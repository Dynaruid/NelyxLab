// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <thread>
#include <vector>

namespace RNSkia {
// JSI members are confined to the live JS owner. Deadline checks and native
// completion carry no JSI values, so a failed/wedged owner can be retained.
class AppleRuntimeBinding final : public std::enable_shared_from_this<AppleRuntimeBinding> {
public:
  using Runtime=facebook::jsi::Runtime;
  using Completion=std::function<void(std::string)>;
  AppleRuntimeBinding(Runtime &runtime,std::string platform,std::function<void()> prepareUi,
      std::function<void(std::function<void()>)> scheduleJs,
      std::function<void(Runtime&,facebook::jsi::Object&)> admission={},std::function<void()> prepareGpu={})
      : _runtime(runtime),_platform(std::move(platform)),_prepareUi(std::move(prepareUi)),_scheduleJs(std::move(scheduleJs)),_admission(std::move(admission)),_prepareGpu(std::move(prepareGpu)),_owner(std::this_thread::get_id()),_generation(++_next) {
    if(_generation>9007199254740991ULL || !_prepareUi || !_scheduleJs)throw std::runtime_error("Apple runtime owner unavailable");
    if(static_cast<bool>(_admission)!=static_cast<bool>(_prepareGpu))throw std::runtime_error("Apple runtime admission ports incomplete");
  }
  void requireOwner() const {if(_owner!=std::this_thread::get_id())throw std::runtime_error("Apple runtime requires its JS owner");}
  void install() {
    requireOwner();namespace jsi=facebook::jsi;auto api=jsi::Object(_runtime);auto weak=weak_from_this();
    api.setProperty(_runtime,"getStatus",jsi::Function::createFromHostFunction(_runtime,jsi::PropNameID::forAscii(_runtime,"getStatus"),0,
      [weak](Runtime &rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Apple runtime owner retired");return self->status(rt);}));
    api.setProperty(_runtime,"registerShutdownHandler",jsi::Function::createFromHostFunction(_runtime,jsi::PropNameID::forAscii(_runtime,"registerShutdownHandler"),1,
      [weak](Runtime &rt,const jsi::Value&,const jsi::Value *args,size_t count)->jsi::Value{
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Apple runtime owner retired");self->requireOwner();
        if(count!=1 || !args[0].isObject() || !args[0].asObject(rt).isFunction(rt) || self->stage()!="active" || self->_handler)throw jsi::JSError(rt,"Apple shutdown handler admission rejected");
        self->_handler.emplace(args[0].asObject(rt).asFunction(rt));return jsi::Value::undefined();}));
    api.setProperty(_runtime,"requestShutdown",jsi::Function::createFromHostFunction(_runtime,jsi::PropNameID::forAscii(_runtime,"requestShutdown"),1,
      [weak](Runtime &rt,const jsi::Value&,const jsi::Value *args,size_t count)->jsi::Value{
        auto self=weak.lock();if(!self || count!=1 || !args[0].isObject() || !args[0].asObject(rt).isFunction(rt))throw jsi::JSError(rt,"Apple shutdown completion required");
        self->requireOwner();if(self->_jsCompletion)throw jsi::JSError(rt,"Apple shutdown already requested");
        if(self->ownerReleased()) {
          auto complete=args[0].asObject(rt).asFunction(rt);
          if(self->stage()=="closed")complete.call(rt);
          else complete.call(rt,jsi::String::createFromUtf8(rt,"Apple runtime owner retired"));
          return jsi::Value::undefined();
        }
        self->_jsCompletion.emplace(args[0].asObject(rt).asFunction(rt));
        self->begin([weak](std::string error){if(auto state=weak.lock())state->completeJs(std::move(error));});return jsi::Value::undefined();}));
    if(_prepareGpu)api.setProperty(_runtime,"prepareCompositionGpu",jsi::Function::createFromHostFunction(_runtime,jsi::PropNameID::forAscii(_runtime,"prepareCompositionGpu"),0,
      [weak](Runtime &rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Apple runtime owner retired");self->requireOwner();
        if(self->stage()!="active" || self->ownerReleased())throw jsi::JSError(rt,"Apple GPU owner admission closed");
        auto status=jsi::Object(rt);self->_admission(rt,status);auto closing=status.getProperty(rt,"hostTeardownRequested");
        if(!closing.isBool() || closing.asBool())throw jsi::JSError(rt,"Apple host teardown admission closed");
        try{self->_prepareGpu();}catch(const std::exception &error){self->fail(error.what());throw jsi::JSError(rt,error.what());}
        return jsi::Value::undefined();}));
    _runtime.global().setProperty(_runtime,"NelyxAppleHost",std::move(api));
  }
  void begin(Completion complete) {
    requireOwner();std::string terminal;bool started=false;
    {std::lock_guard lock(_mutex);
      if(_stage=="closed" || _stage=="failed")terminal=_stage;
      else {if(_completions.size()>=8)throw std::runtime_error("Apple shutdown waiter budget exceeded");_completions.push_back(complete);
        if(_stage=="active"){_stage="sdk";_deadline=Clock::now()+std::chrono::seconds(10);started=true;}}
    }
    if(!terminal.empty()){complete(terminal=="closed"?"":"Apple shutdown failed; process restart required");return;}
    if(!started)return;
    if(!_handler){fail("Apple SDK shutdown handler unavailable");return;}
    namespace jsi=facebook::jsi;auto weak=weak_from_this();
    auto ack=jsi::Function::createFromHostFunction(_runtime,jsi::PropNameID::forAscii(_runtime,"completeAppleSdkShutdown"),1,
      [weak](Runtime &rt,const jsi::Value&,const jsi::Value *args,size_t count)->jsi::Value{
        if(auto self=weak.lock()){
          self->requireOwner();if(self->stage()!="sdk")return jsi::Value::undefined();
          if(count>1 || (count && !args[0].isUndefined() && !args[0].isString()))self->fail("Invalid Apple SDK shutdown acknowledgement");
          else if(count && args[0].isString())self->fail(args[0].asString(rt).utf8(rt));
          else if(self->advance("sdk","ui",5))self->_prepareUi();
        }return jsi::Value::undefined();});
    try{_handler->call(_runtime,std::move(ack));_runtime.drainMicrotasks();}catch(const std::exception &error){fail(error.what());}
  }
  bool advance(const std::string &from,const std::string &to,int seconds) {
    std::lock_guard lock(_mutex);if(_stage!=from || Clock::now()>=_deadline)return false;
    _stage=to;_deadline=Clock::now()+std::chrono::seconds(seconds);return true;
  }
  void finish(std::function<bool()> finalize=[](){return true;}) {
    requireOwner();
    // Serialize the last deadline check with publication release. External
    // native ACKs run only after owner-affine captures have been destroyed.
    try {
      std::lock_guard lock(_mutex);
      if(_stage!="native" || Clock::now()>=_deadline)return;
      _handler.reset();
      if(!finalize())throw std::runtime_error("Apple runtime publication release failed");
      _stage="closed";
    }catch(const std::exception &error){fail(error.what());return;}
    try{completeJs("");}catch(...){}
    _ownerReleased.store(true);
    notify("");
  }
  void fail(std::string error) {
    {std::lock_guard lock(_mutex);if(_stage=="closed" || _stage=="failed")return;_stage="failed";_error=error.empty()?"Apple shutdown failed":error;error=_error;}
    notify(std::move(error));
  }
  void checkDeadline(std::chrono::steady_clock::time_point now=std::chrono::steady_clock::now()) {
    bool expired;{std::lock_guard lock(_mutex);expired=_stage!="active" && _stage!="closed" && _stage!="failed" && now>=_deadline;}
    if(expired)fail("Apple shutdown deadline expired; runtime and dependencies retained");
  }
  std::string stage() const {std::lock_guard lock(_mutex);return _stage;}
  bool ownerReleased() const {return _ownerReleased.load();}
  void invalidate() {if(ownerReleased())return;requireOwner();if(stage()!="closed")fail("Apple runtime invalidated before checked shutdown");_handler.reset();_jsCompletion.reset();_ownerReleased.store(true);}
  Runtime &runtime(){requireOwner();return _runtime;}
private:
  using Clock=std::chrono::steady_clock;
  facebook::jsi::Value status(Runtime &rt) {
    requireOwner();namespace jsi=facebook::jsi;auto value=jsi::Object(rt);auto current=stage();
    value.setProperty(rt,"abi",_admission?3:1);value.setProperty(rt,"platform",jsi::String::createFromUtf8(rt,_platform));value.setProperty(rt,"runtimeGeneration",static_cast<double>(_generation));
    if(_admission)_admission(rt,value);
    value.setProperty(rt,"stage",jsi::String::createFromUtf8(rt,current));value.setProperty(rt,"phase",jsi::String::createFromUtf8(rt,current=="active" || current=="closed" || current=="failed"?current:"closing"));return value;
  }
  void completeJs(std::string error) {
    // A native deadline can arrive off-owner. Keep JSI captures for owner-side
    // invalidation; the host callback reports failure independently.
    if(ownerReleased())return;
    if(std::this_thread::get_id()!=_owner){_scheduleJs([weak=weak_from_this(),error=std::move(error)]()mutable{if(auto self=weak.lock())self->completeJs(std::move(error));});return;}
    if(!_jsCompletion)return;
    auto complete=std::move(*_jsCompletion);_jsCompletion.reset();
    if(error.empty())complete.call(_runtime);else complete.call(_runtime,facebook::jsi::String::createFromUtf8(_runtime,error));
  }
  void notify(std::string error) {std::vector<Completion> completions;{std::lock_guard lock(_mutex);completions.swap(_completions);}for(auto &complete:completions)if(complete){try{complete(error);}catch(...){}}}
  Runtime &_runtime;
  const std::string _platform;
  const std::function<void()> _prepareUi;
  const std::function<void(std::function<void()>)> _scheduleJs;
  const std::function<void(Runtime&,facebook::jsi::Object&)> _admission;
  const std::function<void()> _prepareGpu;
  const std::thread::id _owner;
  const uint64_t _generation;
  inline static std::atomic<uint64_t> _next{0};
  mutable std::mutex _mutex;
  std::string _stage="active",_error;
  Clock::time_point _deadline;
  std::vector<Completion> _completions;
  std::optional<facebook::jsi::Function> _handler,_jsCompletion;
  std::atomic<bool> _ownerReleased{false};
};
} // namespace RNSkia
