// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <exception>
#include <mutex>
#include <stdexcept>
#include <utility>

namespace nelyx::vulkan {
// Native-only external-frame admission/retirement. A frame owns its Device,
// so this gate outlives every lease. No Vulkan/OS/JSI work runs in notification.
class FrameLeaseGate final {
 public:
  static constexpr uint32_t limit=3;
  static constexpr std::chrono::milliseconds maxWait{5000};
  class Lease final {
   public:
    Lease()=default;
    ~Lease(){reset();}
    Lease(const Lease&)=delete;
    Lease& operator=(const Lease&)=delete;
    Lease(Lease&& other) noexcept:gate(std::exchange(other.gate,nullptr)){}
    Lease& operator=(Lease&& other) noexcept {
      if(this!=&other){reset();gate=std::exchange(other.gate,nullptr);}return *this;
    }
    void reset() noexcept {if(auto* owner=std::exchange(gate,nullptr))owner->retire();}
   private:
    friend class FrameLeaseGate;
    explicit Lease(FrameLeaseGate* owner):gate(owner){}
    FrameLeaseGate* gate=nullptr;
  };
  Lease acquire() {
    std::lock_guard lock(mutex);
    if(closed)throw std::runtime_error("DMA-BUF frame lease admission closed");
    if(count==limit)throw std::runtime_error("DMA-BUF frame lease budget exceeded");
    ++count;return Lease(this);
  }
  uint32_t outstanding() const {std::lock_guard lock(mutex);return count;}
  bool accepting() const {std::lock_guard lock(mutex);return !closed && count<limit;}
  bool isClosing() const {std::lock_guard lock(mutex);return closed;}
  // Seal admission before waiting. A timeout leaves both the seal and leases
  // intact. A later native release permits an owner-thread drain retry.
  bool closeAndWait(std::chrono::milliseconds timeout=maxWait) {
    if(timeout<std::chrono::milliseconds::zero() || timeout>maxWait)
      throw std::runtime_error("DMA-BUF frame drain deadline exceeds native bound");
    const auto deadline=std::chrono::steady_clock::now()+timeout;
    std::unique_lock lock(mutex);closed=true;
    return retired.wait_until(lock,deadline,[this]{return count==0;});
  }
 private:
  void retire() noexcept {
    {
      std::lock_guard lock(mutex);
      if(!count)std::terminate(); // Move-only leases must retire exactly once.
      --count;
    }
    retired.notify_all();
  }
  mutable std::mutex mutex;
  std::condition_variable retired;
  uint32_t count=0;
  bool closed=false;
};
}
