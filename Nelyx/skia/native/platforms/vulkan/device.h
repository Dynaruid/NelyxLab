#pragma once
#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <array>
#include <functional>
#include <vector>

class SkSurface;
class SkCanvas;
struct ID3D11Texture2D;
struct ID3D11Fence;
namespace skgpu::graphite { class Context; class Recorder; class Recording; }
namespace nelyx::vulkan {
enum class WindowKind { None, Win32, Xlib, Wayland };
// Borrowed handles stay live on the caller's UI owner until checked renderer close.
struct WindowTarget { WindowKind kind=WindowKind::None; uint64_t display=0,window=0; };
// Single-plane ARGB8888 modifiers advertised by the owning display. This does
// not create a WSI window or allow a software/other-renderer fallback.
struct DmaBufDeviceOptions { std::vector<uint64_t> modifiers; };
// Exact adapter selected by the owning Windows Composition/D3D device. This
// prepares external texture/fence import; it does not create another window.
struct Win32DeviceOptions { std::array<uint8_t,8> adapterLuid{}; };
// Borrowed native COM inputs. The import retains these objects; no JSI/View
// owner is permitted in the native frame. D3D must have completed waitValue.
struct Win32TextureTarget {
  ID3D11Texture2D* texture=nullptr;
  ID3D11Fence* fence=nullptr;
  uint64_t waitValue=0;
};
class Win32Frame final {
 public:
  const uint32_t width,height;
  const uint64_t producerFenceValue;
  ~Win32Frame();
  Win32Frame(const Win32Frame&)=delete;
  Win32Frame& operator=(const Win32Frame&)=delete;
  // Nonblocking native confirmation: caller signals producerFenceValue+1
  // after its D3D copy, then retries until the actual fence has completed.
  void retire(uint64_t consumerFenceValue) const;
  bool isRetired() const;
  void awaitProducer() const;
  void finishProducer() const;
 private:
  friend class Device;
  Win32Frame(uint32_t width,uint32_t height,uint64_t signal,std::shared_ptr<void> native,
      std::function<void(uint64_t)> retire,std::function<bool()> retired,std::function<bool()> retain,
      std::function<void()> awaitProducer,std::function<void()> finishProducer);
  std::shared_ptr<void> native;
  std::function<void(uint64_t)> retireNative;
  std::function<bool()> retiredNative,retainNative;
  std::function<void()> awaitProducerNative,finishProducerNative;
  std::unique_ptr<std::shared_ptr<void>> retention;
};
class DmaBufFrame final {
 public:
  const int fd; // Borrowed until this immutable frame's last reference retires.
  const uint32_t width,height,stride,offset;
  const uint64_t modifier;
 private:
  friend class Device;
  DmaBufFrame(int fd,uint32_t width,uint32_t height,uint32_t stride,uint32_t offset,
    uint64_t modifier,std::shared_ptr<void> owner)
    :fd(fd),width(width),height(height),stride(stride),offset(offset),modifier(modifier),owner(std::move(owner)){}
  std::shared_ptr<void> owner;
};
// Owns Vulkan instance/device/queue/allocator and Graphite context together.
// Surface/resource owners must release their resources before this owner drains.
class Device : public std::enable_shared_from_this<Device> {
 public:
  explicit Device(uint64_t borrowedWindow=0);
  explicit Device(WindowTarget target);
  explicit Device(DmaBufDeviceOptions options);
  explicit Device(Win32DeviceOptions options);
  ~Device();
  Device(const Device&) = delete;
  Device& operator=(const Device&) = delete;
  skgpu::graphite::Context* context() const;
  std::string name() const;
  std::string description() const;
  uint32_t vendor() const;
  uint32_t deviceType() const;
  std::pair<uint64_t,uint64_t> allocations() const;
  bool hasWindow() const;
  void resizeWindow(skgpu::graphite::Recorder*,uint32_t width,uint32_t height);
  void present(skgpu::graphite::Recorder*,SkSurface*);
  void releaseWindow(skgpu::graphite::Recorder*);
  std::shared_ptr<const DmaBufFrame> exportDmaBufFrame(
    std::unique_ptr<skgpu::graphite::Recorder>,uint32_t width,uint32_t height,
    const std::function<void(SkCanvas*)>& draw,
    const std::vector<skgpu::graphite::Recording*>& recordings={});
  bool canExportDmaBufFrame() const;
  uint32_t outstandingDmaBufFrames() const;
  bool canImportWin32Texture() const;
  std::shared_ptr<const Win32Frame> renderWin32Frame(std::unique_ptr<skgpu::graphite::Recorder>,
    Win32TextureTarget,std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings={},bool deferCompletion=false);
  uint32_t outstandingWin32Frames() const;
  bool win32ImportPoisoned() const;
  void retire();
  void drain();
 private:
  struct Impl;
  std::unique_ptr<Impl> impl;
};
}
