// SPDX-License-Identifier: BSD-3-Clause
#include "RNSkVulkanPlatformContext.h"
#include <cmath>
#include <stdexcept>
#include "include/codec/SkWebpDecoder.h"
#include "include/gpu/vk/VulkanTypes.h"

namespace RNSkia {
RNSkVulkanPlatformContext::RNSkVulkanPlatformContext(
    std::shared_ptr<nelyx::host::RuntimeScheduler> invoker, float density, VulkanPlatformServices ports)
    : RNSkPlatformContext(invoker,density),services(std::move(ports)) {
  if(!invoker || !std::isfinite(density) || density<=0 || density>8 || !services.dispatchToMain
    || !services.stream || !services.fontManager || !services.screenshot || !services.reportError || !services.createDevice)
    throw std::runtime_error("Complete native Vulkan platform services and CallInvoker are required");
  // The fixed Vulkan core omits WebP. Register the matching explicit CPU
  // supplement once after the core has initialized its other decoder entries.
  static std::once_flag codecs;
  std::call_once(codecs, [] { SkCodecs::Register(SkWebpDecoder::Decoder()); });
}
RNSkVulkanPlatformContext::~RNSkVulkanPlatformContext() = default;
void RNSkVulkanPlatformContext::configureGpuPolicy(bool allowSoftware) {
  std::lock_guard lock(mutex);
  if(closing || closed)throw std::runtime_error("Native Vulkan platform is closing");
  if(allowSoftware)throw std::runtime_error("Native Vulkan requires a hardware adapter; no software fallback");
  configured=true;
}
nelyx::gpu::Context& RNSkVulkanPlatformContext::getGpuContext() {
  std::lock_guard lock(mutex);
  if(closing || closed)throw std::runtime_error("Native Vulkan platform is closing");
  if(!configured)throw std::runtime_error("Configure native Vulkan policy before GPU initialization");
  if(!gpu) {
    deviceOwner=std::this_thread::get_id();
    try {
      device=services.createDevice();
      if(!device || device->deviceType()==VK_PHYSICAL_DEVICE_TYPE_CPU)
        throw std::runtime_error("Native Vulkan factory must provide a hardware device");
      gpu=std::make_unique<nelyx::vulkan::GpuContext>(device);
    } catch(...) {closing=true;throw;} // Never retry uncertain initialization.
  }
  return *gpu;
}
void RNSkVulkanPlatformContext::runOnMainThread(std::function<void()> task) {services.dispatchToMain(std::move(task));}
void RNSkVulkanPlatformContext::performStreamOperation(const std::string& uri,
    const std::function<void(std::unique_ptr<SkStreamAsset>)>& callback) {services.stream(uri,callback);}
sk_sp<SkFontMgr> RNSkVulkanPlatformContext::createFontMgr() {
  auto manager=services.fontManager();if(!manager)throw std::runtime_error("Native font manager unavailable");return manager;
}
sk_sp<SkImage> RNSkVulkanPlatformContext::takeScreenshotFromViewTag(size_t tag) {return services.screenshot(tag);}
void RNSkVulkanPlatformContext::raiseError(const std::exception& error) {services.reportError(error);}
sk_sp<SkSurface> RNSkVulkanPlatformContext::makeOffscreenSurface(int width,int height,bool p3) {
  return getGpuContext().MakeOffscreen(width,height,p3);
}
void RNSkVulkanPlatformContext::close() {
  std::lock_guard lock(mutex);
  if(closed)return;
  closing=true;
  if(device && deviceOwner!=std::this_thread::get_id())
    throw std::runtime_error("Native Vulkan platform close requires its device creator thread");
  if(gpu)gpu->close();
  else if(device)device->drain();
  // Recorder wrappers retain this platform until their Skia shared-context
  // dies. Keep its drained native device alive for that final destruction.
  gpu.reset();closed=true;
}
bool RNSkVulkanPlatformContext::canExportDmaBufFrame() {
  std::lock_guard lock(mutex);
  if(closing || closed || !gpu)throw std::runtime_error("Initialize the DMA-BUF GPU on the JS owner before admitting GTK presentation");
  return gpu->canExportDmaBufFrame();
}
bool RNSkVulkanPlatformContext::canImportWin32Texture() {
  std::lock_guard lock(mutex);
  if(closing || closed || !gpu)throw std::runtime_error("Initialize the Windows import GPU on the JS owner before presentation");
  return device->canImportWin32Texture();
}
std::shared_ptr<const nelyx::vulkan::Win32Frame> RNSkVulkanPlatformContext::renderWin32Frame(
    nelyx::vulkan::Win32TextureTarget target,std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings) {
  std::lock_guard lock(mutex);
  if(closing || closed || !gpu)throw std::runtime_error("Windows import requires its live initialized GPU owner");
  return gpu->renderWin32Frame(target,std::move(draw),recordings);
}
std::shared_ptr<const nelyx::vulkan::DmaBufFrame> RNSkVulkanPlatformContext::exportDmaBufFrame(
    uint32_t width,uint32_t height,const std::function<void(SkCanvas*)>& draw,
    const std::vector<skgpu::graphite::Recording*>& recordings) {
  std::lock_guard lock(mutex);
  if(closing || closed || !gpu)throw std::runtime_error("Native Vulkan presentation requires its live initialized GPU owner");
  return gpu->exportDmaBufFrame(width,height,draw,recordings);
}
}
