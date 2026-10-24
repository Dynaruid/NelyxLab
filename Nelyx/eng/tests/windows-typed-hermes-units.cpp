// SPDX-License-Identifier: BSD-3-Clause
#define NOMINMAX
#include <windows.h>
#include <hermes/VM/static_h.h>
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <iostream>
#include <stdexcept>
#include <string>

int main(int argc,char** argv){
  HMODULE image=nullptr;SHRuntime* runtime=nullptr;
  try{
    if(argc!=2)throw std::runtime_error("One prototype mode required");const std::string mode=argv[1];
    image=LoadLibraryExW(L"TypedUnits.dll",nullptr,LOAD_LIBRARY_SEARCH_APPLICATION_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
    if(!image)throw std::runtime_error("Prototype image unavailable");
    auto typed=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,mode=="missing"?"sh_export_absent":"sh_export_typed_leaf"));
    auto untyped=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_untyped_root"));
    auto verify=reinterpret_cast<SHUnitCreator>(GetProcAddress(image,"sh_export_verify_roots"));
    if(!typed||!untyped||!verify)throw std::runtime_error("Prototype unit export missing before initialization");
    runtime=_sh_init(0,nullptr);
    const auto initialized=mode=="reversed"?_sh_initialize_units(runtime,2,untyped,typed):_sh_initialize_units(runtime,2,typed,untyped);
    if(!initialized)throw std::runtime_error("Prototype initialization rejected");
    auto& owner=*_sh_get_hermes_runtime(runtime);if(!owner.drainMicrotasks())throw std::runtime_error("Prototype microtasks did not drain");owner.instrumentation().collectGarbage("typed-unit-prototype");
    if(!_sh_initialize_units(runtime,1,verify))throw std::runtime_error("Prototype roots failed after GC");
    _sh_done(runtime);runtime=nullptr;FreeLibrary(image);image=nullptr;
    std::cout<<"PASS-typed-untyped-units sameVM=1 GC=retained callback=observed identity=shared exceptions=preserved nodeApiAdmission=notVerified\n";return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<"\n";if(runtime)_sh_done(runtime);if(image)FreeLibrary(image);return 3;}
}
