// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "CompositionDevice.h"
#include <functional>

namespace RNSkia {
// UI-owned CompositionDrawingSurface. Native packets perform fence completion
// on the GPU worker; the explicit readback diagnostic remains synchronous.
class WindowsCompositionSurface final {
public:
  using Draw=std::function<void(SkCanvas*)>;
  using Recordings=std::vector<std::shared_ptr<skgpu::graphite::Recording>>;
  using Renderer=std::function<std::shared_ptr<const nelyx::vulkan::Win32Frame>(nelyx::vulkan::Win32TextureTarget,Draw,const Recordings&)>;
  using Admitter=std::function<Renderer(uint32_t)>;
  // Optional observer runs inside BeginDraw after the real copy fence, before
  // EndDraw invalidates its target. It never supplies display pixels.
  using CopyObserver=std::function<void(ID3D11Texture2D*,POINT,uint32_t,uint32_t)>;
  struct Prepared {
    winrt::com_ptr<ID3D11Texture2D> texture;
    winrt::com_ptr<ID3D11Fence> fence;
    Renderer renderer;
    Recordings recordings;
    std::shared_ptr<const nelyx::vulkan::Win32Frame> frame;
    uint32_t width=0,height=0;
    uint64_t consumer=0;
    bool updated=false;
    void render(){frame=renderer({texture.get(),fence.get(),consumer},{},recordings);recordings.clear();renderer={};}
    void retire(){
      HANDLE event=CreateEventW(nullptr,FALSE,FALSE,nullptr);
      if(!event)throw std::runtime_error("Windows copy completion event unavailable");
      try{
        const auto value=frame->producerFenceValue+1;
        winrt::check_hresult(fence->SetEventOnCompletion(value,event));
        if(WaitForSingleObject(event,5000)!=WAIT_OBJECT_0||fence->GetCompletedValue()<value)
          throw std::runtime_error("Composition native copy completion unconfirmed");
        frame->retire(value);frame.reset();CloseHandle(event);
      }catch(...){CloseHandle(event);throw;}
    }
  };
private:
  struct Payload {
    std::shared_ptr<WindowsCompositionDevice> device;
    winrt::Microsoft::UI::Composition::CompositionDrawingSurface surface{nullptr};
    winrt::com_ptr<ID3D11Texture2D> texture,target;
    winrt::com_ptr<ID3D11Fence> fence;
    std::shared_ptr<const nelyx::vulkan::Win32Frame> frame;
    Admitter admit;
    std::function<bool()> ready;
    HANDLE event{};
    uint64_t consumer=0;
    uint64_t targetBytes=0;
    bool failed=false,registered=false;
    ~Payload(){
      frame.reset();admit={};ready={};target=nullptr;texture=nullptr;fence=nullptr;surface=nullptr;
      if(event)CloseHandle(event);
      if(registered){device->targetBytes-=targetBytes;--device->surfaces;}
    }
  };
public:
  WindowsCompositionSurface(std::shared_ptr<WindowsCompositionDevice> device,Admitter admit,std::function<bool()> ready)
    :owner(std::this_thread::get_id()),data(std::make_unique<Payload>()) {
    if(!device || !admit || !ready)throw std::runtime_error("Composition requires actual device, native renderer and admission ports");
    device->requireOwner();data->device=std::move(device);
    if(data->device->surfaces.load()>=64)throw std::runtime_error("Composition surface owner budget exceeds64");
    data->admit=std::move(admit);data->ready=std::move(ready);
    data->surface=data->device->data->graphics.CreateDrawingSurface({1,1},
      winrt::Microsoft::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
      winrt::Microsoft::Graphics::DirectX::DirectXAlphaMode::Premultiplied);
    data->event=CreateEventW(nullptr,FALSE,FALSE,nullptr);if(!data->event)throw std::runtime_error("Composition native fence event unavailable");
    ++data->device->surfaces;data->registered=true;
  }
  ~WindowsCompositionSurface(){if(data && (owner!=std::this_thread::get_id() || data->failed)){data->frame.reset();data.release();}}
  WindowsCompositionSurface(const WindowsCompositionSurface&)=delete;
  WindowsCompositionSurface& operator=(const WindowsCompositionSurface&)=delete;
  winrt::Microsoft::UI::Composition::ICompositionSurface content() const {requireOwner();return data->surface;}
  void resize(uint32_t width,uint32_t height) {
    requireOwner();if(width>4096 || height>4096)throw std::runtime_error("Composition dimensions exceed 4096 admission");
    if(width==wide.load() && height==high.load())return;
    const auto bytes=static_cast<uint64_t>(width)*height*4;
    const auto remaining=data->device->targetBytes.load()-data->targetBytes;
    if(bytes>64*1024*1024 || remaining>64*1024*1024-bytes)throw std::runtime_error("Composition logical target budget exceeds64MiB");
    try{if(!busy&&width&&height){data->surface.Resize({static_cast<int32_t>(width),static_cast<int32_t>(height)});surfaceWide=width;surfaceHigh=height;}}
    catch(...){data->failed=true;failure.store(true);data->device->poisoned.store(true);throw;}
    if(!busy){data->texture=nullptr;data->fence=nullptr;data->consumer=0;textureWide=textureHigh=0;}
    data->device->targetBytes.store(remaining+bytes);data->targetBytes=bytes;
    wide.store(width);high.store(height);
  }
  uint32_t width() const{return wide.load();}
  uint32_t height() const{return high.load();}
  uint64_t committedFrames() const{return committed.load();}
  bool failed() const{return failure.load();}
  Renderer admit(uint32_t count){requireOwner();if(!data->ready())throw std::runtime_error("Composition surface admission is closed");return data->admit(count);}
  std::shared_ptr<Prepared> prepare(uint32_t width,uint32_t height,Recordings recordings,Renderer admitted={}){
    requireOwner();if(busy||(!admitted&&!data->ready()))return {};
    if(!width||!height||width>4096||height>4096)throw std::runtime_error("Invalid native recording dimensions");
    if(!data->texture||textureWide!=width||textureHigh!=height){
      data->texture=nullptr;data->fence=nullptr;data->consumer=0;createTarget(width,height);
    }
    auto packet=std::make_shared<Prepared>();packet->texture=data->texture;packet->fence=data->fence;
    packet->renderer=admitted?std::move(admitted):data->admit(1);packet->recordings=std::move(recordings);packet->width=width;packet->height=height;packet->consumer=data->consumer;
    busy=true;return packet;
  }
  // UI owner only: no CPU fence wait, no Graphite replay, no JSI callbacks.
  void publish(const std::shared_ptr<Prepared>& packet,bool current){
    requireOwner();if(!busy||!packet->frame||packet->frame->width!=packet->width||packet->frame->height!=packet->height||
      packet->frame->producerFenceValue!=packet->consumer+1)throw std::runtime_error("Composition native producer frame identity differs");
    auto& device=*data->device->data;
    auto drawing=data->surface.as<winrt::Microsoft::UI::Composition::ICompositionDrawingSurfaceInterop>();
    bool begun=false;
    try{
      if(current&&wide==packet->width&&high==packet->height){
        if(surfaceWide!=packet->width||surfaceHigh!=packet->height){data->surface.Resize({static_cast<int32_t>(packet->width),static_cast<int32_t>(packet->height)});surfaceWide=packet->width;surfaceHigh=packet->height;}
        POINT offset{};winrt::check_hresult(drawing->BeginDraw(nullptr,__uuidof(ID3D11Texture2D),data->target.put_void(),&offset));begun=true;
        D3D11_TEXTURE2D_DESC target{};data->target->GetDesc(&target);
        if(target.Format!=DXGI_FORMAT_B8G8R8A8_UNORM||offset.x<0||offset.y<0||static_cast<uint64_t>(offset.x)+packet->width>target.Width||static_cast<uint64_t>(offset.y)+packet->height>target.Height)
          throw std::runtime_error("Composition atlas copy bounds/format differ");
        winrt::check_hresult(device.context->Wait(packet->fence.get(),packet->frame->producerFenceValue));
        D3D11_BOX source{0,0,0,packet->width,packet->height,1};
        device.context->CopySubresourceRegion(data->target.get(),0,offset.x,offset.y,0,packet->texture.get(),0,&source);
        packet->updated=true;
      }
      winrt::check_hresult(device.context->Signal(packet->fence.get(),packet->frame->producerFenceValue+1));device.context->Flush();
      if(begun){winrt::check_hresult(drawing->EndDraw());begun=false;data->target=nullptr;++committed;}
    }catch(...){if(begun)drawing->EndDraw();poison();throw;}
  }
  void complete(const std::shared_ptr<Prepared>& packet){
    requireOwner();if(!busy||packet->frame)throw std::runtime_error("Composition completion before native retirement");
    // The finished UI callback can start the next size immediately. Drop its
    // duplicate slot references before reallocating that slot for another epoch.
    packet->texture=nullptr;packet->fence=nullptr;
    data->consumer=packet->consumer+2;busy=false;
  }
  void poison(){if(data){data->failed=true;data->device->poisoned.store(true);}failure.store(true);}
  bool present(Draw draw,const Recordings& recordings={},CopyObserver observe={}) {
    requireOwner();const auto width=wide.load(),height=high.load();
    if(!width || !height || !data->ready())return false;
    auto drawing=data->surface.as<winrt::Microsoft::UI::Composition::ICompositionDrawingSurfaceInterop>();
    bool begun=false;
    try {
      if(!data->texture)createTarget(width,height);
      data->frame=data->admit(1)({data->texture.get(),data->fence.get(),data->consumer},std::move(draw),recordings);
      if(!data->frame || data->frame->width!=width || data->frame->height!=height || data->frame->producerFenceValue!=data->consumer+1)
        throw std::runtime_error("Composition native producer frame identity differs");
      POINT offset{};winrt::check_hresult(drawing->BeginDraw(nullptr,__uuidof(ID3D11Texture2D),data->target.put_void(),&offset));begun=true;
      D3D11_TEXTURE2D_DESC target{};data->target->GetDesc(&target);
      if(target.Format!=DXGI_FORMAT_B8G8R8A8_UNORM || offset.x<0 || offset.y<0 ||
         static_cast<uint64_t>(offset.x)+width>target.Width || static_cast<uint64_t>(offset.y)+height>target.Height)
        throw std::runtime_error("Composition atlas copy bounds/format differ");
      auto& device=*data->device->data;
      winrt::check_hresult(device.context->Wait(data->fence.get(),data->frame->producerFenceValue));
      D3D11_BOX source{0,0,0,width,height,1};
      device.context->CopySubresourceRegion(data->target.get(),0,offset.x,offset.y,0,data->texture.get(),0,&source);
      const auto consumer=data->frame->producerFenceValue+1;
      winrt::check_hresult(device.context->Signal(data->fence.get(),consumer));device.context->Flush();
      winrt::check_hresult(data->fence->SetEventOnCompletion(consumer,data->event));
      if(WaitForSingleObject(data->event,5000)!=WAIT_OBJECT_0 || data->fence->GetCompletedValue()<consumer)
        throw std::runtime_error("Composition native copy completion unconfirmed");
      winrt::check_hresult(device.device->GetDeviceRemovedReason());
      if(observe)observe(data->target.get(),offset,width,height);
      data->frame->retire(consumer);data->frame.reset();data->consumer=consumer;
      winrt::check_hresult(drawing->EndDraw());begun=false;data->target=nullptr;
      ++committed;return true;
    }catch(...) {
      if(begun)drawing->EndDraw();
      data->failed=true;failure.store(true);data->device->poisoned.store(true);data->frame.reset();throw;
    }
  }
  void close() {
    if(owner!=std::this_thread::get_id())throw std::runtime_error("Composition surface close requires its UI owner");
    if(!data)return;
    if(busy)throw std::runtime_error("Composition surface still owns an asynchronous native frame");
    if(data->failed)throw std::runtime_error("Composition completion failed; native UI owner retained");
    data->device->requireOwner();data.reset();wide=0;high=0;
  }
private:
  void requireOwner() const {
    if(owner!=std::this_thread::get_id())throw std::runtime_error("Composition surface requires its UI owner");
    if(!data || data->failed)throw std::runtime_error("Composition surface closed or failed");
    data->device->requireOwner();
  }
  void createTarget(uint32_t width,uint32_t height) {
    auto& device=*data->device->data;
    D3D11_TEXTURE2D_DESC description{};description.Width=width;description.Height=height;description.MipLevels=1;description.ArraySize=1;
    description.Format=DXGI_FORMAT_B8G8R8A8_UNORM;description.SampleDesc.Count=1;description.Usage=D3D11_USAGE_DEFAULT;
    description.BindFlags=D3D11_BIND_RENDER_TARGET|D3D11_BIND_SHADER_RESOURCE;
    description.MiscFlags=D3D11_RESOURCE_MISC_SHARED|D3D11_RESOURCE_MISC_SHARED_NTHANDLE;
    winrt::com_ptr<ID3D11Texture2D> texture;winrt::com_ptr<ID3D11Fence> fence;
    winrt::check_hresult(device.device->CreateTexture2D(&description,nullptr,texture.put()));
    winrt::check_hresult(device.device->CreateFence(0,D3D11_FENCE_FLAG_SHARED,__uuidof(ID3D11Fence),fence.put_void()));
    data->texture=std::move(texture);data->fence=std::move(fence);
    textureWide=width;textureHigh=height;
  }
  const std::thread::id owner;
  std::unique_ptr<Payload> data;
  std::atomic<uint32_t> wide{0},high{0};
  std::atomic<uint64_t> committed{0};
  std::atomic<bool> failure{false};
  bool busy=false;
  uint32_t textureWide=0,textureHigh=0,surfaceWide=1,surfaceHigh=1;
};
} // namespace RNSkia
