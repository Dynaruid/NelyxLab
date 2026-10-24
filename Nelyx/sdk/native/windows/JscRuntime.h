// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "JSI/RuntimeHolder.h"
#include <jsitooling/react/runtime/JSRuntimeFactory.h>
#include <JscEngine.h>

namespace Nelyx::WindowsJsc {
class RuntimeHolder final : public Microsoft::JSI::RuntimeHolderLazyInit {
 public:
  RuntimeHolder():runtime_(createRuntime()){}
  std::shared_ptr<facebook::jsi::Runtime> getRuntime() noexcept override{return runtime_;}
  // RNW 0.83.2 exposes only Hermes/V8 enum values. This supplier replaces the
  // default slot; the VM's independently checked identity is always JSC.
  facebook::react::JSIEngineOverride getRuntimeType() noexcept override{return facebook::react::JSIEngineOverride::Default;}
 private:
  std::shared_ptr<facebook::jsi::Runtime> runtime_;
};
class Runtime final : public facebook::react::JSRuntime {
 public:
  explicit Runtime(std::shared_ptr<Microsoft::JSI::RuntimeHolderLazyInit> holder):holder_(std::move(holder)){}
  facebook::jsi::Runtime& getRuntime() noexcept override{return *holder_->getRuntime();}
 private:
  std::shared_ptr<Microsoft::JSI::RuntimeHolderLazyInit> holder_;
};
}
