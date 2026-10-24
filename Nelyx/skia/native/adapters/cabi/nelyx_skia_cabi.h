#pragma once
#include <stdint.h>
#if defined(_WIN32) && defined(NELYX_SKIA_BUILD)
#define NELYX_SKIA_API __declspec(dllexport)
#else
#define NELYX_SKIA_API
#endif
#ifdef __cplusplus
extern "C" {
#endif
NELYX_SKIA_API uint32_t nelyx_skia_abi_version(void);
// Additive ABI 1 query for the maximum accepted frame wire; earlier wires remain readable.
NELYX_SKIA_API uint32_t nelyx_skia_wire_version(void);
// Owner-local program cache diagnostics, as JSON; not a GPU memory/FPS measurement.
NELYX_SKIA_API int32_t nelyx_skia_runtime_shader_stats(uint64_t handle,void* output,uint32_t length);
// ABI 1 module identity: 2 = Graphite/native Vulkan.
NELYX_SKIA_API uint32_t nelyx_skia_gpu_kind(void);
// Requires a live borrowed HWND on the current UI owner; never creates/destroys the HWND.
NELYX_SKIA_API uint64_t nelyx_skia_create_window(const char* image,const char* font,const char* icu,uint64_t borrowedWindow);
// Additive ABI 1, Linux only: kind 1 = Xlib Display*/Window, 2 = wl_display*/wl_surface*.
// Caller owns live same-process handles on this thread until checked close/failed-create cleanup.
// This function never destroys the borrowed display/window and never falls back to CPU rendering.
NELYX_SKIA_API uint64_t nelyx_skia_create_linux_window(const char* image,const char* font,const char* icu,uint32_t kind,uint64_t display,uint64_t window);
NELYX_SKIA_API int32_t nelyx_skia_driver(uint64_t handle,void* output,uint32_t length);
NELYX_SKIA_API uint64_t nelyx_skia_create(const char* image,const char* font,const char* icu,uint32_t gpu);
NELYX_SKIA_API int32_t nelyx_skia_close(uint64_t handle);
// Failed/constructing owners are retained until checked cleanup on their original thread.
NELYX_SKIA_API int32_t nelyx_skia_cleanup_failed_creates(void);
NELYX_SKIA_API int32_t nelyx_skia_resize(uint64_t handle,uint32_t width,uint32_t height);
NELYX_SKIA_API int32_t nelyx_skia_render(uint64_t handle,const void* bytes,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_read_pixels(uint64_t handle,uint32_t width,uint32_t height,void* bytes,uint32_t length);
// Additive ABI 1 native retained SkPicture handles, scoped to this owner/thread.
// Record captures independent native image/font references. Rasterize uses Graphite GPU,
// returns copied premultiplied sRGB RGBA8 pixels and retires GPU work before returning.
// Unconfirmed GPU completion makes this owner checked-close-only; it must not be reused.
NELYX_SKIA_API int32_t nelyx_skia_picture_record(uint64_t handle,uint32_t id,const void* bytes,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_picture_rasterize(uint64_t handle,uint32_t id,uint32_t width,uint32_t height,void* rgba,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_picture_release(uint64_t handle,uint32_t id);
NELYX_SKIA_API int32_t nelyx_skia_layout(uint64_t handle,uint32_t id,const char* text,float width,float size,const char* locale,uint32_t rtl,uint32_t color,uint32_t maxLines,const char* ellipsis,void* output,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_glyphs(uint64_t handle,uint32_t id,void* output,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_range(uint64_t handle,uint32_t id,uint32_t start,uint32_t end,void* output,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_hit(uint64_t handle,uint32_t id,float x,float y,void* output,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_release(uint64_t handle,uint32_t id);
NELYX_SKIA_API int32_t nelyx_skia_asset_load(uint64_t handle,uint32_t id,uint32_t kind,const char* path,const char* family);
NELYX_SKIA_API int32_t nelyx_skia_asset_load_bytes(uint64_t handle,uint32_t id,uint32_t kind,const void* bytes,uint32_t length,const char* family);
NELYX_SKIA_API int32_t nelyx_skia_asset_release(uint64_t handle,uint32_t id,uint32_t kind);
NELYX_SKIA_API int32_t nelyx_skia_layout_font(uint64_t handle,uint32_t id,uint32_t font,const char* text,float width,float size,const char* locale,uint32_t rtl,uint32_t color,uint32_t maxLines,const char* ellipsis,void* output,uint32_t length);
NELYX_SKIA_API int32_t nelyx_skia_retire(uint64_t handle);
NELYX_SKIA_API int32_t nelyx_skia_last_error(void* output,uint32_t length);
#ifdef __cplusplus
}
#endif
