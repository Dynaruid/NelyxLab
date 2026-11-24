// SPDX-License-Identifier: BSD-3-Clause
use js_sys::{Function, Object, Promise, Reflect};
use wasm_bindgen::{prelude::*, JsCast};
use web_sys::{Clipboard, Geolocation, Navigator, PermissionState, PermissionStatus, Window};

fn has_method(target: &JsValue, name: &str) -> bool {
    Reflect::get(target, &JsValue::from_str(name)).is_ok_and(|value| value.is_function())
}

pub fn geolocation(view: &Window) -> Result<Geolocation, JsValue> {
    if view.is_secure_context() {
        let location = view.navigator().geolocation()?;
        if ["getCurrentPosition", "watchPosition", "clearWatch"]
            .into_iter()
            .all(|name| has_method(location.as_ref(), name))
        {
            return Ok(location);
        }
    }
    Err(JsValue::from_str("Geolocation is unsupported in this view"))
}

#[wasm_bindgen]
pub struct BrowserDevices {
    navigator: Navigator,
    clipboard: Option<Clipboard>,
}

impl BrowserDevices {
    pub fn new(view: Window) -> Self {
        let navigator = view.navigator();
        let clipboard = if view.is_secure_context() {
            let clipboard = navigator.clipboard();
            (!AsRef::<JsValue>::as_ref(&clipboard).is_null_or_undefined()).then_some(clipboard)
        } else {
            None
        };
        Self {
            navigator,
            clipboard,
        }
    }

    pub fn permission_state(status: &PermissionStatus) -> &'static str {
        match status.state() {
            PermissionState::Granted => "granted",
            PermissionState::Prompt => "prompt",
            PermissionState::Denied => "denied",
            _ => "unavailable",
        }
    }

    fn clipboard_with_method(&self, method: &str) -> Option<&Clipboard> {
        self.clipboard
            .as_ref()
            .filter(|clipboard| has_method(clipboard.as_ref(), method))
    }
}

#[wasm_bindgen]
impl BrowserDevices {
    pub fn can_read_clipboard(&self) -> bool {
        self.clipboard_with_method("readText").is_some()
    }

    pub fn can_write_clipboard(&self) -> bool {
        self.clipboard_with_method("writeText").is_some()
    }

    // Call the browser synchronously and return its own Promise to the caller.
    #[wasm_bindgen(unchecked_return_type = "Promise<string>")]
    pub fn read_clipboard_text(&self) -> Result<Promise, JsValue> {
        self.clipboard_with_method("readText")
            .map(Clipboard::read_text)
            .ok_or_else(|| JsValue::from_str("Clipboard read is not supported"))
    }

    #[wasm_bindgen(unchecked_return_type = "Promise<void>")]
    pub fn write_clipboard_text(&self, text: &str) -> Result<Promise, JsValue> {
        self.clipboard_with_method("writeText")
            .map(|clipboard| clipboard.write_text(text))
            .ok_or_else(|| JsValue::from_str("Clipboard write is not supported"))
    }

    #[wasm_bindgen(unchecked_return_type = "Promise<PermissionStatus> | undefined")]
    pub fn clipboard_permission(&self, read: bool) -> Option<Promise> {
        let permissions = self.navigator.permissions().ok()?;
        if !has_method(permissions.as_ref(), "query") {
            return None;
        }
        let name = if read {
            "clipboard-read"
        } else {
            "clipboard-write"
        };
        let descriptor = Object::new();
        Reflect::set(
            &descriptor,
            &JsValue::from_str("name"),
            &JsValue::from_str(name),
        )
        .ok()?;
        permissions.query(&descriptor).ok()
    }
}

pub fn vibrate(view: &Window, duration: u32) -> Result<bool, JsValue> {
    let navigator = view.navigator();
    if !has_method(navigator.as_ref(), "vibrate") {
        return Ok(false);
    }
    Ok(navigator.vibrate_with_duration(duration))
}

#[wasm_bindgen]
pub struct ClipboardPermissionObserver {
    status: PermissionStatus,
    listener: Closure<dyn FnMut()>,
}

impl ClipboardPermissionObserver {
    pub fn new(status: PermissionStatus, changed: Function) -> Result<Self, JsValue> {
        let listener = Closure::own_aborting(move || {
            let _ = changed.call0(&JsValue::UNDEFINED);
        });
        status.add_event_listener_with_callback("change", listener.as_ref().unchecked_ref())?;
        Ok(Self { status, listener })
    }
}

impl Drop for ClipboardPermissionObserver {
    fn drop(&mut self) {
        let _ = self
            .status
            .remove_event_listener_with_callback("change", self.listener.as_ref().unchecked_ref());
    }
}
