// SPDX-License-Identifier: BSD-3-Clause

use tauri::{
    ipc::Channel,
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, State, Wry,
};

pub(super) fn plugin() -> TauriPlugin<Wry> {
    Builder::new("nelyx-safe-area")
        .setup(|app, api| {
            app.manage(api.register_android_plugin("dev.nelyx.demo.tauri", "SafeAreaPlugin")?);
            Ok(())
        })
        .build()
}

#[tauri::command]
pub(super) async fn watch_safe_area(
    plugin: State<'_, PluginHandle<Wry>>,
    on_change: Channel,
) -> Result<(), String> {
    plugin
        .run_mobile_plugin_async(
            "watchSafeArea",
            serde_json::json!({ "onChange": on_change }),
        )
        .await
        .map_err(|error| error.to_string())
}
