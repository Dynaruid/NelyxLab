// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <jsi/jsi.h>
#include "../windows/SemanticsState.h"
namespace Nelyx::NativeHermes {
namespace jsi=facebook::jsi;
class Packet {
public:
  Packet(jsi::Runtime& runtime,jsi::Value value):Packet(runtime,std::move(value),std::make_shared<size_t>(16*1024*1024)){}
  Packet field(const char* name)const{return {rt,value.getObject(rt).getProperty(rt,name),remaining};}
  bool absent()const{return value.isNull()||value.isUndefined();}
  std::string string(size_t limit=4096)const{auto result=value.getString(rt).utf8(rt);if(result.size()>limit)fail();consume(result.size());return result;}
  std::wstring text(size_t limit=4096)const{const auto bytes=string(limit*4);const auto size=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,bytes.data(),int(bytes.size()),nullptr,0);if((!size&&!bytes.empty())||size>limit)fail();std::wstring result(size,L'\0');if(size)MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,bytes.data(),int(bytes.size()),result.data(),size);return result;}
  double number()const{auto result=value.getNumber();if(!std::isfinite(result))fail();return result;}
  uint64_t counter(bool zero=true)const{auto n=number();if(n<(zero?0:1)||n>9007199254740991.||n!=std::floor(n))fail();return uint64_t(n);}
  int offset()const{auto n=counter();if(n>INT_MAX)fail();return int(n);}
  bool boolean()const{return value.getBool();}
  std::vector<Packet> array(size_t limit=4096)const{auto array=value.getObject(rt).getArray(rt);const auto size=array.size(rt);if(size>limit)fail();consume(size*sizeof(jsi::Value));std::vector<Packet> result;result.reserve(size);for(size_t i=0;i<size;++i)result.push_back(Packet(rt,array.getValueAtIndex(rt,i),remaining));return result;}
  [[noreturn]] void fail()const{throw jsi::JSError(rt,"Invalid native Hermes service packet");}
