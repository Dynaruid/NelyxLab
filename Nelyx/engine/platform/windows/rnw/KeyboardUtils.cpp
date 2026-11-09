// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Modified for Nelyx: remove unused CoreWindow ownership; App SDK owns the UI thread.
// Original npm/Git identities and dependency closure are in provenance.json.
#include "KeyboardUtils.h"

#include <winrt/Windows.UI.Core.h>
#include <cctype>
#include <type_traits>
#include <vector>

#include <winrt/Microsoft.UI.Input.h>

namespace nelyx::v2::windows::rnw {

// Should align to
// https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
static const std::vector<std::pair<winrt::Windows::System::VirtualKey, std::string>> g_virtualKeyToKey{
    // Modifier keys
    {winrt::Windows::System::VirtualKey::LeftMenu, "Alt"},
    {winrt::Windows::System::VirtualKey::RightMenu, "Alt"},
    {winrt::Windows::System::VirtualKey::Menu, "Alt"},
    {winrt::Windows::System::VirtualKey::CapitalLock, "CapsLock"},
    {winrt::Windows::System::VirtualKey::LeftControl, "Control"},
    {winrt::Windows::System::VirtualKey::RightControl, "Control"},
    {winrt::Windows::System::VirtualKey::Control, "Control"},
    {winrt::Windows::System::VirtualKey::LeftWindows, "Meta"},
    {winrt::Windows::System::VirtualKey::RightWindows, "Meta"},
    {winrt::Windows::System::VirtualKey::NumberKeyLock, "NumLock"},
    {winrt::Windows::System::VirtualKey::Scroll, "ScrollLock"},
    {winrt::Windows::System::VirtualKey::LeftShift, "Shift"},
    {winrt::Windows::System::VirtualKey::RightShift, "Shift"},
    {winrt::Windows::System::VirtualKey::Shift, "Shift"},

    // Whitespace keys
    {winrt::Windows::System::VirtualKey::Enter, "Enter"},
    {winrt::Windows::System::VirtualKey::Tab, "Tab"},
    {winrt::Windows::System::VirtualKey::Space, " "},

    // Navigation keys
    {winrt::Windows::System::VirtualKey::Down, "ArrowDown"},
    {winrt::Windows::System::VirtualKey::Left, "ArrowLeft"},
    {winrt::Windows::System::VirtualKey::Right, "ArrowRight"},
    {winrt::Windows::System::VirtualKey::Up, "ArrowUp"},
    {winrt::Windows::System::VirtualKey::End, "End"},
    {winrt::Windows::System::VirtualKey::Home, "Home"},
    {winrt::Windows::System::VirtualKey::PageDown, "PageDown"},
    {winrt::Windows::System::VirtualKey::PageUp, "PageUp"},

    // Editing keys
    {winrt::Windows::System::VirtualKey::Back, "Backspace"},
    {winrt::Windows::System::VirtualKey::Clear, "Clear"},
    {winrt::Windows::System::VirtualKey::Delete, "Delete"},
    {winrt::Windows::System::VirtualKey::Insert, "Insert"},

    // UI keys
    {winrt::Windows::System::VirtualKey::Accept, "Accept"},
    {winrt::Windows::System::VirtualKey::Application, "ContextMenu"},
    {winrt::Windows::System::VirtualKey::Escape, "Escape"},
    {winrt::Windows::System::VirtualKey::Execute, "Execute"},
    {winrt::Windows::System::VirtualKey::Help, "Help"},
    {winrt::Windows::System::VirtualKey::Pause, "Pause"},
    {winrt::Windows::System::VirtualKey::Select, "Select"},

    // Device keys
    {winrt::Windows::System::VirtualKey::Snapshot, "PrintScreen"},
    {winrt::Windows::System::VirtualKey::Sleep, "Standby"},

    // Common IME keys
    {winrt::Windows::System::VirtualKey::Convert, "Convert"},
    {winrt::Windows::System::VirtualKey::Final, "FinalMode"},
    {winrt::Windows::System::VirtualKey::ModeChange, "ModeChange"},
    {winrt::Windows::System::VirtualKey::NonConvert, "NonConvert"},

    // Korean keyboards only
    {winrt::Windows::System::VirtualKey::Hangul, "HangulMode"},
    {winrt::Windows::System::VirtualKey::Hanja, "HanjaMode"},
    {winrt::Windows::System::VirtualKey::Junja, "JunjaMode"},

    // Japanese keyboards only
    {winrt::Windows::System::VirtualKey::Kana, "KanaMode"},
    {winrt::Windows::System::VirtualKey::Kanji, "KanjiMode"},

    // Function keys
    {winrt::Windows::System::VirtualKey::F1, "F1"},
    {winrt::Windows::System::VirtualKey::F2, "F2"},
    {winrt::Windows::System::VirtualKey::F3, "F3"},
    {winrt::Windows::System::VirtualKey::F4, "F4"},
    {winrt::Windows::System::VirtualKey::F5, "F5"},
    {winrt::Windows::System::VirtualKey::F6, "F6"},
    {winrt::Windows::System::VirtualKey::F7, "F7"},
    {winrt::Windows::System::VirtualKey::F8, "F8"},
    {winrt::Windows::System::VirtualKey::F9, "F9"},
    {winrt::Windows::System::VirtualKey::F10, "F10"},
    {winrt::Windows::System::VirtualKey::F11, "F11"},
    {winrt::Windows::System::VirtualKey::F12, "F12"},
    {winrt::Windows::System::VirtualKey::F13, "F13"},
    {winrt::Windows::System::VirtualKey::F14, "F14"},
    {winrt::Windows::System::VirtualKey::F15, "F15"},
    {winrt::Windows::System::VirtualKey::F16, "F16"},
    {winrt::Windows::System::VirtualKey::F17, "F17"},
    {winrt::Windows::System::VirtualKey::F18, "F18"},
    {winrt::Windows::System::VirtualKey::F19, "F19"},
    {winrt::Windows::System::VirtualKey::F20, "F20"},

    // Numeric keypad keys
    {winrt::Windows::System::VirtualKey::Decimal, "Decimal"},
    {winrt::Windows::System::VirtualKey::Multiply, "Multiply"},
    {winrt::Windows::System::VirtualKey::Add, "Add"},
    {winrt::Windows::System::VirtualKey::Divide, "Divide"},
    {winrt::Windows::System::VirtualKey::Subtract, "Subtract"},
    {winrt::Windows::System::VirtualKey::Separator, "Separator"},

    {winrt::Windows::System::VirtualKey::NumberPad0, "0"},
    {winrt::Windows::System::VirtualKey::NumberPad1, "1"},
    {winrt::Windows::System::VirtualKey::NumberPad2, "2"},
    {winrt::Windows::System::VirtualKey::NumberPad3, "3"},
    {winrt::Windows::System::VirtualKey::NumberPad4, "4"},
    {winrt::Windows::System::VirtualKey::NumberPad5, "5"},
    {winrt::Windows::System::VirtualKey::NumberPad6, "6"},
    {winrt::Windows::System::VirtualKey::NumberPad7, "7"},
    {winrt::Windows::System::VirtualKey::NumberPad8, "8"},
    {winrt::Windows::System::VirtualKey::NumberPad9, "9"},
    //
};

// Convert enum to its underlying type
template <typename E>
constexpr auto to_underlying(E e) noexcept {
  return static_cast<std::underlying_type_t<E>>(e);
}

// Align to https://www.w3.org/TR/uievents-code/
// VirtualKey mapping is from
// https://docs.microsoft.com/en-us/uwp/api/Windows.System.VirtualKey Other
// codes are from
// https://docs.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes All
// codes are listed except alpha and numbers. For the unsupported code, they are
// all commented and they key is 'to_underlying(winrt::Windows::System::None)' For
// example, IntlBackslash is not sent to user:
// //{to_underlying(winrt::Windows::System::None), "IntlBackslash"},
static const std::vector<std::pair<int, std::string>> g_virtualKeyToCode{
    // writing system keys in the Alphanumeric section
    {192, "Backquote"},
    {220, "Backslash"},
    {to_underlying(winrt::Windows::System::VirtualKey::Back), "Backspace"},
    {219, "BracketLeft"},
    {221, "BracketRight"},
    {188, "Comma"},
    {187, "Equal"},
    //{to_underlying(winrt::Windows::System::None), "IntlBackslash"},
    //{to_underlying(winrt::Windows::System::None), "IntlRo"},
    //{to_underlying(winrt::Windows::System::None), "IntlYen"},
    {189, "Minus"},
    {190, "Period"},
    {222, "Quote"},
    {186, "Semicolon"},
    {191, "Slash"},

    // Functional Keys
    {to_underlying(winrt::Windows::System::VirtualKey::LeftMenu), "AltLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::RightMenu), "AltRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::CapitalLock), "CapsLock"},
    {to_underlying(winrt::Windows::System::VirtualKey::Menu), "ContextMenu"},
    {to_underlying(winrt::Windows::System::VirtualKey::LeftControl), "ControlLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::RightControl), "ControlRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::Enter), "Enter"},
    {to_underlying(winrt::Windows::System::VirtualKey::LeftWindows), "MetaLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::RightWindows), "MetaRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::LeftShift), "ShiftLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::RightShift), "ShiftRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::Space), "Space"},
    {to_underlying(winrt::Windows::System::VirtualKey::Tab), "Tab"},

    // List of code values for functional keys found on Japanese and Korean
    // keyboards.
    {to_underlying(winrt::Windows::System::VirtualKey::Convert), "Convert"},
    {to_underlying(winrt::Windows::System::VirtualKey::Kana), "KanaMode"},
    {to_underlying(winrt::Windows::System::VirtualKey::Hangul), "Lang1"},
    {to_underlying(winrt::Windows::System::VirtualKey::Hanja), "Lang2"},
    //{to_underlying(winrt::Windows::System::None), "Lang3"},
    //{to_underlying(winrt::Windows::System::None), "Lang4"},
    //{to_underlying(winrt::Windows::System::None), "Lang5"},
    {to_underlying(winrt::Windows::System::VirtualKey::NonConvert), "NonConvert"},

    // Control Pad Section
    {to_underlying(winrt::Windows::System::VirtualKey::Delete), "Delete"},
    {to_underlying(winrt::Windows::System::VirtualKey::End), "End"},
    {to_underlying(winrt::Windows::System::VirtualKey::Help), "Help"},
    {to_underlying(winrt::Windows::System::VirtualKey::Home), "Home"},
    {to_underlying(winrt::Windows::System::VirtualKey::Insert), "Insert"},
    {to_underlying(winrt::Windows::System::VirtualKey::PageDown), "PageDown"},
    {to_underlying(winrt::Windows::System::VirtualKey::PageUp), "PageUp"},

    // Arrow Pad Section
    {to_underlying(winrt::Windows::System::VirtualKey::Down), "ArrowDown"},
    {to_underlying(winrt::Windows::System::VirtualKey::Left), "ArrowLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::Right), "ArrowRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::Up), "ArrowUp"},

    // Numpad Section
    {to_underlying(winrt::Windows::System::VirtualKey::NumberKeyLock), "NumLock"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad0), "Numpad0"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad1), "Numpad1"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad2), "Numpad2"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad3), "Numpad3"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad4), "Numpad4"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad5), "Numpad5"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad6), "Numpad6"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad7), "Numpad7"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad8), "Numpad8"},
    {to_underlying(winrt::Windows::System::VirtualKey::NumberPad9), "Numpad9"},
    {to_underlying(winrt::Windows::System::VirtualKey::Add), "NumpadAdd"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadBackspace"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadClear"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadClearEntry"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadComma"},
    {to_underlying(winrt::Windows::System::VirtualKey::Decimal), "NumpadDecimal"},
    {to_underlying(winrt::Windows::System::VirtualKey::Divide), "NumpadDivide"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadEnter"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadEqual"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadHash"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadMemoryAdd"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadMemoryClear"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadMemoryRecall"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadMemoryStore"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadMemorySubtract"},
    {to_underlying(winrt::Windows::System::VirtualKey::Multiply), "NumpadMultiply"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadParenLeft"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadParenRight"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "NumpadStar"},
    {to_underlying(winrt::Windows::System::VirtualKey::Subtract), "NumpadSubtract"},

    // Function Section
    {to_underlying(winrt::Windows::System::VirtualKey::Escape), "Escape"},
    {to_underlying(winrt::Windows::System::VirtualKey::F1), "F1"},
    {to_underlying(winrt::Windows::System::VirtualKey::F2), "F2"},
    {to_underlying(winrt::Windows::System::VirtualKey::F3), "F3"},
    {to_underlying(winrt::Windows::System::VirtualKey::F4), "F4"},
    {to_underlying(winrt::Windows::System::VirtualKey::F5), "F5"},
    {to_underlying(winrt::Windows::System::VirtualKey::F6), "F6"},
    {to_underlying(winrt::Windows::System::VirtualKey::F7), "F7"},
    {to_underlying(winrt::Windows::System::VirtualKey::F8), "F8"},
    {to_underlying(winrt::Windows::System::VirtualKey::F9), "F9"},
    {to_underlying(winrt::Windows::System::VirtualKey::F10), "F10"},
    {to_underlying(winrt::Windows::System::VirtualKey::F11), "F11"},
    {to_underlying(winrt::Windows::System::VirtualKey::F12), "F12"},
    {to_underlying(winrt::Windows::System::VirtualKey::F13), "F13"},
    {to_underlying(winrt::Windows::System::VirtualKey::F14), "F14"},
    {to_underlying(winrt::Windows::System::VirtualKey::F15), "F15"},
    {to_underlying(winrt::Windows::System::VirtualKey::F16), "F16"},
    {to_underlying(winrt::Windows::System::VirtualKey::F17), "F17"},
    {to_underlying(winrt::Windows::System::VirtualKey::F18), "F18"},
    {to_underlying(winrt::Windows::System::VirtualKey::F19), "F19"},
    {to_underlying(winrt::Windows::System::VirtualKey::F20), "F20"},
    {to_underlying(winrt::Windows::System::VirtualKey::F21), "F21"},
    {to_underlying(winrt::Windows::System::VirtualKey::F22), "F22"},
    {to_underlying(winrt::Windows::System::VirtualKey::F23), "F23"},
    {to_underlying(winrt::Windows::System::VirtualKey::F24), "F24"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Fn"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "FnLock"},
    {to_underlying(winrt::Windows::System::VirtualKey::Print), "PrintScreen"},
    {to_underlying(winrt::Windows::System::VirtualKey::Scroll), "ScrollLock"},
    {to_underlying(winrt::Windows::System::VirtualKey::Pause), "Pause"},

    //// Media Keys
    {to_underlying(winrt::Windows::System::VirtualKey::GoBack), "BrowserBack"},
    {to_underlying(winrt::Windows::System::VirtualKey::Favorites), "BrowserFavorites"},
    {to_underlying(winrt::Windows::System::VirtualKey::GoForward), "BrowserForward"},
    {to_underlying(winrt::Windows::System::VirtualKey::GoHome), "BrowserHome"},
    {to_underlying(winrt::Windows::System::VirtualKey::Refresh), "BrowserRefresh"},
    {to_underlying(winrt::Windows::System::VirtualKey::Search), "BrowserSearch"},
    {to_underlying(winrt::Windows::System::VirtualKey::Stop), "BrowserStop"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Eject"},
    {182, "LaunchApp1"},
    {183, "LaunchApp2"},
    {180, "LaunchMail"},
    {179, "MediaPlayPause"},
    {181, "MediaSelect"},
    {178, "MediaStop"},
    {176, "MediaTrackNext"},
    {177, "MediaTrackPrevious"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Power"},
    {to_underlying(winrt::Windows::System::VirtualKey::Sleep), "Sleep"},
    {174, "AudioVolumeDown"},
    {173, "AudioVolumeMute"},
    {175, "AudioVolumeUp"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "WakeUp"},

    ////List of code values for legacy modifier keys.
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Hyper"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Super"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Turbo"},

    ////List of code values for legacy process control keys.
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Abort"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Resume"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Suspend"},

    ////List of code values for legacy editing keys.
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Again"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Copy"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Cut"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Find"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Open"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Paste"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Props"},
    {to_underlying(winrt::Windows::System::VirtualKey::Select), "Select"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Undo"},

    // The following keys may be found on non-standard international keyboards.
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Hiragana"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Katakana"},
    //{to_underlying(winrt::Windows::System::VirtualKey::None), "Undo"},

    // Xbox Gamepad
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadA), "GamepadA"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadB), "GamepadB"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadX), "GamepadX"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadY), "GamepadY"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightShoulder), "GamepadRightShoulder"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftShoulder), "GamepadLeftShoulder"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftTrigger), "GamepadLeftTrigger"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightTrigger), "GamepadRightTrigger"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadDPadUp), "GamepadDPadUp"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadDPadDown), "GamepadDPadDown"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadDPadLeft), "GamepadDPadLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadDPadRight), "GamepadDPadRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadMenu), "GamepadMenu"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadView), "GamepadView"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftThumbstickButton), "GamepadLeftThumbstickButton"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightThumbstickButton), "GamepadRightThumbstickButton"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftThumbstickUp), "GamepadLeftThumbstickUp"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftThumbstickDown), "GamepadLeftThumbstickDown"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftThumbstickRight), "GamepadLeftThumbstickRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadLeftThumbstickLeft), "GamepadLeftThumbstickLeft"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightThumbstickUp), "GamepadRightThumbstickUp"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightThumbstickDown), "GamepadRightThumbstickDown"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightThumbstickRight), "GamepadRightThumbstickRight"},
    {to_underlying(winrt::Windows::System::VirtualKey::GamepadRightThumbstickLeft), "GamepadRightThumbstickLeft"}};

