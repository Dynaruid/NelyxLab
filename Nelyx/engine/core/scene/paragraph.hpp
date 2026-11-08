// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <string>
#include <algorithm>
#include <optional>

namespace nelyx::v2 {
struct ParagraphFeature {uint32_t tag=0,value=0;bool operator==(const ParagraphFeature&)const=default;};
struct ParagraphVariation {uint32_t tag=0;double value=0;bool operator==(const ParagraphVariation&)const=default;};
struct ParagraphShadow {uint32_t color=0;double x=0,y=0,sigma=0;bool operator==(const ParagraphShadow&)const=default;};
struct ParagraphStrut {
  uint32_t flags=0,fontWeight=400;double fontSize=14,height=-1,leading=0;std::vector<std::string> fontFamilies;
  bool operator==(const ParagraphStrut&)const=default;
  size_t bytes()const{size_t size=sizeof(ParagraphStrut)+fontFamilies.size()*sizeof(std::string);for(const auto& family:fontFamilies)size+=family.size();return size;}
};
struct ParagraphPlaceholder {
  uint32_t offset=0,alignment=0,baseline=0;double width=0,height=0,baselineOffset=0;
  bool operator==(const ParagraphPlaceholder&)const=default;
};
struct ParagraphBox {
  double x=0,y=0,width=0,height=0;
  uint32_t direction=0;
};
struct ParagraphGeometry {
  Lease lease;
  std::vector<ParagraphBox> boxes;
  ParagraphGeometry(const std::shared_ptr<Ledger>& ledger,std::vector<ParagraphBox> values)
    :lease(ledger,sizeof(ParagraphGeometry)+values.capacity()*sizeof(ParagraphBox)),boxes(std::move(values)){}
};
struct ParagraphRun {
  uint32_t start=0,end=0,color=0,backgroundColor=0,flags=0,fontWeight=400,decoration=0,decorationStyle=0,decorationColor=0;
  double fontSize=14,height=-1,letterSpacing=0,wordSpacing=0,decorationThickness=1;
  std::vector<std::string> fontFamilies;
  std::string locale="en";
  std::vector<ParagraphFeature> features;
  std::vector<ParagraphVariation> variations;
  std::vector<ParagraphShadow> shadows;
  bool operator==(const ParagraphRun&)const=default;
  size_t bytes()const{size_t size=sizeof(ParagraphRun)+locale.size()+fontFamilies.size()*sizeof(std::string)+features.size()*sizeof(ParagraphFeature)+variations.size()*sizeof(ParagraphVariation)+shadows.size()*sizeof(ParagraphShadow);for(const auto& family:fontFamilies)size+=family.size();return size;}
};
struct ParagraphOptions {
  uint32_t flags=wire::paragraphFlags::wrap|wire::paragraphFlags::manualHyphens, align=wire::paragraphAlign::start, maxLines=0;
  double height=-1, letterSpacing=0, wordSpacing=0;
  std::string locale="en", ellipsis;
  uint32_t fontWeight=400;
  std::string fontFamily;
  std::vector<ParagraphRun> runs;
  std::optional<ParagraphStrut> strut;
  std::vector<ParagraphPlaceholder> placeholders;
  size_t metadataBytes()const{size_t size=(strut?strut->bytes():0)+placeholders.size()*sizeof(ParagraphPlaceholder);for(const auto& run:runs)size+=run.bytes();return size;}
  double paintOutset(double fontSize)const{const bool compressed=(strut&&(strut->flags&4))||(height>=0&&height<1);double ink=compressed?fontSize*2:0,shadowSize=0;
    for(const auto& run:runs){if(compressed||(run.height>=0&&run.height<1))ink=std::max(ink,run.fontSize*2);for(const auto& shadow:run.shadows)shadowSize=std::max({shadowSize,std::abs(shadow.x)+shadow.sigma*4,std::abs(shadow.y)+shadow.sigma*4});}return ink+shadowSize;}
  bool operator==(const ParagraphOptions&)const=default;
  bool wraps()const{return (flags&wire::paragraphFlags::wrap)!=0;}
  bool inlineChildren()const{return (flags&wire::paragraphFlags::inlineChildren)!=0;}
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
    :lease(ledger,sizeof(ParagraphData)+options.locale.size()+options.ellipsis.size()+options.fontFamily.size()+options.metadataBytes()),value(std::move(options)){}
};
inline size_t paragraphAligned(size_t value){return (value+7)/8*8;}
inline uint32_t paragraphTag(uint32_t tag){
  for(int shift=0;shift<32;shift+=8){const auto byte=(tag>>shift)&255;require(byte>=32&&byte<=126,wire::statuses::invalidValue);}return tag;
}
inline std::string paragraphString(Reader data,size_t& offset,size_t size){
  auto value=data.slice(offset,size);require(validUtf8(value),wire::statuses::invalidValue);
  const auto padded=paragraphAligned(size);data.range(offset,padded);
  for(size_t i=size;i<padded;++i)require(data.data[offset+i]==0);
  offset+=padded;return std::string(reinterpret_cast<const char*>(value.data),value.length);
}
inline std::vector<std::string> paragraphFamilies(const std::string& names,uint32_t count){
  std::vector<std::string> families;families.reserve(count);size_t start=0;
  for(size_t j=0;j<=names.size();++j)if(j==names.size()||names[j]=='\0'){require(j>start,wire::statuses::invalidValue);families.push_back(names.substr(start,j-start));start=j+1;}
  require(families.size()==count,wire::statuses::invalidValue);return families;
}
inline ParagraphOptions readParagraph(Reader data){
  require(data.length>=wire::paragraphBytes);
  const auto localeLength=data.u32(12),ellipsisLength=data.u32(16),familyLength=data.u32(20),count=data.u32(28);
  require(localeLength>0&&localeLength<=wire::limits::localeBytes&&ellipsisLength<=wire::limits::ellipsisBytes&&familyLength<=wire::limits::fontFamilyBytes&&count<=wire::limits::paragraphRuns,wire::statuses::budgetExceeded);
  const auto strutLength=data.u32(56),placeholderCount=data.u32(60);
  require(placeholderCount<=wire::limits::paragraphPlaceholders,wire::statuses::budgetExceeded);
  require(strutLength==0||(strutLength>=wire::paragraphStrutBytes+8&&strutLength<=wire::paragraphStrutBytes+paragraphAligned(wire::limits::fontFamilyBytes)),wire::statuses::invalidValue);
  size_t offset=wire::paragraphBytes;
  ParagraphOptions value;value.flags=data.u32(0);value.align=data.u32(4);value.maxLines=data.u32(8);
  value.fontWeight=data.u32(24)?data.u32(24):400;
  value.height=data.f64(32);value.letterSpacing=data.f64(40);value.wordSpacing=data.f64(48);
  value.locale=paragraphString(data,offset,localeLength);value.ellipsis=paragraphString(data,offset,ellipsisLength);value.fontFamily=paragraphString(data,offset,familyLength);
  require(value.fontWeight>=100&&value.fontWeight<=900&&value.flags<=63&&value.align<=wire::paragraphAlign::justify&&value.maxLines<=wire::limits::textBytes&&
    (value.height==-1||(value.height>=0&&value.height<=1e6))&&std::abs(value.letterSpacing)<=1e6&&std::abs(value.wordSpacing)<=1e6&&
    value.locale.find('\0')==std::string::npos&&value.fontFamily.find('\0')==std::string::npos,wire::statuses::invalidValue);
  if(strutLength){
    const auto record=data.slice(offset,strutLength);ParagraphStrut strut;strut.flags=record.u32(0);strut.fontWeight=record.u32(4);
    const auto size=record.u32(8),families=record.u32(12);
    require(size>0&&size<=wire::limits::fontFamilyBytes&&families>0&&families<=wire::limits::paragraphRunFamilies,wire::statuses::budgetExceeded);
    require(strutLength==wire::paragraphStrutBytes+paragraphAligned(size)&&record.u64(40)==0,wire::statuses::invalidValue);
    strut.fontSize=record.f64(16);strut.height=record.f64(24);strut.leading=record.f64(32);
    require(strut.flags<=7&&strut.fontWeight>=1&&strut.fontWeight<=1000&&strut.fontSize>=0&&strut.fontSize<=512&&(strut.height==-1||(strut.height>=0&&strut.height<=100))&&strut.leading>=0&&strut.leading<=100,wire::statuses::invalidValue);
    size_t position=wire::paragraphStrutBytes;strut.fontFamilies=paragraphFamilies(paragraphString(record,position,size),families);
    value.strut=std::move(strut);offset+=strutLength;
  }
  data.range(offset,placeholderCount*wire::paragraphPlaceholderBytes);value.placeholders.reserve(placeholderCount);
  for(uint32_t i=0;i<placeholderCount;++i){
    const auto record=data.slice(offset,wire::paragraphPlaceholderBytes);ParagraphPlaceholder item;
    item.offset=record.u32(0);item.alignment=record.u32(4);item.baseline=record.u32(8);item.width=record.f64(16);item.height=record.f64(24);item.baselineOffset=record.f64(32);
    require(item.offset<wire::limits::textBytes&&(i==0||item.offset>value.placeholders.back().offset)&&item.alignment<=5&&item.baseline<=1&&record.u32(12)==0&&item.width>=0&&item.width<=16777216&&item.height>=0&&item.height<=16777216,wire::statuses::invalidValue);
    value.placeholders.push_back(item);offset+=wire::paragraphPlaceholderBytes;
  }
  uint32_t end=0;value.runs.reserve(count);
  for(uint32_t i=0;i<count;++i){
    auto record=data.slice(offset,wire::paragraphRunBytes);offset+=wire::paragraphRunBytes;
    ParagraphRun run;run.start=record.u32(0);run.end=record.u32(4);run.color=record.u32(8);run.backgroundColor=record.u32(12);run.flags=record.u32(16);run.fontWeight=record.u32(20);
    const auto familySize=record.u32(24),localeSize=record.u32(28),families=record.u32(84),features=record.u32(88),variations=record.u32(92),shadows=record.u32(96);
    require(familySize>0&&familySize<=wire::limits::fontFamilyBytes&&localeSize>0&&localeSize<=wire::limits::localeBytes&&families>0&&families<=wire::limits::paragraphRunFamilies&&features<=wire::limits::paragraphRunFeatures&&variations<=wire::limits::paragraphRunVariations&&shadows<=wire::limits::paragraphRunShadows,wire::statuses::budgetExceeded);
    run.fontSize=record.f64(32);run.height=record.f64(40);run.letterSpacing=record.f64(48);run.wordSpacing=record.f64(56);run.decorationThickness=record.f64(64);
    run.decoration=record.u32(72);run.decorationStyle=record.u32(76);run.decorationColor=record.u32(80);
    require(run.start==end&&run.end>run.start&&run.end<=wire::limits::textBytes&&run.flags<=(15|wire::paragraphRunFlags::ideographicBaseline)&&run.fontWeight>=100&&run.fontWeight<=900&&
      run.fontSize>=0&&run.fontSize<=512&&(run.height==-1||(run.height>=0&&run.height<=1e6))&&std::abs(run.letterSpacing)<=1e6&&std::abs(run.wordSpacing)<=1e6&&
      run.decorationThickness>=0&&run.decorationThickness<=1e6&&run.decoration<=7&&run.decorationStyle<=4&&record.u32(100)==0&&record.u64(104)==0&&
      ((run.flags&1)||run.backgroundColor==0)&&((run.flags&8)||run.decorationColor==0),wire::statuses::invalidValue);
    run.fontFamilies=paragraphFamilies(paragraphString(data,offset,familySize),families);
    run.locale=paragraphString(data,offset,localeSize);require(run.locale.find('\0')==std::string::npos,wire::statuses::invalidValue);
    data.range(offset,features*8+variations*16+shadows*32);
    run.features.reserve(features);run.variations.reserve(variations);run.shadows.reserve(shadows);
    for(uint32_t j=0;j<features;++j){run.features.push_back({paragraphTag(data.u32(offset)),data.u32(offset+4)});offset+=8;}
    for(uint32_t j=0;j<variations;++j){require(data.u32(offset+4)==0,wire::statuses::invalidValue);const auto coordinate=data.f64(offset+8);require(std::abs(coordinate)<=16777216,wire::statuses::invalidValue);run.variations.push_back({paragraphTag(data.u32(offset)),coordinate});offset+=16;}
    for(uint32_t j=0;j<shadows;++j){require(data.u32(offset+4)==0,wire::statuses::invalidValue);const auto x=data.f64(offset+8),y=data.f64(offset+16),sigma=data.f64(offset+24);require(std::abs(x)<=16777216&&std::abs(y)<=16777216&&sigma>=0&&sigma<=4096,wire::statuses::invalidValue);run.shadows.push_back({data.u32(offset),x,y,sigma});offset+=32;}
    end=run.end;value.runs.push_back(std::move(run));
  }
  require(offset==data.length);return value;
}
/** Walk scalar boundaries once; a run can never split a surrogate pair. */
template<class Emit> void forParagraphRuns(const std::string& text,const ParagraphOptions& options,Emit emit){
  if(options.runs.empty())return;
  size_t byte=0;uint32_t units=0;
  for(const auto& run:options.runs){
    require(run.start==units&&run.end>run.start,wire::statuses::invalidValue);const auto start=byte;
    while(byte<text.size()&&units<run.end){const auto c=uint8_t(text[byte]);const size_t length=c<0x80?1:c<0xe0?2:c<0xf0?3:4;
      require(byte+length<=text.size(),wire::statuses::invalidValue);byte+=length;units+=length==4?2:1;
    }
    require(units==run.end,wire::statuses::invalidValue);emit(run,start,byte);
  }
  require(byte==text.size(),wire::statuses::invalidValue);
}
inline void validateParagraphPlaceholders(const std::string& text,const ParagraphOptions& options){
  size_t byte=0;uint32_t units=0;int64_t previous=-1;
  for(const auto& item:options.placeholders){
    require(int64_t(item.offset)>previous,wire::statuses::invalidValue);previous=item.offset;
    while(byte<text.size()&&units<item.offset){const auto c=uint8_t(text[byte]);const size_t length=c<0x80?1:c<0xe0?2:c<0xf0?3:4;require(byte+length<=text.size(),wire::statuses::invalidValue);byte+=length;units+=length==4?2:1;}
    require(units==item.offset&&byte+3<=text.size()&&uint8_t(text[byte])==0xef&&uint8_t(text[byte+1])==0xbf&&uint8_t(text[byte+2])==0xbc,wire::statuses::invalidValue);
  }
}
inline Writer paragraphBytes(const ParagraphOptions& value){
  const size_t locale=(value.locale.size()+7)/8*8,ellipsis=(value.ellipsis.size()+7)/8*8,family=(value.fontFamily.size()+7)/8*8;
  const auto join=[](const std::vector<std::string>& values){std::string names;for(const auto& name:values){if(!names.empty())names+='\0';names+=name;}return names;};
  const auto strutNames=value.strut?join(value.strut->fontFamilies):std::string{};
  const auto strutLength=value.strut?wire::paragraphStrutBytes+paragraphAligned(strutNames.size()):0;
  size_t total=wire::paragraphBytes+locale+ellipsis+family+strutLength+value.placeholders.size()*wire::paragraphPlaceholderBytes;
  for(const auto& run:value.runs){size_t names=run.fontFamilies.size()-1;for(const auto& name:run.fontFamilies)names+=name.size();total+=wire::paragraphRunBytes+paragraphAligned(names)+paragraphAligned(run.locale.size())+run.features.size()*8+run.variations.size()*16+run.shadows.size()*32;}
  Writer data(total);
  data.u32(0,value.flags);data.u32(4,value.align);data.u32(8,value.maxLines);
  data.u32(12,uint32_t(value.locale.size()));data.u32(16,uint32_t(value.ellipsis.size()));
  data.u32(20,uint32_t(value.fontFamily.size()));
  if(value.fontWeight!=400)data.u32(24,value.fontWeight);
  data.u32(28,uint32_t(value.runs.size()));
  data.u32(56,uint32_t(strutLength));data.u32(60,uint32_t(value.placeholders.size()));
  data.f64(32,value.height);data.f64(40,value.letterSpacing);data.f64(48,value.wordSpacing);
  std::memcpy(data.bytes.data()+wire::paragraphBytes,value.locale.data(),value.locale.size());
  std::memcpy(data.bytes.data()+wire::paragraphBytes+locale,value.ellipsis.data(),value.ellipsis.size());
  std::memcpy(data.bytes.data()+wire::paragraphBytes+locale+ellipsis,value.fontFamily.data(),value.fontFamily.size());
  size_t offset=wire::paragraphBytes+locale+ellipsis+family;
  if(value.strut){const auto& strut=*value.strut;data.u32(offset,strut.flags);data.u32(offset+4,strut.fontWeight);data.u32(offset+8,uint32_t(strutNames.size()));data.u32(offset+12,uint32_t(strut.fontFamilies.size()));data.f64(offset+16,strut.fontSize);data.f64(offset+24,strut.height);data.f64(offset+32,strut.leading);
    std::memcpy(data.bytes.data()+offset+wire::paragraphStrutBytes,strutNames.data(),strutNames.size());offset+=strutLength;}
  for(const auto& item:value.placeholders){data.u32(offset,item.offset);data.u32(offset+4,item.alignment);data.u32(offset+8,item.baseline);data.f64(offset+16,item.width);data.f64(offset+24,item.height);data.f64(offset+32,item.baselineOffset);offset+=wire::paragraphPlaceholderBytes;}
  for(const auto& run:value.runs){
    std::string names;for(const auto& name:run.fontFamilies){if(!names.empty())names+='\0';names+=name;}
    data.u32(offset,run.start);data.u32(offset+4,run.end);data.u32(offset+8,run.color);data.u32(offset+12,run.backgroundColor);data.u32(offset+16,run.flags);data.u32(offset+20,run.fontWeight);
    data.u32(offset+24,uint32_t(names.size()));data.u32(offset+28,uint32_t(run.locale.size()));data.f64(offset+32,run.fontSize);data.f64(offset+40,run.height);
    data.f64(offset+48,run.letterSpacing);data.f64(offset+56,run.wordSpacing);data.f64(offset+64,run.decorationThickness);data.u32(offset+72,run.decoration);data.u32(offset+76,run.decorationStyle);data.u32(offset+80,run.decorationColor);data.u32(offset+84,uint32_t(run.fontFamilies.size()));
    data.u32(offset+88,uint32_t(run.features.size()));data.u32(offset+92,uint32_t(run.variations.size()));data.u32(offset+96,uint32_t(run.shadows.size()));
    offset+=wire::paragraphRunBytes;std::memcpy(data.bytes.data()+offset,names.data(),names.size());offset+=paragraphAligned(names.size());
    std::memcpy(data.bytes.data()+offset,run.locale.data(),run.locale.size());offset+=paragraphAligned(run.locale.size());
    for(const auto& feature:run.features){data.u32(offset,feature.tag);data.u32(offset+4,feature.value);offset+=8;}
    for(const auto& variation:run.variations){data.u32(offset,variation.tag);data.f64(offset+8,variation.value);offset+=16;}
    for(const auto& shadow:run.shadows){data.u32(offset,shadow.color);data.f64(offset+8,shadow.x);data.f64(offset+16,shadow.y);data.f64(offset+24,shadow.sigma);offset+=32;}
  }
  return data;
}
}
