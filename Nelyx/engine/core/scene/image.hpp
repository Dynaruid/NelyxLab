// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "geometry.hpp"

namespace nelyx::v2 {
struct RasterImage {uint32_t width,height,rowBytes;Reader pixels;};
inline std::optional<RasterImage> readRasterImage(Reader bytes){
  if(bytes.length<4||bytes.u32(0)!=wire::rasterImageMagic)return {};
  require(bytes.length>=wire::rasterImageHeaderBytes,wire::statuses::invalidValue);
  const auto width=bytes.u32(8),height=bytes.u32(12);const uint64_t size=uint64_t(width)*height*4;
  require(bytes.u32(4)==1&&width>0&&height>0&&width<=8192&&height<=8192&&
    size<=wire::limits::resourceBytes-wire::rasterImageHeaderBytes&&bytes.u32(16)==uint64_t(width)*4&&
    bytes.u32(20)==size&&bytes.u32(24)==1&&!bytes.u32(28)&&bytes.length==wire::rasterImageHeaderBytes+size,
    wire::statuses::invalidValue);
  return RasterImage{width,height,width*4,bytes.slice(wire::rasterImageHeaderBytes,size_t(size))};
}
struct ImageStyle {
  uint32_t flags=wire::imageFlags::canonical,fit=7,repeat=0,quality=2,tint=0,colorBlend=5,blend=3;
  uint32_t width=0,height=0;
  double scale=1,opacity=1,alignmentX=0,alignmentY=0,left=0,top=0,right=0,bottom=0;
  bool operator==(const ImageStyle&)const=default;
};
inline std::optional<ImageStyle> readImageStyle(Reader bytes){
  require(bytes.length==wire::imageStyleBytes);
  const auto flags=bytes.u32(0);
  if(!flags){for(size_t i=0;i<bytes.length;++i)require(!bytes.data[i]);return {};}
  ImageStyle s;s.flags=flags;s.fit=bytes.u32(4);s.repeat=bytes.u32(8);s.quality=bytes.u32(12);
  s.tint=bytes.u32(16);s.colorBlend=bytes.u32(20);s.blend=bytes.u32(24);s.width=bytes.u32(32);s.height=bytes.u32(36);
  s.scale=bytes.f64(40);s.opacity=bytes.f64(48);s.alignmentX=bytes.f64(56);s.alignmentY=bytes.f64(64);
  s.left=bytes.f64(72);s.top=bytes.f64(80);s.right=bytes.f64(88);s.bottom=bytes.f64(96);
  require((flags&wire::imageFlags::canonical)&&flags<=255&&!bytes.u32(28)&&!bytes.u64(104)&&
    s.fit<=7&&s.repeat<=3&&s.quality<=3&&s.colorBlend<=28&&s.blend<=28&&s.scale>0&&
    bool(s.width)==bool(s.height)&&s.width<=8192&&s.height<=8192,wire::statuses::invalidValue);
  if(flags&wire::imageFlags::center)require(s.left>=0&&s.top>=0&&s.right>=s.left&&s.bottom>=s.top&&
    (!s.width||(s.right*s.scale<=s.width&&s.bottom*s.scale<=s.height)),wire::statuses::invalidValue);
  else require(!s.left&&!s.top&&!s.right&&!s.bottom,wire::statuses::invalidValue);
  require((flags&wire::imageFlags::tint)||!s.tint,wire::statuses::invalidValue);
  return s;
}
inline Writer imageStyleBytes(const ImageStyle& s){
  Writer bytes(wire::imageStyleBytes);const std::array<uint32_t,10> words{s.flags,s.fit,s.repeat,s.quality,s.tint,s.colorBlend,s.blend,0,s.width,s.height};
  for(size_t i=0;i<words.size();++i)bytes.u32(i*4,words[i]);
  const std::array<double,8> values{s.scale,s.opacity,s.alignmentX,s.alignmentY,s.left,s.top,s.right,s.bottom};
  for(size_t i=0;i<values.size();++i)bytes.f64(40+i*8,values[i]);return bytes;
}
struct ImageTile {Rect source,destination;};
struct ImagePlacement {
  ImageTile tile;double firstX=0,lastX=0,firstY=0,lastY=0;
  std::array<int32_t,4> center{};
  uint32_t count=0;bool clip=false,flip=false,nine=false;
};
inline ImagePlacement imagePlacement(const ImageStyle& s,double width,double height){
  ImagePlacement p;p.flip=s.flags&wire::imageFlags::flip;p.nine=s.flags&wire::imageFlags::center;
  if(!s.width||!s.height||width<=0||height<=0)return p;
  double ow=width,oh=height,iw=s.width,ih=s.height,sliceW=0,sliceH=0;
  bool sliceFits=true;
  if(p.nine){sliceW=iw/s.scale-(s.right-s.left);sliceH=ih/s.scale-(s.bottom-s.top);
    ow-=sliceW;oh-=sliceH;iw-=sliceW*s.scale;ih-=sliceH*s.scale;sliceFits=ow>0&&oh>0;
    const std::array<double,4> center{s.left,s.top,s.right,s.bottom};
    for(size_t i=0;i<4;++i)p.center[i]=int32_t(std::floor(center[i]*s.scale+0.5));
  }
  const auto fit=s.fit==7?(p.nine?0u:6u):s.fit;
  require(!p.nine||(fit!=2&&fit!=5),wire::statuses::invalidValue);
  double sw=iw/s.scale,sh=ih/s.scale,dw=0,dh=0;
  if(sw>0&&sh>0&&ow>0&&oh>0){
    switch(fit){
      case 0:dw=ow;dh=oh;break;
      case 1:if(ow/oh>sw/sh){dw=sw*oh/sh;dh=oh;}else{dw=ow;dh=sh*ow/sw;}break;
      case 2:if(ow/oh>sw/sh)sh=sw*oh/ow;else sw=sh*ow/oh;dw=ow;dh=oh;break;
      case 3:if(ow/oh>sw/sh){sh=sw*oh/ow;dw=ow;dh=oh;}else{dw=ow;dh=sh*ow/sw;}break;
      case 4:if(ow/oh>sw/sh){dw=sw*oh/sh;dh=oh;}else{sw=sh*ow/oh;dw=ow;dh=oh;}break;
      case 5:sw=std::min(sw,ow);sh=std::min(sh,oh);dw=sw;dh=sh;break;
      case 6:dw=sw;dh=sh;{const auto ratio=sw/sh;if(dh>oh){dw=oh*ratio;dh=oh;}if(dw>ow){dw=ow;dh=ow/ratio;}}break;
    }
  }else sw=sh=0;
  sw*=s.scale;sh*=s.scale;
  if(p.nine){ow+=sliceW;oh+=sliceH;dw+=sliceW;dh+=sliceH;
    require(!sliceFits||(std::abs(sw-iw)<=1e-10&&std::abs(sh-ih)<=1e-10),wire::statuses::invalidValue);
  }
  if(dw<=0||dh<=0)return p;
  const double halfW=(ow-dw)/2,halfH=(oh-dh)/2;
  p.tile.source={(iw-sw)*(1+s.alignmentX)/2,(ih-sh)*(1+s.alignmentY)/2,sw,sh};
  p.tile.destination={halfW+(p.flip?-s.alignmentX:s.alignmentX)*halfW,halfH+s.alignmentY*halfH,dw,dh};
  const auto repeat=s.repeat&&!(dw==ow&&dh==oh)?s.repeat:0;
  p.clip=repeat!=0;
  if(repeat==1||repeat==2){p.firstX=std::floor(-p.tile.destination.x/dw);p.lastX=std::ceil((width-p.tile.destination.x-dw)/dw);}
  if(repeat==1||repeat==3){p.firstY=std::floor(-p.tile.destination.y/dh);p.lastY=std::ceil((height-p.tile.destination.y-dh)/dh);}
  const double count=(p.lastX-p.firstX+1)*(p.lastY-p.firstY+1);
  require(std::isfinite(count)&&count>0&&count<=wire::limits::imageTiles,wire::statuses::budgetExceeded);
  p.count=uint32_t(count);
  for(const auto value:{p.tile.source.x,p.tile.source.y,sw,sh,p.tile.destination.x,p.tile.destination.y,dw,dh,p.firstX,p.lastX,p.firstY,p.lastY})
    require(std::isfinite(value)&&std::abs(value)<=1e12,wire::statuses::invalidValue);
  return p;
}
struct ImagePaint {
  Lease lease;ImageStyle style;double width,height;bool clip,flip,nine;std::array<int32_t,4> center;Rect bounds;
  std::vector<ImageTile> tiles;
  ImagePaint(const std::shared_ptr<Ledger>& ledger,const ImageStyle& s,double w,double h,ImagePlacement p)
    :lease(ledger,sizeof(ImagePaint)+p.count*sizeof(ImageTile)),style(s),width(w),height(h),clip(p.clip),flip(p.flip),nine(p.nine),center(p.center){
    tiles.reserve(p.count);
    for(double x=p.firstX;p.count&&x<=p.lastX;++x)for(double y=p.firstY;y<=p.lastY;++y){
      auto tile=p.tile;tile.destination.x+=x*tile.destination.width;tile.destination.y+=y*tile.destination.height;tiles.push_back(tile);
    }
    if(clip&&!tiles.empty())bounds={0,0,w,h};
    else if(!tiles.empty()){
      bounds=tiles.front().destination;if(flip)bounds.x=w-bounds.x-bounds.width;
      for(const auto& tile:tiles){auto rect=tile.destination;if(flip)rect.x=w-rect.x-rect.width;
        const auto right=std::max(bounds.x+bounds.width,rect.x+rect.width),bottom=std::max(bounds.y+bounds.height,rect.y+rect.height);
        bounds.x=std::min(bounds.x,rect.x);bounds.y=std::min(bounds.y,rect.y);bounds.width=right-bounds.x;bounds.height=bottom-bounds.y;
      }
    }
  }
};
inline Writer imagePaintBytes(const ImageStyle& style,const ImagePaint* paint){
  Writer bytes(wire::imagePaintBytes+(paint?paint->tiles.size()*64:0));const auto base=imageStyleBytes(style);
  std::copy(base.bytes.begin(),base.bytes.end(),bytes.bytes.begin());
  if(paint){bytes.u32(112,uint32_t(paint->tiles.size()));bytes.u32(116,(paint->clip?1u:0u)|(paint->flip?2u:0u)|(paint->nine?4u:0u));
    for(size_t i=0;i<4;++i)bytes.u32(128+i*4,uint32_t(paint->center[i]));
    const std::array<double,4> bounds{paint->bounds.x,paint->bounds.y,paint->bounds.width,paint->bounds.height};
    for(size_t i=0;i<4;++i)bytes.f64(144+i*8,bounds[i]);
    for(size_t i=0;i<paint->tiles.size();++i){const auto& tile=paint->tiles[i];const std::array<double,8> values{tile.source.x,tile.source.y,tile.source.width,tile.source.height,tile.destination.x,tile.destination.y,tile.destination.width,tile.destination.height};
      for(size_t j=0;j<8;++j)bytes.f64(wire::imagePaintBytes+i*64+j*8,values[j]);}
  }
  return bytes;
}
}
