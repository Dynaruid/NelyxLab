// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <hermes/hermes_api.h>
#include <windows.h>
#include <iostream>
#include <stdexcept>
#include <string>
#include <RnwJsiPal.h>
static napi_env environment=nullptr;
static void check(napi_status status){
  if(status==napi_ok)return;std::string message="Node-API status="+std::to_string(status);
  if(status==napi_pending_exception){napi_value error{},text{};size_t count=0;napi_get_and_clear_last_exception(environment,&error);
    if(napi_coerce_to_string(environment,error,&text)==napi_ok&&napi_get_value_string_utf8(environment,text,nullptr,0,&count)==napi_ok){std::string value(count+1,'\0');napi_get_value_string_utf8(environment,text,value.data(),value.size(),&count);value.resize(count);message+=" "+value;}}
  throw std::runtime_error(message);
}
static napi_value run(const char* source){napi_value script{},result{};check(napi_create_string_utf8(environment,source,NAPI_AUTO_LENGTH,&script));check(jsr_run_script(environment,script,"nelyx:typed-admission",&result));return result;}
static void callGlobal(const char* name){napi_value global{},fn{},result{};check(napi_get_global(environment,&global));check(napi_get_named_property(environment,global,name,&fn));check(napi_call_function(environment,global,fn,0,nullptr,&result));}
static napi_value callback(napi_env env,napi_callback_info info){size_t count=1;napi_value arg{},result{};double value=0;check(napi_get_cb_info(env,info,&count,&arg,nullptr,nullptr));check(napi_get_value_double(env,arg,&value));check(napi_create_double(env,value+7,&result));return result;}
static napi_value requestPal(napi_env env,napi_callback_info){napi_value script{},result{};const auto source=Nelyx::WindowsStaticHermes::rnwJsiPalSource;check(napi_create_string_utf8(env,source.data(),source.size(),&script));check(jsr_run_script(env,script,Nelyx::WindowsStaticHermes::rnwJsiPalUrl.data(),&result));return result;}
static napi_value requestPreparedPal(napi_env env,napi_callback_info){jsr_prepared_script script{};napi_value result{};const auto source=Nelyx::WindowsStaticHermes::rnwJsiPalSource;check(jsr_create_prepared_script(env,reinterpret_cast<const uint8_t*>(source.data()),source.size(),nullptr,nullptr,Nelyx::WindowsStaticHermes::rnwJsiPalUrl.data(),&script));check(jsr_prepared_script_run(env,script,&result));check(jsr_delete_prepared_script(env,script));return result;}
int main(int argc,char** argv){
  jsr_runtime runtime{};jsr_napi_env_scope scope{};bool opened=false;const std::string mode=argc==2?argv[1]:"ordered";
  try{
    jsr_config config{};check(jsr_create_config(&config));check(jsr_config_set_explicit_microtasks(config,true));check(jsr_config_enable_gc_api(config,true));check(jsr_create_runtime(config,&runtime));check(jsr_delete_config(config));check(jsr_runtime_get_node_api_env(runtime,&environment));check(jsr_open_napi_env_scope(environment,&scope));opened=true;
    napi_value global{},host{};check(napi_get_global(environment,&global));check(napi_create_function(environment,"hostAdd",NAPI_AUTO_LENGTH,callback,nullptr,&host));check(napi_set_named_property(environment,global,"hostAdd",host));
    check(napi_create_function(environment,"requestPal",NAPI_AUTO_LENGTH,requestPal,nullptr,&host));check(napi_set_named_property(environment,global,"requestPal",host));
    check(napi_create_function(environment,"requestPreparedPal",NAPI_AUTO_LENGTH,requestPreparedPal,nullptr,&host));check(napi_set_named_property(environment,global,"requestPreparedPal",host));
    check(napi_get_named_property(environment,global,"__nelyxLoadStaticHermes",&host));napi_value premature{};if(napi_call_function(environment,global,host,0,nullptr,&premature)!=napi_pending_exception)throw std::runtime_error("premature entry admitted");check(napi_get_and_clear_last_exception(environment,&premature));
    if(mode=="preexisting-source")run("1+1");
    std::string failure;try{run("/*nelyx:static-hermes-aot:94aa5e1d:v5*/\n");}catch(std::exception const& error){failure=error.what();}
    if(mode=="ordered"||mode=="pal"){
      if(!failure.empty())throw std::runtime_error(failure);bool drained=false;check(jsr_drain_microtasks(environment,-1,&drained));if(!drained)throw std::runtime_error("microtasks not drained");
      callGlobal("unitVerify");
      if(mode=="pal"){
        for(bool wrongUrl:{false,true}){const auto original=Nelyx::WindowsStaticHermes::rnwJsiPalSource;std::string source(original);if(!wrongUrl)source+=' ';napi_value script{},result{};check(napi_create_string_utf8(environment,source.data(),source.size(),&script));
          if(jsr_run_script(environment,script,wrongUrl?"jsi-internal://wrong-manager.js":Nelyx::WindowsStaticHermes::rnwJsiPalUrl.data(),&result)==napi_ok)throw std::runtime_error("modified RNW source/URL accepted");bool pending=false;check(napi_is_exception_pending(environment,&pending));if(pending)check(napi_get_and_clear_last_exception(environment,&result));}
      }
      bool blocked=false;try{run("1+1");}catch(std::exception const&){blocked=true;}if(!blocked)throw std::runtime_error("source fallback accepted");
      try{run("/*nelyx:static-hermes-aot:94aa5e1d:v5*/\n");throw std::runtime_error("repeat accepted");}catch(std::exception const& error){if(std::string(error.what()).find("one application load")==std::string::npos)throw;}
      if(!GetModuleHandleW(L"NelyxApp.aot.dll"))throw std::runtime_error("native image not retained");
    }else{
      if(failure.empty())throw std::runtime_error("invalid hybrid image accepted");
      if(mode=="root-failure")callGlobal("typedFailureVerify");
      else run("if(typeof __nelyxStaticHermes!=='undefined'||typeof typedChecked!=='undefined')throw Error('bad plan ran a unit');");
      std::cout<<"TYPED_ADMISSION_REJECTED "<<failure<<"\n";
    }
    check(jsr_close_napi_env_scope(environment,scope));opened=false;check(jsr_delete_runtime(runtime));runtime=nullptr;
    std::cout<<"PASS-typed-native-admission mode="<<mode<<" sameVM=1 image=retained runtime=destroyed\n";return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<"\n";if(opened)jsr_close_napi_env_scope(environment,scope);if(runtime)jsr_delete_runtime(runtime);return 2;}
}
