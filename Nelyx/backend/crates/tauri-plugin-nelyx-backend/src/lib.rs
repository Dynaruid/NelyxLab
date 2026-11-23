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

#[derive(Clone, Copy)]
pub struct WindowFeatures {
    pub label: &'static str,
    pub clipboard: Option<ClipboardGrants>,
    pub safe_area: bool,
    pub window_title: bool,
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

#[tauri::command]
fn describe<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
) -> Result<Description, BackendError> {
    let features = allowed(&backend, &webview)?;
    let mut description = backend.identity.describe(std::env::consts::OS);
    description.clipboard = features.clipboard;
    description.safe_area = cfg!(target_os = "android") && features.safe_area;
    description.window_title = features.window_title;
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
fn invoke<R: Runtime>(
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
fn clipboard_policy<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    input: ClipboardInput,
) -> Result<ClipboardPolicy, BackendError> {
    allowed(&backend, &webview)?;
    Ok(nelyx_backend_core::clipboard_policy(input))
}

#[tauri::command]
async fn watch_safe_area<R: Runtime>(
    webview: Webview<R>,
    backend: State<'_, Backend>,
    subscription: String,
    on_change: Channel,
) -> Result<(), BackendError> {
    if !allowed(&backend, &webview)?.safe_area || !cfg!(target_os = "android") {
        return Err(BackendError::new(
            "unsupported",
            "Native safe area is unavailable",
        ));
    }
    #[cfg(target_os = "android")]
    return safe_area(
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
    return safe_area(
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

#[cfg(target_os = "android")]
async fn safe_area<R: Runtime>(
    webview: &Webview<R>,
    command: &str,
    input: Value,
) -> Result<(), BackendError> {
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
    Builder::new("nelyx-backend")
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
            unwatch_safe_area
        ])
        .build()
}
