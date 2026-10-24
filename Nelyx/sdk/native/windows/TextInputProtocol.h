// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "TextInputSession.h"
#include <JSValue.h>
#include <string_view>

namespace Nelyx::WindowsInput {
namespace InputWire {
namespace RN=winrt::Microsoft::ReactNative;
inline RN::JSValue const& field(RN::JSValue const& value,char const* name){if(!value.TryGetObject())throw std::invalid_argument("Input object required");const auto found=value.AsObject().find(name);if(found==value.AsObject().end())throw std::invalid_argument("Missing input packet field");return found->second;}
inline std::string string(RN::JSValue const& value){if(!value.TryGetString())throw std::invalid_argument("Input string required");return value.AsString();}
inline bool boolean(RN::JSValue const& value){if(!value.TryGetBoolean())throw std::invalid_argument("Input boolean required");return value.AsBoolean();}
inline double number(RN::JSValue const& value){if(!value.TryGetInt64()&&!value.TryGetDouble())throw std::invalid_argument("Input number required");const auto result=value.AsDouble();if(!std::isfinite(result))throw std::invalid_argument("Finite input number required");return result;}
inline uint64_t counter(RN::JSValue const& value,bool zero=false,uint64_t maximum=TextInputDocument::maximumCounter){const auto result=number(value);if(result<(zero?0:1)||result>static_cast<double>(maximum)||result!=std::floor(result))throw std::invalid_argument("Invalid input counter");return static_cast<uint64_t>(result);}
inline int32_t offset(RN::JSValue const& value){return static_cast<int32_t>(counter(value,true,static_cast<uint64_t>(std::numeric_limits<int32_t>::max())));}
inline std::wstring text(RN::JSValue const& value){const auto wide=winrt::to_hstring(string(value));return {wide.c_str(),wide.size()};}
inline Owner owner(RN::JSValue const& value){auto id=string(field(value,"id"));if(id.empty())throw std::invalid_argument("Input owner required");return {std::move(id),counter(field(value,"generation"))};}
inline Selection selection(RN::JSValue const& value){return {offset(field(value,"anchor")),offset(field(value,"focus"))};}
inline Rect rect(RN::JSValue const& value){Rect result{number(field(value,"x")),number(field(value,"y")),number(field(value,"width")),number(field(value,"height"))};if(result.width<0||result.height<0||!std::isfinite(result.x+result.width)||!std::isfinite(result.y+result.height))throw std::invalid_argument("Invalid Core input rectangle");return result;}
inline std::vector<Rect> rects(RN::JSValue const& value){if(!value.TryGetArray())throw std::invalid_argument("Input rectangles required");std::vector<Rect> result;result.reserve(value.AsArray().size());for(auto const& box:value.AsArray())result.push_back(rect(box));return result;}
inline void coordinates(RN::JSValue const& value){if(string(field(value,"coordinates"))!="view-logical")throw std::invalid_argument("Core View coordinates required");}
struct Stamp {uint64_t viewport,epoch;};
inline Stamp stamp(RN::JSValue const& value,Owner const& expected){coordinates(value);if(owner(field(value,"owner"))!=expected)throw std::invalid_argument("Foreign Core input owner");return {counter(field(value,"viewportGeneration")),counter(field(value,"layoutEpoch"))};}
inline CoreGeometry geometry(RN::JSValue const& value,Owner const& expected){const auto identity=stamp(value,expected);if(number(field(value,"scale"))<=0)throw std::invalid_argument("Positive Core scale required");auto const& transform=field(value,"transform");if(!transform.TryGetArray()||transform.AsArray().size()!=16)throw std::invalid_argument("Core transform matrix required");for(auto const& entry:transform.AsArray())number(entry);rects(field(value,"selectionRects"));auto const& baseline=field(value,"caretBaseline");const auto surface=value.AsObject().find("nativeSurfaceGeneration");return {expected,identity.viewport,identity.epoch,rect(field(value,"bounds")),rect(field(value,"clip")),rect(field(value,"caret")),number(field(baseline,"x")),number(field(baseline,"y")),surface==value.AsObject().end()?0:counter(surface->second,true)};}
}
struct TextInputProtocolCallbacks {
  std::function<bool()> active;
  std::function<bool()> visible;
  std::function<std::optional<ScreenRect>(Rect const&,CoreGeometry const&)> screenRect;
  std::function<std::optional<ViewPoint>(POINT,DWORD,CoreGeometry const&)> viewPoint;
  std::function<bool()> focusSurface;
  // Semantics can return native focus to the owning canvas after Core blur.
  std::function<bool()> focusCanvas;
  std::function<std::function<void()>(int64_t)> registerFocusProxy;
  std::function<void(std::string_view,InputWire::RN::JSValueObject)> emit;
  // A surface lease belongs to the service, rather than each text client.
  std::function<std::function<void()>(std::function<void(std::string const&)>)> watchRetirement;
};
/** Strict RNW wire endpoint. The caller supplies the real surface mapping;
 * the endpoint never derives coordinates from its proxy's layout or a control.
 * A malformed recognized command retires input and reports one error, rather
 * than allowing RNW to interpret it as an unrelated native editor command. */
class TextInputProtocol final : public std::enable_shared_from_this<TextInputProtocol> {
public:
  static std::shared_ptr<TextInputProtocol> create(std::shared_ptr<TextInputRoot> const& root,InputWire::RN::JSValue const& initial,size_t maximumUnits,InputScope scope,std::chrono::milliseconds timeout,TextInputProtocolCallbacks callbacks){
    using namespace InputWire;if(!callbacks.emit)throw std::invalid_argument("Input event transport required");
    auto self=std::shared_ptr<TextInputProtocol>(new TextInputProtocol(owner(field(initial,"owner")),std::move(callbacks)));const auto weak=std::weak_ptr<TextInputProtocol>(self);TextInputSessionCallbacks session;
    session.active=self->callbacks_.active;session.screenRect=self->callbacks_.screenRect;session.viewPoint=self->callbacks_.viewPoint;session.focusSurface=self->callbacks_.focusSurface;
    session.changed=[weak](TextStoreEvent const& event){if(auto current=weak.lock();current&&!current->stopped_)current->changed(event);};
    session.failed=[weak](std::string const& message){if(auto current=weak.lock())current->fail(message);};
    session.characterBounds=[weak](int32_t start,int32_t end,uint64_t epoch,uint64_t revision){if(auto current=weak.lock();current&&!current->stopped_)current->emit("inputBounds",{{"start",start},{"end",end},{"layoutEpoch",double(epoch)},{"revision",double(revision)}});};
    session.hitPosition=[weak](TextInputHitRequest const& request){if(auto current=weak.lock();current&&!current->stopped_)current->emit("textPosition",{{"request",double(request.request)},{"point",RN::JSValueObject{{"x",request.point.x},{"y",request.point.y}}},{"options",RN::JSValueObject{{"nearest",bool(request.flags&GXFPF_NEAREST)},{"roundNearest",bool(request.flags&GXFPF_ROUND_NEAREST)}}},{"layoutEpoch",double(request.epoch)},{"nativeRevision",double(request.revision)}});};
    self->session_=TextInputSession::create(root,self->owner_,text(field(initial,"text")),selection(initial),maximumUnits,scope,timeout,std::move(session));return self;
  }
  ~TextInputProtocol()noexcept{try{close();}catch(...){std::terminate();}}
  TextInputProtocol(TextInputProtocol const&)=delete;TextInputProtocol& operator=(TextInputProtocol const&)=delete;
  bool stopped()const{ui();return stopped_||!session_||session_->stopped();}
  DocumentValue const& read()const{live();return session_->read();}
  KeyboardTextResult keyboardText(std::wstring const& text,uint64_t revision){live();return session_->keyboardText(text,revision);}
  ITfContext* context()const{live();return session_->context();}
  void configuration(bool enabled,bool readOnly,bool multiline,InputScope scope){live();session_->configuration(enabled,readOnly,multiline,scope);}
  bool command(std::wstring_view name,InputWire::RN::JSValueArray const& args){
    ui();const bool known=name==L"replace"||name==L"replaceComposing"||name==L"geometry"||name==L"caretBounds"||name==L"textPosition"||name==L"focus"||name==L"blur";if(!known)return false;live();auto keep=shared_from_this();
    try{execute(name,args);}catch(winrt::hresult_error const& error){fail(winrt::to_string(error.message()));}catch(std::exception const& error){fail(error.what());}catch(...){fail("Windows input wire command failed");}return true;
  }
  void close(){ui();stopped_=true;frame_.reset();if(session_){session_->close();session_.reset();}callbacks_={};}
  void close(TextInputRoot& registry){ui();stopped_=true;frame_.reset();if(session_){session_->close(registry);session_.reset();}callbacks_={};}
private:
  struct Frame {InputWire::Stamp stamp;uint64_t revision;};
  TextInputProtocol(Owner owner,TextInputProtocolCallbacks callbacks):thread_(GetCurrentThreadId()),owner_(std::move(owner)),callbacks_(std::move(callbacks)){}
  void ui()const{if(GetCurrentThreadId()!=thread_)throw std::logic_error("Input wire requires its UI thread");}
  void live()const{ui();if(stopped_||!session_||session_->stopped())throw std::logic_error("Input wire retired");}
  void emit(std::string_view name,InputWire::RN::JSValueObject payload){if(!stopped_){auto transport=callbacks_.emit;transport(name,std::move(payload));}}
  void changed(TextStoreEvent const& event){using namespace InputWire;if(frame_&&frame_->revision!=event.value.revision)frame_.reset();RN::JSValueObject payload{{"text",winrt::to_string(event.value.text)},{"anchor",event.value.selection.anchor},{"focus",event.value.selection.focus},{"revision",double(event.value.revision)},{"source",event.programmatic?"programmatic":"native"},{"composingStart",event.value.composing.start},{"composingEnd",event.value.composing.end},{"focused",event.value.focused}};if(event.request)payload.emplace("request",double(*event.request));if(!event.rejection.empty())payload.emplace("rejection",event.rejection);emit("editing",std::move(payload));}
  void fail(std::string const& message)noexcept{if(stopped_)return;try{auto transport=callbacks_.emit;stopped_=true;frame_.reset();try{if(session_&&!session_->stopped())session_->close();}catch(...){}if(transport)try{transport("inputError",{{"message",message}});}catch(...){} }catch(...){stopped_=true;}}
  bool current(InputWire::Stamp stamp,uint64_t revision)const{return frame_&&frame_->stamp.viewport==stamp.viewport&&frame_->stamp.epoch==stamp.epoch&&frame_->revision==revision&&session_->read().revision==revision;}
  void execute(std::wstring_view name,InputWire::RN::JSValueArray const& args){
    using namespace InputWire;
    if(name==L"focus"||name==L"blur"){if(!args.empty())throw std::invalid_argument("Input focus command takes no arguments");if(name==L"focus")session_->focus();else session_->blur();return;}
    if(name==L"replace"||name==L"replaceComposing"){if(args.size()!=5)throw std::invalid_argument("Input replacement requires text, anchor, focus, revision, request");session_->replace(text(args[0]),{offset(args[1]),offset(args[2])},counter(args[3],true),counter(args[4]),name==L"replaceComposing");return;}
    if(args.size()!=1)throw std::invalid_argument("Input coordinate command requires one packet");auto const& packet=args[0];const auto revision=counter(field(packet,"nativeRevision"),true);
    if(name==L"geometry"){
      auto const& source=field(packet,"geometry");if(source.IsNull()){if(revision==session_->read().revision){frame_.reset();session_->withdrawGeometry();}return;}
      auto frame=geometry(source,owner_);auto value=text(field(packet,"text"));const auto selected=selection(field(packet,"selection"));auto const& characters=field(packet,"characters");std::vector<Rect> boxes;int32_t start=0,end=0;
      if(!characters.IsNull()){const auto identity=stamp(characters,owner_);if(identity.viewport!=frame.viewport||identity.epoch!=frame.epoch)throw std::invalid_argument("Character bounds differ from their Core frame");start=offset(field(characters,"rangeStart"));boxes=rects(field(characters,"rects"));if(boxes.size()>static_cast<size_t>(std::numeric_limits<int32_t>::max()-start))throw std::invalid_argument("Input character range overflow");end=start+static_cast<int32_t>(boxes.size());}
      if(revision!=session_->read().revision)return;session_->coreDocument(value,selected);if(!session_->geometry(frame,std::move(value),selected,revision))return;if(stopped_||session_->stopped()||session_->read().revision!=revision)return;frame_=Frame{{frame.viewport,frame.epoch},revision};if(!characters.IsNull())session_->characterBounds(frame.viewport,frame.epoch,revision,start,end,std::move(boxes));return;
    }
    if(name==L"caretBounds"){
      auto const& bounds=field(packet,"bounds");const auto identity=stamp(bounds,owner_);const auto start=offset(field(bounds,"rangeStart")),end=offset(field(bounds,"rangeEnd"));if(start!=end)throw std::invalid_argument("Caret reply must have an empty range");const auto box=rect(field(bounds,"rect"));if(current(identity,revision))session_->caretBounds(identity.viewport,identity.epoch,revision,start,box);return;
    }
    auto const& position=field(packet,"position");const auto identity=stamp(position,owner_);const auto request=counter(field(packet,"request"));const auto status=string(field(position,"status"));std::optional<LONG> at;
    if(status=="hit"){at=offset(field(position,"position"));const auto affinity=string(field(position,"affinity"));if(affinity!="upstream"&&affinity!="downstream")throw std::invalid_argument("Invalid Core hit affinity");}else if(status!="miss")throw std::invalid_argument("Invalid Core hit result");if(current(identity,revision))session_->hitPosition(request,at,identity.epoch,revision);
  }
  DWORD const thread_;Owner const owner_;TextInputProtocolCallbacks callbacks_;std::shared_ptr<TextInputSession> session_;std::optional<Frame> frame_;bool stopped_=false;
};
}
