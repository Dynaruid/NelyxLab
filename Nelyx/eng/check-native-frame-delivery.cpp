// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/engine.hpp"
#include "../engine/core/state.hpp"
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
void ok(const std::vector<uint8_t>& bytes){check(read(bytes).u16(14)==wire::statuses::ok,"Native delivery fixture request failed");}
}
void checkNativeFrameDelivery(){
  Engine engine(1,1);const auto ledger=engine.memoryLedger();
  const auto call=[&](uint32_t op,const Writer& body=Writer(0),uint32_t count=0,uint64_t id=0){const auto p=packet(op,body,count,id);return engine.dispatch(read(p.bytes));};
  ok(call(wire::opcodes::openView));
  Writer metrics(40);metrics.u64(0,2);metrics.f64(8,320);metrics.f64(16,240);metrics.f64(24,1);ok(call(wire::opcodes::metrics,metrics));
  Writer create(24);create.u16(0,wire::commands::create);create.u32(4,24);writeHandle(create,8,{1,1});create.u32(16,wire::kinds::box);
  check(read(call(wire::opcodes::transaction,create,1,1)).u16(14)==wire::statuses::accepted,"Native delivery document rejected");
  Writer step(8);step.u32(0,wire::limits::contentPerStep);
  for(unsigned i=0;i<8;++i)ok(call(wire::opcodes::contentStep,step));
  Writer tick(8);tick.f64(0,1);ok(call(wire::opcodes::tick,tick));
  const auto take=packet(wire::opcodes::takeFrame);
  std::shared_ptr<const Frame> native;
  const auto response=engine.dispatchNativeFrame(read(take.bytes),native);ok(response);
  check(native&&native->items.size()==1&&native->scene->document->contains({1,1}),"Native delivery lost its frame");
  check(read(response).u32(wire::headerFields::count)==0&&read(response).u32(wire::headerBytes+wire::stateFields::blobCount)==0&&
    response.size()==wire::headerBytes+wire::stateBytes,"Native delivery serialized discarded rows or paint blobs");
  check(native->id==read(response).u64(wire::headerBytes+wire::stateFields::submission)&&native->snapshotLease,
    "Native reader lacks submission identity or storage credit");
  auto snapshot=engine.frameSnapshot(1,1,native->id);
  check(snapshot->items[0].node==native->items[0].node&&snapshot->properties.size()==native->properties.size(),"Native snapshot geometry differs");
  Writer release(24);release.u64(0,native->id);release.u64(8,native->device);release.u32(16,1);ok(call(wire::opcodes::releaseFrame,release));
  Writer publish(24);publish.u64(0,native->id);publish.u64(8,native->device);ok(call(wire::opcodes::publish,publish));
  auto first=engine.interactionSnapshot(1,1);check(bool(first),"Published interaction snapshot unavailable");
  const auto before=ledger->bytes.load();
  check(engine.interactionSnapshot(1,1,first)==first&&ledger->bytes==before,"Unchanged interaction snapshot was copied");
  auto empty=engine.dispatchNativeFrame(read(take.bytes),native);
  check(read(empty).u16(14)==wire::statuses::notFound&&!native,"Empty acquisition retained a previous reader");
  Writer visible(16);visible.u32(0,1);ok(call(wire::opcodes::visibility,visible));
  visible.u32(0,0);ok(call(wire::opcodes::visibility,visible));
  auto hidden=engine.interactionSnapshot(1,1,first);
  check(hidden!=first&&!hidden->visible,"Snapshot reuse concealed a visibility fence");
  visible.u32(0,3);ok(call(wire::opcodes::visibility,visible));
  tick.f64(0,2);ok(call(wire::opcodes::tick,tick));
  const auto wireFrame=call(wire::opcodes::takeFrame);ok(wireFrame);
  check(read(wireFrame).u32(wire::headerFields::count)==1,"Normal wire delivery lost its rows");
  const auto id=read(wireFrame).u64(wire::headerBytes+wire::stateFields::submission);
  auto acquired=engine.frameSnapshot(1,1,id);
  release.u64(0,id);release.u32(16,0);release.u32(20,1);ok(call(wire::opcodes::releaseFrame,release));
  check(acquired->items.size()==1,"Failed submission invalidated its retained reader");acquired.reset();
  // Exhaust only external headroom after frame construction would fit. The
  // reader reservation must roll back an acquisition, then permit a retry.
  const auto state=call(wire::opcodes::inspect);const auto total=read(state).u64(wire::headerBytes+wire::stateFields::memoryTotal);
  ledger->report(1,2,wire::limits::unifiedBytes-total-128);
  const auto denied=engine.dispatchNativeFrame(read(take.bytes),native);
  check(read(denied).u16(14)==wire::statuses::budgetExceeded&&!native&&
    read(denied).u32(wire::headerBytes+wire::stateFields::holds)==0,"Failed reader admission stranded a submission");
  ledger->report(1,2,0);
  const auto recovered=engine.dispatchNativeFrame(read(take.bytes),native);ok(recovered);
  check(bool(native),"Native reader did not recover after pressure");
  release.u64(0,native->id);ok(call(wire::opcodes::releaseFrame,release));native.reset();
  const auto inspect=packet(wire::opcodes::inspect);
  check(read(engine.dispatchNativeFrame(read(inspect.bytes),native)).u16(14)==wire::statuses::invalidValue&&!native,
    "Native frame entry accepted another opcode");
  metrics.u64(0,3);ok(call(wire::opcodes::metrics,metrics));
  auto changed=engine.interactionSnapshot(1,1,first);
  check(changed!=first&&changed->metrics.epoch==3,"Snapshot reuse concealed a metrics fence");
  first.reset();hidden.reset();changed.reset();
  auto close=packet(wire::opcodes::closeSession);close.u32(28,0);close.u32(32,0);ok(engine.dispatch(read(close.bytes)));
  check(snapshot->items.size()==1&&ledger->bytes>0,"Close invalidated an independently retained native reader");
  snapshot.reset();check(ledger->bytes==0,"Native frame readers retained memory after close");
  std::cout<<"Native frame delivery: no discarded wire rows, normal wire oracle, quota rollback, reader/visibility/metrics fences PASS.\n";
}
