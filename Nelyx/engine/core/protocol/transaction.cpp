// SPDX-License-Identifier: BSD-3-Clause
#include "../scene/document.hpp"
#include <set>
#include <algorithm>
#include "../interaction/editing.hpp"

namespace nelyx::v2 {
namespace {
uint32_t childLimit(uint32_t kind) {
  switch (kind) {
    case wire::kinds::paragraph: case wire::kinds::image: case wire::kinds::editable: case wire::kinds::path: return 0;
    case wire::kinds::box: case wire::kinds::clip: case wire::kinds::transform:
    case wire::kinds::effect: case wire::kinds::scrollViewport: return 1;
    default: return wire::limits::nodes;
  }
}
void validate(Document& d) {
  uint32_t semantics=0,editors=0;
  std::vector<uint32_t> children(d.nodes.size(), 0);
  for (auto& list : d.children) list.clear();
  std::set<std::pair<uint64_t, uint32_t>> order;
  for (const auto& slot : d.nodes) if (slot.value) {
    const Node* n = slot.value.get();
    if(n->semantics)require(++semantics<=wire::limits::semanticsNodes,wire::statuses::budgetExceeded);
    if(n->kind==wire::kinds::editable)require(++editors<=wire::limits::editors,wire::statuses::budgetExceeded);
    d.children[n->parent.slot].push_back(n->id);
    if (n->parent) {
      const auto& parent = d.get(n->parent);
      require(++children[parent.id.slot] <= childLimit(parent.kind), wire::statuses::invalidGraph);
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
      require(data.length == 8 && data.u32(4) == 0);
      const auto kind = data.u32(0);
      require(h.slot > 0 && h.slot < d->nodes.size() && h.generation > 0 &&
        !d->nodes[h.slot].value && h.generation >= d->nodes[h.slot].generation,
        wire::statuses::invalidHandle);
      require(kind >= wire::kinds::box && kind <= wire::kinds::path, wire::statuses::invalidValue);
      auto n = std::make_shared<Node>(current->lease.ledger);
      n->id = h; n->kind = kind;
      d->nodes[h.slot] = {h.generation, std::move(n)};
      dirty.insert(h.slot);
      ++d->count;
      d->highWater = std::max(d->highWater, h.slot);
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
      const auto parent = handle(data, 0);
      d->get(parent);
      require(parent != h, wire::statuses::invalidGraph);
      if (op == wire::commands::move) detach(h);
      else require(!d->get(h).parent, wire::statuses::invalidGraph);
      const auto index = data.u32(8);
      uint32_t children = 0;
      for (const auto& slot : d->nodes) if (slot.value && slot.value->parent == parent) ++children;
      require(index <= children, wire::statuses::invalidGraph);
      for (auto& slot : d->nodes) if (slot.value && slot.value->parent == parent &&
          slot.value->order >= index) ++edit(slot.value->id)->order;
      auto node = edit(h); node->parent = parent; node->order = index;
    } else if (op == wire::commands::detach) {
      require(data.length == 0); detach(h);
    } else if (op == wire::commands::destroy) {
      require(data.length == 0);
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
          staged[resource.slot].value->id == resource, wire::statuses::invalidHandle);
        node->resource = staged[resource.slot].value;
      }
    } else if (op == wire::commands::eventPolicy) {
      require(data.length == 8 && data.u32(4) == 0 && (data.u32(0) & ~7u) == 0);
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
      require(data.length>=104&&data.u32(96)<=3&&data.u32(100)<=wire::limits::pathCommands&&
        data.length==104+size_t(data.u32(100))*56,wire::statuses::invalidValue);
      GraphicsStyle style;
      style.transform={data.f64(0),data.f64(8),data.f64(16),data.f64(24),data.f64(32),data.f64(40)};
      style.shadowX=data.f64(48);style.shadowY=data.f64(56);style.shadowSigma=data.f64(64);
      style.shadowColor=data.u32(72);style.strokeColor=data.u32(76);style.strokeWidth=data.f64(80);style.blur=data.f64(88);
      require(std::abs(style.shadowX)<=8192&&std::abs(style.shadowY)<=8192&&style.shadowSigma>=0&&style.shadowSigma<=64&&
        style.strokeWidth>=0&&style.strokeWidth<=512&&style.blur>=0&&style.blur<=64,wire::statuses::invalidValue);
      std::vector<PathCommand> commands;commands.reserve(data.u32(100));
      for(uint32_t pathIndex=0;pathIndex<data.u32(100);++pathIndex){const size_t at=104+size_t(pathIndex)*56;PathCommand command;command.verb=data.u32(at);
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
      require(data.length >= 24 && data.u32(4) <= 1 && data.u32(20) == 0);
      const auto textLength = data.u32(16);
      require(textLength <= wire::limits::textBytes && textLength <= data.length - 24 &&
        (textLength + 7u) / 8u * 8u == data.length - 24, wire::statuses::budgetExceeded);
      const auto value = data.slice(24, textLength);
      require(validUtf8(value), wire::statuses::invalidValue);
      for (size_t k = 24 + textLength; k < data.length; ++k) require(data.data[k] == 0);
      const auto& previous = d->get(h);
      const auto size = data.f64(8);
      const std::string text(reinterpret_cast<const char*>(value.data), value.length);
      const bool changed = previous.fontSize != size || previous.textDirection != data.u32(4) || !previous.text || previous.text->value != text;
      auto n = edit(h, changed);
      require(n->kind == wire::kinds::paragraph||n->kind==wire::kinds::editable, wire::statuses::invalidValue);
      if(n->kind==wire::kinds::editable&&current->contains(h)){
        const auto& before=current->get(h);
        require(text==(before.text?before.text->value:std::string{}),wire::statuses::baseConflict);
      }
      n->color = data.u32(0); n->fontSize = data.f64(8);
      n->textDirection = data.u32(4);
      require(n->fontSize > 0 && n->fontSize <= 512, wire::statuses::invalidValue);
      if (!n->text || n->text->value != text) n->text = std::make_shared<TextData>(current->lease.ledger, value);
    } else if(op==wire::commands::editor){
      require(data.length==8&&(data.u32(0)&~15u)==0&&data.u32(4)>0&&data.u32(4)<=wire::limits::textBytes,wire::statuses::invalidValue);
      auto node=edit(h,false);require(node->kind==wire::kinds::editable,wire::statuses::invalidValue);
      node->editFlags=data.u32(0);node->maximumLength=data.u32(4);
    } else if(op==wire::commands::semantics){
      require(data.length>=24&&data.u32(20)==0);
      const auto role=data.u32(0),semanticFlags=data.u32(4),actions=data.u32(8),labelLength=data.u32(12),hintLength=data.u32(16);
      require(role<=wire::semanticsRoles::link&&(semanticFlags&~63u)==0&&(actions&~63u)==0&&
        labelLength<=wire::limits::semanticsTextBytes&&hintLength<=wire::limits::semanticsTextBytes&&
        24+((labelLength+hintLength+7)/8)*8==data.length,wire::statuses::invalidValue);
      const auto label=data.slice(24,labelLength),hint=data.slice(24+labelLength,hintLength);
      require(validUtf8(label)&&validUtf8(hint),wire::statuses::invalidValue);
      for(size_t j=24+labelLength+hintLength;j<data.length;++j)require(data.data[j]==0);
      auto node=edit(h,false);
      if(role==0){require(semanticFlags==0&&actions==0&&labelLength==0&&hintLength==0);node->semantics.reset();}
      else node->semantics=std::make_shared<SemanticData>(current->lease.ledger,role,semanticFlags,actions,
        std::string(reinterpret_cast<const char*>(label.data),label.length),std::string(reinterpret_cast<const char*>(hint.data),hint.length));
    } else if (op == wire::commands::layout) {
      require(data.length == 88 && data.u32(28) == 0);
      LayoutStyle s{data.u32(0), data.u32(4), data.u32(8), data.u32(12), data.u32(16),
        data.u32(20), data.u32(24), data.f64(32), data.f64(40), data.f64(48),
        data.f64(56), data.f64(64), data.f64(72), data.f64(80)};
      require(s.enabled <= 1 && s.direction <= 1 && s.mainSize <= 1 && s.mainAlign <= 5 &&
        s.crossAlign <= 4 && s.fit <= 1 && s.columns > 0 && s.columns <= 256 &&
        s.flex >= 0 && s.flex <= 1e6 && s.gap >= 0 && s.runGap >= 0 &&
        s.left >= 0 && s.top >= 0 && s.right >= 0 && s.bottom >= 0, wire::statuses::invalidValue);
      edit(h)->layout = s;
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
      require(data.length==32&&data.u32(20)==0);
      ListStyle value{data.u64(0),data.u32(8),data.u32(12),data.u32(16),data.f64(24)};
      const auto& prior=d->get(h);
      if(!value.generation){require(!value.count&&!value.begin&&!value.end&&value.estimate==0);edit(h)->list={};continue;}
      require(prior.kind==wire::kinds::sliver&&value.generation>0&&
        value.generation>=prior.list.generation&&value.count<=1000000&&
        value.begin<=value.end&&value.end<=value.count&&
        value.end-value.begin<=wire::limits::listChildren&&value.estimate>0&&
        value.estimate*value.count<=1e12,wire::statuses::invalidValue);
      if(prior.list.generation==value.generation&&prior.list.generation)
        require(prior.list.count==value.count&&prior.list.estimate==value.estimate,wire::statuses::stale);
      edit(h)->list=value;
    } else if (op == wire::commands::listItem) {
      require(data.length==16&&data.u32(4)==0&&(data.u64(8)>0||data.u32(0)==0));
      edit(h)->item={data.u32(0),data.u64(8)};
    } else if (op == wire::commands::gesture) {
      require(data.length==8&&data.u32(4)==0&&(data.u32(0)&~255u)==0);
      edit(h,false)->gestures=data.u32(0);
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
