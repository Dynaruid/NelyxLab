// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SemanticsTextDocument.h"
#include <wrl.h>

namespace Nelyx::WindowsSemantics {
using Microsoft::WRL::ComPtr;
using ElementResolver=std::function<HRESULT(IRawElementProviderSimple**)>;
inline void checked(HRESULT result){if(FAILED(result))throw TextError{result};}
template<class T> void output(T* value){require(value!=nullptr,E_POINTER);*value={};}
class SafeArray final {
public:
  SafeArray(VARTYPE type,size_t count):value_(SafeArrayCreateVector(type,0,static_cast<ULONG>(count))){require(value_!=nullptr,E_OUTOFMEMORY);}
  ~SafeArray(){if(value_)SafeArrayDestroy(value_);}
  SafeArray(SafeArray const&)=delete;SafeArray& operator=(SafeArray const&)=delete;
  void put(LONG index,void* value){checked(SafeArrayPutElement(value_,&index,value));}
  SAFEARRAY* release(){auto result=value_;value_=nullptr;return result;}
private:SAFEARRAY* value_;
};
class AutomationVariant final {
public:
  VARIANT data{};
  ~AutomationVariant(){VariantClear(&data);}
  AutomationVariant()=default;AutomationVariant(AutomationVariant const&)=delete;AutomationVariant& operator=(AutomationVariant const&)=delete;
  void string(std::wstring const& text){data.vt=VT_BSTR;data.bstrVal=SysAllocStringLen(text.data(),static_cast<UINT>(text.size()));require(data.bstrVal!=nullptr,E_OUTOFMEMORY);}
};

/** Non-agile COM objects. The enclosing Fabric peer supplies its fragment
 * identity while these patterns consume only the committed Core document. */
class TextRange final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITextRangeProvider> {
public:
  static ComPtr<TextRange> create(std::shared_ptr<TextDocument> const& document,ElementResolver const& element,int start,int end){
    auto range=Microsoft::WRL::Make<TextRange>();require(range!=nullptr,E_OUTOFMEMORY);range->document_=document;range->element_=element;
    ComPtr<IUnknown> identity;checked(range.As(&identity));range->span_=document->addRange(identity.Get(),start,end);return range;
  }
  IFACEMETHODIMP Clone(ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);read();checked(create(document_,element_,span_->start,span_->end).CopyTo(result));});}
  IFACEMETHODIMP Compare(ITextRangeProvider* other,BOOL* result)noexcept override{return boundary([&]{output(result);read();const auto target=peer(other);*result=span_->start==target->start&&span_->end==target->end;});}
  IFACEMETHODIMP CompareEndpoints(TextPatternRangeEndpoint endpoint,ITextRangeProvider* other,TextPatternRangeEndpoint otherEndpoint,int* result)noexcept override{return boundary([&]{output(result);read();const auto target=peer(other);*result=position(*span_,endpoint)-position(*target,otherEndpoint);});}
  IFACEMETHODIMP ExpandToEnclosingUnit(TextUnit unit)noexcept override{return boundary([&]{const auto snapshot=read();const auto extent=TextDocument::enclosing(TextDocument::stops(*snapshot,unit),span_->start);span_->start=extent.first;span_->end=extent.second;});}
  IFACEMETHODIMP FindAttribute(TEXTATTRIBUTEID attribute,VARIANT expected,BOOL,ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);const auto snapshot=read();require(attribute==UIA_IsReadOnlyAttributeId,UIA_E_NOTSUPPORTED);require(expected.vt==VT_BOOL);if((expected.boolVal!=VARIANT_FALSE)==snapshot->readOnly)checked(create(document_,element_,span_->start,span_->end).CopyTo(result));});}
  IFACEMETHODIMP FindText(BSTR text,BOOL backward,BOOL ignoreCase,ITextRangeProvider** result)noexcept override{return boundary([&]{
    output(result);const auto snapshot=read();require(text!=nullptr&&SysStringLen(text)>0&&SysStringLen(text)<=TextDocument::maximumTextUnits);const auto length=static_cast<int>(SysStringLen(text));
    const auto flags=backward?FIND_FROMEND:FIND_FROMSTART;const auto found=FindStringOrdinal(flags,snapshot->text.data()+span_->start,span_->end-span_->start,text,length,ignoreCase);
    if(found<0)return;const int start=span_->start+found,end=start+length;TextDocument::validateSpan(*snapshot,start,end);checked(create(document_,element_,start,end).CopyTo(result));
  });}
  IFACEMETHODIMP GetAttributeValue(TEXTATTRIBUTEID attribute,VARIANT* result)noexcept override{return boundary([&]{
    require(result!=nullptr,E_POINTER);VariantInit(result);const auto snapshot=read();if(attribute==UIA_IsReadOnlyAttributeId){result->vt=VT_BOOL;result->boolVal=snapshot->readOnly?VARIANT_TRUE:VARIANT_FALSE;}
    else{ComPtr<IUnknown> unsupported;checked(UiaGetReservedNotSupportedValue(&unsupported));result->vt=VT_UNKNOWN;result->punkVal=unsupported.Detach();}
  });}
  IFACEMETHODIMP GetBoundingRectangles(SAFEARRAY** result)noexcept override{return boundary([&]{
    output(result);const auto snapshot=read();if(span_->start==span_->end){SafeArray array(VT_R8,0);*result=array.release();return;}
    require(static_cast<bool>(snapshot->rectangles),UIA_E_ELEMENTNOTAVAILABLE);const auto start=span_->start,end=span_->end;const auto boxes=snapshot->rectangles(start,end);require(document_->isCurrent(snapshot)&&span_->start==start&&span_->end==end&&boxes.has_value(),UIA_E_ELEMENTNOTAVAILABLE);require(boxes->size()<=1024);
    SafeArray array(VT_R8,boxes->size()*4);LONG index=0;for(auto const& box:*boxes){require(std::isfinite(box.x)&&std::isfinite(box.y)&&std::isfinite(box.width)&&std::isfinite(box.height)&&box.width>=0&&box.height>=0);for(double number:{box.x,box.y,box.width,box.height})array.put(index++,&number);}*result=array.release();
  });}
  IFACEMETHODIMP GetEnclosingElement(IRawElementProviderSimple** result)noexcept override{return boundary([&]{output(result);const auto snapshot=read();require(static_cast<bool>(element_),UIA_E_ELEMENTNOTAVAILABLE);ComPtr<IRawElementProviderSimple> element;checked(element_(&element));require(document_->isCurrent(snapshot)&&element!=nullptr,UIA_E_ELEMENTNOTAVAILABLE);checked(element.CopyTo(result));});}
  IFACEMETHODIMP GetText(int maximum,BSTR* result)noexcept override{return boundary([&]{
    output(result);const auto snapshot=read();require(maximum>=-1);int end=maximum<0?span_->end:span_->start+std::min(maximum,span_->end-span_->start);if(!TextDocument::scalarBoundary(snapshot->text,end))--end;
    *result=SysAllocStringLen(snapshot->text.data()+span_->start,static_cast<UINT>(end-span_->start));require(*result!=nullptr,E_OUTOFMEMORY);
  });}
  IFACEMETHODIMP Move(TextUnit unit,int count,int* result)noexcept override{return boundary([&]{
    output(result);const auto snapshot=read();const auto stops=TextDocument::stops(*snapshot,unit);if(!count)return;
    const bool collapsed=span_->start==span_->end;const auto base=collapsed?span_->start:TextDocument::enclosing(stops,span_->start).first;
    auto movement=TextDocument::moveEndpoint(stops,base,count);
    // A nonempty range must retain a complete unit; the terminal document
    // endpoint is only a destination for a degenerate insertion point.
    if(!collapsed&&movement.first==stops.back()&&stops.size()>1){movement.first=stops[stops.size()-2];movement.second=static_cast<int>(stops.size()-2)-static_cast<int>(std::lower_bound(stops.begin(),stops.end(),base)-stops.begin());}
    if(!movement.second)return;span_->start=movement.first;span_->end=collapsed?movement.first:TextDocument::enclosing(stops,movement.first).second;*result=movement.second;
  });}
  IFACEMETHODIMP MoveEndpointByUnit(TextPatternRangeEndpoint endpoint,TextUnit unit,int count,int* result)noexcept override{return boundary([&]{output(result);const auto snapshot=read();const auto movement=TextDocument::moveEndpoint(TextDocument::stops(*snapshot,unit),position(*span_,endpoint),count);setPosition(endpoint,movement.first);*result=movement.second;});}
  IFACEMETHODIMP MoveEndpointByRange(TextPatternRangeEndpoint endpoint,ITextRangeProvider* other,TextPatternRangeEndpoint otherEndpoint)noexcept override{return boundary([&]{read();const auto target=peer(other);setPosition(endpoint,position(*target,otherEndpoint));});}
  IFACEMETHODIMP Select()noexcept override{return boundary([&]{const auto snapshot=read();require(snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(snapshot->selectionEnabled&&static_cast<bool>(snapshot->dispatch),UIA_E_INVALIDOPERATION);checkedDispatch(snapshot,{TextActionKind::SetSelection,snapshot->revision,{},span_->start,span_->end,false,snapshot->generation});});}
  IFACEMETHODIMP AddToSelection()noexcept override{return boundary([&]{const auto snapshot=read();require(snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(snapshot->selectionEnabled&&span_->start==std::min(snapshot->anchor,snapshot->focus)&&span_->end==std::max(snapshot->anchor,snapshot->focus),UIA_E_INVALIDOPERATION);});}
  IFACEMETHODIMP RemoveFromSelection()noexcept override{return boundary([&]{read();throw TextError{static_cast<HRESULT>(UIA_E_INVALIDOPERATION)};});}
  IFACEMETHODIMP ScrollIntoView(BOOL alignToTop)noexcept override{return boundary([&]{const auto snapshot=read();require(snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(static_cast<bool>(snapshot->dispatch),UIA_E_INVALIDOPERATION);checkedDispatch(snapshot,{TextActionKind::ScrollRange,snapshot->revision,{},span_->start,span_->end,alignToTop!=FALSE,snapshot->generation});});}
  IFACEMETHODIMP GetChildren(SAFEARRAY** result)noexcept override{return boundary([&]{output(result);read();SafeArray array(VT_UNKNOWN,0);*result=array.release();});}
private:
  std::shared_ptr<TextSnapshot const> read()const{const auto snapshot=document_->read();require(span_&&!span_->retired,UIA_E_ELEMENTNOTAVAILABLE);return snapshot;}
  std::shared_ptr<TextSpan> peer(ITextRangeProvider* range)const{require(range!=nullptr);ComPtr<IUnknown> identity;checked(range->QueryInterface(IID_PPV_ARGS(&identity)));return document_->peerRange(identity.Get());}
  static int position(TextSpan const& range,TextPatternRangeEndpoint endpoint){require(endpoint==TextPatternRangeEndpoint_Start||endpoint==TextPatternRangeEndpoint_End);return endpoint==TextPatternRangeEndpoint_Start?range.start:range.end;}
  void setPosition(TextPatternRangeEndpoint endpoint,int at){position(*span_,endpoint);if(endpoint==TextPatternRangeEndpoint_Start){span_->start=at;span_->end=std::max(at,span_->end);}else{span_->end=at;span_->start=std::min(at,span_->start);}}
  static void checkedDispatch(std::shared_ptr<TextSnapshot const> const& snapshot,TextAction const& action){require(snapshot->dispatch(action),UIA_E_INVALIDOPERATION);}
  std::shared_ptr<TextDocument> document_;std::shared_ptr<TextSpan> span_;ElementResolver element_;
};

class TextProvider final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,Microsoft::WRL::ChainInterfaces<ITextProvider2,ITextProvider>,IValueProvider> {
public:
  static ComPtr<TextProvider> create(std::shared_ptr<TextDocument> document,ElementResolver element={}){require(document!=nullptr);auto provider=Microsoft::WRL::Make<TextProvider>();require(provider!=nullptr,E_OUTOFMEMORY);provider->document_=std::move(document);provider->element_=std::move(element);return provider;}
  IFACEMETHODIMP GetSelection(SAFEARRAY** result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read();const std::vector<TextSpan> spans=snapshot->selectionEnabled?std::vector<TextSpan>{{std::min(snapshot->anchor,snapshot->focus),std::max(snapshot->anchor,snapshot->focus)}}:std::vector<TextSpan>{};*result=ranges(spans);});}
  IFACEMETHODIMP GetVisibleRanges(SAFEARRAY** result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read();require(static_cast<bool>(snapshot->visibleRanges),UIA_E_ELEMENTNOTAVAILABLE);const auto visible=snapshot->visibleRanges();require(document_->isCurrent(snapshot)&&visible.has_value(),UIA_E_ELEMENTNOTAVAILABLE);require(visible->size()<=1024);for(auto const& range:*visible)TextDocument::validateSpan(*snapshot,range.start,range.end);*result=ranges(*visible);});}
  IFACEMETHODIMP RangeFromChild(IRawElementProviderSimple*,ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);document_->read();throw TextError{E_INVALIDARG};});}
  IFACEMETHODIMP RangeFromPoint(UiaPoint point,ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read();require(std::isfinite(point.x)&&std::isfinite(point.y));require(static_cast<bool>(snapshot->hit),UIA_E_ELEMENTNOTAVAILABLE);const auto hit=snapshot->hit(point.x,point.y);require(document_->isCurrent(snapshot)&&hit.has_value(),UIA_E_ELEMENTNOTAVAILABLE);TextDocument::validateSpan(*snapshot,*hit,*hit);checked(TextRange::create(document_,element_,*hit,*hit).CopyTo(result));});}
  IFACEMETHODIMP get_DocumentRange(ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read();checked(TextRange::create(document_,element_,0,static_cast<int>(snapshot->text.size())).CopyTo(result));});}
  IFACEMETHODIMP get_SupportedTextSelection(SupportedTextSelection* result)noexcept override{return boundary([&]{output(result);*result=document_->read()->selectionEnabled?SupportedTextSelection_Single:SupportedTextSelection_None;});}
  IFACEMETHODIMP RangeFromAnnotation(IRawElementProviderSimple*,ITextRangeProvider** result)noexcept override{return boundary([&]{output(result);document_->read();throw TextError{E_INVALIDARG};});}
  IFACEMETHODIMP GetCaretRange(BOOL* active,ITextRangeProvider** result)noexcept override{return boundary([&]{output(active);output(result);const auto snapshot=document_->read();auto caret=TextRange::create(document_,element_,snapshot->focus,snapshot->focus);*active=snapshot->focused;checked(caret.CopyTo(result));});}
  IFACEMETHODIMP SetValue(LPCWSTR text)noexcept override{return boundary([&]{const auto snapshot=document_->read(false);require(text!=nullptr);require(snapshot->enabled,UIA_E_ELEMENTNOTENABLED);require(!snapshot->readOnly&&static_cast<bool>(snapshot->dispatch),UIA_E_INVALIDOPERATION);const auto length=wcsnlen_s(text,TextDocument::maximumTextUnits+1);require(length<=TextDocument::maximumTextUnits);std::wstring content(text,length);TextDocument::validateText(content);require(snapshot->dispatch({TextActionKind::SetText,snapshot->revision,std::move(content),0,0,false,snapshot->generation}),UIA_E_INVALIDOPERATION);});}
  IFACEMETHODIMP get_Value(BSTR* result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read();*result=SysAllocStringLen(snapshot->text.data(),static_cast<UINT>(snapshot->text.size()));require(*result!=nullptr,E_OUTOFMEMORY);});}
  IFACEMETHODIMP get_IsReadOnly(BOOL* result)noexcept override{return boundary([&]{output(result);const auto snapshot=document_->read(false);*result=snapshot->readOnly||!snapshot->enabled;});}
  /** Called only for an actual Core publication, never when a command is queued.
   * The enclosing peer remains responsible for non-text property notifications. */
  HRESULT notify(TextChanges const& changes)noexcept{return boundary([&]{
    const auto snapshot=document_->read(false);if(!UiaClientsAreListening()||!element_)return;ComPtr<IRawElementProviderSimple> element;checked(element_(&element));require(document_->isCurrent(snapshot)&&element!=nullptr,UIA_E_ELEMENTNOTAVAILABLE);
    if(changes.text){if(!snapshot->obscured)checked(UiaRaiseAutomationEvent(element.Get(),UIA_Text_TextChangedEventId));if(!document_->isCurrent(snapshot))return;AutomationVariant before,after;if(changes.previousValue)before.string(*changes.previousValue);after.string(snapshot->text);checked(UiaRaiseAutomationPropertyChangedEvent(element.Get(),UIA_ValueValuePropertyId,before.data,after.data));if(!document_->isCurrent(snapshot))return;}
    if(changes.selection&&!snapshot->obscured)checked(UiaRaiseAutomationEvent(element.Get(),UIA_Text_TextSelectionChangedEventId));
  });}
private:
  SAFEARRAY* ranges(std::vector<TextSpan> const& spans){SafeArray array(VT_UNKNOWN,spans.size());LONG index=0;for(auto const& span:spans){auto range=TextRange::create(document_,element_,span.start,span.end);array.put(index++,static_cast<ITextRangeProvider*>(range.Get()));}return array.release();}
  std::shared_ptr<TextDocument> document_;ElementResolver element_;
};
}
