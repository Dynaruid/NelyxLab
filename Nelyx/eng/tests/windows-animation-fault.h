// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstdio>
#include <cstring>

// Fatal-only diagnostics. No worker, polling, heap dump or supplied-engine
// hook runs during timing. Unwind from the exception context without calling
// language handlers; a damaged stack must not obscure the original fault.
namespace NelyxAnimationFault {
inline volatile LONG entered=0;
inline void write(const char* value,DWORD length)noexcept{DWORD written=0;WriteFile(GetStdHandle(STD_ERROR_HANDLE),value,length,&written,nullptr);}
inline void pc(unsigned frame,DWORD64 address)noexcept{
  MEMORY_BASIC_INFORMATION memory{};char image[MAX_PATH]{},output[512]{};
  const bool mapped=VirtualQuery(reinterpret_cast<void*>(address),&memory,sizeof(memory))&&memory.Type==MEM_IMAGE;
  if(mapped)GetModuleFileNameA(static_cast<HMODULE>(memory.AllocationBase),image,MAX_PATH);
  const auto name=std::strrchr(image,'\\');const auto base=mapped?reinterpret_cast<DWORD64>(memory.AllocationBase):0;
  const int length=std::snprintf(output,sizeof(output),"ANIMATION_FAULT_PC {\"frame\":%u,\"module\":\"%s\",\"rva\":%llu}\n",frame,name?name+1:image,static_cast<unsigned long long>(base?address-base:0));
  if(length>0&&length<sizeof(output))write(output,static_cast<DWORD>(length));
}
inline LONG WINAPI report(EXCEPTION_POINTERS* exception)noexcept{
  if(InterlockedCompareExchange(&entered,1,0))return EXCEPTION_EXECUTE_HANDLER;
  char output[512]{};const auto record=exception->ExceptionRecord;
  const bool access=(record->ExceptionCode==EXCEPTION_ACCESS_VIOLATION||record->ExceptionCode==EXCEPTION_IN_PAGE_ERROR)&&record->NumberParameters>=2;
  const int length=std::snprintf(output,sizeof(output),"ANIMATION_FATAL {\"code\":%lu,\"thread\":%lu,\"instruction\":\"0x%llx\",\"operation\":%lld,\"address\":\"0x%llx\"}\n",record->ExceptionCode,GetCurrentThreadId(),static_cast<unsigned long long>(exception->ContextRecord->Rip),access?static_cast<long long>(record->ExceptionInformation[0]):-1,access?static_cast<unsigned long long>(record->ExceptionInformation[1]):0);
  if(length>0&&length<sizeof(output))write(output,static_cast<DWORD>(length));
  __try{
    CONTEXT context=*exception->ContextRecord;
    for(unsigned frame=0;frame<64&&context.Rip;frame++){
      pc(frame,context.Rip);const auto previousPc=context.Rip,previousSp=context.Rsp;
      DWORD64 imageBase=0;const auto function=RtlLookupFunctionEntry(context.Rip,&imageBase,nullptr);
      if(function){void* handlerData=nullptr;DWORD64 establisherFrame=0;RtlVirtualUnwind(UNW_FLAG_NHANDLER,imageBase,context.Rip,function,&context,&handlerData,&establisherFrame,nullptr);}
      else{SIZE_T read=0;DWORD64 next=0;if(!ReadProcessMemory(GetCurrentProcess(),reinterpret_cast<void*>(context.Rsp),&next,sizeof(next),&read)||read!=sizeof(next))break;context.Rip=next;context.Rsp+=sizeof(next);}
      if(context.Rsp<=previousSp||context.Rip==previousPc)break;
    }
  }__except(EXCEPTION_EXECUTE_HANDLER){const char failed[]="ANIMATION_FATAL_UNWIND_FAILED\n";write(failed,sizeof(failed)-1);}
  return EXCEPTION_EXECUTE_HANDLER;
}
inline void install()noexcept{if(!IsDebuggerPresent())SetUnhandledExceptionFilter(report);}
}
