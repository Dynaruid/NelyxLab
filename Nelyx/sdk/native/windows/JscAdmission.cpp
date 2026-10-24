// SPDX-License-Identifier: BSD-3-Clause
// Runs in a fresh process for each mode, before publishing a supplier.
#include <JscEngine.h>
#include <iostream>

int main() {
  try {
    auto runtime=Nelyx::WindowsJsc::createRuntime();auto &rt=*runtime;
    auto evaluate=[&](std::string source){return rt.evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(std::move(source)),"nelyx:jsc-admission");};
    rt.global().setProperty(rt,"enqueueNative",facebook::jsi::Function::createFromHostFunction(rt,facebook::jsi::PropNameID::forAscii(rt,"enqueueNative"),1,[](auto &runtime,auto const&,auto const *args,size_t count){if(count!=1)throw facebook::jsi::JSError(runtime,"One callback required");runtime.queueMicrotask(args[0].asObject(runtime).asFunction(runtime));return facebook::jsi::Value::undefined();}));
    auto order=evaluate("(()=>{const a=[];Promise.resolve().then(()=>a.push('promise'));enqueueNative(()=>{a.push('host');Promise.resolve().then(()=>a.push('nested'));});a.push('sync');return ()=>a.join(',');})()").asObject(rt).asFunction(rt);
    if(!rt.drainMicrotasks()||order.call(rt).asString(rt).utf8(rt)!="sync,promise,host,nested")throw std::runtime_error("Native/Promise FIFO differs");
    if(evaluate("(()=>{class Box{#n=7;add(x){return this.#n+x}}const b=new Box();const o={get x(){return b.add(2)}};return o.x+Number(10n)+new Uint8Array([3])[0]})()").asNumber()!=22)throw std::runtime_error("JS classes/getters/BigInt/typed array semantics differ");
    auto closure=evaluate("(()=>{const x={n:41};return ()=>++x.n})()").asObject(rt).asFunction(rt);
    if(closure.call(rt).asNumber()!=42)throw std::runtime_error("Rooted closure lifetime differs");
    bool threw=false;try{evaluate("throw new Error('jsc-admission-error')");}catch(facebook::jsi::JSError const& error){threw=std::string(error.what()).find("jsc-admission-error")!=std::string::npos;}
    if(!threw||evaluate("40+2").asNumber()!=42)throw std::runtime_error("Exception/recovery semantics differ");
    std::cout<<"PASS-jsc-native-admission "<<rt.global().getPropertyAsObject(rt,"__nelyxJscRuntimeIdentity").getProperty(rt,"mode").asString(rt).utf8(rt)<<std::endl;
    return 0;
  }catch(std::exception const& error){std::cerr<<error.what()<<std::endl;return 1;}
}
