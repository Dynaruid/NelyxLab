// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/scene_composition.h"
#include "nelyx_skia/scene_packet.h"
#include <algorithm>
#include <cmath>
#include <functional>
#include <stdexcept>
namespace nelyx::scene_composition {
namespace {
[[noreturn]] void reject() {
  throw std::invalid_argument(
      "Invalid/stale/oversize native Scene composition transaction");
}
double id(double v) {
  scene_packet::integer(v, 9007199254740991ULL);
  if (v == 0)
    reject();
  return v;
}
size_t bytes(const std::vector<Node> &nodes) {
  size_t n = nodes.capacity() * sizeof(Node);
  for (const auto &node : nodes)
    n += node.children.capacity() * sizeof(Insertion);
  return n;
}
void clear(std::vector<Node> &nodes) { std::vector<Node>{}.swap(nodes); }
auto find(std::vector<Node> &nodes, double value) {
  return std::lower_bound(nodes.begin(), nodes.end(), value,
                          [](const Node &n, double v) { return n.id < v; });
}
} // namespace
Session::Session(double owner, double generation)
    : owner_(id(owner)), generation_(id(generation)) {}
std::vector<double> Session::prepare(std::span<const double> p) {
  if (closed_ || pending_ || p.size() < 16 || p.size() * 8 > maxBytes ||
      p[0] != magic || p[1] != 1 || p[2] != owner_ || p[3] != generation_ ||
      p[4] <= revision_ || p[13] != p.size() || p[15] != 0)
    reject();
  id(p[4]);
  for (size_t i = 5; i < 9; ++i)
    if (p[i] != -1)
      scene_packet::integer(p[i], 9007199254740991ULL);
  if (!std::isfinite(p[9]) || p[9] <= 0)
    reject();
  const auto updates = scene_packet::integer(p[10], maxNodes),
             removes = scene_packet::integer(p[11], maxNodes);
  id(p[12]);
  scene_packet::integer(p[14], 1);
  // Header counts must fit their minimum representation before copying state.
  if (updates > (p.size() - 16) / 5 || removes > p.size() - 16)
    reject();
  const auto overhead =
      (updates + removes) * sizeof(double) + maxNodes * (sizeof(size_t) + 1) +
      2 * (16 + maxCommands * 3) * sizeof(double) + maxDepth * 128;
  const auto capacity = std::min(maxNodes, committed_.size() + updates);
  size_t copiedChildren = 0;
  for (const auto &node : committed_)
    copiedChildren += node.children.size() * sizeof(Insertion);
  if (bytes(committed_) + capacity * sizeof(Node) + copiedChildren +
          p.size() * 8 + overhead > maxBytes)
    reject();
  // Reserve the complete upper bound before copying. Repeated insert growth
  // would transiently retain both old/new node buffers outside the accounting.
  std::vector<Node> next;
  next.reserve(capacity);
  next.insert(next.end(), committed_.begin(), committed_.end());
  size_t at = 16;
  std::vector<double> touched;
  touched.reserve(updates + removes);
  auto touch = [&](double key) {
    auto it = std::lower_bound(touched.begin(), touched.end(), key);
    if (it != touched.end() && *it == key)
      reject();
    touched.insert(it, key);
  };
  for (size_t n = 0; n < updates; ++n) {
    if (p.size() - at < 5)
      reject();
    auto key = id(p[at++]);
    auto kind = scene_packet::integer(p[at++], 1);
    const bool scope = scene_packet::integer(p[at++], 1) != 0;
    const auto commands = scene_packet::integer(p[at++], maxCommands),
               children = scene_packet::integer(p[at++], maxNodes);
    if (children > (p.size() - at) / 2)
      reject();
    touch(key);
    auto old = find(next, key);
    const bool exists = old != next.end() && old->id == key;
    if (exists != (kind == 1))
      reject();
    if (bytes(committed_) + bytes(next) + p.size() * 8 + overhead +
            children * sizeof(Insertion) >
        maxBytes)
      reject();
    Node node{key, scope, commands, {}};
    node.children.reserve(children);
    size_t previous = 0;
    for (size_t i = 0; i < children; ++i) {
      auto mark = scene_packet::integer(p[at++], commands);
      auto child = id(p[at++]);
      if (mark < previous)
        reject();
      previous = mark;
      node.children.push_back({child, mark});
    }
    if (exists)
      *old = std::move(node);
    else {
      if (next.size() == maxNodes)
        reject();
      next.insert(old, std::move(node));
    }
    if (bytes(committed_) + bytes(next) + p.size() * 8 > maxBytes)
      reject();
  }
  if (removes > p.size() - at)
    reject();
  for (size_t n = 0; n < removes; ++n) {
    const auto key = id(p[at++]);
    touch(key);
    auto old = find(next, key);
    if (old == next.end() || old->id != key)
      reject();
    next.erase(old);
  }
  if (at != p.size())
    reject();
  // Validate the complete live graph, including unreachable retained
  // recordings.
  std::vector<unsigned char> colors(next.size(), 0);
  std::vector<size_t> depths(next.size(), 0);
  auto index = [&](double key) {
    auto it = find(next, key);
    if (it == next.end() || it->id != key)
      reject();
    return size_t(it - next.begin());
  };
  std::function<size_t(size_t, size_t)> visit = [&](size_t n, size_t level) {
    if (level > maxDepth || colors[n] == 1)
      reject();
    if (colors[n] == 2)
      return depths[n];
    colors[n] = 1;
    size_t depth = 1;
    for (const auto &child : next[n].children)
      depth = std::max(depth, 1 + visit(index(child.child), level + 1));
    if (depth > maxDepth)
      reject();
    colors[n] = 2;
    return depths[n] = depth;
  };
  for (size_t i = 0; i < next.size(); ++i)
    visit(i, 1);
  std::vector<double> output;
  output.reserve(16 + maxCommands * 3);
  output.assign(p.begin(), p.begin() + 16);
  output[0] = resultMagic;
  size_t commandCount = 0;
  auto append = [&](double key, size_t begin, size_t end) {
    if (output.size() + 3 > 16 + maxCommands * 3)
      reject();
    output.insert(output.end(), {key, double(begin), double(end)});
    commandCount += key == 0 ? 1 : end - begin;
    if (commandCount > maxCommands)
      reject();
  };
  std::function<void(size_t, bool)> emit = [&](size_t n, bool scope) {
    const auto &node = next[n];
    if (scope && node.scoped)
      append(0, 0, 0);
    size_t start = 0;
    for (const auto &child : node.children) {
      if (start < child.mark)
        append(node.id, start, child.mark);
      start = child.mark;
      emit(index(child.child), true);
    }
    if (start < node.commands)
      append(node.id, start, node.commands);
    if (scope && node.scoped)
      append(0, 1, 1);
  };
  emit(index(p[12]), p[14] != 0);
  output[13] = double(output.size());
  // Capacity accounting includes committed, staging, input and result at once;
  // no native picture/image/callback is stored in this service.
  const auto held = bytes(committed_) + bytes(next) + p.size() * 8 +
                    2 * output.capacity() * 8 + colors.capacity() +
                    depths.capacity() * sizeof(size_t) +
                    touched.capacity() * 8 + maxDepth * 128;
  if (held > maxBytes)
    reject();
  peak_ = std::max(peak_, held);
  staged_ = std::move(next);
  pending_ = p[4];
  revision_ = p[4];
  return output;
}
void Session::commit(double revision) {
  if (!current(revision))
    reject();
  committed_ = std::move(staged_);
  clear(staged_);
  pending_ = 0;
}
void Session::discard(double revision) {
  if (closed_)
    return;
  if (pending_ == revision) {
    clear(staged_);
    pending_ = 0;
  } else if (pending_ != 0)
    reject();
}
void Session::close() {
  closed_ = true;
  pending_ = 0;
  clear(committed_);
  clear(staged_);
}
size_t Session::retainedBytes() const {
  return bytes(committed_) + bytes(staged_);
}
std::vector<double> Session::stats() const {
  return {double(committed_.size()),
          double(staged_.size()),
          double(bytes(committed_)),
          double(bytes(staged_)),
          double(peak_),
          closed_ ? 1. : 0.};
}
} // namespace nelyx::scene_composition
