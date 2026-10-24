// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <chrono>
#include <cstdint>
#include <cstddef>
#include <functional>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>

namespace RNSkia {
// Native view jobs outlive Fabric removal. Registry/producer captures are
// consumed on JS, GPU retirement runs off-owner, and layer release runs on UI.
// A missing scheduler/ACK retains the job and blocks checked runtime teardown.
class AppleViewTaskOwner final : public std::enable_shared_from_this<AppleViewTaskOwner> {
public:
  using Job=std::function<void()>;
  using Scheduler=std::function<void(Job)>;
  using Clock=std::chrono::steady_clock;
  struct Snapshot {size_t pending=0;bool sealed=false,failed=false;};
  AppleViewTaskOwner(Scheduler js,Scheduler worker,Scheduler ui,std::function<void(std::string)> failure)
      :_js(std::move(js)),_worker(std::move(worker)),_ui(std::move(ui)),_failure(std::move(failure)),_owner(std::this_thread::get_id()) {
    if(!_js || !_worker || !_ui || !_failure)throw std::runtime_error("Apple view schedulers unavailable");
  }
  void attach(Job registry,Job ready) {post(std::move(registry),{},std::move(ready),false);}
  void close(Job producerAndRegistry,std::function<bool()> retireGpu,Job releaseLayer) {
    if(!retireGpu)throw std::runtime_error("Apple view GPU retirement unavailable");
    post(std::move(producerAndRegistry),std::move(retireGpu),std::move(releaseLayer),true);
  }
  void seal() {std::lock_guard lock(_mutex);_sealed=true;}
  Snapshot snapshot() const {std::lock_guard lock(_mutex);return {_jobs.size(),_sealed,_failed};}
  bool drained() const {const auto value=snapshot();return value.sealed && !value.failed && !value.pending;}
  void checkDeadline(Clock::time_point now=Clock::now()) {
    bool expired=false;{std::lock_guard lock(_mutex);if(_failed)return;for(const auto &[id,job]:_jobs)if(now>=job->deadline){expired=true;break;}}
    if(expired)fail("Apple view owner deadline expired; native dependencies retained");
  }
private:
  struct Work {uint64_t id;Clock::time_point deadline;Job registry,ui;std::function<bool()> retire;};
  void post(Job registry,std::function<bool()> retire,Job ui,bool closing) {
    if(!registry || !ui)throw std::runtime_error("Apple view owner operations unavailable");
    std::shared_ptr<Work> work;
    {std::lock_guard lock(_mutex);
      if(_failed || (_sealed && !closing) || _jobs.size()>=128)throw std::runtime_error("Apple view owner admission closed or budget exceeded");
      work=std::make_shared<Work>(Work{++_next,Clock::now()+std::chrono::seconds(10),std::move(registry),std::move(ui),std::move(retire)});
      _jobs.emplace(work->id,work);
    }
    auto self=shared_from_this();
    try{_js([self,work](){self->onJs(work);});}catch(const std::exception &error){fail(error.what());}
  }
  bool active(const std::shared_ptr<Work> &work) {
    checkDeadline();std::lock_guard lock(_mutex);return !_failed && _jobs.contains(work->id);
  }
  void onJs(const std::shared_ptr<Work> &work) {
    if(!active(work))return;
    if(std::this_thread::get_id()!=_owner){fail("Apple view registry ran outside its JS owner");return;}
    try {
      work->registry();work->registry={}; // Release owner-affine captures on JS.
      auto self=shared_from_this();
      if(work->retire)_worker([self,work](){self->onWorker(work);});
      else _ui([self,work](){self->onUi(work);});
    }catch(const std::exception &error){fail(error.what());}
    catch(...){fail("Apple view registry operation failed");}
  }
  void onWorker(const std::shared_ptr<Work> &work) {
    if(!active(work))return;
    try {
      if(!work->retire())throw std::runtime_error("Apple view GPU retirement unconfirmed");
      auto self=shared_from_this();_ui([self,work](){self->onUi(work);});
    }catch(const std::exception &error){fail(error.what());}
    catch(...){fail("Apple view GPU retirement failed");}
  }
  void onUi(const std::shared_ptr<Work> &work) {
    if(!active(work))return;
    try {
      work->ui();
      std::lock_guard lock(_mutex);if(!_failed)_jobs.erase(work->id);
    }catch(const std::exception &error){fail(error.what());}
    catch(...){fail("Apple view UI acknowledgement failed");}
  }
  void fail(std::string error) {
    {std::lock_guard lock(_mutex);if(_failed)return;_failed=true;_sealed=true;}
    _failure(std::move(error));
  }
  const Scheduler _js,_worker,_ui;
  const std::function<void(std::string)> _failure;
  const std::thread::id _owner;
  mutable std::mutex _mutex;
  uint64_t _next=0;
  bool _sealed=false,_failed=false;
  std::unordered_map<uint64_t,std::shared_ptr<Work>> _jobs;
};
} // namespace RNSkia
