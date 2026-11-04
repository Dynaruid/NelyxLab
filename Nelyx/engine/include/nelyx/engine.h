// SPDX-License-Identifier: BSD-3-Clause
#ifndef NELYX_ENGINE_V2_H
#define NELYX_ENGINE_V2_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

typedef struct nelyx_engine nelyx_engine;
typedef struct nelyx_engine_options {
  uint32_t size;
  uint32_t abi_major;
  uint32_t abi_minor;
  uint32_t schema;
  uint32_t session_generation;
  uint32_t app_generation;
  uint32_t required_capabilities;
  uint32_t reserved;
} nelyx_engine_options;

/* The receiving module owns this allocation. Only nelyx_engine_buffer_release
 * may free it. The packet is independent of C struct layout and engine lifetime. */
typedef struct nelyx_engine_buffer {
  uint32_t size;
  uint32_t version;
  uint8_t* data;
  uint32_t length;
} nelyx_engine_buffer;

uint32_t nelyx_engine_abi_major(void);
uint32_t nelyx_engine_schema(void);
uint32_t nelyx_engine_capabilities(void);
uint32_t nelyx_engine_create(const nelyx_engine_options*, nelyx_engine**);
/* Headless cooperative dispatcher: callers serialize operations. Host owner
 * threads must use bounded messages; this API does not create OS threads. Input
 * bytes are read/copied before returning; no JS/JSI pointer is retained. */
uint32_t nelyx_engine_dispatch(nelyx_engine*, const uint8_t*, uint32_t, nelyx_engine_buffer*);
uint32_t nelyx_engine_connect_provider(nelyx_engine*, uint32_t independent, uint64_t content_owner, uint64_t render_owner);
void nelyx_engine_buffer_release(nelyx_engine_buffer*);
/* Final CPU teardown. The host must first close/drain outstanding provider
 * holds (closeSession returns busy until releaseFrame). This function does not
 * wait for GPU/platform work and does not manufacture its completion. */
void nelyx_engine_destroy(nelyx_engine*);

#ifdef __cplusplus
}
#endif
#endif
