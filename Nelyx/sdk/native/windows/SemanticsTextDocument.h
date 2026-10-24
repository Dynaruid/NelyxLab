// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <windows.h>
#include <objbase.h>
#include <UIAutomation.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <functional>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace Nelyx::WindowsSemantics {
struct TextError {HRESULT result;};
inline void require(bool condition,HRESULT result=E_INVALIDARG){if(!condition)throw TextError{result};}
template<class F> HRESULT boundary(F&& action)noexcept{
  try{action();return S_OK;}catch(TextError const& error){return error.result;}catch(std::bad_alloc const&){return E_OUTOFMEMORY;}catch(...){return E_FAIL;}
}
struct TextSpan {int start=0,end=0;bool retired=false;};
struct ScreenBox {double x=0,y=0,width=0,height=0;};
enum class TextActionKind {SetText,SetSelection,ScrollRange};
struct TextAction {
  TextActionKind kind;uint64_t revision=0;std::wstring text;int anchor=0,focus=0;bool alignToTop=false;uint64_t generation=0;
};
/** Already committed Core state. Unit stops and screen queries must come from
 * the Core paragraph; the UIA provider never shapes text or estimates positions.
 * An absent query result means unavailable; an empty result means offscreen. */
struct TextSnapshot {
  uint64_t revision=0,textRevision=0,generation=0;
  std::wstring text;int anchor=0,focus=0;
  bool enabled=true,readOnly=false,obscured=false,selectionEnabled=true,focused=false;
  std::vector<int> characters,words,lines;
  std::function<std::optional<std::vector<ScreenBox>>(int,int)> rectangles;
  std::function<std::optional<std::vector<TextSpan>>()> visibleRanges;
  std::function<std::optional<int>(double,double)> hit;
  std::function<bool(TextAction const&)> dispatch;
};
struct TextChanges {bool text=false,selection=false,enabled=false,readOnly=false,focused=false;std::optional<std::wstring> previousValue;};

/** One logical Core semantics node, confined to its COM/UI apartment. The RNW
 * peer must use ProviderOptions_UseComThreading without an agile marshaler. */
