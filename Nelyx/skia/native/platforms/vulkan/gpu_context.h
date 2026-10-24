// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "nelyx_skia/gpu_context.h"
#include "device.h"

namespace nelyx::vulkan {
// One existing native Vulkan device, never a second Skia/Dawn instance.
// Context operations are serialized; each producer receives its own Recorder.
// Release all external recorders/surfaces/images before close on the creator
// thread. RN wrappers retain their platform owner for that entire lifetime.
class GpuContext final : public nelyx::gpu::Context {
public:
  explicit GpuContext(std::shared_ptr<Device>);
  ~GpuContext() override;
  std::unique_ptr<skgpu::graphite::Recorder> makeRecorder() override;
  void submitRecording(skgpu::graphite::Recording*,
      skgpu::graphite::SyncToCpu = skgpu::graphite::SyncToCpu::kNo) override;
  bool insertRecordings(const std::vector<skgpu::graphite::Recording*>&, SkSurface*) override;
  bool retireWork() override;
  sk_sp<SkImage> MakeRasterImage(sk_sp<SkImage>) override;
  sk_sp<SkSurface> MakeOffscreen(int, int, bool = false) override;
  SkColorType targetColorType(bool) const override;
  skgpu::graphite::TextureInfo textureInfo(SkColorType) const override;
  std::shared_ptr<const DmaBufFrame> exportDmaBufFrame(uint32_t width,uint32_t height,
    const std::function<void(SkCanvas*)>& draw,const std::vector<skgpu::graphite::Recording*>& recordings={});
  bool canExportDmaBufFrame();
  std::shared_ptr<const Win32Frame> renderWin32Frame(Win32TextureTarget,std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings={});
  void close();
private:
  struct Impl;
  std::unique_ptr<Impl> impl;
};
}
