// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RNSkLinuxWindowSurface.h"
#include "RNSkVulkanRuntime.h"
#include "MouseCursor.h"
#include "rnskia/RNSkView.h"
#include <react-native-linux/ComponentBootstrap.h>
#include <react-native-linux/RNLinuxHost.h>
#include <fabric/LinuxComponentViewRegistry.h>
#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/components/view/ViewEventEmitter.h>
#include <react/renderer/components/view/ViewProps.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include <react/renderer/core/propsConversions.h>
#include <atomic>
#include <charconv>
#include <cmath>
#include <iostream>
#include <unordered_map>

namespace RNSkia {
inline constexpr char LinuxSkiaViewName[]="SkiaView";
class LinuxSkiaViewProps final : public facebook::react::ViewProps {
public:
  LinuxSkiaViewProps()=default;
  LinuxSkiaViewProps(const facebook::react::PropsParserContext& context,
      const LinuxSkiaViewProps& source,const facebook::react::RawProps& raw)
    :facebook::react::ViewProps(context,source,raw),opaque(facebook::react::convertRawProp(context,raw,"opaque",source.opaque,false)),
     highBitDepth(facebook::react::convertRawProp(context,raw,"highBitDepth",source.highBitDepth,false)),
     mouseCursor(facebook::react::convertRawProp(context,raw,"mouseCursor",source.mouseCursor,std::string("basic"))){}
  bool opaque=false,highBitDepth=false;
  std::string mouseCursor="basic";
};
using LinuxSkiaShadowNode=facebook::react::ConcreteViewShadowNode<LinuxSkiaViewName,LinuxSkiaViewProps,facebook::react::ViewEventEmitter>;
using LinuxSkiaDescriptor=facebook::react::ConcreteComponentDescriptor<LinuxSkiaShadowNode>;
class LinuxSkiaViewState;

// Per-host native view ownership. Descriptor installation is process-wide;
// view factories, native ids, manager binding and closing are per runtime.
class LinuxSkiaSession final : public std::enable_shared_from_this<LinuxSkiaSession> {
public:
  LinuxSkiaSession():uiOwner(std::this_thread::get_id()){}
  void bind(std::shared_ptr<RNSkVulkanRuntime> value,bool initializeGpu) {
    jsOwner=std::this_thread::get_id();
    auto platform=value->getPlatformContext();
    {std::lock_guard lock(mutex);
      if(bound || closing)throw std::runtime_error("Linux Skia session already bound or closing");
      runtime=value;context=std::move(platform);bound=true;}
    if(initializeGpu)prepareGpu();
  }
  void prepareGpu() {
    if(std::this_thread::get_id()!=jsOwner)throw std::runtime_error("Linux GPU activation requires its JS owner");
    auto value=platform();value->configureGpuPolicy(false);value->getGpuContext();
    if(!value->canExportDmaBufFrame())throw std::runtime_error("Linux native GPU has no DMA-BUF frame admission");
    gpuPrepared=true;
  }
  std::shared_ptr<RNSkVulkanPlatformContext> platform() {
    std::lock_guard lock(mutex);if(!bound || closing)throw std::runtime_error("Linux Skia native session is not active");return context;
  }
  std::shared_ptr<LinuxSkiaViewState> create(GtkWidget* widget);
  void registerView(std::shared_ptr<LinuxSkiaViewState>,uint64_t id,uint64_t token);
  void retireView(uint64_t id,uint64_t token);
  void prepareClose(); // GTK owner, before the host posts JS cleanup.
  void closeJs();
  void requireUi() const {if(std::this_thread::get_id()!=uiOwner)throw std::runtime_error("Linux Skia view requires its GTK owner");}
  uint64_t nextToken(){return ++sequence;}
  bool isClosing() const {return closing.load();}
  bool hasGpu() const {return gpuPrepared;}
  size_t nativeOwners(){std::lock_guard lock(mutex);return states.size();}
  std::atomic<uint64_t> created{},registered{},retired{},clockTicks{},cancelledRegistrations{},failedViews{},lateFactories{};
private:
  std::thread::id uiOwner,jsOwner;
  std::mutex mutex;
  std::weak_ptr<RNSkVulkanRuntime> runtime;
  std::shared_ptr<RNSkVulkanPlatformContext> context;
  std::unordered_map<uint64_t,std::shared_ptr<LinuxSkiaViewState>> states;
  std::unordered_map<uint64_t,uint64_t> bindings; // JS owner only.
  std::atomic<uint64_t> sequence{};
  std::atomic<bool> closing=false;
  bool bound=false,uiClosed=false;
  std::atomic<bool> gpuPrepared=false;
};

class LinuxSkiaViewState final : public std::enable_shared_from_this<LinuxSkiaViewState> {
public:
  LinuxSkiaViewState(GtkWidget* widget,std::shared_ptr<LinuxSkiaSession> session,uint64_t identity)
    :widget(widget),session(session),identity(identity),platform(session->platform()),
     surface(std::make_shared<RNSkLinuxWindowSurface>(platform)),view(std::make_shared<RNSkView>(platform,surface)){g_object_ref(widget);}
  ~LinuxSkiaViewState()=default; // closeUi releases GTK refs on their owner.
  void initialize() {
    initializeMouse();
    auto weak=weak_from_this();
    view->setFrameScheduler([weak]{if(auto self=weak.lock();self && self->active)self->queueTick();});
    surface->setCanPresent([weak]{auto self=weak.lock();return self && self->active && gtk_widget_get_mapped(self->widget);});
    for(auto signal:{"map","unmap","notify::scale-factor"}) {
      auto* data=new std::weak_ptr<LinuxSkiaViewState>(weak);
      gulong handler;
      if(std::string_view(signal).starts_with("notify"))
        handler=g_signal_connect_data(widget,signal,G_CALLBACK(+[](GObject*,GParamSpec*,gpointer data){if(auto self=static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data)->lock();self && self->active)self->safeGeometry();}),data,
          [](gpointer data,GClosure*){delete static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data);},GConnectFlags(0));
      else handler=g_signal_connect_data(widget,signal,G_CALLBACK(+[](GtkWidget*,gpointer data){if(auto self=static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data)->lock();self && self->active)self->safeGeometry();}),data,
          [](gpointer data,GClosure*){delete static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data);},GConnectFlags(0));
      signals.push_back(handler);
    }
  }
  void initializeMouse() {
    mouseController=gtk_event_controller_motion_new();g_object_ref(mouseController);
    gtk_event_controller_set_propagation_phase(mouseController,GTK_PHASE_CAPTURE);
    auto connect=[this](const char* name,GCallback callback){g_signal_connect_data(mouseController,name,callback,new std::weak_ptr<LinuxSkiaViewState>(weak_from_this()),[](gpointer data,GClosure*){delete static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data);},GConnectFlags(0));};
    auto motion=G_CALLBACK(+[](GtkEventControllerMotion*,double x,double y,gpointer data){if(auto self=static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data)->lock())self->mouseEvent("hover",x,y);});
    connect("enter",motion);connect("motion",motion);connect("leave",G_CALLBACK(+[](GtkEventControllerMotion*,gpointer data){if(auto self=static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data)->lock())self->mouseEvent("leave",self->mouseX,self->mouseY);}));
    gtk_widget_add_controller(widget,mouseController);
  }
  void mouseEvent(const char* kind,double x,double y) {
    try {
    auto host=session.lock();if(!active||failed||!nativeBound||!host||host->isClosing()||!emitter)return;
    if(std::string_view(kind)=="hover"){auto* event=gtk_event_controller_get_current_event(mouseController);if(event&&(gdk_event_get_modifier_state(event)&(GDK_BUTTON1_MASK|GDK_BUTTON2_MASK|GDK_BUTTON3_MASK|GDK_BUTTON4_MASK|GDK_BUTTON5_MASK)))return;}
    auto* device=gtk_event_controller_get_current_event_device(mouseController);
    if(device)mouseDevice=gdk_device_get_source(device)==GDK_SOURCE_PEN?"pen":"mouse";
    mouseX=x;mouseY=y;
    emitter->dispatchEvent("nativeMouseEvent",folly::dynamic::object("protocol",1)("nativeId",static_cast<double>(nativeId.load()))("kind",kind)("device",mouseDevice)("pointer",1)("buttons",0)("x",x)("y",y)("timestamp",g_get_monotonic_time()/1000.0));
    }catch(const std::exception& error){fail(error.what());}catch(...){fail("Unknown native hover failure");}
  }
  void props(const LinuxSkiaViewProps& props) {
    requireUi();
    if(!active || failed)return;
    gtk_widget_set_cursor_from_name(widget,linuxMouseCursor(props.mouseCursor));
    if(props.highBitDepth)throw std::runtime_error("Linux SkiaView supports BGRA8/sRGB only");
    if(props.nativeId.empty())return;
    uint64_t id{};auto result=std::from_chars(props.nativeId.data(),props.nativeId.data()+props.nativeId.size(),id);
    if(result.ec!=std::errc{} || result.ptr!=props.nativeId.data()+props.nativeId.size() || !id || id>9007199254740991ull)
      throw std::runtime_error("Linux SkiaView nativeID must be a positive safe integer");
    if(id==nativeId)return;
    auto host=session.lock();if(!host || host->isClosing())return;
    if(nativeId)host->retireView(nativeId,token);
    nativeId=id;token=host->nextToken();nativeBound=false;bindingRequested=false;requestBinding();
  }
  void requestBinding() {
    if(!active || failed || bindingRequested || !nativeId || !geometryReady || pixelsWide<=0 || pixelsHigh<=0)return;
    auto host=session.lock();if(!host || host->isClosing())return;
    bindingRequested=true;host->registerView(shared_from_this(),nativeId,token);
  }
  void layout(float width,float height) {requireUi();logicalWidth=width;logicalHeight=height;geometry();}
  void validateLayout(float width,float height) {
    requireUi();if(!active || failed)return;
    const auto scale=gtk_widget_get_scale_factor(widget);
    const double w=std::round(double(width)*scale),h=std::round(double(height)*scale);
    if(!std::isfinite(w) || !std::isfinite(h) || w<0 || h<0 || w>4096 || h>4096)
      throw std::runtime_error("Linux SkiaView backing dimensions exceed admission");
  }
  void setEmitter(std::shared_ptr<const facebook::react::EventEmitter> value){requireUi();if(!active)return;emitter=std::move(value);emitFailure();}
  void fail(const std::string& reason) noexcept {
    try {
      requireUi();if(!active || failed.exchange(true))return;nativeBound=false;
      failure=reason;if(auto host=session.lock())++host->failedViews;
      if(tick){gtk_widget_remove_tick_callback(widget,tick);tick=0;}
      view->setFrameScheduler({});surface->setRequestRedraw({});
      try{view->stopContent();surface->detach();}catch(const std::exception& error){failure+="; native quiescence unconfirmed: ";failure+=error.what();}
      emitFailure();
    } catch(...) {std::cerr<<"Linux Skia view failure retained"<<std::endl;}
  }
  void emitFailure(){if(failed && !failureDelivered && emitter){emit("failed",failure);failureDelivered=true;}}
  void safeGeometry() noexcept {try{geometry();}catch(const std::exception& error){fail(error.what());}catch(...){fail("Unknown native layout failure");}}
  void geometry() {
    requireUi();if(!active)return;if(failed){emitFailure();return;}
    const auto scale=gtk_widget_get_scale_factor(widget);
    double width=std::round(double(logicalWidth)*scale),height=std::round(double(logicalHeight)*scale);
    if(!std::isfinite(width) || !std::isfinite(height) || width<0 || height<0 || width>4096 || height>4096)
      throw std::runtime_error("Linux SkiaView backing dimensions exceed admission");
    const int nextWidth=static_cast<int>(width),nextHeight=static_cast<int>(height);
    const bool mapped=gtk_widget_get_mapped(widget);
    if(geometryReady && nextWidth==pixelsWide && nextHeight==pixelsHigh && mapped==wasMapped){requestBinding();return;}
    geometryReady=true;wasMapped=mapped;pixelsWide=nextWidth;pixelsHigh=nextHeight;++surfaceGeneration;
    surface->setLayoutSize(pixelsWide,pixelsHigh);
    int shownWidth=mapped?pixelsWide:0,shownHeight=mapped?pixelsHigh:0;
    if(!surface->isAttached())surface->attach(widget,shownWidth,shownHeight,false,false,{});
    else surface->resize(shownWidth,shownHeight);
    requestBinding();emit("layout","");queueTick();
  }
  void queueTick() {
    requireUi();if(!active || failed || tick || !widget)return;
    auto* data=new std::weak_ptr<LinuxSkiaViewState>(weak_from_this());
    tick=gtk_widget_add_tick_callback(widget,[](GtkWidget*,GdkFrameClock*,gpointer data)->gboolean {
      auto self=static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data)->lock();
      if(!self || !self->active)return G_SOURCE_REMOVE;
      auto host=self->session.lock();if(!host || host->isClosing()){self->tick=0;return G_SOURCE_REMOVE;}
      try {
        ++host->clockTicks;self->emit("clock",host->hasGpu()?"":"gpu-not-initialized");
        if(!host->hasGpu()){self->emit("unsupported","gpu-not-initialized");self->tick=0;return G_SOURCE_REMOVE;}
        bool pending=false;
        if(self->view->hasRedrawRequest())self->view->redraw();else pending=self->view->presentFrame();
        if(pending || self->view->hasQueuedRecordings() || self->view->hasRedrawRequest())return G_SOURCE_CONTINUE;
      } catch(const std::exception& error){self->tick=0;self->fail(error.what());}
        catch(...){self->tick=0;self->fail("Unknown native presentation failure");}
      self->tick=0;return G_SOURCE_REMOVE;
    },data,[](gpointer data){delete static_cast<std::weak_ptr<LinuxSkiaViewState>*>(data);});
  }
  void closeUi() {
    requireUi();if(closed)return;active=false;
    if(tick){gtk_widget_remove_tick_callback(widget,tick);tick=0;}
    view->setFrameScheduler({});surface->setRequestRedraw({});
    view->stopContent(); // Timeout retains state, widget and native owners.
    surface->detach();
    if(mouseController){gtk_widget_remove_controller(widget,mouseController);g_object_unref(mouseController);mouseController=nullptr;}
    for(auto id:signals)g_signal_handler_disconnect(widget,id);signals.clear();
    g_object_unref(widget);widget=nullptr;emitter.reset();closed=true;nativeReleased=true;
  }
  void emit(const char* phase,const std::string& reason) {
    auto host=session.lock();if(!active || !host || host->isClosing() || !emitter)return;
    emitter->dispatchEvent("linuxSurfaceStatus",folly::dynamic::object("phase",phase)("reason",reason)
      ("nativeId",static_cast<double>(nativeId.load()))("width",pixelsWide)("height",pixelsHigh)("gpuPrepared",host->hasGpu())
      ("logicalWidth",logicalWidth)("logicalHeight",logicalHeight)("scale",gtk_widget_get_scale_factor(widget))
      ("surfaceGeneration",static_cast<double>(surfaceGeneration))("bound",nativeBound)("mapped",wasMapped));
  }
  void requireUi() const {if(auto host=session.lock())host->requireUi();else throw std::runtime_error("Linux Skia session owner expired");}
  GtkWidget* widget;
  GtkEventController* mouseController=nullptr;double mouseX=0,mouseY=0;const char* mouseDevice="mouse";
  std::weak_ptr<LinuxSkiaSession> session;
  const uint64_t identity;
  std::shared_ptr<RNSkVulkanPlatformContext> platform;
  std::shared_ptr<RNSkLinuxWindowSurface> surface;
  std::shared_ptr<RNSkView> view;
  std::atomic<bool> active=true;
  std::atomic<bool> failed=false,nativeReleased=false;
  std::atomic<uint64_t> nativeId{},token{};
