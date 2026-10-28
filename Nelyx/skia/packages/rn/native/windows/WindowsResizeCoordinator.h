// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <thread>

namespace RNSkia {
// The HWND thread may wait inside USER32's geometry transaction. Only native
// Skia work runs here: never dispatch Win32/RNW messages, input, React or close.
// JS functions stay on the JS owner and GPU waits stay on the GPU worker.
class WindowsResizeCoordinator final : public std::enable_shared_from_this<WindowsResizeCoordinator> {
public:
  using Clock=std::chrono::steady_clock;
  using Deadline=Clock::time_point;
  using Dispatch=std::function<void(std::function<void()>)>;
  WindowsResizeCoordinator():owner(std::this_thread::get_id()),signal(CreateEventW(nullptr,FALSE,FALSE,nullptr)){
    if(!signal)throw std::runtime_error("Resize mailbox event unavailable");
  }
  ~WindowsResizeCoordinator(){CloseHandle(signal);}
  void post(std::function<void()> job,const Dispatch& dispatch){
    {std::lock_guard lock(mutex);jobs.push_back(std::move(job));}
    wake();dispatch([weak=weak_from_this()]{if(auto self=weak.lock())self->pump();});
  }
  void wake()const noexcept{SetEvent(signal);}
  void pump(){
    requireUi();std::deque<std::function<void()>> batch;
    {std::lock_guard lock(mutex);batch.swap(jobs);}
    for(auto& job:batch)job();
  }
  template<typename Predicate> bool waitUntil(Predicate ready,Deadline deadline){
    requireUi();for(;;){
      pump();if(ready())return true;
      const auto remaining=std::chrono::duration<double,std::milli>(deadline-Clock::now()).count();
      if(remaining<=0)return false;
      const auto result=WaitForSingleObject(signal,static_cast<DWORD>(std::ceil(remaining)));
      if(result!=WAIT_OBJECT_0&&result!=WAIT_TIMEOUT)throw std::runtime_error("Resize mailbox wait failed");
    }
  }
  uint64_t begin(bool defer){
    requireUi();resolve(false);active=++next;deferred=defer;return active;
  }
  void requested(uint64_t view,uint64_t generation){
    requireUi();if(!active)return;
    auto found=entries.find(view);
    if(found!=entries.end()&&found->second.generation==generation)return;
    std::function<void(bool)> cancel;
    if(found!=entries.end()){
      cancelledThrough[view]=std::max(cancelledThrough[view],found->second.generation);
      cancel=std::move(found->second.resolve);
    }
    entries[view]={generation,false,{}};
    if(cancel)cancel(false);
  }
  bool defers(uint64_t view,uint64_t generation)const{
    requireUi();const auto found=entries.find(view);
    return active&&deferred&&found!=entries.end()&&found->second.generation==generation;
  }
  void stage(uint64_t view,uint64_t generation,std::function<void(bool)> resolve){
    requireUi();const auto found=entries.find(view);
    if(!active||found==entries.end()||found->second.generation!=generation){resolve(false);return;}
    if(found->second.resolve)throw std::runtime_error("Resize generation already has a prepared frame");
    found->second.resolve=std::move(resolve);
  }
  void ready(uint64_t view,uint64_t generation){
    requireUi();const auto found=entries.find(view);
    if(active&&found!=entries.end()&&found->second.generation==generation)found->second.ready=true;
    wake();
  }
  bool ready()const{requireUi();for(const auto& [view,entry]:entries)if(!entry.ready)return false;return true;}
  bool hasRequests()const{requireUi();return !entries.empty();}
  bool cancelled(uint64_t view,uint64_t generation)const{requireUi();const auto found=cancelledThrough.find(view);return found!=cancelledThrough.end()&&generation<=found->second;}
  void retire(uint64_t view){
    requireUi();cancelledThrough.erase(view);const auto found=entries.find(view);if(found==entries.end())return;
    auto resolve=std::move(found->second.resolve);entries.erase(found);if(resolve)resolve(false);
  }
  void resolve(bool commit){
    requireUi();if(!commit)for(const auto& [view,entry]:entries)cancelledThrough[view]=std::max(cancelledThrough[view],entry.generation);
    active=0;deferred=false;std::map<uint64_t,Entry> terminal;terminal.swap(entries);
    // Detach the transaction first: completion may admit another layout epoch.
    for(auto& [view,entry]:terminal)if(entry.resolve)entry.resolve(commit);
  }
private:
  struct Entry{uint64_t generation;bool ready;std::function<void(bool)> resolve;};
  void requireUi()const{if(owner!=std::this_thread::get_id())throw std::runtime_error("Resize transaction requires its HWND owner");}
  const std::thread::id owner;HANDLE signal;
  std::mutex mutex;std::deque<std::function<void()>> jobs;
  uint64_t next=0,active=0;bool deferred=false;std::map<uint64_t,Entry> entries;
  // One numeric fence per live view, not a queue of rejected proposals. A late
  // producer still uploads/retires, but can never publish a cancelled epoch.
  // View unbind retires the fence; no scene, callback or GPU resource is kept.
  std::map<uint64_t,uint64_t> cancelledThrough;
};
}
