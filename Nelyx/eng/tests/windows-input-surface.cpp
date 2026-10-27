// SPDX-License-Identifier: BSD-3-Clause
#include <RNSkiaModule.h>
#include <SkiaView.h>
#include <WindowsAppHost.h>
#include <PlatformServices.h>
#include <TextInputModule.h>
#include "nelyx_skia/paragraph_queries.h"
#include <SemanticsTextGeometry.h>
#include <SemanticsComponent.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <dwmapi.h>
#include <dbghelp.h>
#include <winternl.h>
#include <ctffunc.h>
#include <array>
#include <cmath>
#include <iostream>
#include <thread>
#include <atomic>
#include <future>

namespace RN=winrt::Microsoft::ReactNative;
using namespace Nelyx::WindowsInput;
namespace {
winrt::Microsoft::UI::Windowing::AppWindow window{nullptr};bool finished=false,passed=false,closed=false;
struct CloseProducerProbe {
  std::promise<void> release;std::atomic<bool> released{false};
  std::shared_ptr<RNSkia::WindowsCompositionSession> session;
  winrt::Microsoft::UI::Dispatching::DispatcherQueueTimer timer{nullptr};winrt::event_token tick{};
  std::chrono::steady_clock::time_point deadline;
  void unblock(){if(!released.exchange(true))release.set_value();}
};
std::shared_ptr<CloseProducerProbe> closeProducerProbe;
std::jthread automationWorker;
std::atomic_int automationPhase{0};
class AutomationEvents final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IUIAutomationEventHandler,Microsoft::WRL::FtmBase>{
public:std::atomic_int text{0},selection{0};
  IFACEMETHODIMP HandleAutomationEvent(IUIAutomationElement*,EVENTID event)override{if(event==UIA_Text_TextChangedEventId)++text;if(event==UIA_Text_TextSelectionChangedEventId)++selection;return S_OK;}
};
class AutomationFocusEvents final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IUIAutomationFocusChangedEventHandler,Microsoft::WRL::FtmBase>{
public:std::atomic_int field{0};
  IFACEMETHODIMP HandleFocusChangedEvent(IUIAutomationElement* sender)override{if(!sender)return S_OK;BSTR id=nullptr;BOOL focused=FALSE;if(SUCCEEDED(sender->get_CurrentAutomationId(&id))&&SUCCEEDED(sender->get_CurrentHasKeyboardFocus(&focused))&&focused&&id&&std::wstring_view(id,SysStringLen(id))==L"field")++field;SysFreeString(id);return S_OK;}
};
class AutomationMetadataEvents final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,IUIAutomationPropertyChangedEventHandler,Microsoft::WRL::FtmBase>{
public:std::atomic_int readOnly{0},password{0},textPattern{0};
  IFACEMETHODIMP HandlePropertyChangedEvent(IUIAutomationElement*,PROPERTYID id,VARIANT value)override{if(value.vt!=VT_BOOL)return S_OK;if(id==UIA_ValueIsReadOnlyPropertyId)++readOnly;if(id==UIA_IsPasswordPropertyId)++password;if(id==UIA_IsTextPatternAvailablePropertyId)++textPattern;return S_OK;}
};
std::wstring automationText(IUIAutomationTextRange* range){BSTR value=nullptr;winrt::check_hresult(range->GetText(-1,&value));std::wstring result(value,SysStringLen(value));SysFreeString(value);return result;}
struct Observation{Rect input;CoreGeometry frame;std::optional<ScreenRect> mapped;};std::optional<Observation> observation;
// Only this fixture thread's TSF mode is changed. Keep its actual values and
// restore them before retiring the host, including assertion/error exits.
struct ImeMode {
  struct Item {GUID id;Microsoft::WRL::ComPtr<ITfCompartment> value;VARIANT previous{};bool changed=false;};
  std::array<Item,2> items{{{GUID_COMPARTMENT_KEYBOARD_OPENCLOSE},{GUID_COMPARTMENT_KEYBOARD_INPUTMODE_CONVERSION}}};
  Microsoft::WRL::ComPtr<ITfCompartmentMgr> manager;TfClientId client=TF_CLIENTID_NULL;
  void open(std::shared_ptr<TextInputRoot> const& root){
    if(PRIMARYLANGID(LOWORD(reinterpret_cast<ULONG_PTR>(GetKeyboardLayout(0))))!=LANG_KOREAN)throw std::runtime_error("Actual TSF IME fixture requires an already active Korean keyboard layout");
    client=root->thread()->clientId();checkTextInput(root->thread()->manager()->QueryInterface(IID_PPV_ARGS(&manager)),"Read fixture thread compartments");
    for(auto& item:items){checkTextInput(manager->GetCompartment(item.id,&item.value),"Read fixture IME compartment");checkTextInput(item.value->GetValue(&item.previous),"Read original fixture IME mode");if(item.previous.vt!=VT_EMPTY&&item.previous.vt!=VT_I4)throw std::runtime_error("Unexpected fixture IME compartment value");}
    for(size_t i=0;i<items.size();++i){VARIANT value{};value.vt=VT_I4;value.lVal=i==0?1:TF_CONVERSIONMODE_NATIVE;items[i].changed=true;checkTextInput(items[i].value->SetValue(client,&value),"Set fixture thread IME mode");}
  }
  RN::JSValueObject status()const{
    RN::JSValueObject result{{"layout",double(LOWORD(reinterpret_cast<ULONG_PTR>(GetKeyboardLayout(0))))}};
    for(size_t i=0;i<items.size();++i){VARIANT value{};checkTextInput(items[i].value->GetValue(&value),"Read current fixture IME mode");if(value.vt!=VT_I4)throw std::runtime_error("Fixture IME mode was not an integer");result.emplace(i==0?"open":"conversion",value.lVal);}return result;
  }
  void restore(){for(auto it=items.rbegin();it!=items.rend();++it)if(it->changed){if(it->previous.vt==VT_EMPTY)checkTextInput(manager->ClearCompartment(client,it->id),"Restore empty fixture IME mode");else checkTextInput(it->value->SetValue(client,&it->previous),"Restore original fixture IME mode");it->changed=false;}}
};
std::unique_ptr<ImeMode> imeMode;
void restoreImeMode(){if(imeMode){imeMode->restore();imeMode.reset();}}
RN::JSValueObject box(Rect const& r){return {{"x",r.x},{"y",r.y},{"width",r.width},{"height",r.height}};}
RN::JSValueObject box(RECT const& r){return {{"left",r.left},{"top",r.top},{"right",r.right},{"bottom",r.bottom}};}
void terminateTrace(){std::cerr<<"TERMINATE thread="<<GetCurrentThreadId()<<std::endl;if(auto error=std::current_exception())try{std::rethrow_exception(error);}catch(std::exception const& e){std::cerr<<e.what()<<std::endl;}catch(winrt::hresult_error const& e){std::cerr<<winrt::to_string(e.message())<<std::endl;}catch(...){}void* frames[32]{};const auto count=CaptureStackBackTrace(0,32,frames,nullptr);SymInitialize(GetCurrentProcess(),nullptr,TRUE);for(unsigned i=0;i<count;i++){alignas(SYMBOL_INFO) char data[sizeof(SYMBOL_INFO)+MAX_SYM_NAME]{};const auto symbol=reinterpret_cast<SYMBOL_INFO*>(data);symbol->SizeOfStruct=sizeof(SYMBOL_INFO);symbol->MaxNameLen=MAX_SYM_NAME;DWORD64 offset=0;if(SymFromAddr(GetCurrentProcess(),reinterpret_cast<DWORD64>(frames[i]),&offset,symbol))std::cerr<<symbol->Name<<"+"<<offset<<std::endl;}ExitProcess(4);}
// Keep crash diagnostics in memory. The parent forwards the child's real exit
// code, so a close log followed by fail-fast can never qualify as a pass.
int debugChild(char const* bundle){
  wchar_t executable[MAX_PATH]{};GetModuleFileNameW(nullptr,executable,MAX_PATH);std::wstring command=L"\""+std::wstring(executable)+L"\" \""+winrt::to_hstring(bundle).c_str()+L"\"";STARTUPINFOW startup{sizeof(startup)};PROCESS_INFORMATION process{};
  if(!CreateProcessW(executable,command.data(),nullptr,nullptr,FALSE,DEBUG_ONLY_THIS_PROCESS,nullptr,nullptr,&startup,&process))return 3;
  // Diagnostic only: observe the ordinary IsDebuggerPresent(false) failure
  // path while the parent still receives the fixture child's crash event.
  wchar_t flag[4]{};const bool ordinary=GetEnvironmentVariableW(L"NELYX_WINDOWS_INPUT_HIDE_DEBUGGER",flag,4)&&flag[0]==L'1';
  const auto ordinaryDebugFlag=[&]{if(!ordinary)return;using Query=NTSTATUS(NTAPI*)(HANDLE,PROCESSINFOCLASS,PVOID,ULONG,PULONG);const auto query=reinterpret_cast<Query>(GetProcAddress(GetModuleHandleW(L"ntdll.dll"),"NtQueryInformationProcess"));PROCESS_BASIC_INFORMATION info{};BYTE value=0;if(!query||query(process.hProcess,ProcessBasicInformation,&info,sizeof(info),nullptr)<0||!WriteProcessMemory(process.hProcess,&info.PebBaseAddress->BeingDebugged,&value,sizeof(value),nullptr))throw std::runtime_error("Cannot observe the fixture's ordinary debugger-flag path");};
  DWORD exit=3;const auto deadline=GetTickCount64()+120000;bool exited=false,firstBreakpoint=true,fault=false;unsigned messages=0;
  while(!exited){DEBUG_EVENT event{};if(!WaitForDebugEvent(&event,1000)){if(GetTickCount64()>deadline){TerminateProcess(process.hProcess,3);break;}continue;}DWORD disposition=DBG_CONTINUE;
    if(event.dwDebugEventCode==EXCEPTION_DEBUG_EVENT){const auto& exception=event.u.Exception;const auto code=exception.ExceptionRecord.ExceptionCode;if(code!=EXCEPTION_BREAKPOINT)disposition=DBG_EXCEPTION_NOT_HANDLED;
      if(!exception.dwFirstChance||code==0xc0000409||(code==EXCEPTION_BREAKPOINT&&!firstBreakpoint)){fault=true;std::cerr<<"NATIVE-CRASH 0x"<<std::hex<<code<<std::dec<<std::endl;const auto thread=OpenThread(THREAD_GET_CONTEXT|THREAD_QUERY_INFORMATION,FALSE,event.dwThreadId);CONTEXT context{};context.ContextFlags=CONTEXT_FULL;
        if(thread&&GetThreadContext(thread,&context)){SymInitialize(process.hProcess,nullptr,TRUE);STACKFRAME64 frame{};frame.AddrPC={context.Rip,0,AddrModeFlat};frame.AddrFrame={context.Rbp,0,AddrModeFlat};frame.AddrStack={context.Rsp,0,AddrModeFlat};for(unsigned i=0;i<32&&frame.AddrPC.Offset;i++){alignas(SYMBOL_INFO) char data[sizeof(SYMBOL_INFO)+MAX_SYM_NAME]{};const auto symbol=reinterpret_cast<SYMBOL_INFO*>(data);symbol->SizeOfStruct=sizeof(SYMBOL_INFO);symbol->MaxNameLen=MAX_SYM_NAME;DWORD64 offset=0;IMAGEHLP_MODULE64 module{sizeof(module)};SymGetModuleInfo64(process.hProcess,frame.AddrPC.Offset,&module);std::cerr<<module.ModuleName<<"+0x"<<std::hex<<frame.AddrPC.Offset-module.BaseOfImage<<std::dec;if(SymFromAddr(process.hProcess,frame.AddrPC.Offset,&offset,symbol))std::cerr<<" "<<symbol->Name<<"+"<<offset;std::cerr<<std::endl;if(!StackWalk64(IMAGE_FILE_MACHINE_AMD64,process.hProcess,thread,&frame,&context,nullptr,SymFunctionTableAccess64,SymGetModuleBase64,nullptr))break;}SymCleanup(process.hProcess);}if(thread)CloseHandle(thread);
      }
      if(code==EXCEPTION_BREAKPOINT){if(firstBreakpoint)ordinaryDebugFlag();firstBreakpoint=false;}
    }else if(event.dwDebugEventCode==OUTPUT_DEBUG_STRING_EVENT&&messages++<64){const auto& text=event.u.DebugString;const size_t length=std::min(size_t(text.nDebugStringLength),size_t(8192));if(text.fUnicode){std::vector<wchar_t> data(length+1);if(ReadProcessMemory(process.hProcess,text.lpDebugStringData,data.data(),length*sizeof(wchar_t),nullptr))std::cerr<<"NATIVE-DEBUG "<<winrt::to_string(data.data())<<std::endl;}else{std::vector<char> data(length+1);if(ReadProcessMemory(process.hProcess,text.lpDebugStringData,data.data(),length,nullptr))std::cerr<<"NATIVE-DEBUG "<<data.data()<<std::endl;}}
    else if(event.dwDebugEventCode==LOAD_DLL_DEBUG_EVENT){if(event.u.LoadDll.hFile)CloseHandle(event.u.LoadDll.hFile);}else if(event.dwDebugEventCode==CREATE_PROCESS_DEBUG_EVENT){ordinaryDebugFlag();if(event.u.CreateProcessInfo.hFile)CloseHandle(event.u.CreateProcessInfo.hFile);}else if(event.dwDebugEventCode==CREATE_THREAD_DEBUG_EVENT){CloseHandle(event.u.CreateThread.hThread);}else if(event.dwDebugEventCode==EXIT_PROCESS_DEBUG_EVENT){exit=event.u.ExitProcess.dwExitCode;exited=true;}
    ContinueDebugEvent(event.dwProcessId,event.dwThreadId,disposition);
  }
  if(!exited)WaitForSingleObject(process.hProcess,5000);CloseHandle(process.hThread);CloseHandle(process.hProcess);return static_cast<int>(exit==0&&fault?3:exit);
}
class Read final:public Microsoft::WRL::RuntimeClass<Microsoft::WRL::RuntimeClassFlags<Microsoft::WRL::ClassicCom>,ITfEditSession>{
public:
  std::function<HRESULT(TfEditCookie)> action;
  HRESULT STDMETHODCALLTYPE DoEditSession(TfEditCookie cookie)override{try{return action(cookie);}catch(...){return E_UNEXPECTED;}}
};
REACT_MODULE(NelyxInputSurfaceFixture)
struct NelyxInputSurfaceFixture {
  RN::ReactContext context;
  REACT_INIT(initialize)
  void initialize(RN::ReactContext const& value)noexcept{context=value;}
  REACT_METHOD(validateSemantics)
  void validateSemantics(RN::JSValue packet,RN::ReactPromise<RN::JSValueObject> promise)noexcept{auto value=std::make_shared<RN::JSValue>(std::move(packet));post(promise,[value](RN::ReactContext const&){try{const auto parsed=Nelyx::WindowsSemantics::readCoreSemanticsSnapshot(*value);return RN::JSValueObject{{"accepted",true},{"textRevision",parsed.text?double(parsed.text->textRevision):-1}};}catch(Nelyx::WindowsSemantics::TextError const&){return RN::JSValueObject{{"accepted",false}};}catch(std::invalid_argument const&){return RN::JSValueObject{{"accepted",false}};}});}
  REACT_METHOD(semantics)
  void semantics(double tag,std::string mode,RN::ReactPromise<RN::JSValueObject> promise)noexcept{
    if(automationWorker.joinable())automationWorker.join();const auto current=context;const auto top=winrt::Microsoft::UI::GetWindowFromWindowId(window.Id());
    automationWorker=std::jthread([current,top,tag,mode=std::move(mode),promise]{RN::JSValueObject response;const auto apartment=CoInitializeEx(nullptr,COINIT_MULTITHREADED);
      try{winrt::check_hresult(apartment);Microsoft::WRL::ComPtr<IUIAutomation> client;winrt::check_hresult(CoCreateInstance(CLSID_CUIAutomation,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&client)));
        Microsoft::WRL::ComPtr<IUIAutomationElement> root,element;winrt::check_hresult(client->ElementFromHandle(top,&root));Nelyx::WindowsSemantics::AutomationVariant id;id.string(mode=="invoke"?L"invoke":L"field");Microsoft::WRL::ComPtr<IUIAutomationCondition> condition;winrt::check_hresult(client->CreatePropertyCondition(UIA_AutomationIdPropertyId,id.data,&condition));Microsoft::WRL::ComPtr<IUIAutomationElementArray> matches;winrt::check_hresult(root->FindAll(TreeScope_Descendants,condition.Get(),&matches));int length=0;winrt::check_hresult(matches->get_Length(&length));if(length!=1)throw std::runtime_error("Expected exactly one actual Fabric semantics field, got "+std::to_string(length));winrt::check_hresult(matches->GetElement(0,&element));
        CONTROLTYPEID type=0;winrt::check_hresult(element->get_CurrentControlType(&type));if(type!=(mode=="invoke"?UIA_ButtonControlTypeId:UIA_EditControlTypeId))throw std::runtime_error("The nonvisual field must expose Core Edit control type");
        SAFEARRAY* runtime=nullptr;winrt::check_hresult(element->GetRuntimeId(&runtime));LONG index=0;winrt::check_hresult(SafeArrayGetUBound(runtime,1,&index));int actualTag=0;winrt::check_hresult(SafeArrayGetElement(runtime,&index,&actualTag));SafeArrayDestroy(runtime);if(actualTag!=static_cast<int>(tag))throw std::runtime_error("UIA field did not come from the registered Core Fabric tag");
        if(mode=="invoke"){
          Microsoft::WRL::ComPtr<IUIAutomationInvokePattern> invoke;winrt::check_hresult(element->GetCurrentPatternAs(UIA_InvokePatternId,IID_PPV_ARGS(&invoke)));winrt::check_hresult(invoke->Invoke());response={{"observed",true}};
        }else{
        Microsoft::WRL::ComPtr<IUIAutomationTextPattern2> text;winrt::check_hresult(element->GetCurrentPatternAs(UIA_TextPattern2Id,IID_PPV_ARGS(&text)));Microsoft::WRL::ComPtr<IUIAutomationTextRange> range;winrt::check_hresult(text->get_DocumentRange(&range));
        if(mode=="focus"){
          const auto events=Microsoft::WRL::Make<AutomationFocusEvents>();winrt::check_hresult(client->AddFocusChangedEventHandler(nullptr,events.Get()));struct RemoveFocusEvents{IUIAutomation* client;~RemoveFocusEvents(){client->RemoveAllEventHandlers();}} remove{client.Get()};
          winrt::check_hresult(element->SetFocus());BOOL same=FALSE,hasFocus=FALSE;std::wstring focusedId;
          for(int attempt=0;attempt<25;++attempt){Microsoft::WRL::ComPtr<IUIAutomationElement> focused;winrt::check_hresult(client->GetFocusedElement(&focused));if(focused){winrt::check_hresult(client->CompareElements(element.Get(),focused.Get(),&same));BSTR id=nullptr;winrt::check_hresult(focused->get_CurrentAutomationId(&id));focusedId=id?std::wstring(id,SysStringLen(id)):std::wstring{};SysFreeString(id);}winrt::check_hresult(element->get_CurrentHasKeyboardFocus(&hasFocus));if(same&&hasFocus&&events->field.load()>0)break;std::this_thread::sleep_for(std::chrono::milliseconds(100));}
          response={{"observed",true},{"focusMatches",bool(same)},{"fieldHasFocus",bool(hasFocus)},{"focusEvents",events->field.load()},{"focusedId",winrt::to_string(focusedId)}};
        }else if(mode=="replace"){
          const auto events=Microsoft::WRL::Make<AutomationEvents>();winrt::check_hresult(client->AddAutomationEventHandler(UIA_Text_TextChangedEventId,element.Get(),TreeScope_Element,nullptr,events.Get()));winrt::check_hresult(client->AddAutomationEventHandler(UIA_Text_TextSelectionChangedEventId,element.Get(),TreeScope_Element,nullptr,events.Get()));struct RemoveEvents{IUIAutomation* value;~RemoveEvents(){value->RemoveAllEventHandlers();}} remove{client.Get()};
          Microsoft::WRL::ComPtr<IUIAutomationValuePattern> value;winrt::check_hresult(element->GetCurrentPatternAs(UIA_ValuePatternId,IID_PPV_ARGS(&value)));Nelyx::WindowsSemantics::AutomationVariant replacement;replacement.string(L"Core UIA \U0001f600");winrt::check_hresult(value->SetValue(replacement.data.bstrVal));bool observed=false;for(int attempt=0;attempt<25;++attempt){if(events->text.load()>0&&automationText(range.Get())==L"Core UIA \U0001f600"){observed=true;break;}std::this_thread::sleep_for(std::chrono::milliseconds(100));}if(!observed)throw std::runtime_error("Actual Core replacement did not publish a UIA TextChanged event and live range value");response={{"observed",true},{"textEvents",events->text.load()},{"selectionEvents",events->selection.load()},{"text",winrt::to_string(automationText(range.Get()))}};
        }else if(mode=="metadata"){
          const auto events=Microsoft::WRL::Make<AutomationMetadataEvents>();PROPERTYID ids[]={UIA_ValueIsReadOnlyPropertyId,UIA_IsPasswordPropertyId,UIA_IsTextPatternAvailablePropertyId};winrt::check_hresult(client->AddPropertyChangedEventHandlerNativeArray(element.Get(),TreeScope_Element,nullptr,events.Get(),ids,3));struct RemoveMetadataEvents{IUIAutomation* client;~RemoveMetadataEvents(){client->RemoveAllEventHandlers();automationPhase=0;}} remove{client.Get()};
          automationPhase=1;bool readonly=false;for(int attempt=0;attempt<30;++attempt){Microsoft::WRL::ComPtr<IUIAutomationValuePattern> value;if(SUCCEEDED(element->GetCurrentPatternAs(UIA_ValuePatternId,IID_PPV_ARGS(&value)))){BOOL flag=FALSE;if(SUCCEEDED(value->get_CurrentIsReadOnly(&flag)))readonly=flag&&events->readOnly.load()>0;}if(readonly)break;std::this_thread::sleep_for(std::chrono::milliseconds(100));}if(!readonly)throw std::runtime_error("Core readonly publication did not notify the actual UIA client");
          automationPhase=2;bool secure=false;HRESULT denied=S_OK;for(int attempt=0;attempt<30;++attempt){BOOL flag=FALSE;BSTR body=nullptr;denied=range->GetText(-1,&body);SysFreeString(body);if(SUCCEEDED(element->get_CurrentIsPassword(&flag)))secure=flag&&events->password.load()>0&&(denied==E_ACCESSDENIED||denied==UIA_E_ELEMENTNOTAVAILABLE);if(secure)break;std::this_thread::sleep_for(std::chrono::milliseconds(100));}if(!secure)throw std::runtime_error("Retained UIA range exposed a newly obscured Core document");
          automationPhase=3;bool retired=false;for(int attempt=0;attempt<30;++attempt){BOOL flag=TRUE;BSTR body=nullptr;const auto result=range->GetText(-1,&body);SysFreeString(body);if(SUCCEEDED(element->get_CurrentIsPassword(&flag)))retired=!flag&&result==UIA_E_ELEMENTNOTAVAILABLE&&events->password.load()>=2&&events->readOnly.load()>=2&&events->textPattern.load()>=2;if(retired)break;std::this_thread::sleep_for(std::chrono::milliseconds(100));}if(!retired)throw std::runtime_error("Retired Core range revived or metadata did not notify after privacy restoration");response={{"observed",true},{"readOnlyEvents",events->readOnly.load()},{"passwordEvents",events->password.load()},{"textPatternEvents",events->textPattern.load()},{"retired",retired}};
        }else if(mode=="scroll-top"||mode=="scroll-bottom"){
          const auto body=automationText(range.Get());const auto at=body.find(L"Range 5");if(at==std::wstring::npos)throw std::runtime_error("The Core range probe body was not published");
          winrt::check_hresult(range->MoveEndpointByRange(TextPatternRangeEndpoint_End,range.Get(),TextPatternRangeEndpoint_Start));int moved=0;winrt::check_hresult(range->MoveEndpointByUnit(TextPatternRangeEndpoint_End,TextUnit_Character,static_cast<int>(at+7),&moved));if(moved!=static_cast<int>(at+7))throw std::runtime_error("UIA range end differs from Core units");winrt::check_hresult(range->MoveEndpointByUnit(TextPatternRangeEndpoint_Start,TextUnit_Character,static_cast<int>(at),&moved));if(moved!=static_cast<int>(at))throw std::runtime_error("UIA range start differs from Core units");
          const bool top=mode=="scroll-top";winrt::check_hresult(range->ScrollIntoView(top));double edge=0;bool aligned=false;
          for(int attempt=0;attempt<25;++attempt){SAFEARRAY* rectangles=nullptr;const auto hr=range->GetBoundingRectangles(&rectangles);if(SUCCEEDED(hr)&&rectangles){LONG lower=0,upper=-1;winrt::check_hresult(SafeArrayGetLBound(rectangles,1,&lower));winrt::check_hresult(SafeArrayGetUBound(rectangles,1,&upper));if(upper-lower+1>=4){double y=0,height=0;LONG index=lower+1;winrt::check_hresult(SafeArrayGetElement(rectangles,&index,&y));index=lower+3;winrt::check_hresult(SafeArrayGetElement(rectangles,&index,&height));RECT bounds{};winrt::check_hresult(element->get_CurrentBoundingRectangle(&bounds));edge=top?y-bounds.top:y+height-bounds.bottom;aligned=std::abs(edge)<=2;}SafeArrayDestroy(rectangles);}if(aligned)break;std::this_thread::sleep_for(std::chrono::milliseconds(100));}
          if(!aligned)throw std::runtime_error("UIA ScrollIntoView did not align Core range: "+std::to_string(edge));response={{"observed",true},{"range",winrt::to_string(automationText(range.Get()))},{"edge",edge}};
        }else if(mode=="select"){
          winrt::check_hresult(range->MoveEndpointByRange(TextPatternRangeEndpoint_End,range.Get(),TextPatternRangeEndpoint_Start));int moved=0;winrt::check_hresult(range->MoveEndpointByUnit(TextPatternRangeEndpoint_End,TextUnit_Character,4,&moved));if(moved!=4)throw std::runtime_error("Actual Core Character units not exposed to UIA");winrt::check_hresult(range->MoveEndpointByUnit(TextPatternRangeEndpoint_Start,TextUnit_Character,1,&moved));winrt::check_hresult(range->Select());response={{"observed",true},{"queued",true}};
        }else{
          Microsoft::WRL::ComPtr<IUIAutomationValuePattern> value;winrt::check_hresult(element->GetCurrentPatternAs(UIA_ValuePatternId,IID_PPV_ARGS(&value)));BSTR body=nullptr;winrt::check_hresult(value->get_CurrentValue(&body));const std::wstring actualValue(body,SysStringLen(body));SysFreeString(body);if(actualValue!=automationText(range.Get()))throw std::runtime_error("Actual UIA Value and Text patterns disagree with the same Core body");
          SAFEARRAY* rectangles=nullptr;winrt::check_hresult(range->GetBoundingRectangles(&rectangles));LONG lower=0,upper=-1;winrt::check_hresult(SafeArrayGetLBound(rectangles,1,&lower));winrt::check_hresult(SafeArrayGetUBound(rectangles,1,&upper));SafeArrayDestroy(rectangles);if(upper-lower+1<4)throw std::runtime_error("Core screen range rectangles missing from actual UIA Text pattern");
          Microsoft::WRL::ComPtr<IUIAutomationTextRangeArray> visible;winrt::check_hresult(text->GetVisibleRanges(&visible));int visibleCount=0;winrt::check_hresult(visible->get_Length(&visibleCount));if(visibleCount<1)throw std::runtime_error("Actual UIA visible ranges missing");BOOL active=FALSE;Microsoft::WRL::ComPtr<IUIAutomationTextRange> caret;winrt::check_hresult(text->GetCaretRange(&active,&caret));RECT bounds{};winrt::check_hresult(element->get_CurrentBoundingRectangle(&bounds));Microsoft::WRL::ComPtr<IUIAutomationTextRange> hit;winrt::check_hresult(text->RangeFromPoint({bounds.left+10,bounds.top+15},&hit));
          response={{"observed",true},{"text",winrt::to_string(automationText(range.Get()))},{"visible",visibleCount},{"caretActive",active!=FALSE},{"fragments",double(upper-lower+1)/4},{"runtimeTag",actualTag},{"width",bounds.right-bounds.left},{"height",bounds.bottom-bounds.top}};
        }
        }
      }catch(winrt::hresult_error const& error){response={{"observed",false},{"hresult",double(static_cast<unsigned long>(error.code()))},{"reason",winrt::to_string(error.message())}};}catch(std::exception const& error){response={{"observed",false},{"reason",error.what()}};}catch(...){response={{"observed",false},{"reason","Unknown actual UIA client failure"}};}
      if(SUCCEEDED(apartment))CoUninitialize();auto result=std::make_shared<RN::JSValueObject>(std::move(response));current.UIDispatcher().Post([promise,result]{promise.Resolve(std::move(*result));});
    });
  }
  REACT_SYNC_METHOD(semanticsPhase)
  int semanticsPhase()noexcept{return automationPhase.load();}
  template<class F>void post(RN::ReactPromise<RN::JSValueObject> promise,F action)noexcept{auto current=context;current.UIDispatcher().Post([current,promise,action=std::move(action)]()noexcept{try{promise.Resolve(action(current));}catch(std::exception const& error){promise.Reject(error.what());}catch(Nelyx::WindowsSemantics::TextError const& error){promise.Reject(("Core native text geometry error "+std::to_string(static_cast<unsigned long>(error.result))).c_str());}catch(winrt::hresult_error const& error){promise.Reject(error.message().c_str());}catch(...){promise.Reject("Native Skia input probe failed");}});}
  REACT_METHOD(paragraph)
  void paragraph(RN::JSValue packet,RN::ReactPromise<RN::JSValueObject> promise)noexcept{
    auto value=std::make_shared<RN::JSValue>(std::move(packet));post(promise,[value](RN::ReactContext const& current){
      namespace Query=nelyx::skia_core;using namespace InputWire;
      const auto& reference=field(*value,"paragraph");const auto& resource=field(reference,"resource");const auto& native=field(reference,"reference");const auto identity=owner(field(*value,"owner"));const auto body=string(field(*value,"text"));
      const auto units=counter(field(*value,"units"),false,4096);Query::ParagraphQueryIdentity source{identity.id,string(field(resource,"id")),body,identity.generation,counter(field(resource,"generation")),static_cast<uint32_t>(units)};
      const auto ticket=counter(field(native,"token"),true);if(string(field(native,"protocol"))!="native-paragraph-v1")throw std::invalid_argument("Invalid native paragraph reference");
      const auto session=current.Properties().Get(RNSkia::WindowsCompositionSessionProperty());if(!session)throw std::runtime_error("Actual native composition session missing");const auto platform=std::static_pointer_cast<RNSkia::RNSkPlatformContext>((*session)->uiPlatform());
      const auto boxes=Query::ParagraphQuerySource::ranges(ticket,platform.get(),source,{{0,static_cast<uint32_t>(units)}});const auto hit=Query::ParagraphQuerySource::hit(ticket,platform.get(),source,10,10);if(!boxes||!hit)return RN::JSValueObject{{"observed",false}};
      RN::JSValueArray result;for(const auto& item:boxes->front())result.emplace_back(RN::JSValueObject{{"x",item.left},{"y",item.top},{"width",item.right-item.left},{"height",item.bottom-item.top}});
      auto foreign=source;foreign.resource+="/foreign";auto foreignContext=std::make_shared<int>(1);
      namespace Sem=Nelyx::WindowsSemantics;const auto& core=field(*value,"geometry");Sem::CoreParagraphFrame frame;frame.geometry=geometry(core,identity);frame.identity=source;frame.ticket=ticket;
      const auto& origin=field(reference,"paintOffset");frame.paintX=number(field(origin,"x"));frame.paintY=number(field(origin,"y"));size_t index=0;for(const auto& numberValue:field(core,"transform").AsArray())frame.transform[index++]=number(numberValue);
      Sem::TextSnapshot shadow;shadow.text=text(field(*value,"text"));for(const auto& stop:field(*value,"characters").AsArray())shadow.characters.push_back(offset(stop));
      const auto root=*current.Properties().Get(TextInputRootProperty());const auto resolver=*current.Properties().Get(TextInputSurfaceResolverProperty());const auto surface=resolver(current.Handle(),counter(field(*value,"tag"),true),identity);
      Sem::ParagraphScreenMapping mapping;mapping.context=platform;mapping.active=surface.active;mapping.revision=[root]{return root->coordinateRevision();};
      mapping.screenBox=[screen=surface.screenRect,stamp=frame.geometry](Sem::LogicalBox const& rect)->std::optional<Sem::ScreenBox>{const auto mapped=screen(rect,stamp);if(!mapped)return std::nullopt;return Sem::ScreenBox{double(mapped->left),double(mapped->top),double(mapped->right-mapped->left),double(mapped->bottom-mapped->top)};};
      mapping.viewPoint=[point=surface.viewPoint,stamp=frame.geometry](double x,double y)->std::optional<Sem::LogicalPoint>{const auto mapped=point({static_cast<LONG>(x),static_cast<LONG>(y)},GXFPF_NEAREST,stamp);if(!mapped||mapped->outside)return std::nullopt;return Sem::LogicalPoint{mapped->x,mapped->y};};
      Sem::TextParagraphGeometry reader(frame,mapping,shadow);const auto screen=reader.rectangles(0,static_cast<int>(units));const auto visible=reader.visibleRanges();if(!screen||!visible)return RN::JSValueObject{{"observed",false}};
      RN::JSValueArray screenBoxes,expectedScreen;for(const auto& rect:*screen)screenBoxes.emplace_back(RN::JSValueObject{{"x",rect.x},{"y",rect.y},{"width",rect.width},{"height",rect.height}});for(const auto& rect:rects(field(*value,"expected"))){const auto mapped=mapping.screenBox(rect);if(!mapped)throw std::runtime_error("Expected Core screen mapping unavailable");if(mapped->height>0)expectedScreen.emplace_back(RN::JSValueObject{{"x",mapped->x},{"y",mapped->y},{"width",mapped->width},{"height",mapped->height}});}
      const auto caret=mapping.screenBox(frame.geometry.caret);if(!caret||caret->height<=0)throw std::runtime_error("Actual Core caret screen map unavailable");const auto hitView=mapping.viewPoint(caret->x,caret->y+caret->height/2);const auto hitPosition=reader.hit(caret->x,caret->y+caret->height/2);if(!hitView||!hitPosition)return RN::JSValueObject{{"observed",false}};
      auto changed=mapping;changed.screenBox=[&](Sem::LogicalBox const& rect){auto mapped=mapping.screenBox(rect);root->screenCoordinatesChanged();return mapped;};Sem::TextParagraphGeometry reentrant(frame,changed,shadow);const bool reentrantRejected=!reentrant.rectangles(0,static_cast<int>(units));
      return RN::JSValueObject{{"observed",true},{"boxes",std::move(result)},{"position",double(hit->position)},{"screen",std::move(screenBoxes)},{"expectedScreen",std::move(expectedScreen)},{"visible",double(visible->size())},{"hitPosition",double(*hitPosition)},{"hitViewX",hitView->x},{"hitViewY",hitView->y},{"reentrantRejected",reentrantRejected},{"foreignResourceRejected",!Query::ParagraphQuerySource::ranges(ticket,platform.get(),foreign,{{0,static_cast<uint32_t>(units)}})},{"foreignContextRejected",!Query::ParagraphQuerySource::hit(ticket,foreignContext.get(),source,10,10)}};
    });
  }
  REACT_METHOD(activate)
  void activate(RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[](RN::ReactContext const&){
    const auto top=winrt::Microsoft::UI::GetWindowFromWindowId(window.Id());const auto ui=GetCurrentThreadId(),foreground=GetWindowThreadProcessId(GetForegroundWindow(),nullptr);
    // This background-launched fixture must actually own foreground input
    // before SendInput. Join only the current foreground queue temporarily;
    // detach it before the Core/TSF clients or injected key batch are created.
    const bool attached=foreground&&foreground!=ui&&AttachThreadInput(ui,foreground,TRUE);
    ShowWindow(top,SW_RESTORE);BringWindowToTop(top);SetForegroundWindow(top);const auto error=GetLastError();if(attached&&!AttachThreadInput(ui,foreground,FALSE))throw std::runtime_error("Fixture foreground queue did not detach");
    DWORD process=0;GetWindowThreadProcessId(GetForegroundWindow(),&process);return RN::JSValueObject{{"foreground",GetForegroundWindow()==top},{"foregroundProcess",double(process)},{"ownProcess",double(GetCurrentProcessId())},{"attached",attached},{"error",double(error)}};
  });}
  REACT_METHOD(resize)
  void resize(RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[](RN::ReactContext const&){window.Resize({720,360});return RN::JSValueObject{{"requested",true}};});}
  REACT_METHOD(keys)
  void keys(RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[](RN::ReactContext const& current){
    const auto root=*current.Properties().Get(TextInputRootProperty());const auto target=root->focusedInputWindow();
    DWORD foregroundProcess=0;GetWindowThreadProcessId(GetForegroundWindow(),&foregroundProcess);
    if(::GetFocus()!=target||foregroundProcess!=GetCurrentProcessId())throw std::runtime_error("Actual input fixture must own foreground keyboard focus");
    const auto layout=GetKeyboardLayout(0);for(UINT code:{UINT('A'),UINT('B'),UINT('C')})if(MapVirtualKeyExW(code,MAPVK_VK_TO_CHAR,layout)!=code)throw std::runtime_error("Rapid OS key fixture requires actual Latin letter mappings");
    std::vector<INPUT> inputs;const auto key=[&](WORD code,bool up){const auto scan=MapVirtualKeyExW(code,MAPVK_VK_TO_VSC,layout);if(!scan||scan>0xff)throw std::runtime_error("Fixture key has no actual nonextended hardware scan code");INPUT event{};event.type=INPUT_KEYBOARD;event.ki.wScan=static_cast<WORD>(scan);event.ki.dwFlags=KEYEVENTF_SCANCODE|(up?KEYEVENTF_KEYUP:0);inputs.push_back(event);};
    key(VK_LCONTROL,false);key('A',false);key('A',true);key(VK_LCONTROL,true);for(WORD code:{WORD('A'),WORD('B'),WORD(VK_BACK),WORD('C')}){key(code,false);key(code,true);}
    const auto sent=SendInput(static_cast<UINT>(inputs.size()),inputs.data(),sizeof(INPUT));if(sent!=inputs.size())throw std::runtime_error("OS did not accept the complete fixture keyboard batch");return RN::JSValueObject{{"sent",double(sent)}};
  });}
  REACT_METHOD(characters)
  void characters(std::string kind,RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[kind=std::move(kind)](RN::ReactContext const& current){
    const auto root=*current.Properties().Get(TextInputRootProperty());const auto target=root->focusedInputWindow();DWORD process=0;GetWindowThreadProcessId(GetForegroundWindow(),&process);if(GetFocus()!=target||process!=GetCurrentProcessId())throw std::runtime_error("Standalone character fixture requires its own foreground focus");
    if(kind=="posted"){if(!PostMessageW(target,WM_CHAR,0x03a9,1))throw std::runtime_error("Own queued WM_CHAR was not posted");return RN::JSValueObject{{"posted",true}};}
    if(kind!="packet")throw std::invalid_argument("Unknown native character fixture");std::vector<INPUT> inputs;for(WORD unit:{WORD(0xd83d),WORD(0xde00)})for(bool up:{false,true}){INPUT event{};event.type=INPUT_KEYBOARD;event.ki.wScan=unit;event.ki.dwFlags=KEYEVENTF_UNICODE|(up?KEYEVENTF_KEYUP:0);inputs.push_back(event);}
    const auto sent=SendInput(static_cast<UINT>(inputs.size()),inputs.data(),sizeof(INPUT));if(sent!=inputs.size())throw std::runtime_error("OS did not accept the fixture Unicode packets");return RN::JSValueObject{{"sent",double(sent)}};
  });}
  REACT_METHOD(ime)
  void ime(std::string operation,RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[operation=std::move(operation)](RN::ReactContext const& current){
    if(operation=="restore"){restoreImeMode();return RN::JSValueObject{{"restored",true}};}
    const auto root=*current.Properties().Get(TextInputRootProperty());const auto target=root->focusedInputWindow();DWORD process=0;GetWindowThreadProcessId(GetForegroundWindow(),&process);if(GetFocus()!=target||process!=GetCurrentProcessId())throw std::runtime_error("TSF IME fixture requires its own foreground focus");
    if(operation=="open"){if(imeMode)throw std::logic_error("Fixture IME mode already owned");imeMode=std::make_unique<ImeMode>();imeMode->open(root);return imeMode->status();}
    if(!imeMode)throw std::logic_error("Fixture IME mode not owned");if(operation=="status")return imeMode->status();if(operation!="compose"&&operation!="compose-shift"&&operation!="barrier"&&operation!="commit")throw std::invalid_argument("Unknown fixture IME operation");
    const auto layout=GetKeyboardLayout(0);std::vector<INPUT> inputs;const auto edge=[&](WORD code,bool up){// This fixture requests the dedicated Right arrow. Its base scan also names
      // keypad 6, and MapVirtualKeyEx omits that distinction on these layouts.
      const auto scan=MapVirtualKeyExW(code,MAPVK_VK_TO_VSC_EX,layout);if(!scan||((scan&0xff00)!=0&&(scan&0xff00)!=0xe000))throw std::runtime_error("IME fixture key lacks a supported actual scan code");INPUT event{};event.type=INPUT_KEYBOARD;event.ki.wScan=static_cast<WORD>(scan&0xff);event.ki.dwFlags=KEYEVENTF_SCANCODE|((code==VK_RIGHT||(scan&0xff00)==0xe000)?KEYEVENTF_EXTENDEDKEY:0)|(up?KEYEVENTF_KEYUP:0);inputs.push_back(event);};const auto key=[&](WORD code){edge(code,false);edge(code,true);};
    if(operation=="compose-shift"){edge(VK_LSHIFT,false);key('R');edge(VK_LSHIFT,true);key('K');}else if(operation=="compose"){key('R');key('K');}else key(operation=="barrier"?VK_F24:VK_RIGHT);const auto sent=SendInput(static_cast<UINT>(inputs.size()),inputs.data(),sizeof(INPUT));if(sent!=inputs.size())throw std::runtime_error("OS did not accept the complete IME fixture key batch");return RN::JSValueObject{{"sent",double(sent)}};
  });}
  REACT_METHOD(probe)
  void probe(double tag,double offset,RN::ReactPromise<RN::JSValueObject> promise)noexcept{post(promise,[tag,offset](RN::ReactContext const& current){
    const auto root=*current.Properties().Get(TextInputRootProperty());const auto component=RN::Composition::CompositionUIService::ComponentFromReactTag(current.Handle(),static_cast<int64_t>(tag));
    RN::JSValueArray ancestors;unsigned depth=0;for(auto view=component;view&&depth++<32;view=view.Parent()){const auto metrics=view.LayoutMetrics();const auto props=view.try_as<RN::Composition::ViewComponentView>();ancestors.push_back(RN::JSValueObject{{"tag",view.Tag()},{"id",props?winrt::to_string(props.ViewProps().TestId()):""},{"x",metrics.Frame.X},{"y",metrics.Frame.Y},{"width",metrics.Frame.Width},{"height",metrics.Frame.Height}});}
    RN::JSValueObject result{{"ancestors",std::move(ancestors)},{"layout",false},{"noLayout",false},{"rect",nullptr},{"green",nullptr}};
    wchar_t focusedClass[128]{},rootClass[128]{};const auto focused=::GetFocus();GetClassNameW(focused,focusedClass,128);GetClassNameW(root->window(),rootClass,128);result.emplace("focus",RN::JSValueObject{{"isRoot",focused==root->window()},{"isChild",bool(IsChild(root->window(),focused))},{"class",winrt::to_string(focusedClass)},{"rootClass",winrt::to_string(rootClass)}});
    const auto shell=RNSkia::WindowsSkiaComponent::findInputComponent(component);const auto surface=shell?shell->state->inputSurface():std::nullopt;
    result.emplace("bound",surface&&surface->bound);if(surface)result.emplace("generation",double(surface->surfaceGeneration));
    Microsoft::WRL::ComPtr<ITfDocumentMgr> document;checkTextInput(root->thread()->manager()->GetFocus(&document),"Read focused TSF document");if(!document)return result;
    Microsoft::WRL::ComPtr<ITfContext> input;checkTextInput(document->GetTop(&input),"Read focused TSF context");if(!input)return result;
    observation.reset();auto read=Microsoft::WRL::Make<Read>();read->action=[&](TfEditCookie cookie){Microsoft::WRL::ComPtr<ITfRange> range;checkTextInput(input->GetStart(cookie,&range),"Read TSF start");Microsoft::WRL::ComPtr<ITfRangeACP> acp;checkTextInput(range.As(&acp),"Read TSF ACP");checkTextInput(acp->SetExtent(static_cast<LONG>(offset),0),"Set TSF caret range");Microsoft::WRL::ComPtr<ITfContextView> view;checkTextInput(input->GetActiveView(&view),"Read TSF active view");HWND textWindow=nullptr;checkTextInput(view->GetWnd(&textWindow),"Read actual TSF input window");result["textWindowFocused"]=textWindow==::GetFocus();RECT rect{};BOOL clipped=FALSE;const auto value=view->GetTextExt(cookie,range.Get(),&rect,&clipped);result["layout"]=value==S_OK;result["noLayout"]=value==TS_E_NOLAYOUT;if(value==S_OK)result["rect"]=RN::JSValueObject{{"left",rect.left},{"top",rect.top},{"right",rect.right},{"bottom",rect.bottom},{"clipped",bool(clipped)}};return S_OK;};
    HRESULT readResult=E_FAIL;const auto request=input->RequestEditSession(root->thread()->clientId(),read.Get(),TF_ES_SYNC|TF_ES_READ,&readResult);result.emplace("read",SUCCEEDED(request)&&SUCCEEDED(readResult));
    if(observation){RN::JSValueObject value{{"input",box(observation->input)},{"caret",box(observation->frame.caret)},{"clip",box(observation->frame.clip)},{"surface",double(observation->frame.surface)}};if(observation->mapped)value.emplace("screen",box(*observation->mapped));result.emplace("mapping",std::move(value));}
    // Core paints both the caret and composing underline in saturated green.
    // Separate narrow vertical paint from wide underline runs without using
    // TSF bounds to crop pixels; screen evidence must remain independent.
    DwmFlush();RECT client{};const auto top=GetAncestor(root->window(),GA_ROOT);GetClientRect(top,&client);POINT origin{};ClientToScreen(top,&origin);RECT green{LONG_MAX,LONG_MAX,LONG_MIN,LONG_MIN},underline{LONG_MAX,LONG_MAX,LONG_MIN,LONG_MIN};unsigned count=0,underlinePixels=0;
    result.emplace("clientOrigin",RN::JSValueObject{{"x",origin.x},{"y",origin.y}});const auto local=root->island().CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Point{0,0});result.emplace("islandOrigin",RN::JSValueObject{{"x",local.X},{"y",local.Y}});
    const auto width=client.right,height=client.bottom;if(width<=0||height<=0||width>4096||height>4096)throw std::runtime_error("Unexpected native client dimensions");
    const auto dc=GetDC(nullptr);if(!dc)throw std::runtime_error("Screen pixel observation unavailable");const auto memory=CreateCompatibleDC(dc);
    BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=width;info.bmiHeader.biHeight=-height;info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;void* pixels=nullptr;
    const auto bitmap=memory?CreateDIBSection(dc,&info,DIB_RGB_COLORS,&pixels,nullptr,0):nullptr;const auto previous=bitmap?SelectObject(memory,bitmap):nullptr;
    const bool copied=bitmap&&pixels&&BitBlt(memory,0,0,width,height,dc,origin.x,origin.y,SRCCOPY|CAPTUREBLT);GdiFlush();
    unsigned glyphs=0;
    if(copied){
      const auto bytes=static_cast<unsigned char const*>(pixels);
      const auto greenAt=[&](LONG x,LONG y){const auto color=bytes+4*(y*width+x);return color[2]<35&&color[1]>170&&color[0]>35&&color[0]<110;};
      // The fixture's cursorWidth is 2 logical pixels. Native scale is backing
      // metadata, independent of the Core/TSF caret rectangle being compared.
      const auto caretWidth=static_cast<LONG>(std::ceil(2*(surface?surface->scale:1)))+1;
      for(LONG y=0;y<height;++y)for(LONG x=0;x<width;){
        if(!greenAt(x,y)){++x;continue;}const auto start=x;while(x<width&&greenAt(x,y))++x;
        auto& bounds=x-start<=caretWidth?green:underline;auto& total=x-start<=caretWidth?count:underlinePixels;
        bounds.left=std::min(bounds.left,origin.x+start);bounds.top=std::min(bounds.top,origin.y+y);bounds.right=std::max(bounds.right,origin.x+x);bounds.bottom=std::max(bounds.bottom,origin.y+y+1);total+=static_cast<unsigned>(x-start);
      }
      if(count)for(LONG y=std::max(0L,green.top-origin.y-8);y<std::min(height,green.bottom-origin.y+8);++y)for(LONG x=std::max(0L,green.left-origin.x-200);x<std::min(width,green.right-origin.x+200);++x){const auto color=bytes+4*(y*width+x);if(color[0]>180&&color[1]>180&&color[2]>180)++glyphs;}
    }
    if(previous)SelectObject(memory,previous);if(bitmap)DeleteObject(bitmap);if(memory)DeleteDC(memory);ReleaseDC(nullptr,dc);if(!copied)throw std::runtime_error("Screen pixel capture failed");
    result.emplace("glyphPixels",double(glyphs));if(underlinePixels)result["composingPaint"]=RN::JSValueObject{{"left",underline.left},{"top",underline.top},{"right",underline.right},{"bottom",underline.bottom},{"pixels",double(underlinePixels)}};if(count)result["green"]=RN::JSValueObject{{"left",green.left},{"top",green.top},{"right",green.right},{"bottom",green.bottom},{"pixels",double(count)}};return result;
  });}
  REACT_METHOD(complete)
  void complete(bool ok,std::string message)noexcept{auto current=context;current.UIDispatcher().Post([current,ok,message=std::move(message)]()mutable{if(finished)return;try{restoreImeMode();}catch(std::exception const& error){ok=false;message+="; native input probe restoration failed: "+std::string(error.what());}finished=true;passed=ok;std::cout<<(ok?"PASS-input-surface: ":"FAIL-input-surface: ")<<message<<std::endl;
    const auto close=current.Properties().Get(Nelyx::PlatformCloseRequestProperty());
    if(!ok||!closeProducerProbe){if(closeProducerProbe)closeProducerProbe->unblock();if(close)(*close)();return;}
    const auto probe=closeProducerProbe;probe->deadline=std::chrono::steady_clock::now()+std::chrono::seconds(3);
    probe->timer=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread().CreateTimer();probe->timer.Interval(std::chrono::milliseconds(5));
    probe->tick=probe->timer.Tick([probe,close](auto const&,auto const&){
      bool admitted=false;for(const auto& entry:probe->session->frameTrace.drain())if(entry.stage==0)admitted=true;
      if(!admitted&&std::chrono::steady_clock::now()<probe->deadline)return;
      probe->timer.Stop();probe->timer.Tick(probe->tick);probe->timer=nullptr;
      if(!admitted){passed=false;probe->session->fail("Close producer probe did not admit a native frame");}
      std::cout<<"INPUT_CLOSE_PRODUCER admitted="<<admitted<<" before="<<probe->session->status().phase<<std::endl;
      if(close)(*close)();std::cout<<"INPUT_CLOSE_PRODUCER after="<<probe->session->status().phase<<std::endl;
      probe->unblock();closeProducerProbe.reset();
    });probe->timer.Start();
  });}
  REACT_METHOD(beginCloseProducerProbe)
  void beginCloseProducerProbe(RN::ReactPromise<bool> promise)noexcept{auto current=context;current.UIDispatcher().Post([current,promise]{try{
    if(closeProducerProbe)throw std::runtime_error("Close producer probe already owns the worker gate");
    const auto value=current.Properties().Get(RNSkia::WindowsCompositionSessionProperty());if(!value||!*value)throw std::runtime_error("Native close probe session unavailable");
    const auto probe=std::make_shared<CloseProducerProbe>();probe->session=*value;const auto released=probe->release.get_future().share();
    closeProducerProbe=probe;probe->deadline=std::chrono::steady_clock::now()+std::chrono::seconds(5);
    probe->timer=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread().CreateTimer();probe->timer.Interval(std::chrono::milliseconds(5));
    probe->tick=probe->timer.Tick([probe,released,promise](auto const&,auto const&){
      // Gate the next producer only after the preceding packet's retirement.
      // Blocking an old consumer fence would prevent any new stage0 admission.
      if(probe->session->frameTrace.pending()&&std::chrono::steady_clock::now()<probe->deadline)return;
      probe->timer.Stop();probe->timer.Tick(probe->tick);probe->timer=nullptr;
      if(probe->session->frameTrace.pending()||probe->session->status().phase!="active"){probe->unblock();closeProducerProbe.reset();promise.Reject("Native close probe could not reach idle");return;}
      probe->session->frameTrace.drain();
      probe->session->gpuWorker()->post([probe,released]{if(released.wait_for(std::chrono::seconds(5))!=std::future_status::ready)probe->session->fail("Close producer worker gate timed out");});promise.Resolve(true);
    });probe->timer.Start();
  }catch(std::exception const& error){promise.Reject(error.what());}});}
};
struct Provider:winrt::implements<Provider,RN::IReactPackageProvider>{void CreatePackage(RN::IReactPackageBuilder const& builder)noexcept{AddAttributedModules(builder,true);RNSkia::RegisterWindowsSkiaView(builder);Nelyx::WindowsSemantics::RegisterSemanticsComponent(builder);}};
}
int main(int argc,char** argv){
  if(argc==3&&std::string_view(argv[1])=="--debug")return debugChild(argv[2]);
  if(argc!=2)return 2;std::set_terminate(terminateTrace);winrt::init_apartment(winrt::apartment_type::single_threaded);SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);const auto foreground=GetForegroundWindow();
  RNSkia::WindowsReactApp app;auto settings=app.ReactNativeHost().InstanceSettings();settings.PackageProviders().Append(winrt::make<Provider>());settings.BundleRootPath(winrt::to_hstring(std::string("file://")+argv[1]+"/"));settings.JavaScriptBundleFile(L"input-surface");settings.UseDeveloperSupport(false);settings.UseFastRefresh(false);settings.UseDirectDebugger(false);settings.NativeLogger([](auto level,auto const& value){std::cerr<<"RNW "<<int(level)<<" "<<winrt::to_string(value)<<std::endl;});
  window=app.AppWindow();window.Resize({600,300});window.Title(L"Nelyx actual Skia input surface regression");app.ReactViewOptions().ComponentName(L"NelyxInputSurfaceFixture");
  wchar_t selectedEngine[16]{};GetEnvironmentVariableW(L"NELYX_WINDOWS_INPUT_ENGINE",selectedEngine,16);settings.JSIEngineOverride(std::wstring_view(selectedEngine)==L"v8"?RN::JSIEngine::V8:RN::JSIEngine::Hermes);
  auto host=RNSkia::WindowsAppHost::install(settings,window,app.ReactNativeWindow(),[](std::string const& value){std::cout<<value<<std::endl;if(value.find("closed views=0 consumers=0 gpuDrained=1 inputRetired=1")!=std::string::npos)closed=true;});
  RN::ReactPropertyBag bag(settings.Properties());const auto resolver=*bag.Get(TextInputSurfaceResolverProperty());bag.Set(TextInputSurfaceResolverProperty(),TextInputSurfaceResolver{[resolver](RN::IReactContext const& context,uint64_t tag,Owner const& owner){auto mapping=resolver(context,tag,owner);const auto screen=mapping.screenRect;mapping.screenRect=[screen](Rect const& rect,CoreGeometry const& frame){auto result=screen(rect,frame);observation=Observation{rect,frame,result};return result;};return mapping;}});
  auto timer=winrt::Microsoft::UI::Dispatching::DispatcherQueue::GetForCurrentThread().CreateTimer();timer.Interval(std::chrono::seconds(90));timer.IsRepeating(false);const auto token=timer.Tick([](auto const&,auto const&){try{restoreImeMode();}catch(std::exception const& error){std::cerr<<"Input probe restore: "<<error.what()<<std::endl;}std::cerr<<"FAIL-input-surface: native watchdog expired; no close qualification"<<std::endl;ExitProcess(2);});timer.Start();app.Start();timer.Stop();timer.Tick(token);restoreImeMode();window=nullptr;if(foreground&&IsWindow(foreground))SetForegroundWindow(foreground);
  wchar_t executionMode[16]{};GetEnvironmentVariableW(L"NELYX_WINDOWS_INPUT_HERMES_MODE",executionMode,16);
  if(std::wstring_view(executionMode)==L"aot"||std::wstring_view(executionMode)==L"static-aot"){if(!GetModuleHandleW(L"NelyxApp.aot.dll")){std::cerr<<"FAIL-input-surface: native SHUnit was not loaded"<<std::endl;return 2;}std::cout<<"INPUT_AOT_NATIVE module=loaded"<<std::endl;}
  return finished&&passed&&closed?0:1;
}
