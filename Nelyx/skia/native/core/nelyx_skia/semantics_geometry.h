// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstddef>
#include <span>
#include <vector>
namespace nelyx::semantics_geometry {
inline constexpr size_t maxBytes = 4 * 1024 * 1024, maxNodes = 8192,
                        headerWords = 16, queryWords = 57, resultWords = 31;
inline constexpr double magic = 0x4e4c5347, resultMagic = 0x4e4c5348;
class Session {
  double owner_, generation_, revision_ = 0;
  size_t peak_ = 0;
  bool closed_ = false;

public:
  Session(double owner, double generation);
  std::vector<double> evaluate(std::span<const double> packet);
  bool isCurrent(double revision) const {
    return !closed_ && revision_ == revision;
  }
  void close() { closed_ = true; }
  std::vector<double> stats() const {
    return {0, 0, 0, 0, double(peak_), closed_ ? 1. : 0.};
  }
};
} // namespace nelyx::semantics_geometry
