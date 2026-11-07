// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "paragraph.hpp"
#include <set>

namespace nelyx::v2 {
inline constexpr size_t fontCatalogLimit=16*1024*1024;
struct FontCatalog {
  struct Font {std::string family;Reader bytes;};
  std::vector<Font> fonts;
  std::vector<std::string> fallback;
};
inline bool bundledFontFamily(const std::string& name){return name=="NelyxDefault"||name=="NelyxArabic"||name=="NelyxHebrew"||name=="NelyxEmoji";}
inline void validateFontFamily(const std::string& name){
  require(!name.empty()&&name.size()<=256&&name.front()!=' '&&name.back()!=' ',wire::statuses::invalidValue);
  for(const auto c:name)require(uint8_t(c)>=32&&uint8_t(c)!=127,wire::statuses::invalidValue);
}
/** Byte views are consumed synchronously; providers retain decoded faces, not this Reader. */
inline FontCatalog readFontCatalog(Reader data){
  require(data.length>=32&&data.length<=fontCatalogLimit,wire::statuses::budgetExceeded);
  const auto count=data.u32(8),fallbackCount=data.u32(12);
  require(data.u32(0)==0x31544e46&&data.u32(4)==1&&count<=64&&fallbackCount>0&&fallbackCount<=8&&
    data.u32(16)==data.length&&data.u32(20)==0&&data.u32(24)==0&&data.u32(28)==0,wire::statuses::invalidValue);
  FontCatalog catalog;size_t offset=32;std::set<std::string> names;
  for(uint32_t i=0;i<count;++i){
    data.range(offset,16);const auto nameLength=data.u32(offset),size=data.u32(offset+4);
    require(nameLength>0&&nameLength<=256&&size>=12&&size<=fontCatalogLimit&&data.u32(offset+8)==0&&data.u32(offset+12)==0,wire::statuses::invalidValue);offset+=16;
    auto name=paragraphString(data,offset,nameLength);validateFontFamily(name);names.insert(name);
    const auto bytes=data.slice(offset,size);const auto padded=paragraphAligned(size);data.range(offset,padded);
    for(size_t j=size;j<padded;++j)require(data.data[offset+j]==0);offset+=padded;
    catalog.fonts.push_back({std::move(name),bytes});
  }
  std::set<std::string> seen;
  for(uint32_t i=0;i<fallbackCount;++i){
    data.range(offset,8);const auto size=data.u32(offset);require(size>0&&size<=256&&data.u32(offset+4)==0,wire::statuses::invalidValue);offset+=8;
    auto name=paragraphString(data,offset,size);validateFontFamily(name);
    require((bundledFontFamily(name)||names.contains(name))&&seen.insert(name).second,wire::statuses::invalidValue);catalog.fallback.push_back(std::move(name));
  }
  require(offset==data.length);return catalog;
}
}
