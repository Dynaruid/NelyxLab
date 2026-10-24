// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#ifndef NELYX_APPLE_RUNTIME_TEARDOWN_H
#define NELYX_APPLE_RUNTIME_TEARDOWN_H
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstddef>
#include <memory>
#include <mutex>
#include <unordered_map>

namespace nelyx {
// Copied, pin-checked, into RNCore by the owning runner. No Skia/RN/JSI
// dependency. UI waiters and the JS destruction job share this one fence.
class AppleRuntimeTeardown final {
public:
  using Clock=std::chrono::steady_clock;
  enum class Phase {active,waiting,confirmed,destroying,finalizing,destroyed,failed};
  enum class Request {start,wait,confirmed,rejected};
  struct Snapshot {Phase phase;size_t waiters;};
  void sealAdmission() {_sealed.store(true);}
  bool admissionOpen() const {return !_sealed.load();}
  Request request(Clock::time_point now=Clock::now()) {
    sealAdmission();std::lock_guard lock(_mutex);
    if(_phase==Phase::active){_phase=Phase::waiting;_waiters=1;_deadline=now+std::chrono::seconds(25);return Request::start;}
    if(_phase==Phase::waiting){if(_waiters>=8)return Request::rejected;++_waiters;return Request::wait;}
    return _phase==Phase::failed?Request::rejected:Request::confirmed;
  }
  bool complete(bool success,Clock::time_point now=Clock::now()) {
    std::lock_guard lock(_mutex);if(_phase!=Phase::waiting)return false;
    _phase=success && now<_deadline?Phase::confirmed:Phase::failed;_waiters=0;return true;
  }
  bool claimDestruction(Clock::time_point now=Clock::now()) {
    std::lock_guard lock(_mutex);if(_phase!=Phase::confirmed)return false;
    _phase=Phase::destroying;_deadline=now+std::chrono::seconds(5);return true;
  }
  // The last cancellable boundary is before VM reset. A finalizer timeout
  // cannot undo a started destructor; it withholds success and keeps the lease.
  bool beginFinalization(Clock::time_point now=Clock::now()) {
    std::lock_guard lock(_mutex);if(_phase!=Phase::destroying)return false;
    if(now>=_deadline){_phase=Phase::failed;return false;}
    _phase=Phase::finalizing;return true;
  }
  bool finishDestruction(Clock::time_point now=Clock::now()) {
    std::lock_guard lock(_mutex);if(_phase!=Phase::finalizing)return false;
    if(now>=_deadline){_phase=Phase::failed;return false;}
    _phase=Phase::destroyed;return true;
  }
  bool checkDeadline(Clock::time_point now=Clock::now()) {
    std::lock_guard lock(_mutex);if((_phase!=Phase::waiting && _phase!=Phase::destroying && _phase!=Phase::finalizing)||now<_deadline)return false;
    _phase=Phase::failed;_waiters=0;return true;
  }
  void fail() {sealAdmission();std::lock_guard lock(_mutex);if(_phase!=Phase::destroyed)_phase=Phase::failed;_waiters=0;}
  Snapshot snapshot() const {std::lock_guard lock(_mutex);return {_phase,_waiters};}
private:
  mutable std::mutex _mutex;
  std::atomic<bool> _sealed{false};
  Phase _phase=Phase::active;
  size_t _waiters=0;
  Clock::time_point _deadline;
};

// Only the source-patched RNCore registers a live runtime. The Skia module
// calls its exported C validator; a JS-authored marker is insufficient.
class AppleRuntimeGuardRegistry final {
public:
  bool add(void *runtime,uint64_t generation,const std::shared_ptr<AppleRuntimeTeardown> &owner) {
    if(!runtime || !generation || !owner || !owner->admissionOpen())return false;
    std::lock_guard lock(_mutex);if(_entries.contains(runtime))return false;
    _entries.emplace(runtime,Entry{generation,owner});return true;
  }
  bool verify(void *runtime,uint64_t generation) const {
    std::lock_guard lock(_mutex);const auto found=_entries.find(runtime);
    return found!=_entries.end() && found->second.generation==generation && !found->second.owner.expired();
  }
  bool remove(void *runtime,uint64_t generation) {
    std::lock_guard lock(_mutex);const auto found=_entries.find(runtime);
    if(found==_entries.end() || found->second.generation!=generation)return false;
    _entries.erase(found);return true;
  }
private:
  struct Entry {uint64_t generation;std::weak_ptr<AppleRuntimeTeardown> owner;};
  mutable std::mutex _mutex;
  std::unordered_map<void*,Entry> _entries;
};
} // namespace nelyx
#endif // NELYX_APPLE_RUNTIME_TEARDOWN_H
