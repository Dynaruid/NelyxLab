// SPDX-License-Identifier: BSD-3-Clause
// Device::Impl internals. Three native-only imported frames, <=64MiB. D3D
// presents/copies; this existing Vulkan/Graphite device produces the pixels.
FrameLeaseGate winFrames;
std::atomic<bool> winPoisoned{false};
std::atomic<uint32_t> winAllocations{};
std::atomic<uint64_t> winBytes{};
uint32_t winReplayWidth=0,winReplayHeight=0;
std::mutex winMutex;
std::unordered_set<IUnknown*> winTextures,winFences;
static constexpr VkImageUsageFlags winUsage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT|VK_IMAGE_USAGE_INPUT_ATTACHMENT_BIT|
  VK_IMAGE_USAGE_SAMPLED_BIT|VK_IMAGE_USAGE_TRANSFER_SRC_BIT|VK_IMAGE_USAGE_TRANSFER_DST_BIT;
static void winHr(HRESULT result,const char* action) {
  if(FAILED(result))throw std::runtime_error(std::string(action)+" HRESULT="+std::to_string(static_cast<uint32_t>(result)));
}
struct WinHandle {
  HANDLE value{};
  ~WinHandle(){if(value)CloseHandle(value);}
  WinHandle()=default;WinHandle(const WinHandle&)=delete;WinHandle& operator=(const WinHandle&)=delete;
};
struct WinFrameData {
  std::shared_ptr<Device> device;
  Impl* state;
  Microsoft::WRL::ComPtr<ID3D11Texture2D> texture;
  Microsoft::WRL::ComPtr<ID3D11Fence> sharedFence;
  Microsoft::WRL::ComPtr<ID3D11Device> d3d;
  Microsoft::WRL::ComPtr<IUnknown> textureIdentity,fenceIdentity;
  uint32_t width{},height{};
  uint64_t signal{};
  VkImage image{};
  VkDeviceMemory memory{};
  VkDeviceSize bytes{};
  VkSemaphore semaphore{};
  VkCommandPool pool{};
  VkFence submitted{};
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface;
  std::vector<std::shared_ptr<skgpu::graphite::Recording>> recordings;
  std::function<void(SkCanvas*)> draw;
  std::shared_ptr<std::atomic<bool>> wrapperReleased=std::make_shared<std::atomic<bool>>(false);
  bool wrapperInstalled=false,registered=false;
  std::atomic<bool> mustRetain{false},released{false};
  std::atomic<bool> producerDone{false};
  bool producerFinished=false;
  std::mutex closeMutex;
  FrameLeaseGate::Lease lease;
  WinFrameData(std::shared_ptr<Device> device,Impl* state,Win32TextureTarget target)
    :device(std::move(device)),state(state),texture(target.texture),sharedFence(target.fence) {
    if(!texture || !sharedFence || target.waitValue>UINT64_MAX-2)throw std::runtime_error("Complete Windows texture/fence and bounded fence value required");
    D3D11_TEXTURE2D_DESC description{};texture->GetDesc(&description);
    constexpr auto shared=D3D11_RESOURCE_MISC_SHARED|D3D11_RESOURCE_MISC_SHARED_NTHANDLE;
    if(!description.Width || !description.Height || description.Width>4096 || description.Height>4096 ||
       description.Format!=DXGI_FORMAT_B8G8R8A8_UNORM || description.MipLevels!=1 || description.ArraySize!=1 ||
       description.SampleDesc.Count!=1 || description.SampleDesc.Quality || description.Usage!=D3D11_USAGE_DEFAULT ||
       description.CPUAccessFlags || description.MiscFlags!=shared ||
       description.BindFlags!=(D3D11_BIND_RENDER_TARGET|D3D11_BIND_SHADER_RESOURCE))
      throw std::runtime_error("Windows import requires one unprotected shared NT BGRA8 render texture <=4096");
    texture->GetDevice(&d3d);Microsoft::WRL::ComPtr<ID3D11Device> fenceDevice;sharedFence->GetDevice(&fenceDevice);
    Microsoft::WRL::ComPtr<IUnknown> textureDeviceIdentity,fenceDeviceIdentity;
    winHr(d3d.As(&textureDeviceIdentity),"Texture COM device identity");winHr(fenceDevice.As(&fenceDeviceIdentity),"Fence COM device identity");
    if(textureDeviceIdentity.Get()!=fenceDeviceIdentity.Get())throw std::runtime_error("Windows texture/fence device identity differs");
    winHr(texture.As(&textureIdentity),"Texture COM identity");winHr(sharedFence.As(&fenceIdentity),"Fence COM identity");
    Microsoft::WRL::ComPtr<IDXGIDevice> dxgi;winHr(d3d.As(&dxgi),"Texture DXGI device");
    Microsoft::WRL::ComPtr<IDXGIAdapter> adapter;winHr(dxgi->GetAdapter(&adapter),"Texture DXGI adapter");
    DXGI_ADAPTER_DESC identity{};winHr(adapter->GetDesc(&identity),"Texture DXGI LUID");
    if(std::memcmp(&identity.AdapterLuid,state->winLuid.data(),state->winLuid.size()))throw std::runtime_error("Windows texture does not belong to the selected Vulkan LUID");
    winHr(d3d->GetDeviceRemovedReason(),"Windows producer device removed");
    const auto completed=sharedFence->GetCompletedValue();
    if(completed==UINT64_MAX || completed!=target.waitValue)throw std::runtime_error("Windows fence must equal the confirmed consumer wait value");
    width=description.Width;height=description.Height;signal=target.waitValue+1;
    lease=state->winFrames.acquire();
    std::lock_guard lock(state->winMutex);
    if(state->winTextures.contains(textureIdentity.Get()))throw std::runtime_error("Windows texture already has a live imported frame");
    if(state->winFences.contains(fenceIdentity.Get()))throw std::runtime_error("Windows fence already has a live imported frame");
    state->winTextures.insert(textureIdentity.Get());
    try{state->winFences.insert(fenceIdentity.Get());}catch(...){state->winTextures.erase(textureIdentity.Get());throw;}
    registered=true;
  }
  void cleanup() {
    // All Skia wrappers have retired before the normal native-only consumer ACK.
    surface.reset();recorder.reset();recordings.clear();draw={};
    if(submitted){state->api.get<PFN_vkDestroyFence>("vkDestroyFence")(state->api.device,submitted,nullptr);submitted={};}
    if(pool){state->api.get<PFN_vkDestroyCommandPool>("vkDestroyCommandPool")(state->api.device,pool,nullptr);pool={};}
    if(semaphore){state->api.get<PFN_vkDestroySemaphore>("vkDestroySemaphore")(state->api.device,semaphore,nullptr);semaphore={};}
    if(image){state->api.get<PFN_vkDestroyImage>("vkDestroyImage")(state->api.device,image,nullptr);image={};}
    if(memory){state->api.get<PFN_vkFreeMemory>("vkFreeMemory")(state->api.device,memory,nullptr);memory={};
      state->winBytes-=bytes;--state->winAllocations;bytes=0;}
    {std::lock_guard lock(state->winMutex);if(registered){state->winTextures.erase(textureIdentity.Get());state->winFences.erase(fenceIdentity.Get());registered=false;}}
    texture.Reset();sharedFence.Reset();textureIdentity.Reset();fenceIdentity.Reset();d3d.Reset();
    // Gate observes retirement only after actual Vulkan and native COM release.
    released.store(true);lease.reset();
  }
  void retire(uint64_t consumer) {
    std::lock_guard lock(closeMutex);
    if(!producerFinished || consumer!=signal+1)throw std::runtime_error("Windows consumer ACK fence value differs or producer is unfinished");
    if(released.load())return;
    winHr(d3d->GetDeviceRemovedReason(),"Windows consumer device removed");
    const auto completed=sharedFence->GetCompletedValue();
    if(completed==UINT64_MAX || completed<consumer)throw std::runtime_error("Windows native consumer fence is not complete");
    cleanup();
  }
  void awaitProducer() {
    if(producerDone.load())return;
    const auto result=state->api.get<PFN_vkWaitForFences>("vkWaitForFences")(state->api.device,1,&submitted,VK_TRUE,5000000000ull);
    if(result!=VK_SUCCESS){state->winPoisoned.store(true);checked(result,"Windows producer completion deadline");}
    producerDone.store(true);
  }
  // Caller serializes access to Graphite Context, but never waits under it.
  void finishProducer() {
    if(producerFinished)return;
    if(!producerDone.load())throw std::runtime_error("Windows producer completion unconfirmed");
    auto* context=state->context.get();
    context->checkAsyncWorkCompletion();
    recordings.clear();draw={};surface.reset();recorder.reset();
    context->performDeferredCleanup(std::chrono::milliseconds(1000));
    if(!wrapperReleased->load())context->freeGpuResources();
    if(!wrapperReleased->load())throw std::runtime_error("Windows Graphite wrapper release unconfirmed");
    producerFinished=true;
  }
  bool retain() {
    if(!released.load() && mustRetain.load()){state->winPoisoned.store(true);return true;}
    return false;
  }
  ~WinFrameData(){if(!released.load())cleanup();}
};
void importWin32Frame(WinFrameData& data) {
  VkExternalMemoryImageCreateInfo external{VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO};external.handleTypes=VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_BIT;
  VkImageCreateInfo image{VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO};image.pNext=&external;image.imageType=VK_IMAGE_TYPE_2D;
  image.format=VK_FORMAT_B8G8R8A8_UNORM;image.extent={data.width,data.height,1};image.mipLevels=1;image.arrayLayers=1;
  image.samples=VK_SAMPLE_COUNT_1_BIT;image.tiling=VK_IMAGE_TILING_OPTIMAL;image.usage=winUsage;
  checked(api.get<PFN_vkCreateImage>("vkCreateImage")(api.device,&image,nullptr,&data.image),"Windows imported image");
  Microsoft::WRL::ComPtr<IDXGIResource1> resource;winHr(data.texture.As(&resource),"Windows shared texture resource");
  WinHandle memoryHandle;winHr(resource->CreateSharedHandle(nullptr,DXGI_SHARED_RESOURCE_READ|DXGI_SHARED_RESOURCE_WRITE,nullptr,&memoryHandle.value),"Windows texture NT handle");
  VkMemoryRequirements requirements{};api.get<PFN_vkGetImageMemoryRequirements>("vkGetImageMemoryRequirements")(api.device,data.image,&requirements);
  VkMemoryWin32HandlePropertiesKHR properties{VK_STRUCTURE_TYPE_MEMORY_WIN32_HANDLE_PROPERTIES_KHR};
  checked(api.get<PFN_vkGetMemoryWin32HandlePropertiesKHR>("vkGetMemoryWin32HandlePropertiesKHR")(api.device,VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_BIT,memoryHandle.value,&properties),"Windows imported memory types");
  const auto compatible=requirements.memoryTypeBits&properties.memoryTypeBits;
  VkPhysicalDeviceMemoryProperties types{};api.get<PFN_vkGetPhysicalDeviceMemoryProperties>("vkGetPhysicalDeviceMemoryProperties")(physical,&types);
  uint32_t type=UINT32_MAX;
  for(uint32_t index=0;index<types.memoryTypeCount;++index)if(compatible&(1u<<index)) {
    if(type==UINT32_MAX)type=index;if(types.memoryTypes[index].propertyFlags&VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT){type=index;break;}
  }
  if(type==UINT32_MAX)throw std::runtime_error("Windows imported texture has no compatible Vulkan memory type");
  VkMemoryDedicatedAllocateInfo dedicated{VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO};dedicated.image=data.image;
  VkImportMemoryWin32HandleInfoKHR imported{VK_STRUCTURE_TYPE_IMPORT_MEMORY_WIN32_HANDLE_INFO_KHR};
  imported.pNext=&dedicated;imported.handleType=VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_BIT;imported.handle=memoryHandle.value;
  VkMemoryAllocateInfo allocation{VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO};allocation.pNext=&imported;allocation.allocationSize=requirements.size;allocation.memoryTypeIndex=type;
  {std::lock_guard lock(winMutex);
    const auto live=winBytes.load();if(live>64*1024*1024 || requirements.size>64*1024*1024-live)throw std::runtime_error("Windows imported memory budget exceeds 64MiB");
    checked(api.get<PFN_vkAllocateMemory>("vkAllocateMemory")(api.device,&allocation,nullptr,&data.memory),"Windows texture memory import");
    data.bytes=requirements.size;winBytes+=data.bytes;++winAllocations;
  }
  checked(api.get<PFN_vkBindImageMemory>("vkBindImageMemory")(api.device,data.image,data.memory,0),"Windows imported memory binding");
  VkSemaphoreCreateInfo semaphore{VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO};checked(api.get<PFN_vkCreateSemaphore>("vkCreateSemaphore")(api.device,&semaphore,nullptr,&data.semaphore),"Windows imported semaphore");
  WinHandle fenceHandle;winHr(data.sharedFence->CreateSharedHandle(nullptr,GENERIC_ALL,nullptr,&fenceHandle.value),"Windows shared fence NT handle");
  VkImportSemaphoreWin32HandleInfoKHR fence{VK_STRUCTURE_TYPE_IMPORT_SEMAPHORE_WIN32_HANDLE_INFO_KHR};
  fence.semaphore=data.semaphore;fence.handleType=VK_EXTERNAL_SEMAPHORE_HANDLE_TYPE_D3D12_FENCE_BIT;fence.handle=fenceHandle.value;
  checked(api.get<PFN_vkImportSemaphoreWin32HandleKHR>("vkImportSemaphoreWin32HandleKHR")(api.device,&fence),"Windows D3D fence payload import");
  VkCommandPoolCreateInfo pool{VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO};pool.queueFamilyIndex=graphics;pool.flags=VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
  checked(api.get<PFN_vkCreateCommandPool>("vkCreateCommandPool")(api.device,&pool,nullptr,&data.pool),"Windows import command pool");
  VkFenceCreateInfo submitted{VK_STRUCTURE_TYPE_FENCE_CREATE_INFO};checked(api.get<PFN_vkCreateFence>("vkCreateFence")(api.device,&submitted,nullptr,&data.submitted),"Windows producer completion fence");
}
void submitWin32(WinFrameData& data,VkCommandBuffer command,uint64_t wait,uint64_t signal,bool externalWait,bool externalSignal,const char* phase,bool complete=true) {
  if(complete)checked(api.get<PFN_vkResetFences>("vkResetFences")(api.device,1,&data.submitted),"Windows producer fence reset");
  VkD3D12FenceSubmitInfoKHR values{VK_STRUCTURE_TYPE_D3D12_FENCE_SUBMIT_INFO_KHR};
  values.waitSemaphoreValuesCount=externalWait?1:0;values.pWaitSemaphoreValues=&wait;
  values.signalSemaphoreValuesCount=externalSignal?1:0;values.pSignalSemaphoreValues=&signal;
  VkPipelineStageFlags stage=VK_PIPELINE_STAGE_ALL_COMMANDS_BIT;
  VkSubmitInfo submit{VK_STRUCTURE_TYPE_SUBMIT_INFO};submit.pNext=&values;
  submit.waitSemaphoreCount=externalWait?1:0;submit.pWaitSemaphores=&data.semaphore;submit.pWaitDstStageMask=&stage;
  submit.signalSemaphoreCount=externalSignal?1:0;submit.pSignalSemaphores=&data.semaphore;
  submit.commandBufferCount=command?1:0;submit.pCommandBuffers=&command;
  data.mustRetain.store(true); // Set before any submission whose result can be unknown.
  checked(api.get<PFN_vkQueueSubmit>("vkQueueSubmit")(queue,1,&submit,complete?data.submitted:VK_NULL_HANDLE),phase);
  // A worker observes this fence after releasing the Context lock.
}
std::shared_ptr<const Win32Frame> renderWin32Frame(std::shared_ptr<Device> owner,
    std::unique_ptr<skgpu::graphite::Recorder> recorder,Win32TextureTarget target,std::function<void(SkCanvas*)> draw,
    const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings) {
  if(!win32Interop || winPoisoned.load() || !winFrames.accepting() || !recorder || (!draw && recordings.empty()))
    throw std::runtime_error("Windows import admission unavailable, full or poisoned");
  if(recordings.size()>8 || std::any_of(recordings.begin(),recordings.end(),[](const auto& recording){return !recording;}))
    throw std::runtime_error("Windows native recording batch exceeds admission");
  allocator->beginReplay();
  auto data=std::make_shared<WinFrameData>(std::move(owner),this,target);data->recorder=std::move(recorder);data->recordings=recordings;data->draw=std::move(draw);
  // The previous completed recording may be released by the view only after
  // the preceding present returned. Purging at that present's end is too early
  // to collect those attachments. Before allocating for another size, process
  // their returns on this serialized Context owner. Graphite keeps referenced
  // and unfinished resources; queued upload/recording owners are not discarded.
  if(winReplayWidth&&(winReplayWidth!=data->width||winReplayHeight!=data->height))context->freeGpuResources();
  // MSAA scratch grows with the actual backing, including a maximized/DPI
  // window. Keep its recent working set without changing the allocator's
  // independent 256MiB cap or retaining resources across a size change.
  const auto scratch=static_cast<uint64_t>(data->width)*static_cast<uint64_t>(data->height)*40;
  context->setMaxBudgetedBytes(static_cast<size_t>(std::clamp<uint64_t>(scratch,96*1024*1024,192*1024*1024)));
  // Allocate retention before importing/submitting; the failure path never allocates.
  auto frame=std::shared_ptr<const Win32Frame>(new Win32Frame(data->width,data->height,data->signal,data,
    [data](uint64_t value){data->retire(value);},[data](){return data->released.load();},[data](){return data->retain();},
    [data](){data->awaitProducer();},[data](){data->finishProducer();}));
  try {
    importWin32Frame(*data);
    VkCommandBufferAllocateInfo allocation{VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO};allocation.commandPool=data->pool;allocation.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY;allocation.commandBufferCount=2;
    VkCommandBuffer commands[2]{};checked(api.get<PFN_vkAllocateCommandBuffers>("vkAllocateCommandBuffers")(api.device,&allocation,commands),"Windows import command buffer");auto command=commands[0];
    VkCommandBufferBeginInfo begin{VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO};begin.flags=VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;
    checked(api.get<PFN_vkBeginCommandBuffer>("vkBeginCommandBuffer")(command,&begin),"Windows acquire begin");
    VkImageMemoryBarrier barrier{VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER};barrier.image=data->image;
    barrier.subresourceRange={VK_IMAGE_ASPECT_COLOR_BIT,0,1,0,1};barrier.oldLayout=VK_IMAGE_LAYOUT_UNDEFINED;barrier.newLayout=VK_IMAGE_LAYOUT_GENERAL;
    barrier.srcQueueFamilyIndex=VK_QUEUE_FAMILY_EXTERNAL;barrier.dstQueueFamilyIndex=graphics;barrier.dstAccessMask=VK_ACCESS_MEMORY_READ_BIT|VK_ACCESS_MEMORY_WRITE_BIT;
    api.get<PFN_vkCmdPipelineBarrier>("vkCmdPipelineBarrier")(command,VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT,VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,0,0,nullptr,0,nullptr,1,&barrier);
    checked(api.get<PFN_vkEndCommandBuffer>("vkEndCommandBuffer")(command),"Windows acquire end");
    // Fresh texture contents are discarded, and zero denotes no prior D3D
    // consumer operation. Only a real previous copy needs an imported wait.
    submitWin32(*data,command,target.waitValue,0,target.waitValue!=0,false,"Windows acquire submission",false);
    skgpu::graphite::VulkanTextureInfo texture;texture.fFormat=VK_FORMAT_B8G8R8A8_UNORM;texture.fImageUsageFlags=winUsage;
    skgpu::VulkanAlloc memory;memory.fMemory=data->memory;memory.fSize=data->bytes;
    auto backend=skgpu::graphite::BackendTextures::MakeVulkan(SkISize::Make(data->width,data->height),texture,VK_IMAGE_LAYOUT_GENERAL,graphics,data->image,memory);
    auto callback=std::make_unique<std::shared_ptr<std::atomic<bool>>>(data->wrapperReleased);data->wrapperInstalled=true;
    data->surface=SkSurfaces::WrapBackendTexture(data->recorder.get(),backend,SkColorSpace::MakeSRGB(),nullptr,
      [](void* pointer){std::unique_ptr<std::shared_ptr<std::atomic<bool>>> flag(static_cast<std::shared_ptr<std::atomic<bool>>*>(pointer));(*flag)->store(true);},callback.get());
    callback.release();if(!data->surface)throw std::runtime_error("Graphite Windows imported texture wrap failed");
    data->surface->getCanvas()->clear(SK_ColorTRANSPARENT);if(data->draw)data->draw(data->surface->getCanvas());
    auto own=data->recorder->snap();if(!own)throw std::runtime_error("Windows producer base recording unavailable");
    data->recordings.insert(data->recordings.begin(),std::shared_ptr<skgpu::graphite::Recording>(std::move(own)));
    auto finalState=skgpu::MutableTextureStates::MakeVulkan(VK_IMAGE_LAYOUT_GENERAL,graphics);
    for(size_t index=0;index<data->recordings.size();++index) {
      skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=data->recordings[index].get();insert.fTargetSurface=data->surface.get();
      if(index+1==data->recordings.size())insert.fTargetTextureState=&finalState;
      const auto status=context->insertRecording(insert);
      if(!status)throw std::runtime_error("Windows Graphite replay rejected status="+std::to_string(static_cast<int>(static_cast<skgpu::graphite::InsertStatus::V>(status)))+": "+status.message()+allocator->replayFailure());
    }
    if(!context->submit())throw std::runtime_error("Windows Graphite submit unconfirmed");
    // Graphite uses this same queue. The final release fence includes all prior
    // submissions (Vulkan synchronization, "Fence Signaling"). Preserve both
    // ownership barriers; record release in another buffer while acquire may
    // still be pending, then confirm GPU/Graphite completion before retirement.
    command=commands[1];
    checked(api.get<PFN_vkBeginCommandBuffer>("vkBeginCommandBuffer")(command,&begin),"Windows release begin");
    barrier.oldLayout=VK_IMAGE_LAYOUT_GENERAL;barrier.newLayout=VK_IMAGE_LAYOUT_GENERAL;
    barrier.srcAccessMask=VK_ACCESS_MEMORY_WRITE_BIT;barrier.dstAccessMask=0;barrier.srcQueueFamilyIndex=graphics;barrier.dstQueueFamilyIndex=VK_QUEUE_FAMILY_EXTERNAL;
    api.get<PFN_vkCmdPipelineBarrier>("vkCmdPipelineBarrier")(command,VK_PIPELINE_STAGE_ALL_COMMANDS_BIT,VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT,0,0,nullptr,0,nullptr,1,&barrier);
    checked(api.get<PFN_vkEndCommandBuffer>("vkEndCommandBuffer")(command),"Windows release end");
    submitWin32(*data,command,0,data->signal,false,true,"Windows EXTERNAL release submission");
    winReplayWidth=data->width;winReplayHeight=data->height;return frame;
  } catch(...) {
    if(!data->mustRetain.load()) {
      data->surface.reset();data->recorder.reset();context->freeGpuResources();
      if(data->wrapperInstalled && !data->wrapperReleased->load())data->mustRetain.store(true);
    }
    if(data->mustRetain.load())winPoisoned.store(true);
    throw;
  }
}
