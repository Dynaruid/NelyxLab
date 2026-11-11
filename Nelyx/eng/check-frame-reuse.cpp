// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include "../engine/core/interaction/semantics_data.hpp"
#include "../engine/platform/windows/frame_clock.hpp"
#include "../engine/platform/windows/input/PrecisionVelocity.h"
#include <thread>
#include <atomic>
#include <condition_variable>
#include <iostream>
#include <stdexcept>
using namespace nelyx::v2;
void checkTransactionSharing();
void checkMaterialization();
void checkLivePaintActivation();
void checkProviderAdmission();
void checkNativeFrameDelivery();
static void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
static void legacyPreparationLead(){
  auto ledger=std::make_shared<Ledger>();
  ListGeometry geometry(ledger,ListStyle{1,100,9,13,344,true});geometry.updateEstimate();geometry.total=geometry.prefix(geometry.style.count);
  const double offset=10.4*344,paint=344;
  const auto idle=legacyListCacheRange(geometry,offset,paint);
  const auto forward=legacyListCacheRange(geometry,offset,paint,688);
  const auto reverse=legacyListCacheRange(geometry,offset,paint,-688);
  check(idle.begin==9&&idle.end==13,"Idle legacy range changed");
  check(forward.begin==10&&forward.end==14,"Forward Source demand did not lead contact");
  check(reverse.begin==8&&reverse.end==12,"Reverse Source demand did not lead contact");
  const auto early=legacyListCacheRange(geometry,10.05*paint,paint,688);
  check(early.begin==10&&early.end==14,"Source demand did not cover the measured turnaround before the page callback");
  for(const double velocity:{-1e12,-688.0,0.0,688.0,1e12})for(const double at:{0.0,offset,99.0*344}){
    const auto range=legacyListCacheRange(geometry,at,paint,velocity);
    check(range.end-range.begin<=4,"Preparation hint enlarged the page window");
    check(geometry.prefix(range.begin)<=at&&geometry.prefix(range.end)>=std::min(geometry.total,at+paint),"Preparation hint excluded the actual viewport");
    check(range.begin<=range.end&&range.end<=geometry.style.count,"Preparation hint exceeded finite extent");
  }
  geometry.style.begin=10;geometry.style.end=14;
  const auto paused=legacyListCacheRange(geometry,offset,paint);
  check(paused.begin==10&&paused.end==14,"Velocity reset rolled a complete resident window backward");
  const auto reversing=legacyListCacheRange(geometry,offset,paint,-688);
  check(reversing.begin==8&&reversing.end==12,"Resident window suppressed real reversal demand");
  const auto deferred=legacyListCacheRange(geometry,13*paint,paint,688,true);
  check(deferred.begin<=12&&deferred.end>=14,"Predicted Source window excluded the deferred displayed viewport");
  std::cout<<"Legacy preparation: bounded lead, resident hysteresis, deferred displayed coverage, reverse/reset/finite extent PASS\n";
}
static void inputFrameIndex(){
  auto ledger=std::make_shared<Ledger>();
  for(const uint32_t count:{64u,2048u}){
    // View contains bounded input tables and is heap-owned in the engine.
    // Do the same here instead of nesting it under run's own View stack frame.
    auto ownedView=std::make_unique<View>(1,ledger);auto& view=*ownedView;
    auto document=std::make_shared<Document>(ledger);
    for(uint32_t i=0;i<count;++i){
      auto node=std::make_shared<Node>(ledger);node->id={i*2+1,1};
      node->parent=i?Handle{(std::min(i,8u)-1)*2+1,1}:Handle{};
      node->kind=wire::kinds::box;node->properties={2,3,30,20};
      if(i==0)node->paintTransform={1.5,.2,.1,2,12,18};
      if(i==count-1)node->policy=wire::eventPolicies::observeRaw;
      document->nodes.edit(node->id.slot).value=node;
      document->children.append(node->parent.slot,node->id);
    }
    document->count=count;document->highWater=count*2-1;
    auto scene=std::make_shared<Scene>();scene->document=document;scene->metrics={1,1,800,600,1};
    const auto frameFor=[&](const std::shared_ptr<const Scene>& input){
      Frame frame;frame.scene=input;frame.device=1;frame.properties.resize(input->document->highWater+1);
      view.makeDrawItems(frame);return frame;
    };
    const auto first=frameFor(scene);
    // The old linear lookup is the oracle, including sparse/missing slots and
    // transforms. The retained table must never alias another generation.
    for(uint32_t slot=0;slot<=document->highWater+1;++slot){
      const Handle node{slot,1};const DrawItem* slow=nullptr;
      for(const auto& item:first.items)if(item.node==node){slow=&item;break;}
      check(first.item(node)==slow,"Frame index differs from linear lookup");
      check(!first.item({slot,2}),"Frame index accepted a foreign generation");
      const auto local=first.local(node,130,80);const auto delta=first.delta(node,12,-7);
      const auto inverse=slow?slow->world.inverse():std::optional<Affine>{};
      check(bool(local)==bool(inverse),"Indexed local point presence differs");
      if(inverse){const auto expected=inverse->map({130,80}),a=inverse->map({12,-7}),b=inverse->map({0,0});
        check(local->x==expected.x&&local->y==expected.y&&delta.x==a.x-b.x&&delta.y==a.y-b.y,"Indexed input transform differs");}
      else check(delta.x==0&&delta.y==0,"Missing input target produced a delta");
    }
    const Handle target{document->highWater,1};
    auto changedDocument=std::make_shared<Document>(*document);
    auto paint=std::make_shared<Node>(document->get(target));paint->color=0xff123456;
    changedDocument->nodes.edit(target.slot).value=paint;
    auto changedScene=std::make_shared<Scene>(*scene);changedScene->document=changedDocument;
    auto changed=frameFor(changedScene);
    check(first.sameInputGeometry(changed,target)&&first.sharesInputGeometry(changed),"Paint-only input geometry was rejected");
    auto ancestorDocument=std::make_shared<Document>(*changedDocument);
    auto ancestor=std::make_shared<Node>(document->get({3,1}));++ancestor->properties.width;
    ancestorDocument->nodes.edit(3).value=ancestor;
    auto ancestorScene=std::make_shared<Scene>(*scene);ancestorScene->document=ancestorDocument;changed=frameFor(ancestorScene);
    check(!first.sameInputGeometry(changed,target)&&!first.sharesInputGeometry(changed),"Changed ancestor accepted old input geometry");
    auto recycled=std::make_shared<Document>(*changedDocument);
    auto replacement=std::make_shared<Node>(*paint);replacement->id.generation=2;
    recycled->nodes.edit(target.slot).value=replacement;
    auto children=recycled->children[replacement->parent.slot];children.back()=replacement->id;
    recycled->children.set(replacement->parent.slot,std::move(children));
    auto recycledScene=std::make_shared<Scene>(*scene);recycledScene->document=recycled;changed=frameFor(recycledScene);
    check(first.item(target)&&!first.item(replacement->id)&&!changed.item(target)&&changed.item(replacement->id),"Snapshot index lost its generation fence");
    check(!first.sameInputGeometry(changed,target)&&!first.sharesInputGeometry(changed),"Recycled target accepted old input geometry");
    auto singular=first;singular.items.back().world={0,0,0,0,0,0};
    check(!singular.local(target,0,0)&&singular.delta(target,1,1).x==0&&singular.delta(target,1,1).y==0,"Singular input transform was inverted");
    auto foreign=first;++foreign.device;check(!first.sameInputGeometry(foreign,target)&&!first.sharesInputGeometry(foreign),"Device input fence was lost");
    auto metrics=std::make_shared<Scene>(*scene);++metrics->metrics.epoch;foreign=frameFor(metrics);
    check(!first.sameInputGeometry(foreign,target)&&!first.sharesInputGeometry(foreign),"Metrics input fence was lost");
    check(!first.item({wire::limits::nodes+1,1}),"Out-of-range frame index was read");
    view.close(wire::statuses::closed);
  }
  check(ledger->bytes==0,"Input frame index retained snapshot leases");
  std::cout<<"Input frame index 64/2048, linear oracle, sparse/generation, ancestor/metrics/device, transforms and leases PASS.\n";
}
static void run(){
  inputFrameIndex();
  checkProviderAdmission();
  checkNativeFrameDelivery();
  checkTransactionSharing();
  checkMaterialization();
  checkLivePaintActivation();
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);
    auto document=std::make_shared<Document>(ledger);
    for(uint32_t id=1;id<=6;++id){
      auto node=std::make_shared<Node>(ledger);node->id={id,1};
      node->parent=id==1?Handle{}:Handle{id<=3?1u:2u,1};
      node->kind=id==2?wire::kinds::scrollViewport:wire::kinds::box;
      node->properties={0,id>3?double(id-4)*30:0,200,id==1?300.0:id==2?100.0:30.0};
      node->policy=wire::eventPolicies::semanticsBoundary;
      SemanticMetadata metadata;metadata.direction=1;
      node->semantics=std::make_shared<SemanticData>(ledger,wire::semanticsRoles::group,0,wire::semanticsActions::activate,
        std::to_string(id),"","","","",SemanticRangeData{},UINT32_MAX,0,std::move(metadata));
      document->nodes.edit(id).value=node;document->children.append(node->parent.slot,node->id);
    }
    document->count=document->highWater=6;
    auto scene=std::make_shared<Scene>();scene->document=document;scene->metrics={1,1,200,300,1};
    Frame first;first.scene=scene;first.properties.resize(7);view.makeDrawItems(first);
    view.published=std::make_shared<Frame>(first);
    // Scroll, reversal, opacity removal, opacity restoration and mixed motion.
    for(int sample=0;sample<6;++sample){
      Frame cached;cached.scene=scene;cached.properties.resize(7);
      cached.properties[2].offset=sample<3?sample*11:33-sample*4;
      if(sample==3)cached.properties[5].opacity=0;
      if(sample==5)cached.properties[2].opacity=0;
      view.makeDrawItems(cached);
      auto previous=view.published;view.published.reset();
      Frame reference;reference.scene=scene;reference.properties=cached.properties;view.makeDrawItems(reference);
      check(reference.items.size()==cached.items.size(),"draw topology changed");
      for(size_t i=1;i<cached.semantics.size();++i){
        const auto& a=cached.semantics[i];const auto& b=reference.semantics[i];
        check(a.parent==b.parent&&a.traversal==b.traversal&&a.mergedInto==b.mergedInto&&a.blocked==b.blocked&&a.merged==b.merged,"retained semantic topology differs from full rebuild");
        check(bool(a.data)==bool(b.data),"semantic data absent");
        if(a.data)check(semanticDataBytes(*a.data,a.data->flags,a.data->actions).bytes==semanticDataBytes(*b.data,b.data->flags,b.data->actions).bytes,"retained semantic content differs");
        check(cached.allowsSemantics({uint32_t(i),1})==reference.allowsSemantics({uint32_t(i),1}),"semantic visibility differs");
      }
      view.published=std::make_shared<Frame>(cached);
    }
    ListStyle style{1,100,0,0,10,false,false};
    auto range=nativeListRange(style,nullptr,0,100);
    check(range.begin==0&&range.end==8,"unknown indexed rows were not batched");
    ListGeometry geometry(ledger,style);
    for(uint32_t i=0;i<8;++i)geometry.measured[i]={i+1,10};
    geometry.updateEstimate();range=nativeListRange(style,&geometry,0,100);
    check(range.end==10,"measured coverage did not extend");
    geometry.measured[0].extent=200;geometry.updateEstimate();
    range=nativeListRange(style,&geometry,0,100);
    check(range.end==1,"estimated range was treated as final coverage");
    range=nativeListRange(style,&geometry,500,100);
    check(range.end-range.begin<=8,"revisit batch exceeded its bound");
    range=nativeListRange(style,&geometry,0,0);check(range.begin==range.end,"empty viewport built rows");
    ListStyle cachedStyle{1,100,0,35,10,true,false};ListGeometry cachedGeometry(ledger,cachedStyle);
    range=nativeListCacheRange(cachedStyle,&cachedGeometry,80,100);
    check(range.begin==0&&range.end==35,"resident scrolling rebuilt the cache window");
    range=nativeListCacheRange(cachedStyle,&cachedGeometry,140,100);
    check(range.begin==0&&range.end==49,"cache did not refill ahead before coverage exhaustion");
    auto expanded=cachedStyle;expanded.end=49;
    range=nativeListCacheRange(expanded,&cachedGeometry,140,100);
    check(range.begin==0&&range.end==49,"prior geometry rolled back the accepted cache window");
    cachedGeometry.style.begin=20;cachedGeometry.style.end=70;
    range=nativeListCacheRange(cachedStyle,&cachedGeometry,300,100);
    check(range.begin==5&&range.end==65,"reverse cache demand was not prepared behind the viewport");
    range=nativeListCacheRange(cachedStyle,&cachedGeometry,0,0);check(range.begin==range.end,"empty viewport prefetched rows");
    ListStyle dense{1,1000,0,0,1,true,false};ListGeometry denseGeometry(ledger,dense);
    range=nativeListCacheRange(dense,&denseGeometry,500,120);
    check(range.begin<=500&&range.end>=620&&range.end-range.begin<=wire::limits::listChildren,"cache displaced visible rows or exceeded the row budget");
    range=nativeListCacheRange(style,nullptr,0,100);check(range.end<=8,"cache bypassed unknown-row measurement batching");
    ListStyle rapid{1,1000,0,0,50,true,false};ListGeometry rapidGeometry(ledger,rapid);
    const auto slow=nativeListCacheRange(rapid,&rapidGeometry,3000,720);
    const auto fast=nativeListCacheRange(rapid,&rapidGeometry,3000,720,2500);
    const auto reverse=nativeListCacheRange(rapid,&rapidGeometry,3000,720,-2500);
    check(fast.end>slow.end&&reverse.begin<slow.begin,"prefetch did not follow native velocity");
    check(fast.end-fast.begin<=128&&reverse.end-reverse.begin<=128,"velocity exceeded cache row budget");
    auto oldFrame=std::make_shared<Frame>(first);oldFrame->id=1;oldFrame->device=1;
    auto newScene=std::make_shared<Scene>(*scene);auto newDocument=std::make_shared<Document>(*document);
    newDocument->epoch=2;newScene->document=newDocument;
    auto newFrame=std::make_shared<Frame>(*oldFrame);newFrame->id=2;newFrame->scene=newScene;
    view.published=newFrame;view.publications[0]=oldFrame;view.metrics=scene->metrics;view.visible=view.focused=true;
    Input wheel{};wheel.sequence=1;wheel.metrics=1;wheel.stream=1;wheel.phase=wire::phases::update;
    wheel.source=wire::sources::wheelUnknown;wheel.x=50;wheel.y=60;wheel.dy=20;wheel.publication=1;
    check(view.enqueue(wheel)==wire::statuses::ok,"paint-only document replacement dropped wheel input");
    for(auto& item:newFrame->items)if(item.node.slot==2)item.world.tx+=20;
    wheel.sequence=2;
    check(view.enqueue(wheel)==wire::statuses::stale,"changed viewport accepted stale wheel geometry");
    view.close(wire::statuses::closed);
  }
  check(ledger->bytes==0,"frame/list leases remain");
  std::cout<<"Frame semantics equivalence, indexed batch coverage and lease checks passed.\n";
}

