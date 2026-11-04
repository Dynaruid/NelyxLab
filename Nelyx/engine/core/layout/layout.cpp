// SPDX-License-Identifier: BSD-3-Clause
#include "layout.hpp"
#include <algorithm>
#include "../interaction/editing.hpp"

namespace nelyx::v2 {
namespace {
double scalar(double value) {
  require(std::isfinite(value) && std::abs(value) <= 1e12, wire::statuses::invalidValue);
  return value;
}
double constrain(double value, double minimum, double maximum) {
  return scalar(std::clamp(value, minimum, maximum));
}
void local(Axis axis, double &minimum, double &maximum) {
  if (axis.tag == wire::bounds::expand) {
    require(std::isfinite(maximum), wire::statuses::invalidValue);
    minimum = maximum;
  } else {
    minimum = std::max(minimum, axis.min);
    if (axis.tag == wire::bounds::finite)
      maximum = std::min(maximum, axis.max);
    require(minimum <= maximum, wire::statuses::invalidValue);
  }
}
LayoutConstraints resolve(const Node &n, LayoutConstraints c) {
  local(n.horizontal, c.minWidth, c.maxWidth);
  local(n.vertical, c.minHeight, c.maxHeight);
  if (n.properties.width > 0)
    c.minWidth = c.maxWidth = constrain(n.properties.width, c.minWidth, c.maxWidth);
  if (n.properties.height > 0)
    c.minHeight = c.maxHeight = constrain(n.properties.height, c.minHeight, c.maxHeight);
  return c;
}
double inset(double value, double padding) { return std::max(0.0, value - padding); }
bool horizontal(const Node &n) { return n.layout.direction == 0; }
bool flow(const Node &n) { return n.kind == wire::kinds::flex || n.kind == wire::kinds::sliver; }
double main(const LayoutBox &b, bool h) { return h ? b.width : b.height; }
double cross(const LayoutBox &b, bool h) { return h ? b.height : b.width; }
void position(Placement &p, bool h, double a, double b) {
  p.x = h ? a : b;
  p.y = h ? b : a;
}
} // namespace
struct LayoutWork::State {
  struct Task {
    Handle node;
    LayoutConstraints input, constraints;
    uint32_t phase = 0;
    size_t index = 0, parentIndex = 0;
    std::shared_ptr<LayoutBox> box;
    double innerWidth = 0, innerHeight = 0, totalFlex = 0, flexSpace = 0;
  };
  struct Flatten {
    std::shared_ptr<const LayoutBox> box;
    double x = 0, y = 0;
  };
  Lease lease;
  std::shared_ptr<const Document> source;
  std::shared_ptr<Document> derived;
  std::shared_ptr<const LayoutOutput> previous;
  std::shared_ptr<LayoutOutput> result;
  LayoutConstraints viewport;
  std::vector<Task> stack;
  std::vector<Flatten> flatten;
  std::vector<std::shared_ptr<const LayoutBox>> roots;
  std::optional<MeasurementRequest> pending;
  std::optional<Measurement> measurement;
  size_t root = 0;
  Handle queryRoot;
  bool flattening = false, complete = false;
  uint64_t operations = 0, reused = 0, requestId = 0;
  State(std::shared_ptr<const Document> d, double width, double height, double scale, uint64_t font,
        std::shared_ptr<const LayoutOutput> old)
      : lease(d->lease.ledger,
              sizeof(State) + (wire::limits::depth + 1) * sizeof(Task) +
                  (wire::limits::nodes + 1) * (sizeof(Flatten) + sizeof(roots[0]))),
        source(std::move(d)), previous(std::move(old)),
        result(std::make_shared<LayoutOutput>(source->lease.ledger, scale, font)),
        viewport{0, width, 0, height} {
    stack.reserve(wire::limits::depth + 1);
    flatten.reserve(source->count);
    roots.reserve(source->children[0].size());
    if (previous && (previous->scale != scale || previous->fontRevision != font))
      previous.reset();
  }
  void push(Handle h, LayoutConstraints c, size_t index = 0) {
    require(stack.size() <= wire::limits::depth, wire::statuses::invalidGraph);
    Task t;
    t.node = h;
    t.input = c;
    t.parentIndex = index;
    stack.push_back(std::move(t));
  }
  void done(std::shared_ptr<const LayoutBox> box) {
    const auto index = stack.back().parentIndex;
    stack.pop_back();
    if (stack.empty())
      roots.push_back(std::move(box));
    else
      stack.back().box->children[index].box = std::move(box);
  }
  LayoutConstraints childConstraints(const Node &n, const Task &t, const Node &child, bool flex) {
    LayoutConstraints c{0, t.innerWidth, 0, t.innerHeight};
    const auto &s = n.layout;
    const bool h = horizontal(n);
    if (!s.enabled)
      return c;
    if (flow(n)) {
      double maximum = INFINITY, minimum = 0;
      if (flex) {
        maximum = scalar(t.flexSpace * child.layout.flex / t.totalFlex);
        if (child.layout.fit == 0)
          minimum = maximum;
      }
      if (h) {
        c.minWidth = minimum;
        c.maxWidth = maximum;
      } else {
        c.minHeight = minimum;
        c.maxHeight = maximum;
      }
    } else if (n.kind == wire::kinds::scrollViewport) {
      if (n.properties.flags & 1u)
        c.maxWidth = INFINITY;
      else
        c.maxHeight = INFINITY;
    } else if (n.kind == wire::kinds::grid) {
      require(std::isfinite(t.innerWidth), wire::statuses::invalidValue);
      const double cell = scalar(std::max(0.0, t.innerWidth - s.gap * (s.columns - 1)) / s.columns);
      c.minWidth = c.maxWidth = cell;
      c.maxHeight = INFINITY;
    }
    if (s.crossAlign == wire::layoutCrossAlign::stretch && flow(n)) {
      if (h) {
        require(std::isfinite(c.maxHeight), wire::statuses::invalidValue);
        c.minHeight = c.maxHeight;
      } else {
        require(std::isfinite(c.maxWidth), wire::statuses::invalidValue);
        c.minWidth = c.maxWidth;
      }
    }
    return c;
  }
  void finish(Task &t, const Node &n) {
    auto &b = *t.box;
    const auto &s = n.layout;
    const auto &c = t.constraints;
    const bool h = horizontal(n);
    double width = 0, height = 0;
    if (!s.enabled) {
      b.width = n.properties.width;
      b.height = n.properties.height;
      return;
    }
    if (flow(n)) {
      double length = 0, breadth = 0, ascent = 0, descent = 0;
      for (const auto &child : b.children) {
        length = scalar(length + main(*child.box, h));
        breadth = std::max(breadth, cross(*child.box, h));
        if (s.crossAlign == wire::layoutCrossAlign::baseline) {
          require(h && child.box->baseline >= 0, wire::statuses::invalidValue);
          ascent = std::max(ascent, child.box->baseline);
          descent = std::max(descent, child.box->height - child.box->baseline);
        }
      }
      if (!b.children.empty())
        length = scalar(length + s.gap * (b.children.size() - 1));
      if (s.crossAlign == wire::layoutCrossAlign::baseline)
        breadth = ascent + descent;
      const double available = h ? t.innerWidth : t.innerHeight;
      if (s.mainSize) {
        require(std::isfinite(available), wire::statuses::invalidValue);
        length = std::max(length, available);
      }
      width = h ? length : breadth;
      height = h ? breadth : length;
      b.width = constrain(width + s.left + s.right, c.minWidth, c.maxWidth);
      b.height = constrain(height + s.top + s.bottom, c.minHeight, c.maxHeight);
      const double finalMain =
          inset(h ? b.width : b.height, h ? s.left + s.right : s.top + s.bottom);
      const double finalCross =
          inset(h ? b.height : b.width, h ? s.top + s.bottom : s.left + s.right);
      double used = 0;
      for (const auto &child : b.children)
        used += main(*child.box, h);
      const auto count = b.children.size();
      const double free = std::max(0.0, finalMain - used - (count ? (count - 1) * s.gap : 0));
      double lead = 0, gap = s.gap;
      if (s.mainAlign == 1)
        lead = free / 2;
      if (s.mainAlign == 2)
        lead = free;
      if (s.mainAlign == 3 && count > 1)
        gap += free / (count - 1);
      if (s.mainAlign == 4 && count) {
        gap += free / count;
        lead = free / count / 2;
      }
      if (s.mainAlign == 5 && count) {
        gap += free / (count + 1);
        lead = free / (count + 1);
      }
      for (auto &child : b.children) {
        double offset = 0;
        if (s.crossAlign == 1)
          offset = (finalCross - cross(*child.box, h)) / 2;
        if (s.crossAlign == 2)
          offset = finalCross - cross(*child.box, h);
        if (s.crossAlign == 4)
          offset = ascent - child.box->baseline;
        position(child, h, lead, offset);
        lead += main(*child.box, h) + gap;
      }
    } else if (n.kind == wire::kinds::wrap) {
      require(s.crossAlign <= wire::layoutCrossAlign::end, wire::statuses::capabilityMissing);
      const double limit = h ? t.innerWidth : t.innerHeight;
      double cursor = 0, line = 0, across = 0, longest = 0;
      size_t start = 0, count = 0;
      struct Run {
        size_t begin, end;
        double length, breadth;
      };
      std::vector<Run> runs;
      for (size_t i = 0; i < b.children.size(); ++i) {
        auto &child = b.children[i];
        const auto length = main(*child.box, h), breadth = cross(*child.box, h);
        if (count && cursor + s.gap + length > limit) {
          runs.push_back({start, i, cursor, line});
          start = i;
          count = 0;
          across = scalar(across + line + s.runGap);
          cursor = 0;
          line = 0;
        }
        if (count++)
          cursor += s.gap;
        position(child, h, cursor, across);
        cursor = scalar(cursor + length);
        longest = std::max(longest, cursor);
        line = std::max(line, breadth);
      }
      if (count)
        runs.push_back({start, b.children.size(), cursor, line});
      if (s.mainSize) {
        require(std::isfinite(limit), wire::statuses::invalidValue);
        longest = std::max(longest, limit);
      }
      width = h ? longest : across + line;
      height = h ? across + line : longest;
      const double actualMain =
          inset(h ? constrain(width + s.left + s.right, c.minWidth, c.maxWidth)
                  : constrain(height + s.top + s.bottom, c.minHeight, c.maxHeight),
                h ? s.left + s.right : s.top + s.bottom);
      double runOffset = 0;
      for (const auto &run : runs) {
        const size_t length = run.end - run.begin;
        const double free = std::max(0.0, actualMain - run.length);
        double lead = 0, gap = s.gap;
        if (s.mainAlign == 1)
          lead = free / 2;
        if (s.mainAlign == 2)
          lead = free;
        if (s.mainAlign == 3 && length > 1)
          gap += free / (length - 1);
        if (s.mainAlign == 4) {
          gap += free / length;
          lead = free / length / 2;
        }
        if (s.mainAlign == 5) {
          gap += free / (length + 1);
          lead = free / (length + 1);
        }
        for (size_t i = run.begin; i < run.end; ++i) {
          auto &child = b.children[i];
          const double offset = s.crossAlign == 1   ? (run.breadth - cross(*child.box, h)) / 2
                                : s.crossAlign == 2 ? run.breadth - cross(*child.box, h)
                                                    : 0;
          position(child, h, lead, runOffset + offset);
          lead += main(*child.box, h) + gap;
        }
        runOffset += run.breadth + s.runGap;
      }
    } else if (n.kind == wire::kinds::grid) {
      require(s.crossAlign <= wire::layoutCrossAlign::end, wire::statuses::capabilityMissing);
      double y = 0, rowHeight = 0;
      const double cell = std::max(0.0, t.innerWidth - s.gap * (s.columns - 1)) / s.columns;
      for (size_t i = 0; i < b.children.size(); ++i) {
        if (i && i % s.columns == 0) {
          y = scalar(y + rowHeight + s.runGap);
          rowHeight = 0;
        }
        b.children[i].x = (i % s.columns) * (cell + s.gap);
        b.children[i].y = y;
        rowHeight = std::max(rowHeight, b.children[i].box->height);
      }
      width = t.innerWidth;
      height = y + rowHeight;
      for (size_t begin = 0; begin < b.children.size(); begin += s.columns) {
        const size_t end = std::min(b.children.size(), begin + s.columns);
        double maximum = 0;
        for (size_t i = begin; i < end; ++i)
          maximum = std::max(maximum, b.children[i].box->height);
        for (size_t i = begin; i < end; ++i)
          b.children[i].y += (maximum - b.children[i].box->height) * (s.crossAlign == 1   ? 0.5
                                                                      : s.crossAlign == 2 ? 1
                                                                                          : 0);
      }
    } else {
      for (const auto &child : b.children) {
        const auto &original = source->get(child.box->node).properties;
        width = std::max(width, original.x + child.box->width);
        height = std::max(height, original.y + child.box->height);
      }
      if (n.kind == wire::kinds::scrollViewport) {
        require(std::isfinite(t.innerWidth) && std::isfinite(t.innerHeight),
                wire::statuses::invalidValue);
        width = t.innerWidth;
        height = t.innerHeight;
      }
    }
    if (!flow(n)) {
      b.width = constrain(width + s.left + s.right, c.minWidth, c.maxWidth);
      b.height = constrain(height + s.top + s.bottom, c.minHeight, c.maxHeight);
    }
    for (auto &child : b.children) {
      child.x = scalar(child.x + s.left);
      child.y = scalar(child.y + s.top);
      if (b.baseline < 0 && child.box->baseline >= 0)
        b.baseline = child.y + child.box->baseline;
    }
  }
  void advance() {
    if (flattening) {
      if (flatten.empty()) {
        complete = true;
        return;
      }
      const auto f = flatten.back();
      flatten.pop_back();
      const auto &original = source->get(f.box->node);
      auto n = std::make_shared<Node>(original);
      n->properties.x = scalar(n->properties.x + f.x);
      n->properties.y = scalar(n->properties.y + f.y);
      n->properties.width = f.box->width;
      n->properties.height = f.box->height;
      n->baseline = f.box->baseline;
      n->textGeometry = f.box->textGeometry;
      if (n->layout.enabled && n->kind == wire::kinds::scrollViewport && !f.box->children.empty() &&
          n->properties.extent != wire::extents::unbounded) {
        const auto &child = *f.box->children[0].box;
        n->properties.minimum = 0;
        const auto &childSource = source->get(child.node).properties;
        const auto &childPlacement = f.box->children[0];
        n->properties.maximum = scalar(std::max(
            0.0, (n->properties.flags & 1u) ? child.width + childPlacement.x + childSource.x +
                                                  n->layout.right - n->properties.width
                                            : child.height + childPlacement.y + childSource.y +
                                                  n->layout.bottom - n->properties.height));
      }
      derived->nodes[n->id.slot].value = n;
      result->boxes[n->id.slot] = f.box;
      for (const auto &child : f.box->children)
        flatten.push_back({child.box, child.x, child.y});
      return;
    }
    if (stack.empty()) {
      if (queryRoot && root == 0) {
        ++root;
        push(queryRoot, viewport);
        return;
      }
      if (!queryRoot && root < source->children[0].size()) {
        push(source->children[0][root++], viewport);
        return;
      }
      derived = std::make_shared<Document>(*source);
      for (const auto &box : roots)
        flatten.push_back({box});
      flattening = true;
      return;
    }
    auto &t = stack.back();
    const auto &n = source->get(t.node);
    const auto &children = source->children[n.id.slot];
    if (t.phase == 0) {
      if (previous) {
        const auto &cached = previous->boxes[n.id.slot];
        if (cached && cached->node == n.id && cached->revision == n.layoutRevision &&
            cached->editSerial == n.editSerial && cached->input == t.input) {
          ++reused;
          done(cached);
          return;
        }
      }
      t.constraints = n.layout.enabled ? resolve(n, t.input) : t.input;
      t.box = std::make_shared<LayoutBox>(n, t.input, children.size());
      const auto &s = n.layout;
      if (s.enabled && !flow(n) && n.kind != wire::kinds::wrap && n.kind != wire::kinds::grid)
        require(s.mainAlign == 0 && s.crossAlign == 0 && s.mainSize == 0,
                wire::statuses::capabilityMissing);
      if (s.enabled && (n.kind == wire::kinds::paragraph || n.kind == wire::kinds::editable ||
                        n.kind == wire::kinds::image))
        require(s.left == 0 && s.top == 0 && s.right == 0 && s.bottom == 0,
                wire::statuses::capabilityMissing);
      if (s.enabled && n.kind == wire::kinds::grid)
        require(s.mainAlign == 0 && s.mainSize == 0, wire::statuses::capabilityMissing);
      t.innerWidth = inset(n.layout.enabled ? t.constraints.maxWidth : n.properties.width,
                           s.enabled ? s.left + s.right : 0);
      t.innerHeight = inset(n.layout.enabled ? t.constraints.maxHeight : n.properties.height,
                            s.enabled ? s.top + s.bottom : 0);
      if (n.layout.enabled && (n.kind == wire::kinds::paragraph ||
                               n.kind == wire::kinds::editable || n.kind == wire::kinds::image)) {
        require(children.empty(), wire::statuses::invalidGraph);
        require(n.kind != wire::kinds::image || bool(n.resource), wire::statuses::invalidHandle);
        pending = MeasurementRequest{++requestId, source->nodes[n.id.slot].value,
                                     t.constraints.maxWidth, std::isfinite(t.constraints.maxWidth)};
        if (!pending->bounded)
          pending->width = 0;
        t.phase = 5;
        return;
      }
      t.phase = 1;
      return;
    }
    if (t.phase == 5) {
      if (!measurement)
        return;
      const auto m = *measurement;
      measurement.reset();
      pending.reset();
      if (n.kind == wire::kinds::paragraph || n.kind == wire::kinds::editable) {
        t.box->width = constrain(m.width, t.constraints.minWidth, t.constraints.maxWidth);
        require(t.box->width == m.width, wire::statuses::invalidValue);
        t.box->height = constrain(m.height, t.constraints.minHeight, t.constraints.maxHeight);
        t.box->baseline = m.baseline;
        if (n.kind == wire::kinds::editable) {
          require(n.editing && m.geometry && m.geometry->revision == n.editing->revision,
                  wire::statuses::stale);
          t.box->textGeometry = m.geometry;
        }
      } else {
        require(m.width > 0 && m.height > 0, wire::statuses::invalidValue);
        double width = n.properties.width > 0 ? n.properties.width : m.width;
        double height = n.properties.height > 0 ? n.properties.height : m.height;
        if (n.properties.width > 0 && !n.properties.height)
          height = width * m.height / m.width;
        if (n.properties.height > 0 && !n.properties.width)
          width = height * m.width / m.height;
        t.box->width = constrain(width, t.constraints.minWidth, t.constraints.maxWidth);
        t.box->height = constrain(height, t.constraints.minHeight, t.constraints.maxHeight);
      }
      done(t.box);
      return;
    }
    if (t.phase == 1 || t.phase == 3) {
      while (t.index < children.size()) {
        const auto index = t.index++;
        const auto &child = source->get(children[index]);
        const bool flexible = n.layout.enabled && flow(n) && child.layout.flex > 0;
        if (flexible != (t.phase == 3))
          continue;
        auto c = childConstraints(n, t, child, flexible);
        push(child.id, c, index);
        return;
      }
      if (t.phase == 1) {
        t.totalFlex = 0;
        double used = children.empty() ? 0 : n.layout.gap * (children.size() - 1);
        for (size_t i = 0; i < children.size(); ++i) {
          const auto &child = source->get(children[i]);
          if (n.layout.enabled && flow(n) && child.layout.flex > 0)
            t.totalFlex += child.layout.flex;
          else if (t.box->children[i].box)
            used += main(*t.box->children[i].box, horizontal(n));
        }
        if (t.totalFlex > 0) {
          const double space = horizontal(n) ? t.innerWidth : t.innerHeight;
          require(std::isfinite(space), wire::statuses::invalidValue);
          t.flexSpace = std::max(0.0, space - scalar(used));
        }
        t.phase = 3;
        t.index = 0;
        return;
      }
      finish(t, n);
      done(t.box);
    }
  }
};
LayoutWork::LayoutWork(std::shared_ptr<const Document> d, double width, double height, double scale,
                       uint64_t font, std::shared_ptr<const LayoutOutput> previous)
    : state_(
          std::make_unique<State>(std::move(d), width, height, scale, font, std::move(previous))) {}
LayoutWork::~LayoutWork() = default;
LayoutWork::LayoutWork(std::shared_ptr<const Document> d, Handle root,
                       LayoutConstraints constraints, double scale, uint64_t font)
    : state_(std::make_unique<State>(std::move(d), 0, 0, scale, font, nullptr)) {
  state_->source->get(root);
  state_->queryRoot = root;
  state_->viewport = constraints;
}
bool LayoutWork::step(uint32_t quota) {
  auto &s = *state_;
  while (quota-- && !s.complete && !waiting()) {
    require(++s.operations <= wire::limits::layoutOperations, wire::statuses::budgetExceeded);
    s.advance();
  }
  return s.complete;
}
bool LayoutWork::waiting() const { return state_->pending && !state_->measurement; }
const std::optional<MeasurementRequest> &LayoutWork::request() const { return state_->pending; }
void LayoutWork::measured(uint64_t id, Handle node, Measurement value) {
  auto &s = *state_;
  require(s.pending && !s.measurement && s.pending->id == id && s.pending->node->id == node,
          wire::statuses::stale);
  scalar(value.width);
  scalar(value.height);
  scalar(value.minimum);
  scalar(value.maximum);
  scalar(value.baseline);
  require(value.width >= 0 && value.height >= 0 && value.minimum >= 0 &&
              value.maximum >= value.minimum && value.baseline >= -1 &&
              ((s.pending->node->kind != wire::kinds::paragraph &&
                s.pending->node->kind != wire::kinds::editable) ||
               (value.baseline >= 0 && (!s.pending->bounded || value.width == s.pending->width))),
          wire::statuses::invalidValue);
  s.measurement = value;
}
std::shared_ptr<const Document> LayoutWork::document() const {
  require(state_->complete, wire::statuses::pending);
  return state_->derived;
}
std::shared_ptr<const LayoutOutput> LayoutWork::output() const {
  require(state_->complete, wire::statuses::pending);
  return state_->result;
}
uint64_t LayoutWork::work() const { return state_->operations; }
uint64_t LayoutWork::reused() const { return state_->reused; }
} // namespace nelyx::v2
