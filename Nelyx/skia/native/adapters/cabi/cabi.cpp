#include "nelyx_skia_cabi.h"
#include "../../rendering/renderer.h"
#include "nelyx_skia/core.h"
#include <cmath>
#include <cstring>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <stdexcept>
#include <algorithm>
#include "../../platforms/vulkan/device.h"

namespace {
struct Client {std::thread::id owner;std::unique_ptr<SkiaRenderer> renderer;uint32_t width{},height{};bool closing=false;};
std::mutex clientsMutex;
std::unordered_map<uint64_t,std::shared_ptr<Client>> clients;
std::vector<std::shared_ptr<Client>> preparedClients;
uint64_t nextHandle=1;
thread_local std::string lastError;
template<class F> int32_t invoke(F&& operation) noexcept {try{operation();lastError.clear();return 0;}catch(const std::exception& error){lastError=error.what();return -1;}catch(...){lastError="unknown Skia failure";return -1;}}
std::shared_ptr<Client> client(uint64_t handle,bool cleanup=false) {std::lock_guard lock(clientsMutex);const auto found=clients.find(handle);if(found==clients.end()||found->second->owner!=std::this_thread::get_id())throw std::runtime_error("stale Skia handle or wrong owner thread");if(found->second->closing&&!cleanup)throw std::runtime_error("Skia owner closing; only checked close retry is allowed");return found->second;}
void removePrepared(const std::shared_ptr<Client>& value){std::lock_guard lock(clientsMutex);std::erase(preparedClients,value);}
uint64_t createRenderer(const char* image,const char* font,const char* icu,bool gpu,uint64_t window,uint32_t linuxKind=0,uint64_t display=0){
  auto value=std::make_shared<Client>();value->owner=std::this_thread::get_id();value->renderer=std::make_unique<SkiaRenderer>();value->closing=true;
  {std::lock_guard lock(clientsMutex);
    if(clients.size()+preparedClients.size()>=64||nextHandle==0)throw std::runtime_error("Skia owner/handle budget exhausted");
    if(std::any_of(preparedClients.begin(),preparedClients.end(),[&](const auto& item){return item->owner==value->owner;}))throw std::runtime_error("Failed Skia creation must drain before creating another owner");
    // Publish before GPU initialization; even allocation failure cannot lose a live GPU owner.
    preparedClients.push_back(value);
  }
  try{
    value->renderer->initialize(image,font,icu,gpu,window,linuxKind,display);
    std::lock_guard lock(clientsMutex);const auto handle=nextHandle;clients.emplace(handle,value);++nextHandle;value->closing=false;std::erase(preparedClients,value);return handle;
  }catch(...){
    try{value->renderer->close();removePrepared(value);}catch(...){/* Original thread must retry cleanup; module/window owners stay live. */}
    throw;
  }
}
void text(const std::string& value,void* output,uint32_t length) {if(!output||value.size()+1>length)throw std::runtime_error("native output buffer too small");std::memcpy(output,value.c_str(),value.size()+1);}
}
uint32_t nelyx_skia_abi_version() {return nelyx::skia_core::abiVersion();}
uint32_t nelyx_skia_wire_version() {return nelyx::skia_core::frameWireVersion();}
uint32_t nelyx_skia_gpu_kind() {
  return 2;
}
uint64_t nelyx_skia_create(const char* image,const char* font,const char* icu,uint32_t gpu) {uint64_t handle=0;invoke([&]{if(!image||!font||!icu||gpu!=1)throw std::runtime_error("invalid Skia create arguments");handle=createRenderer(image,font,icu,gpu!=0,0);});return handle;}
uint64_t nelyx_skia_create_window(const char* image,const char* font,const char* icu,uint64_t borrowedWindow) {uint64_t handle=0;invoke([&]{if(!image||!font||!icu||!borrowedWindow)throw std::runtime_error("invalid borrowed Skia window arguments");handle=createRenderer(image,font,icu,true,borrowedWindow);});return handle;}
uint64_t nelyx_skia_create_linux_window(const char* image,const char* font,const char* icu,uint32_t kind,uint64_t display,uint64_t window) {uint64_t handle=0;invoke([&]{
  if(!image||!font||!icu||(kind!=1&&kind!=2)||!display||!window)throw std::runtime_error("invalid borrowed Linux Skia window arguments");
#ifndef __linux__
  throw std::runtime_error("Linux Vulkan window target requires Linux");
#else
  handle=createRenderer(image,font,icu,true,window,kind,display);
#endif
});return handle;}
int32_t nelyx_skia_cleanup_failed_creates(){return invoke([&]{
  for(;;){std::shared_ptr<Client> value;{std::lock_guard lock(clientsMutex);const auto found=std::find_if(preparedClients.begin(),preparedClients.end(),[](const auto& item){return item->owner==std::this_thread::get_id();});if(found==preparedClients.end())return;value=*found;}
    value->renderer->close();removePrepared(value);
  }
});}
int32_t nelyx_skia_driver(uint64_t handle,void* output,uint32_t length){return invoke([&]{text(client(handle)->renderer->driver(),output,length);});}
int32_t nelyx_skia_runtime_shader_stats(uint64_t handle,void* output,uint32_t length){return invoke([&]{text(client(handle)->renderer->runtimeShaderStats(),output,length);});}
int32_t nelyx_skia_close(uint64_t handle) {return invoke([&]{auto value=client(handle,true);value->closing=true;value->renderer->close();value->renderer.reset();std::lock_guard lock(clientsMutex);clients.erase(handle);});}
int32_t nelyx_skia_resize(uint64_t handle,uint32_t width,uint32_t height) {return invoke([&]{auto value=client(handle);value->renderer->resize(width,height);value->width=width;value->height=height;});}
int32_t nelyx_skia_render(uint64_t handle,const void* bytes,uint32_t length) {return invoke([&]{if(!bytes||length<64||length>256*1024)throw std::runtime_error("invalid frame budget");auto value=client(handle);const auto start=static_cast<const uint8_t*>(bytes);value->renderer->render(std::vector<uint8_t>(start,start+length));});}
int32_t nelyx_skia_read_pixels(uint64_t handle,uint32_t width,uint32_t height,void* bytes,uint32_t length) {return invoke([&]{auto value=client(handle);if(!bytes||width!=value->width||height!=value->height||static_cast<uint64_t>(width)*height*4>length)throw std::runtime_error("invalid readback size");try{if(!value->renderer->readPixels(width,height,bytes))throw std::runtime_error("unavailable native readback");}catch(const SkiaRenderer::RasterizationUnconfirmed&){value->closing=true;throw;}});}
int32_t nelyx_skia_picture_record(uint64_t handle,uint32_t id,const void* bytes,uint32_t length){return invoke([&]{if(!bytes||length<64||length>256*1024)throw std::runtime_error("invalid native picture frame budget");const auto start=static_cast<const uint8_t*>(bytes);client(handle)->renderer->recordPicture(id,std::vector<uint8_t>(start,start+length));});}
int32_t nelyx_skia_picture_rasterize(uint64_t handle,uint32_t id,uint32_t width,uint32_t height,void* rgba,uint32_t length){return invoke([&]{auto value=client(handle);try{value->renderer->rasterizePicture(id,width,height,rgba,length);}catch(const SkiaRenderer::RasterizationUnconfirmed&){value->closing=true;throw;}});}
int32_t nelyx_skia_picture_release(uint64_t handle,uint32_t id){return invoke([&]{client(handle)->renderer->releasePicture(id);});}
int32_t nelyx_skia_layout(uint64_t handle,uint32_t id,const char* value,float width,float size,const char* locale,uint32_t rtl,uint32_t color,uint32_t maxLines,const char* ellipsis,void* output,uint32_t length) {return invoke([&]{if(!id||!value||!locale||!ellipsis||!output||length<32768||std::strlen(value)>16384||!std::isfinite(size)||size<=0||size>512||rtl>1||maxLines<1||maxLines>128)throw std::runtime_error("invalid paragraph arguments/budget");text(client(handle)->renderer->layout(id,value,width,size,locale,rtl!=0,color,maxLines,ellipsis),output,length);});}
int32_t nelyx_skia_glyphs(uint64_t handle,uint32_t id,void* output,uint32_t length) {return invoke([&]{text(client(handle)->renderer->glyphs(id),output,length);});}
int32_t nelyx_skia_range(uint64_t handle,uint32_t id,uint32_t start,uint32_t end,void* output,uint32_t length) {return invoke([&]{if(start>end)throw std::runtime_error("invalid text range");text(client(handle)->renderer->range(id,start,end),output,length);});}
int32_t nelyx_skia_hit(uint64_t handle,uint32_t id,float x,float y,void* output,uint32_t length) {return invoke([&]{if(!std::isfinite(x)||!std::isfinite(y))throw std::runtime_error("invalid hit coordinate");text(client(handle)->renderer->hit(id,x,y),output,length);});}
int32_t nelyx_skia_release(uint64_t handle,uint32_t id) {return invoke([&]{client(handle)->renderer->release(id);});}
int32_t nelyx_skia_asset_load(uint64_t handle,uint32_t id,uint32_t kind,const char* path,const char* family) {return invoke([&]{if(!id||!path||!family||std::strlen(path)>32768||std::strlen(family)>256)throw std::runtime_error("invalid asset arguments");client(handle)->renderer->loadAsset(id,kind,path,family);});}
int32_t nelyx_skia_asset_release(uint64_t handle,uint32_t id,uint32_t kind) {return invoke([&]{client(handle)->renderer->releaseAsset(id,kind);});}
int32_t nelyx_skia_asset_load_bytes(uint64_t handle,uint32_t id,uint32_t kind,const void* bytes,uint32_t length,const char* family) {return invoke([&]{if(!bytes||!length||length>16*1024*1024||!family||std::strlen(family)>256)throw std::runtime_error("invalid asset bytes/family");const auto begin=static_cast<const uint8_t*>(bytes);client(handle)->renderer->loadAssetBytes(id,kind,std::vector<uint8_t>(begin,begin+length),family);});}
int32_t nelyx_skia_layout_font(uint64_t handle,uint32_t id,uint32_t font,const char* value,float width,float size,const char* locale,uint32_t rtl,uint32_t color,uint32_t maxLines,const char* ellipsis,void* output,uint32_t length) {return invoke([&]{if(!id||!font||!value||!locale||!ellipsis||!output||length<32768||std::strlen(value)>16384||!std::isfinite(size)||size<=0||size>512||rtl>1||maxLines<1||maxLines>128)throw std::runtime_error("invalid paragraph arguments/budget");text(client(handle)->renderer->layoutWithFont(id,font,value,width,size,locale,rtl!=0,color,maxLines,ellipsis),output,length);});}
int32_t nelyx_skia_retire(uint64_t handle) {return invoke([&]{client(handle)->renderer->retireGpu();});}
int32_t nelyx_skia_last_error(void* output,uint32_t length) {try{text(lastError,output,length);return 0;}catch(...){return -1;}}
