// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>

namespace nelyx::v2 {
void View::dispatchPointerListeners(const Input& inputSample) {
  auto sample=inputSample;
  if(!sample.snapshot||!published||!active||(sample.phase!=wire::phases::cancel&&
      (sample.metrics!=metrics.epoch||sample.snapshot->scene->metrics.epoch!=metrics.epoch)))return;
  auto& capture=pointerListeners.at(sample.stream);
  const bool pointer=sample.flags&2u,hover=sample.flags&4u;
  std::unique_ptr<PointerPath> current;
  if(!pointer||hover||sample.phase==wire::phases::begin){
    if(pointer&&!hover)cancelPointerListeners(sample.stream);
    current=sample.snapshot->pointerPath(sample.x,sample.y);
    if(pointer&&!hover){
      const auto& capturedDocument=*sample.snapshot->scene->document;
      if(std::any_of(current->entries.begin(),current->entries.end(),[&](const auto& entry){
          return capturedDocument.get(entry.node).policy&wire::eventPolicies::pointerListener;})){
        capture.frame=sample.snapshot;capture.path=std::move(current);
      }
    }
  }
  const auto* path=pointer&&!hover?capture.path.get():current.get();
  const auto frame=pointer&&!hover?capture.frame:sample.snapshot;
  if(!path||!frame)return;
  if(pointer){
    if(sample.phase==wire::phases::update){
      const auto& previous=hover?mouseSample:capture.sample;
      sample.dx=sample.x-previous.x;sample.dy=sample.y-previous.y;
      if(hover&&!mouseKnown)sample.dx=sample.dy=0;
    }else sample.dx=sample.dy=0;
  }
  if(pointer&&!hover){capture.sample=sample;capture.sample.snapshot.reset();}
  const auto raw=rawSample(sample,{},0);
  for(const auto& entry:path->entries){
    if(!(frame->scene->document->get(entry.node).policy&wire::eventPolicies::pointerListener)||
        !active->document->contains(entry.node)||!document->contains(entry.node))continue;
    Event event{wire::events::pointer,wire::statuses::ok,sample.sequence,frame->scene->document->epoch,
      frame->id,entry.node,sample.x,sample.y};
    std::copy(raw.bytes.begin()+8,raw.bytes.end(),event.pointer.input.begin());
    event.pointer.inverse=entry.inverse;interaction(event);
  }
  if(pointer&&!hover&&(sample.phase==wire::phases::end||sample.phase==wire::phases::cancel))capture={};
}
void View::cancelPointerListeners(uint32_t stream) {
  auto& capture=pointerListeners.at(stream);
  if(!capture.path)return;
  auto sample=capture.sample;sample.phase=wire::phases::cancel;sample.buttons=0;
  sample.time=time;sample.dx=sample.dy=0;sample.snapshot=capture.frame;
  dispatchPointerListeners(sample);capture={};
}
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
