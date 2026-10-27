// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wrl/client.h>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <iostream>
#include "gpu_context.h"
#include "include/core/SkGraphics.h"
#include "include/gpu/vk/VulkanTypes.h"
static void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
#include "native-shadow-checks.h"
int main(){try{
  SkGraphics::Init();
  Microsoft::WRL::ComPtr<ID3D11Device> d3d;
  require(SUCCEEDED(D3D11CreateDevice(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&d3d,nullptr,nullptr)),"Default Windows hardware adapter unavailable");
  Microsoft::WRL::ComPtr<IDXGIDevice> dxgi;require(SUCCEEDED(d3d.As(&dxgi)),"Windows DXGI adapter unavailable");
  Microsoft::WRL::ComPtr<IDXGIAdapter> adapter;require(SUCCEEDED(dxgi->GetAdapter(&adapter)),"Windows adapter query failed");
  DXGI_ADAPTER_DESC description{};require(SUCCEEDED(adapter->GetDesc(&description)),"Windows adapter identity failed");
  nelyx::vulkan::Win32DeviceOptions options;static_assert(sizeof(description.AdapterLuid)==8);
  std::memcpy(options.adapterLuid.data(),&description.AdapterLuid,8);
  auto device=std::make_shared<nelyx::vulkan::Device>(options);
  require(device->deviceType()!=VK_PHYSICAL_DEVICE_TYPE_CPU,"A hardware Vulkan adapter is required");
  nelyx::vulkan::GpuContext gpu(device);elevationShadowChecks(gpu);gpu.close();
  std::cout<<"PASS exact delivered Windows renderer/core libraries on the default D3D adapter; Vulkan owners drained\n";
  return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}}
