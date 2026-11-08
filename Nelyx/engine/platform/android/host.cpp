// SPDX-License-Identifier: BSD-3-Clause
#include "../../core/engine.hpp"
#include "renderer.hpp"
#include "../common/app_text_jsi.hpp"
#include "../common/app_services_jsi.hpp"
#include "app_services.hpp"
#include <hermes/hermes.h>
#include <jsi/instrumentation.h>
#include <android/native_window_jni.h>
#include <unistd.h>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <thread>
#include <condition_variable>
#include <chrono>

namespace jsi=facebook::jsi;
using namespace nelyx::v2;
namespace na=nelyx::v2::android;
namespace np=nelyx::v2::native;
static double now(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
static void log(const std::string& message){__android_log_write(ANDROID_LOG_INFO,"NelyxV2",message.c_str());}
static std::string jsonQuoted(const std::string& value){std::ostringstream out;out<<'"';for(unsigned char c:value){switch(c){case '"':out<<"\\\"";break;case '\\':out<<"\\\\";break;case '\n':out<<"\\n";break;case '\r':out<<"\\r";break;case '\t':out<<"\\t";break;default:if(c<32)out<<"\\u"<<std::hex<<std::setw(4)<<std::setfill('0')<<int(c)<<std::dec;else out<<char(c);}}out<<'"';return out.str();}
static Reader reader(const std::vector<uint8_t>& bytes){return {bytes.data(),bytes.size()};}
static std::vector<uint8_t> packet(uint32_t op,const std::vector<uint8_t>& data={},bool session=false,uint64_t request=0){Writer w(wire::headerBytes+data.size());w.u32(0,wire::magic);w.u16(4,wire::abiMajor);w.u32(8,wire::schema);w.u16(12,uint16_t(op));w.u32(16,uint32_t(w.bytes.size()));w.u32(20,1);w.u32(24,1);w.u32(28,session?0:1);w.u32(32,session?0:1);w.u64(40,request);if(!data.empty())std::memcpy(w.bytes.data()+wire::headerBytes,data.data(),data.size());return std::move(w.bytes);}
static std::string fileText(const std::string& name){std::ifstream stream(name,std::ios::binary);if(!stream)throw std::runtime_error("Android asset unavailable: "+name);return {std::istreambuf_iterator<char>(stream),{}};}
struct Window {
  ANativeWindow* value=nullptr;uint64_t generation=0;uint32_t width=0,height=0;double scale=1;
  ~Window(){if(value)ANativeWindow_release(value);}
};
struct Job {uint32_t id;std::vector<uint8_t> bytes;std::shared_ptr<ExternalLease> memory;};

/** Registry handles retain this owner; UI close only requests asynchronous disposal. */
class AndroidHost:public std::enable_shared_from_this<AndroidHost> {
  Engine core{1,1};
  const std::string directory;const bool emulator;
  const uint64_t uiThread=uint64_t(gettid());
  std::atomic<uint64_t> appThread{0},contentThread{0},renderThread{0};
  std::atomic<bool> connected{false},appReady{false},appDisposed{false},closing{false},stopping{false},failed{false},contentReady{false},recoverable{false},lossRequested{false};
  uint64_t hostId=0;
  std::thread appOwner,contentOwner,renderOwner;
  std::mutex gate,sceneGate,jobsGate,doneGate,windowGate,errorGate,runtimeGate;
  std::condition_variable wake,appWake;
  std::shared_ptr<na::AppServiceView> clipboard;
  std::shared_ptr<np::AppServices> services=std::make_shared<np::AppServices>(core.memoryLedger(),[]{},[this]{appWake.notify_one();});
  std::deque<Job> jobs,done,uiJobs;size_t jobBytes=0;
  std::shared_ptr<const np::Prepared> candidate,published;
  std::shared_ptr<const np::ParagraphProvider> preparedFont;
  uint64_t preparedFontToken=0;
  std::shared_ptr<Window> desired;
  std::atomic<uint64_t> windowRevision{0},retiredSurface{0},activeSurface{0};
  std::atomic<double> frameTime{0};
  std::atomic<bool> visible{false},contentWake{true},renderWake{true};
  std::atomic<uint64_t> frames{0},paragraphs{0},pictures{0},appCommands{0},fallbacks{0},appHeap{0};
  std::atomic<bool> executionObserved{false},disposeRequested{false},appExited{false};
  facebook::hermes::HermesRuntime* runtime=nullptr;
  std::string error;
  uint64_t inputSequence=0;
  void failure(const std::string& value,bool gpuLoss=false){
    {std::lock_guard lock(errorGate);if(!failed){recoverable=gpuLoss&&appReady;error=value;}else if(!gpuLoss)recoverable=false;failed=true;}
    log("V2_ANDROID_FAILURE {\"host\":"+std::to_string(hostId)+",\"recoverable\":"+(recoverable?"true":"false")+",\"error\":"+jsonQuoted(value)+"}");
    if(!recoverable)stopping=true;wake.notify_all();appWake.notify_all();
  }
  std::vector<uint8_t> call(uint32_t op,const std::vector<uint8_t>& data={},bool session=false,uint64_t request=0){const auto bytes=packet(op,data,session,request);return core.dispatch(reader(bytes));}
  void reply(Job job,std::vector<uint8_t> bytes){job.bytes=std::move(bytes);job.memory=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,job.bytes.size());{std::lock_guard lock(doneGate);if(done.size()>=32)throw std::runtime_error("Android App response mailbox exceeded");done.push_back(std::move(job));}appWake.notify_all();}
  void notifyOwners(){contentWake=true;renderWake=true;wake.notify_all();}
  void completeMeasurement(const std::vector<uint8_t>& state,np::ContentProvider& provider){
    const auto r=reader(state);auto request=core.measurementSnapshot(1,1);if(!request)return;
    const auto value=provider.measure(*request);Writer reply(value.geometry?wire::measurementGeometryBytes+value.geometry->selection.size()*32:value.placeholders?wire::measurementPlaceholderBytes+value.placeholders->boxes.size()*wire::paragraphBoxBytes:wire::measurementBytes);
    reply.u64(wire::measureFields::preparation,request->preparation);reply.u64(wire::measureFields::metrics,r.u64(wire::headerBytes+wire::stateFields::metrics));reply.u64(wire::measureFields::device,r.u64(wire::headerBytes+wire::stateFields::device));reply.u64(wire::measureFields::request,request->id);writeHandle(reply,wire::measureFields::node,request->node->id);
    reply.f64(wire::measureFields::width,value.width);reply.f64(wire::measureFields::height,value.height);reply.f64(wire::measureFields::minimum,value.minimum);reply.f64(wire::measureFields::maximum,value.maximum);reply.f64(wire::measureFields::baseline,value.baseline);reply.f64(wire::measureFields::ideographicBaseline,value.ideographicBaseline);
    reply.u32(wire::measureFields::flags,(value.didExceedMaxLines?wire::measurementFlags::didExceedMaxLines:0)|(value.placeholders?wire::measurementFlags::hasPlaceholders:0));
    if(value.placeholders){const auto& boxes=value.placeholders->boxes;reply.u32(wire::measureFields::placeholderCount,uint32_t(boxes.size()));for(size_t i=0;i<boxes.size();++i){const auto at=wire::measurementPlaceholderBytes+i*wire::paragraphBoxBytes;const auto& b=boxes[i];reply.f64(at,b.x);reply.f64(at+8,b.y);reply.f64(at+16,b.width);reply.f64(at+24,b.height);reply.u32(at+32,b.direction);}}
    if(value.geometry){const auto& g=*value.geometry;reply.u64(wire::measureFields::geometryRevision,g.revision);reply.u32(wire::measureFields::selectionCount,uint32_t(g.selection.size()));const auto rect=[&](size_t at,const TextRect& b){reply.f64(at,b.x);reply.f64(at+8,b.y);reply.f64(at+16,b.width);reply.f64(at+24,b.height);};rect(wire::measureFields::caret,g.caret);for(size_t i=0;i<g.selection.size();++i)rect(wire::measureFields::selection+i*32,g.selection[i]);}
    const auto ack=call(wire::opcodes::measureResult,reply.bytes);const auto status=reader(ack).u16(14);if(status!=wire::statuses::ok&&status!=wire::statuses::stale)throw std::runtime_error("Android measurement rejected: "+std::to_string(status));
  }
  void contentLoop(){
    contentThread=uint64_t(gettid());
    try{
      np::ContentProvider provider(directory+"/engine/assets/font.ttf",directory+"/engine/assets/icudtl.dat",core.memoryLedger());contentReady=true;wake.notify_all();uint64_t last=0;
      while(!stopping){
        contentWake=false;Job job{};bool has=false;{std::lock_guard lock(jobsGate);if(!jobs.empty()){job=std::move(jobs.front());jobs.pop_front();jobBytes-=job.bytes.size();has=true;}}
        if(has){const auto op=reader(job.bytes).u16(12);auto result=core.dispatch(reader(job.bytes));reply(std::move(job),std::move(result));if(op!=wire::opcodes::inspect&&op!=wire::opcodes::pollEvents)renderWake=true;}
        if(connected){
          if(const auto stage=core.fontTransitionSnapshot(1,1)){if(stage->phase==wire::fontTransitionPhases::preparing&&!(stage->ready&wire::fontTransitionOwners::content)){
            Writer ready(8);ready.u32(0,wire::fontTransitionOwners::content);
            try{auto fonts=provider.prepareFont(stage->resource);std::lock_guard lock(sceneGate);preparedFont=std::move(fonts);preparedFontToken=stage->token;}catch(...){ready.u32(4,wire::statuses::invalidValue);}
            call(wire::opcodes::fontTransitionReady,ready.bytes,false,stage->token);renderWake=true;
          }else if(stage->phase!=wire::fontTransitionPhases::preparing){std::lock_guard lock(sceneGate);preparedFont.reset();preparedFontToken=0;provider.trimFontCache();}}
          Writer quota(8);quota.u32(0,wire::limits::contentPerStep);const auto result=call(wire::opcodes::contentStep,quota.bytes);const auto r=reader(result);uint64_t attempted=r.u64(wire::headerBytes+wire::stateFields::measurePreparation);
          try{
            if(r.u16(14)==0&&r.u64(wire::headerBytes+wire::stateFields::measureRequest)){completeMeasurement(result,provider);contentWake=true;}
            if(r.u16(14)==0&&(r.u32(wire::headerBytes+wire::stateFields::flags)&16u)){const auto p=core.providerSnapshot(1,1);if(p&&p->id!=last){attempted=p->id;auto value=provider.prepare(*p);last=p->id;{std::lock_guard lock(sceneGate);candidate=std::move(value);}renderWake=true;}}
          }catch(const std::exception& e){provider.discardMeasurements();Writer result(24);result.u64(0,attempted);result.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));result.u64(16,r.u64(wire::headerBytes+wire::stateFields::device));call(wire::opcodes::preparationResult,result.bytes);log("V2_ANDROID_PREPARATION_ERROR "+std::string(e.what()));}
          if(r.u16(14)==0&&!(r.u32(wire::headerBytes+wire::stateFields::flags)&(16u|wire::layoutBuildPending))&&r.u64(wire::headerBytes+wire::stateFields::preparation))contentWake=true;
          paragraphs=provider.paragraphs.load();pictures=provider.pictures.load();
        }
        wake.notify_all();std::unique_lock lock(gate);wake.wait(lock,[&]{std::lock_guard queued(jobsGate);return stopping||contentWake||!jobs.empty();});
      }
      std::lock_guard lock(sceneGate);candidate.reset();preparedFont.reset();
    }catch(const std::exception& e){failure(e.what());}
  }
  void renderLoop(){
    renderThread=uint64_t(gettid());
    try{
      na::Renderer provider(core.memoryLedger(),emulator);
      {std::unique_lock lock(gate);wake.wait(lock,[&]{return stopping||contentReady;});}if(stopping)return;
      core.connectProvider(true,contentThread,renderThread);connected=true;wake.notify_all();appWake.notify_all();
      std::shared_ptr<const np::Prepared> active,next;std::shared_ptr<Window> window;uint64_t applied=0,metrics=0;double lastClock=0;bool announced=false;
      while(!stopping){
        renderWake=false;
        if(lossRequested.exchange(false))provider.forceLoss();
        if(windowRevision!=applied){std::shared_ptr<Window> target;uint64_t revision;{std::lock_guard lock(windowGate);target=desired;revision=windowRevision;}
          activeSurface=0;provider.attach(target?target->value:nullptr,target?target->width:0,target?target->height:0);
          if(window){retiredSurface=std::max(retiredSurface.load(),window->generation);window.reset();}
          if(target){window=std::move(target);activeSurface=window->generation;}applied=revision;metrics=0;
        }
        {std::lock_guard lock(sceneGate);if(candidate){next=std::move(candidate);candidate.reset();}if(preparedFontToken){if(const auto stage=core.fontTransitionSnapshot(1,1);stage&&stage->token==preparedFontToken&&stage->phase==wire::fontTransitionPhases::preparing&&!(stage->ready&wire::fontTransitionOwners::render)){Writer ready(8);ready.u32(0,wire::fontTransitionOwners::render);call(wire::opcodes::fontTransitionReady,ready.bytes,false,stage->token);contentWake=true;}}}
        const auto state=call(wire::opcodes::inspect);const auto r=reader(state);
        if(r.u16(14)==0){
          if(window&&!metrics){Writer m(40);metrics=r.u64(wire::headerBytes+wire::stateFields::metrics)+1;m.u64(0,metrics);m.f64(8,window->width/window->scale);m.f64(16,window->height/window->scale);m.f64(24,window->scale);m.u64(32,r.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::metrics,m.bytes);contentWake=true;}
          Writer v(16);v.u32(0,window&&visible?3:0);v.u64(8,r.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,v.bytes);
          if(next){Writer ready(24);ready.u64(0,next->id);ready.u64(8,next->metrics);ready.u64(16,next->device);const auto result=call(wire::opcodes::providerReady,ready.bytes);if(reader(result).u16(14)!=wire::statuses::ok)next.reset();}
          const auto clock=frameTime.load();
          if(window&&visible&&clock>0){Writer tick(8);lastClock=std::max(clock,lastClock);tick.f64(0,lastClock);call(wire::opcodes::tick,tick.bytes);const auto result=call(wire::opcodes::takeFrame);const auto fr=reader(result);
            if(fr.u16(14)==0){const auto id=fr.u64(wire::headerBytes+wire::stateFields::submission);auto frame=core.frameSnapshot(1,1,id);if(!frame)throw std::runtime_error("Android frame lease is missing");
              if(next&&next->id==frame->scene->preparation){active=std::move(next);next.reset();}
              if(!active||active->id!=frame->scene->preparation)throw std::runtime_error("Android frame preparation identity differs");
              bool drawn=false;try{drawn=provider.draw(*frame,*active);}catch(...){Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(20,1);call(wire::opcodes::releaseFrame,release.bytes);throw;}
              Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(16,drawn?1:0);release.u32(20,drawn?0:1);call(wire::opcodes::releaseFrame,release.bytes);
              if(drawn){Writer publication(24);publication.u64(0,id);publication.u64(8,frame->device);const auto ack=call(wire::opcodes::publish,publication.bytes);if(reader(ack).u16(14)==0){std::lock_guard lock(sceneGate);published=active;if(!announced){announced=true;log("V2_ANDROID_FIRST_FRAME {\"host\":"+std::to_string(hostId)+",\"frame\":"+std::to_string(id)+",\"sourceSha256\":\""+NELYX_ANDROID_SOURCE_SHA+"\",\"scanout\":\"unobserved\"}");}}frames=provider.draws;}
            }
          }
          if(r.u64(wire::headerBytes+wire::stateFields::pendingDocument))contentWake=true;
        }
        wake.notify_all();std::unique_lock lock(gate);wake.wait(lock,[&]{return stopping||renderWake||windowRevision!=applied;});
      }
      active.reset();next.reset();{std::lock_guard lock(sceneGate);published.reset();}provider.close();if(window){retiredSurface=std::max(retiredSurface.load(),window->generation);window.reset();}activeSurface=0;
    }catch(const na::RecoverableGpuLoss& e){failure(e.what(),true);}catch(const std::exception& e){failure(e.what());}
  }
  void appLoop(){
    appThread=uint64_t(gettid());
    struct Exit{std::atomic<bool>& value;~Exit(){value=true;}}exit{appExited};
    try{
      {std::unique_lock lock(gate);wake.wait(lock,[&]{return stopping||connected;});}if(stopping)return;
      np::AppParagraphs appText(directory+"/engine/assets/font.ttf",directory+"/engine/assets/icudtl.dat",core.memoryLedger(),directory+"/application/assets");
      auto owned=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withES6Class(false).withEnableBlockScoping(true).withOptimizedEval(false).withAsyncBreakCheckInEval(true).build());auto& rt=*owned;
      {std::lock_guard lock(runtimeGate);runtime=owned.get();}
      struct Unregister{AndroidHost& host;~Unregister(){std::lock_guard lock(host.runtimeGate);host.runtime=nullptr;host.core.memoryLedger()->report(4,1,0);host.appHeap=0;}}unregister{*this};
      const auto reportHeap=[&]{const auto info=rt.instrumentation().getHeapInfo(false);const auto heap=info.find("hermes_heapSize"),external=info.find("hermes_externalBytes");if(heap==info.end()||external==info.end()||heap->second<0||external->second<0)throw std::runtime_error("Android Hermes heap accounting unavailable");appHeap=uint64_t(heap->second)+uint64_t(external->second);core.memoryLedger()->report(4,1,appHeap);};
      jsi::Object native(rt);native.setProperty(rt,"operatingSystem","android");native.setProperty(rt,"clockDomain","monotonic-milliseconds");np::installAppText(rt,native,appText);
      np::installAppServices(rt,native,services);
      jsi::Object identity(rt);identity.setProperty(rt,"engine","v2");identity.setProperty(rt,"abiMajor",double(wire::abiMajor));identity.setProperty(rt,"schema",double(wire::schema));native.setProperty(rt,"identity",std::move(identity));
      native.setProperty(rt,"clock",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"clock"),0,[](jsi::Runtime&,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{return now()*1000;}));
      native.setProperty(rt,"enqueue",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"enqueue"),2,[&](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        reportHeap();if(count!=2)throw jsi::JSError(rt,"Android enqueue arguments");const auto id=np::Packet(rt,jsi::Value(rt,args[0])).counter(false);if(id>UINT32_MAX)throw jsi::JSError(rt,"Android request ID overflow");auto buffer=args[1].getObject(rt).getArrayBuffer(rt);const auto length=buffer.size(rt);if(length<wire::headerBytes||length>wire::limits::packetBytes)throw jsi::JSError(rt,"Android packet length");
        std::lock_guard lock(jobsGate);if(stopping||jobs.size()+uiJobs.size()>=32||jobBytes+length>4*wire::limits::packetBytes)throw jsi::JSError(rt,"Android native mailbox full/closed");auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,length);std::vector<uint8_t> bytes(buffer.data(rt),buffer.data(rt)+length);const auto op=reader(bytes).u16(12);if(op==wire::opcodes::memoryReport)throw jsi::JSError(rt,"Memory reports are host-only");
        if(op==wire::opcodes::edit||op==wire::opcodes::focus||op==wire::opcodes::semanticsAction)uiJobs.push_back({uint32_t(id),std::move(bytes),std::move(hold)});else jobs.push_back({uint32_t(id),std::move(bytes),std::move(hold)});jobBytes+=length;notifyOwners();return jsi::Value::undefined();
      }));
      native.setProperty(rt,"notify",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"notify"),2,[this](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        if(count<1||!args[0].isString())throw jsi::JSError(rt,"Android notify arguments");if(count>1&&args[1].isObject()){np::Packet value(rt,jsi::Value(rt,args[1]));appCommands=value.field("acknowledgedCommands").counter();fallbacks=value.field("rejectedFallbacks").counter();executionObserved=value.field("observed").boolean();}
        const auto message=args[0].asString(rt).utf8(rt);log("V2_APP "+message);if(message.find("\"app-ready\"")!=std::string::npos){appReady=true;log("V2_ANDROID_READY {\"host\":"+std::to_string(hostId)+",\"receipt\":"+message+"}");}if(message.find("\"app-disposed\"")!=std::string::npos)appDisposed=true;if(message.find("\"app-error\"")!=std::string::npos)failure(message);return jsi::Value::undefined();
      }));
      rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      jsi::Object console(rt);
      for(const auto* method:{"log","info","warn","error","debug"})console.setProperty(rt,method,jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,method),0,[method](jsi::Runtime& rt,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        std::string message="V2_CONSOLE ";message+=method;
        for(size_t at=0;at<std::min(count,size_t(16));++at){const auto value=rt.global().getPropertyAsFunction(rt,"String").call(rt,jsi::Value(rt,args[at])).getString(rt).utf8(rt);message+=' ';message+=value.substr(0,2048);}
        __android_log_write(std::strcmp(method,"error")==0?ANDROID_LOG_ERROR:std::strcmp(method,"warn")==0?ANDROID_LOG_WARN:ANDROID_LOG_INFO,"NelyxV2",message.c_str());return jsi::Value::undefined();
      }));
      rt.global().setProperty(rt,"console",std::move(console));
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>("globalThis.__v2Timers=[];globalThis.setTimeout=(f,m=0)=>{if(__v2Timers.length>=4096)throw Error('Timer budget exceeded');const t={f,at:Date.now()+m};__v2Timers.push(t);return t;};globalThis.clearTimeout=t=>{if(t)t.f=null;};globalThis.__v2Pump=()=>{const n=Date.now();const q=__v2Timers.splice(0);for(const t of q){if(t.f&&t.at<=n)t.f();else if(t.f)__v2Timers.push(t);}};"),"android-timers.js");
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(fileText(directory+"/application/app.hbc")),"application/app.js");rt.drainMicrotasks();
      while(!stopping){
        if(disposeRequested.exchange(false)){rt.global().getPropertyAsFunction(rt,"__v2Dispose").call(rt);rt.drainMicrotasks();}
        while(services->deliver(rt))rt.drainMicrotasks();
        Job result{};bool has=false;{std::lock_guard lock(doneGate);if(!done.empty()){result=std::move(done.front());done.pop_front();has=true;}}
        if(has){auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(result.bytes.size())).getObject(rt);auto bytes=array.getArrayBuffer(rt);std::memcpy(bytes.data(rt),result.bytes.data(),result.bytes.size());rt.global().getPropertyAsFunction(rt,"__v2Resolve").call(rt,double(result.id),std::move(array));rt.drainMicrotasks();}
        rt.global().getPropertyAsFunction(rt,"__v2Pump").call(rt);rt.drainMicrotasks();reportHeap();std::unique_lock lock(gate);appWake.wait_for(lock,std::chrono::milliseconds(2));
      }
    }catch(const std::exception& e){failure(e.what());}
  }
  static Handle fromKey(uint64_t key){return {uint32_t(key),uint32_t(key>>32)};}
  void rect(std::ostream& out,const Rect& r){out<<'['<<r.x<<','<<r.y<<','<<r.width<<','<<r.height<<']';}
 public:
  AndroidHost(std::string directory,bool emulator,JNIEnv* env,jobject view):directory(std::move(directory)),emulator(emulator),clipboard(std::make_shared<na::AppServiceView>(env,view)){}
  void start(uint64_t id){hostId=id;log("V2_ANDROID_HOST {\"host\":"+std::to_string(hostId)+",\"sourceSha256\":\""+NELYX_ANDROID_SOURCE_SHA+"\",\"reactNative\":false,\"abi\":2,\"schema\":"+std::to_string(wire::schema)+",\"frameClock\":\"android-choreographer\"}");contentOwner=std::thread([this]{contentLoop();});renderOwner=std::thread([this]{renderLoop();});appOwner=std::thread([this]{appLoop();});}
  bool forceLoss(){if(!emulator||closing||failed||!appReady||!frames)return false;lossRequested=true;renderWake=true;wake.notify_all();return true;}
  void surface(std::shared_ptr<Window> value,uint64_t generation){if(closing)return;std::lock_guard lock(windowGate);if(generation<windowRevision)return;if(desired&&desired->generation<generation&&desired->generation!=activeSurface)retiredSurface=std::max(retiredSurface.load(),desired->generation);desired=std::move(value);windowRevision=generation;renderWake=true;wake.notify_all();}
  void frame(double seconds,bool shown){if(closing||stopping)return;visible=shown;frameTime=seconds;renderWake=true;wake.notify_all();}
  void pump(){
    if(stopping||uint64_t(gettid())!=uiThread)return;std::deque<Job> accepted;{std::lock_guard lock(jobsGate);accepted.swap(uiJobs);for(const auto& job:accepted)jobBytes-=job.bytes.size();}
    services->pump([this](const std::string& method,const std::string& text){return clipboard->execute(method,text);});
    for(auto& job:accepted){const auto r=reader(job.bytes);if(r.u16(12)==wire::opcodes::edit&&r.length>=wire::headerBytes+64&&r.u32(wire::headerBytes+24)==wire::editKinds::update){std::fill_n(job.bytes.data()+wire::headerBytes+24,4,uint8_t(0xff));}auto result=core.dispatch(reader(job.bytes));reply(std::move(job),std::move(result));}if(!accepted.empty())notifyOwners();
  }
  void selectAt(double x,double y){
    const auto state=core.interactionSnapshot(1,1);if(!state||!state->focus)return;
    const auto editor=state->editors.find(state->focus.key());if(editor==state->editors.end())return;
    std::shared_ptr<const np::Prepared> prepared;{std::lock_guard lock(sceneGate);prepared=published;}
    if(!prepared||prepared->id!=state->frame.scene->preparation||state->frame.scene->metrics.epoch!=state->metrics.epoch)return;
    const auto source=prepared->editors.find(state->focus.key());if(source==prepared->editors.end()||source->second.identity.text!=utf8(editor->second->text))return;
    const auto item=std::find_if(state->frame.items.begin(),state->frame.items.end(),[&](const auto& item){return item.node==state->focus;});
    if(item==state->frame.items.end()||!state->frame.hit(*item,x,y))return;
    const auto local=state->frame.local(state->focus,x,y);if(!local)return;
    const auto& visual=state->frame.scene->document->get(state->focus);const auto& q=source->second;
    const auto hit=nelyx::skia_core::ParagraphQuerySource::hit(q.ticket,prepared->context.get(),q.identity,float(local->x-visual.contentX),float(local->y-visual.contentY));if(!hit)return;
    int32_t position=int32_t(hit->position);
    if(hit->hasGlyph&&position>int32_t(hit->start)&&position<int32_t(hit->end)){const bool left=local->x-visual.contentX<(hit->glyph.left+hit->glyph.right)/2.;position=int32_t(left!=hit->glyph.rtl?hit->start:hit->end);}
    const auto after=std::lower_bound(q.characters.begin(),q.characters.end(),position);if(after==q.characters.end())position=int32_t(editor->second->text.size());else if(*after!=position){const auto before=after==q.characters.begin()?0:*std::prev(after);position=position-before<*after-position?before:*after;}
    const auto composing=editor->second->composingStart>=0;const auto text=composing?utf8(editor->second->text):std::string{};
    Writer command(64+(text.size()+7)/8*8);writeHandle(command,0,state->focus);command.u64(8,state->session);command.u64(16,editor->second->revision);command.u32(24,composing?wire::editKinds::update:wire::editKinds::selection);command.u32(32,uint32_t(position));command.u32(36,uint32_t(position));command.u32(40,UINT32_MAX);command.u32(44,UINT32_MAX);command.u32(48,uint32_t(text.size()));command.u64(56,state->frame.id);if(!text.empty())std::memcpy(command.bytes.data()+64,text.data(),text.size());call(wire::opcodes::edit,command.bytes);
  }
  bool input(uint32_t phase,uint32_t kind,uint32_t contact,double seconds,double x,double y,double dx,double dy,double velocity,uint32_t buttons,uint32_t modifiers,bool wheel){
    if(closing||stopping||!appReady||!visible||!activeSurface)return false;
    auto result=call(wire::opcodes::inspect);const auto r=reader(result);if(r.u16(14))return false;
    if(phase==wire::phases::begin&&!wheel){const auto state=core.interactionSnapshot(1,1);if(state){Writer focus(32);focus.u64(0,state->frame.id);focus.f64(8,x);focus.f64(16,y);call(wire::opcodes::focusAt,focus.bytes);selectAt(x,y);}}
    Writer b(wire::inputBytes);b.u64(0,++inputSequence);b.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));b.u32(24,contact);b.u32(28,phase);b.u32(32,wheel?wire::sources::wheelUnknown:wire::sources::engineDriven);b.u32(36,2);b.f64(40,seconds);b.f64(56,x);b.f64(64,y);b.f64(72,dx);b.f64(80,dy);b.f64(88,velocity);b.u32(96,1);b.u32(100,buttons);b.u32(104,modifiers);b.u32(108,kind);b.u32(112,contact);b.u32(wire::inputFields::kind,kind);b.u64(wire::inputFields::publication,r.u64(wire::headerBytes+wire::stateFields::publication));const auto ack=call(wire::opcodes::input,b.bytes);notifyOwners();return reader(ack).u16(14)==0;
  }
  bool edit(uint64_t owner,uint64_t session,uint64_t revision,uint64_t publication,const std::string& text,int32_t a,int32_t f,int32_t start,int32_t end){
    if(closing||stopping||!visible||!activeSurface)return false;
    const auto state=core.interactionSnapshot(1,1);if(!state||state->focus.key()!=owner||state->session!=session)return false;
    Writer b(64+(text.size()+7)/8*8);writeHandle(b,0,fromKey(owner));b.u64(8,session);b.u64(16,revision);b.u32(24,wire::editKinds::update);b.u32(32,uint32_t(a));b.u32(36,uint32_t(f));b.u32(40,uint32_t(start));b.u32(44,uint32_t(end));b.u32(48,uint32_t(text.size()));b.u64(56,publication);if(!text.empty())std::memcpy(b.bytes.data()+64,text.data(),text.size());const auto result=call(wire::opcodes::edit,b.bytes);notifyOwners();return reader(result).u16(14)==0;
  }
  bool action(uint64_t owner,uint64_t publication,uint32_t kind,double value=0){
    if(closing||stopping||!visible)return false;
    // Android actions identify a virtual node, not an OS-supplied frame token.
    // Re-resolve that same generation only after a side-effect-free stale NACK.
    for(uint32_t attempt=0;attempt<4;++attempt){Writer b(32);writeHandle(b,0,fromKey(owner));b.u64(8,publication);b.u32(16,kind);b.f64(24,value);const auto result=call(wire::opcodes::semanticsAction,b.bytes);const auto status=reader(result).u16(14);if(status!=wire::statuses::stale){notifyOwners();return status==0;}
      const auto current=core.interactionSnapshot(1,1);if(!current||!current->document->contains(fromKey(owner))||!current->frame.scene->document->contains(fromKey(owner))||!current->frame.allowsSemantics(fromKey(owner)))return false;publication=current->frame.id;
    }return false;
  }
  bool key(uint32_t code,uint32_t modifiers,bool down,bool repeat){if(closing||stopping||!visible)return false;const auto state=core.interactionSnapshot(1,1);if(!state)return false;Writer b(24);b.u64(0,state->frame.id);b.u32(8,code);b.u32(12,modifiers);b.u32(16,down?1:0);b.u32(20,repeat?1:0);const auto result=call(wire::opcodes::key,b.bytes);notifyOwners();return reader(result).u16(14)==0;}
  std::string snapshot(){
    pump();if(closing)return "{\"host\":"+std::to_string(hostId)+",\"closing\":true,\"retiredSurface\":"+std::to_string(retiredSurface)+",\"activeSurface\":"+std::to_string(activeSurface)+"}";
    std::ostringstream out;out<<std::setprecision(17)<<"{\"host\":"<<hostId<<",\"recoverable\":"<<(recoverable?"true":"false")<<",\"ready\":"<<(appReady?"true":"false")<<",\"closing\":"<<(closing?"true":"false")<<",\"failed\":"<<(failed?"true":"false")<<",\"retiredSurface\":"<<retiredSurface<<",\"activeSurface\":"<<activeSurface<<",\"frames\":"<<frames;
    {std::lock_guard lock(errorGate);out<<",\"error\":"<<jsonQuoted(error);}
    const auto inspected=call(wire::opcodes::inspect);const auto r=reader(inspected);const auto b=wire::headerBytes;
    out<<",\"uiThread\":"<<uiThread<<",\"appThread\":"<<appThread<<",\"contentThread\":"<<contentThread<<",\"renderThread\":"<<renderThread<<",\"paragraphs\":"<<paragraphs<<",\"pictures\":"<<pictures<<",\"nativeCommands\":"<<r.u64(b+wire::stateFields::transactionWork)<<",\"sdkCommands\":"<<appCommands<<",\"executionObserved\":"<<(executionObserved?"true":"false")<<",\"rejectedFallbacks\":"<<fallbacks<<",\"layoutWork\":"<<r.u64(b+wire::stateFields::layoutWork)<<",\"editingWork\":"<<r.u64(b+wire::stateFields::editingWork)<<",\"semanticsWork\":"<<r.u64(b+wire::stateFields::semanticsWork)<<",\"memoryTotal\":"<<r.u64(b+wire::stateFields::memoryTotal)<<",\"queued\":"<<r.u32(b+wire::stateFields::queued)<<",\"publication\":"<<r.u64(b+wire::stateFields::publication)<<",\"scanout\":\"unobserved\"";
    const auto state=core.interactionSnapshot(1,1);
    if(!state){out<<",\"editor\":null,\"nodes\":[]} ";return out.str();}
    const auto& frame=state->frame;out<<",\"frame\":"<<frame.id<<",\"metrics\":"<<state->metrics.epoch;
    out<<",\"route\":";
    if(state->visible&&frame.scene->metrics.epoch==state->metrics.epoch&&frame.device==state->metrics.device){
      out<<"{\"sequence\":"<<frame.route.sequence<<",\"scope\":"<<frame.route.scope.key()<<",\"label\":"<<jsonQuoted(frame.route.label?frame.route.label->label:"")<<'}';
    }else out<<"null";
    out<<",\"editor\":";
    const auto editor=state->editors.find(state->focus.key());
    if(editor==state->editors.end()||!state->document->contains(state->focus))out<<"null";
    else {const auto& value=*editor->second;const auto& node=state->document->get(state->focus);out<<"{\"owner\":"<<state->focus.key()<<",\"session\":"<<state->session<<",\"revision\":"<<value.revision<<",\"publication\":"<<frame.id<<",\"metrics\":"<<state->metrics.epoch<<",\"text\":"<<jsonQuoted(utf8(value.text))<<",\"anchor\":"<<value.base<<",\"focus\":"<<value.extent<<",\"composingStart\":"<<value.composingStart<<",\"composingEnd\":"<<value.composingEnd<<",\"flags\":"<<node.editFlags<<",\"caret\":";
      const auto item=std::find_if(frame.items.begin(),frame.items.end(),[&](const auto& item){return item.node==state->focus;});
      if(item!=frame.items.end()&&frame.scene->metrics.epoch==state->metrics.epoch){const auto& visual=frame.scene->document->get(state->focus);if(visual.textGeometry&&visual.textGeometry->revision==value.revision){const auto& c=visual.textGeometry->caret;rect(out,item->world.bounds({c.x,c.y,c.width,c.height}));out<<",\"baseline\":"<<item->world.map({visual.contentX,visual.baseline}).y;}else out<<"null";}else out<<"null";out<<'}';}
    out<<",\"nodes\":[";bool first=true;
    const auto focusPeer=frame.focusPeer(state->focus);
    std::set<uint64_t> exposed;for(const auto& item:frame.items){const auto& node=frame.scene->document->get(item.node);const auto* semantics=frame.semantic(node.id);const auto bounds=intersect(item.bounds,item.clip);if(semantics&&!(semantics->flags&wire::semanticsFlags::hidden)&&frame.allowsSemantics(node.id)&&bounds.width>0&&bounds.height>0)exposed.insert(node.id.key());}
    for(const auto& item:frame.items){const auto& node=frame.scene->document->get(item.node);const auto* semantics=frame.semantic(node.id);if(!semantics||(semantics->flags&wire::semanticsFlags::hidden)||!frame.allowsSemantics(node.id))continue;const auto bounds=intersect(item.bounds,item.clip);if(bounds.width<=0||bounds.height<=0)continue;
      auto parent=node.parent;for(uint32_t depth=0;parent&&!exposed.contains(parent.key())&&depth<wire::limits::depth;++depth)parent=frame.scene->document->get(parent).parent;
      if(!first)out<<',';first=false;out<<"{\"owner\":"<<node.id.key()<<",\"parent\":"<<parent.key()<<",\"role\":"<<semantics->role<<",\"flags\":"<<((node.control.kind==wire::controlKinds::toggle||node.control.kind==wire::controlKinds::checkbox)?((semantics->flags&~wire::semanticsFlags::checked)|(frame.properties[node.id.slot].value>node.control.minimum?wire::semanticsFlags::checked:0)):semantics->flags)<<",\"actions\":"<<semantics->actions<<",\"focused\":"<<(focusPeer==node.id?"true":"false")<<",\"label\":"<<jsonQuoted(semantics->label)<<",\"hint\":"<<jsonQuoted(semantics->hint)<<",\"value\":"<<jsonQuoted(semantics->value)<<",\"bounds\":";rect(out,bounds);
      if(node.editing){out<<",\"password\":"<<((node.editFlags&wire::editFlags::password)?"true":"false")<<",\"text\":"<<jsonQuoted((node.editFlags&wire::editFlags::password)?"":utf8(node.editing->text))<<",\"anchor\":"<<((node.editFlags&wire::editFlags::password)?0:node.editing->base)<<",\"focus\":"<<((node.editFlags&wire::editFlags::password)?0:node.editing->extent)<<",\"revision\":"<<node.editing->revision;}
      if(semantics->range.enabled)out<<",\"range\":["<<semantics->range.minimum<<','<<semantics->range.maximum<<','<<semantics->range.value<<']';out<<'}';
    }out<<"]}";return out.str();
  }
  bool requestClose(){if(closing.exchange(true))return false;visible=false;disposeRequested=true;appWake.notify_all();notifyOwners();return true;}
  std::string close(){
    requestClose();const auto deadline=now()+8;
    while(appReady&&!appDisposed&&!stopping&&now()<deadline)std::this_thread::sleep_for(std::chrono::milliseconds(2));
    if(appReady&&!appDisposed){failed=true;recoverable=false;log("V2_ANDROID_ERROR App disposal timed out/failed");}
    stopping=true;wake.notify_all();appWake.notify_all();
    const auto appDeadline=now()+.25;while(!appExited&&now()<appDeadline)std::this_thread::sleep_for(std::chrono::milliseconds(1));
    if(!appExited){std::lock_guard lock(runtimeGate);if(runtime)runtime->asyncTriggerTimeout();}
    if(appOwner.joinable())appOwner.join();if(contentOwner.joinable())contentOwner.join();if(renderOwner.joinable())renderOwner.join();
    services->close();clipboard.reset();
    {std::lock_guard lock(sceneGate);candidate.reset();published.reset();preparedFont.reset();}{std::lock_guard lock(windowGate);desired.reset();}{std::lock_guard lock(jobsGate);jobs.clear();uiJobs.clear();jobBytes=0;}{std::lock_guard lock(doneGate);done.clear();}
    SkGraphics::PurgeAllCaches();const auto result=call(wire::opcodes::closeSession,{},true);const auto state=reader(result);const auto memory=core.memoryLedger()->snapshot();
    std::string reason;{std::lock_guard lock(errorGate);reason=error;}
    const auto resultJson="{\"host\":"+std::to_string(hostId)+",\"closed\":true,\"status\":"+std::to_string(state.u16(14))+",\"reservedBytes\":"+std::to_string(state.u64(wire::headerBytes+wire::stateFields::reservedBytes))+",\"memoryTotal\":"+std::to_string(memory.total)+",\"workersJoined\":true,\"appDisposed\":"+(appDisposed?"true":"false")+",\"recoverable\":"+(recoverable?"true":"false")+",\"failed\":"+(failed?"true":"false")+",\"error\":"+jsonQuoted(reason)+"}";
    log("V2_ANDROID_CLOSED "+resultJson);return resultJson;
  }
};

