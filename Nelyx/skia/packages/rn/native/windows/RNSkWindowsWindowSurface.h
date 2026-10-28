// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "CompositionSession.h"
#include "CompositionSurface.h"
#include "WindowsFrameDiagnostics.h"
#include "rnskia/RNSkWindowSurface.h"
#include "include/core/SkCanvas.h"

namespace RNSkia {
class RNSkWindowsWindowSurface final : public RNSkWindowSurface, public std::enable_shared_from_this<RNSkWindowsWindowSurface> {
  struct Attachment {
    winrt::Microsoft::UI::Composition::SpriteVisual visual{nullptr};
    std::shared_ptr<WindowsCompositionConsumer> consumer;
    std::unique_ptr<WindowsCompositionSurface> surface;
    Releaser release;
    bool visualDetached=false;
    void disconnectVisual(){if(!visualDetached){if(surface)surface->disconnectVisual();if(visual)try{visual.Brush(nullptr);}catch(winrt::hresult_error const& error){if(error.code()!=RO_E_CLOSED)throw;}visualDetached=true;}}
    void close(){disconnectVisual();if(surface){surface->close();surface.reset();}if(release)release(winrt::get_abi(visual));release={};visual=nullptr;if(consumer){consumer->close();consumer.reset();}}
  };
public:
  RNSkWindowsWindowSurface(std::shared_ptr<WindowsCompositionSession> session,std::shared_ptr<WindowsCompositionDevice> device,
      WindowsCompositionSurface::CopyObserver observer={},bool windowViewport=false)
    :session(std::move(session)),device(std::move(device)),owner(std::this_thread::get_id()),observer(std::move(observer)),windowViewport(windowViewport) {
    if(!this->session || !this->device)throw std::runtime_error("Windows surface requires actual native UI/session owners");
    this->session->requireUi();platform=this->session->uiPlatform();
    format=platform->getGpuContext().textureInfo(kBGRA_8888_SkColorType);
  }
  ~RNSkWindowsWindowSurface() override {
    if(!attachment)return;
    if(owner!=std::this_thread::get_id() || failed){session->fail();attachment.release();return;}
    try{attachment->close();}catch(...){session->fail();attachment.release();}
  }
  void attach(void* handle,int width,int height,bool highBitDepth,bool p3,Releaser release) override {
    requireUi();validate(width,height);if(!handle||highBitDepth||p3)throw std::runtime_error("Windows Composition supports actual BGRA8/sRGB SpriteVisual only");
    detach();auto next=std::make_unique<Attachment>();winrt::copy_from_abi(next->visual,handle);
    try{next->consumer=session->acquireConsumer();
    next->surface=std::make_unique<WindowsCompositionSurface>(device,
      [value=next->consumer](uint32_t count){return value->admitRender(count);},[value=next->consumer]{return value->ready();},next->visual,windowViewport);
    next->surface->resize(width,height);next->release=std::move(release);
    next->visual.Brush(next->surface->brush());
    }catch(...){session->fail();failed=true;next.release();throw;}
    attachment=std::move(next);{std::lock_guard lock(mutex);attached=true;wide=width;high=height;}requestRedraw();
  }
  void resize(int width,int height) override {
    requireUi();validate(width,height);if(attachment)attachment->surface->resize(width,height);
    {std::lock_guard lock(mutex);wide=width;high=height;}requestRedraw();
  }
  void detach() override {
    requireUi();if(attachment){try{attachment->close();attachment.reset();}catch(...){failed=true;session->fail();throw;}}
    std::lock_guard lock(mutex);attached=false;wide=high=0;
  }
  bool isAttached() const override {std::lock_guard lock(mutex);return attached;}
  int getWidth() override {std::lock_guard lock(mutex);return attached?wide:0;}
  int getHeight() override {std::lock_guard lock(mutex);return attached?high:0;}
  void setLayoutSize(int width,int height) override {validate(width,height);std::lock_guard lock(mutex);layoutWide=width;layoutHigh=height;}
  bool getLayoutSize(int* width,int* height) override {std::lock_guard lock(mutex);if(!layoutWide||!layoutHigh)return false;*width=layoutWide;*height=layoutHigh;return true;}
  void setRequestRedraw(std::function<void()> callback) override {std::lock_guard lock(mutex);redraw=std::move(callback);}
  void setCanPresent(std::function<bool()> callback) override {std::lock_guard lock(mutex);visible=std::move(callback);}
  void setPresented(std::function<void(uint64_t)> callback) {requireUi();presented=std::move(callback);}
  void setResizeCancelled(std::function<void()> callback){requireUi();resizeCancelled=std::move(callback);}
  void whenIdle(std::function<void()> complete){
    requireUi();if(!complete||retiring)throw std::runtime_error("Windows surface retirement requires one completion");
    retiring=true;presented={};resizeCancelled={};{std::lock_guard lock(mutex);redraw={};visible={};}
    // RNW can explicitly close its SpriteVisual during child destruction.
    // Disconnect while that UI owner is retiring, before waiting for GPU work.
    // A closed visual is already detached; its native GPU packet still drains.
    if(attachment)attachment->disconnectVisual();
    if(plan){idleCompletion=std::move(complete);return;}complete();
  }
  void setSurfaceGeneration(uint64_t value){requireUi();std::lock_guard lock(mutex);generation=value;}
  bool getTargetInfo(RNSkGraphiteTargetInfo* target) override {
    std::lock_guard lock(mutex);if(!target||!attached||!wide||!high)return false;
    target->width=wide;target->height=high;target->colorType=kBGRA_8888_SkColorType;target->useP3ColorSpace=false;target->textureInfo=format;target->surfaceGeneration=generation;return true;
  }
  bool presentRecordings(const std::vector<skgpu::graphite::Recording*>&) override {
    throw std::runtime_error("Windows imported frames require owned native recording payloads");
  }
  // Copy observers explicitly request a synchronous diagnostic readback. The
  // public SDK path has no observer and always uses native async presentation.
  bool hasAsyncPresentation() const override{return !observer;}
  bool presentAsync(const std::vector<std::shared_ptr<RNSkGraphiteRecording>>& recordings,FrameCompletion complete) override{
    requireUi();if(plan||!canPresent())return false;
    if(recordings.empty()||recordings.size()>8||!complete)throw std::runtime_error("Invalid Windows native frame batch");
    auto next=std::make_unique<Plan>();next->complete=std::move(complete);
    for(const auto& recording:recordings){
      const auto& info=recording->getTarget();
      if(!recording->hasFormatOf({wide,high,kBGRA_8888_SkColorType,false,format})||info.useP3ColorSpace)
        throw std::runtime_error("Windows native frame format changed");
      next->frames.push_back({info.width,info.height,info.surfaceGeneration,recording->nativeReplay(),recording->nelyxIdentity()});
    }
    next->render=attachment->surface->admit(static_cast<uint32_t>(next->frames.size()));
    plan=std::move(next);try{startNext();}catch(std::exception const& error){failAsync(error.what());}catch(...){failAsync("Windows native submission HRESULT failure");}return true;
  }
  bool presentOwnedRecordings(const std::vector<std::shared_ptr<skgpu::graphite::Recording>>& recordings) override {
    requireUi();if(!canPresent())return false;
    try{auto result=attachment->surface->present({},recordings,observer);if(result&&presented)presented(++frames);return result;}catch(...){failed=true;session->fail();throw;}
  }
  bool presentImage(const sk_sp<SkImage>& image) override {
    requireUi();if(!image)throw std::runtime_error("Windows presentation requires a native image");if(!canPresent())return false;
    try{auto result=attachment->surface->present([image](SkCanvas* canvas){canvas->clear(SK_ColorTRANSPARENT);canvas->drawImage(image,0,0);},{},observer);if(result&&presented)presented(++frames);return result;}catch(...){failed=true;session->fail();throw;}
  }
private:
  struct NativeFrame{int width,height;uint64_t generation;std::shared_ptr<skgpu::graphite::Recording> recording;NelyxFrameIdentity identity;};
  struct Plan{std::vector<NativeFrame> frames;size_t next=0;std::optional<size_t> updated;FrameCompletion complete;WindowsCompositionSurface::Renderer render;};
  void startNext(){
    const auto& frame=plan->frames.at(plan->next);
    trace(0);
    auto packet=attachment->surface->prepare(frame.width,frame.height,{frame.recording},plan->render);
    if(!packet)throw std::runtime_error("Windows native frame lost its admitted producer");
    auto weak=weak_from_this();auto dispatch=platform;auto sessionOwner=session;
    session->gpuWorker()->post([weak,packet,dispatch,sessionOwner]{
      std::string failure;
      const auto began=windowsFrameDiagnosticsEnabled()?windowsMonotonicMilliseconds():0.;
      try{packet->render();}catch(std::exception const& error){failure=error.what();}catch(...){failure="Windows producer native HRESULT failure";}
      if(began)windowsFrameDiagnosticDelay("gpu-producer",began,windowsMonotonicMilliseconds());
      try{dispatch->runOnMainThread([weak,packet,failure=std::move(failure)]{if(auto self=weak.lock())self->producerReady(packet,failure);});}
      catch(std::exception const& error){sessionOwner->fail(error.what());}catch(...){sessionOwner->fail("Windows producer completion dispatch failed");}
    });
  }
  void producerReady(const std::shared_ptr<WindowsCompositionSurface::Prepared>& packet,const std::string& failure){
    requireUi();if(!failure.empty()){failAsync(failure);return;}
    trace(1);
    try{
      const auto& frame=plan->frames.at(plan->next);
      attachment->surface->publish(packet,frame.generation==generation&&!session->resize->cancelled(viewIdentity,frame.generation)&&canPresent(),session->resize->defers(viewIdentity,frame.generation));
      if(packet->staged){
        session->resize->stage(viewIdentity,frame.generation,[weak=weak_from_this(),packet](bool commit){if(auto self=weak.lock()){packet->resolution=commit;self->finishPrepared(packet);}});
      }else trace(packet->updated?2:4);
      auto weak=weak_from_this();auto dispatch=platform;auto sessionOwner=session;
      session->gpuWorker()->post([weak,packet,dispatch,sessionOwner]{
        std::string failure;
        const auto began=windowsFrameDiagnosticsEnabled()?windowsMonotonicMilliseconds():0.;
        try{packet->retire();}catch(std::exception const& error){failure=error.what();}catch(...){failure="Windows consumer native HRESULT failure";}
        if(began)windowsFrameDiagnosticDelay("gpu-retirement",began,windowsMonotonicMilliseconds());
        try{dispatch->runOnMainThread([weak,packet,failure=std::move(failure)]{if(auto self=weak.lock())self->consumerReady(packet,failure);});}
        catch(std::exception const& error){sessionOwner->fail(error.what());}catch(...){sessionOwner->fail("Windows consumer completion dispatch failed");}
      });
      // EndDraw has committed the immutable front. Start the next CPU resize
      // while this packet's native references retire on the worker.
      if(packet->updated&&frame.generation==generation&&presented)presented(++frames);
    }catch(std::exception const& error){failAsync(error.what());}catch(...){failAsync("Windows publish native HRESULT failure");}
  }
  void consumerReady(const std::shared_ptr<WindowsCompositionSurface::Prepared>& packet,const std::string& failure){
    requireUi();if(!failure.empty()){failAsync(failure);return;}
    try{
    // Optional diagnostics inspect the completed source copy on its UI owner.
    // Retirement has already confirmed the native fence; no GPU wait is added
    // to ordinary frames and the callback never receives a worker-owned object.
    if(observer&&(packet->updated||packet->staged))observer(packet->texture.get(),{0,0},packet->width,packet->height);
    attachment->surface->complete(packet);
    packet->retired=true;
    trace(packet->staged?12:3);
    const auto& frame=plan->frames.at(plan->next);
    if(packet->updated||packet->staged)session->resize->ready(viewIdentity,frame.generation);
    if(packet->staged){finishPrepared(packet);return;}
    if(!packet->updated&&session->resize->cancelled(viewIdentity,frame.generation)&&resizeCancelled)resizeCancelled();
    finishPacket(packet);
    }catch(std::exception const& error){failAsync(error.what());}catch(...){failAsync("Windows native terminal HRESULT failure");}
  }
  void finishPrepared(const std::shared_ptr<WindowsCompositionSurface::Prepared>& packet){
    requireUi();if(!packet->retired||!packet->resolution)return;
    try{
      const auto& frame=plan->frames.at(plan->next);
      const bool commit=*packet->resolution&&frame.generation==generation&&canPresent();
      attachment->surface->resolvePrepared(packet,commit);trace(commit?2:4);trace(3);
      if(commit&&presented)presented(++frames);else if(!commit&&resizeCancelled)resizeCancelled();
      finishPacket(packet);
    }catch(std::exception const& error){failAsync(error.what());}catch(...){failAsync("Windows prepared resize terminal HRESULT failure");}
  }
  void finishPacket(const std::shared_ptr<WindowsCompositionSurface::Prepared>& packet){
    if(packet->updated)plan->updated=plan->next;
    ++plan->next;
    if(plan->next<plan->frames.size()){startNext();return;}
    auto finished=std::move(plan);auto complete=std::move(finished->complete);const auto updated=finished->updated;finished.reset();
    complete(updated,{});complete={};
    // The UI child may retire before its admitted producer completes. Hold
    // its native attachment/consumer until every batch packet has retired.
    if(idleCompletion){auto complete=std::move(idleCompletion);complete();}
  }
  void failAsync(std::string reason){
    trace(5);
    failed=true;session->fail(reason);attachment->surface->poison();
    // Do not release the plan/recordings when GPU completion is unconfirmed.
    if(plan){auto complete=std::move(plan->complete);if(complete)complete(std::nullopt,reason);}
    throw std::runtime_error(reason);
  }
  void trace(uint32_t stage){if(plan&&plan->next<plan->frames.size()){const auto& frame=plan->frames[plan->next];session->frameTrace.add(frame.identity,viewIdentity,frame.generation,stage,frame.width,frame.height);}}
public:
  void setViewIdentity(uint64_t value){requireUi();viewIdentity=value;}
private:
  uint64_t viewIdentity=0;
  void requireUi() const {if(std::this_thread::get_id()!=owner)throw std::runtime_error("Windows presentation requires its UI owner");}
  static void validate(int width,int height){if(width<0||height<0||width>4096||height>4096)throw std::runtime_error("Windows surface dimensions exceed admission");}
  bool canPresent(){if(retiring||!attachment||!getWidth()||!getHeight()||!attachment->consumer->ready())return false;std::function<bool()> value;{std::lock_guard lock(mutex);value=visible;}return !value||value();}
  void requestRedraw(){std::function<void()> value;{std::lock_guard lock(mutex);value=redraw;}if(value)value();}
  std::shared_ptr<WindowsCompositionSession> session;
  std::shared_ptr<WindowsCompositionDevice> device;
  std::shared_ptr<RNSkVulkanPlatformContext> platform;
  const std::thread::id owner;
  mutable std::mutex mutex;
  bool attached=false,failed=false,retiring=false;
  int wide=0,high=0,layoutWide=0,layoutHigh=0;
  skgpu::graphite::TextureInfo format;
  std::unique_ptr<Attachment> attachment;
  std::unique_ptr<Plan> plan;
  std::function<void()> idleCompletion;
  uint64_t generation=0;
  WindowsCompositionSurface::CopyObserver observer;
  const bool windowViewport;
  std::function<void()> redraw;
  std::function<bool()> visible;
  uint64_t frames=0;
  std::function<void(uint64_t)> presented;
  std::function<void()> resizeCancelled;
};
} // namespace RNSkia
