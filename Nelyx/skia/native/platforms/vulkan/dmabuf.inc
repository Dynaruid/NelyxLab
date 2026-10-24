// SPDX-License-Identifier: BSD-3-Clause
// Device::Impl internals. Native Vulkan only; no GTK/RN/JS/runtime dependency.
// m153 Graphite keys only optimal/linear tiling. Draw into an owned optimal
// image, then GPU-copy into the modifier image; never misdescribe its tiling.
static constexpr VkImageUsageFlags dmaUsage=VK_IMAGE_USAGE_TRANSFER_DST_BIT|VK_IMAGE_USAGE_SAMPLED_BIT;
static constexpr VkImageUsageFlags drawUsage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_SAMPLED_BIT|
  VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT|VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;
static constexpr const char* dmaExtensions[]={VK_EXT_EXTERNAL_MEMORY_DMA_BUF_EXTENSION_NAME,
  VK_KHR_EXTERNAL_MEMORY_FD_EXTENSION_NAME,VK_EXT_IMAGE_DRM_FORMAT_MODIFIER_EXTENSION_NAME,
  VK_EXT_QUEUE_FAMILY_FOREIGN_EXTENSION_NAME,VK_KHR_IMAGE_FORMAT_LIST_EXTENSION_NAME};
bool dmaEnabled=false,dmaPoisoned=false;
uint64_t dmaModifier{};
VkExtent3D dmaExtent{},drawExtent{};
FrameLeaseGate dmaFrames;
std::atomic<uint32_t> dmaAllocations{};
std::atomic<uint64_t> dmaBytes{};

