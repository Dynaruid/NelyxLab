// SPDX-License-Identifier: BSD-3-Clause
#include "Engine.h"
#include "LoadedIdentity.h"
#include <hermes/hermes.h>
#include <chrono>
#include <sstream>

namespace Nelyx::NativeHermes {
namespace jsi = facebook::jsi;
const EngineContract& engineContract() {
  static const EngineContract value{
    "hermes", "native-hermes", "direct-hermes-jsi", "nelyx.native-hermes-package/v1",
    L"NelyxHermesHost.exe", L"hermesvm.dll", L"NelyxHermesHost", L"Nelyx Testbed · direct Hermes",
    {L"icudt79.dll", L"icuin79.dll", L"icuuc79.dll"}, {"bytecode", "static-aot"}, {}, true};
  return value;
}
namespace {
class HermesEngine final : public Engine {
  std::unique_ptr<facebook::hermes::HermesRuntime> runtime_;
  HMODULE unit_ = nullptr;
  bool sampling_ = false, samplingActive_ = false;
public:
  HermesEngine(bool gcStats, bool sampling) : sampling_(sampling) {
    runtime_ = facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withEnableEval(false).withEnableSampleProfiling(sampling).withGCConfig(::hermes::vm::GCConfig::Builder().withShouldRecordStats(gcStats).build()).build());
  }
  ~HermesEngine() override {
    runtime_.reset();
    if (unit_) FreeLibrary(unit_);
  }
  jsi::Runtime& runtime() override { return *runtime_; }
  void installPorts(jsi::Object& api) override {
    auto& rt = *runtime_;
    api.setProperty(rt, "engine", "hermes");
    if (!sampling_) return;
    // Match the sampler's steady-clock epoch, and distinguish runtime CPU from
    // elapsed host/GPU waits. This port exists only in an explicit CPU diagnostic.
    api.setProperty(rt, "cpuProfileClock", jsi::Function::createFromHostFunction(
      rt, jsi::PropNameID::forAscii(rt, "cpuProfileClock"), 0,
      [](auto& rt, auto const&, auto const*, size_t) {
        FILETIME created{}, exited{}, kernel{}, user{};
        if (!GetThreadTimes(GetCurrentThread(), &created, &exited, &kernel, &user))
          throw jsi::JSError(rt, "Runtime thread CPU clock unavailable");
        const auto ticks = [](FILETIME value) {
          return (uint64_t(value.dwHighDateTime) << 32) | value.dwLowDateTime;
        };
        jsi::Array result(rt, 2);
        result.setValueAtIndex(rt, 0, std::chrono::duration<double, std::milli>(
          std::chrono::steady_clock::now().time_since_epoch()).count());
        result.setValueAtIndex(rt, 1, double(ticks(kernel) + ticks(user)) / 10000.);
        return jsi::Value(std::move(result));
      }));
    wchar_t descriptorFlag[2]{};
    if (GetEnvironmentVariableW(L"NELYX_HERMES_DESCRIPTOR_PROFILE", descriptorFlag, 2) == 1 && descriptorFlag[0] == L'1') {
      using DescriptorProfile = void (*)(unsigned, double*);
      const auto profile = reinterpret_cast<DescriptorProfile>(GetProcAddress(
        GetModuleHandleW(L"hermesvm.dll"), "nelyx_descriptor_profile_v1"));
      if (!profile) throw jsi::JSError(rt, "Verified descriptor diagnostic VM is unavailable");
      api.setProperty(rt, "definePropertiesProfile", jsi::Function::createFromHostFunction(
        rt, jsi::PropNameID::forAscii(rt, "definePropertiesProfile"), 1,
        [profile](auto& rt, auto const&, auto* args, size_t count) {
          if (count != 1 || !args[0].isString()) throw jsi::JSError(rt, "Choose descriptor begin, end or calibrate");
          const auto command = args[0].getString(rt).utf8(rt);
          if (command != "begin" && command != "end" && command != "calibrate")
            throw jsi::JSError(rt, "Invalid descriptor diagnostic operation");
          double values[6]{};
          profile(command == "begin" ? 1 : command == "end" ? 0 : 2, values);
          if (values[0] < 0) throw jsi::JSError(rt, "Invalid descriptor diagnostic transition");
          jsi::Array result(rt, 6);
          for (unsigned index = 0; index < 6; ++index) result.setValueAtIndex(rt, index, values[index]);
          return jsi::Value(std::move(result));
        }));
    }
    wchar_t propertyFlag[2]{};
    if (GetEnvironmentVariableW(L"NELYX_HERMES_PROPERTY_PROFILE", propertyFlag, 2) == 1 && propertyFlag[0] == L'1') {
      using PropertyProfile = void (*)(unsigned, double*);
      const auto profile = reinterpret_cast<PropertyProfile>(GetProcAddress(
        GetModuleHandleW(L"hermesvm.dll"), "nelyx_property_profile_v1"));
      if (!profile) throw jsi::JSError(rt, "Verified property diagnostic VM is unavailable");
      api.setProperty(rt, "namedPropertyProfile", jsi::Function::createFromHostFunction(
        rt, jsi::PropNameID::forAscii(rt, "namedPropertyProfile"), 1,
        [profile](auto& rt, auto const&, auto* args, size_t count) {
          if (count != 1 || !args[0].isString()) throw jsi::JSError(rt, "Choose property begin, end or calibrate");
          const auto command = args[0].getString(rt).utf8(rt);
          if (command != "begin" && command != "end" && command != "calibrate")
            throw jsi::JSError(rt, "Invalid property diagnostic operation");
          double values[9]{};
          profile(command == "begin" ? 1 : command == "end" ? 0 : 2, values);
          if (values[0] < 0) throw jsi::JSError(rt, "Invalid property diagnostic transition");
          jsi::Array result(rt, 9);
          for (unsigned index = 0; index < 9; ++index) result.setValueAtIndex(rt, index, values[index]);
          return jsi::Value(std::move(result));
        }));
    }
    auto profile = jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forAscii(rt, "cpuProfile"), 1,
      [this](auto& rt, auto const&, auto* args, size_t count) {
        if (count != 1 || !args[0].isString()) throw jsi::JSError(rt, "Choose begin or end sampling");
        auto operation = args[0].getString(rt).utf8(rt);
        auto root = jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI());
        if (!root) throw jsi::JSError(rt, "Hermes profiling interface unavailable");
        if (operation == "begin" && !samplingActive_) { root->enableSamplingProfiler(1000); samplingActive_ = true; return jsi::Value::undefined(); }
        if (operation != "end" || !samplingActive_) throw jsi::JSError(rt, "Invalid native profiling transition");
        stopProfiling();
        std::ostringstream output;
        root->dumpSampledTraceToStream(output);
        auto text = output.str();
        if (text.size() > 8 * 1024 * 1024) throw jsi::JSError(rt, "Native sampling report exceeds 8 MiB");
        return jsi::Value(jsi::String::createFromUtf8(rt, text));
      });
    api.setProperty(rt, "cpuProfile", std::move(profile));
  }
  void validatePackage(jsi::Object& package) override {
    auto& rt = *runtime_;
    if (package.hasProperty(rt, "engine") && package.getProperty(rt, "engine").getString(rt).utf8(rt) != "hermes")
      throw std::runtime_error("Native Hermes package engine differs");
  }
  void stopProfiling() override {
    if (!samplingActive_) return;
    jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI())->disableSamplingProfiler();
    samplingActive_ = false;
  }
  void evaluate(std::filesystem::path const& bundle, std::string const& mode, jsi::Object& package) override {
    auto* runtime = runtime_.get();
    auto& unit = unit_;
    auto readBytes = [](auto const& file) { return engineReadBytes(file); };
    auto utf8 = engineUtf8;
    auto json = runtime->global().getPropertyAsObject(*runtime, "JSON");
    auto parse = json.getPropertyAsFunction(*runtime, "parse");
    auto stringify = json.getPropertyAsFunction(*runtime, "stringify");
      if(mode=="bytecode"){
        auto bytes=std::make_shared<jsi::StringBuffer>(readBytes(bundle));auto root=static_cast<facebook::hermes::IHermesRootAPI*>(facebook::hermes::makeHermesRootAPI()->castInterface(facebook::hermes::IHermesRootAPI::uuid));std::string reason;
        if(!root||root->getBytecodeVersion()!=99||!root->hermesBytecodeSanityCheck(bytes->data(),bytes->size(),&reason))throw std::runtime_error("Invalid Hermes99 HBC: "+reason);
        runtime->evaluateJavaScript(bytes,utf8(bundle.wstring()));
      }else if(mode=="static-aot"){
        unit=LoadLibraryExW(bundle.c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);if(!unit)throw std::runtime_error("Static Hermes unit load failed");if(!std::filesystem::equivalent(loadedPath(unit),bundle))throw std::runtime_error("Static Hermes unit loaded outside package");
        using Plan=const char*(*)();auto plan=reinterpret_cast<Plan>(GetProcAddress(unit,"nelyx_native_plan_v1"));if(!plan||stringify.call(*runtime,parse.call(*runtime,jsi::String::createFromUtf8(*runtime,plan()))).getString(*runtime).utf8(*runtime)!=stringify.call(*runtime,package.getProperty(*runtime,"nativePlan")).getString(*runtime).utf8(*runtime))throw std::runtime_error("Static Hermes embedded source/coverage plan differs");
        for(auto name:{"sh_export_nelyx_typed","sh_export_nelyx_app"}){auto creator=reinterpret_cast<SHUnitCreator>(GetProcAddress(unit,name));if(!creator)throw std::runtime_error("Static Hermes unit export missing");runtime->evaluateSHUnit(creator);}
      }else throw std::runtime_error("Choose bytecode or static-aot");

  }
};
}
std::unique_ptr<Engine> createEngine(std::filesystem::path const&, bool gcStats, bool sampling) {
  return std::make_unique<HermesEngine>(gcStats, sampling);
}
}
