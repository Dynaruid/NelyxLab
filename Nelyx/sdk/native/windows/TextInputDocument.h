// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace Nelyx::WindowsInput {
// Native shadow state for TSF. Core supplies all display geometry; this class
// contains no control, font, paragraph, caret painting or editing history.
struct Selection {
  int32_t anchor=0,focus=0;
  bool operator==(Selection const&)const=default;
};
struct Composition {
  int32_t start=-1,end=-1;
  bool active()const{return start>=0;}
  bool operator==(Composition const&)const=default;
};
struct DocumentValue {
  std::wstring text;
  Selection selection;
  Composition composing;
  uint64_t revision=0;
  bool focused=false;
};
struct Owner {
  std::string id;
  uint64_t generation=0;
  bool operator==(Owner const&)const=default;
};
struct Rect {
  double x=0,y=0,width=0,height=0;
  bool operator==(Rect const&)const=default;
};
struct CoreGeometry {
  Owner owner;
  uint64_t viewport=0,epoch=0;
  Rect bounds,clip,caret;
  double baselineX=0,baselineY=0;
  uint64_t surface=0;
  bool operator==(CoreGeometry const&)const=default;
};
enum class ReplaceResult {applied,stale,busy,composing};
class TextPositionError final : public std::invalid_argument {
public:
  TextPositionError():std::invalid_argument("Invalid UTF-16 input range"){}
};

class TextInputDocument final {
public:
  /** Input and nonvisual accessibility consume the same committed Core frame. */
  static void validateGeometry(CoreGeometry const& geometry){validate(geometry);}
  static constexpr uint64_t maximumCounter=9007199254740991ULL;
  class NativeEdit {
  public:
    NativeEdit(NativeEdit const&)=delete;
    NativeEdit& operator=(NativeEdit const&)=delete;
    NativeEdit(NativeEdit&& other)noexcept:document_(std::exchange(other.document_,nullptr)),token_(other.token_),value_(std::move(other.value_)){}
    ~NativeEdit(){if(document_)document_->abandon(token_);}
    DocumentValue& value(){return value_;}
    DocumentValue const& value()const{return value_;}
    // A TSF write lock may update text and selection in separate calls. Only
    // its final, validated UTF-16 state becomes visible to Core.
    bool commit(){auto document=document_;if(!document)throw std::logic_error("Native edit already retired");document_=nullptr;return document->commit(token_,std::move(value_));}
  private:
    friend class TextInputDocument;
    NativeEdit(TextInputDocument& document,uint64_t token):document_(&document),token_(token),value_(document.value_){}
    TextInputDocument* document_;
    uint64_t token_;
    DocumentValue value_;
  };

