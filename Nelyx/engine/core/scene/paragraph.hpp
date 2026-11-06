// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <string>

namespace nelyx::v2 {
struct ParagraphOptions {
  uint32_t flags=wire::paragraphFlags::wrap|wire::paragraphFlags::manualHyphens, align=wire::paragraphAlign::start, maxLines=0;
  double height=-1, letterSpacing=0, wordSpacing=0;
  std::string locale="en", ellipsis;
  uint32_t fontWeight=400;
  bool operator==(const ParagraphOptions&)const=default;
  bool wraps()const{return (flags&wire::paragraphFlags::wrap)!=0;}
  double alignment(uint32_t direction)const{
    switch(align){
      case wire::paragraphAlign::center:return 0.5;
      case wire::paragraphAlign::left:return 0;
      case wire::paragraphAlign::right:return 1;
      case wire::paragraphAlign::end:return direction?0:1;
      default:return direction?1:0;
    }
  }
};
struct ParagraphData {
  Lease lease;
  ParagraphOptions value;
  ParagraphData(const std::shared_ptr<Ledger>& ledger,ParagraphOptions options)
    :lease(ledger,sizeof(ParagraphData)+options.locale.size()+options.ellipsis.size()),value(std::move(options)){}
};
inline Writer paragraphBytes(const ParagraphOptions& value){
  const size_t locale=(value.locale.size()+7)/8*8,ellipsis=(value.ellipsis.size()+7)/8*8;
  Writer data(wire::paragraphBytes+locale+ellipsis);
  data.u32(0,value.flags);data.u32(4,value.align);data.u32(8,value.maxLines);
  data.u32(12,uint32_t(value.locale.size()));data.u32(16,uint32_t(value.ellipsis.size()));
  if(value.fontWeight!=400)data.u32(24,value.fontWeight);
  data.f64(32,value.height);data.f64(40,value.letterSpacing);data.f64(48,value.wordSpacing);
  std::memcpy(data.bytes.data()+wire::paragraphBytes,value.locale.data(),value.locale.size());
  std::memcpy(data.bytes.data()+wire::paragraphBytes+locale,value.ellipsis.data(),value.ellipsis.size());
  return data;
}
}
