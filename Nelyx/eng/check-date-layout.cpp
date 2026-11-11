// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include <iostream>
#include <stdexcept>
using namespace nelyx::v2;
namespace {
void requireDate(bool value,const char* message){if(!value)throw std::runtime_error(message);}
std::shared_ptr<Node> addDateNode(std::shared_ptr<Document> document,uint32_t slot,uint32_t kind,Handle parent={}){
  auto node=std::make_shared<Node>(document->lease.ledger);node->id={slot,1};node->kind=kind;node->parent=parent;
  document->nodes.edit(slot).value=node;document->children.append(parent.slot,node->id);++document->count;document->highWater=std::max(document->highWater,slot);return node;
}
}
void checkDateLayout(){
  // Samples from the generated, pinned Flutter ScrollSpringSimulation, not an
  // Euler approximation or a second copy of this Core formula.
  const double samples[][3]={{.016,191.41175299922446,803.5551429577606},{.08,248.0101311211351,839.0758592935308},{.25,333.45862108620787,236.69402490141397},{.5,357.2228524328597,25.18735818663961}};
  for(const auto& row:samples){const auto value=PageSpring::sample(180,360,600,row[0]);requireDate(std::abs(value.first-row[1])<1e-9&&std::abs(value.second-row[2])<1e-9,"Native page spring differs from original Flutter");}
  requireDate(PageSpring::target(180,0,360,0,720,1)==360,"Page midpoint did not round forward");
  requireDate(PageSpring::target(500,-100,360,0,720,1)==360,"Reverse page snap target differs");
  requireDate(PageSpring::target(500,100,360,0,720,1)==720,"Forward page snap target differs");
  requireDate(PageSpring::target(700,1000,360,0,720,1)==720,"Page snap escaped maximum");
  auto ledger=std::make_shared<Ledger>();
  {
    View view(1,ledger);view.metrics={1,1,360,280,1};
    for(uint32_t i=0;i<wire::limits::publicationSnapshots;++i){auto frame=std::make_shared<Frame>();frame->id=i+1;view.publications[i]=frame;}
    view.published=view.publications.back();
    view.streams[1].capturedPublications[0]=view.publications.front();
    const std::weak_ptr<const Frame> captured=view.publications.front(),obsolete=view.publications[1];
    {Lease pressure(ledger,wire::limits::sessionBytes/2);view.contentStep(1);}
    requireDate(std::count_if(view.publications.begin(),view.publications.end(),[](const auto& frame){return bool(frame);})==2,
      "Large scene pressure did not bound obsolete input history");
    requireDate(!captured.expired()&&obsolete.expired()&&view.publications.back()==view.published,
      "History pressure retired captured input or retained obsolete geometry");
    view.close(wire::statuses::closed);
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=addDateNode(document,1,wire::kinds::scrollViewport);viewport->layout.enabled=true;viewport->properties.flags=wire::nodePropertyFlags::horizontal|wire::nodePropertyFlags::pageSnapping;
    auto list=addDateNode(document,2,wire::kinds::sliver,viewport->id);list->layout.enabled=true;list->layout.direction=0;list->list={1,100,0,8,360,true,false};
    for(uint32_t i=0;i<8;++i){auto child=addDateNode(document,3+i,wire::kinds::box,list->id);child->properties.width=360;child->properties.height=280;child->item={i,i+1};}
    LayoutWork work(document,360,280,1,1,nullptr,{});bool complete=false;for(int i=0;i<20&&!complete;++i)complete=work.step(10000);
    requireDate(complete,"Horizontal page list did not finish");
    const auto& result=work.document()->get(viewport->id);requireDate(result.properties.maximum==35640,"Horizontal page extent is wrong");
    const auto output=work.output();requireDate(output->boxes[2]->children[3].x==1080&&output->boxes[2]->children[3].y==0,"Page layout used the vertical axis");
    View view(1,ledger);view.metrics={1,1,360,280,1};view.document=document;
    const auto prepare=[&](std::shared_ptr<const Document> geometry,uint64_t id){
      view.preparing=std::make_unique<Preparation>();view.preparing->id=id;view.preparing->document=std::move(geometry);
      view.preparing->metrics=view.metrics;view.preparing->fontRevision=view.fontRevision;
      view.preparing->ready=view.preparing->providerReady=true;view.activate();
    };
    prepare(work.document(),1);
    Writer seek(48);writeHandle(seek,0,viewport->id);writeHandle(seek,8,list->id);seek.u64(16,1);seek.u32(24,50);seek.f64(40,2);
    requireDate(view.listSeek({seek.bytes.data(),seek.bytes.size()},1)==wire::statuses::pending,"Far page seek did not start");
    requireDate(view.overlays.at(viewport->id.key()).requested==18000,"Far page demand is wrong");
    auto repaint=std::make_shared<Document>(*work.document());repaint->epoch=2;view.document=repaint;
    prepare(repaint,2);
    requireDate(view.overlays.at(viewport->id.key()).offset==0&&view.overlays.at(viewport->id.key()).requested==18000,
      "Unrelated publication discarded a pending page seek");
    view.close(wire::statuses::closed);
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=addDateNode(document,1,wire::kinds::scrollViewport);viewport->layout.enabled=true;
    viewport->properties.flags=wire::nodePropertyFlags::horizontal|wire::nodePropertyFlags::pageSnapping;
    viewport->properties.initialScrollOffset=50*360;
    auto list=addDateNode(document,2,wire::kinds::sliver,viewport->id);list->layout.enabled=true;
    list->layout.direction=0;list->list={1,100,50,51,360,true,false};
    for(uint32_t i=50;i<51;++i){auto child=addDateNode(document,3+i-50,wire::kinds::box,list->id);
      child->properties.width=360;child->properties.height=280;child->item={i,i+1};}
    LayoutWork work(document,360,280,1,1,nullptr,{});bool complete=false;
    for(int i=0;i<20&&!complete;++i)complete=work.step(10000);
    requireDate(complete&&work.output()->boxes[1]->listRequestedOffset==18000,"Initial page did not reach first layout");
    View view(1,ledger);view.metrics={1,1,360,280,1};view.document=document;
    std::shared_ptr<const Document> geometry=work.document();
    const auto prepare=[&](uint64_t id){
      view.preparing=std::make_unique<Preparation>();view.preparing->id=id;view.preparing->document=geometry;
      view.preparing->metrics=view.metrics;view.preparing->fontRevision=view.fontRevision;
      view.preparing->ready=view.preparing->providerReady=true;view.activate();
    };
    prepare(1);
    requireDate(view.active&&view.overlays.at(viewport->id.key()).offset==18000,"First publication did not show initial page");
    auto repaint=std::make_shared<Document>(*geometry);
    auto changed=std::make_shared<Node>(repaint->get(viewport->id));
    changed->properties.initialScrollOffset=0;repaint->nodes.edit(viewport->id.slot).value=changed;
    geometry=repaint;prepare(2);
    requireDate(view.overlays.at(viewport->id.key()).offset==50*360,"Republish reset live page to initial page");
    view.close(wire::statuses::closed);
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto grid=addDateNode(document,1,wire::kinds::grid);grid->layout.enabled=true;grid->layout.columns=7;grid->layout.gap=8;grid->layout.constraintFlags=wire::layoutConstraintFlags::reverseMain;
    for(uint32_t i=0;i<5;++i){auto child=addDateNode(document,2+i,wire::kinds::box,grid->id);child->layout.enabled=true;child->properties.height=40;}
    LayoutWork work(document,384,40,1,1,nullptr,{});bool complete=false;for(int i=0;i<20&&!complete;++i)complete=work.step(10000);
    requireDate(complete,"RTL calendar row did not finish");const auto output=work.output();const auto& children=output->boxes[1]->children;
    requireDate(children[0].x==336&&children[4].x==112&&children[0].box->width==48,"RTL partial calendar row is misplaced");
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=addDateNode(document,1,wire::kinds::scrollViewport);viewport->layout.enabled=true;
    viewport->properties.flags=wire::nodePropertyFlags::horizontal|wire::nodePropertyFlags::pageSnapping;
    viewport->properties.initialScrollOffset=50*360;
    auto list=addDateNode(document,2,wire::kinds::sliver,viewport->id);list->layout.enabled=true;list->layout.direction=0;
    list->list={1,100,49,52,360,true,false};
    for(uint32_t index=49;index<52;++index){auto child=addDateNode(document,index-46,wire::kinds::box,list->id);
      child->properties.width=360;child->properties.height=280;child->item={index,index+1};}
    auto layout=std::make_shared<LayoutWork>(document,360,280,1,1,nullptr,std::vector<ScrollLayoutOffset>{});
    bool complete=false;for(int step=0;step<20&&!complete;++step)complete=layout->step(10000);
    requireDate(complete,"Contact-ready page layout did not finish");
    View view(1,ledger);view.metrics={1,1,360,280,1};view.document=document;
    view.preparing=std::make_unique<Preparation>();view.preparing->id=1;view.preparing->document=layout->document();
    view.preparing->metrics=view.metrics;view.preparing->ready=view.preparing->providerReady=true;view.activate();
    const auto publish=[&]{requireDate(view.takeFrame()==wire::statuses::ok,"Live contact did not produce a frame");
      const auto id=view.nextSubmission;view.releaseFrame(id,1,true,false);view.publish(id,1,0);};publish();
    // A suspended, unrelated Source cohort must not gate resident movement.
    view.preparing=std::make_unique<Preparation>();view.preparing->document=layout->document();view.preparing->metrics=view.metrics;
    auto& stream=view.streams[2];stream.active=true;stream.target=viewport->id;stream.source=wire::sources::engineDriven;
    double offset=18000;uint64_t sequence=0;
    for(const double delta:{-3.5,-7.25,-40.5,15.25,36.0,27.75,-27.75}){
      Input input{};input.sequence=++sequence;input.metrics=1;input.stream=2;input.source=wire::sources::engineDriven;
      input.phase=wire::phases::update;input.target=viewport->id;input.snapshot=view.published;input.dx=delta;
      view.processInput(input);offset+=delta;view.tick(double(sequence)/60);publish();
      const auto& property=view.published->properties[viewport->id.slot];
      requireDate(std::abs(property.offset-offset)<1e-9&&!property.deferred,
        "Published page offset did not follow every fractional contact delta");
      const auto item=std::find_if(view.published->items.begin(),view.published->items.end(),[](const auto& item){return item.node==Handle{4,1};});
      requireDate(item!=view.published->items.end()&&std::abs(item->world.tx-(18000-offset))<1e-9,
        "Page draw transform did not follow the published fractional offset");
      requireDate(view.active->preparation==1&&view.preparing&&!view.preparing->ready,
        "Resident input waited for or consumed an unfinished Source cohort");
    }
    view.close(wire::statuses::closed);
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    for(uint32_t i=0;i<373;++i){auto node=addDateNode(document,i+1,wire::kinds::box);node->semantics=std::make_shared<SemanticData>(ledger,wire::semanticsRoles::group,0,0,"date","","","","",SemanticRangeData{});}
    Resources resources{};const auto installed=transact(document,resources,{nullptr,0},0);
    requireDate(installed.document->count==373,"Original calendar semantics were rejected below the node budget");
    for(uint32_t i=373;i<=wire::limits::semanticsNodes;++i){auto node=addDateNode(document,i+1,wire::kinds::box);node->semantics=std::make_shared<SemanticData>(ledger,wire::semanticsRoles::group,0,0,"date","","","","",SemanticRangeData{});}
    bool rejected=false;try{transact(document,resources,{nullptr,0},0);}catch(const Error& error){rejected=error.status==wire::statuses::budgetExceeded;}
    requireDate(rejected,"Semantic node budget no longer rejects overflow");
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto builder=addDateNode(document,1,wire::kinds::box);builder->layout.enabled=true;
    builder->layout.constraintFlags=wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::expandEmpty;
    builder->layoutBuilder=LayoutBuilderStyle{2,2,{wire::bounds::finite,0,360},{wire::bounds::finite,0,280}};
    LayoutWork unchanged(document,360,280,1,1,nullptr,{});
    requireDate(unchanged.step(10000)&&!unchanged.buildRequest(),"Retained Content constraints triggered another builder round trip");
    LayoutWork resized(document,320,280,1,1,nullptr,{});
    requireDate(!resized.step(10000)&&resized.buildRequest()&&resized.buildRequest()->constraints.maxWidth==320,
      "Core admitted retained builder output with stale parent constraints");
    Writer update(80);update.u16(0,wire::commands::layoutBuilder);update.u32(4,80);writeHandle(update,8,builder->id);
    update.u64(16,3);update.u64(24,3);update.u32(32,wire::bounds::finite);update.f64(48,360);
    update.u32(56,wire::bounds::finite);update.f64(72,280);
    Resources resources{};const auto refreshed=transact(document,resources,{update.bytes.data(),update.bytes.size()},1);
    requireDate(refreshed.document->get(builder->id).layoutRevision==builder->layoutRevision,
      "Completed builder metadata invalidated unchanged layout");
    LayoutWork reused(refreshed.document,360,280,1,1,unchanged.output(),{});
    requireDate(reused.step(10000)&&reused.reused()>0,"Completed builder did not retain measured geometry");
    update.u64(16,4);update.u64(24,4);update.f64(48,320);
    const auto changed=transact(refreshed.document,resources,{update.bytes.data(),update.bytes.size()},1);
    requireDate(changed.document->get(builder->id).layoutRevision!=builder->layoutRevision,
      "Changed builder constraints did not invalidate layout");
  }
  {
    auto document=std::make_shared<Document>(ledger);document->epoch=1;
    auto viewport=addDateNode(document,1,wire::kinds::scrollViewport);viewport->layout.enabled=true;
    viewport->properties.flags=wire::nodePropertyFlags::horizontal|wire::nodePropertyFlags::pageSnapping;
    auto list=addDateNode(document,2,wire::kinds::sliver,viewport->id);list->layout.enabled=true;
    list->layout.direction=0;list->list={1,20,0,2,360,true,false};
    auto row=addDateNode(document,3,wire::kinds::box,list->id);row->layout.enabled=true;
    row->layout.constraintFlags=wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::enforceBounds;
    row->horizontal={wire::bounds::finite,360,360};row->vertical={wire::bounds::finite,280,280};row->item={0,1};
    auto sibling=addDateNode(document,5,wire::kinds::box,list->id);sibling->properties.width=360;sibling->properties.height=280;sibling->item={1,2};
    auto builder=addDateNode(document,4,wire::kinds::box,row->id);builder->layout.enabled=true;
    builder->layout.constraintFlags=wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::expandEmpty;
    builder->layoutBuilder=LayoutBuilderStyle{1,0};
    LayoutWork work(document,360,280,1,1,nullptr,{{viewport->id,0,false,1000}});
    work.step(10000);requireDate(bool(work.buildRequest()),"Page child builder did not suspend");
    const auto request=*work.buildRequest();auto next=std::make_shared<Document>(*document);next->epoch=2;
    auto built=std::make_shared<Node>(*builder);built->layoutBuilder->builtRevision=1;
    built->layoutBuilder->horizontal={wire::bounds::finite,request.constraints.minWidth,request.constraints.maxWidth};
    built->layoutBuilder->vertical={wire::bounds::finite,request.constraints.minHeight,request.constraints.maxHeight};
    next->nodes.edit(4).value=built;
    requireDate(!work.resumeBuild(next,{{{99,1},8,false,1000}}),"Foreign page viewport was accepted");
    requireDate(!work.resumeBuild(next,{{viewport->id,8,true,1000}}),"Page manual-input fence was lost");
    requireDate(work.resumeBuild(next,{{viewport->id,180,false,1000}}),"Moving page discarded a valid descendant builder reply");
    requireDate(work.step(10000)&&work.output()->boxes[1]->listRequestedOffset==180,"Resumed page lost the latest offset");
  }
  requireDate(ledger->bytes==0,"Native date layout leases remain");
  std::cout<<"Original page spring, horizontal pages, partial RTL grid and bounded calendar semantics PASS.\n";
}
