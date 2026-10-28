// SPDX-License-Identifier: BSD-3-Clause
#include "../../skia/native/host/windows/WindowsInputTrace.h"
#include <iostream>
#include <stdexcept>
#include <cstring>
static void check(bool value,char const* message){if(!value)throw std::runtime_error(message);}
int main(int count,char** args){try{
  wchar_t name[96]{};swprintf_s(name,L"Local\\NelyxInputTrace.v1.%lu",GetCurrentProcessId());
  if(count>1&&std::strcmp(args[1],"--disabled")==0){
    check(!RNSkia::windowsInputTraceEnabled(),"Disabled run enabled observations");RNSkia::windowsInputTrace(RNSkia::WindowsInputStage::SdkReceived);
    const auto map=OpenFileMappingW(FILE_MAP_READ,FALSE,name);if(map)CloseHandle(map);check(!map,"Disabled observations allocated shared memory");std::cout<<"PASS input-trace disabled=1 allocated=0\n";return 0;
  }
  check(RNSkia::windowsInputTraceEnabled(),"Enabled run did not opt in");
  {RNSkia::WindowsInputTrace trace;
    for(unsigned i=1;i<=17;++i)trace.add(RNSkia::WindowsInputStage::SdkReceived,7,9,i,RNSkia::windowsMonotonicMilliseconds(),2,false);
    trace.add(RNSkia::WindowsInputStage::SdkDrop,7,9,16,3,17,true);
    const auto map=OpenFileMappingW(FILE_MAP_READ,FALSE,name);check(map,"Recorder mapping unavailable");
    const auto bytes=static_cast<const unsigned char*>(MapViewOfFile(map,FILE_MAP_READ,0,0,0));check(bytes,"Recorder view unavailable");
    const auto header=reinterpret_cast<const uint64_t*>(bytes);check(header[0]==0x4e4c585452414345ULL&&header[1]==1&&header[2]==GetCurrentProcessId(),"Recorder identity differs");check(header[4]==64&&header[5]==8192&&header[6]==16,"Recorder is not bounded/sampled");check(header[7]==3&&header[8]==18,"Sampling lost counters or kept every update");
    const auto latest=reinterpret_cast<const uint64_t*>(bytes+128+11*64);check(latest[0]==17&&latest[3]==7&&latest[4]==9&&latest[5]==17,"Latest stage lost the exact native packet identity");
    const auto drop=reinterpret_cast<const uint64_t*>(bytes+2176+2*64);check(drop[2]==12&&drop[5]==16,"A rare rejection was sampled away");
    const bool gestureReader=count>1&&std::strcmp(args[1],"--gesture-reader")==0;
    if(gestureReader){
      // Model the reported ordering without claiming physical contact input:
      // an end/cancel followed by a 700ms gap and a fresh start. A separate
      // sampled pair skips submission ids and must not be called an outage.
      trace.add(RNSkia::WindowsInputStage::FrameSubmitted,7,9,10,100,50,true);
      trace.add(RNSkia::WindowsInputStage::PrecisionState,0,9,99,4,3|(107<<16),true);
      trace.add(RNSkia::WindowsInputStage::NativeInput,7,9,10,3,0,true);
      trace.add(RNSkia::WindowsInputStage::NativeInput,7,9,11,4,0,true);
      Sleep(700);
      trace.add(RNSkia::WindowsInputStage::NativeInput,7,9,12,1,0,true);
      trace.add(RNSkia::WindowsInputStage::FrameSubmitted,7,9,12,101,51,true);
      Sleep(350);
      trace.add(RNSkia::WindowsInputStage::FrameSubmitted,7,9,28,117,67,true);
      trace.add(RNSkia::WindowsInputStage::FrameSubmitted,7,10,29,118,68,true);
    }
    if(gestureReader||(count>1&&std::strcmp(args[1],"--reader")==0)){std::cout<<"INPUT_TRACE_READY pid="<<GetCurrentProcessId()<<std::endl;Sleep(5000);}
    UnmapViewOfFile(bytes);CloseHandle(map);
  }
  const auto retired=OpenFileMappingW(FILE_MAP_READ,FALSE,name);if(retired)CloseHandle(retired);check(!retired,"Recorder mapping survived its owner");
  std::cout<<"PASS input-trace capacity=8192 sampleEvery=16 latest=17 rareDrop=1 cleanup=1\n";return 0;
}catch(std::exception const& error){std::cerr<<error.what()<<'\n';return 1;}}
