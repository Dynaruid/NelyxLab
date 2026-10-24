// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputService.h"
#include "TextInputHost.h"
#include <NativeModules.h>
#include <winrt/Microsoft.ReactNative.Composition.h>

namespace Nelyx::WindowsInput {
namespace RN=winrt::Microsoft::ReactNative;
// ComponentView.Root() dereferences RNW's cached root and is unsafe after a
// Fabric detach. Follow the actual parent chain at lifetime boundaries.
inline RN::Composition::RootComponentView inputComponentRoot(RN::ComponentView view){
  for(unsigned depth=0;view&&depth<256;++depth,view=view.Parent())if(const auto root=view.try_as<RN::Composition::RootComponentView>())return root;return nullptr;
}
// A producer must resolve the actual native Skia surface and owner. There is
// deliberately no proxy-layout or top-level-window coordinate fallback.
using TextInputSurfaceResolver=std::function<TextInputProtocolCallbacks(RN::IReactContext const&,uint64_t,Owner const&)>;
inline auto TextInputSurfaceResolverProperty(){return RN::ReactPropertyId<RN::ReactNonAbiValue<TextInputSurfaceResolver>>{L"Nelyx.SDK",L"TextInputSurfaces.v1"};}
class TextInputModuleState final : public std::enable_shared_from_this<TextInputModuleState> {
public:
  explicit TextInputModuleState(RN::ReactContext context):context_(std::move(context)){}
  template<class T,class F> void post(RN::ReactPromise<T> promise,F action)noexcept{
    if(!ingress_->load()){promise.Reject("Windows input module retired");return;}auto self=shared_from_this();context_.UIDispatcher().Post([self,promise,action=std::move(action)]()noexcept{
      try{if(!self->ingress_->load())throw std::logic_error("Windows input module retired");promise.Resolve(action(*self));}
      catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}catch(std::exception const& error){promise.Reject(error.what());}catch(...){promise.Reject("Windows input UI operation failed");}
    });
  }
  uint64_t connect(uint64_t surface,Owner owner){
    const auto root=context_.Properties().Get(TextInputRootProperty());const auto resolver=context_.Properties().Get(TextInputSurfaceResolverProperty());if(!root||!*root||!resolver||!*resolver)throw std::logic_error("The Windows host must install actual Skia surface input mappings");auto mapping=(*resolver)(context_.Handle(),surface,owner);const auto weak=weak_from_this();
    auto service=TextInputService::create(*root,std::move(owner),std::move(mapping),[weak](RN::JSValueObject value){if(auto state=weak.lock();state&&state->ingress_->load())state->context_.EmitJSEvent(L"RCTDeviceEventEmitter",L"nelyxWindowsInput",std::move(value));},ingress_);const auto id=service->identity();services_.emplace(id,std::move(service));return id;
  }
  std::shared_ptr<TextInputService> service(uint64_t identity){const auto found=services_.find(identity);if(found==services_.end()||found->second->closed())throw std::logic_error("Windows input service retired");return found->second;}
  bool disconnect(uint64_t identity){const auto found=services_.find(identity);if(found==services_.end())return false;auto service=found->second;service->close();services_.erase(identity);return true;}
  void stop()noexcept{
    if(!ingress_->exchange(false))return;try{auto self=shared_from_this();if(context_.UIDispatcher().HasThreadAccess())retire();else context_.UIDispatcher().Post([self]()noexcept{self->retire();});}catch(...){}
  }
private:
  void retire()noexcept{for(auto found=services_.begin();found!=services_.end();){try{found->second->close();found=services_.erase(found);}catch(...){++found;}}}
  RN::ReactContext context_;std::shared_ptr<std::atomic_bool> ingress_=std::make_shared<std::atomic_bool>(true);std::map<uint64_t,std::shared_ptr<TextInputService>> services_;
};
inline uint64_t inputIdentity(double value){return InputWire::counter(RN::JSValue(value));}
inline InputScope inputScope(double value){const auto scope=static_cast<InputScope>(InputWire::counter(RN::JSValue(value),true,static_cast<uint64_t>(INT32_MAX)));switch(scope){case IS_DEFAULT:case IS_NUMBER:case IS_DIGITS:case IS_TELEPHONE_FULLTELEPHONENUMBER:case IS_EMAIL_SMTPEMAILADDRESS:case IS_URL:case IS_PASSWORD:case IS_SEARCH:case IS_TEXT:case IS_PRIVATE:return scope;default:throw std::invalid_argument("Unsupported TSF input scope");}}
/** The module has no native View. React instance destruction fences OS reads
 * immediately, then retires its service leases on the owning UI dispatcher. */
REACT_MODULE(NelyxWindowsInput)
struct NelyxWindowsInput {
  REACT_INIT(initialize)
  void initialize(RN::ReactContext const& context)noexcept{state=std::make_shared<TextInputModuleState>(context);}
  ~NelyxWindowsInput(){if(state)state->stop();}
  REACT_SYNC_METHOD(getInputProtocol)
  int32_t getInputProtocol()noexcept{return 3;}
  REACT_METHOD(insertText)
  void insertText(double service,double client,std::string text,double revision,double focusEpoch,RN::ReactPromise<RN::JSValueObject> promise)noexcept{state->post(promise,[service,client,text=std::move(text),revision,focusEpoch](auto& current){return current.service(inputIdentity(service))->keyboardText(inputIdentity(client),InputWire::text(RN::JSValue(text)),InputWire::counter(RN::JSValue(revision),true),inputIdentity(focusEpoch));});}
  REACT_METHOD(connect)
  void connect(double surface,RN::JSValue owner,RN::ReactPromise<double> promise)noexcept{auto value=std::make_shared<RN::JSValue>(std::move(owner));state->post(promise,[surface,value](auto& current){return double(current.connect(inputIdentity(surface),InputWire::owner(*value)));});}
  REACT_METHOD(openClient)
  void openClient(double service,double client,RN::JSValue initial,double maximum,double scope,RN::ReactPromise<bool> promise)noexcept{auto value=std::make_shared<RN::JSValue>(std::move(initial));state->post(promise,[service,client,value,maximum,scope](auto& current){current.service(inputIdentity(service))->open(inputIdentity(client),*value,static_cast<size_t>(InputWire::counter(RN::JSValue(maximum),false,65536)),inputScope(scope),std::chrono::milliseconds(5000));return true;});}
  REACT_METHOD(configureClient)
  void configureClient(double service,double client,bool enabled,bool readOnly,bool multiline,double scope,RN::ReactPromise<bool> promise)noexcept{state->post(promise,[=](auto& current){return current.service(inputIdentity(service))->configuration(inputIdentity(client),enabled,readOnly,multiline,inputScope(scope));});}
  REACT_METHOD(command)
  void command(double service,double client,std::string name,RN::JSValueArray args,RN::ReactPromise<bool> promise)noexcept{auto values=std::make_shared<RN::JSValueArray>(std::move(args));state->post(promise,[service,client,name=std::move(name),values](auto& current){const auto wide=winrt::to_hstring(name);return current.service(inputIdentity(service))->command(inputIdentity(client),std::wstring_view(wide),*values);});}
  REACT_METHOD(closeClient)
  void closeClient(double service,double client,RN::ReactPromise<bool> promise)noexcept{state->post(promise,[=](auto& current){return current.service(inputIdentity(service))->closeClient(inputIdentity(client));});}
  REACT_METHOD(disconnect)
  void disconnect(double service,RN::ReactPromise<bool> promise)noexcept{state->post(promise,[=](auto& current){return current.disconnect(inputIdentity(service));});}
  std::shared_ptr<TextInputModuleState> state;
};
}
