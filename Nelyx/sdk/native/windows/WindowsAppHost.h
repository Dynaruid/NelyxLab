// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <CompositionDevice.h>
#include <CompositionSession.h>
#include <SkiaView.h>
#include <winrt/Microsoft.ReactNative.Composition.Experimental.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <ReactPropertyBag.h>
#include <exception>
#include <filesystem>
#include <commctrl.h>
#include <dwmapi.h>
#pragma comment(lib,"comctl32.lib")
#pragma comment(lib,"dwmapi.lib")
#include "PlatformServices.h"
#include "TextInputHost.h"
#include "TextInputSkiaSurface.h"
#include "WindowsReactApp.h"

namespace RNSkia {
/** RNW owns the window/event loop; this UI owner composes the Skia session and checked close. */
class WindowsAppHost final : public std::enable_shared_from_this<WindowsAppHost> {
public:
  using Log=std::function<void(const std::string&)>;
  static std::shared_ptr<WindowsAppHost> install(
      winrt::Microsoft::ReactNative::ReactInstanceSettings const& settings,
      winrt::Microsoft::UI::Windowing::AppWindow const& window,
        winrt::Microsoft::ReactNative::ReactNativeWindow const& inputWindow,Log log={},uint32_t vendor=0,int showCommand=SW_SHOWNORMAL) {
    auto self=std::shared_ptr<WindowsAppHost>(new WindowsAppHost(std::move(log)));
    winrt::com_ptr<IDXGIFactory1> factory;winrt::check_hresult(CreateDXGIFactory1(__uuidof(IDXGIFactory1),factory.put_void()));
    winrt::com_ptr<IDXGIAdapter1> adapter;
    // Hybrid laptops can enumerate a render-only GPU first. Composition's
    // default device must share the primary display adapter's presentation path.
    const auto primary=MonitorFromPoint(POINT{0,0},MONITOR_DEFAULTTOPRIMARY);
    for(UINT index=0;;++index){winrt::com_ptr<IDXGIAdapter1> candidate;auto result=factory->EnumAdapters1(index,candidate.put());
      if(result==DXGI_ERROR_NOT_FOUND)break;winrt::check_hresult(result);DXGI_ADAPTER_DESC1 description{};winrt::check_hresult(candidate->GetDesc1(&description));
      if(description.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)continue;
      bool selected=vendor&&description.VendorId==vendor;
      if(!vendor)for(UINT outputIndex=0;;++outputIndex){winrt::com_ptr<IDXGIOutput> output;auto outputResult=candidate->EnumOutputs(outputIndex,output.put());
        if(outputResult==DXGI_ERROR_NOT_FOUND)break;winrt::check_hresult(outputResult);DXGI_OUTPUT_DESC outputDescription{};winrt::check_hresult(output->GetDesc(&outputDescription));
        if(outputDescription.AttachedToDesktop&&outputDescription.Monitor==primary){selected=true;break;}}
      if(selected){self->write("adapter="+winrt::to_string(winrt::hstring(description.Description))+" vendor="+std::to_string(description.VendorId)+" selection="+(vendor?"explicit-vendor":"primary-display"));adapter=std::move(candidate);break;}}
    if(!adapter)throw std::runtime_error(vendor?"Requested Windows hardware adapter unavailable":"No hardware adapter owns the primary display; select an explicit Windows GPU vendor");
    auto compositor=winrt::Microsoft::ReactNative::Composition::CompositionUIService::GetCompositor(settings.Properties());
    const auto controller=winrt::Microsoft::ReactNative::ReactPropertyBag(settings.Properties()).Get(WindowsCompositorControllerProperty());
    if(!controller||controller.Compositor()!=compositor)throw std::runtime_error("Windows exact resize requires the matching WindowsReactApp compositor owner");
    self->commitController=controller;
    self->device=std::make_shared<WindowsCompositionDevice>(compositor,adapter.get(),winrt::Microsoft::UI::GetWindowFromWindowId(window.Id()));
    self->session=std::make_shared<WindowsCompositionSession>(self->device->nativeOptions());
    winrt::Microsoft::ReactNative::ReactPropertyBag bag{settings.Properties()};
    bag.Set(WindowsCompositionDeviceProperty(),self->device);bag.Set(WindowsCompositionSessionProperty(),self->session);
    auto dispatcher=settings.Properties().Get(winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIDispatcherProperty()).try_as<winrt::Microsoft::ReactNative::IReactDispatcher>();
    if(!dispatcher||!dispatcher.HasThreadAccess())throw std::runtime_error("Owning RNW UI dispatcher unavailable");
    // The host owns proposed and actual Arrange transactions. RNW's separate
    // AppWindow.Changed layout can otherwise overwrite a prepared proposal.
    inputWindow.ResizePolicy(winrt::Microsoft::ReactNative::ContentSizePolicy::None);
    self->dispatcher=dispatcher;self->windowId=window.Id();self->nativeIsland=inputWindow.ReactNativeIsland();
    self->nativeBridge=inputWindow.ContentSiteBridge().as<winrt::Microsoft::UI::Content::DesktopChildSiteBridge>();
    self->nativeBridge.ResizePolicy(winrt::Microsoft::UI::Content::ContentSizePolicy::None);
    self->observedWindow=window;self->updateVisibility();
    self->startupWindow=winrt::Microsoft::UI::GetWindowFromWindowId(window.Id());self->showCommand=showCommand;
    self->session->windowPointer=WindowsWindowPointer::create(self->startupWindow,winrt::Microsoft::UI::GetWindowFromWindowId(self->nativeBridge.WindowId()),[weak=std::weak_ptr<WindowsCompositionSession>(self->session)](std::string reason){if(auto session=weak.lock())session->fail(std::move(reason));});
    // Composition owns the client pixels. A separate USER32 redirection bitmap
    // is another independently resized plane, including between exact frames.
    if(!(GetWindowLongPtrW(self->startupWindow,GWL_EXSTYLE)&WS_EX_NOREDIRECTIONBITMAP))throw std::runtime_error("Composition root requires creation without USER32 redirection");
    if(!SetWindowSubclass(self->startupWindow,startupSubclass,reinterpret_cast<UINT_PTR>(self.get()),reinterpret_cast<DWORD_PTR>(self.get())))throw std::runtime_error("First content show gate unavailable");
    if(!SetTimer(self->startupWindow,reinterpret_cast<UINT_PTR>(self.get()),30000,nullptr))throw std::runtime_error("First content startup deadline unavailable");
    self->arrangeClient();
    self->session->prepareFirstContent([weak=std::weak_ptr<WindowsAppHost>(self)]{if(auto host=weak.lock()){
      if(host->closePending||host->closed)return;
      host->firstContent=true;KillTimer(host->startupWindow,reinterpret_cast<UINT_PTR>(host.get()));
      host->commitController.Commit();
      host->write("first-content-ready displayed=unobserved visibleBefore="+std::to_string(IsWindowVisible(host->startupWindow)?1:0));
      if(host->showCommand!=SW_HIDE)ShowWindow(host->startupWindow,host->showCommand);
      host->updateVisibility();host->write(host->showCommand==SW_HIDE?"prepared-hidden":"shown");
    }});
    self->visibilityChanged=window.Changed([weak=std::weak_ptr<WindowsAppHost>(self)](auto const&,auto const&){if(auto host=weak.lock())try{host->updateVisibility();}catch(std::exception const& error){host->session->fail();host->write(std::string("visibility-failed ")+error.what());}catch(...){host->session->fail();host->write("visibility-failed nativeHRESULT");}});
    self->input=Nelyx::WindowsInput::installTextInputRoot(settings,inputWindow,[weak=std::weak_ptr<WindowsAppHost>(self)](std::string const& error){if(auto host=weak.lock())host->write("text-input-failed "+error);});
    self->observedIsland=self->input->island();self->islandVisibilityChanged=self->observedIsland.StateChanged([weak=std::weak_ptr<WindowsAppHost>(self)](auto const&,auto const&){if(auto host=weak.lock())try{host->updateVisibility();}catch(...){host->session->fail();host->write("visibility-failed island-state");}});
    self->input->observeCharacters([keyboard=std::weak_ptr<ObservedKeyboardState>(WindowsKeyboardState(bag))](uint32_t unit,uint32_t scan,uint32_t repeat,uint64_t epoch){if(auto current=keyboard.lock())current->character(unit,scan,repeat,epoch);});
    self->input->observeConsumedKeyUps([keyboard=std::weak_ptr<ObservedKeyboardState>(WindowsKeyboardState(bag))](uint32_t key,uint32_t scan,uint32_t repeat)->std::function<void()>{
      const auto current=keyboard.lock();const auto stamp=current?current->focusStamp():std::nullopt;if(!stamp)return {};
      return [keyboard,stamp=*stamp,key,scan,repeat]{if(auto current=keyboard.lock())current->consumedKeyUp(stamp,key,scan,repeat);};
    });
    Nelyx::WindowsInput::installSkiaTextInputSurfaces(settings,self->input);
    bag.Set(Nelyx::PlatformCloseRequestProperty(),std::function<void()>([self]{self->requestClose();}));
    // RNW raises InstanceLoaded on its JS dispatcher after executing the bundle.
    // The SDK has registered its shutdown handler by then. Transfer only Failed
    // to the UI owner; neither JSI handles nor GPU objects cross this callback.
    settings.InstanceLoaded([self,dispatcher](auto const&,auto const& args){
      const bool failed=args.Failed();dispatcher.Post([self,failed]{
        self->loadComplete=true;self->loadFailed=failed;
        self->write(failed?"instance-load-failed":"instance-loaded");
          if(failed)self->failedClose("JavaScript bundle failed during startup");
        if(self->closePending)self->requestClose();
      });
    });
    window.Closing([self](auto const&,auto const& args){args.Cancel(true);self->requestClose();});
    self->write("prepared");
    // Reject a missing local release bundle before RNW enters its loader. That
    // loader can terminate before InstanceLoaded reports Failed. Network/dev
    // sources retain their own asynchronous load/failure contract.
    const std::wstring bundleRoot(settings.BundleRootPath());
    if(!settings.UseDeveloperSupport()&&bundleRoot.starts_with(L"file://")){
      const auto file=std::filesystem::path(bundleRoot.substr(7))/(std::wstring(settings.JavaScriptBundleFile())+L".bundle");
      std::error_code error;
      if(!std::filesystem::is_regular_file(file,error)||std::filesystem::file_size(file,error)==0||error)
        self->failedClose("Local startup bundle unavailable");
    }
    return self;
  }
private:
  static LRESULT CALLBACK startupSubclass(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam,UINT_PTR id,DWORD_PTR reference){
    auto* host=reinterpret_cast<WindowsAppHost*>(reference);
    if(message==WM_WINDOWPOSCHANGING&&lparam){
      auto* position=reinterpret_cast<WINDOWPOS*>(lparam);
      // The exact Composition frame owns all client pixels. USER32's valid-bit
      // copy can otherwise translate an old child image while resizing its HWND.
      if(!(position->flags&SWP_NOSIZE))position->flags|=SWP_NOCOPYBITS;
    }
    if(message==WM_WINDOWPOSCHANGING&&!host->firstContent){auto* position=reinterpret_cast<WINDOWPOS*>(lparam);position->flags&=~SWP_SHOWWINDOW;}
    if(message==WM_TIMER&&wparam==id){KillTimer(hwnd,id);host->failedClose("First content startup deadline exceeded");}
    if(message==WM_SIZING&&lparam&&host->firstContent&&!host->closing&&!host->closed){
      try{host->prepareSizing(*reinterpret_cast<const RECT*>(lparam));}
      catch(std::exception const& error){host->resizeFailure(error.what());}
      catch(...){host->resizeFailure("Native resize preparation HRESULT failure");}
    }
    if(message==WM_SIZE&&wparam!=SIZE_MINIMIZED&&!host->closing&&!host->closed){
      try{host->arrangeClient();if(host->firstContent)host->finishActualResize();}catch(std::exception const& error){host->resizeFailure(error.what());}
      catch(...){host->resizeFailure("RNW live resize Arrange failed");}
    }
    if(message==WM_WINDOWPOSCHANGED){
      // USER32 has committed the new client rectangle at entry. Submit the
      // exact prepared front before default WM_SIZE and other window observers.
      if(host->firstContent&&host->resizeTransaction&&!host->arranging&&!host->closing&&!host->closed)try{host->arrangeClient();host->finishActualResize();}
      catch(std::exception const& error){host->resizeFailure(error.what());}
      catch(...){host->resizeFailure("Native resize commit HRESULT failure");}
      return DefSubclassProc(hwnd,message,wparam,lparam);
    }
    if(message==WM_EXITSIZEMOVE){
      try{host->arrangeClient();host->finishActualResize();}catch(std::exception const& error){host->resizeFailure(error.what());}
      catch(...){host->resizeFailure("Native resize settle HRESULT failure");}
    }
    if(message==WM_NCDESTROY){KillTimer(hwnd,id);RemoveWindowSubclass(hwnd,startupSubclass,id);}
    return DefSubclassProc(hwnd,message,wparam,lparam);
  }
  void arrangeClient(){
    if(arranging||!nativeIsland)return;RECT client{};if(!GetClientRect(startupWindow,&client))throw std::runtime_error("Live resize client bounds unavailable");
    const auto width=client.right-client.left,height=client.bottom-client.top;const auto scale=float(GetDpiForWindow(startupWindow))/96.f;
    if(width<=0||height<=0||scale<=0)return;
    if(width==clientWidth&&height==clientHeight&&scale==clientScale)return;
    // Programmatic changes and a rejected sizing proposal still render the
    // actual extent. Their WM_WINDOWPOSCHANGED commits the exact new front.
    if(firstContent){
      session->resize->resolve(false);resizeTransaction.reset();
      const auto id=session->resize->begin(false);resizeTransaction=ResizeTransaction{id,width,height};
    }
    arrangeExtent(width,height,scale);
    if(resizeTransaction){
      const auto deadline=resizeDeadline();
      if(!session->resize->waitUntil([this]{return resizeReady();},deadline))resizeTimeout("actual-frame");
    }
  }
  void arrangeExtent(int width,int height,float scale){
    arranging=true;
    try{
      ensureIslandCapacity(width,height);
      // Declared full-window canvases receive canonical metrics synchronously.
      // Fabric's constraint/mount delivery must not control resize admission.
      session->setWindowViewport(width,height,scale);
      winrt::Microsoft::ReactNative::LayoutConstraints constraints;constraints.LayoutDirection=winrt::Microsoft::ReactNative::LayoutDirection::Undefined;
      constraints.MaximumSize=constraints.MinimumSize={float(width)/scale,float(height)/scale};
      if(nativeIsland.ScaleFactor()!=scale)nativeIsland.ScaleFactor(scale);
      nativeIsland.Arrange(constraints,{0,0});clientWidth=width;clientHeight=height;clientScale=scale;arranging=false;
    }catch(...){arranging=false;throw;}
  }
  void ensureIslandCapacity(int width,int height){
    if(width<=islandWidth&&height<=islandHeight)return;
    // Keep the bridge's HWND allocation stable while the parent clips it to
    // the exact client. Repeated automatic child-HWND resizes can expose an
    // older redirection image independently of the prepared Composition front.
    // Capacity follows the attached monitor and grows only when required;
    // Skia textures and logical metrics still use each exact requested extent.
    MONITORINFO monitor{sizeof(monitor)};
    if(GetMonitorInfoW(MonitorFromWindow(startupWindow,MONITOR_DEFAULTTONEAREST),&monitor)){
      width=std::max(width,int(monitor.rcWork.right-monitor.rcWork.left));height=std::max(height,int(monitor.rcWork.bottom-monitor.rcWork.top));
    }
    islandWidth=std::max(islandWidth,width);islandHeight=std::max(islandHeight,height);
    nativeBridge.MoveAndResize({0,0,islandWidth,islandHeight});
  }
  static WindowsResizeCoordinator::Deadline resizeDeadline(){return WindowsResizeCoordinator::Clock::now()+std::chrono::milliseconds(100);}
  bool resizeReady()const{return session->resize->ready()&&(!session->windowVisible()||!session->hasWindowViewportObservers()||session->resize->hasRequests());}
  void prepareSizing(const RECT& proposed){
    RECT window{},client{};
    if(!GetWindowRect(startupWindow,&window)||!GetClientRect(startupWindow,&client))throw std::runtime_error("Proposed resize bounds unavailable");
    const int width=proposed.right-proposed.left-(window.right-window.left-client.right),height=proposed.bottom-proposed.top-(window.bottom-window.top-client.bottom);
    const auto scale=float(GetDpiForWindow(startupWindow))/96.f;
    if(width<=0||height<=0||scale<=0)return;
    if(width==clientWidth&&height==clientHeight&&scale==clientScale)return;
    session->resize->resolve(false);resizeTransaction.reset();
    // WinUI's HWND clip and its Composition tree commit independently. Reserve
    // the candidate for every edge; publishing a fixed-origin layout early
    // would move right-aligned content ahead of the still-old client edge.
    const auto id=session->resize->begin(true);resizeTransaction=ResizeTransaction{id,width,height};
    const auto deadline=resizeDeadline();arrangeExtent(width,height,scale);
    const bool ready=session->resize->waitUntil([this]{return resizeReady();},deadline);
    if(ready){
      session->frameTrace.add({},0,id,8,width,height);
      // Copy retirement precedes this clock boundary. Keep the following
      // USER32 geometry and native root commit in the same compositor cycle.
      using WaitClock=DWORD(WINAPI*)(UINT,const HANDLE*,DWORD);
      static const auto wait=reinterpret_cast<WaitClock>(GetProcAddress(GetModuleHandleW(L"dcomp.dll"),"DCompositionWaitForCompositorClock"));
      const auto started=WindowsResizeCoordinator::Clock::now();const auto result=wait?wait(0,nullptr,32):0xc0000002u;
      const auto micros=std::chrono::duration_cast<std::chrono::microseconds>(WindowsResizeCoordinator::Clock::now()-started).count();
      session->frameTrace.add({},0,id,13,result,static_cast<uint32_t>(micros));
    }else resizeTimeout("proposed-frame");
  }
  bool commitResize(){
    // Explicitly submit the UI-owned batch. WinUI's asynchronous completion
    // notifications themselves require its dispatcher; waiting for one here
    // would throttle every proposal until timeout. GPU copy retirement is
    // already confirmed separately, before this geometry/publication boundary.
    commitController.Commit();device->commitWindowComposition();winrt::check_hresult(DwmFlush());return true;
  }
  void finishActualResize(){
    if(!resizeTransaction||finishingResize)return;
    finishingResize=true;
    try{
      RECT client{};if(!GetClientRect(startupWindow,&client))throw std::runtime_error("Committed resize bounds unavailable");
      const auto transaction=*resizeTransaction;
      const bool matches=client.right==transaction.width&&client.bottom==transaction.height;
      session->frameTrace.add({},0,transaction.id,9,client.right,client.bottom);
      bool ready=matches&&resizeReady();
      session->resize->resolve(matches);
      // The GPU copy was reserved off-tree. It becomes
      // visible only after USER32 has committed the new origin and client clip.
      if(matches)ready=commitResize()&&ready;
      if(ready)session->frameTrace.add({},0,transaction.id,10,client.right,client.bottom);
      else if(matches)resizeTimeout("actual-commit");
      resizeTransaction.reset();finishingResize=false;
    }catch(...){finishingResize=false;throw;}
  }
  void resizeTimeout(const char* phase){
    if(resizeTransaction){const auto& value=*resizeTransaction;session->frameTrace.add({},0,value.id,11,value.width,value.height);write(std::string("resize-timeout phase=")+phase+" width="+std::to_string(value.width)+" height="+std::to_string(value.height));}
  }
  void resizeFailure(const std::string& reason){session->resize->resolve(false);resizeTransaction.reset();session->fail(reason);write("resize-failed "+reason);PostMessageW(startupWindow,WM_CLOSE,0,0);}
  explicit WindowsAppHost(Log log):log(std::move(log)){}
  void updateVisibility(){if(closed||!observedWindow)return;const auto hwnd=winrt::Microsoft::UI::GetWindowFromWindowId(windowId);session->setWindowVisible(IsWindowVisible(hwnd)&&!IsIconic(hwnd));}
  void write(const std::string& message)const{if(log)log("NELYX_WINDOWS_HOST "+message);}
  [[noreturn]] void failedClose(const std::string& failure){
    // This top-level process cannot recover an unconfirmed native owner. An
    // explicit close must still work: let the OS retire the process resources
    // without running off-owner JSI/GPU destructors or claiming a successful drain.
    write("close-failed "+failure);
    write("terminating exitCode=2 gpuDrained="+std::to_string(session->status().drained)+" ownersRetainedUntilProcessExit=1");
    TerminateProcess(GetCurrentProcess(),2);std::terminate();
  }
  void finishClose(){
    try{auto status=session->status();
      if(status.phase!="closed"||!status.drained||status.consumers||status.views)throw std::runtime_error("Native close acknowledgement incomplete");
      if(!session->windowVisibilityRetired())throw std::runtime_error("Native visibility observers did not retire");
      if(visibilityChanged){observedWindow.Changed(*visibilityChanged);visibilityChanged.reset();}observedWindow=nullptr;
      if(islandVisibilityChanged){observedIsland.StateChanged(*islandVisibilityChanged);islandVisibilityChanged.reset();}observedIsland=nullptr;
      if(session->windowPointer){session->windowPointer->close();session->windowPointer.reset();}
      if(input){input->close();input.reset();}if(device){device->close();device.reset();}
      if(auto window=winrt::Microsoft::UI::Windowing::AppWindow::GetFromWindowId(windowId))window.Destroy();
      closed=true;closePending=false;closing=false;write("closed views=0 consumers=0 gpuDrained=1 inputRetired=1");
    }catch(std::exception const& error){failedClose(error.what());}
    catch(...){failedClose("nativeHRESULT");}
  }
  void requestClose(){
    if(!dispatcher.HasThreadAccess()){write("close-failed owning UI dispatcher required");return;}
    if(closed||closing)return;const bool first=!closePending;closePending=true;
    if(!loadComplete){write("startup-cancelled nativeOwnersRetainedUntilProcessExit=1");TerminateProcess(GetCurrentProcess(),0);return;}
    if(loadFailed)failedClose("JavaScript bundle failed to load");
    if(session->status().phase=="failed")failedClose("Native Composition session failed: "+session->status().failure);
    closing=true;session->resize->resolve(false);resizeTransaction.reset();auto self=shared_from_this();
    // JS may have closed the GPU before this explicit window close. Finish
    // the remaining native input/device owners without requesting JS again.
    if(session->status().phase=="closed"){finishClose();return;}
    try{session->requestCloseUi([self](std::string failure){
      self->dispatcher.Post([self,failure=std::move(failure)]{
        if(!failure.empty())self->failedClose(failure);
        self->finishClose();
      });});write("close-requested");
    }catch(std::exception const& error){failedClose(error.what());}
    catch(...){failedClose("nativeHRESULT");}
  }
  Log log;std::shared_ptr<WindowsCompositionDevice> device;std::shared_ptr<WindowsCompositionSession> session;
  std::shared_ptr<Nelyx::WindowsInput::TextInputRoot> input;
  winrt::Microsoft::ReactNative::IReactDispatcher dispatcher{nullptr};winrt::Microsoft::UI::WindowId windowId{};
  bool loadComplete=false,loadFailed=false,closePending=false,closing=false,closed=false;
  HWND startupWindow=nullptr;bool firstContent=false;int showCommand=SW_SHOWNORMAL;
  winrt::Microsoft::ReactNative::ReactNativeIsland nativeIsland{nullptr};bool arranging=false;int clientWidth=0,clientHeight=0;float clientScale=0;
  winrt::Microsoft::UI::Content::DesktopChildSiteBridge nativeBridge{nullptr};int islandWidth=0,islandHeight=0;
  winrt::Microsoft::UI::Composition::Core::CompositorController commitController{nullptr};
  struct ResizeTransaction{uint64_t id;int width,height;};
  std::optional<ResizeTransaction> resizeTransaction;bool finishingResize=false;
  winrt::Microsoft::UI::Windowing::AppWindow observedWindow{nullptr};std::optional<winrt::event_token> visibilityChanged;
  winrt::Microsoft::UI::Content::ContentIsland observedIsland{nullptr};std::optional<winrt::event_token> islandVisibilityChanged;
};
}
