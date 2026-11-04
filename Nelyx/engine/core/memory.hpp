// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "protocol/wire.hpp"
#include <memory>
#include <atomic>
namespace nelyx::v2 {
struct Ledger {
  std::atomic<uint64_t> bytes{0}, resourceBytes{0}, nodes{0};
  uint32_t queuedInputs = 0, updateInputs = 0, activeViews = 0;
};
struct Lease {
  std::shared_ptr<Ledger> ledger;
  uint64_t bytes;
  bool resource;
  Lease(std::shared_ptr<Ledger> owner, uint64_t count, bool isResource = false)
      : ledger(std::move(owner)), bytes(count), resource(isResource) {
    const auto reserve = [](std::atomic<uint64_t> &used, uint64_t amount, uint64_t limit) {
      auto value = used.load();
      for (;;) {
        require(amount <= limit - value, wire::statuses::budgetExceeded);
        if (used.compare_exchange_weak(value, value + amount))
          return;
      }
    };
    reserve(ledger->bytes, bytes, wire::limits::sessionBytes);
    if (resource)
      try {
        reserve(ledger->resourceBytes, bytes, wire::limits::resourceBytes);
      } catch (...) {
        ledger->bytes -= bytes;
        throw;
      }
  }
  ~Lease() {
    ledger->bytes -= bytes;
    if (resource)
      ledger->resourceBytes -= bytes;
  }
  Lease(const Lease &) = delete;
  Lease &operator=(const Lease &) = delete;
};
} // namespace nelyx::v2
