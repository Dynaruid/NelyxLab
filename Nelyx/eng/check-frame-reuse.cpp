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
static void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
static void run(){
  checkTransactionSharing();
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
int main(){try{run();deadlines();precisionVelocity();ballisticCoverage();movingBuilder();checkMovingList();checkRetargetedCoverage();checkLatePageCoverage();checkDateLayout();return 0;}catch(const std::exception& e){std::cerr<<e.what()<<"\n";}catch(const Error& e){std::cerr<<"Core status="<<e.status<<"\n";}return 1;}
