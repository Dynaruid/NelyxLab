// SPDX-License-Identifier: BSD-3-Clause
// Native callback details and default recognizer rules for canonical Widgets.
#include "../state.hpp"
#include <algorithm>
#include <cmath>

namespace nelyx::v2 {
namespace {
constexpr uint32_t dragMask=wire::gestures::panX|wire::gestures::panY;
uint32_t streamIndex(const View& view,const Stream& stream){return uint32_t(&stream-view.streams.data());}
Point estimateVelocity(const Stream& stream,double now,bool fling) {
  if(!stream.motionCount)return {};
  const auto& newest=stream.motionSamples[(stream.motionCount-1)%20];
  if(now-newest.at>0.04)return {};
  double matrix[3][3]{},bx[3]{},by[3]{};
  uint32_t count=0;auto previous=newest,oldest=newest;
  for(uint32_t i=0;i<std::min(stream.motionCount,20u);++i){
    const auto& sample=stream.motionSamples[(stream.motionCount-1-i)%20];
    const double age=(newest.at-sample.at)*1000;
    if(age>100||std::abs(sample.at-previous.at)>0.04)break;
    previous=oldest=sample;++count;const double t=-age,v[3]{1,t,t*t};
    for(uint32_t row=0;row<3;++row){bx[row]+=v[row]*sample.x;by[row]+=v[row]*sample.y;
      for(uint32_t col=0;col<3;++col)matrix[row][col]+=v[row]*v[col];}
  }
  if(count<3)return {};
  for(uint32_t col=0;col<3;++col){
    uint32_t pivot=col;for(uint32_t row=col+1;row<3;++row)if(std::abs(matrix[row][col])>std::abs(matrix[pivot][col]))pivot=row;
    if(std::abs(matrix[pivot][col])<1e-9)return {};
    if(pivot!=col){for(uint32_t k=0;k<3;++k)std::swap(matrix[pivot][k],matrix[col][k]);std::swap(bx[pivot],bx[col]);std::swap(by[pivot],by[col]);}
    const double divisor=matrix[col][col];for(uint32_t k=col;k<3;++k)matrix[col][k]/=divisor;bx[col]/=divisor;by[col]/=divisor;
    for(uint32_t row=0;row<3;++row)if(row!=col){const double factor=matrix[row][col];
      for(uint32_t k=col;k<3;++k)matrix[row][k]-=factor*matrix[col][k];bx[row]-=factor*bx[col];by[row]-=factor*by[col];}
  }
  Point velocity{bx[1]*1000,by[1]*1000};
  if(!std::isfinite(velocity.x)||!std::isfinite(velocity.y))return {};
  if(!fling)return velocity;
  const double slop=stream.kind==wire::pointerKinds::mouse?1:18;
  if(stream.dragAxis==1){if(std::abs(velocity.x)<=50||std::abs(newest.x-oldest.x)<=slop)return {};return {std::clamp(velocity.x,-8000.0,8000.0),0};}
  if(stream.dragAxis==2){if(std::abs(velocity.y)<=50||std::abs(newest.y-oldest.y)<=slop)return {};return {0,std::clamp(velocity.y,-8000.0,8000.0)};}
  const double speed=std::hypot(velocity.x,velocity.y);
  if(speed<=50||std::hypot(newest.x-oldest.x,newest.y-oldest.y)<=slop)return {};
  if(speed>8000){velocity.x*=8000/speed;velocity.y*=8000/speed;}return velocity;
}
}
GestureDetails View::gestureDetails(Handle node,uint32_t index,double x,double y)const {
  GestureDetails details;
  if(!active||!active->document->contains(node)||!(active->document->get(node).policy&wire::eventPolicies::canonicalGestures))return details;
  const Frame* snapshot=published.get();
  const Stream* captured=nullptr;
  if(index&&index<streams.size()){
    const auto& stream=streams[index];
    captured=&stream;
    for(const auto& frame:stream.capturedPublications)if(frame&&(!snapshot||frame->id>snapshot->id))snapshot=frame.get();
    details.kind=stream.kind;details.stream=index;details.timestamp=stream.sampleAt;details.buttons=stream.buttons;
    details.deltaX=stream.deltaX;details.deltaY=stream.deltaY;details.velocityX=stream.velocityX;details.velocityY=stream.velocityY;
    details.originX=stream.startX;details.originY=stream.startY;
    if(stream.dragAxis==1){details.flags|=wire::gestureDetailFlags::horizontal;details.deltaY=0;}
    if(stream.dragAxis==2){details.flags|=wire::gestureDetailFlags::vertical;details.deltaX=0;}
  }else{details.timestamp=time;details.originX=x;details.originY=y;details.flags|=wire::gestureDetailFlags::semantic;}
  if(!snapshot&&!(captured&&captured->pointerInverseValid))return {};
  const auto local=captured&&captured->pointerInverseValid?std::optional<Point>(captured->pointerInverse.map({x,y})):snapshot->local(node,x,y);
  const auto origin=captured&&captured->pointerInverseValid?std::optional<Point>(captured->pointerInverse.map({details.originX,details.originY})):snapshot->local(node,details.originX,details.originY);
  if(!local||!origin)return {};
  details.localX=local->x;details.localY=local->y;details.localOriginX=origin->x;details.localOriginY=origin->y;
  details.flags|=wire::gestureDetailFlags::valid;return details;
}
void View::canonicalCancel(Stream& stream,uint64_t sequence) {
  if(!active||!active->document->contains(stream.target))return;
  const auto& node=active->document->get(stream.target);
  if(!(node.policy&wire::eventPolicies::canonicalGestures))return;
  const auto index=streamIndex(*this,stream);
  if(!stream.tapCanceled){stream.tapCanceled=true;if(stream.tapDownSent)gesture(stream.target,wire::gestureKinds::tapCancel,sequence,stream.x,stream.y,0,index);}
  if(!stream.longCanceled&&!stream.longSent&&(node.gestures&wire::gestures::longPress)){stream.longCanceled=true;gesture(stream.target,wire::gestureKinds::longPressCancel,sequence,stream.x,stream.y,0,index);}
  if(!stream.dragCanceled&&(node.gestures&dragMask)){stream.dragCanceled=true;
    if(stream.pan&&stream.dragAxis!=4){const auto velocity=estimateVelocity(stream,time,true);stream.velocityX=velocity.x;stream.velocityY=velocity.y;gesture(stream.target,wire::gestureKinds::panEnd,sequence,stream.x,stream.y,0,index);}
    else gesture(stream.target,wire::gestureKinds::dragCancel,sequence,stream.x,stream.y,0,index);
  }
}
void View::finishCanonicalTap(bool accepted) {
  if(!lastTap||(lastTapDetails.flags&wire::gestureDetailFlags::valid)==0)return;
  const auto node=lastTap;
  if(accepted&&!lastTapDownSent){auto down=lastTapDetails;down.localX=down.localOriginX;down.localY=down.localOriginY;
    gesture(node,wire::gestureKinds::tapDown,lastInput,down.originX,down.originY,0,0,&down);lastTapDownSent=true;}
  if(accepted){gesture(node,wire::gestureKinds::tapUp,lastInput,lastTapX,lastTapY,0,0,&lastTapDetails);gesture(node,wire::gestureKinds::tap,lastInput,lastTapX,lastTapY,0,0,&lastTapDetails);}
  else if(lastTapDownSent)gesture(node,wire::gestureKinds::tapCancel,lastInput,lastTapX,lastTapY,0,0,&lastTapDetails);
  lastTap={};lastTapDownSent=false;lastTapDetails={};
}
void View::canonicalCloseArena(const Input& packetInput,Stream& stream) {
  const auto& node=active->document->get(stream.target);const auto mask=node.gestures;
  if((mask&(wire::gestures::doubleTap|wire::gestures::longPress|dragMask))==0&&
      !stream.tapDownSent&&!stream.tapCanceled&&(mask&wire::gestures::tap)){
    stream.tapDownSent=true;gesture(stream.target,wire::gestureKinds::tapDown,packetInput.sequence,stream.startX,stream.startY,0,packetInput.stream);
  }
  const bool singleDrag=(node.policy&wire::eventPolicies::freePan)||(mask&dragMask)==wire::gestures::panX||(mask&dragMask)==wire::gestures::panY;
  if((mask&dragMask)&&singleDrag&&!stream.scroll&&!(node.policy&wire::eventPolicies::dragThreshold)&&
      !(mask&(wire::gestures::tap|wire::gestures::doubleTap|wire::gestures::longPress))){
    stream.pan=true;stream.dragAxis=(node.policy&wire::eventPolicies::freePan)?3:(mask&wire::gestures::panX)?1:2;
    gesture(stream.target,wire::gestureKinds::panStart,packetInput.sequence,packetInput.x,packetInput.y,0,packetInput.stream);
  }
}
void View::canonicalPointer(const Input& packetInput,Stream& stream,bool deferArena) {
  const auto& node=active->document->get(stream.target);const auto mask=node.gestures;
  const auto index=packetInput.stream;
  const auto emit=[&](uint32_t kind,double x,double y){gesture(stream.target,kind,packetInput.sequence,x,y,0,index);};
  const auto tapDown=[&]{if(!stream.tapDownSent&&!stream.tapCanceled&&(mask&wire::gestures::tap)){stream.tapDownSent=true;
    emit(wire::gestureKinds::tapDown,stream.startX,stream.startY);}};
  stream.sampleAt=packetInput.time;
  if(packetInput.phase==wire::phases::begin){
    if(!stream.pointerInverseValid)for(const auto& item:packetInput.snapshot->items)if(item.node==stream.target){const auto inverse=item.world.inverse();if(inverse){stream.pointerInverse=*inverse;stream.pointerInverseValid=true;}break;}
    stream.at=packetInput.time;
    if(lastTap&&lastTap!=stream.target)finishCanonicalTap(true);
    if(lastTap==stream.target&&(lastTapDetails.flags&wire::gestureDetailFlags::valid))stream.tapCanceled=true;
    if(mask&wire::gestures::longPress)emit(wire::gestureKinds::longPressDown,packetInput.x,packetInput.y);
    if(mask&dragMask){
      if(node.policy&wire::eventPolicies::freePan){stream.dragAxis=3;emit(wire::gestureKinds::dragDown,packetInput.x,packetInput.y);stream.dragAxis=0;}
      else{if(mask&wire::gestures::panX){stream.dragAxis=1;emit(wire::gestureKinds::dragDown,packetInput.x,packetInput.y);}if(mask&wire::gestures::panY){stream.dragAxis=2;emit(wire::gestureKinds::dragDown,packetInput.x,packetInput.y);}stream.dragAxis=0;}
    }
    if(!deferArena)canonicalCloseArena(packetInput,stream);
  }
  if(packetInput.phase==wire::phases::begin||packetInput.phase==wire::phases::update){
    const auto local=stream.pointerInverseValid?std::optional<Point>(stream.pointerInverse.map({packetInput.x,packetInput.y})):packetInput.snapshot->local(stream.target,packetInput.x,packetInput.y);
    if(local)stream.motionSamples[stream.motionCount++%20]={packetInput.time,local->x,local->y};
  }
  if(packetInput.phase==wire::phases::update){
    if(packetInput.buttons!=stream.buttons){cancelStream(index,wire::statuses::canceled);return;}
    const double globalDx=packetInput.x-stream.x,globalDy=packetInput.y-stream.y;
    const auto at=stream.pointerInverse.map({globalDx,globalDy}),zero=stream.pointerInverse.map({0,0});
    const Point delta{at.x-zero.x,at.y-zero.y};
    stream.deltaX=delta.x;stream.deltaY=delta.y;
    const auto world=stream.pointerInverse.inverse();
    if(world){
      stream.distanceX+=delta.x*std::hypot(world->a,world->b);stream.distanceY+=delta.y*std::hypot(world->c,world->d);
    }
    stream.distancePan+=std::hypot(packetInput.x-stream.x,packetInput.y-stream.y);stream.x=packetInput.x;stream.y=packetInput.y;
    const double slop=stream.kind==wire::pointerKinds::mouse?1:18;
    const bool beyond=std::hypot(packetInput.x-stream.startX,packetInput.y-stream.startY)>slop;
    if(stream.longSent){emit(wire::gestureKinds::longPressMove,packetInput.x,packetInput.y);return;}
    if(beyond){stream.tapRejected=true;if(!stream.tapCanceled){stream.tapCanceled=true;if(stream.tapDownSent)emit(wire::gestureKinds::tapCancel,packetInput.x,packetInput.y);}
      if(!stream.longCanceled&&(mask&wire::gestures::longPress)){stream.longCanceled=true;emit(wire::gestureKinds::longPressCancel,packetInput.x,packetInput.y);}}
    if(!stream.pan){
      uint32_t axis=0;
      if((node.policy&wire::eventPolicies::freePan)&&stream.distancePan>slop*2)axis=3;
      else if(!(node.policy&wire::eventPolicies::freePan)){
        if((mask&wire::gestures::panX)&&std::abs(stream.distanceX)>slop)axis=1;
        if((mask&wire::gestures::panY)&&std::abs(stream.distanceY)>slop&&(!axis||std::abs(stream.distanceY)>std::abs(stream.distanceX)))axis=2;
      }
      if(!axis&&stream.scroll&&beyond)axis=4;
      if(axis){stream.pan=true;stream.dragAxis=axis;
        if(!stream.tapCanceled){stream.tapCanceled=true;if(stream.tapDownSent)emit(wire::gestureKinds::tapCancel,packetInput.x,packetInput.y);}
        if(!stream.longCanceled&&(mask&wire::gestures::longPress)){stream.longCanceled=true;emit(wire::gestureKinds::longPressCancel,packetInput.x,packetInput.y);}
        if(axis==4&&(mask&dragMask)&&!stream.dragCanceled){stream.dragCanceled=true;emit(wire::gestureKinds::dragCancel,packetInput.x,packetInput.y);}
        if(axis!=4){
          if(!(node.policy&wire::eventPolicies::freePan)&&(mask&dragMask)==dragMask){stream.dragAxis=axis==1?2:1;emit(wire::gestureKinds::dragCancel,packetInput.x,packetInput.y);stream.dragAxis=axis;}
          const bool down=node.policy&wire::eventPolicies::dragStartDown;
          emit(wire::gestureKinds::panStart,down?stream.startX:packetInput.x,down?stream.startY:packetInput.y);
          if(down){const auto current=stream.pointerInverse.map({packetInput.x,packetInput.y}),start=stream.pointerInverse.map({stream.startX,stream.startY});stream.deltaX=current.x-start.x;stream.deltaY=current.y-start.y;}
          else stream.deltaX=stream.deltaY=0;
        }
      }
    }
    if(stream.pan){
      if(stream.dragAxis==4&&stream.scroll){revealPending=false;const auto projected=packetInput.snapshot->delta(stream.scroll,-globalDx,-globalDy);
        applyDelta(stream.scroll,(active->document->get(stream.scroll).properties.flags&1u)?projected.x:projected.y,index,packetInput.snapshot.get());}
      else if(stream.dragAxis!=4)emit(wire::gestureKinds::panUpdate,packetInput.x,packetInput.y);
    }else if(!stream.tapCanceled&&(mask&wire::gestures::tap)&&stream.tapDownSent)emit(wire::gestureKinds::tapMove,packetInput.x,packetInput.y);
    return;
  }
  if(packetInput.phase!=wire::phases::end&&packetInput.phase!=wire::phases::cancel)return;
  overlays.at(stream.target.key()).pressed=false;dirty=true;
  if(packetInput.phase==wire::phases::cancel)canonicalCancel(stream,packetInput.sequence);
  else if(stream.longSent){const auto velocity=estimateVelocity(stream,packetInput.time,false);stream.velocityX=velocity.x;stream.velocityY=velocity.y;emit(wire::gestureKinds::longPressEnd,packetInput.x,packetInput.y);}
  else if(stream.pan){if(stream.dragAxis!=4){const auto velocity=estimateVelocity(stream,packetInput.time,true);stream.velocityX=velocity.x;stream.velocityY=velocity.y;emit(wire::gestureKinds::panEnd,stream.x,stream.y);}}
  else if(!stream.tapRejected&&(!stream.tapCanceled||(mask&wire::gestures::doubleTap))){
    if(mask&wire::gestures::doubleTap){
      const bool second=lastTap==stream.target&&packetInput.time-lastTapTime<=0.3&&stream.at-lastTapTime>=0.04&&stream.buttons==lastTapButtons&&std::hypot(stream.startX-lastTapDetails.originX,stream.startY-lastTapDetails.originY)<=100;
      if(second){finishCanonicalTap(false);emit(wire::gestureKinds::doubleTap,packetInput.x,packetInput.y);}
      else{if(lastTap)finishCanonicalTap(true);lastTap=stream.target;lastTapTime=packetInput.time;lastTapX=packetInput.x;lastTapY=packetInput.y;lastTapButtons=stream.buttons;
        lastTapDetails=gestureDetails(stream.target,index,packetInput.x,packetInput.y);lastTapDownAt=stream.at;lastTapDownSent=stream.tapDownSent;}
    }else{tapDown();emit(wire::gestureKinds::tapUp,packetInput.x,packetInput.y);emit(wire::gestureKinds::tap,packetInput.x,packetInput.y);}
  }
  if(!stream.longSent&&!stream.longCanceled&&(mask&wire::gestures::longPress)){stream.longCanceled=true;emit(wire::gestureKinds::longPressCancel,packetInput.x,packetInput.y);}
  if(!stream.pan&&!stream.dragCanceled&&(mask&dragMask)){stream.dragCanceled=true;emit(wire::gestureKinds::dragCancel,packetInput.x,packetInput.y);}
  if(stream.scroll){
    bool deferred=false;for(auto& entry:overlays)if(entry.second.deferredStream==index){deferred|=entry.second.deferred;entry.second.deferred=false;entry.second.requested=entry.second.offset;}
    if(packetInput.phase==wire::phases::end&&stream.pan&&stream.dragAxis==4&&!deferred&&std::abs(packetInput.velocity)>=1){
      auto& scroll=overlays.at(stream.scroll.key());scroll.ballistic=true;scroll.start=scroll.offset;scroll.startVelocity=packetInput.velocity;scroll.elapsed=0;
    }
  }
  stream.active=false;stream.pointer=false;stream.capturedPublications.fill(nullptr);
}
void View::advanceCanonicalGestures() {
  if(lastTap&&(lastTapDetails.flags&wire::gestureDetailFlags::valid)){
    if(!lastTapDownSent&&time>=lastTapDownAt+0.1){auto down=lastTapDetails;down.localX=down.localOriginX;down.localY=down.localOriginY;
      gesture(lastTap,wire::gestureKinds::tapDown,lastInput,down.originX,down.originY,0,0,&down);lastTapDownSent=true;}
    if(time>=lastTapTime+0.3)finishCanonicalTap(true);
  }
  for(uint32_t index=1;index<streams.size();++index){auto& stream=streams[index];
    if(!stream.active||!stream.pointer||!active||!active->document->contains(stream.target))continue;
    const auto& node=active->document->get(stream.target);if(!(node.policy&wire::eventPolicies::canonicalGestures)||stream.pan||stream.longSent)continue;
    if(!stream.tapDownSent&&!stream.tapCanceled&&(node.gestures&wire::gestures::tap)&&time>=stream.at+0.1){stream.tapDownSent=true;gesture(stream.target,wire::gestureKinds::tapDown,lastInput,stream.startX,stream.startY,0,index);}
    if(!stream.longCanceled&&(node.gestures&wire::gestures::longPress)&&time>=stream.at+0.5){
      if(!stream.tapCanceled){stream.tapCanceled=true;if(stream.tapDownSent)gesture(stream.target,wire::gestureKinds::tapCancel,lastInput,stream.x,stream.y,0,index);}
      stream.longSent=true;gesture(stream.target,wire::gestureKinds::longPress,lastInput,stream.startX,stream.startY,0,index);
      if(!stream.dragCanceled&&(node.gestures&dragMask)){stream.dragCanceled=true;gesture(stream.target,wire::gestureKinds::dragCancel,lastInput,stream.x,stream.y,0,index);}
    }
  }
}
}
