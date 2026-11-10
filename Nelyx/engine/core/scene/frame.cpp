// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>
#include "semantics_order.hpp"
namespace nelyx::v2 {
namespace {
std::optional<Affine> tooltipPlacement(const Node& node,const Document& document,const PaintMatrices& matrices,Affine world) {
  if(!node.tooltipPosition)return {};
  const auto& style=*node.tooltipPosition;
  if(!style.target||!world.inverse()||!matrices[style.target.slot].inverse())return {};
  for(auto at=style.target;at;at=document.get(at).parent)
    if(document.get(at).inlineHidden||(document.get(at).layout.constraintFlags&wire::layoutConstraintFlags::offstage))return {};
  const auto& target=document.get(style.target).properties;
  const auto& child=document.get(document.children[node.id.slot].front()).properties;
  const auto point=(*world.inverse()*matrices[style.target.slot]).map({target.width/2,target.height/2});
  const auto& size=node.properties;
  const bool below=point.y+style.verticalOffset+child.height<=size.height-style.margin;
  const bool above=point.y-style.verticalOffset-child.height>=style.margin;
  const bool prefer=above==below?style.preferBelow:below;
  const double flexible=size.width-child.width;
  const double x=flexible<=2*style.margin?flexible/2:std::clamp(point.x-child.width/2,style.margin,flexible-style.margin);
  const double y=prefer?std::min(point.y+style.verticalOffset,size.height-style.margin):
    std::max(point.y-style.verticalOffset-child.height,style.margin);
  return Affine{1,0,0,1,x,y};
}
bool sameInputNode(const Node& a,const Node& b) {
    if((a.layoutProgram?a.layoutProgram->flags:0)!=(b.layoutProgram?b.layoutProgram->flags:0))return false;
    const auto sameRect=[](Rect x,Rect y){return x.x==y.x&&x.y==y.y&&x.width==y.width&&x.height==y.height;};
    const auto x=a.layoutPaintValues,y=b.layoutPaintValues;
    const bool xr=x&&x->routesDefined,yr=y&&y->routesDefined,xs=x&&x->selfHitDefined,ys=y&&y->selfHitDefined;
    if(xr!=yr||xs!=ys)return false;
    if(xr){if(x->hitRoutes.size()!=y->hitRoutes.size())return false;
      for(size_t i=0;i<x->hitRoutes.size();++i){const auto& left=x->hitRoutes[i];const auto& right=y->hitRoutes[i];
        if(left.enabled!=right.enabled)return false;if(!left.enabled)continue;
        const auto& p=left.projection;const auto& q=right.projection;
        if(!sameRect(left.bounds,right.bounds)||p.a!=q.a||p.b!=q.b||p.c!=q.c||p.d!=q.d||p.tx!=q.tx||p.ty!=q.ty)return false;}}
    if(xs){if(x->selfHitRects.size()!=y->selfHitRects.size())return false;
      for(size_t i=0;i<x->selfHitRects.size();++i)if(!sameRect(x->selfHitRects[i],y->selfHitRects[i]))return false;}
    const auto ap=a.physicalPaint(),bp=b.physicalPaint();
    if(bool(ap)!=bool(bp)||(ap&&!sameNativePaintHit(*ap,*bp)))return false;
    if(a.parent!=b.parent||a.paintOwner!=b.paintOwner||a.inlineHidden!=b.inlineHidden||a.kind!=b.kind||((a.policy^b.policy)&(120u|wire::eventPolicies::roundedHitTest|wire::eventPolicies::mouseRegion|wire::eventPolicies::mouseOpaque|wire::eventPolicies::exclusiveMouseRegion|wire::eventPolicies::pointerListener|wire::eventPolicies::ignorePointer|wire::eventPolicies::absorbPointer))||a.properties.width!=b.properties.width||
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
// Source SemanticsConfiguration's closed flag word uses seven nullable
// two-bit states, then ordinary booleans. Even equal non-null states conflict.
bool compatibleSemantics(const SemanticData& a,const SemanticData& b) {
  if((a.actions&b.actions)||(a.mergeFlags&b.mergeFlags&0x7fff8000u)||
      ((a.mergeFlags^b.mergeFlags)&0x4000u))return false;
  for(uint32_t shift=0;shift<=12;shift+=2)
    if(((a.mergeFlags>>shift)&3u)&&((b.mergeFlags>>shift)&3u))return false;
  return (a.value.empty()||b.value.empty())&&!(a.explicitRole&&b.explicitRole)&&
    !(a.range.enabled&&b.range.enabled);
}
uint32_t mergeSemanticFlags(uint32_t a,uint32_t b) {
  uint32_t result=(a|b)&0x7fffc000u;
  const auto x=a&3u,y=b&3u;
  result|=x==3||y==3?3u:x==1||y==1?1u:x|y;
  for(uint32_t shift=2;shift<=12;shift+=2){const auto left=(a>>shift)&3u,right=(b>>shift)&3u;
    result|=(left==1||right==1?1u:left|right)<<shift;}
  return result;
}
uint32_t semanticOutputFlags(uint32_t source) {
  uint32_t result=0;
  if(((source>>4)&3u)==2)result|=wire::semanticsFlags::disabled;
  if(source&(1u<<22))result|=wire::semanticsFlags::hidden;
  if((source&3u)==1||((source>>6)&3u)==1)result|=wire::semanticsFlags::checked;
  if((source&3u)==3)result|=wire::semanticsFlags::mixed;
  if(((source>>2)&3u)==1)result|=wire::semanticsFlags::selected;
  if((source>>12)&3u)result|=wire::semanticsFlags::focusable;
  if(source&(1u<<27))result|=wire::semanticsFlags::readOnly;
  if(source&(1u<<20))result|=wire::semanticsFlags::scopesRoute;
  if(source&(1u<<21))result|=wire::semanticsFlags::namesRoute;
  return result;
}
uint32_t semanticOutputRole(const SemanticData& a,const SemanticData& b,uint32_t flags) {
  if(a.declaredRole)return a.role;
  if(b.declaredRole)return b.role;
  if((flags&(1u<<17))&&(flags&3u))return wire::semanticsRoles::radio;
  if(flags&(1u<<15))return wire::semanticsRoles::button;
  if(flags&(1u<<28))return wire::semanticsRoles::link;
  if(flags&(1u<<16))return wire::semanticsRoles::textField;
  if(flags&(1u<<29))return wire::semanticsRoles::slider;
  if((flags>>6)&3u)return wire::semanticsRoles::switchControl;
  if(flags&3u)return wire::semanticsRoles::checkbox;
  return a.role==wire::semanticsRoles::text&&b.role==wire::semanticsRoles::text?
    wire::semanticsRoles::text:wire::semanticsRoles::group;
}
void makeSemantics(Frame& frame,const std::shared_ptr<Ledger>& ledger) {
  const auto& document=*frame.scene->document;
  frame.semantics.resize(document.highWater+1);
  Lease scratch(ledger,(document.highWater+1)*(sizeof(uint32_t)+sizeof(uint8_t)));
  std::array<uint32_t,wire::limits::nodes+1> begin{};
  std::array<uint8_t,wire::limits::nodes+1> forming{};
  std::function<bool(const Node&)> collect=[&](const Node& node){
    if(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage)return false;
    bool childBlocks=false;uint32_t index=0;
    if(!(node.policy&wire::eventPolicies::excludeChildSemantics))for(const auto child:document.children[node.id.slot]){
      if(collect(document.get(child))){begin[node.id.slot]=index;childBlocks=true;}
      ++index;
    }
    return bool(node.policy&wire::eventPolicies::blockPreviousSemantics)||
      (!(node.policy&wire::eventPolicies::semanticsBoundary)&&childBlocks);
  };
  uint32_t rootBegin=0,index=0;
  for(const auto root:document.children[0]){if(collect(document.get(root)))rootBegin=index;++index;}
  const auto appendText=[](const std::string& a,const std::string& b,uint32_t direction,uint32_t otherDirection){
    if(b.empty())return a;
    const bool embed=otherDirection&&direction!=otherDirection;
    require(a.size()+b.size()+(!a.empty()?1:0)+(embed?6:0)<=wire::limits::semanticsTextBytes,wire::statuses::budgetExceeded);
    auto result=a.empty()?std::string{}:a+'\n';
    if(embed)result+=otherDirection==2?"\xe2\x80\xab":"\xe2\x80\xaa";
    result+=b;if(embed)result+="\xe2\x80\xac";return result;
  };
  const auto absorb=[&](Handle owner,Handle fragment,bool forced){
    auto& target=frame.semantics[owner.slot];auto& child=frame.semantics[fragment.slot];
    const auto& a=*target.data;const auto& b=*child.data;
    const auto flags=mergeSemanticFlags(a.mergeFlags,b.mergeFlags);
    for(uint32_t bit=0;bit<8;++bit)
      if(!(a.actions&(1u<<bit))&&(b.actions&(1u<<bit)))target.actionSources[bit]=child.actionSources[bit];
    const auto range=a.range.enabled?a.range:b.range;
    auto metadata=a.metadata;
    if(metadata.identifier.empty())metadata.identifier=b.metadata.identifier;
    if(!metadata.direction)metadata.direction=b.metadata.direction;
    if(!metadata.sort)metadata.sort=b.metadata.sort;
    auto sources=std::make_shared<SemanticCustomSources>(ledger);
    if(target.customSources)sources->values=target.customSources->values;
    const bool ownHints=!forced&&std::any_of(metadata.custom.begin(),metadata.custom.end(),[](const auto& action){return action.hintOverride;});
    for(auto action:b.metadata.custom){
      if(ownHints&&action.hintOverride){if(!action.invokable)continue;action.hintOverride=false;}
      const auto found=std::find_if(metadata.custom.begin(),metadata.custom.end(),[&](const auto& value){return value.id==action.id;});
      if(found==metadata.custom.end())metadata.custom.push_back(action);
      else {require(found->label==action.label&&found->hint==action.hint&&found->overrideAction==action.overrideAction,wire::statuses::invalidValue);found->invokable|=action.invokable;found->hintOverride|=action.hintOverride;}
    }
    require(metadata.custom.size()<=wire::limits::semanticsCustomActions,wire::statuses::budgetExceeded);
    std::sort(metadata.custom.begin(),metadata.custom.end(),[](const auto& a,const auto& b){return a.id<b.id;});
    if(child.customSources)for(const auto& entry:child.customSources->values){
      const auto found=std::find_if(sources->values.begin(),sources->values.end(),[&](const auto& value){return value.first==entry.first;});
      if(found==sources->values.end())sources->values.push_back(entry);else if(!forced)found->second=entry.second;
    }
    target.customSources=sources->values.empty()?nullptr:std::move(sources);
    target.data=std::make_shared<SemanticData>(ledger,semanticOutputRole(a,b,flags),semanticOutputFlags(flags),a.actions|b.actions,
      appendText(a.label,b.label,metadata.direction,b.metadata.direction),appendText(a.hint,b.hint,metadata.direction,b.metadata.direction),a.value.empty()?b.value:a.value,
      a.increasedValue.empty()?b.increasedValue:a.increasedValue,
      a.decreasedValue.empty()?b.decreasedValue:a.decreasedValue,range,flags,
      1u|((a.explicitRole||b.explicitRole)?2u:0u)|((a.declaredRole||b.declaredRole)?4u:0u),std::move(metadata));
    child.merged=true;child.mergedInto=owner;
  };
  using Fragments=std::vector<Handle,LedgerAllocator<Handle>>;
  uint32_t semanticCount=0;
  std::function<Fragments(const Node&,bool,bool,bool,bool)> visit;
  visit=[&](const Node& node,bool blocked,bool blockActions,bool parentExplicit,bool root)->Fragments{
    blockActions|=bool(node.policy&wire::eventPolicies::blockSemanticActions);
    blocked|=bool(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage);
    auto& published=frame.semantics[node.id.slot];published={};
    published.blocked=blocked;published.data=node.semantics;
    if(blockActions&&published.data){const auto& data=*published.data;auto range=data.range;range.readOnly=true;
      published.data=std::make_shared<SemanticData>(ledger,data.role,data.flags,0,data.label,data.hint,data.value,
        data.increasedValue,data.decreasedValue,range,data.mergeFlags,
        1u|(data.explicitRole?2u:0u)|(data.declaredRole?4u:0u),data.metadata);}
    const bool boundary=bool(node.policy&wire::eventPolicies::semanticsBoundary)||
      (published.data&&bool(published.data->flags&wire::semanticsFlags::scopesRoute));
    const bool contributes=bool(published.data)||boundary||root;
    const bool force=bool(node.policy&wire::eventPolicies::forceMergeSemantics);
    const bool legacyBoundary=published.data&&published.data->role!=wire::semanticsRoles::text&&
      !(node.policy&(wire::eventPolicies::mergeSemanticsIntoParent|wire::eventPolicies::mergeSemanticsDescendants));
    const bool explicitChildren=root||bool(node.policy&wire::eventPolicies::explicitChildSemantics)||
      (published.data&&!force&&!(node.policy&wire::eventPolicies::mergeSemanticsDescendants))||
      (!contributes&&parentExplicit);
    Fragments fragments{LedgerAllocator<Handle>{ledger}};
    uint32_t childIndex=0;
    for(const auto child:document.children[node.id.slot]){
      auto collected=visit(document.get(child),blocked||bool(node.policy&wire::eventPolicies::excludeChildSemantics)||
        childIndex<begin[node.id.slot],blockActions,explicitChildren,false);
      fragments.insert(fragments.end(),collected.begin(),collected.end());++childIndex;
    }
    if(blocked||!contributes)return fragments;
    require(++semanticCount<=wire::limits::semanticsNodes,wire::statuses::budgetExceeded);
    if(!published.data)published.data=std::make_shared<SemanticData>(ledger,wire::semanticsRoles::group,0,0,
      std::string{},std::string{},std::string{},std::string{},std::string{},SemanticRangeData{});
    for(uint32_t bit=0;bit<8;++bit)if(published.data->actions&(1u<<bit))published.actionSources[bit]=node.id;
    if(published.data->actions&wire::semanticsActions::custom){
      auto sources=std::make_shared<SemanticCustomSources>(ledger);
      for(const auto& action:published.data->metadata.custom)if(action.invokable)sources->values.emplace_back(action.id,node.id);
      if(!sources->values.empty())published.customSources=std::move(sources);
    }
    forming[node.id.slot]=root||boundary||legacyBoundary||parentExplicit;
    // Compare the original configurations before any absorption. A conflicting
    // sibling pair must keep BOTH nodes; greedy merging loses the first row.
    if(!force){
      for(size_t i=0;i<fragments.size();++i){const auto child=fragments[i];if(forming[child.slot]==1)continue;
        if(!compatibleSemantics(*published.data,*frame.semantics[child.slot].data))forming[child.slot]=2;
        for(size_t j=0;j<i;++j){const auto sibling=fragments[j];if(forming[sibling.slot]==1)continue;
          if(!compatibleSemantics(*frame.semantics[child.slot].data,*frame.semantics[sibling.slot].data)){
            forming[child.slot]=2;forming[sibling.slot]=2;
          }
        }
      }
    }
    for(const auto child:fragments)if(force||!forming[child.slot])absorb(node.id,child,force);
    fragments.erase(std::remove_if(fragments.begin(),fragments.end(),[&](Handle child){
      if(forming[child.slot]==2)forming[child.slot]=1;
      return frame.semantics[child.slot].merged;
    }),fragments.end());
    fragments.insert(fragments.begin(),node.id);
    return fragments;
  };
  index=0;
  for(const auto root:document.children[0]){visit(document.get(root),index<rootBegin,false,true,true);++index;}
  for(auto& entry:frame.semantics)if(entry.merged){
    uint32_t depth=0;
    while(frame.semantics[entry.mergedInto.slot].merged){
      require(++depth<=wire::limits::depth,wire::statuses::budgetExceeded);
      entry.mergedInto=frame.semantics[entry.mergedInto.slot].mergedInto;
    }
  }
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
  Lease matrixLease(geometry.lease.ledger,(geometry.highWater+1)*sizeof(Affine));
  PaintMatrices matrices(geometry.highWater+1);
  std::function<void(const Node&,Affine)> visit;
  visit=[&](const Node& node,Affine parent){
    if(node.extensionSize.x>0)require(!node.layout.enabled&&node.properties.width==node.extensionSize.x&&node.properties.height==node.extensionSize.y,wire::statuses::invalidValue);
    const auto leader=node.layerLink.leader;
    const auto world=nodeTransform(node,parent,leader?&geometry.get(leader):nullptr,leader?&matrices[leader.slot]:nullptr);
    matrices[node.id.slot]=world;
    world.bounds({0,0,node.properties.width,node.properties.height});
    const auto placement=tooltipPlacement(node,geometry,matrices,world);
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),childTransform(node,placement?world*(*placement):world));
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
      const auto placement=tooltipPlacement(node,geometry,matrices,world);
      for(const auto child:geometry.children[node.id.slot])capture(geometry.get(child),childTransform(node,placement?world*(*placement):world));
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
    const auto tooltip=node.tooltipPosition?tooltipPlacement(node,geometry,matrices,world):std::optional<Affine>{};
    alpha*=property.opacity;
    hidden|=node.inlineHidden||(link.role==2&&!leader&&!link.showWhenUnlinked);
    hidden|=node.tooltipPosition.has_value()&&!tooltip;
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
        defaultShape||paragraphHit?nullptr:node.graphics.path,head,false,{}});
      if(defaultShape){auto& shape=f.clips.back();const auto& style=*node.clipStyle;
        shape.oval=style.shape==wire::clipShapes::oval||style.shape==wire::clipShapes::circle;
        if(style.shape==wire::clipShapes::circle){const double size=std::min(shape.bounds.width,shape.bounds.height);
          shape.bounds={(shape.bounds.width-size)/2,(shape.bounds.height-size)/2,size,size};}
        else if(style.hitTestShape&&(style.shape==wire::clipShapes::rrect||style.shape==wire::clipShapes::stadium)){
          auto radii=style.radii;if(style.shape==wire::clipShapes::stadium)radii.fill(std::min(shape.bounds.width,shape.bounds.height)/2);
          shape.radii=normalizedRadii(radii,shape.bounds.width,shape.bounds.height);}}
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
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),childTransform(node,tooltip?world*(*tooltip):world),alpha,clip,head,depth+1,hitHead,hidden,offstage);
  };
  f.items.reserve(geometry.count);f.clips.reserve(geometry.count);f.hitRegions.reserve(geometry.count);
  for(const auto root:geometry.children[0])visit(geometry.get(root),{},1,{0,0,f.scene->metrics.width,f.scene->metrics.height},0,0,0,false,false);
  // Semantic text/custom-action merging is a document operation. Scroll and
  // control properties still get fresh geometry and visibility above.
  const auto* previous=published&&published->scene==f.scene?published.get():nullptr;
  if(previous)f.semantics=previous->semantics;
  else makeSemantics(f,lease.ledger);
  bool sameOrder=previous&&previous->items.size()==f.items.size()&&previous->modalRoot==f.modalRoot;
  if(sameOrder){
    Lease scratch(lease.ledger,(geometry.highWater+1)*sizeof(std::optional<Point>));
    std::vector<std::optional<Point>> translations(geometry.highWater+1);
    for(size_t i=0;i<f.items.size()&&sameOrder;++i){
      const auto& item=f.items[i];const auto& old=previous->items[i];
      if(item.node!=old.node){sameOrder=false;break;}
      const auto* semantic=f.semantic(item.node);
      if(!semantic||(semantic->flags&wire::semanticsFlags::hidden))continue;
      const bool exposed=f.allowsSemantics(item.node)&&item.opacity>0;
      if(exposed!=(previous->allowsSemantics(old.node)&&old.opacity>0)){sameOrder=false;break;}
      if(!exposed)continue;
      const auto& a=item.world;const auto& b=old.world;
      if(a.a!=b.a||a.b!=b.b||a.c!=b.c||a.d!=b.d){sameOrder=false;break;}
      auto& translation=translations[f.semantics[item.node.slot].parent.slot];
      const Point delta{a.tx-b.tx,a.ty-b.ty};
      if(translation&&(translation->x!=delta.x||translation->y!=delta.y)){sameOrder=false;break;}
      translation=delta;
    }
  }
  if(!sameOrder){
    for(auto& semantic:f.semantics){semantic.parent={};semantic.traversal=UINT32_MAX;}
    orderSemantics(f,lease.ledger);
  }
}
Handle View::target(double x,double y,const Frame* snapshot)const {
  const auto* frame=snapshot?snapshot:published.get();if(!frame)return {};
  const auto& geometry=*frame->scene->document;
  for(auto it=frame->items.rbegin();it!=frame->items.rend();++it){
    const auto& node=geometry.get(it->node);
    if((it->opacity<=0&&!(node.policy&wire::eventPolicies::canonicalHitTest))||!frame->allows(node.id)||!frame->hit(*it,x,y))continue;
    Handle first;
    for(const Node* current=&node;current;current=current->parent?&geometry.get(current->parent):nullptr)
      if(current->kind==wire::kinds::scrollViewport||current->editorViewport.enabled){
        if(!first)first=current->id;
        if(current->properties.extent==wire::extents::unbounded||current->properties.maximum-current->properties.minimum>1e-6)return current->id;
      }
    if(first)return first;
  }return {};
}
}
