// SPDX-License-Identifier: BSD-3-Clause
#include <NativeJscRuntime.h>
#include <VmCallbacks.h>
#include <iostream>
#include <vector>

namespace jsi = facebook::jsi;
static void require(bool value, const char* message) {
  if (!value) throw std::runtime_error(message);
}
struct Lease { int& live; explicit Lease(int& value):live(value){++live;} ~Lease(){--live;} };
int main() {
  try {
    int live = 0;
    {
      auto runtime = Nelyx::NativeJsc::createRuntime(); auto& rt = *runtime;
      require(!GetModuleHandleW(L"hermesvm.dll") && !GetModuleHandleW(L"Microsoft.ReactNative.dll") && !GetModuleHandleW(L"node.exe"), "Foreign runtime loaded in JSC admission");
      wchar_t executable[32768]{}, image[32768]{};
      require(GetModuleFileNameW(nullptr,executable,32768)>0 && GetModuleFileNameW(GetModuleHandleW(L"JavaScriptCore.dll"),image,32768)>0,"Loaded JSC image path unavailable");
      require(std::filesystem::equivalent(std::filesystem::path(executable).parent_path()/L"JavaScriptCore.dll",image),"JSC loaded outside the owned diagnostic directory");
      auto evaluate = [&](const char* source) { return rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(source), "nelyx:direct-jsc-admission"); };
      std::vector<std::string> rejected;
      {
        auto handler = jsi::Function::createFromHostFunction(rt, jsi::PropNameID::forAscii(rt,"reject"), 2,
          [&](auto& inner, auto const&, auto const* args, size_t count) {
            require(count == 2, "Rejection callback argument count");
            rejected.push_back(args[1].toString(inner).utf8(inner)); return jsi::Value::undefined();
          });
        Nelyx::NativeJsc::trackRejections(rt, handler);
      }
      evaluate("globalThis.checkpointValue=0;Promise.resolve().then(()=>{checkpointValue=1;});");
      require(evaluate("checkpointValue").asNumber() == 0, "JSC jobs ran before explicit checkpoint");
      rt.drainMicrotasks();
      require(evaluate("checkpointValue").asNumber() == 1, "JSC checkpoint did not run jobs");
      evaluate("Promise.reject('plain-rejection');(async()=>{throw 'async-rejection';})();Promise.reject('handled').catch(()=>{});");
      require(rejected.empty(), "Rejection reported before explicit checkpoint"); rt.drainMicrotasks();
      require(rejected.size()==2 && rejected[0]=="plain-rejection" && rejected[1]=="async-rejection", "Intrinsic rejection tracking differs");
      double now=0;int wakes=0;
      {
        Nelyx::NativeHermes::VmCallbacks callbacks(rt,[&]{return now;},[&]{++wakes;});
        jsi::Object api(rt); callbacks.install(api); rt.global().setProperty(rt,"nativeCallbacks",std::move(api));
        evaluate("globalThis.order=[];nativeCallbacks.requestFrame(()=>{order.push('frame1');Promise.resolve().then(()=>order.push('promise1'));});nativeCallbacks.requestFrame(()=>order.push('frame2'));nativeCallbacks.setTimer(()=>order.push('timer'),0,false);");
        require(wakes==1,"Frame clock admission differs");
        require(callbacks.dispatchFrames(16)==2,"Frame dispatch count differs");
        require(evaluate("order.join(',')").asString(rt).utf8(rt)=="frame1,frame2","Frame callbacks contained an early microtask checkpoint");
        rt.drainMicrotasks();callbacks.runDueTimers();
        require(evaluate("order.join(',')").asString(rt).utf8(rt)=="frame1,frame2,promise1,timer","Frame/timer/checkpoint ordering differs");
        evaluate("nativeCallbacks.queueMicrotask(()=>{throw 'queued-rejection';});");
        require(rejected.size()==2,"Host microtask rejected before checkpoint");rt.drainMicrotasks();
        require(rejected.size()==3 && rejected.back()=="queued-rejection","Host microtask failure was lost");
        evaluate("const cancelTimer=nativeCallbacks.setTimer(()=>{throw 'cancelled-timer-ran';},0,false);nativeCallbacks.clearTimer(cancelTimer);");
        callbacks.runDueTimers();require(rejected.size()==3,"Cancelled native timer ran");
        auto lease=std::make_shared<Lease>(live);
        auto queued=jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"lease"),0,
          [lease](auto&,auto const&,auto const*,size_t){return jsi::Value::undefined();});
        rt.queueMicrotask(queued); callbacks.close(); rt.drainMicrotasks();
        require(callbacks.empty(),"Native callback handles survived close");
        rt.global().setProperty(rt,"nativeCallbacks",jsi::Value::undefined());
      }
      require(evaluate("(()=>{class Box{#n=7;get x(){return this.#n}}return new Box().x+Number(10n)+new Uint8Array([3])[0]})()").asNumber()==20,"Language semantics differ");
      bool threw=false;try{evaluate("throw new Error('native-jsc-exception')");}catch(jsi::JSError const& error){threw=std::string(error.what()).find("native-jsc-exception")!=std::string::npos;}
      require(threw && evaluate("40+2").asNumber()==42,"Exception recovery differs");
      require(evaluate("(()=>{try{eval('1');return false;}catch(e){return e instanceof EvalError;}})()").getBool(),"Dynamic eval policy differs");
      auto noop=evaluate("(()=>{})").getObject(rt).getFunction(rt);Nelyx::NativeJsc::trackRejections(rt,noop);rt.drainMicrotasks();
    }
    require(live==0,"Native callback capture survived VM retirement");
    std::cout << "DIRECT_JSC_RUNTIME_PASS loaded-image, checkpoints, FIFO, intrinsic-rejections, host-errors, frames, timers, language, exceptions, eval-policy, retirement" << std::endl;
    return 0;
  } catch(std::exception const& error) { std::cerr << "DIRECT_JSC_RUNTIME_ERROR " << error.what() << std::endl; return 1; }
}
