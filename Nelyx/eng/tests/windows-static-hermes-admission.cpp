// SPDX-License-Identifier: BSD-3-Clause
#include <hermes/hermes_api.h>
#include <windows.h>
#include <iostream>
#include <stdexcept>
#include <string>

static napi_env environment=nullptr;
static void check(napi_status status){
  if(status==napi_ok)return;
  std::string message="Node-API status="+std::to_string(status);
  if(status==napi_pending_exception&&environment){
    napi_value error{},text{};size_t bytes=0;
    napi_get_and_clear_last_exception(environment,&error);
    if(napi_coerce_to_string(environment,error,&text)==napi_ok&&napi_get_value_string_utf8(environment,text,nullptr,0,&bytes)==napi_ok){
      std::string value(bytes+1,'\0');napi_get_value_string_utf8(environment,text,value.data(),value.size(),&bytes);value.resize(bytes);message+=" "+value;
    }
  }
  throw std::runtime_error(message);
}
static napi_value run(const char *source){napi_value script{},result{};check(napi_create_string_utf8(environment,source,NAPI_AUTO_LENGTH,&script));check(jsr_run_script(environment,script,"nelyx:admission",&result));return result;}
static napi_value callback(napi_env env,napi_callback_info info){
  size_t count=1;napi_value argument{},result{};check(napi_get_cb_info(env,info,&count,&argument,nullptr,nullptr));double value{};check(napi_get_value_double(env,argument,&value));check(napi_create_double(env,value+7,&result));return result;
}
int main(int argc,char **){
  SetUnhandledExceptionFilter([](EXCEPTION_POINTERS *error)->LONG{HMODULE module=nullptr;wchar_t name[32768]{};const auto address=error->ExceptionRecord->ExceptionAddress;GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(address),&module);GetModuleFileNameW(module,name,32768);std::wcerr<<L"NATIVE_ADMISSION_EXCEPTION module="<<name<<L" offset="<<std::hex<<(reinterpret_cast<uintptr_t>(address)-reinterpret_cast<uintptr_t>(module))<<L" code="<<error->ExceptionRecord->ExceptionCode<<L"\n";return EXCEPTION_EXECUTE_HANDLER;});
  jsr_runtime runtime{};jsr_napi_env_scope scope{};bool opened=false;
  try{
    std::cerr<<"ADMISSION create-runtime\n";jsr_config config{};check(jsr_create_config(&config));check(jsr_config_set_explicit_microtasks(config,true));check(jsr_config_enable_gc_api(config,true));check(jsr_create_runtime(config,&runtime));check(jsr_delete_config(config));check(jsr_runtime_get_node_api_env(runtime,&environment));check(jsr_open_napi_env_scope(environment,&scope));opened=true;std::cerr<<"ADMISSION runtime-ready\n";
    napi_value global{},host{};check(napi_get_global(environment,&global));check(napi_create_function(environment,"hostAdd",NAPI_AUTO_LENGTH,callback,nullptr,&host));check(napi_set_named_property(environment,global,"hostAdd",host));
    std::cerr<<"ADMISSION source-check\n";run("if(1+1!==2)throw Error('source execution');let premature=false;try{__nelyxLoadStaticHermes()}catch(e){premature=true}if(!premature||typeof __nelyxStaticHermes!=='undefined')throw Error('Interpreter entry was admitted');");std::cerr<<"ADMISSION evaluate-unit\n";run("/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n");std::cerr<<"ADMISSION unit-ready\n";
    if(argc>1)throw std::runtime_error("Unexpected native admission success for failure case");
    bool drained=false;check(jsr_drain_microtasks(environment,-1,&drained));if(!drained)throw std::runtime_error("Microtasks did not drain");
    run("if(!__nelyxStaticHermes.initialized||aotResult!==49||aotPromise!==2||aotGetter!==3||aotCurve<.77||aotCurve>.78)throw Error('AOT semantics mismatch'); gc(); if(aotClosure(5)!==12)throw Error('AOT closure lost across GC');let repeated=false;try{__nelyxLoadStaticHermes()}catch(e){repeated=true}if(!repeated)throw Error('Repeated SHUnit admission accepted');");
    bool repeatedRoot=false;try{run("/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n");}catch(std::exception const& error){if(std::string(error.what()).find("one application load")==std::string::npos)throw;repeatedRoot=true;}
    if(!repeatedRoot)throw std::runtime_error("Repeated native root admission accepted");
    check(jsr_close_napi_env_scope(environment,scope));opened=false;check(jsr_delete_runtime(runtime));runtime=nullptr;environment=nullptr;
    std::cout<<"PASS-static-hermes-native-admission owner=one microtasks=drained callbacks=1 gc=retained repeat=rejected runtime=destroyed\n";return 0;
  }catch(std::exception const& error){
    std::cerr<<error.what()<<"\n";
    if(opened)jsr_close_napi_env_scope(environment,scope);
    if(runtime)jsr_delete_runtime(runtime);
    return argc>1?3:2;
  }
}
