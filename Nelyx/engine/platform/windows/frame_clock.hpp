// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <dwmapi.h>
#include <algorithm>
#include <cstdint>
#include <cmath>
#include <stdexcept>
#include <mutex>

namespace nelyx::v2::windows {
inline double qpcFrequency(){
  static const double frequency=[] {LARGE_INTEGER value{};if(!QueryPerformanceFrequency(&value)||value.QuadPart<=0)throw std::runtime_error("QPC frequency unavailable");return double(value.QuadPart);}();
  return frequency;
}
inline double qpcSeconds(){LARGE_INTEGER value{};if(!QueryPerformanceCounter(&value))throw std::runtime_error("QPC clock unavailable");return double(value.QuadPart)/qpcFrequency();}
// condition_variable::wait_for uses the system timer quantum on Windows.
// A 6ms display deadline can therefore wake 10-16ms later. Own a high-resolution
// timer instead of changing the system-wide timer period or busy-spinning.
class RenderDeadline {
  HANDLE wake_=nullptr,timer_=nullptr;
public:
  RenderDeadline(){
    wake_=CreateEventW(nullptr,TRUE,FALSE,nullptr);
    timer_=CreateWaitableTimerExW(nullptr,nullptr,CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,TIMER_ALL_ACCESS);
    if(!wake_||!timer_){if(wake_)CloseHandle(wake_);if(timer_)CloseHandle(timer_);throw std::runtime_error("Render deadline handles unavailable");}
  }
  ~RenderDeadline(){CloseHandle(timer_);CloseHandle(wake_);}
  RenderDeadline(const RenderDeadline&)=delete;
  RenderDeadline& operator=(const RenderDeadline&)=delete;
  void notify(){SetEvent(wake_);}
  template<class Predicate> void wait(std::unique_lock<std::mutex>& lock,double target,Predicate ready){
    while(true){
      // Reset before checking the authoritative predicate: a producer after
      // that check leaves the event signaled, so no wake can be lost.
      ResetEvent(wake_);
      if(ready())return;
      const auto remaining=target-qpcSeconds();if(remaining<=0)return;
      LARGE_INTEGER due{};due.QuadPart=-std::max<LONGLONG>(1,LONGLONG(std::ceil(remaining*10000000)));
      if(!SetWaitableTimerEx(timer_,&due,0,nullptr,nullptr,nullptr,0))throw std::runtime_error("Render deadline could not be armed");
      HANDLE handles[]={wake_,timer_};lock.unlock();
      const auto result=WaitForMultipleObjects(2,handles,FALSE,INFINITE);
      lock.lock();CancelWaitableTimer(timer_);
      if(result==WAIT_OBJECT_0+1)return;
      if(result!=WAIT_OBJECT_0)throw std::runtime_error("Render deadline wait failed");
    }
  }
};
struct DisplayClockSample {
  bool observed=false;
  HRESULT status=E_PENDING;
  double sampledAt=0,period=.016,target=0;
  uintptr_t monitor=0;
};
inline DisplayClockSample displayClock(HWND window){
  DisplayClockSample sample;sample.sampledAt=qpcSeconds();sample.monitor=uintptr_t(MonitorFromWindow(window,MONITOR_DEFAULTTONEAREST));
  DWM_TIMING_INFO timing{};timing.cbSize=sizeof(timing);
  // Windows 8.1+ requires NULL. This is the composition clock, not a claim
  // of timing from this window's particular monitor or physical scanout.
  sample.status=DwmGetCompositionTimingInfo(nullptr,&timing);
  if(SUCCEEDED(sample.status)&&timing.qpcRefreshPeriod&&timing.qpcVBlank){
    const double period=double(timing.qpcRefreshPeriod)/qpcFrequency(),phase=double(timing.qpcVBlank)/qpcFrequency();
    if(std::isfinite(period)&&period>=.001&&period<=1&&std::isfinite(phase)){
      sample.observed=true;sample.period=period;
      sample.target=phase+std::max(0.0,std::floor((sample.sampledAt-phase)/period)+1)*period;
    }else sample.status=E_UNEXPECTED;
  }
  if(!sample.observed){if(SUCCEEDED(sample.status))sample.status=E_UNEXPECTED;sample.target=sample.sampledAt+sample.period;}
  return sample;
}
}
