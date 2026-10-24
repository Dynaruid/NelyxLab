// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkVulkanRuntime.h"
#include "DevelopmentAssets.h"
#include "fabric/LinuxComponentViewRegistry.h"
#include "include/ports/SkFontMgr_empty.h"
#include <gtk/gtk.h>
#include <atomic>
#include <filesystem>
#include <iostream>
#include <unordered_map>
#include <vector>

namespace RNSkia {
// One instance per RNL host/runtime. GTK registry access stays on its UI owner.
// File assets are regular local files within the explicit bundle asset root.
// Debug development HTTP assets use only the explicit owning loopback origin.
class LinuxRuntimeServices final : public std::enable_shared_from_this<LinuxRuntimeServices> {
  struct UiJob {std::function<void()> task;GSource* source{};~UiJob(){if(source){g_source_destroy(source);g_source_unref(source);}}};
  struct Dispatch {std::weak_ptr<LinuxRuntimeServices> services;uint64_t id;};
public:
  LinuxRuntimeServices(rnlinux::LinuxComponentViewRegistry& registry,std::string assetRoot)
      : LinuxRuntimeServices(registry,std::vector<std::string>{std::move(assetRoot)}) {}
  LinuxRuntimeServices(rnlinux::LinuxComponentViewRegistry& registry,std::vector<std::string> roots,std::string developmentOrigin={})
      : registry(registry),assetRoots(canonicalRoots(roots)),developmentOrigin(checkedLinuxDevelopmentOrigin(std::move(developmentOrigin))),main(g_main_context_ref(g_main_context_default())) {}
  ~LinuxRuntimeServices() {g_main_context_unref(main);}
  VulkanPlatformServices ports(std::shared_ptr<facebook::react::CallInvoker> actualInvoker) {
    owner=std::this_thread::get_id();invoker=std::move(actualInvoker);
    auto self=shared_from_this();VulkanPlatformServices value;
    value.dispatchToMain=[self](auto task){self->dispatch(std::move(task));};
    value.stream=[self](const std::string& uri,const auto& callback){
      self->requireOwner();
      if(self->closed){callback(nullptr);return;}
      if(uri.starts_with("http:")||uri.starts_with("https:")) {
        std::unique_ptr<SkStreamAsset> stream;
        try{const auto bytes=readLinuxDevelopmentAsset(uri,self->developmentOrigin);stream=std::make_unique<SkMemoryStream>(bytes.data(),bytes.size(),true);}catch(const std::exception&){callback(nullptr);return;}
        callback(std::move(stream));return;
      }
      std::string file=uri;
      if(uri.starts_with("file:")) {
        GError* error=nullptr;char* decoded=g_filename_from_uri(uri.c_str(),nullptr,&error);
        if(!decoded){if(error)g_error_free(error);callback(nullptr);return;}
        file=decoded;g_free(decoded);
      }
      std::error_code error;auto path=std::filesystem::canonical(file,error);
      bool admitted=false;
      if(!error)for(const auto& root:self->assetRoots) {
        auto relative=path.lexically_relative(root);
        if(!relative.empty() && !relative.is_absolute() && *relative.begin()!="..") {admitted=true;break;}
      }
      if(error || !admitted ||
         !std::filesystem::is_regular_file(path,error) || error || std::filesystem::file_size(path,error)>16*1024*1024 || error) {
        callback(nullptr);return;
      }
      // A local bounded read. The generic Data API resolves through the actual
      // scheduled JS CallInvoker, so Promise continuations run in RN ticks.
      callback(SkStream::MakeFromFile(path.string().c_str()));
    };
    value.fontManager=[] {return SkFontMgr_New_Custom_Empty();}; // Asset font providers own decoded fonts.
    value.screenshot=[self](size_t tag){return self->screenshot(tag);};
    value.reportError=[](const std::exception& error){throw std::runtime_error(error.what());};
    value.createDevice=[] {throw std::runtime_error("Linux runtime requires its owning display DMA-BUF device factory");return std::shared_ptr<nelyx::vulkan::Device>{};};
    return value;
  }
  void close() {
    requireOwner();
    std::unordered_map<uint64_t,std::shared_ptr<UiJob>> cancelled;
    {std::lock_guard lock(mutex);if(inFlight.load())throw std::runtime_error("GTK callback still owns native runtime work");closed=true;cancelled.swap(jobs);}
    cancelled.clear(); // Destroy callback captures on their live JS owner.
  }
  size_t pendingUi() {std::lock_guard lock(mutex);return jobs.size();}
private:
  static std::vector<std::filesystem::path> canonicalRoots(const std::vector<std::string>& roots) {
    if(roots.empty() || roots.size()>8)throw std::runtime_error("Linux asset roots require 1..8 explicit directories");
    std::vector<std::filesystem::path> result;
    for(const auto& root:roots) {
      auto path=std::filesystem::canonical(root);
      if(!std::filesystem::is_directory(path) || path==path.root_path())throw std::runtime_error("Linux asset root must be an explicit non-root directory");
      result.push_back(std::move(path));
    }
    return result;
  }
  void requireOwner() const {if(owner!=std::this_thread::get_id())throw std::runtime_error("Linux service requires its JS owner");}
  void dispatch(std::function<void()> task) {
    // Native view/producer scheduling also originates on GTK and render-pool
    // threads. Captures stay in the owned map and retire on the JS owner.
    auto job=std::make_shared<UiJob>();job->task=std::move(task);job->source=g_idle_source_new();
    uint64_t id;
    {std::lock_guard lock(mutex);if(closed)throw std::runtime_error("Linux services closed");if(jobs.size()>=64)throw std::runtime_error("Linux UI callback budget exceeded");id=++next;jobs.emplace(id,job);
    auto* data=new Dispatch{weak_from_this(),id};
    g_source_set_callback(job->source,[](gpointer pointer)->gboolean {
      auto& data=*static_cast<Dispatch*>(pointer);auto self=data.services.lock();if(!self)return G_SOURCE_REMOVE;
      const auto weak=data.services;const auto id=data.id;
      std::shared_ptr<UiJob> job;
      {std::lock_guard lock(self->mutex);auto found=self->jobs.find(data.id);if(found==self->jobs.end())return G_SOURCE_REMOVE;job=found->second;self->inFlight++;}
      std::string failure;
      try{job->task();}catch(const std::exception& error){failure=error.what();}
      job.reset(); // The JS-owned map still owns every callback capture.
      self->inFlight--;
      self->invoker->invokeAsync([weak,id,failure](facebook::jsi::Runtime&) {
        auto self=weak.lock();if(!self)return;
        {std::lock_guard lock(self->mutex);self->jobs.erase(id);}
        if(!failure.empty())throw std::runtime_error(failure);
      });
      return G_SOURCE_REMOVE;
    },data,[](gpointer pointer){delete static_cast<Dispatch*>(pointer);});
    g_source_attach(job->source,main);
    } // Publish/configure/attach atomically with respect to owner close.
  }
  sk_sp<SkImage> screenshot(size_t tag) {
    auto* view=registry.lookup(static_cast<rnlinux::Tag>(tag));
    auto* widget=view?view->widget():nullptr;
    if(!widget || !gtk_widget_get_mapped(widget))return nullptr;
    const int width=gtk_widget_get_width(widget),height=gtk_widget_get_height(widget);
    auto* native=gtk_widget_get_native(widget);auto* renderer=native?gtk_native_get_renderer(native):nullptr;
    if(width<=0 || height<=0 || width>8192 || height>8192 || int64_t(width)*height>16*1024*1024 || !renderer)return nullptr;
    auto* paintable=gtk_widget_paintable_new(widget);auto* snapshot=gtk_snapshot_new();
    gdk_paintable_snapshot(paintable,GDK_SNAPSHOT(snapshot),width,height);g_object_unref(paintable);
    auto* node=gtk_snapshot_free_to_node(snapshot);if(!node)return nullptr;
    graphene_rect_t bounds=GRAPHENE_RECT_INIT(0,0,float(width),float(height));
    auto* texture=gsk_renderer_render_texture(renderer,node,&bounds);gsk_render_node_unref(node);
    if(!texture)return nullptr;
    const int pixelsWide=gdk_texture_get_width(texture),pixelsHigh=gdk_texture_get_height(texture);
    if(pixelsWide!=width || pixelsHigh!=height){g_object_unref(texture);return nullptr;}
    auto data=SkData::MakeUninitialized(size_t(width)*height*4);
    gdk_texture_download(texture,static_cast<guchar*>(data->writable_data()),size_t(width)*4);g_object_unref(texture);
    // GDK_MEMORY_DEFAULT on the locked little-endian x86_64 target is premul BGRA.
    return SkImages::RasterFromData(SkImageInfo::Make(width,height,kBGRA_8888_SkColorType,kPremul_SkAlphaType),std::move(data),size_t(width)*4);
  }
  rnlinux::LinuxComponentViewRegistry& registry;
  const std::vector<std::filesystem::path> assetRoots;
  const std::string developmentOrigin;
  GMainContext* main;
  std::thread::id owner;
  std::shared_ptr<facebook::react::CallInvoker> invoker;
  std::mutex mutex;
  bool closed=false;
  std::atomic<unsigned> inFlight=0;
  uint64_t next=0;
  std::unordered_map<uint64_t,std::shared_ptr<UiJob>> jobs;
};
}
