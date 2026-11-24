// SPDX-License-Identifier: BSD-3-Clause
fn main() {
    tauri_plugin::Builder::new(&[
        "describe",
        "invoke",
        "clipboard_policy",
        "watch_safe_area",
        "unwatch_safe_area",
        "dispatch_default_back",
        "device_store",
        "device_file_name",
    ])
    .android_path("android")
    .build();
}
