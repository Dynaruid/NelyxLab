// SPDX-License-Identifier: BSD-3-Clause
#include "windows-animation-diagnostics.h"
#include "windows-animation-fault.h"
#include "windows-animation-profile.h"
#include "windows-wheel-pacer.h"
#include "windows-resize-pixels.h"
#include "windows-resize-timing.h"
#include <RNSkiaModule.h>
#include <SkiaView.h>
#include <WindowsAppHost.h>
#include <WindowsReactApp.h>
#include <PlatformServices.h>
#include <TextInputModule.h>
#include <SemanticsComponent.h>
#include <chrono>
#include <cstring>
#include <cstdio>
#include <iostream>
#include <iomanip>
#include <mutex>
#include <sstream>
#include <vector>
#include <type_traits>
#include <commctrl.h>
#include <psapi.h>
#include <mmsystem.h>
#pragma comment(lib,"winmm.lib")
namespace RN=winrt::Microsoft::ReactNative;
namespace {
struct ErrorReporter:winrt::implements<ErrorReporter,RN::IRedBoxHandler>{
 bool IsDevSupportEnabled()const noexcept{return true;}
 void ShowNewError(RN::IRedBoxErrorInfo const& info,RN::RedBoxErrorType)noexcept{
  std::cerr<<"ANIMATION_REACT_ERROR "<<winrt::to_string(info.Message())<<std::endl;
  for(auto const& frame:info.Callstack())std::cerr<<"ANIMATION_REACT_STACK "<<winrt::to_string(frame.Method())<<" "<<winrt::to_string(frame.File())<<":"<<frame.Line()<<":"<<frame.Column()<<std::endl;
 }
 void UpdateError(RN::IRedBoxErrorInfo const& info)noexcept{ShowNewError(info,RN::RedBoxErrorType::Native);}
 void DismissRedBox()noexcept{}
};
using Clock=std::chrono::steady_clock;
using WheelPacer=Nelyx::Fixture::WheelPacer;
std::string phase;Clock::time_point began{},last{};std::vector<double> intervals;unsigned frames=0;bool finished=false,closed=false;
std::mutex bootStageMutex;std::string lastBootStage;uint64_t bootStageChanges=0;
bool recordBootStage(std::string const& message){if(!message.starts_with("BOOT "))return false;std::lock_guard lock(bootStageMutex);lastBootStage=message.substr(5);++bootStageChanges;return true;}
winrt::Microsoft::UI::Windowing::AppWindow fixtureWindow{nullptr};
unsigned resizeCount=0;
bool failCloseProbe=false;
void placeContinuousWindow(HWND window){
 if(!std::getenv("NELYX_CONTINUOUS_SCROLL"))return;
 const auto configured=std::getenv("NELYX_ANIMATION_MONITOR");const std::string selection=configured?configured:"primary";
 struct Selection {std::string value;int width=0,height=0;unsigned dpi=0;MONITORINFOEXW info{};unsigned matches=0;} target{selection};
 if(selection!="primary"){char extra=0;if(std::sscanf(selection.c_str(),"%dx%d@%u%c",&target.width,&target.height,&target.dpi,&extra)!=3||target.width<=0||target.height<=0||target.dpi<96)throw std::runtime_error("Choose primary or WIDTHxHEIGHT@DPI for the fixture monitor");}
 if(!EnumDisplayMonitors(nullptr,nullptr,[](HMONITOR monitor,HDC,LPRECT,LPARAM argument)->BOOL{auto& target=*reinterpret_cast<Selection*>(argument);MONITORINFOEXW info{};info.cbSize=sizeof(info);if(!GetMonitorInfoW(monitor,reinterpret_cast<MONITORINFO*>(&info)))return FALSE;const bool match=target.value=="primary"?bool(info.dwFlags&MONITORINFOF_PRIMARY):info.rcMonitor.right-info.rcMonitor.left==target.width&&info.rcMonitor.bottom-info.rcMonitor.top==target.height;if(match){target.info=info;++target.matches;}return TRUE;},reinterpret_cast<LPARAM>(&target))||target.matches!=1)throw std::runtime_error("Fixture monitor selection must match exactly one connected display");
 const auto& bounds=target.info.rcWork;
 if(!SetWindowPos(window,nullptr,bounds.left+40,bounds.top+40,0,0,SWP_NOSIZE|SWP_NOZORDER|SWP_NOACTIVATE)||!SetWindowPos(window,nullptr,bounds.left+40,bounds.top+40,1000,1000,SWP_NOZORDER|SWP_NOACTIVATE))throw std::runtime_error("Fixture monitor placement failed");
 const auto dpi=GetDpiForWindow(window);if(target.dpi&&dpi!=target.dpi)throw std::runtime_error("Fixture monitor DPI differs from its selected condition");
 std::cout<<"ANIMATION_DISPLAY {\"selection\":\""<<selection<<"\",\"width\":"<<target.info.rcMonitor.right-target.info.rcMonitor.left<<",\"height\":"<<target.info.rcMonitor.bottom-target.info.rcMonitor.top<<",\"dpi\":"<<dpi<<",\"primary\":"<<((target.info.dwFlags&MONITORINFOF_PRIMARY)?"true":"false")<<",\"workWidth\":"<<bounds.right-bounds.left<<",\"workHeight\":"<<bounds.bottom-bounds.top<<"}"<<std::endl;
}
std::optional<RNSkia::WindowsSurfaceStatus> lastSurfaceStatus;
double startupEntry=0;
double startupCreationToEntry=0;
bool startupDeadlineProbe=false,startupSurfaceObserved=false,startupShownObserved=false;
std::atomic<uint64_t> startupSurfaceFrames{};
void startupMilestone(const char* stage){
 const auto now=RNSkia::windowsMonotonicMilliseconds();std::ostringstream text;
 text<<std::fixed<<std::setprecision(4)<<"ANIMATION_STARTUP {\"stage\":\""<<stage<<"\",\"nativeMs\":"<<now<<",\"elapsedMs\":"<<now-startupEntry<<",\"processElapsedMs\":"<<startupCreationToEntry+now-startupEntry<<",\"surfaceFrames\":"<<startupSurfaceFrames.load()<<"}";
 std::cout<<text.str()<<std::endl;
}
LRESULT CALLBACK startupObservation(HWND window,UINT message,WPARAM w,LPARAM l,UINT_PTR id,DWORD_PTR){
 const auto result=DefSubclassProc(window,message,w,l);
 if(message==WM_WINDOWPOSCHANGED&&!startupShownObserved&&IsWindowVisible(window)){startupShownObserved=true;startupMilestone("first-shown");}
 if(message==WM_NCDESTROY)RemoveWindowSubclass(window,startupObservation,id);
 return result;
}
std::atomic<unsigned> dragEntered{},dragExited{},dragSizing{};std::atomic<double> dragBegan{},dragEnded{};std::thread dragWorker;
std::atomic<unsigned> dragGeometrySamples{},dragGeometryMismatches{};
std::atomic<unsigned> dragSourceSamples{},dragSourceMisses{};
std::vector<Nelyx::Fixture::ResizeObservation> dragGeometry,dragProcessed;
RN::JSValueArray resizeRows(const std::vector<Nelyx::Fixture::ResizeObservation>& rows){
 RN::JSValueArray result;for(const auto& row:rows)result.push_back(RN::JSValueArray{row.time,double(row.rect.left),double(row.rect.top),double(row.rect.right),double(row.rect.bottom),double(row.input)});return result;
}
void observeResizeSource(ID3D11Texture2D* texture,POINT offset,uint32_t width,uint32_t height){
 if(!dragEntered||dragExited)return;
 const auto scale=GetDpiForWindow(winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id()))/96.;
 const auto x=width-static_cast<uint32_t>(std::round(11*scale)),y=static_cast<uint32_t>(std::round(7*scale));
 if(x>=width||y>=height)throw std::runtime_error("Source sensor outside the owned frame");
 winrt::com_ptr<ID3D11Device> device;texture->GetDevice(device.put());winrt::com_ptr<ID3D11DeviceContext> context;device->GetImmediateContext(context.put());
 D3D11_TEXTURE2D_DESC desc{};desc.Width=desc.Height=desc.MipLevels=desc.ArraySize=desc.SampleDesc.Count=1;desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.Usage=D3D11_USAGE_STAGING;desc.CPUAccessFlags=D3D11_CPU_ACCESS_READ;
 winrt::com_ptr<ID3D11Texture2D> sample;winrt::check_hresult(device->CreateTexture2D(&desc,nullptr,sample.put()));
 D3D11_BOX box{UINT(offset.x)+x,UINT(offset.y)+y,0,UINT(offset.x)+x+1,UINT(offset.y)+y+1,1};context->CopySubresourceRegion(sample.get(),0,0,0,0,texture,0,&box);
 D3D11_MAPPED_SUBRESOURCE mapped{};winrt::check_hresult(context->Map(sample.get(),0,D3D11_MAP_READ,0,&mapped));const auto pixel=*static_cast<const uint32_t*>(mapped.pData);context->Unmap(sample.get(),0);++dragSourceSamples;
 if(std::abs(int(pixel&255)-91)>4||std::abs(int((pixel>>8)&255)-230)>4||((pixel>>16)&255)>4){if(++dragSourceMisses<=8)std::cout<<"ANIMATION_SOURCE_MISMATCH width="<<width<<" height="<<height<<" rgba="<<std::hex<<pixel<<std::dec<<std::endl;}
}
bool v8Profile=false;
struct ProfileTimerResolution {
 bool active=false;
 void enable(){if(timeBeginPeriod(1)!=TIMERR_NOERROR)throw std::runtime_error("V8 diagnostic timer resolution unavailable");active=true;}
 ~ProfileTimerResolution(){if(active)timeEndPeriod(1);}
} profileTimerResolution;
void configureV8Profile(){
 // Only the fixture opts into the pinned DLL's public process-level C ABI,
 // before its first runtime. Normal app/supplier flags remain unchanged.
 const auto dll=std::filesystem::current_path()/L"v8jsi.dll";
 const auto module=LoadLibraryExW(dll.c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
 if(!module)throw std::runtime_error("Pinned V8 diagnostic DLL unavailable");
 using SetFlags=void(__cdecl*)(size_t*,char**,bool);
 const auto setFlags=reinterpret_cast<SetFlags>(GetProcAddress(module,"v8_jsi_set_v8_flags"));
 if(!setFlags)throw std::runtime_error("Pinned V8 process flag C ABI unavailable");
 const auto path=(std::filesystem::current_path()/L"v8-profile.log").u8string();
 std::vector<std::string> flags{"nelyx-v8-profile","--prof","--prof-sampling-interval=1000","--log-code","--no-logfile-per-isolate","--trace-gc-nvp","--logfile="+std::string(path.begin(),path.end())};
 std::vector<char*> arguments;for(auto &flag:flags)arguments.push_back(flag.data());size_t count=arguments.size();setFlags(&count,arguments.data(),true);
 if(count!=1||std::string_view(arguments[0])!="nelyx-v8-profile")throw std::runtime_error("V8 diagnostic flags were not recognized");
 // V8's sampling thread otherwise follows the coarse Windows wait quantum.
 // This diagnostic process owns and releases the request; normal runs skip it.
 profileTimerResolution.enable();
 std::cout<<"ANIMATION_V8_PROFILE enabled samplingUs=1000 timerResolutionMs=1"<<std::endl;
}
std::jthread focusWorker;
std::jthread wheelWorker;
std::atomic<int> wheelStreamToken=0,wheelStreamStop=0;
POINT heldWheelOriginal{},heldWheelTarget{};std::atomic<bool> heldWheelCursor=false;
void restoreWheelCursor()noexcept{if(!heldWheelCursor.exchange(false))return;POINT current{};if(GetCursorPos(&current)&&current.x==heldWheelTarget.x&&current.y==heldWheelTarget.y)SetCursorPos(heldWheelOriginal.x,heldWheelOriginal.y);}
struct WheelCursorCleanup {~WheelCursorCleanup(){if(wheelWorker.joinable())wheelWorker.join();restoreWheelCursor();}};
// Windows may deny a background process's foreground request even after an
// input-thread attachment. Activate only a verified caption of this fixture;
// the wheel path still rejects a foreign foreground or a moved pointer.
bool clickOwnCaption(HWND window){
 if((GetAsyncKeyState(VK_LBUTTON)|GetAsyncKeyState(VK_RBUTTON)|GetAsyncKeyState(VK_MBUTTON))&0x8000)return false;
 RECT bounds{};POINT original{};if(!GetWindowRect(window,&bounds)||!GetCursorPos(&original))return false;
 const auto dpi=GetDpiForWindow(window);POINT caption{};bool found=false;
 for(int y=8;y<=56&&!found;y+=4){
  const POINT point{bounds.left+std::min<LONG>((bounds.right-bounds.left)/3,MulDiv(200,dpi,96)),bounds.top+MulDiv(y,dpi,96)};DWORD_PTR hit=0;
  if(GetAncestor(WindowFromPoint(point),GA_ROOT)==window&&SendMessageTimeoutW(window,WM_NCHITTEST,0,MAKELPARAM(point.x,point.y),SMTO_ABORTIFHUNG,1000,&hit)&&hit==HTCAPTION){caption=point;found=true;}
 }
 if(!found)return false;
 const int left=GetSystemMetrics(SM_XVIRTUALSCREEN),top=GetSystemMetrics(SM_YVIRTUALSCREEN),width=GetSystemMetrics(SM_CXVIRTUALSCREEN),height=GetSystemMetrics(SM_CYVIRTUALSCREEN);if(width<2||height<2)return false;
 INPUT input[4]{};for(auto& value:input)value.type=INPUT_MOUSE;
 const auto move=[&](INPUT& value,POINT point){value.mi.dx=static_cast<LONG>((int64_t(point.x)-left)*65535/(width-1));value.mi.dy=static_cast<LONG>((int64_t(point.y)-top)*65535/(height-1));value.mi.dwFlags=MOUSEEVENTF_MOVE|MOUSEEVENTF_ABSOLUTE|MOUSEEVENTF_VIRTUALDESK;};
 move(input[0],caption);input[1].mi.dwFlags=MOUSEEVENTF_LEFTDOWN;input[2].mi.dwFlags=MOUSEEVENTF_LEFTUP;move(input[3],original);
 return SendInput(4,input,sizeof(INPUT))==4;
}
std::shared_ptr<RNSkia::WindowsRuntimeServices> queueProbe;std::function<void(std::function<void()>)> queueProbeDispatch;
LRESULT CALLBACK dragWindow(HWND window,UINT message,WPARAM w,LPARAM l,UINT_PTR id,DWORD_PTR){
 if(message==WM_ENTERSIZEMOVE){++dragEntered;dragBegan=RNSkia::windowsMonotonicMilliseconds();RECT baseline{};if(GetWindowRect(window,&baseline))dragGeometry.push_back({dragBegan.load(),baseline});}
 if(message==WM_EXITSIZEMOVE){dragEnded=RNSkia::windowsMonotonicMilliseconds();++dragExited;}
 if(message==WM_SIZING){++dragSizing;if(l)dragProcessed.push_back({RNSkia::windowsMonotonicMilliseconds(),*reinterpret_cast<RECT*>(l),uint64_t(GetMessageExtraInfo())});}
 bool geometryChanged=false;if(message==WM_WINDOWPOSCHANGED&&dragEntered&&!dragExited){RECT rect{};if(GetWindowRect(window,&rect))geometryChanged=Nelyx::Fixture::appendChanged(dragGeometry,RNSkia::windowsMonotonicMilliseconds(),rect);}
 const auto result=DefSubclassProc(window,message,w,l);
 if(message==WM_WINDOWPOSCHANGED&&geometryChanged&&dragEntered&&!dragExited&&l&&!(reinterpret_cast<const WINDOWPOS*>(l)->flags&SWP_NOSIZE)){
  RECT client{};if(GetClientRect(window,&client)&&lastSurfaceStatus){
   ++dragGeometrySamples;const auto& status=*lastSurfaceStatus;
   if(status.presentedWidth!=client.right||status.presentedHeight!=client.bottom||status.presentedSurfaceGeneration!=status.layoutRevision){
    if(!dragGeometryMismatches++)std::cout<<"ANIMATION_GEOMETRY_MISMATCH client="<<client.right<<","<<client.bottom<<" front="<<status.presentedWidth<<","<<status.presentedHeight<<" generation="<<status.presentedSurfaceGeneration<<","<<status.layoutRevision<<std::endl;
   }
  }
 }
 if(message==WM_NCDESTROY)RemoveWindowSubclass(window,dragWindow,id);return result;
}
REACT_MODULE(NelyxAnimation)
struct NelyxAnimation {
 RN::ReactContext context;
 REACT_SYNC_METHOD(resizing) bool resizing()noexcept{return dragEntered&&!dragExited;}
 REACT_SYNC_METHOD(resizeConfig) RN::JSValueObject resizeConfig()noexcept{const auto read=[](const char* key,const char* fallback){const auto value=std::getenv(key);return std::string(value?value:fallback);};return {{"pages",read("NELYX_ANIMATION_RESIZE_PAGES","material,list,cupertino")},{"corners",read("NELYX_ANIMATION_RESIZE_CORNERS","bottom-right,top-left")},{"label",read("NELYX_ANIMATION_RESIZE_LABEL","current")},{"allowRejections",read("NELYX_ANIMATION_RESIZE_REJECTIONS","0")},{"delayResize",read("NELYX_ANIMATION_RESIZE_DELAY","0")},{"responsiveShortHeader",read("NELYX_ANIMATION_RESPONSIVE_SHORT_HEADER","0")}};}
 REACT_SYNC_METHOD(viewport) std::string viewport()noexcept{const auto value=std::getenv("NELYX_ANIMATION_VIEWPORT");return value?value:"fixed";}
 REACT_SYNC_METHOD(continuousScroll) bool continuousScroll()noexcept{const auto value=std::getenv("NELYX_CONTINUOUS_SCROLL");return value&&std::strcmp(value,"1")==0;}
 REACT_SYNC_METHOD(fullCatalog) bool fullCatalog()noexcept{const auto value=std::getenv("NELYX_CONTINUOUS_CATALOG");return value&&std::strcmp(value,"full")==0;}
 REACT_SYNC_METHOD(childPolicy) std::string childPolicy()noexcept{const auto value=std::getenv("NELYX_CONTINUOUS_CHILD_POLICY");return value?value:"legacy";}
 REACT_SYNC_METHOD(stopWheelStream) bool stopWheelStream(int token)noexcept{if(token<1||wheelStreamToken.load()!=token)return false;wheelStreamStop.store(token);return true;}
 REACT_SYNC_METHOD(mode) std::string mode()noexcept{const auto value=std::getenv("NELYX_ANIMATION_MODE");return value&&std::strcmp(value,"full-runtime-regression")==0?"full-runtime-regression":"research-engine";}
 REACT_SYNC_METHOD(traceFlags) int traceFlags()noexcept{NelyxAnimationProfile::thread();const auto trace=std::getenv("NELYX_ANIMATION_TRACE"),deep=std::getenv("NELYX_ANIMATION_DIAGNOSTIC");return (trace&&std::strcmp(trace,"1")==0?1:0)|(deep&&std::strcmp(deep,"1")==0?2:0);}
 REACT_SYNC_METHOD(startupDeadlineEnabled) bool startupDeadlineEnabled()noexcept{return startupDeadlineProbe;}
 REACT_SYNC_METHOD(profilePhase) bool profilePhase(std::string name,bool begin)noexcept{
  if(!v8Profile)return false;PROCESS_MEMORY_COUNTERS_EX memory{};memory.cb=sizeof(memory);
  if(!GetProcessMemoryInfo(GetCurrentProcess(),reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory),sizeof(memory)))return false;
  std::ostringstream message;message<<std::fixed<<std::setprecision(4)<<"ANIMATION_V8_PHASE {\"phase\":\""<<name<<"\",\"begin\":"<<(begin?"true":"false")<<",\"nativeMs\":"<<RNSkia::windowsMonotonicMilliseconds()<<",\"workingSetBytes\":"<<memory.WorkingSetSize<<",\"peakWorkingSetBytes\":"<<memory.PeakWorkingSetSize<<",\"privateBytes\":"<<memory.PrivateUsage<<"}";std::cout<<message.str()<<std::endl;return true;
 }
 REACT_SYNC_METHOD(startupStage) bool startupStage(std::string stage)noexcept{
  for(const auto name:{"js-register-start","js-registered","asset-load-start","asset-font-ready","core-first-build-start","core-first-build-finished"})if(stage==name){startupMilestone(name);return true;}
  return false;
 }
 REACT_INIT(Initialize) void Initialize(RN::ReactContext const& value)noexcept{context=value;}
 REACT_METHOD(report) void report(std::string text)noexcept{if(!recordBootStage(text))std::cout<<("ANIMATION_JS "+text+"\n")<<std::flush;}
 REACT_METHOD(samplePixel) void samplePixel(double x,double y,RN::ReactPromise<double> promise)noexcept{context.UIDispatcher().Post([x,y,promise]{
  const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());
  if(!lastSurfaceStatus||!std::isfinite(x)||!std::isfinite(y)||GetForegroundWindow()!=window){promise.Reject("Pixel probe requires its own foreground surface");return;}
  POINT point{LONG(std::lround(x*lastSurfaceStatus->scale)),LONG(std::lround(y*lastSurfaceStatus->scale))};
  if(!ClientToScreen(window,&point)||GetAncestor(WindowFromPoint(point),GA_ROOTOWNER)!=GetAncestor(window,GA_ROOTOWNER)){promise.Reject("Pixel probe escaped its own window");return;}
  const auto screen=GetDC(nullptr);if(!screen){promise.Reject("Pixel probe screen DC unavailable");return;}const auto pixel=GetPixel(screen,point.x,point.y);ReleaseDC(nullptr,screen);
  if(pixel==CLR_INVALID){promise.Reject("Pixel probe could not observe its own window");return;}
  promise.Resolve(double(0xff000000u|(uint32_t(GetRValue(pixel))<<16)|(uint32_t(GetGValue(pixel))<<8)|uint32_t(GetBValue(pixel))));
 });}
 REACT_METHOD(windowSnapshot) void windowSnapshot(RN::ReactPromise<RN::JSValueObject> promise)noexcept{auto current=context;current.UIDispatcher().Post([current,promise]{const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());RECT client{};GetClientRect(window,&client);const auto session=current.Properties().Get(RNSkia::WindowsCompositionSessionProperty());promise.Resolve(RN::JSValueObject{{"foreground",GetForegroundWindow()==window},{"appVisible",fixtureWindow.IsVisible()},{"visible",bool(IsWindowVisible(window))},{"minimized",bool(IsIconic(window))},{"maximized",bool(IsZoomed(window))},{"clientWidth",double(client.right-client.left)},{"clientHeight",double(client.bottom-client.top)},{"sessionVisible",session&&*session?(*session)->windowVisible():false},{"surfaceVisible",lastSurfaceStatus?RN::JSValue(lastSurfaceStatus->visible):RN::JSValue{}},{"surfacePhase",lastSurfaceStatus?lastSurfaceStatus->phase:"none"},{"surfaceFrames",lastSurfaceStatus?double(lastSurfaceStatus->frames):0},{"surfaceGeneration",lastSurfaceStatus?double(lastSurfaceStatus->surfaceGeneration):0}});});}
 REACT_SYNC_METHOD(queueFailureStart) bool queueFailureStart()noexcept{try{wchar_t file[32768]{};GetModuleFileNameW(nullptr,file,32768);queueProbe=std::make_shared<RNSkia::WindowsRuntimeServices>(context,context.CallInvoker(),std::vector<std::wstring>{(std::filesystem::path(file).parent_path()/L"Assets").wstring()});auto ports=queueProbe->ports([]{return std::shared_ptr<nelyx::vulkan::Device>{};},[](size_t){return sk_sp<SkImage>{};},[](auto const&){});queueProbeDispatch=ports.dispatchToMain;queueProbeDispatch([]{throw std::runtime_error("resize presentation failure probe");});return true;}catch(...){return false;}}
 REACT_SYNC_METHOD(queueFailureReady) bool queueFailureReady()noexcept{return queueProbe&&!queueProbe->uiFailureReason().empty();}
 REACT_SYNC_METHOD(queueFailureFinish) bool queueFailureFinish()noexcept{bool admission=false,close=false;try{queueProbeDispatch([]{});}catch(std::exception const& error){admission=std::string(error.what())=="Windows UI task failed: resize presentation failure probe";}try{queueProbe->close();}catch(std::exception const& error){close=std::string(error.what())=="Windows UI task failed: resize presentation failure probe";}queueProbeDispatch={};queueProbe.reset();std::cout<<"ANIMATION_QUEUE_FAILURE primary="<<admission<<" retained="<<close<<std::endl;return admission&&close;}
 REACT_METHOD(resize) void resize(int width,int height,RN::ReactPromise<void> promise)noexcept{context.UIDispatcher().Post([width,height,promise]{try{fixtureWindow.Resize({width,height});++resizeCount;promise.Resolve();}catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}});}
 // Small OS wheel deltas with an 8ms requested interval exercise the native input route. This is
 // automated input, not a physical precision-touchpad qualification.
 REACT_METHOD(wheel) void wheel(double x,double y,int delta,int count,int intervalMs,RN::ReactPromise<void> promise)noexcept{wheelImpl(x,y,delta,count,intervalMs,false,promise);}
 REACT_METHOD(wheelSweep) void wheelSweep(double x,double y,int delta,int count,int intervalMs,RN::ReactPromise<void> promise)noexcept{wheelImpl(x,y,delta,count,intervalMs,true,promise);}
 REACT_METHOD(wheelStream) void wheelStream(double x,double y,int delta,int maximum,int intervalMs,int token,RN::ReactPromise<double> promise)noexcept{wheelImpl(x,y,delta,maximum,intervalMs,false,promise,token);}
 REACT_METHOD(restoreWheelPointer) void restoreWheelPointer(RN::ReactPromise<void> promise)noexcept{context.UIDispatcher().Post([promise]{restoreWheelCursor();promise.Resolve();});}
 template<class Result> void wheelImpl(double x,double y,int delta,int count,int intervalMs,bool sweep,RN::ReactPromise<Result> promise,int token=0)noexcept{context.UIDispatcher().Post([x,y,delta,count,intervalMs,sweep,promise,token]{
  const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());
  if(!lastSurfaceStatus||!std::isfinite(x)||!std::isfinite(y)||count<1||count>(token>0?8192:240)||token<0||delta<-120||delta>120||intervalMs<1||intervalMs>16){promise.Reject("Invalid owned wheel workload");return;}
  if(GetForegroundWindow()!=window){promise.Reject("Wheel input requires its own foreground window");return;}
  POINT point{LONG(std::lround(x*lastSurfaceStatus->scale)),LONG(std::lround(y*lastSurfaceStatus->scale))};
  if(!ClientToScreen(window,&point)||GetAncestor(WindowFromPoint(point),GA_ROOTOWNER)!=GetAncestor(window,GA_ROOTOWNER)){RECT bounds{};GetWindowRect(window,&bounds);DWORD process=0;GetWindowThreadProcessId(WindowFromPoint(point),&process);promise.Reject(("Wheel target is outside the owned window point="+std::to_string(point.x)+","+std::to_string(point.y)+" window="+std::to_string(bounds.left)+","+std::to_string(bounds.top)+","+std::to_string(bounds.right)+","+std::to_string(bounds.bottom)+" targetProcess="+std::to_string(process)+" own="+std::to_string(GetCurrentProcessId())).c_str());return;}
  if(wheelWorker.joinable())wheelWorker.join();wheelStreamToken.store(token);wheelStreamStop.store(0);wheelWorker=std::jthread([window,point,delta,count,intervalMs,sweep,promise,token]{POINT saved{};const bool restore=GetCursorPos(&saved);std::string failure;unsigned sent=0;
   if(!SetCursorPos(point.x,point.y))failure="Wheel pointer positioning failed";
   try{std::this_thread::sleep_for(std::chrono::milliseconds(150));WheelPacer pacer(intervalMs);for(int i=0;i<count&&failure.empty()&&(!token||wheelStreamStop.load()!=token);i++){const auto iterationBegin=Clock::now();if(GetForegroundWindow()!=window){failure="Wheel window lost foreground";break;}POINT current{};if(!GetCursorPos(&current)||current.x!=point.x||current.y!=point.y){failure="Owned wheel pointer moved during injection";break;}INPUT input{};input.type=INPUT_MOUSE;input.mi.dwFlags=MOUSEEVENTF_WHEEL;input.mi.mouseData=DWORD(sweep&&(i/24)%2?-delta:delta);if(SendInput(1,&input,sizeof(input))!=1){failure="OS wheel injection failed";break;}pacer.sample();++sent;pacer.wait(iterationBegin);}pacer.report(token?"os-stream":sweep?"os-sweep":"os");}catch(std::exception const& error){failure=error.what();}
   // SendInput completion does not acknowledge delivery to Core. Keep the
   // sweep's pointer owned until JS confirms every event and drains its frame.
   if(restore&&(sweep||std::getenv("NELYX_CONTINUOUS_SCROLL"))&&failure.empty()){heldWheelOriginal=saved;heldWheelTarget=point;heldWheelCursor.store(true);}else if(restore)SetCursorPos(saved.x,saved.y);
   if(failure.empty()){if constexpr(std::is_void_v<Result>)promise.Resolve();else promise.Resolve(static_cast<double>(sent));}else promise.Reject(failure.c_str());
  });
 });}
 // Owner-only queue workload for comparisons while the desktop is in use.
 // It uses the real SDK wheel adapter but does not inject OS mouse input.
 REACT_METHOD(queuedWheel) void queuedWheel(double x,double y,int delta,int count,double generation,int intervalMs,RN::ReactPromise<void> promise)noexcept{
  queuedWheelImpl(x,y,delta,count,generation,intervalMs,false,promise);
 }
 REACT_METHOD(queuedWheelSweep) void queuedWheelSweep(double x,double y,int delta,int count,double generation,int intervalMs,RN::ReactPromise<void> promise)noexcept{
  queuedWheelImpl(x,y,delta,count,generation,intervalMs,true,promise);
 }
 void queuedWheelImpl(double x,double y,int delta,int count,double generation,int intervalMs,bool sweep,RN::ReactPromise<void> promise)noexcept{
  if(!std::isfinite(x)||!std::isfinite(y)||count<1||count>240||delta<-120||delta>120||intervalMs<1||intervalMs>16){promise.Reject("Invalid queued wheel workload");return;}
  if(wheelWorker.joinable())wheelWorker.join();const auto current=context;wheelWorker=std::jthread([current,x,y,delta,count,generation,intervalMs,sweep,promise]{
   try{WheelPacer pacer(intervalMs);for(int i=0;i<count;i++){
    const auto iterationBegin=Clock::now();
    const auto step=sweep&&(i/24)%2?-delta:delta;
    current.EmitJSEvent(L"RCTDeviceEventEmitter",L"nelyxFixtureWheel",RN::JSValueObject{{"x",x},{"y",y},{"deltaX",0.0},{"deltaY",-step*48.0/120.0},{"surfaceGeneration",generation}});
    pacer.sample();pacer.wait(iterationBegin);
   }pacer.report("queued");promise.Resolve();}catch(std::exception const& error){promise.Reject(error.what());}
  });
 }
 REACT_METHOD(windowMode) void windowMode(std::string mode,RN::ReactPromise<void> promise)noexcept{context.UIDispatcher().Post([mode=std::move(mode),promise]()mutable{
  const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());
  if(const auto value=std::getenv("NELYX_ANIMATION_WHEEL_INPUT");value&&std::string_view(value)=="queued"&&(mode=="show"||mode=="restore")){if(mode=="restore")fixtureWindow.Presenter().as<winrt::Microsoft::UI::Windowing::OverlappedPresenter>().Restore(false);fixtureWindow.Show(false);promise.Resolve();return;}
  const bool input=mode=="input"||mode=="input-maximized";
  if(input){MONITORINFO monitor{sizeof(monitor)};if(!GetMonitorInfoW(MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST),&monitor)){promise.Reject("Owned input monitor unavailable");return;}SetWindowPos(window,HWND_TOPMOST,monitor.rcWork.left+40,monitor.rcWork.top+40,0,0,SWP_NOSIZE|SWP_SHOWWINDOW);mode=mode=="input-maximized"?"maximize":"restore";}
  int command=SW_RESTORE;if(mode=="maximize")command=SW_MAXIMIZE;else if(mode=="hide")command=SW_HIDE;else if(mode=="show")command=SW_SHOW;else if(mode=="minimize")command=SW_MINIMIZE;else if(mode!="restore"){promise.Reject("Unknown fixture window mode");return;}
  ShowWindow(window,command);
  if(mode=="show"||mode=="restore"||input){const auto foregroundThread=GetWindowThreadProcessId(GetForegroundWindow(),nullptr),currentThread=GetCurrentThreadId();const bool attached=foregroundThread&&foregroundThread!=currentThread&&AttachThreadInput(currentThread,foregroundThread,TRUE);SetForegroundWindow(window);SetActiveWindow(window);if(attached)AttachThreadInput(currentThread,foregroundThread,FALSE);}
  if(input&&GetForegroundWindow()!=window&&!clickOwnCaption(window)){promise.Reject("Owned input window could not acquire activation through its caption");return;}
  promise.Resolve();
 });}
 REACT_METHOD(focusSnapshot) void focusSnapshot(std::string field,RN::ReactPromise<RN::JSValueObject> promise)noexcept{
  if(focusWorker.joinable())focusWorker.join();const auto current=context;const auto top=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());focusWorker=std::jthread([current,promise,top,field=std::move(field)]{const auto apartment=CoInitializeEx(nullptr,COINIT_MULTITHREADED);RN::JSValueObject result;
   try{winrt::check_hresult(apartment);Microsoft::WRL::ComPtr<IUIAutomation> client;winrt::check_hresult(CoCreateInstance(CLSID_CUIAutomation,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&client)));Microsoft::WRL::ComPtr<IUIAutomationElement> focused;winrt::check_hresult(client->GetFocusedElement(&focused));int process=0;BOOL hasFocus=FALSE;std::wstring id;if(focused){winrt::check_hresult(focused->get_CurrentProcessId(&process));if(process==GetCurrentProcessId()){BSTR value=nullptr;winrt::check_hresult(focused->get_CurrentAutomationId(&value));if(value)id.assign(value,SysStringLen(value));SysFreeString(value);winrt::check_hresult(focused->get_CurrentHasKeyboardFocus(&hasFocus));}}result={{"id",winrt::to_string(id)},{"hasFocus",bool(hasFocus)},{"owned",process==GetCurrentProcessId()},{"fieldHasFocus",nullptr}};
    Microsoft::WRL::ComPtr<IUIAutomationElement> ownRoot,ownField;winrt::check_hresult(client->ElementFromHandle(top,&ownRoot));Nelyx::WindowsSemantics::AutomationVariant ownId;const auto wide=winrt::to_hstring(field);ownId.string(std::wstring(wide.c_str(),wide.size()));Microsoft::WRL::ComPtr<IUIAutomationCondition> condition;winrt::check_hresult(client->CreatePropertyCondition(UIA_AutomationIdPropertyId,ownId.data,&condition));winrt::check_hresult(ownRoot->FindFirst(TreeScope_Descendants,condition.Get(),&ownField));if(ownField){BOOL focused=FALSE;winrt::check_hresult(ownField->get_CurrentHasKeyboardFocus(&focused));result["fieldHasFocus"]=bool(focused);}}
   catch(winrt::hresult_error const& error){result={{"error",winrt::to_string(error.message())}};}if(SUCCEEDED(apartment))CoUninitialize();auto value=std::make_shared<RN::JSValueObject>(std::move(result));current.UIDispatcher().Post([promise,value]{promise.Resolve(std::move(*value));});
  });
 }
 REACT_METHOD(tab) void tab(bool reverse,RN::ReactPromise<void> promise)noexcept{context.UIDispatcher().Post([reverse,promise]{
  if(GetForegroundWindow()!=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id())){promise.Reject("Tab fixture requires its own foreground window");return;}
  for(const auto key:{VK_CONTROL,VK_SHIFT,VK_MENU})if(GetAsyncKeyState(key)&0x8000){promise.Reject("Tab fixture requires released physical modifiers");return;}
  std::vector<INPUT> inputs;const auto key=[&](WORD scan,bool up){INPUT value{};value.type=INPUT_KEYBOARD;value.ki.wScan=scan;value.ki.dwFlags=KEYEVENTF_SCANCODE|(up?KEYEVENTF_KEYUP:0);inputs.push_back(value);};
  if(reverse)key(0x2a,false);key(0x0f,false);key(0x0f,true);if(reverse)key(0x2a,true);
  if(SendInput(static_cast<UINT>(inputs.size()),inputs.data(),sizeof(INPUT))!=inputs.size()){promise.Reject("Tab fixture OS injection was incomplete");return;}promise.Resolve();
 });}
 REACT_METHOD(pointerClick) void pointerClick(std::string identifier,bool byName,RN::ReactPromise<void> promise)noexcept{
  if(focusWorker.joinable())focusWorker.join();const auto current=context;const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());
  focusWorker=std::jthread([current,promise,window,identifier=std::move(identifier),byName]{const auto apartment=CoInitializeEx(nullptr,COINIT_MULTITHREADED);RECT bounds{};std::string failure;
   try{winrt::check_hresult(apartment);Microsoft::WRL::ComPtr<IUIAutomation> client;winrt::check_hresult(CoCreateInstance(CLSID_CUIAutomation,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&client)));Microsoft::WRL::ComPtr<IUIAutomationElement> root,element;winrt::check_hresult(client->ElementFromHandle(window,&root));Nelyx::WindowsSemantics::AutomationVariant value;const auto wide=winrt::to_hstring(identifier);value.string(std::wstring(wide.c_str(),wide.size()));Microsoft::WRL::ComPtr<IUIAutomationCondition> condition;winrt::check_hresult(client->CreatePropertyCondition(byName?UIA_NamePropertyId:UIA_AutomationIdPropertyId,value.data,&condition));winrt::check_hresult(root->FindFirst(TreeScope_Descendants,condition.Get(),&element));winrt::check_bool(element!=nullptr);winrt::check_hresult(element->get_CurrentBoundingRectangle(&bounds));}
   catch(winrt::hresult_error const& error){failure=winrt::to_string(error.message());}if(SUCCEEDED(apartment))CoUninitialize();
   current.UIDispatcher().Post([promise,window,bounds,failure=std::move(failure)]{if(!failure.empty()){promise.Reject(failure.c_str());return;}const POINT point{bounds.left+(bounds.right-bounds.left)/2,bounds.top+(bounds.bottom-bounds.top)/2};POINT local=point;ScreenToClient(window,&local);std::cout<<"ANIMATION_POINTER_TARGET client="<<local.x<<","<<local.y<<" rootHit="<<(WindowFromPoint(point)==window)<<" scale="<<(lastSurfaceStatus?lastSurfaceStatus->scale:0)<<" generation="<<(lastSurfaceStatus?lastSurfaceStatus->surfaceGeneration:0)<<","<<(lastSurfaceStatus?lastSurfaceStatus->layoutRevision:0)<<","<<(lastSurfaceStatus?lastSurfaceStatus->presentedSurfaceGeneration:0)<<std::endl;
    if(bounds.right<=bounds.left||bounds.bottom<=bounds.top||GetForegroundWindow()!=window||GetAncestor(WindowFromPoint(point),GA_ROOT)!=window){promise.Reject("Pointer fixture requires a visible own foreground target");return;}
    const int left=GetSystemMetrics(SM_XVIRTUALSCREEN),top=GetSystemMetrics(SM_YVIRTUALSCREEN),width=GetSystemMetrics(SM_CXVIRTUALSCREEN),height=GetSystemMetrics(SM_CYVIRTUALSCREEN);if(width<2||height<2){promise.Reject("Invalid virtual desktop dimensions");return;}
    INPUT input[3]{};for(auto& value:input)value.type=INPUT_MOUSE;input[0].mi.dx=static_cast<LONG>((int64_t(point.x)-left)*65535/(width-1));input[0].mi.dy=static_cast<LONG>((int64_t(point.y)-top)*65535/(height-1));input[0].mi.dwFlags=MOUSEEVENTF_MOVE|MOUSEEVENTF_ABSOLUTE|MOUSEEVENTF_VIRTUALDESK;input[1].mi.dwFlags=MOUSEEVENTF_LEFTDOWN;input[2].mi.dwFlags=MOUSEEVENTF_LEFTUP;
    if(SendInput(3,input,sizeof(INPUT))!=3){promise.Reject("Pointer fixture OS injection was incomplete");return;}promise.Resolve();
   });
  });
 }
 REACT_METHOD(replaceText) void replaceText(std::string text,RN::ReactPromise<void> promise)noexcept{context.UIDispatcher().Post([text=std::move(text),promise]{
  const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());
  if(GetForegroundWindow()!=window){promise.Reject("Text fixture requires its own foreground window");return;}
  for(const auto key:{VK_CONTROL,VK_SHIFT,VK_MENU})if(GetAsyncKeyState(key)&0x8000){promise.Reject("Text fixture requires released physical modifiers");return;}
  const auto value=winrt::to_hstring(text);if(value.size()>64){promise.Reject("Text fixture exceeds its input budget");return;}
  std::vector<INPUT> inputs;
  const auto scan=[&](WORD code,bool up){INPUT input{};input.type=INPUT_KEYBOARD;input.ki.wScan=code;input.ki.dwFlags=KEYEVENTF_SCANCODE|(up?KEYEVENTF_KEYUP:0);inputs.push_back(input);};
  scan(0x1d,false);scan(0x1e,false);scan(0x1e,true);scan(0x1d,true);
  for(const auto character:value)for(const auto up:{false,true}){INPUT input{};input.type=INPUT_KEYBOARD;input.ki.wScan=character;input.ki.dwFlags=KEYEVENTF_UNICODE|(up?KEYEVENTF_KEYUP:0);inputs.push_back(input);}
  if(SendInput(static_cast<UINT>(inputs.size()),inputs.data(),sizeof(INPUT))!=inputs.size()){promise.Reject("Text fixture OS injection was incomplete");return;}promise.Resolve();
 });}
 REACT_METHOD(dragResize) void dragResize(std::string corner,RN::ReactPromise<RN::JSValueObject> promise)noexcept{auto current=context;current.UIDispatcher().Post([current,promise,corner]{
  const auto side=Nelyx::Fixture::resizeEdge(corner);if(!side.hit){promise.Reject("Choose an actual fixture resize edge or corner");return;}const bool moving=side.horizontal<0||side.vertical<0;
  const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());if(!window||!SetWindowSubclass(window,dragWindow,1,0)){promise.Reject("Resize fixture could not observe its own window");return;}if(dragWorker.joinable())dragWorker.join();dragEntered=dragExited=dragSizing=dragGeometrySamples=dragGeometryMismatches=dragSourceSamples=dragSourceMisses=0;dragBegan=dragEnded=0;dragGeometry.clear();dragProcessed.clear();MONITORINFO monitor{sizeof(monitor)};if(!GetMonitorInfoW(MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST),&monitor)){promise.Reject("Resize fixture monitor unavailable");return;}const auto mode=std::getenv("NELYX_ANIMATION_MODE");const bool live=mode&&std::string_view(mode)=="live-resize",observePixels=live&&(!std::getenv("NELYX_ANIMATION_PIXELS")||std::string_view(std::getenv("NELYX_ANIMATION_PIXELS"))!="0");const double logicalWidth=std::getenv("NELYX_ANIMATION_RESIZE_WIDTH")?std::atof(std::getenv("NELYX_ANIMATION_RESIZE_WIDTH")):500.;if(!std::isfinite(logicalWidth)||logicalWidth<400||logicalWidth>800){promise.Reject("Resize width requires 400..800 logical pixels");return;}const LONG requestedWidth=static_cast<LONG>(std::round(logicalWidth*GetDpiForWindow(window)/96.));const LONG extent=live?static_cast<LONG>(std::round(500*GetDpiForWindow(window)/96.)):1000;const auto work=monitor.rcWork;SetWindowPos(window,HWND_TOP,work.left+std::max<LONG>(40,(work.right-work.left-extent)/2)+(moving?160:0),work.top+(moving?160:40),std::min<LONG>(live?requestedWidth:extent,work.right-work.left-480),std::min<LONG>(extent,work.bottom-work.top-320),SWP_SHOWWINDOW);ShowWindow(window,SW_SHOW);const auto foregroundThread=GetWindowThreadProcessId(GetForegroundWindow(),nullptr),currentThread=GetCurrentThreadId();const bool attached=foregroundThread!=currentThread&&AttachThreadInput(currentThread,foregroundThread,TRUE);SetForegroundWindow(window);SetActiveWindow(window);if(attached)AttachThreadInput(currentThread,foregroundThread,FALSE);
  MONITORINFOEXW display{};display.cbSize=sizeof(display);DEVMODEW displayMode{};displayMode.dmSize=sizeof(displayMode);if(!GetMonitorInfoW(MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST),reinterpret_cast<MONITORINFO*>(&display))||!EnumDisplaySettingsW(display.szDevice,ENUM_CURRENT_SETTINGS,&displayMode)){promise.Reject("Resize display condition unavailable");return;}
  std::cout<<"ANIMATION_RESIZE_ENV {\"monitorWidth\":"<<display.rcMonitor.right-display.rcMonitor.left<<",\"monitorHeight\":"<<display.rcMonitor.bottom-display.rcMonitor.top<<",\"refreshHz\":"<<displayMode.dmDisplayFrequency<<",\"dpi\":"<<GetDpiForWindow(window)<<",\"primary\":"<<((display.dwFlags&MONITORINFOF_PRIMARY)?"true":"false")<<",\"clock\":\"QPC\",\"warmupMs\":500,\"hoverSettleMs\":"<<(observePixels?300:0)<<"}"<<std::endl;
  dragWorker=std::thread([window,current,promise,observePixels,moving,side]{POINT original{};const bool saved=GetCursorPos(&original);bool pressed=false;const auto edge=[](DWORD flags){INPUT input{};input.type=INPUT_MOUSE;input.mi.dwFlags=flags;if(SendInput(1,&input,sizeof(input))!=1)throw std::runtime_error("OS rejected the fixture mouse edge");};try{
   winrt::check_hresult(DwmFlush());
   // Foreground activation can finish after the UI call returns. Observe it before sending mouse input.
   for(int attempt=0;attempt<10&&GetForegroundWindow()!=window;++attempt)std::this_thread::sleep_for(std::chrono::milliseconds(20));
   if(GetForegroundWindow()!=window)throw std::runtime_error("Owned resize window could not acquire foreground activation");if(GetAsyncKeyState(VK_LBUTTON)&0x8000)throw std::runtime_error("Resize fixture requires the physical mouse button to be released");RECT rect{};if(!GetWindowRect(window,&rect))throw std::runtime_error("Owned resize window bounds unavailable");std::vector<POINT> corners;for(int inset=1;inset<=24;inset++){DWORD_PTR hit=0;const int cx=side.horizontal<0?rect.left+inset:side.horizontal>0?rect.right-inset:(rect.left+rect.right)/2,cy=side.vertical<0?rect.top+inset:side.vertical>0?rect.bottom-inset:(rect.top+rect.bottom)/2;if(SendMessageTimeoutW(window,WM_NCHITTEST,0,MAKELPARAM(cx,cy),SMTO_ABORTIFHUNG,1000,&hit)&&hit==side.hit)corners.push_back({cx,cy});}if(corners.empty())throw std::runtime_error("Owned requested corner was not resizeable");const auto target=corners[corners.size()/2];const int x=target.x,y=target.y;
   POINT actual{};RECT clip{};GetClipCursor(&clip);SetLastError(ERROR_SUCCESS);const bool positioned=SetCursorPos(x,y);const auto pointerError=GetLastError();const bool observed=GetCursorPos(&actual);std::cout<<"ANIMATION_DRAG_TARGET requested="<<x<<","<<y<<" actual="<<actual.x<<","<<actual.y<<" positioned="<<positioned<<" observed="<<observed<<" error="<<pointerError<<" rect="<<rect.left<<","<<rect.top<<","<<rect.right<<","<<rect.bottom<<" clip="<<clip.left<<","<<clip.top<<","<<clip.right<<","<<clip.bottom<<std::endl;if(!positioned||!observed||actual.x!=x||actual.y!=y)throw std::runtime_error("Owned resize border did not match the observed desktop pointer");// A drag starts with motion after button-down. Submit both in input order;
   // waiting for WM_ENTERSIZEMOVE before any motion can deadlock its threshold.
   const int left=GetSystemMetrics(SM_XVIRTUALSCREEN),top=GetSystemMetrics(SM_YVIRTUALSCREEN),width=GetSystemMetrics(SM_CXVIRTUALSCREEN),height=GetSystemMetrics(SM_CYVIRTUALSCREEN);if(width<2||height<2||GetAncestor(WindowFromPoint({x,y}),GA_ROOT)!=window)throw std::runtime_error("Owned resize input target unavailable");
   INPUT hover{};hover.type=INPUT_MOUSE;hover.mi.dx=static_cast<LONG>((int64_t(x)-left)*65535/(width-1));hover.mi.dy=static_cast<LONG>((int64_t(y)-top)*65535/(height-1));hover.mi.dwFlags=MOUSEEVENTF_MOVE|MOUSEEVENTF_ABSOLUTE|MOUSEEVENTF_VIRTUALDESK;
   if(SendInput(1,&hover,sizeof(INPUT))!=1)throw std::runtime_error("Owned resize hover input was incomplete");
   // Let the previous client hover paint and external pointer feedback settle
   // after moving onto the native border, before calibrating resting glyphs.
   if(observePixels)std::this_thread::sleep_for(std::chrono::milliseconds(300));
   const auto responsiveSetting=std::getenv("NELYX_ANIMATION_RESPONSIVE_SHORT_HEADER");const bool responsiveShort=responsiveSetting&&std::string_view(responsiveSetting)=="1";
   const auto pixels=observePixels?std::make_unique<WindowsResizePixels>(window,responsiveShort):nullptr;
   INPUT start[3]{};for(auto& value:start)value.type=INPUT_MOUSE;const auto position=[&](INPUT& value,int px,int py){value.mi.dx=static_cast<LONG>((int64_t(px)-left)*65535/(width-1));value.mi.dy=static_cast<LONG>((int64_t(py)-top)*65535/(height-1));value.mi.dwFlags=MOUSEEVENTF_MOVE|MOUSEEVENTF_ABSOLUTE|MOUSEEVENTF_VIRTUALDESK;};position(start[0],x,y);start[1].mi.dwFlags=MOUSEEVENTF_LEFTDOWN;position(start[2],x+side.horizontal*28,y+side.vertical*14);const auto admitted=SendInput(3,start,sizeof(INPUT));pressed=admitted>=2;if(admitted!=3)throw std::runtime_error("OS resize start input was incomplete");auto deadline=Clock::now()+std::chrono::seconds(2);while(!dragEntered&&Clock::now()<deadline)std::this_thread::sleep_for(std::chrono::milliseconds(10));if(!dragEntered)throw std::runtime_error("The actual mouse size loop did not start");
   const double hz=std::getenv("NELYX_ANIMATION_DRAG_HZ")?std::atof(std::getenv("NELYX_ANIMATION_DRAG_HZ")):(std::getenv("NELYX_ANIMATION_DRAG_INTERVAL_MS")?1000./std::atof(std::getenv("NELYX_ANIMATION_DRAG_INTERVAL_MS")):60.);
   const auto resizeMode=std::getenv("NELYX_ANIMATION_MODE");
   const double duration=std::getenv("NELYX_ANIMATION_DRAG_DURATION_MS")?std::atof(std::getenv("NELYX_ANIMATION_DRAG_DURATION_MS")):(resizeMode&&std::string_view(resizeMode)=="live-resize"?4000.:2000.);
   std::vector<Nelyx::Fixture::ResizeObservation> injected;uint64_t sequence=0;
   Nelyx::Fixture::runResizeTrajectory(hz,duration,84.*GetDpiForWindow(window)/96.,[&](double displacement){
    const int delta=static_cast<int>(std::round(displacement));INPUT input{};input.type=INPUT_MOUSE;position(input,x+side.horizontal*delta,y+side.vertical*delta/3);input.mi.dwExtraInfo=static_cast<ULONG_PTR>(0x4e580000u+(++sequence));
    const auto now=RNSkia::windowsMonotonicMilliseconds();if(SendInput(1,&input,sizeof(input))!=1)throw std::runtime_error("OS resize move input was incomplete");
    RECT expected=rect;if(side.horizontal<0)expected.left-=delta;else if(side.horizontal>0)expected.right+=delta;if(side.vertical<0)expected.top-=delta/3;else if(side.vertical>0)expected.bottom+=delta/3;injected.push_back({now,expected,uint64_t(input.mi.dwExtraInfo)});
   },[&]{if(pixels)pixels->sample();});
   edge(MOUSEEVENTF_LEFTUP);pressed=false;deadline=Clock::now()+std::chrono::seconds(2);while(!dragExited&&Clock::now()<deadline)std::this_thread::sleep_for(std::chrono::milliseconds(10));if(!dragExited||!dragSizing)throw std::runtime_error("The actual mouse size loop did not resize and finish");
   const auto displayed=pixels?pixels->displayChanges:std::vector<Nelyx::Fixture::ResizeObservation>{};
   const auto originChanges=pixels?pixels->originChanges:0,originTransitions=pixels?pixels->originTransitions:0;const int maximumOriginDelta=pixels?pixels->maximumOriginDelta:0;
   const auto pixelSamples=pixels?pixels->samples:0,racedSamples=pixels?pixels->racedSamples:0,backgroundExposures=pixels?pixels->backgroundExposures:0,glyphChanges=pixels?pixels->glyphChanges:0,missingGlyphs=pixels?pixels->missingGlyphs:0,edgeGlyphChanges=pixels?pixels->edgeGlyphChanges:0,missingEdgeGlyphs=pixels?pixels->missingEdgeGlyphs:0;const int maximumGlyphDelta=pixels?pixels->maximumGlyphDelta:0,glyphWidth=pixels?pixels->referenceWidth():0,glyphHeight=pixels?pixels->referenceHeight():0,maximumEdgeDelta=pixels?pixels->maximumEdgeDelta:0,distinctPixelSizes=pixels?pixels->distinctSizes():0;
   current.UIDispatcher().Post([=]{std::cout<<"ANIMATION_DRAG entered="<<dragEntered<<" exited="<<dragExited<<" sizing="<<dragSizing<<" pixelSamples="<<pixelSamples<<" backgroundExposures="<<backgroundExposures<<" glyphChanges="<<glyphChanges<<" maximumGlyphDelta="<<maximumGlyphDelta<<" geometrySamples="<<dragGeometrySamples<<" geometryMismatches="<<dragGeometryMismatches<<" edgeGlyphChanges="<<edgeGlyphChanges<<" maximumEdgeDelta="<<maximumEdgeDelta<<std::endl;promise.Resolve(RN::JSValueObject{{"displayed",resizeRows(displayed)},{"requestedHz",hz},{"captureEnabled",observePixels},{"injected",resizeRows(injected)},{"processed",resizeRows(dragProcessed)},{"geometry",resizeRows(dragGeometry)},{"sourceSamples",double(dragSourceSamples.load())},{"sourceMisses",double(dragSourceMisses.load())},{"began",dragBegan.load()},{"ended",dragEnded.load()},{"pixelSamples",double(pixelSamples)},{"distinctPixelSizes",double(distinctPixelSizes)},{"racedSamples",double(racedSamples)},{"backgroundExposures",double(backgroundExposures)},{"glyphChanges",double(glyphChanges)},{"missingGlyphs",double(missingGlyphs)},{"maximumGlyphDelta",double(maximumGlyphDelta)},{"glyphWidth",double(glyphWidth)},{"glyphHeight",double(glyphHeight)},{"geometrySamples",double(dragGeometrySamples.load())},{"geometryMismatches",double(dragGeometryMismatches.load())},{"edgeGlyphChanges",double(edgeGlyphChanges)},{"missingEdgeGlyphs",double(missingEdgeGlyphs)},{"maximumEdgeDelta",double(maximumEdgeDelta)},{"responsiveShortHeader",responsiveShort&&observePixels},{"originChanges",double(originChanges)},{"originTransitions",double(originTransitions)},{"maximumOriginDelta",double(maximumOriginDelta)}});});
  }catch(std::exception const& error){std::cout<<"ANIMATION_DRAG_FAILURE "<<error.what()<<std::endl;if(pressed){try{edge(MOUSEEVENTF_LEFTUP);}catch(...){}}PostMessageW(window,WM_KEYDOWN,VK_ESCAPE,1);PostMessageW(window,WM_KEYUP,VK_ESCAPE,0xc0000001);promise.Reject(error.what());}if(saved)SetCursorPos(original.x,original.y);});
 });}
 REACT_METHOD(cancelResizePreparation) void cancelResizePreparation(RN::ReactPromise<RN::JSValueObject> promise)noexcept{context.UIDispatcher().Post([promise]{
  try{
   const auto window=winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id());RECT original{},client{};
   if(!GetWindowRect(window,&original)||!GetClientRect(window,&client)||!lastSurfaceStatus)throw std::runtime_error("Cancellation probe has no owned surface");
   auto proposed=original;proposed.left-=24;proposed.top-=16;SendMessageW(window,WM_SIZING,WMSZ_TOPLEFT,reinterpret_cast<LPARAM>(&proposed));
   const auto prepared=*lastSurfaceStatus;const bool invisible=prepared.width==client.right+24&&prepared.height==client.bottom+16&&prepared.presentedWidth==client.right&&prepared.presentedHeight==client.bottom;
   SendMessageW(window,WM_EXITSIZEMOVE,0,0);RECT actual{};if(!GetWindowRect(window,&actual))throw std::runtime_error("Cancellation probe lost its window");
   const auto settled=*lastSurfaceStatus;
   const bool restored=EqualRect(&actual,&original)&&settled.presentedWidth==client.right&&settled.presentedHeight==client.bottom&&settled.presentedSurfaceGeneration==settled.layoutRevision;
   promise.Resolve(RN::JSValueObject{{"preparedOffTree",invisible},{"restoredActualGeometry",restored}});
  }catch(std::exception const& error){promise.Reject(error.what());}
 });}
 REACT_METHOD(begin) void begin(std::string name)noexcept{context.UIDispatcher().Post([name]{phase=name;frames=0;intervals.clear();began=Clock::now();NelyxAnimationDiagnostics::begin();NelyxAnimationProfile::begin(name.c_str());std::cout<<"ANIMATION_BEGIN "<<name<<std::endl;});}
 REACT_METHOD(end) void end()noexcept{context.UIDispatcher().Post([]{NelyxAnimationProfile::end();const auto ms=std::chrono::duration<double,std::milli>(Clock::now()-began).count();std::ostringstream report;report<<"ANIMATION_NATIVE {\"phase\":\""<<phase<<"\",\"elapsedMs\":"<<ms<<",\"frames\":"<<frames<<",\"intervals\":[";for(size_t i=0;i<intervals.size();i++){if(i)report<<",";report<<intervals[i];}report<<"]}\n";std::cout<<report.str()<<std::flush;NelyxAnimationDiagnostics::end(phase);phase.clear();});}
 REACT_METHOD(complete) void complete()noexcept{auto current=context;current.UIDispatcher().Post([current]{finished=true;const auto close=current.Properties().Get(Nelyx::PlatformCloseRequestProperty());if(close)(*close)();});}
};
struct Provider:winrt::implements<Provider,RN::IReactPackageProvider>{void CreatePackage(RN::IReactPackageBuilder const& builder)noexcept{
 AddAttributedModules(builder,true);RNSkia::WindowsSkiaViewOptions options;options.observeStatus=[](auto const& status){lastSurfaceStatus=status;startupSurfaceFrames=status.frames;if(status.phase=="frame"&&!startupSurfaceObserved){startupSurfaceObserved=true;startupMilestone("first-surface-updated");}if(status.phase=="frame"&&failCloseProbe){failCloseProbe=false;std::cout<<"ANIMATION_EXPECT_FAILED_CLOSE presentedFrame="<<status.frames<<std::endl;if(!PostMessageW(winrt::Microsoft::UI::GetWindowFromWindowId(fixtureWindow.Id()),WM_CLOSE,0,0))ExitProcess(3);throw std::runtime_error("resize presentation failure probe");}if(status.phase=="frame"&&!phase.empty()){const auto now=Clock::now();if(frames++)intervals.push_back(std::chrono::duration<double,std::milli>(now-last).count());last=now;}};
 if(const auto probe=std::getenv("NELYX_ANIMATION_SOURCE_PIXELS");probe&&std::string_view(probe)=="1")options.observeCopy=observeResizeSource;
 RNSkia::RegisterWindowsSkiaView(builder,options);Nelyx::WindowsSemantics::RegisterSemanticsComponent(builder);
}};
}
int main(int argc,char** argv){
 NelyxAnimationFault::install();
 WheelCursorCleanup wheelCursorCleanup;
 FILETIME created{},ended{},kernel{},user{},entryTime{};
 if(!GetProcessTimes(GetCurrentProcess(),&created,&ended,&kernel,&user))return 2;
 startupEntry=RNSkia::windowsMonotonicMilliseconds();GetSystemTimePreciseAsFileTime(&entryTime);
 ULARGE_INTEGER creationTicks{},entryTicks{};creationTicks.LowPart=created.dwLowDateTime;creationTicks.HighPart=created.dwHighDateTime;entryTicks.LowPart=entryTime.dwLowDateTime;entryTicks.HighPart=entryTime.dwHighDateTime;
 startupCreationToEntry=double(entryTicks.QuadPart-creationTicks.QuadPart)/10000.;startupMilestone("process-entry");
 const bool manual=argc==3&&std::string(argv[2])=="manual",startupClose=argc==3&&std::string(argv[2])=="startup-close";
 startupDeadlineProbe=argc==3&&std::string(argv[2])=="startup-timeout";
 if(const auto value=std::getenv("NELYX_ANIMATION_V8_PROFILE");value&&std::string_view(value)=="1"&&argc==2){
  if(!std::getenv("NELYX_ANIMATION_ENGINE")||std::string_view(std::getenv("NELYX_ANIMATION_ENGINE"))!="v8")return 2;
  try{v8Profile=true;configureV8Profile();}catch(std::exception const& error){std::cerr<<"ANIMATION_V8_PROFILE_FAILURE "<<error.what()<<std::endl;return 2;}
 }
 if(argc!=2&&(argc!=3||(std::string(argv[2])!="failed-close"&&!manual&&!startupClose&&!startupDeadlineProbe)))return 2;failCloseProbe=argc==3&&std::string(argv[2])=="failed-close";winrt::init_apartment(winrt::apartment_type::single_threaded);SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
 RNSkia::WindowsReactApp app;auto settings=app.ReactNativeHost().InstanceSettings();settings.PackageProviders().Append(winrt::make<Provider>());settings.BundleRootPath(winrt::to_hstring(std::string("file://")+argv[1]+"/"));settings.JavaScriptBundleFile(L"input-surface");settings.UseDeveloperSupport(false);settings.JSIEngineOverride(std::getenv("NELYX_ANIMATION_ENGINE")&&std::string(std::getenv("NELYX_ANIMATION_ENGINE"))=="v8"?RN::JSIEngine::V8:RN::JSIEngine::Hermes);settings.UseFastRefresh(false);settings.UseDirectDebugger(false);settings.NativeLogger([](auto level,auto const& message){const auto text=winrt::to_string(message);if(!recordBootStage(text))std::cerr<<"RNW "<<int(level)<<" "<<text<<std::endl;});
 auto window=app.AppWindow();fixtureWindow=window;window.Resize({1000,1000});window.Title(L"Nelyx animation regression");app.ReactViewOptions().ComponentName(startupDeadlineProbe?L"NelyxStartupDeadlineProbe":L"NelyxTestbed2");
 const auto hwnd=winrt::Microsoft::UI::GetWindowFromWindowId(window.Id());
 placeContinuousWindow(hwnd);
 if(!SetWindowSubclass(hwnd,startupObservation,2,0))return 2;
 // Consume spawnSync's STARTF_USESHOWWINDOW/SW_HIDE once, before installing
 // either host. RNW's real subsequent Show is then observed without a fixture
 // restore/show call. The SDK must keep it hidden until its first surface.
 if(const auto mode=std::getenv("NELYX_ANIMATION_MODE");mode&&std::string_view(mode)=="startup-probe")ShowWindow(hwnd,SW_HIDE);
 startupMilestone("host-install-start");
 auto host=RNSkia::WindowsAppHost::install(settings,window,app.ReactNativeWindow(),[](std::string const& message){std::cout<<message<<std::endl;if(message=="NELYX_WINDOWS_HOST prepared")startupMilestone("host-prepared");if(message=="NELYX_WINDOWS_HOST instance-loaded")startupMilestone("instance-loaded");if(message.starts_with("NELYX_WINDOWS_HOST first-content-ready"))startupMilestone("first-content-ready");if(message.find("closed views=0 consumers=0 gpuDrained=1 inputRetired=1")!=std::string::npos)closed=true;});
 settings.RedBoxHandler(winrt::make<ErrorReporter>());
 settings.InstanceLoaded([hwnd=winrt::Microsoft::UI::GetWindowFromWindowId(window.Id())](auto const&,auto const& args){if(args.Failed())PostMessageW(hwnd,WM_CLOSE,0,0);});
 auto timer=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread().CreateTimer();timer.Interval(std::chrono::seconds(manual||std::getenv("NELYX_CONTINUOUS_SCROLL")?600:90));timer.IsRepeating(false);timer.Tick([](auto const&,auto const&){std::cerr<<"Animation watchdog phase="<<phase<<" frames="<<frames<<std::endl;{std::lock_guard lock(bootStageMutex);std::cerr<<"ANIMATION_LAST_BOOT changes="<<bootStageChanges<<" stage="<<lastBootStage<<std::endl;}ExitProcess(2);});timer.Start();if(startupClose)PostMessageW(winrt::Microsoft::UI::GetWindowFromWindowId(window.Id()),WM_CLOSE,0,0);app.Start();timer.Stop();if(dragWorker.joinable())dragWorker.join();fixtureWindow=nullptr;std::cout<<"ANIMATION_RESIZE count="<<resizeCount<<std::endl;
 PROCESS_MEMORY_COUNTERS_EX memory{};memory.cb=sizeof(memory);
 if(GetProcessMemoryInfo(GetCurrentProcess(),reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&memory),sizeof(memory)))std::cout<<"ANIMATION_MEMORY {\"peakWorkingSetBytes\":"<<memory.PeakWorkingSetSize<<",\"workingSetBytes\":"<<memory.WorkingSetSize<<",\"privateBytes\":"<<memory.PrivateUsage<<"}"<<std::endl;
 return (finished||manual)&&closed?0:1;
}
