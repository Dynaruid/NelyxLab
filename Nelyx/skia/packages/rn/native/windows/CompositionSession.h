// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkVulkanRuntime.h"
#include "rnskia/RNSkView.h"
#include "windows/WindowsFrameWorker.h"
#include "WindowsFrameTrace.h"
#include <ReactPropertyBag.h>
#include <algorithm>
#include <map>
#include <optional>

namespace RNSkia {
class WindowsCompositionConsumer;
// Native-only handoff. No Composition/JSI objects cross this session. The UI
// supplies immutable adapter bytes; the runtime creates/closes its GPU on JS.
class WindowsCompositionSession final : public std::enable_shared_from_this<WindowsCompositionSession> {
public:
  using Completion=std::function<void(std::string)>;
  using ShutdownDispatcher=std::function<void(Completion)>;
  struct ViewTicket {uint64_t id,token;std::atomic<bool> active{true};};
  struct Status {std::string phase,adapter;uint64_t generation;uint32_t consumers,deviceCreations;bool jsCreator,drained;uint32_t views;std::string failure;};
  explicit WindowsCompositionSession(nelyx::vulkan::Win32DeviceOptions options)
    :options(options),uiOwner(std::this_thread::get_id()) {
    if(std::all_of(options.adapterLuid.begin(),options.adapterLuid.end(),[](uint8_t byte){return byte==0;}))
      throw std::runtime_error("Composition requires the actual hardware adapter LUID");
  }
  void bind(std::shared_ptr<RNSkVulkanRuntime> value,uint64_t generation,ShutdownDispatcher dispatch) {
    std::lock_guard lock(mutex);
    if(phase!="cold" || !value || !generation || !dispatch || std::this_thread::get_id()==uiOwner)
      throw std::runtime_error("Composition binding requires a fresh native session and a distinct JS owner");
    jsOwner=std::this_thread::get_id();context=value->getPlatformContext();runtime=value;this->generation=generation;shutdown=std::move(dispatch);phase="bound";
  }
  std::shared_ptr<nelyx::vulkan::Device> createDevice() {
    {std::lock_guard lock(mutex);requireJs();
      if(phase!="preparing" || attempted)throw std::runtime_error("Composition native GPU factory is single-use on its JS owner");attempted=true;}
    auto value=std::make_shared<nelyx::vulkan::Device>(options);
    {std::lock_guard lock(mutex);device=value;adapter=value->name();++creations;}
    return value;
  }
  void prepareGpu() {
    std::shared_ptr<RNSkVulkanPlatformContext> value;
    {std::lock_guard lock(mutex);requireJs();if(phase=="active")return;
      if(phase!="bound")throw std::runtime_error("Composition GPU activation is stale or closing");phase="preparing";value=context;}
    try{value->configureGpuPolicy(false);value->getGpuContext();
      if(!value->canImportWin32Texture())throw std::runtime_error("Actual native GPU lacks Windows texture import");
      std::lock_guard lock(mutex);if(phase!="preparing")throw std::runtime_error("Composition activation lost admission");phase="active";
    }catch(...){fail();throw;}
  }
  std::shared_ptr<WindowsCompositionConsumer> acquireConsumer(); // UI owner, active JS GPU only
  bool windowVisible()const{requireUi();if(!windowVisibility)throw std::runtime_error("Windows host visibility protocol1 is required");return *windowVisibility;}
  bool preparingWindow()const{requireUi();return bool(firstContent);}
  void prepareFirstContent(std::function<void()> show){requireUi();if(firstContent||!show)throw std::runtime_error("First content owner already installed");firstContent=std::move(show);}
  void firstContentReady(){requireUi();auto show=std::move(firstContent);firstContent={};if(show)show();}
  void setWindowVisible(bool visible){
    requireUi();if(windowVisibility&&*windowVisibility==visible)return;windowVisibility=visible;
    // A visibility callback can retire its own View or another subscriber.
    const auto callbacks=visibilityObservers;for(auto const& [id,callback]:callbacks)if(windowVisibility&&*windowVisibility==visible&&visibilityObservers.contains(id))callback(visible);
  }
  std::function<void()> observeWindowVisibility(std::function<void(bool)> changed){
    requireUi();windowVisible();if(!changed||nextVisibility==UINT64_MAX)throw std::runtime_error("Window visibility observer unavailable");const auto id=++nextVisibility;visibilityObservers.emplace(id,std::move(changed));
    return [weak=weak_from_this(),id]{if(auto self=weak.lock()){self->requireUi();self->visibilityObservers.erase(id);}};
  }
  bool windowVisibilityRetired()const{requireUi();return visibilityObservers.empty();}
  std::shared_ptr<RNSkVulkanPlatformContext> uiPlatform() {
    requireUi();std::lock_guard lock(mutex);if(phase!="active")throw std::runtime_error("Windows UI requires its active JS platform");return context;
  }
  std::shared_ptr<ViewTicket> registerView(uint64_t id,std::shared_ptr<RNSkView> view,Completion complete) {
    requireUi();if(!id || id>9007199254740991ULL || !view || !complete)throw std::runtime_error("Actual Windows view/id/completion required");
    auto ticket=std::make_shared<ViewTicket>();ticket->id=id;ticket->token=++nextView;
    auto value=uiPlatform();value->runOnJavascriptThread([weak=weak_from_this(),ticket,view=std::move(view),complete=std::move(complete)]() mutable {
      auto self=weak.lock();if(!self || !ticket->active)return;
      std::shared_ptr<RNSkVulkanRuntime> scope;std::string failure;bool replace=false;
      {std::lock_guard lock(self->mutex);self->requireJs();
        if(self->phase!="active")return;scope=self->runtime.lock();
        if(auto old=self->bindings.find(ticket->id);old!=self->bindings.end()){if(old->second->active)failure="Duplicate live Windows Skia nativeID";else replace=true;}}
      if(!scope)failure="Windows view runtime expired";
      if(failure.empty()){
        if(replace)scope->getManager().unregisterSkiaView(ticket->id);
        scope->getManager().registerSkiaView(ticket->id,view);
        std::lock_guard lock(self->mutex);self->bindings[ticket->id]=ticket;
      }
      self->context->runOnMainThread([ticket,complete=std::move(complete),failure=std::move(failure)]() mutable {if(ticket->active)complete(std::move(failure));});
    });return ticket;
  }
  void retireView(const std::shared_ptr<ViewTicket>& ticket) {
    requireUi();if(!ticket)return;ticket->active=false;
    std::shared_ptr<RNSkVulkanPlatformContext> value;{std::lock_guard lock(mutex);value=context;}
    if(!value)return;
    value->runOnJavascriptThread([weak=weak_from_this(),ticket]{if(auto self=weak.lock()){
      self->requireJs();std::shared_ptr<RNSkVulkanRuntime> scope;bool matching=false;
      {std::lock_guard lock(self->mutex);auto old=self->bindings.find(ticket->id);matching=old!=self->bindings.end()&&old->second==ticket;if(matching){self->bindings.erase(old);scope=self->runtime.lock();}}
      if(matching&&scope)scope->getManager().unregisterSkiaView(ticket->id);
    }});
  }
  void registerScreenshot(uint64_t tag,std::shared_ptr<RNSkView> view) {requireUi();std::lock_guard lock(mutex);screenshots[tag]=std::move(view);}
  void retireScreenshot(uint64_t tag,const std::shared_ptr<RNSkView>& view) {requireUi();std::lock_guard lock(mutex);auto old=screenshots.find(tag);if(old!=screenshots.end()&&old->second.lock()==view)screenshots.erase(old);}
  sk_sp<SkImage> screenshot(size_t tag) {
    requireUi();std::shared_ptr<RNSkView> view;{std::lock_guard lock(mutex);if(phase!="active")return nullptr;auto old=screenshots.find(tag);if(old!=screenshots.end())view=old->second.lock();}
    return view?view->makeImageSnapshot(nullptr):nullptr;
  }
  void requestCloseUi(Completion complete) {
    requireUi();ShutdownDispatcher dispatch;
    {std::lock_guard lock(mutex);
      if(!complete || (phase!="active" && phase!="bound") || closeRequested)
        throw std::runtime_error("Composition shutdown requires one live native runtime");
      phase="closing";closeRequested=true;dispatch=shutdown;}
    dispatch(std::move(complete)); // posts native-only token; never waits on JS from UI
  }
  void prepareJsClose() {
    std::lock_guard lock(mutex);requireJs();
    if(phase=="closed")return;
    if(phase=="failed" || phase=="preparing" || phase=="cold" || consumers || !bindings.empty() || !screenshots.empty())
      throw std::runtime_error("Composition UI consumers must retire before JS GPU close");
    phase="closing";
  }
  void finishJsClose() {
    std::lock_guard lock(mutex);requireJs();
    if(phase!="closing" || consumers || !bindings.empty() || !screenshots.empty())throw std::runtime_error("Composition close acknowledgement is stale");
    if(device){auto memory=device->allocations();if(memory.first || memory.second || device->outstandingWin32Frames())
      throw std::runtime_error("Composition native GPU drain is incomplete");}
    context.reset();runtime.reset();device.reset();shutdown={};drained=true;phase="closed";
  }
  Status status() const {std::lock_guard lock(mutex);return {phase,adapter,generation,consumers,creations,jsOwner!=std::thread::id{}&&jsOwner!=uiOwner,drained,static_cast<uint32_t>(bindings.size()),primaryFailure};}
  void fail(std::string reason={}){std::lock_guard lock(mutex);if(primaryFailure.empty()&&!reason.empty())primaryFailure=reason.substr(0,1024);phase="failed";}
  void requireUi() const {if(std::this_thread::get_id()!=uiOwner)throw std::runtime_error("Composition consumer requires its UI owner");}
  std::shared_ptr<WindowsFrameWorker> gpuWorker() const{return worker;}
  WindowsFrameTrace frameTrace;
private:
  friend class WindowsCompositionConsumer;
  void requireJs() const {if(jsOwner!=std::this_thread::get_id())throw std::runtime_error("Composition GPU lifecycle requires its bound JS owner");}
  const nelyx::vulkan::Win32DeviceOptions options;
  const std::thread::id uiOwner;
  std::thread::id jsOwner;
  mutable std::mutex mutex;
  std::string phase="cold",adapter,primaryFailure;
  uint64_t generation=0;
  uint32_t consumers=0,creations=0;
  bool attempted=false,closeRequested=false,drained=false;
  std::shared_ptr<RNSkVulkanPlatformContext> context;
  std::weak_ptr<RNSkVulkanRuntime> runtime;
  std::atomic<uint64_t> nextView{0};
  std::unordered_map<uint64_t,std::shared_ptr<ViewTicket>> bindings;
  std::unordered_map<uint64_t,std::weak_ptr<RNSkView>> screenshots;
  std::shared_ptr<nelyx::vulkan::Device> device;
  ShutdownDispatcher shutdown;
  std::optional<bool> windowVisibility;
  std::function<void()> firstContent;
  std::shared_ptr<WindowsFrameWorker> worker=std::make_shared<WindowsFrameWorker>();
  uint64_t nextVisibility=0;
  std::map<uint64_t,std::function<void(bool)>> visibilityObservers;
};
// Explicit acknowledgement after the caller releases its surface/renderer.
// Dropping an unclosed consumer retains its native payload and poisons admission.
class WindowsCompositionConsumer final {
  friend class WindowsCompositionSession;
  struct Payload {std::shared_ptr<WindowsCompositionSession> session;std::shared_ptr<RNSkVulkanPlatformContext> context;};
  struct ConstructionKey {};
  struct RenderBatch {
    std::shared_ptr<WindowsCompositionSession> session;
    std::shared_ptr<RNSkVulkanPlatformContext> context;
    std::atomic<uint32_t> remaining;
    RenderBatch(std::shared_ptr<WindowsCompositionSession> session,std::shared_ptr<RNSkVulkanPlatformContext> context,uint32_t count)
      :session(std::move(session)),context(std::move(context)),remaining(count){}
  };
public:
  using Renderer=std::function<std::shared_ptr<const nelyx::vulkan::Win32Frame>(nelyx::vulkan::Win32TextureTarget,std::function<void(SkCanvas*)>,const std::vector<std::shared_ptr<skgpu::graphite::Recording>>&)>;
  explicit WindowsCompositionConsumer(ConstructionKey,std::shared_ptr<WindowsCompositionSession> session,std::shared_ptr<RNSkVulkanPlatformContext> context)
    :data(std::make_unique<Payload>(Payload{std::move(session),std::move(context)})){}
  ~WindowsCompositionConsumer(){if(data){data->session->fail();data.release();}}
  WindowsCompositionConsumer(const WindowsCompositionConsumer&)=delete;
  WindowsCompositionConsumer& operator=(const WindowsCompositionConsumer&)=delete;
  bool ready() const {if(!data)return false;return data->session->status().phase=="active";}
  Renderer admitRender(uint32_t count) {
    if(!data)throw std::runtime_error("Composition consumer is closed");data->session->requireUi();
    if(!count||count>8||!ready())throw std::runtime_error("Composition consumer batch admission is closed or exceeds8");
    auto batch=std::make_shared<RenderBatch>(data->session,data->context,count);
    return [batch](auto target,auto draw,const auto& recordings){
      // The UI granted this bounded batch before sealing admission. A queued
      // producer must still execute its uploads after Close; failed/closed
      // sessions never regain permission, and no new batch can enter closing.
      const auto phase=batch->session->status().phase;
      if(phase!="active"&&phase!="closing")throw std::runtime_error("Admitted Composition producer lost its native session");
      auto remaining=batch->remaining.load();
      do{if(!remaining)throw std::runtime_error("Composition producer batch permit already consumed");}
      while(!batch->remaining.compare_exchange_weak(remaining,remaining-1));
      return batch->context->renderWin32Frame(target,std::move(draw),recordings);
    };
  }
  void close() {
    if(!data)return;auto session=data->session;session->requireUi();
    // Release the platform callback owner before returning the UI lease.
    data.reset();std::lock_guard lock(session->mutex);--session->consumers;
  }
private:
  std::unique_ptr<Payload> data;
};
inline std::shared_ptr<WindowsCompositionConsumer> WindowsCompositionSession::acquireConsumer() {
  requireUi();std::shared_ptr<RNSkVulkanPlatformContext> value;
  {std::lock_guard lock(mutex);if(phase!="active" || consumers>=64)throw std::runtime_error("Composition requires its active JS GPU and available consumer budget");++consumers;value=context;}
  try{return std::make_shared<WindowsCompositionConsumer>(WindowsCompositionConsumer::ConstructionKey{},shared_from_this(),std::move(value));}
  catch(...){std::lock_guard lock(mutex);--consumers;throw;}
}
// ReactNonAbiValue is deliberately scoped to the same app binary containing
// the attributed module and component. Do not pass this across native DLLs.
inline auto WindowsCompositionSessionProperty() {
  using namespace winrt::Microsoft::ReactNative;
  return ReactPropertyId<ReactNonAbiValue<std::shared_ptr<WindowsCompositionSession>>>{L"Nelyx.Skia.Windows",L"CompositionSession.v1"};
}
} // namespace RNSkia
