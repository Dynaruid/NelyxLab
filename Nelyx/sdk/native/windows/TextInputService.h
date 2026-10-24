// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputProtocol.h"
#include <atomic>
#include <map>

namespace Nelyx::WindowsInput {
/** One Core View lease. Native sessions are retained until their real context
 * is popped; neither disconnect nor root shutdown acknowledges an undrained
 * client. A thread-safe ingress flag can stop OS reads before UI cleanup. */
class TextInputService final : public std::enable_shared_from_this<TextInputService> {
public:
  using Emit=std::function<void(InputWire::RN::JSValueObject)>;
  static std::shared_ptr<TextInputService> create(std::shared_ptr<TextInputRoot> const& root,Owner owner,TextInputProtocolCallbacks mapping,Emit emit,std::shared_ptr<std::atomic_bool> ingress){
    if(!root||owner.id.empty()||!owner.generation||owner.generation>TextInputDocument::maximumCounter||!mapping.screenRect||!mapping.viewPoint||!mapping.focusSurface||!emit||!ingress||!ingress->load())throw std::invalid_argument("Input service requires its real surface, owner, transport and ingress fence");
    auto self=std::shared_ptr<TextInputService>(new TextInputService(root,std::move(owner),std::move(mapping),std::move(emit),std::move(ingress)));self->identity_=root->registerClient([self,registry=root.get()](std::string const& message){self->retire(*registry,message);});
    try{auto watch=self->mapping_.watchRetirement;if(watch){auto unwatch=watch([weak=std::weak_ptr<TextInputService>(self)](std::string const& message){if(auto current=weak.lock())current->surfaceRetired(message);});if(self->closed_){if(unwatch)unwatch();}else self->unwatch_=std::move(unwatch);}}catch(...){self->close();throw;}return self;
  }
  ~TextInputService()noexcept{if(!closed_)try{close();}catch(...){std::terminate();}}
  uint64_t identity()const{ui();return identity_;}
  bool closed()const{ui();return closed_;}
  void open(uint64_t client,InputWire::RN::JSValue const& initial,size_t maximumUnits,InputScope scope,std::chrono::milliseconds timeout){
    live();if(client<=lastClient_||client>TextInputDocument::maximumCounter||!maximumUnits||maximumUnits>65536||InputWire::owner(InputWire::field(initial,"owner"))!=owner_)throw std::invalid_argument("Invalid input service client/owner/budget");lastClient_=client;
    const auto weak=weak_from_this();auto mapping=mapping_;mapping.emit=[weak,client](std::string_view type,InputWire::RN::JSValueObject value){if(auto current=weak.lock())current->event(client,type,std::move(value));};auto original=mapping.active;mapping.active=[fence=ingress_,local=localIngress_,original]{return fence->load()&&local->load()&&(!original||original());};
    auto endpoint=TextInputProtocol::create(root(),initial,maximumUnits,scope,timeout,std::move(mapping));if(closing_){endpoint->close();throw std::logic_error("Input service retired while opening a client");}clients_.emplace(client,std::move(endpoint));
  }
  bool configuration(uint64_t client,bool enabled,bool readOnly,bool multiline,InputScope scope){live();auto found=clients_.find(client);if(found==clients_.end()||found->second->stopped())return false;auto endpoint=found->second;endpoint->configuration(enabled,readOnly,multiline,scope);return true;}
  bool command(uint64_t client,std::wstring_view name,InputWire::RN::JSValueArray const& args){
    live();const auto found=clients_.find(client);if(found==clients_.end()||found->second->stopped())return false;auto endpoint=found->second;if(!endpoint->command(name,args))throw std::invalid_argument("Unknown Windows input command");return true;
  }
  bool closeClient(uint64_t client){ui();const auto found=clients_.find(client);if(found==clients_.end())return false;auto endpoint=found->second;endpoint->close();clients_.erase(client);return true;}
  InputWire::RN::JSValueObject keyboardText(uint64_t client,std::wstring const& text,uint64_t revision,uint64_t focusEpoch){
    live();const auto found=clients_.find(client);if(found==clients_.end()||found->second->stopped())throw std::logic_error("Keyboard input client retired");auto endpoint=found->second;
    const auto result=focusEpoch==root()->thread()->focusEpoch()?endpoint->keyboardText(text,revision):KeyboardTextResult::unavailable;const char* status="unavailable";switch(result){case KeyboardTextResult::applied:status="applied";break;case KeyboardTextResult::stale:status="stale";break;case KeyboardTextResult::busy:status="busy";break;case KeyboardTextResult::limit:status="limit";break;default:break;}
    return {{"status",status},{"revision",double(endpoint->read().revision)}};
  }
  void close(){ui();if(closed_)return;auto registry=root_.lock();if(!registry)throw std::logic_error("Input root retired before its service");retire(*registry);}
private:
  void surfaceRetired(std::string const& message)noexcept{
    if(closing_||closed_)return;
    try{retire(*root(),message);}catch(...){if(ingress_->load()&&emit_)try{emit_({{"service",double(identity_)},{"client",0},{"type","serviceError"},{"value",InputWire::RN::JSValueObject{{"message",message+"; native retirement requires retry"}}}});}catch(...){} }
  }
  TextInputService(std::shared_ptr<TextInputRoot> const& root,Owner owner,TextInputProtocolCallbacks mapping,Emit emit,std::shared_ptr<std::atomic_bool> ingress):thread_(GetCurrentThreadId()),root_(root),owner_(std::move(owner)),mapping_(std::move(mapping)),emit_(std::move(emit)),ingress_(std::move(ingress)){}
  void ui()const{if(GetCurrentThreadId()!=thread_)throw std::logic_error("Input service requires its UI thread");}
  void live()const{ui();if(closing_||closed_||!ingress_->load())throw std::logic_error("Input service retired");}
  std::shared_ptr<TextInputRoot> root()const{auto current=root_.lock();if(!current)throw std::logic_error("Input root unavailable");return current;}
  void event(uint64_t client,std::string_view type,InputWire::RN::JSValueObject value){
    if(closing_||closed_||!ingress_->load()||!clients_.contains(client))return;auto emit=emit_;emit({{"service",double(identity_)},{"client",double(client)},{"type",std::string(type)},{"value",std::move(value)}});
  }
  void retire(TextInputRoot& registry,std::string const& message={}){
    [[maybe_unused]] auto keep=weak_from_this().lock();ui();if(closed_)return;if(retiring_)throw std::logic_error("Reentrant input service retirement");closing_=true;localIngress_->store(false);retiring_=true;
    try{while(!clients_.empty()){const auto client=clients_.begin()->first;auto endpoint=clients_.begin()->second;endpoint->close(registry);clients_.erase(client);}if(unwatch_){unwatch_();unwatch_={};}if(identity_)registry.unregisterClient(identity_);auto emit=emit_;closed_=true;retiring_=false;mapping_={};emit_={};if(!message.empty()&&ingress_->load())try{emit({{"service",double(identity_)},{"client",0},{"type","serviceError"},{"value",InputWire::RN::JSValueObject{{"message",message}}}});}catch(...){} }catch(...){retiring_=false;throw;}
  }
  DWORD const thread_;std::weak_ptr<TextInputRoot> root_;Owner const owner_;TextInputProtocolCallbacks mapping_;Emit emit_;std::function<void()> unwatch_;std::shared_ptr<std::atomic_bool> ingress_;std::shared_ptr<std::atomic_bool> localIngress_=std::make_shared<std::atomic_bool>(true);std::map<uint64_t,std::shared_ptr<TextInputProtocol>> clients_;uint64_t identity_=0,lastClient_=0;bool closing_=false,retiring_=false,closed_=false;
};
}
