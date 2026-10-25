// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <functional>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>
namespace Nelyx::NativeHermes {
// Execution-owned diagnostic transport. Its sender owns OS target checks; this
// worker owns pacing/cancellation and never captures a VM value or GPU object.
struct NativeWheelPlan {
  int delta=0,count=0,interval=0;bool sweep=false;
  void validate()const{if(delta==0||delta< -120||delta>120||count<1||count>8192||interval<1||interval>1000||int64_t(count)*interval>180000)throw std::runtime_error("Native wheel plan exceeds its bounded input budget");}
  int step(int index)const{if(index<0||index>=count)throw std::runtime_error("Native wheel step is outside its plan");return sweep&&(index/24)%2?-delta:delta;}
};
class NativeWheelDriver final {
  struct Handle{HANDLE value=nullptr;~Handle(){if(value)CloseHandle(value);}};
public:
  struct Snapshot{bool done=false;int emitted=0;int64_t net=0,absolute=0;double p50=0,p95=0,maximum=0;std::string error;};
  explicit NativeWheelDriver(NativeWheelPlan plan,std::function<void(int)> send):plan(plan){
    plan.validate();intervals.reserve(plan.count);cancel.value=CreateEventW(nullptr,TRUE,FALSE,nullptr);if(!cancel.value)throw std::runtime_error("Native wheel cancellation event unavailable");
    timer.value=CreateWaitableTimerExW(nullptr,nullptr,CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,TIMER_ALL_ACCESS);if(!timer.value)throw std::runtime_error("High-resolution native wheel timer unavailable");
    worker=std::thread([this,send=std::move(send)]{run(send);});
  }
  NativeWheelDriver(NativeWheelDriver const&)=delete;NativeWheelDriver& operator=(NativeWheelDriver const&)=delete;
  ~NativeWheelDriver(){stop();}
  void requestStop()noexcept{if(cancel.value)SetEvent(cancel.value);}
  void stop()noexcept{requestStop();if(worker.joinable())worker.join();}
  Snapshot snapshot()const{std::lock_guard lock(mutex);return state;}
private:
  bool wait(std::chrono::steady_clock::time_point deadline){
    const auto remaining=std::chrono::duration_cast<std::chrono::nanoseconds>(deadline-std::chrono::steady_clock::now()).count();if(remaining<=0)return WaitForSingleObject(cancel.value,0)==WAIT_OBJECT_0;
    LARGE_INTEGER due{};due.QuadPart=-std::max<int64_t>(1,(remaining+99)/100);if(!SetWaitableTimerEx(timer.value,&due,0,nullptr,nullptr,nullptr,0))throw std::runtime_error("Native wheel timer rejected its deadline");HANDLE events[]{cancel.value,timer.value};const auto result=WaitForMultipleObjects(2,events,FALSE,5000);if(result!=WAIT_OBJECT_0&&result!=WAIT_OBJECT_0+1)throw std::runtime_error("Native wheel timer wait failed");return result==WAIT_OBJECT_0;
  }
  void run(std::function<void(int)> const& send)noexcept{
    try{
      using Clock=std::chrono::steady_clock;Clock::time_point previous{};
      // Preparation-generated hover has time to cross the native input queue.
      const auto prepared=WaitForSingleObject(cancel.value,150);if(prepared==WAIT_OBJECT_0){std::lock_guard lock(mutex);state.done=true;return;}if(prepared!=WAIT_TIMEOUT)throw std::runtime_error("Native wheel preparation wait failed");
      for(int i=0;i<plan.count&&WaitForSingleObject(cancel.value,0)==WAIT_TIMEOUT;++i){const int delta=plan.step(i);const auto began=Clock::now();send(delta);const auto sent=Clock::now();if(i)intervals.push_back(std::chrono::duration<double,std::milli>(sent-previous).count());previous=sent;{std::lock_guard lock(mutex);++state.emitted;state.net+=delta;state.absolute+=std::abs(delta);}if(wait(began+std::chrono::milliseconds(plan.interval)))break;}
    }catch(std::exception const& error){std::lock_guard lock(mutex);state.error=error.what();}catch(...){std::lock_guard lock(mutex);state.error="Unknown native wheel sender failure";}
    std::sort(intervals.begin(),intervals.end());std::lock_guard lock(mutex);if(!intervals.empty()){state.p50=intervals[intervals.size()/2];state.p95=intervals[intervals.size()*95/100];state.maximum=intervals.back();}state.done=true;
  }
  NativeWheelPlan plan;Handle cancel,timer;mutable std::mutex mutex;Snapshot state;std::vector<double> intervals;std::thread worker;
};
}
