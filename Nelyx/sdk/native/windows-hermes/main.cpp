// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <windowsx.h>
#include <shlwapi.h>
#include <tlhelp32.h>
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <condition_variable>
#include <deque>
#include <filesystem>
#include <fstream>
#include <future>
#include <iostream>
#include <map>
#include <optional>
#include <sstream>
#include "WindowSurface.h"
#include "SemanticsTree.h"
#include "Editors.h"
#include "Keyboard.h"
#include "Services.h"
#include "LoadedIdentity.h"
#include "RuntimeLoop.h"
#include "VmCallbacks.h"
#include "FrameTrace.h"
#include "NativeWheelDriver.h"
#include "MemoryProbe.h"
#include "RNSkVulkanRuntime.h"
#include "rnskia/RNSkView.h"
#include "rnskia/RNSkOwnerAsyncQueue.h"
#include "include/ports/SkTypeface_win.h"
#include "windows/CompositorFrameClock.h"
#include "windows/WindowsMonotonic.h"
#include "windows/WindowsPrecisionTrackpad.h"
#include "InputBatch.h"

extern "C" void C_SetICU(const void*);
namespace jsi=facebook::jsi;
namespace NH=Nelyx::NativeHermes;
using Task=nelyx::host::RuntimeTask;
using namespace std::chrono_literals;
static double now(){return RNSkia::windowsMonotonicMilliseconds();}
static bool flag(wchar_t const* name){wchar_t value[2]{};const auto length=GetEnvironmentVariableW(name,value,2);if(!length)return false;if(length==1&&(value[0]==L'0'||value[0]==L'1'))return value[0]==L'1';throw std::runtime_error("Native diagnostic flags require 0 or 1");}
static std::string readBytes(std::filesystem::path const& file,size_t limit=64*1024*1024){
  auto size=std::filesystem::file_size(file);if(size>limit)throw std::runtime_error("Native input exceeds byte budget");
  std::ifstream stream(file,std::ios::binary);std::string bytes(static_cast<size_t>(size),'\0');if(!stream.read(bytes.data(),bytes.size()))throw std::runtime_error("Native input read failed");return bytes;
}
static std::string utf8(std::wstring_view value){if(value.empty())return {};auto size=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),int(value.size()),nullptr,0,nullptr,nullptr);if(!size)throw std::runtime_error("Invalid UTF-16");std::string result(size,'\0');WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,value.data(),int(value.size()),result.data(),size,nullptr,nullptr);return result;}
static std::wstring utf16(std::string_view value){if(value.empty())return {};auto size=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,value.data(),int(value.size()),nullptr,0);if(!size)throw std::runtime_error("Invalid UTF-8");std::wstring result(size,L'\0');MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,value.data(),int(value.size()),result.data(),size);return result;}

class NativeHost final {
  static constexpr UINT uiMessage=WM_APP+77,doneMessage=WM_APP+78,wheelGuardMessage=WM_APP+79;
  struct Metrics{int width,height,dpi;uint64_t viewport,surface;};
  struct Pointer{std::string kind,device="mouse";double x=0,y=0,dx=0,dy=0,stamp=0,panX=0,panY=0,scale=1;uint32_t pointer=1,buttons=0;uint64_t epoch=0,sequence=0,batch=0;};
public:
  int run(std::filesystem::path bundle,std::filesystem::path root,std::string mode,int duration,int width,int height){
    this->bundle=std::filesystem::absolute(bundle);assetRoot=std::filesystem::canonical(root);this->mode=mode;
    memoryProbe=NH::MemoryProbe(flag(L"NELYX_NATIVE_MEMORY_PROBE"));
    if(flag(L"NELYX_NATIVE_FRAME_TRACE"))trace=std::make_unique<NH::FrameTrace<>>();gcStats=flag(L"NELYX_NATIVE_GC_STATS");sampleProfiling=flag(L"NELYX_NATIVE_CPU_PROFILE");if((gcStats||sampleProfiling)&&!trace)throw std::runtime_error("Native profiling requires NELYX_NATIVE_FRAME_TRACE=1");if(sampleProfiling&&mode!="bytecode")throw std::runtime_error("The sampling diagnostic currently requires bytecode");
    if(memoryProbe.enabled()&&!trace)throw std::runtime_error("Native memory observation requires NELYX_NATIVE_FRAME_TRACE=1");
    loop->uiBarrier([this]{const auto boundary=++inputBatch;return Task([this,boundary](auto& rt){for(;;){auto samples=input.takeBatchIf([&](auto const& p){return p.batch<boundary;},[](auto const& a,auto const& b){return a.batch==b.batch;});if(samples.empty())break;deliverSamples(rt,std::move(samples));}runtimeInputBatch=boundary;});});
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);NH::check(CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED));
    WNDCLASSW cls{};cls.lpfnWndProc=windowProc;cls.hInstance=GetModuleHandleW(nullptr);cls.lpszClassName=L"NelyxHermesHost";cls.hCursor=LoadCursorW(nullptr,MAKEINTRESOURCEW(32512));activeCursor=cls.hCursor;RegisterClassW(&cls);
    window=CreateWindowExW(0,cls.lpszClassName,L"Nelyx Testbed · direct Hermes",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,width,height,nullptr,nullptr,cls.hInstance,this);
    if(!window)throw std::runtime_error("Native window creation failed");
    // Consume a launcher's STARTF_USESHOWWINDOW before first-content reveal.
    ShowWindow(window,SW_HIDE);
    surface=std::make_shared<NH::WindowSurface>(window,[this](auto task){postUi(std::move(task));});updateMetrics();
    semantics=NH::SemanticsTree::create(window,[this](auto action){loop->invokeAsync([this,action=std::move(action)](auto& rt){if(trace)semanticsActions.fetch_add(1,std::memory_order_relaxed);jsi::Object event(rt);event.setProperty(rt,"protocol",1);event.setProperty(rt,"id",jsi::String::createFromUtf8(rt,action.id));event.setProperty(rt,"source",double(action.source));event.setProperty(rt,"commit",double(action.commit));
      if(action.text){auto const& text=*action.text;event.setProperty(rt,"kind",text.kind==Nelyx::WindowsSemantics::TextActionKind::SetText?"set-text":text.kind==Nelyx::WindowsSemantics::TextActionKind::SetSelection?"set-selection":"scroll-range");event.setProperty(rt,"revision",double(text.revision));event.setProperty(rt,"generation",double(text.generation));event.setProperty(rt,"text",jsi::String::createFromUtf8(rt,utf8(text.text)));event.setProperty(rt,"anchor",text.anchor);event.setProperty(rt,"focus",text.focus);event.setProperty(rt,"start",text.anchor);event.setProperty(rt,"end",text.focus);event.setProperty(rt,"alignToTop",text.alignToTop);}else {event.setProperty(rt,"kind",jsi::String::createFromUtf8(rt,action.kind));if(action.value)event.setProperty(rt,"value",*action.value);}emit(rt,"semantics",std::move(event));});},[this](auto task){postUi(std::move(task));});
    semantics->metrics(viewport,surfaceEpoch);editors=std::make_shared<NH::Editors>(window,[this](auto task){postUi(std::move(task));},[this](auto event){loop->invokeAsync([this,event=std::move(event)](auto& rt){emitEditor(rt,event);});});editors->metrics(viewport,surfaceEpoch);keyboard=std::make_unique<NH::Keyboard>(window,editors,[this](auto event){loop->invokeAsync([this,event=std::move(event)](auto& rt){emitKeyboard(rt,event);});});
    precision=RNSkia::WindowsPrecisionTrackpad::create(window,[this](POINT point)->std::optional<RNSkia::WindowsPrecisionPoint>{if(!started||closeRequested||!ScreenToClient(window,&point))return {};const auto scale=dpi.load()/96.;return RNSkia::WindowsPrecisionPoint{point.x/scale,point.y/scale,scale,viewport};},[this](auto const& e){if(!started||closeRequested)return;Pointer p{e.kind,"trackpad",e.origin.x,e.origin.y,e.deltaX,e.deltaY,e.timestamp,e.panX,e.panY,e.scale,e.pointer,0,e.origin.generation,++inputSequence};enqueuePointer(std::move(p));});
    surface->onPresented=[this](uint64_t frame,const auto& id,int width,int height,uint64_t generation){if(trace)trace->surface({frame,id.owner,id.context,id.viewport,id.frame,id.input,id.submission,generation,width,height,now()});if(frame==1&&!closeRequested){ShowWindow(window,SW_SHOWNORMAL);std::cout<<"NELYX_NATIVE_FIRST_FRAME {\"mode\":\""<<this->mode<<"\",\"host\":\"native-hermes\",\"displayed\":\"unobserved\"}"<<std::endl;}};
    thread=std::thread([this]{execute();});if(duration>0)SetTimer(window,1,duration,nullptr);
    MSG message{};for(;;){const auto result=GetMessageW(&message,nullptr,0,0);if(result==0)break;if(result<0){std::cerr<<"NELYX_NATIVE_MESSAGE_ERROR GetMessage failed"<<std::endl;TerminateProcess(GetCurrentProcess(),2);return 2;}
      try{if(wheelDriver&&(message.message>=WM_KEYFIRST&&message.message<=WM_KEYLAST||message.message==WM_POINTERDOWN||message.message==WM_LBUTTONDOWN||message.message==WM_RBUTTONDOWN||message.message==WM_MBUTTONDOWN||message.message==WM_XBUTTONDOWN))++wheelForeign;if(editors&&!closeRequested&&editors->filter(message)){if(keyboard)keyboard->consumed(message);continue;}if(started&&!closeRequested&&keyboard&&message.message!=WM_CHAR)keyboard->flush();TranslateMessage(&message);DispatchMessageW(&message);}
      catch(std::exception const& error){std::cerr<<"NELYX_NATIVE_MESSAGE_ERROR "<<error.what()<<std::endl;exitCode=1;requestClose();}}
    if(thread.joinable())thread.join();const auto frameCount=surface->frames();keyboard.reset();precision.reset();editors->close();semantics->close();editors.reset();semantics.reset();surface->close();surface.reset();DestroyWindow(window);window=nullptr;CoUninitialize();
    std::cout<<"NELYX_NATIVE_EXIT {\"exitCode\":"<<exitCode<<",\"mode\":\""<<mode<<"\",\"runtime\":\"direct-hermes-jsi\",\"displayed\":\"unobserved\",\"surfaceFrames\":"<<frameCount<<",\"inputReceived\":"<<inputSequence<<",\"inputDelivered\":"<<inputDelivered<<",\"inputAccepted\":"<<inputAccepted<<",\"inputRejected\":"<<inputRejected<<",\"wheelReceivedY\":"<<wheelReceivedY<<",\"wheelDeliveredY\":"<<wheelDeliveredY<<"}"<<std::endl;return exitCode;
  }
