// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::{
    BackendError, BackendResult, ClipboardGrants, ClipboardInput, ClipboardPolicy, Description,
    Identity, Registry, Value,
};
use tauri::{
    ipc::Channel,
    plugin::{Builder, TauriPlugin},
    Manager, Runtime, State, Url, Webview,
};
mod scroll_edge_effects;
mod system_chrome;
#[cfg(target_os = "ios")]
mod system_chrome_ios;
#[cfg(windows)]
mod window_acrylic;

use system_chrome::SystemChromeRequest;
pub use scroll_edge_effects::{ScrollEdgeEffect, ScrollEdgeEffects};

#[derive(Clone, Copy)]
pub struct WindowFeatures {
    pub label: &'static str,
    pub clipboard: Option<ClipboardGrants>,
    pub haptics: Option<bool>,
    pub android_back: Option<bool>,
    pub system_chrome: bool,
    pub scroll_edge_effects: ScrollEdgeEffects,
    pub device_services: &'static [&'static str],
    pub safe_area: bool,
    pub window_title: bool,
    pub windows_acrylic: bool,
    pub commands: Option<&'static [&'static str]>,
}

struct Backend {
    identity: Identity,
    registry: Registry,
    windows: &'static [WindowFeatures],
    frontend_build_id: Option<&'static str>,
}

fn app_page(root: &Url, page: &Url) -> bool {
    let page_path = if page.path().is_empty() {
        "/"
    } else {
        page.path()
    };
    let root_path = if root.path().is_empty() {
        "/"
    } else {
        root.path()
    };
    let path = page_path.to_ascii_lowercase();
    root.scheme() == page.scheme()
        && root.host_str() == page.host_str()
        && root.port_or_known_default() == page.port_or_known_default()
        && page.username().is_empty()
        && page.password().is_none()
        && (page_path == root_path
            || page_path.starts_with(&format!("{}/", root_path.trim_end_matches('/'))))
        && !path.contains("%2f")
        && !path.contains("%5c")
}

fn allowed<R: Runtime>(
    backend: &Backend,
    webview: &Webview<R>,
) -> Result<WindowFeatures, BackendError> {
    let denied = || {
        BackendError::new(
            "permission-denied",
            "Backend is scoped to declared app pages and WebViews",
        )
    };
    let features = backend
        .windows
        .iter()
        .find(|window| window.label == webview.label())
        .ok_or_else(denied)?;
    let config = webview.config();
    let window = config
        .app
        .windows
        .iter()
        .find(|window| window.label == webview.label())
        .ok_or_else(denied)?;
    let root = if cfg!(any(target_os = "windows", target_os = "android")) {
        if window.use_https_scheme {
            "https://tauri.localhost/"
        } else {
            "http://tauri.localhost/"
        }
    } else {
        "tauri://localhost/"
    };
    // Android dispatches this query to the UI thread. The command handlers
    // run asynchronously so that thread can answer it.
    let page = webview.url().map_err(|_| denied())?;
    let embedded = app_page(&Url::parse(root).expect("embedded URL"), &page);
    let development = tauri::is_dev()
        && config
            .build
            .dev_url
            .as_ref()
            .is_some_and(|root| app_page(root, &page));
    if embedded || development {
        Ok(*features)
    } else {
        Err(denied())
    }
}

/// Validate the same embedded app page and window as the core backend commands.
pub fn verify_app_webview<R: Runtime>(webview: &Webview<R>) -> Result<(), BackendError> {
    allowed(&webview.state::<Backend>(), webview).map(|_| ())
}

#[tauri::command]
#[cfg_attr(feature = "generate-bindings", specta::specta)]
async fn describe<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
) -> Result<Description, BackendError> {
    let features = allowed(&backend, &webview)?;
    let mut description = backend.identity.describe(std::env::consts::OS);
    description.clipboard = features.clipboard;
    description.haptics = features
        .haptics
        .map(|enabled| enabled && cfg!(any(target_os = "android", target_os = "ios")));
    description.android_back = features
        .android_back
        .map(|enabled| enabled && cfg!(target_os = "android"));
    description.system_chrome =
        features.system_chrome && cfg!(any(target_os = "android", target_os = "ios"));
    description.device_services = features.device_services;
    description.safe_area = cfg!(target_os = "android") && features.safe_area;
    description.window_title = features.window_title;
    #[cfg(windows)]
    if features.windows_acrylic && webview.window().label() == webview.label() {
        description.windows_acrylic = window_acrylic::enabled(&webview.window());
    }
    description.title = webview
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == webview.label())
        .map(|window| window.title.clone());
    description.frontend_build_id = backend.frontend_build_id;
    Ok(description)
}

