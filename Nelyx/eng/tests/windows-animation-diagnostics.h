// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <atomic>
#include <chrono>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

// Used only by the animation fixture's temporary native header overlay.
// No timer, callback or diagnostic hook is added to the supplied engine.
namespace NelyxAnimationDiagnostics {
using Clock=std::chrono::steady_clock;
inline std::atomic<bool> active=false;
inline std::mutex mutex;
inline std::map<std::string,std::vector<double>> values;
inline void begin(){std::lock_guard lock(mutex);values.clear();active=true;}
inline void record(const char* label,double elapsed){if(!active.load())return;std::lock_guard lock(mutex);if(active.load())values[label].push_back(elapsed);}
inline void step(const char* label,Clock::time_point& previous){const auto now=Clock::now();record(label,std::chrono::duration<double,std::milli>(now-previous).count());previous=now;}
struct Scope {
  const char* label;Clock::time_point start=Clock::now();
  ~Scope(){record(label,std::chrono::duration<double,std::milli>(Clock::now()-start).count());}
};
inline void end(std::string const& phase){
  std::lock_guard lock(mutex);active=false;
  if(values.empty())return;
  std::ostringstream output;
  output<<"ANIMATION_STAGES {\"phase\":\""<<phase<<"\",\"stages\":{";
  bool comma=false;
  for(auto& [label,samples]:values){
    std::sort(samples.begin(),samples.end());double sum=0;for(auto value:samples)sum+=value;
    if(comma)output<<",";comma=true;
    output<<"\""<<label<<"\":{\"n\":"<<samples.size()<<",\"sum\":"<<sum<<",\"p50\":"<<samples[samples.size()/2]<<",\"p95\":"<<samples[std::min(samples.size()-1,samples.size()*95/100)]<<",\"max\":"<<samples.back()<<"}";
  }
  output<<"}}\n";std::cout<<output.str()<<std::flush;values.clear();
}
}
