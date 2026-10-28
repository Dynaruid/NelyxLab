// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "windows/WindowsMonotonic.h"
#include <string>

namespace RNSkia {
inline bool windowsFrameDiagnosticsEnabled() noexcept {
  static const bool enabled=[]{wchar_t value[2]{};return GetEnvironmentVariableW(L"NELYX_WINDOWS_FRAME_DIAGNOSTICS",value,2)==1&&value[0]==L'1';}();return enabled;
}
// Opt-in current-process timing, without persistent logs or retained scenes.
inline void windowsFrameDiagnostic(std::string const& message) noexcept {
  if(!windowsFrameDiagnosticsEnabled())return;
  try{const auto line="NELYX_WINDOWS_FRAME "+std::to_string(windowsMonotonicMilliseconds())+" "+message+"\n";DWORD written{};WriteFile(GetStdHandle(STD_ERROR_HANDLE),line.data(),static_cast<DWORD>(line.size()),&written,nullptr);}catch(...){}
}
inline void windowsFrameDiagnosticDelay(char const* stage,double began,double ended) noexcept {
  if(began<=0||ended-began<100)return;
  try{windowsFrameDiagnostic(std::string(stage)+" ms="+std::to_string(ended-began));}catch(...){}
}
}
