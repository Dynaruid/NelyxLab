// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "layout.hpp"

namespace nelyx::v2 {
struct QueryValue {
  double value = 0, width = 0, height = 0, baseline = -1;
};
// Intrinsic and dry queries own their continuations and never install a scene.
class LayoutQueryWork {
public:
  LayoutQueryWork(std::shared_ptr<const Document>, Handle, uint32_t, LayoutConstraints, double,
                  uint64_t);
  ~LayoutQueryWork();
  bool step(uint32_t quota);
  bool waiting() const;
  std::optional<MeasurementRequest> request() const;
  void measured(uint64_t, Handle, Measurement);
  QueryValue value() const;

private:
  struct State;
  std::unique_ptr<State> state_;
};
} // namespace nelyx::v2