private:
  Packet(jsi::Runtime& runtime,jsi::Value value,std::shared_ptr<size_t> budget):rt(runtime),value(std::move(value)),remaining(std::move(budget)){}
  void consume(size_t bytes)const{if(bytes>*remaining)fail();*remaining-=bytes;}
  jsi::Runtime& rt;jsi::Value value;std::shared_ptr<size_t> remaining;
};
inline WindowsInput::Rect readRect(Packet const& p){WindowsInput::Rect rect{p.field("x").number(),p.field("y").number(),p.field("width").number(),p.field("height").number()};if(rect.width<0||rect.height<0||std::abs(rect.x)>1e9||std::abs(rect.y)>1e9||rect.width>1e9||rect.height>1e9)p.fail();return rect;}
inline WindowsInput::Owner readOwner(Packet const& p){return {p.field("id").string(1024),p.field("generation").counter(false)};}
inline WindowsInput::CoreGeometry readGeometry(Packet const& p){
  if(p.field("coordinates").string()!="view-logical")p.fail();const auto baseline=p.field("caretBaseline");
  WindowsInput::CoreGeometry g{readOwner(p.field("owner")),p.field("viewportGeneration").counter(),p.field("layoutEpoch").counter(false),readRect(p.field("bounds")),readRect(p.field("clip")),readRect(p.field("caret")),baseline.field("x").number(),baseline.field("y").number(),p.field("nativeSurfaceGeneration").counter(false)};WindowsInput::TextInputDocument::validateGeometry(g);return g;
}
struct SemanticRange {double min=0,max=0,value=0;std::optional<double> smallChange,largeChange;bool readOnly=true;};
inline bool validSemanticRange(SemanticRange const& range){return std::isfinite(range.min)&&std::isfinite(range.max)&&std::isfinite(range.value)&&range.min<=range.value&&range.value<=range.max&&(!range.smallChange||(std::isfinite(*range.smallChange)&&*range.smallChange>=0))&&(!range.largeChange||(std::isfinite(*range.largeChange)&&*range.largeChange>=0));}
struct SemanticPacket {WindowsSemantics::CoreSemanticsSnapshot snapshot;std::wstring name,tooltip,automationId;std::optional<std::wstring> value;std::optional<bool> selected,checked;std::optional<SemanticRange> range;bool isLink=false,isSlider=false;int parent=-1;};
inline SemanticPacket readSemantics(Packet const& record){
  using namespace WindowsSemantics;auto p=record.field("packet");if(p.field("protocol").counter()!=1)p.fail();SemanticPacket result;result.name=record.field("name").text();result.tooltip=record.field("tooltip").text();result.automationId=record.field("automationId").text();result.isLink=record.field("isLink").boolean();auto selected=record.field("selected"),checked=record.field("checked"),value=record.field("value");if(!selected.absent())result.selected=selected.boolean();if(!checked.absent())result.checked=checked.boolean();if(!value.absent())result.value=value.text();auto parent=record.field("parent").number();if(parent< -1||parent>4095||parent!=std::floor(parent))record.fail();result.parent=int(parent);auto& s=result.snapshot;
  s.id=p.field("id").string(1024);s.role=p.field("role").string(32);if(s.id.empty()||(s.role!="text-field"&&s.role!="button"&&s.role!="text"&&s.role!="image"&&s.role!="group"&&s.role!="list"))p.fail();s.commit=p.field("commit").counter();s.source=p.field("source").counter();s.surface=p.field("surface").counter(false);s.owner=readOwner(p.field("owner"));s.bounds=readRect(p.field("bounds"));s.enabled=p.field("enabled").boolean();s.focusable=p.field("focusable").boolean();s.focused=p.field("focused").boolean();s.canActivate=p.field("canActivate").boolean();
  s.frame={s.owner,p.field("viewport").counter(),s.commit,s.bounds,s.bounds,s.bounds,s.bounds.x,s.bounds.y,p.field("surfaceGeneration").counter(false)};
  const auto slider=p.field("isSlider");if(!slider.absent())result.isSlider=slider.boolean();const auto range=p.field("range");if(!range.absent()){SemanticRange r;r.min=range.field("min").number();r.max=range.field("max").number();r.value=range.field("value").number();r.readOnly=range.field("readOnly").boolean();const auto smallPacket=range.field("smallChange"),largePacket=range.field("largeChange");if(!smallPacket.absent())r.smallChange=smallPacket.number();if(!largePacket.absent())r.largeChange=largePacket.number();if(!validSemanticRange(r)||s.role=="text-field")p.fail();result.range=r;}
  auto input=p.field("text");if(input.absent()){if(s.role=="text-field")p.fail();return result;}
  TextSnapshot t;t.revision=input.field("revision").counter();t.textRevision=input.field("textRevision").counter();t.generation=input.field("generation").counter(false);t.text=input.field("value").text(TextDocument::maximumTextUnits);t.anchor=input.field("anchor").offset();t.focus=input.field("focus").offset();t.readOnly=input.field("readOnly").boolean();t.obscured=input.field("obscured").boolean();t.selectionEnabled=input.field("selectionEnabled").boolean();t.enabled=s.enabled;t.focused=s.focused;
  auto navigation=input.field("navigation"),paragraph=input.field("paragraph"),geometry=input.field("geometry");
  if(t.obscured){if(!t.text.empty()||t.anchor||t.focus||!navigation.absent()||!paragraph.absent())p.fail();}
  else if(!navigation.absent()){auto stops=[&](const char* name){std::vector<int> result;for(auto const& x:navigation.field(name).array(TextDocument::maximumTextUnits+1))result.push_back(x.offset());return result;};t.characters=stops("characters");t.words=stops("words");t.lines=stops("lines");}
  if(!geometry.absent()){auto frame=readGeometry(geometry);if(frame.owner!=s.owner||frame.viewport!=s.frame.viewport||frame.surface!=s.frame.surface)p.fail();s.frame=frame;s.hasGeometry=true;}
  if(!paragraph.absent()){
    if(t.obscured||!s.hasGeometry)p.fail();CoreParagraphFrame f;f.geometry=s.frame;auto resource=paragraph.field("resource"),reference=paragraph.field("reference"),origin=paragraph.field("paintOffset");if(reference.field("protocol").string()!="native-paragraph-v1")p.fail();f.ticket=reference.field("token").counter(false);f.paintX=origin.field("x").number();f.paintY=origin.field("y").number();f.identity={s.owner.id,resource.field("id").string(),input.field("value").string(TextDocument::maximumTextUnits*4),s.owner.generation,resource.field("generation").counter(),uint32_t(t.text.size())};auto transform=geometry.field("transform").array(16);if(transform.size()!=16)p.fail();for(size_t i=0;i<16;++i)f.transform[i]=transform[i].number();s.paragraph=std::move(f);
  }
  TextDocument::validate(t);s.text=std::move(t);return result;
}
struct SemanticsDelta {WindowsInput::Owner owner;uint64_t commit=0,viewport=0,surface=0;std::vector<SemanticPacket> upserts;std::vector<std::string> removed,order;};
inline SemanticsDelta readSemanticsDelta(Packet const& p){if(p.field("protocol").counter()!=1)p.fail();SemanticsDelta delta;delta.owner=readOwner(p.field("owner"));delta.commit=p.field("commit").counter();delta.viewport=p.field("viewport").counter();delta.surface=p.field("surface").counter(false);for(auto const& item:p.field("upserts").array())delta.upserts.push_back(readSemantics(item));for(auto const& item:p.field("removed").array())delta.removed.push_back(item.string(1024));for(auto const& item:p.field("order").array())delta.order.push_back(item.string(1024));return delta;}
}