private:
  bool closed=false,geometryReady=false,wasMapped=false;
  bool failureDelivered=false,bindingRequested=false;
public:
  bool nativeBound=false; // GTK owner; JS registration acknowledges through the UI queue.
private:
  std::string failure;
  guint tick{};
  std::vector<gulong> signals;
  std::shared_ptr<const facebook::react::EventEmitter> emitter;
  float logicalWidth{},logicalHeight{};
  int pixelsWide{},pixelsHigh{};
  uint64_t surfaceGeneration{};
};

inline std::shared_ptr<LinuxSkiaViewState> LinuxSkiaSession::create(GtkWidget* widget) {
  requireUi();const auto identity=nextToken();
  {std::lock_guard lock(mutex);if(closing || !bound)throw std::runtime_error("Linux Skia view session closed");if(states.size()>=64)throw std::runtime_error("Linux Skia view owner budget exceeded");}
  auto value=std::make_shared<LinuxSkiaViewState>(widget,shared_from_this(),identity);
  {std::lock_guard lock(mutex);states.emplace(identity,value);}
  value->initialize();++created;return value;
}
inline void LinuxSkiaSession::registerView(std::shared_ptr<LinuxSkiaViewState> value,uint64_t id,uint64_t token) {
  auto weak=weak_from_this();std::weak_ptr<LinuxSkiaViewState> state=value;
  platform()->runOnJavascriptThread([weak,state,id,token]{
    auto host=weak.lock();auto view=state.lock();if(!host)return;
    if(host->closing || !view || !view->active || view->failed || view->token!=token){++host->cancelledRegistrations;return;}
    auto scope=host->runtime.lock();if(!scope)return;
    if(auto old=host->bindings.find(id);old!=host->bindings.end() && old->second!=token) {
      bool live=false;
      {std::lock_guard lock(host->mutex);for(auto& [identity,state]:host->states)if(state->token==old->second && !state->nativeReleased){live=true;break;}}
      if(live){host->context->runOnMainThread([weak,state,token]{if(auto host=weak.lock();host && !host->closing)if(auto view=state.lock();view && view->active && view->token==token)view->fail("Duplicate Linux Skia nativeID binding");});return;}
      scope->getManager().unregisterSkiaView(id);host->bindings.erase(old);++host->retired;
    }
    scope->getManager().registerSkiaView(id,view->view);host->bindings[id]=token;++host->registered;
    host->context->runOnMainThread([weak,state,token]{if(auto host=weak.lock();host && !host->closing)if(auto view=state.lock();view && view->active && !view->failed && view->token==token){view->nativeBound=true;view->emit("bound","");}});
  });
}
inline void LinuxSkiaSession::retireView(uint64_t id,uint64_t token) {
  if(closing)return;auto weak=weak_from_this();
  platform()->runOnJavascriptThread([weak,id,token]{
    auto host=weak.lock();if(!host || host->closing)return;
    if(auto old=host->bindings.find(id);old!=host->bindings.end() && old->second==token) {
      if(auto scope=host->runtime.lock())scope->getManager().unregisterSkiaView(id);
      host->bindings.erase(old);++host->retired;
    }
    std::lock_guard lock(host->mutex);
    for(auto it=host->states.begin();it!=host->states.end();) {
      if(!it->second->active && it->second->nativeId==id && it->second->token==token)it=host->states.erase(it);else ++it;
    }
  });
}
inline void LinuxSkiaSession::prepareClose() {
  requireUi();closing=true;
  std::vector<std::shared_ptr<LinuxSkiaViewState>> owned;
  {std::lock_guard lock(mutex);for(auto& [id,state]:states)owned.push_back(state);}
  for(auto& state:owned)state->closeUi();uiClosed=true;
}
inline void LinuxSkiaSession::closeJs() {
  if(jsOwner!=std::this_thread::get_id() || !uiClosed)throw std::runtime_error("Linux Skia cleanup requires UI quiescence followed by its live JS owner");
  if(auto scope=runtime.lock())scope->getManager().unregisterAllSkiaViews();
  retired+=bindings.size();bindings.clear();{std::lock_guard lock(mutex);states.clear();context.reset();runtime.reset();bound=false;}
}

