// SPDX-License-Identifier: BSD-3-Clause
#include "Engine.h"
#include <algorithm>
#include <fstream>

namespace Nelyx::NativeHermes {
bool EngineContract::accepts(std::string const& mode) const {
  return std::find(modes.begin(), modes.end(), mode) != modes.end();
}
std::string engineReadBytes(std::filesystem::path const& file, size_t limit) {
  const auto size = std::filesystem::file_size(file);
  if (size > limit) throw std::runtime_error("Native engine input exceeds byte budget");
  std::ifstream stream(file, std::ios::binary);
  std::string bytes(static_cast<size_t>(size), '\0');
  if (!stream.read(bytes.data(), bytes.size())) throw std::runtime_error("Native engine input read failed");
  return bytes;
}
std::string engineUtf8(std::wstring_view value) {
  if (value.empty()) return {};
  const auto size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), int(value.size()), nullptr, 0, nullptr, nullptr);
  if (!size) throw std::runtime_error("Invalid UTF-16 engine path");
  std::string result(size, '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), int(value.size()), result.data(), size, nullptr, nullptr);
  return result;
}
}
