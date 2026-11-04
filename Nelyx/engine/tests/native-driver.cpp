// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx/engine.h"
#include "../core/protocol/schema.hpp"
#include <cstdio>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
int main() {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY); _setmode(_fileno(stdout), _O_BINARY);
#endif
  nelyx_engine_options o{sizeof(o), 2, 0, nelyx_engine_schema(), 1, 1, 15, 0};
  nelyx_engine* engine = nullptr;
  if (nelyx_engine_create(&o, &engine)) return 1;
  int result = 0;
  uint8_t prefix[4];
  while (std::fread(prefix, 1, 4, stdin) == 4) {
    const uint32_t length = uint32_t(prefix[0]) | uint32_t(prefix[1]) << 8 |
      uint32_t(prefix[2]) << 16 | uint32_t(prefix[3]) << 24;
    if (length > nelyx::v2::wire::limits::packetBytes) { result = 2; break; }
    std::vector<uint8_t> bytes(length);
    if (std::fread(bytes.data(), 1, length, stdin) != length) { result = 3; break; }
    nelyx_engine_buffer buffer{sizeof(buffer), 1, nullptr, 0};
    if (nelyx_engine_dispatch(engine, bytes.data(), length, &buffer)) { result = 4; break; }
    for (unsigned i = 0; i < 4; ++i) prefix[i] = uint8_t(buffer.length >> (i * 8));
    if (std::fwrite(prefix, 1, 4, stdout) != 4 ||
        std::fwrite(buffer.data, 1, buffer.length, stdout) != buffer.length) result = 5;
    std::fflush(stdout); nelyx_engine_buffer_release(&buffer);
    if (result) break;
  }
  nelyx_engine_destroy(engine);
  return result;
}
