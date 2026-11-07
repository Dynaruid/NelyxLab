// SPDX-License-Identifier: BSD-3-Clause
#pragma once
// Core font snapshots + actual Native Content C++ CPU pixels, without a window.
std::array<uint64_t,8> nativeFontText(const std::string& root,const std::shared_ptr<Ledger>& ledger){
  nw::ContentProvider provider(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger);
  nw::ParagraphProvider base(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger,1);
  const auto catalog=[&](const char* file,Handle id){
    const auto font=SkData::MakeFromFileName((root+"/assets/"+file).c_str());if(!font)throw std::runtime_error("Native font fixture unavailable");
    const std::array<std::string,4> fallback{"NelyxDefault","NelyxArabic","NelyxHebrew","NelyxEmoji"};
    size_t size=32+16+16+paragraphAligned(font->size());for(const auto& name:fallback)size+=8+paragraphAligned(name.size());
    Writer data(size);data.u32(0,0x31544e46);data.u32(4,1);data.u32(8,1);data.u32(12,4);data.u32(16,uint32_t(size));
    data.u32(32,12);data.u32(36,uint32_t(font->size()));std::copy_n("NelyxDefault",12,data.bytes.data()+48);
    std::copy_n(font->bytes(),font->size(),data.bytes.data()+64);size_t at=64+paragraphAligned(font->size());
    for(const auto& name:fallback){data.u32(at,uint32_t(name.size()));std::copy(name.begin(),name.end(),data.bytes.begin()+at+8);at+=8+paragraphAligned(name.size());}
    auto storage=std::make_shared<ResourceStorage>(ledger,size);storage->bytes=std::move(data.bytes);
    return std::make_shared<Resource>(ledger,id,std::move(storage));
  };
  auto a=catalog("NotoSansHebrew.ttf",{50,1}),b=catalog("NotoNaskhArabic-Regular.ttf",{50,2});
  const auto config=[](const Resource& value){return readFontCatalog({value.bytes.data(),value.bytes.size()});};
  nw::ParagraphProvider first(base,config(*a),ledger,1),second(base,config(*b),ledger,1);
  const std::string value="ABC \xd7\x90\xd7\x91\xd7\x92 \xd9\x85\xd8\xb1\xd8\xad\xd8\xa8\xd8\xa7";
  ParagraphOptions options;auto firstControl=first.build(value,24,0xff172033,0,&options,180);
  auto source=std::make_shared<Document>(ledger);
  const auto add=[&](uint32_t kind,Handle parent){auto node=std::make_shared<Node>(ledger);node->id={++source->highWater,1};node->kind=kind;node->parent=parent;
    node->layout.enabled=1;node->layoutRevision=1;node->order=uint32_t(source->children[parent.slot].size());source->children[parent.slot].push_back(node->id);
    source->nodes[node->id.slot].value=node;++source->count;return node;};
  auto parent=add(wire::kinds::stack,{});parent->properties.width=240;parent->properties.height=160;
  // Admission control: put the retained collection first in the fixed 16 MiB
  // cache. Two distinct 8 MiB collection credits cannot both stay cached.
  auto recording=add(wire::kinds::paragraph,parent->id),regular=add(wire::kinds::paragraph,parent->id);
  for(const auto& node:{regular,recording}){node->fontSize=24;node->color=0xff172033;node->properties.width=180;
    node->layout.constraintFlags=wire::layoutConstraintFlags::paragraphSizing;node->paragraph=std::make_shared<ParagraphData>(ledger,options);
    node->text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(value.data()),value.size()});}
  recording->fontPinned=true;recording->fontRevision=2;recording->fontResource=a;recording->layout.constraintFlags|=wire::layoutConstraintFlags::paintChild;
  auto placement=std::make_shared<PaintPlacement>(ledger);placement->fontRevision=2;placement->width=180;placement->height=firstControl->getHeight();placement->baseline=firstControl->getAlphabeticBaseline();
  auto program=std::make_shared<NativePaint>(ledger,1,4);auto& entry=program->entries[0];entry.kind=wire::nativePaintKinds::shape;entry.geometry=wire::nativePaintGeometryKinds::program;entry.repeat=1;entry.strokeAlign=0;entry.expressions.fill(UINT32_MAX);
  const std::array<double,4> rect{0,60,180,firstControl->getHeight()};for(size_t i=0;i<4;++i){program->expressions[i].value=rect[i];entry.expressions[i]=uint32_t(i);}
  placement->program=std::move(program);recording->paintPlacement=placement;
  uint64_t operations=0,differences=0,ink=0,retainedInk=0;
  std::shared_ptr<const nw::Prepared> retained;
  const auto compare=[&](const sk_sp<SkPicture>& picture,skia::textlayout::Paragraph& control,double x,double y){
    auto actual=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,128)),expected=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(256,128));
    if(!actual||!expected)throw std::runtime_error("Native font raster unavailable");
    actual->getCanvas()->clear(SK_ColorWHITE);actual->getCanvas()->drawPicture(picture);expected->getCanvas()->clear(SK_ColorWHITE);control.paint(expected->getCanvas(),float(x),float(y));
    SkPixmap left,right;if(!actual->peekPixels(&left)||!expected->peekPixels(&right))throw std::runtime_error("Native font pixels unavailable");
    uint64_t painted=0;for(int row=0;row<128;++row)for(int column=0;column<256;++column){differences+=left.getColor(column,row)!=right.getColor(column,row);painted+=left.getColor(column,row)!=SK_ColorWHITE;}
    if(!painted)throw std::runtime_error("Native font paragraph produced no ink");ink+=painted;return painted;
  };
  for(uint64_t phase=0;phase<3;++phase){
    const auto resource=phase==0?std::shared_ptr<const Resource>(a):phase==1?std::shared_ptr<const Resource>(b):nullptr;
    const auto document=fontDocument(source,resource,phase+2);
    if(document->get(recording->id).fontResource!=a||document->get(recording->id).fontRevision!=2||document->get(regular->id).fontResource!=resource)
      throw std::runtime_error("Core font snapshot changed an older recording");
    LayoutWork work(document,240,160,1,phase+2,nullptr);bool complete=false;
    for(uint32_t step=0;step<30&&!complete;++step){complete=work.step(128);if(work.waiting()){
      auto request=*work.request();request.preparation=phase+100;work.measured(request.id,request.node->id,provider.measure(request));
    }}
    if(!complete)throw std::runtime_error("Native font layout did not terminate");operations+=work.work();const auto geometry=work.document();
    Preparation preparation;preparation.document=geometry;preparation.id=phase+100;preparation.metrics={1,1,240,160,1};preparation.fontRevision=phase+2;
    auto prepared=provider.prepare(preparation);auto& control=phase==0?first:phase==1?second:base;
    auto regularControl=control.build(value,24,regular->color,0,&options,180);
    const auto& current=geometry->get(regular->id);compare(prepared->pictures.at(regular->id.key()),*regularControl,current.contentX,current.contentY);
    const auto& old=geometry->get(recording->id);compare(prepared->pictures.at(recording->id.key()),*firstControl,old.contentX,old.contentY);
    if(!phase)retained=std::move(prepared);
  }
  retainedInk=compare(retained->pictures.at(regular->id.key()),*firstControl,0,0);
  if(differences||provider.fontLoads!=2||provider.reusedParagraphs<2)throw std::runtime_error("Native font revisions: diff="+std::to_string(differences)+" loads="+std::to_string(provider.fontLoads)+" reuse="+std::to_string(provider.reusedParagraphs));
  return {provider.measurements,provider.paragraphLayouts,operations,provider.fontLoads,provider.reusedParagraphs,differences,ink,retainedInk};
}
