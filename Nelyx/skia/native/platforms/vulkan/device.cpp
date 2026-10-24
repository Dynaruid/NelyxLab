#include "device.h"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstring>
#include <mutex>
#include <stdexcept>
#include <unordered_map>
#include <vector>
#include "frame_lease_gate.h"
#ifdef _WIN32
#include <windows.h>
#include <d3d11_4.h>
#include <dxgi1_2.h>
#include <wrl/client.h>
#include <unordered_set>
#else
#include <dlfcn.h>
#include <X11/Xlib.h>
#include <wayland-client.h>
#include <unistd.h>
#include <fcntl.h>
#undef None
#endif
#include "include/gpu/graphite/Context.h"
#include "include/gpu/graphite/ContextOptions.h"
#include "include/gpu/graphite/vk/VulkanGraphiteContext.h"
#include "include/gpu/GpuTypes.h"
#include "include/gpu/vk/VulkanBackendContext.h"
#include "include/gpu/vk/VulkanExtensions.h"
#include "include/gpu/vk/VulkanMemoryAllocator.h"
#ifdef _WIN32
#include "include/third_party/vulkan/vulkan/vulkan_win32.h"
#else
#include "include/third_party/vulkan/vulkan/vulkan_xlib.h"
#include "include/third_party/vulkan/vulkan/vulkan_wayland.h"
#endif
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkSurface.h"
#include "include/gpu/graphite/Recorder.h"
#include "include/gpu/graphite/Recording.h"
#include "include/gpu/graphite/Surface.h"
#include "include/gpu/graphite/BackendSemaphore.h"
#include "include/gpu/graphite/vk/VulkanGraphiteTypes.h"
#include "include/gpu/vk/VulkanMutableTextureState.h"

