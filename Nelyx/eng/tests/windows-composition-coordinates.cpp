// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#undef GetCurrentTime
#include <winrt/Microsoft.UI.Content.h>
#include <winrt/Microsoft.UI.Composition.h>
#include <winrt/Windows.UI.h>
#include <dwmapi.h>
#include <iostream>
#include <chrono>

void testWindowsCompositionCoordinates(winrt::Microsoft::UI::Content::ContentIsland const& island,winrt::Microsoft::UI::Composition::SpriteVisual const& root,HWND window){
  auto compositor=root.Compositor();auto parent=compositor.CreateContainerVisual();parent.Size({120,40});parent.Offset({13,7,0});auto marker=compositor.CreateSpriteVisual();marker.Size({20,20});marker.Brush(compositor.CreateColorBrush(winrt::Windows::UI::Color{255,255,0,0}));parent.Children().InsertAtTop(marker);root.Children().InsertAtTop(parent);
  auto source=compositor.CreatePropertySet();source.InsertVector3(L"position",{80,7,0});auto expression=compositor.CreateExpressionAnimation(L"source.position");expression.SetReferenceParameter(L"source",source);parent.StartAnimation(L"Offset",expression);
  ShowWindow(window,SW_SHOW);SetForegroundWindow(window);const auto point=island.CoordinateConverter().ConvertLocalToScreen(winrt::Windows::Foundation::Point{85,12});bool rendered=false;
  try{
    for(unsigned attempt=0;attempt<24&&!rendered;attempt++){
      MSG message{};while(PeekMessageW(&message,nullptr,0,0,PM_REMOVE)){TranslateMessage(&message);DispatchMessageW(&message);}DwmFlush();const auto screen=GetDC(nullptr);if(!screen)throw std::runtime_error("Desktop pixel observation unavailable");const auto pixel=GetPixel(screen,point.X,point.Y);ReleaseDC(nullptr,screen);rendered=pixel!=CLR_INVALID&&GetRValue(pixel)>200&&GetGValue(pixel)<60&&GetBValue(pixel)<60;if(!rendered)MsgWaitForMultipleObjectsEx(0,nullptr,20,QS_ALLINPUT,MWMO_INPUTAVAILABLE);
    }
    const auto getter=parent.Offset();winrt::Windows::Foundation::Numerics::float3 property{};const auto result=parent.Properties().TryGetVector3(L"Offset",property);const auto controller=parent.TryGetAnimationController(L"Offset");
    std::cout<<"COORDINATE-READBACK: expression screen-marker="<<(rendered?"observed":"notVerified")<<" base=13 animated=80 getter="<<getter.x<<" property-status="<<int(result)<<" property-x="<<property.x<<" controller="<<bool(controller)<<". Native visual readback is diagnostic; no Skia/IME qualification.\n";
    if(rendered&&getter.x==13&&!controller)std::cout<<"COORDINATE-LIMIT: an active expression changes rendered position while the getter retains its base value and TryGetAnimationController is null. These APIs cannot admit native parent animation coordinates.\n";
    parent.StopAnimation(L"Offset");root.Children().Remove(parent);marker.Close();parent.Close();source.Close();expression.Close();
  }catch(...){parent.StopAnimation(L"Offset");root.Children().Remove(parent);throw;}
}
