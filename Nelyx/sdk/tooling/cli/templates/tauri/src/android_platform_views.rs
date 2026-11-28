// SPDX-License-Identifier: BSD-3-Clause
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use jni::{
    objects::{JByteArray, JLongArray, JObject},
    sys::{jbyteArray, jdouble, jint},
    JNIEnv,
};
use nelyx_skia_foreground::{ForegroundFrame, FrameKey, SUPPLY_MANIFEST};
use serde_json::{json, Value};
use tauri::{
    ipc::Channel,
    plugin::{self, PluginHandle},
    Builder, Emitter, EventTarget, Manager, Webview, Wry,
};

use crate::ANDROID_PLATFORM_VIEWS;

struct PlatformViews {
    plugin: PluginHandle<Wry>,
    events: Channel<Value>,
    owners: Arc<Mutex<HashMap<String, Value>>>,
}

fn allowed(webview: &Webview<Wry>) -> Result<(), String> {
    if !ANDROID_PLATFORM_VIEWS.contains(&webview.label())
        || webview.label() != webview.window().label()
    {
        return Err("Android platform views are disabled for this WebView".into());
    }
    tauri_plugin_nelyx_backend::verify_app_webview(webview).map_err(|error| error.message)
}

#[tauri::command]
async fn android_platform_view(webview: Webview<Wry>, mut request: Value) -> Result<Value, String> {
    allowed(&webview)?;
    let action = request
        .get("action")
        .and_then(Value::as_str)
        .ok_or("Expected an Android platform view action")?;
    if action == "probe" {
        let manifest: Value =
            serde_json::from_str(SUPPLY_MANIFEST).map_err(|error| error.to_string())?;
        return Ok(json!({ "wireVersion": 1, "types": ["nelyx.android.edit"], "skia": manifest }));
    }
    let open = action == "open";
    let close = action == "close";
    let owner = request
        .get("owner")
        .cloned()
        .ok_or("Expected an Android platform view owner")?;
    let state = webview.state::<PlatformViews>();
    let label = webview.label();
    let object = request
        .as_object_mut()
        .ok_or("Expected an Android platform view command")?;
    if open {
        object.insert("events".into(), json!(state.events));
        object.insert("window".into(), json!(label));
        state
            .owners
            .lock()
            .unwrap()
            .insert(label.to_owned(), owner.clone());
    }
    let result = state
        .plugin
        .run_mobile_plugin_async("control", request)
        .await
        .map_err(|error| error.to_string());
    if close || (open && result.is_err()) {
        let mut owners = state.owners.lock().unwrap();
        if owners.get(label) == Some(&owner) {
            owners.remove(label);
        }
    }
    result
}

#[tauri::command]
async fn android_platform_view_frame(webview: Webview<Wry>, packet: String) -> Result<(), String> {
    allowed(&webview)?;
    if packet.len() > 512 * 1024 {
        return Err("Android foreground packet exceeds its byte budget".into());
    }
    webview
        .state::<PlatformViews>()
        .plugin
        .run_mobile_plugin_async("frame", json!({ "packet": packet }))
        .await
        .map_err(|error| error.to_string())
}

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
        .plugin(
            plugin::Builder::<Wry>::new("nelyx-native-views")
                .setup(|app, api| {
                    let handle = app.clone();
                    let owners = Arc::new(Mutex::new(HashMap::new()));
                    let active = Arc::clone(&owners);
                    // Tauri keeps registered mobile channels for the app lifetime. Share
                    // one channel across WebView generations and route only the live owner.
                    let events = Channel::new(move |body| {
                        let event: Value = body.deserialize()?;
                        if let Some(window) = event.get("window").and_then(Value::as_str) {
                            let valid = active.lock().unwrap().get(window) == event.get("owner");
                            if valid && ANDROID_PLATFORM_VIEWS.contains(&window) {
                                handle.emit_to(
                                    EventTarget::webview(window),
                                    "nelyx-android-platform-view",
                                    event,
                                )?;
                            }
                        }
                        Ok(())
                    });
                    app.manage(PlatformViews {
                        plugin: api.register_android_plugin(
                            "dev.nelyx.platformviews",
                            "PlatformViewsPlugin",
                        )?,
                        events,
                        owners,
                    });
                    Ok(())
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            android_platform_view,
            android_platform_view_frame
        ])
        .on_page_load(|webview, page| {
            if !matches!(page.event(), tauri::webview::PageLoadEvent::Started) {
                return;
            }
            let Some(state) = webview.try_state::<PlatformViews>() else {
                return;
            };
            let owner = state.owners.lock().unwrap().remove(webview.label());
            if let Some(owner) = owner {
                let plugin = state.plugin.clone();
                tauri::async_runtime::spawn(async move {
                    let _: Result<(), _> = plugin
                        .run_mobile_plugin_async(
                            "control",
                            json!({ "action": "close", "owner": owner }),
                        )
                        .await;
                });
            }
        })
}

/// Kotlin owns the TextureView. JNI translates one validated shape packet to RGBA pixels.
#[no_mangle]
pub extern "system" fn Java_dev_nelyx_platformviews_PlatformViewsPlugin_rasterize(
    env: JNIEnv<'_>,
    _self: JObject<'_>,
    packet: JByteArray<'_>,
    expected: JLongArray<'_>,
    width: jint,
    height: jint,
    scale: jdouble,
) -> jbyteArray {
    let render = || {
        if env.get_array_length(&packet).ok()? > 300_000
            || env.get_array_length(&expected).ok()? != 6
        {
            return None;
        }
        let mut key = [0; 6];
        env.get_long_array_region(&expected, 0, &mut key).ok()?;
        if key
            .iter()
            .any(|number| *number < 0 || *number > (1 << 53) - 1)
        {
            return None;
        }
        let [owner_generation, sequence, viewport_generation, renderer_generation, context_generation, surface_generation] =
            key.map(|value| value as u64);
        let bytes = env.convert_byte_array(packet).ok()?;
        let foreground = ForegroundFrame::decode(
            &bytes,
            FrameKey {
                owner_generation,
                sequence,
                viewport_generation,
                renderer_generation,
                context_generation,
                surface_generation,
            },
        )
        .ok()?;
        let pixels = foreground.android_pixels(width, height, scale).ok()?;
        Some(env.byte_array_from_slice(&pixels).ok()?.into_raw())
    };
    render().unwrap_or(std::ptr::null_mut())
}
