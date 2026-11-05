// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx/engine.h"
#include <stddef.h>
int main(void) {
  nelyx_engine_options options = {sizeof(nelyx_engine_options), 2, 0, 0, 1, 1, 1, 0};
  nelyx_engine* engine = NULL;
  nelyx_engine_buffer buffer = {sizeof(nelyx_engine_buffer), 1, NULL, 0};
  options.schema = nelyx_engine_schema();
  options.size = 1;
  if (nelyx_engine_create(&options, &engine) != 10 || engine) return 1;
  options.size = sizeof(options); options.abi_major = 3;
  if (nelyx_engine_create(&options, &engine) != 11 || engine) return 2;
  options.abi_major = 2; options.required_capabilities = 1u << 31;
  if (nelyx_engine_create(&options, &engine) != 12 || engine) return 3;
  options.required_capabilities = 1 | (1u << 9) | (1u << 10) | (1u << 11) | (1u << 12) | (1u << 13);
  if (nelyx_engine_create(&options, &engine) || !engine) return 4;
  buffer.version = 2;
  if (nelyx_engine_dispatch(engine, NULL, 0, &buffer) != 10 || buffer.data) return 5;
  buffer.version = 1;
  if (nelyx_engine_dispatch(engine, NULL, 0, &buffer) || !buffer.data || buffer.length < 64) return 6;
  nelyx_engine_destroy(engine);
  /* The caller may release a copied output after its engine has been destroyed. */
  nelyx_engine_buffer_release(&buffer);
  nelyx_engine_buffer_release(&buffer);
  if (buffer.data || buffer.length) return 7;
  return 0;
}
