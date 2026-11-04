// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>

namespace nelyx::v2 {
static Rect intersect(Rect a, Rect b) {
  const auto x = std::max(a.x, b.x), y = std::max(a.y, b.y);
  return {x, y, std::max(0.0, std::min(a.x + a.width, b.x + b.width) - x),
    std::max(0.0, std::min(a.y + a.height, b.y + b.height) - y)};
}
void View::makeDrawItems(Frame& f) const {
  const auto& d = *f.scene->document;
  std::vector<std::vector<const Node*>> children(d.highWater + 1);
  for (const auto& slot : d.nodes) if (slot.value) children[slot.value->parent.slot].push_back(slot.value.get());
  for (auto& list : children) std::stable_sort(list.begin(), list.end(), [](const Node* a, const Node* b) {
    return a->order == b->order ? a->id.slot < b->id.slot : a->order < b->order;
  });
  std::function<void(const Node&,double,double,double,Rect)> visit;
  visit = [&](const Node& n, double x, double y, double alpha, Rect clip) {
    const auto& o = f.properties[n.id.slot];
    x += n.properties.x; y += n.properties.y; alpha *= o.opacity;
    if (n.kind == wire::kinds::clip || n.kind == wire::kinds::scrollViewport)
      clip = intersect(clip, {x, y, n.properties.width, n.properties.height});
    f.items.push_back({n.id, x, y, alpha, clip});
    double childX = x, childY = y;
    if (n.kind == wire::kinds::scrollViewport) {
      if (n.properties.flags & 1u) childX -= o.offset; else childY -= o.offset;
    }
    for (auto* child : children[n.id.slot]) visit(*child, childX, childY, alpha, clip);
  };
  f.items.reserve(d.count);
  for (auto* n : children[0]) visit(*n, 0, 0, 1, {0, 0, f.scene->metrics.width, f.scene->metrics.height});
}
Handle View::target(double x, double y) const {
  if (!published) return {};
  const auto& d = *published->scene->document;
  for (auto it = published->items.rbegin(); it != published->items.rend(); ++it) {
    const auto& n = d.get(it->node);
    const auto hit = [](double px, double py, Rect r) {
      return r.width > 0 && r.height > 0 && px >= r.x && py >= r.y && px < r.x+r.width && py < r.y+r.height;
    };
    if (!hit(x, y, it->clip) || !hit(x, y, {it->x,it->y,n.properties.width,n.properties.height})) continue;
    for (const Node* current = &n; current; current = current->parent ? &d.get(current->parent) : nullptr)
      if (current->kind == wire::kinds::scrollViewport) return current->id;
  }
  return {};
}
}
