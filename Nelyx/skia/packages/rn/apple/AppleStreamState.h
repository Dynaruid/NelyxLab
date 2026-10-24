// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <limits>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace RNSkia {
struct AppleStreamSnapshot {
  size_t activeJobs;
  size_t retainedBytes;
  bool closing;
  bool drained() const { return closing && !activeJobs && !retainedBytes; }
};

// Transport completion retires a job; payload destruction releases its byte
// reservation independently. Cancellation and deadlines do neither by intent.
class AppleStreamState final {
public:
  using Clock = std::chrono::steady_clock;
  static constexpr size_t MaxJobs = 8, MaxResponse = 16 * 1024 * 1024,
                          MaxPayloads = 64 * 1024 * 1024, Chunk = 64 * 1024;
  uint64_t admit(size_t limit, Clock::time_point now = Clock::now()) {
    std::lock_guard lock(_mutex);
    if (!limit) limit = MaxResponse;
    const auto initial = std::min(limit, Chunk);
    if (_closing || limit > MaxResponse || _jobs.size() >= MaxJobs ||
        initial > MaxPayloads - _bytes || _next == std::numeric_limits<uint64_t>::max())
      throw std::runtime_error("Apple stream admission closed or budget exceeded");
    const auto id = ++_next;
    _jobs.emplace(id, Job{limit, 0, now + std::chrono::seconds(30), false});
    try { _payloads.emplace(id, Payload{initial, 0}); }
    catch (...) { _jobs.erase(id); throw; }
    _bytes += initial;
    return id;
  }
  bool valid(uint64_t id, Clock::time_point now = Clock::now()) {
    std::lock_guard lock(_mutex); return validLocked(id, now);
  }
  bool expectedLength(uint64_t id, int64_t length, Clock::time_point now = Clock::now()) {
    std::lock_guard lock(_mutex);
    if (!validLocked(id, now)) return false;
    auto &job = _jobs.at(id);
    if (length < -1 || (length >= 0 && static_cast<uint64_t>(length) > job.limit)) job.cancelled = true;
    return !job.cancelled;
  }
  bool accept(uint64_t id, size_t count, Clock::time_point now = Clock::now()) {
    std::lock_guard lock(_mutex);
    if (!validLocked(id, now)) return false;
    auto &job = _jobs.at(id);
    if (count > job.limit - job.received) { job.cancelled = true; return false; }
    job.received += count; return true;
  }
  bool beginResize(uint64_t id, size_t capacity) {
    std::lock_guard lock(_mutex);
    if (!validLocked(id, Clock::now())) return false;
    auto found = _payloads.find(id);
    if (found == _payloads.end() || found->second.pending ||
        capacity < found->second.capacity || capacity > _jobs.at(id).limit ||
        capacity > MaxPayloads - _bytes) return false;
    found->second.pending = capacity; _bytes += capacity; return true;
  }
  void endResize(uint64_t id, bool success) {
    std::lock_guard lock(_mutex);
    auto &payload = _payloads.at(id);
    if (!payload.pending) throw std::runtime_error("Apple stream resize was not reserved");
    _bytes -= success ? payload.capacity : payload.pending;
    if (success) payload.capacity = payload.pending;
    payload.pending = 0;
  }
  size_t capacity(uint64_t id) const {
    std::lock_guard lock(_mutex); return _payloads.at(id).capacity;
  }
  size_t limit(uint64_t id) const {
    std::lock_guard lock(_mutex); return _jobs.at(id).limit;
  }
  void cancel(uint64_t id) {
    std::lock_guard lock(_mutex); auto found = _jobs.find(id);
    if (found != _jobs.end()) found->second.cancelled = true;
  }
  std::vector<uint64_t> expire(Clock::time_point now = Clock::now()) {
    std::lock_guard lock(_mutex); std::vector<uint64_t> expired;
    for (auto &[id, job] : _jobs) if (!job.cancelled && now >= job.deadline) {
      job.cancelled = true; expired.push_back(id);
    }
    return expired;
  }
  void close() {
    std::lock_guard lock(_mutex); _closing = true;
    for (auto &[id, job] : _jobs) { (void)id; job.cancelled = true; }
  }
  void retireJob(uint64_t id) { std::lock_guard lock(_mutex); _jobs.erase(id); }
  void releasePayload(uint64_t id) {
    std::lock_guard lock(_mutex); auto found = _payloads.find(id);
    if (found == _payloads.end()) return;
    _bytes -= found->second.capacity + found->second.pending; _payloads.erase(found);
  }
  AppleStreamSnapshot snapshot() const {
    std::lock_guard lock(_mutex); return {_jobs.size(), _bytes, _closing};
  }
private:
  struct Job { size_t limit, received; Clock::time_point deadline; bool cancelled; };
  struct Payload { size_t capacity, pending; };
  bool validLocked(uint64_t id, Clock::time_point now) {
    auto found = _jobs.find(id);
    if (found == _jobs.end() || _closing) return false;
    if (now >= found->second.deadline) found->second.cancelled = true;
    return !found->second.cancelled;
  }
  mutable std::mutex _mutex;
  bool _closing = false;
  uint64_t _next = 0;
  size_t _bytes = 0;
  std::unordered_map<uint64_t, Job> _jobs;
  std::unordered_map<uint64_t, Payload> _payloads;
};

// One transport producer writes a buffer. Shared ownership keeps storage and
// its reservation alive through late native work and the returned SkData.
class AppleStreamBuffer final {
public:
  AppleStreamBuffer(std::shared_ptr<AppleStreamState> state, uint64_t id)
      : _state(std::move(state)), _id(id), _limit(_state->limit(id)),
        _capacity(_state->capacity(id)), _data(std::malloc(_capacity)) {
    if (!_data) throw std::bad_alloc();
  }
  ~AppleStreamBuffer() { std::free(_data); _state->releasePayload(_id); }
  AppleStreamBuffer(const AppleStreamBuffer &) = delete;
  AppleStreamBuffer &operator=(const AppleStreamBuffer &) = delete;
  bool append(const void *bytes, size_t count) {
    if (!_state->valid(_id) || count > _limit - _size || (count && !bytes)) {
      _state->cancel(_id); return false;
    }
    const auto needed = _size + count;
    if (needed > _capacity) {
      const auto capacity = std::min(_limit, std::max(needed, _capacity * 2));
      if (!_state->beginResize(_id, capacity)) { _state->cancel(_id); return false; }
      void *replacement = std::malloc(capacity);
      if (!replacement) { _state->endResize(_id, false); _state->cancel(_id); return false; }
      std::memcpy(replacement, _data, _size); std::free(_data);
      _data = replacement; _capacity = capacity; _state->endResize(_id, true);
    }
    if (!_state->accept(_id, count)) return false;
    if (count) std::memcpy(static_cast<unsigned char *>(_data) + _size, bytes, count);
    _size += count; return true;
  }
  const void *data() const { return _data; }
  size_t size() const { return _size; }
private:
  const std::shared_ptr<AppleStreamState> _state;
  const uint64_t _id;
  const size_t _limit;
  size_t _capacity, _size = 0;
  void *_data;
};
} // namespace RNSkia
