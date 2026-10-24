// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <jsi/jsi.h>
#include <jsi/hermes-interfaces.h>
#include <atomic>
#include <filesystem>
#include <stdexcept>
#include <string_view>
#include "RnwJsiPal.h"

namespace Nelyx::WindowsStaticHermes {
inline constexpr std::string_view internalJavaScriptSha256="c917a77eb7d770ed5e8ba7da12ef6303d105d8975e29fcb5692db49c5c389fd0";
#ifdef HERMESVM_INTERNAL_JAVASCRIPT_NATIVE
inline constexpr bool nativeInternalJavaScript=true;
#else
inline constexpr bool nativeInternalJavaScript=false;
#endif
inline constexpr std::string_view bundleMarker="/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n";
inline constexpr std::string_view aotBundleMarker="/*nelyx:static-hermes-aot:94aa5e1d:v5*/\n";
inline std::string_view bundleView(const uint8_t *data,size_t size){if(size&&data[size-1]==0)--size;return {reinterpret_cast<const char*>(data),size};}
inline bool isBundle(const uint8_t *data,size_t size){
  const auto value=bundleView(data,size);return value==bundleMarker||value==aotBundleMarker;
}
inline bool isAotBundle(const uint8_t *data,size_t size){return bundleView(data,size)==aotBundleMarker;}
inline thread_local bool rootAdmission=false;
inline thread_local bool aotAdmission=false;
inline std::atomic<uint64_t> sourcePreparations{0},sourceExecutions{0},bytecodeExecutions{0},blockedFallbacks{0};
inline std::atomic<bool> nativeStarted{false};
inline std::atomic<bool> rnwPalInitialized{false};
inline thread_local bool rnwPalAdmission=false,rnwPalInitializing=false;
inline SHUnitCreator rnwPalCreator=nullptr;
inline facebook::jsi::Runtime *owningRuntime=nullptr;
inline bool isRnwPal(const uint8_t *data,size_t size,std::string_view url){return url==rnwJsiPalUrl&&bundleView(data,size)==rnwJsiPalSource;}
struct RnwPalAdmission final {RnwPalAdmission(){rnwPalAdmission=true;}~RnwPalAdmission(){rnwPalAdmission=false;}};
inline void evaluateRnwPal(facebook::jsi::Runtime &runtime){
  if(!rnwPalAdmission||!nativeStarted||owningRuntime!=&runtime||!rnwPalCreator||rnwPalInitializing)throw facebook::jsi::JSError(runtime,"Native RNW JSI manager admission differs");
  if(rnwPalInitialized)return;
  rnwPalInitializing=true;
  try{auto hermes=facebook::jsi::castInterface<facebook::hermes::IHermes>(&runtime);if(!hermes)throw std::runtime_error("RNW JSI manager requires owning Hermes runtime");hermes->evaluateSHUnit(rnwPalCreator);rnwPalInitialized=true;rnwPalInitializing=false;}
  catch(...){rnwPalInitializing=false;throw;}
}
inline bool admitNonNative(bool preparation,bool bytecode){
  if(nativeStarted.load()){++blockedFallbacks;return false;}
  if(preparation){if(!bytecode)++sourcePreparations;}
  else if(bytecode)++bytecodeExecutions;else ++sourceExecutions;
  return true;
}
// Both exports are resolved before the first unit can run. No unit identity
// or registration order is accepted from JavaScript.
struct UnitPlanV5 {uint32_t version,count;const char *revision,*policy,*partitionSha256,*typedUnit,*untypedUnit,*scope,*graphSha256,*typePolicySha256,*executionPlanSha256,*sourceSha256,*typedSourceSha256,*internalJavaScriptSha256,*rnwPalSourceSha256,*contract;};
struct RootAdmission final {
  explicit RootAdmission(bool typed=false){if(rootAdmission)throw std::runtime_error("Nested Static Hermes root admission");rootAdmission=true;aotAdmission=typed;}
  ~RootAdmission(){rootAdmission=false;aotAdmission=false;}
};
// Native SHUnits retain pointers into their image until the VM is destroyed.
// Release-only, one owning runtime per process: pin this one image until exit.
// No JSI values or native function pointers are transferred to a second VM.
inline void evaluate(facebook::jsi::Runtime &runtime) {
  if(!nativeInternalJavaScript)throw facebook::jsi::JSError(runtime,"Static Hermes requires native internal JavaScript builtins");
  if(!rootAdmission)throw facebook::jsi::JSError(runtime,"Static Hermes must start through native bundle admission");
  if(aotAdmission&&(sourcePreparations.load()||sourceExecutions.load()||bytecodeExecutions.load()))throw facebook::jsi::JSError(runtime,"Static Hermes AOT rejects prior source/bytecode execution");
  static std::atomic<bool> claimed{false};
  auto hermes=facebook::jsi::castInterface<facebook::hermes::IHermes>(&runtime);
  if(!hermes)throw std::runtime_error("Static Hermes requires the owning Hermes runtime");
  bool expected=false;
  if(!claimed.compare_exchange_strong(expected,true))throw std::runtime_error("Static Hermes supports one application load per process; restart the Release app");
  wchar_t executable[32768]{};
  const auto length=GetModuleFileNameW(nullptr,executable,32768);
  if(!length||length>=32768)throw std::runtime_error("Static Hermes app directory unavailable");
  const auto file=std::filesystem::path(executable).parent_path()/L"NelyxApp.aot.dll";
  auto image=LoadLibraryExW(file.c_str(),nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
  if(!image)throw std::runtime_error("Static Hermes native application unavailable, Win32="+std::to_string(GetLastError()));
  const auto creator=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_nelyx_app"));
  if(!creator){FreeLibrary(image);throw std::runtime_error("Static Hermes application unit export missing");}
  const auto planGetter=reinterpret_cast<const UnitPlanV5*(*)()>(GetProcAddress(image,"nelyx_sh_plan_v5"));
  const UnitPlanV5 *plan=nullptr;SHUnitCreator typed=nullptr;
  if(aotAdmission){
    if(planGetter)plan=planGetter();
    const auto equal=[](const char *value,std::string_view expected){return value&&std::string_view(value)==expected;};
    bool digest=plan&&plan->partitionSha256&&std::string_view(plan->partitionSha256).size()==64;
    if(digest)for(const char ch:std::string_view(plan->partitionSha256))if(!((ch>='0'&&ch<='9')||(ch>='a'&&ch<='f')))digest=false;
    const auto isDigest=[](const char* value){if(!value||std::string_view(value).size()!=64)return false;for(char ch:std::string_view(value))if(!((ch>='0'&&ch<='9')||(ch>='a'&&ch<='f')))return false;return true;};
    if(!plan||plan->version!=5||plan->count!=(equal(plan->scope,"full-runtime")?3:2)||!equal(plan->revision,"94aa5e1d40a4ce99df79d951cbe45310ec40680c")||!equal(plan->policy,"windows-hermes-94aa5e1d-typed-no-cfg-v1")||!equal(plan->typedUnit,"nelyx_typed")||!equal(plan->untypedUnit,"nelyx_app")||!digest||!(equal(plan->scope,"full-runtime")||equal(plan->scope,"native-probe"))||!isDigest(plan->graphSha256)||!isDigest(plan->typePolicySha256)||!isDigest(plan->executionPlanSha256)||!isDigest(plan->sourceSha256)||!isDigest(plan->typedSourceSha256)||!equal(plan->internalJavaScriptSha256,internalJavaScriptSha256)||!equal(plan->rnwPalSourceSha256,equal(plan->scope,"full-runtime")?rnwJsiPalSha256:std::string_view{})||!plan->contract){FreeLibrary(image);throw std::runtime_error("Static Hermes AOT native unit plan differs");}
    const auto contract=std::string("{\"schema\":\"nelyx.shunit-plan/v5\",\"scope\":\"")+plan->scope+"\",\"revision\":\""+plan->revision+"\",\"compilerPolicy\":\""+plan->policy+"\",\"partitionSha256\":\""+plan->partitionSha256+"\",\"graphSha256\":\""+plan->graphSha256+"\",\"typePolicySha256\":\""+plan->typePolicySha256+"\",\"executionPlanSha256\":\""+plan->executionPlanSha256+"\",\"sourceSha256\":\""+plan->sourceSha256+"\",\"typedSourceSha256\":\""+plan->typedSourceSha256+"\",\"internalJavaScriptSha256\":\""+plan->internalJavaScriptSha256+"\",\"rnwPalSourceSha256\":\""+plan->rnwPalSourceSha256+"\"}";
    if(!equal(plan->contract,contract)){FreeLibrary(image);throw std::runtime_error("Static Hermes AOT native unit plan differs");}
    if(equal(plan->scope,"full-runtime")){rnwPalCreator=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_nelyx_rnw_pal"));if(!rnwPalCreator){FreeLibrary(image);throw std::runtime_error("Native RNW JSI manager export missing");}}
    typed=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_nelyx_typed"));
    if(!typed||typed==creator){FreeLibrary(image);throw std::runtime_error("Static Hermes AOT leaf unit export missing or duplicated");}
  }else if(planGetter){FreeLibrary(image);throw std::runtime_error("Static Hermes AOT image requires its v5 native entry");}
  HMODULE pinned=nullptr;
  if(!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_PIN,reinterpret_cast<LPCWSTR>(creator),&pinned)){
    FreeLibrary(image);throw std::runtime_error("Static Hermes application lifetime admission failed");
  }
  FreeLibrary(image); // The process pin now owns the image, including failure.
  facebook::jsi::Object identity(runtime);
  identity.setProperty(runtime,"mode",aotAdmission?"static-native-aot":"untyped-native");
  identity.setProperty(runtime,"revision","94aa5e1d40a4ce99df79d951cbe45310ec40680c");
  identity.setProperty(runtime,"initialized",false);
  identity.setProperty(runtime,"unitsInitialized",0);
  if(plan){identity.setProperty(runtime,"planVersion",5);identity.setProperty(runtime,"partitionSha256",plan->partitionSha256);identity.setProperty(runtime,"scope",plan->scope);identity.setProperty(runtime,"graphSha256",plan->graphSha256);identity.setProperty(runtime,"typePolicySha256",plan->typePolicySha256);identity.setProperty(runtime,"executionPlanSha256",plan->executionPlanSha256);}
  runtime.global().setProperty(runtime,"__nelyxStaticHermes",std::move(identity));
  nativeStarted=aotAdmission;
  owningRuntime=&runtime;
  if(typed){hermes->evaluateSHUnit(typed);runtime.global().getPropertyAsObject(runtime,"__nelyxStaticHermes").setProperty(runtime,"unitsInitialized",1);}
  hermes->evaluateSHUnit(creator);
  if(plan&&std::string_view(plan->scope)=="full-runtime"&&!rnwPalInitialized)throw facebook::jsi::JSError(runtime,"Native RNW JSI manager did not initialize");
  runtime.global().getPropertyAsObject(runtime,"__nelyxStaticHermes").setProperty(runtime,"unitsInitialized",typed?(rnwPalInitialized?3:2):1);
  runtime.global().getPropertyAsObject(runtime,"__nelyxStaticHermes").setProperty(runtime,"initialized",true);
}
// RNW exposes a Node-API JSI adapter, not the underlying IHermes interface.
// Install this entry inside the pinned supplier's RuntimeWrapper constructor.
inline void install(facebook::jsi::Runtime &runtime) {
  auto audit=facebook::jsi::Function::createFromHostFunction(runtime,
    facebook::jsi::PropNameID::forAscii(runtime,"__nelyxStaticHermesAudit"),0,
    [](facebook::jsi::Runtime &owner,facebook::jsi::Value const&,facebook::jsi::Value const*,size_t){
      facebook::jsi::Object result(owner);
      result.setProperty(owner,"sourcePreparations",double(sourcePreparations.load()));
      result.setProperty(owner,"sourceExecutions",double(sourceExecutions.load()));
      result.setProperty(owner,"bytecodeExecutions",double(bytecodeExecutions.load()));
      result.setProperty(owner,"blockedFallbacks",double(blockedFallbacks.load()));
      result.setProperty(owner,"nativeStarted",nativeStarted.load());
      result.setProperty(owner,"jitEnabled",false);result.setProperty(owner,"evalEnabled",false);
      result.setProperty(owner,"internalJavaScriptNative",nativeInternalJavaScript);
      result.setProperty(owner,"internalJavaScriptSha256",internalJavaScriptSha256.data());
      result.setProperty(owner,"rnwPalNative",rnwPalInitialized.load());
      return facebook::jsi::Value(std::move(result));
    });
  runtime.global().setProperty(runtime,"__nelyxStaticHermesAudit",std::move(audit));
  auto entry=facebook::jsi::Function::createFromHostFunction(runtime,
    facebook::jsi::PropNameID::forAscii(runtime,"__nelyxLoadStaticHermes"),0,
    [](facebook::jsi::Runtime &owner,facebook::jsi::Value const&,facebook::jsi::Value const*,size_t count){
      if(count)throw facebook::jsi::JSError(owner,"Static Hermes entry takes no arguments");
      evaluate(owner);return facebook::jsi::Value::undefined();
    });
  runtime.global().setProperty(runtime,"__nelyxLoadStaticHermes",std::move(entry));
  auto pal=facebook::jsi::Function::createFromHostFunction(runtime,facebook::jsi::PropNameID::forAscii(runtime,"__nelyxLoadRnwJsiPal"),0,[](facebook::jsi::Runtime &owner,facebook::jsi::Value const&,facebook::jsi::Value const*,size_t count){if(count)throw facebook::jsi::JSError(owner,"Native RNW JSI manager takes no arguments");evaluateRnwPal(owner);return facebook::jsi::Value::undefined();});
  runtime.global().setProperty(runtime,"__nelyxLoadRnwJsiPal",std::move(pal));
}
}
