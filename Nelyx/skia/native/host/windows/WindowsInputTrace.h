// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "WindowsMonotonic.h"
#include <windows.h>
#include <cstdint>
#include <cwchar>
#include <mutex>
#include <string>

namespace RNSkia {
enum class WindowsInputStage:uint64_t {
  WindowWheel,PrecisionState,PrecisionInteraction,PrecisionTick,PrecisionContent,PrecisionEmit,
  PrecisionSurfaceDrop,NativeInput,PayloadWritten,WheelSuppressed,WheelSurfaceDrop,
  SdkReceived,SdkDrop,SdkQueued,CoreQueued,CoreDispatchBegin,CoreDispatchEnd,CoreDrop,
  FrameRequested,ClockReady,JsFrameBegin,JsFrameEnd,UiQueued,UiBegin,UiEnd,
  FrameSubmitted,GpuComplete,SurfaceUpdated,FrameRetired,FrameFailed,Focus,FrameSuperseded
};
inline unsigned windowsInputKind(std::string const& kind)noexcept{
  return kind=="wheel"?0:kind=="panZoomStart"?1:kind=="panZoomUpdate"?2:kind=="panZoomEnd"?3:kind=="inertiaCancel"?4:kind=="down"?5:kind=="move"?6:kind=="up"?7:kind=="cancel"?8:kind=="hover"?9:kind=="leave"?10:255;
}
inline bool windowsInputTraceEnabled()noexcept{
  static const bool enabled=[]{wchar_t value[2]{};return GetEnvironmentVariableW(L"NELYX_WINDOWS_INPUT_TRACE",value,2)==1&&value[0]==L'1';}();return enabled;
}
// One bounded, numeric current-process recorder. No console writes, retained
// objects, files, callbacks, polling threads or changes to input admission.
// Header: magic/version/pid/creation FILETIME/entry size/capacity/sample rate/
// stored records/observed events/status. 32 latest-stage entries precede the ring.
class WindowsInputTrace final {
  struct Entry {uint64_t sequence;double qpc;uint64_t stage,view,surface,input;double a,b;};
  static_assert(sizeof(Entry)==64);
  static constexpr uint64_t capacity=8192,stages=32,headerBytes=128;
public:
  WindowsInputTrace()noexcept{
    wchar_t name[96]{};swprintf_s(name,L"Local\\NelyxInputTrace.v1.%lu",GetCurrentProcessId());
    map=CreateFileMappingW(INVALID_HANDLE_VALUE,nullptr,PAGE_READWRITE,0,DWORD(headerBytes+(stages+capacity)*sizeof(Entry)),name);
    if(!map)return;if(GetLastError()==ERROR_ALREADY_EXISTS){CloseHandle(map);map=nullptr;return;}
    bytes=static_cast<unsigned char*>(MapViewOfFile(map,FILE_MAP_ALL_ACCESS,0,0,0));if(!bytes){CloseHandle(map);map=nullptr;return;}
    auto* header=reinterpret_cast<uint64_t*>(bytes);FILETIME creation{},exit{},kernel{},user{};GetProcessTimes(GetCurrentProcess(),&creation,&exit,&kernel,&user);
    header[0]=0x4e4c585452414345ULL;header[1]=1;header[2]=GetCurrentProcessId();header[3]=(uint64_t(creation.dwHighDateTime)<<32)|creation.dwLowDateTime;
    header[4]=sizeof(Entry);header[5]=capacity;header[6]=16;header[9]=1;
  }
  ~WindowsInputTrace(){if(bytes){InterlockedExchange64(reinterpret_cast<volatile LONG64*>(bytes+72),2);UnmapViewOfFile(bytes);}if(map)CloseHandle(map);}
  void add(WindowsInputStage stage,uint64_t view,uint64_t surface,uint64_t input,double a,double b,bool important)noexcept{
    if(!bytes)return;const auto index=uint64_t(stage);if(index>=stages)return;
    try{
      std::lock_guard lock(mutex);auto* header=reinterpret_cast<uint64_t*>(bytes);auto* latest=reinterpret_cast<Entry*>(bytes+headerBytes);
      const auto previous=latest[index].qpc;const auto count=++counts[index];const Entry value{count,windowsMonotonicMilliseconds(),index,view,surface,input,a,b};publish(latest[index],value);++header[8];
      const bool delayed=(stage==WindowsInputStage::SdkReceived&&a>0&&value.qpc-a>=200)||((stage==WindowsInputStage::CoreDispatchBegin||stage==WindowsInputStage::CoreDispatchEnd)&&b>=200)||(stage==WindowsInputStage::JsFrameEnd&&b>=100);
      const bool gap=previous>0&&value.qpc-previous>=250;
      if(important||delayed||gap||count%16==1){auto* ring=latest+stages;auto saved=value;saved.sequence=++stored;publish(ring[(stored-1)%capacity],saved);InterlockedExchange64(reinterpret_cast<volatile LONG64*>(header+7),stored);}
    }catch(...){}
  }
private:
  static void publish(Entry& destination,Entry const& value)noexcept{
    auto* sequence=reinterpret_cast<volatile LONG64*>(&destination.sequence);InterlockedExchange64(sequence,0);
    destination.qpc=value.qpc;destination.stage=value.stage;destination.view=value.view;destination.surface=value.surface;destination.input=value.input;destination.a=value.a;destination.b=value.b;
    InterlockedExchange64(sequence,value.sequence);
  }
  HANDLE map=nullptr;unsigned char* bytes=nullptr;std::mutex mutex;uint64_t stored=0,counts[stages]{};
};
inline void windowsInputTrace(WindowsInputStage stage,uint64_t view=0,uint64_t surface=0,uint64_t input=0,double a=0,double b=0,bool important=false)noexcept{
  if(!windowsInputTraceEnabled())return;static WindowsInputTrace trace;trace.add(stage,view,surface,input,a,b,important);
}
}
