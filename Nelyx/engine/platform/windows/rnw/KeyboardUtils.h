// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Modified for Nelyx: standalone App SDK declarations; no React/CoreWindow owner.
#pragma once
#include <winrt/Windows.System.h>
#include <string>

namespace nelyx::v2::windows::rnw {
bool IsModifiedKeyPressed(winrt::Windows::System::VirtualKey virtualKey);
bool IsKeyLocked(winrt::Windows::System::VirtualKey virtualKey);
struct KeyIdentity { std::string key,code; uint32_t location=0; };
// WM_KEY message scan/extended identity remains stable on key-up, when the
// released modifier is no longer in InputKeyboardSource's Down state.
KeyIdentity IdentityFromMessage(uint32_t virtualKey,uint32_t scanCode,bool extended,bool shift,bool caps);
std::string FromVirtualKey(winrt::Windows::System::VirtualKey virtualKey,bool shift,bool caps);
std::string CodeFromVirtualKey(winrt::Windows::System::VirtualKey virtualKey);
const std::string GetOrUnidentifiedCode(winrt::Windows::System::VirtualKey virtualKey);
const std::string GetOrUnidentifiedKey(winrt::Windows::System::VirtualKey virtualKey);
inline bool keyDown(uint32_t key) { return IsModifiedKeyPressed(static_cast<winrt::Windows::System::VirtualKey>(key)); }
inline uint32_t modifierMask() {
  return (keyDown(0x10)?1u:0u)|(keyDown(0x11)?2u:0u)|(keyDown(0x12)?4u:0u)|
    ((keyDown(0x5b)||keyDown(0x5c))?8u:0u);
}
}
