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
public:
  explicit CompositorFrameClock(std::function<void(std::string)> ready):ready(std::move(ready)) {
    stopEvent=CreateEventW(nullptr,TRUE,FALSE,nullptr);if(!stopEvent)throw std::runtime_error("Windows frame clock cancellation event unavailable");
    timer=CreateWaitableTimerExW(nullptr,nullptr,CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,TIMER_ALL_ACCESS);
    if(!timer&&GetLastError()==ERROR_INVALID_PARAMETER)timer=CreateWaitableTimerW(nullptr,FALSE,nullptr);
    if(!timer){CloseHandle(stopEvent);throw std::runtime_error("Windows refresh timer unavailable");}
    try{worker=std::thread([this]{run();});}catch(...){CloseHandle(timer);CloseHandle(stopEvent);throw;}
  }
  ~CompositorFrameClock(){stop();CloseHandle(timer);CloseHandle(stopEvent);}
  const char* source()const noexcept{return "dwm-timing";}
  void request(){std::lock_guard lock(mutex);if(stopped)throw std::runtime_error("Windows frame clock is closed");pending=true;changed.notify_one();}
  void stop()noexcept{std::lock_guard closing(stopMutex);{std::lock_guard lock(mutex);stopped=true;SetEvent(stopEvent);changed.notify_one();}if(worker.joinable())worker.join();}
private:
  // Flutter's Windows embedder derives frame intervals from DWM timing and
  // snaps requests to the next period. A compositor activity notification can
  // arrive much later while idle, delaying the very input that would redraw.
  // These deadlines pace work; they do not acknowledge displayed pixels.
  DWORD waitDwmTiming(){
    DWM_TIMING_INFO timing{};timing.cbSize=sizeof(timing);LARGE_INTEGER now{},frequency{};
    if(!QueryPerformanceCounter(&now)||!QueryPerformanceFrequency(&frequency))return WAIT_FAILED;
    const bool observed=SUCCEEDED(DwmGetCompositionTimingInfo(nullptr,&timing))&&timing.qpcRefreshPeriod>0;
    const auto period=observed?static_cast<long long>(timing.qpcRefreshPeriod):frequency.QuadPart/60;
    const auto last=observed?static_cast<long long>(timing.qpcVBlank):0;
    const auto periods=now.QuadPart>=last?(now.QuadPart-last)/period+1:0;
    const auto next=last+periods*period,remaining=next-now.QuadPart;
    LARGE_INTEGER due{};due.QuadPart=-std::max<long long>(1,(remaining*10000000+frequency.QuadPart-1)/frequency.QuadPart);
    if(!SetWaitableTimer(timer,&due,0,nullptr,nullptr,FALSE))return WAIT_FAILED;
    const HANDLE handles[]{stopEvent,timer};const auto status=WaitForMultipleObjects(2,handles,FALSE,INFINITE);
    return status==WAIT_OBJECT_0+1?0:status==WAIT_OBJECT_0?1:WAIT_FAILED;
  }
  void run()noexcept{
    for(;;){
      {std::unique_lock lock(mutex);changed.wait(lock,[this]{return stopped||pending;});if(stopped)return;pending=false;}
      const auto status=waitDwmTiming();if(stopped)return;
      try{ready(status==0?std::string{}:"Windows refresh timer wait failed: "+std::to_string(status));}catch(...){return;}
    }
  }
  std::function<void(std::string)> ready;
  HANDLE stopEvent=nullptr,timer=nullptr;
  std::thread worker;std::mutex mutex,stopMutex;std::condition_variable changed;
  std::atomic<bool> stopped{false};bool pending=false;
};
} // namespace RNSkia