static std::mutex registryGate;
static std::map<jlong,std::shared_ptr<AndroidHost>> registry;
static std::map<jlong,std::string> closedHosts;
static jlong nextHost=0;
static std::shared_ptr<AndroidHost> lookup(jlong id){std::lock_guard lock(registryGate);const auto found=registry.find(id);return found==registry.end()?nullptr:found->second;}
static void javaFailure(JNIEnv* env,const std::exception& error){if(!env->ExceptionCheck())env->ThrowNew(env->FindClass("java/lang/IllegalStateException"),error.what());}
extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm,void*){na::vm=vm;JNIEnv* env=nullptr;if(vm->GetEnv(reinterpret_cast<void**>(&env),JNI_VERSION_1_6)!=JNI_OK)return JNI_ERR;const auto local=env->FindClass("dev/nelyx/engine/HttpTransport");if(!local)return JNI_ERR;na::httpClass=static_cast<jclass>(env->NewGlobalRef(local));env->DeleteLocalRef(local);return JNI_VERSION_1_6;}
extern "C" JNIEXPORT jstring JNICALL Java_dev_nelyx_engine_NativeHost_identity(JNIEnv* env,jclass){return env->NewStringUTF(NELYX_ANDROID_SOURCE_SHA);}
extern "C" JNIEXPORT jlong JNICALL Java_dev_nelyx_engine_NativeHost_open(JNIEnv* env,jclass,jstring directory,jboolean emulator,jobject view){try{auto host=std::make_shared<AndroidHost>(na::string(env,directory),emulator,env,view);jlong id;{std::lock_guard lock(registryGate);id=++nextHost;registry.emplace(id,host);}host->start(uint64_t(id));return id;}catch(const std::exception& e){javaFailure(env,e);return 0;}}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_nelyx_engine_NativeHost_forceLoss(JNIEnv*,jclass,jlong id){if(const auto host=lookup(id))return host->forceLoss();return false;}
extern "C" JNIEXPORT void JNICALL Java_dev_nelyx_engine_NativeHost_surface(JNIEnv* env,jclass,jlong id,jobject surface,jlong generation,jint width,jint height,jdouble scale){try{const auto host=lookup(id);if(!host)return;std::shared_ptr<Window> window;if(surface){if(width<=0||height<=0||!std::isfinite(scale)||scale<=0)throw std::runtime_error("Invalid Android surface metrics");window=std::make_shared<Window>();window->value=ANativeWindow_fromSurface(env,surface);if(!window->value)throw std::runtime_error("ANativeWindow acquisition failed");window->generation=uint64_t(generation);window->width=uint32_t(width);window->height=uint32_t(height);window->scale=scale;}host->surface(std::move(window),uint64_t(generation));}catch(const std::exception& e){javaFailure(env,e);}}
extern "C" JNIEXPORT jstring JNICALL Java_dev_nelyx_engine_NativeHost_snapshot(JNIEnv* env,jclass,jlong id){try{const auto host=lookup(id);if(host)return na::string(env,host->snapshot());std::lock_guard lock(registryGate);const auto found=closedHosts.find(id);return na::string(env,found!=closedHosts.end()?found->second:"{\"closed\":true}");}catch(const std::exception& e){javaFailure(env,e);return nullptr;}}
extern "C" JNIEXPORT void JNICALL Java_dev_nelyx_engine_NativeHost_frame(JNIEnv*,jclass,jlong id,jlong nanos,jboolean visible){if(const auto host=lookup(id))host->frame(double(nanos)*1e-9,visible);}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_nelyx_engine_NativeHost_input(JNIEnv* env,jclass,jlong id,jint phase,jint kind,jint contact,jdouble time,jdouble x,jdouble y,jdouble dx,jdouble dy,jdouble velocity,jint buttons,jint modifiers,jboolean wheel){try{if(const auto host=lookup(id))return host->input(uint32_t(phase),uint32_t(kind),uint32_t(contact),time,x,y,dx,dy,velocity,uint32_t(buttons),uint32_t(modifiers),wheel);return false;}catch(const std::exception& e){javaFailure(env,e);return false;}}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_nelyx_engine_NativeHost_edit(JNIEnv* env,jclass,jlong id,jlong owner,jlong session,jlong revision,jlong publication,jstring text,jint a,jint f,jint start,jint end){try{if(const auto host=lookup(id))return host->edit(uint64_t(owner),uint64_t(session),uint64_t(revision),uint64_t(publication),na::string(env,text),a,f,start,end);return false;}catch(const std::exception& e){javaFailure(env,e);return false;}}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_nelyx_engine_NativeHost_action(JNIEnv* env,jclass,jlong id,jlong owner,jlong publication,jint action,jdouble value){try{if(const auto host=lookup(id))return host->action(uint64_t(owner),uint64_t(publication),uint32_t(action),value);return false;}catch(const std::exception& e){javaFailure(env,e);return false;}}
extern "C" JNIEXPORT jboolean JNICALL Java_dev_nelyx_engine_NativeHost_key(JNIEnv* env,jclass,jlong id,jint code,jint modifiers,jboolean down,jboolean repeat){try{if(const auto host=lookup(id))return host->key(uint32_t(code),uint32_t(modifiers),down,repeat);return false;}catch(const std::exception& e){javaFailure(env,e);return false;}}
extern "C" JNIEXPORT void JNICALL Java_dev_nelyx_engine_NativeHost_close(JNIEnv*,jclass,jlong id){const auto host=lookup(id);if(!host||!host->requestClose())return;std::thread([host,id]{const auto result=host->close();std::lock_guard lock(registryGate);registry.erase(id);closedHosts.emplace(id,result);while(closedHosts.size()>8)closedHosts.erase(closedHosts.begin());}).detach();}