  TextInputDocument(Owner owner,std::wstring text,Selection selection,size_t maximumUnits)
      :owner_(std::move(owner)),maximumUnits_(maximumUnits),thread_(std::this_thread::get_id()) {
    static_assert(sizeof(wchar_t)==2,"Windows input uses UTF-16 WCHARs");
    counter(owner_.generation,false);
    if(owner_.id.empty()||maximumUnits_>static_cast<size_t>(std::numeric_limits<int32_t>::max()))throw std::invalid_argument("Invalid input owner/document budget");
    value_.text=std::move(text);value_.selection=selection;validate(value_);coreText_=value_.text;coreSelection_=selection;
  }
  TextInputDocument(TextInputDocument const&)=delete;
  TextInputDocument& operator=(TextInputDocument const&)=delete;
  DocumentValue const& read()const{live();return value_;}
  bool editing()const{live();return activeToken_!=0;}
  void validateReplacement(std::wstring const& text,Selection selection)const{live();validateContent(text,selection);}
  NativeEdit beginNativeEdit(){live();if(activeToken_)throw std::logic_error("Nested native document write");counter(++nextToken_,false);activeToken_=nextToken_;return NativeEdit(*this,activeToken_);}
  ReplaceResult replace(std::wstring text,Selection selection,uint64_t expected){
    live();counter(expected,true);DocumentValue next{std::move(text),selection,{},value_.revision,value_.focused};validate(next);
    if(expected!=value_.revision)return ReplaceResult::stale;
    if(activeToken_)return ReplaceResult::busy;
    if(value_.composing.active())return ReplaceResult::composing;
    advance();next.revision=value_.revision;value_=std::move(next);invalidate();return ReplaceResult::applied;
  }
  ReplaceResult replaceSelection(Selection selection,uint64_t expected){
    live();counter(expected,true);DocumentValue next=value_;next.selection=selection;validate(next);
    if(expected!=value_.revision)return ReplaceResult::stale;if(activeToken_)return ReplaceResult::busy;
    advance();next.revision=value_.revision;value_=std::move(next);invalidate();return ReplaceResult::applied;
  }
  void updateCoreDocument(std::wstring text,Selection selection){live();DocumentValue document{std::move(text),selection};validate(document);if(document.text!=coreText_||selection!=coreSelection_)invalidate();coreText_=std::move(document.text);coreSelection_=selection;}
  // Geometry carries the Core document and the native revision to which the
  // publisher matched it. A later native edit cannot silently reuse it.
  bool updateGeometry(CoreGeometry geometry,std::wstring text,Selection selection,uint64_t nativeRevision){
    live();validate(geometry);DocumentValue document{std::move(text),selection};validate(document);counter(nativeRevision,true);
    if(geometry.owner!=owner_)throw std::invalid_argument("Foreign Core input geometry");
    if(nativeRevision!=value_.revision||document.text!=value_.text||document.text!=coreText_||selection!=value_.selection||selection!=coreSelection_)return false;
    if(geometry.epoch<lastEpoch_||(lastGeometry_&&geometry.viewport<lastGeometry_->viewport))return false;
    if(geometry.epoch==lastEpoch_&&lastGeometry_&&(geometry!=*lastGeometry_||document.text!=lastGeometryText_||selection!=lastGeometrySelection_))return false;
    // A character-range reply republishes the same committed Core frame.
    // Keep its existing caret/character cache until a genuinely new frame or
    // document arrives. Clearing it here exposes a transient NOLAYOUT to
    // OnLayoutChange and makes TSF request that same range indefinitely.
    if(!activeToken_&&geometry_&&*geometry_==geometry&&geometryRevision_==nativeRevision&&geometryText_==document.text&&geometrySelection_==selection)return true;
    lastEpoch_=geometry.epoch;lastGeometry_=geometry;lastGeometryText_=document.text;lastGeometrySelection_=selection;geometry_=std::move(geometry);geometryText_=std::move(document.text);geometrySelection_=selection;geometryRevision_=nativeRevision;characters_.reset();caret_.reset();return true;
  }
  void withdrawGeometry(){live();invalidate();}
  CoreGeometry const* geometry()const{
    live();if(!geometry_||activeToken_||geometryRevision_!=value_.revision||geometryText_!=value_.text||geometryText_!=coreText_||geometrySelection_!=value_.selection||geometrySelection_!=coreSelection_)return nullptr;return &*geometry_;
  }
  bool updateCharacterBounds(uint64_t viewport,uint64_t epoch,uint64_t nativeRevision,int32_t start,int32_t end,std::vector<Rect> rects){
    live();counter(viewport,false);counter(epoch,false);counter(nativeRevision,true);if(start<0||end<start)throw std::invalid_argument("Invalid character range");for(auto const& rect:rects)validate(rect);if(rects.size()!=static_cast<size_t>(end-start))throw std::invalid_argument("UTF-16 character bounds count mismatch");
    const auto current=geometry();if(!current||current->viewport!=viewport||current->epoch!=epoch||nativeRevision!=value_.revision)return false;
    range(start,end,value_.text,false);
    characters_=Characters{start,end,std::move(rects)};return true;
  }
  bool updateCaretBounds(uint64_t viewport,uint64_t epoch,uint64_t nativeRevision,int32_t offset,Rect rect){
    live();validate(rect);counter(viewport,false);counter(epoch,false);counter(nativeRevision,true);const auto current=geometry();if(!current||current->viewport!=viewport||current->epoch!=epoch||nativeRevision!=value_.revision)return false;
    range(offset,offset,value_.text);caret_=Caret{offset,rect};return true;
  }
  std::optional<Rect> textBounds(int32_t start,int32_t end)const{
    live();range(start,end,value_.text,false);const auto current=geometry();if(!current)return std::nullopt;
    if(start==end&&start==value_.selection.focus)return current->caret;
    if(start==end&&caret_&&caret_->offset==start)return caret_->rect;
    if(!characters_||start<characters_->start||end>characters_->end||start==end)return std::nullopt;
    const auto& first=characters_->rects[static_cast<size_t>(start-characters_->start)];double left=first.x,top=first.y,right=first.x+first.width,bottom=first.y+first.height;
    for(int32_t index=start+1;index<end;index++){const auto& rect=characters_->rects[static_cast<size_t>(index-characters_->start)];left=std::min(left,rect.x);top=std::min(top,rect.y);right=std::max(right,rect.x+rect.width);bottom=std::max(bottom,rect.y+rect.height);}
    return Rect{left,top,right-left,bottom-top};
  }
  void close(){ui();if(closed_)return;closed_=true;activeToken_=0;value_=DocumentValue{};coreText_.clear();coreSelection_={};invalidate();lastGeometry_.reset();lastGeometryText_.clear();}
  static bool utf16(std::wstring const& text){
    for(size_t index=0;index<text.size();index++){const auto unit=static_cast<uint16_t>(text[index]);if(unit>=0xd800&&unit<=0xdbff){if(++index>=text.size())return false;const auto low=static_cast<uint16_t>(text[index]);if(low<0xdc00||low>0xdfff)return false;}else if(unit>=0xdc00&&unit<=0xdfff)return false;}return true;
  }
  static bool boundary(std::wstring const& text,int32_t offset){return offset>=0&&static_cast<size_t>(offset)<=text.size()&&(offset==0||static_cast<size_t>(offset)==text.size()||!(text[static_cast<size_t>(offset)-1]>=0xd800&&text[static_cast<size_t>(offset)-1]<=0xdbff&&text[static_cast<size_t>(offset)]>=0xdc00&&text[static_cast<size_t>(offset)]<=0xdfff));}
  static void range(int32_t start,int32_t end,std::wstring const& text,bool boundaries=true){if(start<0||end<start||static_cast<size_t>(end)>text.size()||(boundaries&&(!boundary(text,start)||!boundary(text,end))))throw TextPositionError();}
private:
  struct Characters {int32_t start,end;std::vector<Rect> rects;};
  struct Caret {int32_t offset;Rect rect;};
  void ui()const{if(std::this_thread::get_id()!=thread_)throw std::logic_error("Windows input requires its owning UI thread");}
  void live()const{ui();if(closed_)throw std::logic_error("Windows input document retired");}
  static void counter(uint64_t value,bool zero){if(value>maximumCounter||(!zero&&!value))throw std::invalid_argument("Invalid input counter");}
  static void validate(Rect const& rect){if(!std::isfinite(rect.x)||!std::isfinite(rect.y)||!std::isfinite(rect.width)||!std::isfinite(rect.height)||rect.width<0||rect.height<0||!std::isfinite(rect.x+rect.width)||!std::isfinite(rect.y+rect.height))throw std::invalid_argument("Invalid Core input rectangle");}
  static void validate(CoreGeometry const& geometry){counter(geometry.owner.generation,false);counter(geometry.viewport,false);counter(geometry.epoch,false);counter(geometry.surface,true);if(geometry.owner.id.empty()||!std::isfinite(geometry.baselineX)||!std::isfinite(geometry.baselineY))throw std::invalid_argument("Invalid Core input geometry");validate(geometry.bounds);validate(geometry.clip);validate(geometry.caret);}
  void validateContent(std::wstring const& text,Selection selection)const{if(text.size()>maximumUnits_||!utf16(text))throw std::invalid_argument("Invalid UTF-16 input document");if(!boundary(text,selection.anchor)||!boundary(text,selection.focus))throw TextPositionError();}
  void validate(DocumentValue const& value)const{
    validateContent(value.text,value.selection);
    if(value.composing.start==-1&&value.composing.end==-1)return;
    range(value.composing.start,value.composing.end,value.text);
  }
  void advance(){counter(value_.revision+1,false);value_.revision++;}
  bool commit(uint64_t token,DocumentValue next){
    live();if(activeToken_!=token)throw std::logic_error("Native input transaction retired");
    try{validate(next);}catch(...){activeToken_=0;throw;}
    activeToken_=0;const bool changed=next.text!=value_.text||next.selection!=value_.selection||next.composing!=value_.composing||next.focused!=value_.focused;
    if(changed){advance();next.revision=value_.revision;value_=std::move(next);invalidate();}return changed;
  }
  void abandon(uint64_t token)noexcept{if(activeToken_==token)activeToken_=0;}
  void invalidate(){geometry_.reset();geometryText_.clear();characters_.reset();caret_.reset();}
  Owner owner_;
  size_t maximumUnits_;
  std::thread::id thread_;
  DocumentValue value_;
  std::wstring coreText_,geometryText_,lastGeometryText_;
  Selection coreSelection_,geometrySelection_,lastGeometrySelection_;
  uint64_t nextToken_=0,activeToken_=0,lastEpoch_=0,geometryRevision_=0;
  std::optional<CoreGeometry> geometry_,lastGeometry_;
  std::optional<Characters> characters_;
  std::optional<Caret> caret_;
  bool closed_=false;
};

} // namespace Nelyx::WindowsInput
