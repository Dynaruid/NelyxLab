// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <winrt/Windows.Foundation.h>
#include <winrt/Microsoft.UI.Dispatching.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <winrt/Windows.Graphics.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <functional>
#include <iostream>
#include <syncstream>

namespace nelyx::v2::windows {
// Only the outermost STA loop owns this controller. Host/provider drain precedes
// shutdown, since shutting the queue down also destroys its AppWindows.
class AppSdkLoop {
  winrt::Microsoft::UI::Dispatching::DispatcherQueueController controller{
    winrt::Microsoft::UI::Dispatching::DispatcherQueueController::CreateOnCurrentThread()};
  winrt::Microsoft::UI::Windowing::AppWindow appWindow{nullptr};
  winrt::event_token changed{}, closing{};
  bool stopped=false;
public:
  void attach(HWND window,std::function<void()> metrics){
    appWindow=winrt::Microsoft::UI::Windowing::AppWindow::GetFromWindowId(winrt::Microsoft::UI::GetWindowIdFromWindow(window));
    if(!appWindow)throw std::runtime_error("AppWindow HWND interop failed");
    changed=appWindow.Changed([metrics=std::move(metrics)](auto const&,auto const& args){
      if(args.DidSizeChange()||args.DidVisibilityChange()||args.DidPositionChange())metrics();
    });
    // AppWindow intercepts WM_CLOSE before the HWND procedure. Reposting
    // WM_CLOSE here would request another canceled close forever.
    closing=appWindow.Closing([window](auto const&,auto const& args){args.Cancel(true);PostMessageW(window,WM_APP+4,0,0);});
    const auto dpi=GetDpiForWindow(window);
    appWindow.Title(L"Nelyx Engine v2 — Windows App SDK");
    appWindow.ResizeClient({MulDiv(960,int(dpi),96),MulDiv(720,int(dpi),96)});
    appWindow.Show();
    if(!controller.DispatcherQueue().TryEnqueue([]{
      std::osyncstream(std::cout)<<"V2_WINDOWS_HOST {\"host\":\"windows-app-sdk\",\"package\":\"Microsoft.WindowsAppSDK\",\"version\":\"1.8.260508005\",\"deployment\":\"unpackaged-self-contained\",\"dispatcherCallback\":true}"<<std::endl;
    }))throw std::runtime_error("App SDK dispatcher rejected startup callback");
  }
  void shutdown(){
    if(stopped)return;
    stopped=true;
    if(appWindow){appWindow.Changed(changed);appWindow.Closing(closing);appWindow=nullptr;}
    controller.ShutdownQueue();
    std::osyncstream(std::cout)<<"V2_WINDOWS_DISPATCHER_CLOSED"<<std::endl;
  }
  ~AppSdkLoop(){try{shutdown();}catch(...){std::osyncstream(std::cerr)<<"V2_HOST_ERROR App SDK dispatcher cleanup failed"<<std::endl;}}
};
}
