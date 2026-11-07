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
void local(Axis axis, double &minimum, double &maximum, bool enforce) {
  if (axis.tag == wire::bounds::expand) {
    require(std::isfinite(maximum), wire::statuses::invalidValue);
    minimum = maximum;
  } else if (enforce) {
    const double low = std::clamp(axis.min, minimum, maximum);
    if (axis.tag == wire::bounds::finite)
      maximum = std::clamp(axis.max, minimum, maximum);
    minimum = low;
  } else {
    minimum = std::max(minimum, axis.min);
    if (axis.tag == wire::bounds::finite)
      maximum = std::min(maximum, axis.max);
    require(minimum <= maximum, wire::statuses::invalidValue);
  }
}
LayoutConstraints resolve(const Node &n, LayoutConstraints c) {
  const bool enforce = n.layout.constraintFlags & wire::layoutConstraintFlags::enforceBounds;
  local(n.horizontal, c.minWidth, c.maxWidth, enforce);
  local(n.vertical, c.minHeight, c.maxHeight, enforce);
  if(n.layout.constraintFlags&wire::layoutConstraintFlags::preferredSize){
    c.minWidth=c.maxWidth=constrain((n.layout.constraintFlags&wire::layoutConstraintFlags::expandPreferredWidth)&&std::isfinite(c.maxWidth)?c.maxWidth:n.properties.width,c.minWidth,c.maxWidth);
    c.minHeight=c.maxHeight=constrain(n.properties.height,c.minHeight,c.maxHeight);return c;
  }
  if (n.properties.width > 0)
    c.minWidth = c.maxWidth = constrain(n.properties.width, c.minWidth, c.maxWidth);
  if (n.properties.height > 0)
    c.minHeight = c.maxHeight = constrain(n.properties.height, c.minHeight, c.maxHeight);
  return c;
}
double inset(double value, double padding) { return std::max(0.0, value - padding); }
bool horizontal(const Node &n) { return n.layout.direction == 0; }
bool flow(const Node &n) { return n.kind == wire::kinds::flex || n.kind == wire::kinds::sliver; }
bool measuredLeaf(const Node &n) {
  return n.kind == wire::kinds::paragraph || n.kind == wire::kinds::editable ||
         n.kind == wire::kinds::image;
}
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
    std::vector<double> stretch;
  };
  struct Run {
    size_t begin, end;
    double length = 0, breadth = 0, ascent = 0, descent = 0;
  };
  struct Flatten {
    std::shared_ptr<const LayoutBox> box;
    double x = 0, y = 0;
    bool hidden = false;
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
  uint64_t imageWork=0;
  uint32_t imageTiles=0;
  State(std::shared_ptr<const Document> d, double width, double height, double scale, uint64_t font,
        std::shared_ptr<const LayoutOutput> old)
      : lease(d->lease.ledger,
              sizeof(State) + (wire::limits::depth + 1) * sizeof(Task) +
                  (wire::limits::nodes + 1) *
                      (sizeof(Flatten) + sizeof(roots[0]) + sizeof(Run) + sizeof(double))),
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
    if(child.layout.constraintFlags&wire::layoutConstraintFlags::paintChild)return {};
    LayoutConstraints c{0, t.innerWidth, 0, t.innerHeight};
    const auto &s = n.layout;
    const bool h = horizontal(n);
    if (!s.enabled)
      return c;
    // Material's minimum touch target sizes the wrapper after laying out the
    // child with the unchanged incoming constraints.
    if(s.constraintFlags&wire::layoutConstraintFlags::inputPadding)return t.input;
    if(s.constraintFlags&wire::layoutConstraintFlags::inlineScale){
      c.maxWidth=t.innerWidth/s.inlineScale;
      require(!std::isnan(c.maxWidth),wire::statuses::invalidValue);
      c.maxHeight=INFINITY;return c;
    }
    const auto policy = s.constraintFlags & wire::layoutConstraintFlags::childMask;
    if (policy == wire::layoutChildConstraints::inherit) {
      c.minWidth = inset(t.constraints.minWidth, s.left + s.right);
      c.minHeight = inset(t.constraints.minHeight, s.top + s.bottom);
    } else if (policy == wire::layoutChildConstraints::expand) {
      require(std::isfinite(c.maxWidth) && std::isfinite(c.maxHeight), wire::statuses::invalidValue);
      c.minWidth = c.maxWidth;
      c.minHeight = c.maxHeight;
    }
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
    if (s.crossAlign == wire::layoutCrossAlign::stretch &&
        (flow(n) || (n.kind != wire::kinds::wrap && n.kind != wire::kinds::grid &&
                     n.kind != wire::kinds::scrollViewport))) {
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
  // Run discovery and the optional stretch pass use the same finite continuation
  // as normal child layout, including versioned provider measurements.
  std::vector<Run> runs(const Task &t, const Node &n) const {
    std::vector<Run> rows;
    const bool grid = n.kind == wire::kinds::grid, h = grid || horizontal(n);
    const double limit = h ? t.innerWidth : t.innerHeight;
    for (size_t i = 0; i < t.box->children.size(); ++i) {
      const auto &child = *t.box->children[i].box;
      if (rows.empty() ||
          (grid ? i % n.layout.columns == 0
                : i > rows.back().begin &&
                      rows.back().length + n.layout.gap + main(child, h) > limit))
        rows.push_back({i, i});
      auto &run = rows.back();
      if (i > run.begin)
        run.length = scalar(run.length + n.layout.gap);
      run.length = scalar(run.length + main(child, h));
      run.breadth = std::max(run.breadth, cross(child, h));
      run.end = i + 1;
      if (n.layout.crossAlign == wire::layoutCrossAlign::baseline) {
        require(h && child.baseline >= 0, wire::statuses::invalidValue);
        run.ascent = std::max(run.ascent, child.baseline);
        run.descent = std::max(run.descent, child.height - child.baseline);
        run.breadth = run.ascent + run.descent;
      }
    }
    return rows;
  }
  static void alignment(uint32_t align, size_t count, double free, double &lead, double &gap) {
    if (align == wire::layoutMainAlign::center)
      lead = free / 2;
    else if (align == wire::layoutMainAlign::end)
      lead = free;
    else if (align == wire::layoutMainAlign::spaceBetween && count > 1)
      gap += free / (count - 1);
    else if (align == wire::layoutMainAlign::spaceAround && count) {
      gap += free / count;
      lead = free / count / 2;
    } else if (align == wire::layoutMainAlign::spaceEvenly && count) {
      gap += free / (count + 1);
      lead = free / (count + 1);
    }
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
    if(s.constraintFlags&wire::layoutConstraintFlags::inputPadding)require(b.children.size()<=1,wire::statuses::invalidGraph);
    if(s.constraintFlags&wire::layoutConstraintFlags::inlineScale){
      require(b.children.size()<=1,wire::statuses::invalidGraph);
      if(!b.children.empty()){
        const auto& child=*b.children.front().box;
        width=scalar(child.width*s.inlineScale);height=scalar(child.height*s.inlineScale);
        if(child.baseline>=0)b.baseline=scalar(child.baseline*s.inlineScale);
        if(child.ideographicBaseline>=0)b.ideographicBaseline=scalar(child.ideographicBaseline*s.inlineScale);
      }
      b.width=constrain(width,c.minWidth,c.maxWidth);b.height=constrain(height,c.minHeight,c.maxHeight);
      return;
    }
    if(s.constraintFlags&wire::layoutConstraintFlags::alignmentSizing){
      require(n.kind==wire::kinds::box&&b.children.size()<=1,wire::statuses::invalidGraph);
      const double childWidth=b.children.empty()?0:b.children.front().box->width;
      const double childHeight=b.children.empty()?0:b.children.front().box->height;
      width=s.widthFactor>=0?scalar(childWidth*s.widthFactor):
        std::isfinite(c.maxWidth)?c.maxWidth:childWidth;
      height=s.heightFactor>=0?scalar(childHeight*s.heightFactor):
        std::isfinite(c.maxHeight)?c.maxHeight:childHeight;
    } else if((s.constraintFlags&wire::layoutConstraintFlags::expandEmpty)&&std::none_of(b.children.begin(),b.children.end(),[&](const auto& child){return !(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild);})){
      const bool bounded=std::isfinite(c.maxWidth)&&std::isfinite(c.maxHeight);
      width=bounded?c.maxWidth:c.minWidth; height=bounded?c.maxHeight:c.minHeight;
    } else if (n.list.generation) {
      require(n.kind==wire::kinds::sliver&&s.left==0&&s.right==0&&s.top==0&&s.bottom==0&&
        s.gap==0&&s.crossAlign==0&&s.mainAlign==0&&!s.mainSize&&
        b.children.size()<=wire::limits::listChildren,wire::statuses::invalidValue);
      auto list=std::make_shared<ListGeometry>(source->lease.ledger,n.list);
      if(previous){const auto& old=previous->boxes[n.id.slot];
        if(old&&old->node==n.id&&old->listGeometry&&old->listGeometry->style.generation==n.list.generation)
          list->measured=old->listGeometry->measured;}
      std::map<uint32_t,uint64_t> present;
      std::map<uint64_t,uint32_t> keys;
      for(const auto& child:b.children){const auto item=source->get(child.box->node).item;
        require(item.key&&item.index<n.list.count&&present.emplace(item.index,item.key).second&&
          keys.emplace(item.key,item.index).second&&main(*child.box,h)>0,wire::statuses::invalidGraph);
        list->measured[item.index]={item.key,main(*child.box,h)};
        if(h)height=std::max(height,child.box->height);else width=std::max(width,child.box->width);}
      for(auto i=n.list.begin;i<n.list.end;++i)
        require(present.count(i)>0,wire::statuses::contentUnavailable);
      while(list->measured.size()>wire::limits::listMetrics){
        auto first=list->measured.begin(),last=std::prev(list->measured.end());
        const auto distance=[&](uint32_t i){return i<n.list.begin?n.list.begin-i:i>=n.list.end?i-n.list.end+1:0;};
        list->measured.erase(distance(first->first)>distance(last->first)?first:last);}
      for(auto& child:b.children){const auto item=source->get(child.box->node).item;
        const auto offset=list->prefix(item.index);
        child.x=h?offset:0;child.y=h?0:offset;
        list->rows.push_back({child.box->node,item.index,item.key,offset,main(*child.box,h)});}
      list->total=list->prefix(n.list.count);list->begin=list->prefix(n.list.begin);list->end=list->prefix(n.list.end);
      b.width=constrain(h?list->total:width,c.minWidth,c.maxWidth);
      b.height=constrain(h?height:list->total,c.minHeight,c.maxHeight);
      require(main(b,h)==list->total,wire::statuses::invalidValue);
      b.listGeometry=std::move(list);
    } else if (flow(n)) {
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
        if(std::isfinite(available))length = std::max(length, available);
        else require((s.constraintFlags&wire::layoutConstraintFlags::shrinkUnboundedMain)&&t.totalFlex==0,
          wire::statuses::invalidValue);
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
      const bool reverseMain=s.constraintFlags&wire::layoutConstraintFlags::reverseMain;
      const bool reverseCross=s.constraintFlags&wire::layoutConstraintFlags::reverseCross;
      if(s.mainAlign==0&&reverseMain)lead=free;
      if (s.mainAlign == 1)
        lead = free / 2;
      if (s.mainAlign == 2)
        lead = reverseMain?0:free;
      if(s.mainAlign==3&&count<2&&reverseMain)lead=free;
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
      for(size_t index=0;index<count;++index){
        auto& child=b.children[reverseMain?count-1-index:index];
        const double freeCross=finalCross-cross(*child.box,h);
        double offset = reverseCross?freeCross:0;
        if (s.crossAlign == 1)
          offset = (finalCross - cross(*child.box, h)) / 2;
        if (s.crossAlign == 2)
          offset = reverseCross?0:freeCross;
        if (s.crossAlign == 4)
          offset = ascent - child.box->baseline;
        position(child, h, lead, offset);
        lead += main(*child.box, h) + gap;
      }
    } else if (n.kind == wire::kinds::wrap || n.kind == wire::kinds::grid) {
      const bool grid = n.kind == wire::kinds::grid, rowHorizontal = grid || h;
      const auto rows = runs(t, n);
      double longest = 0, across = rows.empty() ? 0 : s.runGap * (rows.size() - 1);
      for (const auto &run : rows) {
        longest = std::max(longest, run.length);
        across = scalar(across + run.breadth);
      }
      if (grid)
        longest = t.innerWidth;
      if (s.mainSize) {
        const double limit = grid ? t.innerHeight : h ? t.innerWidth : t.innerHeight;
        require(std::isfinite(limit), wire::statuses::invalidValue);
        if (grid)
          across = std::max(across, limit);
        else
          longest = std::max(longest, limit);
      }
      width = rowHorizontal ? longest : across;
      height = rowHorizontal ? across : longest;
      b.width = constrain(width + s.left + s.right, c.minWidth, c.maxWidth);
      b.height = constrain(height + s.top + s.bottom, c.minHeight, c.maxHeight);
      const double actualMain = inset(rowHorizontal ? b.width : b.height,
                                      rowHorizontal ? s.left + s.right : s.top + s.bottom);
      double runOffset = 0, runGap = s.runGap;
      if (grid) {
        double used = rows.empty() ? 0 : s.runGap * (rows.size() - 1);
        for (const auto &run : rows)
          used += run.breadth;
        alignment(s.mainAlign, rows.size(), std::max(0.0, inset(b.height, s.top + s.bottom) - used),
                  runOffset, runGap);
      }
      for (const auto &run : rows) {
        double lead = 0, gap = s.gap;
        if (!grid)
          alignment(s.mainAlign, run.end - run.begin, std::max(0.0, actualMain - run.length),
                    lead, gap);
        for (size_t i = run.begin; i < run.end; ++i) {
          auto &child = b.children[i];
          const double offset = s.crossAlign == 1   ? (run.breadth - cross(*child.box, rowHorizontal)) / 2
                                : s.crossAlign == 2 ? run.breadth - cross(*child.box, rowHorizontal)
                                : s.crossAlign == 4 ? run.ascent - child.box->baseline : 0;
          position(child, rowHorizontal, lead, runOffset + offset);
          lead += main(*child.box, rowHorizontal) + gap;
        }
        runOffset += run.breadth + runGap;
      }
    } else {
      double ascent = 0, descent = 0;
      for (const auto &child : b.children) {
        if(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild)continue;
        const auto &original = source->get(child.box->node).properties;
        width = std::max(width, original.x + child.box->width);
        height = std::max(height, original.y + child.box->height);
        if (s.crossAlign == wire::layoutCrossAlign::baseline) {
          require(h && child.box->baseline >= 0, wire::statuses::invalidValue);
          ascent = std::max(ascent, child.box->baseline);
          descent = std::max(descent, child.box->height - child.box->baseline);
        }
      }
      if (s.crossAlign == wire::layoutCrossAlign::baseline)
        height = std::max(height, ascent + descent);
      if (n.kind == wire::kinds::scrollViewport) {
        require(std::isfinite(t.innerWidth) && std::isfinite(t.innerHeight),
                wire::statuses::invalidValue);
        width = t.innerWidth;
        height = t.innerHeight;
      } else if (s.mainSize) {
        require(std::isfinite(h ? t.innerWidth : t.innerHeight), wire::statuses::invalidValue);
        if (h) width = std::max(width, t.innerWidth);
        else height = std::max(height, t.innerHeight);
      }
    }
    if (!flow(n)) {
      b.width = constrain(width + s.left + s.right, c.minWidth, c.maxWidth);
      b.height = constrain(height + s.top + s.bottom, c.minHeight, c.maxHeight);
    }
    if (!flow(n) && n.kind != wire::kinds::wrap && n.kind != wire::kinds::grid &&
        n.kind != wire::kinds::scrollViewport) {
      const double innerWidth = inset(b.width, s.left + s.right),
                   innerHeight = inset(b.height, s.top + s.bottom);
      double ascent = 0;
      if (s.crossAlign == wire::layoutCrossAlign::baseline) {
        require(h, wire::statuses::invalidValue);
        for (const auto &child : b.children) {
          if(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild)continue;
          require(child.box->baseline >= 0, wire::statuses::invalidValue);
          ascent = std::max(ascent, child.box->baseline);
        }
      }
      for (auto &child : b.children) {
        if(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild)continue;
        if(s.constraintFlags&wire::layoutConstraintFlags::alignment){
          child.x=scalar((innerWidth-child.box->width)*(s.alignmentX+1)/2);
          child.y=scalar((innerHeight-child.box->height)*(s.alignmentY+1)/2);
          continue;
        }
        const double freeMain = std::max(0.0, (h ? innerWidth : innerHeight) - main(*child.box, h)),
                     freeCross = (h ? innerHeight : innerWidth) - cross(*child.box, h);
        position(child, h, s.mainAlign == 1 ? freeMain / 2 : s.mainAlign == 2 ? freeMain : 0,
                 s.crossAlign == 1 ? freeCross / 2 : s.crossAlign == 2 ? freeCross
                 : s.crossAlign == 4 ? ascent - child.box->baseline : 0);
      }
    }
    for (auto &child : b.children) {
      if(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild){child.x=child.y=0;continue;}
      child.x = scalar(child.x + s.left);
      child.y = scalar(child.y + s.top);
      if (b.baseline < 0 && child.box->baseline >= 0)
        b.baseline = child.y + child.box->baseline;
      if (b.ideographicBaseline < 0 && child.box->ideographicBaseline >= 0)
        b.ideographicBaseline = child.y + child.box->ideographicBaseline;
    }
  }
  void advance() {
    if (flattening) {
      if (flatten.empty()) {
        resolvePaintPlacements(*derived,result->fontRevision);
        resolveNativePaint(*derived);
        validateGraphics(*derived);
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
      n->inlineHidden = f.hidden;
      if(f.box->paragraph)n->paragraph=f.box->paragraph;
      n->textGeometry = f.box->textGeometry;
      n->listGeometry = f.box->listGeometry;
      n->contentX = n->layout.enabled && measuredLeaf(*n) ? n->layout.left : 0;
      n->contentX = scalar(n->contentX + f.box->textOffsetX);
      n->contentY = n->layout.enabled && measuredLeaf(*n) ? n->layout.top : 0;
      n->contentY=scalar(n->contentY+f.box->textOffsetY);
      n->contentWidth = f.box->textWidth >= 0 ? f.box->textWidth : inset(f.box->width, n->layout.enabled && measuredLeaf(*n)
                                            ? n->layout.left + n->layout.right : 0);
      n->contentHeight = f.box->textHeight >= 0 ? f.box->textHeight : inset(f.box->height, n->layout.enabled && measuredLeaf(*n)
                                              ? n->layout.top + n->layout.bottom : 0);
      n->contentOverflow = f.box->contentOverflow;
      if(n->imageStyle){
        const auto placement=imagePlacement(*n->imageStyle,n->properties.width,n->properties.height);
        require(placement.count<=wire::limits::imageTiles-imageTiles,wire::statuses::budgetExceeded);imageTiles+=placement.count;
        if(!n->imagePaint||n->imagePaint->style!=*n->imageStyle||n->imagePaint->width!=n->properties.width||n->imagePaint->height!=n->properties.height){
          n->imagePaint=std::make_shared<ImagePaint>(n->lease.ledger,*n->imageStyle,n->properties.width,n->properties.height,placement);
          if(n->resource)imageWork+=1+placement.count;
        }
      }
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
        if(child.listGeometry){const auto& list=*child.listGeometry;
          const bool h=(n->properties.flags&1u)!=0;
          require(h==horizontal(source->get(child.node)),wire::statuses::invalidValue);
          const double origin=h?childPlacement.x+childSource.x:childPlacement.y+childSource.y;
          n->coverage={source->epoch,list.style.begin==0?0:origin+list.begin,
            list.style.end==list.style.count?n->properties.maximum:
              std::max(0.0,origin+list.end-(h?n->properties.width:n->properties.height)),true};
          require(n->coverage.minimum<=n->coverage.maximum,wire::statuses::contentUnavailable);}
      }
      derived->nodes[n->id.slot].value = n;
      result->boxes[n->id.slot] = f.box;
      for (const auto &child : f.box->children)
        flatten.push_back({child.box, child.x, child.y, f.hidden||!child.visible});
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
      if (s.enabled && (measuredLeaf(n) || n.kind == wire::kinds::scrollViewport))
        require(s.mainAlign == 0 && s.crossAlign == 0 && s.mainSize == 0,
                wire::statuses::capabilityMissing);
      if (s.enabled && !flow(n) && n.kind != wire::kinds::wrap && n.kind != wire::kinds::grid)
        require(s.mainAlign <= wire::layoutMainAlign::end,
                wire::statuses::capabilityMissing);
      t.innerWidth = inset(n.layout.enabled ? t.constraints.maxWidth : n.properties.width,
                           s.enabled ? s.left + s.right : 0);
      t.innerHeight = inset(n.layout.enabled ? t.constraints.maxHeight : n.properties.height,
                            s.enabled ? s.top + s.bottom : 0);
      if (n.layout.enabled && (n.kind == wire::kinds::paragraph ||
                               n.kind == wire::kinds::editable || n.kind == wire::kinds::image)) {
        if(n.kind==wire::kinds::image&&n.imageStyle&&!n.resource){
          t.box->width=constrain(t.constraints.minWidth,t.constraints.minWidth,t.constraints.maxWidth);
          t.box->height=constrain(t.constraints.minHeight,t.constraints.minHeight,t.constraints.maxHeight);
          done(t.box);return;
        }
        if(n.paragraph&&n.paragraph->value.inlineChildren()){
          require(n.kind==wire::kinds::paragraph&&children.size()==n.paragraph->value.placeholders.size(),wire::statuses::invalidGraph);
          t.phase=6;return;
        }
        require(children.empty(), wire::statuses::invalidGraph);
        require(n.kind != wire::kinds::image || bool(n.resource), wire::statuses::invalidHandle);
        pending = MeasurementRequest{++requestId, source->nodes[n.id.slot].value,
                                     t.innerWidth, std::isfinite(t.innerWidth)&&(!n.paragraph||n.paragraph->value.wraps())};
        if (!pending->bounded)
          pending->width = 0;
        t.phase = 5;
        return;
      }
      t.phase = 1;
      return;
    }
    if(t.phase==6){
      if(t.index<children.size()){
        const auto index=t.index++;
        push(children[index],{0,t.innerWidth,0,INFINITY},index);return;
      }
      auto options=n.paragraph->value;
      for(size_t i=0;i<children.size();++i){
        const auto& child=*t.box->children[i].box;auto& item=options.placeholders[i];
        require(child.width<=16777216&&child.height<=16777216,wire::statuses::invalidValue);
        item.width=child.width;item.height=child.height;
        const double baseline=item.baseline?child.ideographicBaseline:child.baseline;
        item.baselineOffset=item.alignment==0&&baseline>=0?baseline:child.height;
      }
      t.box->paragraph=std::make_shared<ParagraphData>(source->lease.ledger,std::move(options));
      auto measured=std::make_shared<Node>(n);measured->paragraph=t.box->paragraph;
      pending=MeasurementRequest{++requestId,std::move(measured),t.innerWidth,
        std::isfinite(t.innerWidth)&&n.paragraph->value.wraps()};
      if(!pending->bounded)pending->width=0;
      t.phase=5;return;
    }
    if (t.phase == 5) {
      if (!measurement)
        return;
      const auto m = *measurement;
      measurement.reset();
      pending.reset();
      const double padWidth = n.layout.left + n.layout.right,
                   padHeight = n.layout.top + n.layout.bottom;
      if (n.kind == wire::kinds::paragraph || n.kind == wire::kinds::editable) {
        const bool paragraphSizing=n.layout.constraintFlags&wire::layoutConstraintFlags::paragraphSizing;
        t.box->width = constrain((paragraphSizing?m.maximum:m.width) + padWidth, t.constraints.minWidth, t.constraints.maxWidth);
        require(paragraphSizing || inset(t.box->width, padWidth) == m.width, wire::statuses::invalidValue);
        t.box->height = constrain(m.height + padHeight, t.constraints.minHeight, t.constraints.maxHeight);
        t.box->contentOverflow = m.didExceedMaxLines || m.height > inset(t.box->height, padHeight) ||
          (paragraphSizing&&n.paragraph&&!n.paragraph->value.wraps()&&m.maximum>inset(t.box->width,padWidth));
        if(paragraphSizing){
          t.box->textWidth=m.width;t.box->textHeight=m.height;
          const ParagraphOptions defaults;
          const auto& options=n.paragraph?n.paragraph->value:defaults;
          // TextPainter computes its width before RenderParagraph constrains
          // the box. A non-wrapping paragraph retains its intrinsic paint width.
          const double painterWidth=options.wraps()?inset(t.box->width,padWidth):
            std::max(inset(t.constraints.minWidth,padWidth),m.maximum);
          t.box->textOffsetX=scalar(options.alignment(n.textDirection)*(painterWidth-m.width));
        }
        t.box->baseline = m.baseline < 0 ? -1 : n.layout.top + m.baseline;
        t.box->ideographicBaseline = m.ideographicBaseline < 0 ? -1 : n.layout.top + m.ideographicBaseline;
        if(n.paragraph&&n.paragraph->value.inlineChildren()){
          require(m.placeholders&&m.placeholders->boxes.size()<=t.box->children.size(),wire::statuses::invalidValue);
          for(size_t i=0;i<t.box->children.size();++i){
            auto& child=t.box->children[i];child.visible=i<m.placeholders->boxes.size();
            if(!child.visible)continue;
            const auto& rect=m.placeholders->boxes[i];
            child.x=scalar(n.layout.left+t.box->textOffsetX+rect.x);child.y=scalar(n.layout.top+rect.y);
          }
        }
        if (n.kind == wire::kinds::editable) {
          require(n.editing && m.geometry && m.geometry->revision == n.editing->revision,
                  wire::statuses::stale);
          auto caret = m.geometry->caret;
          if(paragraphSizing){
            const auto innerWidth=inset(t.box->width,padWidth),innerHeight=inset(t.box->height,padHeight);
            if(!(n.editFlags&wire::editFlags::multiline))t.box->textOffsetY=std::max(0.0,(innerHeight-m.height)/2);
            const auto right=caret.x+caret.width+t.box->textOffsetX,bottom=caret.y+caret.height+t.box->textOffsetY;
            if(right>innerWidth)t.box->textOffsetX-=right-innerWidth;
            if(caret.x+t.box->textOffsetX<0)t.box->textOffsetX=-caret.x;
            if(bottom>innerHeight)t.box->textOffsetY-=bottom-innerHeight;
            if(caret.y+t.box->textOffsetY<0)t.box->textOffsetY=-caret.y;
            if(t.box->baseline>=0)t.box->baseline+=t.box->textOffsetY;if(t.box->ideographicBaseline>=0)t.box->ideographicBaseline+=t.box->textOffsetY;
          }
          caret.x = scalar(caret.x + n.layout.left+t.box->textOffsetX);
          caret.y = scalar(caret.y + n.layout.top+t.box->textOffsetY);
          auto selection = m.geometry->selection;
          for (auto &rect : selection) {
            rect.x = scalar(rect.x + n.layout.left+t.box->textOffsetX);
            rect.y = scalar(rect.y + n.layout.top+t.box->textOffsetY);
          }
          t.box->textGeometry = std::make_shared<TextGeometry>(source->lease.ledger,
              m.geometry->revision, caret, std::move(selection));
        }
      } else {
        require(m.width > 0 && m.height > 0, wire::statuses::invalidValue);
        const double minWidth = inset(t.constraints.minWidth, padWidth),
                     maxWidth = inset(t.constraints.maxWidth, padWidth),
                     minHeight = inset(t.constraints.minHeight, padHeight),
                     maxHeight = inset(t.constraints.maxHeight, padHeight),
                     aspect = m.width / m.height;
        const double scale=n.imageStyle?n.imageStyle->scale:1;
        double width = m.width/scale, height = m.height/scale;
        // Preserve the intrinsic aspect ratio until tight or conflicting
        // constraints require a different box, as in RenderImage's size contract.
        if (width > maxWidth) { width = maxWidth; height = width / aspect; }
        if (height > maxHeight) { height = maxHeight; width = height * aspect; }
        if (width < minWidth) { width = minWidth; height = width / aspect; }
        if (height < minHeight) { height = minHeight; width = height * aspect; }
        t.box->width = constrain(width + padWidth, t.constraints.minWidth, t.constraints.maxWidth);
        t.box->height = constrain(height + padHeight, t.constraints.minHeight, t.constraints.maxHeight);
      }
      done(t.box);
      return;
    }
    if (t.phase == 4) {
      while (t.index < children.size()) {
        const auto index = t.index++;
        const bool h = n.kind == wire::kinds::grid || horizontal(n);
        const auto &old = *t.box->children[index].box;
        if (cross(old, h) == t.stretch[index])
          continue;
        LayoutConstraints c{old.width, old.width, old.height, old.height};
        if (h) c.minHeight = c.maxHeight = t.stretch[index];
        else c.minWidth = c.maxWidth = t.stretch[index];
        push(children[index], c, index);
        return;
      }
      finish(t, n);
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
      if (n.layout.enabled && n.layout.crossAlign == wire::layoutCrossAlign::stretch &&
          (n.kind == wire::kinds::wrap || n.kind == wire::kinds::grid)) {
        t.stretch.resize(children.size());
        for (const auto &run : runs(t, n))
          for (size_t i = run.begin; i < run.end; ++i)
            t.stretch[i] = run.breadth;
        t.phase = 4;
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
  scalar(value.ideographicBaseline);
  require(value.width >= 0 && value.height >= 0 && value.minimum >= 0 &&
              value.maximum >= value.minimum && value.baseline >= -1 && value.ideographicBaseline >= -1 &&
              ((s.pending->node->kind != wire::kinds::paragraph &&
                s.pending->node->kind != wire::kinds::editable) ||
               (value.baseline >= 0 && (!s.pending->bounded || value.width == s.pending->width))),
          wire::statuses::invalidValue);
  const auto& paragraph=s.pending->node->paragraph;
  if(paragraph&&paragraph->value.inlineChildren()){
    require(value.placeholders&&value.placeholders->boxes.size()<=paragraph->value.placeholders.size(),wire::statuses::invalidValue);
    for(size_t i=0;i<value.placeholders->boxes.size();++i){
      const auto& box=value.placeholders->boxes[i];const auto& expected=paragraph->value.placeholders[i];
      scalar(box.x);scalar(box.y);scalar(box.width);scalar(box.height);
      const auto near=[](double a,double b){return std::abs(a-b)<=std::max(1e-4,std::abs(b)*1e-6);};
      require(box.width>=0&&box.height>=0&&box.direction<=1&&near(box.width,expected.width)&&near(box.height,expected.height),wire::statuses::invalidValue);
    }
  }else require(!value.placeholders,wire::statuses::invalidValue);
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
uint64_t LayoutWork::imagePaintWork() const {return state_->imageWork;}
} // namespace nelyx::v2
