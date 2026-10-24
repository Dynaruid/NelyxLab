// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputRoot.h"
#include <ReactPropertyBag.h>
#include <winrt/Microsoft.ReactNative.h>
#include <winrt/Microsoft.UI.Interop.h>

namespace Nelyx::WindowsInput {
inline auto TextInputRootProperty(){
  using namespace winrt::Microsoft::ReactNative;
  return ReactPropertyId<ReactNonAbiValue<std::shared_ptr<TextInputRoot>>>{L"Nelyx.SDK",L"TextInputRoot.v1"};
}
/** The desktop site's HWND anchors hosting and coordinates. Its ContentIsland
 * can focus an additional InputSite child; TextInputRoot admits that actual
 * HWND after island focus, rather than associating TSF with the site parent. */
inline std::shared_ptr<TextInputRoot> installTextInputRoot(
    winrt::Microsoft::ReactNative::ReactInstanceSettings const& settings,
    winrt::Microsoft::ReactNative::ReactNativeWindow const& window,TextInputIsland::Failed failed){
  winrt::Microsoft::ReactNative::ReactPropertyBag bag{settings.Properties()};
  if(!window||bag.Get(TextInputRootProperty()))throw std::logic_error("Text input root already installed or missing its RNW window");
  const auto island=window.ReactNativeIsland().Island();
  const auto bridge=window.ContentSiteBridge().try_as<winrt::Microsoft::UI::Content::DesktopSiteBridge>();
  if(!island||!bridge)throw std::invalid_argument("Text input requires a desktop ContentIsland bridge");
  const auto siteWindow=winrt::Microsoft::UI::GetWindowFromWindowId(bridge.WindowId());
  auto root=TextInputRoot::create(island,siteWindow,std::move(failed));
  root->watchWindow(window.AppWindow());
  bag.Set(TextInputRootProperty(),root);return root;
}
}
