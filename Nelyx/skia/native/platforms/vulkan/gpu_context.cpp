// SPDX-License-Identifier: BSD-3-Clause
#include "gpu_context.h"
#include <mutex>
#include <atomic>
#include <thread>
#include <unordered_map>
#include "include/core/SkData.h"
#include "include/gpu/graphite/Context.h"
#include "include/gpu/graphite/Image.h"
#include "include/gpu/graphite/ImageProvider.h"
#include "include/gpu/graphite/Surface.h"
#include "include/gpu/graphite/vk/VulkanGraphiteTypes.h"

namespace nelyx::vulkan {
// Recorder-local upload policy. Native recording admission and the recorder's
// byte budget bound retention; no process-global image cache or other backend.
class UploadProvider final : public skgpu::graphite::ImageProvider {
  sk_sp<SkImage> findOrCreate(skgpu::graphite::Recorder* recorder, const SkImage* image,
      SkImage::RequiredProperties properties) override {
    return SkImages::TextureFromImage(recorder, image, properties);
  }
};
struct GpuContext::Impl {
  std::shared_ptr<Device> device;
  std::mutex mutex;
  std::thread::id owner = std::this_thread::get_id();
  std::unordered_map<std::thread::id, std::unique_ptr<skgpu::graphite::Recorder>> offscreenRecorders;
  bool closed = false;
  skgpu::graphite::Context* context() {
    if (closed) throw std::runtime_error("Native Vulkan Graphite context is closed");
    return device->context();
  }
};
GpuContext::GpuContext(std::shared_ptr<Device> device) : impl(std::make_unique<Impl>()) {
  if (!device) throw std::runtime_error("Native Vulkan device owner is required");
  impl->device = std::move(device);
  if (impl->context()->backend() != skgpu::BackendApi::kVulkan)
    throw std::runtime_error("Native Vulkan Graphite backend is required");
}
GpuContext::~GpuContext() = default;
std::unique_ptr<skgpu::graphite::Recorder> GpuContext::makeRecorder() {
  std::lock_guard lock(impl->mutex);
  skgpu::graphite::RecorderOptions options;
  options.fGpuBudgetInBytes = 32 * 1024 * 1024;
  options.fImageProvider = sk_make_sp<UploadProvider>();
  auto recorder = impl->context()->makeRecorder(options);
  if (!recorder) throw std::runtime_error("Native Vulkan Graphite recorder unavailable");
  return recorder;
}
void GpuContext::submitRecording(skgpu::graphite::Recording* recording, skgpu::graphite::SyncToCpu sync) {
  if (!recording) throw std::runtime_error("Cannot submit a null Graphite recording");
  std::lock_guard lock(impl->mutex);
  skgpu::graphite::InsertRecordingInfo insert;
  insert.fRecording = recording;
  if (!impl->context()->insertRecording(insert))
    throw std::runtime_error("Native Vulkan Graphite recording rejected");
  if (!impl->context()->submit(sync))
    throw std::runtime_error("Native Vulkan Graphite submission unconfirmed; owners must be retained");
}
bool GpuContext::insertRecordings(const std::vector<skgpu::graphite::Recording*>& recordings, SkSurface* target) {
  if (!target) throw std::runtime_error("Graphite replay target is required");
  std::lock_guard lock(impl->mutex);
  bool accepted = true;
  for (auto* recording : recordings) {
    if (!recording) throw std::runtime_error("Cannot replay a null Graphite recording");
    skgpu::graphite::InsertRecordingInfo insert;
    insert.fRecording = recording;
    insert.fTargetSurface = target;
    if (!impl->context()->insertRecording(insert)) accepted = false;
  }
  if (!impl->context()->submit())
    throw std::runtime_error("Native Vulkan Graphite replay completion unknown; owners must be retained");
  return accepted;
}
bool GpuContext::retireWork() {
  std::lock_guard lock(impl->mutex);
  impl->context();
  try {
    impl->device->retire();
    return !impl->context()->hasUnfinishedGpuWork();
  } catch (...) { return false; }
}
sk_sp<SkSurface> GpuContext::MakeOffscreen(int width, int height, bool p3) {
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || static_cast<uint64_t>(width)*height>16*1024*1024)
    throw std::runtime_error("Native Vulkan surface dimensions exceed admission limits");
  std::lock_guard lock(impl->mutex);
  auto* context = impl->context();
  const auto thread = std::this_thread::get_id();
  if (!impl->offscreenRecorders.contains(thread) && impl->offscreenRecorders.size() >= 8)
    throw std::runtime_error("Native Vulkan offscreen recorder owner limit reached");
  auto& recorder = impl->offscreenRecorders[thread];
  if (!recorder) {
    skgpu::graphite::RecorderOptions options;
    options.fGpuBudgetInBytes = 32 * 1024 * 1024;
    options.fImageProvider = sk_make_sp<UploadProvider>();
    recorder = context->makeRecorder(options);
  }
  auto info = SkImageInfo::Make(width, height, targetColorType(false), kPremul_SkAlphaType, viewColorSpace(p3));
  auto surface = recorder ? SkSurfaces::RenderTarget(recorder.get(), info) : nullptr;
  if (!surface) throw std::runtime_error("Native Vulkan offscreen surface unavailable");
  return surface;
}
sk_sp<SkImage> GpuContext::MakeRasterImage(sk_sp<SkImage> image) {
  if (!image) throw std::runtime_error("Snapshot image is required");
  if (!image->isTextureBacked()) return image;
  std::lock_guard lock(impl->mutex);
  struct Result {
    std::atomic<bool> called{false};
    std::unique_ptr<const SkImage::AsyncReadResult> pixels;
  };
  auto result = std::make_shared<Result>();
  // Callback ownership survives an unconfirmed submit. Never leave a stack
  // address with the GPU; its context retains the outstanding read operation.
  auto* completion = new std::shared_ptr<Result>(result);
  impl->context()->asyncRescaleAndReadPixels(image.get(), image->imageInfo(), image->imageInfo().bounds(),
    SkImage::RescaleGamma::kSrc, SkImage::RescaleMode::kNearest,
    [](void* pointer, std::unique_ptr<const SkImage::AsyncReadResult> pixels) {
      std::unique_ptr<std::shared_ptr<Result>> hold(static_cast<std::shared_ptr<Result>*>(pointer));
      (*hold)->pixels = std::move(pixels);
      (*hold)->called.store(true, std::memory_order_release);
    }, completion);
  if (!impl->context()->submit(skgpu::graphite::SyncToCpu::kYes))
    throw std::runtime_error("Native Vulkan snapshot completion unconfirmed");
  impl->context()->checkAsyncWorkCompletion();
  if (!result->called.load(std::memory_order_acquire) || !result->pixels)
    throw std::runtime_error("Native Vulkan snapshot pixels unavailable");
  const auto stride = result->pixels->rowBytes(0);
  auto data = SkData::MakeWithCopy(result->pixels->data(0), stride * image->height());
  return SkImages::RasterFromData(image->imageInfo(), std::move(data), stride);
}
SkColorType GpuContext::targetColorType(bool highBitDepth) const {
  return highBitDepth ? kRGBA_F16_SkColorType : kBGRA_8888_SkColorType;
}
skgpu::graphite::TextureInfo GpuContext::textureInfo(SkColorType type) const {
  skgpu::graphite::VulkanTextureInfo info;
  switch (type) {
    case kBGRA_8888_SkColorType: info.fFormat = VK_FORMAT_B8G8R8A8_UNORM; break;
    case kRGBA_8888_SkColorType: info.fFormat = VK_FORMAT_R8G8B8A8_UNORM; break;
    case kRGBA_F16_SkColorType: info.fFormat = VK_FORMAT_R16G16B16A16_SFLOAT; break;
    default: throw std::runtime_error("Unsupported native Vulkan Graphite color type");
  }
  info.fImageUsageFlags = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT
    | VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT;
  return skgpu::graphite::TextureInfos::MakeVulkan(info);
}
void GpuContext::close() {
  if (std::this_thread::get_id() != impl->owner)
    throw std::runtime_error("Native Vulkan context close requires its creator thread");
  std::lock_guard lock(impl->mutex);
  if (impl->closed) return;
  impl->device->retire();
  impl->offscreenRecorders.clear();
  impl->device->drain();
  impl->closed = true;
}
std::shared_ptr<const DmaBufFrame> GpuContext::exportDmaBufFrame(uint32_t width,uint32_t height,
    const std::function<void(SkCanvas*)>& draw,const std::vector<skgpu::graphite::Recording*>& recordings) {
  std::lock_guard lock(impl->mutex);
  skgpu::graphite::RecorderOptions options;
  options.fGpuBudgetInBytes=32*1024*1024;
  options.fImageProvider=sk_make_sp<UploadProvider>();
  return impl->device->exportDmaBufFrame(impl->context()->makeRecorder(options),width,height,draw,recordings);
}
bool GpuContext::canExportDmaBufFrame() {std::lock_guard lock(impl->mutex);impl->context();return impl->device->canExportDmaBufFrame();}
std::shared_ptr<const Win32Frame> GpuContext::renderWin32Frame(Win32TextureTarget target,std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings) {
  std::shared_ptr<const Win32Frame> frame;
  {
    std::lock_guard lock(impl->mutex);
    skgpu::graphite::RecorderOptions options;options.fGpuBudgetInBytes=32*1024*1024;
    options.fImageProvider=sk_make_sp<UploadProvider>();
    frame=impl->device->renderWin32Frame(impl->context()->makeRecorder(options),target,std::move(draw),recordings,true);
  }
  // GPU latency must not hold up JS recorder/resource work on this Context.
  frame->awaitProducer();
  {std::lock_guard lock(impl->mutex);frame->finishProducer();}
  return frame;
}
}
