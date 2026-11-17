// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <JscEngine.h>

namespace Nelyx::NativeJsc {
void trackRejections(facebook::jsi::Runtime&, const facebook::jsi::Function&);
void disableEval(facebook::jsi::Runtime&);

inline std::shared_ptr<facebook::jsi::Runtime> createRuntime() {
  auto runtime = Nelyx::WindowsJsc::createRuntime();
  disableEval(*runtime);
  auto subscribe = facebook::jsi::Function::createFromHostFunction(
    *runtime, facebook::jsi::PropNameID::forAscii(*runtime, "nelyxTrackRejections"), 1,
    [](auto& rt, auto const&, auto const* args, size_t count) {
      if (count != 1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt))
        throw facebook::jsi::JSError(rt, "Rejection tracking requires one callback");
      trackRejections(rt, args[0].getObject(rt).getFunction(rt));
      return facebook::jsi::Value::undefined();
    });
  runtime->global().setProperty(*runtime, "__nelyxTrackRejections", std::move(subscribe));
  return runtime;
}
}
