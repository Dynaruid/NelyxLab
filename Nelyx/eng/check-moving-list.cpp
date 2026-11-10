// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include <iostream>
#include <stdexcept>
using namespace nelyx::v2;
void checkLatePageCoverage(){
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);view.metrics={1,1,200,20,1};
    const Handle viewport{1,1},listId{2,1};
    const auto make=[&](uint64_t epoch,uint32_t begin){
      auto doc=std::make_shared<Document>(ledger);doc->epoch=epoch;
      auto parent=std::make_shared<Node>(ledger);parent->id=viewport;parent->kind=wire::kinds::scrollViewport;parent->layout.enabled=true;parent->layout.direction=1;
      auto list=std::make_shared<Node>(ledger);list->id=listId;list->parent=viewport;list->kind=wire::kinds::sliver;list->layout.enabled=true;list->layout.direction=1;list->list={epoch,100,begin,begin+4,20,true,false};
      doc->nodes[1].value=parent;doc->nodes[2].value=list;doc->children[0]={viewport};doc->children[1]={listId};doc->count=2;doc->highWater=2;
      for(uint32_t i=begin;i<begin+4;++i){auto child=std::make_shared<Node>(ledger);child->id={3+i,1};child->parent=listId;child->kind=wire::kinds::box;child->properties.width=200;child->properties.height=20;child->item={i,i+1};doc->nodes[3+i].value=child;doc->children[2].push_back(child->id);++doc->count;doc->highWater=3+i;}
      return doc;
    };
    auto& offset=view.overlays[viewport.key()];offset.node=viewport;offset.offset=offset.requested=200;
    const auto prepare=[&](std::shared_ptr<Document> doc){
      view.document=doc;
      auto layout=std::make_shared<LayoutWork>(doc,200,20,1,1,nullptr,std::vector<ScrollLayoutOffset>{{viewport,200}});
      bool complete=false;for(int i=0;i<20&&!complete;++i)complete=layout->step(10000);
      if(!complete)throw std::runtime_error("page fixture did not prepare");
      view.preparing=std::make_unique<Preparation>();view.preparing->id=doc->epoch;
      view.preparing->document=layout->document();view.preparing->metrics=view.metrics;
      view.preparing->fontRevision=view.fontRevision;view.preparing->layout=layout;
      view.preparing->ready=view.preparing->providerReady=true;
      view.activate();
    };
    prepare(make(1,9));if(!view.active)throw std::runtime_error("initial page did not activate");
    const auto active=view.active;
    prepare(make(2,12));
    if(view.failedDocument||view.preparing||view.demand||view.active!=active)
      throw std::runtime_error("late page window failed or replaced live coverage");
    if(std::none_of(view.interactionEvents.begin(),view.interactionEvents.end(),[](const auto& e){return e.kind==wire::events::needChildren;}))
      throw std::runtime_error("late page window did not request current demand");
    view.contentStep(10000);
    if(view.preparing)throw std::runtime_error("late page window busy-looped on obsolete document");
    prepare(make(3,9));
    if(!view.active||view.active->document->epoch!=3||view.failedDocument)
      throw std::runtime_error("corrected page window did not recover");
    view.close(wire::statuses::closed);
  }
  if(ledger->bytes)throw std::runtime_error("late page recovery leaked leases");
  std::cout<<"Late fixed page coverage cancels, requests live demand, recovers without failure PASS.\n";
}
void checkRetargetedCoverage(){
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);view.metrics={1,1,200,100,1};
    auto document=std::make_shared<Document>(ledger);document->epoch=2;
    auto parent=std::make_shared<Node>(ledger);parent->id={1,1};parent->kind=wire::kinds::scrollViewport;parent->layout.enabled=true;parent->layout.direction=1;
    auto list=std::make_shared<Node>(ledger);list->id={2,1};list->parent=parent->id;list->kind=wire::kinds::sliver;list->layout.enabled=true;list->layout.direction=1;list->list={1,100,10,15,20,true,false};
    document->nodes[1].value=parent;document->nodes[2].value=list;document->children[0]={parent->id};document->children[1]={list->id};document->count=document->highWater=2;
    for(uint32_t i=10;i<15;++i){auto child=std::make_shared<Node>(ledger);child->id={3+i,1};child->parent=list->id;child->kind=wire::kinds::box;child->properties.width=200;child->properties.height=20;child->item={i,i+1};document->nodes[3+i].value=child;document->children[2].push_back(child->id);++document->count;document->highWater=3+i;}
    auto layout=std::make_shared<LayoutWork>(document,200,100,1,1,nullptr,std::vector<ScrollLayoutOffset>{{parent->id,100}});
    bool complete=false;for(int i=0;i<10&&!complete;++i)complete=layout->step(10000);
    if(!complete)throw std::runtime_error("coverage fixture did not finish");
    // The requested scalar matches, but a prepared row window no longer covers
    // the resolved anchor. Retrying must revisit demand, not reuse this root.
    auto geometry=std::make_shared<Document>(*layout->document());
    auto sourceList=std::make_shared<Node>(*list);sourceList->layoutBuilder=LayoutBuilderStyle{1,1,{wire::bounds::finite,0,200},{wire::bounds::finite,0,100}};document->nodes[2].value=sourceList;
    auto preparedList=std::make_shared<Node>(geometry->get(list->id));preparedList->layoutBuilder=sourceList->layoutBuilder;geometry->nodes[2].value=preparedList;
    view.document=document;auto& overlay=view.overlays[parent->id.key()];overlay.node=parent->id;overlay.offset=overlay.requested=100;
    view.preparing=std::make_unique<Preparation>();view.preparing->id=1;view.preparing->document=geometry;view.preparing->metrics=view.metrics;view.preparing->fontRevision=view.fontRevision;view.preparing->layout=layout;view.preparing->ready=view.preparing->providerReady=true;
    view.activate();
    if(view.failedDocument||view.preparing||!view.demand||!view.pendingLayoutCache||view.pendingLayoutCache->boxes[1])throw std::runtime_error("measured coverage miss did not invalidate/retry its viewport");
    for(int i=0;i<10&&(!view.preparing||!view.preparing->layout||!view.preparing->layout->buildRequest());++i)view.contentStep(10000);
    if(!view.preparing||!view.preparing->layout||!view.preparing->layout->buildRequest())throw std::runtime_error("coverage retry reused the same rejected scene");
    view.close(wire::statuses::closed);
  }
  if(ledger->bytes)throw std::runtime_error("retargeted coverage leaked leases");
  std::cout<<"Equal-offset measured coverage miss retries with fresh viewport demand PASS.\n";
}
void checkMovingList(){
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);view.metrics={1,1,200,720,1};
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto parent=std::make_shared<Node>(ledger);parent->id={1,1};parent->kind=wire::kinds::scrollViewport;parent->layout.enabled=true;parent->layout.direction=1;
    auto list=std::make_shared<Node>(ledger);list->id={2,1};list->parent=parent->id;list->kind=wire::kinds::sliver;list->layout.enabled=true;list->layout.direction=1;
    list->list={1,100,0,0,0,false,true};list->layoutBuilder=LayoutBuilderStyle{1,0};
    document->nodes[1].value=parent;document->nodes[2].value=list;document->children[0]={parent->id};document->children[1]={list->id};document->count=document->highWater=2;
    view.document=document;view.requestContent();
    double at=0;uint64_t inputSequence=0,pending=0;int delay=0;
    const auto reply=[&](const LayoutBuildRequest& request){
      auto next=std::make_shared<Document>(*view.document);++next->epoch;
      auto built=std::make_shared<Node>(next->get(list->id));++built->layoutRevision;++built->configurationRevision;
      built->list.begin=request.list->begin;built->list.end=request.list->end;built->layoutBuilder->builtRevision=built->layoutBuilder->revision;
      built->layoutBuilder->horizontal={wire::bounds::finite,0,request.constraints.maxWidth};built->layoutBuilder->vertical={wire::bounds::finite,0,request.constraints.maxHeight};next->nodes[2].value=built;
      // Keep published/previous rows alive, like the Source bucket, while the
      // next window is measured. All rows have real, nonuniform fixed geometry.
      for(auto i=built->list.begin;i<built->list.end;++i)if(!next->nodes[3+i].value){
        auto child=std::make_shared<Node>(ledger);child->id={3+i,1};child->parent=list->id;child->kind=wire::kinds::box;
        constexpr double heights[]={80,240,400,700,120};child->properties.width=200;child->properties.height=heights[i%5];child->item={i,i+1};
        next->nodes[child->id.slot].value=child;next->children[2].push_back(child->id);++next->count;next->highWater=std::max(next->highWater,child->id.slot);
      }
      auto root=std::make_shared<Node>(next->get(parent->id));++root->layoutRevision;next->nodes[1].value=root;
      view.document=next;view.requestContent();
    };
    const auto pump=[&](bool delayed){
      at+=.05;view.tick(at);
      for(int i=0;i<3;++i)view.contentStep(10000);
      if(view.preparing&&view.preparing->layout&&view.preparing->layout->buildRequest()){
        const auto request=*view.preparing->layout->buildRequest();
        if(request.id!=pending){pending=request.id;delay=delayed?2:0;}
        if(delay--<=0){reply(request);pending=0;}
      }
      if(view.takeFrame()==wire::statuses::ok){const auto id=view.nextSubmission;view.releaseFrame(id,1,true,false);view.publish(id,1,0);}
      if(view.failedDocument)throw std::runtime_error("moving list preparation failed doc="+std::to_string(view.failedDocument)+" at="+std::to_string(at));
      view.events.clear();view.interactionEvents.clear();
    };
    for(int i=0;i<24&&(!view.active||view.preparing||view.demand);++i)pump(false);
    if(!view.published)throw std::runtime_error("moving list did not publish initial coverage");
    const auto input=[&](uint32_t phase,double delta){Input p{};p.sequence=++inputSequence;p.metrics=1;p.stream=2;p.source=wire::sources::engineDriven;p.phase=phase;p.target=parent->id;p.snapshot=view.published;p.x=10;p.y=10;p.dy=delta;p.velocity=delta<0?-4000:4000;view.processInput(p);};
    input(wire::phases::begin,0);
    for(int step=0;step<28;++step){
      input(wire::phases::update,step<14?200:-200);
      const auto& geometry=view.active->document->get(list->id);
      auto& offset=view.overlays.at(parent->id.key());
      const auto range=nativeListCacheRange(geometry.list,geometry.listGeometry.get(),std::max(0.0,offset.requested),720,offset.velocity);
      if(!view.preparing&&!view.demand&&(range.begin!=geometry.list.begin||range.end!=geometry.list.end)){
        auto next=std::make_shared<Document>(*view.document);++next->epoch;
        auto dirty=std::make_shared<Node>(next->get(list->id));++dirty->layoutRevision;++dirty->configurationRevision;++dirty->layoutBuilder->revision;dirty->list.begin=dirty->list.end=0;next->nodes[2].value=dirty;
        auto root=std::make_shared<Node>(next->get(parent->id));++root->layoutRevision;next->nodes[1].value=root;view.document=next;view.requestContent();
      }
      pump(true);
    }
    input(wire::phases::end,-200);
    for(int i=0;i<12;++i)pump(true);
    view.close(wire::statuses::closed);
  }
  if(ledger->bytes)throw std::runtime_error("moving list simulation leaked leases");
  std::cout<<"Fast moving/reversing variable list with delayed App replies PASS.\n";
}