namespace nelyx::vulkan {
static void checked(VkResult result,const char* operation) {
  if(result!=VK_SUCCESS)throw std::runtime_error(std::string(operation)+" failed: "+std::to_string(result));
}
struct Dispatch {
  PFN_vkGetInstanceProcAddr instanceProc{};
  PFN_vkGetDeviceProcAddr deviceProc{};
  VkInstance instance{};
  VkDevice device{};
  PFN_vkVoidFunction find(const char* name) const noexcept {
    if(device&&deviceProc)if(auto function=deviceProc(device,name))return function;
    return instanceProc?instanceProc(instance,name):nullptr;
  }
  template<class T> T get(const char* name) const {
    auto function=find(name);
    if(!function)throw std::runtime_error(std::string("Vulkan symbol unavailable: ")+name);
    return reinterpret_cast<T>(function);
  }
};
// A bounded dedicated allocator uses the published Skia API, with no dependency
// on the supplier's private VMA implementation or Rust binding ABI.
class Allocator final : public skgpu::VulkanMemoryAllocator {
  struct Allocation {VkDeviceMemory memory{};VkDeviceSize size{};uint32_t flags{};void* mapped{};bool persistent{};};
  Dispatch api;
  VkPhysicalDeviceMemoryProperties types{};
  mutable std::mutex mutex;
  std::unordered_map<skgpu::VulkanBackendMemory,Allocation> live;
  uint64_t next=1,total=0;
  // Capture without allocating while the allocator is failing. A replay scope
  // belongs to its calling thread, so a concurrent JS recorder cannot replace
  // the UI replay's first failure. Successful replay clears this at its next start.
  struct Failure {const Allocator* owner;const char* stage;VkResult result;uint64_t total,request,count;uint32_t flags;bool image;};
  inline static thread_local Failure failure{};
  VkResult reject(const char* stage,VkResult result,VkMemoryRequirements requirements,uint32_t flags,VkImage image) {
    if(failure.owner==this&&!failure.stage)failure={this,stage,result,total,requirements.size,live.size(),flags,image!=VK_NULL_HANDLE};
    return result;
  }
  VkResult allocate(VkMemoryRequirements requirements,VkMemoryPropertyFlags required,VkMemoryPropertyFlags preferred,
                    uint32_t flags,VkImage image,VkBuffer buffer,skgpu::VulkanBackendMemory* output) {
    std::lock_guard lock(mutex);
    if(flags&kProtected_AllocationPropertyFlag)return reject("protected-policy",VK_ERROR_OUT_OF_DEVICE_MEMORY,requirements,flags,image);
    if(total>256*1024*1024||requirements.size>256*1024*1024-total)return reject("budget",VK_ERROR_OUT_OF_DEVICE_MEMORY,requirements,flags,image);
    uint32_t index=UINT32_MAX;
    for(uint32_t i=0;i<types.memoryTypeCount;++i) {
      const auto properties=types.memoryTypes[i].propertyFlags;
      if((requirements.memoryTypeBits&(1u<<i))&&(properties&required)==required) {
        if(index==UINT32_MAX)index=i;
        if((properties&preferred)==preferred){index=i;break;}
      }
    }
    if(index==UINT32_MAX)return reject("memory-type",VK_ERROR_FEATURE_NOT_PRESENT,requirements,flags,image);
    VkMemoryDedicatedAllocateInfo dedicated{VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO};dedicated.image=image;dedicated.buffer=buffer;
    VkMemoryAllocateInfo info{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};info.pNext=&dedicated;info.allocationSize=requirements.size;info.memoryTypeIndex=index;
    Allocation value;value.size=requirements.size;const auto properties=types.memoryTypes[index].propertyFlags;
    if(properties&VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT)value.flags|=skgpu::VulkanAlloc::kMappable_Flag;
    if(!(properties&VK_MEMORY_PROPERTY_HOST_COHERENT_BIT))value.flags|=skgpu::VulkanAlloc::kNoncoherent_Flag;
    const auto result=api.get<PFN_vkAllocateMemory>("vkAllocateMemory")(api.device,&info,nullptr,&value.memory);
    if(result!=VK_SUCCESS)return reject("vkAllocateMemory",result,requirements,flags,image);
    value.persistent=(flags&kPersistentlyMapped_AllocationPropertyFlag)!=0;
    if(value.persistent) {
      const auto mapped=api.get<PFN_vkMapMemory>("vkMapMemory")(api.device,value.memory,0,VK_WHOLE_SIZE,0,&value.mapped);
      if(mapped!=VK_SUCCESS){api.get<PFN_vkFreeMemory>("vkFreeMemory")(api.device,value.memory,nullptr);return reject("vkMapMemory",mapped,requirements,flags,image);}
    }
    const auto id=static_cast<skgpu::VulkanBackendMemory>(next++);
    try {live.emplace(id,value);}catch(...){if(value.mapped)api.get<PFN_vkUnmapMemory>("vkUnmapMemory")(api.device,value.memory);api.get<PFN_vkFreeMemory>("vkFreeMemory")(api.device,value.memory,nullptr);return VK_ERROR_OUT_OF_HOST_MEMORY;}
    total+=value.size;*output=id;return VK_SUCCESS;
  }
 public:
  void beginReplay(){failure={this};}
  std::string replayFailure()const {
    if(failure.owner!=this||!failure.stage)return {};
    return " allocator stage="+std::string(failure.stage)+" result="+std::to_string(failure.result)+" total="+std::to_string(failure.total)+" request="+std::to_string(failure.request)+" count="+std::to_string(failure.count)+" flags="+std::to_string(failure.flags)+" image="+std::to_string(failure.image);
  }
  Allocator(const Dispatch& value,VkPhysicalDevice physical):api(value) {
    auto function=reinterpret_cast<PFN_vkGetPhysicalDeviceMemoryProperties>(api.instanceProc(api.instance,"vkGetPhysicalDeviceMemoryProperties"));
    if(!function)throw std::runtime_error("Vulkan memory properties symbol unavailable");function(physical,&types);
  }
  VkResult allocateImageMemory(VkImage image,uint32_t flags,skgpu::VulkanBackendMemory* memory) override {
    VkMemoryRequirements requirements{};api.get<PFN_vkGetImageMemoryRequirements>("vkGetImageMemoryRequirements")(api.device,image,&requirements);
    return allocate(requirements,0,VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,flags,image,VK_NULL_HANDLE,memory);
  }
  VkResult allocateBufferMemory(VkBuffer buffer,BufferUsage usage,uint32_t flags,skgpu::VulkanBackendMemory* memory) override {
    VkMemoryRequirements requirements{};api.get<PFN_vkGetBufferMemoryRequirements>("vkGetBufferMemoryRequirements")(api.device,buffer,&requirements);
    const bool host=usage!=BufferUsage::kGpuOnly;
    return allocate(requirements,host?VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT:0,host?VK_MEMORY_PROPERTY_HOST_COHERENT_BIT:VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,flags,VK_NULL_HANDLE,buffer,memory);
  }
  void getAllocInfo(const skgpu::VulkanBackendMemory& memory,skgpu::VulkanAlloc* output) const override {
    std::lock_guard lock(mutex);const auto& value=live.at(memory);output->fMemory=value.memory;output->fOffset=0;output->fSize=value.size;output->fFlags=value.flags;output->fBackendMemory=memory;
  }
  VkResult mapMemory(const skgpu::VulkanBackendMemory& memory,void** data) override {
    std::lock_guard lock(mutex);auto& value=live.at(memory);
    if(!value.mapped){const auto result=api.get<PFN_vkMapMemory>("vkMapMemory")(api.device,value.memory,0,VK_WHOLE_SIZE,0,&value.mapped);if(result!=VK_SUCCESS)return result;}
    *data=value.mapped;return VK_SUCCESS;
  }
  void unmapMemory(const skgpu::VulkanBackendMemory& memory) override {
    std::lock_guard lock(mutex);auto& value=live.at(memory);if(value.mapped&&!value.persistent){api.get<PFN_vkUnmapMemory>("vkUnmapMemory")(api.device,value.memory);value.mapped=nullptr;}
  }
  VkResult flushMemory(const skgpu::VulkanBackendMemory& memory,VkDeviceSize,VkDeviceSize) override {
    std::lock_guard lock(mutex);const auto& value=live.at(memory);if(!(value.flags&skgpu::VulkanAlloc::kNoncoherent_Flag))return VK_SUCCESS;
    VkMappedMemoryRange range{VK_STRUCTURE_TYPE_MAPPED_MEMORY_RANGE};range.memory=value.memory;range.size=VK_WHOLE_SIZE;
    return api.get<PFN_vkFlushMappedMemoryRanges>("vkFlushMappedMemoryRanges")(api.device,1,&range);
  }
  VkResult invalidateMemory(const skgpu::VulkanBackendMemory& memory,VkDeviceSize,VkDeviceSize) override {
    std::lock_guard lock(mutex);const auto& value=live.at(memory);if(!(value.flags&skgpu::VulkanAlloc::kNoncoherent_Flag))return VK_SUCCESS;
    VkMappedMemoryRange range{VK_STRUCTURE_TYPE_MAPPED_MEMORY_RANGE};range.memory=value.memory;range.size=VK_WHOLE_SIZE;
    return api.get<PFN_vkInvalidateMappedMemoryRanges>("vkInvalidateMappedMemoryRanges")(api.device,1,&range);
  }
  void freeMemory(const skgpu::VulkanBackendMemory& memory) override {
    std::lock_guard lock(mutex);const auto value=live.at(memory);if(value.mapped)api.get<PFN_vkUnmapMemory>("vkUnmapMemory")(api.device,value.memory);api.get<PFN_vkFreeMemory>("vkFreeMemory")(api.device,value.memory,nullptr);total-=value.size;live.erase(memory);
  }
  std::pair<uint64_t,uint64_t> totalAllocatedAndUsedMemory() const override {std::lock_guard lock(mutex);return {total,total};}
  uint64_t count() const {std::lock_guard lock(mutex);return live.size();}
};
struct Device::Impl {
  Dispatch api;
#ifdef _WIN32
  HMODULE loader{};
#else
  void* loader{};
#endif
  VkPhysicalDevice physical{};
  VkQueue queue{};
  uint32_t graphics=UINT32_MAX;
  VkPhysicalDeviceFeatures features{};
  skgpu::VulkanExtensions extensions;
  VkPhysicalDeviceProperties properties{};
  sk_sp<Allocator> allocator;
  std::unique_ptr<skgpu::graphite::Context> context;
  VkSurfaceKHR windowSurface{};
  VkSwapchainKHR swapchain{};
  VkFence acquireFence{};
  struct WindowImage {sk_sp<SkSurface> surface;VkSemaphore rendered{};VkFence presented{};bool pending=false;};
  std::vector<WindowImage> windowImages;
  VkExtent2D extent{};
  bool drained=false;
#if defined(__linux__)
  #include "dmabuf.inc"
#endif
  ~Impl() {
    // Device's checked release runs first. Construction failures have no swapchain/presents.
    if(context){context->submit(skgpu::graphite::SyncToCpu::kYes);context.reset();}
    allocator.reset();
    if(api.device){auto idle=reinterpret_cast<PFN_vkDeviceWaitIdle>(api.find("vkDeviceWaitIdle"));if(idle)idle(api.device);auto destroy=reinterpret_cast<PFN_vkDestroyDevice>(api.find("vkDestroyDevice"));if(destroy)destroy(api.device,nullptr);api.device={};}
    if(windowSurface){api.get<PFN_vkDestroySurfaceKHR>("vkDestroySurfaceKHR")(api.instance,windowSurface,nullptr);}
    if(api.instance){auto destroy=reinterpret_cast<PFN_vkDestroyInstance>(api.instanceProc(api.instance,"vkDestroyInstance"));if(destroy)destroy(api.instance,nullptr);}
#ifdef _WIN32
    if(loader)FreeLibrary(loader);
#else
    if(loader)dlclose(loader);
#endif
  }
  bool win32Interop=false;
#ifdef _WIN32
  std::array<uint8_t,8> winLuid{};
  #include "win32_import.inc"
#endif
  void initialize(WindowTarget target,const DmaBufDeviceOptions* dmaOptions=nullptr,const Win32DeviceOptions* winOptions=nullptr) {
    if(winOptions) {
#ifdef _WIN32
      if(target.kind!=WindowKind::None || dmaOptions || std::all_of(winOptions->adapterLuid.begin(),winOptions->adapterLuid.end(),[](auto byte){return byte==0;}))
        throw std::runtime_error("Windows Composition requires one explicit nonzero DXGI LUID and no WSI target");
#else
      throw std::runtime_error("Windows external texture/fence import requires Windows");
#endif
    }
    const auto borrowedWindow=target.window;
    if(target.kind==WindowKind::None&&(target.display||borrowedWindow))throw std::runtime_error("Invalid offscreen Vulkan target");
    if(target.kind!=WindowKind::None&&!borrowedWindow)throw std::runtime_error("Borrowed Vulkan window is null");
#ifdef _WIN32
    if(target.kind!=WindowKind::None&&target.kind!=WindowKind::Win32)throw std::runtime_error("Linux Vulkan window target requires Linux");
    loader=LoadLibraryExW(L"vulkan-1.dll",nullptr,LOAD_LIBRARY_SEARCH_SYSTEM32);
    if(loader)api.instanceProc=reinterpret_cast<PFN_vkGetInstanceProcAddr>(GetProcAddress(loader,"vkGetInstanceProcAddr"));
#else
    loader=dlopen("libvulkan.so.1",RTLD_NOW|RTLD_LOCAL);
    if(loader)api.instanceProc=reinterpret_cast<PFN_vkGetInstanceProcAddr>(dlsym(loader,"vkGetInstanceProcAddr"));
#endif
    if(!api.instanceProc)throw std::runtime_error("Native Vulkan loader unavailable; no renderer fallback");
    VkApplicationInfo application{VK_STRUCTURE_TYPE_APPLICATION_INFO};application.pApplicationName="Nelyx";application.apiVersion=VK_API_VERSION_1_1;
    VkInstanceCreateInfo instanceInfo{VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO};instanceInfo.pApplicationInfo=&application;
    std::vector<const char*> instanceExtensions;
#ifdef _WIN32
    if(borrowedWindow){
      const auto window=reinterpret_cast<HWND>(borrowedWindow);DWORD process=0;
      if(!IsWindow(window)||GetWindowThreadProcessId(window,&process)!=GetCurrentThreadId()||process!=GetCurrentProcessId())throw std::runtime_error("Vulkan borrowed HWND must be live on this process/UI owner");
      instanceExtensions={VK_KHR_SURFACE_EXTENSION_NAME,VK_KHR_WIN32_SURFACE_EXTENSION_NAME,VK_KHR_GET_SURFACE_CAPABILITIES_2_EXTENSION_NAME,VK_EXT_SURFACE_MAINTENANCE_1_EXTENSION_NAME};
    }
#else
    if(target.kind==WindowKind::Win32)throw std::runtime_error("This borrowed Vulkan surface currently supports Windows only");
    if(borrowedWindow){
      if(!target.display||(target.kind!=WindowKind::Xlib&&target.kind!=WindowKind::Wayland))throw std::runtime_error("Invalid Linux Vulkan display/window target");
      instanceExtensions={VK_KHR_SURFACE_EXTENSION_NAME,target.kind==WindowKind::Xlib?VK_KHR_XLIB_SURFACE_EXTENSION_NAME:VK_KHR_WAYLAND_SURFACE_EXTENSION_NAME,VK_KHR_GET_SURFACE_CAPABILITIES_2_EXTENSION_NAME,VK_EXT_SURFACE_MAINTENANCE_1_EXTENSION_NAME};
    }
#endif
    instanceInfo.enabledExtensionCount=static_cast<uint32_t>(instanceExtensions.size());instanceInfo.ppEnabledExtensionNames=instanceExtensions.data();
    checked(api.get<PFN_vkCreateInstance>("vkCreateInstance")(&instanceInfo,nullptr,&api.instance),"vkCreateInstance");
#ifdef _WIN32
    if(borrowedWindow){VkWin32SurfaceCreateInfoKHR surface{VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR};surface.hinstance=GetModuleHandleW(nullptr);surface.hwnd=reinterpret_cast<HWND>(borrowedWindow);checked(api.get<PFN_vkCreateWin32SurfaceKHR>("vkCreateWin32SurfaceKHR")(api.instance,&surface,nullptr,&windowSurface),"vkCreateWin32SurfaceKHR");}
#else
    if(target.kind==WindowKind::Xlib){VkXlibSurfaceCreateInfoKHR surface{VK_STRUCTURE_TYPE_XLIB_SURFACE_CREATE_INFO_KHR};surface.dpy=reinterpret_cast<Display*>(target.display);surface.window=static_cast<Window>(borrowedWindow);checked(api.get<PFN_vkCreateXlibSurfaceKHR>("vkCreateXlibSurfaceKHR")(api.instance,&surface,nullptr,&windowSurface),"vkCreateXlibSurfaceKHR");}
    if(target.kind==WindowKind::Wayland){VkWaylandSurfaceCreateInfoKHR surface{VK_STRUCTURE_TYPE_WAYLAND_SURFACE_CREATE_INFO_KHR};surface.display=reinterpret_cast<wl_display*>(target.display);surface.surface=reinterpret_cast<wl_surface*>(borrowedWindow);checked(api.get<PFN_vkCreateWaylandSurfaceKHR>("vkCreateWaylandSurfaceKHR")(api.instance,&surface,nullptr,&windowSurface),"vkCreateWaylandSurfaceKHR");}
#endif
    uint32_t count=0;auto enumerate=api.get<PFN_vkEnumeratePhysicalDevices>("vkEnumeratePhysicalDevices");checked(enumerate(api.instance,&count,nullptr),"vkEnumeratePhysicalDevices");
    std::vector<VkPhysicalDevice> devices(count);checked(enumerate(api.instance,&count,devices.data()),"vkEnumeratePhysicalDevices");
    for(auto candidate:devices) {
      VkPhysicalDeviceProperties candidateProperties{};api.get<PFN_vkGetPhysicalDeviceProperties>("vkGetPhysicalDeviceProperties")(candidate,&candidateProperties);
      if(candidateProperties.apiVersion<VK_API_VERSION_1_1||candidateProperties.deviceType==VK_PHYSICAL_DEVICE_TYPE_CPU)continue;
#ifdef _WIN32
      if(winOptions) {
        VkPhysicalDeviceIDProperties identity{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_ID_PROPERTIES};
        VkPhysicalDeviceProperties2 properties2{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_PROPERTIES_2};properties2.pNext=&identity;
        api.get<PFN_vkGetPhysicalDeviceProperties2>("vkGetPhysicalDeviceProperties2")(candidate,&properties2);
        if(!identity.deviceLUIDValid || std::memcmp(identity.deviceLUID,winOptions->adapterLuid.data(),winOptions->adapterLuid.size()))continue;
        uint32_t extensionCount=0;auto enumerate=api.get<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");
        checked(enumerate(candidate,nullptr,&extensionCount,nullptr),"Windows Vulkan extension count");
        std::vector<VkExtensionProperties> available(extensionCount);checked(enumerate(candidate,nullptr,&extensionCount,available.data()),"Windows Vulkan extensions");
        const auto has=[&](const char* name){return std::any_of(available.begin(),available.end(),[&](const auto& extension){return std::string_view(extension.extensionName)==name;});};
        if(!has(VK_KHR_EXTERNAL_MEMORY_WIN32_EXTENSION_NAME) || !has(VK_KHR_EXTERNAL_SEMAPHORE_WIN32_EXTENSION_NAME))
          throw std::runtime_error("Selected DXGI/Vulkan adapter lacks Windows external memory/fence extensions");
        VkPhysicalDeviceExternalImageFormatInfo external{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_EXTERNAL_IMAGE_FORMAT_INFO};external.handleType=VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_BIT;
        VkPhysicalDeviceImageFormatInfo2 format{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_FORMAT_INFO_2};format.pNext=&external;
        format.format=VK_FORMAT_B8G8R8A8_UNORM;format.type=VK_IMAGE_TYPE_2D;format.tiling=VK_IMAGE_TILING_OPTIMAL;
        format.usage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT|VK_IMAGE_USAGE_SAMPLED_BIT|VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;
        VkExternalImageFormatProperties imported{VK_STRUCTURE_TYPE_EXTERNAL_IMAGE_FORMAT_PROPERTIES};
        VkImageFormatProperties2 supported{VK_STRUCTURE_TYPE_IMAGE_FORMAT_PROPERTIES_2};supported.pNext=&imported;
        checked(api.get<PFN_vkGetPhysicalDeviceImageFormatProperties2>("vkGetPhysicalDeviceImageFormatProperties2")(candidate,&format,&supported),"Selected adapter D3D11 texture format");
        const auto& memory=imported.externalMemoryProperties;
        if(!(memory.externalMemoryFeatures&VK_EXTERNAL_MEMORY_FEATURE_IMPORTABLE_BIT) || !(memory.compatibleHandleTypes&VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_BIT))
          throw std::runtime_error("Selected DXGI/Vulkan adapter cannot import required BGRA8 D3D11 textures");
        VkPhysicalDeviceExternalSemaphoreInfo semaphore{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_EXTERNAL_SEMAPHORE_INFO};semaphore.handleType=VK_EXTERNAL_SEMAPHORE_HANDLE_TYPE_D3D12_FENCE_BIT;
        VkExternalSemaphoreProperties payload{VK_STRUCTURE_TYPE_EXTERNAL_SEMAPHORE_PROPERTIES};
        api.get<PFN_vkGetPhysicalDeviceExternalSemaphoreProperties>("vkGetPhysicalDeviceExternalSemaphoreProperties")(candidate,&semaphore,&payload);
        if(!(payload.externalSemaphoreFeatures&VK_EXTERNAL_SEMAPHORE_FEATURE_IMPORTABLE_BIT) || !(payload.compatibleHandleTypes&VK_EXTERNAL_SEMAPHORE_HANDLE_TYPE_D3D12_FENCE_BIT))
          throw std::runtime_error("Selected DXGI/Vulkan adapter cannot import the D3D fence payload");
      }
#endif
#if defined(__linux__)
      if(dmaOptions && !selectDmaBuf(candidate,*dmaOptions))continue;
#else
      if(dmaOptions)throw std::runtime_error("DMA-BUF export requires Linux");
#endif
      if(windowSurface){
        uint32_t extensionCount=0;auto enumerateExtensions=api.get<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");checked(enumerateExtensions(candidate,nullptr,&extensionCount,nullptr),"vkEnumerateDeviceExtensionProperties");std::vector<VkExtensionProperties> available(extensionCount);checked(enumerateExtensions(candidate,nullptr,&extensionCount,available.data()),"vkEnumerateDeviceExtensionProperties");
        const auto has=[&](const char* name){return std::any_of(available.begin(),available.end(),[&](const auto& extension){return std::string_view(extension.extensionName)==name;});};
        if(!has(VK_KHR_SWAPCHAIN_EXTENSION_NAME)||!has(VK_EXT_SWAPCHAIN_MAINTENANCE_1_EXTENSION_NAME))continue;
        VkPhysicalDeviceSwapchainMaintenance1FeaturesEXT maintenance{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_SWAPCHAIN_MAINTENANCE_1_FEATURES_EXT};VkPhysicalDeviceFeatures2 queried{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_FEATURES_2};queried.pNext=&maintenance;api.get<PFN_vkGetPhysicalDeviceFeatures2>("vkGetPhysicalDeviceFeatures2")(candidate,&queried);
        if(!maintenance.swapchainMaintenance1)continue;
      }
      uint32_t queueCount=0;auto queues=api.get<PFN_vkGetPhysicalDeviceQueueFamilyProperties>("vkGetPhysicalDeviceQueueFamilyProperties");queues(candidate,&queueCount,nullptr);std::vector<VkQueueFamilyProperties> families(queueCount);queues(candidate,&queueCount,families.data());
      for(uint32_t i=0;i<queueCount;++i)if(families[i].queueCount&&(families[i].queueFlags&VK_QUEUE_GRAPHICS_BIT)){
        if(windowSurface){VkBool32 present=false;checked(api.get<PFN_vkGetPhysicalDeviceSurfaceSupportKHR>("vkGetPhysicalDeviceSurfaceSupportKHR")(candidate,i,windowSurface,&present),"vkGetPhysicalDeviceSurfaceSupportKHR");if(!present)continue;}
        physical=candidate;properties=candidateProperties;graphics=i;break;
      }
      if(physical)break;
    }
    if(!physical)throw std::runtime_error(winOptions?"Requested DXGI LUID has no matching hardware Vulkan graphics queue; no adapter fallback":windowSurface?"No Vulkan GPU with same graphics/present queue and swapchainMaintenance1; no renderer fallback":"Native Vulkan 1.1 GPU/graphics queue unavailable; no CPU fallback");
    api.get<PFN_vkGetPhysicalDeviceFeatures>("vkGetPhysicalDeviceFeatures")(physical,&features);
    const float priority=1;VkDeviceQueueCreateInfo queueInfo{VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO};queueInfo.queueFamilyIndex=graphics;queueInfo.queueCount=1;queueInfo.pQueuePriorities=&priority;
    std::vector<const char*> enabledExtensions;
    auto enumerateExtensions=api.get<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");uint32_t extensionCount=0;
    checked(enumerateExtensions(physical,nullptr,&extensionCount,nullptr),"vkEnumerateDeviceExtensionProperties");std::vector<VkExtensionProperties> available(extensionCount);checked(enumerateExtensions(physical,nullptr,&extensionCount,available.data()),"vkEnumerateDeviceExtensionProperties");
    for(const auto& extension:available)if(std::string_view(extension.extensionName)==VK_KHR_DRIVER_PROPERTIES_EXTENSION_NAME)enabledExtensions.push_back(VK_KHR_DRIVER_PROPERTIES_EXTENSION_NAME);
#ifdef _WIN32
    if(winOptions) {enabledExtensions.push_back(VK_KHR_EXTERNAL_MEMORY_WIN32_EXTENSION_NAME);enabledExtensions.push_back(VK_KHR_EXTERNAL_SEMAPHORE_WIN32_EXTENSION_NAME);win32Interop=true;winLuid=winOptions->adapterLuid;}
#endif
#if defined(__linux__)
    if(dmaOptions) {
      for(auto name:dmaExtensions)enabledExtensions.push_back(name);
      dmaEnabled=true;
    }
#endif
    VkPhysicalDeviceSwapchainMaintenance1FeaturesEXT maintenance{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_SWAPCHAIN_MAINTENANCE_1_FEATURES_EXT};
    if(windowSurface){enabledExtensions.push_back(VK_KHR_SWAPCHAIN_EXTENSION_NAME);enabledExtensions.push_back(VK_EXT_SWAPCHAIN_MAINTENANCE_1_EXTENSION_NAME);maintenance.swapchainMaintenance1=VK_TRUE;}
    VkDeviceCreateInfo deviceInfo{VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO};deviceInfo.queueCreateInfoCount=1;deviceInfo.pQueueCreateInfos=&queueInfo;deviceInfo.pEnabledFeatures=&features;deviceInfo.enabledExtensionCount=static_cast<uint32_t>(enabledExtensions.size());deviceInfo.ppEnabledExtensionNames=enabledExtensions.data();
    if(windowSurface)deviceInfo.pNext=&maintenance;
    api.deviceProc=reinterpret_cast<PFN_vkGetDeviceProcAddr>(api.instanceProc(api.instance,"vkGetDeviceProcAddr"));
    if(!api.deviceProc)throw std::runtime_error("vkGetDeviceProcAddr unavailable");
    checked(api.get<PFN_vkCreateDevice>("vkCreateDevice")(physical,&deviceInfo,nullptr,&api.device),"vkCreateDevice");
    api.get<PFN_vkGetDeviceQueue>("vkGetDeviceQueue")(api.device,graphics,0,&queue);
    allocator=sk_make_sp<Allocator>(api,physical);
    skgpu::VulkanBackendContext backend;backend.fInstance=api.instance;backend.fPhysicalDevice=physical;backend.fDevice=api.device;backend.fQueue=queue;backend.fGraphicsQueueIndex=graphics;backend.fMaxAPIVersion=VK_API_VERSION_1_1;backend.fDeviceFeatures=&features;backend.fMemoryAllocator=allocator;
    backend.fGetProc=[this](const char* name,VkInstance instance,VkDevice device){return device?api.deviceProc(device,name):api.instanceProc(instance,name);};
    extensions.init(backend.fGetProc,api.instance,physical,static_cast<uint32_t>(instanceExtensions.size()),instanceExtensions.data(),static_cast<uint32_t>(enabledExtensions.size()),enabledExtensions.data());backend.fVkExtensions=&extensions;
    skgpu::graphite::ContextOptions options;options.fGpuBudgetInBytes=32*1024*1024;
#ifdef _WIN32
    // A 1600x1200 backing needs about 71MiB of reusable MSAA scratch on the
    // selected device. Keep that working set recent instead of reallocating it
    // every frame; the allocator's separate 256MiB hard cap remains unchanged.
    options.fGpuBudgetInBytes=96*1024*1024;
#endif
    context=skgpu::graphite::ContextFactory::MakeVulkan(backend,options);
    if(!context||context->backend()!=skgpu::BackendApi::kVulkan)throw std::runtime_error("Graphite/native Vulkan context unavailable");
  }
  void waitPresent(WindowImage& image){
    if(!image.pending)return;
    checked(api.get<PFN_vkWaitForFences>("vkWaitForFences")(api.device,1,&image.presented,VK_TRUE,5000000000ull),"Vulkan presentation resource fence");
    image.pending=false;
  }
  void releaseWindow(skgpu::graphite::Recorder* recorder){
    for(auto& image:windowImages)waitPresent(image);
    // Drop an abandoned pre-insertion draw before freeing its wrapped image. Asset
    // uploads are completed by loadAssetBytes, so no live upload is discarded here.
    if(recorder&&swapchain){auto abandoned=recorder->snap();abandoned.reset();}
    if(context&&!context->submit(skgpu::graphite::SyncToCpu::kYes))throw std::runtime_error("Window GPU drain failed");
    for(auto& image:windowImages)if(image.surface){image.surface.reset();}
    if(recorder)recorder->freeGpuResources();if(context)context->freeGpuResources();
    for(auto& image:windowImages){if(image.rendered){api.get<PFN_vkDestroySemaphore>("vkDestroySemaphore")(api.device,image.rendered,nullptr);}if(image.presented){api.get<PFN_vkDestroyFence>("vkDestroyFence")(api.device,image.presented,nullptr);}}
    windowImages.clear();
    if(acquireFence){api.get<PFN_vkDestroyFence>("vkDestroyFence")(api.device,acquireFence,nullptr);acquireFence={};}
    if(swapchain){api.get<PFN_vkDestroySwapchainKHR>("vkDestroySwapchainKHR")(api.device,swapchain,nullptr);swapchain={};}
    extent={};
  }
  void resizeWindow(skgpu::graphite::Recorder* recorder,uint32_t width,uint32_t height){
    if(!windowSurface)return;
    if(swapchain&&extent.width==width&&extent.height==height)return;
    releaseWindow(recorder);if(!width||!height)return;
    VkSurfaceCapabilitiesKHR caps{};checked(api.get<PFN_vkGetPhysicalDeviceSurfaceCapabilitiesKHR>("vkGetPhysicalDeviceSurfaceCapabilitiesKHR")(physical,windowSurface,&caps),"vkGetPhysicalDeviceSurfaceCapabilitiesKHR");
    if(width<caps.minImageExtent.width||width>caps.maxImageExtent.width||height<caps.minImageExtent.height||height>caps.maxImageExtent.height)throw std::runtime_error("Vulkan window dimensions outside surface limits");
    extent=caps.currentExtent.width==UINT32_MAX?VkExtent2D{width,height}:caps.currentExtent;
    if(extent.width!=width||extent.height!=height)throw std::runtime_error("Vulkan surface metrics changed before reconfigure");
    uint32_t count=0;auto getFormats=api.get<PFN_vkGetPhysicalDeviceSurfaceFormatsKHR>("vkGetPhysicalDeviceSurfaceFormatsKHR");checked(getFormats(physical,windowSurface,&count,nullptr),"surface formats");std::vector<VkSurfaceFormatKHR> formats(count);checked(getFormats(physical,windowSurface,&count,formats.data()),"surface formats");
    auto found=std::find_if(formats.begin(),formats.end(),[](const auto& value){return (value.format==VK_FORMAT_B8G8R8A8_UNORM||value.format==VK_FORMAT_R8G8B8A8_UNORM)&&value.colorSpace==VK_COLOR_SPACE_SRGB_NONLINEAR_KHR;});
    if(found==formats.end())throw std::runtime_error("Vulkan RGBA/BGRA UNORM window surface unavailable");
    VkImageUsageFlags usage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;
    if((caps.supportedUsageFlags&usage)!=usage)throw std::runtime_error("Vulkan window image usage unavailable");
    if(caps.supportedUsageFlags&VK_IMAGE_USAGE_SAMPLED_BIT)usage|=VK_IMAGE_USAGE_SAMPLED_BIT;
    if(caps.supportedUsageFlags&VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT)usage|=VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT;
    VkSwapchainCreateInfoKHR info{VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR};info.surface=windowSurface;info.minImageCount=caps.minImageCount+1;if(caps.maxImageCount)info.minImageCount=std::min(info.minImageCount,caps.maxImageCount);
    if(info.minImageCount>8)throw std::runtime_error("Vulkan swapchain image budget exceeded");
    info.imageFormat=found->format;info.imageColorSpace=found->colorSpace;info.imageExtent=extent;info.imageArrayLayers=1;info.imageUsage=usage;info.imageSharingMode=VK_SHARING_MODE_EXCLUSIVE;info.preTransform=caps.currentTransform;info.compositeAlpha=VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;info.presentMode=VK_PRESENT_MODE_FIFO_KHR;info.clipped=VK_TRUE;
    if(!(caps.supportedCompositeAlpha&info.compositeAlpha))throw std::runtime_error("Vulkan opaque surface unavailable");
    checked(api.get<PFN_vkCreateSwapchainKHR>("vkCreateSwapchainKHR")(api.device,&info,nullptr,&swapchain),"vkCreateSwapchainKHR");
    auto getImages=api.get<PFN_vkGetSwapchainImagesKHR>("vkGetSwapchainImagesKHR");checked(getImages(api.device,swapchain,&count,nullptr),"swapchain images");if(!count||count>8)throw std::runtime_error("Vulkan swapchain image budget exceeded");std::vector<VkImage> images(count);checked(getImages(api.device,swapchain,&count,images.data()),"swapchain images");windowImages.resize(count);
    for(uint32_t i=0;i<count;++i){
      auto& image=windowImages[i];VkSemaphoreCreateInfo semaphore{VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO};checked(api.get<PFN_vkCreateSemaphore>("vkCreateSemaphore")(api.device,&semaphore,nullptr,&image.rendered),"render semaphore");
      VkFenceCreateInfo fence{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};checked(api.get<PFN_vkCreateFence>("vkCreateFence")(api.device,&fence,nullptr,&image.presented),"present fence");
      skgpu::graphite::VulkanTextureInfo texture;texture.fFormat=found->format;texture.fImageUsageFlags=usage;
      auto backend=skgpu::graphite::BackendTextures::MakeVulkan(SkISize::Make(width,height),texture,VK_IMAGE_LAYOUT_UNDEFINED,graphics,images[i],skgpu::VulkanAlloc());
      image.surface=SkSurfaces::WrapBackendTexture(recorder,backend,nullptr,nullptr);if(!image.surface)throw std::runtime_error("Graphite Vulkan swapchain surface wrapping failed");
    }
    VkFenceCreateInfo fence{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};checked(api.get<PFN_vkCreateFence>("vkCreateFence")(api.device,&fence,nullptr,&acquireFence),"acquire fence");
  }
  void present(skgpu::graphite::Recorder* recorder,SkSurface* offscreen){
    if(!swapchain||!offscreen)throw std::runtime_error("Vulkan window surface unavailable");
    uint32_t index=0;checked(api.get<PFN_vkResetFences>("vkResetFences")(api.device,1,&acquireFence),"reset acquire fence");
    auto acquired=api.get<PFN_vkAcquireNextImageKHR>("vkAcquireNextImageKHR")(api.device,swapchain,1000000000ull,VK_NULL_HANDLE,acquireFence,&index);
    if(acquired!=VK_SUCCESS&&acquired!=VK_SUBOPTIMAL_KHR)checked(acquired,"vkAcquireNextImageKHR");
    checked(api.get<PFN_vkWaitForFences>("vkWaitForFences")(api.device,1,&acquireFence,VK_TRUE,5000000000ull),"Vulkan acquire fence");
    auto& image=windowImages.at(index);waitPresent(image);
    bool insertionAttempted=false;
    try{
      // This owner submits synchronously before any next-frame mutation of the shared backing.
      auto snapshot=SkSurfaces::AsImage(sk_ref_sp(offscreen));if(!snapshot)throw std::runtime_error("Graphite offscreen image unavailable");image.surface->getCanvas()->drawImage(snapshot,0,0);
      auto recording=recorder->snap();if(!recording)throw std::runtime_error("Graphite window recording unavailable");
      skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=recording.get();insert.fTargetSurface=image.surface.get();auto state=skgpu::MutableTextureStates::MakeVulkan(VK_IMAGE_LAYOUT_PRESENT_SRC_KHR,graphics);insert.fTargetTextureState=&state;
      auto signal=skgpu::graphite::BackendSemaphores::MakeVulkan(image.rendered);insert.fNumSignalSemaphores=1;insert.fSignalSemaphores=&signal;
      insertionAttempted=true;
      if(context->insertRecording(insert)!=skgpu::graphite::InsertStatus::kSuccess)throw std::runtime_error("Graphite window recording rejected");
      if(!context->submit(skgpu::graphite::SyncToCpu::kYes))throw std::runtime_error("Graphite window GPU submit failed");
      checked(api.get<PFN_vkResetFences>("vkResetFences")(api.device,1,&image.presented),"reset present fence");
      VkSwapchainPresentFenceInfoEXT fences{VK_STRUCTURE_TYPE_SWAPCHAIN_PRESENT_FENCE_INFO_EXT};fences.swapchainCount=1;fences.pFences=&image.presented;
      VkPresentInfoKHR present{VK_STRUCTURE_TYPE_PRESENT_INFO_KHR};present.pNext=&fences;present.waitSemaphoreCount=1;present.pWaitSemaphores=&image.rendered;present.swapchainCount=1;present.pSwapchains=&swapchain;present.pImageIndices=&index;
      image.pending=true;const auto result=api.get<PFN_vkQueuePresentKHR>("vkQueuePresentKHR")(queue,&present);waitPresent(image);
      if(result!=VK_SUCCESS&&result!=VK_SUBOPTIMAL_KHR)checked(result,"vkQueuePresentKHR");
    }catch(...){
      // Before submission the image has no presentation request; return its acquisition.
      if(!insertionAttempted){VkReleaseSwapchainImagesInfoEXT release{VK_STRUCTURE_TYPE_RELEASE_SWAPCHAIN_IMAGES_INFO_EXT};release.swapchain=swapchain;release.imageIndexCount=1;release.pImageIndices=&index;api.get<PFN_vkReleaseSwapchainImagesEXT>("vkReleaseSwapchainImagesEXT")(api.device,&release);}
      throw;
    }
  }
};
Device::Device(uint64_t window):Device(WindowTarget{window?WindowKind::Win32:WindowKind::None,0,window}){}
Device::Device(WindowTarget target):impl(std::make_unique<Impl>()){impl->initialize(target);}
Device::Device(DmaBufDeviceOptions options):impl(std::make_unique<Impl>()) {
  if(options.modifiers.empty() || options.modifiers.size()>256)
    throw std::runtime_error("DMA-BUF requires 1..256 display format modifiers");
  impl->initialize(WindowTarget{},&options);
}
Device::Device(Win32DeviceOptions options):impl(std::make_unique<Impl>()){impl->initialize({},nullptr,&options);}
Device::~Device(){try{impl->releaseWindow(nullptr);}catch(...){impl.release();/* Retain native owners when completion is uncertain. */}}
skgpu::graphite::Context* Device::context() const {if(impl->drained||!impl->context||win32ImportPoisoned())throw std::runtime_error("Vulkan context unavailable, poisoned or owner drained");return impl->context.get();}
std::string Device::name() const{return impl->properties.deviceName;}
std::string Device::description() const{
 const auto& value=impl->properties;
 return name()+" / vendor="+std::to_string(value.vendorID)+" / driver="+std::to_string(value.driverVersion)+" / Vulkan 1.1 (physical "+std::to_string(VK_API_VERSION_MAJOR(value.apiVersion))+"."+std::to_string(VK_API_VERSION_MINOR(value.apiVersion))+"."+std::to_string(VK_API_VERSION_PATCH(value.apiVersion))+") / graphics"+(hasWindow()?std::string("+present"):std::string())+" queue="+std::to_string(impl->graphics);
}
uint32_t Device::vendor() const{return impl->properties.vendorID;}
uint32_t Device::deviceType() const{return impl->properties.deviceType;}
std::pair<uint64_t,uint64_t> Device::allocations() const{
  auto count=impl->allocator->count(),bytes=impl->allocator->totalAllocatedAndUsedMemory().first;
#if defined(__linux__)
  count+=impl->dmaAllocations.load();bytes+=impl->dmaBytes.load();
#elif defined(_WIN32)
  count+=impl->winAllocations.load();bytes+=impl->winBytes.load();
#endif
  return {count,bytes};
}
bool Device::hasWindow() const{return impl->windowSurface!=VK_NULL_HANDLE;}
bool Device::canImportWin32Texture() const {
#ifdef _WIN32
  return !impl->drained && impl->win32Interop && !impl->winPoisoned.load() && impl->winFrames.accepting();
#else
  return false;
#endif
}
bool Device::win32ImportPoisoned() const {
#ifdef _WIN32
  return impl->winPoisoned.load();
#else
  return false;
#endif
}
uint32_t Device::outstandingWin32Frames() const {
#ifdef _WIN32
  return impl->winFrames.outstanding();
#else
  return 0;
#endif
}
Win32Frame::Win32Frame(uint32_t width,uint32_t height,uint64_t signal,std::shared_ptr<void> native,
    std::function<void(uint64_t)> retire,std::function<bool()> retired,std::function<bool()> retain,
    std::function<void()> awaitProducer,std::function<void()> finishProducer)
  :width(width),height(height),producerFenceValue(signal),native(std::move(native)),retireNative(std::move(retire)),
   retiredNative(std::move(retired)),retainNative(std::move(retain)),awaitProducerNative(std::move(awaitProducer)),
   finishProducerNative(std::move(finishProducer)),retention(std::make_unique<std::shared_ptr<void>>(this->native)){}
Win32Frame::~Win32Frame(){if(retainNative && retainNative())retention.release();}
void Win32Frame::retire(uint64_t value) const {retireNative(value);}
bool Win32Frame::isRetired() const{return retiredNative();}
void Win32Frame::awaitProducer() const{awaitProducerNative();}
void Win32Frame::finishProducer() const{finishProducerNative();}
std::shared_ptr<const Win32Frame> Device::renderWin32Frame(std::unique_ptr<skgpu::graphite::Recorder> recorder,
    Win32TextureTarget target,std::function<void(SkCanvas*)> draw,const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings,bool deferCompletion) {
#ifdef _WIN32
  if(impl->drained)throw std::runtime_error("Windows Vulkan owner is drained");
  auto frame=impl->renderWin32Frame(shared_from_this(),std::move(recorder),target,std::move(draw),recordings);
  if(!deferCompletion){frame->awaitProducer();frame->finishProducer();}
  return frame;
#else
  throw std::runtime_error("Windows texture/fence import requires Windows");
#endif
}
void Device::resizeWindow(skgpu::graphite::Recorder* recorder,uint32_t width,uint32_t height){if(impl->drained)throw std::runtime_error("Vulkan owner drained");impl->resizeWindow(recorder,width,height);}
void Device::present(skgpu::graphite::Recorder* recorder,SkSurface* surface){if(impl->drained)throw std::runtime_error("Vulkan owner drained");impl->present(recorder,surface);}
void Device::releaseWindow(skgpu::graphite::Recorder* recorder){impl->releaseWindow(recorder);}
void Device::retire(){if(!context()->submit(skgpu::graphite::SyncToCpu::kYes))throw std::runtime_error("Graphite GPU submit failed");checked(impl->api.get<PFN_vkQueueWaitIdle>("vkQueueWaitIdle")(impl->queue),"vkQueueWaitIdle");}
uint32_t Device::outstandingDmaBufFrames() const {
#if defined(__linux__)
  return impl->dmaFrames.outstanding();
#else
  return 0;
#endif
}
std::shared_ptr<const DmaBufFrame> Device::exportDmaBufFrame(
    std::unique_ptr<skgpu::graphite::Recorder> recorder,uint32_t width,uint32_t height,
    const std::function<void(SkCanvas*)>& draw,const std::vector<skgpu::graphite::Recording*>& recordings) {
#if defined(__linux__)
  if(impl->drained)throw std::runtime_error("Vulkan owner drained");
  return impl->exportDmaBuf(shared_from_this(),std::move(recorder),width,height,draw,recordings);
#else
  throw std::runtime_error("DMA-BUF export requires Linux");
#endif
}
bool Device::canExportDmaBufFrame() const {
#if defined(__linux__)
  if(impl->dmaPoisoned)throw std::runtime_error("DMA-BUF exporter completion is unconfirmed");
  return !impl->drained && impl->dmaEnabled && impl->dmaFrames.accepting();
#else
  return false;
#endif
}
void Device::drain(){
  if(impl->drained)return;
#ifdef _WIN32
  if(impl->winPoisoned.load())throw std::runtime_error("Windows imported frame completion is unconfirmed; owner retained");
  if(!impl->winFrames.closeAndWait())throw std::runtime_error("Windows imported frame leases remain after bounded drain");
#endif
#if defined(__linux__)
  // Native window/producer quiescence precedes this creator-owner call. Only
  // native frame finalizers may signal it; never pump GTK or retire by timeout.
  if(!impl->dmaFrames.closeAndWait())
    throw std::runtime_error("Vulkan DMA-BUF frame leases remain after bounded drain");
#endif
  if(impl->context)retire();
  checked(impl->api.get<PFN_vkDeviceWaitIdle>("vkDeviceWaitIdle")(impl->api.device),"vkDeviceWaitIdle");impl->context.reset();
  if(impl->allocator->count()!=0)throw std::runtime_error("Vulkan resource owners remain at drain");
  impl->drained=true;
}
}
