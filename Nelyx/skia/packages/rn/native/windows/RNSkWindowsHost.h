// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RuntimeServices.h"
#include "../vulkan/RNSkVulkanRuntime.h"
#include "CompositionSession.h"
#include "CompositorFrameClock.h"
#include "WindowsMonotonic.h"
#include <map>

namespace RNSkia {
struct WindowsSkiaHostOptions {
  std::vector<std::wstring> assetRoots;
  std::string icuUri;
  float density=1;
  std::function<std::shared_ptr<nelyx::vulkan::Device>()> createDevice;
  std::function<sk_sp<SkImage>(size_t)> screenshot;
  std::function<void(const std::exception&)> reportError;
  std::shared_ptr<WindowsCompositionSession> composition;
};

// Native host binding owner. RNW owns the VM/window/dispatchers. A Composition
// component must supply the same device and actual screenshot registry ports.
class RNSkWindowsHost final : public std::enable_shared_from_this<RNSkWindowsHost> {
public:
  static std::shared_ptr<RNSkWindowsHost> install(facebook::jsi::Runtime &runtime,
      winrt::Microsoft::ReactNative::ReactContext context,WindowsSkiaHostOptions options) {
    auto value=std::shared_ptr<RNSkWindowsHost>(new RNSkWindowsHost(runtime,std::move(options)));
    {std::lock_guard lock(processMutex);if(poisoned || !published.expired())throw std::runtime_error("Windows Skia runtime replacement requires confirmed drain");published=value;}
    try{value->initialize(std::move(context));}
    catch(...){retainUnconfirmed(value);throw;}
    return value;
  }
  static void retainUnconfirmed(const std::shared_ptr<RNSkWindowsHost> &value) {
    if(!value || value->closed.load())return;
    if(value->frameClock)value->frameClock->stop();
    if(value->services)value->services->seal();
    if(value->options.composition)value->options.composition->fail();
    std::lock_guard lock(processMutex);
    if(value->retained)return;value->retained=true;poisoned=true;
    // Deliberately survive module/VM teardown without off-owner JSI destruction.
    static auto *retainedOwners=new std::vector<std::shared_ptr<RNSkWindowsHost>>();retainedOwners->push_back(value);
  }
  bool isClosed() const {return closed.load();}
  bool isActive() const {return !closed.load() && !retained.load();}
  void requireOwner() const {if(owner!=std::this_thread::get_id())throw std::runtime_error("Windows Skia binding requires its JS owner");}
  void closeBindings() {
    requireOwner();if(closed.load())return;
    if(retained || !scope)throw std::runtime_error("Windows binding cleanup is unconfirmed");
    if(options.composition)options.composition->prepareJsClose(); // recoverable while UI leases remain
    try {
      frameClock->stop();frameCallbacks.clear();frameArmed=false;
      scope->close(runtime);scope.reset();services.reset();
      if(options.composition)options.composition->finishJsClose();
      shutdownHandler.reset();closed.store(true);
      std::lock_guard lock(processMutex);if(published.lock().get()==this)published.reset();
    }catch(...){retainUnconfirmed(shared_from_this());throw;}
  }
private:
  RNSkWindowsHost(facebook::jsi::Runtime &runtime,WindowsSkiaHostOptions options)
      : runtime(runtime),options(std::move(options)),owner(std::this_thread::get_id()),generation(++nextGeneration) {
    if(generation>9007199254740991ULL || !this->options.createDevice || !this->options.screenshot || !this->options.reportError || this->options.icuUri.empty())
      throw std::runtime_error("Complete Windows device/view/error/ICU ports required");
  }
  void initialize(winrt::Microsoft::ReactNative::ReactContext context) {
    requireOwner();namespace jsi=facebook::jsi;
    if(!runtime.global().getProperty(runtime,"NelyxWindowsHost").isUndefined())throw std::runtime_error("Windows host status already installed");
    auto invoker=context.CallInvoker();services=std::make_shared<WindowsRuntimeServices>(context,invoker,options.assetRoots);
    services->initializeIcu(options.icuUri);
    auto ports=services->ports([weak=weak_from_this()](){auto self=weak.lock();if(!self)throw std::runtime_error("Windows device owner expired");++self->deviceCreations;return self->options.createDevice();},options.screenshot,options.reportError);
    scope=std::make_shared<RNSkVulkanRuntime>(runtime,std::move(invoker),options.density,std::move(ports),[services=services](){services->close();});
    if(options.composition)options.composition->bind(scope,generation,
      [weak=weak_from_this(),scheduler=context.CallInvoker()](auto complete){
        scheduler->invokeAsync([weak,complete=std::move(complete)](jsi::Runtime&) mutable {
          if(auto self=weak.lock())self->requestShutdown(std::move(complete));else complete("Windows runtime owner expired");
        });});
    frameClock=std::make_unique<CompositorFrameClock>([weak=weak_from_this(),scheduler=context.CallInvoker()](std::string failure){
      const auto tick=windowsMonotonicMilliseconds();
      scheduler->invokeAsync([weak,tick,failure=std::move(failure)](jsi::Runtime& rt){if(auto self=weak.lock())self->deliverFrames(rt,failure,tick);});
    });
    jsi::Object api(runtime);auto weak=weak_from_this();
    api.setProperty(runtime,"frameClockVersion",1);
    api.setProperty(runtime,"getMonotonicTime",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"getMonotonicTime"),0,
      [](jsi::Runtime&,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{return jsi::Value(windowsMonotonicMilliseconds());}));
    api.setProperty(runtime,"drainFrameTrace",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"drainFrameTrace"),0,
      [weak](jsi::Runtime& rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{
        auto self=weak.lock();if(!self||!self->options.composition)throw jsi::JSError(rt,"Native frame trace owner unavailable");self->requireOwner();
        const auto entries=self->options.composition->frameTrace.drain();jsi::Array result(rt,entries.size());
        for(size_t index=0;index<entries.size();++index){const auto& e=entries[index];jsi::Object value(rt);
          value.setProperty(rt,"view",double(e.view));value.setProperty(rt,"ownerGeneration",double(e.identity.owner));value.setProperty(rt,"viewportGeneration",double(e.identity.viewport));
          value.setProperty(rt,"surfaceGeneration",double(e.surface));value.setProperty(rt,"contextGeneration",double(e.identity.context));value.setProperty(rt,"frameSequence",double(e.identity.frame));
          value.setProperty(rt,"inputSequence",double(e.identity.input));value.setProperty(rt,"submission",double(e.identity.submission));value.setProperty(rt,"stage",double(e.stage));
          value.setProperty(rt,"nativeTimestamp",e.timestamp);value.setProperty(rt,"inputTimestamp",e.identity.inputTimestamp);value.setProperty(rt,"tick",e.identity.tick);value.setProperty(rt,"clockUncertainty",e.identity.clockUncertainty);
          value.setProperty(rt,"width",double(e.width));value.setProperty(rt,"height",double(e.height));result.setValueAtIndex(rt,index,std::move(value));
        }return result;
      }));
    api.setProperty(runtime,"requestFrame",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"requestFrame"),1,
      [weak](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows frame owner expired");self->requireOwner();
        if(!self->isActive()||count!=1||!args[0].isObject()||!args[0].getObject(rt).isFunction(rt)||self->frameCallbacks.size()>=4096||self->nextFrame>=9007199254740991ULL)throw jsi::JSError(rt,"Windows frame request requires an active owner and callback within admission");
        const auto id=++self->nextFrame;self->frameCallbacks.emplace(id,args[0].getObject(rt).getFunction(rt));
        if(!self->frameArmed){try{self->frameClock->request();self->frameArmed=true;}catch(std::exception const& error){self->frameCallbacks.erase(id);throw jsi::JSError(rt,error.what());}}
        return jsi::Value(static_cast<double>(id));
      }));
    api.setProperty(runtime,"cancelFrame",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"cancelFrame"),1,
      [weak](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows frame owner expired");self->requireOwner();
        if(count!=1||!args[0].isNumber()||!std::isfinite(args[0].getNumber())||args[0].getNumber()<1||args[0].getNumber()>9007199254740991.0||args[0].getNumber()!=std::floor(args[0].getNumber()))throw jsi::JSError(rt,"Invalid Windows frame cancellation id");
        self->frameCallbacks.erase(static_cast<uint64_t>(args[0].getNumber()));return jsi::Value::undefined();
      }));
    api.setProperty(runtime,"getStatus",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"getStatus"),0,
      [weak](jsi::Runtime &rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value {
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows runtime owner expired");self->requireOwner();
        jsi::Object status(rt);status.setProperty(rt,"abi",1);status.setProperty(rt,"platform","windows");status.setProperty(rt,"runtimeGeneration",static_cast<double>(self->generation));
        status.setProperty(rt,"phase",self->closed.load()?"closed":self->retained?"failed":"active");status.setProperty(rt,"deviceCreations",static_cast<double>(self->deviceCreations.load()));
        status.setProperty(rt,"pendingAsync",static_cast<double>(self->services?self->services->pendingAsync():0));
        status.setProperty(rt,"uiFailure",jsi::String::createFromUtf8(rt,self->services?self->services->uiFailureReason():""));
        status.setProperty(rt,"frameClock",jsi::String::createFromUtf8(rt,self->frameClock?self->frameClock->source():"closed"));status.setProperty(rt,"pendingFrames",static_cast<double>(self->frameCallbacks.size()));status.setProperty(rt,"frameTicks",static_cast<double>(self->frameTicks));
        if(self->options.composition){auto value=self->options.composition->status();
          status.setProperty(rt,"compositionFailure",jsi::String::createFromUtf8(rt,value.failure));
          status.setProperty(rt,"compositionPhase",jsi::String::createFromUtf8(rt,value.phase));status.setProperty(rt,"nativeAdapter",jsi::String::createFromUtf8(rt,value.adapter));
          status.setProperty(rt,"uiConsumers",static_cast<double>(value.consumers));status.setProperty(rt,"registeredViews",static_cast<double>(value.views));status.setProperty(rt,"gpuCreatedOnJs",value.jsCreator&&value.deviceCreations==1);status.setProperty(rt,"gpuDrained",value.drained);}
        status.setProperty(rt,"assetRoot",jsi::String::createFromUtf8(rt,winrt::to_string(self->options.assetRoots.front())));return status;
      }));
    api.setProperty(runtime,"prepareCompositionGpu",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"prepareCompositionGpu"),0,
      [weak](jsi::Runtime &rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value {
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows owner expired");self->requireOwner();
        if(!self->options.composition || !self->isActive())throw jsi::JSError(rt,"Actual Composition session is unavailable");
        try{self->options.composition->prepareGpu();return jsi::Value::undefined();}
        catch(const std::exception& error){retainUnconfirmed(self);throw jsi::JSError(rt,error.what());}
      }));
    api.setProperty(runtime,"registerShutdownHandler",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"registerShutdownHandler"),1,
      [weak](jsi::Runtime &rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value {
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows owner expired");self->requireOwner();
        if(!self->isActive() || !self->options.composition || self->shutdownRegistered || count!=1 || !args[0].isObject() || !args[0].getObject(rt).isFunction(rt))
          throw jsi::JSError(rt,"Windows shutdown registration requires one active Composition owner");
        self->shutdownHandler=std::make_unique<jsi::Function>(args[0].getObject(rt).getFunction(rt));self->shutdownRegistered=true;return jsi::Value::undefined();
      }));
    api.setProperty(runtime,"closeBindings",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"closeBindings"),0,
      [weak](jsi::Runtime &rt,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value {
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows runtime owner expired");
        try{self->closeBindings();return jsi::Value::undefined();}catch(const std::exception &error){throw jsi::JSError(rt,error.what());}
      }));
    runtime.global().setProperty(runtime,"NelyxWindowsHost",std::move(api));
  }
  void requestShutdown(WindowsCompositionSession::Completion complete) {
    requireOwner();namespace jsi=facebook::jsi;
    if(shutdownRequested || !shutdownHandler){complete("Windows JS shutdown handler unavailable or stale");retainUnconfirmed(shared_from_this());return;}
    shutdownRequested=true;
    auto callback=shutdownHandler->getFunction(runtime);shutdownHandler.reset(); // local JS-owner copy permits synchronous ACK
    auto acknowledge=jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"completeWindowsShutdown"),1,
      [weak=weak_from_this(),complete](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value {
        auto self=weak.lock();if(!self)throw jsi::JSError(rt,"Windows shutdown owner expired");self->requireOwner();
        if(self->shutdownAcknowledged || count>1 || (count && !args[0].isUndefined() && !args[0].isString()))throw jsi::JSError(rt,"Invalid or duplicate Windows shutdown ACK");
        std::string failure=count && args[0].isString()?args[0].getString(rt).utf8(rt):"";
        if(failure.size()>1024)failure.resize(1024);
        if(failure.empty() && !self->isClosed())throw jsi::JSError(rt,"Windows ACK requires confirmed JS binding/GPU close");
        self->shutdownAcknowledged=true;if(!failure.empty()){self->options.composition->fail(failure);retainUnconfirmed(self);}complete(std::move(failure));return jsi::Value::undefined();
      });
    try{callback.call(runtime,std::move(acknowledge));}
    catch(const std::exception& error){options.composition->fail(error.what());retainUnconfirmed(shared_from_this());if(!shutdownAcknowledged){shutdownAcknowledged=true;complete(error.what());}}
  }
  void deliverFrames(facebook::jsi::Runtime& rt,const std::string& failure,double tick){
    requireOwner();if(!isActive())return;frameArmed=false;++frameTicks;
    std::vector<uint64_t> batch;batch.reserve(frameCallbacks.size());for(auto const& entry:frameCallbacks)batch.push_back(entry.first);
    std::exception_ptr firstFailure;
    for(const auto id:batch){const auto found=frameCallbacks.find(id);if(found==frameCallbacks.end())continue;auto callback=std::move(found->second);frameCallbacks.erase(found);
      try{if(failure.empty()){
        facebook::jsi::Object timing(rt);timing.setProperty(rt,"nativeTick",tick);timing.setProperty(rt,"nativeDispatch",windowsMonotonicMilliseconds());
        callback.call(rt,facebook::jsi::Value::undefined(),std::move(timing));
      }else callback.call(rt,facebook::jsi::String::createFromUtf8(rt,failure));}catch(...){if(!firstFailure)firstFailure=std::current_exception();}}
    if(firstFailure)std::rethrow_exception(firstFailure);
  }
  facebook::jsi::Runtime &runtime;
  WindowsSkiaHostOptions options;
  const std::thread::id owner;
  const uint64_t generation;
  std::shared_ptr<WindowsRuntimeServices> services;
  std::shared_ptr<RNSkVulkanRuntime> scope;
  std::unique_ptr<facebook::jsi::Function> shutdownHandler;
  std::unique_ptr<CompositorFrameClock> frameClock;
  std::map<uint64_t,facebook::jsi::Function> frameCallbacks;
  uint64_t nextFrame=0,frameTicks=0;bool frameArmed=false;
  bool shutdownRegistered=false,shutdownRequested=false,shutdownAcknowledged=false;
  std::atomic<bool> closed{false};
  std::atomic<bool> retained{false};
  std::atomic<size_t> deviceCreations{0};
  inline static std::mutex processMutex;
  inline static bool poisoned=false;
  inline static std::weak_ptr<RNSkWindowsHost> published;
  inline static std::atomic<uint64_t> nextGeneration{0};
};
} // namespace RNSkia
