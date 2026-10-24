// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <dwmapi.h>
#pragma comment(lib,"dwmapi.lib")
#include <atomic>
#include <algorithm>
#include <condition_variable>
#include <functional>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>

namespace RNSkia {
/** One interruptible wait per requested batch. The worker never owns a JSI/GPU object. */
class CompositorFrameClock final {
  using WaitForClock=DWORD(WINAPI*)(UINT,const HANDLE*,DWORD);
public:
  explicit CompositorFrameClock(std::function<void(std::string)> ready):ready(std::move(ready)) {
    stopEvent=CreateEventW(nullptr,TRUE,FALSE,nullptr);if(!stopEvent)throw std::runtime_error("Windows frame clock cancellation event unavailable");
    module=LoadLibraryExW(L"dcomp.dll",nullptr,LOAD_LIBRARY_SEARCH_SYSTEM32);
    if(module)waitForClock=reinterpret_cast<WaitForClock>(GetProcAddress(module,"DCompositionWaitForCompositorClock"));
    try{worker=std::thread([this]{run();});}catch(...){if(module)FreeLibrary(module);CloseHandle(stopEvent);throw;}
  }
  ~CompositorFrameClock(){stop();if(module)FreeLibrary(module);CloseHandle(stopEvent);}
  const char* source()const noexcept{return waitForClock?"compositor":"dwm-timing";}
  void request(){std::lock_guard lock(mutex);if(stopped)throw std::runtime_error("Windows frame clock is closed");pending=true;changed.notify_one();}
  void stop()noexcept{std::lock_guard closing(stopMutex);{std::lock_guard lock(mutex);stopped=true;SetEvent(stopEvent);changed.notify_one();}if(worker.joinable())worker.join();}
private:
  // Windows 10 lacks the compositor wait API. Pace to its observed DWM refresh
  // deadline instead of falling back to RNW's unbounded UI-post animation loop.
  DWORD waitDwmTiming(){
    DWM_TIMING_INFO timing{};timing.cbSize=sizeof(timing);LARGE_INTEGER now{},frequency{};
    if(FAILED(DwmGetCompositionTimingInfo(nullptr,&timing))||!timing.qpcRefreshPeriod||!QueryPerformanceCounter(&now)||!QueryPerformanceFrequency(&frequency))return 0xffffffff;
    const auto period=static_cast<long long>(timing.qpcRefreshPeriod),last=static_cast<long long>(timing.qpcVBlank);
    const auto periods=now.QuadPart>=last?(now.QuadPart-last)/period+1:0;
    const auto next=last+periods*period,remaining=next-now.QuadPart;
    const auto milliseconds=static_cast<DWORD>(std::max<long long>(1,(remaining*1000+frequency.QuadPart-1)/frequency.QuadPart));
    return WaitForSingleObject(stopEvent,milliseconds)==WAIT_TIMEOUT?0:1;
  }
  void run()noexcept{
    for(;;){
      {std::unique_lock lock(mutex);changed.wait(lock,[this]{return stopped||pending;});if(stopped)return;pending=false;}
      for(;;){
        const auto status=waitForClock?waitForClock(1,&stopEvent,1000):waitDwmTiming();if(stopped)return;
        // A sleeping/occluded display has no next frame. Keep one request and
        // remain cancellable; never spin or manufacture animation timestamps.
        if(status==0xc01e0006||status==0x102){if(WaitForSingleObject(stopEvent,100)==WAIT_OBJECT_0)return;continue;}
        // With one cancellation handle the clock is WAIT_OBJECT_0 + count.
        // https://learn.microsoft.com/windows/win32/directcomp/compositor-clock/compositor-clock
        const auto tick=waitForClock?WAIT_OBJECT_0+1:0;
        try{ready(status==tick?std::string{}:"Windows compositor clock wait failed: "+std::to_string(status));}catch(...){return;}
        break;
      }
    }
  }
  std::function<void(std::string)> ready;
  HMODULE module=nullptr;HANDLE stopEvent=nullptr;WaitForClock waitForClock=nullptr;
  std::thread worker;std::mutex mutex,stopMutex;std::condition_variable changed;
  std::atomic<bool> stopped{false};bool pending=false;
};
} // namespace RNSkia
