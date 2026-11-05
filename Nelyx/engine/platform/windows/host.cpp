// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <windowsx.h>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <jsi/instrumentation.h>
#include "../../core/engine.hpp"
#include "skia_provider.hpp"
#include "interaction.hpp"
#include <condition_variable>
#include <deque>
#include <fstream>
#include <iostream>
#include <sstream>
#include <functional>
#include <filesystem>

namespace jsi=facebook::jsi;
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
static double now(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
static std::vector<uint8_t> readFile(const std::string& path){std::ifstream stream(path,std::ios::binary);if(!stream)throw std::runtime_error("File unavailable: "+path);return {std::istreambuf_iterator<char>(stream),{}};}
static std::vector<uint8_t> makePacket(uint32_t op,const std::vector<uint8_t>& data={},bool session=false){
  Writer w(wire::headerBytes+data.size());w.u32(0,wire::magic);w.u16(4,2);w.u32(8,wire::schema);w.u16(12,uint16_t(op));w.u32(16,uint32_t(w.bytes.size()));w.u32(20,1);w.u32(24,1);w.u32(28,session?0:1);w.u32(32,session?0:1);
  if(!data.empty())std::memcpy(w.bytes.data()+wire::headerBytes,data.data(),data.size());return std::move(w.bytes);
}
struct Job{uint32_t id;std::vector<uint8_t> bytes;std::shared_ptr<ExternalLease> memory;};
struct AppHeapAccount {
  std::shared_ptr<Ledger> ledger;std::atomic<uint64_t>& observed;
  void update(jsi::Runtime& runtime){
    const auto info=runtime.instrumentation().getHeapInfo(false);
    const auto heap=info.find("hermes_heapSize"),external=info.find("hermes_externalBytes");
    if(heap==info.end()||external==info.end()||heap->second<0||external->second<0)
      throw std::runtime_error("Hermes App heap accounting is unavailable");
    const auto bytes=uint64_t(heap->second)+uint64_t(external->second);
    try{ledger->report(4,1,bytes);}catch(const Error&){throw std::runtime_error("Hermes App heap exceeded the unified memory budget");}
    observed=bytes;
  }
  ~AppHeapAccount(){ledger->report(4,1,0);observed=0;}
};
struct AppExitSignal{std::atomic<bool>& exited;~AppExitSignal(){exited=true;}};
struct AppRuntimeRegistration {
  std::mutex& gate;facebook::hermes::HermesRuntime*& current;
  AppRuntimeRegistration(std::mutex& lock,facebook::hermes::HermesRuntime*& slot,facebook::hermes::HermesRuntime* runtime):gate(lock),current(slot){std::lock_guard held(gate);current=runtime;}
  ~AppRuntimeRegistration(){std::lock_guard held(gate);current=nullptr;}
};
class Host {
  Engine core{1,1};HWND window=nullptr;
  std::atomic<bool> stopping{false},contentReady{false},renderReady{false},connected{false},appReady{false};
  std::atomic<bool> failed{false},closed{false};
  std::atomic<bool> closing{false},disposeRequested{false},appDisposed{false};
  bool probe=false;
  std::atomic<uint32_t> busyOwners{0};
  std::atomic<int32_t> probeDelta{0},appSeek{-1};
  void injectProbeInput(){const auto delta=probeDelta.exchange(0);if(probe&&delta)PostMessageW(window,WM_APP+2,WPARAM(intptr_t(delta)),0);}
  std::atomic<uint32_t> contentThread{0},renderThread{0},appThread{0};uint32_t uiThread=GetCurrentThreadId();
  std::thread contentOwner,renderOwner,appOwner;
  std::mutex appRuntimeMutex;facebook::hermes::HermesRuntime* appRuntime=nullptr;
  std::atomic<bool> appExited{false};
  std::mutex jobsMutex,doneMutex,sceneMutex,wakeMutex,metricsMutex;
  std::condition_variable changed,appChanged;
  std::deque<Job> jobs,done;
  std::deque<Job> uiJobs;
  std::deque<std::function<void()>> uiCallbacks;
  std::mutex uiMutex;
  std::unique_ptr<nw::Interaction> interaction;
  bool interactionPointer=false;
  std::atomic<bool> interactionDirty{false};
  void postUI(std::function<void()> callback){{std::lock_guard lock(uiMutex);if(uiCallbacks.size()>=256)throw std::runtime_error("UI callback mailbox exceeded");uiCallbacks.push_back(std::move(callback));}PostMessageW(window,WM_APP+3,0,0);}
  size_t jobBytes=0;
  std::shared_ptr<const nw::Prepared> candidate;
  std::shared_ptr<const nw::Prepared> publishedPrepared;
  std::string directory;
  std::string appDirectory;
  std::atomic<uint64_t> rendered{0},paragraphs{0},pictures{0},images{0};
  std::atomic<uint64_t> graphicsRecords{0},nativeExtensions{0};
  std::atomic<uint64_t> appHeapBytes{0};
  std::atomic<double> lazyOffset{0};
  std::atomic<double> scrollOffset{0};
  std::atomic<double> publishedWidth{0},publishedHeight{0};
  std::atomic<uint32_t> contentDelay{0},appDelay{0};
  std::atomic<bool> appUpdate{false};
  std::atomic<bool> contentWake{true},renderWakeRequested{true};
  uint64_t inputSequence=0;double scale=1,width=960,height=720;
  bool dragging=false;double pointerX=0,pointerY=0,pointerAt=0,pointerVelocity=0;
  std::atomic<bool> metricsPending{false};bool focused=true,visible=true;
  std::string control;
  std::vector<uint8_t> call(uint32_t op,const std::vector<uint8_t>& data={},bool session=false){auto bytes=makePacket(op,data,session);return core.dispatch({bytes.data(),bytes.size()});}
  static Reader reader(const std::vector<uint8_t>& bytes){return {bytes.data(),bytes.size()};}
  void notifyError(const std::string& error){failed=true;std::cerr<<"V2_HOST_ERROR "<<error<<std::endl;stopping=true;changed.notify_all();appChanged.notify_all();PostMessageW(window,WM_CLOSE,0,0);}
  void contentLoop(){
    contentThread=GetCurrentThreadId();CoInitializeEx(nullptr,COINIT_MULTITHREADED);
    try{
      nw::ContentProvider provider(directory+"/assets/font.ttf",directory+"/assets/icudtl.dat",core.memoryLedger());contentReady=true;changed.notify_all();
      uint64_t last=0;
      while(!stopping){
        Job job{};bool has=false;
        {std::lock_guard lock(jobsMutex);if(!jobs.empty()){job=std::move(jobs.front());jobs.pop_front();jobBytes-=job.bytes.size();has=true;}}
        contentWake=false;
        if(has){auto result=core.dispatch({job.bytes.data(),job.bytes.size()});
          const auto op=Reader{job.bytes.data(),job.bytes.size()}.u16(12);
          if(op==wire::opcodes::scroll||op==wire::opcodes::listSeek||op==wire::opcodes::gestureReply){renderWakeRequested=true;changed.notify_all();}
          if(Reader{job.bytes.data(),job.bytes.size()}.u16(12)==wire::opcodes::transaction){interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);}
          if(Reader{job.bytes.data(),job.bytes.size()}.u16(12)==wire::opcodes::openView){metricsPending=true;renderWakeRequested=true;changed.notify_all();}
          auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,result.size());{std::lock_guard lock(doneMutex);done.push_back({job.id,std::move(result),std::move(hold)});}appChanged.notify_one();}
        if(const auto delay=contentDelay.exchange(0)){busyOwners.fetch_or(2);std::cout<<"V2_CONTENT_DELAY_START "<<delay<<std::endl;injectProbeInput();std::this_thread::sleep_for(std::chrono::milliseconds(delay));busyOwners.fetch_and(~2u);std::cout<<"V2_CONTENT_DELAY_END"<<std::endl;}
        if(connected){Writer quota(8);quota.u32(0,wire::limits::contentPerStep);auto result=call(wire::opcodes::contentStep,quota.bytes);auto r=reader(result);
          uint64_t attempted=r.u64(wire::headerBytes+wire::stateFields::measurePreparation);
          try {
          if(r.u16(14)==0 && r.u64(wire::headerBytes+wire::stateFields::measureRequest)) {
            auto request=core.measurementSnapshot(1,1);
            if(request){const auto value=provider.measure(*request);Writer reply(value.geometry?128+value.geometry->selection.size()*32:80);
              reply.u64(0,request->preparation);reply.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));reply.u64(16,r.u64(wire::headerBytes+wire::stateFields::device));
              reply.u64(24,request->id);writeHandle(reply,32,request->node->id);
              reply.f64(40,value.width);reply.f64(48,value.height);reply.f64(56,value.minimum);reply.f64(64,value.maximum);reply.f64(72,value.baseline);
              if(value.geometry){const auto& g=*value.geometry;reply.u64(80,g.revision);reply.u32(120,uint32_t(g.selection.size()));
                const auto rect=[&](size_t o,const TextRect& r){reply.f64(o,r.x);reply.f64(o+8,r.y);reply.f64(o+16,r.width);reply.f64(o+24,r.height);};
                rect(88,g.caret);for(size_t i=0;i<g.selection.size();++i)rect(128+i*32,g.selection[i]);}
              auto accepted=call(wire::opcodes::measureResult,reply.bytes);const auto status=reader(accepted).u16(14);
              if(status!=wire::statuses::ok && status!=wire::statuses::stale)throw std::runtime_error("Native provider measurement rejected");
            }
          }
          if(r.u16(14)==0&&(r.u32(wire::headerBytes+wire::stateFields::flags)&16u)){
            auto p=core.providerSnapshot(1,1);
            if(p&&p->id!=last){attempted=p->id;last=p->id;auto prepared=provider.prepare(*p);{std::lock_guard lock(sceneMutex);candidate=std::move(prepared);}renderWakeRequested=true;changed.notify_all();}
          }
          } catch(const std::exception& error) {
            provider.discardMeasurements();Writer reply(24);reply.u64(0,attempted);
            reply.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));reply.u64(16,r.u64(wire::headerBytes+wire::stateFields::device));
            call(wire::opcodes::preparationResult,reply.bytes);std::cout<<"V2_PREPARATION_ERROR "<<error.what()<<std::endl;
          }
          if(r.u16(14)==0 && !(r.u32(wire::headerBytes+wire::stateFields::flags)&16u) && r.u64(wire::headerBytes+wire::stateFields::preparation))contentWake=true;
          if(r.u64(wire::headerBytes+wire::stateFields::queryId)&&r.u32(wire::headerBytes+wire::stateFields::queryStatus)==wire::statuses::pending)contentWake=true;
        }
        paragraphs=provider.paragraphs.load();pictures=provider.pictures.load();images=provider.images.load();
        graphicsRecords=provider.graphicsRecords.load();nativeExtensions=provider.nativeExtensions.load();
        std::unique_lock lock(wakeMutex);changed.wait(lock,[this]{std::lock_guard queueLock(jobsMutex);return stopping||contentWake||contentDelay||!jobs.empty();});
      }
      {std::lock_guard lock(sceneMutex);candidate.reset();}
    }catch(const std::exception& error){notifyError(error.what());}
    CoUninitialize();
  }
  void renderLoop(){
    renderThread=GetCurrentThreadId();
    try{
      nw::RenderProvider provider{uint64_t(uintptr_t(window)),uiThread,core.memoryLedger()};renderReady=true;
      std::cout<<"V2_RENDERER "<<provider.driver()<<std::endl;
      while(!stopping&&!contentReady)std::this_thread::sleep_for(std::chrono::milliseconds(2));
      if(stopping)return;
      core.connectProvider(true,contentThread,renderThread);connected=true;appChanged.notify_all();changed.notify_all();
      std::shared_ptr<const nw::Prepared> active,next;
      double lastWidth=-1,lastHeight=-1,lastScale=-1;
      bool clock=false;
      double deadline=0;
      uint64_t lastReportedInput=0,lastReportedDocument=0;
      while(!stopping){
        renderWakeRequested=false;
        if(metricsPending.exchange(false)){
          auto state=call(wire::opcodes::inspect);auto r=reader(state);
          if(r.u16(14)==0){
            std::lock_guard lock(metricsMutex);
            if(width!=lastWidth||height!=lastHeight||scale!=lastScale){
              Writer m(40);m.u64(0,r.u64(wire::headerBytes+wire::stateFields::metrics)+1);m.f64(8,width);m.f64(16,height);m.f64(24,scale);m.u64(32,r.u64(wire::headerBytes+wire::stateFields::lastInput));
              call(wire::opcodes::metrics,m.bytes);lastWidth=width;lastHeight=height;lastScale=scale;
            }
            Writer v(16);v.u32(0,(visible?1u:0u)|(focused?2u:0u));v.u64(8,r.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,v.bytes);contentWake=true;changed.notify_all();
            interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);
          }
        }
        {std::lock_guard lock(sceneMutex);if(candidate){next=std::move(candidate);candidate.reset();}}
        if(next){Writer p(24);p.u64(0,next->id);p.u64(8,next->metrics);p.u64(16,next->device);auto ack=call(wire::opcodes::providerReady,p.bytes);if(reader(ack).u16(14)!=0)next.reset();}
        Writer tick(8);tick.f64(0,now());auto state=call(wire::opcodes::tick,tick.bytes);auto sr=reader(state);
        if(sr.u16(14)==0){
          auto result=call(wire::opcodes::takeFrame);auto r=reader(result);
          if(r.u16(14)==0){
            const auto id=r.u64(wire::headerBytes+wire::stateFields::submission);auto frame=core.frameSnapshot(1,1,id);
            bool firstScroll=true;for(const auto& item:frame->items)if(frame->scene->document->get(item.node).kind==wire::kinds::scrollViewport){if(firstScroll){scrollOffset=frame->properties[item.node.slot].offset;firstScroll=false;}else lazyOffset=frame->properties[item.node.slot].offset;}
            if(next&&next->id==frame->scene->preparation){active=std::move(next);next.reset();}
            if(!active||active->id!=frame->scene->preparation)throw std::runtime_error("Native active preparation resource is missing");
            bool drawn=false;
            const auto busyAtCompose=busyOwners.load();
            try{drawn=provider.draw(*frame,*active);}catch(...){Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(20,1);call(wire::opcodes::releaseFrame,release.bytes);throw;}
            rendered=provider.draws;
            Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(16,drawn?1:0);release.u32(20,drawn?0:1);call(wire::opcodes::releaseFrame,release.bytes);
            if(!drawn){metricsPending=true;std::unique_lock lock(wakeMutex);changed.wait_for(lock,std::chrono::milliseconds(16),[this]{return stopping.load();});continue;}
            Writer publication(24);publication.u64(0,id);publication.u64(8,frame->device);call(wire::opcodes::publish,publication.bytes);
            {std::lock_guard lock(sceneMutex);publishedPrepared=active;}
            interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);
            publishedWidth=frame->scene->metrics.width;publishedHeight=frame->scene->metrics.height;
            if(probe&&frame->scene->document->epoch>lastReportedDocument){lastReportedDocument=frame->scene->document->epoch;std::cout<<"V2_SCENE_PUBLISHED "<<lastReportedDocument<<std::endl;}
            const auto input=r.u64(wire::headerBytes+wire::stateFields::consumedThrough);
            if(probe&&input>lastReportedInput){lastReportedInput=input;std::cout<<"V2_INPUT_FRAME {\"input\":"<<input<<",\"offset\":"<<scrollOffset<<",\"busyAtCompose\":"<<busyAtCompose<<",\"busyAtCompletion\":"<<busyOwners<<"}"<<std::endl;}
          }
          call(wire::opcodes::pollEvents);
          clock=(sr.u32(wire::headerBytes+wire::stateFields::flags)&128u)!=0;
          deadline=sr.f64(wire::headerBytes+wire::stateFields::nextDeadline);
          if(sr.u64(wire::headerBytes+wire::stateFields::pendingDocument)){contentWake=true;changed.notify_all();}
        }
        std::unique_lock lock(wakeMutex);
        const auto wake=[this]{return stopping||renderWakeRequested||metricsPending;};
        if(clock)changed.wait_for(lock,std::chrono::milliseconds(16),wake);
        else if(deadline>0)changed.wait_for(lock,std::chrono::duration<double>(std::max(0.001,deadline-now())),wake);
        else changed.wait(lock,wake);
      }
      active.reset();next.reset();provider.close();
    }catch(const std::exception& error){notifyError(error.what());}
  }
  void appLoop(){
    AppExitSignal exitSignal{appExited};
    appThread=GetCurrentThreadId();
    try{
      while(!stopping&&!connected)std::this_thread::sleep_for(std::chrono::milliseconds(2));if(stopping)return;
      AppHeapAccount appMemory{core.memoryLedger(),appHeapBytes};
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withAsyncBreakCheckInEval(true).build());
      AppRuntimeRegistration registration(appRuntimeMutex,appRuntime,runtime.get());
      auto& rt=*runtime;
      appMemory.update(rt);
      auto native=jsi::Object(rt);
      auto identity=jsi::Object(rt);identity.setProperty(rt,"engine","v2");identity.setProperty(rt,"abiMajor",double(wire::abiMajor));identity.setProperty(rt,"schema",double(wire::schema));native.setProperty(rt,"identity",std::move(identity));
      native.setProperty(rt,"enqueue",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"enqueue"),2,[this,&appMemory](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        appMemory.update(r);
        if(count!=2)throw jsi::JSError(r,"V2 enqueue arguments");auto buffer=args[1].getObject(r).getArrayBuffer(r);const auto length=buffer.size(r);
        std::lock_guard lock(jobsMutex);if(stopping||jobs.size()+uiJobs.size()>=32||jobBytes+length>4*wire::limits::packetBytes)throw jsi::JSError(r,"V2 native mailbox full/closed");
        auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,length);std::vector<uint8_t> bytes(buffer.data(r),buffer.data(r)+length);const auto op=Reader{bytes.data(),bytes.size()}.u16(12);
        if(op==wire::opcodes::memoryReport)throw jsi::JSError(r,"Memory reports are host-only");
        if(op==wire::opcodes::edit||op==wire::opcodes::focus||op==wire::opcodes::semanticsAction){uiJobs.push_back({uint32_t(args[0].asNumber()),std::move(bytes),std::move(hold)});PostMessageW(window,WM_APP+3,0,0);}
        else jobs.push_back({uint32_t(args[0].asNumber()),std::move(bytes),std::move(hold)});jobBytes+=length;
        contentWake=true;
        changed.notify_all();return jsi::Value::undefined();}));
      native.setProperty(rt,"asset",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"asset"),1,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t)->jsi::Value{
        const auto name=args[0].asString(r).utf8(r);std::filesystem::path file;
        if(appDirectory.empty()){if(name!="image")throw jsi::JSError(r,"Unknown native asset");file=directory+"/assets/image.webp";}
        else{const auto root=std::filesystem::canonical(std::filesystem::path(appDirectory)/"application/assets");file=std::filesystem::canonical(root/name);const auto relative=file.lexically_relative(root);
          if(relative.empty()||relative.is_absolute()||*relative.begin()==".."||!std::filesystem::is_regular_file(file))throw jsi::JSError(r,"Invalid application asset path");}
        const auto size=std::filesystem::file_size(file);if(size>wire::limits::resourceBytes)throw jsi::JSError(r,"Application asset budget exceeded");ExternalLease staging(core.memoryLedger(),3,4,size*2);
        auto bytes=readFile(file.string());auto array=r.global().getPropertyAsFunction(r,"ArrayBuffer").callAsConstructor(r,double(bytes.size())).getObject(r);auto buffer=array.getArrayBuffer(r);std::memcpy(buffer.data(r),bytes.data(),bytes.size());return array;}));
      native.setProperty(rt,"notify",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"notify"),1,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t)->jsi::Value{
        const auto message=args[0].asString(r).utf8(r);if(message.find("app-delay-start")!=std::string::npos)busyOwners.fetch_or(1);if(message.find("app-delay-end")!=std::string::npos)busyOwners.fetch_and(~1u);std::cout<<"V2_APP "<<message<<std::endl;if(message.find("app-delay-start")!=std::string::npos)injectProbeInput();if(message.find("app-ready")!=std::string::npos)appReady=true;if(message.find("app-disposed")!=std::string::npos)appDisposed=true;if(message.find("app-error")!=std::string::npos){stats();notifyError(message);}return jsi::Value::undefined();}));
      rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      const auto bootstrap=std::string("globalThis.__v2Timers=[];globalThis.setTimeout=(f,m=0)=>{const t={f,at:Date.now()+m};__v2Timers.push(t);return t;};globalThis.clearTimeout=t=>{if(t)t.f=null;};globalThis.__v2Pump=()=>{const n=Date.now();const q=__v2Timers.splice(0);for(const t of q){if(t.f&&t.at<=n)t.f();else if(t.f)__v2Timers.push(t);}};");
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(bootstrap),"v2-timers.js");
      const auto source=readFile(appDirectory.empty()?directory+"/web/app-native.js":appDirectory+"/application/app.js");rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::string(source.begin(),source.end())),"app-native.js");rt.drainMicrotasks();
      while(!stopping){
        if(disposeRequested.exchange(false)){rt.global().getPropertyAsFunction(rt,"__v2Dispose").call(rt);rt.drainMicrotasks();}
        if(const auto delay=appDelay.exchange(0)){rt.global().getPropertyAsFunction(rt,"__v2Delay").call(rt,double(delay));rt.drainMicrotasks();}
        if(appUpdate.exchange(false)&&appDirectory.empty()){rt.global().getPropertyAsFunction(rt,"__v2Update").call(rt);rt.drainMicrotasks();}
        if(const auto index=appSeek.exchange(-1);index>=0){rt.global().getPropertyAsFunction(rt,"__v2Seek").call(rt,double(index));rt.drainMicrotasks();}
        Job result{};bool has=false;
        {std::lock_guard lock(doneMutex);if(!done.empty()){result=std::move(done.front());done.pop_front();has=true;}}
        if(has){auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(result.bytes.size())).getObject(rt);auto buffer=array.getArrayBuffer(rt);std::memcpy(buffer.data(rt),result.bytes.data(),result.bytes.size());rt.global().getPropertyAsFunction(rt,"__v2Resolve").call(rt,double(result.id),std::move(array));rt.drainMicrotasks();}
        rt.global().getPropertyAsFunction(rt,"__v2Pump").call(rt);rt.drainMicrotasks();appMemory.update(rt);
        std::unique_lock lock(wakeMutex);appChanged.wait_for(lock,std::chrono::milliseconds(2));
      }
    }catch(const std::exception& error){notifyError(error.what());}
  }
 public:
  Host(std::string directory,bool probe,std::string appDirectory={}):probe(probe),directory(std::move(directory)),appDirectory(std::move(appDirectory)){}
  void bind(HWND value){window=value;interaction=std::make_unique<nw::Interaction>(window,core,[this](uint32_t op,const std::vector<uint8_t>& bytes){return call(op,bytes);},[this](auto callback){postUI(std::move(callback));},[this]{contentWake=true;renderWakeRequested=true;changed.notify_all();});contentOwner=std::thread([this]{contentLoop();});renderOwner=std::thread([this]{renderLoop();});appOwner=std::thread([this]{appLoop();});}
  bool filter(const MSG& message){return interaction&&interaction->filter(message);}
  bool keydown(WPARAM key){return interaction&&interaction->keydown(key);}
  bool character(wchar_t unit){return interaction&&interaction->character(unit);}
  LRESULT object(WPARAM w,LPARAM l){return interaction?interaction->object(w,l):0;}
  void ui(){
    if(closed)return;
    std::deque<std::function<void()>> callbacks;{std::lock_guard lock(uiMutex);callbacks.swap(uiCallbacks);}for(auto& callback:callbacks)callback();
    std::deque<Job> accepted;{std::lock_guard lock(jobsMutex);accepted.swap(uiJobs);for(const auto& job:accepted)jobBytes-=job.bytes.size();}
    for(auto& job:accepted){auto result=interaction->gateway(job.bytes);auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,result.size());{std::lock_guard lock(doneMutex);done.push_back({job.id,std::move(result),std::move(hold)});}appChanged.notify_one();}
    if(interactionDirty.exchange(false)&&interaction){std::shared_ptr<const nw::Prepared> published;{std::lock_guard lock(sceneMutex);published=publishedPrepared;}interaction->sync(std::move(published));}
  }
  void timer(UINT_PTR id){if(interaction)interaction->timer(id);if(id==1)poll();}
  void metrics(){if(!window)return;RECT r{};GetClientRect(window,&r);std::lock_guard lock(metricsMutex);scale=GetDpiForWindow(window)/96.0;width=IsIconic(window)?0:(r.right-r.left)/scale;height=IsIconic(window)?0:(r.bottom-r.top)/scale;visible=IsWindowVisible(window)&&!IsIconic(window);metricsPending=true;renderWakeRequested=true;changed.notify_all();}
  void focus(bool value){
    bool shown;{std::lock_guard lock(metricsMutex);focused=value;shown=visible;}
    auto bytes=call(wire::opcodes::inspect);auto state=reader(bytes);if(state.u16(14)==wire::statuses::ok){Writer flags(16);flags.u32(0,(shown?1u:0u)|(value?2u:0u));flags.u64(8,state.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,flags.bytes);}
    metricsPending=true;renderWakeRequested=true;changed.notify_all();
  }
  void update(){if(appReady&&!stopping)appUpdate=true;}
  void probeWheel(int32_t delta){if(probe)wheel(delta,260,300);}
  void pointer(uint32_t phase,double x,double y){
    if(!appReady||stopping)return;
    if(phase==wire::phases::begin&&interaction&&interaction->point(phase,x,y)){interactionPointer=true;return;}
    if(interactionPointer){interaction->point(phase,x,y);if(phase==wire::phases::end||phase==wire::phases::cancel)interactionPointer=false;return;}
    const bool hover=phase==wire::phases::update&&!dragging;
    if(phase!=wire::phases::begin&&!dragging&&!hover)return;
    auto state=call(wire::opcodes::inspect);auto r=reader(state);if(r.u16(14))return;
    const auto at=now(),dt=std::max(0.001,at-pointerAt);
    const auto dx=phase==wire::phases::update?pointerX-x:0,dy=phase==wire::phases::update?pointerY-y:0;
    if(phase==wire::phases::begin){dragging=true;pointerVelocity=0;}
    if(phase==wire::phases::update)pointerVelocity=dy/dt;
    if(phase==wire::phases::cancel||dt>0.08)pointerVelocity=0;
    if(phase==wire::phases::end||phase==wire::phases::cancel)dragging=false;
    pointerX=x;pointerY=y;pointerAt=at;
    Writer input(wire::inputBytes);input.u64(0,++inputSequence);input.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));input.u32(24,1);input.u32(28,phase);input.u32(32,wire::sources::engineDriven);input.f64(40,at);input.f64(56,x);input.f64(64,y);input.f64(72,dx);input.f64(80,dy);input.f64(88,pointerVelocity);input.u32(96,1);input.u32(100,dragging?1:0);input.u32(112,1);
    input.u32(36,hover?6u:2u);
    input.u64(wire::inputFields::publication,r.u64(wire::headerBytes+wire::stateFields::publication));
    call(wire::opcodes::input,input.bytes);renderWakeRequested=true;changed.notify_all();
  }
  void cancelPointer(){if(dragging)pointer(wire::phases::cancel,pointerX,pointerY);}
  void wheel(double delta,double x,double y){
    if(!appReady||stopping)return;auto result=call(wire::opcodes::inspect);auto r=reader(result);if(r.u16(14))return;
    Writer input(wire::inputBytes);input.u64(0,++inputSequence);input.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));input.u32(24,1);input.u32(28,wire::phases::update);input.u32(32,wire::sources::wheelUnknown);input.f64(40,now());input.f64(56,x);input.f64(64,y);input.f64(80,delta);input.u32(96,1);input.u64(wire::inputFields::publication,r.u64(wire::headerBytes+wire::stateFields::publication));call(wire::opcodes::input,input.bytes);renderWakeRequested=true;changed.notify_all();
  }
  void poll(){
    ui();
    DWORD available=0;const auto pipe=GetStdHandle(STD_INPUT_HANDLE);
    if(PeekNamedPipe(pipe,nullptr,0,nullptr,&available,nullptr)&&available){char data[1024];DWORD read=0;ReadFile(pipe,data,std::min<DWORD>(available,sizeof(data)),&read,nullptr);control.append(data,read);if(control.size()>4096)control.clear();}
    for(size_t end;(end=control.find('\n'))!=std::string::npos;){auto line=control.substr(0,end);control.erase(0,end+1);std::istringstream in(line);std::string command;in>>command;int value=0;in>>value;
      if(command=="close")PostMessageW(window,WM_CLOSE,0,0);
      else if(command=="update")appUpdate=true;
      else if(command=="arm-input")probeDelta=std::clamp(value,-500,500);
      else if(command=="minimize")ShowWindow(window,SW_MINIMIZE);
      else if(command=="restore")ShowWindow(window,SW_RESTORE);
      else if(command=="resize"){const auto dpi=GetDpiForWindow(window);RECT bounds{0,0,MulDiv(std::clamp(value,320,1280),int(dpi),96),MulDiv(720,int(dpi),96)};AdjustWindowRectExForDpi(&bounds,WS_OVERLAPPEDWINDOW,FALSE,0,dpi);SetWindowPos(window,nullptr,0,0,bounds.right-bounds.left,bounds.bottom-bounds.top,SWP_NOMOVE|SWP_NOZORDER);}
      else if(command=="delay-app")appDelay=uint32_t(std::clamp(value,0,2000));
      else if(command=="delay-content"){contentDelay=uint32_t(std::clamp(value,0,2000));changed.notify_all();}
      else if(command=="wheel")wheel(value,260,300);
      else if(command=="lazy-wheel")wheel(value,650,420);
      else if(command=="seek")appSeek=std::clamp(value,0,1999);
      else if(command=="stats")stats();
    }
  }
  void stats(){auto bytes=call(wire::opcodes::inspect);auto r=reader(bytes);const auto b=wire::headerBytes;
    std::cout<<"V2_STATS {\"appReady\":"<<(appReady?"true":"false")<<",\"uiThread\":"<<uiThread<<",\"appThread\":"<<appThread<<",\"contentThread\":"<<contentThread<<",\"renderThread\":"<<renderThread<<",\"frames\":"<<rendered<<",\"scrollOffset\":"<<scrollOffset<<",\"lazyOffset\":"<<lazyOffset<<",\"nodeCount\":"<<r.u32(b+wire::stateFields::nodeCount)<<",\"width\":"<<publishedWidth<<",\"height\":"<<publishedHeight<<",\"visible\":"<<((r.u32(b+wire::stateFields::flags)&2u)?"true":"false")<<",\"paragraphs\":"<<paragraphs<<",\"images\":"<<images<<",\"pictures\":"<<pictures<<",\"consumed\":"<<r.u64(b+wire::stateFields::consumed)<<",\"received\":"<<r.u64(b+wire::stateFields::received)<<",\"queued\":"<<r.u32(b+wire::stateFields::queued)<<",\"layoutWork\":"<<r.u64(b+wire::stateFields::layoutWork)<<",\"layoutReused\":"<<r.u64(b+wire::stateFields::layoutReused)<<",\"graphicsRecords\":"<<graphicsRecords<<",\"nativeExtensions\":"<<nativeExtensions<<",\"appHeapBytes\":"<<appHeapBytes<<",\"memoryTotal\":"<<r.u64(b+wire::stateFields::memoryTotal)<<",\"memoryPeak\":"<<r.u64(b+wire::stateFields::memoryPeak)<<",\"memoryGpu\":"<<r.u64(b+wire::stateFields::memoryGpu)<<",\"nativeCommands\":"<<r.u64(b+wire::stateFields::transactionWork)<<",\"ticks\":"<<r.u64(b+wire::stateFields::ticks)<<",\"document\":"<<r.u64(b+wire::stateFields::document)<<",\"activeDocument\":"<<r.u64(b+wire::stateFields::activeDocument)<<",\"preparation\":"<<r.u64(b+wire::stateFields::preparation)<<",\"pendingDocument\":"<<r.u64(b+wire::stateFields::pendingDocument)<<",\"metrics\":"<<r.u64(b+wire::stateFields::metrics)<<",\"contentWork\":"<<r.u64(b+wire::stateFields::contentWork)<<",\"editingWork\":"<<r.u64(b+wire::stateFields::editingWork)<<",\"semanticsWork\":"<<r.u64(b+wire::stateFields::semanticsWork)<<",\"queryWork\":"<<r.u64(b+wire::stateFields::queryWork)<<",\"gestureWork\":"<<r.u64(b+wire::stateFields::gestureWork)<<",\"controlWork\":"<<r.u64(b+wire::stateFields::controlWork)<<",\"fallbacks\":0,\"surfaceCommit\":null}"<<std::endl;
  }
  bool hasFailed()const{return failed;}
  void uiFailure(const std::string& error){notifyError(error);}
  void close(){
    if(closing.exchange(true))return;
    if(appReady&&!stopping){
      disposeRequested=true;appChanged.notify_all();const auto deadline=now()+3;
      while(!appDisposed&&!stopping&&now()<deadline){ui();std::this_thread::sleep_for(std::chrono::milliseconds(1));}
      if(!appDisposed&&!stopping){failed=true;std::cerr<<"V2_HOST_ERROR App disposal timeout"<<std::endl;}
    }
    closed=true;stopping=true;changed.notify_all();appChanged.notify_all();
    const auto appDeadline=now()+0.25;
    while(!appExited&&now()<appDeadline)std::this_thread::sleep_for(std::chrono::milliseconds(1));
    if(!appExited){std::lock_guard lock(appRuntimeMutex);if(appRuntime){failed=true;std::cerr<<"V2_HOST_ERROR Interrupting stalled App JavaScript"<<std::endl;appRuntime->asyncTriggerTimeout();}}
    if(appOwner.joinable())appOwner.join();if(contentOwner.joinable())contentOwner.join();if(renderOwner.joinable())renderOwner.join();
    if(interaction){interaction->close();interaction.reset();}
    std::deque<std::function<void()>> callbacks;{std::lock_guard lock(uiMutex);callbacks.swap(uiCallbacks);}for(auto& callback:callbacks)callback();callbacks.clear();
    {std::lock_guard lock(sceneMutex);candidate.reset();publishedPrepared.reset();}
    SkGraphics::PurgeAllCaches();
    {std::lock_guard lock(jobsMutex);jobs.clear();uiJobs.clear();jobBytes=0;}{std::lock_guard lock(doneMutex);done.clear();}
    auto result=call(wire::opcodes::closeSession,{},true);auto r=reader(result);const auto memory=core.memoryLedger()->snapshot();
    if(r.u16(14)||r.u64(wire::headerBytes+wire::stateFields::reservedBytes)||memory.total)failed=true;
    std::cout<<"V2_CLOSED {\"status\":"<<r.u16(14)<<",\"reservedBytes\":"<<r.u64(wire::headerBytes+wire::stateFields::reservedBytes)<<",\"memoryTotal\":"<<memory.total<<",\"memoryPeak\":"<<memory.peak<<",\"workersJoined\":true}"<<std::endl;
  }
  ~Host(){close();}
};
static LRESULT CALLBACK procedure(HWND window,UINT message,WPARAM w,LPARAM l){
  auto* host=reinterpret_cast<Host*>(GetWindowLongPtrW(window,GWLP_USERDATA));
  if(message==WM_NCCREATE){host=static_cast<Host*>(reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);SetWindowLongPtrW(window,GWLP_USERDATA,LONG_PTR(host));}
  try{if(host)switch(message){case WM_SIZE:case WM_SHOWWINDOW:host->metrics();return 0;case WM_SETFOCUS:host->focus(true);return 0;case WM_KILLFOCUS:host->focus(false);return 0;
    case WM_APP+3:host->ui();return 0;
    case WM_GETOBJECT:if(l==UiaRootObjectId)return host->object(w,l);break;
    case WM_APP+2:host->probeWheel(int32_t(intptr_t(w)));return 0;
    case WM_KEYDOWN:if(host->keydown(w))return 0;if(w=='U'&&(GetKeyState(VK_CONTROL)&0x8000)){host->update();return 0;}break;
    case WM_CHAR:if(host->character(wchar_t(w)))return 0;break;
    case WM_LBUTTONDOWN:{SetFocus(window);SetCapture(window);const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::begin,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);return 0;}
    case WM_MOUSEMOVE:{TRACKMOUSEEVENT track{sizeof(TRACKMOUSEEVENT),TME_LEAVE,window,0};TrackMouseEvent(&track);const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::update,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);}return 0;
    case WM_MOUSELEAVE:host->pointer(wire::phases::update,-1,-1);return 0;
    case WM_LBUTTONUP:{const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::end,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);if(GetCapture()==window)ReleaseCapture();return 0;}
    case WM_CAPTURECHANGED:case WM_CANCELMODE:host->cancelPointer();return 0;
    case WM_MOUSEWHEEL:{POINT p{GET_X_LPARAM(l),GET_Y_LPARAM(l)};ScreenToClient(window,&p);double scale=GetDpiForWindow(window)/96.0;host->wheel(-GET_WHEEL_DELTA_WPARAM(w)/120.0*48,p.x/scale,p.y/scale);return 0;}
    case WM_ERASEBKGND:return 1;case WM_TIMER:host->timer(w);return 0;case WM_CLOSE:host->close();DestroyWindow(window);return 0;case WM_DESTROY:PostQuitMessage(0);return 0;}
  return DefWindowProcW(window,message,w,l);
  }catch(const ::Nelyx::WindowsSemantics::TextError& e){if(host)host->uiFailure("UIA publication rejected HRESULT="+std::to_string(e.result));return 0;}
  catch(const std::exception& e){if(host)host->uiFailure(e.what());return 0;}
  catch(...){if(host)host->uiFailure("Unhandled UI bridge exception");return 0;}
}
int main(int argc,char**argv){
  try{
    if(argc<2)throw std::runtime_error("Usage: NelyxEngineV2Host <current engine dist> [--probe] [--app <bundle directory>]");
    bool probe=false;std::string appDirectory;
    for(int i=2;i<argc;++i){const std::string option=argv[i];if(option=="--probe"&&!probe)probe=true;
      else if(option=="--app"&&appDirectory.empty()&&i+1<argc)appDirectory=std::filesystem::canonical(argv[++i]).string();
      else throw std::runtime_error("Unknown or duplicate native host option: "+option);}
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    if(FAILED(CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED)))throw std::runtime_error("UI COM apartment failed");
    struct Apartment{~Apartment(){CoUninitialize();}}apartment;
    Host host(argv[1],probe,std::move(appDirectory));const auto instance=GetModuleHandleW(nullptr);WNDCLASSW klass{};klass.hInstance=instance;klass.lpszClassName=L"NelyxEngineV2Host";klass.lpfnWndProc=procedure;klass.hCursor=LoadCursorW(nullptr,IDC_ARROW);RegisterClassW(&klass);
    const auto dpi=GetDpiForSystem();RECT bounds{0,0,LONG(960*dpi/96),LONG(720*dpi/96)};AdjustWindowRectExForDpi(&bounds,WS_OVERLAPPEDWINDOW,FALSE,0,dpi);
    const auto window=CreateWindowExW(0,klass.lpszClassName,L"Nelyx Engine v2 — Native Skia",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,bounds.right-bounds.left,bounds.bottom-bounds.top,nullptr,nullptr,instance,&host);
    if(!window)throw std::runtime_error("Native HWND creation failed");host.bind(window);host.metrics();SetTimer(window,1,16,nullptr);ShowWindow(window,SW_SHOW);host.metrics();UpdateWindow(window);
    MSG message;while(GetMessageW(&message,nullptr,0,0)>0){if(!host.filter(message)){TranslateMessage(&message);DispatchMessageW(&message);}}return host.hasFailed()?1:0;
  }catch(const std::exception& error){std::cerr<<"V2_HOST_ERROR "<<error.what()<<std::endl;return 1;}
}
