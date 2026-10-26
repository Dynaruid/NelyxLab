// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include <algorithm>
#include <cmath>
#include <functional>
#include <map>
#include <optional>
#include <stdexcept>
#include <thread>
#include <vector>

namespace Nelyx::NativeHermes {
/** All timer/frame/microtask handles belong to this VM thread. The embedder
 * provides time and a surface wakeup; no HWND, UIA or GPU ownership lives here.
 * A task checkpoint precedes due timers, each timer has a checkpoint, and one
 * surface tick dispatches its admitted frames before the task checkpoint. */
class VmCallbacks final {
public:
  VmCallbacks(facebook::jsi::Runtime& runtime,std::function<double()> now,std::function<void()> frame):runtime(runtime),now(std::move(now)),armFrame(std::move(frame)),owner(std::this_thread::get_id()){}
  VmCallbacks(VmCallbacks const&)=delete;VmCallbacks& operator=(VmCallbacks const&)=delete;
  void install(facebook::jsi::Object& api){
    checkOwner();
    auto method=[&](const char* name,size_t arity,facebook::jsi::HostFunctionType call){api.setProperty(runtime,name,facebook::jsi::Function::createFromHostFunction(runtime,facebook::jsi::PropNameID::forAscii(runtime,name),arity,std::move(call)));};
    method("setTimer",3,[this](auto& rt,auto const&,auto* args,size_t count){
      checkOpen();if(count!=3||timers.size()>=limit||!args[1].isNumber()||!args[2].isBool())throw facebook::jsi::JSError(rt,"Native timer admission failed");
      const double delay=args[1].getNumber();if(!std::isfinite(delay)||delay<0||delay>2147483647)throw facebook::jsi::JSError(rt,"Invalid native timer delay");
      auto callback=readCallback(rt,args[0]);const auto id=next(nextTimer);timers.emplace(id,Timer{now()+delay,args[2].getBool()?std::max(1.,delay):0,std::move(callback)});return facebook::jsi::Value(double(id));
    });
    method("clearTimer",1,[this](auto& rt,auto const&,auto* args,size_t count){checkOwner();timers.erase(readId(rt,args,count));return facebook::jsi::Value::undefined();});
    method("requestFrame",1,[this](auto& rt,auto const&,auto* args,size_t count){
      checkOpen();if(count!=1||frames.size()>=limit)throw facebook::jsi::JSError(rt,"Native frame admission failed");
      auto callback=readCallback(rt,args[0]);const auto id=next(nextFrame);frames.emplace(id,std::move(callback));
      if(!frameArmed){frameArmed=true;try{armFrame();}catch(...){frameArmed=false;frames.erase(id);throw;}}return facebook::jsi::Value(double(id));
    });
    method("cancelFrame",1,[this](auto& rt,auto const&,auto* args,size_t count){checkOwner();frames.erase(readId(rt,args,count));return facebook::jsi::Value::undefined();});
    method("queueMicrotask",1,[this](auto& rt,auto const&,auto* args,size_t count){checkOpen();if(count!=1)throw facebook::jsi::JSError(rt,"Native microtask requires a function");rt.queueMicrotask(readCallback(rt,args[0]));return facebook::jsi::Value::undefined();});
  }
  std::optional<double> deadline(std::optional<double> other={})const{
    checkOwner();for(auto const& [id,timer]:timers)if(!other||timer.deadline<*other)other=timer.deadline;return other;
  }
  void runDueTimers(){
    checkOpen();const auto tick=now();std::vector<uint64_t> due;for(auto const& [id,timer]:timers)if(timer.deadline<=tick)due.push_back(id);
    for(auto id:due){auto found=timers.find(id);if(found==timers.end())continue;auto callback=found->second.callback.getFunction(runtime);
      if(found->second.period)found->second.deadline=tick+found->second.period;else timers.erase(found);callback.call(runtime);runtime.drainMicrotasks();}
  }
  size_t dispatchFrames(double tick){
    checkOpen();frameArmed=false;std::vector<uint64_t> due;for(auto const& [id,callback]:frames)due.push_back(id);size_t dispatched=0;
    for(auto id:due){auto found=frames.find(id);if(found==frames.end())continue;auto callback=std::move(found->second);frames.erase(found);++dispatched;callback.call(runtime,tick,now());}return dispatched;
  }
  bool empty()const{checkOwner();return timers.empty()&&frames.empty();}
  void close(){checkOwner();closed=true;frames.clear();timers.clear();}
private:
  static constexpr uint64_t maxId=9007199254740991ULL;static constexpr size_t limit=4096;
  struct Timer{double deadline,period;facebook::jsi::Function callback;};
  void checkOwner()const{if(owner!=std::this_thread::get_id())throw std::runtime_error("VM callbacks require their runtime thread");}
  void checkOpen()const{checkOwner();if(closed)throw std::runtime_error("VM callbacks are retired");}
  uint64_t next(uint64_t& value){if(value>=maxId)throw std::runtime_error("VM callback ID exhausted");return ++value;}
  static facebook::jsi::Function readCallback(facebook::jsi::Runtime& rt,facebook::jsi::Value const& value){if(!value.isObject()||!value.getObject(rt).isFunction(rt))throw facebook::jsi::JSError(rt,"Native callback must be a function");return value.getObject(rt).getFunction(rt);}
  static uint64_t readId(facebook::jsi::Runtime& rt,facebook::jsi::Value const* args,size_t count){if(count!=1||!args[0].isNumber())throw facebook::jsi::JSError(rt,"Invalid native callback ID");const auto id=args[0].getNumber();if(!std::isfinite(id)||id<0||id>double(maxId)||std::floor(id)!=id)throw facebook::jsi::JSError(rt,"Invalid native callback ID");return uint64_t(id);}
  facebook::jsi::Runtime& runtime;std::function<double()> now;std::function<void()> armFrame;std::thread::id owner;
  std::map<uint64_t,Timer> timers;std::map<uint64_t,facebook::jsi::Function> frames;uint64_t nextTimer=0,nextFrame=0;bool closed=false,frameArmed=false;
};
}
