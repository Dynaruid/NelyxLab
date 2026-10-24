// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SkiaViewComponent.h"
#include "RuntimeServices.h"
#include <optional>
#include <cstring>
#include <functional>
// Public GDK type-query ABI, without Xlib macros (Always/None/Status) leaking
// into consumers such as React Native's text-input enum declarations.
extern "C" {
GType gdk_x11_display_get_type(void);
GType gdk_wayland_display_get_type(void);
}

namespace RNSkia {
enum class LinuxSkiaWindowSystem { X11, Wayland };
struct LinuxSkiaHostOptions {
  std::vector<std::string> assetRoots;
  std::string developmentAssetOrigin;
  LinuxSkiaWindowSystem windowSystem=LinuxSkiaWindowSystem::X11;
};

/** Installs services/components into an RNL-owned window/runtime. No new window,
 * second Vulkan device, runtime download, renderer or software fallback. */
class RNSkLinuxHost final : public std::enable_shared_from_this<RNSkLinuxHost> {
  struct WeakWidget {GWeakRef value;explicit WeakWidget(GtkWidget* widget){g_weak_ref_init(&value,G_OBJECT(widget));}~WeakWidget(){g_weak_ref_clear(&value);}};
public:
  static std::shared_ptr<RNSkLinuxHost> install(rnlinux::RNLinuxHost::Config& config,LinuxSkiaHostOptions options) {
    if(config.initializeRuntime || config.activateRuntime || config.initializeNativeHost || config.requestRuntimeShutdown)
      throw std::runtime_error("Linux Skia host requires exclusive native runtime initialization hooks");
    if(options.assetRoots.empty() || options.assetRoots.size()>8)
      throw std::runtime_error("Linux Skia host requires 1..8 explicit asset roots");
    if((options.windowSystem!=LinuxSkiaWindowSystem::X11 && options.windowSystem!=LinuxSkiaWindowSystem::Wayland))
      throw std::runtime_error("Linux Skia host policy/window system is invalid");
    auto value=std::shared_ptr<RNSkLinuxHost>(new RNSkLinuxHost(std::move(options)));
    installLinuxSkiaComponent(config,value->viewSession);
    config.initializeNativeHost=[value](void* root,auto& registry){value->prepareUi(root,registry);};
    config.initializeRuntime=[value](facebook::jsi::Runtime& runtime,auto invoker){
      value->prepareJs(runtime,std::move(invoker));
      return [value](facebook::jsi::Runtime& current){value->closeJs(current);};
    };
    config.activateRuntime=[value](facebook::jsi::Runtime&){value->activateJs();};
    config.requestRuntimeShutdown=[value](facebook::jsi::Runtime& runtime,auto complete){value->requestShutdown(runtime,std::move(complete));};
    return value;
  }
  std::shared_ptr<LinuxSkiaSession> session() const {return viewSession;}
  std::shared_ptr<RNSkVulkanRuntime> runtime() const {requireJs();return scope;}
  std::shared_ptr<LinuxRuntimeServices> services() const {requireJs();return serviceOwner;}
private:
  explicit RNSkLinuxHost(LinuxSkiaHostOptions value):options(std::move(value)),uiOwner(std::this_thread::get_id()),viewSession(std::make_shared<LinuxSkiaSession>()) {}
  void prepareUi(void* borrowedRoot,rnlinux::LinuxComponentViewRegistry& value) {
    if(std::this_thread::get_id()!=uiOwner || registry)throw std::runtime_error("Linux native host setup requires its initial GTK owner");
    auto* root=static_cast<GtkWidget*>(borrowedRoot);
    if(!root || !GTK_IS_WIDGET(root))throw std::runtime_error("Linux native host requires the RNL-owned GTK root");
    rootWidget=std::make_shared<WeakWidget>(root);
    auto* display=gtk_widget_get_display(root);
    const auto expected=options.windowSystem==LinuxSkiaWindowSystem::X11 ? gdk_x11_display_get_type() : gdk_wayland_display_get_type();
    if(!display || !G_TYPE_CHECK_INSTANCE_TYPE(display,expected))
      throw std::runtime_error("Linux native host window system differs from its requested profile");
    dmaOptions=linuxDmaBufOptions(display);
    registry=&value;
  }
  void prepareJs(facebook::jsi::Runtime& runtime,std::shared_ptr<facebook::react::CallInvoker> invoker) {
    if(!registry || scope || closed)throw std::runtime_error("Linux native host requires UI setup before its first runtime");
    jsOwner=std::this_thread::get_id();
    jsRuntime=&runtime;
    if(!runtime.global().getProperty(runtime,"NelyxLinuxHost").isUndefined())throw std::runtime_error("Linux native host status already belongs to this runtime");
    serviceOwner=std::make_shared<LinuxRuntimeServices>(*registry,options.assetRoots,options.developmentAssetOrigin);
    auto ports=serviceOwner->ports(invoker);
    {
      if(!dmaOptions)throw std::runtime_error("Linux native host has no owning display DMA-BUF options");
      ports.createDevice=[value=*dmaOptions]{return std::make_shared<nelyx::vulkan::Device>(value);};
    }
    scope=std::make_shared<RNSkVulkanRuntime>(runtime,std::move(invoker),1,std::move(ports),[services=serviceOwner]{services->close();});
    viewSession->bind(scope,false); // Cleanup is registered before GPU activation.
    facebook::jsi::Object api(runtime);
    api.setProperty(runtime,"getPreferredLocales",facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime,"getPreferredLocales"),0,
      [weak=weak_from_this()](facebook::jsi::Runtime& current,const facebook::jsi::Value&,const facebook::jsi::Value*,size_t)->facebook::jsi::Value {
        auto owner=weak.lock();if(!owner)throw facebook::jsi::JSError(current,"Linux native host owner expired");
        owner->requireRuntime(current);if(owner->closed)throw facebook::jsi::JSError(current,"Linux native host is closed");
        const gchar* const* names=g_get_language_names();size_t count=0;while(names[count]){if(count>=256||std::strlen(names[count])>128)throw facebook::jsi::JSError(current,"Preferred-language snapshot exceeds its budget");++count;}
        facebook::jsi::Array locales(current,count);
        for(size_t index=0;index<count;++index)locales.setValueAtIndex(current,index,facebook::jsi::String::createFromUtf8(current,names[index]));
        facebook::jsi::Object snapshot(current);snapshot.setProperty(current,"locales",std::move(locales));snapshot.setProperty(current,"format",facebook::jsi::String::createFromAscii(current,"posix"));return snapshot;
      }));
    api.setProperty(runtime,"popSystemNavigator",facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime,"popSystemNavigator"),1,
      [weak=weak_from_this()](facebook::jsi::Runtime& current,const facebook::jsi::Value&,const facebook::jsi::Value* args,size_t count)->facebook::jsi::Value {
        auto owner=weak.lock();if(!owner)throw facebook::jsi::JSError(current,"Linux native host owner expired");owner->requireRuntime(current);
        if(owner->closed||owner->viewSession->isClosing()||!owner->rootWidget||count!=1||!args[0].isBool())throw facebook::jsi::JSError(current,"Linux root close request is unavailable or invalid");
        auto* callback=new std::function<void()>([weak]{if(auto value=weak.lock()){
          if(value->viewSession->isClosing()||std::this_thread::get_id()!=value->uiOwner)return;
          auto* object=g_weak_ref_get(&value->rootWidget->value);if(!object)return;
          auto* root=gtk_widget_get_root(GTK_WIDGET(object));if(root&&GTK_IS_WINDOW(root))gtk_window_close(GTK_WINDOW(root));g_object_unref(object);
        }});
        g_idle_add_full(G_PRIORITY_DEFAULT,[](gpointer data)->gboolean{(*static_cast<std::function<void()>*>(data))();return G_SOURCE_REMOVE;},callback,[](gpointer data){delete static_cast<std::function<void()>*>(data);});
        return facebook::jsi::Value::undefined();
      }));
    api.setProperty(runtime,"getStatus",facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime,"getStatus"),0,
      [weak=weak_from_this()](facebook::jsi::Runtime& current,const facebook::jsi::Value&,const facebook::jsi::Value*,size_t)->facebook::jsi::Value {
        auto value=weak.lock();if(!value)throw facebook::jsi::JSError(current,"Linux native host owner expired");
        try{return value->status(current);}catch(const std::exception& error){throw facebook::jsi::JSError(current,error.what());}
      }));
    api.setProperty(runtime,"registerShutdownHandler",facebook::jsi::Function::createFromHostFunction(runtime,
      facebook::jsi::PropNameID::forAscii(runtime,"registerShutdownHandler"),1,
      [weak=weak_from_this()](facebook::jsi::Runtime& current,const facebook::jsi::Value&,const facebook::jsi::Value* args,size_t count)->facebook::jsi::Value {
        auto value=weak.lock();if(!value)throw facebook::jsi::JSError(current,"Linux native host owner expired");
        try {
          value->requireRuntime(current);
          if(!value->activated || value->closed || value->viewSession->isClosing() || value->shutdownHandler || count!=1 || !args[0].isObject() || !args[0].getObject(current).isFunction(current))
            throw std::runtime_error("Linux shutdown handler requires one active runtime owner");
          value->shutdownHandler=std::make_unique<facebook::jsi::Function>(args[0].getObject(current).getFunction(current));
          return facebook::jsi::Value::undefined();
        }catch(const std::exception& error){throw facebook::jsi::JSError(current,error.what());}
      }));
    runtime.global().setProperty(runtime,"NelyxLinuxHost",std::move(api));
  }
  void activateJs() {
    requireJs();if(!scope || activated || closed)throw std::runtime_error("Linux native host activation is stale or closed");
    viewSession->prepareGpu();
    activated=true;
  }
  void closeJs(facebook::jsi::Runtime& runtime) {
    requireRuntime(runtime);if(closed)return;
    if(shutdownHandler && (!shutdownAcknowledged || !shutdownFailure.empty()))throw std::runtime_error("Linux SDK shutdown unconfirmed; runtime retained");
    viewSession->closeJs();scope->close(runtime);
    runtime.global().setProperty(runtime,"NelyxLinuxHost",facebook::jsi::Value::undefined());
    shutdownHandler.reset();scope.reset();serviceOwner.reset();closed=true;
  }
  void requestShutdown(facebook::jsi::Runtime& runtime,rnlinux::RNLinuxHost::Config::RuntimeShutdownCompletion complete) {
    requireRuntime(runtime);
    if(!viewSession->isClosing() || shutdownRequested || closed)throw std::runtime_error("Linux SDK shutdown requires initial prepared close");
    shutdownRequested=true;
    if(!shutdownHandler){shutdownAcknowledged=true;complete({});return;}
    auto acknowledge=facebook::jsi::Function::createFromHostFunction(runtime,facebook::jsi::PropNameID::forAscii(runtime,"completeShutdown"),1,
      [weak=weak_from_this(),complete](facebook::jsi::Runtime& current,const facebook::jsi::Value&,const facebook::jsi::Value* args,size_t count)->facebook::jsi::Value {
        auto value=weak.lock();if(!value)throw facebook::jsi::JSError(current,"Linux shutdown owner expired");
        try {
          value->requireRuntime(current);
          if(value->shutdownAcknowledged || count>1 || (count && !args[0].isUndefined() && !args[0].isString()))throw std::runtime_error("Invalid or duplicate Linux shutdown acknowledgement");
          std::string failure=count && args[0].isString()?args[0].getString(current).utf8(current):std::string{};
          if(count && args[0].isString() && failure.empty())throw std::runtime_error("Linux shutdown failure must be nonempty");
          value->shutdownAcknowledged=true;value->shutdownFailure=failure;
          complete(std::move(failure));return facebook::jsi::Value::undefined();
        }catch(const std::exception& error){throw facebook::jsi::JSError(current,error.what());}
      });
    shutdownHandler->call(runtime,std::move(acknowledge));
  }
  void requireRuntime(facebook::jsi::Runtime& runtime) const {
    requireJs();if(jsRuntime!=&runtime)throw std::runtime_error("Foreign Linux host runtime rejected");
  }
  facebook::jsi::Object status(facebook::jsi::Runtime& runtime) const {
    requireJs();if(jsRuntime!=&runtime)throw std::runtime_error("Foreign Linux host runtime status rejected");
    const bool closing=viewSession->isClosing();
    const char* phase=closed?"closed":closing?"closing":activated?"active":"prepared";
    facebook::jsi::Object value(runtime);value.setProperty(runtime,"abi",1);value.setProperty(runtime,"platform","linux");
    value.setProperty(runtime,"runtimeGeneration",static_cast<double>(generation));
    value.setProperty(runtime,"windowSystem",options.windowSystem==LinuxSkiaWindowSystem::X11?"x11":"wayland");
    value.setProperty(runtime,"gpuMode","hardware-dmabuf");
    value.setProperty(runtime,"phase",phase);value.setProperty(runtime,"gpuPrepared",activated && !closed && !closing && viewSession->hasGpu());
    return value;
  }
  void requireJs() const {if(std::this_thread::get_id()!=jsOwner)throw std::runtime_error("Linux native host requires its JS owner");}
  LinuxSkiaHostOptions options;
  const std::thread::id uiOwner;
  std::thread::id jsOwner;
  facebook::jsi::Runtime* jsRuntime{};
  inline static std::atomic<uint64_t> nextGeneration{};
  const uint64_t generation=++nextGeneration;
  std::shared_ptr<LinuxSkiaSession> viewSession;
  rnlinux::LinuxComponentViewRegistry* registry{};
  std::shared_ptr<WeakWidget> rootWidget;
  std::optional<nelyx::vulkan::DmaBufDeviceOptions> dmaOptions;
  std::shared_ptr<LinuxRuntimeServices> serviceOwner;
  std::shared_ptr<RNSkVulkanRuntime> scope;
  std::unique_ptr<facebook::jsi::Function> shutdownHandler; // Retired on live JS owner only.
  std::string shutdownFailure;
  bool shutdownRequested=false,shutdownAcknowledged=false;
  bool activated=false,closed=false;
};
}
