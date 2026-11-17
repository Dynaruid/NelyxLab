// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <jsi/jsi.h>
#include <filesystem>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace Nelyx::NativeHermes {
// The executable links exactly one factory. The renderer and host depend only
// on JSI; loading a second VM into that process is an admission failure.
struct EngineContract {
  std::string engine, host, runtime, schema;
  std::wstring executable, vm, windowClass, windowTitle;
  std::vector<std::wstring> icu;
  std::vector<std::string> modes, extraInventory;
  bool profiling;
  bool accepts(std::string const& mode) const;
};
const EngineContract& engineContract();

class Engine {
public:
  virtual ~Engine() = default;
  virtual facebook::jsi::Runtime& runtime() = 0;
  virtual void installPorts(facebook::jsi::Object&) = 0;
  virtual void validatePackage(facebook::jsi::Object&) = 0;
  virtual void evaluate(std::filesystem::path const&, std::string const&, facebook::jsi::Object&) = 0;
  virtual void stopProfiling() = 0;
};
std::unique_ptr<Engine> createEngine(std::filesystem::path const& directory, bool gcStats, bool sampling);
std::string engineReadBytes(std::filesystem::path const&, size_t limit = 64 * 1024 * 1024);
std::string engineUtf8(std::wstring_view);
}
