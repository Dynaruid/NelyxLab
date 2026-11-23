// SPDX-License-Identifier: BSD-3-Clause
use tauri_build::{Attributes, CodegenContext};

fn main() {
    tauri_build::try_build(
        Attributes::new()
            .codegen(CodegenContext::new()),
    )
    .expect("failed to build the Nelyx Tauri context");
}
