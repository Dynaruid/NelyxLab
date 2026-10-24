// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputRoot.h"
#include "TextInputStore.h"
#include <chrono>

namespace Nelyx::WindowsInput {
struct ViewPoint {double x=0,y=0;bool outside=false;};
struct TextInputHitRequest {
  uint64_t request=0;
  ViewPoint point;
  DWORD flags=0;
  uint64_t epoch=0,revision=0;
};
struct TextInputSessionCallbacks {
  std::function<bool()> active;
  std::function<void(TextStoreEvent const&)> changed;
  std::function<void(std::string const&)> failed;
  // The hosting surface supplies these mappings; neither native glyph layout
  // nor the endpoint's own transparent rectangle can substitute for Core.
  std::function<std::optional<ScreenRect>(Rect const&,CoreGeometry const&)> screenRect;
  std::function<std::optional<ViewPoint>(POINT,DWORD,CoreGeometry const&)> viewPoint;
  std::function<void(int32_t,int32_t,uint64_t,uint64_t)> characterBounds;
  std::function<void(TextInputHitRequest const&)> hitPosition;
  std::function<bool()> focusSurface;
};

/** Nonvisual OS endpoint. The root retains registered sessions until real TSF
 * context retirement, while queued callbacks and timers use weak generations. */
class TextInputSession final : public std::enable_shared_from_this<TextInputSession> {
public:
  static std::shared_ptr<TextInputSession> create(std::shared_ptr<TextInputRoot> const& root,Owner owner,std::wstring text,Selection selection,size_t maximumUnits,InputScope scope,std::chrono::milliseconds cancellationTimeout,TextInputSessionCallbacks callbacks){
    if(!root||!callbacks.changed||!callbacks.failed||!callbacks.screenRect||!callbacks.viewPoint||!callbacks.characterBounds||!callbacks.hitPosition||!callbacks.focusSurface||cancellationTimeout.count()<=0||cancellationTimeout>std::chrono::duration_cast<std::chrono::milliseconds>(winrt::Windows::Foundation::TimeSpan::max()))throw std::invalid_argument("Text input session requires its owner, mappings, transports and positive cancellation deadline");
    auto self=std::shared_ptr<TextInputSession>(new TextInputSession(root,cancellationTimeout,std::move(callbacks)));
    const auto weak=std::weak_ptr<TextInputSession>(self);TextStoreCallbacks store;
    store.active=[weak]{auto current=weak.lock();return current&&!current->closing_&&(!current->callbacks_.active||current->callbacks_.active());};
    store.changed=[weak](TextStoreEvent const& event){if(auto current=weak.lock();current&&!current->closing_){if(event.request&&current->cancellation_==event.request)current->stopTimer();current->callbacks_.changed(event);}};
    store.failed=[weak](std::string const& message){if(auto current=weak.lock())current->fail(message);};
    store.post=[weak](std::function<void()> callback){if(auto current=weak.lock();current&&!current->closing_&&current->active()){const auto generation=current->generation_;if(!current->dispatcher_.TryEnqueue([weak,generation,callback=std::move(callback)]{if(auto owner=weak.lock();owner&&!owner->closing_&&owner->active()&&owner->generation_==generation)callback();}))throw std::runtime_error("Text input UI dispatcher stopped");}};
    store.screenRect=[weak](Rect const& rect,CoreGeometry const& geometry)->std::optional<ScreenRect>{if(auto current=weak.lock();current&&!current->closing_)return current->callbacks_.screenRect(rect,geometry);return std::nullopt;};
    store.characterBounds=[weak](int32_t start,int32_t end,uint64_t epoch,uint64_t revision){if(auto current=weak.lock();current&&!current->closing_)current->callbacks_.characterBounds(start,end,epoch,revision);};
    store.hitPosition=[weak](POINT point,DWORD flags,uint64_t epoch,uint64_t revision){if(auto current=weak.lock();current&&!current->closing_)current->requestHit(point,flags,epoch,revision);};
    store.terminateComposition=[weak](ITfCompositionView* composition)->HRESULT{if(auto current=weak.lock();current&&!current->closing_&&current->context_)return current->context_->terminateComposition(composition);return E_UNEXPECTED;};
    self->store_=Microsoft::WRL::Make<TextInputStore>(root->window(),std::move(owner),std::move(text),selection,maximumUnits,scope,std::move(store));
    self->context_=root->thread()->attach(root->window(),self->store_.Get());
    // The session holds only a weak root reference. This callback keeps the
    // OS client alive even if Fabric removes its transport before Pop succeeds.
    self->client_=root->registerClient([self,registry=root.get()](std::string const& message){self->retire(*registry,message);},[weak]{if(auto current=weak.lock();current&&!current->closing_&&current->active())current->screenCoordinatesChanged();});
    return self;
  }
  ~TextInputSession()noexcept{if(!retired_)try{close();}catch(...){std::terminate();}}
  TextInputSession(TextInputSession const&)=delete;
  TextInputSession& operator=(TextInputSession const&)=delete;
  bool stopped()const{ui();return closing_;}
  bool retired()const{ui();return retired_;}
  DocumentValue const& read()const{live();return store_->read();}
  ITfContext* context()const{live();return context_->context();}
  KeyboardTextResult keyboardText(std::wstring const& text,uint64_t revision){auto call=pin();if(!enabled_||!context_->hasFocus())return KeyboardTextResult::unavailable;return call.store->keyboardText(text,revision);}
  void coreDocument(std::wstring text,Selection selection){auto call=pin();call.store->coreDocument(std::move(text),selection);}
  bool geometry(CoreGeometry geometry,std::wstring text,Selection selection,uint64_t revision){auto call=pin();return call.store->coreGeometry(std::move(geometry),std::move(text),selection,revision);}
  void withdrawGeometry(){auto call=pin();pendingHit_.reset();call.store->withdrawGeometry();}
  bool characterBounds(uint64_t viewport,uint64_t epoch,uint64_t revision,int32_t start,int32_t end,std::vector<Rect> rects){auto call=pin();return call.store->characterBounds(viewport,epoch,revision,start,end,std::move(rects));}
  bool caretBounds(uint64_t viewport,uint64_t epoch,uint64_t revision,int32_t offset,Rect rect){auto call=pin();return call.store->caretBounds(viewport,epoch,revision,offset,rect);}
  bool hitPosition(uint64_t request,std::optional<LONG> offset,uint64_t epoch,uint64_t revision){
    auto call=pin();if(!pendingHit_||pendingHit_->request!=request||pendingHit_->mapping!=mapping_||pendingHit_->epoch!=epoch||pendingHit_->revision!=revision)return false;
    const auto pending=*pendingHit_;pendingHit_.reset();return call.store->hitPosition(pending.screen,pending.flags,offset,epoch,revision);
  }
  void screenCoordinatesChanged(){auto call=pin();if(++mapping_>TextInputDocument::maximumCounter)throw std::overflow_error("Text input mapping identity exhausted");pendingHit_.reset();call.store->screenCoordinatesChanged();}
  void configuration(bool enabled,bool readOnly,bool multiline,InputScope scope){
    auto call=pin();if(++configurationSerial_>TextInputDocument::maximumCounter)throw std::overflow_error("Text input configuration identity exhausted");const auto serial=configurationSerial_;enabled_=enabled;
    call.store->configuration(enabled,readOnly,multiline,scope);if(closing_||configurationSerial_!=serial)return;
    if(!enabled){context_->withdrawFocus();if(!closing_&&!context_->hasFocus())call.store->focus(false);}
  }
  bool focus(){auto call=pin();if(!enabled_||!callbacks_.focusSurface())return false;if(closing_)return false;const auto root=root_.lock();if(!root)return false;const auto window=root->focusedInputWindow();call.store->inputWindow(window);if(closing_)return false;context_->associateFocus(window);if(closing_||!context_->hasFocus())return false;call.store->focus(true);return !closing_;}
  void blur(){auto call=pin();context_->withdrawFocus();if(!closing_)call.store->focus(false);}
  void replace(std::wstring text,Selection selection,uint64_t revision,uint64_t request,bool cancel){
    auto call=pin();stopTimer();call.store->replace(std::move(text),selection,revision,request,cancel);
    if(!closing_&&call.store->cancellationPending(request)){
      cancellation_=request;timer_=dispatcher_.CreateTimer();timer_.IsRepeating(false);timer_.Interval(timeout_);const auto generation=generation_;const auto weak=weak_from_this();
      tick_=timer_.Tick([weak,generation,request](auto const&,auto const&){if(auto current=weak.lock();current&&!current->closing_&&current->active()&&current->generation_==generation&&current->cancellation_==request){try{current->store_->cancellationExpired(request);}catch(std::exception const& error){current->fail(error.what());}catch(...){current->fail("Windows input cancellation deadline failed");}}});timer_.Start();
    }
  }
  void close(){ui();if(retired_)return;auto root=root_.lock();if(!root)throw std::logic_error("Text input root retired before its client");close(*root);}
  void close(TextInputRoot& registry){ui();if(&registry!=rootIdentity_)throw std::invalid_argument("Foreign text input retirement owner");retire(registry,{});}
private:
  struct Call {std::shared_ptr<TextInputSession> owner;Microsoft::WRL::ComPtr<TextInputStore> store;};
  Call pin(){live();return {shared_from_this(),store_};}
  struct PendingHit {uint64_t request;POINT screen;DWORD flags;uint64_t epoch,revision,mapping;};
  TextInputSession(std::shared_ptr<TextInputRoot> const& root,std::chrono::milliseconds timeout,TextInputSessionCallbacks callbacks):uiThread_(GetCurrentThreadId()),root_(root),rootIdentity_(root.get()),dispatcher_(root->island().DispatcherQueue()),timeout_(timeout),callbacks_(std::move(callbacks)){}
  bool active()const{return !callbacks_.active||callbacks_.active();}
  void ui()const{if(GetCurrentThreadId()!=uiThread_)throw std::logic_error("Text input session requires its UI thread");}
  void live()const{ui();if(closing_)throw std::logic_error("Text input session retired");}
  void stopTimer(){if(timer_){timer_.Stop();if(tick_)timer_.Tick(*tick_);}tick_.reset();timer_=nullptr;cancellation_.reset();}
  void requestHit(POINT screen,DWORD flags,uint64_t epoch,uint64_t revision){
    const auto geometry=store_->geometry();if(!geometry||geometry->epoch!=epoch||store_->read().revision!=revision)return;
    const auto mapping=mapping_;const auto point=callbacks_.viewPoint(screen,flags,*geometry);if(closing_||mapping_!=mapping||!point)return;
    const auto current=store_->geometry();if(!current||current->epoch!=epoch||store_->read().revision!=revision)return;
    if(point->outside){pendingHit_.reset();store_->hitPosition(screen,flags,std::nullopt,epoch,revision);return;}
    if(!std::isfinite(point->x)||!std::isfinite(point->y))throw std::invalid_argument("Nonfinite Core hit mapping");
    if(nextHit_==TextInputDocument::maximumCounter)throw std::overflow_error("Text input query identity exhausted");const auto request=++nextHit_;pendingHit_=PendingHit{request,screen,flags,epoch,revision,mapping_};callbacks_.hitPosition({request,*point,flags,epoch,revision});
  }
  void beginClose(){if(closing_)return;closing_=true;++generation_;stopTimer();pendingHit_.reset();if(store_)store_->close();}
  void retire(TextInputRoot& root,std::string const& message){
    [[maybe_unused]] auto keep=weak_from_this().lock();ui();if(retired_)return;if(retiring_)throw std::logic_error("Reentrant text input session retirement");auto failed=callbacks_.failed;beginClose();retiring_=true;
    try{if(context_)context_->close();context_.reset();store_.Reset();if(client_)root.unregisterClient(client_);client_=0;retired_=true;retiring_=false;callbacks_={};if(!message.empty())try{failed(message);}catch(...){} }
    catch(...){retiring_=false;throw;}
  }
  void fail(std::string const& message)noexcept{
    if(closing_)return;
    try{auto failed=callbacks_.failed;beginClose();const auto weak=weak_from_this();dispatcher_.TryEnqueue([weak]{if(auto current=weak.lock();current&&!current->retired_)if(auto root=current->root_.lock())try{current->retire(*root,{});}catch(...){} });try{failed(message);}catch(...){} }catch(...){closing_=true;}
  }
  DWORD const uiThread_;
  std::weak_ptr<TextInputRoot> root_;
  TextInputRoot* const rootIdentity_;
  winrt::Microsoft::UI::Dispatching::DispatcherQueue dispatcher_{nullptr};
  std::chrono::milliseconds const timeout_;
  TextInputSessionCallbacks callbacks_;
  Microsoft::WRL::ComPtr<TextInputStore> store_;
  std::unique_ptr<TextInputContext> context_;
  TextInputRoot::ClientId client_=0;
  winrt::Microsoft::UI::Dispatching::DispatcherQueueTimer timer_{nullptr};
  std::optional<winrt::event_token> tick_;
  std::optional<uint64_t> cancellation_;
  std::optional<PendingHit> pendingHit_;
  uint64_t generation_=1,mapping_=0,nextHit_=0,configurationSerial_=0;
  bool enabled_=true,closing_=false,retiring_=false,retired_=false;
};
}
