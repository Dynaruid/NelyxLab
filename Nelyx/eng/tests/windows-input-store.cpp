// SPDX-License-Identifier: BSD-3-Clause
#include "TextInputStore.h"
#include "TextInputContext.h"
#include <deque>
#include <iostream>

using namespace Nelyx::WindowsInput;
void check(bool,char const*);
namespace {
void success(HRESULT result,char const* message){if(FAILED(result)){std::cerr<<message<<": 0x"<<std::hex<<static_cast<unsigned long>(result)<<std::dec<<'\n';throw std::runtime_error(message);}}
class Sink final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITextStoreACPSink> {
public:
  std::function<HRESULT(DWORD)> locked;
  std::function<void()> textChanged,statusChanged;
  std::optional<TS_TEXTCHANGE> lastTextChange;
  HRESULT textResult=S_OK,selectionResult=S_OK,layoutResult=S_OK,statusResult=S_OK,attributeResult=S_OK;
  unsigned textChanges=0,selections=0,layouts=0;
  HRESULT STDMETHODCALLTYPE OnTextChange(DWORD,TS_TEXTCHANGE const* change)override{textChanges++;if(change)lastTextChange=*change;const auto callback=textChanged;if(callback)callback();return textResult;}
  HRESULT STDMETHODCALLTYPE OnSelectionChange()override{selections++;return selectionResult;}
  HRESULT STDMETHODCALLTYPE OnLayoutChange(TsLayoutCode,TsViewCookie)override{layouts++;return layoutResult;}
  HRESULT STDMETHODCALLTYPE OnStatusChange(DWORD)override{if(statusChanged)statusChanged();return statusResult;}
  HRESULT STDMETHODCALLTYPE OnAttrsChange(LONG,LONG,ULONG,TS_ATTRID const*)override{return attributeResult;}
  HRESULT STDMETHODCALLTYPE OnLockGranted(DWORD flags)override{return locked?locked(flags):S_OK;}
  HRESULT STDMETHODCALLTYPE OnStartEditTransaction()override{return S_OK;}
  HRESULT STDMETHODCALLTYPE OnEndEditTransaction()override{return S_OK;}
};
class EditSession final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITfEditSession> {
public:
  explicit EditSession(std::function<HRESULT(TfEditCookie)> action):action_(std::move(action)){}
  HRESULT STDMETHODCALLTYPE DoEditSession(TfEditCookie cookie)override{return action_(cookie);}
private:
  std::function<HRESULT(TfEditCookie)> action_;
};
class CompositionSink final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITfCompositionSink> {
public:
  unsigned terminated=0;
  HRESULT STDMETHODCALLTYPE OnCompositionTerminated(TfEditCookie,ITfComposition*)override{terminated++;return S_OK;}
};
struct Window {
  HWND handle=nullptr;
  bool owned=true;
  explicit Window(HWND existing=nullptr):handle(existing),owned(!existing){if(existing)return;WNDCLASSW type{};type.lpfnWndProc=DefWindowProcW;type.hInstance=GetModuleHandleW(nullptr);type.lpszClassName=L"NelyxNonvisualTextStoreTest";if(!RegisterClassW(&type)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)throw std::runtime_error("Register input window");handle=CreateWindowExW(0,type.lpszClassName,L"",WS_OVERLAPPED,80,100,320,180,nullptr,nullptr,type.hInstance,nullptr);check(handle!=nullptr,"Create input window");}
  ~Window(){if(owned){if(handle)DestroyWindow(handle);UnregisterClassW(L"NelyxNonvisualTextStoreTest",GetModuleHandleW(nullptr));}}
};
struct Harness {
  Window window;
  std::deque<std::function<void()>> posts;
  std::vector<TextStoreEvent> events;
  unsigned boundsRequests=0,hitRequests=0;
  uint64_t surface=0;bool nativeClipped=false;std::function<void()> onScreenRect;
  std::vector<std::string> failures;
  std::function<void(TextStoreEvent const&)> onChanged;
  std::function<std::optional<HRESULT>(ITfCompositionView*)> onTerminate;
  ComPtr<ITfContext> context;
  ComPtr<TextInputStore> store;
  explicit Harness(HWND existing=nullptr):window(existing){TextStoreCallbacks callbacks;
    callbacks.changed=[this](TextStoreEvent const& event){events.push_back(event);if(onChanged)onChanged(event);};
    callbacks.failed=[this](std::string const& message){failures.push_back(message);};
    callbacks.post=[this](std::function<void()> callback){posts.push_back(std::move(callback));};
    callbacks.screenRect=[this](Rect const& rect,CoreGeometry const& geometry)->std::optional<ScreenRect>{if(geometry.surface!=surface)return std::nullopt;POINT origin{};if(!ClientToScreen(window.handle,&origin))return std::nullopt;if(auto reenter=std::exchange(onScreenRect,{}))reenter();return ScreenRect{RECT{origin.x+static_cast<LONG>(rect.x),origin.y+static_cast<LONG>(rect.y),origin.x+static_cast<LONG>(rect.x+rect.width),origin.y+static_cast<LONG>(rect.y+rect.height)},nativeClipped};};
    callbacks.characterBounds=[this](int32_t,int32_t,uint64_t,uint64_t){boundsRequests++;};
    callbacks.hitPosition=[this](POINT,DWORD,uint64_t,uint64_t){hitRequests++;};
    callbacks.terminateComposition=[this](ITfCompositionView* composition)->HRESULT{if(onTerminate){const auto result=onTerminate(composition);if(result)return *result;}if(!context)return E_UNEXPECTED;ComPtr<ITfContextOwnerCompositionServices> services;const auto hr=context.As(&services);return FAILED(hr)?hr:services->TerminateComposition(composition);};
    store=Microsoft::WRL::Make<TextInputStore>(window.handle,Owner{"store",1},L"first",Selection{5,5},size_t{128},IS_DEFAULT,std::move(callbacks));check(store!=nullptr,"Create TSF text store");
  }
  ~Harness(){if(store)store->close();posts.clear();}
  void drain(){for(unsigned count=0;!posts.empty()&&count<24;count++){auto callback=std::move(posts.front());posts.pop_front();callback();}check(posts.empty(),"TSF owner queue did not drain");}
};
void controlledStore(){
  Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Advise TSF sink");
  WCHAR buffer[64]{};ULONG copied=0,runs=0;LONG next=0;check(h.store->GetText(0,-1,buffer,64,&copied,nullptr,0,&runs,&next)==TS_E_NOLOCK,"Unlocked TSF read admitted");
  HRESULT session=E_FAIL;unsigned grants=0;
  sink->locked=[&](DWORD flags)->HRESULT{
    grants++;check((flags&TS_LF_READWRITE)==TS_LF_READWRITE,"Write lock downgrade");
    HRESULT nested=E_FAIL;success(h.store->RequestLock(TS_LF_SYNC|TS_LF_READ,&nested),"Nested synchronous request HRESULT");check(nested==TS_E_SYNCHRONOUS,"Reentrant synchronous lock granted");
    TS_TEXTCHANGE change{};success(h.store->SetText(0,0,5,L"\uD55c\U0001f1f0\U0001f1f7",5,&change),"TSF native SetText");check(change.acpStart==0&&change.acpOldEnd==5&&change.acpNewEnd==5,"Text change extent");
    TS_SELECTION_ACP selected{1,5,{TS_AE_START,FALSE}};success(h.store->SetSelection(1,&selected),"Directed native TSF selection");
    check(h.events.empty()&&h.store->read().text==L"first","Partial TSF write leaked");
    success(h.store->RequestLock(TS_LF_READ,&nested),"Nested asynchronous read request");check(nested==TS_S_ASYNC,"Async nested lock not queued");return S_OK;
  };
  success(h.store->RequestLock(TS_LF_READWRITE|TS_LF_SYNC,&session),"Native write lock");success(session,"Native write session");
  check(h.events.size()==1&&h.events[0].value.selection==Selection{5,1}&&h.events[0].value.text==L"\uD55c\U0001f1f0\U0001f1f7","Native TSF publication");check(sink->textChanges==0&&sink->selections==0,"Manager writes notified the manager recursively");
  ComPtr<IDataObject> formatted;
  sink->locked=[&](DWORD flags)->HRESULT{grants++;check(flags==TS_LF_READ,"Async read flags");success(h.store->GetText(0,-1,buffer,2,&copied,nullptr,0,&runs,&next),"Partial TSF text read");check(copied==2&&next==2&&buffer[0]==L'\uD55c',"Partial UTF-16 read count");success(h.store->GetFormattedText(0,5,&formatted),"Plain TSF formatted text");return S_OK;};h.drain();check(grants==2,"Async nested lock missing");
  FORMATETC format{CF_UNICODETEXT,nullptr,DVASPECT_CONTENT,-1,TYMED_HGLOBAL};STGMEDIUM medium{};success(formatted->GetData(&format,&medium),"Plain text data object");const auto text=static_cast<wchar_t const*>(GlobalLock(medium.hGlobal));check(text&&std::wstring(text)==h.store->read().text,"Formatted text came from another document");GlobalUnlock(medium.hGlobal);ReleaseStgMedium(&medium);
  h.store->replace(L"Core",{4,1},1,7,false);check(h.events.back().programmatic&&h.events.back().request==7&&sink->textChanges==1&&sink->selections==1,"Core replacement acknowledgement/TSF notifications");
  h.store->replace(L"stale",{5,5},1,8,false);check(h.events.back().rejection=="stale"&&h.store->read().text==L"Core","Stale TSF Core replacement");
  h.store->coreDocument(L"Core",{4,1});CoreGeometry geometry{{"store",1},1,9,{10,20,200,40},{10,20,160,40},{30,22,1,24},30,42};check(h.store->coreGeometry(geometry,L"Core",{4,1},2),"Core geometry install");
  sink->locked=[&](DWORD)->HRESULT{RECT rect{};BOOL clipped=FALSE;success(h.store->GetTextExt(1,1,1,&rect,&clipped),"Core TSF caret bounds");POINT origin{};ClientToScreen(h.window.handle,&origin);check(rect.left==origin.x+30&&rect.top==origin.y+22&&!clipped,"Native geometry replaced Core caret");check(h.store->GetTextExt(1,0,4,&rect,&clipped)==TS_E_NOLAYOUT&&h.boundsRequests==1,"Character bounds fabricated");LONG position=-1;const POINT point{origin.x+24,origin.y+28};check(h.store->GetACPFromPoint(1,&point,0,&position)==TS_E_NOLAYOUT&&h.hitRequests==1,"Native hit position fabricated");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Geometry read lock");success(session,"Geometry read session");
  POINT origin{};ClientToScreen(h.window.handle,&origin);const POINT point{origin.x+24,origin.y+28};check(h.store->hitPosition(point,0,2,9,2),"Core hit response");
  sink->locked=[&](DWORD)->HRESULT{LONG position=-1;success(h.store->GetACPFromPoint(1,&point,0,&position),"Core TSF hit reply");check(position==2,"Core hit reply discarded");check(h.store->GetACPFromPoint(1,&point,GXFPF_ROUND_NEAREST,&position)==TS_E_NOLAYOUT&&h.hitRequests==2,"Different TSF hit rounding reused an old reply");RECT rect{};BOOL clipped=FALSE;check(h.store->GetTextExt(1,0,0,&rect,&clipped)==TS_E_NOLAYOUT,"Arbitrary Core caret was guessed");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Hit read lock");success(session,"Hit read session");
  check(h.store->caretBounds(1,9,2,0,{12,22,1,24}),"Arbitrary Core caret reply");check(h.store->hitPosition(point,0,std::nullopt,9,2),"Core miss reply");
  sink->locked=[&](DWORD)->HRESULT{LONG position=-1;check(h.store->GetACPFromPoint(1,&point,0,&position)==TS_E_INVALIDPOINT,"Core miss was converted into a position");RECT rect{};BOOL clipped=FALSE;success(h.store->GetTextExt(1,0,0,&rect,&clipped),"Arbitrary Core caret read");check(rect.left==origin.x+12,"Arbitrary caret used the selection caret");WCHAR textRead[4]{};ULONG actual=0,run=0;LONG nextIndex=0;check(h.store->GetText(-1,2,textRead,4,&actual,nullptr,0,&run,&nextIndex)==TS_E_INVALIDPOS,"Malformed ACP range returned the wrong error");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Caret read lock");success(session,"Caret read session");
  sink->locked=[&](DWORD)->HRESULT{RECT rect{};BOOL clipped=FALSE;LONG position=-1;const auto reenter=[&]{h.store->screenCoordinatesChanged();};h.onScreenRect=reenter;check(h.store->GetScreenExt(1,&rect)==TS_E_NOLAYOUT,"Reentrant mapping change published old screen bounds");h.onScreenRect=reenter;check(h.store->GetTextExt(1,0,0,&rect,&clipped)==TS_E_NOLAYOUT,"Reentrant mapping change published an old Core caret");h.onScreenRect=reenter;check(h.store->GetACPFromPoint(1,&point,0,&position)==TS_E_NOLAYOUT,"Reentrant mapping change reused a cached hit");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Reentrant mapping lock");success(session,"Reentrant mapping session");
  h.nativeClipped=true;
  sink->locked=[&](DWORD)->HRESULT{RECT rect{};BOOL clipped=FALSE;success(h.store->GetTextExt(1,0,0,&rect,&clipped),"Native clip read");check(clipped,"Native surface clipping was lost when Core's own clip contained the caret");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Native clip lock");success(session,"Native clip session");
  h.nativeClipped=false;h.surface=8;
  sink->locked=[&](DWORD)->HRESULT{RECT rect{};BOOL clipped=FALSE;LONG position=-1;check(h.store->GetScreenExt(1,&rect)==TS_E_NOLAYOUT&&h.store->GetTextExt(1,0,0,&rect,&clipped)==TS_E_NOLAYOUT,"A replaced backing reused old Core screen geometry");check(h.store->GetACPFromPoint(1,&point,0,&position)==TS_E_NOLAYOUT,"A cached hit survived the native backing generation");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Stale backing lock");success(session,"Stale backing session");
  geometry.surface=8;geometry.epoch++;check(h.store->coreGeometry(geometry,L"Core",{4,1},2),"Current native backing frame rejected");
  h.store->configuration(true,true,false,IS_PASSWORD);sink->locked=[&](DWORD)->HRESULT{TS_TEXTCHANGE change{};check(h.store->SetText(0,0,4,L"forbidden",9,&change)==TS_E_READONLY,"ReadOnly TSF text write admitted");TS_SELECTION_ACP selected{0,4,{TS_AE_NONE,TRUE}};success(h.store->SetSelection(1,&selected),"Korean interim selection");TS_SELECTION_ACP observed{};ULONG fetched=0;success(h.store->GetSelection(TS_DEFAULT_SELECTION,1,&observed,&fetched),"Interim selection read");check(fetched==1&&observed.style.fInterimChar&&observed.style.ase==TS_AE_NONE,"Interim character state lost");return S_OK;};success(h.store->RequestLock(TS_LF_READWRITE|TS_LF_SYNC,&session),"ReadOnly native lock");success(session,"ReadOnly session");
  sink->locked=[&](DWORD)->HRESULT{success(h.store->RequestSupportedAttrs(TS_ATTR_FIND_WANT_VALUE,0,nullptr),"Supported TSF attributes");TS_ATTRVAL attribute{};ULONG fetched=0;success(h.store->RetrieveRequestedAttrs(1,&attribute,&fetched),"ReadOnly TSF attribute");check(fetched==1&&attribute.idAttr==readOnlyAttribute&&attribute.varValue.vt==VT_BOOL&&attribute.varValue.boolVal==VARIANT_TRUE,"ReadOnly attribute value");VariantClear(&attribute.varValue);success(h.store->RetrieveRequestedAttrs(1,&attribute,&fetched),"InputScope TSF attribute");check(fetched==1&&attribute.idAttr==inputScopeAttribute&&attribute.varValue.vt==VT_UNKNOWN,"InputScope attribute value");ComPtr<ITfInputScope> inputScope;success(attribute.varValue.punkVal->QueryInterface(IID_PPV_ARGS(&inputScope)),"Input scope object identity");VariantClear(&attribute.varValue);return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Attribute read lock");success(session,"Attribute read session");
  InputScope* scopes=nullptr;UINT scopeCount=0;success(h.store->GetInputScopes(&scopes,&scopeCount),"TSF input scope");check(scopeCount==1&&scopes[0]==IS_PASSWORD,"Secure Core input scope lost");CoTaskMemFree(scopes);
  h.store->configuration(false,true,false,IS_PASSWORD);sink->locked=[&](DWORD)->HRESULT{check(h.store->GetText(0,-1,buffer,64,&copied,nullptr,0,&runs,&next)==TS_E_NOLOCK,"Disabled TSF connection read the document");return S_OK;};success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&session),"Disabled read lock");success(session,"Disabled read session");
  h.store->close();check(h.store->GetText(0,-1,buffer,64,&copied,nullptr,0,&runs,&next)==E_UNEXPECTED,"Retired TSF connection read current text");
  check(h.failures.empty(),"Native store silently failed an admitted edit");
}
void reentrantRetirement(){
  {Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Retirement sink");sink->textChanged=[&]{h.store->close();};h.store->replace(L"Core",{4,4},0,1,false);check(h.events.empty()&&sink->selections==0,"Retired Core command emitted a completion");}
  {Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Status retirement sink");sink->statusChanged=[&]{h.store->close();};h.store->configuration(true,true,false,IS_PASSWORD);TS_STATUS status{};check(h.store->GetStatus(&status)==E_UNEXPECTED,"Status callback did not retire its owner");}
  {Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Coalescing sink");h.onChanged=[&](TextStoreEvent const& event){if(event.request==1&&event.rejection=="stale")h.store->replace(L"newest",{6,6},0,3,false);};sink->locked=[&](DWORD)->HRESULT{h.store->replace(L"old",{3,3},0,1,false);h.store->replace(L"middle",{6,6},0,2,false);return S_OK;};HRESULT session=E_FAIL;success(h.store->RequestLock(TS_LF_READWRITE|TS_LF_SYNC,&session),"Reentrant Core queue");success(session,"Reentrant Core queue session");check(h.store->read().text==L"newest"&&h.events.back().request==3&&h.events.back().rejection.empty(),"An older reentrant Core write replaced the latest command");}
  {Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Observer retirement sink");h.onChanged=[](TextStoreEvent const&){throw std::runtime_error("observer failure");};sink->locked=[&](DWORD)->HRESULT{TS_TEXTCHANGE change{};return h.store->SetText(0,0,5,L"Native",6,&change);};HRESULT session=E_FAIL;success(h.store->RequestLock(TS_LF_READWRITE|TS_LF_SYNC,&session),"Failing observer request");check(session==E_UNEXPECTED&&h.failures.size()==1,"Observer failure was hidden");TS_STATUS status{};check(h.store->GetStatus(&status)==E_UNEXPECTED,"Failed observer left native input live");}
}
void keyboardText(){
  Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Keyboard text sink");
  check(h.store->keyboardText(L"x",0)==KeyboardTextResult::unavailable&&h.events.empty(),"An unfocused store accepted keyboard text");
  h.store->focus(true);h.store->replace(L"AxxB",{3,1},h.store->read().revision,100,false);const auto revision=h.store->read().revision;h.events.clear();sink->textChanges=0;sink->selections=0;
  check(h.store->keyboardText(L"\uD55c\U0001f600",revision)==KeyboardTextResult::applied,"Actual UTF-16 keyboard text was not committed");
  check(h.store->read().text==L"A\uD55c\U0001f600B"&&h.store->read().selection==Selection{4,4}&&h.store->read().revision==revision+1,"Keyboard text did not atomically replace the directed selection");
  check(h.events.size()==1&&!h.events[0].programmatic&&!h.events[0].request&&h.events[0].value.text==h.store->read().text,"Keyboard text became a Core command acknowledgement");
  check(sink->textChanges==1&&sink->selections==1&&sink->lastTextChange&&sink->lastTextChange->acpStart==1&&sink->lastTextChange->acpOldEnd==3&&sink->lastTextChange->acpNewEnd==4,"TSF keyboard text notifications lost their UTF-16 extents");
  const auto stable=h.store->read();h.events.clear();check(h.store->keyboardText(L"late",revision)==KeyboardTextResult::stale&&h.store->read().text==stable.text&&h.events.empty(),"Stale keyboard text overwrote a newer native document");
  for(auto text:{std::wstring(1,wchar_t{0xd800}),std::wstring(L"\r"),std::wstring(L"\t"),std::wstring(L"\x7f"),std::wstring{}}){bool invalid=false;try{h.store->keyboardText(text,stable.revision);}catch(std::invalid_argument const&){invalid=true;}check(invalid&&h.store->read().text==stable.text&&h.events.empty(),"Malformed/control keyboard text changed the document");}
  h.store->configuration(true,true,false,IS_TEXT);check(h.store->keyboardText(L"x",stable.revision)==KeyboardTextResult::unavailable,"Readonly keyboard text was committed");h.store->configuration(false,false,false,IS_TEXT);check(h.store->keyboardText(L"x",stable.revision)==KeyboardTextResult::unavailable,"Disabled keyboard text was committed");h.store->configuration(true,false,false,IS_TEXT);
  check(h.store->keyboardText(std::wstring(129,L'x'),stable.revision)==KeyboardTextResult::limit&&h.events.empty(),"Over-budget keyboard text was committed or acknowledged");
  sink->locked=[&](DWORD)->HRESULT{check(h.store->keyboardText(L"busy",h.store->read().revision)==KeyboardTextResult::busy&&h.store->read().text==stable.text&&h.events.empty(),"Keyboard text escaped a held TSF lock");return S_OK;};HRESULT result=E_FAIL;success(h.store->RequestLock(TS_LF_READ|TS_LF_SYNC,&result),"Keyboard held lock");success(result,"Keyboard held lock session");
  check(h.store->keyboardText(L"!",h.store->read().revision)==KeyboardTextResult::applied,"Keyboard retry did not commit after TSF unlock");
  h.events.clear();sink->textChanged=[&]{sink->textChanged={};h.store->replace(L"newer Core",{10,10},h.store->read().revision,101,false);};check(h.store->keyboardText(L"?",h.store->read().revision)==KeyboardTextResult::applied,"Reentrant keyboard transaction failed");
  check(h.events.size()==1&&h.events[0].programmatic&&h.events[0].request==101&&h.events[0].value.text==L"newer Core"&&h.store->read().text==L"newer Core","A superseded keyboard snapshot overwrote its reentrant Core edit");
  h.events.clear();sink->textResult=E_FAIL;check(h.store->keyboardText(L"x",h.store->read().revision)==KeyboardTextResult::unavailable&&h.failures.size()==1&&h.events.empty(),"Failed keyboard sink notification acknowledged editing content");
}
void sinkFailures(){
  for(unsigned kind=0;kind<5;kind++){
    Harness h;auto sink=Microsoft::WRL::Make<Sink>();success(h.store->AdviseSink(__uuidof(ITextStoreACPSink),sink.Get(),TS_AS_ALL_SINKS),"Failure notification sink");
    if(kind==0){sink->textResult=E_FAIL;h.store->replace(L"Core",{4,4},0,1,false);}
    if(kind==1){sink->selectionResult=E_FAIL;h.store->replace(L"first",{1,3},0,1,false);}
    if(kind==2){sink->layoutResult=E_FAIL;h.store->coreDocument(L"first",{5,5});check(!h.store->coreGeometry(CoreGeometry{{"store",1},1,1,{0,0,100,40},{0,0,100,40},{20,0,1,24},20,20},L"first",{5,5},0),"A failed layout notification reported current geometry");}
    if(kind==3){sink->statusResult=E_FAIL;h.store->configuration(true,true,false,IS_DEFAULT);}
    if(kind==4){sink->attributeResult=E_FAIL;h.store->configuration(true,true,false,IS_PASSWORD);}
    TS_STATUS status{};check(h.failures.size()==1&&h.events.empty()&&h.store->GetStatus(&status)==E_UNEXPECTED,"A failed TSF sink remained live or completed a Core command");
  }
}
void actualContext(){
  Harness h;auto thread=TextInputThread::create();auto input=thread->attach(h.window.handle,h.store.Get());h.context=input->context();const auto client=thread->clientId();
  try {
    ComPtr<ITfComposition> composition;auto compositionSink=Microsoft::WRL::Make<CompositionSink>();
    auto edit=Microsoft::WRL::Make<EditSession>([&](TfEditCookie cookie)->HRESULT{
      ComPtr<ITfRange> range,end;auto hr=h.context->GetStart(cookie,&range);if(FAILED(hr))return hr;hr=h.context->GetEnd(cookie,&end);if(FAILED(hr))return hr;hr=range->ShiftEndToRange(cookie,end.Get(),TF_ANCHOR_END);if(FAILED(hr))return hr;hr=range->SetText(cookie,0,L"\uD55c",1);if(FAILED(hr))return hr;
      ComPtr<ITfContextComposition> composing;hr=h.context.As(&composing);if(FAILED(hr))return hr;hr=composing->StartComposition(cookie,range.Get(),compositionSink.Get(),&composition);if(FAILED(hr))return hr;
      TF_SELECTION selection{range.Get(),{TF_AE_START,FALSE}};return h.context->SetSelection(cookie,1,&selection);
    });HRESULT session=E_FAIL;success(h.context->RequestEditSession(client,edit.Get(),TF_ES_SYNC|TF_ES_READWRITE,&session),"Actual TSF edit session request");success(session,"Actual TSF edit session");
    check(composition&&h.store->read().text==L"\uD55c"&&h.store->read().composing==Composition{0,1},"Actual TSF composition did not reach Core shadow state");
    const auto compositionOwner=composition.Get();h.store->replace(h.store->read().text,{1,0},h.store->read().revision,14,false);
    check(composition.Get()==compositionOwner&&compositionSink->terminated==0&&h.store->read().composing==Composition{0,1}&&h.store->read().selection==Selection{1,0}&&h.events.back().programmatic&&h.events.back().request==14&&h.events.back().rejection.empty(),"A Core selection command must preserve the actual TSF composition and acknowledge directed selection");
    h.onTerminate=[](ITfCompositionView*)->std::optional<HRESULT>{return S_OK;};const auto failedStart=h.events.size();h.store->replace(L"",{0,0},h.store->read().revision,16,true);check(h.events.size()==failedStart&&h.store->cancellationPending(16)&&!h.store->cancellationPending(15),"Termination HRESULT fabricated an end acknowledgement");h.store->cancellationExpired(15);check(h.events.size()==failedStart,"Unrelated cancellation timer changed the command");h.store->cancellationExpired(16);check(h.store->read().composing.active()&&h.events.back().request==16&&h.events.back().rejection=="composing","Cancellation timeout completed or cleared an active composition");
    h.onTerminate=[&](ITfCompositionView* compositionView)->std::optional<HRESULT>{return input->terminateComposition(compositionView);};ComPtr<ITfCompositionView> view;success(composition.As(&view),"Actual late composition view");success(input->terminateComposition(view.Get()),"Actual late termination");h.drain();composition.Reset();view.Reset();
    success(h.context->RequestEditSession(client,edit.Get(),TF_ES_SYNC|TF_ES_READWRITE,&session),"Actual TSF second composition request");success(session,"Actual TSF second composition");
    const auto before=h.events.size();h.store->replace(L"",{0,0},h.store->read().revision,17,true);
    for(unsigned attempt=0;attempt<24&&(h.store->cancellationPending(17)||h.events.size()==before);attempt++){h.drain();MSG message{};for(unsigned index=0;index<24&&PeekMessageW(&message,nullptr,0,0,PM_REMOVE);index++){TranslateMessage(&message);DispatchMessageW(&message);}if(h.store->cancellationPending(17)||h.events.size()==before)MsgWaitForMultipleObjectsEx(0,nullptr,100,QS_ALLINPUT,MWMO_INPUTAVAILABLE);}
    h.drain();check(compositionSink->terminated==2&&!h.store->read().composing.active()&&h.store->read().text.empty(),"Actual TSF composition cancellation did not complete");check(h.events.back().programmatic&&h.events.back().request==17&&h.events.back().rejection.empty(),"Core replacement acknowledged before real TSF completion");check(h.failures.empty(),"Actual TSF context failed");
    composition.Reset();h.context.Reset();input->close();input->close();thread->close();h.store->close();
  }catch(...){h.context.Reset();input->close();thread->close();throw;}
}
void contextLifetimes(){
  Harness first;Harness second(first.window.handle);auto thread=TextInputThread::create();ComPtr<ITfDocumentMgr> original,previous;success(thread->manager()->CreateDocumentMgr(&original),"Create preceding TSF association");success(thread->manager()->AssociateFocus(first.window.handle,original.Get(),&previous),"Set preceding TSF association");
  auto a=thread->attach(first.window.handle,first.store.Get()),b=thread->attach(first.window.handle,second.store.Get());
  bool rejected=false;try{thread->close();}catch(std::logic_error const&){rejected=true;}check(rejected,"TSF owner deactivated with live contexts");
  SetFocus(first.window.handle);check(GetFocus()==first.window.handle,"Fixture did not obtain native window focus");a->associateFocus();ComPtr<ITfDocumentMgr> focused;success(thread->manager()->GetFocus(&focused),"Read first TSF focus");check(focused.Get()==a->document(),"First TSF context did not own focused window");
  b->associateFocus();a->close();success(thread->manager()->GetFocus(&focused),"Read replacement TSF focus");check(focused.Get()==b->document(),"Old TSF context retirement detached the replacement");
  b->withdrawFocus();success(thread->manager()->GetFocus(&focused),"Read restored TSF focus");check(focused.Get()==original.Get(),"Original TSF window association was not restored");b->associateFocus();
  MSG message{};message.hwnd=first.window.handle;message.message=WM_CHAR;message.wParam=L'x';check(!thread->filterKeyMessage(message),"A character bypassed the host's input route");message.message=WM_KEYDOWN;message.hwnd=nullptr;check(!thread->filterKeyMessage(message),"A foreign window key reached this TSF owner");
  message.hwnd=first.window.handle;message.message=WM_KEYDOWN;message.wParam=VK_F24;message.lParam=1;check(!thread->filterKeyMessage(message),"An unhandled actual TSF key was consumed");message.message=WM_KEYUP;check(!thread->filterKeyMessage(message),"An unhandled actual TSF key-up was consumed");
  success(thread->manager()->SetFocus(original.Get()),"Set foreign TSF key focus");message.message=WM_KEYDOWN;check(!thread->filterKeyMessage(message),"A foreign TSF document received an owned-window key");b->associateFocus();
  std::exception_ptr wrongThread;std::thread other([&]{try{thread->clientId();}catch(...){wrongThread=std::current_exception();}});other.join();check(wrongThread!=nullptr,"Foreign UI thread reached TSF owner");
  ComPtr<ITfDocumentMgr> external,displaced;success(thread->manager()->CreateDocumentMgr(&external),"Create external TSF association");success(thread->manager()->AssociateFocus(first.window.handle,external.Get(),&displaced),"Replace owned association externally");b->close();success(thread->manager()->GetFocus(&focused),"Read preserved external TSF focus");check(focused.Get()==external.Get(),"Retirement overwrote an external TSF association");displaced.Reset();
  rejected=false;try{b->context();}catch(std::logic_error const&){rejected=true;}check(rejected,"Retired TSF context remained readable");first.store->close();second.store->close();a.reset();b.reset();success(thread->manager()->AssociateFocus(first.window.handle,previous.Get(),&focused),"Restore fixture's initial association");focused.Reset();external.Reset();original.Reset();previous.Reset();
  {Harness destroyed;auto context=thread->attach(destroyed.window.handle,destroyed.store.Get());context->associateFocus();DestroyWindow(destroyed.window.handle);destroyed.window.handle=nullptr;context->close();destroyed.store->close();}
  thread->close();thread->close();
}
}
void textStoreChecks(){
  success(CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED),"Initialize TSF test apartment");try{controlledStore();reentrantRetirement();keyboardText();sinkFailures();actualContext();contextLifetimes();}catch(...){CoUninitialize();throw;}CoUninitialize();
  std::cout<<"PASS-scoped: actual ITextStoreACP locks and UTF-16 IO, printable shadow writes with stale/lock/focus/readonly/budget guards and reentrant sink ownership, Korean interim selection, supplied Core geometry/hit replies, readonly/secure/disabled/retired contracts, observer/sink failure retirement, reentrant writes, timeout/late finish, real TSF context composition/termination, focus association replacement/restoration and unhandled/foreign-focus key pass-through. RNW/testbed/physical IME remain notVerified.\n";
}
