// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include "nelyx_skia/pointer_targets.h"
#include "JsiNativeServiceAudit.h"
#include <cstring>
#include <thread>
namespace RNSkia {
class JsiPointerTargets final : public facebook::jsi::HostObject,public std::enable_shared_from_this<JsiPointerTargets> {
  nelyx::pointer_targets::Session session;
  std::thread::id owner=std::this_thread::get_id();
public:
  explicit JsiPointerTargets(double generation):session(generation){}
  facebook::jsi::Value get(facebook::jsi::Runtime& runtime,const facebook::jsi::PropNameID& property)override{
    namespace jsi=facebook::jsi;auto name=property.utf8(runtime);if(name!="patch"&&name!="query"&&name!="drop"&&name!="close")return jsi::Value::undefined();
    return jsi::Function::createFromHostFunction(runtime,property,name=="close"?0:1,[self=shared_from_this(),name](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value {
      if(self->owner!=std::this_thread::get_id())throw jsi::JSError(rt,"Pointer session requires its JS owner");
      if(name=="close"){self->session.close();return jsi::Value::undefined();}
      if(count!=1)throw jsi::JSError(rt,"Pointer session requires one argument");
      if(name=="drop"){if(!args[0].isNumber())throw jsi::JSError(rt,"Pointer drop requires ID");self->session.drop(args[0].getNumber());return jsi::Value::undefined();}
      auto buffer=args[0].getObject(rt).getArrayBuffer(rt);auto bytes=buffer.size(rt);
      if(bytes<7*8||bytes>(7+128*8)*8||bytes%8)throw jsi::JSError(rt,"Pointer packet budget/alignment");
      std::vector<double> packet(bytes/8);std::memcpy(packet.data(),buffer.data(rt),bytes);
      if(name=="patch"){self->session.patch(packet);NativeServiceAudit::recordScroll({{2,bytes}});return jsi::Value::undefined();}
      auto values=self->session.query(packet);NativeServiceAudit::recordScroll({{0,1},{1,uint64_t(values[2])}});jsi::Array result(rt,values.size());for(size_t i=0;i<values.size();++i)result.setValueAtIndex(rt,i,values[i]);return result;
    });
  }
};
}