static void deadlines(){
  windows::RenderDeadline wait;std::mutex mutex;std::unique_lock lock(mutex);
  double total=0,coarse=0;std::condition_variable cv;
  for(int i=0;i<8;++i){const auto start=windows::qpcSeconds();cv.wait_for(lock,std::chrono::milliseconds(3),[]{return false;});coarse+=windows::qpcSeconds()-start;}
  for(int i=0;i<8;++i){const auto start=windows::qpcSeconds();wait.wait(lock,start+.003,[]{return false;});
    const auto elapsed=windows::qpcSeconds()-start;check(elapsed>=.003,"deadline returned early");total+=elapsed;}
  std::atomic<bool> ready=false;
  std::jthread producer([&]{std::this_thread::sleep_for(std::chrono::milliseconds(3));ready=true;wait.notify();});
  const auto start=windows::qpcSeconds();wait.wait(lock,start+1,[&]{return ready.load();});
  check(ready,"wake did not interrupt deadline");check(windows::qpcSeconds()-start<.5,"wake waited for timer expiry");
  wait.notify();wait.wait(lock,windows::qpcSeconds()+1,[]{return true;});
  std::cout<<"Render deadline 3ms mean="<<total*1000/8<<"ms (condition variable="<<coarse*1000/8<<"ms); interrupt and pre-signaled wake PASS.\n";
}
static void precisionVelocity(){
  windows::PrecisionVelocity value;value.begin(1);
  for(int i=1;i<=3;++i)value.update(1+i*.016,8);
  check(std::abs(value.value(1.048)-500)<.01,"constant motion velocity differs");
  value.update(1.064,0);check(value.value(1.07)>100,"terminal zero transform erased lift velocity");
  check(value.value(1.15)==0,"stationary finger retained a stale fling");
  value.begin(2);value.update(2.016,8);value.update(2.032,8);
  for(int i=3;i<=6;++i)value.update(2+i*.016,-16);
  check(value.value(2.1)<0,"direction reversal retained forward velocity");
  value.cancel();check(value.value(2.1)==0,"canceled contact retained velocity");
  value.begin(3);value.update(3.016,4);value.update(3.016,4);value.update(3.032,8);
  check(std::abs(value.value(3.032)-500)<.01,"coalesced timestamps changed velocity");
  windows::PrecisionPanVelocity pan;pan.begin(4);
  pan.update(4.016,8,0);pan.update(4.032,8,0);
  check(std::abs(pan.value(4.032)-500)<.01,"Horizontal precision motion lost its velocity/prefetch hint");
  pan.update(4.048,0,0);check(pan.value(4.05)>100,"Horizontal final zero erased lift velocity");
  check(pan.value(4.14)==0,"Horizontal stationary contact retained stale momentum");
  pan.begin(5);pan.update(5.016,0,-8);pan.update(5.032,0,-8);
  check(std::abs(pan.value(5.032)+500)<.01,"Vertical precision velocity changed");
  pan.cancel();check(pan.value(5.032)==0,"Two-axis precision cancellation retained momentum");
}
static void ballisticCoverage(){
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=std::make_shared<Node>(ledger);viewport->id={1,1};viewport->kind=wire::kinds::scrollViewport;
    viewport->properties.width=200;viewport->properties.height=100;viewport->properties.maximum=2000;
    viewport->coverage={1,0,100,true};
    auto child=std::make_shared<Node>(ledger);child->id={2,1};child->parent=viewport->id;child->kind=wire::kinds::box;
    child->properties.width=200;child->properties.height=2100;
    document->nodes.edit(1).value=viewport;document->nodes.edit(2).value=child;document->children.set(0,{viewport->id});document->children.set(1,{child->id});document->count=document->highWater=2;
    auto scene=std::make_shared<Scene>();scene->document=document;scene->metrics={1,1,200,100,1};
    view.document=document;view.active=scene;view.metrics=scene->metrics;view.time=1;view.hasTime=true;
    auto& overlay=view.overlays[viewport->id.key()];overlay.node=viewport->id;overlay.offset=overlay.requested=90;
    const auto publish=[&]{auto frame=std::make_shared<Frame>();frame->id=1;frame->device=1;frame->scene=scene;frame->properties.resize(3);frame->properties[1].offset=overlay.offset;view.makeDrawItems(*frame);view.published=frame;};publish();
    auto& stream=view.streams[2];stream.active=true;stream.target=viewport->id;stream.source=wire::sources::engineDriven;
    Input input{};input.metrics=1;input.stream=2;input.source=wire::sources::engineDriven;input.target=viewport->id;input.snapshot=view.published;input.dy=30;input.velocity=600;input.phase=wire::phases::update;input.sequence=1;
    view.processInput(input);check(overlay.offset==100&&overlay.requested==120&&overlay.deferred,"coverage setup failed");
    input.phase=wire::phases::end;input.sequence=2;view.processInput(input);
    check(overlay.ballistic&&overlay.start==120&&!overlay.deferredStream,"lift at coverage boundary lost inertia");
    view.tick(1.016);view.tick(1.032);
    check(overlay.ballistic&&overlay.elapsed==0&&overlay.requested==120,"waiting for rows advanced or canceled inertia");
    viewport->coverage.maximum=1000;publish();view.tick(1.048);
    check(overlay.offset>120&&overlay.ballistic&&overlay.velocity>500,"inertia did not resume after coverage arrived");
    viewport->coverage.maximum=overlay.offset+2;view.tick(1.064);const auto elapsed=overlay.elapsed,requested=overlay.requested;
    view.tick(1.080);view.tick(1.096);
    check(overlay.ballistic&&overlay.deferred&&overlay.elapsed==elapsed&&overlay.requested==requested,"ballistic coverage stall accumulated duplicate deltas");
    input.snapshot=view.published;input.phase=wire::phases::cancel;input.sequence=3;view.processInput(input);
    check(!overlay.ballistic&&!overlay.deferred&&overlay.velocity==0,"inertia cancel after lift was ignored");
    viewport->coverage.enabled=false;overlay.offset=overlay.requested=viewport->properties.maximum;overlay.beginBallistic(600);view.tick(1.112);
    check(!overlay.ballistic,"true content boundary did not stop inertia");
    overlay.beginBallistic(-600);input.phase=wire::phases::begin;input.sequence=4;view.processInput(input);
    check(!overlay.ballistic,"new contact did not stop old inertia");
    view.close(wire::statuses::closed);
  }
  check(ledger->bytes==0,"ballistic coverage leases remain");
  std::cout<<"Precision velocity and lift/stall/resume/cancel/boundary inertia checks PASS.\n";
}
static void deferredContactDistance(){
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=std::make_shared<Node>(ledger);viewport->id={1,1};viewport->kind=wire::kinds::scrollViewport;
    viewport->properties.width=200;viewport->properties.height=100;viewport->properties.maximum=1000;
    viewport->coverage={1,0,100,true};document->nodes.edit(1).value=viewport;
    document->count=document->highWater=1;
    auto scene=std::make_shared<Scene>();scene->document=document;scene->metrics={1,1,200,100,1};
    view.document=document;view.active=scene;
    auto& overlay=view.overlays[viewport->id.key()];overlay.node=viewport->id;overlay.offset=overlay.requested=90;
    auto& stream=view.streams[2];stream.active=true;stream.target=viewport->id;
    for(int i=0;i<20;++i){
      view.applyDelta(viewport->id,20,2);
      check(overlay.requested-overlay.offset<=100,"contact preparation exceeded one viewport");
      check(overlay.requested+overlay.deferredContactDelta==90+(i+1)*20,"coverage clamp discarded admitted contact distance");
    }
    check(overlay.offset==100&&overlay.deferredContactDelta>0,"contact backlog fixture did not reach coverage");
    viewport->coverage.maximum=500;view.advanceDeferred(1.0/60);
    view.advanceDeferred(1.0/60);
    check(overlay.offset>100&&std::abs(overlay.requested+overlay.deferredContactDelta-490)<1e-6,
      "coverage catch-up duplicated or lost contact distance");
    view.endDeferredInput(2,false);
    check(overlay.requested==490&&overlay.deferredContactDelta==0&&!overlay.deferredStream,
      "lift discarded buffered contact distance");
    overlay.offset=overlay.requested=90;overlay.deferred=false;viewport->coverage.maximum=100;
    for(int i=0;i<20;++i)view.applyDelta(viewport->id,20,2);
    view.applyDelta(viewport->id,-20,2);
    check(overlay.offset==80&&overlay.requested==80&&overlay.deferredContactDelta==0,
      "reversal replayed a forward contact backlog");
    for(int i=0;i<20;++i)view.applyDelta(viewport->id,20,2);
    view.cancelStream(2,wire::statuses::canceled);
    check(!overlay.deferred&&overlay.requested==overlay.offset&&overlay.deferredContactDelta==0,
      "cancel retained buffered contact distance");
    stream.active=true;overlay.offset=overlay.requested=90;
    for(int i=0;i<20;++i)view.applyDelta(viewport->id,100,2);
    check(overlay.requested+overlay.deferredContactDelta==1000,"contact backlog exceeded finite content bounds");
    view.close(wire::statuses::closed);
  }
  check(ledger->bytes==0,"deferred contact distance leaked leases");
  std::cout<<"Delayed coverage preserves contact distance with bounded preparation, lift, reversal, cancel and extent PASS.\n";
}
static void movingBuilder(){
  auto ledger=std::make_shared<Ledger>();
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto parent=std::make_shared<Node>(ledger);parent->id={1,1};parent->kind=wire::kinds::scrollViewport;parent->layout.enabled=true;parent->layout.direction=1;
    auto list=std::make_shared<Node>(ledger);list->id={2,1};list->parent=parent->id;list->kind=wire::kinds::sliver;list->layout.enabled=true;list->layout.direction=1;
    list->list={1,100,0,0,20,true,false};list->layoutBuilder=LayoutBuilderStyle{1,0};
    document->nodes.edit(1).value=parent;document->nodes.edit(2).value=list;document->children.set(0,{parent->id});document->children.set(1,{list->id});document->count=document->highWater=2;
    LayoutWork work(document,200,100,1,1,nullptr,{{parent->id,0,false,1000}});
    for(int i=0;i<10&&!work.waiting();++i)work.step(10000);
    check(bool(work.buildRequest())&&bool(work.buildRequest()->list),"list builder did not suspend");
    const auto request=*work.buildRequest();auto next=std::make_shared<Document>(*document);next->epoch=2;
    auto built=std::make_shared<Node>(*list);built->list.begin=request.list->begin;built->list.end=request.list->end;
    built->layoutBuilder->builtRevision=1;built->layoutBuilder->horizontal={wire::bounds::finite,0,request.constraints.maxWidth};built->layoutBuilder->vertical={wire::bounds::finite,0,request.constraints.maxHeight};
    next->nodes.edit(2).value=built;
    for(auto i=built->list.begin;i<built->list.end;++i){auto child=std::make_shared<Node>(ledger);child->id={3+i,1};child->parent=list->id;child->kind=wire::kinds::box;child->properties.width=200;child->properties.height=20;child->item={i,i+1};next->nodes.edit(child->id.slot).value=child;next->children.append(2,child->id);++next->count;next->highWater=child->id.slot;}
    check(!work.resumeBuild(next,{{parent->id,8,true,1000}}),"manual/editor offset fence was lost");
    check(!work.resumeBuild(next,{{{99,1},8,false,1000}}),"foreign viewport retarget was accepted");
    check(work.resumeBuild(next,{{parent->id,8,false,1000}}),"moving own viewport restarted a valid child reply");
    for(int i=0;i<10&&!work.waiting();++i)work.step(10000);
    check(work.buildRequest()&&work.buildRequest()->list&&work.buildRequest()->list->offset==8,"continued builder used the old offset");
  }
  check(ledger->bytes==0,"moving builder leases remain");
  std::cout<<"Moving list builder continuation and viewport fences PASS.\n";
}
void checkMovingList();
void checkRetargetedCoverage();
void checkLatePageCoverage();
void checkDateLayout();
int main(){std::cout.setf(std::ios::unitbuf);try{run();deadlines();precisionVelocity();legacyPreparationLead();ballisticCoverage();deferredContactDistance();movingBuilder();checkMovingList();checkRetargetedCoverage();checkLatePageCoverage();checkDateLayout();return 0;}catch(const std::exception& e){std::cerr<<e.what()<<"\n";}catch(const Error& e){std::cerr<<"Core status="<<e.status<<"\n";}return 1;}
