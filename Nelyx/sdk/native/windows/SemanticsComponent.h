// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SemanticsSnapshot.h"
#include "SemanticsFocus.h"
#include <windows/WindowsInputTrace.h>
#include "SemanticsTextProvider.h"
#include "TextInputModule.h"
#include <CompositionSession.h>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <wrl.h>

namespace Nelyx::WindowsSemantics {
struct SemanticsPeerState {
  bool mounted=false,closed=false;std::optional<CoreSemanticsSnapshot> snapshot;
  std::shared_ptr<TextDocument> document;ComPtr<TextProvider> text;
  ComPtr<IRawElementProviderSimple> base;ComPtr<IRawElementProviderFragment> fragment;
  Nelyx::WindowsInput::TextInputProtocolCallbacks mapping;
  std::weak_ptr<Nelyx::WindowsInput::TextInputRoot> root;
  std::function<bool()> focus,activate;
};
struct CoreSemanticsMetadata {
  uint64_t commit=0;bool canActivate=false,field=false,value=false,text=false,password=false,readOnly=false;
  explicit CoreSemanticsMetadata(CoreSemanticsSnapshot const& snapshot):commit(snapshot.commit),canActivate(snapshot.canActivate),field(snapshot.text.has_value()){
    value=field&&(snapshot.text->obscured||!snapshot.text->characters.empty());password=field&&snapshot.text->obscured;text=value&&!password;readOnly=field&&(snapshot.text->readOnly||!snapshot.enabled);
  }
};
/** The existing RNW fragment tree remains authoritative for native ancestry.
 * This wrapper replaces field patterns and screen bounds with Core producers.
 * It is apartment-bound, and never focuses or paints a native text control. */
class SemanticsPeer final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::WinRtClassicComMix|Microsoft::WRL::InhibitFtmBase>,IInspectable,IRawElementProviderSimple,IRawElementProviderFragment,IInvokeProvider> {
  InspectableClass(L"Nelyx.CoreSemanticsPeer",BaseTrust);
public:
  void initialize(std::weak_ptr<SemanticsPeerState> state){state_=std::move(state);thread_=std::this_thread::get_id();}
  IFACEMETHODIMP get_ProviderOptions(ProviderOptions* result)noexcept override{if(!result)return E_POINTER;*result=static_cast<ProviderOptions>(ProviderOptions_ServerSideProvider|ProviderOptions_UseComThreading);return S_OK;}
  IFACEMETHODIMP GetPatternProvider(PATTERNID id,IUnknown** result)noexcept override{return boundary([&]{output(result);const auto state=read();const auto& snapshot=*state->snapshot;
    if(id==UIA_InvokePatternId){if(snapshot.canActivate)checked(QueryInterface(IID_IInvokeProvider,reinterpret_cast<void**>(result)));return;}
    if(snapshot.role=="text-field"&&(id==UIA_TextPatternId||id==UIA_TextPattern2Id||id==UIA_ValuePatternId)){
      if(!state->text||(id!=UIA_ValuePatternId&&snapshot.text->obscured))return;checked(state->text.CopyTo(IID_IUnknown,reinterpret_cast<void**>(result)));return;
    }checked(state->base->GetPatternProvider(id,result));
  });}
  IFACEMETHODIMP GetPropertyValue(PROPERTYID id,VARIANT* result)noexcept override{return boundary([&]{require(result,E_POINTER);VariantInit(result);const auto state=read();const auto& snapshot=*state->snapshot;
    const auto flag=[&](bool value){result->vt=VT_BOOL;result->boolVal=value?VARIANT_TRUE:VARIANT_FALSE;};
    if(id==UIA_IsEnabledPropertyId){flag(snapshot.enabled);return;}if(id==UIA_IsKeyboardFocusablePropertyId){flag(snapshot.enabled&&snapshot.focusable);return;}if(id==UIA_HasKeyboardFocusPropertyId){
      const auto root=state->root.lock();if(!snapshot.focused||(state->mapping.visible&&!state->mapping.visible())||!root||!winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(root->island()).HasFocus()){flag(false);return;}
      checked(state->base->GetPropertyValue(id,result));return;
    }
    if(id==UIA_IsInvokePatternAvailablePropertyId){flag(snapshot.canActivate);return;}
    if(snapshot.role=="text-field"){
      if(id==UIA_ControlTypePropertyId){result->vt=VT_I4;result->lVal=UIA_EditControlTypeId;return;}
      if(id==UIA_IsPasswordPropertyId){flag(snapshot.text->obscured);return;}
      if(id==UIA_IsTextPatternAvailablePropertyId||id==UIA_IsTextPattern2AvailablePropertyId){flag(state->text&&!snapshot.text->obscured);return;}
      if(id==UIA_IsValuePatternAvailablePropertyId){flag(static_cast<bool>(state->text));return;}
      if(id==UIA_ValueIsReadOnlyPropertyId){flag(snapshot.text->readOnly||!snapshot.enabled);return;}
      if(id==UIA_ValueValuePropertyId){require(!snapshot.text->obscured,E_ACCESSDENIED);result->vt=VT_BSTR;result->bstrVal=SysAllocStringLen(snapshot.text->text.data(),static_cast<UINT>(snapshot.text->text.size()));require(result->bstrVal,E_OUTOFMEMORY);return;}
    }
    if(id==UIA_IsOffscreenPropertyId){const auto bounds=screen(*state);flag(bounds.width<=0||bounds.height<=0);return;}checked(state->base->GetPropertyValue(id,result));
  });}
  IFACEMETHODIMP get_HostRawElementProvider(IRawElementProviderSimple** result)noexcept override{return boundary([&]{output(result);checked(read()->base->get_HostRawElementProvider(result));});}
  IFACEMETHODIMP Navigate(NavigateDirection direction,IRawElementProviderFragment** result)noexcept override{return boundary([&]{output(result);require(direction>=NavigateDirection_Parent&&direction<=NavigateDirection_LastChild);checked(read()->fragment->Navigate(direction,result));});}
  IFACEMETHODIMP GetRuntimeId(SAFEARRAY** result)noexcept override{return boundary([&]{output(result);checked(read()->fragment->GetRuntimeId(result));});}
  IFACEMETHODIMP get_BoundingRectangle(UiaRect* result)noexcept override{return boundary([&]{output(result);*result=screen(*read());});}
  IFACEMETHODIMP GetEmbeddedFragmentRoots(SAFEARRAY** result)noexcept override{return boundary([&]{output(result);checked(read()->fragment->GetEmbeddedFragmentRoots(result));});}
  IFACEMETHODIMP SetFocus()noexcept override{return boundary([&]{const auto state=read();require(state->snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(state->snapshot->focusable&&state->focus&&state->focus(),UIA_E_INVALIDOPERATION);});}
  IFACEMETHODIMP Invoke()noexcept override{return boundary([&]{const auto state=read();require(state->snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(state->snapshot->canActivate&&state->activate&&state->activate(),UIA_E_INVALIDOPERATION);});}
  IFACEMETHODIMP get_FragmentRoot(IRawElementProviderFragmentRoot** result)noexcept override{return boundary([&]{output(result);checked(read()->fragment->get_FragmentRoot(result));});}
private:
  std::shared_ptr<SemanticsPeerState> read()const{require(thread_==std::this_thread::get_id(),RPC_E_WRONG_THREAD);const auto state=state_.lock();require(state&&!state->closed&&state->mounted&&state->snapshot&&state->base&&state->fragment&&state->mapping.active&&state->mapping.active(),UIA_E_ELEMENTNOTAVAILABLE);return state;}
  static UiaRect screen(SemanticsPeerState const& state){const auto snapshot=*state.snapshot;require(snapshot.role!="text-field"||snapshot.hasGeometry,UIA_E_ELEMENTNOTAVAILABLE);const auto root=state.root.lock();const auto before=root?root->coordinateRevision():std::nullopt;require(before.has_value(),UIA_E_ELEMENTNOTAVAILABLE);const auto bounds=state.mapping.screenRect(snapshot.bounds,snapshot.frame);const auto after=root->coordinateRevision();require(bounds&&after&&*before==*after&&!state.closed&&state.mounted&&state.snapshot&&state.snapshot->commit==snapshot.commit&&state.mapping.active(),UIA_E_ELEMENTNOTAVAILABLE);return {double(bounds->left),double(bounds->top),double(bounds->right-bounds->left),double(bounds->bottom-bounds->top)};}
  std::thread::id thread_;std::weak_ptr<SemanticsPeerState> state_;
};
struct SemanticsProps:winrt::implements<SemanticsProps,RN::IComponentProps>{
  SemanticsProps(RN::ViewProps const&,RN::IComponentProps const& previous){if(previous)packet=previous.as<SemanticsProps>()->packet.Copy();}
  void SetProp(uint32_t,winrt::hstring const& name,RN::IJSValueReader const& reader)noexcept{if(name==L"coreSnapshot")RN::ReadValue(reader,packet);}
  RN::JSValue packet;
};
/** A plain Composition View with no visual content or native editor. Only its
 * Fabric lifetime, default fragment ancestry and typed Core data are used. */
struct SemanticsComponent:winrt::implements<SemanticsComponent,winrt::Windows::Foundation::IInspectable>{
  ~SemanticsComponent(){close();}
  void initialize(RN::ComponentView const& view){
    view_=winrt::make_weak(view);state_=std::make_shared<SemanticsPeerState>();const auto weak=get_weak();
    mounted_=view.Mounted(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto self=weak.get())self->guard([&]{self->state_->mounted=true;self->apply();self->finishUpdates();});});
    unmounted_=view.Unmounted(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto self=weak.get()){self->state_->mounted=false;self->retireText();self->retireFocusProxy();}});
    destroying_=view.Destroying(winrt::auto_revoke,[weak](auto const&,auto const&){if(auto self=weak.get())self->close();});
  }
  void finishUpdates(){if(state_->closed||!state_->mounted)return;if(pendingFocus_){const auto previous=*pendingFocus_;pendingFocus_.reset();syncFocus(previous);}if(pendingMetadata_){const auto previous=std::move(*pendingMetadata_);pendingMetadata_.reset();notifyMetadata(previous);}}
  void props(SemanticsProps const& value){packet_=value.packet.Copy();if(state_->mounted)apply();}
  void emitter(RN::EventEmitter value){emitter_=value;if(!failure_.empty())error();}
  winrt::Windows::Foundation::IInspectable automation(winrt::Windows::Foundation::IInspectable const& base){
    require(!state_->closed&&base,UIA_E_ELEMENTNOTAVAILABLE);checked(base.as<IUnknown>()->QueryInterface(IID_PPV_ARGS(&state_->base)));checked(state_->base.As(&state_->fragment));
    peer_=Microsoft::WRL::Make<SemanticsPeer>();require(peer_!=nullptr,E_OUTOFMEMORY);peer_->initialize(state_);ComPtr<IAgileObject> agile;ComPtr<IMarshal> marshal;require(peer_.As(&agile)==E_NOINTERFACE&&peer_.As(&marshal)==E_NOINTERFACE,E_UNEXPECTED);winrt::Windows::Foundation::IInspectable result{nullptr};checked(peer_->QueryInterface(winrt::guid_of<winrt::Windows::Foundation::IInspectable>(),winrt::put_abi(result)));return result;
  }
  void close()noexcept{if(!state_||state_->closed)return;state_->closed=true;state_->mounted=false;retireText();retireFocusProxy();if(unwatch_){try{unwatch_();}catch(...){}unwatch_={};}state_->mapping={};state_->snapshot.reset();state_->base.Reset();state_->fragment.Reset();emitter_=nullptr;}
  template<class F>void guard(F action)noexcept{if(!state_||state_->closed)return;try{action();}catch(TextError const& e){fail("Core semantics HRESULT "+std::to_string(static_cast<unsigned long>(e.result)));}catch(winrt::hresult_error const& e){fail(winrt::to_string(e.message()));}catch(std::exception const& e){fail(e.what());}catch(...){fail("Core semantics native operation failed");}}
