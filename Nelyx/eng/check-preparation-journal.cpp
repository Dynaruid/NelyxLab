// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/platform/common/preparation_journal.hpp"
#include <memory>
#include <sstream>
#include <stdexcept>
#include <iostream>
using namespace nelyx::v2;
namespace {
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
Reader read(const std::vector<uint8_t>& data){return {data.data(),data.size()};}
Writer packet(uint32_t op,const Writer& body=Writer(0),uint32_t count=0,uint64_t id=0){
  Writer p(wire::headerBytes+body.bytes.size());p.u32(0,wire::magic);p.u16(4,wire::abiMajor);p.u32(8,wire::schema);
  p.u16(12,uint16_t(op));p.u32(16,uint32_t(p.bytes.size()));p.u32(20,1);p.u32(24,1);p.u32(28,1);p.u32(32,1);
  p.u64(40,id);p.u32(wire::headerFields::count,count);std::copy(body.bytes.begin(),body.bytes.end(),p.bytes.begin()+wire::headerBytes);return p;
}
}
void checkPreparationJournal(){
  // The optional in-process observation must leave protocol results identical.
  Engine traced(1,1),plain(1,1);DispatchTiming timing;
  const auto call=[&](uint32_t op,const Writer& body=Writer(0),uint32_t count=0,uint64_t id=0){
    const auto p=packet(op,body,count,id);timing.capturePreparation=true;
    const auto a=traced.dispatch(read(p.bytes),&timing),b=plain.dispatch(read(p.bytes));
    check(a==b,"Preparation diagnostics changed protocol bytes");return a;
  };
  call(wire::opcodes::openView);
  check(timing.preparation&&timing.preparation->view==1&&timing.preparation->generation==1,"Diagnostic owner missing");
  Writer metrics(40);metrics.u64(0,2);metrics.f64(8,320);metrics.f64(16,240);metrics.f64(24,1);call(wire::opcodes::metrics,metrics);
  traced.connectProvider(true,1,2);plain.connectProvider(true,1,2);
  Writer create(24);create.u16(0,wire::commands::create);create.u32(4,24);writeHandle(create,8,{1,1});create.u32(16,wire::kinds::box);
  call(wire::opcodes::transaction,create,1,1);
  Writer step(8);step.u32(0,wire::limits::contentPerStep);
  for(unsigned i=0;i<8&&!timing.preparation->ready;++i)call(wire::opcodes::contentStep,step);
  check(timing.preparation->preparing&&timing.preparation->ready&&!timing.preparation->providerReady&&
    timing.preparation->current.document==1&&timing.preparation->current.metrics==2,"Layout/provider boundary collapsed");
  const auto cohort=timing.preparation->current;
  Writer ready(24);ready.u64(0,cohort.preparation);ready.u64(8,cohort.metrics);ready.u64(16,cohort.device);call(wire::opcodes::providerReady,ready);
  check(timing.preparation->providerReady,"Provider acknowledgement not observed");
  Writer tick(8);tick.f64(0,1);call(wire::opcodes::tick,tick);
  check(!timing.preparation->preparing&&timing.preparation->active==cohort,"Activated cohort identity differs");
  auto frame=call(wire::opcodes::takeFrame);const auto frameId=read(frame).u64(wire::headerBytes+wire::stateFields::submission);
  Writer release(24);release.u64(0,frameId);release.u64(8,cohort.device);release.u32(16,1);call(wire::opcodes::releaseFrame,release);
  Writer publish(24);publish.u64(0,frameId);publish.u64(8,cohort.device);call(wire::opcodes::publish,publish);
  check(timing.preparation->published==cohort&&timing.preparation->publication==frameId,"Publication cohort differs");
  auto inspect=packet(wire::opcodes::inspect);timing.capturePreparation=false;traced.dispatch(read(inspect.bytes),&timing);
  check(!timing.preparation&&!timing.capturePreparation,"Disabled diagnostics retained a snapshot");
  call(wire::opcodes::closeView);check(timing.preparation->closed,"Close observation lost its generation");

  // A continuation keeps preparation ID but changes document. Old request and
  // new ready/publication belong to distinct rows, including wide identities.
  auto journal=std::make_unique<diagnostics::PreparationJournal>();PreparationProgress p;
  p.session=1;p.app=2;p.view=3;p.generation=4;p.sequence=1;p.preparing=true;p.hasRequest=true;
  p.current={9007199254740993ULL,10,2,3,4};p.request.node={7,8};p.request.viewport={5,6};p.request.id=9007199254740995ULL;
  p.request.revision=9;p.request.list=true;p.request.listGeneration=9007199254740997ULL;p.request.begin=12;p.request.end=15;
  p.viewportCount=1;p.viewports[0].node={5,6};p.viewports[0].content={7,8};p.viewports[0].listGeneration=p.request.listGeneration;
  p.viewports[0].coverage=true;p.viewports[0].minimum=400;p.viewports[0].maximum=800;p.viewports[0].requested=1000;
  journal->observe(p,1,2);p.sequence=2;p.current.document=11;p.hasRequest=false;p.ready=true;
  journal->observe(p,3,4);p.sequence=3;p.providerReady=true;journal->observe(p,5,6);
  p.sequence=4;p.active=p.current;p.preparing=false;journal->observe(p,7,8);
  p.sequence=5;p.published=p.active;p.publication=55;p.publishedViewportCount=1;p.publishedViewports[0]=p.viewports[0];
  p.publishedViewports[0].offset=800;journal->observe(p,9,10);
  check(journal->through==2&&journal->samples[0].terminal==diagnostics::PreparationJournal::Terminal::continued&&
    journal->samples[0].requests[0].value.id==9007199254740995ULL&&!journal->samples[0].layoutReady.sequence,
    "Continuation merged an old request into new ready coverage");
  check(journal->samples[1].layoutReady.from==3&&journal->samples[1].providerReady.from==5&&
    journal->samples[1].activated.from==7&&journal->samples[1].published.from==9&&
    journal->samples[1].publishedViewports[0].offset==800,"Native phases or exact displayed coverage lost");
  p.sequence=4;journal->observe(p,1,2);check(journal->outOfOrder==1,"Out-of-order snapshots were silently accepted");
  std::ostringstream json;journal->write(json);check(json.str().find("\"9007199254740995\"")!=std::string::npos&&
    json.str().find("dispatch-observation-interval")!=std::string::npos,"Wide IDs or observation interval were rounded");
  p.sequence=6;p.current={100,12,2,3,4};p.active={};p.published={};p.preparing=true;p.ready=false;p.providerReady=false;
  journal->observe(p,11,12);p.sequence=7;p.closed=true;p.current={};journal->observe(p,13,14);
  check(journal->samples[2].terminal==diagnostics::PreparationJournal::Terminal::closed,"Pending close was not terminal");
  journal=std::make_unique<diagnostics::PreparationJournal>();p={};p.session=p.app=p.view=p.generation=1;p.preparing=true;
  for(uint64_t i=1;i<=129;++i){p.sequence=i;p.current={i,i,1,1,1};journal->observe(p,double(i),double(i));}
  check(journal->through==129&&journal->samples[0].sequence==129&&journal->samples[127].sequence==128,
    "Native preparation journal exceeded its fixed ring");
  std::cout<<"Preparation journal: optional protocol oracle, layout/provider/activation/publication, continuation, wide IDs, close, reorder and bounded ring PASS.\n";
}
