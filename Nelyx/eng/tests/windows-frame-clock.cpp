// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/packages/rn/native/windows/CompositorFrameClock.h"
#include <chrono>
#include <iostream>
int main(){
  try{
    std::mutex mutex;std::condition_variable changed;unsigned ticks=0;std::string failure;
    RNSkia::CompositorFrameClock clock([&](std::string error){std::lock_guard lock(mutex);++ticks;failure=std::move(error);changed.notify_one();});
    clock.request();{std::unique_lock lock(mutex);if(!changed.wait_for(lock,std::chrono::seconds(3),[&]{return ticks>0;}))throw std::runtime_error("Compositor clock did not wake");if(!failure.empty())throw std::runtime_error(failure);}
    clock.request();clock.stop();clock.stop();unsigned stopped;{std::lock_guard lock(mutex);stopped=ticks;}
    std::this_thread::sleep_for(std::chrono::milliseconds(30));{std::lock_guard lock(mutex);if(ticks!=stopped)throw std::runtime_error("A stopped frame clock delivered work");}
    bool rejected=false;try{clock.request();}catch(std::exception const&){rejected=true;}if(!rejected)throw std::runtime_error("A closed frame clock accepted work");
    std::cout<<"PASS clock="<<clock.source()<<" ticks="<<stopped<<" stopped=1"<<std::endl;return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<std::endl;return 1;}
}
