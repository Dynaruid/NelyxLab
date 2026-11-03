// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdint>
#include <initializer_list>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#if defined(_WIN32)
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <Windows.h>
#endif

namespace RNSkia {
// Explicit experiment only. No counters, clock reads, or buffers in normal use.
// One fresh runtime/owner is required by the consumer. Bins use the OS QPC
// domain so startup work cannot impersonate work during timed wheel input.
class NativeServiceAudit {
public:
  // snapshot calls/editors, compose prepares/commits/ranges, semantics calls/
  // queries, successful numeric replays/unique paths/unique paints/clip ops.
  using Counts = std::array<std::uint64_t, 11>;
  // Flex plans/children/placements, text transactions/operations/UTF8 bytes,
  // frame seals/admissions/retirements/encoded bytes. Separate legacy metrics.
  using EngineCounts = std::array<std::uint64_t,10>;
private:
  struct State {
    std::string mode;
    double owner, began;
    std::uint64_t epoch;
    Counts total{};
    std::array<std::array<std::uint64_t,4>,3> sessions{};
    std::map<std::uint64_t,Counts> bins;
    EngineCounts engineTotal{};
    std::map<std::uint64_t,EngineCounts> engineBins;
    std::array<uint64_t,4> engineMemory{};
    bool overflow=false, timed=true;
  };
  inline static thread_local std::unique_ptr<State> state_;
  inline static thread_local std::uint64_t epoch_=0;
  static double now() {
#if defined(_WIN32)
    LARGE_INTEGER value, frequency;
    QueryPerformanceCounter(&value); QueryPerformanceFrequency(&frequency);
    return double(value.QuadPart)*1000.0/double(frequency.QuadPart);
#else
    return std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now().time_since_epoch()).count();
#endif
  }
  static void log(const std::string& value) {
    const auto line=value+"\n";
#if defined(_WIN32)
    DWORD written=0;
    WriteFile(GetStdHandle(STD_ERROR_HANDLE),line.data(),static_cast<DWORD>(line.size()),&written,nullptr);
#else
    std::fputs(line.c_str(),stderr);
#endif
  }
  template<class T> static void array(std::ostringstream& out,const T& values) {
    out<<'['; bool first=true;
    for(const auto& value:values){if(!first)out<<',';first=false;out<<value;}
    out<<']';
  }
public:
  static std::string begin(double owner) {
    if(state_ || !std::isfinite(owner) || owner<1 || owner!=std::floor(owner))
      throw std::runtime_error("Invalid/reentrant native service audit owner");
    const char* configured=std::getenv("NELYX_NATIVE_SERVICE_EXPERIMENT");
    const std::string mode=configured?configured:"";
    const char* manual=std::getenv("NELYX_NATIVE_SERVICE_MANUAL");
    const bool interactive=manual&&std::strcmp(manual,"1")==0;
    if(mode!="ts"&&mode!="snapshot"&&mode!="path"&&mode!="paint"&&mode!="composition"&&mode!="semantics"&&mode!="all"&&mode!="retained"&&mode!="backing"&&mode!="text"&&mode!="layout"&&mode!="frame"&&mode!="physics")
      throw std::runtime_error("Choose an explicit NELYX_NATIVE_SERVICE_EXPERIMENT");
    if((mode=="all"||mode=="retained")&&!interactive)
      throw std::runtime_error("Combined/retained service audit requires manual mode");
    state_=std::make_unique<State>(); state_->mode=mode;state_->owner=owner;
    state_->timed=!interactive;
    state_->began=now();state_->epoch=++epoch_;
    return mode;
  }
  static void record(std::initializer_list<std::pair<std::size_t,std::uint64_t>> values) {
    if(!state_)return;
    if(!state_->timed){for(const auto& [index,count]:values)state_->total.at(index)+=count;return;}
    const auto second=static_cast<std::uint64_t>(now()/1000.0);
    auto found=state_->bins.find(second);
    if(found==state_->bins.end()){
      if(state_->bins.size()>=1200){state_->overflow=true;return;}
      found=state_->bins.emplace(second,Counts{}).first;
    }
    for(const auto& [index,count]:values){state_->total.at(index)+=count;found->second.at(index)+=count;}
  }
  static void recordEngine(std::initializer_list<std::pair<std::size_t,std::uint64_t>> values){
    if(!state_)return;
    if(!state_->timed){for(const auto& [index,count]:values)state_->engineTotal.at(index)+=count;return;}
    const auto second=static_cast<std::uint64_t>(now()/1000.0);
    auto found=state_->engineBins.find(second);
    if(found==state_->engineBins.end()){
      if(state_->engineBins.size()>=1200){state_->overflow=true;return;}
      found=state_->engineBins.emplace(second,EngineCounts{}).first;
    }
    for(const auto& [index,count]:values){state_->engineTotal.at(index)+=count;found->second.at(index)+=count;}
  }
  static void engineMemory(uint64_t live,uint64_t bytes,uint64_t peak,uint64_t peakBytes){if(state_)state_->engineMemory={live,bytes,peak,peakBytes};}
  class Session {
    std::uint64_t epoch_=0;
    std::size_t kind_;
    bool closed_=false;
  public:
    explicit Session(std::size_t kind):kind_(kind){
      if(state_){epoch_=state_->epoch;++state_->sessions[kind][0];++state_->sessions[kind][2];}
    }
    void close(std::uint64_t bytes=0){
      if(closed_)return;closed_=true;
      if(state_&&epoch_==state_->epoch){auto& row=state_->sessions[kind_];++row[1];--row[2];row[3]+=bytes;}
    }
  };
  static void end() {
    if(!state_)throw std::runtime_error("Native service audit is not active");
    std::ostringstream out;out.precision(17);
    out<<"NELYX_NATIVE_SERVICE_USAGE {\"schema\":1,\"mode\":\""<<state_->mode
       <<"\",\"ownerGeneration\":"<<state_->owner<<",\"beganQpcMs\":"<<state_->began
       <<",\"endedQpcMs\":"<<now()<<",\"overflow\":"<<(state_->overflow?"true":"false")
       <<",\"timing\":\""<<(state_->timed?"qpc-buckets":"counters-only")<<"\""
       <<",\"binCount\":"<<state_->bins.size()<<",\"totals\":";
    array(out,state_->total);out<<",\"sessions\":[";
    for(std::size_t i=0;i<3;++i){if(i)out<<',';array(out,state_->sessions[i]);}
    out<<"]}";log(out.str());
    std::size_t index=0, count=0;std::ostringstream chunk;
    const auto start=[&]{chunk.str("");chunk.clear();chunk<<"NELYX_NATIVE_SERVICE_BINS {\"schema\":1,\"index\":"<<index++<<",\"rows\":[";count=0;};
    start();
    for(const auto& [second,counts]:state_->bins){
      if(count)chunk<<',';chunk<<'['<<second;for(auto value:counts)chunk<<','<<value;chunk<<']';
      if(++count==16){chunk<<"]}";log(chunk.str());start();}
    }
    if(count){chunk<<"]}";log(chunk.str());}
    if(state_->mode=="all"||state_->mode=="text"||state_->mode=="layout"||state_->mode=="frame"||state_->mode=="physics"){
      std::ostringstream engine;engine.precision(17);
      engine<<"NELYX_NATIVE_ENGINE_USAGE {\"schema\":1,\"mode\":\""<<state_->mode<<"\",\"ownerGeneration\":"<<state_->owner
        <<",\"beganQpcMs\":"<<state_->began<<",\"endedQpcMs\":"<<now()<<",\"closed\":true,\"overflow\":"<<(state_->overflow?"true":"false")
        <<",\"timing\":\""<<(state_->timed?"qpc-buckets":"counters-only")<<"\",\"binCount\":"<<state_->engineBins.size()<<",\"totals\":";
      array(engine,state_->engineTotal);engine<<",\"memory\":";array(engine,state_->engineMemory);engine<<'}';log(engine.str());
      index=count=0;const auto engineStart=[&]{chunk.str("");chunk.clear();chunk<<"NELYX_NATIVE_ENGINE_BINS {\"schema\":1,\"index\":"<<index++<<",\"rows\":[";count=0;};
      engineStart();for(const auto& [second,counts]:state_->engineBins){if(count)chunk<<',';chunk<<'['<<second;for(auto value:counts)chunk<<','<<value;chunk<<']';if(++count==16){chunk<<"]}";log(chunk.str());engineStart();}}
      if(count){chunk<<"]}";log(chunk.str());}
    }
    state_.reset();
  }
};
}
