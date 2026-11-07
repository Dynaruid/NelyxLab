// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>
namespace nelyx::v2 {
namespace {
bool sameInputNode(const Node& a,const Node& b) {
    const auto ap=a.physicalPaint(),bp=b.physicalPaint();
    if(bool(ap)!=bool(bp)||(ap&&!sameNativePaintHit(*ap,*bp)))return false;
    if(a.parent!=b.parent||a.paintOwner!=b.paintOwner||a.inlineHidden!=b.inlineHidden||a.kind!=b.kind||((a.policy^b.policy)&(120u|wire::eventPolicies::roundedHitTest))||a.properties.width!=b.properties.width||
      a.properties.height!=b.properties.height||a.properties.flags!=b.properties.flags||
      ((a.layout.constraintFlags^b.layout.constraintFlags)&wire::layoutConstraintFlags::inputPadding)||
      ((a.kind==wire::kinds::clip||a.kind==wire::kinds::path)&&
        (a.radius!=b.radius||a.graphics.path!=b.graphics.path||a.clipStyle!=b.clipStyle))||
      ((a.policy&wire::eventPolicies::roundedHitTest)&&a.radius!=b.radius))return false;
    return true;
}
bool sameInputItem(const DrawItem& a,const DrawItem& b) {
  const auto& x=a.world;const auto& y=b.world;
  return a.clip.x==b.clip.x&&a.clip.y==b.clip.y&&a.clip.width==b.clip.width&&a.clip.height==b.clip.height&&
    x.a==y.a&&x.b==y.b&&x.c==y.c&&x.d==y.d&&x.tx==y.tx&&x.ty==y.ty;
}
}
bool Frame::sameInputGeometry(const Frame& other, Handle node)const {
  if(device!=other.device||scene->metrics.epoch!=other.scene->metrics.epoch)return false;
  for(uint32_t depth=0;node&&depth<=wire::limits::depth;++depth){
    if(!scene->document->contains(node)||!other.scene->document->contains(node))return false;
    const auto& a=scene->document->get(node);const auto& b=other.scene->document->get(node);
    if(!sameInputNode(a,b))return false;
    const auto left=std::find_if(items.begin(),items.end(),[&](const auto& item){return item.node==node;});
    const auto right=std::find_if(other.items.begin(),other.items.end(),[&](const auto& item){return item.node==node;});
    if(left==items.end()||right==other.items.end()||!sameInputItem(*left,*right))return false;
    node=a.parent;
  }
  return !node;
}
bool Frame::sharesInputGeometry(const Frame& other)const {
  if(device!=other.device||scene->metrics.epoch!=other.scene->metrics.epoch)return false;
  // Draw items are parent-first. Compare each node/ancestor once rather than
  // doing a full target/ancestor scan for every possible input target.
  std::array<const DrawItem*,wire::limits::nodes+1> nextItems{};
  std::array<bool,wire::limits::nodes+1> matching{};
  for(const auto& item:other.items)nextItems[item.node.slot]=&item;
  for(const auto& item:items){
    const auto& a=scene->document->get(item.node);
    const auto* next=nextItems[item.node.slot];
    if(!next||next->node!=item.node||(a.parent&&!matching[a.parent.slot])||
        !sameInputItem(item,*next)||!sameInputNode(a,other.scene->document->get(item.node)))continue;
    matching[item.node.slot]=true;
    if(other.allows(item.node)&&((a.policy&7u)||a.gestures||a.control.kind||a.kind==wire::kinds::scrollViewport||
        (a.semantics&&(a.semantics->actions&wire::semanticsActions::activate))))return true;
  }
  return false;
}
void validateGraphics(const Document& geometry) {
  std::array<Affine,wire::limits::nodes+1> matrices;
  std::function<void(const Node&,Affine)> visit;
  visit=[&](const Node& node,Affine parent){
    if(node.extensionSize.x>0)require(!node.layout.enabled&&node.properties.width==node.extensionSize.x&&node.properties.height==node.extensionSize.y,wire::statuses::invalidValue);
    const auto leader=node.layerLink.leader;
    const auto world=nodeTransform(node,parent,leader?&geometry.get(leader):nullptr,leader?&matrices[leader.slot]:nullptr);
    matrices[node.id.slot]=world;
    world.bounds({0,0,node.properties.width,node.properties.height});
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),childTransform(node,world));
  };
  for(const auto root:geometry.children[0])visit(geometry.get(root),{});
}
void View::makeDrawItems(Frame& f)const {
  const auto& geometry=*f.scene->document;
  // References may point at descendants. Capture current compositor geometry
  // before evaluating paint; neither App nor Content participates in this pass.
  Lease matrixLease(lease.ledger,geometry.framePaintGeometry?(geometry.highWater+1)*(sizeof(Affine)+sizeof(std::optional<Affine>)):0);
  PaintMatrices matrices(geometry.framePaintGeometry?geometry.highWater+1:0);
  std::vector<std::optional<Affine>> placements(matrices.size());
  if(geometry.framePaintGeometry){
    std::function<void(const Node&,Affine)> capture=[&](const Node& node,Affine parent){
      const auto leader=node.layerLink.leader;
      auto world=nodeTransform(node,parent,leader?&geometry.get(leader):nullptr,leader?&matrices[leader.slot]:nullptr);
      matrices[node.id.slot]=world;
      if(node.kind==wire::kinds::scrollViewport){const auto offset=f.properties[node.id.slot].offset;
        world=world*Affine{1,0,0,1,(node.properties.flags&1u)?-offset:0,(node.properties.flags&1u)?0:-offset};}
      for(const auto child:geometry.children[node.id.slot])capture(geometry.get(child),childTransform(node,world));
    };
    for(const auto root:geometry.children[0])capture(geometry.get(root),{});
    // Paint paragraphs are leaves and references cannot descend through one.
    // Resolve them before any parent stream consumes their current matrices.
    for(const auto& slot:geometry.nodes)if(slot.value&&livePaintPlacement(*slot.value)){
      const auto& node=*slot.value;const auto parent=matrices[node.parent.slot];
      if(parent.inverse()){
        auto& placement=placements[node.id.slot];placement=resolvePaintPlacement(node,geometry,matrices,parent,f.paintWork);++f.placementNodes;
        matrices[node.id.slot]=nodeTransform(node,parent,nullptr,nullptr,&*placement);
      }
    }
  }
  std::array<const DrawItem*,wire::limits::nodes+1> leaders{};
  std::function<void(const Node&,Affine,double,Rect,uint32_t,uint32_t,uint32_t,bool)> visit;
  visit=[&](const Node& node,Affine parent,double alpha,Rect clip,uint32_t head,uint32_t depth,uint32_t hitHead,bool hidden){
    const auto& property=f.properties[node.id.slot];
    const auto& link=node.layerLink;
    const auto leader=link.leader?leaders[link.leader.slot]:nullptr;
    const auto placement=geometry.framePaintGeometry?placements[node.id.slot]:std::optional<Affine>{};
    auto world=nodeTransform(node,parent,leader?&geometry.get(link.leader):nullptr,leader?&leader->world:nullptr,placement?&*placement:nullptr);
    if(geometry.framePaintGeometry)matrices[node.id.slot]=world;
    alpha*=property.opacity;
    hidden|=node.inlineHidden||(link.role==2&&!leader&&!link.showWhenUnlinked);
    if(hidden){alpha=0;clip={};}
    const auto bounds=world.bounds({0,0,node.properties.width,node.properties.height});
    f.properties[node.id.slot].visible=!node.paintOwner&&!hidden&&(alpha>0||(node.policy&wire::eventPolicies::canonicalHitTest))&&world.inverse().has_value();
    bool overflowClip=(node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&node.contentOverflow;
    if(node.kind!=wire::kinds::paragraph&&(node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&!overflowClip)
      for(const auto child:geometry.children[node.id.slot]){const auto& p=geometry.get(child).properties;
        if(p.x<0||p.y<0||p.x+p.width>node.properties.width||p.y+p.height>node.properties.height){overflowClip=true;break;}}
    const auto physical=node.physicalPaint();
    if(node.resolvedPaint)for(const auto& entry:node.resolvedPaint->entries)if(entry.kind==wire::nativePaintKinds::hitRegion){
      f.hitRegions.push_back({world*entry.transform,{0,0,entry.width,entry.height},hitHead});hitHead=uint32_t(f.hitRegions.size());}
    // Paragraph admission uses its box even when forced strut lets children
    // paint beyond it. The hit clip does not set the paint-clipping flags.
    const bool paragraphHit=node.kind==wire::kinds::paragraph&&!node.paintOwner;
    const bool styledClip=node.kind==wire::kinds::clip&&node.clipStyle.has_value();
    const bool clips=(physical&&physical->clip!=0)||(node.kind==wire::kinds::clip&&(!styledClip||node.clipStyle->behavior!=wire::clipBehaviors::none))||node.kind==wire::kinds::scrollViewport||overflowClip;
    if(clips)clip=intersect(clip,bounds);
    if(physical||node.kind==wire::kinds::clip||node.kind==wire::kinds::scrollViewport||overflowClip||paragraphHit){
      // Canonical default rect/rrect/path clippers hit their proxy rectangle;
      // Oval clips its hit geometry even when painting uses Clip.none.
      const bool defaultShape=styledClip&&!overflowClip;
      f.clips.push_back({world,{0,0,node.properties.width,node.properties.height},overflowClip||defaultShape||paragraphHit?0:node.radius,
        defaultShape||paragraphHit?nullptr:node.graphics.path,head,defaultShape&&node.clipStyle->shape==wire::clipShapes::oval});
      head=uint32_t(f.clips.size());
    }
    const bool hardEdge=overflowClip||(physical&&physical->clip==1)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::hardEdge);
    const bool saveLayer=clips&&!overflowClip&&((physical&&physical->clip==3)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::antiAliasWithSaveLayer));
    f.items.push_back({node.id,world.tx,world.ty,alpha,clip,world,bounds,head,depth,
      (clips?wire::nodeFlags::clipsChildren:0u)|(hardEdge?wire::nodeFlags::hardEdgeClip:0u)|
      (overflowClip?wire::nodeFlags::rectangularClip:0u)|(saveLayer?wire::nodeFlags::clipSaveLayer:0u),hitHead});
    if(link.role==2&&leader){auto& item=f.items.back();
      item.linkedOffset=layerOffset(node,geometry.get(link.leader));
      // An offscreen unlinked origin may exceed world bounds even though its
      // linked scene is valid. Observation must never invalidate that frame.
      const Affine base{parent.a,parent.b,parent.c,parent.d,
        parent.a*node.properties.x+parent.c*node.properties.y+parent.tx,
        parent.b*node.properties.x+parent.d*node.properties.y+parent.ty};
      item.layerTransform=world.relativeTo(base);
    }
    if(node.nativePaint&&node.nativePaint->frameDependent&&world.inverse()){
      f.items.back().paint=resolveNodePaint(node,geometry,matrices,f.paintWork);++f.paintNodes;
    }
    if(link.role==1)leaders[node.id.slot]=&f.items.back();
    if((node.policy&4u)&&alpha>0)f.modalRoot=node.id;
    if(node.kind==wire::kinds::scrollViewport)
      world=world*Affine{1,0,0,1,(node.properties.flags&1u)?-property.offset:0,(node.properties.flags&1u)?0:-property.offset};
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),childTransform(node,world),alpha,clip,head,depth+1,hitHead,hidden);
  };
  f.items.reserve(geometry.count);f.clips.reserve(geometry.count);f.hitRegions.reserve(geometry.count);
  for(const auto root:geometry.children[0])visit(geometry.get(root),{},1,{0,0,f.scene->metrics.width,f.scene->metrics.height},0,0,0,false);
}
Handle View::target(double x,double y,const Frame* snapshot)const {
  const auto* frame=snapshot?snapshot:published.get();if(!frame)return {};
  const auto& geometry=*frame->scene->document;
  for(auto it=frame->items.rbegin();it!=frame->items.rend();++it){
    const auto& node=geometry.get(it->node);
    if((it->opacity<=0&&!(node.policy&wire::eventPolicies::canonicalHitTest))||!frame->allows(node.id)||!frame->hit(*it,x,y))continue;
    for(const Node* current=&node;current;current=current->parent?&geometry.get(current->parent):nullptr)
      if(current->kind==wire::kinds::scrollViewport)return current->id;
  }return {};
}
}
