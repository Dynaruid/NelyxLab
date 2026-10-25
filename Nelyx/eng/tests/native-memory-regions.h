// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <psapi.h>
#include <algorithm>
#include <cstdint>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <vector>

namespace Nelyx::NativeMemory {
// External, non-atomic cause observation. MEM_PRIVATE does not classify
// copy-on-write pages in MEM_IMAGE/MEM_MAPPED and is not PSAPI PrivateUsage.
inline constexpr uint64_t regionBudget=65536,scanBudgetMs=2000;
struct Allocation {uint64_t committed=0,reserved=0;DWORD protection=0;};
struct Regions {
  uint64_t queries=0,privateCommitted=0,privateReserved=0,imageCommitted=0,mappedCommitted=0,otherCommitted=0;
  std::map<uintptr_t,Allocation> allocations;
};
inline uint64_t privateCommit(HANDLE process){PROCESS_MEMORY_COUNTERS_EX value{};value.cb=sizeof(value);if(!GetProcessMemoryInfo(process,reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&value),sizeof(value)))throw std::runtime_error("External private commit query failed");return value.PrivateUsage;}
inline Regions query(HANDLE process){
  Regions result;SYSTEM_INFO system{};GetSystemInfo(&system);const auto maximum=reinterpret_cast<uintptr_t>(system.lpMaximumApplicationAddress),start=GetTickCount64();uintptr_t address=0;
  for(;;){
    if(++result.queries>regionBudget||GetTickCount64()-start>scanBudgetMs)throw std::runtime_error("External address-space observation exceeded its bound");
    MEMORY_BASIC_INFORMATION value{};if(VirtualQueryEx(process,reinterpret_cast<void const*>(address),&value,sizeof(value))!=sizeof(value))throw std::runtime_error("External address-space query failed: "+std::to_string(GetLastError()));
    const auto base=reinterpret_cast<uintptr_t>(value.BaseAddress);if(base!=address||!value.RegionSize||value.RegionSize>std::numeric_limits<uintptr_t>::max()-base)throw std::runtime_error("External address-space query did not advance");
    if(value.State!=MEM_FREE&&value.Type==MEM_PRIVATE){auto& allocation=result.allocations[reinterpret_cast<uintptr_t>(value.AllocationBase)];allocation.protection=value.AllocationProtect;if(value.State==MEM_COMMIT){allocation.committed+=value.RegionSize;result.privateCommitted+=value.RegionSize;}else if(value.State==MEM_RESERVE){allocation.reserved+=value.RegionSize;result.privateReserved+=value.RegionSize;}else throw std::runtime_error("Unexpected private region state");}
    else if(value.State==MEM_COMMIT){if(value.Type==MEM_IMAGE)result.imageCommitted+=value.RegionSize;else if(value.Type==MEM_MAPPED)result.mappedCommitted+=value.RegionSize;else result.otherCommitted+=value.RegionSize;}
    const auto next=base+value.RegionSize;if(next>maximum)break;address=next;
  }
  return result;
}
struct Change {int64_t committedDelta=0;uint64_t committed=0,reserved=0;DWORD protection=0;bool sameBase=false;};
struct Changes {
  uint64_t newBases=0,missingBases=0,grownBases=0,shrunkBases=0,newCommitted=0,missingCommitted=0,addedAtSameBase=0,releasedAtSameBase=0;
  std::vector<Change> largest;
};
inline Changes compare(Regions const& previous,Regions const& current){
  Changes result;const auto changed=[&](int64_t delta,Allocation const& allocation,bool same){if(delta)result.largest.push_back({delta,allocation.committed,allocation.reserved,allocation.protection,same});};
  for(auto const& [base,value]:current.allocations){const auto old=previous.allocations.find(base);if(old==previous.allocations.end()){++result.newBases;result.newCommitted+=value.committed;changed(int64_t(value.committed),value,false);}else if(value.committed>old->second.committed){++result.grownBases;const auto delta=value.committed-old->second.committed;result.addedAtSameBase+=delta;changed(int64_t(delta),value,true);}else if(value.committed<old->second.committed){++result.shrunkBases;const auto delta=old->second.committed-value.committed;result.releasedAtSameBase+=delta;changed(-int64_t(delta),value,true);}}
  for(auto const& [base,value]:previous.allocations)if(!current.allocations.contains(base)){++result.missingBases;result.missingCommitted+=value.committed;changed(-int64_t(value.committed),value,false);}
  std::sort(result.largest.begin(),result.largest.end(),[](auto const& a,auto const& b){const auto magnitude=[](int64_t value){return value<0?-value:value;};return magnitude(a.committedDelta)>magnitude(b.committedDelta);});if(result.largest.size()>6)result.largest.resize(6);return result;
}
}
