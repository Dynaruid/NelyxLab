// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "app_text.hpp"
#include "jsi_packet.hpp"

namespace nelyx::v2::native {
namespace app_text_jsi {
namespace jsi=facebook::jsi;
using Packet=::nelyx::v2::native::Packet;
inline jsi::Object rect(jsi::Runtime& rt,const SkRect& value) {
  jsi::Object result(rt);result.setProperty(rt,"x",double(value.left()));result.setProperty(rt,"y",double(value.top()));
  result.setProperty(rt,"width",double(value.width()));result.setProperty(rt,"height",double(value.height()));return result;
}
inline jsi::Object range(jsi::Runtime& rt,size_t start,size_t end) {
  jsi::Object result(rt);result.setProperty(rt,"start",double(start));result.setProperty(rt,"end",double(end));return result;
}
inline jsi::Object glyph(jsi::Runtime& rt,const skia::textlayout::Paragraph::GlyphInfo& info,bool ellipsis) {
  auto result=range(rt,info.fGraphemeClusterTextRange.start,info.fGraphemeClusterTextRange.end);
  result.setProperty(rt,"bounds",rect(rt,info.fGraphemeLayoutBounds));
  result.setProperty(rt,"direction",info.fDirection==skia::textlayout::TextDirection::kRtl?"rtl":"ltr");
  if(ellipsis)result.setProperty(rt,"isEllipsis",info.fIsEllipsis);return result;
}
inline jsi::Object geometry(jsi::Runtime& rt,AppParagraphs& service,const AppParagraphs::Entry& entry) {
  auto& p=*entry.paragraph;jsi::Object result(rt);
  result.setProperty(rt,"width",double(p.getMaxWidth()));result.setProperty(rt,"height",double(p.getHeight()));
  result.setProperty(rt,"alphabeticBaseline",double(p.getAlphabeticBaseline()));result.setProperty(rt,"ideographicBaseline",double(p.getIdeographicBaseline()));
  result.setProperty(rt,"minIntrinsicWidth",double(p.getMinIntrinsicWidth()));result.setProperty(rt,"maxIntrinsicWidth",double(p.getMaxIntrinsicWidth()));
  result.setProperty(rt,"longestLine",double(p.getLongestLine()));result.setProperty(rt,"overflow",p.didExceedMaxLines());
  result.setProperty(rt,"unresolvedGlyphs",double(p.unresolvedGlyphs()));
  std::vector<skia::textlayout::LineMetrics> lines;p.getLineMetrics(lines);jsi::Array array(rt,lines.size());
  for(size_t i=0;i<lines.size();++i){const auto& line=lines[i];
    auto item=range(rt,service.lineOffset(entry,line.fStartIndex),service.lineOffset(entry,line.fEndIndex));
    item.setProperty(rt,"baseline",line.fBaseline);item.setProperty(rt,"height",line.fHeight);
    item.setProperty(rt,"bounds",rect(rt,SkRect::MakeXYWH(float(line.fLeft),float(line.fBaseline-line.fAscent),float(line.fWidth),float(line.fAscent+line.fDescent))));
    jsi::Object metrics(rt);metrics.setProperty(rt,"hardBreak",line.fHardBreak);metrics.setProperty(rt,"ascent",line.fAscent);
    metrics.setProperty(rt,"descent",line.fDescent);metrics.setProperty(rt,"unscaledAscent",line.fUnscaledAscent);
    metrics.setProperty(rt,"height",line.fHeight);metrics.setProperty(rt,"width",line.fWidth);metrics.setProperty(rt,"left",line.fLeft);
    metrics.setProperty(rt,"baseline",line.fBaseline);metrics.setProperty(rt,"lineNumber",double(line.fLineNumber));
    item.setProperty(rt,"metrics",std::move(metrics));array.setValueAtIndex(rt,i,std::move(item));
  }
  result.setProperty(rt,"lines",std::move(array));
  const auto placeholders=p.getRectsForPlaceholders();if(placeholders.size()>entry.placeholderCount)throw jsi::JSError(rt,"Unexpected App placeholder geometry");
  if(!placeholders.empty()){jsi::Array boxes(rt,placeholders.size()),directions(rt,placeholders.size());
    for(size_t i=0;i<placeholders.size();++i){boxes.setValueAtIndex(rt,i,rect(rt,placeholders[i].rect));directions.setValueAtIndex(rt,i,placeholders[i].direction==skia::textlayout::TextDirection::kRtl?"rtl":"ltr");}
    result.setProperty(rt,"placeholderBoxes",std::move(boxes));result.setProperty(rt,"placeholderDirections",std::move(directions));}
  return result;
}
inline AppTextInput input(const Packet& packet) {
  AppTextInput result;result.text=packet.field("text").string(16384);result.width=packet.field("width").number();
  if(packet.field("unbounded").boolean())result.width=INFINITY;
  result.fontSize=packet.field("fontSize").number();auto color=packet.field("color").counter();
  auto direction=packet.field("textDirection").counter();if(color>0xffffffff||direction>1)packet.fail();result.color=uint32_t(color);result.direction=uint32_t(direction);
  const auto data=packet.field("paragraphData").array(wire::limits::packetBytes);std::vector<uint8_t> bytes(data.size());
  for(size_t i=0;i<data.size();++i){const auto value=data[i].counter();if(value>255)packet.fail();bytes[i]=uint8_t(value);}
  result.options=readParagraph({bytes.data(),bytes.size()});return result;
}
inline uint32_t offset(const Packet& p) {const auto value=p.counter();if(value>0xffffffff)p.fail();return uint32_t(value);}
inline jsi::Value call(jsi::Runtime& rt,AppParagraphs& service,const jsi::Value* args,size_t count) {
  if(count!=4)throw jsi::JSError(rt,"App text service arguments");
  const auto operation=Packet(rt,jsi::Value(rt,args[0])).string(32);
  const auto owner=Packet(rt,jsi::Value(rt,args[1])).counter(),handle=Packet(rt,jsi::Value(rt,args[2])).counter();
  auto payload=Packet(rt,jsi::Value(rt,args[3]));
  if(operation=="open"){if(owner||handle)payload.fail();return double(service.open());}
  if(operation=="snapshot"||operation=="fontFamilies"){
    if(operation=="fontFamilies"&&!handle)payload.fail();
#if defined(__ANDROID__)
    if(!service.snapshot(owner).closed)service.prepareFonts(owner);
#endif
    const auto& state=service.snapshot(owner);const auto generation=handle?service.fontGeneration(owner,handle):state.generation;
    std::set<std::string> families;
    if(generation)for(const auto& face:generation->provider->faces)families.insert(face.first);
    else for(const auto* family:{"NelyxDefault","NelyxArabic","NelyxHebrew","NelyxEmoji"})families.insert(family);
    jsi::Array names(rt,families.size());size_t index=0;for(const auto& name:families)names.setValueAtIndex(rt,index++,jsi::String::createFromUtf8(rt,name));
    if(operation=="fontFamilies")return names;
    jsi::Object result(rt);result.setProperty(rt,"version",12);result.setProperty(rt,"fontRevision",double(handle?handle:state.fontRevision));
    result.setProperty(rt,"fontFamilies",std::move(names));result.setProperty(rt,"fontCatalogs",double(service.fontCatalogs()));
    result.setProperty(rt,"fontStages",state.stage?1:0);result.setProperty(rt,"fontLoads",double(state.fontLoads));
    uint64_t fontBufferBytes=0;for(const auto& [token,memory]:state.fontBuffers)fontBufferBytes+=memory->bytes;
    result.setProperty(rt,"fontBuffers",double(state.fontBuffers.size()));result.setProperty(rt,"fontBufferBytes",double(fontBufferBytes));
    uint64_t assetBufferBytes=0,assetDataBytes=0;for(const auto& [token,asset]:state.assets){assetBufferBytes+=asset.memory->bytes;assetDataBytes+=asset.size;}
    result.setProperty(rt,"assetBuffers",double(state.assets.size()));result.setProperty(rt,"assetBufferBytes",double(assetBufferBytes));
    result.setProperty(rt,"assetDataBytes",double(assetDataBytes));result.setProperty(rt,"assetLoads",double(state.assetLoads));
    result.setProperty(rt,"assetNativeReads",double(state.assetReads));result.setProperty(rt,"assetNativeReadBytes",double(state.assetReadBytes));
    uint64_t networkRequests=state.networkRequests,networkReadBytes=state.networkReadBytes;
    for(const auto& [token,request]:state.networks){const auto network=request->snapshot();networkRequests+=network.requests;networkReadBytes+=network.bytes;}
    result.setProperty(rt,"networkBuffers",double(state.networks.size()));result.setProperty(rt,"networkBufferBytes",double(state.networks.size()*AppHttpRequest::creditBytes));
    result.setProperty(rt,"networkRequests",double(networkRequests));result.setProperty(rt,"networkReadBytes",double(networkReadBytes));
    result.setProperty(rt,"immutableBuffers",double(state.buffers.size()));result.setProperty(rt,"immutableBufferBytes",double(service.bufferCreditBytes(state)));
    result.setProperty(rt,"immutableBufferDataBytes",double(service.bufferDataBytes(state)));result.setProperty(rt,"immutableBufferCopies",double(state.bufferCopies));
    result.setProperty(rt,"immutableBufferCopyBytes",double(state.bufferCopyBytes));result.setProperty(rt,"immutableBufferReads",double(state.bufferReads));
    result.setProperty(rt,"immutableBufferReadBytes",double(state.bufferReadBytes));result.setProperty(rt,"immutableBufferFileReads",double(state.bufferFileReads));
    result.setProperty(rt,"immutableBufferFileBytes",double(state.bufferFileBytes));
    result.setProperty(rt,"layouts",double(state.layouts));result.setProperty(rt,"queries",double(state.queries));
    result.setProperty(rt,"paragraphs",double(state.entries.size()));result.setProperty(rt,"reservedBytes",double(service.reservedBytes()));
    result.setProperty(rt,"heapBytes",0);result.setProperty(rt,"closed",state.closed);result.setProperty(rt,"fontFamiliesVersion",1);return result;
  }
  if(operation=="prepareFonts"||operation=="fontFamily"){
    if(handle)payload.fail();auto buffer=args[3].getObject(rt).getPropertyAsObject(rt,"bytes").getArrayBuffer(rt);
    const auto at=payload.field("offset").counter(),size=payload.field("length").counter();
    if(size>fontCatalogLimit||at>buffer.size(rt)||size>buffer.size(rt)-at)payload.fail();
    if(operation=="fontFamily")return jsi::String::createFromUtf8(rt,service.fontFamily(owner,Reader{buffer.data(rt)+at,size_t(size)}));
    return double(service.prepareFonts(owner,Reader{buffer.data(rt)+at,size_t(size)}));
  }
  if(operation=="reserveFontBytes"){if(handle)payload.fail();return double(service.reserveFontBytes(owner,payload.counter()));}
  if(operation=="releaseFontBytes"){service.releaseFontBytes(owner,handle);return jsi::Value::undefined();}
  if(operation=="reserveAssetBytes"){if(handle)payload.fail();return double(service.reserveAssetBytes(owner,payload.counter()));}
  if(operation=="resizeAssetBytes"){service.resizeAssetBytes(owner,handle,payload.counter());return jsi::Value::undefined();}
  if(operation=="finishAssetLoad"){
    const auto size=payload.field("size");service.finishAssetLoad(owner,handle,payload.field("delivered").boolean(),size.absent()?std::nullopt:std::optional<uint64_t>(size.counter()));return jsi::Value::undefined();
  }
  if(operation=="openNetwork"){
    if(handle)payload.fail();const auto memory=service.reserveNetworkMetadata(owner);const auto headers=payload.field("headers");return double(service.openNetwork(owner,payload.field("baseUrl").string(4096),payload.field("key").string(4096),headers.absent()?std::string{}:headers.string(16384)));
  }
  if(operation=="pollNetwork"){
    const auto state=service.network(owner,handle)->snapshot();jsi::Object result(rt);
    result.setProperty(rt,"phase",double(state.phase));result.setProperty(rt,"status",double(state.status));result.setProperty(rt,"error",double(state.error));
    result.setProperty(rt,"size",double(state.size));result.setProperty(rt,"bytes",double(state.bytes));result.setProperty(rt,"requests",double(state.requests));
    result.setProperty(rt,"closed",state.closed);return result;
  }
  if(operation=="readNetwork"){service.network(owner,handle)->read();return jsi::Value::undefined();}
  if(operation=="networkChunk"){
    const auto request=service.network(owner,handle);const auto chunk=request->chunk();
    auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(chunk.bytes.size())).getObject(rt);
    auto buffer=array.getArrayBuffer(rt);if(!chunk.bytes.empty())std::memcpy(buffer.data(rt),chunk.bytes.data(),chunk.bytes.size());return array;
  }
  if(operation=="cancelNetwork"){service.cancelNetwork(owner,handle);return jsi::Value::undefined();}
  if(operation=="retireNetwork")return service.retireNetwork(owner,handle);
  if(operation=="assetSize"){if(handle)payload.fail();return double(service.assetSize(owner,payload.string(1024)));}
  if(operation=="readAsset"){
    const auto bytes=service.readAsset(owner,handle,payload.string(1024));
    auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(bytes.size())).getObject(rt);
    auto buffer=array.getArrayBuffer(rt);if(!bytes.empty())std::memcpy(buffer.data(rt),bytes.data(),bytes.size());return array;
  }
  if(operation=="createBuffer"||operation=="bufferFromAsset"||operation=="bufferFromFile"){
    if(handle)payload.fail();uint64_t id=0;
    if(operation=="createBuffer"){
      auto buffer=args[3].getObject(rt).getPropertyAsObject(rt,"bytes").getArrayBuffer(rt);
      const auto at=payload.field("offset").counter(),size=payload.field("length").counter();
      if(size>wire::limits::resourceBytes||at>buffer.size(rt)||size>buffer.size(rt)-at)payload.fail();
      id=service.createBuffer(owner,Reader{size?buffer.data(rt)+at:nullptr,size_t(size)});
    }else id=operation=="bufferFromAsset"?service.bufferFromAsset(owner,payload.string(1024)):service.bufferFromFile(owner,payload.string(4096));
    try{jsi::Object result(rt);result.setProperty(rt,"handle",double(id));result.setProperty(rt,"length",double(service.buffer(owner,id)->bytes->size()));return result;}
    catch(...){service.releaseBuffer(owner,id);throw;}
  }
  if(operation=="retainBuffer")return double(service.retainBuffer(owner,handle));
  if(operation=="imageDescriptor"){
    const auto raw=payload.field("raw");std::optional<AppImages::Raw> options;
    if(!raw.absent()){
      const auto width=raw.field("width").counter(),height=raw.field("height").counter();AppImages::dimensions(width,height);
      const auto format=raw.field("pixelFormat").string(16);if(format!="rgba8888"&&format!="bgra8888")raw.fail();
      options=AppImages::Raw{int(width),int(height),raw.field("rowBytes").counter(),format=="bgra8888"};
    }
    auto& images=service.images(owner);const auto id=images.createDescriptor(service.buffer(owner,handle),options);
    try{const auto value=images.descriptor(id);jsi::Object result(rt);result.setProperty(rt,"handle",double(id));
      result.setProperty(rt,"width",value->width);result.setProperty(rt,"height",value->height);result.setProperty(rt,"bytesPerPixel",value->bytesPerPixel);return result;}
    catch(...){images.releaseDescriptor(id);throw;}
  }
  if(operation=="reserveImageReadback"){if(handle)payload.fail();return double(service.images(owner).reserveReadback(payload.counter()));}
  if(operation=="reserveImageScene"){if(handle)payload.fail();return double(service.images(owner).reserveScene(payload.counter()));}
  if(operation=="releaseImageScene"){service.images(owner).releaseScene(handle);return jsi::Value::undefined();}
  if(operation=="finishImageReadback"){service.images(owner).finishReadback(handle,payload.boolean());return jsi::Value::undefined();}
  if(operation=="imageCodec"){
    auto& images=service.images(owner);const auto id=images.instantiateCodec(handle,payload.field("width").counter(),payload.field("height").counter());
    try{const auto value=images.codec(id);jsi::Object result(rt);result.setProperty(rt,"handle",double(id));
      result.setProperty(rt,"frameCount",value->frameCount);result.setProperty(rt,"repetitionCount",value->repetitionCount);return result;}
    catch(...){images.releaseCodec(id);throw;}
  }
  if(operation=="imageNextFrame"){
    auto& images=service.images(owner);const auto id=images.nextFrame(handle);
    try{const auto value=images.frame(id);jsi::Object result(rt);result.setProperty(rt,"handle",double(id));
      result.setProperty(rt,"width",value->bitmap.width());result.setProperty(rt,"height",value->bitmap.height());result.setProperty(rt,"duration",value->duration);return result;}
    catch(...){images.releaseFrame(id);throw;}
  }
  if(operation=="imageFrameChunk"){
    const auto slice=service.images(owner).chunk(handle,payload.field("offset").counter(),payload.field("length").counter());
    auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(slice.bytes.length)).getObject(rt);
    auto buffer=array.getArrayBuffer(rt);if(slice.bytes.length)std::memcpy(buffer.data(rt),slice.bytes.data,slice.bytes.length);return array;
  }
  if(operation=="releaseImageDescriptor"){service.images(owner).releaseDescriptor(handle);return jsi::Value::undefined();}
  if(operation=="releaseImageCodec"){service.images(owner).releaseCodec(handle);return jsi::Value::undefined();}
  if(operation=="releaseImageFrame"){service.images(owner).releaseFrame(handle);return jsi::Value::undefined();}
  if(operation=="imageSnapshot"){
    if(handle)payload.fail();auto& images=service.images(owner,true);jsi::Object result(rt);result.setProperty(rt,"version",2);
    result.setProperty(rt,"sceneBuffers",double(images.scenes.size()));result.setProperty(rt,"sceneDataBytes",double(images.sceneDataBytes()));
    result.setProperty(rt,"sceneCreditBytes",double(images.sceneCreditBytes()));result.setProperty(rt,"sceneSnapshotCreates",double(images.sceneSnapshotCreates));
    result.setProperty(rt,"descriptors",double(images.descriptors.size()));result.setProperty(rt,"codecs",double(images.codecs.size()));
    result.setProperty(rt,"frames",double(images.frames.size()));result.setProperty(rt,"reservedBytes",double(images.reservedBytes()));
    result.setProperty(rt,"descriptorCreates",double(images.descriptorCreates));result.setProperty(rt,"codecCreates",double(images.codecCreates));
    result.setProperty(rt,"frameDecodes",double(images.frameDecodes));result.setProperty(rt,"pixelReads",double(images.pixelReads));
    result.setProperty(rt,"pixelReadBytes",double(images.pixelReadBytes));result.setProperty(rt,"encodedCopies",0);result.setProperty(rt,"encodedCopyBytes",0);result.setProperty(rt,"readbacks",double(images.readbacks.size()));result.setProperty(rt,"readbackBytes",double(images.readbackBytes()));return result;
  }
  if(operation=="releaseBuffer"){service.releaseBuffer(owner,handle);return jsi::Value::undefined();}
  if(operation=="bufferChunk"){
    const auto slice=service.bufferChunk(owner,handle,payload.field("offset").counter(),payload.field("length").counter());
    auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(slice.bytes.length)).getObject(rt);
    auto buffer=array.getArrayBuffer(rt);if(slice.bytes.length)std::memcpy(buffer.data(rt),slice.bytes.data,slice.bytes.length);return array;
  }
  if(operation=="fontChunk"){
    const auto bytes=service.fontChunk(owner,handle,payload.field("offset").counter(),payload.field("length").counter());
    auto array=rt.global().getPropertyAsFunction(rt,"ArrayBuffer").callAsConstructor(rt,double(bytes.length)).getObject(rt);
    auto buffer=array.getArrayBuffer(rt);std::memcpy(buffer.data(rt),bytes.data,bytes.length);return array;
  }
  if(operation=="activateFonts")return double(service.activateFonts(owner,handle));
  if(operation=="finishFonts"){service.finishFonts(owner,handle,payload.boolean());return jsi::Value::undefined();}
  if(operation=="close"){service.close(owner);return jsi::Value::undefined();}
  if(operation=="release"){service.release(owner,handle);return jsi::Value::undefined();}
  if(operation=="layout"){
    auto value=input(payload);const auto id=service.layout(owner,value,handle);
    try{jsi::Object result(rt);const auto& entry=service.query(owner,id,false);result.setProperty(rt,"handle",double(id));result.setProperty(rt,"fontRevision",double(entry.generation->revision));result.setProperty(rt,"geometry",geometry(rt,service,entry));return result;}
    catch(...){service.release(owner,id);throw;}
  }
  if(operation!="boxes"&&operation!="hit"&&operation!="glyph"&&operation!="closest"&&operation!="word"&&operation!="line")
    throw jsi::JSError(rt,"Unknown App text operation");
  // Validate the entire request before claiming any C++ query work.
  uint32_t a=0,b=0,height=0,width=0;double x=0,y=0;
  if(operation=="boxes"){
    a=offset(payload.field("start"));b=offset(payload.field("end"));height=offset(payload.field("height"));width=offset(payload.field("width"));
    if(height>5||width>1)payload.fail();
  }else if(operation=="hit"||operation=="closest"){
    x=payload.field("x").number();y=payload.field("y").number();
    if(std::abs(x)>1e12||std::abs(y)>1e12)payload.fail();
  }else a=offset(payload.field("offset"));
  auto& entry=service.query(owner,handle);auto& paragraph=*entry.paragraph;
  if(operation=="boxes"){
    auto boxes=paragraph.getRectsForRange(a,b,static_cast<skia::textlayout::RectHeightStyle>(height),static_cast<skia::textlayout::RectWidthStyle>(width));
    if(boxes.size()>32768/40)throw jsi::JSError(rt,"App text box geometry budget exceeded");
    jsi::Array result(rt,boxes.size());for(size_t i=0;i<boxes.size();++i){jsi::Object box(rt);box.setProperty(rt,"rect",rect(rt,boxes[i].rect));
      box.setProperty(rt,"direction",boxes[i].direction==skia::textlayout::TextDirection::kRtl?"rtl":"ltr");result.setValueAtIndex(rt,i,std::move(box));}return result;
  }
  if(operation=="hit"){
    auto hit=paragraph.getGlyphPositionAtCoordinate(float(x),float(y));jsi::Object result(rt);result.setProperty(rt,"position",double(hit.position));
    result.setProperty(rt,"affinity",hit.affinity==skia::textlayout::Affinity::kUpstream?"upstream":"downstream");return result;
  }
  if(operation=="glyph"||operation=="closest"){
    skia::textlayout::Paragraph::GlyphInfo info;const bool found=operation=="glyph"?
      paragraph.getGlyphInfoAtUTF16Offset(a,&info):paragraph.getClosestUTF16GlyphInfoAt(float(x),float(y),&info);
    if(!found)return jsi::Value::null();return glyph(rt,info,operation=="glyph");
  }
  if(operation=="word"){const auto result=paragraph.getWordBoundary(a);return range(rt,result.start,result.end);}
  const int line=paragraph.getLineNumberAtUTF16Offset(a);
  if(a>=entry.text.size()||line<0)return jsi::Value::null();return double(line);
}
}
inline void installAppText(facebook::jsi::Runtime& rt,facebook::jsi::Object& native,AppParagraphs& service) {
  namespace jsi=facebook::jsi;
  native.setProperty(rt,"appTextVersion",12);
  native.setProperty(rt,"appImageVersion",2);
  native.setProperty(rt,"appNetworkVersion",2);
  native.setProperty(rt,"appText",jsi::Function::createFromHostFunction(rt,jsi::PropNameID::forAscii(rt,"appText"),4,
    [&service](jsi::Runtime& runtime,const jsi::Value&,const jsi::Value* args,size_t count)->jsi::Value{
      try{return app_text_jsi::call(runtime,service,args,count);}
      catch(const Error& error){throw jsi::JSError(runtime,"App paragraph unified memory/packet rejection: "+std::to_string(error.status));}
      catch(const jsi::JSError&){throw;}
      catch(const std::exception& error){throw jsi::JSError(runtime,error.what());}
    }));
}
}
