// SPDX-License-Identifier: BSD-3-Clause
#include "Engine.h"
#include <NativeJscRuntime.h>

namespace Nelyx::NativeHermes {
const EngineContract& engineContract() {
  static const EngineContract value{
    "jsc", "native-jsc", "direct-jsc-jsi", "nelyx.native-jsc-package/v1",
    L"NelyxJscHost.exe", L"JavaScriptCore.dll", L"NelyxJscHost", L"Nelyx Testbed · direct JSC",
    {L"icudt79.dll", L"icuin79.dll", L"icuuc79.dll", L"icudt77.dll", L"icuin77.dll", L"icuuc77.dll"},
    {"source"}, {"jsc-mode.txt"}, false};
  return value;
}
namespace {
struct Modules {
  std::vector<HMODULE> handles;
  ~Modules() { for (auto image : handles) FreeLibrary(image); }
  void load(std::filesystem::path const& directory) {
    for (auto const& name : engineContract().icu) {
      auto image = LoadLibraryExW((directory / name).c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
      if (!image) throw std::runtime_error("Native JSC dependency load failed");
      handles.push_back(image);
    }
  }
};
class JscEngine final : public Engine {
  // VM and its callback values retire before the explicit dependency leases.
  Modules dependencies_;
  std::shared_ptr<facebook::jsi::Runtime> runtime_;
public:
  explicit JscEngine(std::filesystem::path const& directory) {
    dependencies_.load(directory);
    runtime_ = Nelyx::NativeJsc::createRuntime();
  }
  facebook::jsi::Runtime& runtime() override { return *runtime_; }
  void installPorts(facebook::jsi::Object& api) override {
    namespace jsi = facebook::jsi;
    auto& rt = *runtime_;
    api.setProperty(rt, "engine", "jsc");
    api.setProperty(rt, "executionMode", rt.global().getPropertyAsObject(rt, "__nelyxJscRuntimeIdentity").getProperty(rt, "mode"));
    auto subscribe = jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forAscii(rt, "trackRejections"), 1,
      [](auto& rt, auto const&, auto* args, size_t count) {
        if (count != 1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt)) throw jsi::JSError(rt, "Rejection tracker callback required");
        auto callback = std::make_shared<jsi::Function>(args[0].getObject(rt).getFunction(rt));
        auto handler = jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forAscii(rt, "nativeRejection"), 2,
          [callback](auto& inner, auto const&, auto* values, size_t n) {
            if (n != 2) throw jsi::JSError(inner, "JSC rejection arguments differ");
            callback->call(inner, values[1]);
            return jsi::Value::undefined();
          });
        Nelyx::NativeJsc::trackRejections(rt, handler);
        return jsi::Value::undefined();
      });
    api.setProperty(rt, "trackRejections", std::move(subscribe));
  }
  void validatePackage(facebook::jsi::Object& package) override {
    auto& rt = *runtime_;
    const auto actual = rt.global().getPropertyAsObject(rt, "__nelyxJscRuntimeIdentity").getProperty(rt, "mode").getString(rt).utf8(rt);
    if (package.getProperty(rt, "engine").getString(rt).utf8(rt) != "jsc" || package.getProperty(rt, "executionMode").getString(rt).utf8(rt) != actual)
      throw std::runtime_error("Native JSC package execution mode differs from the VM");
  }
  void evaluate(std::filesystem::path const& bundle, std::string const& mode, facebook::jsi::Object&) override {
    if (mode != "source") throw std::runtime_error("Native JSC requires source execution");
    runtime_->evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(engineReadBytes(bundle)), engineUtf8(bundle.wstring()));
  }
  void stopProfiling() override {}
};
}
std::unique_ptr<Engine> createEngine(std::filesystem::path const& directory, bool gcStats, bool sampling) {
  if (gcStats || sampling) throw std::runtime_error("Hermes profiling is unavailable in JSC");
  return std::make_unique<JscEngine>(directory);
}
}
