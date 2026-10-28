// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/native/host/windows/CompositorFrameClock.h"
#include <chrono>
#include <iostream>
int main(){
  try{
    std::mutex mutex;std::condition_variable changed;unsigned ticks=0;std::string failure;
    RNSkia::CompositorFrameClock clock([&](std::string error){std::lock_guard lock(mutex);++ticks;failure=std::move(error);changed.notify_one();});
    std::this_thread::sleep_for(std::chrono::milliseconds(80));{std::lock_guard lock(mutex);if(ticks)throw std::runtime_error("An idle refresh clock manufactured work");}
    double maximum=0;
    for(unsigned request=1;request<=8;++request){
      const auto start=std::chrono::steady_clock::now();clock.request();
      {std::unique_lock lock(mutex);if(!changed.wait_for(lock,std::chrono::seconds(3),[&]{return ticks>=request;}))throw std::runtime_error("DWM refresh deadline did not wake");if(!failure.empty())throw std::runtime_error(failure);}
      const auto elapsed=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();maximum=std::max(maximum,elapsed);
      if(elapsed>150)throw std::runtime_error("A refresh request waited for compositor activity instead of its next deadline");
    }
    clock.request();clock.stop();clock.stop();unsigned stopped;{std::lock_guard lock(mutex);stopped=ticks;}
    std::this_thread::sleep_for(std::chrono::milliseconds(30));{std::lock_guard lock(mutex);if(ticks!=stopped)throw std::runtime_error("A stopped frame clock delivered work");}
    bool rejected=false;try{clock.request();}catch(std::exception const&){rejected=true;}if(!rejected)throw std::runtime_error("A closed frame clock accepted work");
    std::cout<<"PASS clock="<<clock.source()<<" ticks="<<stopped<<" idle=1 maximumRequestMs="<<maximum<<" stopped=1"<<std::endl;return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<std::endl;return 1;}
}
