// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "DmaBufTexture.h"
#include "RNSkVulkanPlatformContext.h"
#include "rnskia/RNSkWindowSurface.h"
#include "include/core/SkCanvas.h"
#include "include/gpu/graphite/vk/VulkanGraphiteTypes.h"
#include <mutex>
#include <thread>

namespace RNSkia {
// One GTK-owner view. The host must detach on that owner and drain view work
// before runtime cleanup. It initializes the DMA-BUF device on the JS owner
// before mounting; metadata queries and attachment never construct a device.
class RNSkLinuxWindowSurface final : public RNSkWindowSurface {
  struct Attachment {
    GtkPicture* picture;
    std::shared_ptr<RNSkVulkanPlatformContext> context;
    Releaser releaser; // Native-only borrowed-handle release, no JSI captures.
    Attachment(GtkPicture* borrowed,std::shared_ptr<RNSkVulkanPlatformContext> context,Releaser releaser)
      :picture(GTK_PICTURE(g_object_ref(borrowed))),context(std::move(context)),releaser(std::move(releaser)){}
    Attachment(const Attachment&)=delete;
    ~Attachment(){gtk_picture_set_paintable(picture,nullptr);if(releaser)releaser(picture);g_object_unref(picture);}
  };
public:
  explicit RNSkLinuxWindowSurface(std::shared_ptr<RNSkVulkanPlatformContext> context)
    :context(std::move(context)),owner(std::this_thread::get_id()) {
    if(!this->context)throw std::runtime_error("Linux window surface requires its owning native Vulkan platform");
  }
  ~RNSkLinuxWindowSurface() override {
    if(attachment && std::this_thread::get_id()!=owner) {
      // An owner violation cannot free a GTK view or its imported GPU frame.
      // Retain the preallocated native attachment; no allocation on failure.
      attachment.release();
    } else {attachment.reset();}
  }
  void attach(void* handle,int width,int height,bool highBitDepth,bool p3,Releaser releaser) override {
    requireOwner();validateSize(width,height);
    if(!handle || !GTK_IS_PICTURE(handle) || highBitDepth || p3)
      throw std::runtime_error("Linux DMA-BUF surface requires GtkPicture with premultiplied BGRA8/sRGB");
    auto next=std::make_unique<Attachment>(GTK_PICTURE(handle),context,std::move(releaser));
    detach();attachment=std::move(next);
    {std::lock_guard lock(mutex);attached=true;pixelsWide=width;pixelsHigh=height;}
    gtk_picture_set_content_fit(attachment->picture,GTK_CONTENT_FIT_FILL);
    requestRedraw();
  }
  void resize(int width,int height) override {
    requireOwner();validateSize(width,height);
    {std::lock_guard lock(mutex);pixelsWide=width;pixelsHigh=height;}
    if(attachment && (!width || !height))gtk_picture_set_paintable(attachment->picture,nullptr);
    requestRedraw();
  }
  void detach() override {
    requireOwner();
    {std::lock_guard lock(mutex);attached=false;pixelsWide=0;pixelsHigh=0;}
    attachment.reset();
  }
  bool isAttached() const override {std::lock_guard lock(mutex);return attached;}
  int getWidth() override {std::lock_guard lock(mutex);return attached?pixelsWide:0;}
  int getHeight() override {std::lock_guard lock(mutex);return attached?pixelsHigh:0;}
  void setLayoutSize(int width,int height) override {std::lock_guard lock(mutex);layoutWide=width;layoutHigh=height;}
  bool getLayoutSize(int* width,int* height) override {
    std::lock_guard lock(mutex);if(layoutWide<=0 || layoutHigh<=0)return false;*width=layoutWide;*height=layoutHigh;return true;
  }
  void setRequestRedraw(std::function<void()> callback) override {std::lock_guard lock(mutex);redraw=std::move(callback);}
  void setCanPresent(std::function<bool()> callback) override {std::lock_guard lock(mutex);visible=std::move(callback);}
  bool getTargetInfo(RNSkGraphiteTargetInfo* target) override {
    std::lock_guard lock(mutex);if(!target || !attached || pixelsWide<=0 || pixelsHigh<=0)return false;
    target->width=pixelsWide;target->height=pixelsHigh;target->colorType=kBGRA_8888_SkColorType;target->useP3ColorSpace=false;
    skgpu::graphite::VulkanTextureInfo info;info.fFormat=VK_FORMAT_B8G8R8A8_UNORM;
    info.fImageUsageFlags=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_SAMPLED_BIT|VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT|
      VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;
    target->textureInfo=skgpu::graphite::TextureInfos::MakeVulkan(info);return true;
  }
  bool presentRecordings(const std::vector<skgpu::graphite::Recording*>& recordings) override {
    requireOwner();if(!canPresent())return false;
    auto frame=context->exportDmaBufFrame(getWidth(),getHeight(),{},recordings);publish(std::move(frame));return true;
  }
  bool presentImage(const sk_sp<SkImage>& image) override {
    requireOwner();if(!image)throw std::runtime_error("Linux presentation requires an image");if(!canPresent())return false;
    auto frame=context->exportDmaBufFrame(getWidth(),getHeight(),[&](SkCanvas* canvas){canvas->clear(SK_ColorTRANSPARENT);canvas->drawImage(image,0,0);});
    publish(std::move(frame));return true;
  }
private:
  void requireOwner() const {if(std::this_thread::get_id()!=owner)throw std::runtime_error("Linux presentation requires its GTK owner");}
  static void validateSize(int width,int height) {if(width<0 || height<0 || width>4096 || height>4096)throw std::runtime_error("Linux DMA-BUF surface size exceeds admission");}
  void requestRedraw() {std::function<void()> callback;{std::lock_guard lock(mutex);callback=redraw;}if(callback)callback();}
  bool canPresent() {
    if(!attachment || !getWidth() || !getHeight() || !gtk_widget_get_mapped(GTK_WIDGET(attachment->picture)))return false;
    std::function<bool()> callback;{std::lock_guard lock(mutex);callback=visible;}
    if(callback && !callback())return false;
    // At most three immutable frames. Return before consuming a recording;
    // the owning frame scheduler retries while GTK retires an older texture.
    return context->canExportDmaBufFrame();
  }
  void publish(std::shared_ptr<const nelyx::vulkan::DmaBufFrame> frame) {
    auto* texture=importLinuxDmaBufTexture(gtk_widget_get_display(GTK_WIDGET(attachment->picture)),std::move(frame));
    gtk_picture_set_paintable(attachment->picture,GDK_PAINTABLE(texture));g_object_unref(texture);
  }
  std::shared_ptr<RNSkVulkanPlatformContext> context;
  const std::thread::id owner;
  std::unique_ptr<Attachment> attachment;
  mutable std::mutex mutex;
  bool attached=false;
  int pixelsWide=0,pixelsHigh=0,layoutWide=0,layoutHigh=0;
  std::function<void()> redraw;
  std::function<bool()> visible;
};
}
