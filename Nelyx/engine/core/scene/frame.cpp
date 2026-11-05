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
  std::function<void(const Node&,double,double,double,Rect)> visit;
  visit = [&](const Node& n, double x, double y, double alpha, Rect clip) {
    const auto& o = f.properties[n.id.slot];
    x += n.properties.x; y += n.properties.y; alpha *= o.opacity;
    f.properties[n.id.slot].visible=alpha>0;
    if (n.kind == wire::kinds::clip || n.kind == wire::kinds::scrollViewport)
      clip = intersect(clip, {x, y, n.properties.width, n.properties.height});
    f.items.push_back({n.id, x, y, alpha, clip});
    if((n.policy&4u)&&alpha>0)f.modalRoot=n.id;
    double childX = x, childY = y;
    if (n.kind == wire::kinds::scrollViewport) {
      if (n.properties.flags & 1u) childX -= o.offset; else childY -= o.offset;
    }
    for (const auto child : d.children[n.id.slot]) visit(d.get(child), childX, childY, alpha, clip);
  };
  f.items.reserve(d.count);
  for (const auto n : d.children[0]) visit(d.get(n), 0, 0, 1, {0, 0, f.scene->metrics.width, f.scene->metrics.height});
}
Handle View::target(double x, double y) const {
  if (!published) return {};
  const auto& d = *published->scene->document;
  for (auto it = published->items.rbegin(); it != published->items.rend(); ++it) {
    const auto& n = d.get(it->node);
    if(it->opacity<=0||!published->allows(n.id))continue;
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