template <typename T>
static const std::string GetOrUnidentified(
    winrt::Windows::System::VirtualKey virtualKey,
    std::vector<std::pair<T, std::string>> const &vector) {
  for (auto const &pair : vector) {
    if (static_cast<int>(pair.first) == static_cast<int>(virtualKey))
      return pair.second;
  }
  return "Unidentified";
}

const std::string GetOrUnidentifiedCode(winrt::Windows::System::VirtualKey virtualKey) {
  return GetOrUnidentified(virtualKey, g_virtualKeyToCode);
}

const std::string GetOrUnidentifiedKey(winrt::Windows::System::VirtualKey virtualKey) {
  return GetOrUnidentified(virtualKey, g_virtualKeyToKey);
}

std::string FromVirtualKey(winrt::Windows::System::VirtualKey virtualKey, bool fShift, bool fCaps) {
  int vk = static_cast<int>(virtualKey);

  // Windows doesn't define Virtual Keys for 0-9 and A-Z, they're just aligned to their ASCII representation (in
  // uppercase, for the alphabet VKs).  See WinUser.h
  if ((vk >= '0' && vk <= '9') || (vk >= 'A' && vk <= 'Z')) {
    auto c = static_cast<char>(vk);
    if ((fShift == fCaps) && std::isalpha(c)) {
      c = static_cast<char>(std::tolower(c));
    }

    return std::string{c};
  }

  return GetOrUnidentifiedKey(virtualKey);
}

