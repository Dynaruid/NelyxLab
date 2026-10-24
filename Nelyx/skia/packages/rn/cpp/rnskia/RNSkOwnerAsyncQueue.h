// SPDX-License-Identifier: BSD-3-Clause
#pragma once

#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <thread>
#include <unordered_map>
#include <utility>

namespace RNSkia {

// Only the owner holds callbacks, which may capture JSI values. Producers and
// scheduler jobs carry weak state and an ID; Result must contain native data.
template <class Result>
class RNSkOwnerAsyncQueue final
    : public std::enable_shared_from_this<RNSkOwnerAsyncQueue<Result>> {
public:
  using Callback = std::function<void(Result)>;
  using Scheduler = std::function<void(std::function<void()>)>;

  explicit RNSkOwnerAsyncQueue(Scheduler scheduler, size_t capacity = 64)
      : _scheduler(std::move(scheduler)), _capacity(capacity),
        _owner(std::this_thread::get_id()) {
    if (!_scheduler || !_capacity)
      throw std::runtime_error("Async operation scheduler and capacity required");
  }

  Callback begin(Callback callback) {
    requireOwner();
    const auto weak = this->weak_from_this();
    if (weak.expired() || !callback)
      throw std::runtime_error("Owned async operation callback required");
    uint64_t id;
    {
      std::lock_guard lock(_mutex);
      if (_closed || _pending.size() >= _capacity ||
          _next == std::numeric_limits<uint64_t>::max())
        throw std::runtime_error("Async operation admission closed or full");
      id = ++_next;
      _pending.emplace(id, Entry{std::move(callback), std::nullopt});
    }
    return [weak, id](Result result) {
      if (auto state = weak.lock()) state->complete(id, std::move(result));
    };
  }

  // Invoke while the runtime is still alive. Pending callbacks and their JSI
  // captures are destroyed here, never on a producer or scheduler destructor.
  void close() {
    requireOwner();
    std::unordered_map<uint64_t, Entry> cancelled;
    {
      std::lock_guard lock(_mutex);
      _closed = true;
      cancelled.swap(_pending);
    }
    cancelled.clear();
  }

  // May be called by a foreign teardown thread before quarantining this queue.
  // It closes admission/delivery without destroying owner-affine callbacks.
  void seal() {
    std::lock_guard lock(_mutex);
    _closed = true;
  }

  void requireOwner() const {
    if (_owner != std::this_thread::get_id())
      throw std::runtime_error("Async operation requires its JS owner");
  }

  size_t pending() const {
    std::lock_guard lock(_mutex);
    return _pending.size();
  }

private:
  struct Entry {
    Callback callback;
    std::optional<Result> result;
  };

  void complete(uint64_t id, Result result) {
    {
      std::lock_guard lock(_mutex);
      auto found = _pending.find(id);
      if (_closed || found == _pending.end() || found->second.result) return;
      found->second.result.emplace(std::move(result));
    }
    // A scheduler can retire this job after close or even after VM teardown.
    // Neither the queued job nor a rejected duplicate owns the JS callback.
    try {
      _scheduler([weak = this->weak_from_this(), id] {
        if (auto state = weak.lock()) state->deliver(id);
      });
    } catch (...) {
      // Keep the callback for owner-side close if the scheduler rejects work.
    }
  }

  void deliver(uint64_t id) {
    requireOwner();
    std::optional<Entry> ready;
    {
      std::lock_guard lock(_mutex);
      auto found = _pending.find(id);
      if (_closed || found == _pending.end() || !found->second.result) return;
      ready.emplace(std::move(found->second));
      _pending.erase(found);
    }
    ready->callback(std::move(*ready->result));
  }

  const Scheduler _scheduler;
  const size_t _capacity;
  const std::thread::id _owner;
  mutable std::mutex _mutex;
  bool _closed = false;
  uint64_t _next = 0;
  std::unordered_map<uint64_t, Entry> _pending;
};
} // namespace RNSkia