#[tauri::command]
async fn invoke<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    command: &str,
    input: Value,
) -> BackendResult {
    let features = allowed(&backend, &webview)?;
    if features
        .commands
        .is_some_and(|commands| !commands.contains(&command))
    {
        return Err(BackendError::new(
            "permission-denied",
            "This WebView cannot invoke that app command",
        ));
    }
    backend.registry.invoke(command, input)
}

#[tauri::command]
#[cfg_attr(feature = "generate-bindings", specta::specta)]
async fn clipboard_policy<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    input: ClipboardInput,
) -> Result<ClipboardPolicy, BackendError> {
    allowed(&backend, &webview)?;
    Ok(nelyx_backend_core::clipboard_policy(input))
}

#[derive(serde::Deserialize)]
#[serde(tag = "operation", rename_all = "lowercase")]
enum StoreInput {
    Get { key: String },
    Set { key: String, value: Value },
    Remove { key: String },
}

#[tauri::command]
async fn device_store<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    input: StoreInput,
) -> BackendResult {
    if !allowed(&backend, &webview)?
        .device_services
        .contains(&"store")
    {
        return Err(BackendError::new(
            "permission-denied",
            "Device store is disabled for this WebView",
        ));
    }
    let key = match &input {
        StoreInput::Get { key } | StoreInput::Set { key, .. } | StoreInput::Remove { key } => key,
    };
    if key.trim().is_empty() || key.contains('\0') || key.encode_utf16().count() > 200 {
        return Err(BackendError::new(
            "invalid-arguments",
            "Invalid device store key",
        ));
    }
    #[cfg(feature = "device-store")]
    {
        use tauri_plugin_store::StoreExt;
        let map_error = |error: tauri_plugin_store::Error| {
            BackendError::new("storage-error", error.to_string())
        };
        let store = webview
            .store_builder("nelyx-device-store.json")
            .disable_auto_save()
            .build()
            .map_err(map_error)?;
        match input {
            StoreInput::Get { key } => {
                let value = store.get(&key);
                return Ok(nelyx_backend_core::json!({ "found": value.is_some(), "value": value }));
            }
            StoreInput::Set { key, value } => store.set(key, value),
            StoreInput::Remove { key } => {
                store.delete(key);
            }
        }
        store.save().map_err(map_error)?;
        Ok(Value::Null)
    }
    #[cfg(not(feature = "device-store"))]
    {
        if let StoreInput::Set { value, .. } = input {
            drop(value);
        }
        Err(BackendError::new(
            "unsupported",
            "Device store plugin is unavailable",
        ))
    }
}

#[derive(serde::Serialize)]
struct SafeAreaInsets {
    top: u32,
    right: u32,
    bottom: u32,
    left: u32,
}

#[tauri::command]
async fn watch_safe_area<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    subscription: String,
    on_change: Channel<SafeAreaInsets>,
) -> Result<(), BackendError> {
    if !allowed(&backend, &webview)?.safe_area || !cfg!(target_os = "android") {
        return Err(BackendError::new(
            "unsupported",
            "Native safe area is unavailable",
        ));
    }
    #[cfg(target_os = "android")]
    return android_call(
        &webview,
        "watchSafeArea",
        serde_json::json!({
            "view": webview.label(), "subscription": subscription, "onChange": on_change,
        }),
    )
    .await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = (subscription, on_change);
        Ok(())
    }
}

#[tauri::command]
async fn unwatch_safe_area<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    subscription: String,
) -> Result<(), BackendError> {
    allowed(&backend, &webview)?;
    #[cfg(target_os = "android")]
    return android_call(
        &webview,
        "unwatchSafeArea",
        serde_json::json!({
            "view": webview.label(), "subscription": subscription,
        }),
    )
    .await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = subscription;
        Ok(())
    }
}

#[tauri::command]
async fn dispatch_default_back<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
) -> Result<(), BackendError> {
    if allowed(&backend, &webview)?.android_back != Some(true) || !cfg!(target_os = "android") {
        return Err(BackendError::new(
            "unsupported",
            "Android back is unavailable",
        ));
    }
    #[cfg(target_os = "android")]
    return android_call(&webview, "dispatchDefaultBack", Value::Null).await;
    #[cfg(not(target_os = "android"))]
    Ok(())
}

#[tauri::command]
async fn system_chrome<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    request: SystemChromeRequest,
) -> Result<(), BackendError> {
    if !allowed(&backend, &webview)?.system_chrome || !cfg!(any(target_os = "android", target_os = "ios")) {
        return Err(BackendError::new("unsupported", "SystemChrome is unavailable"));
    }
    #[cfg(target_os = "ios")]
    return system_chrome_ios::apply(&webview, request).await;
    #[cfg(target_os = "android")]
    return android_call(
        &webview,
        "systemChrome",
        serde_json::to_value(request).map_err(|error| BackendError::new("invalid-arguments", error.to_string()))?,
    )
    .await;
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = request;
        Ok(())
    }
}

