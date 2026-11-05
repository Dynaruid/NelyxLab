// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <cstring>

namespace nelyx::v2 {
void View::gesture(Handle node,uint32_t kind,uint64_t sequence,double x,double y,double value) {
  uint64_t bits;std::memcpy(&bits,&value,sizeof(bits));
  interaction({wire::events::gesture,kind,sequence,active?active->document->epoch:0,bits,node,x,y});
}
Handle View::pointerTarget(double x,double y) const {
  if(!published)return {};
  const auto& d=*published->scene->document;
  for(auto it=published->items.rbegin();it!=published->items.rend();++it){
    const auto& n=d.get(it->node);const auto& c=it->clip;
    if(!published->allows(n.id))continue;
    if(it->opacity<=0||x<c.x||y<c.y||x>=c.x+c.width||y>=c.y+c.height||
       x<it->x||y<it->y||x>=it->x+n.properties.width||y>=it->y+n.properties.height)continue;
    for(const Node* node=&n;node;node=node->parent?&d.get(node->parent):nullptr)
      if((node->policy&4u)||node->gestures||(node->control.kind&&node->control.kind<=wire::controlKinds::rangeSlider)||node->control.kind==wire::controlKinds::checkbox||node->kind==wire::kinds::scrollViewport||
        (node->semantics&&(node->semantics->actions&wire::semanticsActions::activate)))return node->id;
  }
  return {};
}
void View::controlValue(Handle h,double value,bool second) {
  if(!active||!document->contains(h)||!active->document->contains(h))return;
  const auto& c=active->document->get(h).control;
  if(c.disabled||!c.kind)return;
  auto& o=overlays.at(h.key());
  value=std::clamp(value,c.minimum,c.maximum);
  if(c.step>0)value=std::clamp(c.minimum+std::round((value-c.minimum)/c.step)*c.step,c.minimum,c.maximum);
  if(c.kind==wire::controlKinds::rangeSlider)value=second?std::max(value,o.value):std::min(value,o.second);
  auto& destination=second?o.second:o.value;
  if(destination==value)return;
  destination=value;dirty=true;
  ++controlWork;
  uint64_t bits;std::memcpy(&bits,&o.value,sizeof(bits));
  interaction({wire::events::controlChanged,wire::statuses::ok,lastInput,active->document->epoch,bits,h,o.second,0});
}
void View::activateControl(Handle h) {
  if(!active||!document->contains(h)||!active->document->contains(h))return;
  const auto& n=active->document->get(h);if(n.control.disabled)return;
  if(n.control.kind==wire::controlKinds::button)++controlWork;
  if(n.control.kind==wire::controlKinds::toggle||n.control.kind==wire::controlKinds::checkbox)controlValue(h,overlays.at(h.key()).value==n.control.minimum?n.control.maximum:n.control.minimum);
  else if(n.control.kind==wire::controlKinds::radio)controlValue(h,n.control.maximum);
}
void View::pointer(Input p) {
  ++gestureWork;
  auto& s=streams[p.stream];
  if(!published||!active||p.metrics!=metrics.epoch||published->scene->metrics.epoch!=metrics.epoch){++canceled;return;}
  if(p.flags&4u){
    const auto h=pointerTarget(p.x,p.y);
    if(h!=hoverNode){if(hoverNode&&overlays.count(hoverNode.key()))overlays.at(hoverNode.key()).hovered=false;
      hoverNode=h;if(h&&overlays.count(h.key())){overlays.at(h.key()).hovered=true;gesture(h,wire::gestureKinds::hover,p.sequence,p.x,p.y,1);}dirty=true;}
    ++consumed;consumedThrough=p.sequence;return;
  }
  if(p.phase==wire::phases::begin){
    const auto h=pointerTarget(p.x,p.y);
    if(!h||!document->contains(h)||!active->document->contains(h)||document->get(h).control.disabled||
       (document->get(h).semantics&&(document->get(h).semantics->flags&(wire::semanticsFlags::hidden|wire::semanticsFlags::disabled)))){++canceled;return;}
    if(s.active)cancelStream(p.stream,wire::statuses::canceled);
    s={};s.active=true;s.pointer=true;s.target=h;s.source=p.source;s.x=s.startX=p.x;s.y=s.startY=p.y;s.at=time;
    const auto& n=active->document->get(h);auto& o=overlays.at(h.key());o.pressed=true;dirty=true;
    for(auto node=h;node;node=active->document->get(node).parent)
      if(active->document->get(node).kind==wire::kinds::scrollViewport){s.scroll=node;break;}
    if(s.scroll){auto& scroll=overlays.at(s.scroll.key());scroll.ballistic=false;scroll.velocity=0;
      for(auto it=commands.begin();it!=commands.end();){const auto current=it++;if(current->second.node==s.scroll)finishCommand(current->first,wire::statuses::canceled);}}
    if(n.semantics&&(n.semantics->actions&wire::semanticsActions::focus))setFocus(h,publication,0);
    if(n.gestures&wire::gestures::pinch)for(auto& other:streams)
      if(&other!=&s&&other.active&&other.pointer&&other.target==h){
        const auto distance=std::hypot(other.x-s.x,other.y-s.y);
        if(distance>=1){s.pinched=other.pinched=true;s.pinchDistance=other.pinchDistance=distance;
          other.pan=s.pan=false;gesture(h,wire::gestureKinds::pinchStart,p.sequence,(s.x+other.x)/2,(s.y+other.y)/2,1);}break;}
    if(n.control.kind==wire::controlKinds::rangeSlider){const auto item=std::find_if(published->items.begin(),published->items.end(),[&](const auto& value){return value.node==h;});
      const double value=n.control.minimum+(p.x-item->x-6)/std::max(1.0,n.properties.width-12)*(n.control.maximum-n.control.minimum);
      s.secondThumb=std::abs(value-o.second)<std::abs(value-o.value);}
    if(n.control.kind==wire::controlKinds::slider||n.control.kind==wire::controlKinds::rangeSlider){
      const auto item=std::find_if(published->items.begin(),published->items.end(),[&](const auto& value){return value.node==h;});
      controlValue(h,n.control.minimum+(p.x-item->x-6)/std::max(1.0,n.properties.width-12)*(n.control.maximum-n.control.minimum),s.secondThumb);}
  }
  if(!s.active||!s.pointer||!document->contains(s.target)||!active->document->contains(s.target)||
      !published->allows(s.target)||document->get(s.target).control.disabled||
      (document->get(s.target).semantics&&(document->get(s.target).semantics->flags&(wire::semanticsFlags::disabled|wire::semanticsFlags::hidden)))){
    ++canceled;cancelStream(p.stream,wire::statuses::canceled);return;}
  ++consumed;consumedThrough=p.sequence;
  const auto& n=active->document->get(s.target);auto& o=overlays.at(s.target.key());
  if(p.phase==wire::phases::update){
    const double dx=s.x-p.x,dy=s.y-p.y;s.x=p.x;s.y=p.y;
    if(s.pinched){
      for(const auto& other:streams){
        if(&other!=&s&&other.active&&other.pointer&&other.target==s.target){
          gesture(s.target,wire::gestureKinds::pinchUpdate,p.sequence,(s.x+other.x)/2,(s.y+other.y)/2,
            std::clamp(std::hypot(s.x-other.x,s.y-other.y)/s.pinchDistance,1e-6,1e6));break;
        }
      }
      return;
    }
    const bool slider=n.control.kind==wire::controlKinds::slider||n.control.kind==wire::controlKinds::rangeSlider;
    if(!s.pan&&(slider||(n.gestures&wire::gestures::scrollbar)||std::hypot(p.x-s.startX,p.y-s.startY)>=8)){
      s.pan=true;o.pressed=slider;dirty=true;gesture(s.target,wire::gestureKinds::panStart,p.sequence,p.x,p.y);}
    if(s.pan){
      if(slider){const auto item=std::find_if(published->items.begin(),published->items.end(),[&](const auto& value){return value.node==s.target;});
        controlValue(s.target,n.control.minimum+(p.x-item->x-6)/std::max(1.0,n.properties.width-12)*(n.control.maximum-n.control.minimum),s.secondThumb);}
      else if(n.gestures&wire::gestures::scrollbar){if(s.scroll){const auto& viewport=active->document->get(s.scroll);const auto& props=viewport.properties;
        applyDelta(s.scroll,-dy*(props.maximum-props.minimum)/std::max(1.0,n.properties.height));}}
      else if(s.scroll)applyDelta(s.scroll,(active->document->get(s.scroll).properties.flags&1u)?dx:dy,p.stream);
      if(n.gestures&(wire::gestures::panX|wire::gestures::panY))gesture(s.target,wire::gestureKinds::panUpdate,p.sequence,p.x,p.y,
        (n.gestures&wire::gestures::panX)?-dx:-dy);
    }
  } else if(p.phase==wire::phases::end||p.phase==wire::phases::cancel){
    const bool canceledPointer=p.phase==wire::phases::cancel;
    o.pressed=false;dirty=true;
    if(s.pinched){gesture(s.target,wire::gestureKinds::pinchEnd,p.sequence,p.x,p.y);
      for(auto& other:streams)if(&other!=&s&&other.active&&other.target==s.target){other.pinched=false;other.pan=true;other.startX=other.x;other.startY=other.y;}}
    else if(s.pan)gesture(s.target,wire::gestureKinds::panEnd,p.sequence,p.x,p.y,p.velocity);
    else if(!canceledPointer&&!s.longSent&&pointerTarget(p.x,p.y)==s.target){
      if(n.gestures&wire::gestures::doubleTap){
        if(lastTap&&lastTap!=s.target){lastTapTime=time-0.301;advanceGestures();}
        if(lastTap==s.target&&time-lastTapTime<=0.3&&std::hypot(p.x-lastTapX,p.y-lastTapY)<=20){gesture(s.target,wire::gestureKinds::doubleTap,p.sequence,p.x,p.y);lastTap={};}
        else {lastTap=s.target;lastTapTime=time;lastTapX=p.x;lastTapY=p.y;}
      } else {gesture(s.target,wire::gestureKinds::tap,p.sequence,p.x,p.y);
        activateControl(s.target);
        if(n.semantics&&(n.semantics->actions&wire::semanticsActions::activate))
          interaction({wire::events::semanticAction,wire::statuses::ok,publication,document->epoch,wire::semanticsActions::activate,s.target});}
    }
    if(canceledPointer)gesture(s.target,wire::gestureKinds::cancel,p.sequence,p.x,p.y);
    if(s.scroll){auto& scroll=overlays.at(s.scroll.key());
      bool deferred=false;for(auto& entry:overlays)if(entry.second.deferredStream==p.stream){deferred|=entry.second.deferred;entry.second.deferred=false;entry.second.requested=entry.second.offset;}
      if(!canceledPointer&&s.pan&&!s.pinched&&!deferred&&std::abs(p.velocity)>=1){scroll.ballistic=true;scroll.start=scroll.offset;scroll.startVelocity=p.velocity;scroll.elapsed=0;}}
    s.active=false;s.pointer=false;
  }
}
void View::advanceGestures() {
  if(lastTap&&time-lastTapTime>=0.3){if(active&&document->contains(lastTap)&&active->document->contains(lastTap)){
    gesture(lastTap,wire::gestureKinds::tap,lastInput,lastTapX,lastTapY);activateControl(lastTap);
    const auto& n=active->document->get(lastTap);if(n.semantics&&(n.semantics->actions&wire::semanticsActions::activate))
      interaction({wire::events::semanticAction,wire::statuses::ok,publication,document->epoch,wire::semanticsActions::activate,lastTap});}lastTap={};}
  for(auto& s:streams)if(s.active&&s.pointer&&!s.pan&&!s.pinched&&!s.longSent&&active&&active->document->contains(s.target)&&
      (active->document->get(s.target).gestures&wire::gestures::longPress)&&time-s.at>=0.5){s.longSent=true;gesture(s.target,wire::gestureKinds::longPress,lastInput,s.x,s.y);}
}
void View::key(Reader r) {
  require(r.length==24&&r.u32(20)==0&&r.u32(16)<=1&&r.u64(0)==publication,wire::statuses::stale);
  if(!r.u32(16))return;
  const auto code=r.u32(8),modifiers=r.u32(12);
  if(code==9&&published){std::vector<Handle> choices;
    for(const auto& item:published->items){const auto& n=published->scene->document->get(item.node);
      if(item.opacity>0&&published->allows(n.id)&&document->contains(n.id)&&n.semantics&&(n.semantics->flags&wire::semanticsFlags::focusable)&&
        !(n.semantics->flags&(wire::semanticsFlags::hidden|wire::semanticsFlags::disabled))&&!n.control.disabled&&item.clip.width>0&&item.clip.height>0)choices.push_back(n.id);}
    if(!choices.empty()){auto at=std::find(choices.begin(),choices.end(),focusNode);const auto index=at==choices.end()?int64_t((modifiers&1u)?0:-1):at-choices.begin();
      setFocus(choices[size_t((index+((modifiers&1u)?-1:1)+int64_t(choices.size()))%int64_t(choices.size()))],publication,0);}return;}
  if(!focusNode||!active||!document->contains(focusNode)||!active->document->contains(focusNode))return;
  const auto& n=active->document->get(focusNode);if(n.control.disabled)return;
  if(code==13||code==32){activateControl(focusNode);
    if(n.semantics&&(n.semantics->actions&wire::semanticsActions::activate))interaction({wire::events::semanticAction,wire::statuses::ok,publication,document->epoch,wire::semanticsActions::activate,focusNode});}
  else if(n.control.kind==wire::controlKinds::slider||n.control.kind==wire::controlKinds::rangeSlider){
    const double step=n.control.step>0?n.control.step:(n.control.maximum-n.control.minimum)/20;
    const auto value=overlays.at(focusNode.key()).value;
    if(code==37||code==40)controlValue(focusNode,value-step);
    else if(code==38||code==39)controlValue(focusNode,value+step);
    else if(code==36)controlValue(focusNode,n.control.minimum);
    else if(code==35)controlValue(focusNode,n.control.maximum);
  }
}
}
