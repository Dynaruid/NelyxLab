// SPDX-License-Identifier: BSD-3-Clause
#pragma once
// Diagnostic consumer of the exact windowsV8Pin C ABI. This header is never
// included by the product host. No V8 C++ ABI or RNW runtime crosses this seam.
#include <windows.h>
#include <roapi.h>
#include <winstring.h>
#include <activation.h>
#include <V8JsiRuntime.h>
#include <jsi_abi/JsiAbiRuntime.h>
#include <jsi_abi/v8_node_api_attach.h>
#include <algorithm>
#include <atomic>
#include <cstdint>
#include <deque>
#include <functional>
#include <filesystem>
#include <iostream>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <syncstream>
#include <unordered_map>

namespace nelyx::diagnostics {
namespace fj=facebook::jsi;
// Activate the current SDK's unmodified, embedded registration-free manifest.
// Its assembly directory stays at the actual current SDK. No '..' filenames
// are embedded in the comparison executable and no SDK installation is copied.
class ComparisonSdkActivation {
  HANDLE context=INVALID_HANDLE_VALUE;
  ULONG_PTR cookie=0;
public:
  explicit ComparisonSdkActivation(const std::string& engineDirectory){
    const auto directory=(std::filesystem::path(engineDirectory)/"windows-app-sdk").wstring();
    const auto executable=(std::filesystem::path(directory)/"NelyxEngineAppSdkHost.exe").wstring();
    ACTCTXW info{};info.cbSize=sizeof(info);
    info.dwFlags=ACTCTX_FLAG_RESOURCE_NAME_VALID|ACTCTX_FLAG_ASSEMBLY_DIRECTORY_VALID;
    info.lpSource=executable.c_str();info.lpAssemblyDirectory=directory.c_str();info.lpResourceName=MAKEINTRESOURCEW(1);
    context=CreateActCtxW(&info);
    if(context==INVALID_HANDLE_VALUE)throw std::runtime_error("Current SDK activation context failed: "+std::to_string(GetLastError()));
    if(!ActivateActCtx(context,&cookie)){
      const auto error=GetLastError();ReleaseActCtx(context);context=INVALID_HANDLE_VALUE;
      throw std::runtime_error("Current SDK activation failed: "+std::to_string(error));
    }
  }
  ~ComparisonSdkActivation(){if(cookie)DeactivateActCtx(0,cookie);if(context!=INVALID_HANDLE_VALUE)ReleaseActCtx(context);}
  void admit(){
    const auto status=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    if(FAILED(status))throw std::runtime_error("SDK admission COM apartment failed");
    struct Apartment{~Apartment(){CoUninitialize();}}apartment;
    constexpr wchar_t name[]=L"Microsoft.UI.Dispatching.DispatcherQueueController";
    HSTRING id=nullptr;const auto created=WindowsCreateString(name,UINT32(sizeof(name)/sizeof(wchar_t)-1),&id);
    if(FAILED(created))throw std::runtime_error("SDK admission class name failed");
    IUnknown* factory=nullptr;
    const auto result=RoGetActivationFactory(id,__uuidof(IUnknown),reinterpret_cast<void**>(&factory));
    WindowsDeleteString(id);if(factory)factory->Release();
    if(FAILED(result))throw std::runtime_error("Current SDK WinRT factory admission failed: "+std::to_string(result));
  }
};
class V8Foreground final:public v8runtime::JSITaskRunner {
  std::mutex mutex;
  std::deque<std::unique_ptr<v8runtime::JSITask>> tasks;
  std::function<void()> wake;
  bool closed=false,overflow=false;
public:
  std::atomic<uint64_t> posted{0},cancelled{0};
  uint64_t executed=0;
  explicit V8Foreground(std::function<void()> notify):wake(std::move(notify)){}
  void postTask(std::unique_ptr<v8runtime::JSITask> task)override{
    {std::lock_guard lock(mutex);++posted;
      if(closed){++cancelled;return;}
      if(tasks.size()==256){overflow=true;return;}
      tasks.push_back(std::move(task));}
    wake();
  }
  void pump(){
    for(unsigned i=0;i<8;++i){
      std::unique_ptr<v8runtime::JSITask> task;
      {std::lock_guard lock(mutex);if(overflow)throw std::runtime_error("V8 foreground task bound exceeded");
        if(tasks.empty())return;task=std::move(tasks.front());tasks.pop_front();}
      task->run();++executed;
    }
    wake();
  }
  void close(){
    std::deque<std::unique_ptr<v8runtime::JSITask>> discard;
    {std::lock_guard lock(mutex);closed=true;cancelled+=tasks.size();discard.swap(tasks);}
    // Destroy tasks while the runtime and its DLL are still alive.
    discard.clear();
  }
};
class ComparisonV8;
inline thread_local ComparisonV8* currentComparisonV8=nullptr;
class ComparisonV8 {
  napi_env environment=nullptr;
  bool attached=false;
public:
  std::shared_ptr<V8Foreground> foreground;
  std::unique_ptr<fj::Runtime> runtime;
  uint64_t heapReads=0,aliasedBuffers=0,copiedBuffers=0,aliasedBytes=0,copiedBytes=0;
  uint64_t peakHeap=0,peakExternal=0,peakExecutable=0;
  bool jitless=false;
  explicit ComparisonV8(std::function<void()> wake):foreground(std::make_shared<V8Foreground>(std::move(wake))){
    if(currentComparisonV8)throw std::runtime_error("Only one comparison runtime may own the App thread");
    wchar_t value[2]{};
    jitless=GetEnvironmentVariableW(L"NELYX_COMPARE_V8_JITLESS",value,2)==1&&value[0]==L'1';
    v8runtime::V8RuntimeArgs args{};
    args.foreground_task_runner=foreground;
    args.flags.explicitMicrotaskPolicy=true;
    args.flags.jitless=jitless;
    runtime=v8runtime::makeV8Runtime(std::move(args));
    if(!runtime)throw std::runtime_error("V8 comparison runtime creation failed");
    const auto abi=::jsi::abi::getAbiRuntime(*runtime);
    if(!abi||v8_attach_node_api(abi,8,&environment)!=napi_ok||!environment)
      throw std::runtime_error("V8 same-isolate heap API attachment failed");
    // The JSI runtime owns environment. Do not unref/destroy it independently.
    attached=true;currentComparisonV8=this;
    try{admit();heap(*runtime);}catch(...){currentComparisonV8=nullptr;throw;}
    std::osyncstream(std::cout)<<"V2_RUNTIME_COMPARISON {\"engine\":\"v8\",\"package\":\"24.1.10\",\"revision\":\"c1877966a8285b7cbacbdd03e26ca003496436bc\",\"adapterJsiVersion\":19,\"jitless\":"<<(jitless?"true":"false")<<",\"heapAccounting\":true,\"timeoutInterrupt\":false}"<<std::endl;
  }
  void admit(){
    auto& rt=*runtime;
    auto count=rt.evaluateJavaScript(std::make_shared<fj::StringBuffer>(
      "(()=>{let n=0;Promise.resolve().then(()=>++n).then(()=>++n);return ()=>n;})()"),
      "nelyx:v8-comparison-admission").asObject(rt).asFunction(rt);
    if(!rt.drainMicrotasks()||count.call(rt).asNumber()!=2)
      throw std::runtime_error("V8 Promise checkpoint admission failed");
    bool ran=false;
    auto host=fj::Function::createFromHostFunction(rt,fj::PropNameID::forAscii(rt,"comparisonAdmission"),0,
      [&ran](fj::Runtime&,const fj::Value&,const fj::Value*,size_t){ran=true;return fj::Value::undefined();});
    rt.queueMicrotask(host);
    if(!rt.drainMicrotasks()||!ran||!rt.drainMicrotasks())
      throw std::runtime_error("V8 host/empty microtask admission failed");
  }
  std::unordered_map<std::string,int64_t> heap(fj::Runtime& rt){
    if(&rt!=runtime.get()||!attached)throw std::runtime_error("V8 heap query escaped its App runtime");
    jsr_napi_env_scope scope=nullptr;
    if(jsr_open_napi_env_scope(environment,&scope)!=napi_ok)
      throw std::runtime_error("V8 heap environment scope failed");
    struct Guard{napi_env env;jsr_napi_env_scope scope;~Guard(){jsr_close_napi_env_scope(env,scope);}}guard{environment,scope};
    std::unordered_map<std::string,int64_t> info;
    const auto status=jsr_instrumentation_get_heap_info(environment,false,
      [](void* raw,const char* key,int64_t value){
        static_cast<std::unordered_map<std::string,int64_t>*>(raw)->emplace(key,value);
      },&info);
    if(status!=napi_ok)throw std::runtime_error("V8 heap query failed");
    for(const auto key:{"totalHeapSize","externalMemory","mallocedMemory","totalGlobalHandlesSize","totalHeapSizeExecutable"})
      if(!info.contains(key)||info.at(key)<0)throw std::runtime_error("V8 exact heap counter unavailable");
    if(!info.at("totalHeapSize"))throw std::runtime_error("V8 heap counter is empty");
    ++heapReads;peakHeap=std::max(peakHeap,uint64_t(info.at("totalHeapSize")));
    peakExternal=std::max(peakExternal,uint64_t(info.at("externalMemory")));
    peakExecutable=std::max(peakExecutable,uint64_t(info.at("totalHeapSizeExecutable")));
    return info;
  }
  void response(bool alias,size_t size){
    if(alias){++aliasedBuffers;aliasedBytes+=size;}
    else{++copiedBuffers;copiedBytes+=size;}
  }
  ~ComparisonV8(){
    foreground->close();
    runtime.reset(); // Node-API env and all JS values die before task runner.
    if(currentComparisonV8==this)currentComparisonV8=nullptr;
    std::osyncstream(std::cout)<<"V2_RUNTIME_COMPARISON_CLOSED {\"jitless\":"<<(jitless?"true":"false")
      <<",\"heapReads\":"<<heapReads<<",\"peakHeap\":"<<peakHeap<<",\"peakExternal\":"<<peakExternal
      <<",\"peakExecutable\":"<<peakExecutable<<",\"aliasedBuffers\":"<<aliasedBuffers<<",\"copiedBuffers\":"<<copiedBuffers
      <<",\"aliasedBytes\":"<<aliasedBytes<<",\"copiedBytes\":"<<copiedBytes<<",\"tasksPosted\":"<<foreground->posted
      <<",\"tasksExecuted\":"<<foreground->executed<<",\"tasksCancelled\":"<<foreground->cancelled<<"}"<<std::endl;
  }
};
inline std::unordered_map<std::string,int64_t> comparisonV8Heap(fj::Runtime& rt){
  if(!currentComparisonV8)throw std::runtime_error("V8 heap owner unavailable");
  return currentComparisonV8->heap(rt);
}
// No timeout interrupt is exported by this pinned C ABI. A stalled comparison
// is a failed run, never a successful shutdown. The supervising check owns and
// reaps this exact process and its temporary resources even after this failure.
[[noreturn]] inline void comparisonV8Timeout(fj::Runtime*){
  std::osyncstream(std::cerr)<<"V2_HOST_ERROR V8 comparison stalled; timeout interrupt unavailable"<<std::endl;
  TerminateProcess(GetCurrentProcess(),125);std::terminate();
}
} // namespace nelyx::diagnostics
