// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../generated/vulkan/device.h"
#include <d3d11_4.h>
#include <dxgi1_2.h>
#include <winrt/Microsoft.UI.Composition.h>
#include <winrt/Microsoft.UI.Composition.Interop.h>
#include <winrt/Microsoft.Graphics.DirectX.h>
#include <atomic>
#include <cstring>
#include <thread>
#include <stdexcept>

namespace RNSkia {
// UI-owned D3D/Composition resources. JS/native GPU creation receives only the
// immutable LUID options; this owner never creates a second Vulkan device.
class WindowsCompositionDevice final {
  struct Payload {
    winrt::Microsoft::UI::Composition::Compositor compositor{nullptr};
    winrt::Microsoft::UI::Composition::CompositionGraphicsDevice graphics{nullptr};
    winrt::com_ptr<ID3D11Device5> device;
    winrt::com_ptr<ID3D11DeviceContext4> context;
  };
public:
  WindowsCompositionDevice(winrt::Microsoft::UI::Composition::Compositor compositor,IDXGIAdapter1* adapter)
    :owner(std::this_thread::get_id()),data(std::make_unique<Payload>()) {
    if(!compositor || !adapter)throw std::runtime_error("Actual compositor and explicit hardware DXGI adapter required");
    DXGI_ADAPTER_DESC1 description{};winrt::check_hresult(adapter->GetDesc1(&description));
    if(description.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)throw std::runtime_error("Composition requires an explicit hardware adapter");
    std::memcpy(options.adapterLuid.data(),&description.AdapterLuid,options.adapterLuid.size());
    winrt::com_ptr<ID3D11Device> device;winrt::com_ptr<ID3D11DeviceContext> context;
    winrt::check_hresult(D3D11CreateDevice(adapter,D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      nullptr,0,D3D11_SDK_VERSION,device.put(),nullptr,context.put()));
    data->device=device.as<ID3D11Device5>();data->context=context.as<ID3D11DeviceContext4>();data->compositor=std::move(compositor);
    auto interop=data->compositor.as<winrt::Microsoft::UI::Composition::ICompositorInterop>();
    winrt::Microsoft::UI::Composition::ICompositionGraphicsDevice graphics{nullptr};
    winrt::check_hresult(interop->CreateGraphicsDevice(data->device.get(),&graphics));
    data->graphics=graphics.as<winrt::Microsoft::UI::Composition::CompositionGraphicsDevice>();
  }
  ~WindowsCompositionDevice(){if(data && (owner!=std::this_thread::get_id() || surfaces.load() || poisoned.load()))data.release();}
  WindowsCompositionDevice(const WindowsCompositionDevice&)=delete;
  WindowsCompositionDevice& operator=(const WindowsCompositionDevice&)=delete;
  nelyx::vulkan::Win32DeviceOptions nativeOptions() const {
    if(closed.load() || poisoned.load())throw std::runtime_error("Composition device is closed or poisoned");return options;
  }
  void requireOwner() const {
    if(owner!=std::this_thread::get_id())throw std::runtime_error("Composition operation requires its UI owner");
    if(closed.load() || poisoned.load())throw std::runtime_error("Composition device is closed or poisoned");
  }
  uint32_t activeSurfaces() const{return surfaces.load();}
  uint64_t logicalTargetBytes() const{return targetBytes.load();}
  void close() {
    if(owner!=std::this_thread::get_id())throw std::runtime_error("Composition close requires its UI owner");
    if(closed.load())return;
    if(poisoned.load())throw std::runtime_error("Composition completion is unconfirmed; UI owner retained");
    if(surfaces.load())throw std::runtime_error("Composition surface owners remain at device close");
    data.reset();closed.store(true);
  }
private:
  friend class WindowsCompositionSurface;
  const std::thread::id owner;
  nelyx::vulkan::Win32DeviceOptions options{};
  std::unique_ptr<Payload> data;
  std::atomic<uint32_t> surfaces{0};
  std::atomic<bool> closed{false};
  std::atomic<bool> poisoned{false};
  std::atomic<uint64_t> targetBytes{0}; // logical output area, not driver memory attribution
};
} // namespace RNSkia
