// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "paragraph_provider.hpp"
#ifdef __ANDROID__
#include "../android/app_http.hpp"
#else
#include "../windows/app_http.hpp"
namespace nelyx::v2::native { using ::nelyx::v2::windows::AppHttpRequest; }
#endif
#include "app_images.hpp"
#include "../../core/interaction/editing.hpp"
#include <map>
#include <algorithm>
#include <fstream>
#include <functional>
#include <set>

namespace nelyx::v2::native {
struct AppTextInput {
  std::string text;
  double width=0,fontSize=14;
  uint32_t color=0xffeef5ff,direction=0;
  ParagraphOptions options;
};
/** App-thread-only owner. It never submits work to or waits for Content/UI. */
class AppParagraphs {
 public:
  static constexpr uint64_t quota=320*1024*1024;
  struct Generation {uint64_t revision=1;std::shared_ptr<ParagraphProvider> provider;};
  struct FontStage {uint64_t token=0;bool active=false;std::shared_ptr<Generation> candidate,previous;
    std::unique_ptr<ExternalLease> memory;std::vector<uint8_t> bytes;};
  struct Entry {
    std::unique_ptr<ExternalLease> memory;
    std::shared_ptr<Generation> generation;
    std::u16string text;
    std::unique_ptr<skia::textlayout::Paragraph> paragraph;
    size_t placeholderCount=0;
  };
  using ImmutableData=AppImmutableData;
  struct BufferSlice {std::shared_ptr<ImmutableData> storage;Reader bytes;};
  struct Owner {
    uint64_t layouts=0,queries=0,fontRevision=1,nextRevision=1,fontLoads=0;
    bool closed=false;
    std::shared_ptr<Generation> generation;
    std::optional<FontStage> stage;
    std::map<uint64_t,std::unique_ptr<ExternalLease>> fontBuffers;
    struct Asset {uint64_t size;bool reading=false,delivered=false;std::unique_ptr<ExternalLease> memory;};
    std::map<uint64_t,Asset> assets;
    uint64_t assetLoads=0,assetReads=0,assetReadBytes=0;
    std::map<uint64_t,std::shared_ptr<AppHttpRequest>> networks;
    uint64_t networkRequests=0,networkReadBytes=0;
    std::map<uint64_t,std::shared_ptr<ImmutableData>> buffers;
    std::vector<std::weak_ptr<ImmutableData>> bufferAllocations;
    uint64_t bufferCopies=0,bufferCopyBytes=0,bufferReads=0,bufferReadBytes=0,bufferFileReads=0,bufferFileBytes=0;
    std::unique_ptr<AppImages> images;
    std::map<uint64_t,Entry> entries;
  };
 private:
  std::string font,icu,assetRoot;
  bool bundledAssetAliases=false;
  std::shared_ptr<Ledger> ledger;
  std::shared_ptr<ParagraphProvider> provider;
  std::vector<std::weak_ptr<ParagraphProvider>> fontProviders;
  std::map<uint64_t,Owner> owners;
  uint64_t nextOwner=0,nextParagraph=0,nextStage=0,nextFontBuffer=0,paragraphBytes=0;
  size_t paragraphCount=0;
  Owner& current(uint64_t owner) {
    const auto found=owners.find(owner);
    if(found==owners.end()||found->second.closed)throw std::runtime_error("App paragraph owner is foreign/closed");
    return found->second;
  }
  void ensureProvider(Owner& state){
    if(!provider)provider=std::make_shared<ParagraphProvider>(font,icu,ledger,6);
    if(!state.generation)state.generation=std::make_shared<Generation>(Generation{state.fontRevision,provider});
  }
  FontStage& stageFor(Owner& state,uint64_t token){
    if(!state.stage||state.stage->token!=token)throw std::runtime_error("App font stage is foreign/retired");
    return *state.stage;
  }
 public:
  AppParagraphs(std::string font,std::string icu,std::shared_ptr<Ledger> ledger,
      std::string assets="",bool bundled=false)
    :font(std::move(font)),icu(std::move(icu)),assetRoot(std::move(assets)),bundledAssetAliases(bundled),ledger(std::move(ledger)){}
  ~AppParagraphs(){for(auto& [id,owner]:owners)for(auto& [token,request]:owner.networks)try{request->cancel();}catch(...){}}
  std::filesystem::path assetPath(const std::string& name)const {
    if(name.empty()||name.size()>1024||assetRoot.empty())throw std::runtime_error("App asset source/key is unavailable");
    for(unsigned char c:name)if(c<32||c==127||c=='\\'||c==':'||c=='?'||c=='*'||c=='\"'||c=='<'||c=='>'||c=='|')
      throw std::runtime_error("Invalid application asset name");
    size_t at=0;while(at<=name.size()){
      const auto end=name.find('/',at);const auto part=name.substr(at,end==std::string::npos?name.size()-at:end-at);
      if(part.empty()||part=="."||part==".."||part.back()=='.'||part.back()==' ')throw std::runtime_error("Invalid application asset name");
      if(end==std::string::npos)break;at=end+1;
    }
    const auto root=std::filesystem::canonical(std::filesystem::u8path(assetRoot));
    if(bundledAssetAliases&&name!="image")throw std::runtime_error("Unknown bundled application asset");
    const auto file=std::filesystem::canonical(root/std::filesystem::u8path(bundledAssetAliases?"image.webp":name)),relative=file.lexically_relative(root);
    if(relative.empty()||relative.is_absolute()||*relative.begin()==".."||!std::filesystem::is_regular_file(file))
      throw std::runtime_error("Invalid application asset path");
    return file;
  }
  uint64_t assetSize(uint64_t owner,const std::string& name){
    current(owner);const auto size=std::filesystem::file_size(assetPath(name));
    if(size>wire::limits::resourceBytes)throw std::runtime_error("App asset byte budget exceeded");return size;
  }
  uint64_t reserveAssetBytes(uint64_t owner,uint64_t size){
    auto& state=current(owner);uint64_t total=0;for(const auto& [id,asset]:state.assets)total+=asset.size;
    const auto held=reservedBytes(),bytes=3*size+65536;
    if(size>wire::limits::resourceBytes||total>wire::limits::resourceBytes-size||state.assets.size()>=64||
      nextFontBuffer>=9007199254740991ull||held>quota||bytes>quota-held)
      throw std::runtime_error("App asset count/byte/memory budget exceeded");
    auto memory=std::make_unique<ExternalLease>(ledger,6,4,bytes);const auto token=++nextFontBuffer;
    state.assets.emplace(token,Owner::Asset{size,false,false,std::move(memory)});return token;
  }
  void resizeAssetBytes(uint64_t owner,uint64_t token,uint64_t size){
    auto& state=current(owner);const auto found=state.assets.find(token);
    if(found==state.assets.end()||found->second.delivered||size>wire::limits::resourceBytes)throw std::runtime_error("App asset resize is foreign/delivered/outside budget");
    auto& asset=found->second;uint64_t total=0;for(const auto& [id,value]:state.assets)total+=value.size;
    const auto held=reservedBytes(),bytes=3*size+65536,before=asset.memory->bytes;
    if(total-asset.size>wire::limits::resourceBytes-size||held>quota||(bytes>before&&bytes-before>quota-held))
      throw std::runtime_error("App asset resize budget exceeded");
    if(bytes>before)ledger->adjust(6,4,bytes-before,false);else ledger->adjust(6,4,before-bytes,true);
    asset.memory->bytes=bytes;asset.size=size;
  }
  void finishAssetLoad(uint64_t owner,uint64_t token,bool delivered,std::optional<uint64_t> size=std::nullopt){
    auto& state=current(owner);const auto found=state.assets.find(token);
    if(found==state.assets.end()||found->second.delivered)throw std::runtime_error("App asset credit is foreign/already delivered");
    if(size&&*size!=found->second.size)throw std::runtime_error("App asset final size differs from admitted credit");
    if(delivered){
      // The IO/JSI callback has returned. Only caller-owned JS data remains;
      // its credit stays held until this App realm terminates.
      auto& asset=found->second;const auto bytes=asset.size+65536;
      ledger->adjust(6,4,asset.memory->bytes-bytes,true);asset.memory->bytes=bytes;
      asset.delivered=true;++state.assetLoads;
    }else state.assets.erase(found);
  }
  std::unique_ptr<ExternalLease> reserveNetworkMetadata(uint64_t owner){
    current(owner);if(reservedBytes()>quota-65536)throw std::runtime_error("App HTTP metadata quota exceeded");return std::make_unique<ExternalLease>(ledger,6,4,65536);
  }
  uint64_t openNetwork(uint64_t owner,const std::string& base,const std::string& key,const std::string& headers={}){
    auto& state=current(owner);const auto held=reservedBytes();
    if(state.networks.size()>=32||nextFontBuffer>=9007199254740991ull||held>quota||AppHttpRequest::creditBytes>quota-held)
      throw std::runtime_error("App HTTP request count/memory budget exceeded");
    auto request=std::make_shared<AppHttpRequest>(ledger);const auto token=++nextFontBuffer;
    state.networks.emplace(token,request);
    try{request->start(base,key,headers);}catch(...){state.networks.erase(token);throw;}
    return token;
  }
  const std::shared_ptr<AppHttpRequest>& network(uint64_t owner,uint64_t token){
    auto& state=current(owner);const auto found=state.networks.find(token);
    if(found==state.networks.end())throw std::runtime_error("App HTTP request is foreign/retired");
    return found->second;
  }
  void cancelNetwork(uint64_t owner,uint64_t token){network(owner,token)->cancel();}
  bool retireNetwork(uint64_t owner,uint64_t token){
    auto& state=current(owner);const auto found=state.networks.find(token);
    if(found==state.networks.end())throw std::runtime_error("App HTTP request is foreign/retired");
    const auto value=found->second->snapshot();
    if(!value.closed||found->second.use_count()!=1)return false;
    state.networkRequests+=value.requests;state.networkReadBytes+=value.bytes;state.networks.erase(found);return true;
  }
  uint64_t bufferDataBytes(const Owner& state)const {
    uint64_t size=0;
    for(const auto& weak:state.bufferAllocations)if(const auto value=weak.lock())size+=value->bytes->size();
    return size;
  }
  uint64_t bufferCreditBytes(const Owner& state)const {
    uint64_t size=0;
    for(const auto& weak:state.bufferAllocations)if(const auto value=weak.lock())size+=value->memory->bytes;
    return size;
  }
  uint64_t makeBuffer(uint64_t owner,uint64_t size,const std::function<sk_sp<SkData>()>& capture){
    auto& state=current(owner);std::erase_if(state.bufferAllocations,[](const auto& value){return value.expired();});
    const auto held=reservedBytes(),credit=2*size+65536,total=bufferDataBytes(state);
    if(size>wire::limits::resourceBytes||total>wire::limits::resourceBytes-size||state.buffers.size()>=64||state.bufferAllocations.size()>=64||
      nextFontBuffer>=9007199254740991ull||held>quota||credit>quota-held)
      throw std::runtime_error("App immutable buffer count/byte/memory budget exceeded");
    auto value=std::make_shared<ImmutableData>();
    value->memory=std::make_unique<ExternalLease>(ledger,6,4,credit);
    value->bytes=capture();
    if(!value->bytes||value->bytes->size()!=size)throw std::runtime_error("App immutable buffer capture failed");
    const auto token=++nextFontBuffer;state.bufferAllocations.push_back(value);state.buffers.emplace(token,std::move(value));
    ++state.bufferCopies;state.bufferCopyBytes+=size;return token;
  }
  uint64_t createBuffer(uint64_t owner,Reader bytes){
    return makeBuffer(owner,bytes.length,[&]{return SkData::MakeWithCopy(bytes.data,bytes.length);});
  }
  uint64_t bufferFromPath(uint64_t owner,const std::filesystem::path& path){
    current(owner);if(!std::filesystem::is_regular_file(path))throw std::runtime_error("ImmutableBuffer file is unavailable");
    const auto size=std::filesystem::file_size(path);
    const auto token=makeBuffer(owner,size,[&]{
      std::vector<uint8_t> bytes(static_cast<size_t>(size));std::ifstream stream(path,std::ios::binary);
      if(!stream||(!bytes.empty()&&!stream.read(reinterpret_cast<char*>(bytes.data()),std::streamsize(bytes.size())))||stream.peek()!=std::ifstream::traits_type::eof())
        throw std::runtime_error("ImmutableBuffer file changed or could not be read");
      return SkData::MakeWithCopy(bytes.data(),bytes.size());
    });
    auto& state=current(owner);++state.bufferFileReads;state.bufferFileBytes+=size;return token;
  }
  uint64_t bufferFromAsset(uint64_t owner,const std::string& key){current(owner);return bufferFromPath(owner,assetPath(key));}
  uint64_t bufferFromFile(uint64_t owner,const std::string& name){
    if(name.empty()||name.size()>4096||name.find('\0')!=std::string::npos)throw std::runtime_error("Invalid ImmutableBuffer file path");
    return bufferFromPath(owner,std::filesystem::u8path(name));
  }
  const std::shared_ptr<ImmutableData>& buffer(uint64_t owner,uint64_t token){
    auto& state=current(owner);const auto found=state.buffers.find(token);
    if(found==state.buffers.end())throw std::runtime_error("ImmutableBuffer handle is foreign/retired");
    return found->second;
  }
  uint64_t retainBuffer(uint64_t owner,uint64_t token){
    const auto storage=buffer(owner,token);auto& state=current(owner);
    if(state.buffers.size()>=64||nextFontBuffer>=9007199254740991ull)throw std::runtime_error("ImmutableBuffer handle budget exceeded");
    const auto id=++nextFontBuffer;state.buffers.emplace(id,storage);return id;
  }
  void releaseBuffer(uint64_t owner,uint64_t token){
    if(!current(owner).buffers.erase(token))throw std::runtime_error("ImmutableBuffer handle is foreign/retired");
  }
  BufferSlice bufferChunk(uint64_t owner,uint64_t token,uint64_t offset,uint64_t size){
    const auto storage=buffer(owner,token);const auto length=storage->bytes->size();
    if(size>wire::limits::fontChunkBytes||offset>length||size>length-offset)
      throw std::runtime_error("ImmutableBuffer chunk is outside the admitted buffer");
    auto& state=current(owner);++state.bufferReads;state.bufferReadBytes+=size;
    const auto* data=static_cast<const uint8_t*>(storage->bytes->data());
    return {storage,Reader{size?data+offset:nullptr,size_t(size)}};
  }
  std::vector<uint8_t> readAsset(uint64_t owner,uint64_t token,const std::string& name){
    auto& state=current(owner);const auto found=state.assets.find(token);
    if(found==state.assets.end()||found->second.reading||found->second.delivered)
      throw std::runtime_error("App asset credit is foreign/already read");
    auto& asset=found->second;const auto file=assetPath(name);
    if(std::filesystem::file_size(file)!=asset.size)throw std::runtime_error("App asset size changed before reading");
    asset.reading=true;std::vector<uint8_t> bytes(size_t(asset.size));std::ifstream stream(file,std::ios::binary);
    if(!stream||(!bytes.empty()&&!stream.read(reinterpret_cast<char*>(bytes.data()),std::streamsize(bytes.size())))||stream.peek()!=std::ifstream::traits_type::eof())
      throw std::runtime_error("App asset changed or could not be read");
    ++state.assetReads;state.assetReadBytes+=bytes.size();return bytes;
  }
  uint64_t reservedBytes()const {
    uint64_t bytes=paragraphBytes+(provider?provider->fontMemory->bytes+provider->cacheMemory->bytes+(provider->systemFontMemory?provider->systemFontMemory->bytes:0):0);
    for(const auto& weak:fontProviders)if(const auto value=weak.lock())bytes+=value->fontMemory->bytes+value->cacheMemory->bytes;
    for(const auto& [id,owner]:owners){
      if(owner.stage)bytes+=owner.stage->memory->bytes;
      for(const auto& [token,memory]:owner.fontBuffers)bytes+=memory->bytes;
      for(const auto& [token,asset]:owner.assets)bytes+=asset.memory->bytes;
      bytes+=owner.networks.size()*AppHttpRequest::creditBytes;
      bytes+=bufferCreditBytes(owner);
      if(owner.images)bytes+=owner.images->reservedBytes();
    }
    return bytes;
  }
  AppImages& images(uint64_t owner,bool inspect=false){
    if(!inspect)current(owner);
    const auto found=owners.find(owner);if(found==owners.end())throw std::runtime_error("Unknown App image owner");auto& state=found->second;
    if(!state.images)state.images=std::make_unique<AppImages>(ledger,[this]{return reservedBytes();},nextFontBuffer);
    return *state.images;
  }
  size_t fontCatalogs()const {size_t count=provider?1:0;for(const auto& value:fontProviders)if(!value.expired())++count;return count;}
  uint64_t reserveFontBytes(uint64_t owner,uint64_t bytes){
    auto& state=current(owner);const auto held=reservedBytes();
    if(state.fontBuffers.size()>=64||nextFontBuffer>=9007199254740991ull||!bytes||
      bytes>2*fontCatalogLimit+4*wire::limits::fontChunkBytes+65536||held>quota||bytes>quota-held)
      throw std::runtime_error("App font buffer credit is invalid/budget exceeded");
    auto memory=std::make_unique<ExternalLease>(ledger,6,4,bytes);const auto token=++nextFontBuffer;
    state.fontBuffers.emplace(token,std::move(memory));return token;
  }
  void releaseFontBytes(uint64_t owner,uint64_t token){
    if(!current(owner).fontBuffers.erase(token))throw std::runtime_error("App font buffer credit is foreign/retired");
  }
  std::string fontFamily(uint64_t owner,Reader bytes){
    auto& state=current(owner);const auto held=reservedBytes(),needed=3*bytes.length+65536;
    if(bytes.length<12||bytes.length>fontCatalogLimit||held>quota||needed>quota-held)
      throw std::runtime_error("App font family input is invalid/memory quota exceeded");
    ExternalLease memory(ledger,6,4,needed);
    auto manager=provider?provider->manager:nelyx::font_services::manager();
    auto face=manager->makeFromData(SkData::MakeWithCopy(bytes.data,bytes.length));
    if(!face)throw std::runtime_error("Dynamic native font decode failed");
    ++state.fontLoads;SkString family;face->getFamilyName(&family);
    return std::string(family.c_str(),family.size());
  }
  uint64_t prepareFonts(uint64_t owner,Reader bytes){
    auto& state=current(owner);
    if(state.stage||nextStage>=9007199254740991ull)throw std::runtime_error("App font stage already pending/budget exceeded");
    // Parse and reserve before decoding. Failure never changes the active generation.
    const auto parsed=readFontCatalog(bytes);
    const uint64_t stagingBytes=2*bytes.length+4*wire::limits::fontChunkBytes+65536;
    auto base=provider?provider:std::make_shared<ParagraphProvider>(font,icu,ledger,6);
    uint64_t needed=8*1024*1024+65536;for(const auto& item:parsed.fonts)needed+=item.bytes.length*3+item.family.size()*2+256;
    const auto held=reservedBytes()+(provider?0:base->fontMemory->bytes+base->cacheMemory->bytes);
    if(held>quota||stagingBytes>quota-held||needed>quota-held-stagingBytes)throw std::runtime_error("App font catalog memory quota exceeded");
    auto memory=std::make_unique<ExternalLease>(ledger,6,4,stagingBytes);
    std::vector<uint8_t> copied(bytes.data,bytes.data+bytes.length);
    const auto catalog=readFontCatalog({copied.data(),copied.size()});
    std::erase_if(fontProviders,[](const auto& value){return value.expired();});
    auto candidate=std::make_shared<ParagraphProvider>(*base,catalog,ledger,6,&state.fontLoads);
    auto generation=std::make_shared<Generation>(Generation{0,candidate});
    auto previous=state.generation?state.generation:std::make_shared<Generation>(Generation{state.fontRevision,base});
    fontProviders.push_back(candidate);
    state.stage=FontStage{++nextStage,false,std::move(generation),previous,std::move(memory),std::move(copied)};
    if(!provider)provider=std::move(base);
    if(!state.generation)state.generation=std::move(previous);
    return nextStage;
  }
  Reader fontChunk(uint64_t owner,uint64_t token,uint64_t at,uint64_t length){
    auto& stage=stageFor(current(owner),token);
    if(!length||length>wire::limits::fontChunkBytes||at>stage.bytes.size()||length>stage.bytes.size()-at)throw std::runtime_error("Invalid App font chunk");
    return {stage.bytes.data()+at,size_t(length)};
  }
  uint64_t activateFonts(uint64_t owner,uint64_t token){
    auto& state=current(owner);auto& stage=stageFor(state,token);
    if(stage.active||state.nextRevision>=9007199254740991ull)throw std::runtime_error("App font stage activation is stale/budget exceeded");
    stage.candidate->revision=++state.nextRevision;stage.active=true;
    state.generation=stage.candidate;return state.fontRevision=state.generation->revision;
  }
  void finishFonts(uint64_t owner,uint64_t token,bool committed){
    auto& state=current(owner);auto& stage=stageFor(state,token);
    if(committed&&!stage.active)throw std::runtime_error("Unactivated App font stage cannot commit");
    if(!committed){state.generation=stage.previous;state.fontRevision=state.generation->revision;}
    state.stage.reset();
  }
  uint64_t open() {
    if(nextOwner>=8)throw std::runtime_error("App paragraph owner budget exceeded");
    owners.try_emplace(++nextOwner);return nextOwner;
  }
  void prepareFonts(uint64_t owner){auto& state=current(owner);ensureProvider(state);}
  const Owner& snapshot(uint64_t owner)const {
    const auto found=owners.find(owner);
    if(found==owners.end())throw std::runtime_error("Unknown App paragraph owner");
    return found->second;
  }
  std::shared_ptr<Generation> fontGeneration(uint64_t owner,uint64_t revision)const {
    const auto& state=snapshot(owner);
    if(state.closed||!revision||revision>9007199254740991ull)throw std::runtime_error("App font revision is foreign/retired");
    if(revision==state.fontRevision)return state.generation;
    if(state.stage){if(state.stage->previous->revision==revision)return state.stage->previous;
      if(state.stage->candidate->revision==revision)return state.stage->candidate;}
    for(const auto& [key,entry]:state.entries)if(entry.generation->revision==revision)return entry.generation;
    throw std::runtime_error("App font revision is foreign/retired");
  }
  uint64_t layout(uint64_t owner,const AppTextInput& input,uint64_t revision=0) {
    auto& state=current(owner);
    auto text=utf16({reinterpret_cast<const uint8_t*>(input.text.data()),input.text.size()});
    if(text.size()>4096||input.text.size()>16384||
        !((std::isfinite(input.width)&&input.width>=0&&input.width<=16777216)||input.width==INFINITY)||
        !std::isfinite(input.fontSize)||input.fontSize<0||input.fontSize>512||input.direction>1||
        input.options.align>wire::paragraphAlign::justify||input.options.flags>31||
        input.options.maxLines>128||input.options.fontWeight<100||input.options.fontWeight>900||
        input.options.locale.empty()||input.options.locale.size()>wire::limits::localeBytes||
        input.options.ellipsis.size()>wire::limits::ellipsisBytes||
        !(input.options.height==-1||(std::isfinite(input.options.height)&&input.options.height>=0&&input.options.height<=1e6))||
        !std::isfinite(input.options.letterSpacing)||std::abs(input.options.letterSpacing)>1e6||
        !std::isfinite(input.options.wordSpacing)||std::abs(input.options.wordSpacing)>1e6)
      throw std::runtime_error("Invalid App paragraph configuration");
    if(paragraphCount>=1024||nextParagraph>=9007199254740991ull)
      throw std::runtime_error("App paragraph resource budget exceeded");
    forParagraphRuns(input.text,input.options,[](const auto&,size_t,size_t){});
    validateParagraphPlaceholders(input.text,input.options);
    auto generation=revision?fontGeneration(owner,revision):state.generation;
    const auto allowedFamily=[&](const auto& family){if(!bundledFontFamily(family)&&(!generation||!generation->provider->hasFamily(family)))throw std::runtime_error("App paragraph font family is outside its pinned cohort");};
    if(!input.options.fontFamily.empty())allowedFamily(input.options.fontFamily);
    if(input.options.strut)for(const auto& family:input.options.strut->fontFamilies)allowedFamily(family);
    for(const auto& run:input.options.runs)for(const auto& family:run.fontFamilies)
      allowedFamily(family);
    const uint64_t bytes=65536+input.text.size()*256+input.options.metadataBytes();
    ensureProvider(state);
    if(!generation)generation=state.generation;
    if(reservedBytes()>quota||bytes>quota-reservedBytes())throw std::runtime_error("App paragraph memory quota exceeded");
    auto memory=std::make_unique<ExternalLease>(ledger,6,2,bytes);
    auto paragraph=generation->provider->build(input.text,input.fontSize,input.color,input.direction,&input.options,input.width);
    ++state.layouts;
    std::vector<skia::textlayout::LineMetrics> lines;paragraph->getLineMetrics(lines);
    if(lines.size()>128)throw std::runtime_error("App paragraph line geometry budget exceeded");
    const auto handle=++nextParagraph;
    state.entries.emplace(handle,Entry{std::move(memory),std::move(generation),std::move(text),std::move(paragraph),input.options.placeholders.size()});
    paragraphBytes+=bytes;++paragraphCount;return handle;
  }
  Entry& query(uint64_t owner,uint64_t handle,bool work=true) {
    auto& state=current(owner);const auto found=state.entries.find(handle);
    if(found==state.entries.end())throw std::runtime_error("App paragraph handle is foreign/retired");
    if(work)++state.queries;return found->second;
  }
  size_t lineOffset(const Entry& entry,size_t value)const {
    if(entry.generation->provider->lineMetricsUtf16)return value;
    const auto text=utf8(entry.text);
    if(value>text.size())throw std::runtime_error("Invalid provider line offset");
    return utf16({reinterpret_cast<const uint8_t*>(text.data()),value}).size();
  }
  void release(uint64_t owner,uint64_t handle) {
    auto& state=current(owner);const auto found=state.entries.find(handle);
    if(found==state.entries.end())throw std::runtime_error("App paragraph handle is foreign/retired");
    paragraphBytes-=found->second.memory->bytes;--paragraphCount;state.entries.erase(found);
  }
  void close(uint64_t owner) {
    auto& state=current(owner);
    if(state.images&&state.images->live())throw std::runtime_error("App image descriptors/codecs/frames/readers are still live");
    if(!state.networks.empty())throw std::runtime_error("App HTTP callbacks/requests are still pending");
    if(!state.entries.empty()||state.stage||!state.fontBuffers.empty())throw std::runtime_error("App paragraph owner still has live resources/stage/font buffers");
    if(!state.buffers.empty()||std::any_of(state.bufferAllocations.begin(),state.bufferAllocations.end(),[](const auto& value){return !value.expired();}))
      throw std::runtime_error("App immutable buffers still have live handles/readers");
    for(const auto& [token,asset]:state.assets)if(!asset.delivered)throw std::runtime_error("App asset loads are still pending");
    state.generation.reset();
    state.closed=true;
    if(std::all_of(owners.begin(),owners.end(),[](const auto& item){return item.second.closed;}))provider.reset();
  }
};
}
