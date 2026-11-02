// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstddef>
#include <span>
#include <vector>

namespace nelyx::scene_packet {
inline constexpr double magic = 0x4e4c444c, pathMagic = 0x4e4c5054;
inline constexpr size_t version = 2, headerWords = 16,
                        maxWords = 2 * 1024 * 1024;
inline constexpr size_t maxEntries = 65536, maxPathOperations = 4096;
struct Operation {
  size_t verb;
  std::vector<double> values;
};
struct Path {
  size_t fill;
  std::vector<Operation> operations;
};
struct Paint {
  double color, aa, style, width, miter, cap, join, blend;
};
struct Tables {
  size_t commandOffset = 0;
  std::vector<Path> paths;
  std::vector<Paint> paints;
};
size_t integer(double value, size_t maximum);
Path readPath(std::span<const double> words, size_t &at);
Path readPathPacket(std::span<const double> words);
Tables readTables(std::span<const double> words, size_t handles);
} // namespace nelyx::scene_packet
