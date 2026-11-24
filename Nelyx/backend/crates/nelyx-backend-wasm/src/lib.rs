// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::{clipboard_policy, Identity, Registry};
pub use wasm_bindgen;

#[cfg(target_arch = "wasm32")]
mod devices;
#[cfg(target_arch = "wasm32")]
#[doc(hidden)]
pub use devices::{geolocation, vibrate, BrowserDevices, ClipboardPermissionObserver};
#[cfg(target_arch = "wasm32")]
#[doc(hidden)]
pub use {js_sys, web_sys};

pub fn describe(identity: Identity) -> String {
    serde_json::to_string(&identity.describe("browser")).expect("serializable backend identity")
}

pub fn invoke(registry: &Registry, command: &str, input: &str) -> String {
    let result = serde_json::from_str(input)
        .map_err(|error| {
            nelyx_backend_core::BackendError::new("invalid-arguments", error.to_string())
        })
        .and_then(|value| registry.invoke(command, value));
    serde_json::to_string(&result).expect("serializable backend result")
}

pub fn policy(input: &str) -> Result<String, wasm_bindgen::JsValue> {
    let error = |error: serde_json::Error| wasm_bindgen::JsValue::from_str(&error.to_string());
    let input = serde_json::from_str(input).map_err(error)?;
    serde_json::to_string(&clipboard_policy(input)).map_err(error)
}

#[macro_export]
macro_rules! export_backend {
    ($identity:expr, $register:path) => {
        use $crate::wasm_bindgen::prelude::wasm_bindgen;

        fn registry() -> &'static nelyx_backend_core::Registry {
            static REGISTRY: std::sync::OnceLock<nelyx_backend_core::Registry> =
                std::sync::OnceLock::new();
            REGISTRY.get_or_init(|| {
                let mut registry = nelyx_backend_core::Registry::default();
                $register(&mut registry);
                registry
            })
        }

        #[wasm_bindgen]
        pub fn describe() -> String {
            registry();
            $crate::describe($identity)
        }

        #[wasm_bindgen]
        pub fn invoke(command: &str, input: &str) -> String {
            $crate::invoke(registry(), command, input)
        }

        #[wasm_bindgen]
        pub fn clipboard_policy(input: &str) -> Result<String, $crate::wasm_bindgen::JsValue> {
            $crate::policy(input)
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn bind_browser_devices(view: $crate::web_sys::Window) -> $crate::BrowserDevices {
            $crate::BrowserDevices::new(view)
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn clipboard_permission_state(status: &$crate::web_sys::PermissionStatus) -> String {
            $crate::BrowserDevices::permission_state(status).into()
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn observe_clipboard_permission(
            status: $crate::web_sys::PermissionStatus,
            changed: $crate::js_sys::Function,
        ) -> Result<$crate::ClipboardPermissionObserver, $crate::wasm_bindgen::JsValue> {
            $crate::ClipboardPermissionObserver::new(status, changed)
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn vibrate_browser(
            view: &$crate::web_sys::Window,
            duration: u32,
        ) -> Result<bool, $crate::wasm_bindgen::JsValue> {
            $crate::vibrate(view, duration)
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn browser_geolocation_available(view: &$crate::web_sys::Window) -> bool {
            $crate::geolocation(view).is_ok()
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn browser_geolocation_current(
            view: &$crate::web_sys::Window,
            success: &$crate::js_sys::Function,
            failure: &$crate::js_sys::Function,
            options: &$crate::web_sys::PositionOptions,
        ) -> Result<(), $crate::wasm_bindgen::JsValue> {
            $crate::geolocation(view)?.get_current_position_with_error_callback_and_options(
                success,
                Some(failure),
                options,
            )
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn browser_geolocation_watch(
            view: &$crate::web_sys::Window,
            success: &$crate::js_sys::Function,
            failure: &$crate::js_sys::Function,
            options: &$crate::web_sys::PositionOptions,
        ) -> Result<i32, $crate::wasm_bindgen::JsValue> {
            $crate::geolocation(view)?.watch_position_with_error_callback_and_options(
                success,
                Some(failure),
                options,
            )
        }

        #[cfg(target_arch = "wasm32")]
        #[wasm_bindgen]
        pub fn browser_geolocation_clear(
            view: &$crate::web_sys::Window,
            id: i32,
        ) -> Result<(), $crate::wasm_bindgen::JsValue> {
            $crate::geolocation(view)?.clear_watch(id);
            Ok(())
        }
    };
}
