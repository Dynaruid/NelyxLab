// Copyright (c) Nelyx contributors. SPDX-License-Identifier: BSD-3-Clause
#pragma once

#include <ReactCommon/CallInvoker.h>
#include <jsi/jsi.h>

#include <atomic>
#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <stdexcept>
#include <thread>
#include <unordered_map>
#include <utility>

namespace RNSkia {

// Only the runtime-owned sentinel holds callbacks. IO workers and queued
// invocations carry weak tickets and native payloads, never JSI handles.
template <typename Payload> class AndroidRuntimeCallbacks {
public:
  using Callback = std::function<void(Payload)>;

  struct State {
    facebook::jsi::Runtime *runtime;
    const std::thread::id owner = std::this_thread::get_id();
    std::atomic<bool> active{true};
    uint64_t next = 1;
    std::unordered_map<uint64_t, Callback> callbacks;

    explicit State(facebook::jsi::Runtime &rt) : runtime(&rt) {}

    void close() noexcept {
      active.store(false, std::memory_order_release);
      // NativeState finalization is serialized by the engine. Release JSI
      // callbacks here while the engine exists, even if a worker holds State.
      callbacks.clear();
    }
  };

  using TicketOwner = std::weak_ptr<State>;
  static constexpr size_t kMaxPending = 64;

  static TicketOwner bind(facebook::jsi::Runtime &runtime) {
    namespace jsi = facebook::jsi;
    auto global = runtime.global();
    auto existing = global.getProperty(runtime, kGlobalName);
    if (existing.isObject()) {
      auto object = existing.getObject(runtime);
      if (object.template hasNativeState<Sentinel>(runtime)) {
        auto sentinel = object.template getNativeState<Sentinel>(runtime);
        requireOwner(*sentinel->state, runtime);
        return sentinel->state;
      }
    }
    if (!existing.isUndefined()) {
      throw std::runtime_error("Nelyx Android runtime callback global collision");
    }
    auto sentinel = std::make_shared<Sentinel>(runtime);
    jsi::Object holder(runtime);
    holder.setNativeState(runtime, sentinel);
    jsi::Object descriptor(runtime);
    descriptor.setProperty(runtime, "value", std::move(holder));
    descriptor.setProperty(runtime, "writable", false);
    descriptor.setProperty(runtime, "enumerable", false);
    descriptor.setProperty(runtime, "configurable", false);
    global.getPropertyAsObject(runtime, "Object")
        .getPropertyAsFunction(runtime, "defineProperty")
        .call(runtime, global, jsi::String::createFromAscii(runtime, kGlobalName),
              descriptor);
    return sentinel->state;
  }

  static Callback add(const TicketOwner &owner, facebook::jsi::Runtime &runtime,
                      std::shared_ptr<facebook::react::CallInvoker> invoker,
                      Callback callback) {
    auto state = owner.lock();
    if (!state || !invoker) {
      throw std::runtime_error("Nelyx Android runtime callbacks are closed");
    }
    requireOwner(*state, runtime);
    if (state->callbacks.size() >= kMaxPending ||
        state->next == std::numeric_limits<uint64_t>::max()) {
      throw std::runtime_error("Nelyx Android runtime callback limit reached");
    }
    const auto key = state->next++;
    state->callbacks.emplace(key, std::move(callback));
    return [owner, invoker = std::move(invoker), key](Payload payload) mutable {
      auto live = owner.lock();
      if (!live || !live->active.load(std::memory_order_acquire)) {
        return;
      }
      invoker->invokeAsync(
          [owner, key, payload = std::move(payload)](
              facebook::jsi::Runtime &runtime) mutable {
            auto live = owner.lock();
            if (!live || !live->active.load(std::memory_order_acquire) ||
                live->runtime != &runtime ||
                live->owner != std::this_thread::get_id()) {
              return;
            }
            auto found = live->callbacks.find(key);
            if (found == live->callbacks.end()) {
              return;
            }
            auto callback = std::move(found->second);
            live->callbacks.erase(found);
            callback(std::move(payload));
          });
    };
  }

private:
  struct Sentinel : facebook::jsi::NativeState {
    std::shared_ptr<State> state;
    explicit Sentinel(facebook::jsi::Runtime &rt)
        : state(std::make_shared<State>(rt)) {}
    ~Sentinel() override { state->close(); }
  };

  static constexpr const char *kGlobalName = "__nelyxAndroidRuntimeCallbacks";

  static void requireOwner(const State &state, facebook::jsi::Runtime &runtime) {
    if (!state.active.load(std::memory_order_acquire) ||
        state.runtime != &runtime || state.owner != std::this_thread::get_id()) {
      throw std::runtime_error("Nelyx Android runtime callback owner mismatch");
    }
  }
};

} // namespace RNSkia
