// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../../core/memory.hpp"
#include <functional>
#include <map>
#include <string>
#include <vector>

namespace nelyx::v2::native {
/** OS-input snapshots contain copied text only. A key's dispatch releases its
 * admission; an unfinished OS read retains its credit until terminal delivery. */
class InputClipboard final {
 public:
  using Completion=std::function<void(std::string,std::string)>;
 private:
  struct Record {
    bool ready=false,released=false;
    std::string value,error;
    std::vector<Completion> readers;
    std::shared_ptr<ExternalLease> credit;
  };
  std::shared_ptr<Ledger> ledger;
  mutable std::mutex gate;
  std::map<uint64_t,std::shared_ptr<Record>> records;
  uint64_t sequence=0;
  bool closed=false;
 public:
  explicit InputClipboard(std::shared_ptr<Ledger> ledger):ledger(std::move(ledger)){}
  uint64_t begin(){
    std::lock_guard lock(gate);
    if(closed||records.size()>=32||sequence==9007199254740991ull)
      throw std::runtime_error("Input clipboard snapshot admission exceeded or closed");
    auto record=std::make_shared<Record>();
    record->credit=std::make_shared<ExternalLease>(ledger,3,5,6ull*65536+4096);
    const auto id=sequence+1;records.emplace(id,std::move(record));sequence=id;return id;
  }
  void complete(uint64_t id,std::string value,std::string error){
    if(value.size()>4*65536||value.find('\0')!=std::string::npos){value.clear();error="Input clipboard text exceeds its boundary";}
    std::shared_ptr<Record> record;std::vector<Completion> readers;
    {
      std::lock_guard lock(gate);const auto found=records.find(id);
      if(found==records.end()||found->second->ready)return;
      record=found->second;record->ready=true;
      record->value=error.empty()?std::move(value):std::string{};record->error=std::move(error);
      readers.swap(record->readers);
      if(record->released)records.erase(found);
    }
    for(auto& reader:readers)reader(record->value,record->error);
  }
  void read(uint64_t id,Completion completion){
    std::shared_ptr<Record> record;
    {
      std::lock_guard lock(gate);const auto found=records.find(id);
      if(closed||!id||found==records.end()||found->second->released)
        throw std::runtime_error("Input clipboard snapshot is stale or closed");
      record=found->second;
      if(!record->ready){
        if(record->readers.size()>=32)throw std::runtime_error("Input clipboard reader budget exceeded");
        record->readers.push_back(std::move(completion));return;
      }
    }
    completion(record->value,record->error);
  }
  void release(uint64_t id){
    std::lock_guard lock(gate);
    if(!id||id>sequence)throw std::runtime_error("Invalid input clipboard snapshot identity");
    const auto found=records.find(id);if(found==records.end())return;
    found->second->released=true;if(found->second->ready)records.erase(found);
  }
  void close(){
    std::vector<Completion> readers;
    {
      std::lock_guard lock(gate);closed=true;
      for(auto it=records.begin();it!=records.end();){
        auto& record=*it->second;record.released=true;
        for(auto& reader:record.readers)readers.push_back(std::move(reader));record.readers.clear();
        if(record.ready)it=records.erase(it);else ++it;
      }
    }
    for(auto& reader:readers)reader({},"Input clipboard owner closed");
  }
  size_t pending()const{std::lock_guard lock(gate);return records.size();}
};
}
