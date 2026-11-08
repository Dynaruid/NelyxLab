// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
std::unique_ptr<PointerPath> Frame::pointerPath(double x,double y,Handle within,bool localRoot) const {
  require(scene&&scene->document,wire::statuses::notFound);
  const auto& document=*scene->document;
  require(!within||document.contains(within),wire::statuses::invalidHandle);
  require(!localRoot||bool(within),wire::statuses::invalidValue);
  auto result=std::make_unique<PointerPath>(document.lease.ledger,wire::limits::nodes);
  Lease scratch(document.lease.ledger,(wire::limits::nodes+1)*(sizeof(const DrawItem*)+sizeof(bool)));
  std::array<const DrawItem*,wire::limits::nodes+1> geometry{};
  std::array<bool,wire::limits::nodes+1> exclusiveFound{};
  for(const auto& item:items)geometry[item.node.slot]=&item;
  DrawItem rootBoundary;
  if(localRoot){const auto parent=document.get(within).parent;const auto* item=parent?geometry[parent.slot]:nullptr;
    if(item){rootBoundary.clipHead=item->clipHead;rootBoundary.hitHead=item->hitHead;}}
  const auto* boundary=localRoot?&rootBoundary:nullptr;
  uint32_t steps=0;
  const auto visit=[&](const auto& self,Handle id,Point point,Point shift,uint32_t depth,Handle exclusiveRoot)->bool {
    require(depth<=wire::limits::depth,wire::statuses::invalidGraph);
    require(++steps<=wire::limits::nodes*(wire::limits::depth+1),wire::statuses::budgetExceeded);
    const auto* item=geometry[id.slot];
    const auto& node=document.get(id);
    const bool exclusive=node.policy&wire::eventPolicies::exclusiveMouseRegion;
    if(exclusive&&!exclusiveRoot)exclusiveRoot=id;
    // A modal subtree still needs its ancestors as retained path entries.
    if(localRoot&&(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage))return false;
    const bool allowed=localRoot?(id.slot<properties.size()&&properties[id.slot].focusVisible):allows(id);
    if(!item||(!allowed&&!(modalRoot&&!localRoot&&document.descends(modalRoot,id)))||
       (item->opacity<=0&&!(node.policy&wire::eventPolicies::canonicalHitTest))||
       !hit(*item,point.x,point.y,boundary))return false;
    const auto inverse=item->world.inverse();
    if(!inverse)return false;
    bool childHit=false;
    const auto& children=document.children[id.slot];
    for(auto child=children.rbegin();child!=children.rend();++child)
      if(self(self,*child,point,shift,depth+1,exclusiveRoot)){childHit=true;break;}
    if(!childHit&&(node.layout.constraintFlags&wire::layoutConstraintFlags::inputPadding)&&children.size()==1){
      const auto child=children.front();
      const auto* childItem=geometry[child.slot];
      if(childItem){
        const auto& size=document.get(child).properties;
        const auto center=childItem->world.map({size.width/2,size.height/2});
        childHit=self(self,child,center,{shift.x+center.x-point.x,shift.y+center.y-point.y},depth+1,exclusiveRoot);
      }
    }
    const bool canonical=node.policy&wire::eventPolicies::canonicalHitTest;
    const bool selfHit=allowed&&(!canonical||(node.policy&wire::eventPolicies::hitTestSelf));
    const bool found=childHit||selfHit;
    if((found||(node.policy&wire::eventPolicies::translucent))&&(!exclusive||!exclusiveFound[exclusiveRoot.slot])){
      require(result->entries.size()<wire::limits::nodes,wire::statuses::budgetExceeded);
      result->entries.push_back({id,*inverse*Affine{1,0,0,1,shift.x,shift.y},found});
      if(exclusive)exclusiveFound[exclusiveRoot.slot]=true;
    }
    return found&&(!(node.policy&wire::eventPolicies::mouseRegion)||exclusive||(node.policy&wire::eventPolicies::mouseOpaque));
  };
  if(within)result->hit=visit(visit,within,{x,y},{},0,{});
  else for(auto root=document.children[0].rbegin();root!=document.children[0].rend();++root)
    if(visit(visit,*root,{x,y},{},0,{})){result->hit=true;break;}
  return result;
}
}
