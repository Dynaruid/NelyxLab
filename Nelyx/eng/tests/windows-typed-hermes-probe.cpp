// SPDX-License-Identifier: BSD-3-Clause
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <hermes/hermes_api.h>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

static napi_env environment=nullptr;
static void check(napi_status status){
  if(status==napi_ok)return;
  std::string message="Node-API status="+std::to_string(status);
  if(status==napi_pending_exception&&environment){
    napi_value error{},text{};size_t size=0;napi_get_and_clear_last_exception(environment,&error);
    if(napi_coerce_to_string(environment,error,&text)==napi_ok&&napi_get_value_string_utf8(environment,text,nullptr,0,&size)==napi_ok){
      std::string value(size+1,'\0');napi_get_value_string_utf8(environment,text,value.data(),value.size(),&size);value.resize(size);message+=" "+value;
    }
  }
  throw std::runtime_error(message);
}
static napi_value run(std::string const& source){napi_value script{},result{};check(napi_create_string_utf8(environment,source.data(),source.size(),&script));check(jsr_run_script(environment,script,"nelyx:typed-compiler-probe",&result));return result;}
int main(int argc,char** argv){
  SetErrorMode(SEM_FAILCRITICALERRORS|SEM_NOGPFAULTERRORBOX);
  jsr_runtime runtime{};jsr_napi_env_scope scope{};bool opened=false;
  try{
    if(argc!=2)throw std::runtime_error("One verification script required");
    std::ifstream input(argv[1]);if(!input)throw std::runtime_error("Verification script unavailable");
    std::string source{std::istreambuf_iterator<char>(input),std::istreambuf_iterator<char>()};
    jsr_config config{};check(jsr_create_config(&config));check(jsr_config_set_explicit_microtasks(config,true));check(jsr_config_enable_gc_api(config,true));check(jsr_create_runtime(config,&runtime));check(jsr_delete_config(config));
    check(jsr_runtime_get_node_api_env(runtime,&environment));check(jsr_open_napi_env_scope(environment,&scope));opened=true;
    // This single-unit compiler probe deliberately uses the existing v1 root.
    // It does not establish a product hybrid loader or module interoperability.
    run("/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n");
    bool drained=false;check(jsr_drain_microtasks(environment,-1,&drained));if(!drained)throw std::runtime_error("Microtasks did not drain");
    const auto result=run(source);size_t size=0;check(napi_get_value_string_utf8(environment,result,nullptr,0,&size));std::string text(size+1,'\0');check(napi_get_value_string_utf8(environment,result,text.data(),text.size(),&size));text.resize(size);
    check(jsr_close_napi_env_scope(environment,scope));opened=false;check(jsr_delete_runtime(runtime));runtime=nullptr;environment=nullptr;
    std::cout<<"TYPED_PROBE_RESULT "<<text<<"\n";return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<"\n";if(opened)jsr_close_napi_env_scope(environment,scope);if(runtime)jsr_delete_runtime(runtime);return 2;}
}
