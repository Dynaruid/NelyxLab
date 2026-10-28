// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <mmsystem.h>
#include <chrono>
#include <algorithm>
#include <atomic>
#include <thread>
#include <vector>
#include <cmath>
#include <stdexcept>
#include <string_view>
#pragma comment(lib,"winmm.lib")

namespace Nelyx::Fixture {
// Numeric fixture observations only. All timestamps use the native QPC domain.
struct ResizeObservation {double time;RECT rect;uint64_t input=0;};
struct ResizeEdge {int horizontal=0,vertical=0,hit=0;};
inline ResizeEdge resizeEdge(std::string_view name){
  if(name=="left")return {-1,0,HTLEFT};if(name=="right")return {1,0,HTRIGHT};
  if(name=="top")return {0,-1,HTTOP};if(name=="bottom")return {0,1,HTBOTTOM};
  if(name=="top-left")return {-1,-1,HTTOPLEFT};if(name=="top-right")return {1,-1,HTTOPRIGHT};
  if(name=="bottom-left")return {-1,1,HTBOTTOMLEFT};if(name=="bottom-right")return {1,1,HTBOTTOMRIGHT};return {};
}
inline bool sameRect(const RECT& a,const RECT& b){return a.left==b.left&&a.top==b.top&&a.right==b.right&&a.bottom==b.bottom;}
inline bool appendChanged(std::vector<ResizeObservation>& rows,double time,const RECT& rect,uint64_t input=0){
  if(rows.empty()||!sameRect(rows.back().rect,rect)){
    if(rows.size()>=4096)throw std::runtime_error("Resize fixture observation capacity exceeded");
    rows.push_back({time,rect,input});
    return true;
  }
  return false;
}
// Elapsed-time trajectory, independent of scheduling/capture delays. Missed
// deadlines are skipped, never replayed in an input burst after a late wake.
struct ResizeTrajectory {
  double duration,period,amplitude;
  double displacement(double elapsed)const{const auto p=std::clamp(elapsed/duration,0.,1.);return amplitude*(p<=.5?p*2:(1-p)*2);}
  uint64_t next(double elapsed)const{return static_cast<uint64_t>(std::floor(elapsed/period))+1;}
};
class ResizeTimerPeriod final {
  bool active=timeBeginPeriod(1)==TIMERR_NOERROR;
public:~ResizeTimerPeriod(){if(active)timeEndPeriod(1);}
};
template<class Move,class Sample> void runResizeTrajectory(double hz,double duration,double amplitude,Move move,Sample sample){
  if(!std::isfinite(hz)||hz<8||hz>240||!std::isfinite(duration)||duration<800||duration>10000)throw std::runtime_error("Resize input requires 8..240Hz and 800..10000ms");
  ResizeTimerPeriod timer;std::atomic<bool> done=false;std::exception_ptr failure;
  std::jthread injector([&](std::stop_token stop){try{
    using Clock=std::chrono::steady_clock;const auto began=Clock::now();const ResizeTrajectory path{duration,1000./hz,amplitude};
    while(!stop.stop_requested()){
      const auto elapsed=std::chrono::duration<double,std::milli>(Clock::now()-began).count();if(elapsed>=duration)break;
      move(path.displacement(elapsed));
      const auto next=std::chrono::duration<double,std::milli>(path.next(elapsed)*path.period);
      std::this_thread::sleep_until(began+std::chrono::duration_cast<Clock::duration>(next));
    }
    if(!stop.stop_requested())move(0.);
  }catch(...){failure=std::current_exception();}done=true;});
  while(!done.load()){sample();std::this_thread::sleep_for(std::chrono::milliseconds(1));}
  injector.join();if(failure)std::rethrow_exception(failure);
}
}
