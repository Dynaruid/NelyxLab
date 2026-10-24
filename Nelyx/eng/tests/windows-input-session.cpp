// SPDX-License-Identifier: BSD-3-Clause
#include <TextInputSession.h>
#include <TextInputSkiaSurface.h>
#include <Microsoft.UI.Dispatching.Interop.h>
#include <winrt/Microsoft.UI.Input.h>
#include <chrono>
#include <iostream>
#include <tuple>
#include <thread>

using namespace Nelyx::WindowsInput;
namespace {
void check(bool value,char const* message){if(!value)throw std::runtime_error(message);}
void hr(HRESULT result,char const* message){if(FAILED(result)){std::cerr<<message<<" 0x"<<std::hex<<static_cast<unsigned long>(result)<<std::dec<<'\n';throw std::runtime_error(message);}}
template<class F> void pump(F ready){
  const auto end=std::chrono::steady_clock::now()+std::chrono::seconds(5);
  while(!ready()){
    if(std::chrono::steady_clock::now()>end)throw std::runtime_error("Native session observation timed out");
    MSG message{};if(PeekMessageW(&message,nullptr,0,0,PM_REMOVE)){if(!ContentPreTranslateMessage(&message)){TranslateMessage(&message);DispatchMessageW(&message);}}else MsgWaitForMultipleObjectsEx(0,nullptr,50,QS_ALLINPUT,MWMO_INPUTAVAILABLE);
  }
}
class Edit final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITfEditSession> {
public:
  explicit Edit(std::function<HRESULT(TfEditCookie)> action):action(std::move(action)){}
  HRESULT STDMETHODCALLTYPE DoEditSession(TfEditCookie cookie)override{try{return action(cookie);}catch(std::exception const& error){message=error.what();return E_UNEXPECTED;}}
  std::function<HRESULT(TfEditCookie)> action;
  std::string message;
};
class CompositionObserver final : public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITfCompositionSink> {
public:
  unsigned ended=0;
  HRESULT STDMETHODCALLTYPE OnCompositionTerminated(TfEditCookie,ITfComposition*)override{ended++;return S_OK;}
};
void edit(ITfContext* context,TfClientId client,bool write,std::function<HRESULT(TfEditCookie)> action){
  auto request=Microsoft::WRL::Make<Edit>(std::move(action));HRESULT result=E_FAIL;hr(context->RequestEditSession(client,request.Get(),TF_ES_SYNC|(write?TF_ES_READWRITE:TF_ES_READ),&result),"Request session edit");hr(result,request->message.empty()?"Session edit failed":request->message.c_str());
}
Microsoft::WRL::ComPtr<ITfRange> range(ITfContext* context,TfEditCookie cookie,LONG start,LONG end){
  Microsoft::WRL::ComPtr<ITfRange> value;hr(context->GetStart(cookie,&value),"Get session range");Microsoft::WRL::ComPtr<ITfRangeACP> acp;hr(value.As(&acp),"Get session ACP range");hr(acp->SetExtent(start,end-start),"Set session range");return value;
}
}
void testWindowsInputSession(winrt::Microsoft::UI::Content::ContentIsland const& island,winrt::Microsoft::UI::Content::DesktopChildSiteBridge const& bridge,HWND inputWindow){
  {
    const auto converter=island.CoordinateConverter();TextInputSurfaceProjection map{25,17,{35,25,60,30},true};CoreGeometry frame;frame.clip={0,0,200,100};
    // This fixture's desktop island is axis aligned at an integer HWND origin.
    // Check outward physical bounds independently of the default Rect overload,
    // whose truncation cannot be the expected value at a fractional DPI.
    const auto origin=converter.ConvertLocalToScreen(winrt::Windows::Foundation::Point{0,0});const double scale=island.RasterizationScale();
    const auto rect=map.screenRect(converter,{5,10,80,20},frame);
    check(rect.clipped&&rect.left==std::floor(origin.X+35*scale)&&rect.top==std::floor(origin.Y+27*scale)&&rect.right==std::ceil(origin.X+95*scale)&&rect.bottom==std::ceil(origin.Y+47*scale),"Native surface clip/origin did not enclose the actual fractional-DPI screen bounds");
    frame.clip={15,12,20,10};const auto core=map.screenRect(converter,{5,10,80,20},frame);check(core.clipped&&core.left==std::floor(origin.X+40*scale)&&core.right==std::ceil(origin.X+60*scale)&&core.top==std::floor(origin.Y+29*scale)&&core.bottom==std::ceil(origin.Y+39*scale),"Core clip was lost while applying native clipping");frame.clip={0,0,200,100};
    const auto offscreen=map.screenRect(converter,{100,100,20,10},frame);check(offscreen.clipped&&offscreen.left==0&&offscreen.top==0&&offscreen.right==0&&offscreen.bottom==0,"Known offscreen text did not return an empty clipped screen rectangle");
    const auto caret=map.screenRect(converter,{15,10,0,20},frame);check(!caret.clipped&&caret.right>=caret.left&&caret.right-caret.left<=1&&caret.bottom>caret.top,"A visible zero-width Core caret was mistaken for invisible text");
    const auto fractional=map.screenRect(converter,{15.25,10.25,.1,.1},frame);check(fractional.right>fractional.left&&fractional.bottom>fractional.top,"Default truncation erased a visible fractional Core rectangle instead of enclosing its screen pixels");check(!fractional.clipped,"Floating-point intersection marked an entirely visible fractional rectangle as clipped");
    const auto screen=converter.ConvertLocalToScreen(winrt::Windows::Foundation::Point{100,30});const POINT outside{screen.X,screen.Y};check(map.viewPoint(converter,outside,GXFPF_ROUND_NEAREST,frame).outside,"Rounding admitted a point outside the native clip");const auto nearest=map.viewPoint(converter,outside,GXFPF_NEAREST,frame);check(!nearest.outside&&std::abs(nearest.x-75)<=1&&std::abs(nearest.y-13)<=1,"Nearest hit lost the real native screen-to-View mapping");
    map.visible=false;const auto hidden=map.screenRect(converter,{15,10,1,20},frame);check(hidden.clipped&&hidden.left==0&&hidden.bottom==0&&map.viewPoint(converter,outside,GXFPF_NEAREST,frame).outside,"Hidden native text retained screen geometry or an invented nearest hit");
  }
  auto root=TextInputRoot::create(island,inputWindow,[](std::string const& message){throw std::runtime_error(message);});const auto client=root->thread()->clientId();
  std::vector<TextStoreEvent> values;std::vector<std::string> failures;std::vector<TextInputHitRequest> hits;std::vector<std::tuple<int32_t,int32_t,uint64_t,uint64_t>> bounds;
  bool outside=false,mappingReentry=false;size_t coordinateChanges=0;TextInputRoot::ClientId coordinateClient=0;coordinateClient=root->registerClient([&](std::string const&){root->unregisterClient(coordinateClient);},[&]{coordinateChanges++;});
  std::shared_ptr<TextInputSession> session;bool closeOnChange=false,throwOnChange=false,supersedeOnStale=false;
  const auto callbacks=[&]{TextInputSessionCallbacks value;
    value.changed=[&](TextStoreEvent const& event){values.push_back(event);if(throwOnChange)throw std::runtime_error("controlled session observer failure");if(closeOnChange)session->close();if(supersedeOnStale&&event.request==44&&event.rejection=="stale"){supersedeOnStale=false;session->replace(L"nested",{6,6},event.value.revision,46,true);}};value.failed=[&](std::string const& message){failures.push_back(message);};
    value.screenRect=[&](Rect const& rect,CoreGeometry const&)->std::optional<ScreenRect>{const auto screen=island.CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Rect{float(rect.x),float(rect.y),float(rect.width),float(rect.height)});return RECT{screen.X,screen.Y,screen.X+screen.Width,screen.Y+screen.Height};};
    value.viewPoint=[&](POINT point,DWORD,CoreGeometry const&)->std::optional<ViewPoint>{const auto view=island.CoordinateConverter().ConvertScreenToLocal(winrt::Windows::Graphics::PointInt32{point.x,point.y});if(mappingReentry){mappingReentry=false;session->screenCoordinatesChanged();}return ViewPoint{view.X,view.Y,outside};};
    value.characterBounds=[&](int32_t start,int32_t end,uint64_t epoch,uint64_t revision){bounds.emplace_back(start,end,epoch,revision);};value.hitPosition=[&](TextInputHitRequest const& request){hits.push_back(request);};
    value.focusSurface=[&]{return winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(island).TrySetFocus();};return value;
  };
  session=TextInputSession::create(root,Owner{"session",4},L"seed",Selection{4,4},128,IS_DEFAULT,std::chrono::milliseconds(50),callbacks());check(session->focus()&&session->read().focused,"Session did not focus the real input surface");
  check(session->keyboardText(L"\uD55c\U0001f600",session->read().revision)==KeyboardTextResult::applied&&session->read().text==L"seed\uD55c\U0001f600"&&!values.back().programmatic,"Actual focused TSF session did not observe printable UTF-16 text");
  session->configuration(true,true,false,IS_TEXT);const auto readonlyText=session->read().text;check(session->keyboardText(L"x",session->read().revision)==KeyboardTextResult::unavailable&&session->read().text==readonlyText,"Readonly actual TSF session accepted printable text");session->configuration(true,false,false,IS_TEXT);
  session->blur();check(session->keyboardText(L"x",session->read().revision)==KeyboardTextResult::unavailable,"Blurred actual TSF session accepted printable text");check(session->focus(),"Printable text focus restoration failed");
  session->configuration(false,false,false,IS_TEXT);check(!session->read().focused&&!values.empty()&&!values.back().value.focused,"Disabling the native input context did not publish its actual focus withdrawal");check(!session->focus(),"A disabled native context regained focus");
  session->configuration(true,false,false,IS_TEXT);check(!session->read().focused,"Re-enabling fabricated an OS focus restoration");check(session->focus()&&session->read().focused,"A new explicit focus request did not restore the native context");
  session->replace(L"seed",{4,4},session->read().revision,39,false);check(session->read().text==L"seed"&&session->read().selection==Selection{4,4},"Core command did not restore the printable-text fixture document");session->coreDocument(L"seed",{4,4});const auto revision=session->read().revision;
  check(session->geometry(CoreGeometry{{"session",4},1,1,{0,0,200,60},{0,0,200,60},{55,20,1,24},55,40},L"seed",{4,4},revision),"Session did not accept its current Core frame");
  Microsoft::WRL::ComPtr<ITfContext> context=session->context();Microsoft::WRL::ComPtr<ITfContextView> view;hr(context->GetActiveView(&view),"Get native context view");
  edit(context.Get(),client,false,[&](TfEditCookie cookie){RECT rect{};BOOL clipped=FALSE;const auto at=range(context.Get(),cookie,1,1);check(view->GetTextExt(cookie,at.Get(),&rect,&clipped)==TS_E_NOLAYOUT,"Arbitrary caret was fabricated before Core replied");return S_OK;});
  check(!bounds.empty()&&bounds.back()==std::tuple<int32_t,int32_t,uint64_t,uint64_t>{1,1,1,revision},"Caret request lost Core epoch/native revision");
  const Rect caret{21,20,1,24};check(session->caretBounds(1,1,revision,1,caret),"Current Core caret reply rejected");
  edit(context.Get(),client,false,[&](TfEditCookie cookie){RECT rect{};BOOL clipped=FALSE;const auto at=range(context.Get(),cookie,1,1);hr(view->GetTextExt(cookie,at.Get(),&rect,&clipped),"Read supplied Core caret");const auto expected=callbacks().screenRect(caret,{});check(rect.left==expected->left&&rect.top==expected->top&&rect.bottom==expected->bottom,"Native mapping replaced the Core caret");return S_OK;});
  const auto screen=island.CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Point{25,30});const POINT point{screen.X,screen.Y};
  const auto queryHit=[&]{edit(context.Get(),client,false,[&](TfEditCookie cookie){Microsoft::WRL::ComPtr<ITfRange> at;check(view->GetRangeFromPoint(cookie,&point,GXFPF_ROUND_NEAREST,&at)==TS_E_NOLAYOUT,"Native hit was fabricated before Core replied");return S_OK;});};
  mappingReentry=true;const auto beforeMappingReentry=hits.size();queryHit();check(hits.size()==beforeMappingReentry,"A reentrant screen mapping emitted a point under the wrong native mapping generation");
  queryHit();check(!hits.empty()&&hits.back().epoch==1&&hits.back().revision==revision,"Hit request lost its document/frame identity");const auto old=hits.back();const auto coordinateBefore=coordinateChanges;bridge.MoveAndResize({0,0,340,200});pump([&]{return coordinateChanges>coordinateBefore;});check(!session->hitPosition(old.request,1,1,revision),"A hit reply survived a changed native screen mapping");queryHit();const auto current=hits.back();check(current.request>old.request,"Native hit identity was reused");check(session->hitPosition(current.request,1,1,revision),"Current Core hit reply rejected");
  edit(context.Get(),client,false,[&](TfEditCookie cookie){Microsoft::WRL::ComPtr<ITfRange> at;hr(view->GetRangeFromPoint(cookie,&point,GXFPF_ROUND_NEAREST,&at),"Read supplied Core hit");Microsoft::WRL::ComPtr<ITfRangeACP> acp;hr(at.As(&acp),"Read hit ACP");LONG start=0,length=0;hr(acp->GetExtent(&start,&length),"Read hit extent");check(start==1&&length==0,"Native hit changed the supplied Core UTF-16 position");return S_OK;});
  outside=true;session->screenCoordinatesChanged();const auto hitCount=hits.size();queryHit();check(hits.size()==hitCount,"A point outside the native clip was forwarded as a Core hit query");
  edit(context.Get(),client,false,[&](TfEditCookie cookie){Microsoft::WRL::ComPtr<ITfRange> at;check(view->GetRangeFromPoint(cookie,&point,GXFPF_ROUND_NEAREST,&at)==TS_E_INVALIDPOINT,"A native clip miss became a text position");return S_OK;});outside=false;session->screenCoordinatesChanged();
  Microsoft::WRL::ComPtr<ITfComposition> composing;auto observer=Microsoft::WRL::Make<CompositionObserver>();
  const auto compose=[&]{edit(context.Get(),client,true,[&](TfEditCookie cookie){auto all=range(context.Get(),cookie,0,static_cast<LONG>(session->read().text.size()));hr(all->SetText(cookie,0,L"\uD55c",1),"Write actual session composition");Microsoft::WRL::ComPtr<ITfContextComposition> owner;hr(context.As(&owner),"Read composition owner");hr(owner->StartComposition(cookie,all.Get(),observer.Get(),&composing),"Start actual session composition");hr(all->Collapse(cookie,TF_ANCHOR_END),"Collapse composition selection");TF_SELECTION selection{all.Get(),{TF_AE_END,FALSE}};return context->SetSelection(cookie,1,&selection);});};
  compose();check(session->read().composing.active(),"Actual TSF composition did not reach the session");
  const auto compositionValue=session->read();const auto compositionEvents=values.size();check(session->keyboardText(L"x",compositionValue.revision)==KeyboardTextResult::unavailable&&session->read().text==compositionValue.text&&values.size()==compositionEvents,"Printable key text overwrote an actual active TSF composition");
  edit(context.Get(),client,false,[&](TfEditCookie){session->replace(L"",{0,0},session->read().revision,40,true);pump([&]{return !values.empty()&&values.back().request==40;});check(values.back().rejection=="composing"&&session->read().composing.active(),"Timer fabricated composition completion under a held TSF lock");return S_OK;});
  // An older replace can reenter through its stale acknowledgement. Its
  // outer call must not overwrite the newer cancellation's live timer.
  edit(context.Get(),client,false,[&](TfEditCookie){session->replace(L"older",{5,5},session->read().revision,44,true);supersedeOnStale=true;session->replace(L"outer",{5,5},session->read().revision,45,true);pump([&]{return !values.empty()&&values.back().request==46;});check(values.back().rejection=="composing"&&session->read().composing.active(),"A reentrant older replacement stole the newer cancellation timer");return S_OK;});
  Microsoft::WRL::ComPtr<ITfContextOwnerCompositionServices> termination;hr(context.As(&termination),"Read actual termination services");Microsoft::WRL::ComPtr<ITfCompositionView> compositionView;hr(composing.As(&compositionView),"Read actual composition view");hr(termination->TerminateComposition(compositionView.Get()),"Terminate expired composition");composing.Reset();compositionView.Reset();
  compose();const auto before=values.size();session->replace(L"",{0,0},session->read().revision,41,true);pump([&]{return values.size()>before&&values.back().request==41;});check(values.back().programmatic&&values.back().rejection.empty()&&session->read().text.empty()&&observer->ended==2,"Real OS completion did not precede the Core replacement");
  closeOnChange=true;session->replace(L"close",{5,5},session->read().revision,42,false);check(session->retired(),"Observer-driven session retirement did not complete");session.reset();context.Reset();view.Reset();composing.Reset();
  closeOnChange=false;throwOnChange=true;session=TextInputSession::create(root,Owner{"failure",1},L"seed",{4,4},128,IS_DEFAULT,std::chrono::milliseconds(50),callbacks());bool threw=false;try{session->replace(L"failure",{7,7},0,43,false);}catch(std::runtime_error const&){threw=true;}check(threw&&session->stopped()&&failures.size()==1,"Observer failure left an active native input session");
  // Its queued retirement must pop a real context whose store has already
  // cleared its document and stopped accepting TSF reads.
  pump([&]{return session->retired();});root->close();std::thread([retired=std::move(session)]()mutable{retired.reset();}).join();
  std::cout<<"PASS-session: actual TSF/Core query roundtrip with supplied caret/hit replies, printable UTF-16 writes with actual focus/readonly/composition guards, disable/focus withdrawal and explicit restoration, actual island resize/screen-map invalidation, reentrant cancellation ownership and real dispatcher cancellation deadline under a held TSF lock, late finish/new cancellation, and observer-driven/failed-context retirement. Core geometry replies are controlled; default provider/physical IME remain notVerified.\n";
}
