// SPDX-License-Identifier: BSD-3-Clause
use nelyx_backend_core::{json, BackendError, Registry};

pub fn register(registry: &mut Registry) {
    registry.register("app.example", |input| {
        let number = input
            .as_i64()
            .and_then(|number| number.checked_mul(2))
            .and_then(|number| number.checked_add(1))
            .ok_or_else(|| BackendError::new("invalid-arguments", "Expected a bounded integer"))?;
        Ok(json!(number))
    });
}
