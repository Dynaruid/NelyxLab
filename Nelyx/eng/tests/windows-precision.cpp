// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/native/host/windows/WindowsPrecisionTrackpad.h"
#include <iostream>
int main(){
  HWND window=nullptr;
  try{
    winrt::init_apartment(winrt::apartment_type::single_threaded);
    window=CreateWindowExW(0,L"STATIC",L"Nelyx precision owner",WS_OVERLAPPEDWINDOW,0,0,640,480,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    if(!window)throw std::runtime_error("Precision test HWND unavailable");
    unsigned events=0;
    auto precision=RNSkia::WindowsPrecisionTrackpad::create(window,[](POINT point){return std::optional<RNSkia::WindowsPrecisionPoint>{{double(point.x),double(point.y),1,1}};},
      [&](const auto&){++events;},[](auto job){job();});
    if(precision->ownsWheel())throw std::runtime_error("Idle viewport suppressed fallback wheel");
    precision->cancel();precision.reset();DestroyWindow(window);window=nullptr;
    if(events)throw std::runtime_error("Idle initialization manufactured physical input");
    std::cout<<"PASS precision initialized=1 retired=1 physicalInput=unobserved"<<std::endl;return 0;
  }catch(std::exception const& error){if(window)DestroyWindow(window);std::cerr<<error.what()<<std::endl;return 1;}
  catch(winrt::hresult_error const& error){if(window)DestroyWindow(window);std::cerr<<winrt::to_string(error.message())<<std::endl;return 1;}
}
