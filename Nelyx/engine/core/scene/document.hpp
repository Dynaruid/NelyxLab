// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include "../layout/list.hpp"
#include "../interaction/controls.hpp"
#include "geometry.hpp"
#include <array>
#include <memory>
#include <atomic>
#include <string>

namespace nelyx::v2 {
struct EditingValue;
struct TextGeometry;
struct SemanticData;
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
struct LayoutStyle {
  uint32_t enabled = 0, direction = 0, mainSize = 0, mainAlign = 0, crossAlign = 0, fit = 0, columns = 2;
  double flex = 0, gap = 0, runGap = 0, left = 0, top = 0, right = 0, bottom = 0;
};
struct Coverage { uint64_t revision = 0; double minimum = 0, maximum = 0; bool enabled = false; };
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
  GraphicsStyle graphics;
  Axis horizontal, vertical;
  Motion motion;
  LayoutStyle layout;
  Coverage coverage;
  ListStyle list;
  ListItem item;
  uint32_t gestures=0;
  ControlStyle control;
  std::shared_ptr<const ListGeometry> listGeometry;
  uint64_t layoutRevision = 0;
  double baseline = -1;
  double contentX = 0, contentY = 0, contentWidth = 0, contentHeight = 0;
  uint64_t editSerial=0;
  uint32_t editFlags=0,maximumLength=wire::limits::textBytes;
  std::shared_ptr<const EditingValue> editing;
  std::shared_ptr<const TextGeometry> textGeometry;
  std::shared_ptr<const SemanticData> semantics;
  uint32_t color = 0;
  uint32_t textDirection = 0;
  double radius = 0, fontSize = 18;
  std::shared_ptr<const TextData> text;
  std::shared_ptr<const Resource> resource;
  explicit Node(const std::shared_ptr<Ledger>& ledger) : lease(ledger, sizeof(Node)) {
    ++lease.ledger->nodes;
  }
  Node(const Node& n) : lease(n.lease.ledger, sizeof(Node)), id(n.id), parent(n.parent),
      kind(n.kind), order(n.order), policy(n.policy), properties(n.properties), graphics(n.graphics),
      horizontal(n.horizontal), vertical(n.vertical), motion(n.motion), layout(n.layout), coverage(n.coverage),
      list(n.list), item(n.item), gestures(n.gestures), control(n.control), listGeometry(n.listGeometry),
      layoutRevision(n.layoutRevision), baseline(n.baseline), contentX(n.contentX), contentY(n.contentY),
      contentWidth(n.contentWidth), contentHeight(n.contentHeight), editSerial(n.editSerial),editFlags(n.editFlags),maximumLength(n.maximumLength),
      editing(n.editing),textGeometry(n.textGeometry),semantics(n.semantics),color(n.color), textDirection(n.textDirection), radius(n.radius),
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
  std::vector<std::vector<Handle>> children;
  explicit Document(const std::shared_ptr<Ledger>& ledger)
      : lease(ledger, sizeof(Document) + (wire::limits::nodes + 1) *
          (sizeof(Slot<Node>) + sizeof(std::vector<Handle>) + 4 * sizeof(Handle))),
        nodes(wire::limits::nodes + 1), children(wire::limits::nodes + 1) {}
  Document(const Document& d) : lease(d.lease.ledger, d.lease.bytes),
      epoch(d.epoch), count(d.count), highWater(d.highWater), nodes(d.nodes), children(d.children) {}
  const Node& get(Handle h) const {
    require(h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h, wire::statuses::invalidHandle);
    return *nodes[h.slot].value;
  }
  bool contains(Handle h) const {
    return h.slot > 0 && h.slot < nodes.size() && nodes[h.slot].value &&
      nodes[h.slot].value->id == h;
  }
  bool descends(Handle child,Handle ancestor) const {
    for(uint32_t depth=0;child&&depth<=wire::limits::depth;++depth){if(child==ancestor)return true;
      if(!contains(child))return false;child=get(child).parent;}
    return false;
  }
};
using Resources = std::array<Slot<Resource>, wire::limits::resources + 1>;
struct Installed {
  std::shared_ptr<const Document> document;
  Resources resources;
};
Installed transact(const std::shared_ptr<const Document>&, const Resources&, Reader, uint32_t);
}
