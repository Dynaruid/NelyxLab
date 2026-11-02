// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstddef>
#include <span>
#include <vector>
namespace nelyx::scene_composition {
inline constexpr size_t maxBytes = 4 * 1024 * 1024, maxNodes = 8192,
                        maxDepth = 128, maxCommands = 4096;
inline constexpr double magic = 0x4e4c5343, resultMagic = 0x4e4c534f;
struct Insertion {
  double child;
  size_t mark;
};
struct Node {
  double id;
  bool scoped;
  size_t commands;
  std::vector<Insertion> children;
};
class Session {
  double owner_, generation_, revision_ = 0, pending_ = 0;
  bool closed_ = false;
  std::vector<Node> committed_, staged_;
  size_t peak_ = 0;

public:
  Session(double owner, double generation);
  std::vector<double> prepare(std::span<const double> packet);
  void commit(double revision);
  void discard(double revision);
  void close();
  size_t retainedBytes() const;
  bool current(double revision) const {
    return !closed_ && pending_ == revision;
  }
  std::vector<double> stats() const;
};
} // namespace nelyx::scene_composition
