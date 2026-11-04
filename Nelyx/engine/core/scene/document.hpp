// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../protocol/wire.hpp"
#include <array>
#include <memory>
#include <atomic>
#include <string>

namespace nelyx::v2 {
struct Ledger {
  std::atomic<uint64_t> bytes{0}, resourceBytes{0}, nodes{0};
  uint32_t queuedInputs = 0, updateInputs = 0, activeViews = 0;
};
struct Lease {
  std::shared_ptr<Ledger> ledger;
  uint64_t bytes;
  bool resource;
  Lease(std::shared_ptr<Ledger> owner, uint64_t count, bool isResource = false)
      : ledger(std::move(owner)), bytes(count), resource(isResource) {
    const auto reserve = [](std::atomic<uint64_t>& used, uint64_t amount, uint64_t limit) {
      auto value = used.load();
      for (;;) {
        require(amount <= limit - value, wire::statuses::budgetExceeded);
        if (used.compare_exchange_weak(value, value + amount)) return;
      }
    };
    reserve(ledger->bytes, bytes, wire::limits::sessionBytes);
    if (resource) try { reserve(ledger->resourceBytes, bytes, wire::limits::resourceBytes); }
      catch (...) { ledger->bytes -= bytes; throw; }
  }
  ~Lease() { ledger->bytes -= bytes; if (resource) ledger->resourceBytes -= bytes; }
  Lease(const Lease&) = delete;
  Lease& operator=(const Lease&) = delete;
};
struct Resource {
  Lease lease;
  Handle id;
  std::vector<uint8_t> bytes;
  Resource(const std::shared_ptr<Ledger>& ledger, Handle h, Reader data)
      : lease(ledger, data.length + sizeof(Resource), true), id(h),
        bytes(data.data, data.data + data.length) {}
};
struct Properties {
  double x = 0, y = 0, width = 0, height = 0, opacity = 1;
  double minimum = 0, maximum = 0;
  uint32_t extent = wire::extents::finite, flags = 0;
};
struct Motion {
  uint64_t id = 0, baseRevision = 0;
  double target = 1, seconds = 0;
};
struct TextData {
  Lease lease;
  std::string value;
  TextData(const std::shared_ptr<Ledger>& owner, Reader data)
    : lease(owner, sizeof(TextData) + data.length),
      value(reinterpret_cast<const char*>(data.data), data.length) {}
};
struct Node {
  Lease lease;
  Handle id, parent;
  uint32_t kind = 0, order = 0, policy = 0;
  Properties properties;
  Axis horizontal, vertical;
  Motion motion;
  uint32_t color = 0;
  double radius = 0, fontSize = 18;
  std::shared_ptr<const TextData> text;
  std::shared_ptr<const Resource> resource;
  explicit Node(const std::shared_ptr<Ledger>& ledger) : lease(ledger, sizeof(Node)) {
    ++lease.ledger->nodes;
  }
  Node(const Node& n) : lease(n.lease.ledger, sizeof(Node)), id(n.id), parent(n.parent),
      kind(n.kind), order(n.order), policy(n.policy), properties(n.properties),
      horizontal(n.horizontal), vertical(n.vertical), motion(n.motion), color(n.color), radius(n.radius),
      fontSize(n.fontSize), text(n.text), resource(n.resource) {
    ++lease.ledger->nodes;
  }
  ~Node() { --lease.ledger->nodes; }
};
template<class T> struct Slot {
  uint32_t generation = 1;
  std::shared_ptr<const T> value;
};
struct Document {
  Lease lease;
  uint64_t epoch = 0;
  uint32_t count = 0;
  uint32_t highWater = 0;
  std::vector<Slot<Node>> nodes;
  explicit Document(const std::shared_ptr<Ledger>& ledger)
      : lease(ledger, sizeof(Document) + (wire::limits::nodes + 1) * sizeof(Slot<Node>)),
        nodes(wire::limits::nodes + 1) {}
  Document(const Document& d) : lease(d.lease.ledger, d.lease.bytes),
      epoch(d.epoch), count(d.count), highWater(d.highWater), nodes(d.nodes) {}
  const Node& get(Handle h) const {
    require(h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h, wire::statuses::invalidHandle);
    return *nodes[h.slot].value;
  }
  bool contains(Handle h) const {
    return h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h;
  }
};
using Resources = std::array<Slot<Resource>, wire::limits::resources + 1>;
struct Installed {
  std::shared_ptr<const Document> document;
  Resources resources;
};
Installed transact(const std::shared_ptr<const Document>&, const Resources&, Reader, uint32_t);
}
