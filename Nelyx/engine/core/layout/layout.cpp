// SPDX-License-Identifier: BSD-3-Clause
#include "layout.hpp"
#include "query.hpp"
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
bool canonicalStack(const Node& n) {return n.layout.constraintFlags&wire::layoutConstraintFlags::canonicalStack;}
double alignmentBaseline(const LayoutBox& box,const LayoutStyle& style) {
  return style.textBaseline==2?box.ideographicBaseline:box.baseline;
}
bool hasAlignmentBaseline(const LayoutBox& box,const LayoutStyle& style) {
  return style.textBaseline==2?box.hasIdeographicBaseline:box.hasBaseline;
}
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
    std::unique_ptr<LayoutQueryWork> intrinsic;
    std::unique_ptr<LayoutEvaluation> program;
    double intrinsicWidth=0,intrinsicHeight=0;
  };
  struct Run {
    size_t begin, end;
    double length = 0, breadth = 0, ascent = 0, descent = 0;
  };
  struct Flatten {
    std::shared_ptr<const LayoutBox> box;
    double x = 0, y = 0;
    bool hidden = false;
    double scaleX = 1, scaleY = 1;
  };
  Lease lease;
  std::shared_ptr<const Document> source;
  std::shared_ptr<Document> derived;
  std::shared_ptr<const LayoutOutput> previous;
  std::shared_ptr<LayoutOutput> result;
  std::vector<ScrollLayoutOffset> offsets;
  std::array<bool,wire::limits::nodes+1> nativeInputChanged{};
  LayoutConstraints viewport;
  std::vector<Task> stack;
  std::vector<Flatten> flatten;
  std::vector<std::shared_ptr<const LayoutBox>> roots;
  std::optional<MeasurementRequest> pending;
  std::optional<LayoutBuildRequest> pendingBuild;
  std::optional<Measurement> measurement;
  uint64_t intrinsicRequest=0;
  size_t root = 0;
  Handle queryRoot;
  bool flattening = false, complete = false;
  uint64_t operations = 0, reused = 0, requestId = 0;
  uint64_t imageWork=0;
  uint32_t imageTiles=0;
  State(std::shared_ptr<const Document> d, double width, double height, double scale, uint64_t font,
        std::shared_ptr<const LayoutOutput> old, std::vector<ScrollLayoutOffset> scrollOffsets = {})
      : lease(d->lease.ledger,
              sizeof(State) + scrollOffsets.size()*sizeof(ScrollLayoutOffset) + (wire::limits::depth + 1) * sizeof(Task) +
                  (wire::limits::nodes + 1) *
                      (sizeof(Flatten) + sizeof(roots[0]) + sizeof(Run) + sizeof(double))),
        source(std::move(d)), previous(std::move(old)),
        result(std::make_shared<LayoutOutput>(source->lease.ledger, scale, font)),
        offsets(std::move(scrollOffsets)),
        viewport{0, width, 0, height} {
    stack.reserve(wire::limits::depth + 1);
    flatten.reserve(source->count);
    roots.reserve(source->children[0].size());
    if (previous && (previous->scale != scale || previous->fontRevision != font))
      previous.reset();
    if(previous)for(const auto& slot:source->nodes)if(slot.value){const auto& cached=previous->boxes[slot.value->id.slot];
      if(cached&&cached->node==slot.value->id)result->boxes[slot.value->id.slot]=cached;}
    if(previous)for(const auto& slot:source->nodes)if(slot.value&&slot.value->kind==wire::kinds::sliver&&slot.value->layoutBuilder&&slot.value->parent){
      const auto parent=slot.value->parent;const auto& cached=previous->boxes[parent.slot];
      if(cached&&cached->node==parent&&cached->listRequestedOffset!=requestedOffset(parent))
        for(Handle at=parent;at;at=source->get(at).parent)nativeInputChanged[at.slot]=true;
    }
    if(previous)for(const auto& slot:source->nodes)if(slot.value&&slot.value->editorViewport.enabled){
      const auto& node=*slot.value;const auto& cached=previous->boxes[node.id.slot];
      if(cached&&cached->node==node.id&&(cached->listRequestedOffset!=requestedOffset(node.id)||
          cached->editorScrollOffset!=requestedOffset(node.id)))
        for(Handle at=node.id;at;at=source->get(at).parent)nativeInputChanged[at.slot]=true;
    }
  }
  double requestedOffset(Handle node)const {
    for(const auto& value:offsets)if(value.node==node)return value.requested;
    return source->get(node).properties.initialScrollOffset;
  }
  bool manualOffset(Handle node)const {
    for(const auto& value:offsets)if(value.node==node)return value.manual;
    return false;
  }
  double scrollVelocity(Handle node)const {
    for(const auto& value:offsets)if(value.node==node)return value.velocity;
    return 0;
  }
  LayoutBuildRequest nativeListDemand(const Task& task,const Node& node,const ListGeometry* geometry,bool includeMeasurements) {
    require(stack.size()>1&&stack[stack.size()-2].node==node.parent,wire::statuses::invalidGraph);
    const auto& parentTask=stack[stack.size()-2];const auto& parent=source->get(node.parent);
    require(parent.kind==wire::kinds::scrollViewport&&!(parent.properties.flags&1u)&&
      std::isfinite(task.input.maxWidth)&&std::isfinite(parentTask.constraints.maxHeight),wire::statuses::capabilityMissing);
    const double width=task.input.maxWidth,height=parentTask.constraints.maxHeight;
    if(geometry&&(geometry->style.count!=node.list.count||geometry->style.generation!=node.list.generation))geometry=nullptr;
    const double total=geometry?geometry->total:node.list.estimate*node.list.count;
    double requested=requestedOffset(parent.id);
    if(!node.list.sequential||(geometry&&geometry->knownCount==node.list.count))
      requested=std::clamp(requested,0.0,std::max(0.0,total+parent.layout.top+parent.layout.bottom-height));
    else requested=std::max(0.0,requested);
    const double origin=parent.layout.top+node.properties.y,offset=std::max(0.0,requested-origin);
    const double paint=std::max(0.0,height-std::max(0.0,origin-requested));
    // Unknown heights select work only. Materialize the first unknown row,
    // measure it in Content, then extend until the actual viewport is covered.
    const auto range=nativeListCacheRange(node.list,geometry,offset,paint,scrollVelocity(parent.id));
    require(range.begin<=range.end&&range.end-range.begin<=wire::limits::listChildren,wire::statuses::contentUnavailable);
    LayoutBuildRequest request;request.node=source->nodes[node.id.slot].value;
    request.constraints={0,width,0,height};
    request.list=LayoutBuildRequest::List{range.begin,range.end,node.list.count,offset,range.beginOffset,paint,includeMeasurements?task.box->listGeometry:nullptr};
    return request;
  }
  void requestNativeList(const Task& task,const Node& node,const ListGeometry* geometry,bool includeMeasurements=false) {
    auto request=nativeListDemand(task,node,geometry,includeMeasurements);request.id=++requestId;pendingBuild=std::move(request);
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
    result->boxes[box->node.slot]=box;
    if(source->get(stack.back().node).tapRegion.revision){
      require(result->tapRegionVisits.size()<wire::limits::nodes,wire::statuses::budgetExceeded);
      result->tapRegionVisits.push_back(stack.back().node);
    }
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
    if(canonicalStack(n)&&child.layout.positionedFlags){
      const auto flags=child.layout.positionedFlags;const auto& p=child.layout.positioned;
      LayoutConstraints positioned;
      if((flags&5u)==5u)positioned.minWidth=positioned.maxWidth=std::max(0.0,scalar(t.box->width-p[0]-p[2]));
      else if(flags&16u)positioned.minWidth=positioned.maxWidth=p[4];
      if((flags&10u)==10u)positioned.minHeight=positioned.maxHeight=std::max(0.0,scalar(t.box->height-p[1]-p[3]));
      else if(flags&32u)positioned.minHeight=positioned.maxHeight=p[5];
      return positioned;
    }
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
    } else if(policy==wire::layoutChildConstraints::unconstrained){
      c={};
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
      if(n.list.generation&&n.layoutBuilder){require(!h&&std::isfinite(c.maxWidth),wire::statuses::capabilityMissing);c.minWidth=c.maxWidth;}
      if(n.list.fixed){if(h)c.minWidth=c.maxWidth=n.list.estimate;else c.minHeight=c.maxHeight=n.list.estimate;}
    } else if (n.kind == wire::kinds::wrap) {
      c.minWidth=c.minHeight=0;
      if(h)c.maxHeight=INFINITY;else c.maxWidth=INFINITY;
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
                      rows.back().length + n.layout.gap + main(child, h) - limit > 1e-10))
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
  static void alignment(uint32_t align, size_t count, double free, double &lead, double &gap,bool reverse=false) {
    if((align==wire::layoutMainAlign::start||(align==wire::layoutMainAlign::spaceBetween&&count<2))&&reverse)lead=free;
    if (align == wire::layoutMainAlign::center)
      lead = free / 2;
    else if (align == wire::layoutMainAlign::end)
      lead = reverse?0:free;
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
  void sizeStack(Task& t,const Node& n) {
    double width=t.constraints.minWidth,height=t.constraints.minHeight;bool nonPositioned=false;
    for(const auto& child:t.box->children)
      if(child.box&&!source->get(child.box->node).layout.positionedFlags){nonPositioned=true;
        width=std::max(width,child.box->width);height=std::max(height,child.box->height);}
    if(!nonPositioned&&!t.box->children.empty()){
      require(std::isfinite(t.constraints.maxWidth)&&std::isfinite(t.constraints.maxHeight),wire::statuses::invalidValue);
      width=t.constraints.maxWidth;height=t.constraints.maxHeight;
    }else if(t.box->children.empty()&&std::isfinite(t.constraints.maxWidth)&&std::isfinite(t.constraints.maxHeight)){
      width=t.constraints.maxWidth;height=t.constraints.maxHeight;
    }
    (void)n;
    t.box->width=constrain(width,t.constraints.minWidth,t.constraints.maxWidth);
    t.box->height=constrain(height,t.constraints.minHeight,t.constraints.maxHeight);
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
    if(s.constraintFlags&wire::layoutConstraintFlags::offstage){
      require(n.kind==wire::kinds::box&&b.children.size()<=1,wire::statuses::invalidGraph);
      b.width=c.minWidth;b.height=c.minHeight;
      for(auto& child:b.children)child.x=child.y=0;
      return;
    }
    if(s.constraintFlags&wire::layoutConstraintFlags::inputPadding)require(b.children.size()<=1,wire::statuses::invalidGraph);
    if(s.constraintFlags&wire::layoutConstraintFlags::inlineScale){
      require(b.children.size()<=1,wire::statuses::invalidGraph);
      if(!b.children.empty()){
        const auto& child=*b.children.front().box;
        width=scalar(child.width*s.inlineScale);height=scalar(child.height*s.inlineScale);
        if(child.hasBaseline){b.baseline=scalar(child.baseline*s.inlineScale);b.hasBaseline=true;}
        if(child.hasIdeographicBaseline){b.ideographicBaseline=scalar(child.ideographicBaseline*s.inlineScale);b.hasIdeographicBaseline=true;}
      }
      b.width=constrain(width,c.minWidth,c.maxWidth);b.height=constrain(height,c.minHeight,c.maxHeight);
      return;
    }
    if(canonicalStack(n)){
      width=b.width;height=b.height;
      for(auto& child:b.children){const auto& item=source->get(child.box->node).layout;
        const auto flags=item.positionedFlags;const auto& p=item.positioned;
        child.x=scalar(flags&1u?p[0]:flags&4u?width-p[2]-child.box->width:(width-child.box->width)*(s.alignmentX+1)/2);
        child.y=scalar(flags&2u?p[1]:flags&8u?height-p[3]-child.box->height:(height-child.box->height)*(s.alignmentY+1)/2);
        if(flags)b.contentOverflow|=child.x<0||child.y<0||child.x+child.box->width>width||child.y+child.box->height>height;
      }
    }else if(s.constraintFlags&wire::layoutConstraintFlags::alignmentSizing){
      require(n.kind==wire::kinds::box&&b.children.size()<=1,wire::statuses::invalidGraph);
      const double childWidth=b.children.empty()?0:b.children.front().box->width;
      const double childHeight=b.children.empty()?0:b.children.front().box->height;
      width=s.widthFactor>=0?scalar(childWidth*s.widthFactor):
        std::isfinite(c.maxWidth)?c.maxWidth:childWidth;
      height=s.heightFactor>=0?scalar(childHeight*s.heightFactor):
        std::isfinite(c.maxHeight)?c.maxHeight:childHeight;
    } else if((s.constraintFlags&wire::layoutConstraintFlags::expandEmpty)&&std::none_of(b.children.begin(),b.children.end(),[&](const auto& child){return !(source->get(child.box->node).layout.constraintFlags&wire::layoutConstraintFlags::paintChild);})){
      const bool bounded=std::isfinite(c.maxWidth)&&std::isfinite(c.maxHeight);
      require((!n.layoutBuilder&&!(n.policy&(wire::eventPolicies::mouseRegion|wire::eventPolicies::pointerListener)))||bounded,wire::statuses::invalidValue);
      width=bounded?c.maxWidth:c.minWidth; height=bounded?c.maxHeight:c.minHeight;
    } else if (n.list.generation) {
      require(n.kind==wire::kinds::sliver&&s.left==0&&s.right==0&&s.top==0&&s.bottom==0&&
        s.gap==0&&s.crossAlign==0&&s.mainAlign==0&&!s.mainSize&&
        b.children.size()<=wire::limits::listChildren,wire::statuses::invalidValue);
      auto list=std::make_shared<ListGeometry>(source->lease.ledger,n.list,n.layoutBuilder&&!n.list.fixed?wire::limits::sourceListMetrics:wire::limits::listMetrics);
      if(previous){const auto& old=previous->boxes[n.id.slot];
        if(old&&old->node==n.id&&old->listGeometry&&old->listGeometry->style.generation==n.list.generation)
          for(const auto& metric:old->listGeometry->measured){if(list->measured.size()==list->metricLimit)break;list->measured.insert(metric);}}
      std::map<uint32_t,uint64_t> present;
      std::map<uint64_t,uint32_t> keys;
      for(const auto& child:b.children){const auto item=source->get(child.box->node).item;
        require(item.key&&item.index<n.list.count&&present.emplace(item.index,item.key).second&&
          keys.emplace(item.key,item.index).second&&main(*child.box,h)>=0,wire::statuses::invalidGraph);
        list->measured[item.index]={item.key,main(*child.box,h)};
        if(h)height=std::max(height,child.box->height);else width=std::max(width,child.box->width);}
      for(auto i=n.list.begin;i<n.list.end;++i)
        require(present.count(i)>0,wire::statuses::contentUnavailable);
      while(list->measured.size()>list->metricLimit){
        auto first=list->measured.begin(),last=std::prev(list->measured.end());
        const auto distance=[&](uint32_t i){return i<n.list.begin?n.list.begin-i:i>=n.list.end?i-n.list.end+1:0;};
        list->measured.erase(distance(first->first)>distance(last->first)?first:last);}
      list->updateEstimate();
      for(auto& child:b.children){const auto item=source->get(child.box->node).item;
        const auto offset=list->prefix(item.index);
        child.x=h?offset:0;child.y=h?0:offset;
        list->rows.push_back({child.box->node,item.index,item.key,offset,main(*child.box,h)});}
      list->total=list->prefix(n.list.count);list->begin=list->prefix(n.list.begin);list->end=list->prefix(n.list.end);
      b.width=constrain(h?list->total:n.layoutBuilder?c.maxWidth:width,c.minWidth,c.maxWidth);
      b.height=constrain(h?height:list->total,c.minHeight,c.maxHeight);
      require(main(b,h)==list->total,wire::statuses::invalidValue);
      b.listGeometry=std::move(list);
      result->boxes[n.id.slot]=t.box;
      if(n.layoutBuilder){const auto demand=nativeListDemand(t,n,b.listGeometry.get(),true);
        if(demand.list->begin!=n.list.begin||demand.list->end!=n.list.end){requestNativeList(t,n,b.listGeometry.get(),true);return;}}
    } else if (flow(n)) {
      double length = 0, breadth = 0, ascent = 0, descent = 0;
      for (const auto &child : b.children) {
        length = scalar(length + main(*child.box, h));
        breadth = std::max(breadth, cross(*child.box, h));
        if (s.crossAlign == wire::layoutCrossAlign::baseline) {
          const double baseline=alignmentBaseline(*child.box,s);
          const bool present=hasAlignmentBaseline(*child.box,s);
          require(h && (s.textBaseline||present), wire::statuses::invalidValue);
          if(present){ascent = std::max(ascent, baseline);
            descent = std::max(descent, child.box->height - baseline);}
        }
      }
      if (!b.children.empty())
        length = scalar(length + s.gap * (b.children.size() - 1));
      if (s.crossAlign == wire::layoutCrossAlign::baseline)
        breadth = s.textBaseline?std::max(breadth,ascent+descent):ascent+descent;
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
        if (s.crossAlign == 4){const auto baseline=alignmentBaseline(*child.box,s);
          offset = hasAlignmentBaseline(*child.box,s)?ascent-baseline:0;}
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
      const bool reverseMain=(s.constraintFlags&wire::layoutConstraintFlags::reverseMain);
      const bool reverseCross=!grid&&(s.constraintFlags&wire::layoutConstraintFlags::reverseCross);
      if (grid) {
        double used = rows.empty() ? 0 : s.runGap * (rows.size() - 1);
        for (const auto &run : rows)
          used += run.breadth;
        alignment(s.mainAlign, rows.size(), std::max(0.0, inset(b.height, s.top + s.bottom) - used),
                  runOffset, runGap);
      }else{
        const double actualCross=inset(rowHorizontal?b.height:b.width,rowHorizontal?s.top+s.bottom:s.left+s.right);
        alignment(s.runAlign,rows.size(),std::max(0.0,actualCross-across),runOffset,runGap,reverseCross);
        b.contentOverflow=longest>actualMain||across>actualCross;
      }
      for(size_t row=0;row<rows.size();++row){const auto& run=rows[reverseCross?rows.size()-1-row:row];
        double lead = grid&&reverseMain?actualMain-run.length:0, gap = s.gap;
        if (!grid)
          alignment(s.mainAlign, run.end - run.begin, std::max(0.0, actualMain - run.length),
                    lead, gap,reverseMain);
        for(size_t at=0;at<run.end-run.begin;++at){const size_t i=reverseMain?run.end-1-at:run.begin+at;
          auto &child = b.children[i];
          const double offset = s.crossAlign == 1   ? (run.breadth - cross(*child.box, rowHorizontal)) / 2
                                : s.crossAlign == 4 ? run.ascent - child.box->baseline
                                : ((s.crossAlign==2)!=reverseCross)?run.breadth-cross(*child.box,rowHorizontal):0;
          position(child, rowHorizontal, lead, runOffset + offset);
          if(!grid)b.contentOverflow|=child.x<0||child.y<0||child.x+child.box->width>b.width+1e-10||child.y+child.box->height>b.height+1e-10;
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
    if (!flow(n) && !canonicalStack(n) && n.kind != wire::kinds::wrap && n.kind != wire::kinds::grid &&
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
        if(n.childAnchor){const auto& anchor=*n.childAnchor;
          child.x=scalar(b.width*anchor[0]+child.box->width*anchor[1]+anchor[2]);
          child.y=scalar(b.height*anchor[3]+child.box->height*anchor[4]+anchor[5]);
          continue;
        }
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
      const bool highest=canonicalStack(n)||n.kind==wire::kinds::wrap||(n.kind==wire::kinds::flex&&h);
      if (child.box->hasBaseline&&(!b.hasBaseline||highest)){
        b.baseline = b.hasBaseline?std::min(b.baseline,child.y+child.box->baseline):child.y+child.box->baseline;
        b.hasBaseline=true;
      }
      if (child.box->hasIdeographicBaseline&&(!b.hasIdeographicBaseline||highest)){
        b.ideographicBaseline = b.hasIdeographicBaseline?std::min(b.ideographicBaseline,child.y+child.box->ideographicBaseline):child.y+child.box->ideographicBaseline;
        b.hasIdeographicBaseline=true;
      }
    }
  }
  void advance() {
    if (flattening) {
      if (flatten.empty()) {
        // Dry layout cannot execute paint or resolve paint-only dependencies.
        if(!queryRoot){
          resolvePaintPlacements(*derived,result->fontRevision);
          resolveNativePaint(*derived);
          validateGraphics(*derived);
        }
        complete = true;
        return;
      }
      const auto f = flatten.back();
      flatten.pop_back();
      const auto &original = source->get(f.box->node);
      auto n = std::make_shared<Node>(original);
      if(original.layout.enabled){const auto constraints=resolve(original,f.box->input);
        n->paintBoundedWidth=std::isfinite(constraints.maxWidth);
        n->paintBoundedHeight=std::isfinite(constraints.maxHeight);}
      n->properties.x = scalar(n->properties.x + f.x);
      n->properties.y = scalar(n->properties.y + f.y);
      n->properties.width = f.box->width;
      n->properties.height = f.box->height;
      n->layoutTransform={f.scaleX,0,0,f.scaleY,0,0};
      n->layoutPaintValues=f.box->paintValues;
      n->baseline = f.box->baseline;
      n->inlineHidden = f.hidden;
      if(f.box->paragraph)n->paragraph=f.box->paragraph;
      n->textGeometry = f.box->textGeometry;
      if(n->editorViewport.enabled){
        n->editorScrollOffset=f.box->editorScrollOffset;
        n->properties.minimum=0;n->properties.maximum=f.box->editorScrollMaximum;
        n->properties.flags=(n->properties.flags&~1u)|((n->editFlags&wire::editFlags::multiline)?0u:1u);
      }
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
      n->contentOverflowX=f.box->contentOverflowX;
      n->overflowProbeWidth=f.box->overflowProbeWidth;n->overflowProbeHeight=f.box->overflowProbeHeight;
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
          n->coverage={source->epoch,list.begin==0?0:origin+list.begin,
            list.style.end==list.style.count?n->properties.maximum:
              std::max(0.0,origin+list.end-(h?n->properties.width:n->properties.height)),true};
          require(n->coverage.minimum<=n->coverage.maximum,wire::statuses::contentUnavailable);}
      }
      derived->nodes.edit(n->id.slot).value = n;
      result->boxes[n->id.slot] = f.box;
      for (const auto &child : f.box->children)
        flatten.push_back({child.box, child.x, child.y, f.hidden||!child.visible,child.scaleX,child.scaleY});
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
      if(n.layoutBuilder){
        require(!queryRoot,wire::statuses::capabilityMissing);
        const auto& builder=*n.layoutBuilder;
        const LayoutConstraints built{builder.horizontal.min,builder.horizontal.tag==wire::bounds::finite?builder.horizontal.max:INFINITY,
          builder.vertical.min,builder.vertical.tag==wire::bounds::finite?builder.vertical.max:INFINITY};
        const bool list=n.kind==wire::kinds::sliver;
        const auto expected=list?nativeListDemand(t,n,nullptr,false).constraints:t.input;
        if(builder.builtRevision!=builder.revision||built!=expected){
          if(list){const ListGeometry* prior=nullptr;
            if(previous){const auto& cached=previous->boxes[n.id.slot];if(cached&&cached->node==n.id&&cached->listGeometry)prior=cached->listGeometry.get();}
            requestNativeList(t,n,prior);
          }else pendingBuild=LayoutBuildRequest{++requestId,source->nodes[n.id.slot].value,t.input,{}};
          return;
        }
      }
      if(queryRoot&&(n.layout.constraintFlags&wire::layoutConstraintFlags::offstage)){
        const auto constraints=resolve(n,t.input);
        auto box=std::make_shared<LayoutBox>(n,t.input,0);
        box->width=constraints.minWidth;box->height=constraints.minHeight;
        done(std::move(box));return;
      }
      if (previous) {
        const auto &cached = previous->boxes[n.id.slot];
        if (cached && cached->node == n.id && cached->revision == n.layoutRevision &&
            cached->editSerial == n.editSerial && cached->input == t.input&&!nativeInputChanged[n.id.slot]) {
          if(n.layoutBuilder&&n.list.generation&&cached->listGeometry){const auto demand=nativeListDemand(t,n,cached->listGeometry.get(),false);
            if(demand.list->begin!=n.list.begin||demand.list->end!=n.list.end){requestNativeList(t,n,cached->listGeometry.get());return;}}
          ++reused;
          done(cached);
          return;
        }
      }
      t.constraints = n.layout.enabled ? resolve(n, t.input) : t.input;
      t.box = std::make_shared<LayoutBox>(n, t.input, children.size());
      if(n.layoutProgram){
        t.program=std::make_unique<LayoutEvaluation>(source->lease.ledger,*n.layoutProgram,0,
          std::array<double,5>{t.constraints.minWidth,t.constraints.maxWidth,t.constraints.minHeight,t.constraints.maxHeight,INFINITY});
        t.phase=20;return;
      }
      if(n.childAnchor)require(std::isfinite(t.constraints.maxWidth)&&std::isfinite(t.constraints.maxHeight),wire::statuses::invalidValue);
      if(n.intrinsicSizing){
        require(children.size()==1,wire::statuses::invalidGraph);
        t.phase=10;
        LayoutConstraints intrinsic;intrinsic.maxWidth=t.constraints.maxWidth;
        t.intrinsic=std::make_unique<LayoutQueryWork>(source,children.front(),wire::layoutQueries::maxHeight,intrinsic,result->scale,result->fontRevision);
        return;
      }
      if(n.kind==wire::kinds::scrollViewport||n.editorViewport.enabled)t.box->listRequestedOffset=requestedOffset(n.id);
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
        if(n.editorViewport.enabled){
          require(n.paragraph&&n.paragraph->value.overflowProbe,wire::statuses::invalidValue);
          const auto& probe=*n.paragraph->value.overflowProbe;
          auto measured=std::make_shared<Node>(n);measured->kind=wire::kinds::paragraph;
          measured->editing.reset();measured->editorViewport={};measured->fontSize=probe.fontSize;measured->color=probe.color;
          measured->paragraph=std::make_shared<ParagraphData>(source->lease.ledger,probe.paragraph);
          measured->text=std::make_shared<TextData>(source->lease.ledger,Reader{reinterpret_cast<const uint8_t*>(probe.text.data()),probe.text.size()});
          pending=MeasurementRequest{++requestId,std::move(measured),0,false};t.phase=8;return;
        }
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
        if(n.editorViewport.enabled){
          require(n.editing&&m.geometry&&m.geometry->revision==n.editing->revision&&m.geometry->caret.height>0,
            wire::statuses::invalidValue);
          const auto& v=n.editorViewport;const double line=t.box->overflowProbeHeight;
          require(line>0,wire::statuses::invalidValue);
          double height;
          if(v.expands){require(std::isfinite(t.constraints.maxHeight),wire::statuses::invalidValue);height=t.constraints.maxHeight;}
          else {const double minimum=line*v.minimumLines,maximum=v.maximumLines?line*v.maximumLines:INFINITY;
            require(std::isfinite(minimum)&&minimum<=1e12&&(!std::isfinite(maximum)||maximum<=1e12),wire::statuses::invalidValue);
            height=std::clamp(m.height,minimum,maximum)+padHeight;}
          t.box->height=constrain(height,t.constraints.minHeight,t.constraints.maxHeight);
        }
        t.box->contentOverflowX=paragraphSizing&&n.paragraph&&!n.paragraph->value.wraps()&&m.maximum>inset(t.box->width,padWidth);
        t.box->contentOverflow = m.didExceedMaxLines || m.height > inset(t.box->height, padHeight) || t.box->contentOverflowX;
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
        t.box->hasBaseline = m.baseline >= 0;
        t.box->hasIdeographicBaseline = m.ideographicBaseline >= 0;
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
          if(paragraphSizing&&n.editorViewport.enabled){
            const bool horizontal=!(n.editFlags&wire::editFlags::multiline),rtl=horizontal&&n.textDirection;
            const double inner=horizontal?inset(t.box->width,padWidth):inset(t.box->height,padHeight);
            const double content=horizontal?std::max(m.width,m.maximum)+caret.width:m.height;
            const double maximum=std::max(0.0,content-inner);
            double logical=std::clamp(requestedOffset(n.id),0.0,maximum),physical=rtl?maximum-logical:logical;
            const LayoutBox* old=nullptr;
            if(previous){const auto& cached=previous->boxes[n.id.slot];if(cached&&cached->node==n.id)old=cached.get();}
            if(!manualOffset(n.id)&&(!old||old->editSerial!=n.editSerial||old->width!=t.box->width||old->height!=t.box->height)){
              const double first=horizontal?caret.x+t.box->textOffsetX:caret.y;
              const double last=first+(horizontal?caret.width:caret.height);
              if(last-physical>inner)physical=last-inner;
              if(first-physical<0)physical=first;
              physical=std::clamp(physical,0.0,maximum);logical=rtl?maximum-physical:physical;
            }
            t.box->editorScrollOffset=logical;t.box->editorScrollMaximum=maximum;
            if(horizontal){t.box->textOffsetX-=physical;t.box->textOffsetY=std::max(0.0,(inset(t.box->height,padHeight)-m.height)/2);}
            else t.box->textOffsetY=-physical;
            const double baselineOffset=horizontal?t.box->textOffsetY:0;
            if(t.box->hasBaseline)t.box->baseline=std::clamp(t.box->baseline+baselineOffset,0.0,t.box->height);
            if(t.box->hasIdeographicBaseline)t.box->ideographicBaseline=std::clamp(t.box->ideographicBaseline+baselineOffset,0.0,t.box->height);
          }else if(paragraphSizing){
            const auto innerWidth=inset(t.box->width,padWidth),innerHeight=inset(t.box->height,padHeight);
            if(!(n.editFlags&wire::editFlags::multiline))t.box->textOffsetY=std::max(0.0,(innerHeight-m.height)/2);
            const auto right=caret.x+caret.width+t.box->textOffsetX,bottom=caret.y+caret.height+t.box->textOffsetY;
            if(right>innerWidth)t.box->textOffsetX-=right-innerWidth;
            if(caret.x+t.box->textOffsetX<0)t.box->textOffsetX=-caret.x;
            if(bottom>innerHeight)t.box->textOffsetY-=bottom-innerHeight;
            if(caret.y+t.box->textOffsetY<0)t.box->textOffsetY=-caret.y;
            const double baselineOffset=n.editFlags&wire::editFlags::multiline?0:t.box->textOffsetY;
            if(t.box->hasBaseline)t.box->baseline=std::clamp(t.box->baseline+baselineOffset,0.0,t.box->height);
            if(t.box->hasIdeographicBaseline)t.box->ideographicBaseline=std::clamp(t.box->ideographicBaseline+baselineOffset,0.0,t.box->height);
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
      if(n.paragraph&&n.paragraph->value.overflowProbe&&!n.editorViewport.enabled&&t.box->contentOverflow){
        const auto& probe=*n.paragraph->value.overflowProbe;
        auto measured=std::make_shared<Node>(n);measured->fontSize=probe.fontSize;measured->color=probe.color;
        measured->paragraph=std::make_shared<ParagraphData>(source->lease.ledger,probe.paragraph);
        measured->text=std::make_shared<TextData>(source->lease.ledger,Reader{reinterpret_cast<const uint8_t*>(probe.text.data()),probe.text.size()});
        pending=MeasurementRequest{++requestId,std::move(measured),0,false};t.phase=7;return;
      }
      done(t.box);
      return;
    }
    if(t.phase==7){
      if(!measurement)return;
      t.box->overflowProbeWidth=measurement->width;t.box->overflowProbeHeight=measurement->height;
      measurement.reset();pending.reset();done(t.box);return;
    }
    if(t.phase==8){
      if(!measurement)return;
      t.box->overflowProbeWidth=measurement->width;t.box->overflowProbeHeight=measurement->height;
      measurement.reset();pending.reset();
      pending=MeasurementRequest{++requestId,source->nodes[n.id.slot].value,t.innerWidth,
        std::isfinite(t.innerWidth)&&(!n.paragraph||n.paragraph->value.wraps())};
      if(!pending->bounded)pending->width=0;t.phase=5;return;
    }
    if(t.phase==20){
      auto& program=*t.program;
      if(program.complete()){
        auto& box=*t.box;box.width=constrain(program.width,t.constraints.minWidth,t.constraints.maxWidth);box.height=constrain(program.height,t.constraints.minHeight,t.constraints.maxHeight);
        box.baseline=program.hasBaseline?program.baseline:-1;box.hasBaseline=program.hasBaseline;box.ideographicBaseline=program.hasIdeographic?program.ideographic:-1;box.hasIdeographicBaseline=program.hasIdeographic;
        box.paintValues=program.paintValues;
        for(size_t i=0;i<children.size();++i){require(bool(box.children[i].box),wire::statuses::invalidGraph);box.children[i].x=program.positions[i].x;box.children[i].y=program.positions[i].y;box.children[i].scaleX=program.scales[i].x;box.children[i].scaleY=program.scales[i].y;}
        done(t.box);return;
      }
      if(!program.demand){program.advance(operations);return;}
      const auto& demand=*program.demand;const auto& values=demand.values;
      if(demand.kind==2){t.phase=21;push(children[demand.child],{values[0],values[1],values[2],values[3]},demand.child);return;}
      LayoutConstraints constraints;if(demand.query<=wire::layoutQueries::maxWidth)constraints.maxHeight=values[0];else constraints.maxWidth=values[0];
      t.intrinsic=std::make_unique<LayoutQueryWork>(source,children[demand.child],demand.query,constraints,result->scale,result->fontRevision);t.phase=22;return;
    }
    if(t.phase==21){
      auto& program=*t.program;const auto& child=*t.box->children[program.demand->child].box;
      program.measured(child.width,child.height,child.baseline,child.ideographicBaseline,child.hasBaseline,child.hasIdeographicBaseline);t.phase=20;return;
    }
    if(t.phase==22){
      if(!t.intrinsic->step(1)){if(auto request=t.intrinsic->request()){intrinsicRequest=request->id;request->id=++requestId;pending=std::move(request);}return;}
      t.program->queried(t.intrinsic->value().value);t.intrinsic.reset();t.phase=20;return;
    }
    if(t.phase==10||t.phase==11){
      if(!t.intrinsic->step(1)){
        if(auto request=t.intrinsic->request()){
          intrinsicRequest=request->id;request->id=++requestId;pending=std::move(request);
        }
        return;
      }
      if(t.phase==10){
        t.intrinsicHeight=std::max(n.intrinsicSizing->minimumHeight,t.intrinsic->value().value);
        LayoutConstraints intrinsic;intrinsic.maxHeight=t.constraints.maxHeight;
        t.intrinsic=std::make_unique<LayoutQueryWork>(source,children.front(),wire::layoutQueries::maxWidth,intrinsic,result->scale,result->fontRevision);
        t.phase=11;return;
      }
      t.intrinsicWidth=std::max(t.intrinsic->value().value,scalar(t.intrinsicHeight*n.intrinsicSizing->minimumWidthPerHeight));
      t.intrinsic.reset();
      const double width=constrain(t.intrinsicWidth,t.constraints.minWidth,t.constraints.maxWidth),height=constrain(t.intrinsicHeight,t.constraints.minHeight,t.constraints.maxHeight);
      t.phase=12;push(children.front(),{width,width,height,height});return;
    }
    if(t.phase==12){
      const auto& child=*t.box->children.front().box;auto& box=*t.box;
      box.width=n.intrinsicSizing->expandReportedWidth?std::max(child.width,scalar(child.height*n.intrinsicSizing->minimumWidthPerHeight)):child.width;
      box.height=child.height;box.baseline=child.baseline;box.ideographicBaseline=child.ideographicBaseline;
      require(box.width>=t.constraints.minWidth&&box.width<=t.constraints.maxWidth&&
        box.height>=t.constraints.minHeight&&box.height<=t.constraints.maxHeight,wire::statuses::invalidValue);
      box.hasBaseline=child.hasBaseline;box.hasIdeographicBaseline=child.hasIdeographicBaseline;
      done(t.box);return;
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
      if(pendingBuild)return;
      done(t.box);
      return;
    }
    if (t.phase == 1 || t.phase == 3) {
      while (t.index < children.size()) {
        const auto index = t.index++;
        const auto &child = source->get(children[index]);
        const bool bounded=std::isfinite(horizontal(n)?t.innerWidth:t.innerHeight);
        const bool flexible = n.layout.enabled && flow(n) && child.layout.flex > 0&&bounded;
        if(canonicalStack(n)){
          if(bool(child.layout.positionedFlags)!=(t.phase==3))continue;
        }else{
          if(n.layout.enabled&&flow(n)&&child.layout.flex>0&&!bounded)
            require((n.layout.constraintFlags&wire::layoutConstraintFlags::shrinkUnboundedMain)&&!n.layout.mainSize&&child.layout.fit==1,wire::statuses::invalidValue);
        if (flexible != (t.phase == 3))
          continue;
        }
        auto c = childConstraints(n, t, child, flexible);
        push(child.id, c, index);
        return;
      }
      if (t.phase == 1) {
        if(canonicalStack(n)){sizeStack(t,n);t.phase=3;t.index=0;return;}
        t.totalFlex = 0;
        double used = children.empty() ? 0 : n.layout.gap * (children.size() - 1);
        for (size_t i = 0; i < children.size(); ++i) {
          const auto &child = source->get(children[i]);
          if (n.layout.enabled && flow(n) && child.layout.flex > 0&&std::isfinite(horizontal(n)?t.innerWidth:t.innerHeight))
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
      if(pendingBuild)return;
      done(t.box);
    }
  }
};
LayoutWork::LayoutWork(std::shared_ptr<const Document> d, double width, double height, double scale,
                       uint64_t font, std::shared_ptr<const LayoutOutput> previous,std::vector<ScrollLayoutOffset> offsets)
    : state_(
          std::make_unique<State>(std::move(d), width, height, scale, font, std::move(previous),std::move(offsets))) {}
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
bool LayoutWork::waiting() const { return state_->pendingBuild.has_value()||(state_->pending && !state_->measurement); }
const std::optional<MeasurementRequest> &LayoutWork::request() const { return state_->pending; }
const std::optional<LayoutBuildRequest> &LayoutWork::buildRequest() const { return state_->pendingBuild; }
void LayoutWork::measured(uint64_t id, Handle node, Measurement value) {
  auto &s = *state_;
  require(s.pending && !s.measurement && s.pending->id == id && s.pending->node->id == node,
          wire::statuses::stale);
  if(s.intrinsicRequest){
    require(!s.stack.empty()&&bool(s.stack.back().intrinsic),wire::statuses::stale);
    s.stack.back().intrinsic->measured(s.intrinsicRequest,node,std::move(value));
    s.intrinsicRequest=0;s.pending.reset();return;
  }
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
std::shared_ptr<const LayoutOutput> LayoutWork::pendingCache()const {
  require(state_->pendingBuild.has_value(),wire::statuses::pending);
  return state_->result;
}
bool LayoutWork::resumeBuild(std::shared_ptr<const Document> document,
    const std::vector<ScrollLayoutOffset>& offsets) {
  auto& s=*state_;
  if(!s.pendingBuild||s.stack.empty()||s.flattening||s.complete||s.queryRoot||
      document->epoch<=s.source->epoch)return false;
  const auto& request=*s.pendingBuild;
  const auto boundary=request.node->id;
  if(s.stack.back().node!=boundary||!document->contains(boundary)||
      document->children[0]!=s.source->children[0])return false;
  const auto& before=*request.node;const auto& after=document->get(boundary);
  const auto sameAxis=[](Axis a,Axis b){return a.tag==b.tag&&a.min==b.min&&a.max==b.max;};
  if(!after.layoutBuilder||!before.layoutBuilder||
      after.layoutBuilder->revision!=before.layoutBuilder->revision||
      after.layoutBuilder->builtRevision!=after.layoutBuilder->revision||
      after.kind!=before.kind||after.parent!=before.parent||after.order!=before.order||
      after.properties!=before.properties||after.layout!=before.layout||
      !sameAxis(after.horizontal,before.horizontal)||!sameAxis(after.vertical,before.vertical)||
      after.list.generation!=before.list.generation||after.list.count!=before.list.count||
      after.list.fixed!=before.list.fixed||after.list.sequential!=before.list.sequential||
      after.list.estimate!=before.list.estimate)return false;
  const auto& built=*after.layoutBuilder;
  if(LayoutConstraints{built.horizontal.min,built.horizontal.tag==wire::bounds::finite?built.horizontal.max:INFINITY,
      built.vertical.min,built.vertical.tag==wire::bounds::finite?built.vertical.max:INFINITY}!=request.constraints)return false;
  // Offsets are native input, independent of transaction revisions.
  if(offsets.size()!=s.offsets.size())return false;
  for(const auto& offset:offsets)if(std::none_of(s.offsets.begin(),s.offsets.end(),[&](const auto& old){
      // A compositor offset does not change this list's width/height or its
      // already-measured siblings. Retarget only the pending list's viewport;
      // editor and unrelated viewport changes still require normal restart.
      const bool ownList=request.list&&offset.node==before.parent&&
        document->get(offset.node).kind==wire::kinds::scrollViewport;
      if(!document->contains(offset.node))return false;
      // A box builder inside a fixed horizontal page has the same constraints
      // while its ancestor scrolls. Do not discard its reply on every trackpad
      // sample. Source slivers and editor viewports retain their stricter fence.
      const auto& viewport=document->get(offset.node);
      const auto& children=document->children[offset.node.slot];
      const bool movingPage=!request.list&&viewport.kind==wire::kinds::scrollViewport&&
        (viewport.properties.flags&wire::nodePropertyFlags::horizontal)&&
        document->descends(boundary,offset.node)&&children.size()==1&&
        document->get(children.front()).list.fixed&&!document->get(children.front()).layoutBuilder;
      return old.node==offset.node&&old.manual==offset.manual&&
        (old.requested==offset.requested||ownList||movingPage);} ))return false;
  // No siblings, ancestors, root ordering or cross-boundary moves may change.
  // Font/editing snapshots can change without a Source transaction edit.
  for(uint32_t slot=1;slot<=std::max(document->highWater,s.source->highWater);++slot){
    const auto& old=s.source->nodes[slot].value;const auto& value=document->nodes[slot].value;
    const bool oldInside=old&&s.source->descends(old->id,boundary);
    const bool newInside=value&&document->descends(value->id,boundary);
    if(oldInside||newInside){
      if(old&&value&&(oldInside!=newInside))return false;
      continue;
    }
    if(bool(old)!=bool(value))return false;
    if(old&&(old->id!=value->id||old->configurationRevision!=value->configurationRevision||
        old->editSerial!=value->editSerial||old->editing!=value->editing||
        old->fontRevision!=value->fontRevision||old->fontResource!=value->fontResource||
        old->paintOwner!=value->paintOwner||s.source->children[slot]!=document->children[slot]))return false;
  }
  for(const auto& task:s.stack)if(task.intrinsic||task.program)return false;
  // All rejection checks precede mutation. Restart only the answered builder;
  // completed siblings and the parent constraint/placement continuations live on.
  const auto input=s.stack.back().input;const auto index=s.stack.back().parentIndex;
  s.offsets=offsets;
  s.stack.pop_back();
  for(auto& task:s.stack)if(task.box){task.box->revision=document->get(task.node).layoutRevision;
    if(document->get(task.node).kind==wire::kinds::scrollViewport)
      task.box->listRequestedOffset=s.requestedOffset(task.node);}
  auto& visits=s.result->tapRegionVisits;
  visits.erase(std::remove_if(visits.begin(),visits.end(),[&](Handle node){
    return !document->contains(node)||s.source->descends(node,boundary);}),visits.end());
  for(size_t slot=1;slot<s.result->boxes.size();++slot){
    const auto& box=s.result->boxes[slot];
    if(box&&!document->contains(box->node))s.result->boxes[slot].reset();
  }
  s.source=std::move(document);s.previous=s.result;s.pendingBuild.reset();
  s.push(boundary,input,index);
  return true;
}
uint64_t LayoutWork::work() const { return state_->operations; }
uint64_t LayoutWork::reused() const { return state_->reused; }
uint64_t LayoutWork::imagePaintWork() const {return state_->imageWork;}
Handle LayoutWork::currentNode() const {
  if(!state_->stack.empty())return state_->stack.back().node;
  if(!state_->flatten.empty())return state_->flatten.back().box->node;
  return {};
}
} // namespace nelyx::v2
