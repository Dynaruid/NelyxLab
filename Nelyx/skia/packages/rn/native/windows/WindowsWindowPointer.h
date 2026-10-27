// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <Windows.h>
#include <commctrl.h>
#include <algorithm>
#include <functional>
#include <map>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>
#include <winrt/Windows.Foundation.h>

namespace RNSkia {
// Native topmost DirectComposition visuals are outside ContentIsland's visual
// input tree. The host's HWNDs still receive ordinary native client input.
// Observe those HWNDs on their UI owner, without pumping any messages.
class WindowsWindowPointer final : public std::enable_shared_from_this<WindowsWindowPointer> {
public:
  enum class Device {Mouse,Pen,Touch};
  enum class Update {Other,LeftButtonReleased,RightButtonReleased,MiddleButtonReleased,XButton1Released,XButton2Released};
  struct Point {
    Device device=Device::Mouse;Update update=Update::Other;uint32_t id=1,buttons=0;float x=0,y=0;uint64_t timestamp=0;int wheel=0;bool horizontal=false,cancelled=false,contact=false;
    auto Position()const{return winrt::Windows::Foundation::Point{x,y};}
    auto Properties()const{return *this;}auto PointerDeviceType()const{return device;}auto PointerUpdateKind()const{return update;}
    auto PointerId()const{return id;}auto Timestamp()const{return timestamp;}
    bool IsCanceled()const{return cancelled;}bool IsInContact()const{return contact;}
    bool IsLeftButtonPressed()const{return buttons&1;}bool IsRightButtonPressed()const{return buttons&2;}
    bool IsBarrelButtonPressed()const{return false;}bool IsMiddleButtonPressed()const{return buttons&4;}
    bool IsXButton1Pressed()const{return buttons&8;}bool IsXButton2Pressed()const{return buttons&16;}
    bool IsHorizontalMouseWheel()const{return horizontal;}int MouseWheelDelta()const{return wheel;}
  };
  using Input=std::function<void(std::string const&,Point const&)>;
  static std::shared_ptr<WindowsWindowPointer> create(HWND window,HWND bridge,std::function<void(std::string)> failed){
    if(!window||!bridge||GetWindowThreadProcessId(window,nullptr)!=GetCurrentThreadId()||GetWindowThreadProcessId(bridge,nullptr)!=GetCurrentThreadId()||!failed)throw std::invalid_argument("Window pointer requires its UI window/bridge");
    auto self=std::shared_ptr<WindowsWindowPointer>(new WindowsWindowPointer(window,std::move(failed)));
    self->watch(window);self->watch(bridge);return self;
  }
  ~WindowsWindowPointer(){close();}
  HWND window()const{return target;}
  std::function<void()> listen(Input input){
    ui();if(closed||observer||!input)throw std::logic_error("Window pointer requires one live window canvas");observer=std::move(input);
    return [weak=weak_from_this()]{if(auto self=weak.lock()){self->ui();self->cancel();self->observer={};}};
  }
  void close(){
    ui();if(closed)return;cancel();observer={};
    for(const auto window:watched)if(IsWindow(window))RemoveWindowSubclass(window,subclass,reinterpret_cast<UINT_PTR>(this));watched.clear();
    closed=true;
  }
private:
  WindowsWindowPointer(HWND value,std::function<void(std::string)> failed):target(value),failed(std::move(failed)){}
  void ui()const{if(GetCurrentThreadId()!=thread)throw std::logic_error("Window pointer requires its UI owner");}
  static LRESULT CALLBACK subclass(HWND window,UINT message,WPARAM wp,LPARAM lp,UINT_PTR id,DWORD_PTR ref){
    const auto self=reinterpret_cast<WindowsWindowPointer*>(ref)->weak_from_this().lock();if(!self)return DefSubclassProc(window,message,wp,lp);
    try{
      if(message==WM_CAPTURECHANGED&&self->capture==window&&reinterpret_cast<HWND>(lp)!=window){self->capture=nullptr;self->cancelMouse();}
      if(message==WM_CANCELMODE)self->cancel();
      if(message==WM_NCDESTROY){self->watched.erase(window);RemoveWindowSubclass(window,subclass,id);}
      if(!self->closed&&self->observer){MSG event{};event.hwnd=window;event.message=message;event.wParam=wp;event.lParam=lp;event.time=static_cast<DWORD>(GetMessageTime());self->message(event);}
    }catch(std::exception const& error){self->failed(error.what());}catch(...){self->failed("Window pointer retirement failed");}
    return DefSubclassProc(window,message,wp,lp);
  }
  void watch(HWND window){if(watched.contains(window))return;if(!SetWindowSubclass(window,subclass,reinterpret_cast<UINT_PTR>(this),reinterpret_cast<DWORD_PTR>(this)))throw std::runtime_error("Window pointer capture observer unavailable");watched.insert(window);}
  void send(std::string const& kind,Point const& point){if(auto callback=observer)callback(kind,point);}
  void cancelMouse(){auto points=active;for(auto& [id,point]:points)if(point.device==Device::Mouse){active.erase(id);point.buttons=0;send("cancel",point);}}
  void cancel(){auto points=std::move(active);active.clear();for(auto& [id,point]:points){point.buttons=0;send("cancel",point);}if(capture&&GetCapture()==capture)ReleaseCapture();capture=nullptr;}
  void message(MSG const& message){
    if(closed||!observer||!message.hwnd||GetAncestor(message.hwnd,GA_ROOT)!=target)return;
    const auto msg=message.message;const auto wp=message.wParam;const auto lp=message.lParam;
    const bool mouse=(msg>=WM_MOUSEFIRST&&msg<=WM_MOUSELAST)||msg==WM_MOUSELEAVE;
    const bool pointer=msg==WM_POINTERDOWN||msg==WM_POINTERUPDATE||msg==WM_POINTERUP||msg==WM_POINTERLEAVE||msg==WM_POINTERCAPTURECHANGED;
    if(!mouse&&!pointer)return;
    if(mouse&&msg!=WM_MOUSEWHEEL&&msg!=WM_MOUSEHWHEEL&&(GetMessageExtraInfo()&0xffffff00)==0xff515700)return; // promoted pen/touch mouse
    Point point;POINT position{};std::string kind;
    const auto now=GetTickCount64();point.timestamp=(now-static_cast<uint32_t>(static_cast<uint32_t>(now)-message.time))*1000;
    if(pointer){
      point.id=LOWORD(wp);if(msg==WM_POINTERCAPTURECHANGED){if(auto found=active.find(point.id);found!=active.end()){point=found->second;active.erase(found);point.buttons=0;send("cancel",point);}return;}
      POINTER_INFO info{};if(!GetPointerInfo(point.id,&info))return;position=info.ptPixelLocation;
      point.device=info.pointerType==PT_PEN?Device::Pen:info.pointerType==PT_TOUCH?Device::Touch:Device::Mouse;
      point.contact=(info.pointerFlags&POINTER_FLAG_INCONTACT)!=0;point.cancelled=(info.pointerFlags&POINTER_FLAG_CANCELED)!=0;
      point.buttons=((info.pointerFlags&POINTER_FLAG_FIRSTBUTTON)?1u:0u)|((info.pointerFlags&POINTER_FLAG_SECONDBUTTON)?2u:0u)|((info.pointerFlags&POINTER_FLAG_THIRDBUTTON)?4u:0u)|((info.pointerFlags&POINTER_FLAG_FOURTHBUTTON)?8u:0u)|((info.pointerFlags&POINTER_FLAG_FIFTHBUTTON)?16u:0u);
      kind=msg==WM_POINTERDOWN?"down":msg==WM_POINTERUP?"up":msg==WM_POINTERLEAVE?"leave":"move";
    }else{
      point.buttons=((wp&MK_LBUTTON)?1u:0u)|((wp&MK_RBUTTON)?2u:0u)|((wp&MK_MBUTTON)?4u:0u)|((wp&MK_XBUTTON1)?8u:0u)|((wp&MK_XBUTTON2)?16u:0u);
      position={static_cast<short>(LOWORD(lp)),static_cast<short>(HIWORD(lp))};
      if(msg==WM_MOUSELEAVE){GetCursorPos(&position);kind="leave";}
      else if(msg==WM_MOUSEWHEEL||msg==WM_MOUSEHWHEEL){kind="wheel";point.wheel=static_cast<short>(HIWORD(wp));point.horizontal=msg==WM_MOUSEHWHEEL;}
      else{if(!ClientToScreen(message.hwnd,&position))return;
        if(msg==WM_LBUTTONDOWN||msg==WM_RBUTTONDOWN||msg==WM_MBUTTONDOWN||msg==WM_XBUTTONDOWN||msg==WM_LBUTTONDBLCLK||msg==WM_RBUTTONDBLCLK||msg==WM_MBUTTONDBLCLK||msg==WM_XBUTTONDBLCLK)kind="down";
        else if(msg==WM_LBUTTONUP||msg==WM_RBUTTONUP||msg==WM_MBUTTONUP||msg==WM_XBUTTONUP){kind="up";point.update=Update::LeftButtonReleased;}
        else kind="move";
      }
      watch(message.hwnd);if(msg==WM_MOUSEMOVE){TRACKMOUSEEVENT track{sizeof(track),TME_LEAVE,message.hwnd,0};TrackMouseEvent(&track);}
    }
    if(!ScreenToClient(target,&position))return;RECT client{};GetClientRect(target,&client);if(active.empty()&&kind!="leave"&&kind!="up"&&!PtInRect(&client,position))return;
    const auto scale=GetDpiForWindow(target)/96.f;point.x=position.x/scale;point.y=position.y/scale;
    if(kind=="down"){active.insert_or_assign(point.id,point);if(point.device==Device::Mouse){capture=message.hwnd;SetCapture(capture);}}
    else if(kind=="up"||point.cancelled)active.erase(point.id);
    else if(active.contains(point.id))active.insert_or_assign(point.id,point);
    send(kind,point);
    if(kind=="up"&&point.device==Device::Mouse&&!point.buttons&&capture){if(GetCapture()==capture)ReleaseCapture();capture=nullptr;}
  }
  const DWORD thread=GetCurrentThreadId();HWND target=nullptr,capture=nullptr;bool closed=false;
  Input observer;std::function<void(std::string)> failed;std::map<uint32_t,Point> active;std::set<HWND> watched;
};
}
