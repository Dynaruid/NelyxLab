// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include <array>
#include <stdexcept>
#include <thread>

namespace RNSkia {
// No destructor touches JSI. The caller explicitly rolls back on the live
// owner and separately proves that native work is drained before retrying.
class AppleRuntimeInstall final {
public:
  explicit AppleRuntimeInstall(facebook::jsi::Runtime &runtime)
      : _runtime(runtime),_owner(std::this_thread::get_id()) {
    for(const auto *name:names())
      if(!_runtime.global().getProperty(_runtime,name).isUndefined())
        throw std::runtime_error("Apple installation would overwrite existing globals");
  }
  void beginMutation() {requireOwner();_mutated=true;}
  bool rollback() {
    requireOwner();if(!_mutated)return true;
    bool confirmed=true;
    for(const auto *name:names()) {
      try{_runtime.global().setProperty(_runtime,name,facebook::jsi::Value::undefined());}
      catch(...){confirmed=false;}
    }
    for(const auto *name:names()) {
      try{if(!_runtime.global().getProperty(_runtime,name).isUndefined())confirmed=false;}
      catch(...){confirmed=false;}
    }
    return confirmed;
  }
private:
  static const std::array<const char *,3> &names() {
    static const std::array<const char *,3> value{"SkiaApi","SkiaViewApi","NelyxAppleHost"};return value;
  }
  void requireOwner() const {
    if(_owner!=std::this_thread::get_id())throw std::runtime_error("Apple installation requires its JS owner");
  }
  facebook::jsi::Runtime &_runtime;
  const std::thread::id _owner;
  bool _mutated=false;
};
} // namespace RNSkia
