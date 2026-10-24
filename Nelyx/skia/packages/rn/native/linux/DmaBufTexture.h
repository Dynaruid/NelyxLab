// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "gpu_context.h"
#include <gtk/gtk.h>
#include <libdrm/drm_fourcc.h>
#include <memory>
#include <algorithm>
#include <stdexcept>

namespace RNSkia {
// Call on the owning GTK UI thread before creating the one shared device.
inline nelyx::vulkan::DmaBufDeviceOptions linuxDmaBufOptions(GdkDisplay* display) {
  if(!display)throw std::runtime_error("Linux DMA-BUF requires the owning GDK display");
  nelyx::vulkan::DmaBufDeviceOptions options;
  auto* formats=gdk_display_get_dmabuf_formats(display);
  if(formats)for(gsize i=0;i<gdk_dmabuf_formats_get_n_formats(formats);++i) {
    guint32 fourcc{};guint64 modifier{};gdk_dmabuf_formats_get_format(formats,i,&fourcc,&modifier);
    if(fourcc==DRM_FORMAT_ARGB8888 && std::find(options.modifiers.begin(),options.modifiers.end(),modifier)==options.modifiers.end())
      options.modifiers.push_back(modifier);
  }
  if(options.modifiers.empty() || options.modifiers.size()>256)
    throw std::runtime_error("GDK has no bounded ARGB8888 DMA-BUF modifier set; no renderer fallback");
  return options;
}
// The exporter has completed all GPU writes and its FOREIGN ownership release.
// GDK holds the immutable native lease and FD until its final texture release;
// no runtime/component/CallInvoker is captured by the destroy callback.
inline GdkTexture* importLinuxDmaBufTexture(GdkDisplay* display,
    std::shared_ptr<const nelyx::vulkan::DmaBufFrame> frame) {
  if(!display || !frame || frame->fd<0)throw std::runtime_error("A completed native DMA-BUF frame is required");
  auto* formats=gdk_display_get_dmabuf_formats(display);
  if(!formats || !gdk_dmabuf_formats_contains(formats,DRM_FORMAT_ARGB8888,frame->modifier))
    throw std::runtime_error("GDK display no longer supports the frame modifier");
  auto* builder=gdk_dmabuf_texture_builder_new();
  gdk_dmabuf_texture_builder_set_display(builder,display);
  gdk_dmabuf_texture_builder_set_width(builder,frame->width);gdk_dmabuf_texture_builder_set_height(builder,frame->height);
  gdk_dmabuf_texture_builder_set_fourcc(builder,DRM_FORMAT_ARGB8888);
  gdk_dmabuf_texture_builder_set_modifier(builder,frame->modifier);gdk_dmabuf_texture_builder_set_premultiplied(builder,TRUE);
  gdk_dmabuf_texture_builder_set_n_planes(builder,1);gdk_dmabuf_texture_builder_set_fd(builder,0,frame->fd);
  gdk_dmabuf_texture_builder_set_stride(builder,0,frame->stride);gdk_dmabuf_texture_builder_set_offset(builder,0,frame->offset);
  auto lease=std::make_unique<std::shared_ptr<const nelyx::vulkan::DmaBufFrame>>(std::move(frame));GError* error{};
  auto* texture=gdk_dmabuf_texture_builder_build(builder,[](gpointer value){delete static_cast<std::shared_ptr<const nelyx::vulkan::DmaBufFrame>*>(value);},lease.get(),&error);
  g_object_unref(builder);
  if(!texture){std::string message=error?error->message:"GDK DMA-BUF import failed";if(error)g_error_free(error);throw std::runtime_error(message);}
  lease.release();return texture;
}
}
