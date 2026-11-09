// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include "../engine/core/interaction/semantics_data.hpp"
#include <iostream>
#include <stdexcept>
using namespace nelyx::v2;
static void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
static void run(){
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
      document->nodes[id].value=node;document->children[node->parent.slot].push_back(node->id);
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

int main(){try{run();return 0;}catch(const std::exception& e){std::cerr<<e.what()<<"\n";}catch(const Error& e){std::cerr<<"Core status="<<e.status<<"\n";}return 1;}
