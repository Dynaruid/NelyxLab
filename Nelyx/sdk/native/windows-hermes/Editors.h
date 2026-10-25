// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "Packets.h"
#include "../windows/TextInputStore.h"
#include "../windows/TextInputContext.h"
namespace Nelyx::NativeHermes {
namespace WI=WindowsInput;
struct EditorCommand{
  std::string kind,id;uint64_t generation=0,revision=0,request=0,operation=0,focusEpoch=0;std::wstring text;WI::Selection selection;size_t maximum=65536;
  bool enabled=true,readOnly=false,multiline=false,cancel=false;std::optional<WI::CoreGeometry> geometry;
  InputScope scope=IS_DEFAULT;
  std::vector<WI::Rect> rects;int start=0,end=0;std::optional<WI::Rect> caret;std::optional<int> hit;
};
inline EditorCommand readEditorCommand(std::string kind,Packet const& p){
  EditorCommand c;c.kind=std::move(kind);c.id=p.field("id").string(1024);c.generation=p.field("generation").counter(false);c.operation=p.field("operation").counter(false);
  if(c.kind=="attach"||c.kind=="replace"||c.kind=="geometry"){c.text=p.field("text").text(65536);c.selection={p.field("anchor").offset(),p.field("focus").offset()};}
  if(c.kind=="attach"){c.maximum=p.field("maximum").counter(false);if(c.maximum>65536)p.fail();}
  if(c.kind=="attach"||c.kind=="configure"){c.enabled=p.field("enabled").boolean();c.readOnly=p.field("readOnly").boolean();c.multiline=p.field("multiline").boolean();const auto raw=p.field("scope").counter();if(raw>INT_MAX)p.fail();c.scope=InputScope(int(raw));switch(c.scope){case IS_DEFAULT:case IS_TEXT:case IS_PRIVATE:case IS_NUMBER:case IS_DIGITS:case IS_PASSWORD:case IS_TELEPHONE_FULLTELEPHONENUMBER:case IS_EMAIL_SMTPEMAILADDRESS:case IS_URL:break;default:p.fail();}if(c.multiline&&c.scope==IS_PASSWORD)p.fail();}
  if(c.kind=="replace"){c.revision=p.field("revision").counter();c.request=p.field("request").counter(false);c.cancel=p.field("cancel").boolean();}
  if(c.kind=="geometry"){c.revision=p.field("revision").counter();auto g=p.field("geometry");if(!g.absent())c.geometry=readGeometry(g);auto chars=p.field("characters");if(!chars.absent()){c.start=chars.field("rangeStart").offset();for(auto const& rect:chars.field("rects").array(4096))c.rects.push_back(readRect(rect));c.end=c.start+int(c.rects.size());}}
  if(c.kind=="caret"){c.revision=p.field("revision").counter();auto bounds=p.field("bounds");c.start=bounds.field("rangeStart").offset();c.request=bounds.field("layoutEpoch").counter(false);c.caret=readRect(bounds.field("rect"));}
  if(c.kind=="hit"){c.revision=p.field("revision").counter();c.request=p.field("request").counter(false);auto position=p.field("position");if(position.field("status").string()=="hit")c.hit=position.field("position").offset();}
  if(c.kind=="keyboardText"){c.text=p.field("text").text(65536);c.revision=p.field("revision").counter();c.focusEpoch=p.field("focusEpoch").counter(false);}
  if(c.kind!="attach"&&c.kind!="configure"&&c.kind!="replace"&&c.kind!="detach"&&c.kind!="focus"&&c.kind!="blur"&&c.kind!="geometry"&&c.kind!="caret"&&c.kind!="hit"&&c.kind!="keyboardText")p.fail();
  return c;
}
class Editors final:public std::enable_shared_from_this<Editors>{
public:
  struct Token{std::string id;uint64_t generation=0;};
  struct Event{std::string kind,id;uint64_t generation=0;WI::TextStoreEvent editing;int start=0,end=0;uint64_t epoch=0,revision=0,request=0;POINT point{};DWORD flags=0;};
  using Emit=std::function<void(Event)>;
  Editors(HWND window,std::function<void(std::function<void()>)> post,Emit emit):window(window),post(std::move(post)),emit(std::move(emit)),thread(WI::TextInputThread::create()){}
  bool filter(MSG const& message){return thread->filterKeyMessage(message);}
  void execute(EditorCommand c){
    if(closed)return;auto found=entries.find(c.id);
    if(c.kind=="attach"){
      if(found!=entries.end()){if(found->second->generation==c.generation)throw std::runtime_error("Duplicate editor owner");retire(found);}
      if(entries.size()>=256)throw std::runtime_error("Native editor count exceeds256");auto entry=std::make_shared<Entry>();entry->id=c.id;entry->generation=c.generation;auto weak=weak_from_this();std::weak_ptr<Entry> token=entry;
      WI::TextStoreCallbacks callbacks;
      callbacks.active=[weak,token]{auto self=weak.lock();auto e=token.lock();return self&&!self->closed&&e&&e->active;};
      callbacks.post=post;callbacks.changed=[weak,token](auto const& editing){if(auto self=weak.lock())if(auto e=token.lock();e&&e->active)self->emit(Event{"editing",e->id,e->generation,editing});};
      callbacks.failed=[weak,token](std::string const& failure){if(auto self=weak.lock()){auto e=token.lock();if(e&&e->active)self->post([failure]{throw std::runtime_error("Native editor: "+failure);});}};
      callbacks.screenRect=[weak](WI::Rect const& rect,WI::CoreGeometry const& geometry)->std::optional<WI::ScreenRect>{auto self=weak.lock();if(!self||self->closed||geometry.viewport!=self->viewport||geometry.surface!=self->surface)return {};POINT origin{};if(!ClientToScreen(self->window,&origin))return {};auto scale=GetDpiForWindow(self->window)/96.;return WI::ScreenRect{RECT{LONG(std::floor(origin.x+rect.x*scale)),LONG(std::floor(origin.y+rect.y*scale)),LONG(std::ceil(origin.x+(rect.x+rect.width)*scale)),LONG(std::ceil(origin.y+(rect.y+rect.height)*scale))}};};
      callbacks.characterBounds=[weak,token](int start,int end,uint64_t epoch,uint64_t revision){if(auto self=weak.lock())if(auto e=token.lock();e&&e->active){Event event{"characters",e->id,e->generation};event.start=start;event.end=end;event.epoch=epoch;event.revision=revision;self->emit(std::move(event));}};
      callbacks.hitPosition=[weak,token](POINT point,DWORD flags,uint64_t epoch,uint64_t revision){if(auto self=weak.lock())if(auto e=token.lock();e&&e->active){e->hitPoint=point;e->hitFlags=flags;e->hitEpoch=epoch;Event event{"hit",e->id,e->generation};event.point=point;event.flags=flags;event.epoch=epoch;event.revision=revision;event.request=++e->hitSequence;self->emit(std::move(event));}};
      callbacks.terminateComposition=[token](ITfCompositionView* composition){auto e=token.lock();return e&&e->active&&e->context?e->context->terminateComposition(composition):E_UNEXPECTED;};
      entry->store=Microsoft::WRL::Make<WI::TextInputStore>(window,WI::Owner{"native-hermes:root",1},c.text,c.selection,c.maximum,c.scope,std::move(callbacks));
      entry->context=thread->attach(window,entry->store.Get());entry->store->configuration(c.enabled,c.readOnly,c.multiline,c.scope);entries.emplace(c.id,entry);emit(Event{"editing",entry->id,entry->generation,WI::TextStoreEvent{entry->store->read(),false,{},{}}});return;
    }
    if(found==entries.end()||found->second->generation!=c.generation)return;auto e=found->second;
    if(c.kind=="detach"){retire(found);return;}
    if(c.kind=="configure")e->store->configuration(c.enabled,c.readOnly,c.multiline,c.scope);
    else if(c.kind=="replace"){e->store->replace(c.text,c.selection,c.revision,c.request,c.cancel);if(c.cancel&&e->store->cancellationPending(c.request)){if(e->timer)KillTimer(window,e->timer);e->cancellation=c.request;e->timer=SetTimer(window,++nextTimer,1000,nullptr);if(!e->timer)throw std::runtime_error("Native composition timer unavailable");}}
    else if(c.kind=="focus"){if(!focused.empty()&&focused!=c.id){auto old=entries.find(focused);if(old!=entries.end()){old->second->context->withdrawFocus();old->second->store->focus(false);}}focused=c.id;::SetFocus(window);e->context->associateFocus();e->store->focus(e->context->hasFocus());}
    else if(c.kind=="blur"){e->context->withdrawFocus();e->store->focus(false);if(focused==c.id)focused.clear();}
    else if(c.kind=="geometry"){e->store->coreDocument(c.text,c.selection);if(!c.geometry||c.geometry->viewport!=viewport||c.geometry->surface!=surface)e->store->withdrawGeometry();else if(e->store->coreGeometry(*c.geometry,c.text,c.selection,c.revision)&&!c.rects.empty())e->store->characterBounds(c.geometry->viewport,c.geometry->epoch,c.revision,c.start,c.end,std::move(c.rects));}
    else if(c.kind=="caret"){auto geometry=e->store->geometry();if(geometry&&geometry->epoch==c.request)e->store->caretBounds(geometry->viewport,geometry->epoch,c.revision,c.start,*c.caret);}
    else if(c.kind=="hit"&&e->hitSequence==c.request)e->store->hitPosition(e->hitPoint,e->hitFlags,c.hit,e->hitEpoch,c.revision);
  }
  Token focusToken()const{auto found=entries.find(focused);return found==entries.end()?Token{}:Token{focused,found->second->generation};}
  std::pair<std::string,uint64_t> keyboardText(EditorCommand const& c,uint64_t focusEpoch){auto found=entries.find(c.id);if(found==entries.end()||found->second->generation!=c.generation)return {"unavailable",0};auto e=found->second;if(c.id!=focused||!focusEpoch||c.focusEpoch!=focusEpoch)return {"unavailable",e->store->read().revision};auto result=e->store->keyboardText(c.text,c.revision);const char* status="unavailable";switch(result){case WI::KeyboardTextResult::applied:status="applied";break;case WI::KeyboardTextResult::stale:status="stale";break;case WI::KeyboardTextResult::busy:status="busy";break;case WI::KeyboardTextResult::limit:status="limit";break;default:break;}return {status,e->store->read().revision};}
  void focusLost(){auto found=entries.find(focused);if(found!=entries.end())found->second->store->focus(false);}
  void timer(UINT_PTR id){for(auto const& [key,e]:entries)if(e->timer==id){KillTimer(window,id);e->timer=0;e->store->cancellationExpired(e->cancellation);return;}}
  void metrics(uint64_t value,uint64_t backing){viewport=value;surface=backing;for(auto& [id,e]:entries){e->store->withdrawGeometry();e->store->screenCoordinatesChanged();}}
  void moved(){for(auto& [id,e]:entries)e->store->screenCoordinatesChanged();}
  void close(){if(closed)return;while(!entries.empty())retire(entries.begin());thread->close();closed=true;emit={};}
private:
  struct Entry{std::string id;uint64_t generation=0,cancellation=0,hitSequence=0,hitEpoch=0;UINT_PTR timer=0;POINT hitPoint{};DWORD hitFlags=0;bool active=true;ComPtr<WI::TextInputStore> store;std::unique_ptr<WI::TextInputContext> context;};
  void retire(std::map<std::string,std::shared_ptr<Entry>>::iterator found){auto e=found->second;e->active=false;if(e->timer)KillTimer(window,e->timer);if(e->context)e->context->close();e->context.reset();if(e->store)e->store->close();e->store.Reset();if(focused==e->id)focused.clear();entries.erase(found);}
  HWND window;std::function<void(std::function<void()>)> post;Emit emit;std::shared_ptr<WI::TextInputThread> thread;std::map<std::string,std::shared_ptr<Entry>> entries;std::string focused;uint64_t viewport=0,surface=0;UINT_PTR nextTimer=100;bool closed=false;
};
}
