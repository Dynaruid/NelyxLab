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
  const auto visit=[&](const auto& self,Handle id,Affine mapping,uint32_t depth,Handle exclusiveRoot,const DrawItem* clipBoundary)->bool {
    require(depth<=wire::limits::depth,wire::statuses::invalidGraph);
    require(++steps<=wire::limits::nodes*(wire::limits::depth+1),wire::statuses::budgetExceeded);
    const auto* item=geometry[id.slot];
    const auto& node=document.get(id);
    const auto point=mapping.map({x,y});
    if(node.policy&wire::eventPolicies::ignorePointer)return false;
    const bool exclusive=node.policy&wire::eventPolicies::exclusiveMouseRegion;
    if(exclusive&&!exclusiveRoot)exclusiveRoot=id;
    // A modal subtree still needs its ancestors as retained path entries.
    if(localRoot&&(node.layout.constraintFlags&wire::layoutConstraintFlags::offstage))return false;
    const bool allowed=localRoot?(id.slot<properties.size()&&properties[id.slot].focusVisible):allows(id);
    if(!item||(!allowed&&!(modalRoot&&!localRoot&&document.descends(modalRoot,id)))||
       (item->opacity<=0&&!(node.policy&wire::eventPolicies::canonicalHitTest))||
       !hit(*item,point.x,point.y,clipBoundary))return false;
    const auto inverse=item->world.inverse();
    if(!inverse)return false;
    bool childHit=false;
    const auto& children=document.children[id.slot];
    const auto output=node.layoutPaintValues;
    if(!(node.policy&wire::eventPolicies::absorbPointer))for(size_t i=0;i<children.size();++i){
      const auto index=node.layoutProgram&&(node.layoutProgram->flags&1u)?i:children.size()-1-i;
      const auto child=children[index];
      if(output&&output->routesDefined){
        const auto& route=output->hitRoutes.at(index);const auto local=inverse->map(point);const auto& r=route.bounds;
        if(!route.enabled||r.width<=0||r.height<=0||local.x<r.x||local.y<r.y||local.x>r.x+r.width||local.y>r.y+r.height)continue;
        const auto* childItem=geometry[child.slot];
        if(childItem){const auto projected=route.projection.map(local);
          childHit=self(self,child,childItem->world*Affine{0,0,0,0,projected.x,projected.y},depth+1,exclusiveRoot,item);}
        // A route chooses exactly one child even when that child's hit fails.
        break;
      }
      if(self(self,child,mapping,depth+1,exclusiveRoot,clipBoundary)){childHit=true;break;}
    }
    if(!childHit&&(node.layout.constraintFlags&wire::layoutConstraintFlags::inputPadding)&&children.size()==1){
      const auto child=children.front();
      const auto* childItem=geometry[child.slot];
      if(childItem){
        const auto& size=document.get(child).properties;
        const auto center=childItem->world.map({size.width/2,size.height/2});
        childHit=self(self,child,Affine{1,0,0,1,center.x-point.x,center.y-point.y}*mapping,depth+1,exclusiveRoot,clipBoundary);
      }
    }
    const bool canonical=node.policy&wire::eventPolicies::canonicalHitTest;
    bool selfHit=allowed&&(!canonical||(node.policy&(wire::eventPolicies::hitTestSelf|wire::eventPolicies::absorbPointer)));
    if(selfHit&&output&&output->selfHitDefined){const auto local=inverse->map(point);
      selfHit=std::any_of(output->selfHitRects.begin(),output->selfHitRects.end(),[&](const Rect& r){return r.width>0&&r.height>0&&local.x>=r.x&&local.y>=r.y&&local.x<r.x+r.width&&local.y<r.y+r.height;});}
    const bool found=childHit||selfHit;
    if((found||(node.policy&wire::eventPolicies::translucent))&&(!exclusive||!exclusiveFound[exclusiveRoot.slot])){
      require(result->entries.size()<wire::limits::nodes,wire::statuses::budgetExceeded);
      result->entries.push_back({id,*inverse*mapping,found});
      if(exclusive)exclusiveFound[exclusiveRoot.slot]=true;
    }
    return found&&(!(node.policy&wire::eventPolicies::mouseRegion)||exclusive||(node.policy&wire::eventPolicies::mouseOpaque));
  };
  if(within)result->hit=visit(visit,within,{},0,{},boundary);
  else for(auto root=document.children[0].rbegin();root!=document.children[0].rend();++root)
    if(visit(visit,*root,{},0,{},boundary)){result->hit=true;break;}
  return result;
}
}
