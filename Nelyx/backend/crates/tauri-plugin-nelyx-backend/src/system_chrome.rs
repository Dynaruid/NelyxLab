// SPDX-License-Identifier: BSD-3-Clause
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
#[serde(tag = "method", content = "arguments")]
pub(crate) enum SystemChromeRequest {
    #[serde(rename = "SystemChrome.setPreferredOrientations")]
    Orientations(Vec<DeviceOrientation>),
    #[serde(rename = "SystemChrome.setEnabledSystemUIMode")]
    Mode(SystemUiMode),
    #[serde(rename = "SystemChrome.setEnabledSystemUIOverlays")]
    Overlays(Vec<SystemUiOverlay>),
    #[serde(rename = "SystemChrome.restoreSystemUIOverlays")]
    Restore,
    #[serde(rename = "SystemChrome.setSystemUIOverlayStyle")]
    Style(OverlayStyle),
}

#[derive(Deserialize, Serialize)]
pub(crate) enum DeviceOrientation {
    #[serde(rename = "DeviceOrientation.portraitUp")]
    PortraitUp,
    #[serde(rename = "DeviceOrientation.portraitDown")]
    PortraitDown,
    #[serde(rename = "DeviceOrientation.landscapeLeft")]
    LandscapeLeft,
    #[serde(rename = "DeviceOrientation.landscapeRight")]
    LandscapeRight,
}

#[derive(Deserialize, Serialize)]
pub(crate) enum SystemUiMode {
    #[serde(rename = "SystemUiMode.edgeToEdge")]
    EdgeToEdge,
    #[serde(rename = "SystemUiMode.leanBack")]
    LeanBack,
    #[serde(rename = "SystemUiMode.immersive")]
    Immersive,
    #[serde(rename = "SystemUiMode.immersiveSticky")]
    ImmersiveSticky,
}

#[derive(Deserialize, PartialEq, Serialize)]
pub(crate) enum SystemUiOverlay {
    #[serde(rename = "SystemUiOverlay.top")]
    Top,
    #[serde(rename = "SystemUiOverlay.bottom")]
    Bottom,
}

#[derive(Deserialize, Serialize)]
pub(crate) enum Brightness {
    #[serde(rename = "Brightness.light")]
    Light,
    #[serde(rename = "Brightness.dark")]
    Dark,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OverlayStyle {
    pub status_bar_brightness: Option<Brightness>,
    status_bar_icon_brightness: Option<Brightness>,
    status_bar_color: Option<u32>,
    system_status_bar_contrast_enforced: Option<bool>,
    system_navigation_bar_color: Option<u32>,
    system_navigation_bar_divider_color: Option<u32>,
    system_navigation_bar_icon_brightness: Option<Brightness>,
    system_navigation_bar_contrast_enforced: Option<bool>,
}
