// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "windows/ObservedKeyboardState.h"
#include <NativeModules.h>
#include <ReactPropertyBag.h>
#include <memory>

namespace RNSkia {
inline auto WindowsKeyboardStateProperty(){using namespace winrt::Microsoft::ReactNative;return ReactPropertyId<ReactNonAbiValue<std::shared_ptr<ObservedKeyboardState>>>{L"Nelyx.Skia.Windows",L"ObservedKeyboardState.v1"};}
/** Called on the app's UI dispatcher, shared by snapshot and native producers. */
inline std::shared_ptr<ObservedKeyboardState> WindowsKeyboardState(winrt::Microsoft::ReactNative::ReactPropertyBag const& properties){
  auto existing=properties.Get(WindowsKeyboardStateProperty());if(existing)return *existing;
  auto state=std::make_shared<ObservedKeyboardState>();properties.Set(WindowsKeyboardStateProperty(),state);return state;
}
inline std::shared_ptr<ObservedKeyboardState> WindowsKeyboardState(winrt::Microsoft::ReactNative::ReactContext const& context){return WindowsKeyboardState(context.Properties());}
} // namespace RNSkia
