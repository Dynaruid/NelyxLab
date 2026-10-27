// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <ReactPropertyBag.h>
#include <winrt/Microsoft.ReactNative.h>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <winrt/Microsoft.UI.Composition.Core.h>
#include <winrt/Microsoft.UI.Dispatching.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <stdexcept>

namespace RNSkia {
inline auto WindowsCompositorControllerProperty(){
  return winrt::Microsoft::ReactNative::ReactPropertyId<winrt::Microsoft::UI::Composition::Core::CompositorController>{L"Nelyx.Windows",L"CompositorController.v1"};
}
// RNW's standard Win32 bootstrap uses implicit dispatcher commits. A resize
// rendezvous needs an explicitly committable compositor. Keep RNW's public
// host, island, window, unload and DispatcherQueue lifecycle with that owner.
class WindowsReactApp final {
public:
  WindowsReactApp(){
    queue=winrt::Microsoft::UI::Dispatching::DispatcherQueueController::CreateOnCurrentThread();
    controller=winrt::Microsoft::UI::Composition::Core::CompositorController();
    commitNeeded=controller.CommitNeeded([value=controller](auto const&,auto const&){value.Commit();});
    host=winrt::Microsoft::ReactNative::ReactNativeHost();options=winrt::Microsoft::ReactNative::ReactViewOptions();
    auto settings=host.InstanceSettings();auto dispatcher=winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIThreadDispatcher();
    settings.Properties().Set(winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIDispatcherProperty(),dispatcher);
    winrt::Microsoft::ReactNative::ReactPropertyBag(settings.Properties()).Set(WindowsCompositorControllerProperty(),controller);
    winrt::Microsoft::ReactNative::Composition::CompositionUIService::SetCompositor(settings,controller.Compositor());
    window=winrt::Microsoft::ReactNative::ReactNativeWindow::CreateFromWindow(createAppWindow(),controller.Compositor());
  }
  ~WindowsReactApp(){if(controller){controller.CommitNeeded(commitNeeded);controller.Close();}}
  WindowsReactApp(const WindowsReactApp&)=delete;WindowsReactApp& operator=(const WindowsReactApp&)=delete;
  winrt::Microsoft::UI::Windowing::AppWindow AppWindow()const{return window.AppWindow();}
  winrt::Microsoft::ReactNative::ReactNativeWindow ReactNativeWindow()const{return window;}
  winrt::Microsoft::ReactNative::ReactNativeHost ReactNativeHost()const{return host;}
  winrt::Microsoft::ReactNative::ReactViewOptions ReactViewOptions()const{return options;}
  void Start(){
    auto appWindow=AppWindow();appWindow.Show();
    winrt::Microsoft::ReactNative::ReactCoreInjection::SetTopLevelWindowId(host.InstanceSettings().Properties(),reinterpret_cast<uint64_t>(winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id())));
    host.ReloadInstance();
    window.ReactNativeIsland().ReactViewHost(winrt::Microsoft::ReactNative::ReactCoreInjection::MakeViewHost(host,options));
    appWindow.Destroying([this](auto const&,auto const&){
      auto unload=host.UnloadInstance();
      unload.Completed([settings=host.InstanceSettings()](auto const&,auto status){
        settings.UIDispatcher().Post([status]{PostQuitMessage(status==winrt::Windows::Foundation::AsyncStatus::Completed?0:2);});
      });
    });
    queue.DispatcherQueue().RunEventLoop();appWindow.Destroy();queue.ShutdownQueue();
  }
private:
  static winrt::Microsoft::UI::Windowing::AppWindow createAppWindow(){
    // Choose redirection ownership at HWND creation, before AppWindow or the
    // ContentIsland bridge attaches its own style and geometry observers.
    static const auto name=[](){
      constexpr auto value=L"Nelyx.Windows.CompositionRoot.v1";
      WNDCLASSEXW type{sizeof(type)};type.style=CS_HREDRAW|CS_VREDRAW|CS_DBLCLKS;type.lpfnWndProc=DefWindowProcW;type.hInstance=GetModuleHandleW(nullptr);
      type.hCursor=LoadCursorW(nullptr,IDC_ARROW);type.lpszClassName=value;
      if(!RegisterClassExW(&type)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)winrt::throw_last_error();return value;
    }();
    const auto handle=CreateWindowExW(WS_EX_NOREDIRECTIONBITMAP,name,L"Nelyx",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,1000,1000,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    if(!handle)winrt::throw_last_error();
    try{
      auto result=winrt::Microsoft::UI::Windowing::AppWindow::GetFromWindowId(winrt::Microsoft::UI::GetWindowIdFromWindow(handle));
      if(!result)throw std::runtime_error("Composition root AppWindow unavailable");return result;
    }catch(...){DestroyWindow(handle);throw;}
  }
  winrt::Microsoft::UI::Dispatching::DispatcherQueueController queue{nullptr};
  winrt::Microsoft::UI::Composition::Core::CompositorController controller{nullptr};winrt::event_token commitNeeded{};
  winrt::Microsoft::ReactNative::ReactNativeHost host{nullptr};winrt::Microsoft::ReactNative::ReactViewOptions options{nullptr};
  winrt::Microsoft::ReactNative::ReactNativeWindow window{nullptr};
};
}
