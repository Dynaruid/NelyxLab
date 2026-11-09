// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx/engine.h"
#include <cstdlib>
#include <emscripten/em_asm.h>

extern "C" {
// Growth on another pthread does not run this owner's JS resize hook. Refresh
// every canonical view before external JS accesses an allocated packet range.
void nelyx_wasm_refresh_heap() { EM_ASM({ updateMemoryViews(); }); }
uint32_t nelyx_wasm_connect(nelyx_engine* engine, uint32_t independent, uint32_t content, uint32_t render) {
  return nelyx_engine_connect_provider(engine, independent, content, render);
}
nelyx_engine* nelyx_wasm_open(uint32_t session, uint32_t app, uint32_t schema, uint32_t required) {
  nelyx_engine_options o{sizeof(o), nelyx_engine_abi_major(), 0, schema, session, app, required, 0};
  nelyx_engine* engine = nullptr;
  return nelyx_engine_create(&o, &engine) == 0 ? engine : nullptr;
}
nelyx_engine_buffer* nelyx_wasm_dispatch(nelyx_engine* engine, const uint8_t* data, uint32_t length) {
  auto* buffer = new nelyx_engine_buffer{sizeof(nelyx_engine_buffer), 1, nullptr, 0};
  if (nelyx_engine_dispatch(engine, data, length, buffer)) { delete buffer; return nullptr; }
  return buffer;
}
uint8_t* nelyx_wasm_buffer_data(nelyx_engine_buffer* buffer) { return buffer ? buffer->data : nullptr; }
uint32_t nelyx_wasm_buffer_length(nelyx_engine_buffer* buffer) { return buffer ? buffer->length : 0; }
void nelyx_wasm_release(nelyx_engine_buffer* buffer) {
  if (!buffer) return;
  nelyx_engine_buffer_release(buffer); delete buffer;
}
}
