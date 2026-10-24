// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <windows.h>
#include <hermes/hermes_api.h>
#include <iostream>
#include <stdexcept>
static napi_env env=nullptr;
static void check(napi_status status){if(status!=napi_ok)throw std::runtime_error("Node-API failure");}
static napi_value capture(napi_env owner,napi_callback_info){
  auto base=reinterpret_cast<uintptr_t>(GetModuleHandleW(L"NelyxApp.aot.dll"));auto dos=reinterpret_cast<IMAGE_DOS_HEADER*>(base);auto pe=reinterpret_cast<IMAGE_NT_HEADERS64*>(base+dos->e_lfanew);void* frames[64]{};const auto count=CaptureStackBackTrace(0,64,frames,nullptr);
  for(USHORT i=0;i<count;i++){auto pc=reinterpret_cast<uintptr_t>(frames[i]);if(pc>=base&&pc<base+pe->OptionalHeader.SizeOfImage)std::cout<<"NATIVE_PC_RVA "<<pc-base<<"\n";}
  napi_value value{};check(napi_get_undefined(owner,&value));return value;
}
int main(){jsr_runtime runtime{};jsr_napi_env_scope scope{};bool opened=false;try{
  jsr_config config{};check(jsr_create_config(&config));check(jsr_create_runtime(config,&runtime));check(jsr_delete_config(config));check(jsr_runtime_get_node_api_env(runtime,&env));check(jsr_open_napi_env_scope(env,&scope));opened=true;
  napi_value global{},fn{},script{},result{};check(napi_get_global(env,&global));check(napi_create_function(env,"hostCapture",NAPI_AUTO_LENGTH,capture,nullptr,&fn));check(napi_set_named_property(env,global,"hostCapture",fn));
  check(napi_create_string_utf8(env,"/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n",NAPI_AUTO_LENGTH,&script));check(jsr_run_script(env,script,"nelyx:native-pc",&result));check(napi_get_named_property(env,global,"errorTarget",&fn));
  if(napi_call_function(env,global,fn,0,nullptr,&result)!=napi_pending_exception)throw std::runtime_error("Native error was not observed");napi_value error{},text{};check(napi_get_and_clear_last_exception(env,&error));check(napi_coerce_to_string(env,error,&text));char message[256]{};check(napi_get_value_string_utf8(env,text,message,sizeof(message),nullptr));std::cout<<message<<"\n";
  check(jsr_close_napi_env_scope(env,scope));opened=false;check(jsr_delete_runtime(runtime));runtime=nullptr;return 0;
}catch(std::exception const& error){std::cerr<<error.what()<<"\n";if(opened)jsr_close_napi_env_scope(env,scope);if(runtime)jsr_delete_runtime(runtime);return 2;}}
