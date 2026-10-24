// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <windows.h>
#include <dbghelp.h>
#include <algorithm>
#include <chrono>
#include <iostream>
#include <sstream>
#include <fstream>
#include <filesystem>
#include <map>
#include <string>
#include <vector>

// Diagnostic only: an external, same-user debugger observes the sync JSI
// caller. Resume it before allocation, module lookup, symbols or output.
// Snapshots include waits and are NOT CPU-time percentages or timing samples.
using Clock=std::chrono::steady_clock;
struct Module {DWORD64 base,size;std::string name;};
struct Sampler {
 HANDLE process,thread=nullptr;DWORD threadId=0;std::vector<Module> modules;
 std::string phase;std::map<std::pair<std::string,DWORD64>,unsigned> pcs;
 std::vector<std::string> records;
 std::vector<double> intervals;Clock::time_point last{},next{};unsigned samples=0,failed=0,dropped=0;ULONGLONG cpuStart=0;
 explicit Sampler(HANDLE value):process(value){}
 ~Sampler(){if(thread)CloseHandle(thread);}
 ULONGLONG cpu(){FILETIME created{},exited{},kernel{},user{};if(!thread||!GetThreadTimes(thread,&created,&exited,&kernel,&user))return 0;ULARGE_INTEGER k{},u{};k.LowPart=kernel.dwLowDateTime;k.HighPart=kernel.dwHighDateTime;u.LowPart=user.dwLowDateTime;u.HighPart=user.dwHighDateTime;return k.QuadPart+u.QuadPart;}
 void target(DWORD id){if(thread)CloseHandle(thread);thread=OpenThread(THREAD_SUSPEND_RESUME|THREAD_GET_CONTEXT|THREAD_QUERY_INFORMATION,FALSE,id);threadId=id;}
 void module(void* address,HANDLE file){
  IMAGE_DOS_HEADER dos{};IMAGE_NT_HEADERS64 nt{};SIZE_T read=0;const auto base=reinterpret_cast<DWORD64>(address);
  if(!ReadProcessMemory(process,address,&dos,sizeof(dos),&read)||read!=sizeof(dos)||dos.e_magic!=IMAGE_DOS_SIGNATURE||dos.e_lfanew<0||!ReadProcessMemory(process,reinterpret_cast<void*>(base+dos.e_lfanew),&nt,sizeof(nt),&read)||read!=sizeof(nt)||nt.Signature!=IMAGE_NT_SIGNATURE)return;
  char name[32768]{};if(file)GetFinalPathNameByHandleA(file,name,sizeof(name),FILE_NAME_NORMALIZED);const std::string path(name);const auto slash=path.find_last_of("\\/");modules.push_back({base,nt.OptionalHeader.SizeOfImage,slash==std::string::npos?path:path.substr(slash+1)});
 }
 std::pair<std::string,DWORD64> resolve(DWORD64 pc){for(const auto& module:modules)if(pc>=module.base&&pc-module.base<module.size)return {module.name,pc-module.base};return {"unmapped",0};}
 void begin(std::string name){if(!phase.empty())end(false);phase=std::move(name);pcs.clear();intervals.clear();samples=failed=dropped=0;last={};next=Clock::now();cpuStart=cpu();}
 void sample(){
  if(phase.empty()||Clock::now()<next)return;next=Clock::now()+std::chrono::milliseconds(8);
  if(!thread){failed++;return;}
  CONTEXT context{};context.ContextFlags=CONTEXT_CONTROL;
  if(SuspendThread(thread)==DWORD(-1)){failed++;return;}
  const bool captured=!!GetThreadContext(thread,&context);const bool resumed=ResumeThread(thread)!=DWORD(-1);
  // No target-owned lock, allocation, symbol API or logging above this point.
  if(!resumed){TerminateProcess(process,7);failed++;return;}if(!captured){failed++;return;}
  const auto now=Clock::now();if(samples)intervals.push_back(std::chrono::duration<double,std::milli>(now-last).count());last=now;samples++;
  const auto key=resolve(context.Rip);const auto found=pcs.find(key);if(found!=pcs.end())found->second++;else if(pcs.size()<16384)pcs.emplace(key,1);else dropped++;
 }
 void end(bool complete=true){
  if(phase.empty())return;const auto endCpu=cpu();std::sort(intervals.begin(),intervals.end());
  std::ostringstream output;output<<"{\"phase\":\""<<phase<<"\",\"thread\":"<<threadId<<",\"complete\":"<<(complete?"true":"false")<<",\"samples\":"<<samples<<",\"failed\":"<<failed<<",\"dropped\":"<<dropped<<",\"requestedIntervalMs\":8,\"threadCpuMs\":"<<(endCpu>=cpuStart?double(endCpu-cpuStart)/10000.:0)<<",\"intervalP50Ms\":"<<(intervals.empty()?0:intervals[intervals.size()/2])<<",\"intervalP95Ms\":"<<(intervals.empty()?0:intervals[intervals.size()*95/100])<<",\"intervalMaxMs\":"<<(intervals.empty()?0:intervals.back())<<",\"pcs\":[";
  bool comma=false;for(const auto& [key,count]:pcs){if(comma)output<<",";comma=true;output<<"{\"module\":\""<<key.first<<"\",\"rva\":"<<key.second<<",\"n\":"<<count<<"}";}output<<"]}";records.push_back(output.str());std::cout<<"ANIMATION_PC_SAMPLES "<<records.back()<<std::endl;phase.clear();
 }
 void debug(const std::string& value,DWORD caller){
  if(value.starts_with("ANIMATION_PROFILE_THREAD "))target(caller);
  else if(value.starts_with("ANIMATION_PROFILE_BEGIN ")){std::string name=value.substr(24);while(!name.empty()&&(name.back()=='\n'||name.back()=='\r'))name.pop_back();if(!name.empty()&&name.size()<96&&std::all_of(name.begin(),name.end(),[](char c){return c=='-'||c>='a'&&c<='z'||c>='0'&&c<='9';}))begin(std::move(name));}
  else if(value.starts_with("ANIMATION_PROFILE_END"))end();
 }
 void fault(DWORD id,const EXCEPTION_RECORD& record){
  std::cout<<"ANIMATION_FATAL {\"code\":"<<record.ExceptionCode<<",\"thread\":"<<id<<",\"debugger\":true}"<<std::endl;
  const auto handle=OpenThread(THREAD_GET_CONTEXT|THREAD_QUERY_INFORMATION,FALSE,id);CONTEXT context{};context.ContextFlags=CONTEXT_FULL;
  if(handle&&GetThreadContext(handle,&context)){
   SymSetOptions(SYMOPT_UNDNAME|SYMOPT_DEFERRED_LOADS|SYMOPT_FAIL_CRITICAL_ERRORS);
   if(SymInitialize(process,nullptr,TRUE)){
    STACKFRAME64 frame{};frame.AddrPC={context.Rip,0,AddrModeFlat};frame.AddrFrame={context.Rbp,0,AddrModeFlat};frame.AddrStack={context.Rsp,0,AddrModeFlat};
    for(unsigned n=0;n<64&&frame.AddrPC.Offset;n++){const auto key=resolve(frame.AddrPC.Offset);std::cout<<"ANIMATION_FAULT_PC {\"frame\":"<<n<<",\"module\":\""<<key.first<<"\",\"rva\":"<<key.second<<"}"<<std::endl;if(!StackWalk64(IMAGE_FILE_MACHINE_AMD64,process,handle,&frame,&context,nullptr,SymFunctionTableAccess64,SymGetModuleBase64,nullptr))break;}
    SymCleanup(process);
   }
  }if(handle)CloseHandle(handle);
 }
};
int wmain(int argc,wchar_t** argv){
 if(argc!=3)return 4;STARTUPINFOW startup{sizeof(startup)};PROCESS_INFORMATION child{};
 startup.dwFlags=STARTF_USESTDHANDLES;startup.hStdInput=GetStdHandle(STD_INPUT_HANDLE);startup.hStdOutput=GetStdHandle(STD_OUTPUT_HANDLE);startup.hStdError=GetStdHandle(STD_ERROR_HANDLE);
 for(const auto handle:{startup.hStdInput,startup.hStdOutput,startup.hStdError})if(handle&&handle!=INVALID_HANDLE_VALUE)SetHandleInformation(handle,HANDLE_FLAG_INHERIT,HANDLE_FLAG_INHERIT);
 std::wstring command=L"\""+std::wstring(argv[1])+L"\" \""+std::wstring(argv[2])+L"\"";
 if(!CreateProcessW(argv[1],command.data(),nullptr,nullptr,TRUE,DEBUG_ONLY_THIS_PROCESS,nullptr,nullptr,&startup,&child))return 5;
 DWORD result=6;bool initial=true,exited=false,fatal=false;const auto deadline=GetTickCount64()+600000;
 {Sampler sampler(child.hProcess);
  while(!exited){
   if(GetTickCount64()>deadline){TerminateProcess(child.hProcess,6);break;}
   DEBUG_EVENT event{};if(!WaitForDebugEvent(&event,sampler.phase.empty()?100:2)){sampler.sample();continue;}DWORD disposition=DBG_CONTINUE;
   if(event.dwDebugEventCode==EXCEPTION_DEBUG_EVENT){const auto& error=event.u.Exception;const auto code=error.ExceptionRecord.ExceptionCode;
    if(code==EXCEPTION_BREAKPOINT&&initial)initial=false;else disposition=DBG_EXCEPTION_NOT_HANDLED;
    if(!error.dwFirstChance){fatal=true;sampler.fault(event.dwThreadId,error.ExceptionRecord);}
   }else if(event.dwDebugEventCode==CREATE_PROCESS_DEBUG_EVENT){sampler.module(event.u.CreateProcessInfo.lpBaseOfImage,event.u.CreateProcessInfo.hFile);if(event.u.CreateProcessInfo.hFile)CloseHandle(event.u.CreateProcessInfo.hFile);if(event.u.CreateProcessInfo.hThread!=child.hThread)CloseHandle(event.u.CreateProcessInfo.hThread);if(event.u.CreateProcessInfo.hProcess!=child.hProcess)CloseHandle(event.u.CreateProcessInfo.hProcess);}
   else if(event.dwDebugEventCode==LOAD_DLL_DEBUG_EVENT){sampler.module(event.u.LoadDll.lpBaseOfDll,event.u.LoadDll.hFile);if(event.u.LoadDll.hFile)CloseHandle(event.u.LoadDll.hFile);}
   else if(event.dwDebugEventCode==UNLOAD_DLL_DEBUG_EVENT){const auto base=reinterpret_cast<DWORD64>(event.u.UnloadDll.lpBaseOfDll);std::erase_if(sampler.modules,[base](const Module& module){return module.base==base;});}
   else if(event.dwDebugEventCode==CREATE_THREAD_DEBUG_EVENT)CloseHandle(event.u.CreateThread.hThread);
   else if(event.dwDebugEventCode==OUTPUT_DEBUG_STRING_EVENT){const auto& debug=event.u.DebugString;if(!debug.fUnicode&&debug.nDebugStringLength&&debug.nDebugStringLength<=16384){std::vector<char> message(size_t(debug.nDebugStringLength)+1);if(ReadProcessMemory(child.hProcess,debug.lpDebugStringData,message.data(),debug.nDebugStringLength,nullptr))sampler.debug(std::string(message.data()),event.dwThreadId);}}
   else if(event.dwDebugEventCode==EXIT_PROCESS_DEBUG_EVENT){result=event.u.ExitProcess.dwExitCode;exited=true;}
   ContinueDebugEvent(event.dwProcessId,event.dwThreadId,disposition);if(!exited)sampler.sample();
  }sampler.end(false);
#ifdef NELYX_PC_MAPPER_PATH
  if(sampler.records.empty()&&result==0){std::cerr<<"ANIMATION_PC_ERROR No phase markers observed"<<std::endl;result=8;}
  if(!sampler.records.empty()){
   const auto file=std::filesystem::path(argv[2]).parent_path()/L"pc-snapshots.json";
   {std::ofstream output(file,std::ios::binary);output<<"[";for(size_t n=0;n<sampler.records.size();n++){if(n)output<<",";output<<sampler.records[n];}output<<"]";}
   wchar_t observer[32768]{};GetModuleFileNameW(nullptr,observer,32768);
   std::wstring mapping=L"\"" NELYX_NODE_PATH L"\" \"" NELYX_PC_MAPPER_PATH L"\" \""+std::wstring(argv[2])+L"\" \""+file.wstring()+L"\" \""+std::wstring(observer)+L"\" \""+std::wstring(argv[1])+L"\"";PROCESS_INFORMATION mapper{};
   if(CreateProcessW(NELYX_NODE_PATH,mapping.data(),nullptr,nullptr,TRUE,CREATE_NO_WINDOW,nullptr,nullptr,&startup,&mapper)){
    if(WaitForSingleObject(mapper.hProcess,1200000)!=WAIT_OBJECT_0)TerminateProcess(mapper.hProcess,8);DWORD mapped=8;GetExitCodeProcess(mapper.hProcess,&mapped);CloseHandle(mapper.hThread);CloseHandle(mapper.hProcess);if(result==0&&mapped!=0)result=8;
   }else if(result==0)result=8;
  }
#endif
 }
 if(!exited)WaitForSingleObject(child.hProcess,5000);CloseHandle(child.hThread);CloseHandle(child.hProcess);
 std::cout<<"ANIMATION_PROFILE_EXIT "<<result<<std::endl;return int(result==0&&fatal?3:result);
}
