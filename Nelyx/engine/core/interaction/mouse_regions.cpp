// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
void View::updateMouse(const Input& sample,bool hover) {
  if(!sample.snapshot||!active)return;
  mouseSample=sample;mouseSample.snapshot.reset();mouseKnown=true;
  const auto& frame=*sample.snapshot;const auto& geometry=*frame.scene->document;
  std::array<Handle,wire::limits::nodes> nextRegions{};uint32_t count=0;Handle blocker;
  for(auto item=frame.items.rbegin();item!=frame.items.rend();++item){
    const auto& node=geometry.get(item->node);
    if(!frame.allows(node.id)||!frame.hit(*item,sample.x,sample.y))continue;
    if(blocker&&!geometry.descends(blocker,node.id))continue;
    const bool canonical=node.policy&wire::eventPolicies::canonicalHitTest;
    const bool self=!canonical||(node.policy&wire::eventPolicies::hitTestSelf);
    const bool child=blocker&&geometry.descends(blocker,node.id);
    if(node.policy&wire::eventPolicies::mouseRegion){
      if(self||child||(node.policy&wire::eventPolicies::translucent)){
        if(count<nextRegions.size())nextRegions[count++]=node.id;
        if((self||child)&&(node.policy&wire::eventPolicies::mouseOpaque)&&!blocker)blocker=node.id;
      }
    }else if(self&&!blocker)blocker=node.id;
  }
  const auto emit=[&](Handle node,uint32_t kind){
    if(!active->document->contains(node))return;
    auto details=gestureDetails(node,0,sample.x,sample.y);details.kind=sample.kind;
    details.timestamp=sample.time;details.buttons=sample.buttons;details.flags&=~wire::gestureDetailFlags::semantic;
    gesture(node,kind,sample.sequence,sample.x,sample.y,0,0,&details);
  };
  for(uint32_t i=0;i<mouseRegionCount;++i)
    if(std::find(nextRegions.begin(),nextRegions.begin()+count,mouseRegions[i])==nextRegions.begin()+count)
      emit(mouseRegions[i],wire::gestureKinds::mouseExit);
  for(uint32_t i=count;i>0;--i)
    if(std::find(mouseRegions.begin(),mouseRegions.begin()+mouseRegionCount,nextRegions[i-1])==mouseRegions.begin()+mouseRegionCount)
      emit(nextRegions[i-1],wire::gestureKinds::mouseEnter);
  if(hover)for(uint32_t i=0;i<count;++i)emit(nextRegions[i],wire::gestureKinds::mouseHover);
  mouseRegions=nextRegions;mouseRegionCount=count;
}
void View::refreshMouse() {
  if(!mouseKnown||!published)return;
  auto sample=mouseSample;sample.snapshot=published;sample.metrics=metrics.epoch;
  updateMouse(sample,false);
}
}
