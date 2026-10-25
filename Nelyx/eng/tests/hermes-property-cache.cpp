// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <windows.h>
#include <hermes/VM/static_h.h>
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <chrono>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <memory>
#include <string>
#include <vector>
namespace jsi=facebook::jsi;
static void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
class CacheHost final:public jsi::HostObject{public:int reads=0;jsi::Value get(jsi::Runtime& owner,jsi::PropNameID const& name)override{require(name.utf8(owner)=="value","Unexpected host property");return 100.+ ++reads;}};
int main(int argc,char** argv){
  HMODULE image=nullptr;SHRuntime* native=nullptr;std::unique_ptr<facebook::hermes::HermesRuntime> bytecode;
  try{
    require(argc==4,"Expected bytecode|static-aot and two owned product paths");const std::string mode=argv[1];jsi::Runtime* runtime=nullptr;
    if(mode=="bytecode"){bytecode=facebook::hermes::makeHermesRuntime();runtime=bytecode.get();}
    else{require(mode=="static-aot","Unknown cache fixture mode");native=_sh_init(0,nullptr);runtime=_sh_get_hermes_runtime(native);}
    {
      std::vector<jsi::WeakObject> prototypes;
      auto track=jsi::Function::createFromHostFunction(*runtime,jsi::PropNameID::forAscii(*runtime,"trackPrototype"),1,[&](auto& owner,auto const&,auto const* args,size_t count){require(count==1&&args[0].isObject(),"Prototype tracker arguments differ");prototypes.emplace_back(owner,args[0].asObject(owner));return jsi::Value::undefined();});runtime->global().setProperty(*runtime,"trackPrototype",std::move(track));
      if(bytecode){std::ifstream input(argv[2],std::ios::binary);require(bool(input),"Cache bytecode missing");std::string source((std::istreambuf_iterator<char>(input)),{});runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(source)),"nelyx:property-cache.hbc");}
      else{image=LoadLibraryExA(argv[2],nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);require(image!=nullptr,"Cache native unit missing");auto create=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_property_cache"));require(create!=nullptr&&_sh_initialize_units(native,1,create),"Cache native initialization failed");}
      require(runtime->global().getPropertyAsFunction(*runtime,"cacheChecks").call(*runtime).getBool(),"Cache correctness checks failed");
      runtime->instrumentation().collectGarbage("property-cache-weak-roots");
      require(prototypes.size()==1&&prototypes[0].lock(*runtime).isUndefined(),"Property cache retained an unreachable prototype");
      auto retained=runtime->global().getPropertyAsFunction(*runtime,"cacheRetainedRead");require(retained.call(*runtime,runtime->global().getProperty(*runtime,"cacheRetained")).getNumber()==7,"Retained chain invalid after GC");
      const char* timing=std::getenv("NELYX_HERMES_PROPERTY_BENCH");
      if(timing&&std::string(timing)=="1"){
        auto bench=runtime->global().getPropertyAsFunction(*runtime,"cacheBench");std::cout<<"HERMES_PROPERTY_CACHE {\"mode\":\""<<mode<<"\",\"scope\":\"isolated VM lookup fixture; not app performance acceptance\",\"iterations\":400000,\"milliseconds\":{";
        bool first=true;for(auto kind:{"own","inherited","getter","method"}){auto name=jsi::String::createFromAscii(*runtime,kind);require(bench.call(*runtime,name,20000).getNumber()==140000,"Cache warm result differs");const auto start=std::chrono::steady_clock::now();const auto value=bench.call(*runtime,name,400000).getNumber();const auto elapsed=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-start).count();require(value==2800000,"Cache benchmark result differs");if(!first)std::cout<<',';first=false;std::cout<<'\"'<<kind<<"\":"<<elapsed;}std::cout<<"},\"weakPrototypeReleased\":true,\"retainedAfterGC\":true}\n";
      }else std::cout<<"HERMES_PROPERTY_CACHE {\"mode\":\""<<mode<<"\",\"scope\":\"correctness only\",\"weakPrototypeReleased\":true,\"retainedAfterGC\":true}\n";
      // Register stress-only services after the unchanged timing fixture.
      auto host=std::make_shared<CacheHost>();runtime->global().setProperty(*runtime,"hostCacheObject",jsi::Object::createFromHostObject(*runtime,host));
      auto collect=jsi::Function::createFromHostFunction(*runtime,jsi::PropNameID::forAscii(*runtime,"cacheCollect"),0,[](auto& owner,auto const&,auto const*,size_t){owner.instrumentation().collectGarbage("property-cache-old-prototypes");return jsi::Value::undefined();});runtime->global().setProperty(*runtime,"cacheCollect",std::move(collect));
      auto collections=jsi::Function::createFromHostFunction(*runtime,jsi::PropNameID::forAscii(*runtime,"cacheYoungCollections"),0,[](auto& owner,auto const&,auto const*,size_t){const auto info=owner.instrumentation().getHeapInfo(false);const auto found=info.find("hermes_yg_numCollections");require(found!=info.end(),"Young collection counter unavailable");return jsi::Value(double(found->second));});runtime->global().setProperty(*runtime,"cacheYoungCollections",std::move(collections));
      if(bytecode){std::ifstream input(argv[3],std::ios::binary);require(bool(input),"Cache GC bytecode missing");std::string source((std::istreambuf_iterator<char>(input)),{});runtime->evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(source)),"nelyx:property-cache-gc.hbc");}
      else{auto create=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_property_cache_gc"));require(create!=nullptr&&_sh_initialize_units(native,1,create),"Cache GC native initialization failed");}
      require(runtime->global().getPropertyAsFunction(*runtime,"cacheGcChecks").call(*runtime).getBool(),"Old prototype GC/mutation checks failed");
      runtime->instrumentation().collectGarbage("property-cache-old-weak-roots");require(prototypes.size()==2&&prototypes[1].lock(*runtime).isUndefined(),"Old prototype cache kept an unreachable prototype");require(host->reads==20,"Host property calls were cached or skipped");
      const auto rounds=runtime->global().getPropertyAsFunction(*runtime,"cacheYoungChecks").call(*runtime).getNumber();require(rounds>=1&&rounds<=8,"Young pressure exceeded its bound");
      std::cout<<"HERMES_PROPERTY_CACHE_GC {\"mode\":\""<<mode<<"\",\"oldPrototypeMutations\":true,\"getterGC\":true,\"weakPrototypeReleased\":true,\"hostReads\":20,\"youngPressureRounds\":"<<rounds<<"}\n";
    }
    if(native){_sh_done(native);native=nullptr;}bytecode.reset();if(image){FreeLibrary(image);image=nullptr;}return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<'\n';if(native)_sh_done(native);bytecode.reset();if(image)FreeLibrary(image);return 2;}
}
