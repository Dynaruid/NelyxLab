// SPDX-License-Identifier: BSD-3-Clause
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScrollEdgeEffect {
    #[default]
    Hidden,
    Automatic,
    Soft,
    Hard,
}

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct ScrollEdgeEffects {
    pub top: ScrollEdgeEffect,
    pub right: ScrollEdgeEffect,
    pub bottom: ScrollEdgeEffect,
    pub left: ScrollEdgeEffect,
}

#[cfg(target_os = "ios")]
pub(crate) mod ios {
    use super::{ScrollEdgeEffect, ScrollEdgeEffects};
    use nelyx_backend_core::BackendError;
    use objc2::{
        msg_send,
        rc::Retained,
        runtime::{AnyClass, AnyObject, Bool},
    };
    use tauri::{webview::PlatformWebview, Runtime, Webview};

    pub(crate) fn initialize<R: Runtime>(webview: &Webview<R>, effects: ScrollEdgeEffects) {
        if let Some(styles) = AnyClass::get(c"UIScrollEdgeEffectStyle") {
            if let Err(error) = webview.with_webview(move |native| {
                if let Err(error) = update(native, styles, Some(effects)) {
                    eprintln!("Nelyx scroll edge effects: {}", error.message);
                }
            }) {
                eprintln!("Nelyx scroll edge effects: {error}");
            }
        }
    }

    pub(crate) async fn configure<R: Runtime>(
        webview: &Webview<R>,
        effects: Option<ScrollEdgeEffects>,
    ) -> Result<ScrollEdgeEffects, BackendError> {
        let styles = AnyClass::get(c"UIScrollEdgeEffectStyle").ok_or_else(|| {
            BackendError::new("unsupported", "Scroll edge effects require iOS 26")
        })?;
        let (sender, mut receiver) = tauri::async_runtime::channel(1);
        webview
            .with_webview(move |native| {
                let _ = sender.try_send(update(native, styles, effects));
            })
            .map_err(|error| BackendError::new("platform-error", error.to_string()))?;
        receiver.recv().await.ok_or_else(|| {
            BackendError::new(
                "platform-error",
                "WebView closed during scroll edge configuration",
            )
        })?
    }

    fn update(
        native: PlatformWebview,
        styles: &AnyClass,
        effects: Option<ScrollEdgeEffects>,
    ) -> Result<ScrollEdgeEffects, BackendError> {
        // Tauri owns the WKWebView and invokes this callback on the main thread.
        let webview = unsafe { native.inner().cast::<AnyObject>().as_ref() }
            .ok_or_else(|| BackendError::new("platform-error", "iOS WebView is unavailable"))?;
        let view: Retained<AnyObject> = unsafe { msg_send![webview, scrollView] };
        let top: Retained<AnyObject> = unsafe { msg_send![&*view, topEdgeEffect] };
        let right: Retained<AnyObject> = unsafe { msg_send![&*view, rightEdgeEffect] };
        let bottom: Retained<AnyObject> = unsafe { msg_send![&*view, bottomEdgeEffect] };
        let left: Retained<AnyObject> = unsafe { msg_send![&*view, leftEdgeEffect] };
        let edges = [&*top, &*right, &*bottom, &*left];
        if let Some(effects) = effects {
            for (edge, effect) in
                edges
                    .into_iter()
                    .zip([effects.top, effects.right, effects.bottom, effects.left])
            {
                set_effect(edge, styles, effect);
            }
        }
        let [top, right, bottom, left] = edges.map(|edge| read_effect(edge, styles));
        Ok(ScrollEdgeEffects {
            top,
            right,
            bottom,
            left,
        })
    }

    fn set_effect(edge: &AnyObject, styles: &AnyClass, effect: ScrollEdgeEffect) {
        unsafe {
            let style: Option<Retained<AnyObject>> = match effect {
                ScrollEdgeEffect::Hidden => None,
                ScrollEdgeEffect::Automatic => msg_send![styles, automaticStyle],
                ScrollEdgeEffect::Soft => msg_send![styles, softStyle],
                ScrollEdgeEffect::Hard => msg_send![styles, hardStyle],
            };
            if let Some(style) = &style {
                let _: () = msg_send![edge, setStyle: &**style];
            }
            let _: () = msg_send![edge, setHidden: Bool::new(style.is_none())];
        }
    }

    fn read_effect(edge: &AnyObject, styles: &AnyClass) -> ScrollEdgeEffect {
        unsafe {
            let hidden: Bool = msg_send![edge, isHidden];
            if hidden.as_bool() {
                return ScrollEdgeEffect::Hidden;
            }
            let current: Retained<AnyObject> = msg_send![edge, style];
            let soft: Retained<AnyObject> = msg_send![styles, softStyle];
            let hard: Retained<AnyObject> = msg_send![styles, hardStyle];
            let is_soft: Bool = msg_send![&*current, isEqual: &*soft];
            let is_hard: Bool = msg_send![&*current, isEqual: &*hard];
            if is_soft.as_bool() {
                ScrollEdgeEffect::Soft
            } else if is_hard.as_bool() {
                ScrollEdgeEffect::Hard
            } else {
                ScrollEdgeEffect::Automatic
            }
        }
    }
}
