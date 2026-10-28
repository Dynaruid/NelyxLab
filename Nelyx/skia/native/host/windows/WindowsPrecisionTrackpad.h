// SPDX-License-Identifier: BSD-3-Clause
// Protocol follows Flutter's Windows DirectManipulation contact/inertia split.
// Copyright 2013 The Flutter Authors. All rights reserved.
// FlutterEngine-LICENSE.md applies to the reference-derived protocol.
#pragma once
#include "WindowsMonotonic.h"
#include "WindowsInputTrace.h"
#include <directmanipulation.h>
#include <commctrl.h>
#include <winrt/base.h>
#include <memory>
#include <optional>
#include <cmath>
#include <algorithm>
#include <atomic>
#include <functional>
#include <string>
#include <stdexcept>
#pragma comment(lib,"comctl32.lib")

namespace RNSkia {
inline bool windowsPrecisionDiagnosticsEnabled(){
  static const bool enabled=[]{wchar_t value[2]{};return GetEnvironmentVariableW(L"NELYX_TRACKPAD_DIAGNOSTICS",value,2)==1&&value[0]==L'1';}();return enabled;
}
inline void windowsPrecisionDiagnostic(std::string const& value)noexcept{
  if(!windowsPrecisionDiagnosticsEnabled())return;
  try{const auto line="NELYX_TRACKPAD "+std::to_string(windowsMonotonicMilliseconds())+" "+value+"\n";DWORD written{};WriteFile(GetStdHandle(STD_ERROR_HANDLE),line.data(),static_cast<DWORD>(line.size()),&written,nullptr);}catch(...){}
}
struct WindowsPrecisionPoint{double x,y,scale;uint64_t generation;};
struct WindowsPrecisionEvent{
  std::string kind;WindowsPrecisionPoint origin;uint32_t pointer;
  double panX=0,panY=0,deltaX=0,deltaY=0,scale=1,timestamp=0;
};
// UI-owned viewport, polled by its HWND timer independently of render demand,
// as in Flutter's Windows embedder. The timer retires when input is idle.
// Framework physics owns momentum. OS inertia is observed only for cancellation.
class WindowsPrecisionTrackpad final : public std::enable_shared_from_this<WindowsPrecisionTrackpad>{
  friend struct WindowsPrecisionTrackpadTest;
  struct Handler final : IDirectManipulationViewportEventHandler,IDirectManipulationInteractionEventHandler{
    std::atomic<ULONG> references{1};
    std::weak_ptr<WindowsPrecisionTrackpad> owner;
    HRESULT __stdcall QueryInterface(REFIID iid,void** result) noexcept override{
      if(!result)return E_POINTER;*result=nullptr;
      if(iid==__uuidof(IUnknown)||iid==__uuidof(IDirectManipulationViewportEventHandler))*result=static_cast<IDirectManipulationViewportEventHandler*>(this);
      else if(iid==__uuidof(IDirectManipulationInteractionEventHandler))*result=static_cast<IDirectManipulationInteractionEventHandler*>(this);
      else return E_NOINTERFACE;
      AddRef();return S_OK;
    }
    ULONG __stdcall AddRef() noexcept override{return ++references;}
    ULONG __stdcall Release() noexcept override{const auto remaining=--references;if(!remaining)delete this;return remaining;}
    HRESULT __stdcall OnViewportStatusChanged(IDirectManipulationViewport*,DIRECTMANIPULATION_STATUS current,DIRECTMANIPULATION_STATUS previous) noexcept override{
      if(auto self=owner.lock())try{self->status(current,previous);}catch(...){self->failure("status-failed",winrt::to_hresult());}return S_OK;
    }
    HRESULT __stdcall OnViewportUpdated(IDirectManipulationViewport*) noexcept override{return S_OK;}
    HRESULT __stdcall OnContentUpdated(IDirectManipulationViewport*,IDirectManipulationContent* content) noexcept override{
      if(auto self=owner.lock())try{float values[6]{};winrt::check_hresult(content->GetContentTransform(values,6));self->content(values);}catch(...){self->failure("content-failed",winrt::to_hresult());}return S_OK;
    }
    HRESULT __stdcall OnInteraction(IDirectManipulationViewport2*,DIRECTMANIPULATION_INTERACTION_TYPE type) noexcept override{
      if(auto self=owner.lock())try{self->interaction(type);}catch(...){self->failure("interaction-failed",winrt::to_hresult());}return S_OK;
    }
  };
public:
  using Map=std::function<std::optional<WindowsPrecisionPoint>(POINT)>;
  using Emit=std::function<void(const WindowsPrecisionEvent&)>;
  static std::shared_ptr<WindowsPrecisionTrackpad> create(HWND window,Map map,Emit emit){
    auto self=std::shared_ptr<WindowsPrecisionTrackpad>(new WindowsPrecisionTrackpad(window,std::move(map),std::move(emit)));
    self->initialize();return self;
  }
  ~WindowsPrecisionTrackpad(){disable();disarm();detach();}
  void cancel(){
    windowsInputTrace(WindowsInputStage::PrecisionInteraction,0,origin?origin->generation:0,pointer,-1,diagnosticFlags(),true);
    trace("cancel");
    const bool active=needsUpdate(),end=running,cancelInertia=inertia;
    running=inertia=interacting=resetting=false;disarm();
    if(end)send("panZoomEnd");if(cancelInertia)send("inertiaCancel");origin.reset();
    if(available&&active){
      // Retire native contacts too: otherwise a new contact can remain in the
      // old RUNNING viewport without another start callback after cancellation.
      resetting=true;winrt::check_hresult(viewport->ReleaseAllContacts());winrt::check_hresult(viewport->Stop());resetTransform();
    }
  }
  bool ownsWheel()const{return available&&origin.has_value()&&(running||inertia);}
  unsigned diagnosticFlags()const noexcept{return unsigned(available)|(unsigned(running)<<1)|(unsigned(inertia)<<2)|(unsigned(interacting)<<3)|(unsigned(resetting)<<4)|(unsigned(armed)<<5)|(unsigned(origin.has_value())<<6);}
private:
  WindowsPrecisionTrackpad(HWND window,Map map,Emit emit):window(window),root(GetAncestor(window,GA_ROOT)),map(std::move(map)),emit(std::move(emit)),pointer(++nextPointer){}
  void initialize(){
    winrt::check_hresult(CoCreateInstance(CLSID_DirectManipulationManager,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(manager.put())));
    winrt::check_hresult(manager->GetUpdateManager(IID_PPV_ARGS(updates.put())));
    winrt::check_hresult(manager->CreateViewport(nullptr,window,IID_PPV_ARGS(viewport.put())));
    auto config=DIRECTMANIPULATION_CONFIGURATION_INTERACTION|DIRECTMANIPULATION_CONFIGURATION_TRANSLATION_X|DIRECTMANIPULATION_CONFIGURATION_TRANSLATION_Y|DIRECTMANIPULATION_CONFIGURATION_SCALING|DIRECTMANIPULATION_CONFIGURATION_TRANSLATION_INERTIA;
    winrt::check_hresult(viewport->ActivateConfiguration(static_cast<DIRECTMANIPULATION_CONFIGURATION>(config)));
    winrt::check_hresult(viewport->SetViewportOptions(DIRECTMANIPULATION_VIEWPORT_OPTIONS_MANUALUPDATE));
    handler.attach(new Handler());handler->owner=weak_from_this();
    winrt::check_hresult(viewport->AddEventHandler(window,handler.get(),&cookie));
    resize();winrt::check_hresult(manager->Activate(window));winrt::check_hresult(viewport->Enable());
    const auto id=reinterpret_cast<UINT_PTR>(this);
    if(!SetWindowSubclass(window,subclass,id,reinterpret_cast<DWORD_PTR>(this)))throw std::runtime_error("Precision input HWND subclass unavailable");
    attached=true;
    if(root!=window){if(!SetWindowSubclass(root,subclass,id,reinterpret_cast<DWORD_PTR>(this)))throw std::runtime_error("Precision input root subclass unavailable");rootAttached=true;}
    available=true;winrt::check_hresult(updates->Update(nullptr));trace("initialized");
  }
  void trace(char const* operation,HRESULT result=S_OK)const noexcept{
    if(!windowsPrecisionDiagnosticsEnabled())return;
    try{windowsPrecisionDiagnostic(std::string(operation)+" pointer="+std::to_string(pointer)+" hr="+std::to_string(static_cast<int32_t>(result))+" status="+std::to_string(lastStatus)+" available="+std::to_string(available)+" running="+std::to_string(running)+" inertia="+std::to_string(inertia)+" interacting="+std::to_string(interacting)+" resetting="+std::to_string(resetting)+" armed="+std::to_string(armed)+" ticks="+std::to_string(ticks)+" content="+std::to_string(contents)+" emitted="+std::to_string(emitted));}catch(...){}
  }
  void failure(char const* operation,HRESULT result)noexcept{windowsInputTrace(WindowsInputStage::PrecisionState,0,0,pointer,double(int32_t(result)),diagnosticFlags(),true);trace(operation,result);disable();}
  void resize(){RECT rect{};if(!GetClientRect(window,&rect))throw std::runtime_error("Precision viewport bounds unavailable");if(rect.right>0&&rect.bottom>0)winrt::check_hresult(viewport->SetViewportRect(&rect));}
  void arm(){if(!armed&&available){
    // Flutter requests 14ms so ordinary Win32 timer granularity yields about
    // 16ms input updates instead of often rounding a 16ms request to 32ms.
    if(!SetTimer(window,reinterpret_cast<UINT_PTR>(this),14,nullptr))throw std::runtime_error("Precision input timer unavailable");
    armed=true;windowsInputTrace(WindowsInputStage::FrameRequested,0,origin?origin->generation:0,pointer,1,diagnosticFlags());
  }}
  void disarm()noexcept{if(armed){KillTimer(window,reinterpret_cast<UINT_PTR>(this));armed=false;}}
  bool needsUpdate()const{return interacting||running||inertia||resetting;}
  bool prepareContact(){
    // Drain the old synthesized reset before SetContact can synchronously
    // report a real RUNNING transition. Its callbacks stay suppressed until
    // Update and GetStatus have confirmed READY, as in the ordinary tick.
    // An unfinished reset leaves this contact to the native wheel fallback.
    if(resetting)update();
    return !resetting;
  }
  void update(){
    windowsInputTrace(WindowsInputStage::PrecisionTick,0,origin?origin->generation:0,pointer,diagnosticFlags(),double(lastStatus));
    if(++ticks%60==0)trace("tick");
    const auto drainedReset=resetSerial;
    winrt::check_hresult(updates->Update(nullptr));
    if(resetting&&resetSerial==drainedReset){
      // ZoomToRect(false) can leave an already-READY viewport unchanged, with
      // no new READY notification. Reconcile after draining the update rather
      // than waiting forever for a callback that need not be emitted.
      DIRECTMANIPULATION_STATUS current{};winrt::check_hresult(viewport->GetStatus(&current));
      if(current==DIRECTMANIPULATION_READY)resetting=false;
    }
    if(needsUpdate())arm();else disarm();
  }
  void interaction(DIRECTMANIPULATION_INTERACTION_TYPE type){
    windowsInputTrace(WindowsInputStage::PrecisionInteraction,0,origin?origin->generation:0,pointer,double(type),diagnosticFlags(),true);
    trace(("interaction-"+std::to_string(type)).c_str());
    if(resetting)return; // Synthesized reset callbacks do not own real input.
    if(type==DIRECTMANIPULATION_INTERACTION_BEGIN)interacting=true;
    else if(type==DIRECTMANIPULATION_INTERACTION_END)interacting=false;
    // A contact can wait before it starts moving; RUNNING alone does not own
    // the manual update lifetime. END also needs a final status drain.
    arm();
  }
  void resetTransform(){
    resetting=true;++resetSerial;lastX=lastY=lastDeltaX=lastDeltaY=0;origin.reset();
    RECT rect{};winrt::check_hresult(viewport->GetViewportRect(&rect));
    winrt::check_hresult(viewport->ZoomToRect(float(rect.left),float(rect.top),float(rect.right),float(rect.bottom),FALSE));
    arm();
  }
  void send(std::string kind,double panX=0,double panY=0,double deltaX=0,double deltaY=0,double scale=1){
    if(origin){++emitted;windowsInputTrace(WindowsInputStage::PrecisionEmit,0,origin->generation,pointer,windowsInputKind(kind),deltaY,kind!="panZoomUpdate");if(kind!="panZoomUpdate"||emitted%32==0)trace(kind.c_str());emit({std::move(kind),*origin,pointer,panX,panY,deltaX,deltaY,scale,windowsMonotonicMilliseconds()});}
  }
  void status(DIRECTMANIPULATION_STATUS current,DIRECTMANIPULATION_STATUS previous){
    windowsInputTrace(WindowsInputStage::PrecisionState,0,origin?origin->generation:0,pointer,double(current),double(unsigned(previous)|(diagnosticFlags()<<16)),true);
    lastStatus=current;trace(("status-from-"+std::to_string(previous)).c_str());
    if(resetting){if(current==DIRECTMANIPULATION_READY)resetting=false;return;}
    if(current==DIRECTMANIPULATION_RUNNING&&!running){
      if(inertia)send("inertiaCancel");inertia=false;
      winrt::com_ptr<IDirectManipulationContent> content;winrt::check_hresult(viewport->GetPrimaryContent(IID_PPV_ARGS(content.put())));
      float values[6]{};winrt::check_hresult(content->GetContentTransform(values,6));initialScale=values[0];initialX=values[4];initialY=values[5];lastX=lastY=lastDeltaX=lastDeltaY=0;
      POINT cursor{};GetCursorPos(&cursor);origin=map(cursor);running=origin.has_value();if(running)send("panZoomStart");arm();
    }else if(previous==DIRECTMANIPULATION_RUNNING){if(running)send("panZoomEnd");running=false;lastDeltaX=lastDeltaY=0;}
    inertia=current==DIRECTMANIPULATION_INERTIA;
    if(current==DIRECTMANIPULATION_READY&&(previous==DIRECTMANIPULATION_RUNNING||previous==DIRECTMANIPULATION_INERTIA)){
      if(previous==DIRECTMANIPULATION_INERTIA&&std::max(std::abs(lastDeltaX),std::abs(lastDeltaY))>.01)send("inertiaCancel");
      resetTransform();
    }
    if(needsUpdate())arm();
  }
  void content(float values[6]){
    windowsInputTrace(WindowsInputStage::PrecisionContent,0,origin?origin->generation:0,pointer,values[4],values[5]);
    if(++contents%32==1)trace("content");
    if(resetting||!origin||!std::isfinite(initialScale)||initialScale<=0)return;
    const auto x=double(values[4]-initialX)/origin->scale,y=double(values[5]-initialY)/origin->scale;
    lastDeltaX=x-lastX;lastDeltaY=y-lastY;lastX=x;lastY=y;
    if(running&&!inertia)send("panZoomUpdate",x,y,lastDeltaX,lastDeltaY,double(values[0])/initialScale);
  }
  void disable()noexcept{available=false;try{cancel();if(viewport)viewport->Disable();}catch(...){} }
  void detach()noexcept{
    available=false;if(handler)handler->owner.reset();
    const auto id=reinterpret_cast<UINT_PTR>(this);if(attached)RemoveWindowSubclass(window,subclass,id);if(rootAttached)RemoveWindowSubclass(root,subclass,id);
    if(viewport){viewport->Disable();if(cookie)viewport->RemoveEventHandler(cookie);viewport->Abandon();}
    if(manager)manager->Deactivate(window);
  }
  static LRESULT CALLBACK subclass(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam,UINT_PTR,DWORD_PTR reference){
    auto* self=reinterpret_cast<WindowsPrecisionTrackpad*>(reference);
    try{
      if(message==WM_TIMER&&hwnd==self->window&&wparam==reinterpret_cast<UINT_PTR>(self)){
        if(self->available&&self->armed){windowsInputTrace(WindowsInputStage::ClockReady,0,0,self->pointer,1,0);self->update();}return 0;
      }
      if(message==DM_POINTERHITTEST&&self->available){POINTER_INPUT_TYPE type{};const auto id=GET_POINTERID_WPARAM(wparam);
        windowsInputTrace(WindowsInputStage::PrecisionInteraction,0,0,id,double(DM_POINTERHITTEST),self->diagnosticFlags(),true);
        self->trace("hittest");
        POINT cursor{};GetCursorPos(&cursor);
        if(GetPointerType(id,&type)&&type==PT_TOUCHPAD&&self->map(cursor)&&self->prepareContact()){
          winrt::check_hresult(self->viewport->SetContact(id));self->update();self->arm();return 0;
        }
      }
      if(message==WM_SIZE&&hwnd==self->window){self->cancel();self->resize();}
      if(message==WM_CANCELMODE||(message==WM_ACTIVATEAPP&&!wparam))self->cancel();
    }catch(...){self->failure("message-failed",winrt::to_hresult());}
    return DefSubclassProc(hwnd,message,wparam,lparam);
  }
  HWND window,root;Map map;Emit emit;uint32_t pointer;
  winrt::com_ptr<IDirectManipulationManager> manager;winrt::com_ptr<IDirectManipulationUpdateManager> updates;winrt::com_ptr<IDirectManipulationViewport> viewport;
  winrt::com_ptr<Handler> handler;DWORD cookie=0;
  std::optional<WindowsPrecisionPoint> origin;
  bool attached=false,rootAttached=false,available=false,running=false,inertia=false,interacting=false,resetting=false,armed=false;
  double initialScale=1,initialX=0,initialY=0,lastX=0,lastY=0,lastDeltaX=0,lastDeltaY=0;
  DIRECTMANIPULATION_STATUS lastStatus=DIRECTMANIPULATION_BUILDING;uint64_t ticks=0,contents=0,emitted=0,resetSerial=0;
  inline static std::atomic<uint32_t> nextPointer{1u<<30};
};
}