bool IsModifiedKeyPressed(winrt::Windows::System::VirtualKey virtualKey) {
  auto const &keyState = winrt::Microsoft::UI::Input::InputKeyboardSource::GetKeyStateForCurrentThread(virtualKey);
  return (keyState & winrt::Windows::UI::Core::CoreVirtualKeyStates::Down) == winrt::Windows::UI::Core::CoreVirtualKeyStates::Down;
}
bool IsKeyLocked(winrt::Windows::System::VirtualKey virtualKey) {
  const auto state=winrt::Microsoft::UI::Input::InputKeyboardSource::GetKeyStateForCurrentThread(virtualKey);
  return (state&winrt::Windows::UI::Core::CoreVirtualKeyStates::Locked)==winrt::Windows::UI::Core::CoreVirtualKeyStates::Locked;
}

KeyIdentity IdentityFromMessage(uint32_t key,uint32_t scanCode,bool extended,bool shift,bool caps) {
  // Resolve only WM_KEY's generic modifiers. Explicit left/right VKs from
  // injected or alternate producers are already unambiguous.
  if(key==0x10)key=scanCode==0x36?0xa1:0xa0;
  else if(key==0x11)key=extended?0xa3:0xa2;
  else if(key==0x12)key=extended?0xa5:0xa4;
  const auto vk=static_cast<winrt::Windows::System::VirtualKey>(key);
  KeyIdentity result{FromVirtualKey(vk,shift,caps),CodeFromVirtualKey(vk)};
  if(key==0x0d&&extended)result.code="NumpadEnter";
  // NumLock changes the logical VK, but not the physical keypad position.
  if(!extended&&scanCode>=0x47&&scanCode<=0x53){
    const char* code=nullptr;
    switch(scanCode){case 0x47:code="Numpad7";break;case 0x48:code="Numpad8";break;case 0x49:code="Numpad9";break;
      case 0x4b:code="Numpad4";break;case 0x4c:code="Numpad5";break;case 0x4d:code="Numpad6";break;
      case 0x4f:code="Numpad1";break;case 0x50:code="Numpad2";break;case 0x51:code="Numpad3";break;
      case 0x52:code="Numpad0";break;case 0x53:code="NumpadDecimal";break;}
    if(code)result.code=code;
  }
  // Adapt the RNW table's legacy operation labels to Source key labels.
  switch(key){case 0x6a:result.key="*";break;case 0x6b:result.key="+";break;case 0x6d:result.key="-";break;
    case 0x6e:result.key=".";break;case 0x6f:result.key="/";break;
    case 0x2c:result.code="PrintScreen";break;case 0x5d:result.code="ContextMenu";break;}
  if(result.code=="ShiftLeft"||result.code=="ControlLeft"||result.code=="AltLeft"||result.code=="MetaLeft")result.location=1;
  else if(result.code=="ShiftRight"||result.code=="ControlRight"||result.code=="AltRight"||result.code=="MetaRight")result.location=2;
  else if(result.code.starts_with("Numpad"))result.location=3;
  return result;
}

