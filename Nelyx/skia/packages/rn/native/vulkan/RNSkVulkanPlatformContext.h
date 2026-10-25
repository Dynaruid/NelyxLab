// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <functional>
#include <memory>
#include <mutex>
#include <thread>
#include "rnskia/RNSkPlatformContext.h"
#include "gpu_context.h"

namespace RNSkia {
// The host supplies actual UI/stream/font/view services and its CallInvoker.
// This adapter owns only native Vulkan composition; it never creates a window
// or runtime, nor selects a Dawn/raster fallback when the device is unavailable.
struct VulkanPlatformServices {
  std::function<void(std::function<void()>)> dispatchToMain;
  std::function<void(const std::string&,
    const std::function<void(std::unique_ptr<SkStreamAsset>)>&)> stream;
  std::function<sk_sp<SkFontMgr>()> fontManager;
  std::function<sk_sp<SkImage>(size_t)> screenshot;
  std::function<void(const std::exception&)> reportError;
  std::function<std::shared_ptr<nelyx::vulkan::Device>()> createDevice;
  // A host can keep JSI captures on its actual JS owner and give workers
  // native-only completion tokens. Existing hosts retain their own policy.
  std::function<RNSkAsyncCompletion(RNSkAsyncCompletion)> makeAsyncCompletion;
};
class RNSkVulkanPlatformContext final : public RNSkPlatformContext {
public:
  RNSkVulkanPlatformContext(std::shared_ptr<nelyx::host::RuntimeScheduler>,
    float pixelDensity, VulkanPlatformServices);
  ~RNSkVulkanPlatformContext() override;
  nelyx::gpu::Context& getGpuContext() override;
  void configureGpuPolicy(bool allowSoftware) override;
  RNSkAsyncCompletion makeAsyncCompletion(RNSkAsyncCompletion callback) override {
    return services.makeAsyncCompletion ? services.makeAsyncCompletion(std::move(callback)) :
        RNSkPlatformContext::makeAsyncCompletion(std::move(callback));
  }
  void runOnMainThread(std::function<void()>) override;
  void performStreamOperation(const std::string&,
    const std::function<void(std::unique_ptr<SkStreamAsset>)>&) override;
  sk_sp<SkFontMgr> createFontMgr() override;
  sk_sp<SkImage> takeScreenshotFromViewTag(size_t) override;
  void raiseError(const std::exception&) override;
  sk_sp<SkSurface> makeOffscreenSurface(int,int,bool = false) override;
  // Host calls on the device creator thread after view/recording/asset drain.
  // Failure retains the context/device and keeps admission closed.
  void close();
  // Presentation may not lazily create a device on the GTK thread. The host
  // initializes its DMA-BUF-enabled GPU on the JS owner before view admission.
  bool canExportDmaBufFrame();
  bool canImportWin32Texture();
  std::shared_ptr<const nelyx::vulkan::Win32Frame> renderWin32Frame(nelyx::vulkan::Win32TextureTarget,
    std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings={});
  std::shared_ptr<const nelyx::vulkan::DmaBufFrame> exportDmaBufFrame(uint32_t,uint32_t,
    const std::function<void(SkCanvas*)>&,
    const std::vector<skgpu::graphite::Recording*>& = {});
private:
  VulkanPlatformServices services;
  std::mutex mutex;
  bool configured=false,closing=false,closed=false;
  std::thread::id deviceOwner;
  std::shared_ptr<nelyx::vulkan::Device> device;
  std::unique_ptr<nelyx::vulkan::GpuContext> gpu;
};
}
