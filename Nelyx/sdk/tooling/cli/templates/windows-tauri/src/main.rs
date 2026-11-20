// SPDX-License-Identifier: BSD-3-Clause
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

fn main() {
    let release_url = Url::parse("https://tauri.localhost/").expect("invalid embedded app URL");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![host_info])
        .on_page_load(move |webview, payload| {
            if payload.event() != PageLoadEvent::Finished || webview.label() != "main" {
                return;
            }
            let app_url = if tauri::is_dev() {
                webview.config().build.dev_url.as_ref()
            } else {
                Some(&release_url)
            };
            if !app_url.is_some_and(|url| url.origin() == payload.url().origin()) {
                return;
            }
            let Some(window) = webview
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
            else {
                return;
            };
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
