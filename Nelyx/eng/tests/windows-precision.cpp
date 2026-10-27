// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/native/host/windows/WindowsPrecisionTrackpad.h"
#include <iostream>
#include <vector>

namespace RNSkia {
// Drive the native callback protocol deterministically; this does not inject
// physical touchpad contacts or replace the real DirectManipulation viewport.
struct WindowsPrecisionTrackpadTest {
  static void status(WindowsPrecisionTrackpad& owner,DIRECTMANIPULATION_STATUS current,DIRECTMANIPULATION_STATUS previous){owner.status(current,previous);}
  static void content(WindowsPrecisionTrackpad& owner,float x,float y){float transform[]{1,0,0,1,x,y};owner.content(transform);}
  static void update(WindowsPrecisionTrackpad& owner){owner.update();}
  static bool resetting(WindowsPrecisionTrackpad const& owner){return owner.resetting;}
  static bool needsUpdate(WindowsPrecisionTrackpad const& owner){return owner.needsUpdate();}
  static void interaction(WindowsPrecisionTrackpad& owner,DIRECTMANIPULATION_INTERACTION_TYPE type){
    auto callback=owner.handler.as<IDirectManipulationInteractionEventHandler>();
    winrt::check_hresult(callback->OnInteraction(nullptr,type));
  }
};
}

static void require(bool condition,char const* message){if(!condition)throw std::runtime_error(message);}
int main(){
  HWND window=nullptr;
  try{
    winrt::init_apartment(winrt::apartment_type::single_threaded);
    window=CreateWindowExW(0,L"STATIC",L"Nelyx precision owner",WS_OVERLAPPEDWINDOW,0,0,640,480,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    if(!window)throw std::runtime_error("Precision test HWND unavailable");
    std::vector<RNSkia::WindowsPrecisionEvent> events;
    auto precision=RNSkia::WindowsPrecisionTrackpad::create(window,[](POINT point){return std::optional<RNSkia::WindowsPrecisionPoint>{{double(point.x),double(point.y),1,1}};},
      [&](const auto& event){events.push_back(event);},[](auto){});
    if(precision->ownsWheel())throw std::runtime_error("Idle viewport suppressed fallback wheel");
    require(events.empty(),"Idle initialization manufactured physical input");
    using Probe=RNSkia::WindowsPrecisionTrackpadTest;
    Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
    require(Probe::needsUpdate(*precision),"Stationary contact stopped manual updates before RUNNING");
    require(!precision->ownsWheel(),"Stationary contact suppressed fallback wheel");
    Probe::update(*precision);
    require(Probe::needsUpdate(*precision),"Idle viewport status retired a live contact");
    Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_END);
    Probe::update(*precision);
    require(!Probe::needsUpdate(*precision)&&events.empty(),"Ended stationary contact manufactured a gesture or kept polling");
    for(unsigned gesture=0;gesture<12;++gesture){
      const auto before=events.size();
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      require(precision->ownsWheel(),"Active precision gesture did not own wheel");
      Probe::content(*precision,0,-24);
      Probe::status(*precision,DIRECTMANIPULATION_INERTIA,DIRECTMANIPULATION_RUNNING);
      Probe::content(*precision,0,-25);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_INERTIA);
      Probe::update(*precision);
      require(!Probe::resetting(*precision),"Reset remained latched after the viewport was already READY");
      require(!precision->ownsWheel(),"Completed gesture suppressed fallback wheel");
      require(events.size()==before+4,"Repeated gesture lost events or emitted synthetic reset input");
      require(events[before].kind=="panZoomStart"&&events[before+1].kind=="panZoomUpdate"&&events[before+2].kind=="panZoomEnd"&&events[before+3].kind=="inertiaCancel","Gesture contact/inertia order changed");
    }
    for(unsigned gesture=0;gesture<4;++gesture){
      const auto before=events.size();
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      Probe::content(*precision,0,-12);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);
      require(Probe::needsUpdate(*precision),"Gesture without inertia skipped its transform reset");
      Probe::update(*precision);
      require(!Probe::needsUpdate(*precision)&&!precision->ownsWheel(),"Gesture without inertia did not retire");
      require(events.size()==before+3&&events.back().kind=="panZoomEnd","Gesture without inertia emitted reset movement");
      require(events[before+1].deltaY==-12,"New gesture inherited the previous translation");
    }
    {
      const auto before=events.size();
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      Probe::content(*precision,0,-10);
      Probe::status(*precision,DIRECTMANIPULATION_INERTIA,DIRECTMANIPULATION_RUNNING);
      Probe::content(*precision,0,-11);
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_INERTIA);
      Probe::content(*precision,0,-6);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);
      Probe::update(*precision);
      require(events.size()==before+7&&events[before+3].kind=="inertiaCancel"&&events[before+4].kind=="panZoomStart","New contact during inertia lost its start/cancellation order");
      require(!Probe::needsUpdate(*precision),"Interrupted inertia kept polling after completion");
    }
    for(bool inertia:{false,true}){
      Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      Probe::content(*precision,0,-8);
      if(inertia)Probe::status(*precision,DIRECTMANIPULATION_INERTIA,DIRECTMANIPULATION_RUNNING);
      const auto before=events.size();
      precision->cancel();
      require(events.size()==before+1&&events.back().kind==(inertia?"inertiaCancel":"panZoomEnd"),"Cancellation did not retire the active stream exactly once");
      Probe::update(*precision);
      require(!Probe::needsUpdate(*precision)&&!precision->ownsWheel(),"Cancellation retained contacts, reset or wheel ownership");
      const auto cancelled=events.size();precision->cancel();
      require(events.size()==cancelled,"Repeated cancellation emitted a duplicate terminal event");
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      require(events.size()==cancelled+1&&events.back().kind=="panZoomStart","Contact after cancellation did not restart");
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);
      Probe::update(*precision);
    }
    precision->cancel();precision.reset();DestroyWindow(window);window=nullptr;
    std::cout<<"PASS precision initialized=1 retired=1 repeatedGestures=12 stationary=1 noInertia=4 interruptedInertia=1 cancellation=2 physicalInput=unobserved"<<std::endl;return 0;
  }catch(std::exception const& error){if(window)DestroyWindow(window);std::cerr<<error.what()<<std::endl;return 1;}
  catch(winrt::hresult_error const& error){if(window)DestroyWindow(window);std::cerr<<winrt::to_string(error.message())<<std::endl;return 1;}
}
