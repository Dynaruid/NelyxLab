// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/packages/rn/native/windows/WindowsResizeCoordinator.h"
#include "windows-resize-timing.h"
#include <iostream>
#include <vector>

int main(){
  using Coordinator=RNSkia::WindowsResizeCoordinator;
  try{
    // A slow capture reader must not become the resize input clock.
    unsigned moves=0;double lastDelta=-1;
    Nelyx::Fixture::runResizeTrajectory(60,800,84,[&](double delta){++moves;lastDelta=delta;},[]{std::this_thread::sleep_for(std::chrono::milliseconds(50));});
    if(moves<30||moves>50||lastDelta!=0)throw std::runtime_error("Capture work throttled or burst-replayed resize input");
    for(const auto name:{"left","right","top","bottom","top-left","top-right","bottom-left","bottom-right"})if(!Nelyx::Fixture::resizeEdge(name).hit)throw std::runtime_error("A native resize hit-test edge is missing");
    auto owner=std::make_shared<Coordinator>();std::vector<std::function<void()>> dispatches;
    auto dispatch=[&](auto callback){dispatches.push_back(std::move(callback));};
    MSG message{};PeekMessageW(&message,nullptr,0,0,PM_NOREMOVE);
    if(!PostThreadMessageW(GetCurrentThreadId(),WM_APP+31,0,0))throw std::runtime_error("Unrelated message setup failed");
    owner->begin(true);owner->requested(1,4);bool resolved=false,committed=false;
    owner->stage(1,4,[&](bool commit){resolved=true;committed=commit;});
    std::thread worker([&]{owner->post([&]{owner->ready(1,3);},dispatch);owner->post([&]{owner->ready(1,4);},dispatch);});
    const auto ready=owner->waitUntil([&]{return owner->ready();},Coordinator::Clock::now()+std::chrono::seconds(1));worker.join();
    if(!ready||resolved)throw std::runtime_error("Preparation must wait for the matching generation without publishing");
    if(!PeekMessageW(&message,nullptr,WM_APP+31,WM_APP+31,PM_REMOVE))throw std::runtime_error("Resize pumped an unrelated Win32 message");
    owner->resolve(true);if(!resolved||!committed)throw std::runtime_error("Actual geometry did not publish the reserved frame");
    for(auto& callback:dispatches)callback();dispatches.clear();
    owner->begin(true);owner->requested(1,5);resolved=false;owner->stage(1,5,[&](bool commit){resolved=true;committed=commit;});
    owner->ready(1,4);
    if(owner->waitUntil([&]{return owner->ready();},Coordinator::Clock::now()+std::chrono::milliseconds(5)))throw std::runtime_error("A stale frame satisfied the next generation");
    if(resolved)throw std::runtime_error("Timeout must not report a presented frame");
    owner->resolve(false);if(!resolved||committed)throw std::runtime_error("Cancelled geometry published a prepared frame");
    if(!owner->cancelled(1,5)||!owner->cancelled(1,4)||owner->cancelled(1,6))throw std::runtime_error("A late cancelled epoch can publish or a later epoch was fenced");
    owner->begin(true);owner->requested(1,6);resolved=false;owner->stage(1,6,[&](bool commit){resolved=true;committed=commit;});owner->requested(1,7);
    if(!resolved||committed||owner->ready()||!owner->cancelled(1,6))throw std::runtime_error("Replacement failed to cancel the old candidate");
    bool offOwner=false;std::thread wrong([&]{try{owner->resolve(true);}catch(const std::exception&){offOwner=true;}});wrong.join();if(!offOwner)throw std::runtime_error("Transaction accepted a non-HWND owner");
    owner->resolve(false);
    owner->retire(1);if(owner->cancelled(1,7))throw std::runtime_error("View retirement retained its cancellation fence");
    std::cout<<"PASS exact-generation=1 deferred-publication=1 cancellation=1 timeout=1 unrelated-messages=0 owner-affinity=1 independent-input=1 edges=8\n";
    return 0;
  }catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}
}
