// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputDocument.h"
#include "TextInputDataObject.h"
#include <msctf.h>
#include <olectl.h>
#include <textstor.h>
#include <inputscope.h>
#include <tsattrs.h>
#include <functional>
#include <memory>

namespace Nelyx::WindowsInput {
using Microsoft::WRL::ComPtr;
// SDK contract GUIDs (InputScope.h and TSAttrs.h). Local inline values keep
// header-only consumers independent of INITGUID ordering and optional GUID libs.
inline constexpr GUID inputScopeAttribute{0x1713dd5a,0x68e7,0x4a5b,{0x9a,0xf6,0x59,0x2a,0x59,0x5c,0x77,0x8d}};
inline constexpr GUID readOnlyAttribute{0x85836617,0xde32,0x4afd,{0xa5,0x0f,0xa2,0xdb,0x11,0x0e,0x6e,0x4d}};
struct TextStoreEvent {
  DocumentValue value;
  bool programmatic=false;
  std::optional<uint64_t> request;
  std::string rejection;
};
enum class KeyboardTextResult {applied,stale,busy,unavailable,limit};
struct ScreenRect : RECT {
  bool clipped=false;
  ScreenRect(RECT rect,bool clipped=false):RECT(rect),clipped(clipped){}
};
struct TextStoreCallbacks {
  // Optional cross-thread ingress fence; cleanup still runs on the UI thread.
  std::function<bool()> active;
  std::function<void(TextStoreEvent const&)> changed;
  std::function<void(std::string const&)> failed;
  // Enqueue on the owning UI dispatcher; do not execute inline.
  std::function<void(std::function<void()>)> post;
  std::function<std::optional<ScreenRect>(Rect const&,CoreGeometry const&)> screenRect;
  std::function<void(int32_t,int32_t,uint64_t,uint64_t)> characterBounds;
  std::function<void(POINT,DWORD,uint64_t,uint64_t)> hitPosition;
  std::function<HRESULT(ITfCompositionView*)> terminateComposition;
};

// The TSF endpoint is a text store, never a visual edit control. Its caller
// supplies the HWND, dispatch owner and Core geometry/position publications.
class TextInputStore final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITextStoreACP,ITfContextOwnerCompositionSink,ITfInputScope> {
public:
  TextInputStore(HWND window,Owner owner,std::wstring text,Selection selection,size_t maximumUnits,InputScope scope,TextStoreCallbacks callbacks)
      :document_(std::move(owner),std::move(text),selection,maximumUnits),window_(window),maximumUnits_(maximumUnits),scope_(scope),callbacks_(std::move(callbacks)),thread_(GetCurrentThreadId()){
    if(!IsWindow(window_)||!callbacks_.changed||!callbacks_.failed||!callbacks_.post||!callbacks_.screenRect||!callbacks_.characterBounds||!callbacks_.hitPosition||!callbacks_.terminateComposition)throw std::invalid_argument("Windows text input requires its real window and owning transports");
  }
  DocumentValue const& read()const{ui();return document_.read();}
  void inputWindow(HWND window){ui();if(!window||GetWindowThreadProcessId(window,nullptr)!=thread_)throw std::invalid_argument("TSF input window requires its actual UI owner");if(window_!=window){window_=window;screenCoordinatesChanged();}}
  void coreDocument(std::wstring text,Selection selection){ui();document_.updateCoreDocument(std::move(text),selection);}
  bool coreGeometry(CoreGeometry geometry,std::wstring text,Selection selection,uint64_t revision){ui();const auto accepted=document_.updateGeometry(std::move(geometry),std::move(text),selection,revision);if(accepted)layoutChanged();return accepted&&!closed_;}
  std::optional<CoreGeometry> geometry()const{ui();const auto frame=document_.geometry();return frame?std::optional<CoreGeometry>(*frame):std::nullopt;}
  void withdrawGeometry(){ui();document_.withdrawGeometry();hit_.reset();layoutChanged();}
  // View-logical Core boxes remain valid when the host moves. Screen-point
  // hit replies must be requested again through the new native mapping.
  void screenCoordinatesChanged(){ui();if(++coordinates_>TextInputDocument::maximumCounter)throw std::overflow_error("Text input coordinate identity exhausted");hit_.reset();layoutChanged();}
  bool characterBounds(uint64_t viewport,uint64_t epoch,uint64_t revision,int32_t start,int32_t end,std::vector<Rect> rects){ui();const auto accepted=document_.updateCharacterBounds(viewport,epoch,revision,start,end,std::move(rects));if(accepted)layoutChanged();return accepted&&!closed_;}
  bool caretBounds(uint64_t viewport,uint64_t epoch,uint64_t revision,int32_t offset,Rect rect){ui();const auto accepted=document_.updateCaretBounds(viewport,epoch,revision,offset,rect);if(accepted)layoutChanged();return accepted&&!closed_;}
  bool hitPosition(POINT point,DWORD flags,std::optional<LONG> offset,uint64_t epoch,uint64_t revision){ui();const auto geometry=document_.geometry();if(!geometry||geometry->epoch!=epoch||document_.read().revision!=revision)return false;if(offset&&!TextInputDocument::boundary(document_.read().text,*offset))throw std::invalid_argument("Invalid Core text hit position");hit_=Hit{point,flags,offset,epoch,revision};layoutChanged();return !closed_;}
  void configuration(bool enabled,bool readOnly,bool multiline,InputScope scope){
    ui();enabled_=enabled;readOnly_=readOnly;multiline_=multiline;scope_=scope;
    if(!enabled_)withdrawGeometry();
    auto sink=sink_;
    if(sink&&(sinkMask_&TS_AS_STATUS_CHANGE)&&!sinkResult(sink->OnStatusChange(TS_SD_READONLY),"TSF status notification failed"))return;
    if(!closed_&&sink&&sink_==sink&&(sinkMask_&TS_AS_ATTR_CHANGE)){const TS_ATTRID attributes[]={readOnlyAttribute,inputScopeAttribute};sinkResult(sink->OnAttrsChange(0,static_cast<LONG>(document_.read().text.size()),2,attributes),"TSF attribute notification failed");}
  }
  void focus(bool focused){ui();if(lock_){pendingFocus_=focused;return;}auto edit=document_.beginNativeEdit();edit.value().focused=focused;if(edit.commit())emit(false);}
  /** An actual printable character from the owning native key route. The
   * caller must finish Core key handling first; busy/stale never queues or
   * guesses a replacement. TSF compositions continue through TSF itself. */
  KeyboardTextResult keyboardText(std::wstring const& text,uint64_t revision){
    ComPtr<TextInputStore> keep(this);ui();
    if(text.empty()||!TextInputDocument::utf16(text)||revision>TextInputDocument::maximumCounter||std::any_of(text.begin(),text.end(),[](wchar_t unit){return unit<0x20||unit==0x7f;}))throw std::invalid_argument("Printable UTF-16 keyboard text and native revision required");
    const auto old=document_.read();if(revision!=old.revision)return KeyboardTextResult::stale;
    if(!enabled_||readOnly_||!old.focused||composition_||old.composing.active())return KeyboardTextResult::unavailable;
    if(lock_||pendingLock_||pending_||pendingFocus_||startingComposition_||terminating_||document_.editing())return KeyboardTextResult::busy;
    const auto start=std::min(old.selection.anchor,old.selection.focus),end=std::max(old.selection.anchor,old.selection.focus);
    if(text.size()>maximumUnits_-(old.text.size()-static_cast<size_t>(end-start)))return KeyboardTextResult::limit;
    {auto edit=document_.beginNativeEdit();auto& next=edit.value();next.text.replace(static_cast<size_t>(start),static_cast<size_t>(end-start),text);const auto caret=start+static_cast<int32_t>(text.size());next.selection={caret,caret};edit.commit();}
    interim_=false;const auto accepted=document_.read();auto sink=sink_;
    // Application writes notify TSF; TSF's own SetText batches do not. Keep
    // exact UTF-16 extents, and never republish a snapshot superseded by a
    // sink's reentrant Core write or native-owner retirement.
    if(sink&&(sinkMask_&TS_AS_TEXT_CHANGE)){TS_TEXTCHANGE change{start,end,start+static_cast<LONG>(text.size())};if(!sinkResult(sink->OnTextChange(0,&change),"TSF keyboard text notification failed"))return KeyboardTextResult::unavailable;}
    if(closed_||document_.read().revision!=accepted.revision)return KeyboardTextResult::applied;
    if(sink&&sink_==sink&&(sinkMask_&TS_AS_SEL_CHANGE)&&old.selection!=accepted.selection&&!sinkResult(sink->OnSelectionChange(),"TSF keyboard selection notification failed"))return KeyboardTextResult::unavailable;
    if(!closed_&&document_.read().revision==accepted.revision)emitSnapshot({accepted,false,{},{}});
    return KeyboardTextResult::applied;
  }
  void replace(std::wstring text,Selection selection,uint64_t revision,uint64_t request,bool cancel){
    ui();if(!request||request>TextInputDocument::maximumCounter)throw std::invalid_argument("Invalid Windows input request");document_.validateReplacement(text,selection);
    if(revision!=document_.read().revision){emit(true,request,"stale");return;}
    const auto serial=++commandSerial_;if(serial>TextInputDocument::maximumCounter)throw std::overflow_error("Windows input request space exhausted");
    if(pending_){const auto previous=pending_->request;pending_.reset();emit(true,previous,"stale");if(closed_)return;if(commandSerial_!=serial){emit(true,request,"stale");return;}}
    pending_=Replacement{std::move(text),selection,revision,request,cancel};settle();
  }
  // The UI owner invokes this only for the matching cancellation timer. A
  // successful TerminateComposition call is not itself a composition-end ack.
  void cancellationExpired(uint64_t request){ui();if(!pending_||pending_->request!=request||!pending_->cancel)return;if(!composition_){settle();return;}pending_.reset();emit(false);emit(true,request,"composing");}
  bool cancellationPending(uint64_t request)const{return !closed_&&pending_&&pending_->request==request&&pending_->cancel&&composition_;}
  void close(){if(GetCurrentThreadId()!=thread_)throw std::logic_error("TSF requires its owning UI thread");if(closed_)return;closed_=true;++generation_;pending_.reset();pendingFocus_.reset();draft_.reset();composition_.Reset();sink_.Reset();identity_.Reset();attributes_.clear();hit_.reset();document_.close();}