private:
  void postUi(std::function<void()> task){std::lock_guard lock(uiMutex);if(uiTasks.size()>=4096)throw std::runtime_error("UI queue admission exceeds4096");uiTasks.push_back(std::move(task));if(!PostMessageW(window,uiMessage,0,0))throw std::runtime_error("UI dispatcher stopped");}
  template<class F> auto onUi(F task){using Result=std::invoke_result_t<F>;auto done=std::make_shared<std::promise<Result>>();auto result=done->get_future();postUi([task=std::move(task),done]{try{if constexpr(std::is_void_v<Result>){task();done->set_value();}else done->set_value(task());}catch(...){done->set_exception(std::current_exception());}});if(result.wait_for(10s)!=std::future_status::ready)throw std::runtime_error("Native UI owner timed out");return result.get();}
  Metrics metricsSnapshot()const{return {physicalWidth.load(),physicalHeight.load(),dpi.load(),viewport.load(),surfaceEpoch.load()};}
  void updateMetrics(){if(!window||!surface)return;RECT client{};GetClientRect(window,&client);const auto nextDpi=GetDpiForWindow(window);if(viewport&&physicalWidth==client.right&&physicalHeight==client.bottom&&dpi==nextDpi)return;physicalWidth=client.right;physicalHeight=client.bottom;dpi=nextDpi;surface->resize(client.right,client.bottom);surfaceEpoch=surface->surfaceGeneration();++viewport;
    if(editors)editors->metrics(viewport,surfaceEpoch);
    if(semantics)semantics->metrics(viewport,surfaceEpoch);
    MONITORINFOEXW monitor{};monitor.cbSize=sizeof(monitor);DEVMODEW display{};display.dmSize=sizeof(display);const bool observed=GetMonitorInfoW(MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST),&monitor)&&EnumDisplaySettingsW(monitor.szDevice,ENUM_CURRENT_SETTINGS,&display);
    std::cout<<"NELYX_NATIVE_VIEW {\"physicalWidth\":"<<client.right<<",\"physicalHeight\":"<<client.bottom<<",\"dpi\":"<<nextDpi<<",\"refreshHz\":"<<(observed?display.dmDisplayFrequency:0)<<",\"viewportGeneration\":"<<viewport.load()<<",\"surfaceGeneration\":"<<surfaceEpoch.load()<<"}"<<std::endl;
    if(started){const auto snapshot=metricsSnapshot();loop->invokeAsync([this,snapshot](auto& rt){emit(rt,"metrics",metrics(rt,snapshot));});}}
  jsi::Object metrics(jsi::Runtime& rt){return metrics(rt,onUi([this]{return metricsSnapshot();}));}
  jsi::Object metrics(jsi::Runtime& rt,Metrics const& snapshot){jsi::Object value(rt);auto scale=snapshot.dpi/96.;value.setProperty(rt,"logicalWidth",snapshot.width/scale);value.setProperty(rt,"logicalHeight",snapshot.height/scale);value.setProperty(rt,"physicalWidth",snapshot.width);value.setProperty(rt,"physicalHeight",snapshot.height);value.setProperty(rt,"scale",scale);value.setProperty(rt,"viewportGeneration",double(snapshot.viewport));value.setProperty(rt,"rendererGeneration",1);value.setProperty(rt,"nativeSurfaceGeneration",double(snapshot.surface));return value;}
  jsi::Value emit(jsi::Runtime& rt,const char* kind,jsi::Value value){return events?events->call(rt,jsi::String::createFromAscii(rt,kind),std::move(value)):jsi::Value::undefined();}
  void emitEditor(jsi::Runtime& rt,NH::Editors::Event const& e){jsi::Object value(rt);value.setProperty(rt,"id",jsi::String::createFromUtf8(rt,e.id));value.setProperty(rt,"generation",double(e.generation));value.setProperty(rt,"kind",jsi::String::createFromUtf8(rt,e.kind));
    if(e.kind=="editing"){auto const& state=e.editing.value;value.setProperty(rt,"text",jsi::String::createFromUtf8(rt,utf8(state.text)));value.setProperty(rt,"anchor",state.selection.anchor);value.setProperty(rt,"focus",state.selection.focus);value.setProperty(rt,"revision",double(state.revision));value.setProperty(rt,"source",e.editing.programmatic?"programmatic":"native");value.setProperty(rt,"composingStart",state.composing.start);value.setProperty(rt,"composingEnd",state.composing.end);value.setProperty(rt,"focused",state.focused);if(e.editing.request)value.setProperty(rt,"request",double(*e.editing.request));if(!e.editing.rejection.empty())value.setProperty(rt,"rejection",jsi::String::createFromUtf8(rt,e.editing.rejection));}
    else{value.setProperty(rt,"start",e.start);value.setProperty(rt,"end",e.end);value.setProperty(rt,"layoutEpoch",double(e.epoch));value.setProperty(rt,"nativeRevision",double(e.revision));value.setProperty(rt,"request",double(e.request));auto origin=onUi([this]{POINT point{};ClientToScreen(window,&point);return point;});const auto scale=dpi.load()/96.;jsi::Object point(rt);point.setProperty(rt,"x",(e.point.x-origin.x)/scale);point.setProperty(rt,"y",(e.point.y-origin.y)/scale);value.setProperty(rt,"point",std::move(point));jsi::Object options(rt);options.setProperty(rt,"nearest",bool(e.flags&GXFPF_NEAREST));options.setProperty(rt,"roundNearest",bool(e.flags&GXFPF_ROUND_NEAREST));value.setProperty(rt,"options",std::move(options));}
    emit(rt,"editor",std::move(value));
  }
  void finishNativeWheel(){if(wheelDriver){wheelDriver->stop();wheelDriver.reset();}POINT current{};if(savedWheelCursor&&GetCursorPos(&current)&&current.x==wheelPoint.x&&current.y==wheelPoint.y)SetCursorPos(savedWheelCursor->x,savedWheelCursor->y);savedWheelCursor.reset();}
  void parkDiagnosticCursor(){
    if(!trace||closeRequested||wheelDriver||mouseHeld||GetForegroundWindow()!=window)throw std::runtime_error("Diagnostic cursor requires an idle owned foreground window");
    POINT current{};if(!GetCursorPos(&current))throw std::runtime_error("Diagnostic cursor observation failed");
    if(savedDiagnosticCursor&&(current.x!=diagnosticPoint.x||current.y!=diagnosticPoint.y))throw std::runtime_error("Desktop pointer moved after diagnostic cursor parking");
    TITLEBARINFO title{};title.cbSize=sizeof(title);if(!GetTitleBarInfo(window,&title)||IsRectEmpty(&title.rcTitleBar))throw std::runtime_error("Owned diagnostic caption unavailable");
    POINT target{title.rcTitleBar.left+(title.rcTitleBar.right-title.rcTitleBar.left)/2,title.rcTitleBar.top+(title.rcTitleBar.bottom-title.rcTitleBar.top)/2},client=target;RECT bounds{};
    if(!ScreenToClient(window,&client)||!GetClientRect(window,&bounds)||PtInRect(&bounds,client)||GetAncestor(WindowFromPoint(target),GA_ROOT)!=window)throw std::runtime_error("Owned diagnostic caption is not visible outside its client");
    if(savedDiagnosticCursor&&current.x==target.x&&current.y==target.y)return;
    if(!SetCursorPos(target.x,target.y))throw std::runtime_error("Diagnostic cursor parking failed");
    if(!savedDiagnosticCursor)savedDiagnosticCursor=current;diagnosticPoint=target;
  }
  void restoreDiagnosticCursor(){POINT current{};if(savedDiagnosticCursor&&GetCursorPos(&current)&&current.x==diagnosticPoint.x&&current.y==diagnosticPoint.y)SetCursorPos(savedDiagnosticCursor->x,savedDiagnosticCursor->y);savedDiagnosticCursor.reset();}
  void requestClose(){if(closeRequested.exchange(true))return;finishNativeWheel();restoreDiagnosticCursor();if(precision)precision->cancel();input.seal();loop->closeAfterPending([this](auto& rt){closing=true;if(events)emit(rt,"close",jsi::Value::undefined());else finished=true;});}
  void pointer(const char* kind,int x,int y,int buttons,double dx=0,double dy=0){if(!started||closeRequested)return;const double stamp=now(),scale=dpi.load()/96.;const auto epoch=viewport.load(),sequence=++inputSequence;
    enqueuePointer(Pointer{kind,"mouse",x/scale,y/scale,dx,dy,stamp,0,0,1,0,uint32_t(buttons),epoch,sequence});}
  void cancelPointers(){
    if(mouseHeld){mouseHeld=0;pointer("cancel",lastMouse.x,lastMouse.y,0);if(GetCapture()==window)ReleaseCapture();}
    auto cancelled=std::move(contacts);contacts.clear();for(auto& [id,p]:cancelled){if(!started||closeRequested)continue;p.kind="cancel";p.buttons=0;p.stamp=now();p.sequence=++inputSequence;enqueuePointer(std::move(p));}
  }
  void cancelContact(uint32_t id){auto found=contacts.find(id);if(found==contacts.end())return;auto p=found->second;contacts.erase(found);if(!started||closeRequested)return;p.kind="cancel";p.buttons=0;p.stamp=now();p.sequence=++inputSequence;enqueuePointer(std::move(p));}
  void enqueuePointer(Pointer p){p.batch=inputBatch;if(p.kind=="wheel")wheelReceivedY+=p.dy;if(input.push(std::move(p)))loop->invokeInput([this](auto& rt){deliverInput(rt);});}
  void deliverSamples(jsi::Runtime& rt,std::vector<Pointer> samples){for(auto const& p:samples){
    if(closing)continue;const auto began=trace?now():0.;jsi::Object value(rt);value.setProperty(rt,"kind",jsi::String::createFromUtf8(rt,p.kind));value.setProperty(rt,"pointer",double(p.pointer));value.setProperty(rt,"device",jsi::String::createFromUtf8(rt,p.device));value.setProperty(rt,"x",p.x);value.setProperty(rt,"y",p.y);value.setProperty(rt,"buttons",double(p.buttons));value.setProperty(rt,"timestamp",p.stamp);value.setProperty(rt,"oldestTimestamp",p.stamp);value.setProperty(rt,"latestTimestamp",p.stamp);value.setProperty(rt,"deltaX",p.dx);value.setProperty(rt,"deltaY",p.dy);value.setProperty(rt,"panX",p.panX);value.setProperty(rt,"panY",p.panY);value.setProperty(rt,"scale",p.scale);value.setProperty(rt,"rotation",0);value.setProperty(rt,"viewportGeneration",double(p.epoch));value.setProperty(rt,"inputSequence",double(p.sequence));++inputDelivered;if(p.kind=="wheel"){wheelDeliveredY+=p.dy;if(memoryProbe.enabled())memoryWheelDeliveredAbsoluteY+=std::abs(p.dy);}auto accepted=emit(rt,"pointer",std::move(value));const bool admitted=accepted.isBool()&&accepted.getBool();if(admitted)++inputAccepted;else ++inputRejected;if(trace){const char* kinds[]{"hover","down","move","up","wheel","cancel","leave","panZoomStart","panZoomUpdate","panZoomEnd","inertiaCancel"};int kind=0;while(kind<11&&p.kind!=kinds[kind])++kind;trace->input({p.sequence,admitted?inputAccepted:0,p.epoch,kind,p.stamp,began,now(),p.dx,p.dy,admitted});}}}
  void deliverInput(jsi::Runtime& rt){deliverSamples(rt,input.takeBatchIf([this](auto const& p){return p.batch<=runtimeInputBatch;},[](auto const& first,auto const& next){return first.batch==next.batch;}));
    if(input.finish())loop->invokeInput([this](auto& rt){deliverInput(rt);});
  }
  bool contact(UINT message,WPARAM w){if(!started||closeRequested)return false;const auto id=GET_POINTERID_WPARAM(w);POINTER_INFO latest{};if(!GetPointerInfo(id,&latest)||latest.pointerType!=PT_TOUCH&&latest.pointerType!=PT_PEN)return false;
    std::vector<POINTER_INFO> history{latest};if(message==WM_POINTERUPDATE&&latest.historyCount>1){if(latest.historyCount>256)throw std::runtime_error("Native pointer history exceeds256");history.resize(latest.historyCount);UINT count=UINT(history.size());if(!GetPointerInfoHistory(id,&count,history.data())||count!=history.size())throw std::runtime_error("Native pointer history was not fully delivered");}
    LARGE_INTEGER frequency{};if(!QueryPerformanceFrequency(&frequency))throw std::runtime_error("Native pointer clock unavailable");for(auto it=history.rbegin();it!=history.rend();++it){auto const& point=*it;POINT position=point.ptPixelLocation;if(!ScreenToClient(window,&position))throw std::runtime_error("Native pointer coordinates unavailable");const auto scale=dpi.load()/96.;Pointer p;p.pointer=id+1;p.device=point.pointerType==PT_TOUCH?"touch":"pen";p.kind=point.pointerFlags&POINTER_FLAG_CANCELED?"cancel":message==WM_POINTERDOWN?"down":message==WM_POINTERUP?"up":point.pointerFlags&POINTER_FLAG_INCONTACT?"move":"hover";p.x=position.x/scale;p.y=position.y/scale;p.buttons=point.pointerFlags&POINTER_FLAG_INCONTACT?1:0;if(point.pointerFlags&POINTER_FLAG_SECONDBUTTON)p.buttons|=2;p.stamp=point.PerformanceCount?double(point.PerformanceCount)*1000./frequency.QuadPart:now();p.epoch=viewport;p.sequence=++inputSequence;if(p.kind=="down"||p.kind=="move")contacts[id]=p;else if(p.kind=="up"||p.kind=="cancel")contacts.erase(id);enqueuePointer(std::move(p));}return true;
  }
  static uint32_t mouseButtons(WPARAM w){return (w&MK_LBUTTON?1:0)|(w&MK_RBUTTON?2:0)|(w&MK_MBUTTON?4:0)|(w&MK_XBUTTON1?8:0)|(w&MK_XBUTTON2?16:0);}
  static LRESULT CALLBACK windowProc(HWND hwnd,UINT message,WPARAM w,LPARAM l){auto self=reinterpret_cast<NativeHost*>(GetWindowLongPtrW(hwnd,GWLP_USERDATA));if(message==WM_NCCREATE){self=static_cast<NativeHost*>(reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);SetWindowLongPtrW(hwnd,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(self));self->window=hwnd;}if(!self)return DefWindowProcW(hwnd,message,w,l);
    if(self->trace)switch(message){case WM_KEYDOWN:case WM_KEYUP:case WM_SYSKEYDOWN:case WM_SYSKEYUP:case WM_CHAR:case WM_SYSCHAR:case WM_DEADCHAR:case WM_SYSDEADCHAR:case WM_UNICHAR:case WM_IME_CHAR:case WM_IME_STARTCOMPOSITION:case WM_IME_COMPOSITION:case WM_IME_ENDCOMPOSITION:++self->keyboardMessages;break;default:break;}
    try{switch(message){
      case uiMessage:{const auto sending=InSendMessageEx(nullptr);if((sending&ISMEX_SEND)&&!(sending&ISMEX_REPLIED)){if(!PostMessageW(hwnd,uiMessage,0,0))throw std::runtime_error("UI dispatcher stopped");return 0;}std::deque<std::function<void()>> tasks;{std::lock_guard lock(self->uiMutex);tasks.swap(self->uiTasks);}for(auto& task:tasks)task();return 0;}
      case doneMessage:PostQuitMessage(self->exitCode);return 0;
      case wheelGuardMessage:{if(!self->wheelDriver||self->closeRequested||LONG_PTR(w)!=self->wheelCookie||GetForegroundWindow()!=hwnd)return 0;POINT cursor{};return GetCursorPos(&cursor)&&cursor.x==self->wheelPoint.x&&cursor.y==self->wheelPoint.y&&GetAncestor(WindowFromPoint(cursor),GA_ROOT)==hwnd;}
      case NH::memoryProbeMessage:{
        if(!self->memoryProbe.enabled())return 0;
        const auto contains=[&](char const* id){return self->semantics&&std::find(self->semantics->order.begin(),self->semantics->order.end(),id)!=self->semantics->order.end();};
        const bool ready=self->started&&!self->closeRequested&&GetForegroundWindow()==hwnd&&::GetFocus()==hwnd&&contains("show-list-view")&&!contains("list-view-back");
        if(!self->memoryProbe.admit(w,l,ready))return 0;
        const auto cycle=uint32_t(w);const auto input=self->inputSequence,keys=self->keyboardMessages,focus=self->focusChanges,viewport=self->viewport.load(),surface=self->surfaceEpoch.load();
        const auto width=self->physicalWidth.load(),height=self->physicalHeight.load(),dpi=self->dpi.load();
        const auto wheelCount=self->memoryWheelReceived,wheelAbsolute=self->memoryWheelAbsolute,wheelForeign=self->memoryWheelForeign;const auto wheelNet=self->memoryWheelNet;
        self->loop->invokeAsync([self,cycle,input,keys,focus,viewport,surface,width,height,dpi,wheelCount,wheelAbsolute,wheelForeign,wheelNet](auto& rt){
          if(self->closing)throw std::runtime_error("Native memory probe reached closing runtime");
          auto device=self->memoryDevice.lock();if(!device)throw std::runtime_error("Native memory probe has no live Vulkan device");
          const auto heap=rt.instrumentation().getHeapInfo(false);const auto process=NH::currentProcessMemory();const auto gpu=device->allocations();
          // This is actual allocator ownership, including imported Win32 memory,
          // rather than a GPU Process Memory performance-counter estimate.
          std::ostringstream out;out<<"NELYX_NATIVE_MEMORY {\"schema\":1,\"scope\":\"process-private-commit-and-vulkan-allocations\",\"cycle\":"<<cycle<<",\"pid\":"<<GetCurrentProcessId()<<",\"mode\":\""<<self->mode<<"\",\"privateBytes\":"<<process.privateBytes<<",\"vmAllocatedBytes\":"<<heap.at("hermes_allocatedBytes")<<",\"vmCapacityBytes\":"<<heap.at("hermes_heapSize")<<",\"vmExternalBytes\":"<<heap.at("hermes_externalBytes")<<",\"vmTotalAllocatedBytes\":"<<heap.at("hermes_totalAllocatedBytes")<<",\"vmCollections\":"<<heap.at("hermes_numCollections")<<",\"vmFullCollections\":"<<heap.at("hermes_full_numCollections")<<",\"vmYoungCollections\":"<<heap.at("hermes_yg_numCollections")<<",\"vmPeakLiveAfterGcBytes\":"<<heap.at("hermes_peakLiveAfterGC")<<",\"workingSetBytes\":"<<process.workingSetBytes<<",\"peakPrivateBytes\":"<<process.peakPrivateBytes<<",\"vulkanAllocationCount\":"<<gpu.first<<",\"vulkanAllocationBytes\":"<<gpu.second<<",\"inputReceived\":"<<input<<",\"wheelReceived\":"<<wheelCount<<",\"wheelRawNet\":"<<wheelNet<<",\"wheelRawAbsolute\":"<<wheelAbsolute<<",\"wheelForeign\":"<<wheelForeign<<",\"wheelDeliveredY\":"<<self->wheelDeliveredY<<",\"wheelDeliveredAbsoluteY\":"<<self->memoryWheelDeliveredAbsoluteY<<",\"inputDelivered\":"<<self->inputDelivered<<",\"inputAccepted\":"<<self->inputAccepted<<",\"inputRejected\":"<<self->inputRejected<<",\"keyboardMessages\":"<<keys<<",\"focusChanges\":"<<focus<<",\"viewportGeneration\":"<<viewport<<",\"surfaceGeneration\":"<<surface<<",\"physicalWidth\":"<<width<<",\"physicalHeight\":"<<height<<",\"dpi\":"<<dpi<<",\"returnedToGallery\":true,\"windowFocused\":true,\"foreground\":true,\"performanceAccepted\":false,\"physicalInputAccepted\":\"notVerified\",\"displayed\":\"unobserved\"}\n";std::cout<<out.str()<<std::flush;
        });return 1;
      }
      case WM_CLOSE:self->requestClose();return 0;
      case WM_TIMER:if(w==1){KillTimer(hwnd,1);self->requestClose();}else if(self->editors)self->editors->timer(w);return 0;
      case WM_GETOBJECT:if(l==UiaRootObjectId&&!self->closeRequested&&self->semantics&&!self->semantics->closed)return UiaReturnRawElementProvider(hwnd,w,l,self->semantics->root.Get());break;
      case WM_DESTROY:UiaReturnRawElementProvider(hwnd,0,0,nullptr);break;
      case WM_SETCURSOR:if(self->started&&LOWORD(l)==HTCLIENT){SetCursor(self->activeCursor);return TRUE;}break;
      case WM_MOVE:if(self->editors)self->editors->moved();if(self->semantics)++self->semantics->coordinates;break;
      case WM_SETFOCUS:++self->focusChanges;if(self->started&&self->keyboard)self->keyboard->focus(true);break;
      case WM_KILLFOCUS:++self->focusChanges;self->cancelPointers();if(self->editors)self->editors->focusLost();if(self->started&&self->keyboard)self->keyboard->focus(false);break;
      case WM_KEYDOWN:case WM_KEYUP:case WM_SYSKEYDOWN:case WM_SYSKEYUP:if(self->started&&!self->closeRequested&&self->keyboard)self->keyboard->key(UINT(w),l,message==WM_KEYUP||message==WM_SYSKEYUP);break;
      case WM_CHAR:if(self->started&&!self->closeRequested&&self->keyboard)self->keyboard->character(UINT(w),l);return 0;
      case WM_IME_CHAR:case WM_DEADCHAR:return 0;
      case WM_SIZE:self->cancelPointers();self->updateMetrics();if(self->started)self->loop->invokeAsync([self,visible=w!=SIZE_MINIMIZED&&IsWindowVisible(hwnd)](auto& rt){self->emit(rt,"visibility",jsi::Value(visible));});return 0;
      case WM_DPICHANGED:{auto rect=reinterpret_cast<RECT*>(l);SetWindowPos(hwnd,nullptr,rect->left,rect->top,rect->right-rect->left,rect->bottom-rect->top,SWP_NOZORDER|SWP_NOACTIVATE);self->updateMetrics();return 0;}
      case WM_POINTERDOWN:case WM_POINTERUP:case WM_POINTERUPDATE:if(self->contact(message,w))return 0;break;
      case WM_POINTERCAPTURECHANGED:self->cancelContact(GET_POINTERID_WPARAM(w));break;
      case WM_LBUTTONDOWN:case WM_RBUTTONDOWN:case WM_MBUTTONDOWN:case WM_XBUTTONDOWN:{if((GetMessageExtraInfo()&0xffffff00)==0xff515700)return 0;const auto previous=self->mouseHeld;self->mouseHeld=mouseButtons(w);self->lastMouse={GET_X_LPARAM(l),GET_Y_LPARAM(l)};SetFocus(hwnd);SetCapture(hwnd);self->pointer(previous?"move":"down",self->lastMouse.x,self->lastMouse.y,self->mouseHeld);return 0;}
      case WM_LBUTTONUP:case WM_RBUTTONUP:case WM_MBUTTONUP:case WM_XBUTTONUP:if((GetMessageExtraInfo()&0xffffff00)==0xff515700)return 0;self->mouseHeld=mouseButtons(w);self->lastMouse={GET_X_LPARAM(l),GET_Y_LPARAM(l)};self->pointer(self->mouseHeld?"move":"up",self->lastMouse.x,self->lastMouse.y,self->mouseHeld);if(!self->mouseHeld)ReleaseCapture();return 0;
      case WM_MOUSEMOVE:if((GetMessageExtraInfo()&0xffffff00)==0xff515700)return 0;self->lastMouse={GET_X_LPARAM(l),GET_Y_LPARAM(l)};if(!self->trackingMouse){TRACKMOUSEEVENT tracking{sizeof(tracking),TME_LEAVE,hwnd,0};self->trackingMouse=TrackMouseEvent(&tracking)!=FALSE;}self->pointer(mouseButtons(w)?"move":"hover",self->lastMouse.x,self->lastMouse.y,mouseButtons(w));return 0;
      case WM_MOUSELEAVE:self->trackingMouse=false;self->pointer("leave",self->lastMouse.x,self->lastMouse.y,self->mouseHeld);return 0;
      case WM_CANCELMODE:self->cancelPointers();return 0;
      case WM_CAPTURECHANGED:if(self->mouseHeld&&reinterpret_cast<HWND>(l)!=hwnd){self->mouseHeld=0;self->pointer("cancel",self->lastMouse.x,self->lastMouse.y,0);}return 0;
      case WM_MOUSEWHEEL:case WM_MOUSEHWHEEL:{if(self->memoryProbe.enabled()&&message==WM_MOUSEWHEEL){const auto delta=GET_WHEEL_DELTA_WPARAM(w);++self->memoryWheelReceived;self->memoryWheelNet+=delta;self->memoryWheelAbsolute+=std::abs(delta);if(ULONG_PTR(GetMessageExtraInfo())!=NH::memoryProbeWheelCookie)++self->memoryWheelForeign;}if(self->wheelDriver){self->wheelObserved=uint32_t(ULONG_PTR(GetMessageExtraInfo()));if(message!=WM_MOUSEWHEEL||LONG_PTR(self->wheelObserved)!=self->wheelCookie)++self->wheelForeign;else{++self->wheelReceived;self->wheelNet+=GET_WHEEL_DELTA_WPARAM(w);self->wheelAbsolute+=std::abs(GET_WHEEL_DELTA_WPARAM(w));}}if(self->precision&&self->precision->ownsWheel())return 0;POINT point{GET_X_LPARAM(l),GET_Y_LPARAM(l)};ScreenToClient(hwnd,&point);const double delta=GET_WHEEL_DELTA_WPARAM(w)/120.*48.;self->pointer("wheel",point.x,point.y,0,message==WM_MOUSEHWHEEL?delta:0,message==WM_MOUSEWHEEL?-delta:0);return 0;}
      case WM_SHOWWINDOW:if(!w)self->cancelPointers();if(self->started)self->loop->invokeAsync([self,shown=bool(w)&&!IsIconic(hwnd)](auto& rt){self->emit(rt,"visibility",jsi::Value(shown));});break;
    }}catch(std::exception const& error){std::cerr<<"NELYX_NATIVE_UI_ERROR "<<error.what()<<std::endl;self->exitCode=1;self->requestClose();}
    return DefWindowProcW(hwnd,message,w,l);
  }
  void emitKeyboard(jsi::Runtime& rt,NH::Keyboard::Event const& e){jsi::Object value(rt);value.setProperty(rt,"protocol",1);value.setProperty(rt,"sequence",double(e.sequence));value.setProperty(rt,"viewGeneration",1);value.setProperty(rt,"timestamp",e.timestamp);if(e.kind=="native-keyboard-focus")value.setProperty(rt,"focused",e.focused);else{auto const& k=e.key;value.setProperty(rt,"kind",k.up?"up":"down");value.setProperty(rt,"keyCode",double(k.keyCode));value.setProperty(rt,"scanCode",double(k.scanCode));value.setProperty(rt,"characterCodePoint",double(k.characterCodePoint));value.setProperty(rt,"modifiers",double(k.modifiers));value.setProperty(rt,"repeatCount",double(k.repeatCount));value.setProperty(rt,"focusEpoch",double(k.focusEpoch));value.setProperty(rt,"repeat",k.repeat);value.setProperty(rt,"dead",k.dead);value.setProperty(rt,"capsLock",k.capsLock);value.setProperty(rt,"numLock",k.numLock);value.setProperty(rt,"scrollLock",k.scrollLock);}emit(rt,e.kind.c_str(),std::move(value));}
  void install(jsi::Runtime& rt){
    jsi::Object api(rt);api.setProperty(rt,"abi",2);jsi::Object capabilities(rt);for(auto name:{"vm","services","editing","semantics"})capabilities.setProperty(rt,name,1);api.setProperty(rt,"capabilities",std::move(capabilities));api.setProperty(rt,"mode",jsi::String::createFromUtf8(rt,mode));api.setProperty(rt,"assetRoot",jsi::String::createFromUtf8(rt,utf8(assetRoot.wstring())));api.setProperty(rt,"diagnostics",GetEnvironmentVariableW(L"NELYX_NATIVE_DIAGNOSTICS",nullptr,0)>0);
    auto method=[&](const char* name,size_t arity,jsi::HostFunctionType call){api.setProperty(rt,name,jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,name),arity,std::move(call)));};
    method("now",0,[](auto&,auto const&,auto*,size_t){return jsi::Value(now());});
    method("metrics",0,[this](auto& rt,auto const&,auto*,size_t){return metrics(rt);});
    if(trace){
      wchar_t probeViewport[16]{};const auto probeLength=GetEnvironmentVariableW(L"NELYX_NATIVE_PROBE_VIEWPORT",probeViewport,16);if(probeLength>=16||probeLength&&std::wstring_view(probeViewport)!=L"default"&&std::wstring_view(probeViewport)!=L"maximized")throw std::runtime_error("Choose a default or maximized native probe viewport");api.setProperty(rt,"probeViewport",jsi::String::createFromUtf8(rt,probeLength?utf8(probeViewport):"default"));
      method("startNativeWheel",1,[this](auto& rt,auto const&,auto* args,size_t count){
        if(count!=1)throw jsi::JSError(rt,"A bounded native wheel plan is required");NH::Packet p(rt,jsi::Value(rt,args[0]));const auto integer=[&](char const* name,int minimum,int maximum){const auto value=p.field(name).number();if(value<minimum||value>maximum||value!=std::floor(value))p.fail();return int(value);};const NH::NativeWheelPlan plan{integer("delta",-120,120),integer("count",1,8192),integer("interval",1,1000),p.field("sweep").boolean()};plan.validate();const auto x=p.field("x").number(),y=p.field("y").number();
        onUi([this,x,y,plan]{if(wheelDriver||closeRequested||GetForegroundWindow()!=window||mouseHeld)throw std::runtime_error("Native wheel requires an idle owned foreground window");const auto scale=dpi.load()/96.;if(x<0||y<0||x>=physicalWidth/scale||y>=physicalHeight/scale)throw std::runtime_error("Native wheel point is outside its client viewport");POINT point{LONG(std::round(x*scale)),LONG(std::round(y*scale))},original{};if(!ClientToScreen(window,&point)||GetAncestor(WindowFromPoint(point),GA_ROOT)!=window||!GetCursorPos(&original))throw std::runtime_error("Native wheel target is not visible in its owned window");savedWheelCursor=original;wheelPoint=point;if(!SetCursorPos(point.x,point.y))throw std::runtime_error("Native wheel cursor placement failed");wheelReceived=wheelForeign=0;wheelNet=wheelAbsolute=0;wheelObserved=0;wheelCookie=LONG_PTR(0x4e000000u|((GetCurrentProcessId()*2654435761u+uint32_t(++wheelEpoch))&0x00ffffffu));const auto target=window;const auto cookie=wheelCookie;
          wheelDriver=std::make_unique<NH::NativeWheelDriver>(plan,[target,point,cookie](int delta){POINT cursor{};DWORD_PTR allowed=0;if(GetForegroundWindow()!=target||!SendMessageTimeoutW(target,wheelGuardMessage,WPARAM(cookie),0,SMTO_ABORTIFHUNG|SMTO_BLOCK,20,&allowed)||!allowed)throw std::runtime_error("Owned native wheel target lost foreground or visibility");if(!GetCursorPos(&cursor)||cursor.x!=point.x||cursor.y!=point.y)throw std::runtime_error("Desktop pointer moved during native wheel injection");for(const auto key:{VK_CONTROL,VK_SHIFT,VK_MENU,VK_LWIN,VK_RWIN,VK_LBUTTON,VK_RBUTTON,VK_MBUTTON})if(GetAsyncKeyState(key)&0x8000)throw std::runtime_error("Desktop buttons or modifiers intruded during native wheel injection");INPUT input{};input.type=INPUT_MOUSE;input.mi.dwFlags=MOUSEEVENTF_WHEEL;input.mi.mouseData=DWORD(delta);input.mi.dwExtraInfo=ULONG_PTR(cookie);if(SendInput(1,&input,sizeof(input))!=1)throw std::runtime_error("OS rejected native wheel injection");});});return jsi::Value::undefined();
      });
      method("nativeWheelState",0,[this](auto& rt,auto const&,auto*,size_t){struct State{NH::NativeWheelDriver::Snapshot sender;int received=0,foreign=0;int64_t net=0,absolute=0;uint32_t expected=0,observed=0;};const auto state=onUi([this]{if(!wheelDriver)throw std::runtime_error("No native wheel driver is active");return State{wheelDriver->snapshot(),wheelReceived,wheelForeign,wheelNet,wheelAbsolute,uint32_t(wheelCookie),wheelObserved};});jsi::Object value(rt);value.setProperty(rt,"done",state.sender.done);value.setProperty(rt,"emitted",state.sender.emitted);value.setProperty(rt,"sentRaw",double(state.sender.net));value.setProperty(rt,"sentAbsoluteRaw",double(state.sender.absolute));value.setProperty(rt,"received",state.received);value.setProperty(rt,"receivedRaw",double(state.net));value.setProperty(rt,"receivedAbsoluteRaw",double(state.absolute));value.setProperty(rt,"foreign",state.foreign);value.setProperty(rt,"expectedCookie",double(state.expected));value.setProperty(rt,"observedCookie",double(state.observed));value.setProperty(rt,"error",jsi::String::createFromUtf8(rt,state.sender.error));value.setProperty(rt,"pacingPolicy","high-resolution-relative-start-completion-v1");value.setProperty(rt,"sendP50",state.sender.p50);value.setProperty(rt,"sendP95",state.sender.p95);value.setProperty(rt,"sendMax",state.sender.maximum);return value;});
      method("stopNativeWheel",0,[this](auto&,auto const&,auto*,size_t){onUi([this]{if(wheelDriver)wheelDriver->requestStop();});return jsi::Value::undefined();});
      method("finishNativeWheel",0,[this](auto&,auto const&,auto*,size_t){onUi([this]{finishNativeWheel();});return jsi::Value::undefined();});
      method("diagnosticWindow",1,[this](auto& rt,auto const&,auto* args,size_t count){if(count!=1||!args[0].isString())throw jsi::JSError(rt,"Choose maximize or restore");auto mode=args[0].getString(rt).utf8(rt);if(mode!="maximize"&&mode!="restore")throw jsi::JSError(rt,"Choose maximize or restore");const auto snapshot=onUi([this,mode]{ShowWindow(window,mode=="maximize"?SW_MAXIMIZE:SW_RESTORE);SetForegroundWindow(window);return metricsSnapshot();});return metrics(rt,snapshot);});
      method("diagnosticParkCursor",0,[this](auto&,auto const&,auto*,size_t){onUi([this]{parkDiagnosticCursor();});return jsi::Value::undefined();});
      method("diagnosticState",0,[this](auto& rt,auto const&,auto*,size_t){struct State{bool focused=false,foreground=false;uint64_t focusChanges=0,keyboardMessages=0,semanticsActions=0;bool cursorParked=false;DWORD lastInput=0;HRESULT focusResult=S_OK;std::vector<std::string> focusedIds;std::string providerFocus;};auto s=onUi([this]{State s;s.focused=::GetFocus()==window;s.foreground=GetForegroundWindow()==window;s.focusChanges=focusChanges;s.keyboardMessages=keyboardMessages;s.semanticsActions=semanticsActions.load(std::memory_order_relaxed);POINT cursor{};s.cursorParked=savedDiagnosticCursor&&GetCursorPos(&cursor)&&cursor.x==diagnosticPoint.x&&cursor.y==diagnosticPoint.y;LASTINPUTINFO input{};input.cbSize=sizeof(input);if(!GetLastInputInfo(&input))throw std::runtime_error("Desktop input observation unavailable");s.lastInput=input.dwTime;Microsoft::WRL::ComPtr<IRawElementProviderFragment> focused;s.focusResult=semantics->root->GetFocus(&focused);for(auto const& id:semantics->order){auto& node=semantics->read(id);if(node.packet.snapshot.focused)s.focusedIds.push_back(id);if(focused.Get()==static_cast<IRawElementProviderFragment*>(node.peer.Get()))s.providerFocus=id;}return s;});jsi::Object result(rt);result.setProperty(rt,"windowFocused",s.focused);result.setProperty(rt,"foreground",s.foreground);result.setProperty(rt,"focusChanges",double(s.focusChanges));result.setProperty(rt,"keyboardMessages",double(s.keyboardMessages));result.setProperty(rt,"semanticsActions",double(s.semanticsActions));result.setProperty(rt,"cursorParked",s.cursorParked);result.setProperty(rt,"lastInputTick",double(s.lastInput));result.setProperty(rt,"focusResult",double(s.focusResult));result.setProperty(rt,"providerFocusId",jsi::String::createFromUtf8(rt,s.providerFocus));jsi::Array ids(rt,s.focusedIds.size());for(size_t i=0;i<s.focusedIds.size();++i)ids.setValueAtIndex(rt,i,jsi::String::createFromUtf8(rt,s.focusedIds[i]));result.setProperty(rt,"focusedIds",std::move(ids));return result;});
      method("takeFrameTrace",0,[this](auto& rt,auto const&,auto*,size_t){
        auto snapshot=trace->take();jsi::Object result(rt);result.setProperty(rt,"schema",1);result.setProperty(rt,"clock","qpc-ms");result.setProperty(rt,"completion","surface-copy-fence-observed");result.setProperty(rt,"displayed","unobserved");result.setProperty(rt,"lostInputs",double(snapshot.lostInputs));result.setProperty(rt,"lostSurfaces",double(snapshot.lostSurfaces));result.setProperty(rt,"lostTurns",double(snapshot.lostTurns));result.setProperty(rt,"inputStride",10);result.setProperty(rt,"surfaceStride",11);result.setProperty(rt,"turnStride",8);
        auto packed=[&](auto const& rows,size_t columns,auto encode){auto value=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(rows.size()*columns*sizeof(double))).getObject(rt);auto buffer=value.getArrayBuffer(rt);auto destination=buffer.data(rt);size_t at=0;for(auto const& row:rows){auto values=encode(row);memcpy(destination+at,values.data(),values.size()*sizeof(double));at+=values.size()*sizeof(double);}return value;};
        result.setProperty(rt,"inputs",packed(snapshot.inputs,10,[](auto const& p){return std::array<double,10>{double(p.native),double(p.core),double(p.viewport),double(p.kind),p.timestamp,p.dispatchBegin,p.dispatchEnd,p.dx,p.dy,p.accepted?1.:0.};}));
        result.setProperty(rt,"surfaces",packed(snapshot.surfaces,11,[](auto const& f){return std::array<double,11>{double(f.surfaceFrame),double(f.owner),double(f.context),double(f.viewport),double(f.frame),double(f.input),double(f.submission),double(f.surface),double(f.width),double(f.height),f.completed};}));
        result.setProperty(rt,"turns",packed(snapshot.turns,8,[](auto const& t){return std::array<double,8>{double(t.sequence),double(t.viewport),double(t.input),t.tick,t.dispatch,t.callbacksEnd,t.checkpointEnd,double(t.callbacks)};}));return result;
      });
      method("heapInfo",0,[this](auto& rt,auto const&,auto*,size_t){jsi::Object result(rt),heap(rt);for(auto const& [key,value]:rt.instrumentation().getHeapInfo(false))heap.setProperty(rt,key.c_str(),double(value));result.setProperty(rt,"heap",std::move(heap));result.setProperty(rt,"gcStatsEnabled",gcStats);if(gcStats){auto data=rt.instrumentation().getRecordedGCStats();if(data.size()>4*1024*1024)throw jsi::JSError(rt,"Native GC report exceeds 4 MiB");result.setProperty(rt,"gc",jsi::String::createFromUtf8(rt,data));}return result;});
      if(sampleProfiling)method("cpuProfile",1,[this](auto& rt,auto const&,auto* args,size_t count){if(count!=1||!args[0].isString())throw jsi::JSError(rt,"Choose begin or end sampling");auto operation=args[0].getString(rt).utf8(rt);auto api=jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());if(!api)throw jsi::JSError(rt,"Hermes profiling interface unavailable");if(operation=="begin"&&!samplingActive){api->enableSamplingProfiler(1000);samplingActive=true;return jsi::Value::undefined();}if(operation!="end"||!samplingActive)throw jsi::JSError(rt,"Invalid native profiling transition");api->disableSamplingProfiler();samplingActive=false;std::ostringstream output;api->dumpSampledTraceToStream(output);auto text=output.str();if(text.size()>8*1024*1024)throw jsi::JSError(rt,"Native sampling report exceeds 8 MiB");return jsi::Value(jsi::String::createFromUtf8(rt,text));});
    }
    method("environment",0,[this](auto& rt,auto const&,auto*,size_t){auto e=onUi([this]{return NH::readEnvironment(window);});jsi::Object value(rt);jsi::Array locales(rt,e.locales.size());for(size_t i=0;i<e.locales.size();++i)locales.setValueAtIndex(rt,i,jsi::String::createFromUtf8(rt,utf8(e.locales[i])));value.setProperty(rt,"locales",std::move(locales));value.setProperty(rt,"localeSource","native");value.setProperty(rt,"localeObservation","poll");value.setProperty(rt,"brightness",e.light?"light":"dark");value.setProperty(rt,"lifecycle",!e.visible?"hidden":e.active?"resumed":"inactive");value.setProperty(rt,"textScale",e.textScale);jsi::Object accessibility(rt);accessibility.setProperty(rt,"features",e.features);accessibility.setProperty(rt,"supportedFeatures",4|16|32);accessibility.setProperty(rt,"semanticsEnabled",jsi::Value::null());accessibility.setProperty(rt,"source","native");accessibility.setProperty(rt,"observation","poll");value.setProperty(rt,"accessibility",std::move(accessibility));jsi::Object capabilities(rt);for(auto name:{"clipboardRead","clipboardWrite","navigation"})capabilities.setProperty(rt,name,"available");value.setProperty(rt,"capabilities",std::move(capabilities));return value;});
    method("service",3,[this](auto& rt,auto const&,auto* args,size_t count){
      if(count!=3||!args[0].isNumber()||!args[1].isString()||!args[2].isString())throw jsi::JSError(rt,"Native service packet required");
      const auto id=NH::Packet(rt,jsi::Value(rt,args[0])).counter(false);auto kind=NH::Packet(rt,jsi::Value(rt,args[1])).string(64);auto text=NH::Packet(rt,jsi::Value(rt,args[2])).text(1024*1024);
      if(kind!="clipboard-read"&&kind!="clipboard-write"&&kind!="cursor"&&kind!="announce")throw jsi::JSError(rt,"Unknown native service");
      postUi([this,id,kind=std::move(kind),text=std::move(text)]{std::string result,error;
        try{if(kind=="cursor"){if(text.size()>64)throw std::runtime_error("Native cursor name too long");activeCursor=NH::systemCursor(text);SetCursor(activeCursor);}else if(kind=="announce")semantics->announce(text);else{NH::Clipboard clipboard(window);if(kind=="clipboard-read")result=utf8(clipboard.read());else clipboard.write(text);}}
        catch(std::exception const& failure){error=failure.what();}
        loop->invokeAsync([this,id,result=std::move(result),error=std::move(error)](auto& rt){jsi::Object reply(rt);reply.setProperty(rt,"id",double(id));reply.setProperty(rt,"value",jsi::String::createFromUtf8(rt,result));reply.setProperty(rt,"error",jsi::String::createFromUtf8(rt,error));emit(rt,"service",std::move(reply));});
      });return jsi::Value::undefined();
    });
    method("requestClose",0,[this](auto&,auto const&,auto*,size_t){postUi([this]{requestClose();});return jsi::Value::undefined();});
    method("listen",1,[this](auto& rt,auto const&,auto* args,size_t count){if(count!=1||events)throw jsi::JSError(rt,"Native listener requires single owner");events.emplace(args[0].getObject(rt).getFunction(rt));return jsi::Value::undefined();});
    method("publishSemantics",1,[this](auto& rt,auto const&,auto* args,size_t count){if(count!=1)throw jsi::JSError(rt,"Native semantics snapshot required");auto update=NH::readSemanticsDelta(NH::Packet(rt,jsi::Value(rt,args[0])));auto weak=nativeContext;postUi([this,update=std::move(update),weak]()mutable{semantics->update(std::move(update),weak);});return jsi::Value::undefined();});
    method("pressedKeys",0,[this](auto& rt,auto const&,auto*,size_t){auto keys=onUi([this]{return keyboard->snapshot();});jsi::Array result(rt,keys.size());for(size_t i=0;i<keys.size();++i){jsi::Object key(rt);key.setProperty(rt,"keyCode",double(keys[i].keyCode));key.setProperty(rt,"scanCode",double(keys[i].scanCode));result.setValueAtIndex(rt,i,std::move(key));}return result;});
    method("editor",2,[this](auto& rt,auto const&,auto* args,size_t count){if(count!=2)throw jsi::JSError(rt,"Native editor command required");auto command=NH::readEditorCommand(args[0].getString(rt).utf8(rt),NH::Packet(rt,jsi::Value(rt,args[1])));postUi([this,command=std::move(command)]()mutable{auto operation=command.operation;std::string error,status="ok";uint64_t revision=0;try{if(command.kind=="keyboardText"){auto result=editors->keyboardText(command,keyboard->epoch());status=result.first;revision=result.second;}else editors->execute(std::move(command));}catch(std::exception const& failure){error=failure.what();}loop->invokeAsync([this,operation,error=std::move(error),status=std::move(status),revision](auto& rt){jsi::Object reply(rt);reply.setProperty(rt,"operation",double(operation));reply.setProperty(rt,"error",jsi::String::createFromUtf8(rt,error));reply.setProperty(rt,"status",jsi::String::createFromUtf8(rt,status));reply.setProperty(rt,"revision",double(revision));emit(rt,"editor-ack",std::move(reply));});});return jsi::Value::undefined();});
    method("log",1,[](auto& rt,auto const&,auto* args,size_t count){if(count!=1||!args[0].isString())throw jsi::JSError(rt,"Native log requires text");std::cout<<args[0].getString(rt).utf8(rt).substr(0,8192)<<std::endl;return jsi::Value::undefined();});
    callbacks->install(api);
    method("completeShutdown",0,[this](auto&,auto const&,auto*,size_t){if(!callbacks->empty())throw std::runtime_error("Native VM shutdown still owns callbacks");finished=true;return jsi::Value::undefined();});
    method("fail",1,[this](auto& rt,auto const&,auto* args,size_t count){std::cerr<<"NELYX_NATIVE_JS_ERROR "<<(count?args[0].toString(rt).utf8(rt):"unknown")<<std::endl;exitCode=1;if(!failureDeadline)failureDeadline=now()+15000;if(events)postUi([this]{requestClose();});else finished=true;return jsi::Value::undefined();});
    rt.global().setProperty(rt,"NelyxNativeHost",std::move(api));
  }
  void execute()noexcept{
    HMODULE unit=nullptr;
    // These owners survive the evaluation catch. Every callback and JSI value
    // must retire on this thread while its runtime is still alive, including
    // startup, frame, timer and native-service failures.
    std::unique_ptr<facebook::hermes::HermesRuntime> runtime;
    std::shared_ptr<RNSkia::RNSkOwnerAsyncQueue<RNSkia::RNSkAsyncResult>> async;
    std::shared_ptr<RNSkia::RNSkVulkanRuntime> scope;
    std::shared_ptr<RNSkia::RNSkVulkanPlatformContext> context;
    std::string icu;
    try{
      runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withEnableEval(false).withEnableSampleProfiling(sampleProfiling).withGCConfig(::hermes::vm::GCConfig::Builder().withShouldRecordStats(gcStats).build()).build());loop->bind(*runtime);callbacks=std::make_unique<NH::VmCallbacks>(*runtime,now,[this]{clock->request();});
      async=std::make_shared<RNSkia::RNSkOwnerAsyncQueue<RNSkia::RNSkAsyncResult>>([scheduler=loop](auto task){scheduler->invokeAsync(std::move(task));});
      icu=readBytes(assetRoot/L"icudtl.dat");C_SetICU(icu.data());
      RNSkia::VulkanPlatformServices services;
      services.dispatchToMain=[this](auto task){postUi(std::move(task));};services.fontManager=[](){return SkFontMgr_New_DirectWrite();};services.screenshot=[](size_t){return sk_sp<SkImage>{};};
      services.reportError=[](auto const& error){throw std::runtime_error(error.what());};
      services.stream=[this](std::string const& uri,auto const& complete){
        std::wstring local=utf16(uri);if(local.starts_with(L"file:")){std::wstring decoded(32768,L'\0');DWORD size=DWORD(decoded.size());NH::check(PathCreateFromUrlW(local.c_str(),decoded.data(),&size,0));decoded.resize(wcslen(decoded.c_str()));local=std::move(decoded);}
        const auto file=std::filesystem::canonical(local),relative=file.lexically_relative(assetRoot);if(relative.empty()||relative.is_absolute()||*relative.begin()==L"..")throw std::runtime_error("Native asset outside supplied root");
        auto bytes=readBytes(file,16*1024*1024);complete(std::make_unique<SkMemoryStream>(SkData::MakeWithCopy(bytes.data(),bytes.size())));
      };
      const auto deviceOptions=surface->nativeOptions();services.createDevice=[this,deviceOptions]{auto value=std::make_shared<nelyx::vulkan::Device>(deviceOptions);if(memoryProbe.enabled())memoryDevice=value;return value;};services.makeAsyncCompletion=[async](auto callback){return async->begin(std::move(callback));};
      scope=std::make_shared<RNSkia::RNSkVulkanRuntime>(*runtime,loop,dpi.load()/96.f,std::move(services),[async]{async->close();});
      context=scope->getPlatformContext();nativeContext=context;context->configureGpuPolicy(false);context->getGpuContext();if(!context->canImportWin32Texture())throw std::runtime_error("Native GPU lacks Win32 texture import");
      onUi([this,context]{surface->configure(context->getGpuContext().textureInfo(kBGRA_8888_SkColorType),[context](auto target,auto const& recordings){return context->renderWin32Frame(target,{},recordings);});view=std::make_shared<RNSkia::RNSkView>(context,surface);surface->setCanPresent([this]{return !IsIconic(window);});});
      scope->getManager().registerSkiaView(1,view);
      clock=std::make_unique<RNSkia::CompositorFrameClock>([this](std::string failure,RNSkia::CompositorFrameTiming timing){const auto tick=timing.wake;postUi([this,tick,timing,failure=std::move(failure)]{if(!started||closeRequested)return;loop->invokeAsync([this,tick,timing,failure](auto& rt){if(!failure.empty())throw jsi::JSError(rt,failure);const auto dispatch=trace?now():0.;const auto dispatched=callbacks->dispatchFrames(tick,&timing);if(trace){const auto end=now();rt.drainMicrotasks();trace->turn({++frameTurn,viewport.load(),inputAccepted,tick,dispatch,end,now(),dispatched});}});});});
      install(*runtime);started=true;
      const auto parent=bundle.parent_path();auto json=runtime->global().getPropertyAsObject(*runtime,"JSON");auto parse=json.getPropertyAsFunction(*runtime,"parse");auto stringify=json.getPropertyAsFunction(*runtime,"stringify");
      auto package=parse.call(*runtime,jsi::String::createFromUtf8(*runtime,readBytes(parent/L"native-package.json"))).getObject(*runtime);
      if(package.getProperty(*runtime,"schema").getString(*runtime).utf8(*runtime)!="nelyx.native-hermes-package/v1"||package.getProperty(*runtime,"mode").getString(*runtime).utf8(*runtime)!=mode)throw std::runtime_error("Native package runtime identity differs");
      const auto vm=GetModuleHandleW(L"hermesvm.dll");if(!vm||!std::filesystem::equivalent(NH::loadedPath(nullptr),parent/L"NelyxHermesHost.exe")||!std::filesystem::equivalent(NH::loadedPath(vm),parent/L"hermesvm.dll"))throw std::runtime_error("Native host/VM loaded outside package");
      std::map<std::string,std::string> expected;auto files=package.getPropertyAsObject(*runtime,"files").getArray(*runtime);for(size_t i=0;i<files.size(*runtime);++i){auto file=files.getValueAtIndex(*runtime,i).getObject(*runtime);auto name=file.getProperty(*runtime,"path").getString(*runtime).utf8(*runtime);if(name=="NelyxHermesHost.exe"||name=="hermesvm.dll"||name==utf8(bundle.filename().wstring()))expected.emplace(name,file.getProperty(*runtime,"sha256").getString(*runtime).utf8(*runtime));}
      if(expected.size()!=3)throw std::runtime_error("Native package image inventory incomplete");for(auto const& [name,hash]:expected)if(NH::fileHash(parent/utf16(name))!=hash)throw std::runtime_error("Native loaded image hash differs: "+name);
      if(mode=="bytecode"){
        auto bytes=std::make_shared<jsi::StringBuffer>(readBytes(bundle));auto root=static_cast<facebook::hermes::IHermesRootAPI*>(facebook::hermes::makeHermesRootAPI()->castInterface(facebook::hermes::IHermesRootAPI::uuid));std::string reason;
        if(!root||root->getBytecodeVersion()!=99||!root->hermesBytecodeSanityCheck(bytes->data(),bytes->size(),&reason))throw std::runtime_error("Invalid Hermes99 HBC: "+reason);
        runtime->evaluateJavaScript(bytes,utf8(bundle.wstring()));
      }else if(mode=="static-aot"){
        unit=LoadLibraryExW(bundle.c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);if(!unit)throw std::runtime_error("Static Hermes unit load failed");if(!std::filesystem::equivalent(NH::loadedPath(unit),bundle))throw std::runtime_error("Static Hermes unit loaded outside package");
        using Plan=const char*(*)();auto plan=reinterpret_cast<Plan>(GetProcAddress(unit,"nelyx_native_plan_v1"));if(!plan||stringify.call(*runtime,parse.call(*runtime,jsi::String::createFromUtf8(*runtime,plan()))).getString(*runtime).utf8(*runtime)!=stringify.call(*runtime,package.getProperty(*runtime,"nativePlan")).getString(*runtime).utf8(*runtime))throw std::runtime_error("Static Hermes embedded source/coverage plan differs");
        for(auto name:{"sh_export_nelyx_typed","sh_export_nelyx_app"}){auto creator=reinterpret_cast<SHUnitCreator>(GetProcAddress(unit,name));if(!creator)throw std::runtime_error("Static Hermes unit export missing");runtime->evaluateSHUnit(creator);}
      }else throw std::runtime_error("Choose bytecode or static-aot");
      std::cout<<"NELYX_NATIVE_IDENTITY {\"hostSha256\":\""<<expected.at("NelyxHermesHost.exe")<<"\",\"vmSha256\":\""<<expected.at("hermesvm.dll")<<"\",\"bundleSha256\":\""<<expected.at(utf8(bundle.filename().wstring()))<<"\",\"modules\":"<<NH::assertIndependentModules()<<",\"nodeApiJsi\":false,\"rnRuntime\":false}"<<std::endl;
      runtime->drainMicrotasks();
      while(!finished){loop->step(callbacks->deadline(failureDeadline));if(failureDeadline&&now()>=*failureDeadline&&!finished)throw std::runtime_error("Native application failed to complete its owned shutdown");callbacks->runDueTimers();}
    }catch(std::exception const& error){std::cerr<<"NELYX_NATIVE_ERROR "<<error.what()<<std::endl;exitCode=1;}catch(...){std::cerr<<"NELYX_NATIVE_ERROR unknown native failure"<<std::endl;exitCode=1;}
    started=false;closeRequested=true;input.seal();
    try{
      if(samplingActive){jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI())->disableSamplingProfiler();samplingActive=false;}
      if(clock)clock->stop();clock.reset();if(callbacks)callbacks->close();events.reset();
      onUi([this]{finishNativeWheel();restoreDiagnosticCursor();if(precision)precision->cancel();editors->close();semantics->close();if(view)view->stopContent();});
      const auto deadline=std::chrono::steady_clock::now()+10s;
      for(;;){if(onUi([this]{return surface->idle();}))break;if(std::chrono::steady_clock::now()>=deadline)throw std::runtime_error("Native GPU drain timed out");std::this_thread::sleep_for(1ms);}
      if(scope)scope->getManager().unregisterAllSkiaViews();
      onUi([this]{view.reset();surface->detach();});
      if(scope)scope->close(*runtime);if(async)async->close();loop->close();
      scope.reset();context.reset();async.reset();runtime.reset();callbacks.reset();
      if(unit){FreeLibrary(unit);unit=nullptr;}
    }catch(std::exception const& error){
      std::cerr<<"NELYX_NATIVE_DRAIN_ERROR "<<error.what()<<std::endl;
      // Destroying a VM while a failed GPU drain still retains its resources
      // is unsafe. Fail the process without running foreign-owner destructors.
      TerminateProcess(GetCurrentProcess(),2);return;
    }
    PostMessageW(window,doneMessage,0,0);
  }
  HWND window=nullptr;HCURSOR activeCursor=nullptr;std::filesystem::path bundle,assetRoot;std::string mode;std::thread thread;
  std::shared_ptr<NH::RuntimeLoop> loop=std::make_shared<NH::RuntimeLoop>(now);std::shared_ptr<NH::WindowSurface> surface;std::shared_ptr<RNSkia::RNSkView> view;
  std::unique_ptr<NH::FrameTrace<>> trace;bool gcStats=false,sampleProfiling=false,samplingActive=false;uint64_t frameTurn=0;
  NH::MemoryProbe memoryProbe;std::weak_ptr<nelyx::vulkan::Device> memoryDevice;uint64_t memoryWheelReceived=0,memoryWheelAbsolute=0,memoryWheelForeign=0;int64_t memoryWheelNet=0;double memoryWheelDeliveredAbsoluteY=0;
  std::unique_ptr<NH::NativeWheelDriver> wheelDriver;std::optional<POINT> savedWheelCursor;POINT wheelPoint{};LONG_PTR wheelCookie=0;uint32_t wheelObserved=0;uint64_t wheelEpoch=0;int wheelReceived=0,wheelForeign=0;int64_t wheelNet=0,wheelAbsolute=0;
  std::optional<POINT> savedDiagnosticCursor;POINT diagnosticPoint{};uint64_t keyboardMessages=0;std::atomic<uint64_t> semanticsActions{0};
  std::unique_ptr<RNSkia::CompositorFrameClock> clock;std::mutex uiMutex;std::deque<std::function<void()>> uiTasks;
  std::unique_ptr<NH::Keyboard> keyboard;std::shared_ptr<NH::SemanticsTree> semantics;std::shared_ptr<NH::Editors> editors;std::weak_ptr<void> nativeContext;uint32_t mouseHeld=0;POINT lastMouse{};bool trackingMouse=false;std::map<uint32_t,Pointer> contacts;
  std::shared_ptr<RNSkia::WindowsPrecisionTrackpad> precision;nelyx::host::InputBatch<Pointer> input;
  std::unique_ptr<NH::VmCallbacks> callbacks;std::optional<jsi::Function> events;uint64_t inputSequence=0,inputBatch=0,runtimeInputBatch=0,inputDelivered=0,inputAccepted=0,inputRejected=0,focusChanges=0;double wheelReceivedY=0,wheelDeliveredY=0;
  std::atomic<int> physicalWidth{0},physicalHeight{0},dpi{96},exitCode{0};std::atomic<uint64_t> viewport{0},surfaceEpoch{0};std::atomic<bool> started{false},closeRequested{false};bool finished=false,closing=false;std::optional<double> failureDeadline;
};
int wmain(int count,wchar_t** args){
  try{if(count<4||count>7)throw std::runtime_error("Usage: NelyxHermesHost bundle asset-root bytecode|static-aot [duration-ms] [width] [height]");auto mode=utf8(args[3]);if(mode!="bytecode"&&mode!="static-aot")throw std::runtime_error("Choose bytecode or static-aot");auto number=[&](int index,int fallback,int minimum,int maximum){if(count<=index)return fallback;std::wstring value(args[index]);if(value.empty()||!std::all_of(value.begin(),value.end(),[](wchar_t digit){return digit>=L'0'&&digit<=L'9';}))throw std::runtime_error("Invalid native host numeric argument");const auto result=std::stoull(value);if(result<uint64_t(minimum)||result>uint64_t(maximum))throw std::runtime_error("Native host numeric argument outside its bounds");return int(result);};NativeHost host;return host.run(args[1],args[2],mode,number(4,0,0,INT_MAX),number(5,1000,64,4096),number(6,1000,64,4096));}
  catch(std::exception const& error){std::cerr<<"NELYX_NATIVE_START_ERROR "<<error.what()<<std::endl;return 1;}
}
