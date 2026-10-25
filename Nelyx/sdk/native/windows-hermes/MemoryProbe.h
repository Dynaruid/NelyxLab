// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <psapi.h>
#include <cstdint>
#include <stdexcept>

namespace Nelyx::NativeHermes {
inline constexpr UINT memoryProbeMessage=WM_APP+80;
inline constexpr ULONG_PTR memoryProbeWheelCookie=0x4e4d454d;
// The UI owner admits one bounded sequence. Ordinary products keep this off.
class MemoryProbe final {
  bool active=false;
  uint32_t next=0;
public:
  explicit MemoryProbe(bool enabled=false):active(enabled){}
  bool enabled()const{return active;}
  bool admit(WPARAM cycle,LPARAM reserved,bool ready){
    if(!active||!ready||reserved||cycle>30||cycle!=next)return false;
    ++next;return true;
  }
};
struct ProcessMemory {
  uint64_t privateBytes,workingSetBytes,peakPrivateBytes;
};
inline ProcessMemory currentProcessMemory(){
  PROCESS_MEMORY_COUNTERS_EX value{};value.cb=sizeof(value);
  if(!GetProcessMemoryInfo(GetCurrentProcess(),reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&value),sizeof(value)))
    throw std::runtime_error("Native private process memory is unavailable");
  return {value.PrivateUsage,value.WorkingSetSize,value.PeakPagefileUsage};
}
}
