// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <algorithm>
#include <chrono>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace Nelyx::Fixture {
// Test-only pacing. Every interval uses an owned high-resolution timer. Charge
// guard/send work to its iteration rather than adding it to the requested wait.
// Completion samples describe the actual SendInput/enqueue spacing, not Core delivery.
struct WheelPacer final {
 using Clock=std::chrono::steady_clock;
 int interval;HANDLE timer=nullptr;Clock::time_point last{};std::vector<double> samples;unsigned count=0;
 explicit WheelPacer(int ms):interval(ms){
  if(ms<1||ms>1000)throw std::runtime_error("Wheel fixture interval outside1..1000ms");
  samples.reserve(8191);timer=CreateWaitableTimerExW(nullptr,nullptr,CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,TIMER_ALL_ACCESS);
  if(!timer)throw std::runtime_error("High-resolution wheel fixture timer unavailable");
 }
 WheelPacer(WheelPacer const&)=delete;WheelPacer& operator=(WheelPacer const&)=delete;
 ~WheelPacer(){if(timer)CloseHandle(timer);}
 void sample(){if(count>=8192)throw std::runtime_error("Wheel fixture sample budget exceeded");const auto now=Clock::now();if(count++)samples.push_back(std::chrono::duration<double,std::milli>(now-last).count());last=now;}
 void wait(Clock::time_point iterationBegin){
  const auto remaining=std::chrono::duration_cast<std::chrono::nanoseconds>(iterationBegin+std::chrono::milliseconds(interval)-Clock::now()).count();
  if(remaining<=0)return;LARGE_INTEGER due{};due.QuadPart=-((remaining+99)/100);
  if(!SetWaitableTimerEx(timer,&due,0,nullptr,nullptr,nullptr,0)||WaitForSingleObject(timer,5000)!=WAIT_OBJECT_0)throw std::runtime_error("High-resolution wheel fixture wait failed");
 }
 void report(const char* mode){if(samples.empty())return;std::sort(samples.begin(),samples.end());std::cout<<"ANIMATION_WHEEL_SEND {\"mode\":\""<<mode<<"\",\"policy\":\"high-resolution-relative-start-completion-v1\",\"count\":"<<count<<",\"requestedMs\":"<<interval<<",\"p50Ms\":"<<samples[samples.size()/2]<<",\"p95Ms\":"<<samples[samples.size()*95/100]<<",\"maxMs\":"<<samples.back()<<"}"<<std::endl;}
};
}
