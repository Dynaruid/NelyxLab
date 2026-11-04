// SPDX-License-Identifier: BSD-3-Clause
#include <emscripten.h>
#include <pthread.h>
#include <cstdint>
#include <cstdlib>
#include <cstring>

struct OwnerStart { void* engine; uint32_t role; char* adapter; char* root; };
EM_JS(void, nelyx_owner_boot, (void* engine, uint32_t role, const char* adapter, const char* root), {
  importScripts(UTF8ToString(adapter));
  NelyxV2Owner.boot(Module, engine, role, UTF8ToString(root)).catch((error) => {
    postMessage({ kind: 'nelyx-v2-owner-error', role, message: String(error), stack: error.stack });
  });
});
static void* start_owner(void* value) {
  auto* start = static_cast<OwnerStart*>(value);
  nelyx_owner_boot(start->engine, start->role, start->adapter, start->root);
  std::free(start->adapter); std::free(start->root); delete start;
  emscripten_exit_with_live_runtime();
  return nullptr;
}
extern "C" {
uint32_t nelyx_host_thread_id() { return uint32_t(uintptr_t(pthread_self())); }
uint32_t nelyx_host_start(void* engine, uint32_t role, const char* adapter, const char* root) {
#ifdef __EMSCRIPTEN_PTHREADS__
  auto* start = new OwnerStart{engine, role, strdup(adapter), strdup(root)};
  pthread_t thread;
  const auto result = pthread_create(&thread, nullptr, start_owner, start);
  if (result) { std::free(start->adapter); std::free(start->root); delete start; return 0; }
  pthread_detach(thread);
  return uint32_t(uintptr_t(thread));
#else
  (void)engine; (void)role; (void)adapter; (void)root;
  return 0;
#endif
}
void nelyx_host_exit() {
#ifdef __EMSCRIPTEN_PTHREADS__
  // Emscripten's async callback boundary handles the pthread 'unwind'. Calling
  // pthread_exit directly from an ordinary JS setTimeout leaks that exception.
  emscripten_async_call([](void*){pthread_exit(nullptr);},nullptr,0);
#endif
}
}
