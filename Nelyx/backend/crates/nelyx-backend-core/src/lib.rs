// SPDX-License-Identifier: BSD-3-Clause
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
pub use serde_json::{json, Value};

pub const PROTOCOL_VERSION: u32 = 3;

#[derive(Clone, Copy, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "lowercase")]
pub enum BackendKind {
    Wasm,
    Native,
}

#[derive(Clone, Copy, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub backend_version: &'static str,
    pub source_id: &'static str,
    pub kind: BackendKind,
}

#[derive(Clone, Copy, Default, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct ClipboardGrants {
    pub read: bool,
    pub write: bool,
}

#[derive(Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct Description {
    #[serde(flatten)]
    pub identity: Identity,
    pub protocol_version: u32,
    pub os: &'static str,
    pub clipboard: Option<ClipboardGrants>,
    pub haptics: Option<bool>,
    pub android_back: Option<bool>,
    pub system_chrome: bool,
    pub device_services: &'static [&'static str],
    pub safe_area: bool,
    pub window_title: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub windows_acrylic: Option<bool>,
    pub title: Option<String>,
    pub frontend_build_id: Option<&'static str>,
}

impl Identity {
    pub fn describe(self, os: &'static str) -> Description {
        Description {
            identity: self,
            protocol_version: PROTOCOL_VERSION,
            os,
            clipboard: None,
            haptics: None,
            android_back: None,
            system_chrome: false,
            device_services: &[],
            safe_area: false,
            window_title: false,
            windows_acrylic: None,
            title: None,
            frontend_build_id: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct BackendError {
    pub code: &'static str,
    pub message: String,
}

impl BackendError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

pub type BackendResult = Result<Value, BackendError>;
type Handler = Box<dyn Fn(Value) -> BackendResult + Send + Sync>;

#[derive(Default)]
pub struct Registry(BTreeMap<&'static str, Handler>);

impl Registry {
    pub fn register(
        &mut self,
        name: &'static str,
        handler: impl Fn(Value) -> BackendResult + Send + Sync + 'static,
    ) {
        assert!(
            !name.is_empty() && !self.0.contains_key(name),
            "Invalid or duplicate backend command: {name}"
        );
        self.0.insert(name, Box::new(handler));
    }

    pub fn invoke(&self, name: &str, input: Value) -> BackendResult {
        let handler = self.0.get(name).ok_or_else(|| {
            BackendError::new(
                "unknown-command",
                format!("Unknown backend command: {name}"),
            )
        })?;
        handler(input)
    }
}

#[derive(Clone, Copy, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum ClipboardHost {
    Browser,
    BrowserMobile,
    NativeDesktop,
    NativeMobile,
}

#[derive(Clone, Copy, Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum Permission {
    Granted,
    Prompt,
    Denied,
    Unavailable,
}

#[derive(Deserialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ClipboardInput {
    pub host: ClipboardHost,
    pub read_api: bool,
    pub write_api: bool,
    pub read_permission: Permission,
    pub write_permission: Permission,
}

#[derive(Debug, PartialEq, Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[serde(rename_all = "kebab-case")]
pub enum Preflight {
    Read,
    PermissionRequired,
    PermissionDenied,
    Unsupported,
}

#[derive(Serialize)]
#[cfg_attr(feature = "specta", derive(specta::Type))]
pub struct ClipboardPolicy {
    pub read: bool,
    pub write: bool,
    pub preflight: Preflight,
}

pub fn clipboard_policy(input: ClipboardInput) -> ClipboardPolicy {
    let preflight = match (input.read_api, input.host, input.read_permission) {
        (false, _, _) => Preflight::Unsupported,
        (_, _, Permission::Denied) => Preflight::PermissionDenied,
        (_, ClipboardHost::NativeDesktop, _) | (_, ClipboardHost::Browser, Permission::Granted) => {
            Preflight::Read
        }
        _ => Preflight::PermissionRequired,
    };
    ClipboardPolicy {
        read: input.read_api && !matches!(input.read_permission, Permission::Denied),
        write: input.write_api && !matches!(input.write_permission, Permission::Denied),
        preflight,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clipboard_preflight_preserves_permissions_and_mobile_activation() {
        use ClipboardHost::*;
        use Permission::*;
        use Preflight::*;
        for (host, grant, api, preflight) in [
            (Browser, Granted, true, Read),
            (Browser, Prompt, true, PermissionRequired),
            (Browser, Denied, true, PermissionDenied),
            (BrowserMobile, Granted, true, PermissionRequired),
            (Browser, Unavailable, false, Unsupported),
            (NativeDesktop, Granted, true, Read),
            (NativeMobile, Granted, true, PermissionRequired),
            (NativeMobile, Granted, false, Unsupported),
        ] {
            let result = clipboard_policy(ClipboardInput {
                host,
                read_api: api,
                write_api: true,
                read_permission: grant,
                write_permission: Denied,
            });
            assert_eq!(result.preflight, preflight);
            assert_eq!(result.read, api && !matches!(grant, Denied));
            assert!(!result.write);
        }
    }
}