private:
  void retireFocusProxy()noexcept{
    pendingFocus_.reset();if(!unregisterFocus_)return;
    try{const auto view=view_.get();const auto nativeRoot=Nelyx::WindowsInput::inputComponentRoot(view);const auto root=state_->root.lock();if(nativeRoot&&nativeRoot.GetFocusedComponent()==view&&root&&winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(root->island()).HasFocus()&&state_->mapping.active&&state_->mapping.active()&&state_->mapping.focusCanvas)state_->mapping.focusCanvas();}catch(...){}
    try{unregisterFocus_();}catch(...){}unregisterFocus_={};
  }
  void retireText()noexcept{if(state_->document){try{state_->document->retire();}catch(...){}state_->document.reset();}state_->text.Reset();}
  void apply(){
    if(packet_.IsNull())return;auto next=readCoreSemanticsSnapshot(packet_);const auto view=view_.get();require(static_cast<bool>(view),UIA_E_ELEMENTNOTAVAILABLE);const auto context=view.ReactContext();const RN::ReactPropertyBag properties(context.Properties());
    if(state_->snapshot){const auto& old=*state_->snapshot;require(old.id==next.id&&old.source==next.source&&old.owner==next.owner&&old.surface==next.surface);require(next.commit>=old.commit);}
    if(!state_->mapping.active){const auto root=properties.Get(Nelyx::WindowsInput::TextInputRootProperty());const auto resolver=properties.Get(Nelyx::WindowsInput::TextInputSurfaceResolverProperty());require(root&&*root&&resolver&&*resolver);state_->root=*root;state_->mapping=(*resolver)(context,next.surface,next.owner);const auto weak=get_weak();
      if(state_->mapping.watchRetirement)unwatch_=state_->mapping.watchRetirement([weak](std::string const& reason){if(auto self=weak.get())self->fail(reason);});
      state_->focus=[weak]{if(auto self=weak.get()){const auto view=self->view_.get();if(view)RNSkia::windowsInputTrace(RNSkia::WindowsInputStage::Focus,view.Tag(),0,0,4,0,true);return view&&self->state_->mapping.focusSurface&&self->state_->mapping.focusSurface()&&self->dispatch("focus",{})&&view.TryFocus(RN::FocusState::Programmatic);}return false;};
      state_->activate=[weak]{if(auto self=weak.get())return self->dispatch("activate",{});return false;};
    }
    if(!unregisterFocus_){require(static_cast<bool>(state_->mapping.registerFocusProxy),UIA_E_INVALIDOPERATION);unregisterFocus_=state_->mapping.registerFocusProxy(view.Tag());}
    if(next.paragraph){const auto session=properties.Get(RNSkia::WindowsCompositionSessionProperty());require(session&&*session);ParagraphScreenMapping mapping;mapping.context=std::static_pointer_cast<RNSkia::RNSkPlatformContext>((*session)->uiPlatform());mapping.active=state_->mapping.active;mapping.revision=[root=state_->root]{const auto live=root.lock();return live?live->coordinateRevision():std::nullopt;};
      mapping.screenBox=[convert=state_->mapping.screenRect,frame=next.frame](LogicalBox const& box)->std::optional<ScreenBox>{const auto value=convert(box,frame);if(!value)return std::nullopt;return ScreenBox{double(value->left),double(value->top),double(value->right-value->left),double(value->bottom-value->top)};};
      mapping.viewPoint=[convert=state_->mapping.viewPoint,frame=next.frame](double x,double y)->std::optional<LogicalPoint>{const auto rx=std::round(x),ry=std::round(y);if(!std::isfinite(rx)||!std::isfinite(ry)||rx<LONG_MIN||rx>LONG_MAX||ry<LONG_MIN||ry>LONG_MAX)return std::nullopt;const auto point=convert({static_cast<LONG>(rx),static_cast<LONG>(ry)},GXFPF_NEAREST,frame);if(!point||point->outside)return std::nullopt;return LogicalPoint{point->x,point->y};};attachParagraphQueries(next,std::move(mapping));
    }
    const bool wasFocused=state_->snapshot&&state_->snapshot->enabled&&state_->snapshot->focusable&&state_->snapshot->focused;
    if(state_->snapshot&&!pendingMetadata_)pendingMetadata_.emplace(*state_->snapshot);
    const bool textReady=next.text&&(next.text->obscured||!next.text->characters.empty());if(!textReady)retireText();else{
      if(state_->document&&state_->snapshot&&state_->snapshot->text&&state_->snapshot->text->generation!=next.text->generation)retireText();
      const auto weak=get_weak();next.text->dispatch=[weak](TextAction const& action){const auto self=weak.get();if(!self||!self->state_->snapshot||!self->state_->snapshot->text)return false;const auto& current=*self->state_->snapshot->text;if(current.revision!=action.revision||current.generation!=action.generation)return false;
        if(action.kind==TextActionKind::SetText)return self->dispatch("set-text",{{"text",winrt::to_string(action.text)}});
        if(action.kind==TextActionKind::SetSelection)return self->dispatch("set-selection",{{"anchor",action.anchor},{"focus",action.focus}});
        if(action.kind==TextActionKind::ScrollRange)return self->dispatch("scroll-range",{{"start",action.anchor},{"end",action.focus},{"alignToTop",action.alignToTop}});return false;
      };
      if(!state_->document){state_->document=std::make_shared<TextDocument>();state_->text=TextProvider::create(state_->document,[weak](IRawElementProviderSimple** result){const auto self=weak.get();if(!self||!self->peer_||self->state_->closed||!self->state_->mounted)return HRESULT(UIA_E_ELEMENTNOTAVAILABLE);return self->peer_.CopyTo(result);});}
      const auto changes=state_->document->publish(*next.text);state_->snapshot=std::move(next);if(peer_)checked(state_->text->notify(changes));if(!pendingFocus_)pendingFocus_=wasFocused;return;
    }state_->snapshot=std::move(next);if(!pendingFocus_)pendingFocus_=wasFocused;
  }
  void notifyMetadata(CoreSemanticsMetadata const& previous){
    if(!peer_||!state_->snapshot||state_->closed||!state_->mounted||!UiaClientsAreListening())return;const CoreSemanticsMetadata next(*state_->snapshot);
    const auto notify=[&](PROPERTYID id,bool before,bool after){if(before==after||state_->closed||!state_->mounted||!state_->snapshot||state_->snapshot->commit!=next.commit)return;AutomationVariant oldValue,newValue;oldValue.data.vt=newValue.data.vt=VT_BOOL;oldValue.data.boolVal=before?VARIANT_TRUE:VARIANT_FALSE;newValue.data.boolVal=after?VARIANT_TRUE:VARIANT_FALSE;checked(UiaRaiseAutomationPropertyChangedEvent(peer_.Get(),id,oldValue.data,newValue.data));};
    // RNW publishes name, role, enabled and focusable changes from its ViewProps.
    // These properties are replaced by this Core peer and need Core notifications.
    notify(UIA_IsInvokePatternAvailablePropertyId,previous.canActivate,next.canActivate);
    notify(UIA_IsValuePatternAvailablePropertyId,previous.value,next.value);notify(UIA_IsTextPatternAvailablePropertyId,previous.text,next.text);notify(UIA_IsTextPattern2AvailablePropertyId,previous.text,next.text);
    if(previous.field&&next.field){notify(UIA_IsPasswordPropertyId,previous.password,next.password);notify(UIA_ValueIsReadOnlyPropertyId,previous.readOnly,next.readOnly);}
  }
  void syncFocus(bool wasFocused){
    const auto view=view_.get();if(!view||!state_->snapshot||!state_->mapping.active()||(state_->mapping.visible&&!state_->mapping.visible()))return;
    const auto nativeRoot=Nelyx::WindowsInput::inputComponentRoot(view);if(!nativeRoot)return;
    const auto& snapshot=*state_->snapshot;const bool focused=snapshot.enabled&&snapshot.focusable&&snapshot.focused;bool moved=false;
    const auto root=state_->root.lock();const bool ownerFocused=root&&winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(root->island()).HasFocus();
    const bool peerFocused=nativeRoot.GetFocusedComponent()==view;
    const auto action=semanticsFocusAction(wasFocused,focused,peerFocused,ownerFocused);
    if(action!=NativeFocusAction::None||wasFocused!=focused)RNSkia::windowsInputTrace(RNSkia::WindowsInputStage::Focus,view.Tag(),0,0,action==NativeFocusAction::Peer?2:action==NativeFocusAction::Canvas?3:6,unsigned(ownerFocused)|(unsigned(peerFocused)<<1)|(unsigned(focused)<<2)|(unsigned(wasFocused)<<3),true);
    if(action==NativeFocusAction::Peer){require(state_->mapping.focusSurface&&state_->mapping.focusSurface(),UIA_E_INVALIDOPERATION);require(view.TryFocus(RN::FocusState::Programmatic),UIA_E_INVALIDOPERATION);moved=true;}
    else if(action==NativeFocusAction::Canvas){require(state_->mapping.focusCanvas&&state_->mapping.focusCanvas(),UIA_E_INVALIDOPERATION);moved=true;}
    // RNW raises focus notifications when native focus actually moves. A UIA
    // request can move it before Core publishes the acknowledged focus value.
    if(!moved&&peer_&&ownerFocused&&peerFocused&&wasFocused!=focused&&UiaClientsAreListening()){
      AutomationVariant before,after;before.data.vt=after.data.vt=VT_BOOL;before.data.boolVal=wasFocused?VARIANT_TRUE:VARIANT_FALSE;after.data.boolVal=focused?VARIANT_TRUE:VARIANT_FALSE;
      checked(UiaRaiseAutomationPropertyChangedEvent(peer_.Get(),UIA_HasKeyboardFocusPropertyId,before.data,after.data));if(focused)checked(UiaRaiseAutomationEvent(peer_.Get(),UIA_AutomationFocusChangedEventId));
    }
  }
  bool dispatch(std::string kind,RN::JSValueObject arguments){
    if(state_->closed||!state_->mounted||!state_->snapshot||!state_->snapshot->enabled||!emitter_||!state_->mapping.active())return false;const auto& value=*state_->snapshot;
    arguments.emplace("protocol",1);arguments.emplace("kind",std::move(kind));arguments.emplace("id",value.id);arguments.emplace("source",double(value.source));arguments.emplace("commit",double(value.commit));if(value.text){arguments.emplace("revision",double(value.text->revision));arguments.emplace("generation",double(value.text->generation));}
    auto payload=std::make_shared<RN::JSValueObject>(std::move(arguments));emitter_.DispatchEvent(L"coreSemanticsAction",[payload](RN::IJSValueWriter const& writer)noexcept{RN::WriteValue(writer,*payload);});return true;
  }
  void fail(std::string reason)noexcept{if(state_->closed)return;failure_=std::move(reason);error();close();}
  void error()noexcept{if(!emitter_)return;try{auto value=std::make_shared<RN::JSValueObject>(RN::JSValueObject{{"message",failure_}});emitter_.DispatchEvent(L"coreSemanticsError",[value](RN::IJSValueWriter const& writer)noexcept{RN::WriteValue(writer,*value);});}catch(...){} }
  winrt::weak_ref<RN::ComponentView> view_;std::shared_ptr<SemanticsPeerState> state_;ComPtr<SemanticsPeer> peer_;RN::JSValue packet_;RN::EventEmitter emitter_{nullptr};std::string failure_;std::function<void()> unwatch_,unregisterFocus_;std::optional<bool> pendingFocus_;std::optional<CoreSemanticsMetadata> pendingMetadata_;
  RN::ComponentView::Mounted_revoker mounted_;RN::ComponentView::Unmounted_revoker unmounted_;RN::ComponentView::Destroying_revoker destroying_;
};
REACT_MODULE(NelyxWindowsSemantics)
struct NelyxWindowsSemantics {
  REACT_SYNC_METHOD(getSemanticsProtocol)
  int getSemanticsProtocol()noexcept{return 4;}
};
inline void RegisterSemanticsComponent(RN::IReactPackageBuilder const& package){
  package.as<RN::IReactPackageBuilderFabric>().AddViewComponent(L"NelyxCoreSemantics",[](RN::IReactViewComponentBuilder const& builder){
    builder.SetCreateProps([](RN::ViewProps const& base,RN::IComponentProps const& previous){return winrt::make<SemanticsProps>(base,previous);});const auto composition=builder.as<RN::Composition::IReactCompositionViewComponentBuilder>();
    composition.SetViewComponentViewInitializer([](RN::ComponentView const& view){const auto component=winrt::make_self<SemanticsComponent>();component->initialize(view);view.UserData(*component);});
    builder.SetUpdatePropsHandler([](RN::ComponentView const& view,RN::IComponentProps const& props,RN::IComponentProps const&){const auto component=view.UserData().as<SemanticsComponent>();component->guard([&]{component->props(*props.as<SemanticsProps>());});});
    builder.SetFinalizeUpdateHandler([](RN::ComponentView const& view,RN::ComponentViewUpdateMask){const auto component=view.UserData().as<SemanticsComponent>();component->guard([&]{component->finishUpdates();});});
    builder.SetUpdateEventEmitterHandler([](RN::ComponentView const& view,RN::EventEmitter const& emitter){view.UserData().as<SemanticsComponent>()->emitter(emitter);});
    builder.SetCreateAutomationPeerHandler([](RN::ComponentView const& view,RN::CreateAutomationPeerArgs const& args){auto component=view.UserData().as<SemanticsComponent>();winrt::Windows::Foundation::IInspectable result{nullptr};component->guard([&]{result=component->automation(args.DefaultAutomationPeer());});return result;});
  });
}
}
