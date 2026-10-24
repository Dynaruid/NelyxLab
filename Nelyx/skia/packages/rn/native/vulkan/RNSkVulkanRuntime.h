// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkVulkanPlatformContext.h"
#include "rnskia/RNSkManager.h"
#include <cstdint>
#include <stdexcept>
#include <unordered_map>

namespace RNSkia {
// The host's scheduler owns execution. Queued scheduler lambdas carry only
// weak native state + an ID, so cancelled JSI captures retire on their owner.
class VulkanRuntimeInvoker final : public facebook::react::CallInvoker,
    public std::enable_shared_from_this<VulkanRuntimeInvoker> {
public:
  explicit VulkanRuntimeInvoker(std::shared_ptr<facebook::react::CallInvoker> scheduler)
      : scheduler(std::move(scheduler)), owner(std::this_thread::get_id()) {
    if(!this->scheduler)throw std::runtime_error("Actual host CallInvoker required");
  }
  void invokeAsync(facebook::react::CallFunc&& task) noexcept override {
    uint64_t id;
    {
      std::lock_guard lock(mutex);
      if(closed)return;
      id=++next;pending.emplace(id,std::move(task));
    }
    scheduler->invokeAsync([weak=weak_from_this(),id](facebook::jsi::Runtime& rt) {
      auto self=weak.lock();if(!self)return;
      facebook::react::CallFunc task;
      {
        std::lock_guard lock(self->mutex);
        auto found=self->pending.find(id);if(found==self->pending.end())return;
        task=std::move(found->second);self->pending.erase(found);
      }
      task(rt);
    });
  }
  void invokeSync(facebook::react::CallFunc&& task) override {
    requireOwner();
    {std::lock_guard lock(mutex);if(closed)throw std::runtime_error("Native runtime is closed");}
    scheduler->invokeSync(std::move(task));
  }
  void close() {
    requireOwner();
    std::unordered_map<uint64_t,facebook::react::CallFunc> cancelled;
    {std::lock_guard lock(mutex);closed=true;cancelled.swap(pending);cancelledTotal+=cancelled.size();}
    // All JSI values captured by pending work die on their live runtime owner.
    cancelled.clear();
  }
  void requireOwner() const {
    if(owner!=std::this_thread::get_id())throw std::runtime_error("Runtime operation requires its JS owner");
  }
  size_t cancelledCallbacks() {requireOwner();std::lock_guard lock(mutex);return cancelledTotal;}
private:
  std::shared_ptr<facebook::react::CallInvoker> scheduler;
  const std::thread::id owner;
  std::mutex mutex;
  bool closed=false;
  uint64_t next=0;
  size_t cancelledTotal=0;
  std::unordered_map<uint64_t,facebook::react::CallFunc> pending;
};

class RNSkVulkanRuntime final {
public:
  RNSkVulkanRuntime(facebook::jsi::Runtime& runtime,
      std::shared_ptr<facebook::react::CallInvoker> scheduler, float density,
      VulkanPlatformServices services, std::function<void()> stopServices)
      : runtime(&runtime), invoker(std::make_shared<VulkanRuntimeInvoker>(std::move(scheduler))),
        stopServices(std::move(stopServices)) {
    if(!this->stopServices)throw std::runtime_error("Native service quiescence is required before runtime destruction");
    if(!runtime.global().getProperty(runtime,"SkiaApi").isUndefined() ||
       !runtime.global().getProperty(runtime,"SkiaViewApi").isUndefined())
      throw std::runtime_error("Skia bindings already belong to this runtime");
    context=std::make_shared<RNSkVulkanPlatformContext>(invoker,density,std::move(services));
    manager=std::make_unique<RNSkManager>(&runtime,invoker,context);
  }
  RNSkManager& getManager() {invoker->requireOwner();if(!manager)throw std::runtime_error("Native runtime is closed");return *manager;}
  std::shared_ptr<RNSkVulkanPlatformContext> getPlatformContext() {return context;}
  size_t cancelledCallbacks() {return invoker->cancelledCallbacks();}
  void close(facebook::jsi::Runtime& current) {
    invoker->requireOwner();
    if(runtime!=&current)throw std::runtime_error("Foreign runtime cleanup rejected");
    if(closed)return;
    // The host stops view producers first. Services must cancel/retire every
    // callback that captures JSI values, on this owner, before returning.
    manager->unregisterAllSkiaViews(); // Pending native properties die on this live JS owner.
    stopServices(); // Also cancel any native release work queued by property destruction.
    context->close(); // Failed native drain retains all state and the runtime.
    invoker->close();
    current.global().setProperty(current,"SkiaViewApi",facebook::jsi::Value::undefined());
    current.global().setProperty(current,"SkiaApi",facebook::jsi::Value::undefined());
    manager.reset();context.reset();closed=true;
  }
private:
  facebook::jsi::Runtime* runtime;
  std::shared_ptr<VulkanRuntimeInvoker> invoker;
  std::shared_ptr<RNSkVulkanPlatformContext> context;
  std::unique_ptr<RNSkManager> manager;
  std::function<void()> stopServices;
  bool closed=false;
};
}
