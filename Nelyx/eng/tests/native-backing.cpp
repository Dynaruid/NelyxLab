// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <d3d11_4.h>
#include <dxgi.h>
#include <wrl/client.h>
#include <array>
#include <cstring>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <vector>
#include "gpu_context.h"
#include "include/core/SkCanvas.h"
#include "include/core/SkGraphics.h"
#include "include/core/SkPaint.h"

using Microsoft::WRL::ComPtr;
using namespace nelyx::vulkan;
static void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
static void checked(HRESULT value,const char* message){require(SUCCEEDED(value),message);}
#include "native-text-segment-checks.h"
template<class Work> static void rejects(Work work){bool rejected=false;try{work();}catch(const std::exception&){rejected=true;}require(rejected,"Invalid backing/frame identity was accepted");}
struct Target {
  ComPtr<ID3D11Texture2D> texture,readback;
  ComPtr<ID3D11Fence> fence;
  std::shared_ptr<Win32BackingSlot> slot=std::make_shared<Win32BackingSlot>();
  uint32_t width,height;
  uint64_t consumer=0;
};
int main(int argc,char** argv){try{
  require(argc==3,"Expected bundled font and ICU inputs");checked(CoInitializeEx(nullptr,COINIT_MULTITHREADED),"Native font COM apartment unavailable");struct Apartment{~Apartment(){CoUninitialize();}} apartment;
  SkGraphics::Init();
  ComPtr<ID3D11Device> base;ComPtr<ID3D11DeviceContext> baseContext;
  checked(D3D11CreateDevice(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&base,nullptr,&baseContext),"Hardware D3D adapter unavailable");
  ComPtr<ID3D11Device5> d3d;ComPtr<ID3D11DeviceContext4> context;
  checked(base.As(&d3d),"Shared D3D fence device unavailable");checked(baseContext.As(&context),"Shared D3D fence context unavailable");
  ComPtr<IDXGIDevice> dxgi;ComPtr<IDXGIAdapter> adapter;DXGI_ADAPTER_DESC description{};
  checked(base.As(&dxgi),"DXGI device unavailable");checked(dxgi->GetAdapter(&adapter),"DXGI adapter unavailable");checked(adapter->GetDesc(&description),"DXGI LUID unavailable");
  Win32DeviceOptions options;std::memcpy(options.adapterLuid.data(),&description.AdapterLuid,8);
  auto device=std::make_shared<Device>(options);GpuContext gpu(device);
  paragraphSegmentChecks(gpu,argv[1],argv[2]);
  const bool reuse=gpu.beginWin32BackingAudit(17);
  uint64_t creates=0,reuses=0,frames=0;
  auto makeTarget=[&](uint32_t width,uint32_t height){
    auto target=std::make_unique<Target>();target->width=width;target->height=height;
    D3D11_TEXTURE2D_DESC texture{};texture.Width=width;texture.Height=height;texture.MipLevels=texture.ArraySize=1;
    texture.Format=DXGI_FORMAT_B8G8R8A8_UNORM;texture.SampleDesc.Count=1;texture.Usage=D3D11_USAGE_DEFAULT;
    texture.BindFlags=D3D11_BIND_RENDER_TARGET|D3D11_BIND_SHADER_RESOURCE;texture.MiscFlags=D3D11_RESOURCE_MISC_SHARED|D3D11_RESOURCE_MISC_SHARED_NTHANDLE;
    checked(d3d->CreateTexture2D(&texture,nullptr,&target->texture),"Shared texture creation failed");
    texture.Usage=D3D11_USAGE_STAGING;texture.BindFlags=texture.MiscFlags=0;texture.CPUAccessFlags=D3D11_CPU_ACCESS_READ;
    checked(d3d->CreateTexture2D(&texture,nullptr,&target->readback),"Readback texture creation failed");
    checked(d3d->CreateFence(0,D3D11_FENCE_FLAG_SHARED,IID_PPV_ARGS(&target->fence)),"Shared fence creation failed");
    return target;
  };
  auto render=[&](Target& target,bool first,bool invalidAck=false){
    const uint32_t inset=3+uint32_t(frames%5);const SkColor color=frames%2?0xff1878f0:0xffe04020;
    Win32BackingResult result;
    auto frame=gpu.renderWin32Frame({target.texture.Get(),target.fence.Get(),target.consumer,nullptr,target.slot,&result},[&](SkCanvas* canvas){
      canvas->clear(SK_ColorWHITE);SkPaint paint;paint.setColor(color);paint.setAntiAlias(false);
      canvas->drawRect(SkRect::MakeXYWH(float(inset),5,17,13),paint);
    });
    require(result.operation==(reuse&&!first?2u:1u)&&result.mode==unsigned(reuse),"Native create/reuse selection differs");
    creates+=result.operation==1;reuses+=result.operation==2;++frames;
    require(frame->producerFenceValue==target.consumer+1,"Producer fence sequence differs");
    if(invalidAck){
      rejects([&]{frame->retire(frame->producerFenceValue);});
      rejects([&]{frame->retire(frame->producerFenceValue+1);});
      // A completed producer remains unavailable until its native consumer ACK.
      rejects([&]{gpu.renderWin32Frame({target.texture.Get(),target.fence.Get(),frame->producerFenceValue,nullptr,target.slot},{});});
      require(device->outstandingWin32Frames()==1&&!device->win32ImportPoisoned(),"Rejected input changed the admitted frame");
    }
    checked(context->Wait(target.fence.Get(),frame->producerFenceValue),"D3D producer wait failed");
    context->CopyResource(target.readback.Get(),target.texture.Get());
    const auto consumer=frame->producerFenceValue+1;
    checked(context->Signal(target.fence.Get(),consumer),"D3D consumer signal failed");context->Flush();
    HANDLE event=CreateEventW(nullptr,FALSE,FALSE,nullptr);require(event!=nullptr,"Consumer event unavailable");
    const auto armed=target.fence->SetEventOnCompletion(consumer,event);
    const auto completed=SUCCEEDED(armed)?WaitForSingleObject(event,5000):WAIT_FAILED;CloseHandle(event);
    require(completed==WAIT_OBJECT_0&&target.fence->GetCompletedValue()>=consumer,"Consumer completion unconfirmed");
    D3D11_MAPPED_SUBRESOURCE mapped{};checked(context->Map(target.readback.Get(),0,D3D11_MAP_READ,0,&mapped),"Readback map failed");
    bool equal=true;
    for(uint32_t y=0;y<target.height;++y){
      const auto row=reinterpret_cast<const uint32_t*>(static_cast<const uint8_t*>(mapped.pData)+y*mapped.RowPitch);
      for(uint32_t x=0;x<target.width;++x){const bool inside=x>=inset&&x<inset+17&&y>=5&&y<18;if(row[x]!=(inside?color:SK_ColorWHITE))equal=false;}
    }
    context->Unmap(target.readback.Get(),0);require(equal,"Shared backing pixels changed, smeared or retained an old frame");
    frame->retire(consumer);require(frame->isRetired(),"Native consumer did not retire the frame");frame.reset();target.consumer=consumer;
    require(device->outstandingWin32Frames()==0&&!device->win32ImportPoisoned(),"Native frame leaked or poisoned the owner");
  };
  std::vector<std::unique_ptr<Target>> targets;
  targets.push_back(makeTarget(72,48));auto& first=*targets[0];
  for(unsigned i=0;i<4;++i)render(first,i==0,i==0);
  if(reuse){
    auto foreign=makeTarget(80,56);
    rejects([&]{gpu.renderWin32Frame({foreign->texture.Get(),foreign->fence.Get(),0,nullptr,first.slot},{});});
    require(!device->win32ImportPoisoned()&&device->outstandingWin32Frames()==0,"Foreign texture rejection leaked a frame");
  }
  // Surface generation replacement drops its old import before the next one.
  first.slot=std::make_shared<Win32BackingSlot>();render(first,true);render(first,false);
  for(const auto size:std::array<std::array<uint32_t,2>,4>{{{96,64},{128,96},{80,56},{64,40}}}){
    targets.push_back(makeTarget(size[0],size[1]));render(*targets.back(),true);render(*targets.back(),false);
  }
  // Four idle owners exceed the three-backing cache. The evicted first owner
  // must import again and still produce its exact new pixels.
  render(first,true);render(first,false);
  gpu.close();require(device->outstandingWin32Frames()==0,"Close left a native frame");
  std::cout<<"BACKING_CALLER {\"created\":"<<creates<<",\"reused\":"<<reuses<<",\"frames\":"<<frames<<"}\n";
  std::cout<<"PASS delivered Win32 texture pixels, ACK fencing, foreign identity rejection, generation/size replacement, bounded idle eviction and drain\n";
  return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}}
