// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include "nelyx_skia/input_geometry.h"
#include <cstring>
#include <chrono>
#include <memory>
#include <thread>

namespace RNSkia {
// Numeric-only HostObject state. It caches no Runtime*, JS value or GPU context.
class JsiInputGeometry final : public facebook::jsi::HostObject,
                              public std::enable_shared_from_this<JsiInputGeometry> {
  using Runtime = facebook::jsi::Runtime;
  using Value = facebook::jsi::Value;
  nelyx::input_geometry::Session session_;
  const std::thread::id thread_ = std::this_thread::get_id();
  void ensureThread() const {
    if (thread_ != std::this_thread::get_id()) throw std::runtime_error("Input geometry requires its owner thread");
  }
  Value evaluate(Runtime& runtime, const Value* arguments, size_t count) {
    namespace jsi = facebook::jsi;
    ensureThread();
    if (count != 1 || !arguments[0].isObject()) throw jsi::JSError(runtime,"Input geometry requires one ArrayBuffer");
    auto buffer=arguments[0].getObject(runtime).getArrayBuffer(runtime);
    const auto bytes=buffer.size(runtime);
    if (bytes < nelyx::input_geometry::headerWords*sizeof(double) || bytes > nelyx::input_geometry::maxBytes || bytes%sizeof(double))
      throw jsi::JSError(runtime,"Input geometry byte budget/alignment");
    const auto copyBegan=std::chrono::steady_clock::now();
    std::vector<double> owned(bytes/sizeof(double));
    std::memcpy(owned.data(),buffer.data(runtime),bytes);
    const auto copyMs=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-copyBegan).count();
    auto output=session_.evaluate(owned);
    if (owned[14]==1) output[14]+=copyMs;
    // RNW JsiAbiRuntime::createArrayBuffer terminates for native external
    // storage. Use VM-owned storage, as the existing asset byte adapter does,
    // and copy only after every potentially reentrant JS operation.
    auto array=runtime.global().getPropertyAsFunction(runtime,"Float64Array")
      .callAsConstructor(runtime,static_cast<double>(output.size())).getObject(runtime);
    auto result=array.getPropertyAsObject(runtime,"buffer").getArrayBuffer(runtime);
    if (result.size(runtime)!=output.size()*sizeof(double) || !session_.isCurrent(owned[4]))
      throw jsi::JSError(runtime,"Input geometry result allocation changed its buffer/session");
    std::memcpy(result.data(runtime),output.data(),output.size()*sizeof(double));
    return result;
  }
public:
  explicit JsiInputGeometry(nelyx::input_geometry::Owner owner) : session_(owner) {}
  Value get(Runtime& runtime, const facebook::jsi::PropNameID& property) override {
    namespace jsi = facebook::jsi;
    const auto name=property.utf8(runtime);
    if (name!="evaluate" && name!="close") return Value::undefined();
    auto self=shared_from_this();
    return jsi::Function::createFromHostFunction(runtime,property,name=="evaluate" ? 1 : 0,
      [self,name](Runtime& rt,const Value&,const Value* arguments,size_t count)->Value {
        if (name=="evaluate") return self->evaluate(rt,arguments,count);
        self->ensureThread(); self->session_.close(); return Value::undefined();
      });
  }
  std::vector<facebook::jsi::PropNameID> getPropertyNames(Runtime& runtime) override {
    std::vector<facebook::jsi::PropNameID> names;
    names.emplace_back(facebook::jsi::PropNameID::forAscii(runtime,"evaluate"));
    names.emplace_back(facebook::jsi::PropNameID::forAscii(runtime,"close"));
    return names;
  }
};
}
