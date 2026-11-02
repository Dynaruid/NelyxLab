// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "nelyx_skia/scene_composition.h"
#include <cstring>
#include <jsi/jsi.h>
#include <memory>
#include <thread>
namespace RNSkia {
class JsiSceneComposition final
    : public facebook::jsi::HostObject,
      public std::enable_shared_from_this<JsiSceneComposition> {
  using Runtime = facebook::jsi::Runtime;
  using Value = facebook::jsi::Value;
  nelyx::scene_composition::Session session_;
  const std::thread::id thread_ = std::this_thread::get_id();
  bool executing_ = false;

public:
  JsiSceneComposition(double owner, double generation)
      : session_(owner, generation) {}
  Value get(Runtime &runtime,
            const facebook::jsi::PropNameID &property) override {
    namespace jsi = facebook::jsi;
    auto name = property.utf8(runtime);
    if (name != "prepare" && name != "commit" && name != "discard" &&
        name != "close" && name != "stats")
      return Value::undefined();
    auto self = shared_from_this();
    return jsi::Function::createFromHostFunction(
        runtime, property, 1,
        [self, name](Runtime &rt, const Value &, const Value *arguments,
                     size_t count) -> Value {
          if (self->thread_ != std::this_thread::get_id())
            throw jsi::JSError(rt,
                               "Scene composition requires its owner thread");
          if (name == "close") {
            self->session_.close();
            return Value::undefined();
          }
          // A JS result constructor/getter can reenter this HostObject while
          // its native input/output still exist. Keep that aggregate bounded;
          // close remains available to invalidate the original operation.
          if (self->executing_)
            throw jsi::JSError(rt, "Reentrant Scene numeric operation");
          self->executing_ = true;
          struct Operation {
            bool &active;
            ~Operation() { active = false; }
          } operation{self->executing_};
          if (name == "commit" || name == "discard") {
            if (count != 1 || !arguments[0].isNumber())
              throw jsi::JSError(rt, "Scene composition requires a revision");
            if (name == "commit")
              self->session_.commit(arguments[0].getNumber());
            else
              self->session_.discard(arguments[0].getNumber());
            return Value::undefined();
          }
          std::vector<double> output;
          double revision = 0;
          if (name == "stats")
            output = self->session_.stats();
          else {
            if (count != 1)
              throw jsi::JSError(
                  rt, "Scene composition requires one numeric packet");
            auto buffer = arguments[0].getObject(rt).getArrayBuffer(rt);
            const auto bytes = buffer.size(rt);
            constexpr auto available = nelyx::scene_composition::maxBytes - 4096;
            if (bytes < 16 * 8 || bytes > available || bytes % 8 ||
                self->session_.retainedBytes() > available - bytes)
              throw jsi::JSError(rt, "Scene composition byte budget/alignment");
            std::vector<double> owned(bytes / 8);
            std::memcpy(owned.data(), buffer.data(rt), bytes);
            revision = owned[4];
            output = self->session_.prepare(owned);
          }
          try {
            auto array = rt.global()
                             .getPropertyAsFunction(rt, "Float64Array")
                             .callAsConstructor(rt, double(output.size()))
                             .getObject(rt);
            auto buffer =
                array.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
            if (buffer.size(rt) != output.size() * 8 ||
                (name == "prepare" && !self->session_.current(revision)))
              throw jsi::JSError(rt, "Scene composition allocation changed its "
                                     "owner/revision/buffer");
            std::memcpy(buffer.data(rt), output.data(), output.size() * 8);
            return buffer;
          } catch (...) {
            if (name == "prepare" && self->session_.current(revision))
              self->session_.discard(revision);
            throw;
          }
        });
  }
};
} // namespace RNSkia
