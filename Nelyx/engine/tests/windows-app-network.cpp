// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <hermes/hermes.h>
#include "../platform/windows/app_text_jsi.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <thread>
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
namespace jsi=facebook::jsi;
int main(int argc,char** argv){
  try{
    if(argc!=3&&argc!=4)throw std::runtime_error("Expected network probe, HTTP origin and optional asset root");
    auto ledger=std::make_shared<Ledger>();std::string result;
    {
      nw::AppParagraphs service("","",ledger,argc==4?argv[3]:"");
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());auto& rt=*runtime;
      jsi::Object native(rt);nw::installAppText(rt,native,service);rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      rt.global().setProperty(rt,"__networkOrigin",jsi::String::createFromUtf8(rt,argv[2]));
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>("globalThis.__timers=[];globalThis.setTimeout=(f,m=0)=>{const t={f,at:Date.now()+m};__timers.push(t);return t;};globalThis.clearTimeout=t=>{if(t)t.f=null;};globalThis.__pump=()=>{const n=Date.now(),q=__timers.splice(0);for(const t of q){if(t.f&&t.at<=n)t.f();else if(t.f)__timers.push(t);}};"),"network-timers.js");
      std::ifstream file(argv[1]);std::stringstream source;source<<file.rdbuf();
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source.str()),"network-probe.js");
      const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(120);
      while(!rt.global().hasProperty(rt,"__networkResult")&&!rt.global().hasProperty(rt,"__networkError")){
        if(std::chrono::steady_clock::now()>deadline){
          if(rt.global().hasProperty(rt,"__networkInspect"))std::cerr<<rt.global().getPropertyAsFunction(rt,"__networkInspect").call(rt).asString(rt).utf8(rt)<<std::endl;
          else if(rt.global().hasProperty(rt,"__networkStage"))std::cerr<<rt.global().getProperty(rt,"__networkStage").asString(rt).utf8(rt)<<std::endl;
          for(uint64_t owner=1;owner<=2;++owner){const auto& state=service.snapshot(owner);
            for(const auto& [id,request]:state.networks){const auto value=request->snapshot();
              std::cerr<<"HTTP pending owner="<<owner<<" handle="<<id<<" holders="<<request.use_count()<<" phase="<<value.phase<<" status="<<value.status<<" closed="<<value.closed<<" bytes="<<value.bytes<<" error="<<value.error<<std::endl;}}
          throw std::runtime_error("Native HTTP probe did not drain");
        }
        rt.global().getPropertyAsFunction(rt,"__pump").call(rt);rt.drainMicrotasks();std::this_thread::sleep_for(std::chrono::milliseconds(1));
      }
      if(rt.global().hasProperty(rt,"__networkError"))throw std::runtime_error(rt.global().getProperty(rt,"__networkError").asString(rt).utf8(rt));
      result=rt.global().getProperty(rt,"__networkResult").asString(rt).utf8(rt);
    }
    if(ledger->snapshot().total)throw std::runtime_error("HTTP service/runtime termination retained credit");
    std::cout<<"{\"probe\":"<<result<<",\"ledgerAfterTermination\":0}"<<std::endl;
  }catch(const std::exception& error){std::cerr<<error.what()<<std::endl;return 1;}
}
