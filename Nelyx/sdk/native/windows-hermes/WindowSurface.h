// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <dcomp.h>
#include <d3d11_4.h>
#include <dxgi1_2.h>
#include <wrl.h>
#include <atomic>
#include <iostream>
#include <string>
#include "rnskia/RNSkWindowSurface.h"
#include "rnskia/RNSkGraphiteTarget.h"
#include "device.h"
#include "windows/WindowsFrameWorker.h"

namespace Nelyx::NativeHermes {
using Microsoft::WRL::ComPtr;
inline void check(HRESULT value){if(FAILED(value))throw std::runtime_error("Windows native operation failed: "+std::to_string(static_cast<uint32_t>(value)));}
// All D3D/DirectComposition objects belong to the UI owner. The worker receives
// only retained native recordings, textures and fences; never JSI objects.
class WindowSurface final:public RNSkia::RNSkWindowSurface,public std::enable_shared_from_this<WindowSurface> {
public:
  using UiPost=std::function<void(std::function<void()>)>;
  using Render=std::function<std::shared_ptr<const nelyx::vulkan::Win32Frame>(nelyx::vulkan::Win32TextureTarget,const std::vector<std::shared_ptr<skgpu::graphite::Recording>>&)>;
  explicit WindowSurface(HWND hwnd,UiPost post):hwnd(hwnd),post(std::move(post)),owner(std::this_thread::get_id()){
    ComPtr<IDXGIFactory1> factory;check(CreateDXGIFactory1(IID_PPV_ARGS(&factory)));
    wchar_t requested[32]{};const auto length=GetEnvironmentVariableW(L"NELYX_WINDOWS_GPU_VENDOR",requested,32);uint32_t vendor=0;
    if(length){if(length>=32)throw std::runtime_error("Invalid NELYX_WINDOWS_GPU_VENDOR");size_t end=0;const auto value=std::stoul(requested,&end,0);if(end!=length||!value||value>UINT32_MAX)throw std::runtime_error("Invalid NELYX_WINDOWS_GPU_VENDOR");vendor=uint32_t(value);}
    ComPtr<IDXGIAdapter1> adapter;const auto primary=MonitorFromPoint(POINT{0,0},MONITOR_DEFAULTTOPRIMARY);
    for(UINT index=0;;++index){
      ComPtr<IDXGIAdapter1> candidate;const auto result=factory->EnumAdapters1(index,&candidate);if(result==DXGI_ERROR_NOT_FOUND)break;check(result);
      DXGI_ADAPTER_DESC1 description{};check(candidate->GetDesc1(&description));if(description.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)continue;
      bool selected=vendor&&description.VendorId==vendor;
      if(!vendor)for(UINT outputIndex=0;;++outputIndex){ComPtr<IDXGIOutput> output;const auto outputResult=candidate->EnumOutputs(outputIndex,&output);if(outputResult==DXGI_ERROR_NOT_FOUND)break;check(outputResult);DXGI_OUTPUT_DESC display{};check(output->GetDesc(&display));if(display.AttachedToDesktop&&display.Monitor==primary){selected=true;break;}}
      if(selected){adapter=std::move(candidate);memcpy(options.adapterLuid.data(),&description.AdapterLuid,8);std::cout<<"NELYX_NATIVE_ADAPTER {\"vendor\":"<<description.VendorId<<",\"device\":"<<description.DeviceId<<",\"luidLow\":"<<description.AdapterLuid.LowPart<<",\"luidHigh\":"<<description.AdapterLuid.HighPart<<",\"selection\":\""<<(vendor?"explicit-vendor":"primary-display")<<"\"}"<<std::endl;break;}
    }
    if(!adapter)throw std::runtime_error(vendor?"Requested Windows hardware adapter unavailable":"No hardware adapter owns the primary display; select NELYX_WINDOWS_GPU_VENDOR");
    ComPtr<ID3D11Device> device0;ComPtr<ID3D11DeviceContext> context0;
    check(D3D11CreateDevice(adapter.Get(),D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&device0,nullptr,&context0));
    check(device0.As(&device));check(context0.As(&context));ComPtr<IDXGIDevice> dxgi;check(device.As(&dxgi));
    check(DCompositionCreateDevice(dxgi.Get(),IID_PPV_ARGS(&composition)));check(composition->CreateTargetForHwnd(hwnd,TRUE,&target));
    check(composition->CreateVisual(&visual));check(target->SetRoot(visual.Get()));
    check(composition->CreateSurface(1,1,DXGI_FORMAT_B8G8R8A8_UNORM,DXGI_ALPHA_MODE_PREMULTIPLIED,&drawing));
    check(visual->SetContent(drawing.Get()));check(composition->Commit());
  }
  nelyx::vulkan::Win32DeviceOptions nativeOptions()const{return options;}
  void configure(skgpu::graphite::TextureInfo info,Render value){ui();format=info;render=std::move(value);}
  void attach(void*,int w,int h,bool,bool,Releaser)override{resize(w,h);}
  void resize(int w,int h)override{ui();if(w<0||h<0||w>4096||h>4096)throw std::runtime_error("Native surface dimensions exceed 4096");if(wide==w&&high==h)return;wide=w;high=h;++generation;}
  void detach()override{ui();if(busy)throw std::runtime_error("Native GPU frame must drain before surface detach");render={};redraw={};canShow={};wide=high=0;}
  bool isAttached()const override{return wide>0&&high>0;}
  int getWidth()override{return wide;}
  int getHeight()override{return high;}
  void setLayoutSize(int w,int h)override{logicalWide=w;logicalHigh=h;}
  bool getLayoutSize(int* w,int* h)override{*w=logicalWide;*h=logicalHigh;return logicalWide>0&&logicalHigh>0;}
  void setRequestRedraw(std::function<void()> value)override{redraw=std::move(value);}
  void setCanPresent(std::function<bool()> value)override{canShow=std::move(value);}
  bool getTargetInfo(RNSkia::RNSkGraphiteTargetInfo* info)override{if(!info||!wide||!high)return false;*info={wide,high,kBGRA_8888_SkColorType,false,format};info->surfaceGeneration=generation;return true;}
  bool presentRecordings(const std::vector<skgpu::graphite::Recording*>&)override{throw std::runtime_error("Owned native recordings required");}
  bool presentImage(const sk_sp<SkImage>&)override{throw std::runtime_error("Native surface rejects stale-size image presentation");}
  bool hasAsyncPresentation()const override{return true;}
  bool presentAsync(const std::vector<std::shared_ptr<RNSkia::RNSkGraphiteRecording>>& recordings,FrameCompletion complete)override{
    ui();if(busy||!render||!wide||!high||(canShow&&!canShow()))return false;
    if(recordings.empty()||recordings.size()>2)throw std::runtime_error("Native frame batch exceeds admission");
    ensureTarget();auto packet=std::make_shared<Packet>();packet->width=wide;packet->height=high;packet->generation=generation;packet->texture=texture;packet->fence=fence;packet->wait=consumer;
    for(auto const& recording:recordings){packet->recordings.push_back(recording->nativeReplay());packet->identities.push_back(recording->nelyxIdentity());}
    packet->complete=std::move(complete);packet->render=render;busy=true;
    auto self=shared_from_this();worker.post([self,packet]{
      try{packet->frame=packet->render({packet->texture.Get(),packet->fence.Get(),packet->wait},packet->recordings);packet->recordings.clear();packet->render={};}
      catch(std::exception const& error){packet->failure=error.what();}
      self->post([self,packet]{self->publish(packet);});
    });return true;
  }
  bool idle()const{return !busy;}
  uint64_t surfaceGeneration()const{return generation;}
  uint64_t frames()const{return committed;}
  std::function<void(uint64_t,const RNSkia::NelyxFrameIdentity&,int,int,uint64_t)> onPresented;
  void close(){ui();if(busy)throw std::runtime_error("Native surface close before GPU drain");worker.close();detach();check(visual->SetContent(nullptr));check(composition->Commit());drawing.Reset();visual.Reset();target.Reset();composition.Reset();texture.Reset();fence.Reset();context.Reset();device.Reset();}
private:
  struct Packet{int width,height;uint64_t generation,wait;ComPtr<ID3D11Texture2D> texture;ComPtr<ID3D11Fence> fence;std::vector<std::shared_ptr<skgpu::graphite::Recording>> recordings;std::vector<RNSkia::NelyxFrameIdentity> identities;std::shared_ptr<const nelyx::vulkan::Win32Frame> frame;Render render;FrameCompletion complete;std::string failure;bool updated=false;};
  void ui()const{if(owner!=std::this_thread::get_id())throw std::runtime_error("Native surface requires UI owner");}
  void ensureTarget(){
    if(texture&&targetWide==wide&&targetHigh==high)return;texture.Reset();fence.Reset();consumer=0;
    D3D11_TEXTURE2D_DESC desc{};desc.Width=wide;desc.Height=high;desc.MipLevels=1;desc.ArraySize=1;desc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;desc.SampleDesc.Count=1;desc.Usage=D3D11_USAGE_DEFAULT;desc.BindFlags=D3D11_BIND_SHADER_RESOURCE|D3D11_BIND_RENDER_TARGET;desc.MiscFlags=D3D11_RESOURCE_MISC_SHARED_NTHANDLE|D3D11_RESOURCE_MISC_SHARED;
    check(device->CreateTexture2D(&desc,nullptr,&texture));check(device->CreateFence(0,D3D11_FENCE_FLAG_SHARED,IID_PPV_ARGS(&fence)));targetWide=wide;targetHigh=high;
  }
  void publish(std::shared_ptr<Packet> packet){
    ui();if(!packet->failure.empty()){busy=false;packet->complete({},packet->failure);return;}
    try{
      const bool current=packet->generation==generation&&packet->width==wide&&packet->height==high&&(!canShow||canShow());
      check(context->Wait(packet->fence.Get(),packet->frame->producerFenceValue));
      if(current){
        if(drawingWide!=wide||drawingHigh!=high){ComPtr<IDCompositionSurface> next;check(composition->CreateSurface(wide,high,DXGI_FORMAT_B8G8R8A8_UNORM,DXGI_ALPHA_MODE_PREMULTIPLIED,&next));check(visual->SetContent(next.Get()));drawing=next;drawingWide=wide;drawingHigh=high;}
        POINT offset{};ComPtr<ID3D11Texture2D> destination;check(drawing->BeginDraw(nullptr,IID_PPV_ARGS(&destination),&offset));
        context->CopySubresourceRegion(destination.Get(),0,offset.x,offset.y,0,packet->texture.Get(),0,nullptr);check(drawing->EndDraw());check(composition->Commit());packet->updated=true;
      }
      consumer=packet->frame->producerFenceValue+1;check(context->Signal(packet->fence.Get(),consumer));context->Flush();
      auto self=shared_from_this();worker.post([self,packet]{
        HANDLE completed=CreateEventW(nullptr,FALSE,FALSE,nullptr);
        try{if(!completed)throw std::runtime_error("Native completion event unavailable");const auto end=packet->frame->producerFenceValue+1;check(packet->fence->SetEventOnCompletion(end,completed));if(WaitForSingleObject(completed,5000)!=WAIT_OBJECT_0)throw std::runtime_error("Native copy fence timeout");packet->frame->retire(end);packet->frame.reset();}
        catch(std::exception const& error){packet->failure=error.what();}if(completed)CloseHandle(completed);
        self->post([self,packet]{self->busy=false;if(packet->updated&&packet->failure.empty()){++self->committed;if(self->onPresented)self->onPresented(self->committed,packet->identities.back(),packet->width,packet->height,packet->generation);}packet->complete(packet->updated?std::optional<size_t>(packet->identities.size()-1):std::nullopt,packet->failure);});
      });
    }catch(std::exception const& error){busy=false;packet->complete({},error.what());}
  }
  HWND hwnd;UiPost post;std::thread::id owner;RNSkia::WindowsFrameWorker worker;
  nelyx::vulkan::Win32DeviceOptions options{};skgpu::graphite::TextureInfo format;Render render;
  std::atomic<int> wide{0},high{0},logicalWide{0},logicalHigh{0};std::atomic<uint64_t> generation{1};
  bool busy=false;uint64_t consumer=0,committed=0;int targetWide=0,targetHigh=0,drawingWide=1,drawingHigh=1;
  std::function<void()> redraw;std::function<bool()> canShow;
  ComPtr<ID3D11Device5> device;ComPtr<ID3D11DeviceContext4> context;ComPtr<ID3D11Texture2D> texture;ComPtr<ID3D11Fence> fence;
  ComPtr<IDCompositionDevice> composition;ComPtr<IDCompositionTarget> target;ComPtr<IDCompositionVisual> visual;ComPtr<IDCompositionSurface> drawing;
};
}
