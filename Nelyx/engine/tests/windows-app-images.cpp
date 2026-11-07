// SPDX-License-Identifier: BSD-3-Clause
#include <hermes/hermes.h>
#include "../platform/windows/app_text_jsi.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
using namespace nelyx::v2;
int main(int argc,char** argv){
  try{
    if(argc!=3)throw std::runtime_error("Expected image probe and asset root");
    auto ledger=std::make_shared<Ledger>();std::string result;
    {
      windows::AppParagraphs service("","",ledger,argv[2]);
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());auto& rt=*runtime;
      facebook::jsi::Object native(rt);windows::installAppText(rt,native,service);rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      std::ifstream file(argv[1]);std::stringstream source;source<<file.rdbuf();
      rt.evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(source.str()),"image-probe.js");
      for(int steps=0;steps<1000&&!rt.global().hasProperty(rt,"__imageResult")&&!rt.global().hasProperty(rt,"__imageError");++steps)rt.drainMicrotasks();
      if(rt.global().hasProperty(rt,"__imageError"))throw std::runtime_error(rt.global().getProperty(rt,"__imageError").asString(rt).utf8(rt));
      if(!rt.global().hasProperty(rt,"__imageResult"))throw std::runtime_error("Image probe did not settle");
      result=rt.global().getProperty(rt,"__imageResult").asString(rt).utf8(rt);
    }
    if(ledger->snapshot().total)throw std::runtime_error("Image service/runtime termination retained credit");
    std::cout<<"{\"probe\":"<<result<<",\"ledgerAfterTermination\":0}"<<std::endl;
  }catch(const std::exception& error){std::cerr<<error.what()<<std::endl;return 1;}
}
