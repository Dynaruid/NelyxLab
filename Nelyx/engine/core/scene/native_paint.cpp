// SPDX-License-Identifier: BSD-3-Clause
#include "document.hpp"
namespace nelyx::v2 {
std::shared_ptr<const NativePaint> readNativePaint(const std::shared_ptr<Ledger>& ledger,Reader bytes) {
  require(bytes.length>=8&&bytes.u32(4)==0&&bytes.u32(0)<=wire::limits::nativePaintEntries&&
    bytes.length==8+size_t(bytes.u32(0))*wire::nativePaintBytes,wire::statuses::invalidValue);
  auto paint=std::make_shared<NativePaint>(ledger,bytes.u32(0));
  for(size_t i=0;i<paint->entries.size();++i){auto& e=paint->entries[i];const auto at=8+i*wire::nativePaintBytes;
    e.kind=bytes.u32(at);e.flags=bytes.u32(at+4);e.color=bytes.u32(at+8);e.shadowColor=bytes.u32(at+12);
    e.reference={bytes.u32(at+16),bytes.u32(at+20)};e.shape=bytes.u32(at+24);e.clip=bytes.u32(at+28);e.strokeColor=bytes.u32(at+32);
    require(e.kind>=1&&e.kind<=4&&!(e.flags&~31u)&&e.shape<=2&&e.clip<=3&&!bytes.u32(at+36),wire::statuses::invalidValue);
    e.elevation=bytes.f64(at+40);e.strokeWidth=bytes.f64(at+48);e.strokeAlign=bytes.f64(at+56);
    e.x=bytes.f64(at+64);e.y=bytes.f64(at+72);e.radius=bytes.f64(at+80);e.progress=bytes.f64(at+88);
    require(e.elevation>=0&&e.elevation<=128&&e.strokeWidth>=0&&e.strokeWidth<=512&&std::abs(e.strokeAlign)<=1e6&&
      std::abs(e.x)<=1e12&&std::abs(e.y)<=1e12&&e.radius>=-1&&e.radius<=1e6&&e.progress>=0&&e.progress<=1,wire::statuses::invalidValue);
    require((e.kind<=2&&!e.reference)||(e.kind>=3&&e.reference),wire::statuses::invalidValue);
    require(!(e.flags&16u)||(e.kind==2),wire::statuses::invalidValue);
    for(size_t j=0;j<8;++j){e.radii[j]=bytes.f64(at+96+j*8);require(e.radii[j]>=0&&e.radii[j]<=1e6,wire::statuses::invalidValue);}
    for(size_t j=160;j<wire::nativePaintBytes;j+=8)require(bytes.u64(at+j)==0,wire::statuses::invalidValue);
  }
  return paint;
}
Writer nativePaintBytes(const NativePaint& paint) {
  Writer bytes(8+paint.entries.size()*wire::nativePaintBytes);bytes.u32(0,uint32_t(paint.entries.size()));bytes.u32(4,paint.resolved?1:0);
  for(size_t i=0;i<paint.entries.size();++i){const auto& e=paint.entries[i];const auto at=8+i*wire::nativePaintBytes;
    bytes.u32(at,e.kind);bytes.u32(at+4,e.flags);bytes.u32(at+8,e.color);bytes.u32(at+12,e.shadowColor);
    bytes.u32(at+16,e.reference.slot);bytes.u32(at+20,e.reference.generation);bytes.u32(at+24,e.shape);bytes.u32(at+28,e.clip);bytes.u32(at+32,e.strokeColor);
    bytes.f64(at+40,e.elevation);bytes.f64(at+48,e.strokeWidth);bytes.f64(at+56,e.strokeAlign);
    bytes.f64(at+64,e.x);bytes.f64(at+72,e.y);bytes.f64(at+80,e.radius);bytes.f64(at+88,e.progress);
    for(size_t j=0;j<8;++j)bytes.f64(at+96+j*8,e.radii[j]);
    bytes.f64(at+160,e.width);bytes.f64(at+168,e.height);bytes.f64(at+176,e.cx);bytes.f64(at+184,e.cy);bytes.f64(at+192,e.resolvedRadius);
    const std::array<double,6> matrix{e.transform.a,e.transform.b,e.transform.c,e.transform.d,e.transform.tx,e.transform.ty};
    for(size_t j=0;j<6;++j)bytes.f64(at+200+j*8,matrix[j]);
  }
  return bytes;
}
namespace {
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
    const auto world=parent*Affine{1,0,0,1,n.properties.x,n.properties.y}*n.graphics.effective(n.properties.width,n.properties.height);
    matrices[id.slot]=world;for(const auto child:document.children[id.slot])visit(child,world);
  };
  for(const auto root:document.children[0])visit(root,{});
  for(auto& slot:document.nodes){if(!slot.value||!slot.value->nativePaint)continue;
    auto node=std::make_shared<Node>(*slot.value);const auto& input=*node->nativePaint;
    auto resolved=std::make_shared<NativePaint>(document.lease.ledger,input.entries.size());resolved->resolved=true;resolved->entries=input.entries;
    if(!input.entries.empty()&&(input.entries[0].flags&16u)){
      require(bool(node->parent),wire::statuses::invalidValue);const auto& parent=document.get(node->parent);
      require(node->properties.x==0&&node->properties.y==0&&!node->layout.enabled,wire::statuses::invalidValue);
      node->properties.width=parent.properties.width;node->properties.height=parent.properties.height;
    }
    for(auto& e:resolved->entries){const auto& ref=e.reference?document.get(e.reference):*node;
      if(e.reference){require(document.descends(ref.id,node->id),wire::statuses::invalidValue);
        for(Handle at=ref.id;at!=node->id;at=document.get(at).parent)
          require(document.get(at).kind!=wire::kinds::scrollViewport,wire::statuses::capabilityMissing);
        const auto inverse=matrices[node->id.slot].inverse();require(inverse.has_value(),wire::statuses::invalidValue);
        e.transform=*inverse*matrices[ref.id.slot];
      }
      e.width=ref.properties.width;e.height=ref.properties.height;normalize(e);
      e.cx=e.width/2;e.cy=e.height/2;e.resolvedRadius=e.radius<0?35:e.radius;
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