class TextDocument final {
public:
  static constexpr size_t maximumTextUnits=4096,maximumRanges=4096;
  TextDocument():thread_(std::this_thread::get_id()){}
  std::shared_ptr<TextSnapshot const> read(bool text=true)const{
    checkThread();require(!retired_&&current_,UIA_E_ELEMENTNOTAVAILABLE);
    require(!text||!current_->obscured,E_ACCESSDENIED);return current_;
  }
  bool isCurrent(std::shared_ptr<TextSnapshot const> const& snapshot)const{checkThread();return !retired_&&current_==snapshot;}
  void retire(){checkThread();if(retired_)return;retired_=true;for(auto const& entry:ranges_)if(auto span=entry.second.lock())span->retired=true;current_.reset();ranges_.clear();}
  TextChanges publish(TextSnapshot value){
    checkThread();require(!retired_,UIA_E_ELEMENTNOTAVAILABLE);validate(value);
    const auto previous=current_;if(previous){
      if(value.generation!=previous->generation){retire();throw TextError{static_cast<HRESULT>(UIA_E_ELEMENTNOTAVAILABLE)};}
      require(value.revision>=previous->revision&&value.textRevision>=previous->textRevision);
      require(value.revision!=previous->revision||(value.text==previous->text&&value.anchor==previous->anchor&&value.focus==previous->focus&&value.obscured==previous->obscured&&value.textRevision==previous->textRevision));
    }
    auto next=std::make_shared<TextSnapshot const>(std::move(value));
    if(previous){
      if(previous->obscured!=next->obscured){for(auto const& entry:ranges_)if(auto span=entry.second.lock())span->retired=true;}
      else if(previous->text!=next->text)updateRanges(previous->text,next->text);
    }
    current_=next;
    TextChanges changes{previous&&(previous->text!=next->text||previous->textRevision!=next->textRevision),previous&&(previous->anchor!=next->anchor||previous->focus!=next->focus),!previous||previous->enabled!=next->enabled,!previous||previous->readOnly!=next->readOnly,!previous||previous->focused!=next->focused,{}};
    if(previous&&!previous->obscured&&!next->obscured)changes.previousValue=previous->text;
    return changes;
  }
  std::shared_ptr<TextSpan> addRange(void* identity,int start,int end){
    const auto snapshot=read();validateSpan(*snapshot,start,end);require(identity);
    for(auto entry=ranges_.begin();entry!=ranges_.end();)if(entry->second.expired())entry=ranges_.erase(entry);else ++entry;
    require(ranges_.size()<maximumRanges,UIA_E_INVALIDOPERATION);
    auto span=std::make_shared<TextSpan>(TextSpan{start,end});ranges_[identity]=span;return span;
  }
  std::shared_ptr<TextSpan> peerRange(void* identity)const{
    read();const auto entry=ranges_.find(identity);require(entry!=ranges_.end());const auto result=entry->second.lock();require(result!=nullptr);require(!result->retired,UIA_E_ELEMENTNOTAVAILABLE);return result;
  }
  static bool scalarBoundary(std::wstring const& text,int at){
    return at>=0&&static_cast<size_t>(at)<=text.size()&&!(at>0&&static_cast<size_t>(at)<text.size()&&high(text[static_cast<size_t>(at)-1])&&low(text[static_cast<size_t>(at)]));
  }
  static void validateText(std::wstring const& text){
    require(text.size()<=maximumTextUnits&&text.find(L'\0')==std::wstring::npos);
    for(size_t i=0;i<text.size();++i){if(high(text[i])){require(i+1<text.size()&&low(text[i+1]));++i;}else require(!low(text[i]));}
  }
  static void validateSpan(TextSnapshot const& value,int start,int end){require(start<=end&&scalarBoundary(value.text,start)&&scalarBoundary(value.text,end));}
  static std::vector<int> stops(TextSnapshot const& value,TextUnit unit){
    require(unit>=TextUnit_Character&&unit<=TextUnit_Document);
    if(unit==TextUnit_Character&&!value.characters.empty())return value.characters;
    if(unit<=TextUnit_Word&&!value.words.empty())return value.words;
    if(unit<=TextUnit_Line&&!value.lines.empty())return value.lines;
    return value.text.empty()?std::vector<int>{0}:std::vector<int>{0,static_cast<int>(value.text.size())};
  }
  static std::pair<int,int> enclosing(std::vector<int> const& boundaries,int position){
    if(boundaries.size()==1)return {0,0};
    const auto upper=std::upper_bound(boundaries.begin(),boundaries.end(),position);
    const size_t index=upper==boundaries.end()?boundaries.size()-2:static_cast<size_t>(upper-boundaries.begin()-1);
    return {boundaries[index],boundaries[index+1]};
  }
  static std::pair<int,int> moveEndpoint(std::vector<int> const& boundaries,int position,int count){
    if(!count)return {position,0};
    const auto lower=std::lower_bound(boundaries.begin(),boundaries.end(),position);
    const int64_t base=count>0?static_cast<int64_t>(std::upper_bound(boundaries.begin(),boundaries.end(),position)-boundaries.begin())-1:static_cast<int64_t>(lower-boundaries.begin());
    const auto index=std::clamp(base+static_cast<int64_t>(count),int64_t{0},static_cast<int64_t>(boundaries.size()-1));
    return {boundaries[static_cast<size_t>(index)],static_cast<int>(index-base)};
  }
private:
  static bool high(wchar_t unit){return unit>=0xd800&&unit<=0xdbff;}
  static bool low(wchar_t unit){return unit>=0xdc00&&unit<=0xdfff;}
  void checkThread()const{require(thread_==std::this_thread::get_id(),RPC_E_WRONG_THREAD);}
  static void validate(TextSnapshot const& value){
    require(value.revision<=9007199254740991ULL&&value.textRevision<=9007199254740991ULL&&value.generation>0&&value.generation<=9007199254740991ULL&&value.text.size()<=maximumTextUnits);
    validateText(value.text);
    validateSpan(value,std::min(value.anchor,value.focus),std::max(value.anchor,value.focus));
    // Password text must be redacted before it reaches this peer, even though
    // its independent TSF input session still owns the real native shadow.
    require(!value.obscured||(value.text.empty()&&value.characters.empty()&&value.words.empty()&&value.lines.empty()&&value.anchor==0&&value.focus==0));
    for(auto const* values:{&value.characters,&value.words,&value.lines}){
      if(values->empty())continue;require(values->size()<=maximumTextUnits+1&&values->front()==0&&values->back()==static_cast<int>(value.text.size()));
      int previous=-1;for(const int stop:*values){require(stop>previous&&scalarBoundary(value.text,stop));previous=stop;}
    }
    require(value.obscured||!value.characters.empty());
  }
  void updateRanges(std::wstring const& oldText,std::wstring const& newText){
    size_t prefix=0;while(prefix<oldText.size()&&prefix<newText.size()&&oldText[prefix]==newText[prefix])++prefix;
    while(prefix&&!scalarBoundary(oldText,static_cast<int>(prefix)))--prefix;
    size_t suffix=0;while(suffix<oldText.size()-prefix&&suffix<newText.size()-prefix&&oldText[oldText.size()-suffix-1]==newText[newText.size()-suffix-1])++suffix;
    while(suffix&&(!scalarBoundary(oldText,static_cast<int>(oldText.size()-suffix))||!scalarBoundary(newText,static_cast<int>(newText.size()-suffix))))--suffix;
    const int begin=static_cast<int>(prefix),oldEnd=static_cast<int>(oldText.size()-suffix),newEnd=static_cast<int>(newText.size()-suffix),delta=newEnd-oldEnd;
    const auto map=[&](int position,bool end){return position<=begin?position:position>=oldEnd?position+delta:end?newEnd:begin;};
    for(auto const& entry:ranges_)if(auto range=entry.second.lock();range&&!range->retired){
      const bool collapsed=range->start==range->end;range->start=map(range->start,false);range->end=collapsed?range->start:std::max(range->start,map(range->end,true));
    }
  }
  const std::thread::id thread_;bool retired_=false;
  std::shared_ptr<TextSnapshot const> current_;
  std::unordered_map<void*,std::weak_ptr<TextSpan>> ranges_;
};
}
