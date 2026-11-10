// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <windowsx.h>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include <jsi/instrumentation.h>
#include "../../core/engine.hpp"
#include "skia_provider.hpp"
#include "app_text_jsi.hpp"
#include "../common/app_services_jsi.hpp"
#include "../common/input_clipboard.hpp"
#include "interaction.hpp"
#include "memory_pressure.hpp"
#include "rnw/ClipboardModule.h"
#include "input/WindowsPrecisionTrackpad.h"
#include "input/PrecisionVelocity.h"
#include <condition_variable>
#include <deque>
#include <fstream>
#include <iostream>
#include <sstream>
#include <functional>
#include <filesystem>
#include <cmath>
#include <syncstream>
#include <iomanip>
#include "app_sdk.hpp"

namespace jsi=facebook::jsi;
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
static std::atomic<HWND> consoleWindow{nullptr};
static BOOL WINAPI closeFromConsole(DWORD event){
  if(event!=CTRL_C_EVENT&&event!=CTRL_BREAK_EVENT)return FALSE;
  if(const auto window=consoleWindow.load())PostMessageW(window,WM_CLOSE,0,0);
  return TRUE;
}
static double now(){return nw::qpcSeconds();}
static std::vector<uint8_t> readFile(const std::string& path){std::ifstream stream(path,std::ios::binary);if(!stream)throw std::runtime_error("File unavailable: "+path);return {std::istreambuf_iterator<char>(stream),{}};}
static std::vector<uint8_t> makePacket(uint32_t op,const std::vector<uint8_t>& data={},bool session=false,uint64_t requestId=0){
  Writer w(wire::headerBytes+data.size());w.u32(0,wire::magic);w.u16(4,2);w.u32(8,wire::schema);w.u16(12,uint16_t(op));w.u32(16,uint32_t(w.bytes.size()));w.u32(20,1);w.u32(24,1);w.u32(28,session?0:1);w.u32(32,session?0:1);
  w.u64(40,requestId);if(!data.empty())std::memcpy(w.bytes.data()+wire::headerBytes,data.data(),data.size());return std::move(w.bytes);
}
struct Job{uint32_t id;std::vector<uint8_t> bytes;std::shared_ptr<ExternalLease> memory;double enqueued=now();};
struct PreparedFont {uint64_t token;std::shared_ptr<const Resource> resource;std::shared_ptr<nw::ParagraphProvider> fonts;};
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
struct SamplingGuard {
  facebook::hermes::IHermesRootAPI* api=nullptr;bool active=false;
  ~SamplingGuard(){if(active)try{api->disableSamplingProfiler();}catch(...){}}
};
struct AppRuntimeRegistration {
  std::mutex& gate;facebook::hermes::HermesRuntime*& current;
  AppRuntimeRegistration(std::mutex& lock,facebook::hermes::HermesRuntime*& slot,facebook::hermes::HermesRuntime* runtime):gate(lock),current(slot){std::lock_guard held(gate);current=runtime;}
  ~AppRuntimeRegistration(){std::lock_guard held(gate);current=nullptr;}
};
class Host {
  struct Trace {uint64_t sequence=0,request=0,input=0,document=0,preparation=0,submission=0,publication=0;uint32_t opcode=0,status=0;double started=0,elapsedMs=0,queueMs=0,lockWaitMs=0,lockHeldMs=0;};
  std::mutex traceMutex;std::array<Trace,1024> traceRing{};uint64_t traceSequence=0;
  std::vector<uint8_t> dispatch(const std::vector<uint8_t>& bytes,double enqueued=0){
    const auto started=now();DispatchTiming timing;auto result=core.dispatch({bytes.data(),bytes.size()},&timing);
    const auto ended=now();const auto r=reader(result);const auto b=wire::headerBytes;
    const auto opcode=reader(bytes).u16(12); // Responses include the reply bit.
    if(result.size()>=b+wire::stateBytes&&opcode!=wire::opcodes::inspect){
      std::lock_guard lock(traceMutex);const auto sequence=++traceSequence;
      traceRing[(sequence-1)%traceRing.size()]={sequence,r.u64(40),(opcode==wire::opcodes::input&&bytes.size()>=b+8?reader(bytes).u64(b):r.u64(b+wire::stateFields::consumedThrough)),r.u64(b+wire::stateFields::document),r.u64(b+wire::stateFields::preparation),r.u64(b+wire::stateFields::submission),r.u64(b+wire::stateFields::publication),opcode,r.u16(14),started,(ended-started)*1000,enqueued?(started-enqueued)*1000:0,timing.lockWaitMs,timing.lockHeldMs};
    }
    return result;
  }
  void trace(){
    std::array<Trace,1024> copy;uint64_t through;{std::lock_guard lock(traceMutex);copy=traceRing;through=traceSequence;}
    std::ostringstream out;out<<std::setprecision(17)<<"V2_TRACE {\"through\":"<<through<<",\"overwritten\":"<<(through>copy.size()?through-copy.size():0)<<",\"samples\":[";
    const auto first=through>copy.size()?through-copy.size()+1:1;
    for(auto i=first;i<=through;++i){const auto& t=copy[(i-1)%copy.size()];if(i!=first)out<<',';
      out<<"{\"seq\":"<<t.sequence<<",\"op\":"<<t.opcode<<",\"request\":"<<t.request<<",\"input\":"<<t.input<<",\"document\":"<<t.document<<",\"preparation\":"<<t.preparation<<",\"submission\":"<<t.submission<<",\"publication\":"<<t.publication<<",\"status\":"<<t.status<<",\"started\":"<<t.started<<",\"elapsedMs\":"<<t.elapsedMs<<",\"queueMs\":"<<t.queueMs<<",\"lockWaitMs\":"<<t.lockWaitMs<<",\"lockHeldMs\":"<<t.lockHeldMs<<'}';}
    out<<"],\"frames\":[";
    {std::lock_guard lock(timingMutex);const auto begin=frameSampleCount>frameSamples.size()?frameSampleCount-frameSamples.size():0;
      for(auto i=begin;i<frameSampleCount;++i){const auto& f=frameSamples[i%frameSamples.size()];if(i!=begin)out<<',';
        out<<"{\"submission\":"<<f.submission<<",\"document\":"<<f.document<<",\"publication\":"<<f.publication<<",\"input\":"<<f.input<<",\"started\":"<<f.started<<",\"completed\":"<<f.completed<<",\"coreMs\":"<<f.coreMs<<",\"recordMs\":"<<f.recordMs<<",\"outputMs\":"<<f.submitMs<<",\"acquireMs\":"<<f.gpu.acquireMs<<",\"submitMs\":"<<f.gpu.submitMs<<",\"presentMs\":"<<f.gpu.presentMs<<",\"gpuObservedMs\":"<<f.gpu.gpuObservedMs<<",\"resourcesObservedMs\":"<<f.gpu.resourcesObservedMs<<'}';}
      out<<"],\"frameSamplesThrough\":"<<frameSampleCount<<",\"frameSamplesOverwritten\":"<<(frameSampleCount>frameSamples.size()?frameSampleCount-frameSamples.size():0);}
    out<<"}";std::osyncstream(std::cout)<<out.str()<<std::endl;
  }
  struct FrameTiming {nw::DisplayClockSample clock;double started=0,coreMs=0,recordMs=0,submitMs=0,publicationMs=0,completed=0;uint64_t submission=0,document=0,publication=0,input=0;nelyx::vulkan::WindowFrameTiming gpu;};
  struct ContentTiming {uint64_t preparation=0,document=0,steps=0,work=0;double started=0,coreMs=0,measureMs=0,recordMs=0,completed=0;bool failed=false;};
  std::mutex timingMutex;FrameTiming frameTiming;ContentTiming contentTiming;
  std::array<FrameTiming,256> frameSamples{};uint64_t frameSampleCount=0;
  std::string timingJson(){std::lock_guard lock(timingMutex);const auto& t=frameTiming;std::ostringstream out;out<<std::setprecision(17);
    out<<"\"frameClock\":{\"source\":\""<<(t.clock.observed?"dwm-composition-qpc":(t.clock.sampledAt?"timer-fallback":"unobserved"))<<"\",\"status\":"<<int32_t(t.clock.status)<<",\"periodMs\":"<<t.clock.period*1000<<",\"targetSeconds\":"<<t.clock.target<<",\"monitor\":\""<<t.clock.monitor<<"\",\"monitorSpecific\":false},";
    out<<"\"timing\":{\"domain\":\"qpc-seconds\",\"qpcFrequency\":"<<nw::qpcFrequency()<<",\"startedAtSeconds\":"<<t.started<<",\"coreElapsedMs\":"<<t.coreMs<<",\"recordAndBackingElapsedMs\":"<<t.recordMs<<",\"submitElapsedMs\":"<<t.submitMs<<",\"publicationElapsedMs\":"<<t.publicationMs<<",\"completedAtSeconds\":"<<t.completed<<",\"submission\":"<<t.submission<<",\"document\":"<<t.document<<",\"publication\":"<<t.publication<<",\"consumedThrough\":"<<t.input<<",\"scanout\":\"unobserved\"},";
    const auto& c=contentTiming;out<<"\"contentTiming\":{\"domain\":\"qpc-seconds\",\"preparation\":"<<c.preparation<<",\"document\":"<<c.document<<",\"steps\":"<<c.steps<<",\"nativeWorkThrough\":"<<c.work<<",\"startedAtSeconds\":"<<c.started<<",\"coreStepElapsedMs\":"<<c.coreMs<<",\"measurementElapsedMs\":"<<c.measureMs<<",\"recordElapsedMs\":"<<c.recordMs<<",\"completedAtSeconds\":"<<c.completed<<",\"failed\":"<<(c.failed?"true":"false")<<"}";return out.str();}
  Engine core{1,1};HWND window=nullptr;
  std::atomic<bool> stopping{false},contentReady{false},renderReady{false},connected{false},appReady{false};
  std::atomic<bool> failed{false},closed{false};
  std::atomic<bool> closing{false},disposeRequested{false},appDisposed{false};
  std::atomic<uint32_t> contentThread{0},renderThread{0},appThread{0};uint32_t uiThread=GetCurrentThreadId();
  std::thread contentOwner,renderOwner,appOwner;
  std::mutex appRuntimeMutex;facebook::hermes::HermesRuntime* appRuntime=nullptr;
  std::atomic<bool> appExited{false};
  std::mutex jobsMutex,doneMutex,sceneMutex,wakeMutex,metricsMutex;
  std::condition_variable changed,appChanged;
  nw::RenderDeadline renderDeadline;
  void wakeOwners(){renderDeadline.notify();changed.notify_all();}
  uint64_t appWakeRevision=0;
  std::atomic<bool> appNotification{false};
  std::atomic<uint32_t> profileRequest{0};
  void wakeApp(){ {std::lock_guard lock(wakeMutex);++appWakeRevision;} appChanged.notify_one(); }
  std::mutex notificationMutex;
  std::array<uint64_t,14> notifiedState{};
  void notifyState(const std::vector<uint8_t>& bytes){
    if(bytes.size()<wire::headerBytes+wire::stateBytes)return;
    const auto r=reader(bytes);const auto b=wire::headerBytes;
    if(r.u16(14)!=wire::statuses::ok)return;
    const auto flags=r.u32(b+wire::stateFields::flags);
    const std::array<uint64_t,14> current{
      r.u64(b+wire::stateFields::document),r.u64(b+wire::stateFields::publication),
      r.u64(b+wire::stateFields::metrics),r.u64(b+wire::stateFields::device),
      r.u64(b+wire::stateFields::failedDocument),r.u64(b+wire::stateFields::preparation),
      (flags&wire::layoutBuildPending)?r.u64(b+wire::stateFields::contentWork):0,
      uint64_t(flags&~128u),r.u64(b+wire::stateFields::focusWork),
      r.u64(b+wire::stateFields::editingWork),r.u64(b+wire::stateFields::controlWork),
      r.u64(b+wire::stateFields::appFrameWork),r.u64(b+wire::stateFields::consumedThrough),
      r.u64(b+wire::stateFields::fontRevision)};
    bool changedState=false;
    {std::lock_guard lock(notificationMutex);changedState=current!=notifiedState;notifiedState=current;}
    if(changedState||r.u32(b+wire::stateFields::interactionCount)){
      appNotification=true;wakeApp();
    }
  }
  std::shared_ptr<nelyx::v2::native::AppServices> services=std::make_shared<nelyx::v2::native::AppServices>(core.memoryLedger(),[this]{PostMessageW(window,WM_APP+3,0,0);},[this]{wakeApp();});
  nw::rnw::Clipboard clipboard;
  std::shared_ptr<nelyx::v2::native::InputClipboard> inputClipboard=std::make_shared<nelyx::v2::native::InputClipboard>(core.memoryLedger());
  std::deque<Job> jobs,done;
  std::deque<Job> uiJobs;
  std::deque<std::function<void()>> uiCallbacks;
  std::mutex uiMutex;
  std::unique_ptr<nw::Interaction> interaction;
  std::shared_ptr<RNSkia::WindowsPrecisionTrackpad> precision;
  uint64_t precisionPackets=0,precisionRejected=0;
  nw::PrecisionVelocity precisionVelocity;
  double precisionEndVelocity=0;
  uint64_t precisionEnds=0,precisionMovingEnds=0;
  bool interactionPointer=false;
  std::atomic<bool> interactionDirty{false};
  void postUI(std::function<void()> callback){{std::lock_guard lock(uiMutex);if(uiCallbacks.size()>=256)throw std::runtime_error("UI callback mailbox exceeded");uiCallbacks.push_back(std::move(callback));}PostMessageW(window,WM_APP+3,0,0);}
  size_t jobBytes=0;
  std::shared_ptr<const nw::Prepared> candidate;
  std::shared_ptr<const nw::Prepared> publishedPrepared;
  std::shared_ptr<const PreparedFont> fontCandidate;
  std::string directory;
  std::string appDirectory;
  std::atomic<uint64_t> rendered{0},paragraphs{0},pictures{0},images{0};
  std::atomic<uint64_t> graphicsRecords{0},nativeExtensions{0};
  std::atomic<uint64_t> reusedPictures{0},reusedParagraphs{0},reusedImages{0},cachedContentBytes{0},paragraphLayouts{0};
  nw::MemoryPressureMonitor memoryMonitor;
  bool osPressure=false;
  std::atomic<bool> memoryPressure{false};
  std::atomic<uint64_t> pressureEpoch{1},contentPressureEpoch{0},renderPressureEpoch{0};
  void sampleMemoryPressure() {
    if(stopping||closing)return;
    osPressure=memoryMonitor.sample(now());const bool low=osPressure;
    if(memoryPressure.exchange(low)!=low){++pressureEpoch;contentWake=true;renderWakeRequested=true;wakeOwners();}
  }
  std::atomic<uint64_t> appHeapBytes{0};
  std::atomic<uint64_t> appAcknowledgedCommands{0},appRejectedFallbacks{0};
  std::atomic<bool> appExecutionObserved{false};
  std::atomic<double> lazyOffset{0};
  std::atomic<double> scrollOffset{0};
  std::atomic<double> publishedWidth{0},publishedHeight{0};
  std::atomic<bool> appUpdate{false};
  std::atomic<bool> contentWake{true},renderWakeRequested{true};
  uint64_t inputSequence=0;double scale=1,width=960,height=720;
  bool dragging=false;double pointerX=0,pointerY=0,pointerAt=0,pointerVelocity=0;
  std::atomic<bool> metricsPending{false};bool focused=true,visible=true;
  std::string control;
  std::vector<uint8_t> call(uint32_t op,const std::vector<uint8_t>& data={},bool session=false,uint64_t requestId=0){
    // Host input/clock/status reads do not consume document node payloads.
    if(op==wire::opcodes::inspect&&data.empty()){Writer query(4);query.u32(0,wire::inspectionFlags::stateOnly);return call(op,query.bytes,session,requestId);}
    auto bytes=makePacket(op,data,session,requestId);auto result=dispatch(bytes);
    if(op==wire::opcodes::tick||op==wire::opcodes::contentStep||op==wire::opcodes::publish||
       op==wire::opcodes::metrics||op==wire::opcodes::visibility||op==wire::opcodes::preparationResult)notifyState(result);
    return result;}
  static Reader reader(const std::vector<uint8_t>& bytes){return {bytes.data(),bytes.size()};}
  void notifyError(const std::string& error){failed=true;std::osyncstream(std::cerr)<<"V2_HOST_ERROR "<<error<<std::endl;stopping=true;wakeOwners();wakeApp();PostMessageW(window,WM_CLOSE,0,0);}
  void contentLoop(){
    contentThread=GetCurrentThreadId();CoInitializeEx(nullptr,COINIT_MULTITHREADED);
    try{
      nw::ContentProvider provider(directory+"/assets/font.ttf",directory+"/assets/icudtl.dat",core.memoryLedger());contentReady=true;wakeOwners();
      uint64_t last=0,handledPressure=0;ContentTiming currentTiming;
      while(!stopping){
        if(const auto epoch=pressureEpoch.load();epoch!=handledPressure){provider.setMemoryPressure(memoryPressure);handledPressure=epoch;contentPressureEpoch=epoch;}
        Job job{};bool has=false;
        {std::lock_guard lock(jobsMutex);if(!jobs.empty()){job=std::move(jobs.front());jobs.pop_front();jobBytes-=job.bytes.size();has=true;}}
        contentWake=false;
        if(has){auto result=dispatch(job.bytes,job.enqueued);
          const auto op=Reader{job.bytes.data(),job.bytes.size()}.u16(12);
          if(op==wire::opcodes::scroll||op==wire::opcodes::scrollCancel||op==wire::opcodes::listSeek||op==wire::opcodes::gestureReply||op==wire::opcodes::requestAppFrame){renderWakeRequested=true;wakeOwners();}
          if(op==wire::opcodes::fontTransitionBegin||op==wire::opcodes::fontTransitionReady||
            op==wire::opcodes::fontTransitionCommit||op==wire::opcodes::fontTransitionAbort){renderWakeRequested=true;wakeOwners();}
          if(op==wire::opcodes::transaction){
            interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);
            if(reader(result).u16(14)==wire::statuses::accepted){renderWakeRequested=true;wakeOwners();}
          }
          if(Reader{job.bytes.data(),job.bytes.size()}.u16(12)==wire::opcodes::openView){metricsPending=true;renderWakeRequested=true;wakeOwners();}
          auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,result.size());{std::lock_guard lock(doneMutex);done.push_back({job.id,std::move(result),std::move(hold)});}wakeApp();}
        if(connected){
          if(const auto stage=core.fontTransitionSnapshot(1,1)){
            if(stage->phase==wire::fontTransitionPhases::preparing&&!(stage->ready&wire::fontTransitionOwners::content)){
              Writer reply(8);reply.u32(0,wire::fontTransitionOwners::content);
              try{
                auto fonts=provider.prepareFont(stage->resource);
                {std::lock_guard lock(sceneMutex);fontCandidate=std::make_shared<PreparedFont>(PreparedFont{stage->token,stage->resource,std::move(fonts)});}
              }catch(const std::exception& error){reply.u32(4,wire::statuses::invalidValue);std::osyncstream(std::cout)<<"V2_FONT_PREPARATION_ERROR "<<error.what()<<std::endl;}
              call(wire::opcodes::fontTransitionReady,reply.bytes,false,stage->token);renderWakeRequested=true;wakeOwners();
            }else if(stage->phase!=wire::fontTransitionPhases::preparing){
              {std::lock_guard lock(sceneMutex);fontCandidate.reset();}provider.trimFontCache();
            }
          }
          const auto stepStarted=now();Writer quota(8);quota.u32(0,wire::limits::contentPerStep);auto result=call(wire::opcodes::contentStep,quota.bytes);auto r=reader(result);
          const auto preparation=r.u64(wire::headerBytes+wire::stateFields::preparation);
          if(preparation&&preparation!=currentTiming.preparation){currentTiming={};currentTiming.preparation=preparation;currentTiming.document=r.u64(wire::headerBytes+wire::stateFields::preparationDocument);currentTiming.started=stepStarted;}
          if(preparation){++currentTiming.steps;currentTiming.coreMs+=(now()-stepStarted)*1000;currentTiming.work=r.u64(wire::headerBytes+wire::stateFields::contentWork);}
          uint64_t attempted=r.u64(wire::headerBytes+wire::stateFields::measurePreparation);
          try {
          if(r.u16(14)==0 && r.u64(wire::headerBytes+wire::stateFields::measureRequest)) {
            const auto measurementStarted=now();
            auto request=core.measurementSnapshot(1,1);
            if(request){const auto value=provider.measure(*request);Writer reply(value.geometry?wire::measurementGeometryBytes+value.geometry->selection.size()*32:
              value.placeholders?wire::measurementPlaceholderBytes+value.placeholders->boxes.size()*wire::paragraphBoxBytes:wire::measurementBytes);
              reply.u64(wire::measureFields::preparation,request->preparation);reply.u64(wire::measureFields::metrics,r.u64(wire::headerBytes+wire::stateFields::metrics));reply.u64(wire::measureFields::device,r.u64(wire::headerBytes+wire::stateFields::device));
              reply.u64(wire::measureFields::request,request->id);writeHandle(reply,wire::measureFields::node,request->node->id);
              reply.f64(wire::measureFields::width,value.width);reply.f64(wire::measureFields::height,value.height);reply.f64(wire::measureFields::minimum,value.minimum);reply.f64(wire::measureFields::maximum,value.maximum);reply.f64(wire::measureFields::baseline,value.baseline);
              reply.f64(wire::measureFields::ideographicBaseline,value.ideographicBaseline);
              reply.u32(wire::measureFields::flags,(value.didExceedMaxLines?wire::measurementFlags::didExceedMaxLines:0)|
                (value.placeholders?wire::measurementFlags::hasPlaceholders:0));
              if(value.placeholders){const auto& boxes=value.placeholders->boxes;reply.u32(wire::measureFields::placeholderCount,uint32_t(boxes.size()));
                for(size_t i=0;i<boxes.size();++i){const auto offset=wire::measurementPlaceholderBytes+i*wire::paragraphBoxBytes;const auto& box=boxes[i];
                  reply.f64(offset,box.x);reply.f64(offset+8,box.y);reply.f64(offset+16,box.width);reply.f64(offset+24,box.height);reply.u32(offset+32,box.direction);}}
              if(value.geometry){const auto& g=*value.geometry;reply.u64(wire::measureFields::geometryRevision,g.revision);reply.u32(wire::measureFields::selectionCount,uint32_t(g.selection.size()));
                const auto rect=[&](size_t o,const TextRect& r){reply.f64(o,r.x);reply.f64(o+8,r.y);reply.f64(o+16,r.width);reply.f64(o+24,r.height);};
                rect(wire::measureFields::caret,g.caret);for(size_t i=0;i<g.selection.size();++i)rect(wire::measureFields::selection+i*32,g.selection[i]);}
              auto accepted=call(wire::opcodes::measureResult,reply.bytes);const auto status=reader(accepted).u16(14);
              if(status!=wire::statuses::ok && status!=wire::statuses::stale)throw std::runtime_error("Native provider measurement rejected status="+std::to_string(status));
            }
            currentTiming.measureMs+=(now()-measurementStarted)*1000;
          }
          if(r.u16(14)==0&&(r.u32(wire::headerBytes+wire::stateFields::flags)&16u)){
            auto p=core.providerSnapshot(1,1);
            if(p&&p->id!=last){const auto recordStarted=now();attempted=p->id;last=p->id;auto prepared=provider.prepare(*p);currentTiming.recordMs=(now()-recordStarted)*1000;currentTiming.completed=now();{std::lock_guard lock(sceneMutex);candidate=std::move(prepared);}renderWakeRequested=true;wakeOwners();}
          }
          } catch(const std::exception& error) {
            currentTiming.failed=true;
            provider.discardMeasurements();Writer reply(24);reply.u64(0,attempted);
            reply.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));reply.u64(16,r.u64(wire::headerBytes+wire::stateFields::device));
            call(wire::opcodes::preparationResult,reply.bytes);std::osyncstream(std::cout)<<"V2_PREPARATION_ERROR "<<error.what()<<std::endl;
          }
          if(currentTiming.preparation){std::lock_guard lock(timingMutex);contentTiming=currentTiming;}
          if(r.u16(14)==0 &&
              ((!(r.u32(wire::headerBytes+wire::stateFields::flags)&(16u|wire::layoutBuildPending)) && r.u64(wire::headerBytes+wire::stateFields::preparation)) ||
               (!r.u64(wire::headerBytes+wire::stateFields::preparation) && r.u64(wire::headerBytes+wire::stateFields::pendingDocument))))contentWake=true;
          if(r.u64(wire::headerBytes+wire::stateFields::queryId)&&r.u32(wire::headerBytes+wire::stateFields::queryStatus)==wire::statuses::pending)contentWake=true;
        }
        paragraphs=provider.paragraphs.load();pictures=provider.pictures.load();images=provider.images.load();
        graphicsRecords=provider.graphicsRecords.load();nativeExtensions=provider.nativeExtensions.load();
        reusedPictures=provider.reusedPictures.load();reusedParagraphs=provider.reusedParagraphs.load();reusedImages=provider.reusedImages.load();
        cachedContentBytes=provider.cachedBytes.load();paragraphLayouts=provider.paragraphLayouts.load();
        std::unique_lock lock(wakeMutex);changed.wait(lock,[this,&handledPressure]{std::lock_guard queueLock(jobsMutex);return stopping||contentWake||!jobs.empty()||pressureEpoch!=handledPressure;});
      }
      {std::lock_guard lock(sceneMutex);candidate.reset();fontCandidate.reset();}
    }catch(const std::exception& error){notifyError(std::string("Content owner: ")+error.what());}
    CoUninitialize();
  }
  void renderLoop(){
    renderThread=GetCurrentThreadId();
    try{
      nw::RenderProvider provider{uint64_t(uintptr_t(window)),uiThread,core.memoryLedger()};renderReady=true;
      std::osyncstream(std::cout)<<"V2_RENDERER "<<provider.driver()<<std::endl;
      while(!stopping&&!contentReady)std::this_thread::sleep_for(std::chrono::milliseconds(2));
      if(stopping)return;
      core.connectProvider(true,contentThread,renderThread);connected=true;wakeApp();wakeOwners();
      std::shared_ptr<const nw::Prepared> active,next,pendingPrepared;
      std::shared_ptr<const Frame> pendingFrame;FrameTiming pendingTiming;
      double lastWidth=-1,lastHeight=-1,lastScale=-1;
      bool clock=false;
      double deadline=0;
      uint64_t handledPressure=0;
      while(!stopping){
        renderWakeRequested=false;
        bool retryAcquire=false;
        if(pendingFrame&&provider.complete()){
          const auto frame=pendingFrame;const auto id=frame->id;
          Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(16,1);call(wire::opcodes::releaseFrame,release.bytes);
          const auto publicationStarted=now();Writer publication(24);publication.u64(0,id);publication.u64(8,frame->device);
          const auto published=call(wire::opcodes::publish,publication.bytes);const auto state=reader(published);
          pendingTiming.publicationMs=(now()-publicationStarted)*1000;pendingTiming.completed=now();pendingTiming.publication=state.u64(wire::headerBytes+wire::stateFields::publication);
          {std::lock_guard lock(timingMutex);pendingTiming.gpu=provider.timing();frameTiming=pendingTiming;frameSamples[frameSampleCount++%frameSamples.size()]=pendingTiming;}
          if(state.u16(14)==wire::statuses::ok){
            {std::lock_guard lock(sceneMutex);publishedPrepared=pendingPrepared;}
            interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);
            publishedWidth=frame->scene->metrics.width;publishedHeight=frame->scene->metrics.height;
          }
          provider.retireFrame();pendingFrame.reset();pendingPrepared.reset();
        }
        {std::shared_ptr<const PreparedFont> prepared;{std::lock_guard lock(sceneMutex);prepared=fontCandidate;}
          if(prepared)if(const auto stage=core.fontTransitionSnapshot(1,1);stage&&stage->token==prepared->token&&
              stage->phase==wire::fontTransitionPhases::preparing&&!(stage->ready&wire::fontTransitionOwners::render)){
            if(stage->resource!=prepared->resource||(stage->resource&&!prepared->fonts))throw std::runtime_error("Native Render font preparation identity differs");
            Writer reply(8);reply.u32(0,wire::fontTransitionOwners::render);call(wire::opcodes::fontTransitionReady,reply.bytes,false,stage->token);
            contentWake=true;wakeOwners();
          }}
        if(const auto epoch=pressureEpoch.load();epoch!=handledPressure){provider.setMemoryPressure(memoryPressure);handledPressure=epoch;renderPressureEpoch=epoch;}
        const auto frameStarted=now();const auto display=nw::displayClock(window);
        if(metricsPending.exchange(false)){
          auto state=call(wire::opcodes::inspect);auto r=reader(state);
          if(r.u16(14)==0){
            std::lock_guard lock(metricsMutex);
            if(width!=lastWidth||height!=lastHeight||scale!=lastScale){
              Writer m(40);m.u64(0,r.u64(wire::headerBytes+wire::stateFields::metrics)+1);m.f64(8,width);m.f64(16,height);m.f64(24,scale);m.u64(32,r.u64(wire::headerBytes+wire::stateFields::lastInput));
              call(wire::opcodes::metrics,m.bytes);lastWidth=width;lastHeight=height;lastScale=scale;
            }
            Writer v(16);v.u32(0,(visible?1u:0u)|(focused?2u:0u));v.u64(8,r.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,v.bytes);contentWake=true;wakeOwners();
            interactionDirty=true;PostMessageW(window,WM_APP+3,0,0);
          }
        }
        {std::lock_guard lock(sceneMutex);if(candidate){next=std::move(candidate);candidate.reset();}}
        if(next){Writer p(24);p.u64(0,next->id);p.u64(8,next->metrics);p.u64(16,next->device);auto ack=call(wire::opcodes::providerReady,p.bytes);if(reader(ack).u16(14)!=0)next.reset();}
        const auto coreStarted=now();Writer tick(8);tick.f64(0,now());auto state=call(wire::opcodes::tick,tick.bytes);auto sr=reader(state);
        if(sr.u32(wire::headerBytes+wire::stateFields::flags)&1u){
          if(closing)break;
          if(const auto overflow=core.eventOverflowSnapshot(1,1)){
            std::ostringstream detail;detail<<"V2_EVENT_OVERFLOW {\"queue\":\""<<(overflow->queue==2?"interaction":"lifecycle")
              <<"\",\"triggerKind\":"<<overflow->kind<<",\"triggerStatus\":"<<overflow->status<<",\"queued\":"<<overflow->queued
              <<",\"pointerPhase\":"<<overflow->pointerPhase<<",\"pointerFlags\":"<<overflow->pointerFlags<<",\"kinds\":{";
            bool first=true;for(size_t kind=0;kind<overflow->kinds.size();++kind)if(overflow->kinds[kind]){
              if(!first)detail<<',';first=false;detail<<'"'<<kind<<"\":"<<overflow->kinds[kind];}
            std::osyncstream(std::cerr)<<detail.str()<<"}}"<<std::endl;
          }
          uint32_t reason=wire::statuses::closed;
          for(uint32_t batch=0;batch<=wire::limits::events/wire::limits::eventsPerPoll;++batch){
            const auto terminal=call(wire::opcodes::pollEvents);const auto tr=reader(terminal);
            const auto count=tr.u32(wire::headerBytes+wire::stateFields::eventCount);
            for(uint32_t index=0;index<count;++index){
              const size_t offset=wire::headerBytes+wire::stateBytes+tr.u32(wire::headerFields::count)*wire::nodeBytes+index*wire::eventBytes;
              if(tr.u32(offset)==wire::events::viewClosed)reason=tr.u32(offset+4);
            }
            if(count<wire::limits::eventsPerPoll)break;
          }
          throw std::runtime_error("Core view closed status="+std::to_string(reason));
        }
        if(sr.u16(14)==0){
          // Activation advances even while the previous GPU slot is occupied.
          // Retain each activated cohort immediately; pendingPrepared owns the
          // older submitted cohort until its independent retirement.
          if(next&&next->id==sr.u64(wire::headerBytes+wire::stateFields::activePreparation)){active=std::move(next);next.reset();}
          if(!pendingFrame){
          auto result=call(wire::opcodes::takeFrame);auto r=reader(result);const auto coreElapsedMs=(now()-coreStarted)*1000;
          if(r.u16(14)==0){
            const auto id=r.u64(wire::headerBytes+wire::stateFields::submission);auto frame=core.frameSnapshot(1,1,id);
            bool firstScroll=true;for(const auto& item:frame->items)if(frame->scene->document->get(item.node).kind==wire::kinds::scrollViewport){if(firstScroll){scrollOffset=frame->properties[item.node.slot].offset;firstScroll=false;}else lazyOffset=frame->properties[item.node.slot].offset;}
            if(next&&next->id==frame->scene->preparation){active=std::move(next);next.reset();}
            if(!active||active->id!=frame->scene->preparation)throw std::runtime_error("Native active preparation resource is missing");
            bool drawn=false;
            try{drawn=provider.draw(frame,active);}catch(...){Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(20,1);call(wire::opcodes::releaseFrame,release.bytes);throw;}
            rendered=provider.draws;
            if(!drawn){Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(20,1);call(wire::opcodes::releaseFrame,release.bytes);retryAcquire=true;if(provider.needsMetrics)metricsPending=true;}
            else {pendingFrame=frame;pendingPrepared=active;pendingTiming={display,frameStarted,coreElapsedMs,provider.recordAndBackingElapsedMs,provider.submitElapsedMs,0,0,id,frame->scene->document->epoch,0,r.u64(wire::headerBytes+wire::stateFields::consumedThrough)};}
          }
          }
          const auto events=call(wire::opcodes::pollEvents);const auto er=reader(events);
          for(uint32_t index=0;index<er.u32(wire::headerBytes+wire::stateFields::eventCount);++index){
            const size_t offset=wire::headerBytes+wire::stateBytes+er.u32(wire::headerFields::count)*wire::nodeBytes+index*wire::eventBytes;
            if(er.u32(offset)==wire::events::preparationFailed){
              std::osyncstream(std::cout)<<"V2_PREPARATION_ERROR Core status="<<er.u32(offset+4)<<" preparation="<<er.u64(offset+8)<<" document="<<er.u64(offset+16)<<std::endl;
              if(const auto f=core.preparationFailureSnapshot(1,1);f&&f->preparation==er.u64(offset+8))
                std::osyncstream(std::cout)<<"V2_PREPARATION_CONTEXT {\"ready\":"<<(f->ready?"true":"false")<<",\"node\":"<<f->node.slot<<",\"offset\":"<<f->offset<<",\"requested\":"<<f->requested<<",\"minimum\":"<<f->minimum<<",\"maximum\":"<<f->maximum<<",\"preparedOffset\":"<<f->preparedOffset<<"}"<<std::endl;
            }
          }
          clock=(sr.u32(wire::headerBytes+wire::stateFields::flags)&128u)!=0;
          deadline=sr.f64(wire::headerBytes+wire::stateFields::nextDeadline);
          if(sr.u64(wire::headerBytes+wire::stateFields::pendingDocument)){contentWake=true;wakeOwners();}
        }
        std::unique_lock lock(wakeMutex);
        const auto wake=[this,&handledPressure,&retryAcquire]{return stopping||renderWakeRequested||(metricsPending&&!retryAcquire)||pressureEpoch!=handledPressure;};
        if(clock||pendingFrame||retryAcquire){const auto display=nw::displayClock(window);const auto target=deadline>0?std::min(display.target,deadline):display.target;renderDeadline.wait(lock,target,wake);}
        else if(deadline>0)renderDeadline.wait(lock,deadline,wake);
        else changed.wait(lock,wake);
      }
      provider.close();
      if(pendingFrame){Writer release(24);release.u64(0,pendingFrame->id);release.u64(8,pendingFrame->device);release.u32(20,1);call(wire::opcodes::releaseFrame,release.bytes);}
      pendingFrame.reset();pendingPrepared.reset();active.reset();next.reset();
    }catch(const std::exception& error){notifyError(std::string("Render owner: ")+error.what());}
  }
  void appLoop(){
    AppExitSignal exitSignal{appExited};
    appThread=GetCurrentThreadId();
    try{
      while(!stopping&&!connected)std::this_thread::sleep_for(std::chrono::milliseconds(2));if(stopping)return;
      AppHeapAccount appMemory{core.memoryLedger(),appHeapBytes};
      nw::AppParagraphs appText(directory+"/assets/font.ttf",directory+"/assets/icudtl.dat",core.memoryLedger(),
        appDirectory+"/application/assets",false);
      wchar_t profileFlag[2]{};const bool profiling=GetEnvironmentVariableW(L"NELYX_V2_CPU_PROFILE",profileFlag,2)==1&&profileFlag[0]==L'1';
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withES6BlockScoping(true).withAsyncBreakCheckInEval(true).withEnableSampleProfiling(profiling).withGCConfig(::hermes::vm::GCConfig::Builder().withShouldRecordStats(profiling).build()).build());
      SamplingGuard sampling{profiling?jsi::castInterface<facebook::hermes::IHermesRootAPI>(facebook::hermes::makeHermesRootAPI()):nullptr};
      if(profiling&&!sampling.api)throw std::runtime_error("Hermes sampling interface unavailable");
      double profileDeadline=0;bool profiled=false;
      AppRuntimeRegistration registration(appRuntimeMutex,appRuntime,runtime.get());
      auto& rt=*runtime;
      appMemory.update(rt);
      auto native=jsi::Object(rt);
      native.setProperty(rt,"operatingSystem","windows");
      native.setProperty(rt,"eventNotifications",true);
      native.setProperty(rt,"clockDomain","qpc-milliseconds");
      nw::installAppText(rt,native,appText);
      nelyx::v2::native::installAppServices(rt,native,services,[clipboard=clipboard,input=inputClipboard]()mutable{input->close();clipboard.cancel();});
      auto identity=jsi::Object(rt);identity.setProperty(rt,"engine","v2");identity.setProperty(rt,"abiMajor",double(wire::abiMajor));identity.setProperty(rt,"schema",double(wire::schema));native.setProperty(rt,"identity",std::move(identity));
      native.setProperty(rt,"clock",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"clock"),0,[](jsi::Runtime&,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{return now()*1000;}));
      native.setProperty(rt,"enqueue",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"enqueue"),2,[this,&appMemory](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        appMemory.update(r);
        if(count!=2)throw jsi::JSError(r,"V2 enqueue arguments");auto buffer=args[1].getObject(r).getArrayBuffer(r);const auto length=buffer.size(r);
        std::unique_lock lock(jobsMutex);if(stopping)throw jsi::JSError(r,"V2 native mailbox closed");
        if(jobs.size()+uiJobs.size()>=wire::limits::results||jobBytes+length>4*wire::limits::packetBytes)throw jsi::JSError(r,"V2 native mailbox full");
        auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,length);std::vector<uint8_t> bytes(buffer.data(r),buffer.data(r)+length);const auto op=Reader{bytes.data(),bytes.size()}.u16(12);
        if(op==wire::opcodes::memoryReport)throw jsi::JSError(r,"Memory reports are host-only");
        // These bounded reads run on the App owner, outside the Content job
        // schedule. They still serialize with Core's authoritative input state.
        if(op==wire::opcodes::pollInteractionEvents||op==wire::opcodes::pollRaw){
          lock.unlock();
          auto result=dispatch(bytes);auto responseMemory=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,result.size());
          {std::lock_guard ready(doneMutex);done.push_back({uint32_t(args[0].asNumber()),std::move(result),std::move(responseMemory)});}
          wakeApp();return jsi::Value::undefined();
        }
        if(op==wire::opcodes::edit||op==wire::opcodes::focus||op==wire::opcodes::semanticsAction){uiJobs.push_back({uint32_t(args[0].asNumber()),std::move(bytes),std::move(hold)});PostMessageW(window,WM_APP+3,0,0);}
        else jobs.push_back({uint32_t(args[0].asNumber()),std::move(bytes),std::move(hold)});jobBytes+=length;
        contentWake=true;
        wakeOwners();return jsi::Value::undefined();}));
      native.setProperty(rt,"notify",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"notify"),2,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        if(count>1&&args[1].isObject()){
          const auto execution=args[1].asObject(r);
          const auto commands=execution.getProperty(r,"acknowledgedCommands").asNumber(),rejected=execution.getProperty(r,"rejectedFallbacks").asNumber();
          if(!std::isfinite(commands)||commands<0||commands>9007199254740991.0||!std::isfinite(rejected)||rejected<0||rejected>9007199254740991.0)throw jsi::JSError(r,"Invalid App execution counters");
          appAcknowledgedCommands=uint64_t(commands);appRejectedFallbacks=uint64_t(rejected);
          appExecutionObserved=execution.getProperty(r,"observed").getBool();
        }
        const auto message=args[0].asString(r).utf8(r);
        // Each scene ACK updates the counters above. Printing its full snapshot
        // blocks the App event pump on slow consoles until interaction events
        // overflow. Explicit stats and lifecycle/error messages remain visible.
        if(message.starts_with("{\"kind\":\"app-execution\""))return jsi::Value::undefined();
        std::osyncstream(std::cout)<<"V2_APP "<<message<<std::endl;if(message.find("app-ready")!=std::string::npos)appReady=true;if(message.find("app-disposed")!=std::string::npos)appDisposed=true;if(message.find("app-error")!=std::string::npos){stats();notifyError(message);}return jsi::Value::undefined();}));
      rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      const auto bootstrap=std::string("globalThis.__v2Timers=[];globalThis.setTimeout=(f,m=0)=>{const t={f,at:Date.now()+m};__v2Timers.push(t);return t;};globalThis.clearTimeout=t=>{if(t)t.f=null;};globalThis.__v2Delay=()=>{let d=2147483647;const n=Date.now();for(const t of __v2Timers)if(t.f)d=Math.min(d,Math.max(0,t.at-n));return d;};globalThis.__v2Pump=()=>{const n=Date.now();const q=__v2Timers.splice(0);for(const t of q){if(t.f&&t.at<=n)t.f();else if(t.f)__v2Timers.push(t);}};");
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(bootstrap),"v2-timers.js");
      const auto source=readFile(appDirectory+"/application/app.hbc");rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::string(source.begin(),source.end())),"application/app.hbc");rt.drainMicrotasks();
      while(!stopping){
        uint64_t observedWake;{std::lock_guard lock(wakeMutex);observedWake=appWakeRevision;}
        const auto profile=profileRequest.exchange(0);
        if(profiling&&profile==1&&!profiled){sampling.api->enableSamplingProfiler(250);sampling.active=true;profiled=true;profileDeadline=now()+30;std::osyncstream(std::cout)<<"V2_PROFILE_STARTED"<<std::endl;}
        if(sampling.active&&(profile==2||now()>=profileDeadline)){
          sampling.api->disableSamplingProfiler();sampling.active=false;
          std::ostringstream output;sampling.api->dumpSampledTraceToStream(output);const auto report=output.str();
          if(report.size()<=8*1024*1024)std::osyncstream(std::cout)<<"V2_PROFILE_BEGIN\n"<<report<<"\nV2_PROFILE_END"<<std::endl;
          const auto gc=rt.instrumentation().getRecordedGCStats();
          if(gc.size()<=4*1024*1024)std::osyncstream(std::cout)<<"V2_GC_BEGIN\n"<<gc<<"\nV2_GC_END"<<std::endl;
        }
        if(appNotification.exchange(false)&&rt.global().hasProperty(rt,"__v2Changed")){rt.global().getPropertyAsFunction(rt,"__v2Changed").call(rt);rt.drainMicrotasks();}
        while(services->deliver(rt))rt.drainMicrotasks();
        if(disposeRequested.exchange(false)){rt.global().getPropertyAsFunction(rt,"__v2Dispose").call(rt);rt.drainMicrotasks();}
        if(appUpdate.exchange(false)&&rt.global().hasProperty(rt,"__v2Update")){rt.global().getPropertyAsFunction(rt,"__v2Update").call(rt);rt.drainMicrotasks();}
        // Resolve the already-ready bounded mailbox before running continuations.
        // A commit continuation must not postpone an older input/geometry reply
        // behind another complete App capture just because it was second in FIFO.
        std::deque<Job> completed;{std::lock_guard lock(doneMutex);completed.swap(done);}
        for(auto& result:completed){auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(result.bytes.size())).getObject(rt);auto buffer=array.getArrayBuffer(rt);std::memcpy(buffer.data(rt),result.bytes.data(),result.bytes.size());rt.global().getPropertyAsFunction(rt,"__v2Resolve").call(rt,double(result.id),std::move(array));}
        completed.clear();rt.drainMicrotasks();
        rt.global().getPropertyAsFunction(rt,"__v2Pump").call(rt);rt.drainMicrotasks();appMemory.update(rt);
        const auto timerDelay=rt.global().getPropertyAsFunction(rt,"__v2Delay").call(rt).asNumber();
        const auto delay=sampling.active?std::min(timerDelay,std::max(0.0,(profileDeadline-now())*1000)):timerDelay;
        std::unique_lock lock(wakeMutex);appChanged.wait_for(lock,std::chrono::duration<double,std::milli>(delay),[this,observedWake]{
          if(stopping||disposeRequested||appUpdate||appNotification||appWakeRevision!=observedWake)return true;
          std::lock_guard ready(doneMutex);return !done.empty();
        });
      }
    }catch(const std::exception& error){notifyError(std::string("App owner: ")+error.what());}
  }
 public:
  Host(std::string directory,std::string appDirectory):directory(std::move(directory)),appDirectory(std::move(appDirectory)){}
  void bind(HWND value){window=value;interaction=std::make_unique<nw::Interaction>(window,core,[this](uint32_t op,const std::vector<uint8_t>& bytes){return call(op,bytes);},[this](auto callback){postUI(std::move(callback));},[this]{contentWake=true;renderWakeRequested=true;wakeOwners();},[this]{
      const auto id=inputClipboard->begin();
      try{clipboard.captureString([input=inputClipboard,id](std::string value,std::string error){input->complete(id,std::move(value),std::move(error));});}
      catch(...){inputClipboard->complete(id,{},"Input clipboard capture failed");inputClipboard->release(id);throw;}
      return id;
    },[input=inputClipboard](uint64_t id){input->release(id);});
    precision=RNSkia::WindowsPrecisionTrackpad::create(window,[this](POINT p)->std::optional<RNSkia::WindowsPrecisionPoint>{
      if(!appReady||stopping||closing||!IsWindowVisible(window)||IsIconic(window))return {};
      ScreenToClient(window,&p);const auto dpi=GetDpiForWindow(window)/96.0;RECT bounds{};GetClientRect(window,&bounds);
      if(p.x<0||p.y<0||p.x>=bounds.right||p.y>=bounds.bottom)return {};
      auto bytes=call(wire::opcodes::inspect);const auto state=reader(bytes);if(state.u16(14))return {};
      return RNSkia::WindowsPrecisionPoint{p.x/dpi,p.y/dpi,dpi,state.u64(wire::headerBytes+wire::stateFields::metrics)};
    },[this](const auto& event){precisionInput(event);});
    contentOwner=std::thread([this]{contentLoop();});renderOwner=std::thread([this]{renderLoop();});appOwner=std::thread([this]{appLoop();});}
  bool filter(const MSG& message){return interaction&&interaction->filter(message);}
  bool keydown(WPARAM key,LPARAM detail=0){return interaction&&interaction->keydown(key,detail);}
  bool keyup(WPARAM key,LPARAM detail){return interaction&&interaction->keyup(key,detail);}
  bool character(wchar_t unit){return interaction&&interaction->character(unit);}
  LRESULT object(WPARAM w,LPARAM l){return interaction?interaction->object(w,l):0;}
  void ui(){
    if(closed)return;
    services->pumpAsync([this](const std::string& method,const std::string& text,nelyx::v2::native::AppServices::Completion complete){
      // Windows' canonical accessibility embedding ignores node feedback;
      // UIA focus/invoke changes already follow the published Core mirror.
      if(method=="semantics-tap"||method=="semantics-longPress"||method=="semantics-focus"){complete({},{});return;}
      if(method=="accessibility-tooltip"){
        if(!interaction)throw std::runtime_error("Accessibility owner is unavailable");
        interaction->tooltip(text);complete({},{});return;
      }
      // Flutter's pinned Windows platform_handler.cc does not implement
      // haptics. Preserve NotImplemented for the original OptionalMethodChannel,
      // rather than turning an optional vibration into a PlatformException.
      if(method=="haptic-feedback"){complete({},"not-implemented");return;}
      if(method=="system-sound")throw std::runtime_error("Windows system feedback is unavailable");
      if(method=="clipboard-read-event"){inputClipboard->read(std::stoull(text),std::move(complete));return;}
      if(method=="clipboard-release-event"){inputClipboard->release(std::stoull(text));complete({},{});return;}
      if(method=="clipboard-write"){
        clipboard.setString(winrt::to_hstring(text),std::move(complete));return;
      }
      if(method!="clipboard-read"&&method!="clipboard-has-strings")throw std::runtime_error("Unsupported Windows OS service");
      clipboard.getString([complete=std::move(complete),has=method=="clipboard-has-strings"](std::string value,std::string error){
        complete(error.empty()&&has?(value.empty()?"0":"1"):std::move(value),std::move(error));
      });
    });
    std::deque<std::function<void()>> callbacks;{std::lock_guard lock(uiMutex);callbacks.swap(uiCallbacks);}for(auto& callback:callbacks)callback();
    std::deque<Job> accepted;{std::lock_guard lock(jobsMutex);accepted.swap(uiJobs);for(const auto& job:accepted)jobBytes-=job.bytes.size();}
    for(auto& job:accepted){auto result=interaction->gateway(job.bytes);auto hold=std::make_shared<ExternalLease>(core.memoryLedger(),3,5,result.size());{std::lock_guard lock(doneMutex);done.push_back({job.id,std::move(result),std::move(hold)});}wakeApp();}
    if(interactionDirty.exchange(false)&&interaction){std::shared_ptr<const nw::Prepared> published;{std::lock_guard lock(sceneMutex);published=publishedPrepared;}interaction->sync(std::move(published));}
  }
  void timer(UINT_PTR id){if(interaction)interaction->timer(id);if(id==1)poll();}
  void metrics(){if(!window)return;RECT r{};GetClientRect(window,&r);std::lock_guard lock(metricsMutex);scale=GetDpiForWindow(window)/96.0;width=IsIconic(window)?0:(r.right-r.left)/scale;height=IsIconic(window)?0:(r.bottom-r.top)/scale;visible=IsWindowVisible(window)&&!IsIconic(window);metricsPending=true;renderWakeRequested=true;wakeOwners();}
  void focus(bool value){
    bool shown;{std::lock_guard lock(metricsMutex);focused=value;shown=visible;}
    auto bytes=call(wire::opcodes::inspect);auto state=reader(bytes);if(state.u16(14)==wire::statuses::ok){Writer flags(16);flags.u32(0,(shown?1u:0u)|(value?2u:0u));flags.u64(8,state.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,flags.bytes);}
    metricsPending=true;renderWakeRequested=true;wakeOwners();
  }
  void update(){if(appReady&&!stopping)appUpdate=true;}
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
    input.u32(36,hover?6u:2u);input.u32(wire::inputFields::kind,wire::pointerKinds::mouse);
    input.u64(wire::inputFields::publication,r.u64(wire::headerBytes+wire::stateFields::publication));
    call(wire::opcodes::input,input.bytes);renderWakeRequested=true;wakeOwners();
  }
  void cancelPointer(){if(dragging)pointer(wire::phases::cancel,pointerX,pointerY);}
  void wheel(double delta,double x,double y){
    if(!appReady||stopping)return;auto result=call(wire::opcodes::inspect);auto r=reader(result);if(r.u16(14))return;
    Writer input(wire::inputBytes);input.u64(0,++inputSequence);input.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));input.u32(24,3);input.u32(28,wire::phases::update);input.u32(32,wire::sources::wheelUnknown);input.f64(40,now());input.f64(56,x);input.f64(64,y);input.f64(80,delta);input.u32(96,1);input.u64(wire::inputFields::publication,r.u64(wire::headerBytes+wire::stateFields::publication));call(wire::opcodes::input,input.bytes);renderWakeRequested=true;wakeOwners();
  }
  bool precisionOwnsWheel()const{return precision&&precision->ownsWheel();}
  void precisionInput(const RNSkia::WindowsPrecisionEvent& event){
    if(!appReady||stopping)return;
    const auto phase=event.kind=="panZoomStart"?wire::phases::begin:event.kind=="panZoomUpdate"?wire::phases::update:(event.kind=="inertiaCancel"||event.kind=="panZoomCancel")?wire::phases::cancel:wire::phases::end;
    auto bytes=call(wire::opcodes::inspect);const auto state=reader(bytes);if(state.u16(14))return;
    const auto at=event.timestamp/1000;
    if(phase==wire::phases::begin)precisionVelocity.begin(at);
    if(phase==wire::phases::update)precisionVelocity.update(at,-event.deltaY);
    if(phase==wire::phases::cancel)precisionVelocity.cancel();
    const auto velocity=precisionVelocity.value(at);
    if(phase==wire::phases::end){++precisionEnds;precisionEndVelocity=velocity;if(std::abs(velocity)>=1)++precisionMovingEnds;}
    Writer input(wire::inputBytes);input.u64(0,++inputSequence);input.u64(8,event.origin.generation);input.u32(24,2);input.u32(28,phase);input.u32(32,wire::sources::engineDriven);input.f64(40,at);input.f64(56,event.origin.x);input.f64(64,event.origin.y);input.f64(72,-event.deltaX);input.f64(80,-event.deltaY);input.f64(88,velocity);input.u32(96,1);input.u32(108,3);input.u32(112,2);input.u64(wire::inputFields::publication,state.u64(wire::headerBytes+wire::stateFields::publication));
    auto admitted=call(wire::opcodes::input,input.bytes);if(reader(admitted).u16(14))++precisionRejected;else ++precisionPackets;
    renderWakeRequested=true;wakeOwners();
  }
  void poll(){
    ui();
    sampleMemoryPressure();
    DWORD available=0;const auto pipe=GetStdHandle(STD_INPUT_HANDLE);
    if(PeekNamedPipe(pipe,nullptr,0,nullptr,&available,nullptr)&&available){char data[1024];DWORD read=0;ReadFile(pipe,data,std::min<DWORD>(available,sizeof(data)),&read,nullptr);control.append(data,read);if(control.size()>4096)control.clear();}
    for(size_t end;(end=control.find('\n'))!=std::string::npos;){auto line=control.substr(0,end);control.erase(0,end+1);std::istringstream in(line);std::string command;in>>command;
      if(command=="close")PostMessageW(window,WM_CLOSE,0,0);
      else if(command=="stats")stats();
      else if(command=="trace")trace();
      else if(command=="profile-start"||command=="profile-stop"){profileRequest=command=="profile-start"?1:2;wakeApp();}
    }
  }
  void stats(){auto bytes=call(wire::opcodes::inspect);auto r=reader(bytes);const auto b=wire::headerBytes;
    std::osyncstream(std::cout)<<"V2_CORE_STATE {\"document\":"<<r.u64(b+wire::stateFields::document)<<",\"activeDocument\":"<<r.u64(b+wire::stateFields::activeDocument)
      <<",\"pendingDocument\":"<<r.u64(b+wire::stateFields::pendingDocument)<<",\"preparation\":"<<r.u64(b+wire::stateFields::preparation)
      <<",\"preparationDocument\":"<<r.u64(b+wire::stateFields::preparationDocument)<<",\"failedDocument\":"<<r.u64(b+wire::stateFields::failedDocument)
      <<",\"publishedDocument\":"<<r.u64(b+wire::stateFields::publishedDocument)<<",\"flags\":"<<r.u32(b+wire::stateFields::flags)
      <<",\"rejected\":"<<r.u64(b+wire::stateFields::rejected)<<",\"canceled\":"<<r.u64(b+wire::stateFields::canceled)<<"}"<<std::endl;
    if(interaction)std::osyncstream(std::cout)<<"V2_TEXT_INPUT {\"focusNode\":"<<r.u64(b+wire::stateFields::focusNode)
      <<",\"focusPeer\":"<<r.u64(b+wire::stateFields::focusPeer)<<",\"focusSession\":"<<r.u64(b+wire::stateFields::focusSession)
      <<",\"characters\":"<<interaction->characters<<",\"applied\":"<<interaction->charactersApplied
      <<",\"unavailable\":"<<interaction->charactersUnavailable<<",\"stale\":"<<interaction->charactersStale
      <<",\"busy\":"<<interaction->charactersBusy<<",\"limited\":"<<interaction->charactersLimited
      <<",\"keysAdmitted\":"<<interaction->keysAdmitted<<",\"keysStale\":"<<interaction->keysStale
      <<",\"keysRejected\":"<<interaction->keysRejected<<",\"lastKeyStatus\":"<<interaction->lastKeyStatus
      <<",\"clipboardSnapshots\":"<<inputClipboard->pending()<<"}"<<std::endl;
    std::osyncstream(std::cout)<<"V2_INPUT_SOURCE {\"source\":\"precision-trackpad-directmanipulation\",\"available\":"<<(precision?"true":"false")<<",\"admitted\":"<<precisionPackets<<",\"rejected\":"<<precisionRejected<<",\"ends\":"<<precisionEnds<<",\"movingEnds\":"<<precisionMovingEnds<<",\"lastEndVelocity\":"<<precisionEndVelocity<<",\"physicalAcceptance\":\"notVerified\"}"<<std::endl;
    std::osyncstream(std::cout)<<"V2_STATS {\"appReady\":"<<(appReady?"true":"false")<<",\"uiThread\":"<<uiThread<<",\"appThread\":"<<appThread<<",\"contentThread\":"<<contentThread<<",\"renderThread\":"<<renderThread<<",\"frames\":"<<rendered<<",\"scrollOffset\":"<<scrollOffset<<",\"lazyOffset\":"<<lazyOffset<<",\"nodeCount\":"<<r.u32(b+wire::stateFields::nodeCount)<<",\"width\":"<<publishedWidth<<",\"height\":"<<publishedHeight<<",\"visible\":"<<((r.u32(b+wire::stateFields::flags)&2u)?"true":"false")<<",\"paragraphs\":"<<paragraphs<<",\"images\":"<<images<<",\"pictures\":"<<pictures<<",\"consumed\":"<<r.u64(b+wire::stateFields::consumed)<<",\"received\":"<<r.u64(b+wire::stateFields::received)<<",\"queued\":"<<r.u32(b+wire::stateFields::queued)<<",\"layoutWork\":"<<r.u64(b+wire::stateFields::layoutWork)<<",\"layoutReused\":"<<r.u64(b+wire::stateFields::layoutReused)<<",\"graphicsRecords\":"<<graphicsRecords<<",\"nativeExtensions\":"<<nativeExtensions<<",\"appHeapBytes\":"<<appHeapBytes<<",\"memoryTotal\":"<<r.u64(b+wire::stateFields::memoryTotal)<<",\"memoryPeak\":"<<r.u64(b+wire::stateFields::memoryPeak)<<",\"memoryGpu\":"<<r.u64(b+wire::stateFields::memoryGpu)<<",\"nativeCommands\":"<<r.u64(b+wire::stateFields::transactionWork)<<",\"ticks\":"<<r.u64(b+wire::stateFields::ticks)<<",\"document\":"<<r.u64(b+wire::stateFields::document)<<",\"activeDocument\":"<<r.u64(b+wire::stateFields::activeDocument)<<",\"preparation\":"<<r.u64(b+wire::stateFields::preparation)<<",\"pendingDocument\":"<<r.u64(b+wire::stateFields::pendingDocument)<<",\"metrics\":"<<r.u64(b+wire::stateFields::metrics)<<",\"contentWork\":"<<r.u64(b+wire::stateFields::contentWork)<<",\"editingWork\":"<<r.u64(b+wire::stateFields::editingWork)<<",\"semanticsWork\":"<<r.u64(b+wire::stateFields::semanticsWork)<<",\"queryWork\":"<<r.u64(b+wire::stateFields::queryWork)<<",\"gestureWork\":"<<r.u64(b+wire::stateFields::gestureWork)<<",\"controlWork\":"<<r.u64(b+wire::stateFields::controlWork)<<",\"fallbackPolicy\":\"reject-unported\",\"appExecutionObserved\":"<<(appExecutionObserved?"true":"false")<<",\"appAcknowledgedCommands\":"<<appAcknowledgedCommands<<",\"rejectedFallbacks\":"<<(appExecutionObserved?std::to_string(appRejectedFallbacks.load()):"null")<<",\"reusedPictures\":"<<reusedPictures<<",\"reusedParagraphs\":"<<reusedParagraphs<<",\"reusedImages\":"<<reusedImages<<",\"cachedContentBytes\":"<<cachedContentBytes<<",\"paragraphLayouts\":"<<paragraphLayouts<<",\"memoryPressure\":{\"source\":\"windows-resource-notification\",\"osLow\":"<<(osPressure?"true":"false")<<",\"effectiveLow\":"<<(memoryPressure?"true":"false")<<",\"epoch\":"<<pressureEpoch<<",\"contentEpoch\":"<<contentPressureEpoch<<",\"renderEpoch\":"<<renderPressureEpoch<<",\"gpuCacheLimitBytes\":"<<((memoryPressure?4ull:32ull)*1024*1024)<<"},\"surfaceCommit\":null,"<<timingJson()<<"}"<<std::endl;
  }
  bool hasFailed()const{return failed;}
  void uiFailure(const std::string& error){notifyError(error);}
  void close(){
    if(closing.exchange(true))return;
    if(precision){precision->cancel();precision.reset();}
    inputClipboard->close();
    clipboard.cancel();
    // WinRT completions may return to this STA. Drain them before destroying
    // the App/ledger or shutting down its App SDK dispatcher.
    const auto clipboardDeadline=now()+5;
    while(clipboard.pending()&&now()<clipboardDeadline){
      MSG message;
      while(PeekMessageW(&message,nullptr,0,0,PM_REMOVE)){
        if(message.message==WM_QUIT){PostQuitMessage(int(message.wParam));break;}
        TranslateMessage(&message);DispatchMessageW(&message);
      }
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    if(clipboard.pending()){failed=true;std::osyncstream(std::cerr)<<"V2_HOST_ERROR Clipboard terminal drain timed out"<<std::endl;}
    if(appReady&&!stopping){
      disposeRequested=true;wakeApp();const auto deadline=now()+3;
      while(!appDisposed&&!stopping&&now()<deadline){ui();std::this_thread::sleep_for(std::chrono::milliseconds(1));}
      if(!appDisposed&&!stopping){failed=true;std::osyncstream(std::cerr)<<"V2_HOST_ERROR App disposal timeout"<<std::endl;}
    }
    closed=true;stopping=true;wakeOwners();wakeApp();
    const auto appDeadline=now()+0.25;
    while(!appExited&&now()<appDeadline)std::this_thread::sleep_for(std::chrono::milliseconds(1));
    if(!appExited){std::lock_guard lock(appRuntimeMutex);if(appRuntime){failed=true;std::osyncstream(std::cerr)<<"V2_HOST_ERROR Interrupting stalled App JavaScript"<<std::endl;appRuntime->asyncTriggerTimeout();}}
    if(appOwner.joinable())appOwner.join();if(contentOwner.joinable())contentOwner.join();if(renderOwner.joinable())renderOwner.join();
    if(interaction){interaction->close();interaction.reset();}
    services->close();
    std::deque<std::function<void()>> callbacks;{std::lock_guard lock(uiMutex);callbacks.swap(uiCallbacks);}for(auto& callback:callbacks)callback();callbacks.clear();
    {std::lock_guard lock(sceneMutex);candidate.reset();publishedPrepared.reset();}
    SkGraphics::PurgeAllCaches();
    {std::lock_guard lock(jobsMutex);jobs.clear();uiJobs.clear();jobBytes=0;}{std::lock_guard lock(doneMutex);done.clear();}
    auto result=call(wire::opcodes::closeSession,{},true);auto r=reader(result);const auto memory=core.memoryLedger()->snapshot();
    if(r.u16(14)||r.u64(wire::headerBytes+wire::stateFields::reservedBytes)||memory.total)failed=true;
    std::osyncstream(std::cout)<<"V2_CLOSED {\"status\":"<<r.u16(14)<<",\"reservedBytes\":"<<r.u64(wire::headerBytes+wire::stateFields::reservedBytes)<<",\"memoryTotal\":"<<memory.total<<",\"memoryPeak\":"<<memory.peak<<",\"workersJoined\":true}"<<std::endl;
  }
  ~Host(){close();}
};
static LRESULT CALLBACK procedure(HWND window,UINT message,WPARAM w,LPARAM l){
  auto* host=reinterpret_cast<Host*>(GetWindowLongPtrW(window,GWLP_USERDATA));
  if(message==WM_NCCREATE){host=static_cast<Host*>(reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);SetWindowLongPtrW(window,GWLP_USERDATA,LONG_PTR(host));}
  try{if(host)switch(message){case WM_SIZE:case WM_SHOWWINDOW:host->metrics();return 0;
    case WM_DPICHANGED:{const auto* bounds=reinterpret_cast<const RECT*>(l);SetWindowPos(window,nullptr,bounds->left,bounds->top,bounds->right-bounds->left,bounds->bottom-bounds->top,SWP_NOACTIVATE|SWP_NOZORDER);host->metrics();return 0;}
    case WM_SETFOCUS:host->focus(true);return 0;case WM_KILLFOCUS:host->focus(false);return 0;
    case WM_APP+3:host->ui();return 0;
    case WM_GETOBJECT:if(l==UiaRootObjectId)return host->object(w,l);break;
    case WM_SYSKEYDOWN:case WM_KEYDOWN:if(host->keydown(w,l))return 0;if(w=='U'&&nw::rnw::keyDown(VK_CONTROL)){host->update();return 0;}break;
    case WM_SYSKEYUP:case WM_KEYUP:if(host->keyup(w,l))return 0;break;
    case WM_CHAR:if(host->character(wchar_t(w)))return 0;break;
    case WM_LBUTTONDOWN:{SetFocus(window);SetCapture(window);const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::begin,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);return 0;}
    case WM_MOUSEMOVE:{TRACKMOUSEEVENT track{sizeof(TRACKMOUSEEVENT),TME_LEAVE,window,0};TrackMouseEvent(&track);const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::update,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);}return 0;
    case WM_MOUSELEAVE:host->pointer(wire::phases::update,-1,-1);return 0;
    case WM_LBUTTONUP:{const auto scale=GetDpiForWindow(window)/96.0;host->pointer(wire::phases::end,GET_X_LPARAM(l)/scale,GET_Y_LPARAM(l)/scale);if(GetCapture()==window)ReleaseCapture();return 0;}
    case WM_CAPTURECHANGED:case WM_CANCELMODE:host->cancelPointer();return 0;
    case WM_MOUSEWHEEL:{if(host->precisionOwnsWheel())return 0;POINT p{GET_X_LPARAM(l),GET_Y_LPARAM(l)};ScreenToClient(window,&p);double scale=GetDpiForWindow(window)/96.0;host->wheel(-GET_WHEEL_DELTA_WPARAM(w)/120.0*48,p.x/scale,p.y/scale);return 0;}
    case WM_ERASEBKGND:return 1;case WM_TIMER:host->timer(w);return 0;case WM_APP+4:case WM_CLOSE:host->close();DestroyWindow(window);return 0;case WM_DESTROY:PostQuitMessage(0);return 0;}
  return DefWindowProcW(window,message,w,l);
  }catch(const ::Nelyx::WindowsSemantics::TextError& e){if(host)host->uiFailure("UIA publication rejected HRESULT="+std::to_string(e.result)+(e.reason?std::string("; ")+e.reason:std::string{}));return 0;}
  catch(const std::exception& e){if(host)host->uiFailure("UI message="+std::to_string(message)+": "+e.what());return 0;}
  catch(...){if(host)host->uiFailure("Unhandled UI bridge exception");return 0;}
}
int main(int argc,char**argv){
  try{
    if(argc<4)throw std::runtime_error("Usage: NelyxEngineAppSdkHost <current engine dist> --app <bundle directory>");
    std::string appDirectory;
    for(int i=2;i<argc;++i){const std::string option=argv[i];if(option=="--app"&&appDirectory.empty()&&i+1<argc)appDirectory=std::filesystem::canonical(argv[++i]).string();
      else throw std::runtime_error("Unknown or duplicate native host option: "+option);}
    if(appDirectory.empty())throw std::runtime_error("An independently built App bundle is required");
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    if(FAILED(CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED)))throw std::runtime_error("UI COM apartment failed");
    struct Apartment{~Apartment(){CoUninitialize();}}apartment;
    nw::AppSdkLoop appSdk;
    Host host(argv[1],std::move(appDirectory));const auto instance=GetModuleHandleW(nullptr);WNDCLASSW klass{};klass.hInstance=instance;klass.lpszClassName=L"NelyxEngineAppSdkHost";klass.lpfnWndProc=procedure;klass.hCursor=LoadCursorW(nullptr,IDC_ARROW);RegisterClassW(&klass);
    const auto dpi=GetDpiForSystem();RECT bounds{0,0,LONG(960*dpi/96),LONG(720*dpi/96)};AdjustWindowRectExForDpi(&bounds,WS_OVERLAPPEDWINDOW,FALSE,0,dpi);
    const auto window=CreateWindowExW(0,klass.lpszClassName,L"Nelyx Engine v2 — Windows App SDK",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,bounds.right-bounds.left,bounds.bottom-bounds.top,nullptr,nullptr,instance,&host);
    if(!window)throw std::runtime_error("Native HWND creation failed");
    struct WindowOwner{HWND window;Host& host;~WindowOwner(){host.close();if(IsWindow(window)){SetWindowLongPtrW(window,GWLP_USERDATA,0);DestroyWindow(window);}}}windowOwner{window,host};
    if(!SetConsoleCtrlHandler(closeFromConsole,TRUE))throw std::runtime_error("Native console close handler failed");
    consoleWindow=window;
    struct ConsoleOwner{~ConsoleOwner(){consoleWindow=nullptr;SetConsoleCtrlHandler(closeFromConsole,FALSE);}}consoleOwner;
    host.bind(window);host.metrics();SetTimer(window,1,16,nullptr);
    appSdk.attach(window,[&host]{host.metrics();});
    host.metrics();UpdateWindow(window);
    MSG message;int messageStatus;while((messageStatus=GetMessageW(&message,nullptr,0,0))>0){if(!host.filter(message)){TranslateMessage(&message);DispatchMessageW(&message);}}
    host.close();
    appSdk.shutdown();
    if(messageStatus<0)throw std::runtime_error("Native UI message pump failed");return host.hasFailed()?1:0;
  }catch(const winrt::hresult_error& error){std::osyncstream(std::cerr)<<"V2_HOST_ERROR Windows HRESULT="<<error.code().value<<" "<<winrt::to_string(error.message())<<std::endl;return 1;
  }catch(const std::exception& error){std::osyncstream(std::cerr)<<"V2_HOST_ERROR "<<error.what()<<std::endl;return 1;}
}
