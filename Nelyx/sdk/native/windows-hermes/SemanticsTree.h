// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "Packets.h"
#include "../windows/SemanticsTextProvider.h"
#include <set>
#include <limits>
namespace Nelyx::NativeHermes {
using Microsoft::WRL::ComPtr;
namespace WS=WindowsSemantics;
class SemanticsTree;
class SemanticsPeer final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IRawElementProviderSimple,IRawElementProviderFragment,IRawElementProviderFragmentRoot,IInvokeProvider,IToggleProvider,IValueProvider,IRangeValueProvider>{
public:
  using Base=Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IRawElementProviderSimple,IRawElementProviderFragment,IRawElementProviderFragmentRoot,IInvokeProvider,IToggleProvider,IValueProvider,IRangeValueProvider>;
  IFACEMETHODIMP QueryInterface(REFIID iid,void** value)noexcept override{if(!value)return E_POINTER;*value=nullptr;if(!id.empty()&&iid==__uuidof(IRawElementProviderFragmentRoot))return E_NOINTERFACE;return Base::QueryInterface(iid,value);}
  std::weak_ptr<SemanticsTree> tree;std::string id;int runtimeId=0;DWORD owner=GetCurrentThreadId();HWND hostWindow=nullptr;SemanticsPeer* disconnectRoot=nullptr;
  void identity()const{WS::require(owner==GetCurrentThreadId(),UIA_E_ELEMENTNOTAVAILABLE);if(!disconnectRoot)lock();}
  std::shared_ptr<SemanticsTree> lock()const;
  IFACEMETHODIMP get_ProviderOptions(ProviderOptions* value)noexcept override{if(!value)return E_POINTER;*value=ProviderOptions(ProviderOptions_ServerSideProvider|ProviderOptions_UseComThreading);return S_OK;}
  IFACEMETHODIMP GetPatternProvider(PATTERNID,IUnknown**)noexcept override;
  IFACEMETHODIMP GetPropertyValue(PROPERTYID,VARIANT*)noexcept override;
  IFACEMETHODIMP get_HostRawElementProvider(IRawElementProviderSimple**)noexcept override;
  IFACEMETHODIMP Navigate(NavigateDirection,IRawElementProviderFragment**)noexcept override;
  IFACEMETHODIMP GetRuntimeId(SAFEARRAY**)noexcept override;
  IFACEMETHODIMP get_BoundingRectangle(UiaRect*)noexcept override;
  IFACEMETHODIMP GetEmbeddedFragmentRoots(SAFEARRAY** value)noexcept override{if(!value)return E_POINTER;*value=nullptr;return S_OK;}
  IFACEMETHODIMP SetFocus()noexcept override;
  IFACEMETHODIMP get_FragmentRoot(IRawElementProviderFragmentRoot**)noexcept override;
  IFACEMETHODIMP ElementProviderFromPoint(double,double,IRawElementProviderFragment**)noexcept override;
  IFACEMETHODIMP GetFocus(IRawElementProviderFragment**)noexcept override;
  IFACEMETHODIMP Invoke()noexcept override;
  IFACEMETHODIMP Toggle()noexcept override;
  IFACEMETHODIMP get_ToggleState(ToggleState*)noexcept override;
  IFACEMETHODIMP SetValue(LPCWSTR)noexcept override;
  IFACEMETHODIMP get_Value(BSTR*)noexcept override;
  IFACEMETHODIMP get_IsReadOnly(BOOL*)noexcept override;
  IFACEMETHODIMP SetValue(double)noexcept override;
  IFACEMETHODIMP get_Value(double*)noexcept override;
  IFACEMETHODIMP get_Minimum(double*)noexcept override;
  IFACEMETHODIMP get_Maximum(double*)noexcept override;
  IFACEMETHODIMP get_SmallChange(double*)noexcept override;
  IFACEMETHODIMP get_LargeChange(double*)noexcept override;
};
class SemanticsTree final:public std::enable_shared_from_this<SemanticsTree>{
public:
  struct Action{std::string id,kind;uint64_t source=0,commit=0;std::optional<WS::TextAction> text;std::optional<double> value;};
  struct Node{SemanticPacket packet;ComPtr<SemanticsPeer> peer;std::shared_ptr<WS::TextDocument> document;ComPtr<WS::TextProvider> text;};
  static std::shared_ptr<SemanticsTree> create(HWND window,std::function<void(Action)> dispatch,std::function<void(std::function<void()>)> defer){auto value=std::shared_ptr<SemanticsTree>(new SemanticsTree(window,std::move(dispatch),std::move(defer)));value->root=Microsoft::WRL::Make<SemanticsPeer>();value->root->tree=value;value->root->hostWindow=window;value->root->runtimeId=++value->next;return value;}
  Node& read(std::string const& id){ui();auto found=nodes.find(id);WS::require(found!=nodes.end(),UIA_E_ELEMENTNOTAVAILABLE);return found->second;}
  void ui()const{WS::require(owner==GetCurrentThreadId()&&!closed,UIA_E_ELEMENTNOTAVAILABLE);}
  UiaRect bounds(std::string const& id){ui();POINT origin{};WS::require(ClientToScreen(window,&origin));const double scale=GetDpiForWindow(window)/96.;if(id.empty()){RECT r{};GetClientRect(window,&r);return {double(origin.x),double(origin.y),double(r.right),double(r.bottom)};}auto const& s=read(id).packet.snapshot;WS::require(s.frame.viewport==viewport&&s.frame.surface==surface,UIA_E_ELEMENTNOTAVAILABLE);auto const& r=s.bounds;return {origin.x+r.x*scale,origin.y+r.y*scale,r.width*scale,r.height*scale};}
  ComPtr<SemanticsPeer> peer(std::string const& id){return id.empty()?root:read(id).peer;}
  std::vector<std::string> children(std::string const& id){ui();std::vector<std::string> result;for(size_t i=0;i<order.size();++i){auto const& n=read(order[i]);const auto parent=n.packet.parent;if(id.empty()?parent<0:parent>=0&&size_t(parent)<order.size()&&order[parent]==id)result.push_back(order[i]);}return result;}
  bool action(std::string const& id,std::string kind,std::optional<WS::TextAction> text={},std::optional<double> value={}){auto const& node=read(id).packet.snapshot;WS::require(node.frame.viewport==viewport&&node.frame.surface==surface,UIA_E_ELEMENTNOTAVAILABLE);if(!node.enabled)return false;dispatch({id,std::move(kind),node.source,node.commit,std::move(text),value});return true;}
  void metrics(uint64_t value,uint64_t backing){ui();viewport=value;surface=backing;++coordinates;}
  void announce(std::wstring const& message){ui();if(message.empty()||!UiaClientsAreListening())return;if(message.size()>4096)throw std::runtime_error("Native announcement exceeds4096 UTF-16 units");auto text=SysAllocStringLen(message.data(),UINT(message.size()));if(!text)throw std::bad_alloc();const auto result=UiaRaiseNotificationEvent(root.Get(),NotificationKind_ActionCompleted,NotificationProcessing_ImportantMostRecent,text,nullptr);SysFreeString(text);WS::checked(result);}
  void update(SemanticsDelta delta,std::weak_ptr<void> context){
    ui();if(delta.viewport!=viewport||delta.surface!=surface||delta.commit<commit)return;
    if(delta.owner.id!="native-hermes:root"||delta.owner.generation!=1)throw std::runtime_error("Foreign native semantics owner");
    std::map<std::string,SemanticPacket> changes;std::set<std::string> desired(delta.order.begin(),delta.order.end()),removed(delta.removed.begin(),delta.removed.end());
    if(desired.size()!=delta.order.size()||removed.size()!=delta.removed.size())throw std::runtime_error("Duplicate native semantics delta ID");
    for(auto& packet:delta.upserts){auto const& s=packet.snapshot;auto id=s.id;if(s.owner!=delta.owner||s.commit!=delta.commit||s.frame.viewport!=delta.viewport||s.frame.surface!=delta.surface||!desired.contains(id)||!changes.emplace(id,std::move(packet)).second)throw std::runtime_error("Invalid native semantics upsert");}
    for(auto const& id:removed)if(desired.contains(id)||!nodes.contains(id))throw std::runtime_error("Invalid native semantics removal");
    for(auto const& [id,node]:nodes)if(!desired.contains(id)&&!removed.contains(id))throw std::runtime_error("Missing native semantics removal");
    std::vector<SemanticPacket> packets;packets.reserve(delta.order.size());
    for(auto const& id:delta.order){auto found=changes.find(id);if(found==changes.end()&&!nodes.contains(id))throw std::runtime_error("Missing native semantics node");auto packet=found==changes.end()?nodes.at(id).packet:std::move(found->second);packet.snapshot.commit=delta.commit;packets.push_back(std::move(packet));}
    publish(std::move(packets),context);commit=delta.commit;
  }
  void publish(std::vector<SemanticPacket> packets,std::weak_ptr<void> context){
    ui();if(packets.size()>4096)throw std::runtime_error("Native semantics node budget");std::set<std::string> wanted;std::vector<std::string> nextOrder;size_t index=0;
    for(auto const& p:packets){if(p.snapshot.id.empty()||!wanted.insert(p.snapshot.id).second||p.parent< -1||p.parent>=int(index++))throw std::runtime_error("Invalid native semantics topology");
      if(p.range&&(!validSemanticRange(*p.range)||p.snapshot.text||p.snapshot.role=="text-field"))throw std::runtime_error("Invalid native semantics range");
      if(p.snapshot.text){WS::TextDocument::validate(*p.snapshot.text);auto old=nodes.find(p.snapshot.id);if(old!=nodes.end()&&old->second.document&&old->second.packet.snapshot.source==p.snapshot.source&&old->second.packet.snapshot.text->generation==p.snapshot.text->generation)WS::TextDocument::validateTransition(*old->second.document->read(false),*p.snapshot.text);}
      nextOrder.push_back(p.snapshot.id);}
    struct Properties{std::wstring name;std::optional<std::wstring> value;std::optional<bool> selected,checked;bool focused=false,enabled=true;std::optional<SemanticRange> range;};
    struct Notification{ComPtr<SemanticsPeer> peer;std::optional<Properties> previous;std::string id;WS::TextChanges text;};std::vector<Notification> notifications;const bool listening=UiaClientsAreListening();if(listening)notifications.reserve(packets.size());
    std::vector<ComPtr<SemanticsPeer>> retired;
    bool structure=order!=nextOrder;++coordinates;
    for(auto it=nodes.begin();it!=nodes.end();)if(!wanted.contains(it->first)){retired.push_back(it->second.peer);if(it->second.document)it->second.document->retire();it=nodes.erase(it);}else ++it;
    order=std::move(nextOrder);
    for(auto& packet:packets){const auto id=packet.snapshot.id;const auto source=packet.snapshot.source;auto found=nodes.find(id);
      if(found!=nodes.end()&&(found->second.packet.snapshot.source!=source||found->second.packet.snapshot.role!=packet.snapshot.role||found->second.packet.isSlider!=packet.isSlider||(packet.snapshot.text&&found->second.packet.snapshot.text&&packet.snapshot.text->generation!=found->second.packet.snapshot.text->generation))){retired.push_back(found->second.peer);if(found->second.document)found->second.document->retire();nodes.erase(found);structure=true;}
      auto& node=nodes[id];Notification notification;if(listening){notification.id=id;if(node.peer){auto const& p=node.packet;notification.previous=Properties{p.name,p.value,p.selected,p.checked,p.snapshot.focused,p.snapshot.enabled,p.range};}}if(!node.peer){node.peer=Microsoft::WRL::Make<SemanticsPeer>();node.peer->tree=shared_from_this();node.peer->id=id;node.peer->runtimeId=++next;}if(listening)notification.peer=node.peer;
      auto& snapshot=packet.snapshot;
      if(snapshot.text){
        auto weak=weak_from_this();WS::ParagraphScreenMapping mapping;mapping.context=context;
        mapping.active=[weak,id,source]{auto self=weak.lock();if(!self||self->closed||!self->nodes.contains(id))return false;auto const& s=self->nodes.at(id).packet.snapshot;return s.source==source&&s.frame.viewport==self->viewport&&s.frame.surface==self->surface;};
        mapping.revision=[weak]()->std::optional<uint64_t>{auto self=weak.lock();return self&&!self->closed?std::optional<uint64_t>(self->coordinates):std::nullopt;};
        mapping.screenBox=[weak](WS::LogicalBox const& box)->std::optional<WS::ScreenBox>{auto self=weak.lock();if(!self||self->closed)return {};POINT origin{};if(!ClientToScreen(self->window,&origin))return {};const auto scale=GetDpiForWindow(self->window)/96.;return WS::ScreenBox{origin.x+box.x*scale,origin.y+box.y*scale,box.width*scale,box.height*scale};};
        mapping.viewPoint=[weak](double x,double y)->std::optional<WS::LogicalPoint>{auto self=weak.lock();if(!self||self->closed)return {};POINT origin{};if(!ClientToScreen(self->window,&origin))return {};const auto scale=GetDpiForWindow(self->window)/96.;return WS::LogicalPoint{(x-origin.x)/scale,(y-origin.y)/scale};};
        WS::attachParagraphQueries(snapshot,std::move(mapping));snapshot.text->dispatch=[weak,id](WS::TextAction const& action){auto self=weak.lock();return self&&!self->closed&&self->action(id,"text",action);};
        if(!node.document){node.document=std::make_shared<WS::TextDocument>();node.text=WS::TextProvider::create(node.document,[weak,id](IRawElementProviderSimple** output){auto self=weak.lock();if(!self||self->closed)return HRESULT(UIA_E_ELEMENTNOTAVAILABLE);try{return self->peer(id).CopyTo(output);}catch(...){return HRESULT(UIA_E_ELEMENTNOTAVAILABLE);}});}
        notification.text=node.document->publish(*snapshot.text);node.packet=std::move(packet);
      }else{if(node.document)node.document->retire();node.text.Reset();node.document.reset();node.packet=std::move(packet);}
      if(listening)notifications.push_back(std::move(notification));
    }
    // UIA can re-enter a provider while receiving an event. Notify only after
    // the complete validated tree has acquired the new commit.
    for(auto const& event:notifications){auto& node=read(event.id);if(node.text)node.text->notify(event.text);if(!UiaClientsAreListening())continue;
      auto property=[&](PROPERTYID id,VARIANT before,VARIANT after){UiaRaiseAutomationPropertyChangedEvent(event.peer.Get(),id,before,after);};
      auto boolean=[&](PROPERTYID id,bool before,bool after){if(before==after)return;VARIANT a{},b{};a.vt=b.vt=VT_BOOL;a.boolVal=before?VARIANT_TRUE:VARIANT_FALSE;b.boolVal=after?VARIANT_TRUE:VARIANT_FALSE;property(id,a,b);};
      auto const& current=node.packet;const auto* previous=event.previous?&*event.previous:nullptr;
      const bool focused=current.snapshot.focused&&::GetFocus()==window;boolean(UIA_HasKeyboardFocusPropertyId,previous&&previous->focused&&::GetFocus()==window,focused);boolean(UIA_IsEnabledPropertyId,!previous||previous->enabled,current.snapshot.enabled);
      if(focused&&(!previous||!previous->focused))UiaRaiseAutomationEvent(event.peer.Get(),UIA_AutomationFocusChangedEventId);
      if(current.selected)boolean(UIA_SelectionItemIsSelectedPropertyId,previous&&previous->selected.value_or(false),*current.selected);
      if(current.checked&&(!previous||previous->checked!=current.checked)){VARIANT a{},b{};a.vt=b.vt=VT_I4;a.lVal=previous&&previous->checked.value_or(false)?ToggleState_On:ToggleState_Off;b.lVal=*current.checked?ToggleState_On:ToggleState_Off;property(UIA_ToggleToggleStatePropertyId,a,b);}
      auto string=[&](PROPERTYID id,std::wstring const& before,std::wstring const& after){if(before==after)return;WS::AutomationVariant a,b;a.string(before);b.string(after);property(id,a.data,b.data);};
      string(UIA_NamePropertyId,previous?previous->name:L"",current.name);if(current.value&&!current.range)string(UIA_ValueValuePropertyId,previous&&previous->value?*previous->value:L"",*current.value);
      if(current.range&&previous&&previous->range){auto const& a=*previous->range;auto const& b=*current.range;auto numeric=[&](PROPERTYID id,double before,double after){if(before==after||std::isnan(before)&&std::isnan(after))return;VARIANT x{},y{};x.vt=y.vt=VT_R8;x.dblVal=before;y.dblVal=after;property(id,x,y);};numeric(UIA_RangeValueValuePropertyId,a.value,b.value);numeric(UIA_RangeValueMinimumPropertyId,a.min,b.min);numeric(UIA_RangeValueMaximumPropertyId,a.max,b.max);numeric(UIA_RangeValueSmallChangePropertyId,a.smallChange.value_or(std::numeric_limits<double>::quiet_NaN()),b.smallChange.value_or(std::numeric_limits<double>::quiet_NaN()));numeric(UIA_RangeValueLargeChangePropertyId,a.largeChange.value_or(std::numeric_limits<double>::quiet_NaN()),b.largeChange.value_or(std::numeric_limits<double>::quiet_NaN()));boolean(UIA_RangeValueIsReadOnlyPropertyId,a.readOnly,b.readOnly);}
    }
    if(structure&&UiaClientsAreListening())UiaRaiseStructureChangedEvent(root.Get(),StructureChangeType_ChildrenInvalidated,nullptr,0);
    disconnect(std::move(retired));
  }
  void close(){if(closed)return;ui();std::vector<ComPtr<SemanticsPeer>> retired;retired.reserve(nodes.size()+1);for(auto& [id,node]:nodes){retired.push_back(node.peer);if(node.document)node.document->retire();}retired.push_back(root);nodes.clear();order.clear();dispatch={};closed=true;disconnect(std::move(retired));}
  HWND window;DWORD owner;bool closed=false;int next=0;uint64_t coordinates=0,viewport=0,surface=0,commit=0;std::vector<std::string> order;std::map<std::string,Node> nodes;ComPtr<SemanticsPeer> root;
private:
  void disconnect(std::vector<ComPtr<SemanticsPeer>> retired){if(retired.empty())return;defer([retired=std::move(retired),root=this->root]{
    // Outbound UIA COM calls are forbidden inside a cross-thread SendMessage.
    // The host posts this work after the whole replacement tree is published.
    if(root->owner!=GetCurrentThreadId())throw std::runtime_error("Native UIA disconnection requires its UI owner");const auto sending=InSendMessageEx(nullptr);if((sending&ISMEX_SEND)&&!(sending&ISMEX_REPLIED))throw std::runtime_error("Native UIA disconnection requires a posted UI turn");
    // UIA must resolve the retired identity to disconnect it. Temporarily allow
    // only runtime/host/root identity queries; actions, data and bounds remain
    // fenced by lock(). Restore prior state if COM pumps another cleanup turn.
    HRESULT failure=S_OK;for(auto const& peer:retired){auto previousRoot=root->disconnectRoot,previousPeer=peer->disconnectRoot;root->disconnectRoot=root.Get();peer->disconnectRoot=root.Get();const auto result=UiaDisconnectProvider(peer.Get());peer->disconnectRoot=previousPeer;root->disconnectRoot=previousRoot;if(FAILED(result)&&SUCCEEDED(failure))failure=result;}
    if(FAILED(failure))throw std::runtime_error("Native UIA provider disconnection failed HRESULT="+std::to_string(failure));
  });}
  SemanticsTree(HWND window,std::function<void(Action)> dispatch,std::function<void(std::function<void()>)> defer):window(window),owner(GetCurrentThreadId()),dispatch(std::move(dispatch)),defer(std::move(defer)){}std::function<void(Action)> dispatch;std::function<void(std::function<void()>)> defer;
};
inline std::shared_ptr<SemanticsTree> SemanticsPeer::lock()const{auto self=tree.lock();WS::require(self!=nullptr,UIA_E_ELEMENTNOTAVAILABLE);self->ui();WS::require(id.empty()?self->root.Get()==this:self->read(id).peer.Get()==this,UIA_E_ELEMENTNOTAVAILABLE);return self;}
inline HRESULT SemanticsPeer::GetRuntimeId(SAFEARRAY** result)noexcept{return WS::boundary([&]{WS::output(result);identity();if(id.empty())return;int values[2]{UiaAppendRuntimeId,runtimeId};WS::SafeArray array(VT_I4,2);LONG at=0;for(auto value:values)array.put(at++,&value);*result=array.release();});}
inline HRESULT SemanticsPeer::GetPatternProvider(PATTERNID pattern,IUnknown** result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();self->ui();if(id.empty())return;auto& node=self->read(id);if(pattern==UIA_InvokePatternId&&node.packet.snapshot.canActivate)WS::checked(QueryInterface(__uuidof(IInvokeProvider),reinterpret_cast<void**>(result)));else if(pattern==UIA_TogglePatternId&&node.packet.checked&&node.packet.snapshot.canActivate)WS::checked(QueryInterface(__uuidof(IToggleProvider),reinterpret_cast<void**>(result)));else if(node.text&&(pattern==UIA_TextPatternId||pattern==UIA_TextPattern2Id||pattern==UIA_ValuePatternId)){if(pattern==UIA_ValuePatternId)WS::checked(node.text->QueryInterface(__uuidof(IValueProvider),reinterpret_cast<void**>(result)));else WS::checked(node.text->QueryInterface(__uuidof(ITextProvider2),reinterpret_cast<void**>(result)));}else if(pattern==UIA_RangeValuePatternId&&node.packet.range)WS::checked(QueryInterface(__uuidof(IRangeValueProvider),reinterpret_cast<void**>(result)));else if(pattern==UIA_ValuePatternId&&node.packet.value&&!node.packet.range)WS::checked(QueryInterface(__uuidof(IValueProvider),reinterpret_cast<void**>(result)));});}
inline HRESULT SemanticsPeer::GetPropertyValue(PROPERTYID property,VARIANT* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();self->ui();const auto node=id.empty()?nullptr:&self->read(id);auto boolean=[&](bool value){result->vt=VT_BOOL;result->boolVal=value?VARIANT_TRUE:VARIANT_FALSE;};auto string=[&](std::wstring const& value){result->vt=VT_BSTR;result->bstrVal=SysAllocStringLen(value.data(),UINT(value.size()));WS::require(result->bstrVal!=nullptr,E_OUTOFMEMORY);};
  // The HWND provider supplies the root's focus, runtime ID and Window
  // properties. Overriding them with virtual-child defaults hides its focus.
  if(!node){if(property==UIA_NamePropertyId)string(L"Nelyx application");else if(property==UIA_IsControlElementPropertyId||property==UIA_IsContentElementPropertyId)boolean(true);return;}
  if(property==UIA_NamePropertyId)string(node?node->packet.name:L"Nelyx application");else if(property==UIA_AutomationIdPropertyId)string(node?node->packet.automationId:L"");else if(property==UIA_HelpTextPropertyId)string(node?node->packet.tooltip:L"");
  else if(property==UIA_IsRangeValuePatternAvailablePropertyId)boolean(node&&node->packet.range.has_value());
  else if(property==UIA_RangeValueIsReadOnlyPropertyId&&node&&node->packet.range)boolean(node->packet.range->readOnly);
  else if(node&&node->packet.range&&(property==UIA_RangeValueValuePropertyId||property==UIA_RangeValueMinimumPropertyId||property==UIA_RangeValueMaximumPropertyId||property==UIA_RangeValueSmallChangePropertyId||property==UIA_RangeValueLargeChangePropertyId)){auto const& r=*node->packet.range;result->vt=VT_R8;result->dblVal=property==UIA_RangeValueValuePropertyId?r.value:property==UIA_RangeValueMinimumPropertyId?r.min:property==UIA_RangeValueMaximumPropertyId?r.max:property==UIA_RangeValueSmallChangePropertyId?r.smallChange.value_or(std::numeric_limits<double>::quiet_NaN()):r.largeChange.value_or(std::numeric_limits<double>::quiet_NaN());}
  else if(property==UIA_ValueValuePropertyId&&node&&node->packet.value&&!node->packet.range)string(*node->packet.value);
  else if(property==UIA_SelectionItemIsSelectedPropertyId&&node&&node->packet.selected)boolean(*node->packet.selected);
  else if(property==UIA_ToggleToggleStatePropertyId&&node&&node->packet.checked){result->vt=VT_I4;result->lVal=*node->packet.checked?ToggleState_On:ToggleState_Off;}
  else if(property==UIA_ControlTypePropertyId){result->vt=VT_I4;auto role=node?node->packet.snapshot.role:"root";result->lVal=node&&node->packet.isSlider?UIA_SliderControlTypeId:node&&node->packet.isLink?UIA_HyperlinkControlTypeId:node&&node->packet.checked?UIA_CheckBoxControlTypeId:role=="text-field"?UIA_EditControlTypeId:role=="button"?UIA_ButtonControlTypeId:role=="text"?UIA_TextControlTypeId:role=="image"?UIA_ImageControlTypeId:role=="list"?UIA_ListControlTypeId:UIA_GroupControlTypeId;}
  else if(property==UIA_IsEnabledPropertyId)boolean(!node||node->packet.snapshot.enabled);else if(property==UIA_IsKeyboardFocusablePropertyId)boolean(node&&node->packet.snapshot.focusable);else if(property==UIA_HasKeyboardFocusPropertyId)boolean(node&&node->packet.snapshot.focused&&::GetFocus()==self->window);else if(property==UIA_IsControlElementPropertyId||property==UIA_IsContentElementPropertyId)boolean(true);else if(property==UIA_IsPasswordPropertyId)boolean(node&&node->packet.snapshot.text&&node->packet.snapshot.text->obscured);
  else if(property==UIA_IsOffscreenPropertyId){auto r=self->bounds(id),root=self->bounds("");boolean(r.width<=0||r.height<=0||r.left+r.width<=root.left||r.top+r.height<=root.top||r.left>=root.left+root.width||r.top>=root.top+root.height);}
});}
inline HRESULT SemanticsPeer::get_HostRawElementProvider(IRawElementProviderSimple** result)noexcept{return WS::boundary([&]{WS::output(result);WS::require(owner==GetCurrentThreadId(),UIA_E_ELEMENTNOTAVAILABLE);if(disconnectRoot){if(id.empty())WS::checked(UiaHostProviderFromHwnd(hostWindow,result));return;}auto self=lock();self->ui();if(id.empty())WS::checked(UiaHostProviderFromHwnd(self->window,result));});}
inline HRESULT SemanticsPeer::Navigate(NavigateDirection direction,IRawElementProviderFragment** result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();self->ui();if(direction==NavigateDirection_Parent){if(id.empty())return;auto parent=self->read(id).packet.parent;WS::checked(self->peer(parent<0?"":self->order.at(parent)).CopyTo(result));return;}
  if(direction==NavigateDirection_FirstChild||direction==NavigateDirection_LastChild){auto children=self->children(id);if(!children.empty())WS::checked(self->peer(direction==NavigateDirection_FirstChild?children.front():children.back()).CopyTo(result));return;}
  if(id.empty())return;auto parent=self->read(id).packet.parent;auto siblings=self->children(parent<0?"":self->order.at(parent));auto at=std::find(siblings.begin(),siblings.end(),id);if(at==siblings.end())return;if(direction==NavigateDirection_NextSibling&&++at!=siblings.end())WS::checked(self->peer(*at).CopyTo(result));else if(direction==NavigateDirection_PreviousSibling&&at!=siblings.begin())WS::checked(self->peer(*--at).CopyTo(result));
});}
inline HRESULT SemanticsPeer::get_BoundingRectangle(UiaRect* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();*result=self->bounds(id);});}
inline HRESULT SemanticsPeer::get_FragmentRoot(IRawElementProviderFragmentRoot** result)noexcept{return WS::boundary([&]{WS::output(result);WS::require(owner==GetCurrentThreadId(),UIA_E_ELEMENTNOTAVAILABLE);if(disconnectRoot){WS::checked(disconnectRoot->QueryInterface(IID_PPV_ARGS(result)));return;}auto self=lock();self->ui();WS::checked(self->root.CopyTo(result));});}
inline HRESULT SemanticsPeer::SetFocus()noexcept{return WS::boundary([&]{auto self=lock();if(id.empty())::SetFocus(self->window);else WS::require(self->read(id).packet.snapshot.focusable&&self->action(id,"focus"),UIA_E_INVALIDOPERATION);});}
inline HRESULT SemanticsPeer::Invoke()noexcept{return WS::boundary([&]{auto self=lock();WS::require(!id.empty()&&self->read(id).packet.snapshot.canActivate&&self->action(id,"activate"),UIA_E_INVALIDOPERATION);});}
inline HRESULT SemanticsPeer::Toggle()noexcept{return WS::boundary([&]{auto self=lock();WS::require(!id.empty()&&self->read(id).packet.checked.has_value()&&self->read(id).packet.snapshot.canActivate&&self->action(id,"activate"),UIA_E_INVALIDOPERATION);});}
inline HRESULT SemanticsPeer::get_ToggleState(ToggleState* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& state=self->read(id).packet.checked;WS::require(state.has_value(),UIA_E_INVALIDOPERATION);*result=*state?ToggleState_On:ToggleState_Off;});}
inline HRESULT SemanticsPeer::get_Value(BSTR* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& value=self->read(id).packet.value;WS::require(value.has_value()&&!self->read(id).packet.range,UIA_E_INVALIDOPERATION);*result=SysAllocStringLen(value->data(),UINT(value->size()));WS::require(*result!=nullptr,E_OUTOFMEMORY);});}
inline HRESULT SemanticsPeer::get_IsReadOnly(BOOL* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& packet=self->read(id).packet;WS::require(packet.range.has_value()||packet.value.has_value(),UIA_E_INVALIDOPERATION);*result=packet.range?packet.range->readOnly:TRUE;});}
inline HRESULT SemanticsPeer::SetValue(LPCWSTR)noexcept{return WS::boundary([&]{lock();throw WS::TextError{static_cast<HRESULT>(UIA_E_INVALIDOPERATION)};});}
inline HRESULT SemanticsPeer::SetValue(double value)noexcept{return WS::boundary([&]{auto self=lock();auto const& packet=self->read(id).packet;WS::require(packet.range.has_value(),UIA_E_INVALIDOPERATION);WS::require(packet.snapshot.enabled,UIA_E_ELEMENTNOTENABLED);WS::require(!packet.range->readOnly,UIA_E_INVALIDOPERATION);WS::require(std::isfinite(value)&&value>=packet.range->min&&value<=packet.range->max,E_INVALIDARG);WS::require(self->action(id,"set-range-value",{},value),UIA_E_INVALIDOPERATION);});}
inline HRESULT SemanticsPeer::get_Value(double* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& range=self->read(id).packet.range;WS::require(range.has_value(),UIA_E_INVALIDOPERATION);*result=range->value;});}
inline HRESULT SemanticsPeer::get_Minimum(double* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& range=self->read(id).packet.range;WS::require(range.has_value(),UIA_E_INVALIDOPERATION);*result=range->min;});}
inline HRESULT SemanticsPeer::get_Maximum(double* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& range=self->read(id).packet.range;WS::require(range.has_value(),UIA_E_INVALIDOPERATION);*result=range->max;});}
inline HRESULT SemanticsPeer::get_SmallChange(double* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& range=self->read(id).packet.range;WS::require(range.has_value(),UIA_E_INVALIDOPERATION);*result=range->smallChange.value_or(std::numeric_limits<double>::quiet_NaN());});}
inline HRESULT SemanticsPeer::get_LargeChange(double* result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();auto const& range=self->read(id).packet.range;WS::require(range.has_value(),UIA_E_INVALIDOPERATION);*result=range->largeChange.value_or(std::numeric_limits<double>::quiet_NaN());});}
inline HRESULT SemanticsPeer::ElementProviderFromPoint(double x,double y,IRawElementProviderFragment** result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();self->ui();for(auto at=self->order.rbegin();at!=self->order.rend();++at){auto r=self->bounds(*at);if(x>=r.left&&x<r.left+r.width&&y>=r.top&&y<r.top+r.height){WS::checked(self->peer(*at).CopyTo(result));return;}}WS::checked(self->root.CopyTo(result));});}
inline HRESULT SemanticsPeer::GetFocus(IRawElementProviderFragment** result)noexcept{return WS::boundary([&]{WS::output(result);auto self=lock();self->ui();if(::GetFocus()!=self->window)return;for(auto const& id:self->order)if(self->read(id).packet.snapshot.focused){WS::checked(self->peer(id).CopyTo(result));return;}});}
}
