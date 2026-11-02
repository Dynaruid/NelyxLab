// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "nelyx_skia/semantics_geometry.h"
#include <cstring>
#include <jsi/jsi.h>
#include <memory>
#include <thread>
namespace RNSkia {
class JsiSemanticsGeometry final
    : public facebook::jsi::HostObject,
      public std::enable_shared_from_this<JsiSemanticsGeometry> {
  using Runtime = facebook::jsi::Runtime;
  using Value = facebook::jsi::Value;
  nelyx::semantics_geometry::Session session_;
  const std::thread::id thread_ = std::this_thread::get_id();
  bool executing_ = false;

public:
  JsiSemanticsGeometry(double owner, double generation)
      : session_(owner, generation) {}
  Value get(Runtime &runtime,
            const facebook::jsi::PropNameID &property) override {
    namespace jsi = facebook::jsi;
    auto name = property.utf8(runtime);
    if (name != "evaluate" && name != "close" && name != "stats")
      return Value::undefined();
    auto self = shared_from_this();
    return jsi::Function::createFromHostFunction(
        runtime, property, 1,
        [self, name](Runtime &rt, const Value &, const Value *arguments,
                     size_t count) -> Value {
          if (self->thread_ != std::this_thread::get_id())
            throw jsi::JSError(rt,
                               "Semantics geometry requires its owner thread");
          if (name == "close") {
            self->session_.close();
            return Value::undefined();
          }
          if (self->executing_)
            throw jsi::JSError(rt, "Reentrant Semantics numeric operation");
          self->executing_ = true;
          struct Operation {
            bool &active;
            ~Operation() { active = false; }
          } operation{self->executing_};
          std::vector<double> output;
          double revision = 0;
          if (name == "stats")
            output = self->session_.stats();
          else {
            if (count != 1)
              throw jsi::JSError(
                  rt, "Semantics geometry requires one numeric packet");
            auto buffer = arguments[0].getObject(rt).getArrayBuffer(rt);
            const auto bytes = buffer.size(rt);
            if (bytes < 16 * 8 || bytes > nelyx::semantics_geometry::maxBytes - 4096 ||
                bytes % 8)
              throw jsi::JSError(rt,
                                 "Semantics geometry byte budget/alignment");
            std::vector<double> owned(bytes / 8);
            std::memcpy(owned.data(), buffer.data(rt), bytes);
            revision = owned[4];
            output = self->session_.evaluate(owned);
          }
          auto array = rt.global()
                           .getPropertyAsFunction(rt, "Float64Array")
                           .callAsConstructor(rt, double(output.size()))
                           .getObject(rt);
          auto buffer =
              array.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
          if (buffer.size(rt) != output.size() * 8 ||
              (name == "evaluate" && !self->session_.isCurrent(revision)))
            throw jsi::JSError(rt, "Semantics geometry allocation changed its "
                                   "owner/revision/buffer");
          std::memcpy(buffer.data(rt), output.data(), output.size() * 8);
          return buffer;
        });
  }
};
} // namespace RNSkia
