// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include <windowsx.h>
#include <hermes/hermes.h>
#include <jsi/jsi.h>
#include "../../core/engine.hpp"
#include "skia_provider.hpp"
#include <condition_variable>
#include <deque>
#include <fstream>
#include <iostream>
#include <sstream>
#include <functional>

namespace jsi=facebook::jsi;
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
static double now(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
static std::vector<uint8_t> readFile(const std::string& path){std::ifstream stream(path,std::ios::binary);if(!stream)throw std::runtime_error("File unavailable: "+path);return {std::istreambuf_iterator<char>(stream),{}};}
static std::vector<uint8_t> makePacket(uint32_t op,const std::vector<uint8_t>& data={},bool session=false){
  Writer w(wire::headerBytes+data.size());w.u32(0,wire::magic);w.u16(4,2);w.u32(8,wire::schema);w.u16(12,uint16_t(op));w.u32(16,uint32_t(w.bytes.size()));w.u32(20,1);w.u32(24,1);w.u32(28,session?0:1);w.u32(32,session?0:1);
  if(!data.empty())std::memcpy(w.bytes.data()+wire::headerBytes,data.data(),data.size());return std::move(w.bytes);
}
struct Job{uint32_t id;std::vector<uint8_t> bytes;};
class Host {
  Engine core{1,1};HWND window=nullptr;
  std::atomic<bool> stopping{false},contentReady{false},renderReady{false},connected{false},appReady{false};
  std::atomic<bool> failed{false},closed{false};
  std::atomic<uint32_t> contentThread{0},renderThread{0},appThread{0};uint32_t uiThread=GetCurrentThreadId();
  std::thread contentOwner,renderOwner,appOwner;
  std::mutex jobsMutex,doneMutex,sceneMutex,wakeMutex,metricsMutex;
  std::condition_variable changed,appChanged;
  std::deque<Job> jobs,done;
  size_t jobBytes=0;
  std::shared_ptr<const nw::Prepared> candidate;
  std::string directory;
  std::atomic<uint64_t> rendered{0},paragraphs{0},pictures{0},images{0};
  std::atomic<uint32_t> contentDelay{0},appDelay{0};
  uint64_t inputSequence=0;double scale=1,width=960,height=720;
  std::atomic<bool> metricsPending{true};bool focused=true,visible=true;
  std::string control;
  std::vector<uint8_t> call(uint32_t op,const std::vector<uint8_t>& data={},bool session=false){auto bytes=makePacket(op,data,session);return core.dispatch({bytes.data(),bytes.size()});}
  static Reader reader(const std::vector<uint8_t>& bytes){return {bytes.data(),bytes.size()};}
  void notifyError(const std::string& error){failed=true;std::cerr<<"V2_HOST_ERROR "<<error<<std::endl;stopping=true;changed.notify_all();appChanged.notify_all();PostMessageW(window,WM_CLOSE,0,0);}
  void contentLoop(){
    contentThread=GetCurrentThreadId();CoInitializeEx(nullptr,COINIT_MULTITHREADED);
    try{
      nw::ContentProvider provider(directory+"/assets/font.ttf",directory+"/assets/icudtl.dat");contentReady=true;changed.notify_all();
      uint64_t last=0;
      while(!stopping){
        Job job{};bool has=false;
        {std::lock_guard lock(jobsMutex);if(!jobs.empty()){job=std::move(jobs.front());jobs.pop_front();jobBytes-=job.bytes.size();has=true;}}
        if(has){auto result=core.dispatch({job.bytes.data(),job.bytes.size()});{std::lock_guard lock(doneMutex);done.push_back({job.id,std::move(result)});}appChanged.notify_one();}
        if(const auto delay=contentDelay.exchange(0)){std::cout<<"V2_CONTENT_DELAY_START "<<delay<<std::endl;std::this_thread::sleep_for(std::chrono::milliseconds(delay));std::cout<<"V2_CONTENT_DELAY_END"<<std::endl;}
        if(connected){Writer quota(8);quota.u32(0,wire::limits::contentPerStep);auto result=call(wire::opcodes::contentStep,quota.bytes);auto r=reader(result);
          if(r.u16(14)==0&&(r.u32(wire::headerBytes+wire::stateFields::flags)&16u)){
            auto p=core.providerSnapshot(1,1);
            if(p&&p->id!=last){last=p->id;auto prepared=provider.prepare(*p);{std::lock_guard lock(sceneMutex);candidate=std::move(prepared);}changed.notify_one();}
          }
        }
        paragraphs=provider.paragraphs.load();pictures=provider.pictures.load();images=provider.images.load();
        std::unique_lock lock(wakeMutex);changed.wait_for(lock,std::chrono::milliseconds(4));
      }
      {std::lock_guard lock(sceneMutex);candidate.reset();}
    }catch(const std::exception& error){notifyError(error.what());}
    CoUninitialize();
  }
  void renderLoop(){
    renderThread=GetCurrentThreadId();
    try{
      nw::RenderProvider provider(uint64_t(uintptr_t(window)));renderReady=true;
      std::cout<<"V2_RENDERER "<<provider.driver()<<std::endl;
      while(!stopping&&!contentReady)std::this_thread::sleep_for(std::chrono::milliseconds(2));
      if(stopping)return;
      core.connectProvider(true,contentThread,renderThread);connected=true;appChanged.notify_all();changed.notify_all();
      std::shared_ptr<const nw::Prepared> active,next;
      bool clock=false;
      while(!stopping){
        if(metricsPending.exchange(false)){
          auto state=call(wire::opcodes::inspect);auto r=reader(state);
          if(r.u16(14)==0){
            std::lock_guard lock(metricsMutex);
            Writer m(40);m.u64(0,r.u64(wire::headerBytes+wire::stateFields::metrics)+1);m.f64(8,width);m.f64(16,height);m.f64(24,scale);m.u64(32,r.u64(wire::headerBytes+wire::stateFields::lastInput));
            call(wire::opcodes::metrics,m.bytes);
            Writer v(16);v.u32(0,(visible?1u:0u)|(focused?2u:0u));v.u64(8,r.u64(wire::headerBytes+wire::stateFields::lastInput));call(wire::opcodes::visibility,v.bytes);changed.notify_one();
          }else metricsPending=true;
        }
        {std::lock_guard lock(sceneMutex);if(candidate){next=std::move(candidate);candidate.reset();}}
        if(next){Writer p(24);p.u64(0,next->id);p.u64(8,next->metrics);p.u64(16,next->device);auto ack=call(wire::opcodes::providerReady,p.bytes);if(reader(ack).u16(14)!=0)next.reset();}
        Writer tick(8);tick.f64(0,now());auto state=call(wire::opcodes::tick,tick.bytes);auto sr=reader(state);
        if(sr.u16(14)==0){
          auto result=call(wire::opcodes::takeFrame);auto r=reader(result);
          if(r.u16(14)==0){
            const auto id=r.u64(wire::headerBytes+wire::stateFields::submission);auto frame=core.frameSnapshot(1,1,id);
            if(next&&next->id==frame->scene->preparation){active=std::move(next);next.reset();}
            if(!active||active->id!=frame->scene->preparation)throw std::runtime_error("Native active preparation resource is missing");
            provider.draw(*frame,*active);rendered=provider.draws;
            Writer release(24);release.u64(0,id);release.u64(8,frame->device);release.u32(16,1);call(wire::opcodes::releaseFrame,release.bytes);
            Writer publication(24);publication.u64(0,id);publication.u64(8,frame->device);call(wire::opcodes::publish,publication.bytes);
          }
          call(wire::opcodes::pollEvents);
          clock=(sr.u32(wire::headerBytes+wire::stateFields::flags)&128u)!=0;
        }
        std::unique_lock lock(wakeMutex);changed.wait_for(lock,std::chrono::milliseconds(clock?16:40));
      }
      active.reset();next.reset();provider.close();
    }catch(const std::exception& error){notifyError(error.what());}
  }
  void appLoop(){
    appThread=GetCurrentThreadId();
    try{
      while(!stopping&&!connected)std::this_thread::sleep_for(std::chrono::milliseconds(2));if(stopping)return;
      auto runtime=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).build());
      auto& rt=*runtime;
      auto native=jsi::Object(rt);
      native.setProperty(rt,"enqueue",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"enqueue"),2,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
        if(count!=2)throw jsi::JSError(r,"V2 enqueue arguments");auto buffer=args[1].getObject(r).getArrayBuffer(r);const auto length=buffer.size(r);
        std::lock_guard lock(jobsMutex);if(stopping||jobs.size()>=32||jobBytes+length>4*wire::limits::packetBytes)throw jsi::JSError(r,"V2 native mailbox full/closed");
        jobs.push_back({uint32_t(args[0].asNumber()),std::vector<uint8_t>(buffer.data(r),buffer.data(r)+length)});jobBytes+=length;
        if(length>=wire::headerBytes && Reader{buffer.data(r),length}.u16(12)==wire::opcodes::openView)metricsPending=true;
        changed.notify_all();return jsi::Value::undefined();}));
      native.setProperty(rt,"asset",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"asset"),1,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t)->jsi::Value{
        if(args[0].asString(r).utf8(r)!="image")throw jsi::JSError(r,"Unknown native asset");auto bytes=readFile(directory+"/assets/image.webp");auto array=r.global().getPropertyAsFunction(r,"ArrayBuffer").callAsConstructor(r,double(bytes.size())).getObject(r);auto buffer=array.getArrayBuffer(r);std::memcpy(buffer.data(r),bytes.data(),bytes.size());return array;}));
      native.setProperty(rt,"notify",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"notify"),1,[this](jsi::Runtime& r,const jsi::Value&,const jsi::Value* args,size_t)->jsi::Value{
        const auto message=args[0].asString(r).utf8(r);std::cout<<"V2_APP "<<message<<std::endl;if(message.find("app-ready")!=std::string::npos)appReady=true;if(message.find("app-error")!=std::string::npos)notifyError(message);return jsi::Value::undefined();}));
      rt.global().setProperty(rt,"NelyxV2Native",std::move(native));
      const auto bootstrap=std::string("globalThis.__v2Timers=[];globalThis.setTimeout=(f,m=0)=>{const t={f,at:Date.now()+m};__v2Timers.push(t);return t;};globalThis.clearTimeout=t=>{if(t)t.f=null;};globalThis.__v2Pump=()=>{const n=Date.now();const q=__v2Timers.splice(0);for(const t of q){if(t.f&&t.at<=n)t.f();else if(t.f)__v2Timers.push(t);}};");
      rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(bootstrap),"v2-timers.js");
      const auto source=readFile(directory+"/web/app-native.js");rt.evaluateJavaScript(std::make_shared<jsi::StringBuffer>(std::string(source.begin(),source.end())),"app-native.js");rt.drainMicrotasks();
      while(!stopping){
        if(const auto delay=appDelay.exchange(0)){rt.global().getPropertyAsFunction(rt,"__v2Delay").call(rt,double(delay));rt.drainMicrotasks();}
        Job result{};bool has=false;
        {std::lock_guard lock(doneMutex);if(!done.empty()){result=std::move(done.front());done.pop_front();has=true;}}
        if(has){auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(result.bytes.size())).getObject(rt);auto buffer=array.getArrayBuffer(rt);std::memcpy(buffer.data(rt),result.bytes.data(),result.bytes.size());rt.global().getPropertyAsFunction(rt,"__v2Resolve").call(rt,double(result.id),std::move(array));rt.drainMicrotasks();}
        rt.global().getPropertyAsFunction(rt,"__v2Pump").call(rt);rt.drainMicrotasks();
        std::unique_lock lock(wakeMutex);appChanged.wait_for(lock,std::chrono::milliseconds(2));
      }
    }catch(const std::exception& error){notifyError(error.what());}
  }
 public:
  explicit Host(std::string directory):directory(std::move(directory)){}
  void bind(HWND value){window=value;contentOwner=std::thread([this]{contentLoop();});renderOwner=std::thread([this]{renderLoop();});appOwner=std::thread([this]{appLoop();});}
  void metrics(){if(!window)return;RECT r{};GetClientRect(window,&r);std::lock_guard lock(metricsMutex);scale=GetDpiForWindow(window)/96.0;width=(r.right-r.left)/scale;height=(r.bottom-r.top)/scale;visible=!IsIconic(window);metricsPending=true;changed.notify_all();}
  void focus(bool value){{std::lock_guard lock(metricsMutex);focused=value;}metricsPending=true;changed.notify_all();}
  void wheel(double delta,double x,double y){
    if(!appReady||stopping)return;auto result=call(wire::opcodes::inspect);auto r=reader(result);if(r.u16(14))return;
    Writer input(wire::inputBytes);input.u64(0,++inputSequence);input.u64(8,r.u64(wire::headerBytes+wire::stateFields::metrics));input.u32(24,1);input.u32(28,wire::phases::update);input.u32(32,wire::sources::osResolved);input.f64(40,now());input.f64(56,x);input.f64(64,y);input.f64(80,delta);input.u32(96,1);call(wire::opcodes::input,input.bytes);changed.notify_all();
  }
  void poll(){
    DWORD available=0;const auto pipe=GetStdHandle(STD_INPUT_HANDLE);
    if(PeekNamedPipe(pipe,nullptr,0,nullptr,&available,nullptr)&&available){char data[1024];DWORD read=0;ReadFile(pipe,data,std::min<DWORD>(available,sizeof(data)),&read,nullptr);control.append(data,read);if(control.size()>4096)control.clear();}
    for(size_t end;(end=control.find('\n'))!=std::string::npos;){auto line=control.substr(0,end);control.erase(0,end+1);std::istringstream in(line);std::string command;in>>command;int value=0;in>>value;
      if(command=="close")PostMessageW(window,WM_CLOSE,0,0);
      else if(command=="delay-app")appDelay=uint32_t(std::clamp(value,0,2000));
      else if(command=="delay-content")contentDelay=uint32_t(std::clamp(value,0,2000));
      else if(command=="wheel")wheel(value,260,300);
      else if(command=="stats")stats();
    }
  }
  void stats(){auto bytes=call(wire::opcodes::inspect);auto r=reader(bytes);const auto b=wire::headerBytes;
    std::cout<<"V2_STATS {\"appReady\":"<<(appReady?"true":"false")<<",\"uiThread\":"<<uiThread<<",\"appThread\":"<<appThread<<",\"contentThread\":"<<contentThread<<",\"renderThread\":"<<renderThread<<",\"frames\":"<<rendered<<",\"paragraphs\":"<<paragraphs<<",\"images\":"<<images<<",\"pictures\":"<<pictures<<",\"consumed\":"<<r.u64(b+wire::stateFields::consumed)<<",\"received\":"<<r.u64(b+wire::stateFields::received)<<",\"queued\":"<<r.u32(b+wire::stateFields::queued)<<",\"nativeCommands\":"<<r.u64(b+wire::stateFields::transactionWork)<<",\"fallbacks\":0,\"surfaceCommit\":null}"<<std::endl;
  }
  bool hasFailed()const{return failed;}
  void close(){if(closed.exchange(true))return;stopping=true;changed.notify_all();appChanged.notify_all();if(appOwner.joinable())appOwner.join();if(contentOwner.joinable())contentOwner.join();if(renderOwner.joinable())renderOwner.join();auto result=call(wire::opcodes::closeSession,{},true);auto r=reader(result);std::cout<<"V2_CLOSED {\"status\":"<<r.u16(14)<<",\"reservedBytes\":"<<r.u64(wire::headerBytes+wire::stateFields::reservedBytes)<<",\"workersJoined\":true}"<<std::endl;}
  ~Host(){close();}
};
static LRESULT CALLBACK procedure(HWND window,UINT message,WPARAM w,LPARAM l){
  auto* host=reinterpret_cast<Host*>(GetWindowLongPtrW(window,GWLP_USERDATA));
  if(message==WM_NCCREATE){host=static_cast<Host*>(reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);SetWindowLongPtrW(window,GWLP_USERDATA,LONG_PTR(host));}
  if(host)switch(message){case WM_SIZE:host->metrics();return 0;case WM_SETFOCUS:host->focus(true);return 0;case WM_KILLFOCUS:host->focus(false);return 0;
    case WM_MOUSEWHEEL:{POINT p{GET_X_LPARAM(l),GET_Y_LPARAM(l)};ScreenToClient(window,&p);double scale=GetDpiForWindow(window)/96.0;host->wheel(-GET_WHEEL_DELTA_WPARAM(w)/120.0*48,p.x/scale,p.y/scale);return 0;}
    case WM_ERASEBKGND:return 1;case WM_TIMER:host->poll();return 0;case WM_CLOSE:host->close();DestroyWindow(window);return 0;case WM_DESTROY:PostQuitMessage(0);return 0;}
  return DefWindowProcW(window,message,w,l);
}
int main(int argc,char**argv){
  try{
    if(argc!=2)throw std::runtime_error("Usage: NelyxEngineV2Host <current engine dist>");SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    Host host(argv[1]);const auto instance=GetModuleHandleW(nullptr);WNDCLASSW klass{};klass.hInstance=instance;klass.lpszClassName=L"NelyxEngineV2Host";klass.lpfnWndProc=procedure;klass.hCursor=LoadCursorW(nullptr,IDC_ARROW);RegisterClassW(&klass);
    const auto dpi=GetDpiForSystem();RECT bounds{0,0,LONG(960*dpi/96),LONG(720*dpi/96)};AdjustWindowRectExForDpi(&bounds,WS_OVERLAPPEDWINDOW,FALSE,0,dpi);
    const auto window=CreateWindowExW(0,klass.lpszClassName,L"Nelyx Engine v2 — Native Skia",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,bounds.right-bounds.left,bounds.bottom-bounds.top,nullptr,nullptr,instance,&host);
    if(!window)throw std::runtime_error("Native HWND creation failed");host.bind(window);host.metrics();SetTimer(window,1,50,nullptr);ShowWindow(window,SW_SHOW);UpdateWindow(window);
    MSG message;while(GetMessageW(&message,nullptr,0,0)>0){TranslateMessage(&message);DispatchMessageW(&message);}return host.hasFailed()?1:0;
  }catch(const std::exception& error){std::cerr<<"V2_HOST_ERROR "<<error.what()<<std::endl;return 1;}
}
