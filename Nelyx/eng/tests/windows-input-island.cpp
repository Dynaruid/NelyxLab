// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#undef GetCurrentTime
#include <TextInputIsland.h>
#include <TextInputStore.h>
#include <TextInputContext.h>
#include <TextInputHost.h>
#include <TextInputSession.h>
#include <WindowsAppHost.h>
#include <winrt/Microsoft.UI.Composition.h>
#include <winrt/Microsoft.UI.Dispatching.h>
#include <winrt/Microsoft.UI.Interop.h>
#include <winrt/Microsoft.UI.Windowing.h>
#include <Microsoft.UI.Dispatching.Interop.h>
#include <deque>
#include <dbghelp.h>
#include <iostream>

using namespace Nelyx::WindowsInput;
void require(bool value,char const* message){if(!value)throw std::runtime_error(message);}
struct Window {
  HWND handle=nullptr;
  Window(){WNDCLASSW type{};type.lpfnWndProc=DefWindowProcW;type.hInstance=GetModuleHandleW(nullptr);type.lpszClassName=L"NelyxInputIslandTest";if(!RegisterClassW(&type)&&GetLastError()!=ERROR_CLASS_ALREADY_EXISTS)throw std::runtime_error("Register input island window");handle=CreateWindowExW(0,type.lpszClassName,L"Nelyx input transport test",WS_OVERLAPPEDWINDOW,80,100,320,180,nullptr,nullptr,type.hInstance,nullptr);require(handle!=nullptr,"Create input island window");}
  ~Window(){if(handle)DestroyWindow(handle);UnregisterClassW(L"NelyxInputIslandTest",GetModuleHandleW(nullptr));}
};
LONG WINAPI reportNativeException(EXCEPTION_POINTERS* error){
  const auto process=GetCurrentProcess();SymInitialize(process,nullptr,TRUE);CONTEXT context=*error->ContextRecord;STACKFRAME64 frame{};frame.AddrPC.Offset=context.Rip;frame.AddrFrame.Offset=context.Rbp;frame.AddrStack.Offset=context.Rsp;frame.AddrPC.Mode=frame.AddrFrame.Mode=frame.AddrStack.Mode=AddrModeFlat;
  std::cerr<<"Native exception 0x"<<std::hex<<error->ExceptionRecord->ExceptionCode<<std::dec<<'\n';
  for(unsigned index=0;index<24&&frame.AddrPC.Offset;index++){
    alignas(SYMBOL_INFO) char buffer[sizeof(SYMBOL_INFO)+MAX_SYM_NAME]{};auto symbol=reinterpret_cast<SYMBOL_INFO*>(buffer);symbol->SizeOfStruct=sizeof(SYMBOL_INFO);symbol->MaxNameLen=MAX_SYM_NAME;DWORD64 displacement=0;HMODULE module=nullptr;wchar_t name[MAX_PATH]{};GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(frame.AddrPC.Offset),&module);GetModuleFileNameW(module,name,MAX_PATH);
    std::cerr<<index<<" "<<winrt::to_string(name)<<"+0x"<<std::hex<<(frame.AddrPC.Offset-reinterpret_cast<DWORD64>(module))<<std::dec;if(SymFromAddr(process,frame.AddrPC.Offset,&displacement,symbol))std::cerr<<" "<<symbol->Name<<"+"<<displacement;std::cerr<<'\n';
    if(!StackWalk64(IMAGE_FILE_MACHINE_AMD64,process,GetCurrentThread(),&frame,&context,nullptr,SymFunctionTableAccess64,SymGetModuleBase64,nullptr))break;
  }
  SymCleanup(process);return EXCEPTION_EXECUTE_HANDLER;
}
void testWindowsInputSession(winrt::Microsoft::UI::Content::ContentIsland const&,winrt::Microsoft::UI::Content::DesktopChildSiteBridge const&,HWND);
void testWindowsInputProtocol(winrt::Microsoft::UI::Content::ContentIsland const&,HWND);
void testWindowsInputService(winrt::Microsoft::UI::Content::ContentIsland const&,HWND);
void testWindowsCompositionCoordinates(winrt::Microsoft::UI::Content::ContentIsland const&,winrt::Microsoft::UI::Composition::SpriteVisual const&,HWND);
int runWindowsInputBridge(winrt::hstring const&);
int main(int argc,char** argv){
  SetUnhandledExceptionFilter(reportNativeException);
  try{
    if(argc==2)return runWindowsInputBridge(winrt::to_hstring(argv[1]));
    winrt::init_apartment(winrt::apartment_type::single_threaded);SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    auto dispatcher=winrt::Microsoft::UI::Dispatching::DispatcherQueueController::CreateOnCurrentThread();
    {
      std::cerr<<"input-island: manual window\n";
      Window window;auto compositor=winrt::Microsoft::UI::Composition::Compositor();auto visual=compositor.CreateSpriteVisual();visual.Size({320,180});
      auto island=winrt::Microsoft::UI::Content::ContentIsland::Create(visual);
      auto bridge=winrt::Microsoft::UI::Content::DesktopChildSiteBridge::Create(compositor,winrt::Microsoft::UI::GetWindowIdFromWindow(window.handle));bridge.Connect(island);bridge.MoveAndResize({0,0,320,180});bridge.Show();
      ShowWindow(window.handle,SW_SHOWNOACTIVATE);const auto focus=winrt::Microsoft::UI::Input::InputFocusController::GetForIsland(island);require(focus.TrySetFocus(),"Actual content island did not receive input focus");
      const auto inputWindow=GetFocus();require(inputWindow&&(inputWindow==window.handle||IsChild(window.handle,inputWindow)),"Content island input HWND is outside its host window");
      testWindowsCompositionCoordinates(island,visual,window.handle);
      std::cerr<<"input-island: TSF owner\n";
      auto thread=TextInputThread::create();std::deque<std::function<void()>> posts;std::vector<std::string> failures;std::unique_ptr<TextInputContext> context;
      TextStoreCallbacks callbacks;callbacks.changed=[](TextStoreEvent const&){};callbacks.failed=[&](std::string const& message){failures.push_back(message);};callbacks.post=[&](std::function<void()> callback){posts.push_back(std::move(callback));};
      callbacks.screenRect=[&](Rect const& rect,CoreGeometry const&)->std::optional<ScreenRect>{auto mapped=island.CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Rect{float(rect.x),float(rect.y),float(rect.width),float(rect.height)});return RECT{mapped.X,mapped.Y,mapped.X+mapped.Width,mapped.Y+mapped.Height};};
      callbacks.characterBounds=[](int32_t,int32_t,uint64_t,uint64_t){};callbacks.hitPosition=[](POINT,DWORD,uint64_t,uint64_t){};callbacks.terminateComposition=[&](ITfCompositionView* view){return context?context->terminateComposition(view):E_UNEXPECTED;};
      auto store=Microsoft::WRL::Make<TextInputStore>(inputWindow,Owner{"island",1},L"Core",Selection{4,4},size_t{128},IS_DEFAULT,std::move(callbacks));context=thread->attach(inputWindow,store.Get());context->associateFocus();
      unsigned calls=0;bool consume=false,throwOnCall=false;std::shared_ptr<TextInputIsland> transport;
      transport=TextInputIsland::create(island,[&](MSG const& message){calls++;require(message.hwnd==inputWindow,"Pre-translation fabricated an input HWND");if(throwOnCall)throw std::runtime_error("controlled filter failure");return consume||thread->filterKeyMessage(message);},[&](std::string const& message){failures.push_back(message);});
      MSG message{};message.hwnd=inputWindow;message.message=WM_KEYDOWN;message.wParam=VK_F24;message.lParam=1;
      require(!ContentPreTranslateMessage(&message)&&calls==1,"Unhandled TSF key did not retain native routing");consume=true;require(ContentPreTranslateMessage(&message)&&calls==2,"Consumed pre-translation key reached native routing");
      consume=false;message.message=WM_KEYUP;require(!ContentPreTranslateMessage(&message)&&calls==3,"Unhandled TSF key-up did not retain native routing");
      throwOnCall=true;ContentPreTranslateMessage(&message);require(failures.size()==1&&calls==4,"Failed filter was not reported exactly once");ContentPreTranslateMessage(&message);require(calls==4,"A failed filter continued reading native input");transport->close();transport->close();transport.reset();
      bool closedInside=false;transport=TextInputIsland::create(island,[&](MSG const&){closedInside=true;transport->close();return true;},[&](std::string const& error){failures.push_back(error);});
      require(ContentPreTranslateMessage(&message)&&closedInside,"Reentrant close lost an actual consumed result");transport.reset();
      context->close();context.reset();store->close();posts.clear();thread->close();thread.reset();
      std::cerr<<"input-island: session endpoint\n";testWindowsInputSession(island,bridge,inputWindow);
      std::cerr<<"input-island: wire endpoint\n";testWindowsInputProtocol(island,inputWindow);
      std::cerr<<"input-island: RNW service\n";testWindowsInputService(island,inputWindow);
      {
        std::cerr<<"input-island: RNW owner\n";
        using namespace winrt::Microsoft::ReactNative;
        auto nativeWindow=ReactNativeWindow::CreateFromCompositor(compositor);auto settings=ReactInstanceSettings();
        std::cerr<<"input-island: install RNW owner\n";
        auto root=installTextInputRoot(settings,nativeWindow,[&](std::string const& error){failures.push_back(error);});
        const auto nativeBridge=nativeWindow.ContentSiteBridge().as<winrt::Microsoft::UI::Content::DesktopSiteBridge>();
        require(root->window()==winrt::Microsoft::UI::GetWindowFromWindowId(nativeBridge.WindowId()),"RNW root used another input HWND");require(root->window()!=winrt::Microsoft::UI::GetWindowFromWindowId(nativeWindow.AppWindow().Id()),"RNW root substituted the top-level HWND for the input child");
        const auto retained=ReactPropertyBag(settings.Properties()).Get(TextInputRootProperty());require(retained&&*retained==root,"RNW property bag lost the input owner");
        bool rejected=false;try{installTextInputRoot(settings,nativeWindow,[](std::string const&){});}catch(std::logic_error const&){rejected=true;}require(rejected,"A second root overwrote the island input handler");
        TextStoreCallbacks ownerCallbacks;ownerCallbacks.changed=[](TextStoreEvent const&){};ownerCallbacks.failed=[&](std::string const& error){failures.push_back(error);};ownerCallbacks.post=[&](std::function<void()> callback){posts.push_back(std::move(callback));};ownerCallbacks.screenRect=[](Rect const&,CoreGeometry const&)->std::optional<ScreenRect>{return std::nullopt;};ownerCallbacks.characterBounds=[](int32_t,int32_t,uint64_t,uint64_t){};ownerCallbacks.hitPosition=[](POINT,DWORD,uint64_t,uint64_t){};ownerCallbacks.terminateComposition=[](ITfCompositionView*){return E_UNEXPECTED;};
        auto ownerStore=Microsoft::WRL::Make<TextInputStore>(root->window(),Owner{"root",1},L"retire",Selection{6,6},size_t{128},IS_DEFAULT,std::move(ownerCallbacks));auto ownerContext=root->thread()->attach(root->window(),ownerStore.Get());
        bool clientRetired=false,reentrantRejected=false;TextInputRoot::ClientId client=0;
        client=root->registerClient([&](std::string const& error){require(error.empty(),"A normal close invented an input failure");try{root->close();}catch(std::logic_error const&){reentrantRejected=true;}ownerContext->close();ownerStore->close();root->unregisterClient(client);clientRetired=true;});
        std::cerr<<"input-island: drain clients\n";
        const auto unacknowledged=root->registerClient([](std::string const&){});rejected=false;try{root->close();}catch(std::logic_error const&){rejected=true;}require(rejected&&clientRetired&&reentrantRejected,"Input root acknowledged an undrained/reentrant provider");
        rejected=false;try{root->registerClient([](std::string const&){});}catch(std::logic_error const&){rejected=true;}require(rejected,"A retiring root admitted a new input provider");root->unregisterClient(unacknowledged);root->close();root->close();ownerContext.reset();ownerStore.Reset();posts.clear();
        require(failures.size()==1,"RNW root produced an unexpected input failure");nativeWindow.Close();root.reset();
      }
      std::cerr<<"input-island: close manual window\n";
      bridge.Close();island.Close();visual=nullptr;compositor.Close();
    }
    std::cerr<<"input-island: shutdown dispatcher\n";
    dispatcher.ShutdownQueue();
    std::cout<<"PASS-scoped: actual WinAppSDK ContentIsland input HWND, TSF context association, ContentPreTranslateMessage pass-through/consumption, error retirement, handler detach/reentrant close, actual RNW window/property owner, provider drain rejection/retry and context retirement. Consumed results are controlled; default provider/Core transport/physical IME remain notVerified.\n";return 0;
  }catch(winrt::hresult_error const& error){std::cerr<<"WinAppSDK input failure 0x"<<std::hex<<static_cast<unsigned long>(error.code().value)<<": "<<winrt::to_string(error.message())<<'\n';return 1;}
  catch(std::exception const& error){std::cerr<<error.what()<<'\n';return 1;}
}
