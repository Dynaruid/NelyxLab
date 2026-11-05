// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx/engine.h"
#include "../core/engine.hpp"
#include <cstdlib>
#include <new>

struct nelyx_engine { nelyx::v2::Engine core; nelyx_engine(uint32_t s, uint32_t a) : core(s, a) {} };
using namespace nelyx::v2;
extern "C" {
uint32_t nelyx_engine_abi_major(void) { return wire::abiMajor; }
uint32_t nelyx_engine_schema(void) { return wire::schema; }
uint32_t nelyx_engine_capabilities(void) { return coreCapabilities; }
uint32_t nelyx_engine_create(const nelyx_engine_options* o, nelyx_engine** output) {
  if (!output) return wire::statuses::malformed;
  *output = nullptr;
  if (!o || o->size != sizeof(nelyx_engine_options) || o->reserved ||
      !o->session_generation || !o->app_generation) return wire::statuses::malformed;
  if (o->abi_major != wire::abiMajor || o->abi_minor > wire::abiMinor || o->schema != wire::schema)
    return wire::statuses::incompatible;
  if (o->required_capabilities & ~nelyx_engine_capabilities()) return wire::statuses::capabilityMissing;
  try { *output = new nelyx_engine(o->session_generation, o->app_generation); return wire::statuses::ok; }
  catch (...) { return wire::statuses::budgetExceeded; }
}
uint32_t nelyx_engine_dispatch(nelyx_engine* engine, const uint8_t* data, uint32_t length,
    nelyx_engine_buffer* output) {
  if (!output || output->size != sizeof(nelyx_engine_buffer) || output->version != 1 ||
      output->data || output->length || !engine || (!data && length)) return wire::statuses::malformed;
  try {
    const auto bytes = engine->core.dispatch({data, length});
    auto* copy = static_cast<uint8_t*>(std::malloc(bytes.size()));
    if (!copy) return wire::statuses::budgetExceeded;
    std::memcpy(copy, bytes.data(), bytes.size());
    output->data = copy; output->length = uint32_t(bytes.size());
    return wire::statuses::ok;
  } catch (const Error& e) { return e.status; }
  catch (const std::bad_alloc&) { return wire::statuses::budgetExceeded; }
  catch (...) { return wire::statuses::failed; }
}
uint32_t nelyx_engine_connect_provider(nelyx_engine* engine, uint32_t independent, uint64_t content, uint64_t render) {
  if (!engine || independent > 1) return wire::statuses::malformed;
  try { engine->core.connectProvider(bool(independent), content, render); return 0; }
  catch (const Error& e) { return e.status; }
  catch (...) { return wire::statuses::failed; }
}
void nelyx_engine_buffer_release(nelyx_engine_buffer* buffer) {
  if (!buffer || buffer->size != sizeof(nelyx_engine_buffer) || buffer->version != 1) return;
  std::free(buffer->data); buffer->data = nullptr; buffer->length = 0;
}
void nelyx_engine_destroy(nelyx_engine* engine) { delete engine; }
}