inline winrt::Windows::System::VirtualKey GetLeftOrRightModifiedKey(
    winrt::Windows::System::VirtualKey leftKey,
    winrt::Windows::System::VirtualKey rightKey) {
  return IsModifiedKeyPressed(leftKey) ? leftKey : rightKey;
}

std::string CodeFromVirtualKey(winrt::Windows::System::VirtualKey virtualKey) {
  int key = static_cast<int>(virtualKey);

  if (key >= '0' && key <= '9') {
    return "Digit" + std::string(1, static_cast<char>(key));
  } else if (key >= 'A' && key <= 'Z') {
    return "Key" + std::string(1, static_cast<char>(key));
  } else {
    // Override the virtual key if it's modified key of Control, Shift or Menu
    if (virtualKey == winrt::Windows::System::VirtualKey::Control) {
      virtualKey = GetLeftOrRightModifiedKey(
          winrt::Windows::System::VirtualKey::LeftControl,
          winrt::Windows::System::VirtualKey::RightControl);
    } else if (virtualKey == winrt::Windows::System::VirtualKey::Shift) {
      virtualKey = GetLeftOrRightModifiedKey(
          winrt::Windows::System::VirtualKey::LeftShift, winrt::Windows::System::VirtualKey::RightShift);
    } else if (virtualKey == winrt::Windows::System::VirtualKey::Menu) {
      virtualKey = GetLeftOrRightModifiedKey(
          winrt::Windows::System::VirtualKey::LeftMenu, winrt::Windows::System::VirtualKey::RightMenu);
    }
  }

  return GetOrUnidentifiedCode(virtualKey);
}

} // namespace nelyx::v2::windows::rnw
