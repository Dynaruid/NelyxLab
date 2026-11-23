// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::{BackendKind, Identity, Registry};

fn register(_: &mut Registry) {}

nelyx_backend_wasm::export_backend!(
    Identity {
        backend_version: env!("CARGO_PKG_VERSION"),
        source_id: match option_env!("NELYX_BACKEND_SOURCE_ID") {
            Some(id) => id,
            None => "",
        },
        kind: BackendKind::Wasm,
    },
    register
);
