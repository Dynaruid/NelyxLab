// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
void View::updateMouse(const Input& sample,bool hover) {
  if(!sample.snapshot||!active)return;
  mouseSample=sample;mouseSample.snapshot.reset();mouseKnown=true;
  const auto& frame=*sample.snapshot;const auto& geometry=*frame.scene->document;
  std::array<Handle,wire::limits::nodes> nextRegions{};
  std::array<Affine,wire::limits::nodes> nextTransforms{};uint32_t count=0;
  const auto path=frame.pointerPath(sample.x,sample.y);
  for(const auto& entry:path->entries)
    if(geometry.get(entry.node).policy&wire::eventPolicies::mouseRegion){
      require(count<nextRegions.size(),wire::statuses::budgetExceeded);
      nextTransforms[count]=entry.inverse;nextRegions[count++]=entry.node;
    }
  const auto emit=[&](Handle node,uint32_t kind,const Affine& inverse){
    if(!active->document->contains(node))return;
    auto details=gestureDetails(node,0,sample.x,sample.y);details.kind=sample.kind;
    const auto point=inverse.map({sample.x,sample.y});details.localX=point.x;details.localY=point.y;
    details.timestamp=sample.time;details.buttons=sample.buttons;details.flags&=~wire::gestureDetailFlags::semantic;
    gesture(node,kind,sample.sequence,sample.x,sample.y,0,0,&details);
  };
  for(uint32_t i=0;i<mouseRegionCount;++i)
    if(std::find(nextRegions.begin(),nextRegions.begin()+count,mouseRegions[i])==nextRegions.begin()+count)
      emit(mouseRegions[i],wire::gestureKinds::mouseExit,mouseTransforms[i]);
  for(uint32_t i=count;i>0;--i)
    if(std::find(mouseRegions.begin(),mouseRegions.begin()+mouseRegionCount,nextRegions[i-1])==mouseRegions.begin()+mouseRegionCount)
      emit(nextRegions[i-1],wire::gestureKinds::mouseEnter,nextTransforms[i-1]);
  if(hover)for(uint32_t i=0;i<count;++i)emit(nextRegions[i],wire::gestureKinds::mouseHover,nextTransforms[i]);
  mouseRegions=nextRegions;mouseTransforms=nextTransforms;mouseRegionCount=count;
}
void View::refreshMouse() {
  if(!mouseKnown||!published)return;
  auto sample=mouseSample;sample.snapshot=published;sample.metrics=metrics.epoch;
  updateMouse(sample,false);
}
}
