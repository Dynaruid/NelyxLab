// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/scene_packet.h"
#include <array>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace nelyx::scene_packet {
namespace {
[[noreturn]] void reject() {
  throw std::invalid_argument("Invalid native scene2 numeric table");
}
void scalar(double value) {
  if (!std::isfinite(value) ||
      std::abs(value) > std::numeric_limits<float>::max())
    reject();
}
} // namespace
size_t integer(double value, size_t maximum) {
  if (!std::isfinite(value) || value < 0 || value > double(maximum) ||
      std::floor(value) != value)
    reject();
  return static_cast<size_t>(value);
}
Path readPath(std::span<const double> words, size_t &at) {
  if (at > words.size() || words.size() - at < 3)
    reject();
  Path path{integer(words[at], 1), {}};
  const auto count = integer(words[at + 1], maxPathOperations),
             length = integer(words[at + 2], maxWords);
  at += 3;
  if (length > words.size() - at)
    reject();
  const auto end = at + length;
  constexpr std::array<size_t, 14> arity{2, 2, 2, 2, 4, 4, 6,
                                         6, 5, 5, 0, 4, 4, 12};
  // Check the count against the available minimum record size before
  // allocation.
  if (count > (end - at) / 2)
    reject();
  path.operations.reserve(count);
  for (size_t i = 0; i < count; ++i) {
    if (end - at < 2)
      reject();
    const auto verb = integer(words[at++], arity.size() - 1),
               n = integer(words[at++], 12);
    if (n != arity[verb] || n > end - at)
      reject();
    for (size_t j = 0; j < n; ++j)
      scalar(words[at + j]);
    if (verb >= 11) {
      if (words[at + 2] < words[at] || words[at + 3] < words[at + 1])
        reject();
      if (verb == 13)
        for (size_t j = 4; j < 12; ++j)
          if (words[at + j] < 0)
            reject();
    }
    path.operations.push_back(
        {verb, {words.begin() + at, words.begin() + at + n}});
    at += n;
  }
  if (at != end)
    reject();
  return path;
}
Path readPathPacket(std::span<const double> words) {
  if (words.size() < 5 || words.size() > maxWords || words[0] != pathMagic ||
      words[1] != 1)
    reject();
  size_t at = 2;
  auto path = readPath(words, at);
  if (at != words.size())
    reject();
  return path;
}
Tables readTables(std::span<const double> words, size_t handles) {
  if (words.size() < headerWords || words.size() > maxWords ||
      words[0] != magic || words[1] != version || words[4] != words.size() ||
      words[3] != handles)
    reject();
  integer(words[2], maxEntries);
  integer(words[3], maxEntries);
  const auto paths = integer(words[5], maxEntries),
             paints = integer(words[6], maxEntries),
             end = integer(words[7], words.size());
  if (end < headerWords || paths > (end - headerWords) / 3 ||
      paints > (end - headerWords) / 8)
    reject();
  // Frame identity is diagnostic/fencing metadata. The recording's native owner
  // and Core resource admission remain authoritative for handles and
  // submission.
  for (size_t i = 8; i < 14; ++i) {
    if (words[i] != -1)
      integer(words[i], 9007199254740991ULL);
  }
  if (!std::isfinite(words[14]) || words[14] <= 0 || words[15] != 0)
    reject();
  Tables result;
  size_t at = headerWords;
  result.paths.reserve(paths);
  result.paints.reserve(paints);
  for (size_t i = 0; i < paths; ++i)
    result.paths.push_back(readPath(words.first(end), at));
  for (size_t i = 0; i < paints; ++i) {
    if (end - at < 8)
      reject();
    const auto *p = words.data() + at;
    integer(p[0], 4294967295ULL);
    integer(p[1], 1);
    integer(p[2], 1);
    scalar(p[3]);
    scalar(p[4]);
    integer(p[5], 2);
    integer(p[6], 2);
    integer(p[7], 28);
    if (p[3] < 0 || p[4] < 0 || p[4] > 2147483647)
      reject();
    result.paints.push_back({p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]});
    at += 8;
  }
  if (at != end)
    reject();
  result.commandOffset = end;
  return result;
}
} // namespace nelyx::scene_packet
