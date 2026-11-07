// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../common/skia_provider.hpp"
#include "frame_clock.hpp"
#include "../../../skia/native/platforms/vulkan/device.h"
namespace nelyx::v2::windows {
using namespace ::nelyx::v2::native;
class UploadProvider final : public skgpu::graphite::ImageProvider {
  sk_sp<SkImage> findOrCreate(skgpu::graphite::Recorder* recorder,const SkImage* image,SkImage::RequiredProperties properties) override {
    return SkImages::TextureFromImage(recorder,image,properties);
  }
};
class RenderProvider {
  std::shared_ptr<Ledger> ledger;
  std::unique_ptr<ExternalLease> cacheMemory,backingMemory;
  std::shared_ptr<nelyx::vulkan::Device> device;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface;
  uint32_t width=0,height=0;
 public:
  uint64_t draws=0;
  NativePaintCounts paintCounts;
  double recordAndBackingElapsedMs=0,submitElapsedMs=0;
  RenderProvider(uint64_t window,uint32_t uiThread,std::shared_ptr<Ledger> book):ledger(std::move(book)) {
    cacheMemory=std::make_unique<ExternalLease>(ledger,2,3,32*1024*1024);
    device=std::make_shared<nelyx::vulkan::Device>(nelyx::vulkan::WindowTarget{nelyx::vulkan::WindowKind::Win32,0,window,uiThread});
    skgpu::graphite::RecorderOptions options;options.fGpuBudgetInBytes=32*1024*1024;options.fImageProvider=sk_make_sp<UploadProvider>();
    recorder=device->context()->makeRecorder(options);if(!recorder)throw std::runtime_error("Vulkan Graphite recorder unavailable");
  }
  std::string driver()const{return device->description();}
  void setMemoryPressure(bool low) {
    const size_t budget=(low?4:32)*1024*1024;
    recorder->setMaxBudgetedBytes(budget);device->context()->setMaxBudgetedBytes(budget);
    if(low){recorder->freeGpuResources();device->context()->freeGpuResources();}
    // Keep the conservative GPU reservation: in-use resources and driver
    // allocations are not proven to disappear when a cache limit is reduced.
  }
  bool draw(const Frame& frame,const Prepared& prepared) {
    try {
    const auto started=qpcSeconds();
    const auto scale=frame.scene->metrics.scale;
    const auto w=uint32_t(std::llround(frame.scene->metrics.width*scale)),h=uint32_t(std::llround(frame.scene->metrics.height*scale));
    if(!w||!h)return false;
    if(w>8192||h>8192||uint64_t(w)*h>16*1024*1024)throw std::runtime_error("Native surface size budget exceeded");
    if(w!=width||h!=height){
      auto nextMemory=std::make_unique<ExternalLease>(ledger,2,3,uint64_t(w)*h*12);
      surface.reset();device->resizeWindow(recorder.get(),w,h);
      surface=SkSurfaces::RenderTarget(recorder.get(),SkImageInfo::Make(w,h,kRGBA_8888_SkColorType,kPremul_SkAlphaType));
      if(!surface)throw std::runtime_error("Native GPU surface unavailable");width=w;height=h;backingMemory=std::move(nextMemory);
    }
    uint64_t pathBytes=0,layerBytes=0;for(const auto& item:frame.items){const auto& n=frame.scene->document->get(item.node);
      if(item.paint)pathBytes+=item.paint->paths.size()*256+1024;
      if(frame.properties[n.id.slot].opacity<1||n.graphics.blur>0)layerBytes+=uint64_t(w)*h*4*(n.graphics.blur>0?3:1);
      if(item.flags&wire::nodeFlags::clipSaveLayer)layerBytes+=uint64_t(w)*h*4;}
    ExternalLease pathMemory(ledger,2,2,pathBytes);
    ExternalLease layers(ledger,2,3,layerBytes);
    drawPreparedFrame(surface->getCanvas(),frame,prepared,scale,paintCounts);
    const auto recorded=qpcSeconds();recordAndBackingElapsedMs=(recorded-started)*1000;
    device->present(recorder.get(),surface.get());submitElapsedMs=(qpcSeconds()-recorded)*1000;++draws;return true;
    }catch(const nelyx::vulkan::SurfaceChanged&){
      surface.reset();device->releaseWindow(recorder.get());backingMemory.reset();width=height=0;return false;
    }
  }
  void close(){if(!device)return;device->retire();surface.reset();device->releaseWindow(recorder.get());recorder.reset();device->drain();device.reset();backingMemory.reset();cacheMemory.reset();}
  ~RenderProvider(){try{close();}catch(...){device.reset();}}
};
}
