// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include <optional>
#include <string>
#include <thread>
#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <utility>
#include <functional>

namespace RNSkia {
// The exact RN host patch installs this immutable marker before TurboModule
// bindings or bundle evaluation. It belongs to the RN instance, not Skia.
class AppleRuntimeHost final {
public:
  struct Identity {std::string platform,nativeReactNativeVersion;uint64_t generation;};
  AppleRuntimeHost(facebook::jsi::Runtime &runtime,std::string platform,std::string version,std::function<bool(uint64_t)> nativeGuard)
      :_runtime(runtime),_owner(std::this_thread::get_id()),_identity{std::move(platform),std::move(version),0},_nativeGuard(std::move(nativeGuard)) {
    namespace jsi=facebook::jsi;
    auto value=runtime.global().getProperty(runtime,"NelyxAppleRuntimeHost");
    if(!value.isObject())throw std::runtime_error("Apple native host protocol3 missing; reinstall/prepare and rebuild the native runner");
    auto marker=value.asObject(runtime);auto number=[&](const char *name){auto entry=marker.getProperty(runtime,name);return entry.isNumber()?entry.asNumber():-1;};
    auto text=[&](const char *name){auto entry=marker.getProperty(runtime,name);return entry.isString()?entry.asString(runtime).utf8(runtime):"";};
    const auto generation=number("generation");
    if(number("abi")!=1 || number("shutdownProtocol")!=3 || text("platform")!=_identity.platform || text("nativeReactNativeVersion")!=_identity.nativeReactNativeVersion ||
       generation<1 || generation>9007199254740991.0 || std::floor(generation)!=generation)
      throw std::runtime_error("Apple native host hook cohort/protocol mismatch");
    auto object=runtime.global().getPropertyAsObject(runtime,"Object");
    if(!object.getPropertyAsFunction(runtime,"isFrozen").call(runtime,marker).asBool())throw std::runtime_error("Apple native host marker must be immutable");
    auto descriptor=object.getPropertyAsFunction(runtime,"getOwnPropertyDescriptor").call(runtime,runtime.global(),jsi::String::createFromAscii(runtime,"NelyxAppleRuntimeHost"));
    if(!descriptor.isObject())throw std::runtime_error("Apple native host marker descriptor missing");
    auto fields=descriptor.asObject(runtime);
    if(!fields.getProperty(runtime,"writable").isBool() || fields.getProperty(runtime,"writable").asBool() ||
       !fields.getProperty(runtime,"configurable").isBool() || fields.getProperty(runtime,"configurable").asBool())throw std::runtime_error("Apple native host marker binding must be immutable");
    _identity.generation=static_cast<uint64_t>(generation);_marker.emplace(std::move(marker));verify();
  }
  const Identity &identity() const {return _identity;}
  void verify(bool requireAdmission=true) const {
    requireOwner();auto current=_runtime.global().getProperty(_runtime,"NelyxAppleRuntimeHost");
    if(!_marker || !current.isObject() || !facebook::jsi::Object::strictEquals(_runtime,*_marker,current.asObject(_runtime)))
      throw std::runtime_error("Apple native host marker owner changed");
    if(!_nativeGuard || !_nativeGuard(_identity.generation))throw std::runtime_error("Native RN teardown guard missing or foreign");
    if(teardownRequested() && requireAdmission)throw std::runtime_error("Apple native host teardown admission closed");
  }
  bool teardownRequested() const {
    requireOwner();if(!_marker)return _teardownRequested;
    auto value=_marker->getProperty(_runtime,"isTeardownRequested");
    if(!value.isObject() || !value.asObject(_runtime).isFunction(_runtime))throw std::runtime_error("Apple native teardown probe unavailable");
    auto probe=value.asObject(_runtime).asFunction(_runtime);
    if(!probe.isHostFunction(_runtime))throw std::runtime_error("Apple teardown probe must be native");
    auto requested=probe.call(_runtime);if(!requested.isBool())throw std::runtime_error("Invalid native teardown probe");
    _teardownRequested=requested.asBool();return _teardownRequested;
  }
  void releaseOwner() {if(!_marker)return;requireOwner();_marker.reset();}
private:
  void requireOwner() const {if(std::this_thread::get_id()!=_owner)throw std::runtime_error("Apple native host marker requires its JS owner");}
  facebook::jsi::Runtime &_runtime;
  const std::thread::id _owner;
  Identity _identity;
  const std::function<bool(uint64_t)> _nativeGuard;
  mutable bool _teardownRequested=false;
  std::optional<facebook::jsi::Object> _marker;
};
} // namespace RNSkia
