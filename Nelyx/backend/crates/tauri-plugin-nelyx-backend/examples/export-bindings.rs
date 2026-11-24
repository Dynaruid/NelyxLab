// SPDX-License-Identifier: BSD-3-Clause
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args_os()
        .nth(1)
        .ok_or("Expected a TypeScript output path")?;
    tauri_plugin_nelyx_backend::export_bindings(path)
}
