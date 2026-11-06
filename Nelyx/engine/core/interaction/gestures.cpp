// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <cstring>

namespace nelyx::v2 {
RawSample rawSample(const Input& p,Handle node,uint64_t generation) {
  Writer w(8+wire::inputBytes);w.u64(0,generation);const size_t b=8;
  w.u64(b,p.sequence);w.u64(b+8,p.metrics);writeHandle(w,b+16,p.target);
  w.u32(b+24,p.stream);w.u32(b+28,p.phase);w.u32(b+32,p.source);w.u32(b+36,p.flags);
  w.f64(b+40,p.time);w.f64(b+48,p.sample);w.f64(b+56,p.x);w.f64(b+64,p.y);
  w.f64(b+72,p.dx);w.f64(b+80,p.dy);w.f64(b+88,p.velocity);
  w.u32(b+96,p.clock);w.u32(b+100,p.buttons);w.u32(b+104,p.modifiers);w.u32(b+108,p.device);
  w.u32(b+112,p.contact);w.u32(b+wire::inputFields::kind,p.kind);w.u64(b+120,p.snapshot?p.snapshot->id:p.publication);
  RawSample sample;sample.node=node;std::copy(w.bytes.begin(),w.bytes.end(),sample.bytes.begin());return sample;
}
void View::observeRaw(const Input& p,Handle h) {
  if(!rawActive||!p.snapshot)return;
  const auto& capturedDocument=*p.snapshot->scene->document;
  for(uint32_t depth=0;h&&depth<=wire::limits::depth;++depth){
    if(!capturedDocument.contains(h))return;const auto& node=capturedDocument.get(h);
    if(node.policy&1u){
      if(rawInputs.size()>=wire::limits::observerPackets){rawActive=false;
        Reader first{rawInputs.front().bytes.data(),rawInputs.front().bytes.size()};
        rawGapFirst=first.u64(8);rawGapLast=p.sequence;rawInputs.clear();return;}
      rawInputs.push_back(rawSample(p,h,rawGeneration));return;
    }
    h=node.parent;
  }
}
bool View::appDecision(Input& p) {
  if(p.appApproved)return true;
  auto& stream=streams[p.stream];
  if(!p.target)p.target=stream.active?stream.target:
    (p.flags&2u?pointerTarget(p.x,p.y,p.snapshot.get()):target(p.x,p.y,p.snapshot.get()));
  if(!active||!p.snapshot||!published||!document->contains(p.target)||
      !active->document->contains(p.target)||!published->allows(p.target)||
      !(active->document->get(p.target).policy&2u))return true;
  if(stream.decision){++canceled;cancelStream(p.stream,wire::statuses::busy);return false;}
  if(stream.denied&&p.phase!=wire::phases::begin){++canceled;return false;}
  stream.target=p.target;stream.decision=p.sequence;stream.decisionDeadline=time+0.1;
  stream.appPending=p;++consumed;consumedThrough=std::max(consumedThrough,p.sequence);observeRaw(p,p.target);
  interaction({wire::events::gestureDecision,wire::statuses::pending,p.sequence,
    p.snapshot->id,p.stream,p.target,p.x,p.y});return false;
}
void View::gestureReply(Reader r) {
  require(r.length==24&&r.u32(4)<=1&&r.u64(16)==0);
  const auto index=r.u32(0);require(index>0&&index<streams.size(),wire::statuses::invalidValue);
  auto& stream=streams[index];
  require(stream.decision==r.u64(8)&&stream.appPending&&!stream.appPending->appApproved&&
    time<stream.decisionDeadline,wire::statuses::stale);
  if(!r.u32(4)){cancelStream(index,wire::statuses::canceled);return;}
  stream.appPending->appApproved=true; // Render tick remains the property writer.
}
void View::gesture(Handle node,uint32_t kind,uint64_t sequence,double x,double y,double value,uint32_t stream,const GestureDetails* details) {
  uint64_t bits;std::memcpy(&bits,&value,sizeof(bits));
  Event event{wire::events::gesture,kind,sequence,active?active->document->epoch:0,bits,node,x,y};
  event.gesture=details?*details:gestureDetails(node,stream,x,y);
  interaction(event);
}
Handle View::pointerTarget(double x,double y,const Frame* snapshot) const {
  const auto* frame=snapshot?snapshot:published.get();
  if(!frame)return {};
  const auto& d=*frame->scene->document;
  Handle translucent;
  for(auto it=frame->items.rbegin();it!=frame->items.rend();++it){
    const auto& n=d.get(it->node);
    if(!frame->allows(n.id))continue;
    if((it->opacity<=0&&!(n.policy&wire::eventPolicies::canonicalHitTest))||!frame->hit(*it,x,y))continue;
    const bool canonical=n.policy&wire::eventPolicies::canonicalHitTest;
    const bool self=!canonical||(n.policy&wire::eventPolicies::hitTestSelf);
    for(const Node* node=&n;node;node=node->parent?&d.get(node->parent):nullptr) {
      if((node->policy&7u)||node->gestures||(node->control.kind&&node->control.kind<=wire::controlKinds::rangeSlider)||node->control.kind==wire::controlKinds::checkbox||node->kind==wire::kinds::scrollViewport||
        (node->semantics&&(node->semantics->actions&wire::semanticsActions::activate))) {
        if(node->policy&wire::eventPolicies::translucent){if(!translucent)translucent=node->id;break;}
        if(!(node->policy&wire::eventPolicies::canonicalHitTest)||(node->policy&wire::eventPolicies::hitTestSelf)||self)
          return translucent?translucent:node->id;
      }
    }
    if(canonical&&self)return translucent;
  }
  return translucent;
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
  if(!p.snapshot||!published||!active||p.metrics!=metrics.epoch||p.snapshot->scene->metrics.epoch!=metrics.epoch){++canceled;return;}
  if(p.flags&4u){
    updateMouse(p);
    const auto h=pointerTarget(p.x,p.y,p.snapshot.get());
    if(h!=hoverNode){if(hoverNode&&overlays.count(hoverNode.key()))overlays.at(hoverNode.key()).hovered=false;
      hoverNode=h;if(h&&overlays.count(h.key())){overlays.at(h.key()).hovered=true;gesture(h,wire::gestureKinds::hover,p.sequence,p.x,p.y,1);}dirty=true;}
    ++consumed;consumedThrough=p.sequence;return;
  }
  if(p.phase==wire::phases::begin){
    const auto h=pointerTarget(p.x,p.y,p.snapshot.get());
    if(!h||!document->contains(h)||!active->document->contains(h)||document->get(h).control.disabled||
       (document->get(h).semantics&&(document->get(h).semantics->flags&(wire::semanticsFlags::hidden|wire::semanticsFlags::disabled)))){++canceled;return;}
    if(s.active)cancelStream(p.stream,wire::statuses::canceled);
    s={};s.active=true;s.pointer=true;s.target=h;s.source=p.source;s.x=s.startX=p.x;s.y=s.startY=p.y;s.at=time;
    for(const auto& snapshot:publications)if(snapshot&&snapshot->scene==p.snapshot->scene)
      s.capturedPublications[s.captureCursor++%wire::limits::publicationSnapshots]=snapshot;
    if(std::none_of(s.capturedPublications.begin(),s.capturedPublications.end(),[&](const auto& snapshot){return snapshot==p.snapshot;}))
      s.capturedPublications[s.captureCursor++%wire::limits::publicationSnapshots]=p.snapshot;
    const auto& n=active->document->get(h);auto& o=overlays.at(h.key());o.pressed=true;dirty=true;
    s.kind=p.kind;s.buttons=p.buttons;
    if((n.policy&wire::eventPolicies::canonicalGestures)&&p.buttons!=1u){cancelStream(p.stream,wire::statuses::canceled);return;}
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
    if(n.control.kind==wire::controlKinds::rangeSlider){
      const auto local=p.snapshot->local(h,p.x,p.y);const double value=n.control.minimum+((local?local->x:0)-6)/std::max(1.0,p.snapshot->scene->document->get(h).properties.width-12)*(n.control.maximum-n.control.minimum);
      s.secondThumb=std::abs(value-o.second)<std::abs(value-o.value);}
    if(n.control.kind==wire::controlKinds::slider||n.control.kind==wire::controlKinds::rangeSlider){

      const auto local=p.snapshot->local(h,p.x,p.y);controlValue(h,n.control.minimum+((local?local->x:0)-6)/std::max(1.0,p.snapshot->scene->document->get(h).properties.width-12)*(n.control.maximum-n.control.minimum),s.secondThumb);}
  }
  if(!s.active||!s.pointer||!document->contains(s.target)||!active->document->contains(s.target)||
      !published->allows(s.target)||document->get(s.target).control.disabled||
      (document->get(s.target).semantics&&(document->get(s.target).semantics->flags&(wire::semanticsFlags::disabled|wire::semanticsFlags::hidden)))){
    ++canceled;cancelStream(p.stream,wire::statuses::canceled);return;}
  if(!p.appApproved){++consumed;consumedThrough=std::max(consumedThrough,p.sequence);observeRaw(p,s.target);}
  const auto& n=active->document->get(s.target);auto& o=overlays.at(s.target.key());
  const bool canonical=n.policy&wire::eventPolicies::canonicalGestures;
  if(canonical){canonicalPointer(p,s);return;}
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
    const auto distance=std::hypot(p.x-s.startX,p.y-s.startY);
    const bool beyond=canonical?distance>(s.kind==wire::pointerKinds::mouse?1.0:18.0):distance>=8;
    if(!s.pan&&(slider||(n.gestures&wire::gestures::scrollbar)||beyond)){
      s.pan=true;o.pressed=slider;dirty=true;gesture(s.target,wire::gestureKinds::panStart,p.sequence,p.x,p.y);}
    if(s.pan){
      if(slider){
        const auto local=p.snapshot->local(s.target,p.x,p.y);controlValue(s.target,n.control.minimum+((local?local->x:0)-6)/std::max(1.0,p.snapshot->scene->document->get(s.target).properties.width-12)*(n.control.maximum-n.control.minimum),s.secondThumb);}
      else if(n.gestures&wire::gestures::scrollbar){if(s.scroll){const auto& viewport=active->document->get(s.scroll);const auto& props=viewport.properties;
        const auto local=p.snapshot->delta(s.target,dx,dy);applyDelta(s.scroll,-local.y*(props.maximum-props.minimum)/std::max(1.0,n.properties.height),0,p.snapshot.get());}}
      else if(s.scroll){revealPending=false;const auto delta=p.snapshot->delta(s.scroll,dx,dy);applyDelta(s.scroll,(active->document->get(s.scroll).properties.flags&1u)?delta.x:delta.y,p.stream,p.snapshot.get());}
      if(n.gestures&(wire::gestures::panX|wire::gestures::panY))gesture(s.target,wire::gestureKinds::panUpdate,p.sequence,p.x,p.y,
        (n.gestures&wire::gestures::panX)?-dx:-dy);
    }
  } else if(p.phase==wire::phases::end||p.phase==wire::phases::cancel){
    const bool canceledPointer=p.phase==wire::phases::cancel;
    o.pressed=false;dirty=true;
    if(s.pinched){gesture(s.target,wire::gestureKinds::pinchEnd,p.sequence,p.x,p.y);
      for(auto& other:streams)if(&other!=&s&&other.active&&other.target==s.target){other.pinched=false;other.pan=true;other.startX=other.x;other.startY=other.y;}}
    else if(s.pan)gesture(s.target,wire::gestureKinds::panEnd,p.sequence,p.x,p.y,p.velocity);
    else if(!canceledPointer&&!s.longSent&&(canonical||pointerTarget(p.x,p.y,p.snapshot.get())==s.target)){
      if(n.gestures&wire::gestures::doubleTap){
        if(lastTap&&lastTap!=s.target){lastTapTime=time-0.301;advanceGestures();}
        if(lastTap==s.target&&time-lastTapTime<=0.3&&(!canonical||(s.at-lastTapTime>=0.04&&s.buttons==lastTapButtons))&&
          std::hypot(p.x-lastTapX,p.y-lastTapY)<=(canonical?100.0:20.0)){gesture(s.target,wire::gestureKinds::doubleTap,p.sequence,p.x,p.y);lastTap={};}
        else {lastTap=s.target;lastTapTime=time;lastTapX=p.x;lastTapY=p.y;lastTapButtons=s.buttons;lastTapDetails={};lastTapDownSent=false;}
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
    s.capturedPublications.fill(nullptr);
  }
}
void View::advanceGestures() {
  advanceCanonicalGestures();
  if(lastTap&&time-lastTapTime>=0.3){if(active&&document->contains(lastTap)&&active->document->contains(lastTap)){
    gesture(lastTap,wire::gestureKinds::tap,lastInput,lastTapX,lastTapY);activateControl(lastTap);
    const auto& n=active->document->get(lastTap);if(n.semantics&&(n.semantics->actions&wire::semanticsActions::activate))
      interaction({wire::events::semanticAction,wire::statuses::ok,publication,document->epoch,wire::semanticsActions::activate,lastTap});}lastTap={};}
  for(auto& s:streams)if(s.active&&s.pointer&&!s.pan&&!s.pinched&&!s.longSent&&active&&active->document->contains(s.target)&&
      (active->document->get(s.target).gestures&wire::gestures::longPress)&&!(active->document->get(s.target).policy&wire::eventPolicies::canonicalGestures)&&time-s.at>=0.5){s.longSent=true;gesture(s.target,wire::gestureKinds::longPress,lastInput,s.x,s.y);}
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
