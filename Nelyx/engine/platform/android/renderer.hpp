// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../common/skia_provider.hpp"
#include <android/native_window.h>
#include <android/log.h>
#include "dawn/native/DawnNative.h"
#include "include/gpu/graphite/dawn/DawnBackendContext.h"
#include "include/gpu/graphite/dawn/DawnGraphiteTypes.h"
#include "include/gpu/graphite/Recording.h"
#include "include/gpu/graphite/ContextOptions.h"
#include "include/gpu/graphite/BackendTexture.h"
#include <atomic>

namespace nelyx::v2::android {
class RecoverableGpuLoss final:public std::runtime_error {public:using std::runtime_error::runtime_error;};
class UploadProvider final:public skgpu::graphite::ImageProvider {
  sk_sp<SkImage> findOrCreate(skgpu::graphite::Recorder* recorder,const SkImage* image,SkImage::RequiredProperties properties)override{return SkImages::TextureFromImage(recorder,image,properties);}
};
/** All Dawn/Graphite objects and ANativeWindow use belong to the Render owner. */
class Renderer {
  struct CallbackState {std::atomic<bool> lost{false},error{false},closing{false};};
  // Declared before device/instance: userdata outlives them on constructor unwind too.
  const std::shared_ptr<CallbackState> callbacks=std::make_shared<CallbackState>();
  std::shared_ptr<Ledger> ledger;
  native::SnapshotImages snapshots;
  std::unique_ptr<ExternalLease> cacheMemory,backingMemory;
  std::unique_ptr<dawn::native::Instance> instance;
  skgpu::graphite::DawnBackendContext backend;
  std::unique_ptr<skgpu::graphite::Context> context;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  wgpu::Surface surface;
  ANativeWindow* attachedWindow=nullptr;
  uint32_t width=0,height=0;
  void check(){if(callbacks->lost)throw RecoverableGpuLoss("Android Dawn device lost");if(callbacks->error)throw std::runtime_error("Android Dawn validation/submission error");}
  void drain(){check();if(context&&!context->submit(skgpu::graphite::SyncToCpu::kYes)){check();throw RecoverableGpuLoss("Android Graphite context lost during drain");}check();}
 public:
  uint64_t draws=0;
  native::NativePaintCounts paintCounts;
  Renderer(const std::shared_ptr<Ledger>& ledger,bool emulator):ledger(ledger){
    cacheMemory=std::make_unique<ExternalLease>(ledger,2,3,32*1024*1024);
    const auto wait=wgpu::InstanceFeatureName::TimedWaitAny;
    wgpu::InstanceLimits limits;limits.timedWaitAnyMaxCount=64;
    wgpu::InstanceDescriptor options;options.requiredFeatureCount=1;options.requiredFeatures=&wait;options.requiredLimits=&limits;
    instance=std::make_unique<dawn::native::Instance>(&options);
    wgpu::RequestAdapterOptions request;request.backendType=wgpu::BackendType::Vulkan;request.featureLevel=wgpu::FeatureLevel::Core;
    const auto adapters=instance->EnumerateAdapters(&request);
    dawn::native::Adapter selected;
    for(const auto& candidate:adapters){wgpu::Adapter adapter(candidate.Get());wgpu::AdapterInfo info;adapter.GetInfo(&info);
      const bool hardware=info.adapterType==wgpu::AdapterType::DiscreteGPU||info.adapterType==wgpu::AdapterType::IntegratedGPU;
      if(info.backendType==wgpu::BackendType::Vulkan&&(hardware||emulator)){selected=candidate;break;}}
    if(!selected)throw std::runtime_error("Android Vulkan adapter unavailable; software requires the explicit emulator profile");
    wgpu::Adapter adapter(selected.Get());std::vector<wgpu::FeatureName> features;
    for(const auto feature:{wgpu::FeatureName::DualSourceBlending,wgpu::FeatureName::MSAARenderToSingleSampled,wgpu::FeatureName::DawnLoadResolveTexture,wgpu::FeatureName::DawnPartialLoadResolveTexture,wgpu::FeatureName::Unorm16TextureFormats,wgpu::FeatureName::ImplicitDeviceSynchronization})if(adapter.HasFeature(feature))features.push_back(feature);
    wgpu::DeviceDescriptor device;device.requiredFeatureCount=features.size();device.requiredFeatures=features.data();
    device.SetDeviceLostCallback(wgpu::CallbackMode::AllowSpontaneous,[state=callbacks](const wgpu::Device&,wgpu::DeviceLostReason reason,wgpu::StringView){if(!state->closing&&reason!=wgpu::DeviceLostReason::Destroyed)state->lost=true;});
    device.SetUncapturedErrorCallback([](const wgpu::Device&,wgpu::ErrorType,wgpu::StringView message,CallbackState* state){if(!state->closing)state->error=true;__android_log_print(ANDROID_LOG_ERROR,"NelyxV2","Dawn: %.*s",int(message.length),message.data);},callbacks.get());
    backend.fInstance=wgpu::Instance(instance->Get());backend.fDevice=wgpu::Device::Acquire(selected.CreateDevice(&device));
    if(!backend.fDevice)throw std::runtime_error("Android Dawn device initialization failed");
    backend.fQueue=backend.fDevice.GetQueue();
    skgpu::graphite::ContextOptions graphite;graphite.fGpuBudgetInBytes=32*1024*1024;
    context=skgpu::graphite::ContextFactory::MakeDawn(backend,graphite);
    if(!context)throw std::runtime_error("Android Graphite context unavailable");
    skgpu::graphite::RecorderOptions recording;recording.fGpuBudgetInBytes=32*1024*1024;recording.fImageProvider=sk_make_sp<UploadProvider>();
    recorder=context->makeRecorder(recording);if(!recorder)throw std::runtime_error("Android Graphite recorder unavailable");
    wgpu::AdapterInfo info;adapter.GetInfo(&info);__android_log_print(ANDROID_LOG_INFO,"NelyxV2","V2_ANDROID_GPU {\"backend\":\"Dawn-Vulkan\",\"emulator\":%s,\"adapterType\":%d,\"device\":\"%.*s\"}",emulator?"true":"false",int(info.adapterType),int(info.device.length),info.device.data);
  }
  void detach(){if(surface){drain();surface.Unconfigure();surface=nullptr;}attachedWindow=nullptr;backingMemory.reset();width=height=0;}
  // Qualification uses Dawn's actual device-loss path, on the Render owner.
  void forceLoss(){backend.fDevice.ForceLoss(wgpu::DeviceLostReason::Unknown,"Nelyx emulator recovery qualification");check();}
  void attach(ANativeWindow* window,uint32_t w,uint32_t h){
    if(!window){detach();return;}
    if(!w||!h||w>8192||h>8192||uint64_t(w)*h>16*1024*1024)throw std::runtime_error("Android surface exceeds the declared budget");
    if(surface&&attachedWindow==window){drain();backingMemory.reset();}
    else {detach();wgpu::SurfaceSourceAndroidNativeWindow source;source.window=window;wgpu::SurfaceDescriptor descriptor;descriptor.nextInChain=&source;surface=backend.fInstance.CreateSurface(&descriptor);if(!surface)throw std::runtime_error("Android native surface creation failed");attachedWindow=window;}
    backingMemory=std::make_unique<ExternalLease>(ledger,2,3,uint64_t(w)*h*12);
    wgpu::SurfaceCapabilities caps;if(surface.GetCapabilities(backend.fDevice.GetAdapter(),&caps)!=wgpu::Status::Success)throw std::runtime_error("Android surface capabilities unavailable");
    if(std::find(caps.formats,caps.formats+caps.formatCount,wgpu::TextureFormat::RGBA8Unorm)==caps.formats+caps.formatCount)throw std::runtime_error("Android RGBA8 surface unavailable");
    wgpu::SurfaceConfiguration config;config.device=backend.fDevice;config.format=wgpu::TextureFormat::RGBA8Unorm;config.width=w;config.height=h;config.presentMode=wgpu::PresentMode::Fifo;config.usage=wgpu::TextureUsage::RenderAttachment;
    for(const auto extra:{wgpu::TextureUsage::TextureBinding,wgpu::TextureUsage::CopySrc})if(caps.usages&extra)config.usage|=extra;
    surface.Configure(&config);width=w;height=h;
  }
  bool draw(const Frame& frame,const native::Prepared& prepared){
    check();
    if(!surface)return false;
    const auto scale=frame.scene->metrics.scale;
    if(uint32_t(std::llround(frame.scene->metrics.width*scale))!=width||uint32_t(std::llround(frame.scene->metrics.height*scale))!=height)return false;
    wgpu::SurfaceTexture texture;surface.GetCurrentTexture(&texture);
    check();
    if(texture.status==wgpu::SurfaceGetCurrentTextureStatus::Timeout)return false;
    if(texture.status==wgpu::SurfaceGetCurrentTextureStatus::Outdated||texture.status==wgpu::SurfaceGetCurrentTextureStatus::Lost)throw RecoverableGpuLoss("Android presentation surface lost/outdated");
    if(texture.status==wgpu::SurfaceGetCurrentTextureStatus::Error)throw std::runtime_error("Android presentation surface acquisition failed");
    if(!texture.texture)throw std::runtime_error("Android surface returned no texture");
    auto backendTexture=skgpu::graphite::BackendTextures::MakeDawn(texture.texture.Get());
    auto target=SkSurfaces::WrapBackendTexture(recorder.get(),backendTexture,SkColorSpace::MakeSRGB(),nullptr);
    if(!target)throw std::runtime_error("Android Graphite surface wrapping failed");
    uint64_t layers=0,paths=0;for(const auto& item:frame.items){const auto& node=frame.scene->document->get(item.node);if(node.graphics.path)paths+=node.graphics.path->commands.size()*256+1024;if(item.paint)paths+=item.paint->paths.size()*256+1024;if(item.opacity<=0||!item.world.inverse())continue;if(frame.properties[item.node.slot].opacity<1||node.graphics.blur>0)layers+=uint64_t(width)*height*4*(node.graphics.blur>0?3:1);if(item.flags&wire::nodeFlags::clipSaveLayer)layers+=uint64_t(width)*height*4;}
    for(const auto& item:frame.items){const auto& node=frame.scene->document->get(item.node);
      layers+=native::nativeMaskLayerBytes(item,scale,width,height);
      if(item.opacity>0&&item.world.inverse()&&node.snapshot&&node.snapshot->live.opacity<1)layers+=uint64_t(width)*height*4;}
    ExternalLease pathMemory(ledger,2,2,paths),layerMemory(ledger,2,3,layers);
    native::drawPreparedFrame(target->getCanvas(),frame,prepared,scale,paintCounts,snapshots);
    auto recording=recorder->snap();if(!recording)throw std::runtime_error("Android recording unavailable");
    skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=recording.get();
    if(!context->insertRecording(insert)||!context->submit(skgpu::graphite::SyncToCpu::kYes)){check();throw RecoverableGpuLoss("Android Graphite context submission lost");}
    check();if(surface.Present()!=wgpu::Status::Success){check();throw RecoverableGpuLoss("Android presentation surface lost");}check();
    ++draws;return true;
  }
  void close(){
    // Always release every owner even when a lost device cannot submit a drain.
    if(!callbacks->lost&&!callbacks->error&&context)context->submit(skgpu::graphite::SyncToCpu::kYes);
    callbacks->closing=true;if(surface){surface.Unconfigure();surface=nullptr;}attachedWindow=nullptr;backingMemory.reset();width=height=0;
    snapshots.clear();recorder.reset();context.reset();backend={};instance.reset();cacheMemory.reset();
  }
  ~Renderer(){try{close();}catch(...){}}
};
}
