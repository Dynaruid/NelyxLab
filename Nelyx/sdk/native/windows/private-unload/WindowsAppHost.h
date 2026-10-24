// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <CompositionDevice.h>
#include <CompositionSession.h>
#include <SkiaView.h>
#include "RuntimeUnloadAbi.h"
#include "UnloadAction.h"
#include <winrt/Microsoft.ReactNative.Composition.Experimental.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <winrt/Windows.System.Threading.h>
#include <ReactPropertyBag.h>

namespace RNSkia {
class WindowsAppHost final : public std::enable_shared_from_this<WindowsAppHost> {
  using Action=winrt::com_ptr<WindowsUnloadAction>;
  struct Gate :winrt::implements<Gate,INelyxRnwUnloadGate,winrt::Windows::Foundation::IStringable> {
    explicit Gate(std::weak_ptr<WindowsAppHost> owner):owner(std::move(owner)){}
    winrt::hstring ToString(){return L"Nelyx RNW Core unload protocol 1";}
    HRESULT __stdcall Begin(UINT32 reason,UINT64 generation,IUnknown **result)noexcept override {
      if(!result)return E_POINTER;*result=nullptr;
      try{if(reason>1||!generation)winrt::throw_hresult(E_INVALIDARG);auto self=owner.lock();if(!self)winrt::throw_hresult(RO_E_CLOSED);
        auto action=winrt::make_self<WindowsUnloadAction>();self->dispatcher.Post([self,reason,generation,action]{self->beginCore(reason,generation,action);});
        *result=reinterpret_cast<IUnknown*>(winrt::detach_abi(action.as<winrt::Windows::Foundation::IAsyncAction>()));return S_OK;
      }catch(...){return winrt::to_hresult();}
    }
    std::weak_ptr<WindowsAppHost> owner;
  };
public:
  using Log=std::function<void(const std::string&)>;
  static std::shared_ptr<WindowsAppHost> install(
      winrt::Microsoft::ReactNative::ReactInstanceSettings const& settings,
      winrt::Microsoft::UI::Windowing::AppWindow const& window,Log log={},uint32_t vendor=0) {
    auto self=std::shared_ptr<WindowsAppHost>(new WindowsAppHost(std::move(log)));
    self->properties=settings.Properties();self->windowId=window.Id();self->observedWindow=window;
    winrt::com_ptr<IDXGIFactory1> factory;winrt::check_hresult(CreateDXGIFactory1(__uuidof(IDXGIFactory1),factory.put_void()));
    winrt::com_ptr<IDXGIAdapter1> adapter;
    for(UINT index=0;;++index){winrt::com_ptr<IDXGIAdapter1> candidate;auto result=factory->EnumAdapters1(index,candidate.put());
      if(result==DXGI_ERROR_NOT_FOUND)break;winrt::check_hresult(result);DXGI_ADAPTER_DESC1 description{};winrt::check_hresult(candidate->GetDesc1(&description));
      if(!(description.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)&&(!vendor||description.VendorId==vendor)){adapter=std::move(candidate);break;}}
    if(!adapter)throw std::runtime_error("Requested Windows hardware adapter unavailable");
    auto compositor=winrt::Microsoft::ReactNative::Composition::CompositionUIService::GetCompositor(settings.Properties());
    self->device=std::make_shared<WindowsCompositionDevice>(compositor,adapter.get());
    winrt::Microsoft::ReactNative::ReactPropertyBag bag{settings.Properties()};bag.Set(WindowsCompositionDeviceProperty(),self->device);self->freshSession();
    self->dispatcher=settings.Properties().Get(winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIDispatcherProperty()).try_as<winrt::Microsoft::ReactNative::IReactDispatcher>();
    if(!self->dispatcher||!self->dispatcher.HasThreadAccess())throw std::runtime_error("Owning RNW UI dispatcher unavailable");
    self->visibilityChanged=window.Changed([weak=std::weak_ptr<WindowsAppHost>(self)](auto const&,auto const&){if(auto host=weak.lock())try{host->updateVisibility();}catch(...){host->failed=true;host->session->fail();host->write("visibility-failed");}});
    auto gate=winrt::make_self<Gate>(self);self->properties.Set(key(L"BeforeUnload.v1"),gate.as<winrt::Windows::Foundation::IInspectable>());
    window.Closing([self](auto const&,auto const& args){args.Cancel(true);self->closing=true;self->properties.Set(key(L"AdmissionClosed"),winrt::box_value(true));self->write("close-requested");self->beginDrain(self->coreGeneration());});
    self->write("prepared protocol=1");return self;
  }
private:
  explicit WindowsAppHost(Log log):log(std::move(log)){}
  static auto key(wchar_t const *value){using namespace winrt::Microsoft::ReactNative;return ReactPropertyBagHelper::GetName(ReactPropertyBagHelper::GetNamespace(L"Nelyx.Rnw.Runtime"),value);}
  uint64_t coreGeneration()const {auto value=properties.Get(key(L"CoreGeneration"));return value?winrt::unbox_value<uint64_t>(value):0;}
  void write(const std::string& message)const{if(log)log("NELYX_WINDOWS_HOST "+message);}
  void updateVisibility(){if(closed||!observedWindow)return;const auto hwnd=winrt::Microsoft::UI::GetWindowFromWindowId(windowId);session->setWindowVisible(IsWindowVisible(hwnd)&&!IsIconic(hwnd));}
  void freshSession(){session=std::make_shared<WindowsCompositionSession>(device->nativeOptions());updateVisibility();winrt::Microsoft::ReactNative::ReactPropertyBag{properties}.Set(WindowsCompositionSessionProperty(),session);}
  void beginCore(uint32_t reason,uint64_t generation,Action action)noexcept {
    try{if(generation!=coreGeneration())throw std::runtime_error("Stale Core shutdown generation");
      if(reason==1){closing=true;properties.Set(key(L"AdmissionClosed"),winrt::box_value(true));}
      if(failed){action->finish(E_FAIL);return;}
      if(closed){action->finish();return;}
      waiters.push_back(action);write("core-unload-begin generation="+std::to_string(generation)+" reason="+std::to_string(reason));beginDrain(generation);
    }catch(std::exception const& error){write(std::string("core-unload-rejected ")+error.what());action->finish(E_INVALIDARG);}
    catch(...){action->finish(winrt::to_hresult());}
  }
  void beginDrain(uint64_t generation)noexcept {
    if(failed){write("close-failed retained owner");return;}if(closed)return;if(draining)return;
    draining=true;const auto operation=++nextOperation;auto self=shared_from_this();
    try{
      deadline=winrt::Windows::System::Threading::ThreadPoolTimer::CreateTimer([weak=weak_from_this(),operation](auto const&){if(auto owner=weak.lock())owner->dispatcher.Post([owner,operation]{owner->finishDrain(operation,"Native shutdown deadline expired");});},std::chrono::seconds(15));
      auto status=session->status();
      if(status.phase=="cold"&&!status.consumers&&!status.views){finishDrain(operation,"");return;}
      session->requestCloseUi([self,operation](std::string failure){self->dispatcher.Post([self,operation,failure=std::move(failure)]{self->finishDrain(operation,failure);});});
    }catch(std::exception const& error){finishDrain(operation,error.what());}catch(...){finishDrain(operation,"Native shutdown HRESULT");}
  }
  void finishDrain(uint64_t operation,std::string failure)noexcept {
    if(operation!=nextOperation||!draining){write("late-unload-ack ignored");return;}
    draining=false;if(deadline)try{deadline.Cancel();}catch(...){}deadline=nullptr;
    try{
      auto status=session->status();
      if(failure.empty()&&(status.phase!="closed"||!status.drained||status.consumers||status.views)&&status.phase!="cold")failure="Incomplete native shutdown acknowledgement";
      if(failure.empty()&&!session->windowVisibilityRetired())failure="Native visibility observers did not retire";
      if(!failure.empty()){failed=true;session->fail();properties.Set(key(L"AdmissionClosed"),winrt::box_value(true));write("close-failed "+failure);auto actions=std::move(waiters);for(auto const& action:actions)action->finish(E_FAIL);return;}
      write("generation-drained core="+std::to_string(coreGeneration())+" views=0 consumers=0 gpuDrained=1");
      if(closing){if(visibilityChanged){observedWindow.Changed(*visibilityChanged);visibilityChanged.reset();}observedWindow=nullptr;if(device){device->close();device.reset();}closed=true;write("closed views=0 consumers=0 gpuDrained=1");}
      else freshSession();
      auto actions=std::move(waiters);for(auto const& action:actions)action->finish();
      if(closing)if(auto window=winrt::Microsoft::UI::Windowing::AppWindow::GetFromWindowId(windowId))window.Destroy();
    }catch(std::exception const& error){failed=true;properties.Set(key(L"AdmissionClosed"),winrt::box_value(true));write(std::string("close-failed ")+error.what());auto actions=std::move(waiters);for(auto const& action:actions)action->finish(E_FAIL);}
    catch(...){failed=true;auto actions=std::move(waiters);for(auto const& action:actions)action->finish(E_FAIL);}
  }
  Log log;std::shared_ptr<WindowsCompositionDevice> device;std::shared_ptr<WindowsCompositionSession> session;
  winrt::Microsoft::ReactNative::IReactPropertyBag properties{nullptr};winrt::Microsoft::ReactNative::IReactDispatcher dispatcher{nullptr};
  winrt::Microsoft::UI::WindowId windowId{};winrt::Windows::System::Threading::ThreadPoolTimer deadline{nullptr};
  std::vector<Action> waiters;bool draining=false,failed=false,closing=false,closed=false;uint64_t nextOperation=0;
  winrt::Microsoft::UI::Windowing::AppWindow observedWindow{nullptr};std::optional<winrt::event_token> visibilityChanged;
};
} // namespace RNSkia
