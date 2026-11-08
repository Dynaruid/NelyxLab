// SPDX-License-Identifier: BSD-3-Clause
// Flex intrinsic allocation follows Flutter's rendering/flex.dart (BSD-3-Clause).
#include "query.hpp"
#include <algorithm>

namespace nelyx::v2 {
namespace {
double finiteSize(double v) {
  require(std::isfinite(v) && v >= 0 && v <= 1e12, wire::statuses::invalidValue);
  return v;
}
bool widthQuery(uint32_t mode) {
  return mode == wire::layoutQueries::minWidth || mode == wire::layoutQueries::maxWidth;
}
bool minimumQuery(uint32_t mode) {
  return mode == wire::layoutQueries::minWidth || mode == wire::layoutQueries::minHeight;
}
double bounded(double v, Axis axis) {
  require(axis.tag != wire::bounds::expand, wire::statuses::capabilityMissing);
  return finiteSize(
      std::max(axis.min, axis.tag == wire::bounds::finite ? std::min(v, axis.max) : v));
}
} // namespace
struct LayoutQueryWork::State {
  struct Task {
    Handle node;
    uint32_t mode = 0, phase = 0;
    double extent = INFINITY;
    size_t index = 0, parentIndex = 0;
    std::vector<QueryValue> values;
    std::vector<double> mainSizes;
    std::unique_ptr<LayoutWork> dry;
    bool crossFlex = false;
  };
  Lease lease;
  std::shared_ptr<const Document> document;
  double scale;
  uint64_t font;
  std::vector<Task> stack;
  QueryValue result;
  bool complete = false;
  uint64_t operations = 0, nextRequest = 0;
  std::optional<MeasurementRequest> pending;
  std::optional<Measurement> measurement;
  std::optional<MeasurementRequest> external;
  uint64_t nextExternal = 0, internalRequest = 0;
  State(std::shared_ptr<const Document> d, Handle root, uint32_t mode,
        LayoutConstraints constraints, double dpi, uint64_t fonts)
      : lease(d->lease.ledger, sizeof(State) + (wire::limits::depth + 1) * sizeof(Task) +
                                   wire::limits::nodes * (sizeof(QueryValue) + sizeof(double))),
        document(std::move(d)), scale(dpi), font(fonts) {
    stack.reserve(wire::limits::depth + 1);
    push(root, mode, widthQuery(mode) ? constraints.maxHeight : constraints.maxWidth);
    if (mode == wire::layoutQueries::dry)
      stack.back().dry = std::make_unique<LayoutWork>(document, root, constraints, scale, font);
  }
  void push(Handle node, uint32_t mode, double extent, size_t index = 0) {
    require(stack.size() <= wire::limits::depth, wire::statuses::invalidGraph);
    Task t;
    t.node = node;
    t.mode = mode;
    t.extent = extent;
    t.parentIndex = index;
    stack.push_back(std::move(t));
  }
  void finish(QueryValue value) {
    finiteSize(value.value);
    finiteSize(value.width);
    finiteSize(value.height);
    const auto index = stack.back().parentIndex;
    stack.pop_back();
    if (stack.empty()) {
      result = value;
      complete = true;
    } else {
      auto &parent = stack.back();
      if (parent.phase == 2)
        parent.mainSizes[index] = value.value;
      else
        parent.values[index] = value;
    }
  }
  void startDry(Task &task, const Node &n) {
    LayoutConstraints c;
    if (widthQuery(task.mode))
      c.maxHeight = task.extent;
    else
      c.maxWidth = task.extent;
    task.dry = std::make_unique<LayoutWork>(document, n.id, c, scale, font);
  }
  void advance() {
    auto &t = stack.back();
    const auto &n = document->get(t.node);
    require(!n.layoutBuilder,wire::statuses::capabilityMissing);
    const auto &s = n.layout;
    const bool w = widthQuery(t.mode), minimum = minimumQuery(t.mode);
    const auto &children = document->children[n.id.slot];
    const double padding = w ? s.left + s.right : s.top + s.bottom;
    const double oppositePadding = w ? s.top + s.bottom : s.left + s.right;
    const double extent = std::max(0.0, t.extent - oppositePadding);
    if (t.dry) {
      if (!t.dry->step(1))
        return;
      const auto &box = *t.dry->output()->boxes[n.id.slot];
      finish({t.mode == wire::layoutQueries::dry ? 0
              : w                                ? box.width
                                                 : box.height,
              box.width, box.height, box.baseline});
      return;
    }
    if (t.phase == 0) {
      if(s.constraintFlags&wire::layoutConstraintFlags::offstage){finish({});return;}
      if(n.kind==wire::kinds::image&&n.imageStyle){
        if(minimum&&!(n.imageStyle->flags&(wire::imageFlags::widthSpecified|wire::imageFlags::heightSpecified))){finish({});return;}
        LayoutConstraints c;if(std::isfinite(t.extent)){if(w)c.minHeight=c.maxHeight=t.extent;else c.minWidth=c.maxWidth=t.extent;}
        t.dry=std::make_unique<LayoutWork>(document,n.id,c,scale,font);return;
      }
      const double preferred = w ? n.properties.width : n.properties.height;
      if ((preferred > 0 &&
           (w || (n.kind != wire::kinds::paragraph && n.kind != wire::kinds::editable))) ||
          !s.enabled) {
        const double v = bounded(preferred, w ? n.horizontal : n.vertical);
        finish({v, w ? v : 0, w ? 0 : v, -1});
        return;
      }
      require(n.kind != wire::kinds::scrollViewport && n.kind != wire::kinds::sliver,
              wire::statuses::capabilityMissing);
      if (n.kind == wire::kinds::paragraph || n.kind == wire::kinds::editable ||
          n.kind == wire::kinds::image) {
        pending = MeasurementRequest{++nextRequest, document->nodes[n.id.slot].value,
                                     w ? 0 : extent, !w && std::isfinite(extent)&&(!n.paragraph||n.paragraph->value.wraps())};
        t.phase = 5;
        return;
      }
      if (n.kind == wire::kinds::wrap && w != (s.direction == 0)) {
        startDry(t, n);
        return;
      }
      if (n.kind == wire::kinds::grid && !w) {
        if (std::isfinite(extent)) {
          startDry(t, n);
          return;
        }
        t.values.resize(1);
        t.phase = 6;
        push(n.id, wire::layoutQueries::maxWidth, INFINITY);
        return;
      }
      t.values.resize(children.size());
      t.mainSizes.resize(children.size());
      t.crossFlex = n.kind == wire::kinds::flex && w != (s.direction == 0);
      t.phase = t.crossFlex ? 2 : 3;
      t.index = 0;
      return;
    }
    if (t.phase == 6) {
      const double width = t.values[0].value;
      LayoutConstraints c;
      c.maxWidth = width;
      t.dry = std::make_unique<LayoutWork>(document, n.id, c, scale, font);
      return;
    }
    if (t.phase == 5) {
      if (!measurement)
        return;
      const auto m = *measurement;
      measurement.reset();
      pending.reset();
      double v;
      if (n.kind == wire::kinds::image) {
        require(m.width > 0 && m.height > 0, wire::statuses::invalidValue);
        if (w)
          v = std::isfinite(extent) ? extent * m.width / m.height : m.width;
        else
          v = std::isfinite(extent) ? extent * m.height / m.width : m.height;
      } else
        v = w ? (minimum ? m.minimum : m.maximum) : m.height;
      const double preferred = w ? n.properties.width : n.properties.height;
      if (preferred > 0)
        v = preferred;
      v = bounded(preferred > 0 ? preferred : v + padding, w ? n.horizontal : n.vertical);
      finish({v, w ? v : m.width + s.left + s.right,
              w ? m.height + s.top + s.bottom : v,
              w || m.baseline < 0 ? -1 : s.top + m.baseline});
      return;
    }
    if (t.phase == 2) {
      while (t.index < children.size()) {
        const size_t index = t.index++;
        const auto &child = document->get(children[index]);
        if (child.layout.flex > 0 && std::isfinite(extent))
          continue;
        push(child.id,
             s.direction == 0 ? wire::layoutQueries::maxWidth : wire::layoutQueries::maxHeight,
             INFINITY, index);
        return;
      }
      double used = children.empty() ? 0 : s.gap * (children.size() - 1), flex = 0;
      for (size_t i = 0; i < children.size(); ++i) {
        const auto &child = document->get(children[i]);
        if (child.layout.flex > 0)
          flex += child.layout.flex;
        else
          used += t.mainSizes[i];
      }
      if (std::isfinite(extent) && flex > 0)
        for (size_t i = 0; i < children.size(); ++i) {
          const auto &child = document->get(children[i]);
          if (child.layout.flex > 0)
            t.mainSizes[i] = std::max(0.0, extent - used) * child.layout.flex / flex;
        }
      t.phase = 3;
      t.index = 0;
      return;
    }
    if (t.phase == 3) {
      if (t.index < children.size()) {
        const size_t index = t.index++;
        const double childExtent = t.crossFlex ? t.mainSizes[index]
                                   : n.kind == wire::kinds::wrap || n.kind == wire::kinds::grid
                                       ? INFINITY
                                       : extent;
        push(children[index], t.mode, childExtent, index);
        return;
      }
      double value = 0, flex = 0, fraction = 0, ascent = 0, descent = 0;
      const bool mainFlex = n.kind == wire::kinds::flex && !t.crossFlex;
      const bool sumWrap = n.kind == wire::kinds::wrap && !minimum;
      const bool baselineAligned = !w && s.direction == 0 &&
          s.crossAlign == wire::layoutCrossAlign::baseline &&
          (t.crossFlex || n.kind == wire::kinds::box || n.kind == wire::kinds::stack);
      for (size_t i = 0; i < children.size(); ++i) {
        const auto &child = document->get(children[i]);
        const auto v = t.values[i].value;
        if (mainFlex && child.layout.flex > 0) {
          flex += child.layout.flex;
          fraction = std::max(fraction, v / child.layout.flex);
        } else if (mainFlex || sumWrap)
          value += v;
        else
          value = std::max(value, v + (n.kind == wire::kinds::stack || n.kind == wire::kinds::box
                                           ? (w ? child.properties.x : child.properties.y)
                                           : 0));
        if (baselineAligned) {
          require(t.values[i].baseline >= 0, wire::statuses::capabilityMissing);
          ascent = std::max(ascent, t.values[i].baseline);
          descent = std::max(descent, v - t.values[i].baseline);
        }
      }
      if (mainFlex)
        value += fraction * flex;
      if ((mainFlex || sumWrap) && !children.empty())
        value += s.gap * (children.size() - 1);
      if (n.kind == wire::kinds::grid)
        value = value * s.columns + s.gap * (s.columns - 1);
      if (baselineAligned)
        value = std::max(value, ascent + descent);
      if(s.constraintFlags&wire::layoutConstraintFlags::alignmentSizing){
        const double factor=w?s.widthFactor:s.heightFactor;
        if(factor>=0)value=finiteSize(value*factor);
      }
      value = bounded(value + padding, w ? n.horizontal : n.vertical);
      double baseline = -1;
      if (baselineAligned && !t.values.empty()) baseline = s.top + ascent;
      else if (!w && !t.values.empty() && t.values[0].baseline >= 0)
        baseline = s.top + t.values[0].baseline;
      finish({value, w ? value : 0, w ? 0 : value, baseline});
    }
  }
};
LayoutQueryWork::LayoutQueryWork(std::shared_ptr<const Document> document, Handle root,
                                 uint32_t mode, LayoutConstraints constraints, double scale,
                                 uint64_t font)
    : state_(std::make_unique<State>(std::move(document), root, mode, constraints, scale, font)) {}
LayoutQueryWork::~LayoutQueryWork() = default;
bool LayoutQueryWork::step(uint32_t quota) {
  auto &s = *state_;
  while (quota-- && !s.complete && !waiting()) {
    require(++s.operations <= wire::limits::layoutOperations, wire::statuses::budgetExceeded);
    s.advance();
  }
  return s.complete;
}
bool LayoutQueryWork::waiting() const {
  const auto &s = *state_;
  return (s.pending && !s.measurement) ||
         (!s.stack.empty() && s.stack.back().dry && s.stack.back().dry->waiting());
}
std::optional<MeasurementRequest> LayoutQueryWork::request() const {
  auto &s = *state_;
  if (s.external)
    return s.external;
  std::optional<MeasurementRequest> pending;
  if (s.pending && !s.measurement)
    pending = s.pending;
  else if (!s.stack.empty() && s.stack.back().dry && s.stack.back().dry->waiting())
    pending = s.stack.back().dry->request();
  if (pending) {
    s.internalRequest = pending->id;
    pending->id = ++s.nextExternal;
    s.external = pending;
  }
  return pending;
}
void LayoutQueryWork::measured(uint64_t id, Handle node, Measurement value) {
  auto &s = *state_;
  require(s.external && s.external->id == id && s.external->node->id == node,
          wire::statuses::stale);
  if (!s.stack.empty() && s.stack.back().dry && s.stack.back().dry->waiting()) {
    s.stack.back().dry->measured(s.internalRequest, node, value);
    s.external.reset();
    return;
  }
  require(s.pending && !s.measurement && s.pending->node->id == node, wire::statuses::stale);
  finiteSize(value.width);
  finiteSize(value.height);
  finiteSize(value.minimum);
  finiteSize(value.maximum);
  require(value.maximum >= value.minimum && value.baseline >= -1 && std::isfinite(value.baseline),
          wire::statuses::invalidValue);
  s.measurement = value;
  s.external.reset();
}
QueryValue LayoutQueryWork::value() const {
  require(state_->complete, wire::statuses::pending);
  return state_->result;
}
} // namespace nelyx::v2
