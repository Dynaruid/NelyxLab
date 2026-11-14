// SPDX-License-Identifier: BSD-3-Clause
// One owned test App, read-only Windows stack snapshots. No VM instrumentation.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <dbghelp.h>
#include <tlhelp32.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstring>
#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

struct Handle {
  HANDLE value=nullptr;
  explicit Handle(HANDLE h):value(h){if(!h||h==INVALID_HANDLE_VALUE)throw std::runtime_error("Windows handle unavailable");}
  ~Handle(){CloseHandle(value);}
  Handle(const Handle&)=delete;
};
static double now(){LARGE_INTEGER t,f;QueryPerformanceCounter(&t);QueryPerformanceFrequency(&f);return double(t.QuadPart)/f.QuadPart;}
struct Sample {double from=0,to=0;uint64_t leaf=0;std::vector<uint64_t> frames;bool truncated=false;};
struct Resume {
  HANDLE thread;uint32_t& failures;
  ~Resume(){if(ResumeThread(thread)==DWORD(-1))++failures;}
};
struct Symbols {HANDLE process;~Symbols(){SymCleanup(process);}};
struct FrozenStack {
  uint64_t begin=0,end=0,regionBegin=0,regionEnd=0;
  std::vector<unsigned char> bytes=std::vector<unsigned char>(512*1024);
};
static thread_local const FrozenStack* frozenStack=nullptr;
static BOOL CALLBACK readSnapshot(HANDLE process,DWORD64 address,PVOID output,DWORD length,LPDWORD read){
  *read=0;if(address+length<address)return FALSE;
  if(frozenStack&&address<frozenStack->regionEnd&&address+length>frozenStack->regionBegin){
    if(address<frozenStack->begin||address+length>frozenStack->end)return FALSE;
    std::memcpy(output,frozenStack->bytes.data()+address-frozenStack->begin,length);*read=length;return TRUE;
  }
  // Native unwind tables/code are immutable loaded images. Never read a live
  // target stack after resuming its owner; out-of-bound stack reads fail closed.
  SIZE_T received=0;const auto ok=ReadProcessMemory(process,reinterpret_cast<LPCVOID>(address),output,length,&received);
  *read=DWORD(received);return ok;
}
int wmain(int argc,wchar_t** argv){
  try{
    if(argc!=5)throw std::runtime_error("Expected owned PID, creation FILETIME, App thread and native image");
    const DWORD pid=std::stoul(argv[1]),tid=std::stoul(argv[3]);
    const uint64_t creation=std::stoull(argv[2]);
    Handle process(OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_VM_READ,FALSE,pid));
    FILETIME created,exit,kernel,user;
    if(!GetProcessTimes(process.value,&created,&exit,&kernel,&user)||
        ((uint64_t(created.dwHighDateTime)<<32)|created.dwLowDateTime)!=creation)
      throw std::runtime_error("App process creation identity differs");
    Handle thread(OpenThread(THREAD_SUSPEND_RESUME|THREAD_GET_CONTEXT|THREAD_QUERY_INFORMATION,FALSE,tid));
    if(GetProcessIdOfThread(thread.value)!=pid)throw std::runtime_error("App thread belongs to another process");
    const auto image=std::filesystem::canonical(argv[4]);
    Handle modules(CreateToolhelp32Snapshot(TH32CS_SNAPMODULE|TH32CS_SNAPMODULE32,pid));
    MODULEENTRY32W module{};module.dwSize=sizeof(module);uint64_t base=0,size=0;
    if(!Module32FirstW(modules.value,&module))throw std::runtime_error("App modules unavailable");
    do{if(std::filesystem::equivalent(image,module.szExePath)){base=reinterpret_cast<uint64_t>(module.modBaseAddr);size=module.modBaseSize;break;}}while(Module32NextW(modules.value,&module));
    if(!base||!size)throw std::runtime_error("Verified App native image is not loaded");
    SymSetOptions(SYMOPT_DEFERRED_LOADS|SYMOPT_FAIL_CRITICAL_ERRORS|SYMOPT_NO_PROMPTS|SYMOPT_IGNORE_NT_SYMPATH);
    if(!SymInitializeW(process.value,image.parent_path().c_str(),TRUE))throw std::runtime_error("Native unwind initialization failed");
    Symbols symbols{process.value};uint32_t failures=0,resumeFailures=0;double maximumHeldMs=0,totalHeldMs=0;
    FrozenStack stack;
    const auto snapshot=[&](){
      Sample sample;CONTEXT context{};context.ContextFlags=CONTEXT_FULL;sample.from=now();
      const auto prior=SuspendThread(thread.value);
      if(prior==DWORD(-1)){++failures;sample.to=now();return sample;}
      {
        Resume resume{thread.value,resumeFailures};
        if(prior){++failures;sample.to=now();return sample;}
        if(!GetThreadContext(thread.value,&context)){++failures;sample.to=now();return sample;}
        sample.leaf=context.Rip;
        MEMORY_BASIC_INFORMATION memory{};
        if(!VirtualQueryEx(process.value,reinterpret_cast<LPCVOID>(context.Rsp),&memory,sizeof(memory)))
          throw std::runtime_error("Native stack memory bound unavailable");
        stack.regionBegin=reinterpret_cast<uint64_t>(memory.BaseAddress);stack.regionEnd=stack.regionBegin+memory.RegionSize;
        stack.begin=context.Rsp;stack.end=std::min(stack.regionEnd,stack.begin+stack.bytes.size());
        SIZE_T received=0;
        if(stack.end<=stack.begin||!ReadProcessMemory(process.value,reinterpret_cast<LPCVOID>(stack.begin),
            stack.bytes.data(),SIZE_T(stack.end-stack.begin),&received)||received!=stack.end-stack.begin)
          throw std::runtime_error("Native stack snapshot incomplete");
      }
      sample.to=now();const auto held=(sample.to-sample.from)*1000;
      maximumHeldMs=std::max(maximumHeldMs,held);totalHeldMs+=held;
      // The owner is running again. All potentially slow DbgHelp work uses
      // the frozen bounded stack and immutable image unwind tables.
      frozenStack=&stack;
      STACKFRAME64 frame{};frame.AddrPC={context.Rip,0,AddrModeFlat};
      frame.AddrFrame={context.Rbp,0,AddrModeFlat};frame.AddrStack={context.Rsp,0,AddrModeFlat};
      uint64_t lastPc=frame.AddrPC.Offset,lastSp=frame.AddrStack.Offset;
      if(lastPc>=base&&lastPc-base<size)sample.frames.push_back(lastPc-base);
      for(uint32_t depth=0;depth<48;++depth){
        if(!StackWalk64(IMAGE_FILE_MACHINE_AMD64,process.value,thread.value,&frame,&context,readSnapshot,
            SymFunctionTableAccess64,SymGetModuleBase64,nullptr))break;
        const auto pc=frame.AddrPC.Offset,sp=frame.AddrStack.Offset;
        if(!pc)break;
        if(pc==lastPc&&sp==lastSp){if(!depth)continue;break;}
        if(pc>=base&&pc-base<size)sample.frames.push_back(pc-base);
        lastPc=pc;lastSp=sp;sample.truncated=depth==47;
      }
      frozenStack=nullptr;return sample;
    };
    // Prime unwind metadata before the gesture; this sample never enters evidence.
    snapshot();if(failures||resumeFailures)throw std::runtime_error("Native unwind warmup failed");maximumHeldMs=totalHeldMs=0;
    std::cout<<"NATIVE_STACK_READY {\"pid\":"<<pid<<",\"thread\":"<<tid<<",\"base\":"<<base<<",\"size\":"<<size<<"}"<<std::endl;
    std::string command;while(std::getline(std::cin,command)&&command!="start")if(command=="stop")return 0;
    if(command!="start")return 0;
    std::vector<Sample> samples;samples.reserve(256);std::atomic<bool> stopped=false;
    {
      std::jthread worker([&]{try{const auto start=std::chrono::steady_clock::now();
        for(uint32_t i=0;i<256&&!stopped;++i){std::this_thread::sleep_until(start+std::chrono::milliseconds(i*8));if(!stopped)samples.push_back(snapshot());}}
        catch(...){++failures;stopped=true;}});
      while(std::getline(std::cin,command)&&command!="stop"){}
      stopped=true;
    }
    std::cout.precision(17);
    std::cout<<"NATIVE_STACK_RESULT {\"domain\":\"qpc-seconds\",\"precision\":\"native-function-range\",\"diagnosticOnly\":true,\"pid\":"<<pid
      <<",\"thread\":"<<tid<<",\"base\":"<<base<<",\"size\":"<<size<<",\"failures\":"<<failures<<",\"resumeFailures\":"<<resumeFailures
      <<",\"maximumHeldMs\":"<<maximumHeldMs<<",\"totalHeldMs\":"<<totalHeldMs<<",\"samples\":[";
    for(size_t i=0;i<samples.size();++i){if(i)std::cout<<',';const auto& s=samples[i];
      std::cout<<"{\"from\":"<<s.from<<",\"to\":"<<s.to<<",\"leafInApp\":"<<(s.leaf>=base&&s.leaf-base<size?"true":"false")
        <<",\"truncated\":"<<(s.truncated?"true":"false")<<",\"frames\":[";
      for(size_t j=0;j<s.frames.size();++j){if(j)std::cout<<',';std::cout<<s.frames[j];}std::cout<<"]}";
    }
    std::cout<<"]}"<<std::endl;return failures||resumeFailures?1:0;
  }catch(const std::exception& error){std::cerr<<error.what()<<std::endl;return 1;}
}
