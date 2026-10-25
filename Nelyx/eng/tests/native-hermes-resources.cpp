// SPDX-License-Identifier: BSD-3-Clause
#include "SemanticsTree.h"
#include "MemoryProbe.h"
#include "native-memory-regions.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <optional>
void require(bool,char const*);
namespace WS=Nelyx::WindowsSemantics;
namespace NH=Nelyx::NativeHermes;
using namespace std::chrono_literals;

// Exercise the actual delivered gallery without another JS entry or AOT image.
int nativeUiaResourceClient(char const* pidValue,char const* cyclesValue,char const* viewportValue)try{
  const auto integer=[](char const* text){const std::string value(text);require(!value.empty()&&std::all_of(value.begin(),value.end(),[](char c){return c>='0'&&c<='9';}),"Resource probe requires explicit decimal values");return std::stoull(value);};
  const auto pid=integer(pidValue),cycles=integer(cyclesValue);const std::string viewport(viewportValue);
  require(pid>0&&pid<=MAXDWORD&&cycles>=3&&cycles<=30&&(viewport=="default"||viewport=="maximized"),"Invalid bounded resource probe options");
  struct Target{DWORD pid;HWND window=nullptr;int matches=0;}target{DWORD(pid)};
  EnumWindows([](HWND window,LPARAM context)->BOOL{auto& target=*reinterpret_cast<Target*>(context);DWORD pid=0;GetWindowThreadProcessId(window,&pid);wchar_t name[64]{};GetClassNameW(window,name,64);if(pid==target.pid&&IsWindowVisible(window)&&std::wstring(name)==L"NelyxHermesHost"){target.window=window;++target.matches;}return TRUE;},reinterpret_cast<LPARAM>(&target));
  require(target.matches==1&&GetForegroundWindow()==target.window,"Resource probe requires one owned foreground window");
  struct Process{HANDLE value;~Process(){if(value)CloseHandle(value);}}process{OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,FALSE,DWORD(pid))};require(process.value&&GetProcessId(process.value)==pid,"Resource address-space owner is unavailable");
  std::optional<Nelyx::NativeMemory::Regions> previous;
  const auto regions=[&](uint32_t cycle){namespace NM=Nelyx::NativeMemory;const auto before=NM::privateCommit(process.value),begin=GetTickCount64();auto current=NM::query(process.value);const auto elapsed=GetTickCount64()-begin,after=NM::privateCommit(process.value);require(elapsed<=NM::scanBudgetMs,"External address-space observation exceeded its time bound");const auto changes=previous?NM::compare(*previous,current):NM::Changes{};
    std::cout<<"NELYX_NATIVE_MEMORY_REGIONS {\"schema\":1,\"scope\":\"external-non-atomic-address-space\",\"cycle\":"<<cycle<<",\"pid\":"<<pid<<",\"complete\":true,\"atomic\":false,\"copyOnWritePrivatePages\":\"notClassified\",\"allocationOwner\":\"unknown\",\"scanMs\":"<<elapsed<<",\"queries\":"<<current.queries<<",\"allocationBases\":"<<current.allocations.size()<<",\"privateCommittedBytes\":"<<current.privateCommitted<<",\"privateReservedBytes\":"<<current.privateReserved<<",\"imageCommittedBytes\":"<<current.imageCommitted<<",\"mappedCommittedBytes\":"<<current.mappedCommitted<<",\"otherCommittedBytes\":"<<current.otherCommitted<<",\"privateBeforeBytes\":"<<before<<",\"privateAfterBytes\":"<<after<<",\"newBases\":"<<changes.newBases<<",\"missingBases\":"<<changes.missingBases<<",\"grownBases\":"<<changes.grownBases<<",\"shrunkBases\":"<<changes.shrunkBases<<",\"newBaseCommittedBytes\":"<<changes.newCommitted<<",\"missingBaseCommittedBytes\":"<<changes.missingCommitted<<",\"sameBaseAddedBytes\":"<<changes.addedAtSameBase<<",\"sameBaseReleasedBytes\":"<<changes.releasedAtSameBase<<",\"largest\":[";
    for(size_t index=0;index<changes.largest.size();++index){auto const& change=changes.largest[index];if(index)std::cout<<",";std::cout<<"{\"committedDelta\":"<<change.committedDelta<<",\"committedBytes\":"<<change.committed<<",\"reservedBytes\":"<<change.reserved<<",\"allocationProtect\":"<<change.protection<<",\"sameBase\":"<<(change.sameBase?"true":"false")<<"}";}std::cout<<"]}\n";previous=std::move(current);
  };
  ShowWindow(target.window,viewport=="maximized"?SW_MAXIMIZE:SW_RESTORE);
  require(bool(IsZoomed(target.window))==(viewport=="maximized"),"Resource viewport did not reach its requested window state");
  WS::checked(CoInitializeEx(nullptr,COINIT_MULTITHREADED));struct Apartment{~Apartment(){CoUninitialize();}}apartment;
  Microsoft::WRL::ComPtr<IUIAutomation> automation;WS::checked(CoCreateInstance(__uuidof(CUIAutomation8),nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&automation)));
  Microsoft::WRL::ComPtr<IUIAutomation2> bounded;WS::checked(automation.As(&bounded));WS::checked(bounded->put_ConnectionTimeout(3000));WS::checked(bounded->put_TransactionTimeout(3000));
  Microsoft::WRL::ComPtr<IUIAutomationElement> root;WS::checked(automation->ElementFromHandle(target.window,&root));
  struct Cursor{POINT before{},last{};bool active=false;~Cursor(){POINT current{};if(active&&GetCursorPos(&current)&&current.x==last.x&&current.y==last.y)SetCursorPos(before.x,before.y);}}cursor;
  require(GetCursorPos(&cursor.before),"Cannot save owned resource probe cursor");RECT rect{};require(GetClientRect(target.window,&rect),"Resource window client missing");
  cursor.last={rect.right*3/4,rect.bottom*3/4};require(ClientToScreen(target.window,&cursor.last)&&GetAncestor(WindowFromPoint(cursor.last),GA_ROOT)==target.window&&SetCursorPos(cursor.last.x,cursor.last.y),"Resource probe point escaped its window");cursor.active=true;
  const auto guard=[&]{POINT current{};require(GetForegroundWindow()==target.window&&GetCursorPos(&current)&&current.x==cursor.last.x&&current.y==cursor.last.y,"Desktop focus or pointer intruded during resource probe");for(const auto key:{VK_LBUTTON,VK_RBUTTON,VK_MBUTTON,VK_XBUTTON1,VK_XBUTTON2,VK_SHIFT,VK_CONTROL,VK_MENU,VK_LWIN,VK_RWIN})require(!(GetAsyncKeyState(key)&0x8000),"Desktop buttons intruded during resource probe");};
  const auto visible=[&](wchar_t const* id){WS::AutomationVariant value;value.string(id);Microsoft::WRL::ComPtr<IUIAutomationCondition> condition;WS::checked(automation->CreatePropertyCondition(UIA_AutomationIdPropertyId,value.data,&condition));Microsoft::WRL::ComPtr<IUIAutomationElement> element;WS::checked(root->FindFirst(TreeScope_Descendants,condition.Get(),&element));if(element){BOOL off=TRUE;const auto status=element->get_CurrentIsOffscreen(&off);if(status==UIA_E_ELEMENTNOTAVAILABLE)return Microsoft::WRL::ComPtr<IUIAutomationElement>{};WS::checked(status);if(off)return Microsoft::WRL::ComPtr<IUIAutomationElement>{};}return element;};
  const auto until=[&](auto predicate,char const* message){const auto end=std::chrono::steady_clock::now()+10s;do{guard();if(predicate())return;std::this_thread::sleep_for(32ms);}while(std::chrono::steady_clock::now()<end);throw std::runtime_error(message);};
  const auto activate=[&](wchar_t const* id){Microsoft::WRL::ComPtr<IUIAutomationElement> element;until([&]{element=visible(id);return bool(element);},"Product button did not become visible");Microsoft::WRL::ComPtr<IUIAutomationInvokePattern> action;WS::checked(element->GetCurrentPatternAs(UIA_InvokePatternId,IID_PPV_ARGS(&action)));WS::checked(action->Invoke());};
  const auto request=[&](WPARAM cycle,LPARAM reserved=0){DWORD_PTR result=0;require(SendMessageTimeoutW(target.window,NH::memoryProbeMessage,cycle,reserved,SMTO_ABORTIFHUNG|SMTO_BLOCK,5000,&result),"Resource observation request timed out");return result;};
  const auto wheel=[&](int delta){for(int packet=0;packet<16;++packet){guard();INPUT value{};value.type=INPUT_MOUSE;value.mi.dwFlags=MOUSEEVENTF_WHEEL;value.mi.mouseData=DWORD(delta);value.mi.dwExtraInfo=NH::memoryProbeWheelCookie;require(SendInput(1,&value,sizeof(value))==1,"Resource scroll wheel was not delivered");std::this_thread::sleep_for(16ms);}};
  std::this_thread::sleep_for(750ms);until([&]{return bool(visible(L"show-list-view"))&&!visible(L"list-view-back");},"Resource baseline is not the real gallery");
  require(!request(1)&&!request(0,1)&&!request(31),"Resource request admitted invalid order, payload or count");require(request(0)==1&&!request(0),"Resource baseline was not admitted exactly once");
  std::this_thread::sleep_for(150ms);
  guard();regions(0);guard();
  for(uint32_t cycle=1;cycle<=cycles;++cycle){
    activate(L"show-list-view");until([&]{return bool(visible(L"list-view-item-0"));},"ListView first row did not materialize");
    wheel(-120);until([&]{return !visible(L"list-view-item-0");},"Cold wheel scroll did not leave the first row");
    wheel(120);until([&]{return bool(visible(L"list-view-item-0"));},"Revisit wheel scroll did not return to the first row");
    activate(L"list-view-last");until([&]{return bool(visible(L"list-view-item-999"));},"ListView last row did not materialize");
    activate(L"list-view-first");until([&]{return bool(visible(L"list-view-item-0"));},"ListView first-row boundary did not return");
    activate(L"list-view-back");until([&]{return bool(visible(L"show-list-view"))&&!visible(L"list-view-back");},"ListView route did not return to the gallery");
    std::this_thread::sleep_for(750ms);guard();require(request(cycle)==1,"Returned resource observation was rejected");
    std::cout<<"NELYX_NATIVE_MEMORY_WORKLOAD {\"cycle\":"<<cycle<<",\"pid\":"<<pid<<",\"cold\":true,\"revisit\":true,\"last\":true,\"first\":true,\"returnedToGallery\":true,\"wheelPackets\":32,\"wheelRawNet\":0,\"wheelRawAbsolute\":3840}\n";
    std::this_thread::sleep_for(150ms);
    guard();regions(cycle);guard();
  }
  require(!request(31),"Resource observation exceeded its bound");return 0;
}catch(std::exception const& error){std::cerr<<"NELYX_NATIVE_MEMORY_CLIENT_ERROR "<<error.what()<<"\n";return 1;}
