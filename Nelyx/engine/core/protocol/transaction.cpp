// SPDX-License-Identifier: BSD-3-Clause
#include "../scene/document.hpp"
#include <set>
#include <algorithm>
#include "../interaction/editing.hpp"
#include "../interaction/semantics_data.hpp"

namespace nelyx::v2 {
namespace {
uint32_t childLimit(const Node& node) {
  if(node.kind==wire::kinds::paragraph&&node.paragraph&&node.paragraph->value.inlineChildren())return wire::limits::paragraphPlaceholders;
  if(node.layoutProgram)return node.layoutProgram->children;
  switch (node.kind) {
    case wire::kinds::paragraph: case wire::kinds::image: case wire::kinds::editable: case wire::kinds::path: return 0;
    case wire::kinds::box: case wire::kinds::clip: case wire::kinds::transform:
    case wire::kinds::effect: case wire::kinds::scrollViewport: return 1;
    default: return wire::limits::nodes;
  }
}
void validate(Document& d) {
  for(const auto& slot:d.nodes)if(slot.value){const auto& n=*slot.value;
    if(n.layoutProgram)require((n.kind==wire::kinds::box||n.kind==wire::kinds::stack)&&n.layout.enabled&&
      !n.childAnchor&&!n.intrinsicSizing&&!n.layoutBuilder&&!n.snapshot&&!n.tooltipPosition&&!n.paintOwner&&
      n.layout.constraintFlags==0&&!n.layout.left&&!n.layout.top&&!n.layout.right&&!n.layout.bottom&&
      !n.layout.mainSize&&!n.layout.mainAlign&&!n.layout.crossAlign&&!n.properties.width&&!n.properties.height,wire::statuses::invalidGraph);
    if(n.childAnchor||n.intrinsicSizing)require(n.kind==wire::kinds::box&&n.layout.enabled&&
      !n.layoutBuilder&&!n.paintOwner&&!n.snapshot&&!n.tooltipPosition&&
      n.layout.left==0&&n.layout.top==0&&n.layout.right==0&&n.layout.bottom==0,wire::statuses::invalidGraph);
    if(n.childAnchor)require(!n.intrinsicSizing&&n.layout.constraintFlags==(wire::layoutChildConstraints::unconstrained|
      wire::layoutConstraintFlags::alignment|wire::layoutConstraintFlags::alignmentSizing),wire::statuses::invalidGraph);
    if(n.intrinsicSizing)require(n.layout.constraintFlags==0&&!n.properties.width&&!n.properties.height,wire::statuses::invalidGraph);
    if(n.layout.positionedFlags)require(n.parent&&n.properties.x==0&&n.properties.y==0&&
      (d.get(n.parent).layout.constraintFlags&wire::layoutConstraintFlags::canonicalStack),wire::statuses::invalidGraph);
    if(n.kind==wire::kinds::box&&(n.layout.constraintFlags&wire::layoutConstraintFlags::expandEmpty))
      require(bool(n.layoutBuilder)||(n.policy&(wire::eventPolicies::mouseRegion|wire::eventPolicies::pointerListener)),wire::statuses::invalidGraph);
    if(n.layoutBuilder)require(n.layout.enabled&&!n.snapshot&&!n.paintOwner&&
      ((n.kind==wire::kinds::box&&n.layout.constraintFlags==(wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::expandEmpty))||
       (n.kind==wire::kinds::sliver&&n.list.generation&&n.parent&&d.get(n.parent).kind==wire::kinds::scrollViewport&&
        (n.list.fixed||n.list.count<=wire::limits::sourceListMetrics)&&
        !(d.get(n.parent).properties.flags&1u)&&n.layout.direction==1&&n.layout.constraintFlags==0&&
        n.layout.gap==0&&n.layout.runGap==0&&n.layout.flex==0&&n.layout.mainSize==0&&n.layout.mainAlign==0&&n.layout.crossAlign==0&&n.properties.x==0&&n.properties.y==0))&&
      n.horizontal.tag==wire::bounds::unbounded&&n.horizontal.min==0&&n.vertical.tag==wire::bounds::unbounded&&n.vertical.min==0&&
      n.properties.width==0&&n.properties.height==0&&
      n.layout.left==0&&n.layout.top==0&&n.layout.right==0&&n.layout.bottom==0,
      wire::statuses::invalidGraph);
    if(n.list.sequential)require(n.layoutBuilder&&n.list.count<=wire::limits::sourceListMetrics,
      wire::statuses::invalidGraph);
    if(n.editorViewport.enabled)require(n.kind==wire::kinds::editable&&n.layout.enabled&&
      (n.layout.constraintFlags&wire::layoutConstraintFlags::paragraphSizing)&&
      ((n.editFlags&wire::editFlags::multiline)||(!n.editorViewport.expands&&
        n.editorViewport.minimumLines==1&&n.editorViewport.maximumLines==1)),wire::statuses::invalidGraph);
    if(n.snapshot)require(n.kind==wire::kinds::box&&n.layout.enabled&&
      n.layout.constraintFlags==wire::layoutChildConstraints::inherit&&!n.paintOwner,wire::statuses::invalidGraph);
    const auto& tap=n.tapRegion;
    if(tap.flags||tap.revision){
      require(n.kind==wire::kinds::box&&n.layout.enabled&&(n.policy&wire::eventPolicies::canonicalHitTest)&&!n.paintOwner,wire::statuses::invalidGraph);
      if(tap.flags==wire::tapRegionFlags::surface)
        require(!tap.surface&&!tap.group&&!tap.revision,wire::statuses::invalidValue);
      else {
        require(!(tap.flags&~126u)&&tap.revision&&tap.surface&&tap.group<=wire::limits::nodes,wire::statuses::invalidValue);
        require(d.get(tap.surface).tapRegion.flags==wire::tapRegionFlags::surface&&d.descends(n.parent,tap.surface),wire::statuses::invalidGraph);
      }
    }
    if(n.imageStyle){require(n.kind==wire::kinds::image&&n.layout.enabled&&bool(n.resource)==bool(n.imageStyle->width),wire::statuses::invalidGraph);
      if(n.resource)if(const auto raw=readRasterImage({n.resource->bytes.data(),n.resource->bytes.size()}))
        require(raw->width==n.imageStyle->width&&raw->height==n.imageStyle->height,wire::statuses::invalidValue);
    }
  }
  uint32_t semantics=0,editors=0;
  d.framePaintGeometry=false;
  std::vector<uint32_t> children(d.nodes.size(), 0);
  Lease ownerScratch(d.lease.ledger,d.nodes.size()*sizeof(Handle));
  std::vector<Handle> paintOwners(d.nodes.size());
  for(const auto& slot:d.nodes)if(slot.value&&slot.value->nativePaint)
    for(const auto& entry:slot.value->nativePaint->entries)if(entry.kind==wire::nativePaintKinds::paragraph){
      const auto& target=d.get(entry.reference);
      require(target.parent==slot.value->id&&target.paintPlacement&&!target.nativePaint,wire::statuses::invalidGraph);
      paintOwners[target.id.slot]=slot.value->id;
    }
  for(auto& slot:d.nodes)if(slot.value&&slot.value->paintOwner!=paintOwners[slot.value->id.slot]){
    auto node=std::make_shared<Node>(*slot.value);node->paintOwner=paintOwners[node->id.slot];slot.value=std::move(node);
  }
  for (auto& list : d.children) list.clear();
  std::set<std::pair<uint64_t, uint32_t>> order;
  for (const auto& slot : d.nodes) if (slot.value) {
    const Node* n = slot.value.get();
    if(n->paragraph&&n->paragraph->value.overflowProbe){
      require((n->kind==wire::kinds::paragraph||(n->kind==wire::kinds::editable&&n->editorViewport.enabled))&&
        n->layout.enabled,wire::statuses::invalidValue);
      const auto& probe=*n->paragraph->value.overflowProbe;
      forParagraphRuns(probe.text,probe.paragraph,[](const auto&,size_t,size_t){});
    }
    if(n->paragraph&&(!n->paragraph->value.runs.empty()||!n->paragraph->value.placeholders.empty())){
      require(n->kind==wire::kinds::paragraph&&bool(n->text),wire::statuses::invalidValue);
      forParagraphRuns(n->text->value,n->paragraph->value,[](const auto&,size_t,size_t){});
      validateParagraphPlaceholders(n->text->value,n->paragraph->value);
    }
    d.framePaintGeometry|=(n->nativePaint&&n->nativePaint->frameDependent)||livePaintPlacement(*n)||n->tooltipPosition.has_value();
    const bool paintChild=n->layout.constraintFlags&wire::layoutConstraintFlags::paintChild;
    require(paintChild==bool(n->paintPlacement),wire::statuses::invalidValue);
    if(paintChild){
      require(!n->paragraph||!n->paragraph->value.inlineChildren(),wire::statuses::invalidGraph);
      require(n->kind==wire::kinds::paragraph&&n->layout.enabled&&n->parent&&!n->semantics&&!n->gestures&&!n->control.kind&&!n->layerLink.role&&
        !(n->policy&~(wire::eventPolicies::canonicalHitTest|wire::eventPolicies::deferToChild))&&
        (n->policy&wire::eventPolicies::deferToChild)&&n->properties.x==0&&n->properties.y==0&&n->layout.constraintFlags==wire::layoutConstraintFlags::paintChild&&
        n->layout.left==0&&n->layout.top==0&&n->layout.right==0&&n->layout.bottom==0,wire::statuses::invalidValue);
      if(n->paintPlacement->reference)for(Handle at=n->paintPlacement->reference;at;at=d.get(at).parent)require(!d.get(at).paintPlacement,wire::statuses::invalidValue);
      const auto& parent=d.get(n->parent);
      require((parent.kind==wire::kinds::box||parent.kind==wire::kinds::stack)&&
        !(parent.layout.constraintFlags&(wire::layoutConstraintFlags::alignmentSizing|wire::layoutConstraintFlags::inlineScale)),wire::statuses::capabilityMissing);
    }
    if(n->semantics)require(++semantics<=wire::limits::semanticsNodes,wire::statuses::budgetExceeded);
    if(n->kind==wire::kinds::editable)require(++editors<=wire::limits::editors,wire::statuses::budgetExceeded);
    d.children[n->parent.slot].push_back(n->id);
    if (n->parent) {
      const auto& parent = d.get(n->parent);
      if(!paintChild)require(++children[parent.id.slot] <= childLimit(parent), wire::statuses::invalidGraph);
      require(order.emplace(parent.id.key(), n->order).second, wire::statuses::invalidGraph);
    }
    uint32_t depth = 0;
    for (const Node* p = n; p->parent; p = &d.get(p->parent)) {
      require(++depth <= wire::limits::depth && p->parent != n->id, wire::statuses::invalidGraph);
    }
  }
  for (auto& list : d.children) std::sort(list.begin(), list.end(), [&](Handle a, Handle b) {
    const auto& first = d.get(a); const auto& second = d.get(b);
    return first.order == second.order ? a.slot < b.slot : first.order < second.order;
  });
  for(const auto& slot:d.nodes)if(slot.value&&slot.value->paragraph&&slot.value->paragraph->value.inlineChildren()){
    const auto& n=*slot.value;
    require(n.kind==wire::kinds::paragraph&&n.layout.enabled&&
      d.children[n.id.slot].size()==n.paragraph->value.placeholders.size(),wire::statuses::invalidGraph);
    for(const auto child:d.children[n.id.slot])require(!d.get(child).paintPlacement,wire::statuses::invalidGraph);
  }
  for(const auto& slot:d.nodes)if(slot.value&&slot.value->layoutProgram){const auto& n=*slot.value;
    require(d.children[n.id.slot].size()==n.layoutProgram->children,wire::statuses::invalidGraph);
    for(const auto child:d.children[n.id.slot])require(!d.get(child).paintPlacement&&!d.get(child).layout.positionedFlags,wire::statuses::invalidGraph);
  }
  std::array<bool,wire::limits::nodes+1> leaders{};
  std::array<bool,wire::limits::nodes+1> visited{};
  std::function<void(Handle)> visit=[&](Handle id){const auto& n=d.get(id);const auto& link=n.layerLink;
    if(n.childAnchor||n.intrinsicSizing)require(d.children[id.slot].size()==1&&!d.get(d.children[id.slot].front()).paintPlacement,wire::statuses::invalidGraph);
    if(n.tooltipPosition){const auto target=n.tooltipPosition->target;
      require(n.kind==wire::kinds::box&&n.layout.enabled&&d.children[id.slot].size()==1&&
        (n.layout.constraintFlags&wire::layoutConstraintFlags::alignmentSizing),wire::statuses::invalidGraph);
      require(!target||(d.contains(target)&&visited[target.slot]&&!d.descends(id,target)),wire::statuses::invalidGraph);
    }
    if(link.role==1)leaders[id.slot]=true;
    if(link.role==2&&link.leader){const auto& leader=d.get(link.leader);
      require(leader.layerLink.role==1&&leaders[link.leader.slot],wire::statuses::invalidGraph);}
    for(const auto child:d.children[id.slot])visit(child);
    visited[id.slot]=true;
  };
  for(const auto root:d.children[0])visit(root);
}
}
Installed transact(const std::shared_ptr<const Document>& current, const Resources& resources,
    Reader body, uint32_t count) {
  require(count <= wire::limits::commands, wire::statuses::budgetExceeded);
  auto d = std::make_shared<Document>(*current);
  Resources staged = resources;
  std::set<uint32_t> dirty;
  const auto edit = [&](Handle h, bool layout = true) {
    const auto& original = d->get(h);
    auto copy = std::make_shared<Node>(original);
    d->nodes[h.slot].value = copy;
    if (layout) dirty.insert(h.slot);
    return copy;
  };
  const auto detach = [&](Handle h) {
    auto node = edit(h);
    const auto parent = node->parent;
    if (parent) dirty.insert(parent.slot);
    const auto old = node->order;
    node->parent = {};
    node->order = 0;
    if (parent) for (auto& slot : d->nodes) if (slot.value && slot.value->parent == parent &&
        slot.value->order > old) --edit(slot.value->id)->order;
  };
  const auto attach = [&](Handle h, Handle parent, uint32_t index, bool moving) {
    d->get(parent);
    require(parent != h, wire::statuses::invalidGraph);
    if (moving) detach(h);
    else require(!d->get(h).parent, wire::statuses::invalidGraph);
    uint32_t children = 0;
    for (const auto& slot : d->nodes) if (slot.value && slot.value->parent == parent) ++children;
    require(index <= children, wire::statuses::invalidGraph);
    for (auto& slot : d->nodes) if (slot.value && slot.value->parent == parent &&
        slot.value->order >= index) ++edit(slot.value->id)->order;
    auto node = edit(h); node->parent = parent; node->order = index;
  };
  size_t position = 0;
  for (uint32_t i = 0; i < count; ++i) {
    body.range(position, 16);
    const auto op = body.u16(position), flags = body.u16(position + 2);
    const auto length = body.u32(position + 4);
    const auto h = handle(body, position + 8);
    require(length >= 16 && length % 8 == 0 && (flags & ~1u) == 0);
    const auto data = body.slice(position + 16, length - 16);
    position += length;
    if (op == wire::commands::create) {
      require(data.length == wire::nodeCreationBytes ||
        (data.length == wire::nodeAttachedCreationBytes && data.u32(wire::nodeCreationFields::reserved) == 0));
      const auto kind = data.u32(0), initial = data.u32(4);
      require((initial & ~7u) == 0 &&
        (!(initial & wire::nodeCreationFlags::inheritChildConstraints) ||
          (initial & wire::nodeCreationFlags::layoutEnabled)), wire::statuses::invalidValue);
      require(h.slot > 0 && h.slot < d->nodes.size() && h.generation > 0 &&
        !d->nodes[h.slot].value && h.generation >= d->nodes[h.slot].generation,
        wire::statuses::invalidHandle);
      require(kind >= wire::kinds::box && kind <= wire::kinds::path, wire::statuses::invalidValue);
      auto n = std::make_shared<Node>(current->lease.ledger);
      n->id = h; n->kind = kind;
      n->layout.enabled = (initial & wire::nodeCreationFlags::layoutEnabled) ? 1u : 0u;
      n->layout.constraintFlags = (initial & wire::nodeCreationFlags::inheritChildConstraints)
        ? wire::layoutChildConstraints::inherit : wire::layoutChildConstraints::loose;
      n->policy = (initial & wire::nodeCreationFlags::canonicalHitTest)
        ? wire::eventPolicies::canonicalHitTest : 0u;
      d->nodes[h.slot] = {h.generation, std::move(n)};
      dirty.insert(h.slot);
      ++d->count;
      d->highWater = std::max(d->highWater, h.slot);
      if (data.length == wire::nodeAttachedCreationBytes)
        attach(h, handle(data, wire::nodeCreationFields::parent), data.u32(wire::nodeCreationFields::index), false);
    } else if (op == wire::commands::properties) {
      require(data.length == 64);
      Properties p{data.f64(0), data.f64(8), data.f64(16), data.f64(24), data.f64(32),
        data.f64(40), data.f64(48), data.u32(56), data.u32(60)};
      require(p.width >= 0 && p.height >= 0 && p.opacity >= 0 && p.opacity <= 1 &&
        p.extent <= wire::extents::unbounded &&
        (p.extent == wire::extents::unbounded ? p.maximum == 0 : p.minimum <= p.maximum) && (p.flags & ~3u) == 0,
        wire::statuses::invalidValue);
      const auto& previous = d->get(h).properties;
      const bool changed = previous.x != p.x || previous.y != p.y ||
        previous.width != p.width || previous.height != p.height ||
        ((previous.flags ^ p.flags) & 1u);
      auto node = edit(h, changed);
      node->properties = p;
      node->contentX = node->contentY = 0;
      node->contentWidth = p.width; node->contentHeight = p.height;
    } else if (op == wire::commands::attach || op == wire::commands::move) {
      require(data.length == 16 && data.u32(12) == 0);
      attach(h, handle(data, 0), data.u32(8), op == wire::commands::move);
    } else if (op == wire::commands::detach) {
      require(data.length == 0); detach(h);
    } else if (op == wire::commands::destroy) {
      require(data.length == 0 ||
        (data.length == 8 && data.u32(0) == wire::nodeDestroyFlags::detach && data.u32(4) == 0));
      if (data.length) detach(h);
      const auto& node = d->get(h);
      require(!node.parent, wire::statuses::invalidGraph);
      require(h.generation != UINT32_MAX, wire::statuses::exhausted);
      d->nodes[h.slot] = {h.generation + 1, nullptr}; --d->count;
    } else if (op == wire::commands::acquireResource) {
      require(data.length >= 8 && data.u32(4) == 0 && data.u32(0) <= data.length - 8 &&
        (data.u32(0) + 7u) / 8u * 8u == data.length - 8);
      require(h.slot > 0 && h.slot < staged.size() && h.generation > 0 &&
        !staged[h.slot].value && h.generation >= staged[h.slot].generation,
        wire::statuses::invalidHandle);
      for (size_t p = 8 + data.u32(0); p < data.length; ++p) require(data.data[p] == 0);
      staged[h.slot] = {h.generation,
        std::make_shared<Resource>(current->lease.ledger, h, data.slice(8, data.u32(0)))};
    } else if (op == wire::commands::releaseResource) {
      require(data.length == 0);
      require(h.slot > 0 && h.slot < staged.size() && staged[h.slot].value &&
        staged[h.slot].value->id == h, wire::statuses::invalidHandle);
      require(h.generation != UINT32_MAX, wire::statuses::exhausted);
      staged[h.slot] = {h.generation + 1, nullptr};
    } else if (op == wire::commands::bindResource) {
      require(data.length == 8);
      const auto resource = handle(data, 0);
      auto node = edit(h);
      if (!resource) { require(resource.generation == 0); node->resource.reset(); }
      else {
        require(resource.slot < staged.size() && staged[resource.slot].value &&
          staged[resource.slot].value->id == resource&&!staged[resource.slot].value->fontCatalog, wire::statuses::invalidHandle);
        node->resource = staged[resource.slot].value;
      }
    } else if(op==wire::commands::paragraphFont){
      auto node=edit(h);require(node->kind==wire::kinds::paragraph||node->kind==wire::kinds::editable,wire::statuses::invalidValue);
      if(data.length==0){node->fontPinned=false;node->fontResource.reset();node->fontRevision=1;}
      else{
        require(data.length==16&&data.u64(8)>0,wire::statuses::invalidValue);const auto resource=handle(data,0);
        if(!resource){require(resource.generation==0);node->fontResource.reset();}
        else{
          require(resource.slot<staged.size()&&staged[resource.slot].value&&staged[resource.slot].value->id==resource&&
            staged[resource.slot].value->fontCatalog,wire::statuses::invalidHandle);node->fontResource=staged[resource.slot].value;
        }
        node->fontPinned=true;node->fontRevision=data.u64(8);
      }
    } else if (op == wire::commands::eventPolicy) {
      require(data.length == 8 && data.u32(4) == 0 && (data.u32(0) & ~1073741823u) == 0);
      const auto policy=data.u32(0),hit=policy&112u;
      require(!(policy&wire::eventPolicies::forceMergeSemantics)||(policy&wire::eventPolicies::semanticsBoundary),wire::statuses::invalidValue);
      require(!(policy&wire::eventPolicies::pointerListener)||(policy&wire::eventPolicies::canonicalHitTest),wire::statuses::invalidValue);
      const auto blocking=policy&(wire::eventPolicies::ignorePointer|wire::eventPolicies::absorbPointer);
      require(!blocking||((policy&wire::eventPolicies::canonicalHitTest)&&(blocking&(blocking-1))==0),wire::statuses::invalidValue);
      require((!hit||(policy&wire::eventPolicies::canonicalHitTest))&&(!hit||(hit&(hit-1))==0),wire::statuses::invalidValue);
      require(!(policy&(wire::eventPolicies::focusEnabled|wire::eventPolicies::skipTraversal))||(policy&wire::eventPolicies::focusOwner),wire::statuses::invalidValue);
      require(!(policy&(wire::eventPolicies::mouseRegion|wire::eventPolicies::mouseOpaque))||
        ((policy&wire::eventPolicies::mouseRegion)&&(policy&wire::eventPolicies::canonicalHitTest)),wire::statuses::invalidValue);
      require(!(policy&wire::eventPolicies::exclusiveMouseRegion)||
        ((policy&wire::eventPolicies::mouseRegion)&&(policy&wire::eventPolicies::canonicalHitTest)),wire::statuses::invalidValue);
      edit(h, false)->policy = data.u32(0);
    } else if (op == wire::commands::motion) {
      require(data.length == 32);
      Motion motion{data.u64(0), data.u64(8), data.f64(16), data.f64(24)};
      require(motion.target >= 0 && motion.target <= 1 && motion.seconds >= 0 &&
        motion.seconds <= 60, wire::statuses::invalidValue);
      const auto& previous = d->get(h).motion;
      require(!motion.id || motion.id != previous.id ||
        (motion.baseRevision == previous.baseRevision && motion.target == previous.target &&
          motion.seconds == previous.seconds), wire::statuses::idReused);
      edit(h, false)->motion = motion;
    } else if(op==wire::commands::graphics) {
      require(data.length>=wire::graphicsBytes&&data.u32(wire::graphicsFields::flags)<=15&&data.u32(wire::graphicsFields::pathCount)<=wire::limits::pathCommands&&
        data.length==wire::graphicsBytes+size_t(data.u32(wire::graphicsFields::pathCount))*wire::graphicsPathBytes,wire::statuses::invalidValue);
      GraphicsStyle style;
      const auto graphicsFlags=data.u32(wire::graphicsFields::flags);
      const Point origin{data.f64(wire::graphicsFields::originX),data.f64(wire::graphicsFields::originY)},
        alignment{data.f64(wire::graphicsFields::alignmentX),data.f64(wire::graphicsFields::alignmentY)};
      require((graphicsFlags&wire::graphicsFlags::hasOrigin)||(origin.x==0&&origin.y==0),wire::statuses::invalidValue);
      require((graphicsFlags&wire::graphicsFlags::hasAlignment)||(alignment.x==0&&alignment.y==0),wire::statuses::invalidValue);
      if(graphicsFlags&wire::graphicsFlags::hasOrigin)style.origin=origin;
      if(graphicsFlags&wire::graphicsFlags::hasAlignment)style.alignment=alignment;
      style.transform={data.f64(0),data.f64(8),data.f64(16),data.f64(24),data.f64(32),data.f64(40)};
      style.shadowX=data.f64(48);style.shadowY=data.f64(56);style.shadowSigma=data.f64(64);
      style.shadowColor=data.u32(72);style.strokeColor=data.u32(76);style.strokeWidth=data.f64(80);style.blur=data.f64(88);
      require(std::abs(style.shadowX)<=8192&&std::abs(style.shadowY)<=8192&&style.shadowSigma>=0&&style.shadowSigma<=64&&
        style.strokeWidth>=0&&style.strokeWidth<=512&&style.blur>=0&&style.blur<=64,wire::statuses::invalidValue);
      std::vector<PathCommand> commands;commands.reserve(data.u32(100));
      for(uint32_t pathIndex=0;pathIndex<data.u32(100);++pathIndex){const size_t at=wire::graphicsBytes+size_t(pathIndex)*wire::graphicsPathBytes;PathCommand command;command.verb=data.u32(at);
        require(command.verb>=1&&command.verb<=5&&data.u32(at+4)==0,wire::statuses::invalidValue);
        const uint32_t coordinates=command.verb<=2?2:command.verb==3?4:command.verb==4?6:0;
        for(uint32_t j=0;j<6;++j){command.values[j]=data.f64(at+8+j*8);
          require(std::abs(command.values[j])<=1e6&&(j<coordinates||command.values[j]==0),wire::statuses::invalidValue);}
        commands.push_back(command);}
      require(commands.empty()||(data.u32(96)&wire::graphicsFlags::hasPath),wire::statuses::invalidValue);
      if(data.u32(96)&wire::graphicsFlags::hasPath)style.path=std::make_shared<GraphicsPath>(current->lease.ledger,std::move(commands),data.u32(96)&wire::graphicsFlags::evenOdd);
      const auto& previous=d->get(h);
      require(!style.path||previous.kind==wire::kinds::path||previous.kind==wire::kinds::clip,wire::statuses::invalidValue);
      if(previous.extensionSize.x>0&&!(data.u32(96)&wire::graphicsFlags::hasPath))style.path=previous.graphics.path;
      edit(h,false)->graphics=std::move(style);
    } else if(op==wire::commands::paintPlacement){
      auto node=edit(h);node->paintPlacement=data.length?readPaintPlacement(current->lease.ledger,data):nullptr;node->paintTransform={};
    } else if(op==wire::commands::nativePaint){
      auto node=edit(h,false);node->nativePaint=data.length?readNativePaint(current->lease.ledger,data):nullptr;
      node->resolvedPaint.reset();
    } else if(op==wire::commands::nativeExtension){
      require(data.length>=24&&data.u32(0)==wire::extensions::sparkline,wire::statuses::capabilityMissing);
      const auto sampleCount=data.u32(4);require(sampleCount>=2&&sampleCount<=256&&data.length==24+size_t(sampleCount)*8,wire::statuses::invalidValue);
      const double width=data.f64(8),height=data.f64(16);require(width>0&&width<=8192&&height>0&&height<=8192,wire::statuses::invalidValue);
      auto node=edit(h);require(node->kind==wire::kinds::path,wire::statuses::invalidValue);
      std::vector<PathCommand> path;path.reserve(sampleCount);
      for(uint32_t sampleIndex=0;sampleIndex<sampleCount;++sampleIndex){const auto value=data.f64(24+size_t(sampleIndex)*8);require(value>=0&&value<=1,wire::statuses::invalidValue);
        path.push_back({sampleIndex?2u:1u,{width*sampleIndex/(sampleCount-1),height*(1-value),0,0,0,0}});}
      node->extensionSize={width,height};node->properties.width=width;node->properties.height=height;node->layout.enabled=0;
      node->graphics.path=std::make_shared<GraphicsPath>(current->lease.ledger,std::move(path),0);
    } else if (op == wire::commands::paint) {
      require(data.length == 16 && data.u32(4) == 0);
      auto n = edit(h, false); n->color = data.u32(0); n->radius = data.f64(8);
      require(n->radius >= 0 && n->radius <= 8192, wire::statuses::invalidValue);
    } else if (op == wire::commands::text) {
      require(data.length >= 24 && data.u32(4) <= 1 && data.u32(20) <= wire::textFlags::styleOnly);
      const bool styleOnly=data.u32(20)&wire::textFlags::styleOnly;
      const auto textLength = data.u32(16);
      require(textLength <= wire::limits::textBytes && textLength <= data.length - 24 &&
        (textLength + 7u) / 8u * 8u == data.length - 24, wire::statuses::budgetExceeded);
      const auto value = data.slice(24, textLength);
      require(validUtf8(value), wire::statuses::invalidValue);
      for (size_t k = 24 + textLength; k < data.length; ++k) require(data.data[k] == 0);
      const auto& previous = d->get(h);
      require(!styleOnly||(textLength==0&&previous.kind==wire::kinds::editable&&current->contains(h)),wire::statuses::invalidValue);
      const auto size = data.f64(8);
      const std::string text(reinterpret_cast<const char*>(value.data), value.length);
      const bool changed = previous.fontSize != size || previous.textDirection != data.u32(4) || (!styleOnly&&(!previous.text || previous.text->value != text));
      auto n = edit(h, changed);
      require(n->kind == wire::kinds::paragraph||n->kind==wire::kinds::editable, wire::statuses::invalidValue);
      if(!styleOnly&&n->kind==wire::kinds::editable&&current->contains(h)){
        const auto& before=current->get(h);
        require(text==(before.text?before.text->value:std::string{}),wire::statuses::baseConflict);
      }
      n->color = data.u32(0); n->fontSize = data.f64(8);
      n->textDirection = data.u32(4);
      require(n->fontSize > 0 && n->fontSize <= 512, wire::statuses::invalidValue);
      if (!styleOnly&&(!n->text || n->text->value != text)) n->text = std::make_shared<TextData>(current->lease.ledger, value);
    } else if(op==wire::commands::childAnchor){
      if(!data.length){edit(h)->childAnchor.reset();continue;}
      require(data.length==48,wire::statuses::invalidValue);std::array<double,6> anchor{};
      for(size_t anchorIndex=0;anchorIndex<anchor.size();++anchorIndex){anchor[anchorIndex]=data.f64(anchorIndex*8);require(std::abs(anchor[anchorIndex])<=(anchorIndex%3==2?1e12:1e6),wire::statuses::invalidValue);}
      edit(h)->childAnchor=anchor;
    } else if(op==wire::commands::layoutProgram){
      edit(h)->layoutProgram=data.length?readLayoutProgram(d->lease.ledger,data):nullptr;
    } else if(op==wire::commands::intrinsicSizing){
      if(!data.length){edit(h)->intrinsicSizing.reset();continue;}
      require(data.length==24&&data.u32(16)<=1&&!data.u32(20),wire::statuses::invalidValue);
      IntrinsicSizingStyle style{data.f64(0),data.f64(8),bool(data.u32(16))};
      require(style.minimumHeight>=0&&style.minimumHeight<=1e12&&style.minimumWidthPerHeight>=0&&style.minimumWidthPerHeight<=1e6,wire::statuses::invalidValue);
      edit(h)->intrinsicSizing=style;
    } else if(op==wire::commands::tooltipPosition){
      if(!data.length){edit(h,false)->tooltipPosition.reset();continue;}
      require(data.length==32&&data.u32(24)<=1&&data.u32(28)==0,wire::statuses::invalidValue);
      TooltipPositionStyle style{handle(data,0),data.f64(8),data.f64(16),bool(data.u32(24))};
      require(bool(style.target.slot)==bool(style.target.generation),wire::statuses::invalidHandle);
      require(std::abs(style.verticalOffset)<=1e12&&style.margin>=0&&style.margin<=1e12,wire::statuses::invalidValue);
      edit(h,false)->tooltipPosition=style;
    } else if(op==wire::commands::layerLink){
      const auto& previous=d->get(h);
      if(!data.length){edit(h,false)->layerLink={};continue;}
      require(previous.kind==wire::kinds::box,wire::statuses::capabilityMissing);
      require(data.length==wire::layerLinkBytes);
      LayerLinkStyle link{data.u32(0),bool(data.u32(4)),handle(data,8),
        {data.f64(16),data.f64(24)},{data.f64(32),data.f64(40)},{data.f64(48),data.f64(56)}};
      require(link.role>=1&&link.role<=2&&data.u32(4)<=1,wire::statuses::invalidValue);
      require(bool(link.leader.slot)==bool(link.leader.generation),wire::statuses::invalidHandle);
      for(const auto value:{link.offset.x,link.offset.y,link.leaderAnchor.x,link.leaderAnchor.y,link.followerAnchor.x,link.followerAnchor.y})
        require(std::abs(value)<=1e12,wire::statuses::invalidValue);
      if(link.role==1)require(!link.showWhenUnlinked&&!link.leader&&!link.offset.x&&!link.offset.y&&
        !link.leaderAnchor.x&&!link.leaderAnchor.y&&!link.followerAnchor.x&&!link.followerAnchor.y,wire::statuses::invalidValue);
      edit(h,false)->layerLink=link;
    } else if(op==wire::commands::tapRegion){
      const auto& before=d->get(h).tapRegion;
      TapRegionStyle style;
      if(data.length){
        require(data.length==wire::tapRegionBytes);
        style={data.u32(0),data.u32(4),handle(data,8),data.u64(16)};
        require(bool(style.surface.slot)==bool(style.surface.generation),wire::statuses::invalidHandle);
        require(style.flags||style.revision,wire::statuses::invalidValue);
        if(before.revision&&style.revision)require(style.revision>=before.revision,wire::statuses::stale);
      }
      const bool layout=before.surface!=style.surface||before.revision!=style.revision||
        ((before.flags^style.flags)&(wire::tapRegionFlags::surface|wire::tapRegionFlags::enabled|wire::tapRegionFlags::consumeOutside));
      edit(h,layout)->tapRegion=style;
    } else if(op==wire::commands::imageStyle){
      const auto& previous=d->get(h);require(previous.kind==wire::kinds::image,wire::statuses::invalidValue);
      auto style=readImageStyle(data);
      const bool layout=bool(style)!=bool(previous.imageStyle)||(style&&previous.imageStyle&&
        (style->scale!=previous.imageStyle->scale||style->width!=previous.imageStyle->width||style->height!=previous.imageStyle->height||
          ((style->flags^previous.imageStyle->flags)&(wire::imageFlags::widthSpecified|wire::imageFlags::heightSpecified))));
      auto node=edit(h,layout);if(node->imageStyle!=style){node->imageStyle=style;node->imagePaint.reset();}
    } else if(op==wire::commands::clipStyle){
      require(d->get(h).kind==wire::kinds::clip,wire::statuses::invalidValue);
      if(!data.length){edit(h,false)->clipStyle.reset();continue;}
      require(data.length==wire::clipStyleBytes&&data.u32(0)<=wire::clipBehaviors::antiAliasWithSaveLayer&&
        data.u32(4)<=wire::clipShapes::circle&&data.u32(8)<=wire::clipStyleFlags::hitTestShape&&!data.u32(12),wire::statuses::invalidValue);
      ClipStyle style;style.behavior=data.u32(0);style.shape=data.u32(4);style.hitTestShape=data.u32(8)!=0;
      for(size_t radiusIndex=0;radiusIndex<style.radii.size();++radiusIndex){style.radii[radiusIndex]=data.f64(16+radiusIndex*8);
        require(style.radii[radiusIndex]>=0&&(style.shape==wire::clipShapes::rrect||style.radii[radiusIndex]==0),wire::statuses::invalidValue);}
      edit(h,false)->clipStyle=std::move(style);
    } else if(op==wire::commands::paragraphOptions){
      const auto& previous=d->get(h);
      require(previous.kind==wire::kinds::paragraph||previous.kind==wire::kinds::editable,wire::statuses::capabilityMissing);
      if(data.length==0)edit(h,bool(previous.paragraph))->paragraph.reset();
      else{auto value=readParagraph(data);const bool changed=!previous.paragraph||previous.paragraph->value!=value;
        auto node=edit(h,changed);if(changed)node->paragraph=std::make_shared<ParagraphData>(current->lease.ledger,std::move(value));}
    } else if(op==wire::commands::editor){
      require((data.length==8||data.length==wire::editorViewportBytes)&&(data.u32(0)&~15u)==0&&
        data.u32(4)>0&&data.u32(4)<=wire::limits::textBytes,wire::statuses::invalidValue);
      auto node=edit(h);require(node->kind==wire::kinds::editable,wire::statuses::invalidValue);
      node->editFlags=data.u32(0);node->maximumLength=data.u32(4);
      node->editorViewport={};
      if(data.length==wire::editorViewportBytes){
        const auto min=data.u32(8),max=data.u32(12),viewportFlags=data.u32(16);
        require(!(viewportFlags&~wire::editorViewportFlags::expands)&&data.u32(20)==0&&
          min<=wire::limits::textBytes&&max<=wire::limits::textBytes&&
          (viewportFlags?(min==0&&max==0):(min>0&&(!max||max>=min))),wire::statuses::invalidValue);
        node->editorViewport={true,bool(viewportFlags),min,max};
      }
    } else if(op==wire::commands::semantics){
      auto value=readSemanticData(current->lease.ledger,data);
      edit(h,false)->semantics=std::move(value);
    } else if (op == wire::commands::layout) {
      require(data.length == wire::layoutBytes);
      LayoutStyle s{data.u32(0), data.u32(4), data.u32(8), data.u32(12), data.u32(16),
        data.u32(20), data.u32(24), data.u32(28), data.f64(32), data.f64(40), data.f64(48),
        data.f64(56), data.f64(64), data.f64(72), data.f64(80),
        data.f64(88), data.f64(96), data.f64(104), data.f64(112),data.f64(120)};
      s.runAlign=data.u32(wire::layoutFields::runAlign);s.textBaseline=data.u32(wire::layoutFields::textBaseline);
      s.positionedFlags=data.u32(wire::layoutFields::positionedFlags);s.overflowClipBehavior=data.u32(wire::layoutFields::overflowClipBehavior);
      for(size_t index=0;index<s.positioned.size();++index){s.positioned[index]=data.f64(wire::layoutFields::positioned+index*8);
        require((s.positionedFlags&(1u<<index))||s.positioned[index]==0,wire::statuses::invalidValue);}
      const auto kind=d->get(h).kind;
      require(s.enabled <= 1 && s.direction <= 1 && s.mainSize <= 1 && s.mainAlign <= 5 &&
        s.crossAlign <= 4 && s.fit <= 1 && s.columns > 0 && s.columns <= 256 && s.constraintFlags <= 262143 &&
        (s.constraintFlags & wire::layoutConstraintFlags::childMask) <= 3 &&
        s.flex >= 0 && s.flex <= 1e6 && ((s.gap >= 0 && s.runGap >= 0)||kind==wire::kinds::wrap) &&
        s.left >= 0 && s.top >= 0 && s.right >= 0 && s.bottom >= 0 &&
        (s.widthFactor == -1 || s.widthFactor >= 0) && (s.heightFactor == -1 || s.heightFactor >= 0)&&
        s.runAlign<=5&&s.textBaseline<=2&&s.positionedFlags<=63&&s.overflowClipBehavior<=3&&
        (!(s.positionedFlags&16u)||s.positioned[4]>=0)&&(!(s.positionedFlags&32u)||s.positioned[5]>=0)&&
        (s.positionedFlags&21u)!=21u&&(s.positionedFlags&42u)!=42u, wire::statuses::invalidValue);
      const auto layoutFlags=s.constraintFlags;
      require(!s.textBaseline||(kind==wire::kinds::flex&&s.direction==0&&s.crossAlign==wire::layoutCrossAlign::baseline),wire::statuses::capabilityMissing);
      require(!s.runAlign||kind==wire::kinds::wrap,wire::statuses::capabilityMissing);
      require(!s.overflowClipBehavior||(layoutFlags&wire::layoutConstraintFlags::clipOverflow),wire::statuses::invalidValue);
      require(!(layoutFlags&wire::layoutConstraintFlags::canonicalStack)||
        (kind==wire::kinds::stack&&(layoutFlags&wire::layoutConstraintFlags::alignment)&&s.left==0&&s.top==0&&s.right==0&&s.bottom==0&&
          !s.mainAlign&&!s.crossAlign&&!s.mainSize&&!s.gap&&!s.runGap),wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::offstage)||
        (kind==wire::kinds::box&&layoutFlags==(wire::layoutConstraintFlags::offstage|wire::layoutChildConstraints::inherit)&&
          s.left==0&&s.top==0&&s.right==0&&s.bottom==0&&s.mainSize==0&&s.mainAlign==0&&s.crossAlign==0&&s.gap==0&&s.runGap==0),wire::statuses::capabilityMissing);
      const bool proxy=kind==wire::kinds::box||kind==wire::kinds::stack||kind==wire::kinds::clip||kind==wire::kinds::transform;
      require(!layoutFlags||s.enabled,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::childMask)||proxy,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::enforceBounds)||proxy||kind==wire::kinds::image,wire::statuses::capabilityMissing);
      require(!(layoutFlags&(wire::layoutConstraintFlags::reverseMain|wire::layoutConstraintFlags::reverseCross))||kind==wire::kinds::flex||kind==wire::kinds::wrap,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::shrinkUnboundedMain)||kind==wire::kinds::flex,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::alignment)||proxy,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::alignmentSizing)||
        (kind==wire::kinds::box&&(layoutFlags&wire::layoutConstraintFlags::alignment)&&
          ((layoutFlags&wire::layoutConstraintFlags::childMask)==0||(layoutFlags&wire::layoutConstraintFlags::childMask)==wire::layoutChildConstraints::unconstrained)&&
          s.left==0&&s.top==0&&s.right==0&&s.bottom==0),wire::statuses::capabilityMissing);
      require((layoutFlags&wire::layoutConstraintFlags::alignment)||(s.alignmentX==0&&s.alignmentY==0),wire::statuses::invalidValue);
      require((layoutFlags&wire::layoutConstraintFlags::alignmentSizing)||(s.widthFactor==-1&&s.heightFactor==-1),wire::statuses::invalidValue);
      require(!(layoutFlags&wire::layoutConstraintFlags::expandEmpty)||kind==wire::kinds::stack||
        (kind==wire::kinds::box&&layoutFlags==(wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::expandEmpty)),
        wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::clipOverflow)||kind==wire::kinds::stack||kind==wire::kinds::flex||kind==wire::kinds::wrap||kind==wire::kinds::paragraph||kind==wire::kinds::editable,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::paintChild)||kind==wire::kinds::paragraph,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::paragraphSizing)||kind==wire::kinds::paragraph||kind==wire::kinds::editable,wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::preferredSize)||(kind==wire::kinds::box&&s.enabled),wire::statuses::capabilityMissing);
      require(!(layoutFlags&wire::layoutConstraintFlags::expandPreferredWidth)||(layoutFlags&wire::layoutConstraintFlags::preferredSize),wire::statuses::invalidValue);
      require(!(layoutFlags&wire::layoutConstraintFlags::inlineScale)||
        (kind==wire::kinds::box&&layoutFlags==wire::layoutConstraintFlags::inlineScale&&
          s.left==0&&s.top==0&&s.right==0&&s.bottom==0&&s.mainSize==0&&s.mainAlign==0&&s.crossAlign==0&&s.inlineScale>=0),wire::statuses::capabilityMissing);
      require((layoutFlags&wire::layoutConstraintFlags::inlineScale)||s.inlineScale==1,wire::statuses::invalidValue);
      require(!(layoutFlags&wire::layoutConstraintFlags::inputPadding)||
        (kind==wire::kinds::box&&layoutFlags==(wire::layoutConstraintFlags::inputPadding|wire::layoutConstraintFlags::enforceBounds|wire::layoutConstraintFlags::alignment)&&
          s.left==0&&s.top==0&&s.right==0&&s.bottom==0&&s.mainSize==0&&s.mainAlign==0&&s.crossAlign==0&&s.alignmentX==0&&s.alignmentY==0),wire::statuses::capabilityMissing);
      edit(h)->layout = s;
    } else if (op == wire::commands::layoutBuilder) {
      if(data.length==0){if(d->get(h).layoutBuilder)edit(h)->layoutBuilder.reset();continue;}
      require(data.length==wire::layoutBuilderBytes,wire::statuses::invalidValue);
      LayoutBuilderStyle value{data.u64(0),data.u64(8),axis(data.slice(16,24)),axis(data.slice(40,24))};
      require(value.revision&&value.builtRevision<=value.revision&&value.horizontal.tag!=wire::bounds::expand&&
        value.vertical.tag!=wire::bounds::expand,wire::statuses::invalidValue);
      if(!value.builtRevision)for(size_t at=16;at<data.length;++at)require(data.data[at]==0,wire::statuses::invalidValue);
      const auto& prior=d->get(h).layoutBuilder;
      require(!prior||value.revision>=prior->revision,wire::statuses::stale);
      edit(h)->layoutBuilder=value;
    } else if (op == wire::commands::snapshot) {
      const auto value=readSnapshotStyle(data);
      const auto& node=d->get(h);
      require(!value||(node.kind==wire::kinds::box&&node.layout.enabled&&
        node.layout.constraintFlags==wire::layoutChildConstraints::inherit),wire::statuses::capabilityMissing);
      edit(h,false)->snapshot=value;
    } else if (op == wire::commands::coverage) {
      require(data.length == 32 && data.u32(24) <= 1 && data.u32(28) == 0);
      Coverage coverage{data.u64(0),data.f64(8),data.f64(16),bool(data.u32(24))};
      const auto& previous = d->get(h);
      require(previous.kind == wire::kinds::scrollViewport && coverage.minimum <= coverage.maximum &&
        coverage.revision > 0, wire::statuses::invalidValue);
      require(coverage.revision > previous.coverage.revision ||
        (coverage.revision == previous.coverage.revision && coverage.minimum == previous.coverage.minimum &&
          coverage.maximum == previous.coverage.maximum && coverage.enabled == previous.coverage.enabled), wire::statuses::stale);
      edit(h,false)->coverage = coverage;
    } else if (op == wire::commands::list) {
      require(data.length==32&&(data.u32(20)==0||data.u32(20)==wire::listFlags::fixedExtent||data.u32(20)==wire::listFlags::sequential));
      ListStyle value{data.u64(0),data.u32(8),data.u32(12),data.u32(16),data.f64(24),
        data.u32(20)==wire::listFlags::fixedExtent,data.u32(20)==wire::listFlags::sequential};
      const auto& prior=d->get(h);
      if(!value.generation){require(!value.count&&!value.begin&&!value.end&&value.estimate==0&&!value.fixed&&!value.sequential);edit(h)->list={};continue;}
      require(prior.kind==wire::kinds::sliver&&value.generation>0&&
        value.generation>=prior.list.generation&&value.count<=1000000&&
        value.begin<=value.end&&value.end<=value.count&&
        value.end-value.begin<=wire::limits::listChildren&&(value.sequential?value.estimate==0:value.estimate>0)&&
        value.estimate*value.count<=1e12,wire::statuses::invalidValue);
      if(prior.list.generation==value.generation&&prior.list.generation)
        require(prior.list.count==value.count&&prior.list.estimate==value.estimate&&prior.list.fixed==value.fixed&&
          prior.list.sequential==value.sequential,wire::statuses::stale);
      edit(h)->list=value;
    } else if (op == wire::commands::listItem) {
      require(data.length==16&&data.u32(4)==0&&(data.u64(8)>0||data.u32(0)==0));
      edit(h)->item={data.u32(0),data.u64(8)};
    } else if (op == wire::commands::gesture) {
      require(data.length==8&&(data.u32(4)&~63u)==0&&(data.u32(0)&~255u)==0);
      auto node=edit(h,false);node->gestures=data.u32(0);node->gestureDevices=data.u32(4);
    } else if (op == wire::commands::control) {
      require(data.length==64);
      ControlStyle value{data.u32(0),data.u32(4)&1u,data.u32(8),data.u32(12),data.u64(16),
        data.f64(24),data.f64(32),data.f64(40),data.f64(48),data.f64(56)};
      value.appearance=data.u32(4)>>1;
      require(value.kind<=wire::controlKinds::activity&&value.appearance<=4&&value.minimum<value.maximum&&
        value.step>=0&&value.value>=value.minimum&&value.value<=value.maximum&&
        value.second>=value.minimum&&value.second<=value.maximum&&
        (value.kind!=wire::controlKinds::rangeSlider||value.second>=value.value),wire::statuses::invalidValue);
      edit(h,false)->control=value;
    } else if (op == wire::commands::constraints) {
      require(data.length == 48);
      auto node = edit(h);
      node->horizontal = axis(data.slice(0, 24)); node->vertical = axis(data.slice(24, 24));
    } else require((flags & 1u) != 0, wire::statuses::incompatible);
  }
  require(position == body.length);
  for(const auto& slot:d->nodes)if(slot.value&&slot.value->fontPinned)
    require(slot.value->paintPlacement&&slot.value->paintPlacement->fontRevision==slot.value->fontRevision,wire::statuses::invalidValue);
  validate(*d);
  validateGraphics(*d);
  d->epoch = next(current->epoch);
  std::set<uint32_t> invalidated;
  for (const auto slot : dirty) if (d->nodes[slot].value) {
    for (auto h = d->nodes[slot].value->id; h && invalidated.insert(h.slot).second; h = d->get(h).parent) {}
  }
  for (const auto slot : invalidated) {
    const auto id = d->nodes[slot].value->id;
    edit(id, false)->layoutRevision = d->epoch;
  }
  return {std::move(d), std::move(staged)};
}
}
