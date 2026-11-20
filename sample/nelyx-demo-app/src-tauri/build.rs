use tauri_build::{AppManifest, Attributes, CodegenContext};

fn main() {
    tauri_build::try_build(
        Attributes::new()
            .app_manifest(AppManifest::new().commands(&["host_info"]))
            .codegen(CodegenContext::new()),
    )
    .expect("failed to build the Nelyx Demo Tauri context");
}