bool selectDmaBuf(VkPhysicalDevice candidate,const DmaBufDeviceOptions& options) {
  VkPhysicalDeviceProperties props{};api.get<PFN_vkGetPhysicalDeviceProperties>("vkGetPhysicalDeviceProperties")(candidate,&props);
  if(props.deviceType!=VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU && props.deviceType!=VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU)return false;
  uint32_t count{};auto enumerate=api.get<PFN_vkEnumerateDeviceExtensionProperties>("vkEnumerateDeviceExtensionProperties");
  checked(enumerate(candidate,nullptr,&count,nullptr),"DMA-BUF extension count");
  std::vector<VkExtensionProperties> available(count);checked(enumerate(candidate,nullptr,&count,available.data()),"DMA-BUF extensions");
  for(auto required:dmaExtensions)if(std::none_of(available.begin(),available.end(),[&](auto& e){return std::string_view(e.extensionName)==required;}))return false;
  VkPhysicalDeviceImageFormatInfo2 drawInfo{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_FORMAT_INFO_2,nullptr,VK_FORMAT_B8G8R8A8_UNORM,VK_IMAGE_TYPE_2D,VK_IMAGE_TILING_OPTIMAL,drawUsage,0};
  VkImageFormatProperties2 drawProperties{VK_STRUCTURE_TYPE_IMAGE_FORMAT_PROPERTIES_2};
  if(api.get<PFN_vkGetPhysicalDeviceImageFormatProperties2>("vkGetPhysicalDeviceImageFormatProperties2")(candidate,&drawInfo,&drawProperties)!=VK_SUCCESS ||
     !(drawProperties.imageFormatProperties.sampleCounts&VK_SAMPLE_COUNT_1_BIT))return false;
  VkDrmFormatModifierPropertiesListEXT modifiers{VK_STRUCTURE_TYPE_DRM_FORMAT_MODIFIER_PROPERTIES_LIST_EXT};
  VkFormatProperties2 format{VK_STRUCTURE_TYPE_FORMAT_PROPERTIES_2,&modifiers};
  auto getFormat=api.get<PFN_vkGetPhysicalDeviceFormatProperties2>("vkGetPhysicalDeviceFormatProperties2");
  getFormat(candidate,VK_FORMAT_B8G8R8A8_UNORM,&format);
  std::vector<VkDrmFormatModifierPropertiesEXT> entries(modifiers.drmFormatModifierCount);
  modifiers.pDrmFormatModifierProperties=entries.data();getFormat(candidate,VK_FORMAT_B8G8R8A8_UNORM,&format);
  for(const auto& entry:entries) {
    if(entry.drmFormatModifierPlaneCount!=1 || std::find(options.modifiers.begin(),options.modifiers.end(),entry.drmFormatModifier)==options.modifiers.end())continue;
    VkPhysicalDeviceImageDrmFormatModifierInfoEXT drm{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_DRM_FORMAT_MODIFIER_INFO_EXT};
    drm.drmFormatModifier=entry.drmFormatModifier;drm.sharingMode=VK_SHARING_MODE_EXCLUSIVE;
    VkPhysicalDeviceExternalImageFormatInfo external{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_EXTERNAL_IMAGE_FORMAT_INFO,&drm,VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT};
    VkPhysicalDeviceImageFormatInfo2 input{VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_FORMAT_INFO_2,&external,VK_FORMAT_B8G8R8A8_UNORM,VK_IMAGE_TYPE_2D,VK_IMAGE_TILING_DRM_FORMAT_MODIFIER_EXT,dmaUsage,0};
    VkExternalImageFormatProperties properties{VK_STRUCTURE_TYPE_EXTERNAL_IMAGE_FORMAT_PROPERTIES};
    VkImageFormatProperties2 output{VK_STRUCTURE_TYPE_IMAGE_FORMAT_PROPERTIES_2,&properties};
    if(api.get<PFN_vkGetPhysicalDeviceImageFormatProperties2>("vkGetPhysicalDeviceImageFormatProperties2")(candidate,&input,&output)!=VK_SUCCESS)continue;
    if(!(properties.externalMemoryProperties.externalMemoryFeatures&VK_EXTERNAL_MEMORY_FEATURE_EXPORTABLE_BIT) ||
       !(properties.externalMemoryProperties.compatibleHandleTypes&VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT))continue;
    if(!(output.imageFormatProperties.sampleCounts&VK_SAMPLE_COUNT_1_BIT))continue;
    dmaModifier=entry.drmFormatModifier;dmaExtent=output.imageFormatProperties.maxExtent;drawExtent=drawProperties.imageFormatProperties.maxExtent;return true;
  }
  return false;
}
struct DmaFrameData {
  // Native-only lease. Destruction may run on GDK's release thread after its
  // last use; no queue/context work or JSI destruction happens on that thread.
  std::shared_ptr<Device> device;
  Impl* state;
  VkImage source{},image{};
  VkDeviceMemory sourceMemory{},memory{};
  VkDeviceSize sourceBytes{},bytes{};
  VkCommandPool commands{};
  VkFence fence{};
  int fd=-1;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface;
  std::shared_ptr<std::atomic<bool>> wrapperReleased=std::make_shared<std::atomic<bool>>(false);
  // Declared last: release only after the destructor body freed all native
  // Vulkan/FD owners, while the first member still keeps Device alive.
  FrameLeaseGate::Lease lease;
  DmaFrameData(std::shared_ptr<Device> device,Impl* state):device(std::move(device)),state(state),lease(state->dmaFrames.acquire()){}
  void freeImage(VkImage& image,VkDeviceMemory& memory,VkDeviceSize& bytes) {
    if(image){state->api.get<PFN_vkDestroyImage>("vkDestroyImage")(state->api.device,image,nullptr);image={};}
    if(memory){state->api.get<PFN_vkFreeMemory>("vkFreeMemory")(state->api.device,memory,nullptr);memory={};
      state->dmaBytes-=bytes;--state->dmaAllocations;bytes=0;}
  }
  ~DmaFrameData() {
    surface.reset();recorder.reset();
    if(fd>=0)close(fd);
    if(fence)state->api.get<PFN_vkDestroyFence>("vkDestroyFence")(state->api.device,fence,nullptr);
    if(commands)state->api.get<PFN_vkDestroyCommandPool>("vkDestroyCommandPool")(state->api.device,commands,nullptr);
    freeImage(source,sourceMemory,sourceBytes);freeImage(image,memory,bytes);
  }
};
void allocateDmaImage(DmaFrameData& data,bool exported,uint32_t width,uint32_t height) {
  auto& image=exported?data.image:data.source;auto& memory=exported?data.memory:data.sourceMemory;
  auto& size=exported?data.bytes:data.sourceBytes;
  VkImageDrmFormatModifierListCreateInfoEXT drm{VK_STRUCTURE_TYPE_IMAGE_DRM_FORMAT_MODIFIER_LIST_CREATE_INFO_EXT};
  drm.drmFormatModifierCount=1;drm.pDrmFormatModifiers=&dmaModifier;
  VkExternalMemoryImageCreateInfo external{VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO,&drm,VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT};
  VkImageCreateInfo info{VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO};info.pNext=exported?&external:nullptr;
  info.imageType=VK_IMAGE_TYPE_2D;info.format=VK_FORMAT_B8G8R8A8_UNORM;info.extent={width,height,1};
  info.mipLevels=1;info.arrayLayers=1;info.samples=VK_SAMPLE_COUNT_1_BIT;info.sharingMode=VK_SHARING_MODE_EXCLUSIVE;
  info.tiling=exported?VK_IMAGE_TILING_DRM_FORMAT_MODIFIER_EXT:VK_IMAGE_TILING_OPTIMAL;info.usage=exported?dmaUsage:drawUsage;
  checked(api.get<PFN_vkCreateImage>("vkCreateImage")(api.device,&info,nullptr,&image),"DMA-BUF image creation");
  VkMemoryRequirements requirements{};api.get<PFN_vkGetImageMemoryRequirements>("vkGetImageMemoryRequirements")(api.device,image,&requirements);
  const auto live=dmaBytes.load();
  if(live>64*1024*1024 || requirements.size>64*1024*1024-live)throw std::runtime_error("DMA-BUF total allocation budget exceeded");
  VkPhysicalDeviceMemoryProperties types{};api.get<PFN_vkGetPhysicalDeviceMemoryProperties>("vkGetPhysicalDeviceMemoryProperties")(physical,&types);
  uint32_t type=UINT32_MAX;
  for(uint32_t i=0;i<types.memoryTypeCount;++i)if(requirements.memoryTypeBits&(1u<<i)) {
    if(type==UINT32_MAX)type=i;
    if(types.memoryTypes[i].propertyFlags&VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT){type=i;break;}
  }
  if(type==UINT32_MAX)throw std::runtime_error("DMA-BUF compatible memory type unavailable");
  VkMemoryDedicatedAllocateInfo dedicated{VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO};dedicated.image=image;
  VkExportMemoryAllocateInfo exportInfo{VK_STRUCTURE_TYPE_EXPORT_MEMORY_ALLOCATE_INFO,&dedicated,VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT};
  VkMemoryAllocateInfo allocation{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};allocation.pNext=exported?static_cast<void*>(&exportInfo):static_cast<void*>(&dedicated);
  allocation.allocationSize=requirements.size;allocation.memoryTypeIndex=type;
  checked(api.get<PFN_vkAllocateMemory>("vkAllocateMemory")(api.device,&allocation,nullptr,&memory),"DMA-BUF memory allocation");
  size=requirements.size;dmaBytes+=size;++dmaAllocations;
  checked(api.get<PFN_vkBindImageMemory>("vkBindImageMemory")(api.device,image,memory,0),"DMA-BUF memory binding");
}
std::shared_ptr<const DmaBufFrame> exportDmaBuf(std::shared_ptr<Device> owner,
    std::unique_ptr<skgpu::graphite::Recorder> recorder,uint32_t width,uint32_t height,
    const std::function<void(SkCanvas*)>& draw,const std::vector<skgpu::graphite::Recording*>& recordings) {
  if(!dmaEnabled || dmaPoisoned || !recorder || (!draw && recordings.empty()))throw std::runtime_error("DMA-BUF exporter is unavailable or poisoned");
  if(recordings.size()>8 || std::any_of(recordings.begin(),recordings.end(),[](auto* r){return !r;}))
    throw std::runtime_error("DMA-BUF recording replay admission exceeded");
  if(!width || !height || width>4096 || height>4096 || width>dmaExtent.width || height>dmaExtent.height ||
     width>drawExtent.width || height>drawExtent.height || !dmaFrames.accepting())throw std::runtime_error("DMA-BUF dimensions/frame admission exceeded");
  auto data=std::make_shared<DmaFrameData>(std::move(owner),this);data->recorder=std::move(recorder);
  // Reserve a retention holder before any submission. The failure path must
  // not allocate memory in order to preserve an unconfirmed native owner.
  auto retention=std::make_unique<std::shared_ptr<DmaFrameData>>(data);
  bool uncertain=false;
  try {
    allocateDmaImage(*data,false,width,height);allocateDmaImage(*data,true,width,height);
    skgpu::graphite::VulkanTextureInfo info;info.fFormat=VK_FORMAT_B8G8R8A8_UNORM;info.fImageUsageFlags=drawUsage;
    skgpu::VulkanAlloc allocation;allocation.fMemory=data->sourceMemory;allocation.fSize=data->sourceBytes;
    auto backend=skgpu::graphite::BackendTextures::MakeVulkan(SkISize::Make(width,height),info,VK_IMAGE_LAYOUT_UNDEFINED,graphics,data->source,allocation);
    auto callback=std::make_unique<std::shared_ptr<std::atomic<bool>>>(data->wrapperReleased);
    data->surface=SkSurfaces::WrapBackendTexture(data->recorder.get(),backend,SkColorSpace::MakeSRGB(),nullptr,
      [](void* pointer){std::unique_ptr<std::shared_ptr<std::atomic<bool>>> flag(static_cast<std::shared_ptr<std::atomic<bool>>*>(pointer));(*flag)->store(true);},callback.get());
    // WrapBackendTexture invokes its release callback even when wrapping fails.
    callback.release();
    if(!data->surface)throw std::runtime_error("Graphite DMA-BUF draw surface unavailable");
    std::unique_ptr<skgpu::graphite::Recording> recording;
    if(draw) {draw(data->surface->getCanvas());recording=data->recorder->snap();if(!recording)throw std::runtime_error("Graphite DMA-BUF recording unavailable");}
    auto replay=recordings;if(recording)replay.push_back(recording.get());
    auto state=skgpu::MutableTextureStates::MakeVulkan(VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,graphics);
    uncertain=true;
    for(size_t i=0;i<replay.size();++i) {
      skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=replay[i];insert.fTargetSurface=data->surface.get();
      if(i+1==replay.size())insert.fTargetTextureState=&state;
      if(!context->insertRecording(insert))throw std::runtime_error("Graphite DMA-BUF recording replay rejected");
    }
    if(!context->submit(skgpu::graphite::SyncToCpu::kYes) || context->hasUnfinishedGpuWork())
      throw std::runtime_error("Graphite DMA-BUF producer completion unconfirmed");
    uncertain=false;
    VkCommandPoolCreateInfo pool{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};pool.queueFamilyIndex=graphics;
    checked(api.get<PFN_vkCreateCommandPool>("vkCreateCommandPool")(api.device,&pool,nullptr,&data->commands),"DMA-BUF command pool");
    VkCommandBufferAllocateInfo commands{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};commands.commandPool=data->commands;commands.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY;commands.commandBufferCount=1;
    VkCommandBuffer command{};checked(api.get<PFN_vkAllocateCommandBuffers>("vkAllocateCommandBuffers")(api.device,&commands,&command),"DMA-BUF command buffer");
    VkCommandBufferBeginInfo begin{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};begin.flags=VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;
    checked(api.get<PFN_vkBeginCommandBuffer>("vkBeginCommandBuffer")(command,&begin),"DMA-BUF copy begin");
    VkImageMemoryBarrier barrier{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};barrier.oldLayout=VK_IMAGE_LAYOUT_UNDEFINED;barrier.newLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
    barrier.srcQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED;barrier.dstQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED;barrier.image=data->image;
    barrier.subresourceRange={VK_IMAGE_ASPECT_COLOR_BIT,0,1,0,1};barrier.dstAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT;
    auto pipelineBarrier=api.get<PFN_vkCmdPipelineBarrier>("vkCmdPipelineBarrier");
    pipelineBarrier(command,VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT,0,0,nullptr,0,nullptr,1,&barrier);
    VkImageCopy copy{};copy.srcSubresource={VK_IMAGE_ASPECT_COLOR_BIT,0,0,1};copy.dstSubresource=copy.srcSubresource;copy.extent={width,height,1};
    api.get<PFN_vkCmdCopyImage>("vkCmdCopyImage")(command,data->source,VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,data->image,VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,1,&copy);
    barrier.oldLayout=VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;barrier.newLayout=VK_IMAGE_LAYOUT_GENERAL;
    barrier.srcAccessMask=VK_ACCESS_TRANSFER_WRITE_BIT;barrier.dstAccessMask=0;
    barrier.srcQueueFamilyIndex=graphics;barrier.dstQueueFamilyIndex=VK_QUEUE_FAMILY_FOREIGN_EXT;
    pipelineBarrier(command,VK_PIPELINE_STAGE_TRANSFER_BIT,VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT,0,0,nullptr,0,nullptr,1,&barrier);
    checked(api.get<PFN_vkEndCommandBuffer>("vkEndCommandBuffer")(command),"DMA-BUF copy end");
    VkFenceCreateInfo fence{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};checked(api.get<PFN_vkCreateFence>("vkCreateFence")(api.device,&fence,nullptr,&data->fence),"DMA-BUF fence creation");
    VkSubmitInfo submit{VK_STRUCTURE_TYPE_SUBMIT_INFO};submit.commandBufferCount=1;submit.pCommandBuffers=&command;
    uncertain=true;
    checked(api.get<PFN_vkQueueSubmit>("vkQueueSubmit")(queue,1,&submit,data->fence),"DMA-BUF copy submission");
    checked(api.get<PFN_vkWaitForFences>("vkWaitForFences")(api.device,1,&data->fence,VK_TRUE,5000000000ull),"DMA-BUF copy/FOREIGN release completion");
    uncertain=false;
    VkImageDrmFormatModifierPropertiesEXT modifier{VK_STRUCTURE_TYPE_IMAGE_DRM_FORMAT_MODIFIER_PROPERTIES_EXT};
    checked(api.get<PFN_vkGetImageDrmFormatModifierPropertiesEXT>("vkGetImageDrmFormatModifierPropertiesEXT")(api.device,data->image,&modifier),"DMA-BUF actual modifier");
    if(modifier.drmFormatModifier!=dmaModifier)throw std::runtime_error("DMA-BUF actual modifier mismatch");
    VkImageSubresource plane{VK_IMAGE_ASPECT_MEMORY_PLANE_0_BIT_EXT,0,0};VkSubresourceLayout layout{};
    api.get<PFN_vkGetImageSubresourceLayout>("vkGetImageSubresourceLayout")(api.device,data->image,&plane,&layout);
    if(layout.rowPitch<uint64_t(width)*4 || layout.rowPitch>UINT32_MAX || layout.offset>UINT32_MAX || layout.offset>=data->bytes ||
       uint64_t(height-1)*layout.rowPitch+uint64_t(width)*4>data->bytes-layout.offset)
      throw std::runtime_error("DMA-BUF plane layout exceeds allocation");
    VkMemoryGetFdInfoKHR fd{VK_STRUCTURE_TYPE_MEMORY_GET_FD_INFO_KHR};fd.memory=data->memory;fd.handleType=VK_EXTERNAL_MEMORY_HANDLE_TYPE_DMA_BUF_BIT_EXT;
    checked(api.get<PFN_vkGetMemoryFdKHR>("vkGetMemoryFdKHR")(api.device,&fd,&data->fd),"DMA-BUF memory FD export");
    if(data->fd<0 || fcntl(data->fd,F_SETFD,FD_CLOEXEC)<0)throw std::runtime_error("DMA-BUF FD flags unavailable");
    // No Graphite wrapper remains when the immutable frame crosses to GTK.
    recording.reset();data->surface.reset();data->recorder.reset();context->freeGpuResources();
    if(!data->wrapperReleased->load()) {uncertain=true;throw std::runtime_error("Graphite DMA-BUF source wrapper retirement unconfirmed");}
    data->freeImage(data->source,data->sourceMemory,data->sourceBytes);
    return std::shared_ptr<const DmaBufFrame>(new DmaBufFrame(data->fd,width,height,static_cast<uint32_t>(layout.rowPitch),
      static_cast<uint32_t>(layout.offset),dmaModifier,data));
  } catch(...) {
    if(uncertain) {
      dmaPoisoned=true;
      // Keep native image/recorder/device owners for unobserved work. No JS
      // captures and no reuse; explicit recovery is required to reclaim them.
      retention.release();
    }
    throw;
  }
}
