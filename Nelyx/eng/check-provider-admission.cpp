// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include "../engine/include/nelyx/engine.h"
#include <iostream>
#include <stdexcept>
#include <thread>
#include <atomic>
using namespace nelyx::v2;
namespace {
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
struct Engine {
  nelyx_engine* value=nullptr;
  Engine(){const nelyx_engine_options options{sizeof(options),wire::abiMajor,wire::abiMinor,
    wire::schema,1,1,wire::capabilities::protocol,0};
    check(nelyx_engine_create(&options,&value)==wire::statuses::ok,"Native engine create failed");}
  ~Engine(){nelyx_engine_destroy(value);}
  std::vector<uint8_t> call(uint32_t op,const Writer& body=Writer(0),bool view=true,uint32_t count=0){
    Writer input(wire::headerBytes+body.bytes.size());
    input.u32(wire::headerFields::magic,wire::magic);input.u16(wire::headerFields::major,wire::abiMajor);
    input.u16(wire::headerFields::minor,wire::abiMinor);input.u32(wire::headerFields::schema,wire::schema);
    input.u16(wire::headerFields::opcode,uint16_t(op));input.u32(wire::headerFields::length,uint32_t(input.bytes.size()));
    input.u32(wire::headerFields::session,1);input.u32(wire::headerFields::app,1);
    input.u32(wire::headerFields::view,view?1:0);input.u32(wire::headerFields::generation,view?1:0);
    input.u64(wire::headerFields::id,op==wire::opcodes::transaction?1:0);input.u32(wire::headerFields::count,count);
    std::copy(body.bytes.begin(),body.bytes.end(),input.bytes.begin()+wire::headerBytes);
    nelyx_engine_buffer output{sizeof(output),1,nullptr,0};
    check(nelyx_engine_dispatch(value,input.bytes.data(),uint32_t(input.bytes.size()),&output)==wire::statuses::ok,
      "Optional provider allocation escaped its structured response");
    std::vector<uint8_t> bytes(output.data,output.data+output.length);nelyx_engine_buffer_release(&output);return bytes;
  }
};
Reader read(const std::vector<uint8_t>& bytes){return {bytes.data(),bytes.size()};}
void ok(const std::vector<uint8_t>& bytes){check(read(bytes).u16(wire::headerFields::status)==wire::statuses::ok,"Native provider fixture request failed");}
}
void checkProviderAdmission(){
  {
    Ledger ledger;std::atomic<uint32_t> accepted{0},rejected{0},unexpected{0};
    const auto admit=[&](uint32_t owner){try{ledger.report(owner,2,1024,false,wire::limits::unifiedBytes-1536);++accepted;}
      catch(const Error& error){if(error.status==wire::statuses::budgetExceeded)++rejected;else ++unexpected;}
      catch(...){++unexpected;}};
    std::thread first(admit,1),second(admit,2);first.join();second.join();
    const auto state=ledger.snapshot();
    check(accepted==1&&rejected==1&&!unexpected&&state.total==1024&&state.peak==1024,
      "Concurrent headroom admission oversubscribed or charged temporary room");
    ledger.report(1,2,0);ledger.report(2,2,0);check(ledger.snapshot().total==0,"Admission accounts did not drain");
  }
  Engine engine;ok(engine.call(wire::opcodes::openView));
  Writer metrics(40);metrics.u64(0,2);metrics.f64(8,320);metrics.f64(16,240);metrics.f64(24,1);
  ok(engine.call(wire::opcodes::metrics,metrics));
  Writer create(24);create.u16(0,wire::commands::create);create.u32(4,24);writeHandle(create,8,{1,1});create.u32(16,wire::kinds::box);
  const auto accepted=engine.call(wire::opcodes::transaction,create,true,1);
  check(read(accepted).u16(wire::headerFields::status)==wire::statuses::accepted,"Native fixture document rejected");
  Writer step(8);step.u32(0,wire::limits::contentPerStep);
  for(uint32_t i=0;i<8;++i)ok(engine.call(wire::opcodes::contentStep,step));
  const auto state=engine.call(wire::opcodes::inspect);ok(state);
  const auto total=read(state).u64(wire::headerBytes+wire::stateFields::memoryTotal);
  // Native allocations grow the ledger directly. Wasm allocations below its
  // committed heap size intentionally do not consume a second unified credit.
  Writer report(16);report.u32(0,1);report.u32(4,2);report.u64(8,wire::limits::unifiedBytes-total-48000);
  ok(engine.call(wire::opcodes::memoryReport,report,false));
  const auto admitted=engine.call(wire::opcodes::inspect);ok(admitted);
  const auto peak=read(admitted).u64(wire::headerBytes+wire::stateFields::memoryPeak);
  Writer guarded(wire::memoryReportHeadroomBytes);guarded.u32(0,1);guarded.u32(4,2);
  guarded.u64(8,read(report.bytes).u64(8));guarded.u64(16,65536);
  const auto denied=engine.call(wire::opcodes::memoryReport,guarded,false);
  check(read(denied).u16(wire::headerFields::status)==wire::statuses::budgetExceeded,"Headroom check skipped an unchanged live account");
  check(read(denied).u64(wire::headerBytes+wire::stateFields::memoryCpu)==read(report.bytes).u64(8)&&
    read(denied).u64(wire::headerBytes+wire::stateFields::memoryPeak)==peak,"Rejected headroom changed its account or committed peak");
  guarded.u64(16,uint64_t(wire::limits::unifiedBytes)+1);
  check(read(engine.call(wire::opcodes::memoryReport,guarded,false)).u16(wire::headerFields::status)==wire::statuses::invalidValue,
    "Unbounded admission headroom was accepted");
  Writer delta(16);delta.u32(0,wire::inspectionFlags::providerPreparationDelta);
  const auto rejected=engine.call(wire::opcodes::preparationScene,delta);
  check(read(rejected).u16(wire::headerFields::status)==wire::statuses::budgetExceeded,"Optional preparation proof did not meet its quota");
  check(read(rejected).u32(wire::headerBytes+wire::stateFields::holds)==0,"Rejected preparation acquired a frame holder");
  report.u64(8,0);ok(engine.call(wire::opcodes::memoryReport,report,false));
  const auto recovered=engine.call(wire::opcodes::preparationScene);ok(recovered);
  check(read(recovered).u32(wire::headerFields::count)==1,"Rejected proof invalidated its usable candidate");
  const auto closed=engine.call(wire::opcodes::closeSession,Writer(0),false);ok(closed);
  check(read(closed).u64(wire::headerBytes+wire::stateFields::reservedBytes)==0,"Provider admission fixture retained memory");
  std::cout<<"Optional preparation proof admission: structured quota rejection, usable candidate and close PASS.\n";
}
