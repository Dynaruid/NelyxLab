// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <map>
#include <memory>
#include <vector>
#include <array>
#include <bitset>

namespace nelyx::v2 {
struct ObservationBlob {
  Lease lease;
  uint64_t id;
  uint32_t type;
  Handle owner;
  std::vector<uint8_t> bytes;
  ObservationBlob(const std::shared_ptr<Ledger>& ledger,uint64_t token,uint32_t kind,Handle node,Reader data)
    :lease(ledger,sizeof(ObservationBlob)+data.length),id(token),type(kind),owner(node),bytes(data.data,data.data+data.length){}
};
struct ObservationRow {
  Lease lease;
  Handle node;
  std::array<uint8_t,wire::nodeBytes> bytes{};
  std::vector<std::shared_ptr<const ObservationBlob>> blobs;
  ObservationRow(const std::shared_ptr<Ledger>& ledger,Handle id,size_t count)
    :lease(ledger,sizeof(ObservationRow)+count*sizeof(std::shared_ptr<const ObservationBlob>)),node(id){}
};
struct ObservationState {
  std::vector<uint32_t,LedgerAllocator<uint32_t>> pending;
  std::bitset<wire::limits::nodes+1> marked;
  std::array<Handle,wire::limits::nodes+1> slots{};
  bool orderDirty=false,fullRequired=false;
  bool selected=false;
  std::shared_ptr<Lease> indexLease;
  uint64_t version=0;
  std::array<uint64_t,20> signature{};
  std::vector<Handle> selection;
  std::map<uint64_t,std::shared_ptr<const ObservationRow>> rows;
  std::vector<Handle> order;
  size_t bytes=0;
  explicit ObservationState(const std::shared_ptr<Ledger>& ledger):pending(LedgerAllocator<uint32_t>{ledger}){}
  void mark(Handle node){if(version&&node&&!marked[node.slot]){pending.push_back(node.slot);marked.set(node.slot);}}
  void clean(){pending.clear();marked.reset();orderDirty=false;fullRequired=false;}
  void clear(){indexLease.reset();version=0;rows.clear();order.clear();selection.clear();slots.fill({});clean();
    decltype(pending) empty(pending.get_allocator());pending.swap(empty);bytes=0;}
};
// Provider subscriptions are optional. Native/full-frame consumers must not
// reserve a second slot dictionary merely because the Web delta role exists.
struct ProviderObservationState final : ObservationState {
  Lease lease;
  explicit ProviderObservationState(const std::shared_ptr<Ledger>& ledger)
    :ObservationState(ledger),lease(ledger,sizeof(ProviderObservationState)){}
};
}
