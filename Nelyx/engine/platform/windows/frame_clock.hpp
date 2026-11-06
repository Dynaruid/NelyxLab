// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <dwmapi.h>
#include <algorithm>
#include <cstdint>
#include <cmath>
#include <stdexcept>

namespace nelyx::v2::windows {
inline double qpcFrequency(){
  static const double frequency=[] {LARGE_INTEGER value{};if(!QueryPerformanceFrequency(&value)||value.QuadPart<=0)throw std::runtime_error("QPC frequency unavailable");return double(value.QuadPart);}();
  return frequency;
}
inline double qpcSeconds(){LARGE_INTEGER value{};if(!QueryPerformanceCounter(&value))throw std::runtime_error("QPC clock unavailable");return double(value.QuadPart)/qpcFrequency();}
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
