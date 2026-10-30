// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
namespace RNSkia {
/** QPC milliseconds. Targets predict compositor cadence, never display completion. */
struct CompositorFrameTiming {
  double start=0,target=0,interval=0,wake=0,uncertainty=0;
  uint64_t revision=0;
  bool observed=false;
};
}
