// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::{clipboard_policy, Identity, Registry};
pub use wasm_bindgen;

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
    };
}
