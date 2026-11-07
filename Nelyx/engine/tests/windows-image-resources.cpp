// SPDX-License-Identifier: BSD-3-Clause
#include <windows.h>
#include "../platform/windows/skia_provider.hpp"
#include <fstream>
#include <iostream>
using namespace nelyx::v2;
namespace nw=nelyx::v2::windows;
uint32_t rawImages(nw::ContentProvider& content,const std::shared_ptr<Ledger>& ledger){
  sk_sp<SkPicture> retained;std::weak_ptr<const ResourceStorage> old;
  const std::array<SkColor,4> colors{SK_ColorRED,SK_ColorGREEN,SK_ColorBLUE,SK_ColorWHITE};
  for(uint32_t phase=0;phase<8;++phase){
    Writer bytes(wire::rasterImageHeaderBytes+8*8*4);bytes.u32(0,wire::rasterImageMagic);bytes.u32(4,1);bytes.u32(8,8);bytes.u32(12,8);bytes.u32(16,32);bytes.u32(20,256);bytes.u32(24,1);
    for(uint32_t y=0;y<8;++y)for(uint32_t x=0;x<8;++x){const auto color=colors[(y>=4?2:0)+(x>=4?1:0)];const auto at=wire::rasterImageHeaderBytes+(y*8+x)*4;
      bytes.bytes[at]=SkColorGetR(color);bytes.bytes[at+1]=SkColorGetG(color);bytes.bytes[at+2]=SkColorGetB(color);bytes.bytes[at+3]=255;}
    auto resource=std::make_shared<Resource>(ledger,Handle{3,phase+1},Reader{bytes.bytes.data(),bytes.bytes.size()});
    auto node=std::make_shared<Node>(ledger);node->id={3,1};node->kind=wire::kinds::image;node->resource=resource;
    node->properties.width=node->properties.height=node->contentWidth=node->contentHeight=64;
    ImageStyle style;style.width=style.height=8;style.fit=0;style.quality=0;
    if(phase==1)style.flags|=wire::imageFlags::flip;
    if(phase==2){style.flags|=wire::imageFlags::tint;style.tint=SK_ColorCYAN;}
    if(phase==3)style.flags|=wire::imageFlags::invert;
    if(phase==4)style.opacity=0.5;
    if(phase==5){style.fit=7;style.repeat=1;style.alignmentX=style.alignmentY=-1;}
    if(phase==6){style.flags|=wire::imageFlags::center;style.left=style.top=2;style.right=style.bottom=6;}
    if(phase==7){style.quality=3;style.flags|=wire::imageFlags::antialias;style.blend=wire::imageBlendModes::multiply;}
    node->imageStyle=style;node->imagePaint=std::make_shared<ImagePaint>(ledger,style,64,64,imagePlacement(style,64,64));
    auto document=std::make_shared<Document>(ledger);document->nodes[3].value=node;document->children[0].push_back(node->id);document->count=1;document->highWater=3;
    Preparation preparation;preparation.id=phase+20;preparation.document=document;
    const auto prepared=content.prepare(preparation);
    auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(64,64));surface->getCanvas()->clear(0xff102030);surface->getCanvas()->drawPicture(prepared->pictures.at(node->id.key()));
    SkPixmap pixels;if(!surface->peekPixels(&pixels))throw std::runtime_error("Native raw pixels unavailable");
    auto expected=colors;
    if(phase==1)expected={SK_ColorGREEN,SK_ColorRED,SK_ColorWHITE,SK_ColorBLUE};
    if(phase==2)expected.fill(SK_ColorCYAN);
    if(phase==3)expected={SK_ColorCYAN,SK_ColorMAGENTA,SK_ColorYELLOW,SK_ColorBLACK};
    if(phase==4)expected={0xff881018,0xff089018,0xff081098,0xff889098};
    if(phase==7)expected={0xff100000,0xff002000,0xff000030,0xff102030};
    for(size_t i=0;i<4;++i){const auto x=phase==5?(i%2?5:1):(i%2?56:8),y=phase==5?(i/2?5:1):(i/2?56:8);
      if(pixels.getColor(x,y)!=expected[i])throw std::runtime_error("Native raw image style pixels differ at phase "+std::to_string(phase)+" quadrant "+std::to_string(i));}
    if(!phase){retained=prepared->pictures.at(node->id.key());old=resource->storage;}
  }
  content.trimCache();
  if(old.expired())throw std::runtime_error("Raw Picture dropped its Core pixel storage lease");
  auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(64,64));surface->getCanvas()->clear(SK_ColorTRANSPARENT);surface->getCanvas()->drawPicture(retained);
  SkPixmap pixels;if(!surface->peekPixels(&pixels)||pixels.getColor(8,8)!=SK_ColorRED)throw std::runtime_error("Retained raw Picture pixels differ");
  retained.reset();
  if(!old.expired())throw std::runtime_error("Raw pixels outlived their last Picture");
  return 8;
}
int main(int argc,char** argv){
  try{
    if(argc!=3)throw std::runtime_error("Expected supply root and image directory");
    auto ledger=std::make_shared<Ledger>();uint64_t reads=0,images=0,pictures=0,raw=0;
    {
      const auto root=std::string(argv[1]),directory=std::string(argv[2]);
      nw::ContentProvider content(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger);
      std::shared_ptr<const nw::Prepared> previous;
      std::weak_ptr<const ResourceStorage> old;
      for(uint32_t phase=0;phase<2;++phase){
        std::ifstream file(directory+(phase?"/second.png":"/first.png"),std::ios::binary);
        std::vector<uint8_t> bytes{std::istreambuf_iterator<char>(file),std::istreambuf_iterator<char>()};
        if(bytes.size()<=wire::limits::packetBytes)throw std::runtime_error("Large image fixture is missing");
        auto resource=std::make_shared<Resource>(ledger,Handle{1,phase+1},Reader{bytes.data(),bytes.size()});
        auto node=std::make_shared<Node>(ledger);node->id={1,1};node->kind=wire::kinds::image;node->resource=resource;
        node->properties.width=node->properties.height=node->contentWidth=node->contentHeight=64;
        auto measurement=content.measure({phase+1,node,64,true,phase+1});
        if(measurement.width!=600||measurement.height!=512)throw std::runtime_error("Native intrinsic image size differs");
        auto document=std::make_shared<Document>(ledger);document->nodes[1].value=node;document->children[0].push_back(node->id);document->count=document->highWater=1;
        Preparation preparation;preparation.document=document;preparation.id=phase+1;
        auto prepared=content.prepare(preparation);
        auto surface=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(64,64));
        surface->getCanvas()->clear(SK_ColorTRANSPARENT);surface->getCanvas()->drawPicture(prepared->pictures.at(node->id.key()));
        SkPixmap pixels;if(!surface->peekPixels(&pixels))throw std::runtime_error("Native image raster pixels unavailable");
        const std::array<SkColor,4> expected=phase?
          std::array<SkColor,4>{SK_ColorCYAN,SK_ColorMAGENTA,SK_ColorYELLOW,SK_ColorBLACK}:
          std::array<SkColor,4>{SK_ColorRED,SK_ColorGREEN,SK_ColorBLUE,SK_ColorWHITE};
        for(size_t i=0;i<4;++i)if(pixels.getColor(i%2?56:8,i/2?56:8)!=expected[i])throw std::runtime_error("Native large image quadrant differs");
        if(!phase){previous=prepared;old=resource->storage;}
        else{
          if(!old.expired())throw std::runtime_error("An old producer survives its last document/cache holder");
          surface->getCanvas()->clear(SK_ColorTRANSPARENT);surface->getCanvas()->drawPicture(previous->pictures.at(node->id.key()));
          if(pixels.getColor(8,8)!=SK_ColorRED)throw std::runtime_error("Retained Native image Picture lost its pixels after producer retirement");
        }
        ++reads;
      }
      images=content.images;pictures=content.pictures;
      if(content.measurements!=2||images!=2||pictures!=2)throw std::runtime_error("Native image work was not observed");
      raw=rawImages(content,ledger);
    }
    if(ledger->snapshot().total)throw std::runtime_error("Native image resources survived owner termination");
    std::cout<<"{\"control\":\"Native-CPU-large-images\",\"measurements\":"<<reads<<",\"images\":"<<images<<",\"pictures\":"<<pictures<<",\"rawPictures\":"<<raw<<",\"rawRetainedBacking\":true,\"retainedPicturePixels\":true,\"ledgerAfterTermination\":0}";
    return 0;
  }catch(const std::exception& error){std::cerr<<error.what();return 1;}
}
