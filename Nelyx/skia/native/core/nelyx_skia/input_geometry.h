// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace nelyx::input_geometry {
inline constexpr double magic = 0x4e4c4947;
inline constexpr double resultMagic = 0x4e4c494f;
inline constexpr double version = 1;
inline constexpr std::size_t headerWords = 16, nodeWords = 24, editorWords = 12,
                             resultWords = 35;
inline constexpr std::size_t maxBytes = 4 * 1024 * 1024, maxNodes = 8192,
                             maxEditors = 256, maxSelections = 16384,
                             maxEditorSelections = 4096, maxDepth = 128;

// All storage is caller/native-owned. No VM, graphics or OS types cross here.
// Header: magic, version, session, ownerGeneration, revision, viewport,
// surface (-1 absent), scale, width, height, nodes, editors, selections, words,
// diagnostics (0/1), reserved (0). Diagnostic results use the last two lanes
// for copy/validation and kernel milliseconds. Counts are checked before cast.
struct Owner {
  double session;
  double generation;
};
std::vector<double> evaluate(std::span<const double> packet, Owner owner);

// Explicit session close is independent of a VM finalizer. Revisions advance
// only after a fully validated calculation succeeds; failed input is atomic.
class Session {
public:
  explicit Session(Owner owner);
  std::vector<double> evaluate(std::span<const double> packet);
  bool isCurrent(double revision) const noexcept { return !closed_ && revision_ == revision; }
  void close() noexcept { closed_ = true; }
private:
  Owner owner_;
  double revision_ = 0;
  bool closed_ = false;
};
}
