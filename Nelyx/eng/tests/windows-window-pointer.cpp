// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/packages/rn/native/windows/WindowsWindowPointer.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <thread>
using RNSkia::WindowsWindowPointer;
int main(){
 SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
 WNDCLASSW type{};type.lpfnWndProc=DefWindowProcW;type.hInstance=GetModuleHandleW(nullptr);type.lpszClassName=L"NelyxPointerFixture";assert(RegisterClassW(&type));
 const auto root=CreateWindowW(type.lpszClassName,L"",WS_OVERLAPPEDWINDOW,100,100,600,500,nullptr,nullptr,type.hInstance,nullptr);assert(root);
 const auto child=CreateWindowW(type.lpszClassName,L"",WS_CHILD,17,23,400,300,root,nullptr,type.hInstance,nullptr);assert(child);
 const auto other=CreateWindowW(type.lpszClassName,L"",WS_OVERLAPPEDWINDOW,800,100,200,200,nullptr,nullptr,type.hInstance,nullptr);assert(other);
 std::string failure;auto source=WindowsWindowPointer::create(root,child,[&](std::string value){failure=std::move(value);});
 struct Sample{std::string kind;WindowsWindowPointer::Point point;};std::vector<Sample> events;
 auto stop=source->listen([&](auto const& kind,auto const& point){events.push_back({kind,point});});
 SendMessageW(other,WM_MOUSEMOVE,0,MAKELPARAM(10,20));assert(events.empty());
 SendMessageW(child,WM_MOUSEMOVE,0,MAKELPARAM(10,20));assert(events.size()==1&&events.back().kind=="move");
 const auto scale=GetDpiForWindow(root)/96.f;assert(std::abs(events.back().point.x-27/scale)<.01&&std::abs(events.back().point.y-43/scale)<.01);
 SendMessageW(child,WM_LBUTTONDOWN,MK_LBUTTON,MAKELPARAM(10,20));assert(events.back().kind=="down"&&events.back().point.buttons==1);
 SendMessageW(child,WM_MOUSEMOVE,MK_LBUTTON,MAKELPARAM(-30,20));assert(events.back().kind=="move"&&events.back().point.x<0);
 SendMessageW(child,WM_LBUTTONUP,0,MAKELPARAM(-30,20));assert(events.back().kind=="up"&&events.back().point.buttons==0);
 POINT wheel{10,20};assert(ClientToScreen(child,&wheel));SendMessageW(child,WM_MOUSEWHEEL,MAKEWPARAM(0,120),MAKELPARAM(wheel.x,wheel.y));
 assert(events.back().kind=="wheel"&&events.back().point.wheel==120&&!events.back().point.horizontal);assert(std::abs(events.back().point.x-27/scale)<.01);
 SendMessageW(child,WM_RBUTTONDOWN,MK_RBUTTON,MAKELPARAM(10,20));SendMessageW(child,WM_CAPTURECHANGED,0,reinterpret_cast<LPARAM>(other));assert(events.back().kind=="cancel");
 SendMessageW(child,WM_LBUTTONDOWN,MK_LBUTTON,MAKELPARAM(10,20));stop();assert(events.back().kind=="cancel");const auto count=events.size();
 SendMessageW(child,WM_LBUTTONDOWN,MK_LBUTTON,MAKELPARAM(10,20));assert(events.size()==count);
 bool wrongOwner=false;std::thread worker([&]{try{source->listen([](auto const&,auto const&){});}catch(std::logic_error const&){wrongOwner=true;}});worker.join();assert(wrongOwner);
 source->close();source.reset();DestroyWindow(other);DestroyWindow(root);assert(failure.empty());
 std::cout<<"PASS coordinates=1 buttons=1 wheel=1 capture-loss=1 retirement=1 unrelated-window=0 owner-affinity=1\n";
}
