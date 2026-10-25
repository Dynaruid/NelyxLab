// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <condition_variable>
#include <deque>
#include <functional>
#include <mutex>
#include <thread>
#include <stdexcept>

namespace RNSkia {
// One native worker per GPU session. Jobs contain native recordings/fences and
// dispatcher tokens only; never JSI Values, Runtime references or JS callbacks.
class WindowsFrameWorker final {
public:
  WindowsFrameWorker():thread([this]{run();}){}
  ~WindowsFrameWorker(){close();}
  void post(std::function<void()> job){
    std::lock_guard lock(mutex);
    if(stopped||!job||jobs.size()>=128)throw std::runtime_error("Windows GPU worker admission closed or full");
    jobs.push_back(std::move(job));changed.notify_one();
  }
  void close(){
    {std::lock_guard lock(mutex);stopped=true;changed.notify_one();}
    if(thread.joinable())thread.join();
  }
private:
  void run(){
    for(;;){std::function<void()> job;
      {std::unique_lock lock(mutex);changed.wait(lock,[this]{return stopped||!jobs.empty();});
        if(jobs.empty())return;job=std::move(jobs.front());jobs.pop_front();}
      job(); // Every job translates failures to its UI completion terminal.
    }
  }
  std::mutex mutex;std::condition_variable changed;std::deque<std::function<void()>> jobs;
  bool stopped=false;std::thread thread;
};
}