class LinuxSkiaViewComponent final : public rnlinux::LinuxComponentView {
public:
  LinuxSkiaViewComponent(rnlinux::Tag tag,std::shared_ptr<LinuxSkiaSession> session):LinuxComponentView(tag),session(std::move(session)) {
    widget_=gtk_picture_new();takeWidgetRef();gtk_picture_set_can_shrink(GTK_PICTURE(widget_),TRUE);
    state=this->session->create(widget_);
  }
  ~LinuxSkiaViewComponent() override {
    try {state->closeUi();session->retireView(state->nativeId,state->token);}
    catch(const std::exception& error){std::cerr<<"Linux Skia view retained: "<<error.what()<<std::endl;}
  }
  void updateProps(const facebook::react::Props&,const facebook::react::Props& next) override {boundary([&]{state->props(static_cast<const LinuxSkiaViewProps&>(next));});}
  void updateLayoutMetrics(const facebook::react::LayoutMetrics& metrics) override {boundary([&]{if(!state->active || state->failed)return;state->validateLayout(metrics.frame.size.width,metrics.frame.size.height);LinuxComponentView::updateLayoutMetrics(metrics);state->layout(layoutWidth_,layoutHeight_);});}
  void updateEventEmitter(std::shared_ptr<const facebook::react::EventEmitter> value) override {boundary([&]{LinuxComponentView::updateEventEmitter(value);state->setEmitter(std::move(value));});}
  void postLayoutPass() override {state->safeGeometry();}
private:
  template<class F> void boundary(F&& operation) noexcept {try{operation();}catch(const std::exception& error){state->fail(error.what());}catch(...){state->fail("Unknown native component failure");}}
  std::shared_ptr<LinuxSkiaSession> session;
  std::shared_ptr<LinuxSkiaViewState> state;
};

inline void installLinuxSkiaComponent(rnlinux::RNLinuxHost::Config& config,std::shared_ptr<LinuxSkiaSession> session) {
  static std::once_flag descriptors;
  std::call_once(descriptors,[]{rnlinux::LinuxComponentBootstrap::registerInitializer([](auto& registry){registry.add(facebook::react::concreteComponentDescriptorProvider<LinuxSkiaDescriptor>());});});
  auto initialize=std::move(config.initializeComponentViews);
  config.initializeComponentViews=[initialize,session](auto& registry){if(initialize)initialize(registry);registry.registerComponent(LinuxSkiaViewName,[session](rnlinux::Tag tag)->std::unique_ptr<rnlinux::LinuxComponentView>{
    if(session->isClosing()){++session->lateFactories;return nullptr;}
    try{return std::make_unique<LinuxSkiaViewComponent>(tag,session);}catch(const std::exception& error){std::cerr<<"Linux Skia factory rejected: "<<error.what()<<std::endl;return nullptr;}
  });};
  auto cleanup=std::move(config.prepareRuntimeCleanup);
  config.prepareRuntimeCleanup=[cleanup,session]{session->prepareClose();if(cleanup)cleanup();};
}
}
