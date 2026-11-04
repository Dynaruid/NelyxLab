// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "protocol/wire.hpp"
#include <memory>

namespace nelyx::v2 {
struct Preparation;
struct Frame;
class Engine {
 public:
  Engine(uint32_t session, uint32_t app);
  ~Engine();
  std::vector<uint8_t> dispatch(Reader packet);
  void connectProvider(bool independent, uint64_t contentOwner, uint64_t renderOwner);
  std::shared_ptr<const Preparation> providerSnapshot(uint32_t view, uint32_t generation);
  std::shared_ptr<const Frame> frameSnapshot(uint32_t view, uint32_t generation, uint64_t id);
 private:
  struct State;
  std::unique_ptr<State> state_;
};
}
