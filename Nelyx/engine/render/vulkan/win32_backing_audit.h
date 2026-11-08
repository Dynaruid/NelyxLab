// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <array>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <map>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

namespace nelyx::vulkan {
// Device-local, explicitly enabled experiment. The producer thread records
// real imports/reuses; the creator reports only after checked device drain.
class Win32BackingAudit {
  std::atomic<bool> active{false};
  std::mutex mutex;
  using Counts=std::array<uint64_t,3>;
  Counts counts{};
  std::map<uint64_t,Counts> bins;
  double owner=0,began=0;
  uint64_t initialObjects=0,initialBytes=0,peakObjects=0,peakBytes=0;
  bool reuse=false;
  std::atomic<bool> overflow{false};
  static double now(){LARGE_INTEGER q,f;QueryPerformanceCounter(&q);QueryPerformanceFrequency(&f);return double(q.QuadPart)*1000./double(f.QuadPart);}
  static void write(const std::string& value){const auto line=value+"\n";DWORD written=0;WriteFile(GetStdHandle(STD_ERROR_HANDLE),line.data(),DWORD(line.size()),&written,nullptr);}
public:
  bool enabled()const{return active.load(std::memory_order_relaxed);}
  void begin(double generation,bool selected,uint64_t objects,uint64_t bytes){
    std::lock_guard lock(mutex);
    if(active||!std::isfinite(generation)||generation<1||generation!=std::floor(generation))throw std::runtime_error("Invalid backing audit owner");
    owner=generation;reuse=selected;initialObjects=peakObjects=objects;initialBytes=peakBytes=bytes;began=now();active=true;
  }
  void record(unsigned operation,uint64_t objects,uint64_t bytes)noexcept{
    if(!enabled())return;try{std::lock_guard lock(mutex);if(!active)return;
    if(operation<1||operation>3)throw std::runtime_error("Invalid backing audit operation");
    const auto second=uint64_t(now()/1000.);
    auto found=bins.find(second);
    if(found==bins.end()){
      if(bins.size()>=1200){overflow=true;return;}
      found=bins.emplace(second,Counts{}).first;
    }
    ++counts[operation-1];++found->second[operation-1];peakObjects=std::max(peakObjects,objects);peakBytes=std::max(peakBytes,bytes);
    }catch(...){overflow=true;}
  }
  void end(uint64_t objects,uint64_t bytes){
    if(!enabled())return;std::lock_guard lock(mutex);
    std::ostringstream out;out.precision(17);
    out<<"NELYX_WIN32_BACKING_USAGE {\"schema\":1,\"mode\":\""<<(reuse?"backing":"ts")<<"\",\"ownerGeneration\":"<<owner
      <<",\"beganQpcMs\":"<<began<<",\"endedQpcMs\":"<<now()<<",\"created\":"<<counts[0]<<",\"reused\":"<<counts[1]
      <<",\"destroyed\":"<<counts[2]<<",\"initialObjects\":"<<initialObjects<<",\"initialBytes\":"<<initialBytes
      <<",\"liveObjects\":"<<objects<<",\"liveBytes\":"<<bytes<<",\"peakObjects\":"<<peakObjects<<",\"peakBytes\":"<<peakBytes
      <<",\"overflow\":"<<(overflow?"true":"false")<<",\"closed\":true,\"binCount\":"<<bins.size()<<"}";
    write(out.str());unsigned index=0,count=0;std::ostringstream chunk;
    const auto start=[&]{chunk.str("");chunk.clear();chunk<<"NELYX_WIN32_BACKING_BINS {\"schema\":1,\"index\":"<<index++<<",\"rows\":[";count=0;};
    start();for(const auto& [second,row]:bins){if(count)chunk<<',';chunk<<'['<<second<<','<<row[0]<<','<<row[1]<<','<<row[2]<<']';if(++count==16){chunk<<"]}";write(chunk.str());start();}}
    if(count){chunk<<"]}";write(chunk.str());}active=false;
  }
};
}
