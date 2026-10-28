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
  static bool interacting(WindowsPrecisionTrackpad const& owner){return owner.interacting;}
  static uint64_t ticks(WindowsPrecisionTrackpad const& owner){return owner.ticks;}
  static void seedNativeTransform(WindowsPrecisionTrackpad& owner){
    RECT rect{};winrt::check_hresult(owner.viewport->GetViewportRect(&rect));owner.resetting=true;++owner.resetSerial;
    winrt::check_hresult(owner.viewport->ZoomToRect(float(rect.left),float(rect.top+48),float(rect.right),float(rect.bottom+48),FALSE));owner.arm();
  }
  static std::pair<float,float> nativeTranslation(WindowsPrecisionTrackpad& owner){winrt::com_ptr<IDirectManipulationContent> content;winrt::check_hresult(owner.viewport->GetPrimaryContent(IID_PPV_ARGS(content.put())));float values[6]{};winrt::check_hresult(content->GetContentTransform(values,6));return {values[4],values[5]};}
  static void resetTransform(WindowsPrecisionTrackpad& owner){owner.resetTransform();}
  static void synthesizedInteraction(WindowsPrecisionTrackpad& owner,DIRECTMANIPULATION_INTERACTION_TYPE type){owner.resetting=true;interaction(owner,type);owner.resetting=false;}
  static bool needsUpdate(WindowsPrecisionTrackpad const& owner){return owner.needsUpdate();}
  static bool prepareContact(WindowsPrecisionTrackpad& owner){return owner.prepareContact();}
  static void interaction(WindowsPrecisionTrackpad& owner,DIRECTMANIPULATION_INTERACTION_TYPE type){
    auto callback=owner.handler.as<IDirectManipulationInteractionEventHandler>();
    winrt::check_hresult(callback->OnInteraction(nullptr,type));
  }
};
}

