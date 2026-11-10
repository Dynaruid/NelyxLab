// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "editing.hpp"
#include <set>

namespace nelyx::v2 {
inline size_t semanticAligned(size_t value){return (value+7)/8*8;}
inline bool validCustomSemanticAction(const SemanticCustomActionData& value){
  const auto a=value.overrideAction;
  return (!a||(!(a&(a-1))&&a<=(1u<<25)))&&(!value.hintOverride||a)&&
    (a?(value.label.empty()&&!value.hint.empty()):(!value.label.empty()&&value.hint.empty()));
}
inline std::shared_ptr<const SemanticData> readSemanticData(const std::shared_ptr<Ledger>& ledger,Reader data){
  require(data.length>=wire::semanticsBytes&&!data.u64(112));
  const auto role=data.u32(0),flags=data.u32(4),actions=data.u32(8),rangeFlags=data.u32(24);
  const auto sourceFlags=data.u32(28),configuration=data.u32(80),sortFlags=data.u32(96),customCount=data.u32(104),direction=data.u32(108);
  const auto order=data.finiteF64(88);
  require(sourceFlags<=0x7fffffffu&&configuration<=7&&(!(configuration&4u)||(configuration&2u))&&
    ((configuration&1u)||(!sourceFlags&&!configuration)),wire::statuses::invalidValue);
  for(uint32_t shift=2;shift<=12;shift+=2)require(((sourceFlags>>shift)&3u)!=3u,wire::statuses::invalidValue);
  const std::array<uint32_t,7> lengths{data.u32(12),data.u32(16),data.u32(20),data.u32(72),data.u32(76),data.u32(84),data.u32(100)};
  size_t total=0;for(const auto length:lengths){require(length<=wire::limits::semanticsTextBytes,wire::statuses::invalidValue);total+=length;}
  require(role<=wire::semanticsRoles::dialog&&!(flags&~1919u)&&!(actions&~511u)&&
    rangeFlags<=3&&rangeFlags!=2&&sortFlags<=3&&sortFlags!=2&&((sortFlags&1u)||!order)&&
    ((sortFlags&2u)||!lengths[6])&&direction<=2&&customCount<=wire::limits::semanticsCustomActions&&
    wire::semanticsBytes+semanticAligned(total)<=data.length,wire::statuses::invalidValue);
  require(!(flags&wire::semanticsFlags::mixed)||(role==wire::semanticsRoles::checkbox&&!(flags&wire::semanticsFlags::checked)),wire::statuses::invalidValue);
  require(!(actions&wire::semanticsActions::deselect)||(role==wire::semanticsRoles::radio&&
    (flags&wire::semanticsFlags::checked)&&(actions&wire::semanticsActions::activate)),wire::statuses::invalidValue);
  std::array<std::string,7> text;size_t cursor=wire::semanticsBytes;
  for(size_t i=0;i<text.size();++i){const auto part=data.slice(cursor,lengths[i]);require(validUtf8(part),wire::statuses::invalidValue);
    text[i]=std::string(reinterpret_cast<const char*>(part.data),part.length);cursor+=part.length;}
  const auto padding=[&](size_t end){require(end<=data.length);while(cursor<end)require(!data.data[cursor++]);};
  padding(wire::semanticsBytes+semanticAligned(total));
  SemanticMetadata metadata;metadata.identifier=std::move(text[5]);metadata.direction=direction;
  if(sortFlags&1u)metadata.sort=SemanticSortKey{order,sortFlags&2u?std::optional<std::string>(std::move(text[6])):std::nullopt};
  metadata.custom.reserve(customCount);std::set<uint32_t> ids;
  for(uint32_t i=0;i<customCount;++i){
    require(cursor+wire::semanticCustomActionBytes<=data.length);
    const auto start=cursor;
    const auto id=data.u32(start),overrideAction=data.u32(start+4),labelLength=data.u32(start+8),hintLength=data.u32(start+12);
    require(data.u32(start+16)<=3&&!data.u32(start+20)&&ids.insert(uint32_t(id)).second&&labelLength<=wire::limits::semanticsTextBytes&&
      hintLength<=wire::limits::semanticsTextBytes&&start+wire::semanticCustomActionBytes+semanticAligned(labelLength+hintLength)<=data.length);
    cursor+=wire::semanticCustomActionBytes;const auto label=data.slice(cursor,labelLength);cursor+=labelLength;
    const auto hint=data.slice(cursor,hintLength);cursor+=hintLength;require(validUtf8(label)&&validUtf8(hint));
    SemanticCustomActionData action{uint32_t(id),uint32_t(overrideAction),
      std::string(reinterpret_cast<const char*>(label.data),label.length),std::string(reinterpret_cast<const char*>(hint.data),hint.length),bool(data.u32(start+16)&1u),bool(data.u32(start+16)&2u)};
    require(validCustomSemanticAction(action));metadata.custom.push_back(std::move(action));
    padding(start+wire::semanticCustomActionBytes+semanticAligned(labelLength+hintLength));
  }
  require(cursor==data.length);
  SemanticRangeData range{bool(rangeFlags&1u),bool(rangeFlags&2u),data.f64(32),data.f64(40),data.f64(48),data.f64(56),data.f64(64)};
  if(range.enabled)require(range.minimum<=range.maximum&&range.value>=range.minimum&&range.value<=range.maximum&&range.smallChange>=0&&range.largeChange>=0,wire::statuses::invalidValue);
  else require(range.minimum==0&&range.maximum==0&&range.value==0&&range.smallChange==0&&range.largeChange==0,wire::statuses::invalidValue);
  require(!range.enabled||!(actions&wire::semanticsActions::setValue)||!range.readOnly,wire::statuses::invalidValue);
  if(!role){require(!flags&&!actions&&!total&&!range.enabled&&!sourceFlags&&!configuration&&!sortFlags&&!direction&&!customCount);return {};}
  return std::make_shared<SemanticData>(ledger,role,flags,actions,std::move(text[0]),std::move(text[1]),std::move(text[2]),std::move(text[3]),std::move(text[4]),range,
    configuration?sourceFlags:UINT32_MAX,configuration,std::move(metadata));
}
inline Writer semanticDataBytes(const SemanticData& data,uint32_t flags,uint32_t actions){
  const auto& m=data.metadata;
  const std::array<const std::string*,7> text{&data.label,&data.hint,&data.value,&data.increasedValue,&data.decreasedValue,&m.identifier,m.sort&&m.sort->name?&*m.sort->name:nullptr};
  size_t strings=0;for(const auto* part:text)if(part)strings+=part->size();
  size_t size=wire::semanticsBytes+semanticAligned(strings);
  for(const auto& action:m.custom)size+=wire::semanticCustomActionBytes+semanticAligned(action.label.size()+action.hint.size());
  Writer out(size);out.u32(0,data.role);out.u32(4,flags);out.u32(8,actions);
  constexpr std::array<size_t,7> lengths{12,16,20,72,76,84,100};
  for(size_t i=0;i<text.size();++i)out.u32(lengths[i],uint32_t(text[i]?text[i]->size():0));
  const auto& range=data.range;out.u32(24,range.enabled?(range.readOnly?3u:1u):0u);
  out.u32(28,data.mergeFlags);out.u32(80,1u|(data.explicitRole?2u:0u)|(data.declaredRole?4u:0u));
  out.f64(32,range.minimum);out.f64(40,range.maximum);out.f64(48,range.value);out.f64(56,range.smallChange);out.f64(64,range.largeChange);
  out.f64(88,m.sort?m.sort->order:0);out.u32(96,m.sort?1u|(m.sort->name?2u:0u):0u);
  out.u32(104,uint32_t(m.custom.size()));out.u32(108,m.direction);
  size_t cursor=wire::semanticsBytes;
  for(const auto* part:text)if(part){if(!part->empty())std::memcpy(out.bytes.data()+cursor,part->data(),part->size());cursor+=part->size();}
  cursor=wire::semanticsBytes+semanticAligned(strings);
  for(const auto& action:m.custom){
    out.u32(cursor,action.id);out.u32(cursor+4,action.overrideAction);out.u32(cursor+8,uint32_t(action.label.size()));out.u32(cursor+12,uint32_t(action.hint.size()));
    out.u32(cursor+16,(action.invokable?1u:0u)|(action.hintOverride?2u:0u));
    if(!action.label.empty())std::memcpy(out.bytes.data()+cursor+wire::semanticCustomActionBytes,action.label.data(),action.label.size());
    if(!action.hint.empty())std::memcpy(out.bytes.data()+cursor+wire::semanticCustomActionBytes+action.label.size(),action.hint.data(),action.hint.size());
    cursor+=wire::semanticCustomActionBytes+semanticAligned(action.label.size()+action.hint.size());
  }
  return out;
}
}