  HRESULT STDMETHODCALLTYPE AdviseSink(REFIID iid,IUnknown* unknown,DWORD mask)override{return safe([&]{if(iid!=__uuidof(ITextStoreACPSink)||!unknown)return E_INVALIDARG;ComPtr<IUnknown> identity;auto hr=unknown->QueryInterface(IID_PPV_ARGS(&identity));if(FAILED(hr))return hr;if(identity_&&identity_!=identity)return CONNECT_E_ADVISELIMIT;ComPtr<ITextStoreACPSink> sink;hr=unknown->QueryInterface(IID_PPV_ARGS(&sink));if(FAILED(hr))return hr;identity_=identity;sink_=sink;sinkMask_=mask;return S_OK;});}
  HRESULT STDMETHODCALLTYPE UnadviseSink(IUnknown* unknown)override{return safe([&]{if(!unknown)return E_INVALIDARG;ComPtr<IUnknown> identity;auto hr=unknown->QueryInterface(IID_PPV_ARGS(&identity));if(FAILED(hr))return hr;if(!identity_||identity!=identity_)return CONNECT_E_NOCONNECTION;identity_.Reset();sink_.Reset();sinkMask_=0;return S_OK;});}
  HRESULT STDMETHODCALLTYPE RequestLock(DWORD flags,HRESULT* session)override{
    if(!session)return E_INVALIDARG;*session=E_FAIL;
    return safe([&]{const auto mode=flags&~TS_LF_SYNC;if((flags&~(TS_LF_SYNC|TS_LF_READWRITE))||(mode!=TS_LF_READ&&mode!=TS_LF_READWRITE)||!sink_)return E_INVALIDARG;if(lock_){if(flags&TS_LF_SYNC){*session=TS_E_SYNCHRONOUS;return S_OK;}pendingLock_|=mode;*session=TS_S_ASYNC;return S_OK;}*session=grant(mode);return S_OK;});
  }
  HRESULT STDMETHODCALLTYPE GetStatus(TS_STATUS* status)override{return safe([&]{if(!status)return E_INVALIDARG;status->dwDynamicFlags=!enabled_||readOnly_?TS_SD_READONLY:0;status->dwStaticFlags=TS_SS_NOHIDDENTEXT|(multiline_?TS_SS_MULTILINE:0);return S_OK;});}
  HRESULT STDMETHODCALLTYPE QueryInsert(LONG start,LONG end,ULONG count,LONG* resultStart,LONG* resultEnd)override{return safe([&]{if(!resultStart||!resultEnd)return E_INVALIDARG;const auto& state=current();TextInputDocument::range(start,end,state.text);if(count>maximumUnits_-(state.text.size()-static_cast<size_t>(end-start)))return TS_E_INVALIDPOS;*resultStart=start;*resultEnd=end;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetSelection(ULONG index,ULONG count,TS_SELECTION_ACP* selection,ULONG* fetched)override{return safe([&]{if(!fetched||count&&!selection)return E_INVALIDARG;*fetched=0;if(!canRead())return TS_E_NOLOCK;if(index!=TS_DEFAULT_SELECTION&&index!=0)return TS_E_NOSELECTION;if(!count)return S_OK;const auto& state=current();selection[0]={std::min(state.selection.anchor,state.selection.focus),std::max(state.selection.anchor,state.selection.focus),{interim_?TS_AE_NONE:state.selection.focus<state.selection.anchor?TS_AE_START:TS_AE_END,interim_}};*fetched=1;return S_OK;});}
  HRESULT STDMETHODCALLTYPE SetSelection(ULONG count,TS_SELECTION_ACP const* selection)override{return safe([&]{if(count!=1||!selection)return E_INVALIDARG;if(!canWrite())return TS_E_NOLOCK;auto& state=draft_->value();TextInputDocument::range(selection->acpStart,selection->acpEnd,state.text);const auto end=selection->style.ase;if(end!=TS_AE_START&&end!=TS_AE_END&&end!=TS_AE_NONE)return E_INVALIDARG;interim_=selection->style.fInterimChar!=FALSE;state.selection=end==TS_AE_START&&!interim_?Selection{selection->acpEnd,selection->acpStart}:Selection{selection->acpStart,selection->acpEnd};return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetText(LONG start,LONG end,WCHAR* plain,ULONG plainCount,ULONG* plainFetched,TS_RUNINFO* runs,ULONG runCount,ULONG* runsFetched,LONG* next)override{return safe([&]{if(!plainFetched||!runsFetched||!next||(plainCount&&!plain)||(runCount&&!runs))return E_INVALIDARG;*plainFetched=0;*runsFetched=0;*next=start;if(!canRead())return TS_E_NOLOCK;const auto& text=current().text;if(end==-1)end=static_cast<LONG>(text.size());TextInputDocument::range(start,end,text,false);const auto available=static_cast<ULONG>(end-start),copied=plainCount?std::min(available,plainCount):runCount?available:0;if(plainCount)std::copy_n(text.data()+start,copied,plain);*plainFetched=plainCount?copied:0;if(runCount&&copied){runs[0]={copied,TS_RT_PLAIN};*runsFetched=1;}*next=start+static_cast<LONG>(copied);return S_OK;});}
  HRESULT STDMETHODCALLTYPE SetText(DWORD,LONG start,LONG end,WCHAR const* text,ULONG count,TS_TEXTCHANGE* change)override{return safe([&]{if(!change||(count&&!text))return E_INVALIDARG;if(!canWrite())return TS_E_NOLOCK;if(readOnly_)return TS_E_READONLY;return nativeText(start,end,text,count,change);});}
  HRESULT STDMETHODCALLTYPE GetFormattedText(LONG start,LONG end,IDataObject** output)override{return safe([&]{if(!output)return E_INVALIDARG;*output=nullptr;if(!canRead())return TS_E_NOLOCK;if(end==-1)end=static_cast<LONG>(current().text.size());TextInputDocument::range(start,end,current().text,false);auto object=Microsoft::WRL::Make<TextInputDataObject>(current().text.substr(static_cast<size_t>(start),static_cast<size_t>(end-start)));if(!object)return E_OUTOFMEMORY;return object.CopyTo(output);});}
  HRESULT STDMETHODCALLTYPE GetEmbedded(LONG position,REFGUID,REFIID,IUnknown** output)override{return safe([&]{if(!output)return E_INVALIDARG;*output=nullptr;if(!canRead())return TS_E_NOLOCK;TextInputDocument::range(position,position,current().text,false);return TS_E_NOOBJECT;});}
  HRESULT STDMETHODCALLTYPE QueryInsertEmbedded(GUID const*,FORMATETC const*,BOOL* insertable)override{return safe([&]{if(!insertable)return E_INVALIDARG;*insertable=FALSE;return S_OK;});}
  HRESULT STDMETHODCALLTYPE InsertEmbedded(DWORD,LONG,LONG,IDataObject*,TS_TEXTCHANGE*)override{return safe([&]{return canWrite()?TS_E_FORMAT:TS_E_NOLOCK;});}
  HRESULT STDMETHODCALLTYPE InsertEmbeddedAtSelection(DWORD,IDataObject*,LONG*,LONG*,TS_TEXTCHANGE*)override{return safe([&]{return canWrite()?TS_E_FORMAT:TS_E_NOLOCK;});}
  HRESULT STDMETHODCALLTYPE InsertTextAtSelection(DWORD flags,WCHAR const* text,ULONG count,LONG* start,LONG* end,TS_TEXTCHANGE* change)override{return safe([&]{if(flags&~(TS_IAS_QUERYONLY|TS_IAS_NOQUERY)||(flags&TS_IAS_QUERYONLY&&flags&TS_IAS_NOQUERY)||(count&&!text))return E_INVALIDARG;if(flags&TS_IAS_QUERYONLY){if(!canRead())return TS_E_NOLOCK;}else if(!canWrite())return TS_E_NOLOCK;if(!(flags&TS_IAS_NOQUERY)&&(!start||!end))return E_INVALIDARG;const auto selected=current().selection;const auto from=std::min(selected.anchor,selected.focus),to=std::max(selected.anchor,selected.focus);if(count>maximumUnits_-(current().text.size()-static_cast<size_t>(to-from)))return TS_E_INVALIDPOS;if(start)*start=from;if(end)*end=from+static_cast<LONG>(count);if(flags&TS_IAS_QUERYONLY)return S_OK;if(!change)return E_INVALIDARG;if(readOnly_)return TS_E_READONLY;return nativeText(from,to,text,count,change);});}
  HRESULT STDMETHODCALLTYPE RequestSupportedAttrs(DWORD flags,ULONG count,TS_ATTRID const* attributes)override{return safe([&]{return requestAttributes(flags,count,attributes);});}
  HRESULT STDMETHODCALLTYPE RequestAttrsAtPosition(LONG position,ULONG count,TS_ATTRID const* attributes,DWORD flags)override{return safe([&]{if(!canRead())return TS_E_NOLOCK;TextInputDocument::range(position,position,current().text,false);return requestAttributes(flags,count,attributes);});}
  HRESULT STDMETHODCALLTYPE RequestAttrsTransitioningAtPosition(LONG position,ULONG count,TS_ATTRID const* attributes,DWORD flags)override{return safe([&]{if(!canRead())return TS_E_NOLOCK;TextInputDocument::range(position,position,current().text,false);attributes_.clear();if((flags&TS_ATTR_FIND_WANT_END)?position==static_cast<LONG>(current().text.size()):position==0)return requestAttributes(flags,count,attributes);return S_OK;});}
  HRESULT STDMETHODCALLTYPE FindNextAttrTransition(LONG start,LONG halt,ULONG count,TS_ATTRID const* attributes,DWORD flags,LONG* next,BOOL* found,LONG* offset)override{return safe([&]{if(!next||!found||!offset||(count&&!attributes))return E_INVALIDARG;if(!canRead())return TS_E_NOLOCK;TextInputDocument::range(start,start,current().text,false);TextInputDocument::range(halt,halt,current().text,false);const bool backwards=(flags&TS_ATTR_FIND_BACKWARDS)!=0;if(backwards?halt>start:halt<start)return TS_E_INVALIDPOS;bool supported=count==0;for(ULONG index=0;index<count;index++)supported|=supportedAttribute(attributes[index]);const LONG boundary=backwards?0:static_cast<LONG>(current().text.size());*found=supported&&start!=boundary&&(backwards?boundary>=halt:boundary<=halt);*next=*found?boundary:halt;*offset=*found?(flags&TS_ATTR_FIND_WANT_OFFSET?boundary-start:boundary):0;return S_OK;});}
  HRESULT STDMETHODCALLTYPE RetrieveRequestedAttrs(ULONG count,TS_ATTRVAL* values,ULONG* fetched)override{return safe([&]{if(!fetched||(count&&!values))return E_INVALIDARG;*fetched=0;while(*fetched<count&&!attributes_.empty()){auto& output=values[(*fetched)++];const auto id=attributes_.front();attributes_.erase(attributes_.begin());output.idAttr=id;output.dwOverlapId=0;VariantInit(&output.varValue);if(attributeValues_){if(id==readOnlyAttribute){output.varValue.vt=VT_BOOL;output.varValue.boolVal=readOnly_||!enabled_?VARIANT_TRUE:VARIANT_FALSE;}else{output.varValue.vt=VT_UNKNOWN;output.varValue.punkVal=static_cast<ITfInputScope*>(this);output.varValue.punkVal->AddRef();}}}return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetEndACP(LONG* end)override{return safe([&]{if(!end)return E_INVALIDARG;if(!canRead())return TS_E_NOLOCK;*end=static_cast<LONG>(current().text.size());return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetActiveView(TsViewCookie* view)override{return safe([&]{if(!view)return E_INVALIDARG;*view=1;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetWnd(TsViewCookie view,HWND* window)override{return safe([&]{if(!window||view!=1)return E_INVALIDARG;*window=window_;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetScreenExt(TsViewCookie view,RECT* rect)override{return safe([&]{if(view!=1||!rect)return E_INVALIDARG;*rect={};const auto geometry=this->geometry();if(!geometry)return TS_E_NOLAYOUT;const auto revision=document_.read().revision,coordinates=coordinates_;const auto screen=callbacks_.screenRect(geometry->clip,*geometry);if(!screen||!currentGeometry(*geometry,revision,coordinates))return closed_?E_UNEXPECTED:TS_E_NOLAYOUT;*rect=*screen;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetTextExt(TsViewCookie view,LONG start,LONG end,RECT* rect,BOOL* clipped)override{return safe([&]{if(view!=1||!rect||!clipped)return E_INVALIDARG;*rect={};*clipped=FALSE;if(!canRead())return TS_E_NOLOCK;TextInputDocument::range(start,end,current().text,start==end);const auto geometry=this->geometry();if(!geometry)return TS_E_NOLAYOUT;const auto bounds=document_.textBounds(start,end);if(!bounds){callbacks_.characterBounds(start,end,geometry->epoch,document_.read().revision);return TS_E_NOLAYOUT;}const auto revision=document_.read().revision,coordinates=coordinates_;const auto screen=callbacks_.screenRect(*bounds,*geometry);if(!screen||!currentGeometry(*geometry,revision,coordinates))return closed_?E_UNEXPECTED:TS_E_NOLAYOUT;const auto clip=geometry->clip;*clipped=screen->clipped||bounds->x<clip.x||bounds->y<clip.y||bounds->x+bounds->width>clip.x+clip.width||bounds->y+bounds->height>clip.y+clip.height;*rect=*screen;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetACPFromPoint(TsViewCookie view,POINT const* point,DWORD flags,LONG* position)override{return safe([&]{if(view!=1||!point||!position||(flags&~(GXFPF_NEAREST|GXFPF_ROUND_NEAREST)))return E_INVALIDARG;if(!canRead())return TS_E_NOLOCK;const auto geometry=this->geometry();if(!geometry)return TS_E_NOLAYOUT;const auto revision=document_.read().revision,coordinates=coordinates_;if(!callbacks_.screenRect(geometry->clip,*geometry)||!currentGeometry(*geometry,revision,coordinates))return closed_?E_UNEXPECTED:TS_E_NOLAYOUT;if(hit_&&hit_->epoch==geometry->epoch&&hit_->revision==revision&&hit_->flags==flags&&hit_->point.x==point->x&&hit_->point.y==point->y){if(!hit_->position)return TS_E_INVALIDPOINT;*position=*hit_->position;return S_OK;}callbacks_.hitPosition(*point,flags,geometry->epoch,revision);return TS_E_NOLAYOUT;});}
  HRESULT STDMETHODCALLTYPE OnStartComposition(ITfCompositionView* composition,BOOL* accepted)override{return safe([&]{if(!accepted||!composition)return E_INVALIDARG;*accepted=FALSE;if(!enabled_||readOnly_||composition_)return S_OK;ComPtr<ITfRange> range;auto hr=composition->GetRange(&range);if(FAILED(hr))return hr;Composition extent;hr=compositionRange(range.Get(),extent);if(FAILED(hr))return hr;TextInputDocument::range(extent.start,extent.end,current().text);composition_=composition;startingComposition_=true;try{nativeMetadata([&](DocumentValue& state){state.composing=extent;});}catch(...){startingComposition_=false;composition_.Reset();throw;}startingComposition_=false;if(!closed_){*accepted=TRUE;if(!lock_)queueSettle();}return S_OK;});}
  HRESULT STDMETHODCALLTYPE OnUpdateComposition(ITfCompositionView* composition,ITfRange* range)override{return safe([&]{if(!sameComposition(composition))return E_INVALIDARG;if(range){Composition extent;auto hr=compositionRange(range,extent);if(FAILED(hr))return hr;nativeMetadata([&](DocumentValue& state){state.composing=extent;});}return S_OK;});}
  HRESULT STDMETHODCALLTYPE OnEndComposition(ITfCompositionView* composition)override{return safe([&]{if(!sameComposition(composition))return E_INVALIDARG;composition_.Reset();nativeMetadata([](DocumentValue& state){state.composing={};});if(!lock_)queueSettle();return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetInputScopes(InputScope** scopes,UINT* count)override{return safe([&]{if(!scopes||!count)return E_INVALIDARG;*scopes=nullptr;*count=0;auto memory=static_cast<InputScope*>(CoTaskMemAlloc(sizeof(InputScope)));if(!memory)return E_OUTOFMEMORY;*memory=scope_;*scopes=memory;*count=1;return S_OK;});}
  HRESULT STDMETHODCALLTYPE GetPhrase(BSTR** phrases,UINT* count)override{return safe([&]{if(!phrases||!count)return E_INVALIDARG;*phrases=nullptr;*count=0;return S_FALSE;});}
  HRESULT STDMETHODCALLTYPE GetRegularExpression(BSTR* state)override{return emptyInputConstraint(state);}
  HRESULT STDMETHODCALLTYPE GetSRGS(BSTR* state)override{return emptyInputConstraint(state);}
  HRESULT STDMETHODCALLTYPE GetXML(BSTR* state)override{return emptyInputConstraint(state);}
private:
  struct Replacement {std::wstring text;Selection selection;uint64_t revision,request;bool cancel;};
  struct Hit {POINT point;DWORD flags;std::optional<LONG> position;uint64_t epoch,revision;};
  bool active()const{return !callbacks_.active||callbacks_.active();}
  void ui()const{if(GetCurrentThreadId()!=thread_)throw std::logic_error("TSF requires its owning UI thread");if(closed_||!active())throw std::logic_error("Windows text store retired");}
  template<class F> HRESULT safe(F&& action)noexcept{ComPtr<TextInputStore> keep(this);if(GetCurrentThreadId()!=thread_)return RPC_E_WRONG_THREAD;try{ui();return action();}catch(std::bad_alloc const&){return E_OUTOFMEMORY;}catch(TextPositionError const&){return TS_E_INVALIDPOS;}catch(std::invalid_argument const&){return E_INVALIDARG;}catch(...){return E_UNEXPECTED;}}
  DocumentValue const& current()const{return draft_?draft_->value():document_.read();}
  bool canRead()const{return enabled_&&(lock_&TS_LF_READ)!=0;}
  bool canWrite()const{return enabled_&&(lock_&TS_LF_READWRITE)==TS_LF_READWRITE&&draft_.has_value();}
  void emitSnapshot(TextStoreEvent event){if(closed_)return;if(!active()){close();return;}try{callbacks_.changed(event);}catch(std::exception const& error){fail(error.what());throw;}catch(...){fail("Windows input observer failed");throw;}}
  void emit(bool programmatic,std::optional<uint64_t> request={},std::string rejection={}){if(!closed_)emitSnapshot({document_.read(),programmatic,request,std::move(rejection)});}
  void fail(std::string const& reason)noexcept{if(closed_)return;auto failed=callbacks_.failed;close();try{failed(reason);}catch(...){}}
  bool sinkResult(HRESULT result,char const* message){if(FAILED(result))fail(message);return !closed_;}
  bool currentGeometry(CoreGeometry const& expected,uint64_t revision,uint64_t coordinates)const{if(closed_||coordinates_!=coordinates)return false;const auto current=document_.geometry();return current&&*current==expected&&document_.read().revision==revision;}
  uint64_t coordinates_=0;
  void layoutChanged(){auto sink=sink_;if(sink&&(sinkMask_&TS_AS_LAYOUT_CHANGE))sinkResult(sink->OnLayoutChange(TS_LC_CHANGE,1),"TSF layout notification failed");}
  HRESULT nativeText(LONG start,LONG end,WCHAR const* text,ULONG count,TS_TEXTCHANGE* change){
    auto& state=draft_->value();TextInputDocument::range(start,end,state.text);if(count>maximumUnits_-(state.text.size()-static_cast<size_t>(end-start)))return TS_E_INVALIDPOS;
    auto next=state.text;next.replace(static_cast<size_t>(start),static_cast<size_t>(end-start),text?text:L"",count);if(!TextInputDocument::utf16(next))return TS_E_INVALIDPOS;
    state.text=std::move(next);const auto caret=start+static_cast<LONG>(count);state.selection={caret,caret};*change={start,end,caret};interim_=false;return S_OK;
  }
  template<class F> void nativeMetadata(F&& action){if(draft_){action(draft_->value());return;}auto edit=document_.beginNativeEdit();action(edit.value());if(edit.commit()&&!(pending_&&pending_->cancel))emit(false);}
  static HRESULT compositionRange(ITfRange* range,Composition& result){if(!range)return E_INVALIDARG;ComPtr<ITfRangeACP> acp;auto hr=range->QueryInterface(IID_PPV_ARGS(&acp));if(FAILED(hr))return hr;LONG start=0,length=0;hr=acp->GetExtent(&start,&length);if(FAILED(hr))return hr;if(start<0||length<0||start>std::numeric_limits<LONG>::max()-length)return E_INVALIDARG;result={start,start+length};return S_OK;}
  bool sameComposition(ITfCompositionView* composition)const{if(!composition||!composition_)return false;ComPtr<IUnknown> first,second;return SUCCEEDED(composition->QueryInterface(IID_PPV_ARGS(&first)))&&SUCCEEDED(composition_->QueryInterface(IID_PPV_ARGS(&second)))&&first==second;}
  HRESULT grant(DWORD flags){
    ComPtr<TextInputStore> keep(this);if(!active()){close();return E_UNEXPECTED;}auto sink=sink_;lock_=flags;HRESULT result=E_FAIL;bool changed=false;const auto previousInterim=interim_;
    try{
      if((flags&TS_LF_READWRITE)==TS_LF_READWRITE)draft_.emplace(document_.beginNativeEdit());
      result=sink->OnLockGranted(flags);
      if(!closed_&&!active())close();
      if(!closed_&&draft_){if(composition_){ComPtr<ITfRange> range;const auto hr=composition_->GetRange(&range);if(FAILED(hr))throw std::runtime_error("TSF composition range unavailable");Composition extent;const auto rangeResult=compositionRange(range.Get(),extent);if(FAILED(rangeResult))throw std::runtime_error("TSF composition extent unavailable");draft_->value().composing=extent;}changed=draft_->commit();}
    }catch(std::exception const& error){result=E_UNEXPECTED;interim_=previousInterim;fail(error.what());}catch(...){result=E_UNEXPECTED;interim_=previousInterim;fail("Windows native edit failed");}
    draft_.reset();lock_=0;
    if(!closed_)try{if(changed&&!(pending_&&pending_->cancel))emit(false);if(pendingFocus_){const auto state=*pendingFocus_;pendingFocus_.reset();focus(state);}settle();queueLock();}catch(std::exception const& error){result=E_UNEXPECTED;fail(error.what());}catch(...){result=E_UNEXPECTED;fail("Windows input publication failed");}return result;
  }
  void queueLock(){if(!pendingLock_||lockQueued_||closed_)return;lockQueued_=true;const auto generation=generation_;ComPtr<TextInputStore> keep(this);callbacks_.post([keep,generation]{if(keep->closed_||keep->generation_!=generation)return;keep->lockQueued_=false;const auto flags=std::exchange(keep->pendingLock_,0UL);if(flags&&keep->sink_)keep->grant(flags);});}
  void queueSettle(){if(!pending_||settleQueued_||closed_)return;settleQueued_=true;const auto generation=generation_;ComPtr<TextInputStore> keep(this);callbacks_.post([keep,generation]{if(keep->closed_||keep->generation_!=generation)return;keep->settleQueued_=false;keep->settle();});}
  void settle(){
    if(closed_)return;if(!active()){close();return;}if(lock_||!pending_)return;
    if(startingComposition_){queueSettle();return;}
    if(composition_&&(pending_->cancel||pending_->text!=document_.read().text)){if(!pending_->cancel){const auto request=pending_->request;pending_.reset();emit(true,request,"composing");return;}if(terminating_)return;terminating_=true;auto composition=composition_;const auto request=pending_->request;HRESULT result=E_FAIL;try{result=callbacks_.terminateComposition(composition.Get());}catch(std::exception const& error){terminating_=false;fail(error.what());return;}catch(...){terminating_=false;fail("Windows composition termination failed");return;}terminating_=false;if(FAILED(result)&&pending_&&pending_->request==request){pending_.reset();emit(false);emit(true,request,"composing");}return;}
    auto replacement=std::move(*pending_);pending_.reset();const auto old=document_.read();const auto result=!replacement.cancel&&old.composing.active()&&replacement.text==old.text?document_.replaceSelection(replacement.selection,replacement.revision):document_.replace(std::move(replacement.text),replacement.selection,replacement.cancel?old.revision:replacement.revision);
    if(result!=ReplaceResult::applied){emit(true,replacement.request,result==ReplaceResult::composing?"composing":"stale");return;}
    interim_=false;const auto accepted=document_.read();auto sink=sink_;
    if(sink){if((sinkMask_&TS_AS_TEXT_CHANGE)&&old.text!=accepted.text){TS_TEXTCHANGE change{0,static_cast<LONG>(old.text.size()),static_cast<LONG>(accepted.text.size())};if(!sinkResult(sink->OnTextChange(0,&change),"TSF text notification failed"))return;}if(!closed_&&sink_==sink&&(sinkMask_&TS_AS_SEL_CHANGE)&&old.selection!=accepted.selection&&!sinkResult(sink->OnSelectionChange(),"TSF selection notification failed"))return;}
    if(!closed_)emitSnapshot({accepted,true,replacement.request,{}});
  }
  static bool supportedAttribute(TS_ATTRID const& id){return id==readOnlyAttribute||id==inputScopeAttribute;}
  HRESULT requestAttributes(DWORD flags,ULONG count,TS_ATTRID const* attributes){if(count&&!attributes)return E_INVALIDARG;attributes_.clear();attributeValues_=(flags&TS_ATTR_FIND_WANT_VALUE)!=0;const TS_ATTRID supported[]={readOnlyAttribute,inputScopeAttribute};for(const auto& id:supported){bool requested=count==0;for(ULONG index=0;index<count;index++)requested|=attributes[index]==id;if(requested)attributes_.push_back(id);}return S_OK;}
  HRESULT emptyInputConstraint(BSTR* state){return safe([&]{if(!state)return E_INVALIDARG;*state=nullptr;return S_FALSE;});}
  TextInputDocument document_;
  HWND window_;
  size_t maximumUnits_;
  InputScope scope_;
  TextStoreCallbacks callbacks_;
  DWORD thread_,lock_=0,pendingLock_=0,sinkMask_=0;
  ComPtr<IUnknown> identity_;
  ComPtr<ITextStoreACPSink> sink_;
  ComPtr<ITfCompositionView> composition_;
  std::optional<TextInputDocument::NativeEdit> draft_;
  std::optional<Replacement> pending_;
  std::optional<bool> pendingFocus_;
  std::optional<Hit> hit_;
  std::vector<TS_ATTRID> attributes_;
  uint64_t generation_=0,commandSerial_=0;
  bool closed_=false,enabled_=true,readOnly_=false,multiline_=false,interim_=false,attributeValues_=false,lockQueued_=false,settleQueued_=false,terminating_=false,startingComposition_=false;
};
}
