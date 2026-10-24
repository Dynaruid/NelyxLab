// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <cstdint>
#include <memory>
#include <stdexcept>
#include <vector>
#include "include/core/SkColorSpace.h"
#include "include/core/SkColorType.h"
#include "include/core/SkImage.h"
#include "include/core/SkSurface.h"
#include "include/gpu/graphite/Recorder.h"
#include "include/gpu/graphite/Recording.h"
#include "include/gpu/graphite/TextureInfo.h"

namespace nelyx::gpu {
// Graphite recording/replay contract. No RN, window, Dawn or Vulkan headers.
// The platform owns device selection and lifetime. Recorders and images must
// be released before checked device close; false retirement retains owners.
class Context {
public:
  virtual ~Context() = default;
  virtual std::unique_ptr<skgpu::graphite::Recorder> makeRecorder() = 0;
  virtual void submitRecording(skgpu::graphite::Recording*,
      skgpu::graphite::SyncToCpu = skgpu::graphite::SyncToCpu::kNo) = 0;
  virtual bool insertRecordings(const std::vector<skgpu::graphite::Recording*>&,
      SkSurface*) = 0;
  virtual bool retireWork() = 0;
  virtual sk_sp<SkImage> MakeRasterImage(sk_sp<SkImage>) = 0;
  virtual sk_sp<SkSurface> MakeOffscreen(int, int, bool = false) = 0;
  virtual SkColorType targetColorType(bool highBitDepth) const = 0;
  virtual skgpu::graphite::TextureInfo textureInfo(SkColorType) const = 0;

  // Optional Dawn/WebGPU interop. These opaque borrowed handles are never
  // interpreted by generic JSI code or a native Vulkan backend. A successful
  // exportTexture transfers one native reference to its adopting consumer.
  virtual uint64_t webGpuDevice() { return unsupportedInterop(); }
  virtual sk_sp<SkImage> importTexture(uint64_t) { unsupportedInterop(); return nullptr; }
  virtual sk_sp<SkSurface> importSurface(uint64_t) { unsupportedInterop(); return nullptr; }
  virtual uint64_t exportTexture(sk_sp<SkImage>) { return unsupportedInterop(); }
  static sk_sp<SkColorSpace> viewColorSpace(bool p3) {
    return p3 ? SkColorSpace::MakeRGB(SkNamedTransferFn::kSRGB, SkNamedGamut::kDisplayP3)
              : SkColorSpace::MakeSRGB();
  }
private:
  [[noreturn]] static uint64_t unsupportedInterop() {
    throw std::runtime_error("WebGPU texture interop is unavailable on this Graphite backend");
  }
};
}
