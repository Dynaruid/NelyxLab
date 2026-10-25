// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "RuntimeScheduler.h"
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <deque>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <thread>

namespace Nelyx::NativeHermes {
class RuntimeLoop final:public nelyx::host::RuntimeScheduler {
public:
  using Task=nelyx::host::RuntimeTask;
  using nelyx::host::RuntimeScheduler::invokeAsync;
  explicit RuntimeLoop(std::function<double()> now):now(std::move(now)){}
  void uiBarrier(std::function<Task()> value){uiThread=std::this_thread::get_id();barrier=std::move(value);}
  void invokeAsync(Task&& task)override{invokeInput(ordered(std::move(task)));}
  void invokeInput(Task task){std::lock_guard lock(mutex);if(stopped)throw std::runtime_error("Runtime queue retired");if(queue.size()>=4096)throw std::runtime_error("Runtime queue admission exceeds4096");queue.push_back(std::move(task));changed.notify_one();}
  void invokeSync(Task&& task)override{if(owner!=std::this_thread::get_id()||!runtime)throw std::runtime_error("JSI sync call requires its runtime owner");task(*runtime);}
  // One reserved close slot follows admitted work, including the rest of a
  // pointer batch. Service completions can still settle SDK shutdown.
  void closeAfterPending(Task task){task=ordered(std::move(task));std::lock_guard lock(mutex);if(stopped||closingQueued)return;closingQueued=true;queue.push_back(std::move(task));changed.notify_one();}
  void bind(facebook::jsi::Runtime& value){owner=std::this_thread::get_id();runtime=&value;}
  bool step(std::optional<double> deadline){
    Task task;
    {std::unique_lock lock(mutex);if(queue.empty()&&!stopped){if(deadline)changed.wait_for(lock,std::chrono::duration<double,std::milli>(std::max(0.,*deadline-now())),[&]{return stopped||!queue.empty();});else changed.wait(lock,[&]{return stopped||!queue.empty();});}
      if(stopped)return false;if(queue.empty())return true;task=std::move(queue.front());queue.pop_front();}
    task(*runtime);runtime->drainMicrotasks();return true;
  }
  void close(){if(owner!=std::this_thread::get_id())throw std::runtime_error("Runtime close requires owner");std::deque<Task> cancelled;{std::lock_guard lock(mutex);stopped=true;cancelled.swap(queue);}cancelled.clear();runtime=nullptr;}
private:
  Task ordered(Task task){if(std::this_thread::get_id()!=uiThread||!barrier)return task;auto before=barrier();return [before=std::move(before),task=std::move(task)](auto& rt){before(rt);rt.drainMicrotasks();task(rt);};}
  std::function<double()> now;std::thread::id uiThread,owner;std::function<Task()> barrier;std::mutex mutex;std::condition_variable changed;std::deque<Task> queue;bool stopped=false,closingQueued=false;facebook::jsi::Runtime* runtime=nullptr;
};
}