static void require(bool condition,char const* message){if(!condition)throw std::runtime_error(message);}
static void pumpTimers(HWND window,unsigned milliseconds){
  const auto until=GetTickCount64()+milliseconds;
  for(unsigned pass=0;pass<12&&GetTickCount64()<until;++pass){
    MsgWaitForMultipleObjects(0,nullptr,FALSE,static_cast<DWORD>(std::min<ULONGLONG>(20,until-GetTickCount64())),QS_TIMER);
    MSG message{};while(PeekMessageW(&message,window,WM_TIMER,WM_TIMER,PM_REMOVE))DispatchMessageW(&message);
  }
}
int main(){
  HWND window=nullptr;
  try{
    winrt::init_apartment(winrt::apartment_type::single_threaded);
    window=CreateWindowExW(0,L"STATIC",L"Nelyx precision owner",WS_OVERLAPPEDWINDOW,0,0,640,480,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);
    if(!window)throw std::runtime_error("Precision test HWND unavailable");
    std::vector<RNSkia::WindowsPrecisionEvent> events;bool canMap=true;
    auto precision=RNSkia::WindowsPrecisionTrackpad::create(window,[&](POINT point)->std::optional<RNSkia::WindowsPrecisionPoint>{if(!canMap)return {};return RNSkia::WindowsPrecisionPoint{double(point.x),double(point.y),1,1};},
      [&](const auto& event){events.push_back(event);});
    if(precision->ownsWheel())throw std::runtime_error("Idle viewport suppressed fallback wheel");
    require(events.empty(),"Idle initialization manufactured physical input");
    using Probe=RNSkia::WindowsPrecisionTrackpadTest;
    Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
    require(Probe::needsUpdate(*precision),"Stationary contact stopped manual updates before RUNNING");
    require(!precision->ownsWheel(),"Stationary contact suppressed fallback wheel");
    const auto timerTicks=Probe::ticks(*precision);pumpTimers(window,80);
    require(Probe::ticks(*precision)>timerTicks,"Stationary input waited for compositor activity instead of its HWND timer");
    Probe::update(*precision);
    require(Probe::needsUpdate(*precision),"Idle viewport status retired a live contact");
    Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_END);
    Probe::update(*precision);
    require(!Probe::needsUpdate(*precision)&&events.empty(),"Ended stationary contact manufactured a gesture or kept polling");
    const auto idleTicks=Probe::ticks(*precision);pumpTimers(window,40);
    SendMessageW(window,WM_TIMER,1,0);
    require(Probe::ticks(*precision)==idleTicks,"An idle or unrelated HWND timer polled precision input");
    {
      const auto before=events.size();canMap=false;
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      Probe::content(*precision,0,-12);
      Probe::status(*precision,DIRECTMANIPULATION_INERTIA,DIRECTMANIPULATION_RUNNING);
      require(!precision->ownsWheel(),"An unmapped inertia stream swallowed fallback wheel without admitting a precision gesture");
      require(events.size()==before,"An unmapped gesture manufactured framework input");
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_INERTIA);Probe::update(*precision);canMap=true;
    }
    {
      // Flutter's reset remains synthetic through the entire native callback
      // sequence, even if interaction END follows the READY notification.
      const auto before=events.size();
      Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);Probe::content(*precision,0,-24);
      Probe::status(*precision,DIRECTMANIPULATION_INERTIA,DIRECTMANIPULATION_RUNNING);Probe::content(*precision,0,-25);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_INERTIA);
      require(events.size()==before+4&&events.back().kind=="inertiaCancel"&&Probe::resetting(*precision),"Flutter terminal/reset ordering changed");
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);Probe::content(*precision,0,0);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);
      require(events.size()==before+4,"Synthesized reset start/update/end escaped as physical input");
      Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_END);Probe::update(*precision);
      require(!Probe::needsUpdate(*precision),"Completed Flutter reset kept polling");
      Probe::synthesizedInteraction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
      require(!Probe::interacting(*precision),"Synthesized reset BEGIN took ownership of real input");
      Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_BEGIN);
      Probe::synthesizedInteraction(*precision,DIRECTMANIPULATION_INTERACTION_END);
      require(Probe::interacting(*precision),"Synthesized reset END retired real input");
      Probe::interaction(*precision,DIRECTMANIPULATION_INTERACTION_END);Probe::update(*precision);
    }
    {
      // Exercise real asynchronous ZoomToRect callbacks from a nonidentity
      // native transform. The former identity-only fixture never emitted them.
      const auto before=events.size();Probe::seedNativeTransform(*precision);Probe::update(*precision);
      const auto moved=Probe::nativeTranslation(*precision);
      require(std::abs(moved.first)>1||std::abs(moved.second)>1,"Native reset fixture did not move its real content");
      Probe::resetTransform(*precision);pumpTimers(window,120);
      const auto reset=Probe::nativeTranslation(*precision);
      require(std::abs(reset.first)<.1&&std::abs(reset.second)<.1&&!Probe::resetting(*precision),"Real native reset did not settle");
      require(events.size()==before,"Real ZoomToRect callbacks manufactured an extra gesture");
    }
    {
      Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);Probe::content(*precision,0,-8);
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);
      // The next physical gesture can start before the queued compositor poll.
      const auto before=events.size();require(Probe::prepareContact(*precision),"A completed reset did not admit a fresh contact");Probe::status(*precision,DIRECTMANIPULATION_RUNNING,DIRECTMANIPULATION_READY);
      require(events.size()==before+1&&events.back().kind=="panZoomStart","A READY reset swallowed a new gesture arriving before its compositor poll");
      Probe::content(*precision,0,-6);require(events.back().kind=="panZoomUpdate"&&events.back().deltaY==-6,"A rapid new gesture lost its independent translation");
      Probe::status(*precision,DIRECTMANIPULATION_READY,DIRECTMANIPULATION_RUNNING);Probe::update(*precision);
    }
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
    std::cout<<"PASS precision initialized=1 retired=1 repeatedGestures=12 stationary=1 noInertia=4 interruptedInertia=1 cancellation=2 hwndTimer=1 idleTimerRetired=1 syntheticReset=1 nativeZoomReset=1 synthesizedInteraction=2 physicalInput=unobserved"<<std::endl;return 0;
  }catch(std::exception const& error){if(window)DestroyWindow(window);std::cerr<<error.what()<<std::endl;return 1;}
  catch(winrt::hresult_error const& error){if(window)DestroyWindow(window);std::cerr<<winrt::to_string(error.message())<<std::endl;return 1;}
}
