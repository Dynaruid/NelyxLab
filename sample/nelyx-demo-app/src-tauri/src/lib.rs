// SPDX-License-Identifier: BSD-3-Clause

use tauri::{webview::PageLoadEvent, AppHandle, Manager, Url};

#[derive(serde::Serialize)]
struct HostInfo {
    version: String,
    os: &'static str,
}

#[tauri::command]
fn host_info(app: AppHandle) -> HostInfo {
    HostInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS,
    }
}

fn app_page(root: &Url, page: &Url) -> bool {
    // WebKit can report the embedded root as tauri://localhost without a slash.
    let page_path = if page.path().is_empty() { "/" } else { page.path() };
    let path = page_path.to_ascii_lowercase();
    root.scheme() == page.scheme()
        && root.host_str() == page.host_str()
        && root.port_or_known_default() == page.port_or_known_default()
        && page.username().is_empty()
        && page.password().is_none()
        && page_path.starts_with(root.path())
        && !path.contains("%2f")
        && !path.contains("%5c")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![host_info])
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Finished || webview.label() != "main" {
                return;
            }
            let config = webview.config();
            let Some(window) = config.app.windows.iter().find(|w| w.label == "main") else {
                return;
            };
            let release_url = if cfg!(any(target_os = "windows", target_os = "android")) {
                if window.use_https_scheme {
                    "https://tauri.localhost/"
                } else {
                    "http://tauri.localhost/"
                }
            } else {
                "tauri://localhost/"
            };
            let release_url = Url::parse(release_url).expect("invalid embedded app URL");
            let root = if tauri::is_dev() {
                config.build.dev_url.as_ref()
            } else {
                Some(&release_url)
            };
            // Mobile Tauri proxies a localhost dev server through its built-in app protocol.
            let mobile_proxy = tauri::is_dev() && cfg!(mobile) && app_page(&release_url, payload.url());
            if !root.is_some_and(|root| app_page(root, payload.url())) && !mobile_proxy {
                return;
            }
            let title =
                serde_json::to_string(&window.title).expect("could not serialize the window title");
            let script = format!(
                "{{\n{}\nvoid setNelyxHostTitle({title});\n}}",
                include_str!("host-info.js")
            );
            if let Err(error) = webview.eval(script) {
                eprintln!("could not evaluate the host info script: {error}");
            }
        })
        .run(tauri::tauri_build_context!())
        .expect("could not run Nelyx Tauri");
}
