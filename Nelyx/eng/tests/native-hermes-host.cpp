// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <objbase.h>
#include <hermes/hermes.h>
#include "RNSkVulkanRuntime.h"
#include "JsiDisplayList.h"
#include "JsiSkGraphiteContext.h"
#include "JsiSkPictureRecorder.h"
#include <jsi/instrumentation.h>
#include "InputBatch.h"
#include "RuntimeLoop.h"
#include "VmCallbacks.h"
#include "FrameTrace.h"
#include "NativeWheelDriver.h"
#include "MemoryProbe.h"
#include "native-memory-regions.h"
#include "include/core/SkSurface.h"
#include "include/core/SkPictureRecorder.h"
#include "include/utils/SkNWayCanvas.h"
#include "include/effects/SkImageFilters.h"
#include "include/ports/SkTypeface_win.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skunicode/include/SkUnicode_icu.h"
#include <fstream>
#include <iterator>
#include <future>
#include <iostream>
#include <thread>
namespace jsi=facebook::jsi;
void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
void semanticsChecks();
int nativeUiaFocusClient(char const*,char const*,bool,bool,bool);
int nativeUiaResourceClient(char const*,char const*,char const*);
extern "C" void C_SetICU(const void*);
static jsi::Value packet(jsi::Runtime&,std::vector<double> const&);
static void vmEnvironmentChecks(char const* file){
  std::ifstream input(file,std::ios::binary);require(bool(input),"Installed VM environment module missing");std::string source{std::istreambuf_iterator<char>(input),{}};
  require(!source.empty()&&source.size()<1024*1024,"VM environment module exceeds its test input bound");
  for(auto at=source.find("\nexport ");at!=std::string::npos;at=source.find("\nexport ",at))source.erase(at+1,7);
  auto runtime=facebook::hermes::makeHermesRuntime(hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());auto& rt=*runtime;double tick=0;
  Nelyx::NativeHermes::VmCallbacks callbacks(rt,[&]{return tick;},[]{});jsi::Object api(rt);callbacks.install(api);
  api.setProperty(rt,"now",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"now"),0,[&](auto&,auto const&,auto*,size_t){return jsi::Value(tick);}));
  rt.global().setProperty(rt,"vmEnvironmentFixture",std::move(api));rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(source)),"installed-vm-environment.js");
  auto script=[&](std::string source){return rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(source)),"vm-environment-lifetime.js");};
  script(R"JS(var envFailures=[],lateCallbacks=0,nativeVm=vmEnvironmentFixture;
    var env=installVmEnvironment(globalThis,{
      now:nativeVm.now,setTimer:nativeVm.setTimer,clearTimer:nativeVm.clearTimer,
      requestFrame:nativeVm.requestFrame,cancelFrame:nativeVm.cancelFrame,queueMicrotask:nativeVm.queueMicrotask,
      trackRejections:function(report){HermesInternal.enablePromiseRejectionTracker({allRejections:true,onUnhandled:function(id,error){report(error);},onHandled:function(){}});},
      fail:function(message){envFailures.push(message);},log:function(){}
    },{AbortController:function(){},AbortSignal:function(){}});
    env.claimApplication();Promise.reject('handled before close').catch(function(){});
    setInterval(function(){lateCallbacks++;},1);requestAnimationFrame(function(){lateCallbacks++;});
    queueMicrotask(function(){throw 0;});queueMicrotask(function(){lateCallbacks++;});
  )JS");rt.drainMicrotasks();
  require(script("env.state==='closing'&&envFailures.length===1&&envFailures[0]==='0'&&lateCallbacks===0").getBool(),"Actual Hermes callback failure did not fence app work");
  require(callbacks.empty(),"Actual Hermes close retained app or rejection-tracker callbacks");
  require(script("Promise.reject(0).catch(function(){});setTimeout(function(){lateCallbacks++;},0)<0").getBool(),"Handled shutdown rejection was replaced by timer admission failure");rt.drainMicrotasks();
  script("var drainComplete=false;env.retirement.delay(16).then(function(){drainComplete=true;});");tick=16;callbacks.runDueTimers();
  require(script("drainComplete").getBool(),"Actual Hermes retirement timer could not settle after the app fence");
  script("env.dispose();Promise.reject(false).catch(function(){});");rt.drainMicrotasks();
  require(script("env.state==='closed'&&lateCallbacks===0&&envFailures.length===1").getBool()&&callbacks.empty(),"Actual Hermes VM disposal lost a callback or the original error");callbacks.close();
  std::cout<<"PASS installed VM environment on actual Hermes: fatal microtask, late callback fence, handled close rejection and independent drain\n";
}
static void vmCallbackChecks(jsi::Runtime& rt){
  double tick=0;int arms=0;Nelyx::NativeHermes::VmCallbacks callbacks(rt,[&]{return tick;},[&]{++arms;});
  jsi::Object api(rt);callbacks.install(api);rt.global().setProperty(rt,"vmCallbackFixture",std::move(api));
  auto script=[&](std::string source){return rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::move(source)),"vm-callback-lifetime.js");};
  script(R"JS(var vmEvents=[];var v=vmCallbackFixture;
    v.setTimer(()=>{vmEvents.push('timer');v.queueMicrotask(()=>vmEvents.push('microtask'));v.clearTimer(laterTimer);},0,false);
    var laterTimer=v.setTimer(()=>vmEvents.push('cancelled timer'),0,false);
    var interval=v.setTimer(()=>vmEvents.push('interval'),2,true);
    v.requestFrame(()=>{vmEvents.push('frame');v.cancelFrame(laterFrame);v.requestFrame(()=>vmEvents.push('next frame'));});
    var laterFrame=v.requestFrame(()=>vmEvents.push('cancelled frame'));
    for(var bad of [-1,.5,Infinity,NaN,9007199254740992]){var rejected=false;try{v.clearTimer(bad);}catch(e){rejected=true;}if(!rejected)throw Error('Invalid callback ID accepted');}
    for(var bad of [null,3,'source']){var rejected=false;try{v.queueMicrotask(bad);}catch(e){rejected=true;}if(!rejected)throw Error('Invalid microtask accepted');}
  )JS");
  require(callbacks.deadline()==0&&arms==1,"VM callback admission/wakeup changed");callbacks.runDueTimers();
  require(script("JSON.stringify(vmEvents)").getString(rt).utf8(rt)=="[\"timer\",\"microtask\"]","Timer cancellation or per-timer microtask checkpoint changed");
  tick=2;callbacks.runDueTimers();require(callbacks.deadline()==4,"Repeating timer did not rearm from its dispatch tick");
  require(callbacks.dispatchFrames(3)==1&&arms==2,"Frame cancellation/reentrant next-tick admission changed");
  require(callbacks.dispatchFrames(4)==1,"A reentrant frame was not retained for the next tick");
  require(script("JSON.stringify(vmEvents)").getString(rt).utf8(rt)=="[\"timer\",\"microtask\",\"interval\",\"frame\",\"next frame\"]","Native callback order differs");
  bool foreign=false;std::thread thread([&]{try{callbacks.deadline();}catch(std::runtime_error const&){foreign=true;}});thread.join();require(foreign,"VM callback handles admitted a foreign thread");
  callbacks.close();require(callbacks.empty(),"VM close retained timer/frame handles");
  require(script("var rejected=false;try{v.setTimer(()=>{},0,false);}catch(e){rejected=true;}rejected").getBool(),"A retired callback owner admitted new work");
  script("v=undefined;vmCallbackFixture=undefined;vmEvents=undefined;");
  std::cout<<"PASS actual Hermes VM callback order, microtask checkpoints, cancellation, reentry, owner thread and close\n";
}
static void memoryRegionChecks(){
  namespace NM=Nelyx::NativeMemory;SYSTEM_INFO system{};GetSystemInfo(&system);const auto page=system.dwPageSize,reserve=system.dwAllocationGranularity*2;
  struct Pages{void* value;~Pages(){if(value)VirtualFree(value,0,MEM_RELEASE);}}pages{VirtualAlloc(nullptr,reserve,MEM_RESERVE,PAGE_READWRITE)};require(pages.value!=nullptr,"Address-space fixture reserve failed");const auto base=reinterpret_cast<uintptr_t>(pages.value);
  require(VirtualAlloc(pages.value,page*4,MEM_COMMIT,PAGE_READWRITE)==pages.value,"Address-space fixture commit failed");auto first=NM::query(GetCurrentProcess());require(first.allocations.at(base).committed==page*4&&first.allocations.at(base).reserved==reserve-page*4,"Private reserve and commit were conflated");
  require(VirtualAlloc(static_cast<char*>(pages.value)+page*4,page*4,MEM_COMMIT,PAGE_READWRITE)!=nullptr,"Address-space fixture expansion failed");auto second=NM::query(GetCurrentProcess());require(second.allocations.at(base).committed==page*8,"Existing allocation-base commit growth was missed");auto growth=NM::compare(first,second);require(growth.addedAtSameBase>=page*4,"Address-space growth classification lost real committed pages");
  require(VirtualFree(pages.value,page*2,MEM_DECOMMIT),"Address-space fixture decommit failed");auto third=NM::query(GetCurrentProcess());require(third.allocations.at(base).committed==page*6&&third.allocations.at(base).reserved==reserve-page*6,"Private decommit was reported as allocation release");require(NM::compare(second,third).releasedAtSameBase>=page*2,"Address-space decommit classification lost real pages");
  require(VirtualFree(pages.value,0,MEM_RELEASE),"Address-space fixture release failed");pages.value=nullptr;MEMORY_BASIC_INFORMATION released{};require(VirtualQueryEx(GetCurrentProcess(),reinterpret_cast<void*>(base),&released,sizeof(released))==sizeof(released)&&released.State==MEM_FREE,"Released private reservation remained committed");bool rejected=false;try{NM::query(nullptr);}catch(std::exception const&){rejected=true;}require(rejected,"Foreign/invalid process handle was accepted for address-space observation");
  std::cout<<"PASS actual VirtualAlloc reserve/commit/expand/decommit/release remain distinct in bounded address-space observations\n";
}
static void wheelDriverChecks(){
  namespace NH=Nelyx::NativeHermes;using namespace std::chrono_literals;
  for(auto plan:{NH::NativeWheelPlan{0,1,1},NH::NativeWheelPlan{121,1,1},NH::NativeWheelPlan{1,8193,1},NH::NativeWheelPlan{1,1000,1000}}){bool rejected=false;try{plan.validate();}catch(...){rejected=true;}require(rejected,"Unbounded native wheel plan was admitted");}
  NH::NativeWheelPlan sweep{-1,48,16,true};sweep.validate();require(sweep.step(0)==-1&&sweep.step(23)==-1&&sweep.step(24)==1&&sweep.step(47)==1,"Retained OS sweep changed its signed 24-packet halves");
  std::promise<void> sent;int calls=0;NH::NativeWheelDriver driver({-3,4,1},[&](int delta){require(delta==-3,"Native sender changed its signed delta");if(++calls==4)sent.set_value();});require(sent.get_future().wait_for(5s)==std::future_status::ready,"Native wheel worker did not finish its bounded sends");driver.stop();const auto complete=driver.snapshot();require(complete.done&&complete.error.empty()&&complete.emitted==4&&complete.net==-12&&complete.absolute==12&&complete.maximum>=complete.p95&&complete.p95>=complete.p50,"Native wheel accounting or timer ordering differs");
  std::promise<void> entered,release;auto released=release.get_future();NH::NativeWheelDriver cancelled({1,4,1},[&](int){entered.set_value();released.wait();});const auto enteredStatus=entered.get_future().wait_for(5s);cancelled.requestStop();release.set_value();cancelled.stop();require(enteredStatus==std::future_status::ready,"Native cancellation sender did not enter");require(cancelled.snapshot().done&&cancelled.snapshot().emitted==1,"Cancelled native sender emitted another input");
  std::promise<void> failed;NH::NativeWheelDriver failing({1,4,1},[&](int){failed.set_value();throw std::runtime_error("sender probe");});require(failed.get_future().wait_for(5s)==std::future_status::ready,"Native sender failure was not reached");failing.stop();require(failing.snapshot().done&&failing.snapshot().emitted==0&&failing.snapshot().error=="sender probe","Native sender failure became a successful or hanging receipt");
  const auto guardWindow=CreateWindowExW(0,L"STATIC",L"Native wheel guard fixture",WS_POPUP,0,0,1,1,nullptr,nullptr,GetModuleHandleW(nullptr),nullptr);require(guardWindow!=nullptr,"Native wheel guard HWND was not created");
  try{std::promise<void> guarding;NH::NativeWheelDriver guarded({1,4,1},[&](int){guarding.set_value();DWORD_PTR result=0;if(!SendMessageTimeoutW(guardWindow,WM_NULL,0,0,SMTO_ABORTIFHUNG|SMTO_BLOCK,20,&result))throw std::runtime_error("guard timeout");});const auto entered=guarding.get_future().wait_for(5s);const auto began=std::chrono::steady_clock::now();guarded.stop();require(entered==std::future_status::ready&&guarded.snapshot().done&&std::chrono::steady_clock::now()-began<5s,"UI-owner join waited indefinitely on its own input guard");}catch(...){DestroyWindow(guardWindow);throw;}DestroyWindow(guardWindow);
  std::cout<<"PASS bounded native wheel pacing, signed sweep, cancellation/join and sender failure without OS injection\n";
}
static void frameTraceChecks(){
  Nelyx::NativeHermes::FrameTrace<3> trace;for(uint64_t id=1;id<=4;++id){trace.input({id,id,1,4,10.+id,20.+id,21.+id,0,-48,true});trace.surface({id,1,2,1,id,id,id,3,100,100,30.+id});trace.turn({id,1,id,10.,11.,12.,13.,2});}
  auto snapshot=trace.take();require(snapshot.inputs.size()==3&&snapshot.surfaces.size()==3&&snapshot.turns.size()==3&&snapshot.lostInputs==1&&snapshot.lostSurfaces==1&&snapshot.lostTurns==1,"Frame trace overwrote evidence or failed to report lost receipts");require(snapshot.inputs[0].timestamp==11&&snapshot.inputs[2].dy==-48&&snapshot.surfaces[2].input==3&&snapshot.surfaces[2].completed==33&&snapshot.turns[2].checkpointEnd==13,"Frame/input identities, deltas or timestamps changed in diagnostic transport");
  std::thread input([&]{trace.input({5,0,2,4,1,2,3,0,48,false});trace.input({6,4,2,4,2,3,4,0,48,true});});trace.surface({4,1,2,2,4,4,4,4,200,200,40});input.join();snapshot=trace.take();require(snapshot.inputs.size()==2&&snapshot.surfaces.size()==1&&!snapshot.lostInputs&&!snapshot.lostSurfaces&&!snapshot.inputs[0].accepted&&snapshot.inputs[1].core==4,"Frame trace lost concurrent producers, rejection or accepted Core identity");require(trace.take().inputs.empty(),"Drained diagnostic receipts were retained");std::cout<<"PASS bounded concurrent native frame/input trace preserves identities and reports overflow without overwriting\n";
}
static void runtimeInputOrder(jsi::Runtime& rt){
  // Cover both queue interleavings: a tail wake before and after its following
  // control. A wake must never consume a future group across a queued control.
  for(bool earlyWake:{false,true}){
    Nelyx::NativeHermes::RuntimeLoop loop([]{return 0.;});loop.bind(rt);
    nelyx::host::InputBatch<std::pair<unsigned,int>> samples;unsigned uiGroup=0,runtimeGroup=0;std::vector<int> trace;
    auto same=[](auto const& a,auto const& b){return a.first==b.first;};
    auto deliver=[&](auto batch){for(auto const& p:batch){trace.push_back(p.second);if(p.second==129)rt.queueMicrotask(jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"input-checkpoint"),0,[&](auto&,auto const&,auto*,size_t){trace.push_back(9003);return jsi::Value::undefined();}));}};
    loop.uiBarrier([&]{const auto boundary=++uiGroup;return nelyx::host::RuntimeTask([&,boundary](auto&){for(;;){auto batch=samples.takeBatchIf([&](auto const& p){return p.first<boundary;},same);if(batch.empty())break;deliver(std::move(batch));}runtimeGroup=boundary;});});
    std::function<void(jsi::Runtime&)> wake;wake=[&](auto&){deliver(samples.takeBatchIf([&](auto const& p){return p.first<=runtimeGroup;},same));if(samples.finish())loop.invokeInput(wake);};
    auto push=[&](int id){if(samples.push({uiGroup,id}))loop.invokeInput(wake);};
    for(int id=0;id<130;++id)push(id);if(earlyWake)loop.step(0.);
    loop.invokeAsync([&](auto&){trace.push_back(9000);});for(int id=130;id<200;++id)push(id);
    loop.invokeAsync([&](auto&){trace.push_back(9001);});push(200);samples.seal();loop.closeAfterPending([&](auto&){trace.push_back(9002);});
    for(int step=0;step<12;++step)loop.step(0.);
    std::vector<int> expected;for(int id=0;id<130;++id)expected.push_back(id);expected.push_back(9003);expected.push_back(9000);for(int id=130;id<200;++id)expected.push_back(id);expected.push_back(9001);expected.push_back(200);expected.push_back(9002);
    require(trace==expected&&samples.pending()==0,"A pointer tail crossed a key/frame/close barrier or lost its microtask checkpoint");
    bool foreignSync=false;std::thread foreign([&]{try{loop.invokeSync([](auto&){});}catch(...){foreignSync=true;}});foreign.join();require(foreignSync,"Runtime sync admitted a foreign owner");loop.close();
  }
  std::cout<<"PASS actual Hermes loop preserves over-64 pointer batches, key/frame/close order and microtask checkpoints in both tail-wakeup interleavings\n";
}
static void displayListParity(jsi::Runtime& rt,std::shared_ptr<RNSkia::RNSkPlatformContext> context){
  const auto info=SkImageInfo::MakeN32Premul(128,128);auto actual=SkSurfaces::Raster(info),expected=SkSurfaces::Raster(info);require(actual&&expected,"Parity raster surfaces missing");
  SkPictureRecorder legacyRecorder;auto legacyCanvas=legacyRecorder.beginRecording(128,128);SkNWayCanvas legacy(128,128);legacy.addCanvas(expected->getCanvas());legacy.addCanvas(legacyCanvas);auto canvas=&legacy;
  jsi::Array handles(rt,16);size_t next=0;auto add=[&](jsi::Value value){const auto id=next++;handles.setValueAtIndex(rt,id,std::move(value));return double(id);};
  const auto white=add(RNSkia::JsiSkColor::toValue(rt,SK_ColorWHITE));SkPaint red;red.setColor(SK_ColorRED);red.setAntiAlias(true);SkPaint blue=red;blue.setColor(SK_ColorBLUE);blue.setStyle(SkPaint::kStroke_Style);blue.setStrokeWidth(2);SkPaint layer;layer.setAlphaf(.5f);
  const auto fill=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkPaint>(context,red))),stroke=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkPaint>(context,blue))),alpha=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkPaint>(context,layer)));
  auto rect=SkRect::MakeXYWH(4,4,32,24);auto rounded=SkRRect::MakeRectXY(SkRect::MakeXYWH(44,4,32,24),6,6);auto clip=SkRect::MakeXYWH(2,2,120,120);SkPathBuilder pathBuilder;pathBuilder.addOval(SkRect::MakeXYWH(8,44,32,26));const auto path=pathBuilder.detach();SkMatrix matrix=SkMatrix::Translate(1,2);
  const auto rectId=add(RNSkia::JsiSkRect::toValue(rt,context,rect)),roundedId=add(RNSkia::JsiSkRRect::toValue(rt,context,rounded)),clipId=add(RNSkia::JsiSkRect::toValue(rt,context,clip)),pathId=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkPath>(context,path))),matrixId=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkMatrix>(context,matrix)));
  auto imageSurface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(8,8));imageSurface->getCanvas()->clear(SK_ColorGREEN);imageSurface->getCanvas()->drawRect(SkRect::MakeXYWH(0,0,4,4),red);auto image=imageSurface->makeImageSnapshot();const auto imageId=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkImage>(context,image))),sourceId=add(RNSkia::JsiSkRect::toValue(rt,context,SkRect::MakeWH(8,8))),destinationId=add(RNSkia::JsiSkRect::toValue(rt,context,SkRect::MakeXYWH(78,44,36,28))),centerId=add(RNSkia::JsiSkRect::toValue(rt,context,SkRect::MakeXYWH(1,1,6,6)));
  SkPictureRecorder recorder;recorder.beginRecording(128,128)->drawOval(SkRect::MakeXYWH(80,80,20,20),red);auto picture=recorder.finishRecordingAsPicture();const auto pictureId=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkPicture>(context,picture)));
  auto fonts=sk_make_sp<skia::textlayout::FontCollection>();fonts->setDefaultFontManager(SkFontMgr_New_DirectWrite());skia::textlayout::ParagraphStyle paragraphStyle;skia::textlayout::TextStyle textStyle;textStyle.setFontSize(14);textStyle.setColor(SK_ColorBLACK);textStyle.setFontFamilies({SkString("Segoe UI")});paragraphStyle.setTextStyle(textStyle);auto builder=skia::textlayout::ParagraphBuilder::make(paragraphStyle,fonts,SkUnicodes::ICU::Make());require(bool(builder),"Parity paragraph builder missing");builder->addText("Native paragraph");auto paragraph=std::make_shared<RNSkia::JsiSkParagraph>(context,builder.get());paragraph->layout(120);const auto paragraphId=add(RNSkia::makeJsiObject(rt,paragraph));auto blur=SkImageFilters::Blur(2,2,nullptr);const auto blurId=add(RNSkia::makeJsiObject(rt,std::make_shared<RNSkia::JsiSkImageFilter>(context,blur)));
  auto compare=[&](std::vector<double> const& words){
    jsi::Value table(rt,handles);RNSkia::replayDisplayList(rt,actual->getCanvas(),packet(rt,words),table);
    auto recorder=std::make_shared<RNSkia::JsiSkPictureRecorder>(context);auto object=RNSkia::makeJsiObject(rt,recorder).getObject(rt);auto replay=object.getPropertyAsFunction(rt,"nelyxReplayDisplayList");
    bool rejected=false;try{replay.callWithThis(rt,object,packet(rt,words),table);}catch(std::exception const&){rejected=true;}require(rejected,"Picture packet admitted outside a recording");
    auto alias=recorder->beginRecording(std::make_shared<SkRect>(SkRect::MakeWH(128,128)));replay.callWithThis(rt,object,packet(rt,words),table);
    auto invalid=packet(rt,{0x4e4c444c,1,2,16,22,9,0,0,0,128,128,0,0,0xff0000ff,1,99,0});rejected=false;try{replay.callWithThis(rt,object,invalid,table);}catch(std::exception const&){rejected=true;}require(rejected,"Malformed picture packet bypassed complete validation");
    auto picture=recorder->finishRecordingAsPicture();auto restored=SkSurfaces::Raster(info),oldPictureSurface=SkSurfaces::Raster(info);require(restored&&oldPictureSurface,"Picture parity surface missing");restored->getCanvas()->drawPicture(picture->getObject());
    legacy.removeCanvas(legacyCanvas);auto oldPicture=legacyRecorder.finishRecordingAsPicture();oldPictureSurface->getCanvas()->drawPicture(oldPicture);legacyCanvas=legacyRecorder.beginRecording(128,128);legacy.addCanvas(legacyCanvas);
    rejected=false;try{alias->getCanvas();}catch(std::exception const&){rejected=true;}require(rejected,"Picture finish left a live borrowed canvas");
    rejected=false;try{replay.callWithThis(rt,object,packet(rt,words),table);}catch(std::exception const&){rejected=true;}require(rejected,"Picture packet admitted after finish");object.getPropertyAsFunction(rt,"dispose").callWithThis(rt,object);
    rejected=false;try{replay.callWithThis(rt,object,packet(rt,words),table);}catch(std::exception const&){rejected=true;}require(rejected,"Picture packet admitted after disposal");
    SkPixmap a,b,c,d;require(actual->peekPixels(&a)&&expected->peekPixels(&b)&&restored->peekPixels(&c)&&oldPictureSurface->peekPixels(&d),"Parity pixels missing");for(int y=0;y<128;++y)for(int x=0;x<128;++x){require(a.getColor(x,y)==b.getColor(x,y),"Native batch pixels differ from the existing SkCanvas path");if(c.getColor(x,y)!=d.getColor(x,y))throw std::runtime_error("Picture packet pixel mismatch at "+std::to_string(x)+","+std::to_string(y)+" expected="+std::to_string(d.getColor(x,y))+" actual="+std::to_string(c.getColor(x,y))+" commands="+std::to_string(int(words[2]))+" words="+std::to_string(words.size()));}require(actual->getCanvas()->getSaveCount()==1,"Native batch leaked a save/layer");
  };
  auto words=std::vector<double>{0x4e4c444c,1,0,16};auto emit=[&](int op,std::initializer_list<double> values){++words[2];words.push_back(op);words.push_back(double(values.size()));words.insert(words.end(),values);};
  emit(2,{white});canvas->clear(SK_ColorWHITE);emit(0,{});canvas->save();emit(12,{matrixId});canvas->concat(matrix);emit(13,{1,0,0,0,0,1,0,0,0,0,1,0,2,1,0,1});nelyx::skia_core::concatMatrix4(*canvas,{1,0,0,0,0,1,0,0,0,0,1,0,2,1,0,1});emit(8,{clipId,1,1});canvas->clipRect(clip,SkClipOp::kIntersect,true);emit(4,{rectId,fill});canvas->drawRect(rect,red);emit(5,{rectId,stroke});canvas->drawOval(rect,blue);emit(6,{roundedId,fill});canvas->drawRRect(rounded,red);emit(7,{4,34,114,34,stroke});canvas->drawLine(4,34,114,34,blue);emit(10,{pathId,fill});canvas->drawPath(path,red);emit(1,{});canvas->restore();compare(words);
  const auto src=SkRect::MakeWH(8,8),dst=SkRect::MakeXYWH(78,44,36,28);for(int op:{14,15,16,17}){words={0x4e4c444c,1,0,16};emit(2,{white});canvas->clear(SK_ColorWHITE);if(op==14){emit(op,{imageId,sourceId,destinationId,-1});canvas->drawImageRect(image,src,dst,SkSamplingOptions(),nullptr,SkCanvas::kStrict_SrcRectConstraint);}else if(op==15){emit(op,{imageId,sourceId,destinationId,1,0,-1});canvas->drawImageRect(image,src,dst,SkSamplingOptions(SkFilterMode::kLinear),nullptr,SkCanvas::kStrict_SrcRectConstraint);}else if(op==16){emit(op,{imageId,sourceId,destinationId,1./3,1./3,-1});canvas->drawImageRect(image,src,dst,SkSamplingOptions(SkCubicResampler{1.f/3,1.f/3}),nullptr,SkCanvas::kStrict_SrcRectConstraint);}else{emit(op,{imageId,centerId,destinationId,1,-1});canvas->drawImageNine(image.get(),SkIRect::MakeXYWH(1,1,6,6),dst,SkFilterMode::kLinear,nullptr);}compare(words);}
  words={0x4e4c444c,1,0,16};emit(2,{white});canvas->clear(SK_ColorWHITE);emit(0,{});canvas->save();emit(9,{roundedId,1,1});canvas->clipRRect(rounded,SkClipOp::kIntersect,true);emit(3,{fill});canvas->drawPaint(red);emit(1,{});canvas->restore();emit(0,{});canvas->save();emit(11,{pathId,1,1});canvas->clipPath(path,SkClipOp::kIntersect,true);emit(3,{stroke});canvas->drawPaint(blue);emit(1,{});canvas->restore();emit(20,{alpha,-1,-1});canvas->saveLayer(nullptr,&layer);emit(18,{pictureId});canvas->drawPicture(picture);emit(1,{});canvas->restore();compare(words);
  words={0x4e4c444c,1,0,16};emit(2,{white});canvas->clear(SK_ColorWHITE);emit(21,{pathId,0x6600ff00,4,0,2});nelyx::skia_core::drawShadow(*canvas,path,0x6600ff00,4,false,2);emit(22,{2,88,6,20,24,4,4,0xff330066,1});SkPaint purple;purple.setAntiAlias(true);purple.setColor(0xff330066);canvas->drawRRect(SkRRect::MakeRectXY(SkRect::MakeXYWH(88,6,20,24),4,4),purple);compare(words);
  words={0x4e4c444c,1,0,16};emit(2,{white});canvas->clear(SK_ColorWHITE);emit(4,{rectId,fill});canvas->drawRect(rect,red);emit(20,{alpha,clipId,blurId});canvas->saveLayer(SkCanvas::SaveLayerRec(&clip,&layer,blur.get(),0));emit(19,{paragraphId,4,88});nelyx::skia_core::paintParagraph(*paragraph->getObject(),*canvas,4,88);emit(1,{});canvas->restore();compare(words);
  std::cout<<"PASS all 23 frame and PictureRecorder batch opcodes match legacy pixels, including paragraph/backdrop; malformed picture packets are atomic and finish/disposal invalidate admission\n";
}
class Scheduler final:public nelyx::host::RuntimeScheduler{public:jsi::Runtime* runtime=nullptr;void invokeSync(nelyx::host::RuntimeTask&& task)override{task(*runtime);}void invokeAsync(nelyx::host::RuntimeTask&&)override{throw std::runtime_error("Unexpected asynchronous test work");}};
static jsi::Value packet(jsi::Runtime& rt,std::vector<double> const& words){auto object=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(words.size()*8)).getObject(rt);auto buffer=object.getArrayBuffer(rt);memcpy(buffer.data(rt),words.data(),words.size()*8);return jsi::Value(std::move(object));}
static void scrollingShadowChecks(std::shared_ptr<RNSkia::RNSkPlatformContext> context){
  const auto rounded=SkRRect::MakeRectXY(SkRect::MakeXYWH(0,0,445.5f,119),12,12);
  SkPathBuilder builder;builder.addRRect(rounded);const auto path=builder.detach();
  SkPaint fill;fill.setAntiAlias(true);fill.setColor(0xffeeeeee);
  auto deferred=context->getGpuContext().makeRecorder();
  bool shadowsPresent=true;
  // Actual All components card geometry. At DPR2 the pinned Skia shadow lost
  // over 90% of its pixels at these fractional scroll positions. The reference
  // permits normal pixel-phase coverage changes while detecting dropout and
  // overshoot. Subtracting the fill-only render excludes edge antialiasing.
  for(float dpr:{1.f,2.f})for(bool retained:{false,true}){
    unsigned reference=0;
    for(float y:{321.f,423.69f,394.497f,345.842f,320.25f,511.269f}){
      std::vector<SkColor> baseline(2048*1440);unsigned mass=0;
      for(bool shadow:{false,true}){
        // A fresh surface avoids reading a previous snapshot after external
        // deferred replay; its own initialization must precede that replay.
        auto surface=context->makeOffscreenSurface(2048,1440);require(bool(surface),"Shadow GPU surface missing");
        const auto paint=[&](SkCanvas* canvas){if(shadow)nelyx::skia_core::drawShadow(*canvas,path,SK_ColorBLACK,1,false,dpr);canvas->drawRRect(rounded,fill);};
        auto canvas=deferred->makeDeferredCanvas(surface->imageInfo(),context->getGpuContext().textureInfo(surface->imageInfo().colorType()));
        require(canvas,"Deferred shadow canvas missing");canvas->clear(SK_ColorWHITE);canvas->save();canvas->scale(dpr,dpr);canvas->translate(268,y);
        if(retained){
          auto recorder=std::make_shared<RNSkia::JsiSkPictureRecorder>(context);
          auto recordingCanvas=recorder->beginRecording(std::make_shared<SkRect>(SkRect::MakeLTRB(SK_ScalarMin,SK_ScalarMin,SK_ScalarMax,SK_ScalarMax)))->getCanvas();
          paint(recordingCanvas);
          // Keep this above SkPicture's small-picture inline threshold so the
          // actual RTree replay and picture optimizations are exercised.
          for(int i=0;i<64;++i)recordingCanvas->drawRect(SkRect::MakeXYWH(4000+i*4,4000,1,1),fill);
          canvas->drawPicture(recorder->finishRecordingAsPicture()->getObject());
        }else paint(canvas);
        canvas->restore();auto frame=deferred->snap(),initial=surface->recorder()->snap();
        if(initial)context->getGpuContext().submitRecording(initial.get());
        require(frame&&context->getGpuContext().insertRecordings({frame.get()},surface.get()),"Deferred shadow recording rejected");
        auto image=surface->makeImageSnapshot();auto recording=surface->recorder()->snap();
        if(recording)context->getGpuContext().submitRecording(recording.get());
        auto raster=context->getGpuContext().MakeRasterImage(image);SkPixmap pixels;
        require(raster&&raster->peekPixels(&pixels),"Shadow GPU readback missing");
        require(pixels.getColor(int(288*dpr),int((y+30)*dpr))==0xffeeeeee,"Deferred card fill did not reach the readback surface");
        for(int row=0;row<1440;++row)for(int x=0;x<2048;++x){
          const auto index=row*2048+x;const auto color=pixels.getColor(x,row);
          if(!shadow)baseline[index]=color;
          else if(SkColorGetR(baseline[index])>SkColorGetR(color))mass+=SkColorGetR(baseline[index])-SkColorGetR(color);
        }
      }
      if(y==321)reference=mass;
      const bool stable=reference>0&&mass*2>=reference&&mass*2<=reference*3;
      if(!stable)std::cerr<<"Unstable shadow dpr="<<dpr<<" retained="<<retained<<" y="<<y<<" mass="<<mass<<" reference="<<reference<<'\n';
      shadowsPresent=shadowsPresent&&stable;
    }
  }
  deferred.reset();require(context->getGpuContext().retireWork(),"Shadow GPU work did not drain");
  require(shadowsPresent,"Scrolling card shadow disappeared from the actual Vulkan surface");
  std::cout<<"PASS 24 actual Vulkan card shadow positions, DPR1/2 and retained RTree pictures preserve fractional scrolling without shadow dropout; GPU work drains\n";
}
static void recordingLifetime(jsi::Runtime& rt,std::shared_ptr<Scheduler> scheduler){
  RNSkia::VulkanPlatformServices services;services.fontManager=[](){return SkFontMgr_New_DirectWrite();};services.dispatchToMain=[](auto task){task();};services.reportError=[](auto const& error){throw std::runtime_error(error.what());};services.stream=[](auto const&,auto const&){throw std::runtime_error("Unexpected recording fixture stream");};services.screenshot=[](size_t){return sk_sp<SkImage>{};};services.createDevice=[](){return std::make_shared<nelyx::vulkan::Device>();};
  auto scope=std::make_unique<RNSkia::RNSkVulkanRuntime>(rt,scheduler,1,std::move(services),[]{});
  scope->getPlatformContext()->configureGpuPolicy(false);
  auto target=std::make_shared<RNSkia::RNSkGraphiteTarget>(scope->getPlatformContext());target->setLayout(32,32,true,false);target->nelyxConfigure();require(target->nelyxReserve(target->nelyxIdentity(),32,32,1024,1)==0,"Native recording reservation missing");
  auto wrapper=std::make_shared<RNSkia::JsiSkGraphiteContext>(scope->getPlatformContext(),target);auto canvas=wrapper->beginRecording();std::weak_ptr<RNSkia::JsiSkCanvas> borrowed=canvas;canvas.reset();rt.instrumentation().collectGarbage("native-display-list-lifetime");
  require(!borrowed.expired(),"An open native recording lost its canvas to JS liveness/GC");
  jsi::Value args[]{packet(rt,{0x4e4c444c,1,1,0,22,9,0,0,0,32,32,0,0,0xff123456,1}),jsi::Value(jsi::Array(rt,0))};wrapper->nelyxReplayDisplayList(rt,jsi::Value::undefined(),args,2);
  auto recording=wrapper->finishRecording();require(borrowed.expired(),"Snapped canvas wrapper was retained after its native recording");recording.reset();wrapper->nelyxClose();wrapper->nelyxReset();wrapper.reset();target.reset();scrollingShadowChecks(scope->getPlatformContext());scope->close(rt);scope.reset();
  std::cout<<"PASS actual Vulkan recording keeps its canvas through forced Hermes GC and releases it at snap/drain\n";
}
int main(int count,char** args){try{
  if(count==5&&std::string(args[1])=="--uia-resources")return nativeUiaResourceClient(args[2],args[3],args[4]);
  if(count>=4&&count<=7&&std::string(args[1])=="--uia-focus"){bool category=false,pointer=false,range=false;for(int index=4;index<count;++index){const std::string option(args[index]);if(option=="--text-category"&&!category)category=true;else if(option=="--pointer"&&!pointer)pointer=true;else if(option=="--range"&&!range)range=true;else throw std::runtime_error("Unknown or duplicate UIA focus option");}return nativeUiaFocusClient(args[2],args[3],category,pointer,range);}
  {Nelyx::NativeHermes::MemoryProbe off,on(true);require(!off.admit(0,0,true)&&!on.admit(0,0,false)&&!on.admit(1,0,true)&&!on.admit(0,1,true)&&!on.admit(31,0,true),"Memory observer admitted a disabled, foreign or unbounded request");require(on.admit(0,0,true)&&!on.admit(0,0,true)&&on.admit(1,0,true),"Memory observer lost its monotonic request boundary");const auto memory=Nelyx::NativeHermes::currentProcessMemory();require(memory.privateBytes>0&&memory.workingSetBytes>0&&memory.peakPrivateBytes>=memory.privateBytes,"Actual private commit memory is unavailable");}
  memoryRegionChecks();
  frameTraceChecks();
  wheelDriverChecks();
  require(count==3,"Pinned ICU and installed VM environment input paths missing");std::ifstream icuFile(args[1],std::ios::binary|std::ios::ate);require(bool(icuFile),"Pinned ICU input missing");const auto icuSize=icuFile.tellg();require(icuSize>0&&icuSize<64*1024*1024,"ICU input size outside its budget");std::vector<char> icu(size_t(icuSize),0);icuFile.seekg(0);require(bool(icuFile.read(icu.data(),icuSize)),"Pinned ICU read failed");C_SetICU(icu.data());vmEnvironmentChecks(args[2]);
  nelyx::host::InputBatch<int,4> input;require(input.push(1)&&!input.push(2),"One input wakeup required");require(input.take(1)==std::vector<int>{1}&&input.finish(),"Partial drain must rearm");std::thread producer([&]{input.push(3);input.push(4);input.push(5);});producer.join();bool saturated=false;try{input.push(6);}catch(...){saturated=true;}require(saturated&&input.take()==std::vector<int>({2,3,4,5})&&!input.finish(),"Samples lost, reordered or unbounded");require(input.push(7),"An idle mailbox must wake again");input.seal();bool sealed=false;try{input.push(8);}catch(...){sealed=true;}require(sealed&&input.take()==std::vector<int>{7}&&!input.finish(),"Close must drain admitted samples without admitting more");
  nelyx::host::InputBatch<std::pair<int,int>> bounded;bounded.push({0,1});bounded.push({0,2});bounded.push({1,3});const auto same=[](auto const& a,auto const& b){return a.first==b.first;};auto first=bounded.takeBatch(same);require(first.size()==2&&first[0].second==1&&first[1].second==2&&bounded.finish(),"A key/viewport boundary was crossed by a pointer wakeup");require(bounded.takeBatch(same).front().second==3&&!bounded.finish(),"A later input group bypassed its native control barrier");
  CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);auto runtime=facebook::hermes::makeHermesRuntime(hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());runtimeInputOrder(*runtime);vmCallbackChecks(*runtime);auto scheduler=std::make_shared<Scheduler>();scheduler->runtime=runtime.get();RNSkia::VulkanPlatformServices services;services.fontManager=[](){return SkFontMgr_New_DirectWrite();};services.dispatchToMain=[](auto task){task();};services.reportError=[](auto const& error){throw std::runtime_error(error.what());};services.stream=[](auto const&,auto const&){throw std::runtime_error("Unexpected stream in paint validation");};services.screenshot=[](size_t){return sk_sp<SkImage>{};};services.createDevice=[]()->std::shared_ptr<nelyx::vulkan::Device>{throw std::runtime_error("Native packet validation must not allocate a GPU device");};
  auto scope=std::make_unique<RNSkia::RNSkVulkanRuntime>(*runtime,scheduler,1,std::move(services),[]{});
  {
    auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(32,32));require(bool(surface),"Raster test surface missing");auto canvas=surface->getCanvas();canvas->clear(SK_ColorWHITE);auto rt=runtime.get();jsi::Value handles(jsi::Array(*rt,0));
    auto bytes=packet(*rt,{0x4e4c444c,1,3,0,0,0,22,9,0,1,2,3,4,0,0,0xffff0000,1,1,0});RNSkia::replayDisplayList(*rt,canvas,bytes,handles);
    SkPixmap pixels;require(surface->peekPixels(&pixels),"Pixels unavailable");require(pixels.getColor(2,3)==SK_ColorRED&&pixels.getColor(10,10)==SK_ColorWHITE,"Native raw fill pixel parity failed");
    // Complete validation precedes all mutations, even when the final command
    // fails after an otherwise valid destination-changing fill.
    auto invalid=packet(*rt,{0x4e4c444c,1,2,0,22,9,0,0,0,32,32,0,0,0xff0000ff,1,18,1,0});bool rejected=false;try{RNSkia::replayDisplayList(*rt,canvas,invalid,handles);}catch(jsi::JSError const&){rejected=true;}require(rejected&&pixels.getColor(10,10)==SK_ColorWHITE,"Invalid native handle partially mutated recording");
    auto unbalanced=packet(*rt,{0x4e4c444c,1,1,0,0,0});rejected=false;try{RNSkia::replayDisplayList(*rt,canvas,unbalanced,handles);}catch(jsi::JSError const&){rejected=true;}require(rejected&&canvas->getSaveCount()==1,"Invalid layer balance changed native canvas state");
    jsi::Array colors(*rt,1);colors.setValueAtIndex(*rt,0,rt->global().getPropertyAsFunction(*rt,"Float32Array").callAsConstructor(*rt,0));jsi::Value colorTable(std::move(colors));auto badColor=packet(*rt,{0x4e4c444c,1,2,1,22,9,0,0,0,32,32,0,0,0xff0000ff,1,2,1,0});rejected=false;try{RNSkia::replayDisplayList(*rt,canvas,badColor,colorTable);}catch(jsi::JSError const&){rejected=true;}require(rejected&&pixels.getColor(10,10)==SK_ColorWHITE,"A short colour buffer was read or partially changed the canvas");
  }
  displayListParity(*runtime,scope->getPlatformContext());scope->close(*runtime);scope.reset();recordingLifetime(*runtime,scheduler);runtime.reset();semanticsChecks();CoUninitialize();std::cout<<"PASS native display-list pixels/atomic rejection/save balance; input order/concurrency/bounds/close; direct JSI scope retirement\n";return 0;
}catch(std::exception const& error){std::cerr<<error.what()<<'\n';return 1;}}
