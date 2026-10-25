// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <windows.h>
#include <dbghelp.h>
#include <psapi.h>
#include <iostream>
#include <string>
#include <vector>

// Diagnostic execution only. Forward the real exit code and keep debug output
// in the caller's bounded memory buffer; a forced timeout never qualifies.
int wmain(int argc,wchar_t** argv){
  if(argc!=2&&argc!=3)return 4;
  STARTUPINFOW startup{sizeof(startup)};PROCESS_INFORMATION process{};
  std::wstring command=L"\""+std::wstring(argv[1])+L"\"";
  if(!CreateProcessW(argv[1],command.data(),nullptr,nullptr,FALSE,DEBUG_ONLY_THIS_PROCESS,nullptr,nullptr,&startup,&process))return 5;
  bool initial=true,exited=false,ready=false,fault=false;DWORD result=6;
  const auto deadline=GetTickCount64()+60000;auto closeAt=deadline;
  const auto trapRva=argc==3?wcstoull(argv[2],nullptr,0):0;DWORD64 trap=0,aotBase=0;BYTE previous=0;DWORD stepping=0;
  std::cout<<"APP_DEBUG_PID "<<process.dwProcessId<<std::endl;
  while(!exited){
    if(ready&&GetTickCount64()>closeAt){
      EnumWindows([](HWND window,LPARAM pid)->BOOL{DWORD owner=0;GetWindowThreadProcessId(window,&owner);if(owner==DWORD(pid)&&IsWindowVisible(window))PostMessageW(window,WM_CLOSE,0,0);return TRUE;},process.dwProcessId);
      closeAt=deadline;
    }
    DEBUG_EVENT event{};
    if(!WaitForDebugEvent(&event,100)){if(GetTickCount64()>deadline){TerminateProcess(process.hProcess,6);break;}continue;}
    DWORD disposition=DBG_CONTINUE;
    if(event.dwDebugEventCode==EXCEPTION_DEBUG_EVENT){
      const auto& error=event.u.Exception;const auto code=error.ExceptionRecord.ExceptionCode;
      if(code==EXCEPTION_SINGLE_STEP&&stepping==event.dwThreadId){
        const auto thread=OpenThread(THREAD_GET_CONTEXT|THREAD_SET_CONTEXT,FALSE,event.dwThreadId);CONTEXT context{};context.ContextFlags=CONTEXT_CONTROL;
        if(thread&&GetThreadContext(thread,&context)){context.EFlags&=~0x100;SetThreadContext(thread,&context);}if(thread)CloseHandle(thread);
        const BYTE breakpoint=0xcc;WriteProcessMemory(process.hProcess,reinterpret_cast<void*>(trap),&breakpoint,1,nullptr);FlushInstructionCache(process.hProcess,reinterpret_cast<void*>(trap),1);stepping=0;
        ContinueDebugEvent(event.dwProcessId,event.dwThreadId,DBG_CONTINUE);continue;
      }
      const bool trapped=trap&&reinterpret_cast<DWORD64>(error.ExceptionRecord.ExceptionAddress)==trap&&code==EXCEPTION_BREAKPOINT;
      if(trapped)std::cout<<"APP_DEBUG_TRAP_HIT"<<std::endl;
      // Expected WinUI C++ exceptions can be numerous. Symbol loading pauses
      // the entire debuggee and can consume its startup deadline. Their only
      // first-chance output is an AOT PC, so walk them only with that image live.
      if(code==0xe06d7363&&aotBase||code==0xc0000409||!error.dwFirstChance||trapped){
        SymInitialize(process.hProcess,nullptr,TRUE);SymRefreshModuleList(process.hProcess);
        const auto thread=OpenThread(THREAD_GET_CONTEXT|THREAD_SET_CONTEXT|THREAD_QUERY_INFORMATION,FALSE,event.dwThreadId);
        CONTEXT context{};context.ContextFlags=CONTEXT_FULL;
        if(thread&&GetThreadContext(thread,&context)){
          if(trapped){WriteProcessMemory(process.hProcess,reinterpret_cast<void*>(trap),&previous,1,nullptr);FlushInstructionCache(process.hProcess,reinterpret_cast<void*>(trap),1);--context.Rip;context.EFlags|=0x100;SetThreadContext(thread,&context);stepping=event.dwThreadId;}
          STACKFRAME64 frame{};frame.AddrPC={context.Rip,0,AddrModeFlat};frame.AddrFrame={context.Rbp,0,AddrModeFlat};frame.AddrStack={context.Rsp,0,AddrModeFlat};
          for(unsigned index=0;index<64&&frame.AddrPC.Offset;index++){
            const auto base=SymGetModuleBase64(process.hProcess,frame.AddrPC.Offset);char name[MAX_PATH]{};
            if(base)GetModuleFileNameExA(process.hProcess,reinterpret_cast<HMODULE>(base),name,MAX_PATH);
            if(trapped||code==0xc0000409||!error.dwFirstChance){
              alignas(SYMBOL_INFO) char symbolData[sizeof(SYMBOL_INFO)+MAX_SYM_NAME]{};const auto symbol=reinterpret_cast<SYMBOL_INFO*>(symbolData);symbol->SizeOfStruct=sizeof(SYMBOL_INFO);symbol->MaxNameLen=MAX_SYM_NAME;DWORD64 offset=0;
              std::cout<<"APP_DEBUG_FRAME "<<name<<" 0x"<<std::hex<<frame.AddrPC.Offset-base<<std::dec;if(SymFromAddr(process.hProcess,frame.AddrPC.Offset,&offset,symbol))std::cout<<" "<<symbol->Name<<"+"<<offset;std::cout<<std::endl;
            }
            if(std::string(name).ends_with("NelyxApp.aot.dll"))std::cout<<"APP_DEBUG_AOT_PC 0x"<<std::hex<<frame.AddrPC.Offset-base<<std::dec<<std::endl;
            if(!StackWalk64(IMAGE_FILE_MACHINE_AMD64,process.hProcess,thread,&frame,&context,nullptr,SymFunctionTableAccess64,SymGetModuleBase64,nullptr))break;
          }
        }
        if(thread)CloseHandle(thread);SymCleanup(process.hProcess);
      }
      disposition=trapped||code==EXCEPTION_BREAKPOINT&&initial?DBG_CONTINUE:DBG_EXCEPTION_NOT_HANDLED;
      if(code==EXCEPTION_BREAKPOINT)initial=false;
      if(!error.dwFirstChance){fault=true;std::cout<<"APP_DEBUG_FAULT "<<std::hex<<code<<std::dec<<std::endl;}
    }else if(event.dwDebugEventCode==OUTPUT_DEBUG_STRING_EVENT){
      const auto& value=event.u.DebugString;const auto length=std::min(size_t(value.nDebugStringLength),size_t(16384));
      if(!value.fUnicode){
        std::vector<char> text(length+1);
        if(ReadProcessMemory(process.hProcess,value.lpDebugStringData,text.data(),length,nullptr)){
          const std::string message(text.data());std::cout<<message<<std::endl;
          if(message.find("first-content-ready")!=std::string::npos){ready=true;closeAt=GetTickCount64()+3000;}
        }
      }
    }else if(event.dwDebugEventCode==CREATE_PROCESS_DEBUG_EVENT){if(event.u.CreateProcessInfo.hFile)CloseHandle(event.u.CreateProcessInfo.hFile);}
    else if(event.dwDebugEventCode==LOAD_DLL_DEBUG_EVENT){
      char name[MAX_PATH]{};
      if(event.u.LoadDll.hFile)GetFinalPathNameByHandleA(event.u.LoadDll.hFile,name,MAX_PATH,FILE_NAME_NORMALIZED);
      if(std::string(name).ends_with("\\NelyxApp.aot.dll"))aotBase=reinterpret_cast<DWORD64>(event.u.LoadDll.lpBaseOfDll);
      if(trapRva&&std::string(name).ends_with("\\hermes.dll")){
        trap=reinterpret_cast<DWORD64>(event.u.LoadDll.lpBaseOfDll)+trapRva;const BYTE breakpoint=0xcc;
        if(!ReadProcessMemory(process.hProcess,reinterpret_cast<void*>(trap),&previous,1,nullptr)||!WriteProcessMemory(process.hProcess,reinterpret_cast<void*>(trap),&breakpoint,1,nullptr))return 7;
        FlushInstructionCache(process.hProcess,reinterpret_cast<void*>(trap),1);
        std::cout<<"APP_DEBUG_TRAP_INSTALLED 0x"<<std::hex<<trap<<std::dec<<std::endl;
      }
      if(event.u.LoadDll.hFile)CloseHandle(event.u.LoadDll.hFile);
    }
    else if(event.dwDebugEventCode==UNLOAD_DLL_DEBUG_EVENT){if(reinterpret_cast<DWORD64>(event.u.UnloadDll.lpBaseOfDll)==aotBase)aotBase=0;}
    else if(event.dwDebugEventCode==CREATE_THREAD_DEBUG_EVENT)CloseHandle(event.u.CreateThread.hThread);
    else if(event.dwDebugEventCode==EXIT_PROCESS_DEBUG_EVENT){result=event.u.ExitProcess.dwExitCode;exited=true;}
    ContinueDebugEvent(event.dwProcessId,event.dwThreadId,disposition);
  }
  if(!exited)WaitForSingleObject(process.hProcess,5000);
  CloseHandle(process.hThread);CloseHandle(process.hProcess);
  std::cout<<"APP_DEBUG_EXIT "<<result<<std::endl;
  return int(result==0&&fault?3:result);
}
