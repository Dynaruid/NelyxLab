// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/platform/windows/app_heap_clock.hpp"
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <stdexcept>
using nelyx::v2::windows::AppHeapClock;
static void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
int main(){try{
  check(nelyx::v2::windows::checkedInstrumentedHeapCounter(9007199254740991LL)==9007199254740991ULL,"Exact bridge counter boundary changed");
  for(const auto value:{-1LL,9007199254740992LL}){
    bool rejected=false;try{nelyx::v2::windows::checkedInstrumentedHeapCounter(value);}catch(const std::runtime_error&){rejected=true;}
    check(rejected,"Rounded/negative bridge counter was accepted");
  }
  auto clock=std::make_unique<AppHeapClock>();unsigned queries=0;
  check(!clock->isActive(),"New heap profile was active");
  const auto maximum=std::numeric_limits<uint64_t>::max();
  auto read=[&]{++queries;return AppHeapClock::Counters{maximum-10,maximum-2,20,100,5};};
  clock->sample(1,read,[]{return 1.01;});check(queries==0,"Inactive probe queried the VM");
  clock->start(100);
  check(clock->isActive(),"Started heap profile was inactive");
  clock->sample(101,read,[]{return 101.01;});
  clock->sample(102,[]()->AppHeapClock::Counters{throw std::bad_alloc();},[]{return 102.01;});
  clock->sample(std::numeric_limits<double>::quiet_NaN(),read,[]{return 102.01;});
  clock->sample(103,read,[]{return 102.;});
  clock->sample(104,[]{return AppHeapClock::Counters{1,1,1,1,1};},[]{return 104.01;});
  clock->sample(105,[&]{return AppHeapClock::Counters{maximum,maximum-1,3,10,0};},[]{return 105.02;});
  clock->sample(106,[&]{return AppHeapClock::Counters{maximum,maximum,4,10,1};},[]{return 106.01;});
  clock->stop(107);
  check(!clock->isActive(),"Stopped heap profile was active");
  const auto before=queries;clock->sample(108,read,[]{return 108.01;});
  check(queries==before,"Stopped probe queried the VM");
  std::ostringstream report;clock->write(report);
  check(report.str().size()<512*1024,"Heap diagnostic exceeded its output bound");
  std::cout<<"HEAP_CLOCK_SAMPLE "<<report.str()<<'\n';

  clock->start(200);unsigned reads=0;
  for(size_t i=0;i<AppHeapClock::capacity;++i){
    const double at=201+double(i);
    clock->sample(at,[&]{return AppHeapClock::Counters{++reads,0,0,0,0};},[at]{return at+.001;});
  }
  clock->sample(4000,[&]()->AppHeapClock::Counters{++reads;throw std::runtime_error("Full probe queried the VM");},[]{return 4000.01;});
  check(reads==AppHeapClock::capacity,"Full probe queried or allocated another sample");
  clock->stop(5000);std::ostringstream full;clock->write(full);
  check(full.str().size()<512*1024,"Full heap diagnostic exceeded its output bound");
  check(full.str().find("\"through\":2049,\"dropped\":1,\"invalid\":0,\"failed\":0")!=std::string::npos,"Full probe accounting differs");
  clock->start(6000);clock->sample(6001,[]{return AppHeapClock::Counters{10,0,0,0,0};},[]{return 6001.01;});clock->stop(6002);
  std::ostringstream reset;clock->write(reset);
  check(reset.str().find("\"through\":1,\"dropped\":0,\"invalid\":0,\"failed\":0")!=std::string::npos,"New profile retained old counters");
  clock->start(7000);unsigned failures=0;
  for(size_t i=0;i<=AppHeapClock::capacity;++i)
    clock->sample(7001,[&]()->AppHeapClock::Counters{++failures;throw std::bad_alloc();},[]{return 7001.01;});
  check(failures==AppHeapClock::capacity,"Failed probes exceeded their query budget");
  clock->stop(7002);std::ostringstream failed;clock->write(failed);
  check(failed.str().find("\"through\":2049,\"dropped\":1,\"invalid\":0,\"failed\":2048")!=std::string::npos,"Failed probe accounting differs");
  std::cout<<"Heap clock: inactive/stopped/full queries, exception isolation, monotonic counters, uint64, bounded storage/output and reset PASS.\n";
  return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}}
