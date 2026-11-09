// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "protocol/wire.hpp"
#include <memory>
#include <atomic>
#include <array>
#include <mutex>
#include <algorithm>
#include <type_traits>
namespace nelyx::v2 {
struct MemorySnapshot {uint64_t total=0,peak=0,cpu=0,gpu=0,staging=0,engineHeap=0,providerHeap=0,rejected=0;};
struct Ledger {
  std::atomic<uint64_t> bytes{0},resourceBytes{0},nodes{0};
  uint32_t queuedInputs=0,updateInputs=0,activeViews=0;
  std::mutex gate;
  std::array<std::array<uint64_t,6>,8> external{};
  uint64_t peak=0,rejected=0;
  MemorySnapshot snapshotLocked(uint64_t core)const {
    MemorySnapshot value;value.peak=peak;value.rejected=rejected;
    for(const auto& row:external){value.engineHeap+=row[0];value.providerHeap+=row[1];
      value.cpu+=row[2];value.gpu+=row[3];value.staging+=row[4]+row[5];}
    // Wasm core allocations occupy the engine heap; do not count them twice.
    value.total=std::max(core,value.engineHeap)+value.providerHeap+value.cpu+value.gpu+value.staging;
    return value;
  }
  void check(uint64_t core) {
    const auto value=snapshotLocked(core);
    if(value.total>wire::limits::unifiedBytes||value.gpu>wire::limits::gpuBytes){++rejected;throw Error{wire::statuses::budgetExceeded};}
    peak=std::max(peak,value.total);
  }
  void reserve(uint64_t count,bool resource) {
    std::lock_guard lock(gate);const auto used=bytes.load();
    if(count>wire::limits::sessionBytes-used||(resource&&count>wire::limits::resourceBytes-resourceBytes.load())){++rejected;throw Error{wire::statuses::budgetExceeded};}
    check(used+count);bytes+=count;if(resource)resourceBytes+=count;
  }
  void release(uint64_t count,bool resource) {
    std::lock_guard lock(gate);bytes-=count;if(resource)resourceBytes-=count;
  }
  void report(uint32_t owner,uint32_t kind,uint64_t count,bool draining=false) {
    require(owner<external.size()&&kind<external[0].size()&&count<=wire::limits::unifiedBytes,wire::statuses::invalidValue);
    std::lock_guard lock(gate);auto& entry=external[owner][kind];const auto before=entry;entry=count;
    if(draining&&count>before){entry=before;throw Error{wire::statuses::closed};}
    try{check(bytes.load());}catch(...){entry=before;throw;}
  }
  void adjust(uint32_t owner,uint32_t kind,uint64_t count,bool release) {
    std::lock_guard lock(gate);auto& entry=external.at(owner).at(kind);const auto before=entry;
    if(release){if(count>entry)std::terminate();entry-=count;return;}
    if(count>wire::limits::unifiedBytes-entry){++rejected;throw Error{wire::statuses::budgetExceeded};}entry+=count;
    try{check(bytes.load());}catch(...){entry=before;throw;}
  }
  MemorySnapshot snapshot(){std::lock_guard lock(gate);return snapshotLocked(bytes.load());}
};
struct Lease {
  std::shared_ptr<Ledger> ledger;uint64_t bytes;bool resource;
  Lease(std::shared_ptr<Ledger> owner,uint64_t count,bool isResource=false)
    :ledger(std::move(owner)),bytes(count),resource(isResource){ledger->reserve(bytes,resource);}
  ~Lease(){ledger->release(bytes,resource);}
  Lease(const Lease&)=delete;Lease& operator=(const Lease&)=delete;
};
struct ExternalLease {
  std::shared_ptr<Ledger> ledger;uint32_t owner,kind;uint64_t bytes;
  ExternalLease(std::shared_ptr<Ledger> book,uint32_t slot,uint32_t category,uint64_t count)
    :ledger(std::move(book)),owner(slot),kind(category),bytes(count){ledger->adjust(owner,kind,bytes,false);}
  ~ExternalLease(){ledger->adjust(owner,kind,bytes,true);}
  ExternalLease(const ExternalLease&)=delete;ExternalLease& operator=(const ExternalLease&)=delete;
};
/** Variable-sized geometry pays for each container allocation before allocating.
 * Rebind/copy/move retain the same ledger through nested vector growth. */
template<class T> struct LedgerAllocator {
  using value_type=T;
  using propagate_on_container_move_assignment=std::true_type;
  std::shared_ptr<Ledger> ledger;
  explicit LedgerAllocator(std::shared_ptr<Ledger> owner) noexcept:ledger(std::move(owner)){}
  template<class U> LedgerAllocator(const LedgerAllocator<U>& other) noexcept:ledger(other.ledger){}
  T* allocate(size_t count){
    if(count>std::numeric_limits<size_t>::max()/sizeof(T))throw std::bad_array_new_length{};
    const auto bytes=uint64_t(count)*sizeof(T);ledger->reserve(bytes,false);
    try{return std::allocator<T>{}.allocate(count);}catch(...){ledger->release(bytes,false);throw;}
  }
  void deallocate(T* pointer,size_t count) noexcept{
    std::allocator<T>{}.deallocate(pointer,count);ledger->release(uint64_t(count)*sizeof(T),false);
  }
  template<class U> bool operator==(const LedgerAllocator<U>& other)const noexcept{return ledger==other.ledger;}
};
}
