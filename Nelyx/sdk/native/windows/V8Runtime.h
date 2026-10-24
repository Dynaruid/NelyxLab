// SPDX-License-Identifier: BSD-3-Clause
#pragma once
// Compiled into the pinned RNW source supplier, against its JSI 21 headers.
// The V8 DLL boundary is Microsoft's pinned C ABI; no V8 C++ ABI crosses it.
#include "JSI/RuntimeHolder.h"
#include <jsitooling/react/runtime/JSRuntimeFactory.h>
#include <V8JsiRuntime.h>

namespace Nelyx::WindowsJavaScript {
class TaskRunner final : public v8runtime::JSITaskRunner {
 public:
  explicit TaskRunner(std::shared_ptr<facebook::react::MessageQueueThread> queue):queue_(std::move(queue)){}
  void postTask(std::unique_ptr<v8runtime::JSITask> task) override {
    auto shared=std::shared_ptr<v8runtime::JSITask>(std::move(task));
    queue_->runOnQueue([task=std::move(shared)]{task->run();});
  }
 private:
  std::shared_ptr<facebook::react::MessageQueueThread> queue_;
};
class RuntimeHolder final : public Microsoft::JSI::RuntimeHolderLazyInit {
 public:
  explicit RuntimeHolder(std::shared_ptr<facebook::react::MessageQueueThread> queue){
    v8runtime::V8RuntimeArgs args{};
    args.foreground_task_runner=std::make_shared<TaskRunner>(std::move(queue));
    args.flags.explicitMicrotaskPolicy=true;
    runtime_=v8runtime::makeV8Runtime(std::move(args));
    if(!runtime_)throw std::runtime_error("V8 runtime creation failed");
    auto &runtime=*runtime_;
    // Admission exercises real Promise chaining and a JSI host microtask.
    // RN's scheduler retries forever if the C ABI's completion bit is passed
    // through with the wrong meaning, even when the queue is already empty.
    auto settled=runtime.evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>("(()=>{let n=0;Promise.resolve().then(()=>++n).then(()=>++n);return ()=>n;})()"),"nelyx:v8-microtask-admission").asObject(runtime).asFunction(runtime);
    if(!runtime.drainMicrotasks()||settled.call(runtime).asNumber()!=2)throw std::runtime_error("V8 Promise checkpoint admission failed");
    auto queued=std::make_shared<bool>(false);
    auto task=facebook::jsi::Function::createFromHostFunction(runtime,facebook::jsi::PropNameID::forAscii(runtime,"nelyxMicrotaskAdmission"),0,[queued](facebook::jsi::Runtime&,const facebook::jsi::Value&,const facebook::jsi::Value*,size_t){*queued=true;return facebook::jsi::Value::undefined();});
    runtime.queueMicrotask(task);
    if(!runtime.drainMicrotasks()||!*queued||!runtime.drainMicrotasks())throw std::runtime_error("V8 host/empty checkpoint admission failed");
    facebook::jsi::Object identity(runtime);
    identity.setProperty(runtime,"engine","v8");
    identity.setProperty(runtime,"releaseVersion","24.1.10");
    identity.setProperty(runtime,"revision","c1877966a8285b7cbacbdd03e26ca003496436bc");
    identity.setProperty(runtime,"description",facebook::jsi::String::createFromUtf8(runtime,runtime.description()));
    runtime.global().setProperty(runtime,"__nelyxV8RuntimeIdentity",std::move(identity));
  }
  std::shared_ptr<facebook::jsi::Runtime> getRuntime() noexcept override{return runtime_;}
  facebook::react::JSIEngineOverride getRuntimeType() noexcept override{return facebook::react::JSIEngineOverride::V8;}
 private:
  std::shared_ptr<facebook::jsi::Runtime> runtime_;
};
class Runtime final : public facebook::react::JSRuntime {
 public:
  explicit Runtime(std::shared_ptr<Microsoft::JSI::RuntimeHolderLazyInit> holder):holder_(std::move(holder)){}
  facebook::jsi::Runtime& getRuntime() noexcept override{return *holder_->getRuntime();}
  // JSRuntime owns its fallback inspector delegate. Hermes' delegate requires
  // Hermes-specific handles and must never be used for a V8 instance.
 private:
  std::shared_ptr<Microsoft::JSI::RuntimeHolderLazyInit> holder_;
};
}
