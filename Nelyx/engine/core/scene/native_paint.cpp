// SPDX-License-Identifier: BSD-3-Clause
#include "document.hpp"
namespace nelyx::v2 {
std::shared_ptr<const NativePaint> readNativePaint(const std::shared_ptr<Ledger>& ledger,Reader bytes) {
  require(bytes.length>=wire::nativePaintHeaderBytes&&bytes.u32(4)==0&&bytes.u32(12)==0&&bytes.u32(0)<=wire::limits::nativePaintEntries&&bytes.u32(8)<=wire::limits::nativePaintExpressions&&
    bytes.length==wire::nativePaintHeaderBytes+size_t(bytes.u32(0))*wire::nativePaintBytes+size_t(bytes.u32(8))*wire::nativePaintExpressionBytes,wire::statuses::invalidValue);
  auto paint=std::make_shared<NativePaint>(ledger,bytes.u32(0),bytes.u32(8));
  const auto expressionAt=wire::nativePaintHeaderBytes+paint->entries.size()*wire::nativePaintBytes;
  for(size_t i=0;i<paint->expressions.size();++i){auto& e=paint->expressions[i];const auto at=expressionAt+i*wire::nativePaintExpressionBytes;
    e={bytes.u32(at),bytes.u32(at+4),bytes.u32(at+8),bytes.u32(at+12),bytes.finiteF64(at+16),false};
    require(e.op<=wire::nativePaintOperations::select,wire::statuses::invalidValue);
    const uint32_t arity=e.op<=3?0u:(e.op==10||e.op==16?3u:2u);
    const std::array<uint32_t,3> operands{e.a,e.b,e.c};
    for(size_t j=0;j<operands.size();++j){if(j<arity)require(operands[j]<i,wire::statuses::invalidValue);else require(!operands[j],wire::statuses::invalidValue);}
    require(!e.op||!e.value,wire::statuses::invalidValue);
    e.varying=e.op==3;
    for(size_t j=0;j<arity;++j)e.varying|=paint->expressions[operands[j]].varying;
  }
  uint32_t scope=0;
  for(size_t i=0;i<paint->entries.size();++i){auto& e=paint->entries[i];const auto at=wire::nativePaintHeaderBytes+i*wire::nativePaintBytes;
    e.kind=bytes.u32(at);e.flags=bytes.u32(at+4);e.color=bytes.u32(at+8);e.shadowColor=bytes.u32(at+12);
    e.reference={bytes.u32(at+16),bytes.u32(at+20)};e.shape=bytes.u32(at+24);e.clip=bytes.u32(at+28);e.strokeColor=bytes.u32(at+32);
    require(e.kind>=1&&e.kind<=wire::nativePaintKinds::restore&&!(e.flags&~127u)&&e.shape<=2&&e.clip<=3&&!bytes.u32(at+36),wire::statuses::invalidValue);
    require(!(e.flags&32u)||e.kind==6,wire::statuses::invalidValue);
    require(!(e.flags&64u)||e.kind==wire::nativePaintKinds::elevationShadow,wire::statuses::invalidValue);
    e.elevation=bytes.f64(at+40);e.strokeWidth=bytes.f64(at+48);e.strokeAlign=bytes.f64(at+56);
    e.x=bytes.f64(at+64);e.y=bytes.f64(at+72);e.radius=bytes.f64(at+80);e.progress=bytes.f64(at+88);
    require(e.elevation>=0&&e.elevation<=128&&e.strokeWidth>=0&&e.strokeWidth<=512&&std::abs(e.strokeAlign)<=1e6&&
      std::abs(e.x)<=1e12&&std::abs(e.y)<=1e12&&e.radius>=-1&&e.radius<=1e6&&e.progress>=0&&e.progress<=1,wire::statuses::invalidValue);
    require(((e.kind<=2||e.kind>=5)&&!e.reference)||((e.kind==3||e.kind==4)&&e.reference),wire::statuses::invalidValue);
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
        (e.kind==2||e.kind==7||e.kind==8||e.kind==9||e.kind==10||e.kind==12)&&e.repeat>=0&&std::floor(e.repeat)==e.repeat,wire::statuses::invalidValue);
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
    if(e.kind==wire::nativePaintKinds::hitRegion)require(e.geometry==wire::nativePaintGeometryKinds::linear&&e.shape==0&&!e.color&&!e.strokeWidth&&!e.flags&&!e.clip,wire::statuses::invalidValue);
    if(e.kind>=wire::nativePaintKinds::save){
      require(!e.flags&&!e.color&&!e.shadowColor&&!e.shape&&!e.clip&&!e.strokeWidth&&!e.strokeColor&&!e.strokeAlign&&!e.elevation&&!e.x&&!e.y&&e.radius==-1&&!e.progress&&!e.geometry,wire::statuses::invalidValue);
      for(const auto radius:e.radii)require(!radius,wire::statuses::invalidValue);
      if(e.kind==wire::nativePaintKinds::save)require(++scope<=wire::limits::depth,wire::statuses::invalidValue);
      else {require(scope>0,wire::statuses::invalidValue);--scope;}
    }
  }
  require(!scope,wire::statuses::invalidValue);
  require(std::count_if(paint->entries.begin(),paint->entries.end(),[](const auto& entry){return entry.kind==wire::nativePaintKinds::hitRegion;})<=1,wire::statuses::invalidValue);
  return paint;
}
Writer nativePaintBytes(const NativePaint& paint) {
  Writer bytes(wire::nativePaintHeaderBytes+paint.entries.size()*wire::nativePaintBytes+paint.expressions.size()*wire::nativePaintExpressionBytes);bytes.u32(0,uint32_t(paint.entries.size()));bytes.u32(4,paint.resolved?1:0);bytes.u32(8,uint32_t(paint.expressions.size()));
  for(size_t i=0;i<paint.entries.size();++i){const auto& e=paint.entries[i];const auto at=wire::nativePaintHeaderBytes+i*wire::nativePaintBytes;
    bytes.u32(at,e.kind);bytes.u32(at+4,e.flags);bytes.u32(at+8,e.color);bytes.u32(at+12,e.shadowColor);
    bytes.u32(at+16,e.reference.slot);bytes.u32(at+20,e.reference.generation);bytes.u32(at+24,e.shape);bytes.u32(at+28,e.clip);bytes.u32(at+32,e.strokeColor);
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
  }
  const auto expressionAt=wire::nativePaintHeaderBytes+paint.entries.size()*wire::nativePaintBytes;
  for(size_t i=0;i<paint.expressions.size();++i){const auto& e=paint.expressions[i];const auto at=expressionAt+i*wire::nativePaintExpressionBytes;
    bytes.u32(at,e.op);bytes.u32(at+4,e.a);bytes.u32(at+8,e.b);bytes.u32(at+12,e.c);bytes.f64(at+16,e.value);}
  return bytes;
}
namespace {
struct PaintEvaluator {
  const NativePaint& paint;double width,height,index=0;uint64_t stamp=1;uint64_t& operations;
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
      case 16:value=a()!=0?b():c();break;default:require(false,wire::statuses::invalidValue);
    }
    require(std::isfinite(value),wire::statuses::invalidValue);
    values[ref]=value;stamps[ref]=stamp;return value;
  }
};
std::shared_ptr<NativePaint> expandPaint(const Node& node,const NativePaint& input,uint64_t& operations) {
  const auto ledger=node.lease.ledger;
  if(input.expressions.empty()){auto result=std::make_shared<NativePaint>(ledger,input.entries.size());result->entries=input.entries;return result;}
  Lease scratch(ledger,wire::limits::nativePaintDraws*sizeof(NativePaintEntry));
  std::vector<NativePaintEntry> entries;entries.reserve(wire::limits::nativePaintDraws);
  PaintEvaluator evaluator{input,node.properties.width,node.properties.height,0,1,operations};
  for(const auto& source:input.entries){
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
      if(entry.kind==7&&entry.radius<0)entry.radius=std::max(0.0,std::min(entry.linear[6],entry.linear[7])/2);
      entry.expressions.fill(0);entry.repeat=0;entries.push_back(std::move(entry));
    }
  }
  auto result=std::make_shared<NativePaint>(ledger,entries.size());
  std::move(entries.begin(),entries.end(),result->entries.begin());return result;
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
void resolveNativePaint(Document& document) {
  if(std::none_of(document.nodes.begin(),document.nodes.end(),[](const auto& slot){return slot.value&&slot.value->nativePaint;}))return;
  std::array<Affine,wire::limits::nodes+1> matrices;
  std::function<void(Handle,Affine)> visit=[&](Handle id,Affine parent){const auto& n=document.get(id);
    const auto leader=n.layerLink.leader;
    const auto world=nodeTransform(n,parent,leader?&document.get(leader):nullptr,leader?&matrices[leader.slot]:nullptr);
    matrices[id.slot]=world;for(const auto child:document.children[id.slot])visit(child,world);
  };
  for(const auto root:document.children[0])visit(root,{});
  uint64_t operations=0;
  for(auto& slot:document.nodes){if(!slot.value||!slot.value->nativePaint)continue;
    auto node=std::make_shared<Node>(*slot.value);const auto& input=*node->nativePaint;
    if(!input.entries.empty()&&(input.entries[0].flags&16u)){
      require(bool(node->parent),wire::statuses::invalidValue);const auto& parent=document.get(node->parent);
      require(node->properties.x==0&&node->properties.y==0&&!node->layout.enabled,wire::statuses::invalidValue);
      node->properties.width=parent.properties.width;node->properties.height=parent.properties.height;
    }
    auto resolved=expandPaint(*node,input,operations);resolved->resolved=true;
    for(auto& e:resolved->entries){const auto& ref=e.reference?document.get(e.reference):*node;
      if(e.reference){require(document.descends(ref.id,node->id),wire::statuses::invalidValue);
        for(Handle at=ref.id;at!=node->id;at=document.get(at).parent)
          require(document.get(at).kind!=wire::kinds::scrollViewport,wire::statuses::capabilityMissing);
        const auto inverse=matrices[node->id.slot].inverse();require(inverse.has_value(),wire::statuses::invalidValue);
        e.transform=*inverse*matrices[ref.id.slot];
      }
      e.width=ref.properties.width;e.height=ref.properties.height;
      e.cx=e.width/2;e.cy=e.height/2;e.resolvedRadius=e.radius<0?35:e.radius;
      if(e.geometry==wire::nativePaintGeometryKinds::linear){
        e.width=std::max(0.0,ref.properties.width*e.linear[2]+e.linear[6]);
        e.height=std::max(0.0,ref.properties.height*e.linear[3]+e.linear[7]);
        e.transform={1,0,0,1,ref.properties.width*e.linear[0]+e.linear[4],ref.properties.height*e.linear[1]+e.linear[5]};
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
      if(e.kind==1)node->graphics.path=shapePath(e,document.lease.ledger);
    }
    node->resolvedPaint=std::move(resolved);slot.value=std::move(node);
  }
}
}
