// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "protocol/wire.hpp"
#include <memory>

namespace nelyx::v2 {
inline constexpr uint32_t coreCapabilities = wire::capabilities::protocol | wire::capabilities::headlessScene |
  wire::capabilities::scroll | wire::capabilities::motion | wire::capabilities::layoutQueries |
  wire::capabilities::editing | wire::capabilities::semantics | wire::capabilities::lazyList |
  wire::capabilities::gestures | wire::capabilities::controls |
  wire::capabilities::rawObserver | wire::capabilities::appControlled | wire::capabilities::graphics | wire::capabilities::memoryBudget;
struct Ledger;
struct Preparation;
struct Frame;
struct MeasurementRequest;
struct InteractionSnapshot;
class Engine {
 public:
  Engine(uint32_t session, uint32_t app);
  ~Engine();
  std::shared_ptr<Ledger> memoryLedger() const;
  std::vector<uint8_t> dispatch(Reader packet);
  void connectProvider(bool independent, uint64_t contentOwner, uint64_t renderOwner);
  std::shared_ptr<const Preparation> providerSnapshot(uint32_t view, uint32_t generation);
  std::shared_ptr<const MeasurementRequest> measurementSnapshot(uint32_t view, uint32_t generation);
  std::shared_ptr<const Frame> frameSnapshot(uint32_t view, uint32_t generation, uint64_t id);
  std::shared_ptr<const InteractionSnapshot> interactionSnapshot(uint32_t view,uint32_t generation);
 private:
  struct State;
  std::unique_ptr<State> state_;
};
}
