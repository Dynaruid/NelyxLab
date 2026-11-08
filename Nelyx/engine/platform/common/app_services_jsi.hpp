// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/memory.hpp"
#include "../../core/interaction/editing.hpp"
#include "jsi_packet.hpp"
#include <deque>
#include <map>
#include <mutex>
#include <functional>
#include <utility>

namespace nelyx::v2::native {
/** Copied strings and ledger credits cross owners; JSI and OS objects do not. */
class AppServices final {
  struct Record {
    uint32_t id;std::string method,text,result,error;uint64_t bytes;
    std::shared_ptr<ExternalLease> credit;
  };
  std::shared_ptr<Ledger> ledger;
  std::function<void()> notifyUI,notifyApp;
  mutable std::mutex gate;
  std::map<uint32_t,std::shared_ptr<Record>> pending;
  std::deque<std::shared_ptr<Record>> requests,replies;
  uint32_t sequence=0;uint64_t heldBytes=0;bool stopped=false;
  static void text(const std::string& value) {
    if(value.size()>4*65536||value.find('\0')!=std::string::npos)
      throw std::runtime_error("App clipboard text exceeds its byte/NUL boundary");
    const auto units=utf16({reinterpret_cast<const uint8_t*>(value.data()),value.size()});
    if(units.size()>65536)throw std::runtime_error("App clipboard text exceeds65536 UTF-16 units");
  }
 public:
  AppServices(std::shared_ptr<Ledger> ledger,std::function<void()> ui,std::function<void()> app)
    :ledger(std::move(ledger)),notifyUI(std::move(ui)),notifyApp(std::move(app)){}
  void request(uint32_t id,std::string method,std::string value) {
    text(value);
    const bool read=method=="clipboard-read"||method=="clipboard-has-strings";
    const bool semantics=method=="semantics-tap"||method=="semantics-longPress"||method=="semantics-focus";
    if((!read&&method!="clipboard-write"&&!semantics&&method!="system-sound"&&method!="haptic-feedback")||
      (read&&!value.empty()))throw std::runtime_error("Unsupported App OS service request");
    if(semantics){if(value.empty()||value.size()>20||value.find_first_not_of("0123456789")!=std::string::npos||std::stoull(value)==0)throw std::runtime_error("Invalid native semantics event identity");}
    // Reserve returned UTF-8 and the temporary OS UTF-16 copy before access.
    const auto bytes=sizeof(Record)+value.size()+(read?6ull*65536:0ull)+1024;
    {
      std::lock_guard lock(gate);
      if(stopped||!id||id<=sequence||pending.size()>=32||heldBytes+bytes>4*wire::limits::packetBytes)
        throw std::runtime_error("App OS service mailbox is full, closed or has a reused ID");
      auto record=std::make_shared<Record>();record->id=id;record->method=std::move(method);record->text=std::move(value);record->bytes=bytes;
      record->credit=std::make_shared<ExternalLease>(ledger,3,5,bytes);
      pending.emplace(id,record);
      try{requests.push_back(record);}catch(...){pending.erase(id);throw;}
      sequence=id;heldBytes+=bytes;
    }
    notifyUI();
  }
  void stop(){std::lock_guard lock(gate);stopped=true;}
  /** UI owns actual OS access. A stopped, unstarted operation never writes. */
  void pump(const std::function<std::string(const std::string&,const std::string&)>& execute) {
    std::deque<std::shared_ptr<Record>> admitted;
    {std::lock_guard lock(gate);admitted.swap(requests);}
    for(auto& record:admitted){
      bool canceled;{std::lock_guard lock(gate);canceled=stopped;}
      try{
        if(canceled)throw std::runtime_error("App OS service operation canceled before execution");
        record->result=execute(record->method,record->text);text(record->result);
        if(record->method!="clipboard-read"&&record->method!="clipboard-has-strings"&&!record->result.empty())throw std::runtime_error("Invalid App feedback/write reply");
        if(record->method=="clipboard-has-strings"&&record->result!="0"&&record->result!="1")throw std::runtime_error("Invalid clipboard availability reply");
      }catch(const std::exception& error){record->result.clear();record->error=std::string(error.what()).substr(0,1024);}
      {std::lock_guard lock(gate);replies.push_back(std::move(record));}
    }
    if(!admitted.empty())notifyApp();
  }
  /** App owner only. Retire native bytes before running Promise continuations. */
  bool deliver(facebook::jsi::Runtime& rt) {
    namespace jsi=facebook::jsi;
    std::shared_ptr<Record> record;
    {std::lock_guard lock(gate);if(replies.empty())return false;record=std::move(replies.front());replies.pop_front();pending.erase(record->id);heldBytes-=record->bytes;}
    rt.global().getPropertyAsFunction(rt,"__v2ServiceReply").call(rt,double(record->id),
      jsi::String::createFromUtf8(rt,record->result),record->error.empty()?jsi::Value::undefined():jsi::Value(jsi::String::createFromUtf8(rt,record->error)));
    return true;
  }
  std::pair<size_t,uint64_t> snapshot()const{std::lock_guard lock(gate);return {pending.size(),heldBytes};}
  void close(){std::lock_guard lock(gate);stopped=true;requests.clear();replies.clear();pending.clear();heldBytes=0;}
};
inline void installAppServices(facebook::jsi::Runtime& rt,facebook::jsi::Object& native,const std::shared_ptr<AppServices>& services) {
  namespace jsi=facebook::jsi;
  native.setProperty(rt,"appServicesVersion",2);
  native.setProperty(rt,"appService",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"appService"),3,[services](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
    if(count!=3)throw jsi::JSError(rt,"App OS service arguments required");
    const auto id=Packet(rt,jsi::Value(rt,args[0])).counter(false);
    if(id>UINT32_MAX)throw jsi::JSError(rt,"App OS service ID overflow");
    try{services->request(uint32_t(id),Packet(rt,jsi::Value(rt,args[1])).string(32),Packet(rt,jsi::Value(rt,args[2])).string(4*65536));}
    catch(const std::exception& error){throw jsi::JSError(rt,error.what());}
    return jsi::Value::undefined();
  }));
  native.setProperty(rt,"stopAppServices",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"stopAppServices"),0,[services](jsi::Runtime&,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{services->stop();return jsi::Value::undefined();}));
  native.setProperty(rt,"appServicesSnapshot",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"appServicesSnapshot"),0,[services](jsi::Runtime& rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{
    const auto state=services->snapshot();jsi::Object value(rt);value.setProperty(rt,"pending",double(state.first));value.setProperty(rt,"bytes",double(state.second));return value;
  }));
}
}
