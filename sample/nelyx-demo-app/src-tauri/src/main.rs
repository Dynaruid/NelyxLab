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
            if app_url.is_some_and(|url| url.origin() == payload.url().origin()) {
                if let Err(error) = webview.eval(include_str!("host-info.js")) {
                    eprintln!("could not evaluate the host info script: {error}");
                }
            }
        })
        .run(tauri::tauri_build_context!())
        .expect("could not run Nelyx Demo Tauri");
}
