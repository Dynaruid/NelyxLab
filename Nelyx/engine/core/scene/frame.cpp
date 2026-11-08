// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>
namespace nelyx::v2 {
namespace {
bool sameInputNode(const Node& a,const Node& b) {
    const auto ap=a.physicalPaint(),bp=b.physicalPaint();
    if(bool(ap)!=bool(bp)||(ap&&!sameNativePaintHit(*ap,*bp)))return false;
    if(a.parent!=b.parent||a.paintOwner!=b.paintOwner||a.inlineHidden!=b.inlineHidden||a.kind!=b.kind||((a.policy^b.policy)&(120u|wire::eventPolicies::roundedHitTest|wire::eventPolicies::mouseRegion|wire::eventPolicies::mouseOpaque|wire::eventPolicies::exclusiveMouseRegion))||a.properties.width!=b.properties.width||
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
void makeSemantics(Frame& frame,const std::shared_ptr<Ledger>& ledger) {
  const auto& document=*frame.scene->document;
  frame.semantics.resize(document.highWater+1);
  Lease scratch(ledger,(document.highWater+1)*sizeof(uint32_t));
  std::array<uint32_t,wire::limits::nodes+1> begin{};
  std::function<bool(const Node&)> collect=[&](const Node& node){
    // Offstage omits its complete subtree from Source's semantics visitation.
    if(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage)return false;
    bool childBlocks=false;uint32_t index=0;
    if(!(node.policy&wire::eventPolicies::excludeChildSemantics))for(const auto child:document.children[node.id.slot]){
      if(collect(document.get(child))){begin[node.id.slot]=index;childBlocks=true;}
      ++index;
    }
    return bool(node.policy&wire::eventPolicies::blockPreviousSemantics)||
      (!(node.policy&wire::eventPolicies::semanticsBoundary)&&childBlocks);
  };
  // An implicit root is a semantic boundary shared by all scene roots.
  uint32_t rootBegin=0,index=0;
  for(const auto root:document.children[0]){if(collect(document.get(root)))rootBegin=index;++index;}
  std::function<void(const Node&,bool,Handle)> visit;
  visit=[&](const Node& node,bool blocked,Handle mergeTarget){
    blocked|=bool(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage);
    auto& published=frame.semantics[node.id.slot];
    published={};
    published.blocked=blocked;published.data=node.semantics;
    if(node.semantics)for(uint32_t bit=0;bit<8;++bit)
      if(node.semantics->actions&(1u<<bit))published.actionSources[bit]=node.id;
    if(blocked)mergeTarget={};
    if((node.policy&wire::eventPolicies::semanticsBoundary)||
        (node.semantics&&(node.semantics->flags&wire::semanticsFlags::scopesRoute)))mergeTarget={};
    if(!blocked&&node.semantics&&mergeTarget){
      if(node.semantics->role==wire::semanticsRoles::text||
          (node.policy&wire::eventPolicies::mergeSemanticsIntoParent)){
        auto& target=frame.semantics[mergeTarget.slot];
        const auto& parent=*target.data;const auto& child=*node.semantics;
        auto label=parent.label;
        if(!child.label.empty()){if(!label.empty())label+='\n';label+=child.label;}
        require(label.size()<=wire::limits::semanticsTextBytes,wire::statuses::budgetExceeded);
        for(uint32_t bit=0;bit<8;++bit)
          if(!(parent.actions&(1u<<bit))&&(child.actions&(1u<<bit)))target.actionSources[bit]=node.id;
        const auto range=!(parent.actions&wire::semanticsActions::setValue)&&(child.actions&wire::semanticsActions::setValue)?child.range:parent.range;
        target.data=std::make_shared<SemanticData>(ledger,parent.role,parent.flags|child.flags,parent.actions|child.actions,
          std::move(label),parent.hint.empty()?child.hint:parent.hint,parent.value.empty()?child.value:parent.value,
          parent.increasedValue.empty()?child.increasedValue:parent.increasedValue,
          parent.decreasedValue.empty()?child.decreasedValue:parent.decreasedValue,range);
        published.merged=true;
        published.mergedInto=mergeTarget;
      }else mergeTarget={};
    }
    if(!blocked&&!published.merged&&node.semantics&&
        (node.policy&wire::eventPolicies::mergeSemanticsDescendants))mergeTarget=node.id;
    uint32_t childIndex=0;
    for(const auto child:document.children[node.id.slot]){
      visit(document.get(child),blocked||bool(node.policy&wire::eventPolicies::excludeChildSemantics)||childIndex<begin[node.id.slot],mergeTarget);++childIndex;
    }
  };
  index=0;
  for(const auto root:document.children[0]){visit(document.get(root),index<rootBegin,{});++index;}
}
}
void Frame::resolveRoute(const Frame* previous,uint64_t sequence,const std::shared_ptr<Ledger>& ledger) {
  // Routes are edges of the exposed semantic tree, resolved only at publication.
  // Fixed scratch is charged before walking either immutable frame.
  Lease scratch(ledger,2*wire::limits::semanticsNodes*sizeof(Handle));
  std::array<Handle,wire::limits::semanticsNodes> current{},old{};
  uint32_t count=0,oldCount=0;
  const auto exposed=[](const Frame& frame,const auto& visit){
    uint32_t hiddenDepth=UINT32_MAX;
    for(const auto& item:frame.items){
      if(hiddenDepth!=UINT32_MAX&&item.depth>hiddenDepth)continue;
      hiddenDepth=UINT32_MAX;
      const auto* data=frame.semantic(item.node);
      if((!frame.semantics.empty()&&frame.semantics[item.node.slot].blocked)||
          (data&&(data->flags&wire::semanticsFlags::hidden))){hiddenDepth=item.depth;continue;}
      if(data&&frame.allowsSemantics(item.node))visit(item.node,*data);
    }
  };
  const auto collect=[&](const Frame& frame,auto& scopes,uint32_t& size){
    exposed(frame,[&](Handle node,const SemanticData& data){
      if(data.flags&wire::semanticsFlags::scopesRoute){
        require(size<scopes.size(),wire::statuses::budgetExceeded);scopes[size++]=node;
      }
    });
  };
  collect(*this,current,count);if(previous)collect(*previous,old,oldCount);
  route={};route.sequence=sequence;
  const bool unchanged=previous&&count==oldCount&&std::equal(current.begin(),current.begin()+count,old.begin());
  if(unchanged)route.scope=previous->route.scope;
  else for(uint32_t i=0;i<count;++i)
    if(std::find(old.begin(),old.begin()+oldCount,current[i])==old.begin()+oldCount)route.scope=current[i];
  if(!route.scope&&count)route.scope=current[count-1];
  if(route.scope&&(!previous||route.scope!=previous->route.scope||count!=oldCount)){
    require(sequence!=UINT64_MAX,wire::statuses::budgetExceeded);route.sequence=sequence+1;
  }
  if(route.scope)exposed(*this,[&](Handle node,const SemanticData& data){
    if(!route.name&&(data.flags&wire::semanticsFlags::namesRoute)&&!data.label.empty()&&
        scene->document->descends(node,route.scope)){
      route.name=node;route.label=semantics.empty()?scene->document->get(node).semantics:semantics[node.slot].data;
    }
  });
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
  std::function<void(const Node&,Affine,double,Rect,uint32_t,uint32_t,uint32_t,bool,bool)> visit;
  visit=[&](const Node& node,Affine parent,double alpha,Rect clip,uint32_t head,uint32_t depth,uint32_t hitHead,bool hidden,bool offstage){
    const auto& property=f.properties[node.id.slot];
    const auto& link=node.layerLink;
    const auto leader=link.leader?leaders[link.leader.slot]:nullptr;
    const auto placement=geometry.framePaintGeometry?placements[node.id.slot]:std::optional<Affine>{};
    auto world=nodeTransform(node,parent,leader?&geometry.get(link.leader):nullptr,leader?&leader->world:nullptr,placement?&*placement:nullptr);
    if(geometry.framePaintGeometry)matrices[node.id.slot]=world;
    alpha*=property.opacity;
    hidden|=node.inlineHidden||(link.role==2&&!leader&&!link.showWhenUnlinked);
    offstage|=bool(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage);
    if(hidden){alpha=0;clip={};}
    if(offstage)clip={};
    const auto bounds=world.bounds({0,0,node.properties.width,node.properties.height});
    auto& visibility=f.properties[node.id.slot];
    visibility.focusVisible=!node.paintOwner&&!hidden&&(alpha>0||(node.policy&wire::eventPolicies::canonicalHitTest))&&world.inverse().has_value();
    visibility.visible=visibility.focusVisible&&!offstage;
    bool overflowClip=(node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&node.contentOverflow;
    if(node.kind!=wire::kinds::paragraph&&!(node.layout.constraintFlags&wire::layoutConstraintFlags::canonicalStack)&&
        (node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&!overflowClip)
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
    const bool hardEdge=(overflowClip&&node.layout.overflowClipBehavior<=wire::clipBehaviors::hardEdge)||(physical&&physical->clip==1)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::hardEdge);
    const bool saveLayer=clips&&((overflowClip&&node.layout.overflowClipBehavior==wire::clipBehaviors::antiAliasWithSaveLayer)||
      (!overflowClip&&((physical&&physical->clip==3)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::antiAliasWithSaveLayer))));
    f.items.push_back({node.id,world.tx,world.ty,offstage?0:alpha,clip,world,bounds,head,depth,
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
    if(link.role==1&&!offstage&&!hidden)leaders[node.id.slot]=&f.items.back();
    if((node.policy&4u)&&alpha>0&&!offstage)f.modalRoot=node.id;
    if(node.kind==wire::kinds::scrollViewport)
      world=world*Affine{1,0,0,1,(node.properties.flags&1u)?-property.offset:0,(node.properties.flags&1u)?0:-property.offset};
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),childTransform(node,world),alpha,clip,head,depth+1,hitHead,hidden,offstage);
  };
  f.items.reserve(geometry.count);f.clips.reserve(geometry.count);f.hitRegions.reserve(geometry.count);
  for(const auto root:geometry.children[0])visit(geometry.get(root),{},1,{0,0,f.scene->metrics.width,f.scene->metrics.height},0,0,0,false,false);
  makeSemantics(f,lease.ledger);
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
