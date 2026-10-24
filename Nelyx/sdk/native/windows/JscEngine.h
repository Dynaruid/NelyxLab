// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <cstdlib>
#include <stdexcept>
#include <string>
#include <filesystem>
#include <fstream>
#include <jsi/jsi.h>
#include <jsc/JSCRuntime.h>

namespace Nelyx::WindowsJsc {
inline std::shared_ptr<facebook::jsi::Runtime> createRuntime() {
  wchar_t executable[32768]{};
  const auto length=GetModuleFileNameW(nullptr,executable,32768);
  if(!length||length==32768)throw std::runtime_error("Cannot locate JSC runtime mode");
  std::ifstream input(std::filesystem::path(executable).parent_path()/L"jsc-mode.txt",std::ios::binary);
  char buffer[32]{};input.read(buffer,sizeof(buffer));
  const std::string mode(buffer,static_cast<size_t>(input.gcount()));
  const bool jit=mode=="jit\n";
  if(!jit&&mode!="interpreter\n")throw std::runtime_error("JSC requires a packaged jit or interpreter mode");
  // JSC reads the shared MD CRT environment once, when the first VM starts.
  // Set every code generation gate before calling any JSC API. A mode change
  // requires a fresh process; ambient JSC flags cannot reverse this choice.
  for(auto name:{"JSC_useJIT","JSC_useBaselineJIT","JSC_useDFGJIT","JSC_useFTLJIT","JSC_useRegExpJIT","JavaScriptCoreUseJIT"})
    if(_putenv_s(name,jit?"1":"0"))throw std::runtime_error("Cannot configure JSC execution mode");
  if(_putenv_s("JSC_useWasm",jit?"1":"0"))throw std::runtime_error("Cannot configure JSC WebAssembly mode");
  auto runtime=facebook::jsc::makeJSCRuntime();
  // This private, parameterless bool seam is pinned with the DLL and source.
  // No WebKit C++ object or allocator crosses the engine DLL boundary.
  auto canUseAssembler=reinterpret_cast<bool(__cdecl*)()>(GetProcAddress(GetModuleHandleW(L"JavaScriptCore.dll"),"?canUseAssembler@VM@JSC@@SA_NXZ"));
  if(!canUseAssembler||canUseAssembler()!=jit)throw std::runtime_error("JSC VM code generation differs from the requested mode");
  auto &rt=*runtime;
  auto settled=rt.evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>("(()=>{let n=0;Promise.resolve().then(()=>++n).then(()=>++n);return ()=>n;})()"),"nelyx:jsc-promise-admission").asObject(rt).asFunction(rt);
  if(!rt.drainMicrotasks()||settled.call(rt).asNumber()!=2)throw std::runtime_error("JSC Promise checkpoint admission failed");
  auto queued=std::make_shared<bool>(false);
  auto task=facebook::jsi::Function::createFromHostFunction(rt,facebook::jsi::PropNameID::forAscii(rt,"nelyxJscAdmission"),0,[queued](auto&,auto const&,auto const*,size_t){*queued=true;return facebook::jsi::Value::undefined();});
  rt.queueMicrotask(task);
  if(!rt.drainMicrotasks()||!*queued||!rt.drainMicrotasks())throw std::runtime_error("JSC host/empty checkpoint admission failed");
  facebook::jsi::Object identity(rt);
  identity.setProperty(rt,"engine","jsc");
  identity.setProperty(rt,"releaseVersion","26.4.0");
  identity.setProperty(rt,"revision","482d54b279fd6147a45aaa122242f2ac315f46df");
  identity.setProperty(rt,"mode",jit?"jit":"interpreter");
  identity.setProperty(rt,"jitEnabled",jit);
  identity.setProperty(rt,"description",facebook::jsi::String::createFromUtf8(rt,rt.description()));
  rt.global().setProperty(rt,"__nelyxJscRuntimeIdentity",std::move(identity));
  rt.global().setProperty(rt,"__nelyxJavaScriptEngine","jsc");
  return runtime;
}
}