#[tauri::command]
async fn scroll_edge_effects<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    effects: Option<ScrollEdgeEffects>,
) -> Result<ScrollEdgeEffects, BackendError> {
    allowed(&backend, &webview)?;
    #[cfg(target_os = "ios")]
    return scroll_edge_effects::ios::configure(&webview, effects).await;
    #[cfg(not(target_os = "ios"))]
    {
        let _ = effects;
        Err(BackendError::new("unsupported", "Scroll edge effects require iOS 26"))
    }
}

#[tauri::command]
#[cfg_attr(feature = "generate-bindings", specta::specta)]
async fn set_window_acrylic<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    enabled: bool,
) -> Result<(), BackendError> {
    let features = allowed(&backend, &webview)?;
    let window = webview.window();
    if !features.windows_acrylic || window.label() != webview.label() {
        return Err(BackendError::new(
            "permission-denied",
            "Desktop Acrylic is disabled for this window",
        ));
    }
    #[cfg(windows)]
    return window_acrylic::set_enabled(&window, enabled);
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err(BackendError::new("unsupported", "Desktop Acrylic requires Windows 11"))
    }
}

#[tauri::command]
async fn device_file_name<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    uri: String,
) -> Result<Option<String>, BackendError> {
    if !allowed(&backend, &webview)?
        .device_services
        .contains(&"files")
    {
        return Err(BackendError::new(
            "permission-denied",
            "File metadata is disabled for this WebView",
        ));
    }
    if !Url::parse(&uri).is_ok_and(|url| url.scheme() == "content") {
        return Err(BackendError::new(
            "invalid-arguments",
            "Expected an Android content URI",
        ));
    }
    #[cfg(target_os = "android")]
    {
        #[derive(serde::Deserialize)]
        struct Name {
            name: Option<String>,
        }
        let selected: Name = android_call(
            &webview,
            "deviceFileName",
            nelyx_backend_core::json!({ "uri": uri }),
        )
        .await?;
        Ok(selected.name)
    }
    #[cfg(not(target_os = "android"))]
    Err(BackendError::new(
        "unsupported",
        "Android file metadata is unavailable",
    ))
}

#[cfg(target_os = "android")]
async fn android_call<R: Runtime, T: serde::de::DeserializeOwned>(
    webview: &Webview<R>,
    command: &str,
    input: Value,
) -> Result<T, BackendError> {
    webview
        .state::<tauri::plugin::PluginHandle<R>>()
        .run_mobile_plugin_async(command, input)
        .await
        .map_err(|error| BackendError::new("platform-error", error.to_string()))
}

pub fn init<R: Runtime>(
    identity: Identity,
    register: fn(&mut Registry),
    windows: &'static [WindowFeatures],
    frontend_build_id: Option<&'static str>,
) -> TauriPlugin<R> {
    let builder = Builder::new("nelyx-backend");
    #[cfg(target_os = "ios")]
    let builder = builder.on_webview_ready(move |webview| {
        if let Some(window) = windows.iter().find(|window| window.label == webview.label()) {
            scroll_edge_effects::ios::initialize(&webview, window.scroll_edge_effects);
        }
    });
    builder
        .setup(move |app, _api| {
            let mut registry = Registry::default();
            register(&mut registry);
            app.manage(Backend {
                identity,
                registry,
                windows,
                frontend_build_id,
            });
            #[cfg(target_os = "android")]
            app.manage(_api.register_android_plugin("dev.nelyx.backend", "SafeAreaPlugin")?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            describe,
            invoke,
            clipboard_policy,
            watch_safe_area,
            unwatch_safe_area,
            dispatch_default_back,
            system_chrome,
            scroll_edge_effects,
            set_window_acrylic,
            device_store,
            device_file_name
        ])
        .build()
}

#[cfg(feature = "generate-bindings")]
pub fn export_bindings(
    path: impl AsRef<std::path::Path>,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::test::MockRuntime;
    use tauri_specta::{collect_commands, Builder, ErrorHandlingMode};

    Builder::<MockRuntime>::new()
        .plugin_name("nelyx-backend")
        .commands(collect_commands![
            describe::<MockRuntime>,
            clipboard_policy::<MockRuntime>,
            set_window_acrylic::<MockRuntime>
        ])
        .error_handling(ErrorHandlingMode::Throw)
        .export(specta_typescript::Typescript::default(), path)?;
    Ok(())
}
