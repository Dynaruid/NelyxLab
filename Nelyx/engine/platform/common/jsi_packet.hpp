// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include <cmath>
#include <climits>
#include <memory>
#include <vector>

namespace nelyx::v2::native {
/** Bounded JSI value reader. No OS, React context, registry or event dispatcher. */
class Packet {
  using Runtime=facebook::jsi::Runtime;
  using Value=facebook::jsi::Value;
 public:
  Packet(Runtime& rt,Value value):Packet(rt,std::move(value),std::make_shared<size_t>(16*1024*1024)){}
  Packet field(const char* name)const{return {rt,value.getObject(rt).getProperty(rt,name),remaining};}
  bool absent()const{return value.isNull()||value.isUndefined();}
  std::string string(size_t limit=4096)const{auto result=value.getString(rt).utf8(rt);if(result.size()>limit)fail();consume(result.size());return result;}
  double number()const{auto result=value.getNumber();if(!std::isfinite(result))fail();return result;}
  uint64_t counter(bool zero=true)const{const auto n=number();if(n<(zero?0:1)||n>9007199254740991.||n!=std::floor(n))fail();return uint64_t(n);}
  int offset()const{const auto n=counter();if(n>INT_MAX)fail();return int(n);}
  bool boolean()const{return value.getBool();}
  std::vector<Packet> array(size_t limit=4096)const{auto a=value.getObject(rt).getArray(rt);const auto size=a.size(rt);if(size>limit)fail();consume(size*sizeof(Value));std::vector<Packet> result;result.reserve(size);for(size_t i=0;i<size;++i)result.push_back(Packet(rt,a.getValueAtIndex(rt,i),remaining));return result;}
  [[noreturn]] void fail()const{throw facebook::jsi::JSError(rt,"Invalid native service packet");}
 private:
  Packet(Runtime& runtime,Value item,std::shared_ptr<size_t> budget):rt(runtime),value(std::move(item)),remaining(std::move(budget)){}
  void consume(size_t bytes)const{if(bytes>*remaining)fail();*remaining-=bytes;}
  Runtime& rt;Value value;std::shared_ptr<size_t> remaining;
};
}
