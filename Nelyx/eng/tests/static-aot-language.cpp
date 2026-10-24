// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <hermes/hermes_api.h>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
static napi_env env=nullptr;
static void check(napi_status status){if(status!=napi_ok)throw std::runtime_error("Node-API status "+std::to_string(status));}
static void run(const std::string& text){napi_value script{},result{};check(napi_create_string_utf8(env,text.c_str(),text.size(),&script));check(jsr_run_script(env,script,"nelyx:language-reference",&result));}
static std::string result(){bool drained=false;check(jsr_drain_microtasks(env,-1,&drained));if(!drained)throw std::runtime_error("microtasks not drained");napi_value global{},value{};check(napi_get_global(env,&global));check(napi_get_named_property(env,global,"languageResult",&value));size_t count=0;check(napi_get_value_string_utf8(env,value,nullptr,0,&count));std::string text(count+1,'\0');check(napi_get_value_string_utf8(env,value,text.data(),text.size(),&count));text.resize(count);if(text=="pending")throw std::runtime_error("async native result missing");return text;}
int main(int argc,char**){jsr_runtime runtime{};jsr_napi_env_scope scope{};bool opened=false;try{
  jsr_config config{};check(jsr_create_config(&config));check(jsr_config_set_explicit_microtasks(config,true));check(jsr_create_runtime(config,&runtime));check(jsr_delete_config(config));check(jsr_runtime_get_node_api_env(runtime,&env));check(jsr_open_napi_env_scope(env,&scope));opened=true;
  std::ifstream file(argc>1?"expected.json":"source.js",std::ios::binary);std::ostringstream text;text<<file.rdbuf();if(!file||text.str().empty())throw std::runtime_error("reference source missing");std::string reference;if(argc>1)reference=text.str();else{run(text.str());reference=result();}
  run(argc>1?"/*nelyx:static-hermes-aot:94aa5e1d:v5*/\n":"/*nelyx:static-hermes-unit:94aa5e1d:v3*/\n");const auto native=result();if(reference!=native)throw std::runtime_error("native/reference language mismatch");
  check(jsr_close_napi_env_scope(env,scope));opened=false;check(jsr_delete_runtime(runtime));runtime=nullptr;std::cout<<"LANGUAGE_RESULT "<<native<<"\nPASS-native-language\n";return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<"\n";if(opened)jsr_close_napi_env_scope(env,scope);if(runtime)jsr_delete_runtime(runtime);return 1;}}
