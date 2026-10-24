// SPDX-License-Identifier: BSD-3-Clause
#include "SemanticsTextProvider.h"
#include <iostream>
#include <stdexcept>
#include <source_location>

using namespace Nelyx::WindowsSemantics;
using Microsoft::WRL::Make;
static void check(bool value,char const* message){if(!value)throw std::runtime_error(message);}
static void ok(HRESULT result,std::source_location location=std::source_location::current()){if(FAILED(result))throw std::runtime_error("Unexpected COM failure at line "+std::to_string(location.line())+": "+std::to_string(static_cast<unsigned long>(result)));}
static std::wstring content(ITextRangeProvider* range,int maximum=-1){BSTR text=nullptr;ok(range->GetText(maximum,&text));std::wstring result(text,SysStringLen(text));SysFreeString(text);return result;}
static size_t count(SAFEARRAY* array){LONG lower=0,upper=-1;ok(SafeArrayGetLBound(array,1,&lower));ok(SafeArrayGetUBound(array,1,&upper));return static_cast<size_t>(upper-lower+1);}
static TextSnapshot snapshot(){
  TextSnapshot value;value.generation=1;value.revision=7;value.textRevision=2;value.text=L"A\U0001f600e\u0301\n\ud55c \uae00";value.anchor=9;value.focus=6;value.focused=true;
  value.characters={0,1,3,5,6,7,8,9};value.words={0,3,6,8,9};value.lines={0,6,9};
  value.rectangles=[](int,int)->std::optional<std::vector<ScreenBox>>{return std::vector<ScreenBox>{{101,202,37,18},{100,223,42,20}};};
  value.visibleRanges=[]()->std::optional<std::vector<TextSpan>>{return std::vector<TextSpan>{{0,6},{6,9}};};
  value.hit=[](double,double)->std::optional<int>{return 3;};return value;
}
class Element final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IRawElementProviderSimple> {
public:
  IFACEMETHODIMP get_ProviderOptions(ProviderOptions* result)override{if(!result)return E_POINTER;*result=static_cast<ProviderOptions>(ProviderOptions_ServerSideProvider|ProviderOptions_UseComThreading);return S_OK;}
  IFACEMETHODIMP GetPatternProvider(PATTERNID,IUnknown** result)override{if(!result)return E_POINTER;*result=nullptr;return S_OK;}
  IFACEMETHODIMP GetPropertyValue(PROPERTYID,VARIANT* result)override{if(!result)return E_POINTER;VariantInit(result);return S_OK;}
  IFACEMETHODIMP get_HostRawElementProvider(IRawElementProviderSimple** result)override{if(!result)return E_POINTER;*result=nullptr;return S_OK;}
};
static void rangesAndQueries(){
  auto document=std::make_shared<TextDocument>();auto current=snapshot();std::vector<TextAction> commands;current.dispatch=[&](TextAction const& action){commands.push_back(action);return true;};document->publish(current);
  const auto element=Make<Element>();auto provider=TextProvider::create(document,[element](IRawElementProviderSimple** result){return element.CopyTo(result);});
  int expiredIdentity=0;auto expired=document->addRange(&expiredIdentity,0,1);expired.reset();check(boundary([&]{document->peerRange(&expiredIdentity);})==E_INVALIDARG,"An expired local identity is foreign, even if a later COM allocation reuses its address");
  ComPtr<ITextProvider> base;ok(provider.As(&base));ComPtr<ITextProvider2> second;ok(provider.As(&second));ComPtr<IValueProvider> value;ok(provider.As(&value));ComPtr<IAgileObject> agile;check(provider.As(&agile)==E_NOINTERFACE,"Text providers must remain in their owning apartment");
  ComPtr<ITextRangeProvider> full;ok(provider->get_DocumentRange(&full));check(content(full.Get())==current.text,"DocumentRange contains the entire Core text");check(content(full.Get(),2)==L"A","Truncating text must not expose half of a surrogate");check(content(full.Get(),3)==L"A\U0001f600","UTF-16 truncation admits a complete scalar");
  SAFEARRAY* selection=nullptr;ok(provider->GetSelection(&selection));check(count(selection)==1,"Single directional Core selection");ComPtr<IUnknown> selectedUnknown;LONG zero=0;ok(SafeArrayGetElement(selection,&zero,selectedUnknown.GetAddressOf()));ComPtr<ITextRangeProvider> selected;ok(selectedUnknown.As(&selected));SafeArrayDestroy(selection);check(content(selected.Get())==L"\ud55c \uae00","Backward selection normalizes its range");
  BOOL active=FALSE;ComPtr<ITextRangeProvider> caret;ok(provider->GetCaretRange(&active,&caret));check(active&&content(caret.Get()).empty(),"Focused caret range is degenerate");int difference=0;ok(caret->CompareEndpoints(TextPatternRangeEndpoint_Start,selected.Get(),TextPatternRangeEndpoint_Start,&difference));check(difference==0,"Caret follows the Core focus endpoint, not the anchor");
  ComPtr<ITextRangeProvider> clone;ok(selected->Clone(&clone));BOOL equal=FALSE;ok(clone->Compare(selected.Get(),&equal));check(equal,"Cloned ranges compare by owner and endpoints");
  int moved=0;ok(caret->MoveEndpointByUnit(TextPatternRangeEndpoint_Start,TextUnit_Character,-3,&moved));check(moved==-3&&content(caret.Get())==L"\U0001f600e\u0301\n","Character movement uses supplied grapheme stops");
  ok(caret->MoveEndpointByUnit(TextPatternRangeEndpoint_End,TextUnit_Character,-99,&moved));check(moved==-4&&content(caret.Get()).empty(),"Crossing endpoints collapses the range at the bounded destination");
  ok(caret->Move(TextUnit_Character,2,&moved));check(moved==2,"Degenerate move crosses emoji in one Core character unit");ok(caret->ExpandToEnclosingUnit(TextUnit_Character));check(content(caret.Get())==L"e\u0301","Enclosing a character respects combining graphemes");
  ok(caret->Move(TextUnit_Character,0,&moved));check(moved==0&&content(caret.Get())==L"e\u0301","Zero move cannot normalize or mutate a range");ok(caret->Move(TextUnit_Character,INT_MAX,&moved));check(moved==4&&content(caret.Get())==L"\uae00","Nonempty movement retains the last complete unit");
  ok(caret->ExpandToEnclosingUnit(TextUnit_Paragraph));check(content(caret.Get())==current.text,"Unsupported larger units fall forward to Document");
  ok(clone->ExpandToEnclosingUnit(TextUnit_Line));check(content(clone.Get())==L"\ud55c \uae00","Line units come from Core");ok(clone->ExpandToEnclosingUnit(TextUnit_Format));check(content(clone.Get())==L"\ud55c ","Unsupported Format advances to the next supported Word unit");
  BSTR needle=SysAllocString(L"a");ComPtr<ITextRangeProvider> match;ok(full->FindText(needle,FALSE,TRUE,&match));SysFreeString(needle);check(content(match.Get())==L"A","Ordinal case-insensitive text search");
  VARIANT attribute{};ok(full->GetAttributeValue(UIA_FontNameAttributeId,&attribute));check(attribute.vt==VT_UNKNOWN&&attribute.punkVal,"Unknown attributes expose UIA's reserved unsupported value");ComPtr<IUnknown> unsupported;ok(UiaGetReservedNotSupportedValue(&unsupported));check(attribute.punkVal==unsupported.Get(),"Reserved unsupported identity");VariantClear(&attribute);
  attribute.vt=VT_BOOL;attribute.boolVal=VARIANT_FALSE;match.Reset();ok(full->FindAttribute(UIA_IsReadOnlyAttributeId,attribute,FALSE,&match));check(match&&content(match.Get())==current.text,"Uniform Core readonly attribute search");
  SAFEARRAY* boxes=nullptr;ok(full->GetBoundingRectangles(&boxes));check(count(boxes)==8,"Core visible lines stay distinct screen rectangles");double left=0;ok(SafeArrayGetElement(boxes,&zero,&left));check(left==101,"No native font or ratio reconstruction");SafeArrayDestroy(boxes);
  boxes=nullptr;ComPtr<ITextRangeProvider> empty;ok(provider->RangeFromPoint({100,200},&empty));check(content(empty.Get()).empty(),"Core hit produces a degenerate range");ok(empty->GetBoundingRectangles(&boxes));check(count(boxes)==0,"Degenerate ranges have no line rectangles");SafeArrayDestroy(boxes);
  SAFEARRAY* visible=nullptr;ok(provider->GetVisibleRanges(&visible));check(count(visible)==2,"Disjoint Core visible lines are preserved");SafeArrayDestroy(visible);
  ComPtr<IRawElementProviderSimple> enclosing;ok(full->GetEnclosingElement(&enclosing));check(enclosing.Get()==element.Get(),"Text ranges return the enclosing fragment peer");
  ok(selected->Select());check(commands.back().kind==TextActionKind::SetSelection&&commands.back().revision==7&&commands.back().generation==1&&commands.back().anchor==6&&commands.back().focus==9,"UIA selection is a revision-fenced Core command");check(document->read()->anchor==9,"A queued action cannot manufacture native selection state");
  ok(full->ScrollIntoView(TRUE));check(commands.back().kind==TextActionKind::ScrollRange&&commands.back().alignToTop,"Range reveal keeps its explicit alignment");ok(provider->SetValue(L"replacement"));check(commands.back().text==L"replacement"&&document->read()->text==current.text,"Value writes wait for a subsequent actual Core snapshot");
  ok(selected->AddToSelection());check(full->AddToSelection()==UIA_E_INVALIDOPERATION&&selected->RemoveFromSelection()==UIA_E_INVALIDOPERATION,"The provider cannot invent multiple selections");
  auto foreignDocument=std::make_shared<TextDocument>();foreignDocument->publish(current);auto foreign=TextProvider::create(foreignDocument);ComPtr<ITextRangeProvider> foreignRange;ok(foreign->get_DocumentRange(&foreignRange));check(full->Compare(foreignRange.Get(),&equal)==E_INVALIDARG,"Ranges from a different Core owner cannot be compared or selected together");
  check(full->GetText(-2,nullptr)==E_POINTER&&full->Move(static_cast<TextUnit>(-1),0,&moved)==E_INVALIDARG,"COM outputs and unit enums are validated");
  HRESULT wrongThread=S_OK;std::thread other([&]{BSTR result=nullptr;wrongThread=full->GetText(-1,&result);check(result==nullptr,"Wrong-thread access must not return text");});other.join();check(wrongThread==RPC_E_WRONG_THREAD,"No cross-thread direct document reads");
}
static void lifetimeAndValidation(){
  auto document=std::make_shared<TextDocument>();auto current=snapshot();std::vector<TextAction> commands;current.dispatch=[&](TextAction const& action){commands.push_back(action);return true;};document->publish(current);auto provider=TextProvider::create(document);
  const wchar_t malformed[]={static_cast<wchar_t>(0xd800),0};check(provider->SetValue(malformed)==E_INVALIDARG&&commands.empty(),"Malformed UIA replacement text cannot escape into Core");const std::wstring oversized(TextDocument::maximumTextUnits+1,L'x');check(provider->SetValue(oversized.c_str())==E_INVALIDARG&&commands.empty(),"UIA replacements use Core's actual text budget");
  ComPtr<ITextRangeProvider> selected;BOOL active=FALSE;ok(provider->GetCaretRange(&active,&selected));ok(selected->ExpandToEnclosingUnit(TextUnit_Line));
  auto next=current;next.text=L"xx"+current.text;next.revision++;next.textRevision++;next.anchor+=2;next.focus+=2;next.characters={0,1,2,3,5,7,8,9,10,11};next.words={0,2,5,8,10,11};next.lines={0,8,11};
  const auto changes=document->publish(next);check(changes.text&&changes.selection,"Actual Core publications report text and selection changes");check(content(selected.Get())==L"\ud55c \uae00","Live ranges follow source edits before their text");
  auto invalid=next;invalid.text=std::wstring(1,static_cast<wchar_t>(0xd800));invalid.revision++;check(boundary([&]{document->publish(invalid);})==E_INVALIDARG&&document->read()->text==next.text,"Invalid UTF-16 cannot partially change the document or ranges");invalid=next;invalid.characters={0,4,11};invalid.revision++;check(boundary([&]{document->publish(invalid);})==E_INVALIDARG,"Core stop tables cannot split a scalar");
  next.readOnly=true;document->publish(next);check(provider->SetValue(L"blocked")==UIA_E_INVALIDOPERATION,"Readonly text is queryable but cannot be edited");ok(selected->Select());next.enabled=false;document->publish(next);check(provider->SetValue(L"blocked")==UIA_E_ELEMENTNOTENABLED&&selected->Select()==UIA_E_ELEMENTNOTENABLED,"Disabled Core state rejects UIA edits");
  next.enabled=true;next.readOnly=false;next.revision++;next.textRevision++;auto sameText=document->publish(next);check(sameText.text&&!sameText.selection,"Core can signal an accepted identical-text edit independently of selection changes");
  TextSnapshot password;password.generation=1;password.obscured=true;password.revision=next.revision+1;password.textRevision=next.textRevision+1;password.dispatch=current.dispatch;document->publish(password);BSTR text=nullptr;check(provider->get_Value(&text)==E_ACCESSDENIED&&text==nullptr,"Password plaintext cannot enter UIA Value");check(selected->GetText(-1,&text)==E_ACCESSDENIED&&text==nullptr,"Retained ranges cannot reveal a field after it becomes a password");ok(provider->SetValue(L"secret"));check(commands.back().text==L"secret"&&document->read(false)->text.empty(),"Password SetValue still uses a Core command without retaining plaintext in the peer");
  auto restored=snapshot();restored.revision=password.revision+1;restored.textRevision=password.textRevision+1;document->publish(restored);check(selected->GetText(-1,&text)==UIA_E_ELEMENTNOTAVAILABLE,"Ranges retired by a privacy transition never revive");
  ComPtr<ITextRangeProvider> full;ok(provider->get_DocumentRange(&full));document->retire();document->retire();check(full->GetText(-1,&text)==UIA_E_ELEMENTNOTAVAILABLE&&provider->get_Value(&text)==UIA_E_ELEMENTNOTAVAILABLE,"Node retirement closes both patterns and all retained ranges");
  auto replaced=std::make_shared<TextDocument>();replaced->publish(current);auto oldProvider=TextProvider::create(replaced);ComPtr<ITextRangeProvider> oldRange;ok(oldProvider->get_DocumentRange(&oldRange));auto owner=current;owner.generation++;
  check(boundary([&]{replaced->publish(owner);})==UIA_E_ELEMENTNOTAVAILABLE&&oldRange->GetText(-1,&text)==UIA_E_ELEMENTNOTAVAILABLE,"A different Core editing generation permanently retires this peer rather than reviving its old ranges");
}
static void geometryReentrancy(){
  auto document=std::make_shared<TextDocument>();auto current=snapshot();document->publish(current);auto provider=TextProvider::create(document);ComPtr<ITextRangeProvider> full;ok(provider->get_DocumentRange(&full));
  current.rectangles=[](int,int)->std::optional<std::vector<ScreenBox>>{return std::nullopt;};document->publish(current);SAFEARRAY* result=nullptr;check(full->GetBoundingRectangles(&result)==UIA_E_ELEMENTNOTAVAILABLE&&result==nullptr,"Missing geometry is unavailable, not a fabricated offscreen result");
  current.rectangles=[&](int,int)->std::optional<std::vector<ScreenBox>>{document->publish(current);return std::vector<ScreenBox>{{1,2,3,4}};};document->publish(current);check(full->GetBoundingRectangles(&result)==UIA_E_ELEMENTNOTAVAILABLE&&result==nullptr,"Reentrant publication invalidates the queried geometry before return");
  current.rectangles=[&](int,int)->std::optional<std::vector<ScreenBox>>{int moved=0;ok(full->MoveEndpointByUnit(TextPatternRangeEndpoint_Start,TextUnit_Character,1,&moved));return std::vector<ScreenBox>{{1,2,3,4}};};document->publish(current);check(full->GetBoundingRectangles(&result)==UIA_E_ELEMENTNOTAVAILABLE&&result==nullptr,"Reentrant range movement invalidates its old rectangle reply even without a new document publication");
  current.visibleRanges=[]()->std::optional<std::vector<TextSpan>>{return std::vector<TextSpan>{};};document->publish(current);ok(provider->GetVisibleRanges(&result));check(count(result)==0,"A committed offscreen paragraph has a real empty visible result");SafeArrayDestroy(result);result=nullptr;
  current.hit=[](double,double)->std::optional<int>{return 2;};document->publish(current);ComPtr<ITextRangeProvider> hit;check(provider->RangeFromPoint({1,2},&hit)==E_INVALIDARG&&!hit,"Malformed source hit replies cannot split a surrogate");
  current.hit=[&](double,double)->std::optional<int>{document->retire();return 0;};document->publish(current);check(provider->RangeFromPoint({1,2},&hit)==UIA_E_ELEMENTNOTAVAILABLE&&!hit,"A hit cannot escape after node retirement");
}
int main(){
  const auto initialized=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);if(FAILED(initialized))return 2;
  int result=0;try{rangesAndQueries();lifetimeAndValidation();geometryReentrancy();std::cout<<"PASS-scoped Core-fed UIA Text/Text2/Value ranges, Unicode stops, commands, privacy, retirement and reentrant geometry\n";}catch(std::exception const& error){std::cerr<<error.what()<<'\n';result=1;}catch(TextError const& error){std::cerr<<"Text failure "<<std::hex<<error.result<<'\n';result=1;}CoUninitialize();return result;
}
