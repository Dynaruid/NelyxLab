// SPDX-License-Identifier: BSD-3-Clause
#include "document.hpp"
namespace nelyx::v2 {
namespace {constexpr std::array<size_t,10> paintPathArity{0,2,2,4,6,0,5,4,12,7};}
std::shared_ptr<const NativePaint> readNativePaint(const std::shared_ptr<Ledger>& ledger,Reader bytes) {
  require(bytes.length>=wire::nativePaintHeaderBytes&&bytes.u32(4)==0&&bytes.u32(12)==0&&bytes.u32(0)<=wire::limits::nativePaintEntries&&bytes.u32(8)<=wire::limits::nativePaintExpressions&&
    bytes.u32(16)<=wire::limits::pathCommands&&!bytes.u32(20)&&
    bytes.length==wire::nativePaintHeaderBytes+size_t(bytes.u32(0))*wire::nativePaintBytes+size_t(bytes.u32(8))*wire::nativePaintExpressionBytes+size_t(bytes.u32(16))*wire::nativePaintPathCommandBytes,wire::statuses::invalidValue);
  auto paint=std::make_shared<NativePaint>(ledger,bytes.u32(0),bytes.u32(8),bytes.u32(16));
  const auto expressionAt=wire::nativePaintHeaderBytes+paint->entries.size()*wire::nativePaintBytes;
  for(size_t i=0;i<paint->expressions.size();++i){auto& e=paint->expressions[i];const auto at=expressionAt+i*wire::nativePaintExpressionBytes;
    e={bytes.u32(at),bytes.u32(at+4),bytes.u32(at+8),bytes.u32(at+12),bytes.finiteF64(at+16),false};
    require(e.op<=wire::nativePaintOperations::cos,wire::statuses::invalidValue);
    paint->frameDependent|=e.op==wire::nativePaintOperations::worldX||e.op==wire::nativePaintOperations::worldY;
    const uint32_t arity=e.op==wire::nativePaintOperations::acos||e.op==wire::nativePaintOperations::asin||e.op==wire::nativePaintOperations::cos?1u:e.op<=3||e.op>=wire::nativePaintOperations::boundedWidth?0u:(e.op==10||e.op==16?3u:2u);
    const std::array<uint32_t,3> operands{e.a,e.b,e.c};
    for(size_t j=0;j<operands.size();++j){if(j<arity)require(operands[j]<i,wire::statuses::invalidValue);else require(!operands[j],wire::statuses::invalidValue);}
    require(e.op==wire::nativePaintOperations::layoutValue?e.value>=0&&e.value<wire::limits::layoutProgramPaintValues&&std::floor(e.value)==e.value:!e.op||!e.value,wire::statuses::invalidValue);
    e.varying=e.op==3;
    for(size_t j=0;j<arity;++j)e.varying|=paint->expressions[operands[j]].varying;
  }
  const auto pathAt=expressionAt+paint->expressions.size()*wire::nativePaintExpressionBytes;
  for(size_t i=0;i<paint->paths.size();++i){auto& command=paint->paths[i];const auto at=pathAt+i*wire::nativePaintPathCommandBytes;
    command.verb=bytes.u32(at);const auto condition=bytes.u32(at+4);command.condition=condition?condition-1:UINT32_MAX;
    require(command.verb>0&&command.verb<paintPathArity.size()&&condition<=paint->expressions.size(),wire::statuses::invalidValue);
    for(size_t j=0;j<command.expressions.size();++j){const auto ref=bytes.u32(at+8+j*4);command.expressions[j]=ref;
      require(j<paintPathArity[command.verb]?ref<paint->expressions.size():ref==0,wire::statuses::invalidValue);}
    for(size_t j=56;j<wire::nativePaintPathCommandBytes;j+=8)require(!bytes.u64(at+j),wire::statuses::invalidValue);
  }
  uint32_t scope=0,pathCursor=0;bool children=false;
  for(size_t i=0;i<paint->entries.size();++i){auto& e=paint->entries[i];const auto at=wire::nativePaintHeaderBytes+i*wire::nativePaintBytes;
    e.kind=bytes.u32(at);e.flags=bytes.u32(at+4);e.color=bytes.u32(at+8);e.shadowColor=bytes.u32(at+12);
    e.reference={bytes.u32(at+16),bytes.u32(at+20)};e.shape=bytes.u32(at+24);e.clip=bytes.u32(at+28);e.strokeColor=bytes.u32(at+32);e.strokeCap=bytes.u32(at+36);
    paint->frameDependent|=bool(e.reference);
    require(e.kind>=1&&e.kind<=wire::nativePaintKinds::linearMask&&!(e.flags&~255u)&&e.shape<=2&&e.clip<=3&&e.strokeCap<=wire::nativePaintStrokeCaps::square&&
      (!e.strokeCap||e.kind==wire::nativePaintKinds::path),wire::statuses::invalidValue);
    require(!children||e.kind!=wire::nativePaintKinds::physical,wire::statuses::capabilityMissing);
    require(!(e.flags&32u)||e.kind==6,wire::statuses::invalidValue);
    require(!(e.flags&64u)||e.kind==wire::nativePaintKinds::elevationShadow,wire::statuses::invalidValue);
    require(!(e.flags&wire::nativePaintBlendFlags::srcATop)||e.kind==wire::nativePaintKinds::shape||e.kind==wire::nativePaintKinds::path,wire::statuses::invalidValue);
    e.elevation=bytes.f64(at+40);e.strokeWidth=bytes.f64(at+48);e.strokeAlign=bytes.f64(at+56);
    e.x=bytes.f64(at+64);e.y=bytes.f64(at+72);e.radius=bytes.f64(at+80);e.progress=bytes.f64(at+88);
    require(e.elevation>=0&&e.elevation<=128&&e.strokeWidth>=0&&e.strokeWidth<=512&&std::abs(e.strokeAlign)<=1e6&&
      std::abs(e.x)<=1e12&&std::abs(e.y)<=1e12&&e.radius>=-1&&e.radius<=1e6&&e.progress>=0&&e.progress<=1,wire::statuses::invalidValue);
    const bool requiredReference=e.kind==3||e.kind==4||e.kind==wire::nativePaintKinds::paragraph;
    require(requiredReference?bool(e.reference):(!e.reference||e.kind==2||e.kind==7||e.kind==8||e.kind==12||e.kind==wire::nativePaintKinds::path),wire::statuses::invalidValue);
    require(!(e.flags&16u)||(e.kind==2),wire::statuses::invalidValue);
    for(size_t j=0;j<8;++j){e.radii[j]=bytes.f64(at+96+j*8);require(e.radii[j]>=0&&e.radii[j]<=1e6,wire::statuses::invalidValue);}
    for(size_t j=160;j<256;j+=8)require(bytes.u64(at+j)==0,wire::statuses::invalidValue);
    e.geometry=bytes.u32(at+256);e.geometryFlags=bytes.u32(at+260);
    e.trackWidth=bytes.f64(at+264);e.trackHeight=bytes.f64(at+272);
    e.thumbWidth=bytes.f64(at+280);e.thumbHeight=bytes.f64(at+288);
    e.extension=bytes.f64(at+296);e.position=bytes.f64(at+304);e.inset=bytes.f64(at+312);
    e.blurSigma=bytes.f64(at+320);e.spread=bytes.f64(at+328);
    for(size_t j=0;j<e.linear.size();++j){e.linear[j]=bytes.f64(at+336+j*8);require(std::abs(e.linear[j])<=(j<4?1e6:1e12),wire::statuses::invalidValue);}
    for(size_t j=0;j<e.expressions.size();++j)e.expressions[j]=bytes.u32(at+400+j*4);
    e.repeat=bytes.finiteF64(at+456);
    require(e.geometry<=wire::nativePaintGeometryKinds::program&&e.geometryFlags<=1&&e.blurSigma>=0&&e.blurSigma<=64&&std::abs(e.spread)<=512,wire::statuses::invalidValue);
    require(e.kind==9||(!e.blurSigma&&!e.spread),wire::statuses::invalidValue);
    if(e.geometry!=wire::nativePaintGeometryKinds::linear)for(const auto value:e.linear)require(value==0,wire::statuses::invalidValue);
    if(e.geometry==wire::nativePaintGeometryKinds::program){
      require(!e.geometryFlags&&!e.trackWidth&&!e.trackHeight&&!e.thumbWidth&&!e.thumbHeight&&!e.extension&&!e.position&&!e.inset&&
        (e.kind==2||e.kind==7||e.kind==8||e.kind==9||e.kind==10||e.kind==11||e.kind==12||e.kind==wire::nativePaintKinds::path||e.kind==wire::nativePaintKinds::linearMask)&&e.repeat>=0&&std::floor(e.repeat)==e.repeat,wire::statuses::invalidValue);
      for(size_t j=0;j<e.expressions.size();++j)require((j>=4&&e.expressions[j]==UINT32_MAX)||e.expressions[j]<paint->expressions.size(),wire::statuses::invalidValue);
    }else{
      require(!e.repeat,wire::statuses::invalidValue);for(const auto ref:e.expressions)require(!ref,wire::statuses::invalidValue);
    }
    if(e.geometry==wire::nativePaintGeometryKinds::program){}
    else if(e.geometry==wire::nativePaintGeometryKinds::linear){
      require(!e.geometryFlags&&!e.trackWidth&&!e.trackHeight&&!e.thumbWidth&&!e.thumbHeight&&!e.extension&&!e.position&&!e.inset&&
        (e.kind==2||e.kind==7||e.kind==8||e.kind==9||e.kind==10||e.kind==11||e.kind==12),wire::statuses::invalidValue);
    }else if(!e.geometry)require(!e.geometryFlags&&!e.trackWidth&&!e.trackHeight&&!e.thumbWidth&&!e.thumbHeight&&!e.extension&&!e.position&&!e.inset,wire::statuses::invalidValue);
    else{
      require(e.trackWidth>0&&e.trackWidth<=8192&&e.trackHeight>0&&e.trackHeight<=8192&&
        e.thumbWidth>=0&&e.thumbWidth<=8192&&e.thumbHeight>=0&&e.thumbHeight<=8192&&
        e.extension>=0&&e.extension<=8192&&std::abs(e.position)<=4&&std::abs(e.inset)<=8192,wire::statuses::invalidValue);
      require((e.geometry==1&&(e.kind==2||e.kind==8||e.kind==10))||
        (e.geometry==2&&(e.kind==8||e.kind==9))||(e.geometry==3&&e.kind==7)||
        (e.geometry==4&&e.kind==8)||(e.geometry==5&&e.kind==7),wire::statuses::invalidValue);
      if(e.geometry==2||e.geometry==3)require(e.thumbWidth>0&&e.thumbHeight>0,wire::statuses::invalidValue);
    }
    if(e.reference&&e.kind!=3&&e.kind!=4&&e.kind!=wire::nativePaintKinds::paragraph)require(e.geometry==wire::nativePaintGeometryKinds::program,wire::statuses::invalidValue);
    if(e.kind==wire::nativePaintKinds::hitRegion)require((e.geometry==wire::nativePaintGeometryKinds::linear||
      (e.geometry==wire::nativePaintGeometryKinds::program&&e.repeat<=1))&&e.shape==0&&!e.color&&!e.strokeWidth&&!e.flags&&!e.clip,wire::statuses::invalidValue);
    e.pathStart=bytes.u32(at+464);e.pathCount=bytes.u32(at+468);e.pathFillRule=bytes.u32(at+472);
    const auto strokeExpression=bytes.u32(at+wire::nativePaintStrokeWidthExpressionField);
    require(!strokeExpression||(e.kind==wire::nativePaintKinds::path&&e.geometry==wire::nativePaintGeometryKinds::program&&strokeExpression<=paint->expressions.size()),wire::statuses::invalidValue);
    e.strokeWidthExpression=strokeExpression?strokeExpression-1:UINT32_MAX;
    if(e.kind==wire::nativePaintKinds::linearMask){
      require(children&&!scope&&i+1==paint->entries.size()&&e.geometry==wire::nativePaintGeometryKinds::program&&e.repeat==1&&!e.reference&&
        !e.flags&&!e.color&&!e.shadowColor&&!e.shape&&!e.clip&&!e.strokeWidth&&!e.strokeColor&&!e.strokeAlign&&!e.elevation&&!e.x&&!e.y&&e.radius==-1&&!e.progress&&e.expressions[13]==UINT32_MAX,wire::statuses::invalidValue);
      for(size_t j=0;j<4;++j){e.gradientExpressions[j]=bytes.u32(at+wire::nativePaintGradientExpressionField+j*4);require(e.gradientExpressions[j]>0&&e.gradientExpressions[j]<=paint->expressions.size(),wire::statuses::invalidValue);}
      for(size_t j=4;j<12;++j)require(e.expressions[j]==UINT32_MAX,wire::statuses::invalidValue);
      for(const auto radius:e.radii)require(!radius,wire::statuses::invalidValue);
      require(!bytes.u64(at+496)&&!bytes.u64(at+504),wire::statuses::invalidValue);
    }else for(size_t j=480;j<512;j+=8)require(!bytes.u64(at+j),wire::statuses::invalidValue);
    if(e.kind==wire::nativePaintKinds::path){
      require(e.pathCount>0&&e.pathStart==pathCursor&&e.pathCount<=paint->paths.size()-std::min(size_t(pathCursor),paint->paths.size())&&e.pathFillRule<=1&&
        e.geometry==wire::nativePaintGeometryKinds::program&&!e.shape&&!(e.flags&~wire::nativePaintBlendFlags::srcATop)&&!e.clip&&!e.shadowColor&&!e.strokeAlign&&!e.elevation&&!e.x&&!e.y&&e.radius==-1&&!e.progress,wire::statuses::invalidValue);
      for(const auto radius:e.radii)require(!radius,wire::statuses::invalidValue);for(size_t j=4;j<12;++j)require(e.expressions[j]==UINT32_MAX,wire::statuses::invalidValue);
      pathCursor+=e.pathCount;
    }else require(!e.pathStart&&!e.pathCount&&!e.pathFillRule,wire::statuses::invalidValue);
    if(e.kind==wire::nativePaintKinds::paragraph||e.kind==wire::nativePaintKinds::children||e.kind==wire::nativePaintKinds::save||e.kind==wire::nativePaintKinds::restore){
      require(!e.flags&&!e.color&&!e.shadowColor&&!e.shape&&!e.clip&&!e.strokeWidth&&!e.strokeColor&&!e.strokeAlign&&!e.elevation&&!e.x&&!e.y&&e.radius==-1&&!e.progress&&!e.geometry,wire::statuses::invalidValue);
      for(const auto radius:e.radii)require(!radius,wire::statuses::invalidValue);
      if(e.kind==wire::nativePaintKinds::children){require(!children&&!scope,wire::statuses::invalidValue);children=true;paint->frameDependent=true;}
      else if(e.kind==wire::nativePaintKinds::save)require(++scope<=wire::limits::depth,wire::statuses::invalidValue);
      else if(e.kind==wire::nativePaintKinds::restore){require(scope>0,wire::statuses::invalidValue);--scope;}
    }
  }
  require(!scope,wire::statuses::invalidValue);
  require(pathCursor==paint->paths.size(),wire::statuses::invalidValue);
  require(std::count_if(paint->entries.begin(),paint->entries.end(),[](const auto& entry){return entry.kind==wire::nativePaintKinds::hitRegion;})<=1,wire::statuses::invalidValue);
  return paint;
}
Writer nativePaintBytes(const NativePaint& paint) {
  Writer bytes(wire::nativePaintHeaderBytes+paint.entries.size()*wire::nativePaintBytes+paint.expressions.size()*wire::nativePaintExpressionBytes+paint.paths.size()*wire::nativePaintPathCommandBytes);bytes.u32(0,uint32_t(paint.entries.size()));bytes.u32(4,paint.resolved?1:0);bytes.u32(8,uint32_t(paint.expressions.size()));bytes.u32(16,uint32_t(paint.paths.size()));
  for(size_t i=0;i<paint.entries.size();++i){const auto& e=paint.entries[i];const auto at=wire::nativePaintHeaderBytes+i*wire::nativePaintBytes;
    bytes.u32(at,e.kind);bytes.u32(at+4,e.flags);bytes.u32(at+8,e.color);bytes.u32(at+12,e.shadowColor);
    bytes.u32(at+16,e.reference.slot);bytes.u32(at+20,e.reference.generation);bytes.u32(at+24,e.shape);bytes.u32(at+28,e.clip);bytes.u32(at+32,e.strokeColor);bytes.u32(at+36,e.strokeCap);
    bytes.f64(at+40,e.elevation);bytes.f64(at+48,e.strokeWidth);bytes.f64(at+56,e.strokeAlign);
    bytes.f64(at+64,e.x);bytes.f64(at+72,e.y);bytes.f64(at+80,e.radius);bytes.f64(at+88,e.progress);
    for(size_t j=0;j<8;++j)bytes.f64(at+96+j*8,e.radii[j]);
    bytes.f64(at+160,e.width);bytes.f64(at+168,e.height);bytes.f64(at+176,e.cx);bytes.f64(at+184,e.cy);bytes.f64(at+192,e.resolvedRadius);
    const std::array<double,6> matrix{e.transform.a,e.transform.b,e.transform.c,e.transform.d,e.transform.tx,e.transform.ty};
    for(size_t j=0;j<6;++j)bytes.f64(at+200+j*8,matrix[j]);
    bytes.u32(at+256,e.geometry);bytes.u32(at+260,e.geometryFlags);
    const std::array<double,9> geometry{e.trackWidth,e.trackHeight,e.thumbWidth,e.thumbHeight,e.extension,e.position,e.inset,e.blurSigma,e.spread};
    for(size_t j=0;j<geometry.size();++j)bytes.f64(at+264+j*8,geometry[j]);
    for(size_t j=0;j<e.linear.size();++j)bytes.f64(at+336+j*8,e.linear[j]);
    for(size_t j=0;j<e.expressions.size();++j)bytes.u32(at+400+j*4,e.expressions[j]);
    bytes.f64(at+456,e.repeat);
    bytes.u32(at+464,e.pathStart);bytes.u32(at+468,e.pathCount);bytes.u32(at+472,e.pathFillRule);
    bytes.u32(at+wire::nativePaintStrokeWidthExpressionField,e.strokeWidthExpression==UINT32_MAX?0:e.strokeWidthExpression+1);
    if(e.kind==wire::nativePaintKinds::linearMask){for(size_t j=0;j<4;++j){if(paint.resolved)bytes.f64(at+wire::nativePaintGradientExpressionField+j*8,e.gradient[j]);else bytes.u32(at+wire::nativePaintGradientExpressionField+j*4,e.gradientExpressions[j]);}}
    else {bytes.f64(at+480,e.pathBounds.x);bytes.f64(at+488,e.pathBounds.y);bytes.f64(at+496,e.pathBounds.width);bytes.f64(at+504,e.pathBounds.height);}
  }
  const auto expressionAt=wire::nativePaintHeaderBytes+paint.entries.size()*wire::nativePaintBytes;
  for(size_t i=0;i<paint.expressions.size();++i){const auto& e=paint.expressions[i];const auto at=expressionAt+i*wire::nativePaintExpressionBytes;
    bytes.u32(at,e.op);bytes.u32(at+4,e.a);bytes.u32(at+8,e.b);bytes.u32(at+12,e.c);bytes.f64(at+16,e.value);}
  const auto pathAt=expressionAt+paint.expressions.size()*wire::nativePaintExpressionBytes;
  for(size_t i=0;i<paint.paths.size();++i){const auto& command=paint.paths[i];const auto at=pathAt+i*wire::nativePaintPathCommandBytes;bytes.u32(at,command.verb);bytes.u32(at+4,paint.resolved||command.condition==UINT32_MAX?0:command.condition+1);
    for(size_t j=0;j<paintPathArity.at(command.verb);++j){if(paint.resolved)bytes.f64(at+8+j*8,command.values[j]);else bytes.u32(at+8+j*4,command.expressions[j]);}}
  return bytes;
}
std::shared_ptr<const PaintPlacement> readPaintPlacement(const std::shared_ptr<Ledger>& ledger,Reader data) {
  require(data.length>=wire::paintPlacementBytes,wire::statuses::invalidValue);
  auto value=std::make_shared<PaintPlacement>(ledger);
  require(data.u32(40)<=1&&!data.u32(44),wire::statuses::invalidValue);value->unbounded=data.u32(40);
  value->reference={data.u32(32),data.u32(36)};
  require(bool(value->reference.slot)==bool(value->reference.generation),wire::statuses::invalidHandle);
  value->fontRevision=data.u64(0);value->width=data.finiteF64(8);value->height=data.finiteF64(16);value->baseline=data.finiteF64(24);
  require(value->fontRevision>0&&value->width>=0&&value->width<=1e12&&value->height>=0&&value->height<=1e12&&value->baseline>=0&&value->baseline<=1e12,wire::statuses::invalidValue);
  value->program=readNativePaint(ledger,data.slice(wire::paintPlacementBytes,data.length-wire::paintPlacementBytes));
  require(value->program->entries.size()==1,wire::statuses::invalidValue);
  const auto& entry=value->program->entries.front();
  require(entry.kind==wire::nativePaintKinds::shape&&entry.geometry==wire::nativePaintGeometryKinds::program&&entry.repeat==1&&
    entry.expressions[12]==UINT32_MAX&&entry.expressions[13]==UINT32_MAX&&!entry.flags&&!entry.reference&&!entry.color&&!entry.shadowColor&&!entry.shape&&!entry.clip&&!entry.strokeColor&&!entry.elevation&&!entry.strokeWidth&&!entry.strokeAlign&&!entry.x&&!entry.y&&entry.radius==-1&&!entry.progress,wire::statuses::invalidValue);
  for(size_t i=0;i<8;++i)require(!entry.radii[i]&&entry.expressions[i+4]==UINT32_MAX,wire::statuses::invalidValue);
  return value;
}
Writer paintPlacementBytes(const PaintPlacement& value) {
  const auto program=nativePaintBytes(*value.program);Writer bytes(wire::paintPlacementBytes+program.bytes.size());
  bytes.u32(40,value.unbounded?1u:0u);
  bytes.u32(32,value.reference.slot);bytes.u32(36,value.reference.generation);
  bytes.u64(0,value.fontRevision);bytes.f64(8,value.width);bytes.f64(16,value.height);bytes.f64(24,value.baseline);
  std::memcpy(bytes.bytes.data()+wire::paintPlacementBytes,program.bytes.data(),program.bytes.size());return bytes;
}
namespace {
struct PaintEvaluator {
  const NativePaint& paint;double width,height,index=0;uint64_t stamp=1;uint64_t& operations;Affine world;
  bool boundedWidth=true,boundedHeight=true;
  const LayoutPaintValues* layoutValues=nullptr;
  const Node* reference=nullptr;
  std::array<double,wire::limits::nativePaintExpressions> values{};
  std::array<uint64_t,wire::limits::nativePaintExpressions> stamps{};
  double read(uint32_t ref){const auto& e=paint.expressions.at(ref);
    if(stamps[ref]&&(!e.varying||stamps[ref]==stamp))return values[ref];
    require(++operations<=wire::limits::nativePaintOperations,wire::statuses::budgetExceeded);
    const auto a=[&]{return read(e.a);};const auto b=[&]{return read(e.b);};const auto c=[&]{return read(e.c);};
    double value=0;
    switch(e.op){
      case 0:value=e.value;break;case 1:value=width;break;case 2:value=height;break;case 3:value=index;break;
      case 4:value=a()+b();break;case 5:value=a()-b();break;case 6:value=a()*b();break;
      case 7:{const auto denominator=b();require(denominator!=0,wire::statuses::invalidValue);value=a()/denominator;break;}
      case 8:value=std::min(a(),b());break;case 9:value=std::max(a(),b());break;
      case 10:{const auto low=b(),high=c();require(low<=high,wire::statuses::invalidValue);value=std::clamp(a(),low,high);break;}
      case 11:value=a()<b();break;case 12:value=a()<=b();break;case 13:value=a()>b();break;case 14:value=a()>=b();break;case 15:value=a()==b();break;
      case 16:value=a()!=0?b():c();break;
      case 17:value=world.map({a(),b()}).x;break;case 18:value=world.map({a(),b()}).y;break;
      case 19:value=boundedWidth;break;case 20:value=boundedHeight;break;
      case 21:{const auto slot=uint32_t(e.value);require(layoutValues&&(layoutValues->defined&(1u<<slot)),wire::statuses::invalidValue);value=layoutValues->values[slot];break;}
      case 22:value=std::acos(a());break;case 23:value=std::asin(a());break;
      case 28:value=std::cos(a());break;
      case 24:require(reference,wire::statuses::invalidValue);value=reference->contentOverflow;break;
      case 25:require(reference,wire::statuses::invalidValue);value=reference->contentOverflowX;break;
      case 26:case 27:require(reference&&reference->paragraph&&reference->paragraph->value.overflowProbe,wire::statuses::invalidValue);value=e.op==26?reference->overflowProbeWidth:reference->overflowProbeHeight;break;
      default:require(false,wire::statuses::invalidValue);
    }
    require(std::isfinite(value),wire::statuses::invalidValue);
    values[ref]=value;stamps[ref]=stamp;return value;
  }
};
void resolvePaintPath(NativePaintEntry& entry,const NativePaint& input,PaintEvaluator& evaluator,std::vector<NativePaintPathCommand>& paths) {
  require(paths.size()+entry.pathCount<=wire::limits::pathCommands,wire::statuses::budgetExceeded);
  const auto sourceStart=entry.pathStart;entry.pathStart=uint32_t(paths.size());
  bool hasPoint=false;double left=0,top=0,right=0,bottom=0;
  const auto point=[&](double x,double y){if(!hasPoint){left=right=x;top=bottom=y;hasPoint=true;}
    else {left=std::min(left,x);top=std::min(top,y);right=std::max(right,x);bottom=std::max(bottom,y);}};
  for(size_t i=0;i<entry.pathCount;++i){
    require(++evaluator.operations<=wire::limits::nativePaintOperations,wire::statuses::budgetExceeded);
    const auto& source=input.paths.at(sourceStart+i);
    if(source.condition!=UINT32_MAX&&evaluator.read(source.condition)==0)continue;
    NativePaintPathCommand command;command.verb=source.verb;
    const auto arity=paintPathArity.at(command.verb);
    for(size_t j=0;j<arity;++j){const auto value=evaluator.read(source.expressions[j]);require(std::abs(value)<=1e12,wire::statuses::invalidValue);command.values[j]=value;}
    const auto& v=command.values;
    if(command.verb==7||command.verb==8||command.verb==wire::nativePaintPathVerbs::arc){
      require(v[2]>=0&&v[3]>=0,wire::statuses::invalidValue);point(v[0],v[1]);point(v[0]+v[2],v[1]+v[3]);
      if(command.verb==8)for(size_t j=4;j<12;++j)require(v[j]>=0&&v[j]<=1e6,wire::statuses::invalidValue);
      if(command.verb==wire::nativePaintPathVerbs::arc)require(v[6]==0||v[6]==1,wire::statuses::invalidValue);
    }else if(command.verb!=5){
      if(command.verb!=1&&!hasPoint)point(0,0);
      if(command.verb==6)require(v[4]>0&&v[4]<=1e6,wire::statuses::invalidValue);
      const auto coordinates=command.verb==6?4:arity;
      for(size_t j=0;j<coordinates;j+=2)point(v[j],v[j+1]);
    }
    paths.push_back(std::move(command));
  }
  entry.pathCount=uint32_t(paths.size())-entry.pathStart;
  entry.pathBounds={left,top,right-left,bottom-top};
}
std::shared_ptr<NativePaint> expandPaint(const Node& node,const NativePaint& input,uint64_t& operations,const Document* document=nullptr,const PaintMatrices* matrices=nullptr) {
  const auto ledger=node.lease.ledger;
  if(input.expressions.empty()){auto result=std::make_shared<NativePaint>(ledger,input.entries.size());result->entries=input.entries;return result;}
  Lease scratch(ledger,wire::limits::nativePaintDraws*sizeof(NativePaintEntry));
  Lease pathScratch(ledger,input.paths.empty()?0:wire::limits::pathCommands*sizeof(NativePaintPathCommand));
  std::vector<NativePaintEntry> entries;entries.reserve(wire::limits::nativePaintDraws);
  std::vector<NativePaintPathCommand> paths;
  if(!input.paths.empty())paths.reserve(wire::limits::pathCommands);
  for(const auto& source:input.entries){
    const auto& reference=source.reference&&document?document->get(source.reference):node;
    PaintEvaluator evaluator{input,reference.properties.width,reference.properties.height,0,1,operations,matrices?(*matrices)[reference.id.slot]:Affine{},reference.paintBoundedWidth,reference.paintBoundedHeight,reference.layoutPaintValues.get(),&reference};
    if(source.geometry!=wire::nativePaintGeometryKinds::program){require(entries.size()<wire::limits::nativePaintDraws,wire::statuses::budgetExceeded);entries.push_back(source);continue;}
    evaluator.index=0;evaluator.stamp=1;
    const auto condition=source.expressions[12];
    if(condition!=UINT32_MAX&&!input.expressions[condition].varying&&evaluator.read(condition)==0)continue;
    require(source.repeat<=wire::limits::nativePaintDraws,wire::statuses::budgetExceeded);
    for(uint32_t i=0;i<uint32_t(source.repeat);++i){evaluator.index=i;evaluator.stamp=uint64_t(i)+1;
      if(condition!=UINT32_MAX&&evaluator.read(condition)==0)continue;
      require(entries.size()<wire::limits::nativePaintDraws,wire::statuses::budgetExceeded);
      auto entry=source;entry.geometry=wire::nativePaintGeometryKinds::linear;
      entry.linear={0,0,0,0,evaluator.read(source.expressions[0]),evaluator.read(source.expressions[1]),
        evaluator.read(source.expressions[2]),evaluator.read(source.expressions[3])};
      for(size_t j=0;j<entry.radii.size();++j)if(source.expressions[j+4]!=UINT32_MAX){entry.radii[j]=evaluator.read(source.expressions[j+4]);require(entry.radii[j]>=0&&entry.radii[j]<=1e6,wire::statuses::invalidValue);}
      if(source.expressions[13]!=UINT32_MAX){const auto color=evaluator.read(source.expressions[13]);require(color>=0&&color<=UINT32_MAX&&std::floor(color)==color,wire::statuses::invalidValue);entry.color=uint32_t(color);}
      if(source.strokeWidthExpression!=UINT32_MAX){entry.strokeWidth=evaluator.read(source.strokeWidthExpression);require(entry.strokeWidth>=0&&entry.strokeWidth<=512,wire::statuses::invalidValue);}
      entry.strokeWidthExpression=UINT32_MAX;
      if(entry.kind==wire::nativePaintKinds::linearMask){for(size_t j=0;j<4;++j){entry.gradient[j]=evaluator.read(source.gradientExpressions[j]-1);require(std::abs(entry.gradient[j])<=1e12,wire::statuses::invalidValue);}entry.gradientExpressions.fill(0);}
      if(entry.kind==7&&entry.radius<0)entry.radius=std::max(0.0,std::min(entry.linear[6],entry.linear[7])/2);
      if(entry.kind==wire::nativePaintKinds::path){resolvePaintPath(entry,input,evaluator,paths);if(!entry.pathCount)continue;}
      entry.expressions.fill(0);entry.repeat=0;entries.push_back(std::move(entry));
    }
  }
  auto result=std::make_shared<NativePaint>(ledger,entries.size(),0,paths.size());
  std::move(entries.begin(),entries.end(),result->entries.begin());
  std::move(paths.begin(),paths.end(),result->paths.begin());return result;
}
std::shared_ptr<const GraphicsPath> shapePath(const NativePaintEntry& e,const std::shared_ptr<Ledger>& ledger) {
  auto r=e.radii;double x=0,y=0,w=e.width,h=e.height;
  if(e.shape==2){const double d=std::min(w,h);x=(w-d)/2;y=(h-d)/2;w=h=d;r.fill(d/2);}
  const double k=0.5522847498307936;
  std::vector<PathCommand> commands{
    {1,{x+r[0],y}}, {2,{x+w-r[2],y}},
    {4,{x+w-r[2]+k*r[2],y,x+w,y+r[3]-k*r[3],x+w,y+r[3]}},
    {2,{x+w,y+h-r[5]}},
    {4,{x+w,y+h-r[5]+k*r[5],x+w-r[4]+k*r[4],y+h,x+w-r[4],y+h}},
    {2,{x+r[6],y+h}},
    {4,{x+r[6]-k*r[6],y+h,x,y+h-r[7]+k*r[7],x,y+h-r[7]}},
    {2,{x,y+r[1]}}, {4,{x,y+r[1]-k*r[1],x+r[0]-k*r[0],y,x+r[0],y}}, {5,{}}};
  return std::make_shared<GraphicsPath>(ledger,std::move(commands),0);
}
void normalize(NativePaintEntry& e) {
  if(e.shape==1||e.shape==2){e.radii.fill(std::min(e.width,e.height)/2);return;}
  double scale=1;
  const auto side=[&](double sum,double extent){if(sum>extent&&sum>0)scale=std::min(scale,extent/sum);};
  side(e.radii[0]+e.radii[2],e.width);side(e.radii[6]+e.radii[4],e.width);
  side(e.radii[1]+e.radii[7],e.height);side(e.radii[3]+e.radii[5],e.height);
  for(auto& radius:e.radii)radius*=scale;
}
}
bool sameNativePaintHit(const NativePaintEntry& a,const NativePaintEntry& b) {
  return a.kind==b.kind&&a.shape==b.shape&&a.width==b.width&&a.height==b.height&&a.radii==b.radii;
}
namespace {
PaintMatrices paintMatrices(const Document& document) {
  PaintMatrices matrices(document.highWater+1);
  std::function<void(Handle,Affine)> visit=[&](Handle id,Affine parent){const auto& n=document.get(id), *leader=n.layerLink.leader?&document.get(n.layerLink.leader):nullptr;
    const auto world=nodeTransform(n,parent,leader,leader?&matrices[leader->id.slot]:nullptr);matrices[id.slot]=world;
    for(const auto child:document.children[id.slot])visit(child,childTransform(n,world));
  };
  for(const auto root:document.children[0])visit(root,{});return matrices;
}
}
bool livePaintPlacement(const Node& node) {
  return node.paintPlacement&&(node.paintPlacement->reference||node.paintPlacement->program->frameDependent);
}
Affine resolvePaintPlacement(const Node& node,const Document& document,const PaintMatrices& matrices,Affine parent,uint64_t& operations) {
  const auto& placement=*node.paintPlacement;
  const auto& reference=document.get(placement.reference?placement.reference:node.parent);
  const auto resolved=expandPaint(reference,*placement.program,operations,&document,&matrices);
  require(resolved->entries.size()==1,wire::statuses::invalidValue);const auto& rect=resolved->entries.front().linear;
  require(rect[6]>=0&&rect[7]>=0&&(placement.width>0||rect[6]==0)&&(placement.height>0||rect[7]==0),wire::statuses::invalidValue);
  Affine transform{placement.width>0?rect[6]/placement.width:1,0,0,placement.height>0?rect[7]/placement.height:1,rect[4],rect[5]};
  if(placement.reference){const auto inverse=parent.inverse();require(inverse.has_value(),wire::statuses::invalidValue);
    transform=*inverse*matrices[reference.id.slot]*transform;}
  transform.bounds({0,0,node.properties.width,node.properties.height});return transform;
}
void resolvePaintPlacements(Document& document,uint64_t fontRevision) {
  const auto matrices=paintMatrices(document);uint64_t operations=0;
  for(auto& slot:document.nodes){if(!slot.value||!slot.value->paintPlacement)continue;
    auto node=std::make_shared<Node>(*slot.value);const auto& placement=*node->paintPlacement;
    require(placement.fontRevision==(node->fontPinned?node->fontRevision:fontRevision),wire::statuses::stale);
    const auto close=[](double a,double b){return std::abs(a-b)<=1e-5;};
    require(close(node->contentWidth,placement.width)&&close(node->contentHeight,placement.height)&&close(node->baseline,placement.baseline),wire::statuses::stale);
    node->paintTransform=resolvePaintPlacement(*node,document,matrices,matrices[node->parent.slot],operations);
    document.nodes.edit(node->id.slot).value=std::move(node);
  }
}
std::shared_ptr<const NativePaint> resolveNodePaint(const Node& node,const Document& document,const PaintMatrices& matrices,uint64_t& operations) {
    auto resolved=expandPaint(node,*node.nativePaint,operations,&document,&matrices);resolved->resolved=true;
    for(auto& e:resolved->entries){const auto& ref=e.reference?document.get(e.reference):node;
      require(++operations<=wire::limits::nativePaintOperations,wire::statuses::budgetExceeded);
      if(e.reference){if(e.kind==wire::nativePaintKinds::paragraph)require(ref.paintOwner==node.id,wire::statuses::invalidGraph);
        else if(e.kind==3||e.kind==4)require(document.descends(ref.id,node.id),wire::statuses::invalidValue);
        else {for(Handle at=ref.id;at;at=document.get(at).parent)require(!document.get(at).paintPlacement,wire::statuses::invalidValue);}
        const auto inverse=matrices[node.id.slot].inverse();require(inverse.has_value(),wire::statuses::invalidValue);
        e.transform=*inverse*matrices[ref.id.slot];
      }
      e.width=ref.properties.width;e.height=ref.properties.height;
      e.cx=e.width/2;e.cy=e.height/2;e.resolvedRadius=e.radius<0?35:e.radius;
      if(e.geometry==wire::nativePaintGeometryKinds::linear){
        e.width=std::max(0.0,ref.properties.width*e.linear[2]+e.linear[6]);
        e.height=std::max(0.0,ref.properties.height*e.linear[3]+e.linear[7]);
        e.transform=e.transform*Affine{1,0,0,1,ref.properties.width*e.linear[0]+e.linear[4],ref.properties.height*e.linear[1]+e.linear[5]};
        e.transform.bounds({0,0,e.width,e.height});e.cx=e.width/2;e.cy=e.height/2;
      }else if(e.geometry){
        const double left=(e.width-e.trackWidth)/2,top=(e.height-e.trackHeight)/2;
        const bool rtl=e.geometryFlags&1u;
        const double visual=rtl?1-e.position:e.position;
        const double thumbX=left+e.trackHeight/2+e.extension/2-e.thumbWidth/2+
          visual*(e.trackWidth-e.trackHeight-e.extension);
        const double thumbY=top+e.trackHeight/2-e.thumbHeight/2;
        if(e.geometry==1||e.geometry==2){
          e.width=std::max(0.0,(e.geometry==1?e.trackWidth:e.thumbWidth)-2*e.inset);
          e.height=std::max(0.0,(e.geometry==1?e.trackHeight:e.thumbHeight)-2*e.inset);
          e.transform={1,0,0,1,(e.geometry==1?left:thumbX)+e.inset,(e.geometry==1?top:thumbY)+e.inset};
        }else if(e.geometry==3){e.cx=thumbX+e.thumbHeight/2;e.cy=ref.properties.height/2;}
        else if(e.geometry==4){
          e.width=e.thumbWidth;e.height=e.thumbHeight;
          e.transform={1,0,0,1,(rtl?left+e.trackWidth-e.inset:left+e.inset)-e.width/2,
            ref.properties.height/2-e.height/2};
        }else if(e.geometry==5){e.cx=rtl?left+e.inset:left+e.trackWidth-e.inset;e.cy=ref.properties.height/2;}
      }
      if(e.kind==wire::nativePaintKinds::path)e.transform.bounds(e.pathBounds);
      if(e.kind==9){e.transform.tx+=e.x-e.spread;e.transform.ty+=e.y-e.spread;
        e.width=std::max(0.0,e.width+2*e.spread);e.height=std::max(0.0,e.height+2*e.spread);
        for(auto& radius:e.radii)radius=std::max(0.0,radius+e.spread);}
      normalize(e);
      if(e.kind==5){const double inset=1-std::abs(e.progress-0.5)*2;
        e.width=e.height=18-inset*2;e.transform={1,0,0,1,(ref.properties.width-18)/2+inset,(ref.properties.height-18)/2+inset};
        normalize(e);
      }else if(e.kind==6){
        e.transform={1,0,0,1,(e.width-18)/2,(e.height-18)/2};
        const double t=e.progress;
        if(e.flags&32u)e.radii={3.6+5.4*(1-t),9,9+5.4*t,9,0,0,2,0};
        else if(t<0.5)e.radii={2.7,8.1,2.7+4.5*t*2,8.1+4.5*t*2,0,0,2,0};
        else e.radii={2.7,8.1,7.2,12.6,7.2+8.1*(t-0.5)*2,12.6-8.1*(t-0.5)*2,3,0};
      }else if(e.kind==7)e.resolvedRadius=std::max(0.0,e.radius)*e.progress;
      if(e.kind==4){const double target=e.radius<0?std::hypot(e.width,e.height)/2:e.radius;
        const double x=(e.flags&2u)?e.width/2:e.x,y=(e.flags&2u)?e.height/2:e.y;
        e.cx=x+(e.width/2-x)*e.progress;e.cy=y+(e.height/2-y)*e.progress;
        e.resolvedRadius=target*0.3+(target*0.7+5)*e.progress;
      }
    }
  return resolved;
}
void resolveNativePaint(Document& document) {
  if(std::none_of(document.nodes.begin(),document.nodes.end(),[](const auto& slot){return slot.value&&slot.value->nativePaint;}))return;
  const auto matrices=paintMatrices(document);uint64_t operations=0;
  for(auto& slot:document.nodes){if(!slot.value||!slot.value->nativePaint)continue;
    auto node=std::make_shared<Node>(*slot.value);const auto& input=*node->nativePaint;
    if(!input.entries.empty()&&(input.entries[0].flags&16u)){
      require(bool(node->parent),wire::statuses::invalidValue);const auto& parent=document.get(node->parent);
      require(node->properties.x==0&&node->properties.y==0&&!node->layout.enabled,wire::statuses::invalidValue);
      node->properties.width=parent.properties.width;node->properties.height=parent.properties.height;
    }
    node->resolvedPaint=resolveNodePaint(*node,document,matrices,operations);
    for(const auto& e:node->resolvedPaint->entries)if(e.kind==1)node->graphics.path=shapePath(e,document.lease.ledger);
    document.nodes.edit(node->id.slot).value=std::move(node);
  }
}
}
