// SPDX-License-Identifier: BSD-3-Clause
#pragma once
// Actual Native Core + Content CPU pixels. No HWND, display or physical input claim.
std::array<uint64_t,7> nativeInlineText(const std::string& root,const std::shared_ptr<Ledger>& ledger){
  nw::ContentProvider provider(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger);
  nw::ParagraphProvider control(root+"/assets/font.ttf",root+"/assets/icudtl.dat",ledger,1);
  uint64_t operations=0,slots=0,hidden=0,differences=0,ink=0;
  const auto approximate=[](double a,double b){return std::abs(a-b)<1e-4;};
  for(uint32_t phase=0;phase<4;++phase){
    const double scale=phase?1.5:1.25,width=phase==1?140:220;
    auto document=std::make_shared<Document>(ledger);
    const auto add=[&](uint32_t kind,Handle parent){auto node=std::make_shared<Node>(ledger);node->id={++document->highWater,1};node->kind=kind;node->parent=parent;node->layout.enabled=1;node->layoutRevision=1;
      node->order=uint32_t(document->children[parent.slot].size());document->children[parent.slot].push_back(node->id);document->nodes[node->id.slot].value=node;++document->count;return node;};
    const auto text=[&](Node& node,const std::string& value){node.text=std::make_shared<TextData>(ledger,Reader{reinterpret_cast<const uint8_t*>(value.data()),value.size()});node.layout.constraintFlags=wire::layoutConstraintFlags::paragraphSizing;};
    auto paragraph=add(wire::kinds::paragraph,{});paragraph->properties.x=32;paragraph->properties.y=32;paragraph->fontSize=18;paragraph->color=0xffdd3300;paragraph->textDirection=phase==1;
    std::string value="A ";ParagraphOptions declared,expected;declared.flags|=wire::paragraphFlags::inlineChildren;
    if(phase==1){declared.maxLines=1;declared.ellipsis="\xe2\x80\xa6";}
    if(phase==3){ParagraphStrut strut;strut.fontFamilies={"NelyxDefault"};strut.fontSize=8;strut.height=0.5;strut.flags=4;declared.strut=std::move(strut);}
    std::array<Handle,7> wrappers{},labels{};
    std::array<std::unique_ptr<skia::textlayout::Paragraph>,7> childControl;
    for(uint32_t i=0;i<7;++i){const auto alignment=i==6?0:i;ParagraphPlaceholder item;item.offset=uint32_t(value.size());item.alignment=alignment;item.baseline=i==6;declared.placeholders.push_back(item);value+="\xef\xbf\xbc B ";
      auto wrapper=add(wire::kinds::box,paragraph->id);wrappers[i]=wrapper->id;wrapper->layout.constraintFlags=wire::layoutConstraintFlags::inlineScale;wrapper->layout.inlineScale=scale;
      auto sized=add(wire::kinds::box,wrapper->id);sized->properties.width=20+i;sized->properties.height=28+i+(phase?6:0);sized->color=0xffbbddaa+i*0x00040301;
      auto child=add(wire::kinds::paragraph,sized->id);labels[i]=child->id;child->fontSize=12;child->color=0xff112233;text(*child,"M");
      child->paragraph=std::make_shared<ParagraphData>(ledger,ParagraphOptions{});
      childControl[i]=control.build("M",12,child->color,0,&child->paragraph->value,sized->properties.width);
    }
    // Offsets in the declaration are UTF16 units, not UTF8 bytes.
    for(uint32_t i=0;i<7;++i)declared.placeholders[i].offset=2+i*4;
    text(*paragraph,value);paragraph->layout.constraintFlags|=wire::layoutConstraintFlags::clipOverflow;
    paragraph->paragraph=std::make_shared<ParagraphData>(ledger,declared);expected=declared;expected.flags&=~wire::paragraphFlags::inlineChildren;
    for(uint32_t i=0;i<7;++i){auto& item=expected.placeholders[i];item.width=(20+i)*scale;item.height=(28+i+(phase?6:0))*scale;
      item.baselineOffset=item.alignment==0?(item.baseline?childControl[i]->getIdeographicBaseline():childControl[i]->getAlphabeticBaseline())*scale:item.height;}
    LayoutWork work(document,paragraph->id,{0,width,0,240},1,1);
    bool complete=false;for(uint32_t step=0;step<30&&!complete;++step){complete=work.step(256);if(work.waiting()){
      auto request=*work.request();request.preparation=500+phase;const auto measured=provider.measure(request);
      if(request.node->id==paragraph->id){if(!measured.placeholders)throw std::runtime_error("Native inline measurement omitted its geometry");
        const auto& actual=request.node->paragraph->value.placeholders;for(uint32_t i=0;i<7;++i)
          if(!approximate(actual[i].width,expected.placeholders[i].width)||!approximate(actual[i].height,expected.placeholders[i].height)||!approximate(actual[i].baselineOffset,expected.placeholders[i].baselineOffset))throw std::runtime_error("Native Core changed the child size or baseline");}
      work.measured(request.id,request.node->id,measured);
    }}
    if(!complete)throw std::runtime_error("Native inline continuation did not terminate");operations+=work.work();const auto geometry=work.document();
    const auto& laidOut=geometry->get(paragraph->id);auto reference=control.build(value,18,paragraph->color,paragraph->textDirection,&expected,width);const auto boxes=reference->getRectsForPlaceholders();slots+=boxes.size();
    for(uint32_t i=0;i<7;++i){const auto& wrapper=geometry->get(wrappers[i]);
      if(i<boxes.size()){if(wrapper.inlineHidden||!approximate(wrapper.properties.x,boxes[i].rect.x())||!approximate(wrapper.properties.y,boxes[i].rect.y()))throw std::runtime_error("Native inline position differs from SkParagraph");}
      else{if(!wrapper.inlineHidden||!geometry->get(labels[i]).inlineHidden)throw std::runtime_error("Native ellipsis did not hide the child subtree");++hidden;}
    }
    Preparation preparation;preparation.document=geometry;preparation.id=500+phase;preparation.metrics={1,1,512,320,1};auto prepared=provider.prepare(preparation);
    Frame frame;frame.scene=std::make_shared<Scene>(Scene{geometry,preparation.metrics,1,preparation.id,{}});frame.properties.resize(document->highWater+1);View view(1,ledger);view.makeDrawItems(frame);
    for(uint32_t i=uint32_t(boxes.size());i<7;++i)if(frame.allows(labels[i]))throw std::runtime_error("Native hidden inline child allows input");
    auto actual=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(512,320)),wanted=SkSurfaces::Raster(SkImageInfo::MakeN32Premul(512,320));if(!actual||!wanted)throw std::runtime_error("Native inline raster unavailable");
    nw::NativePaintCounts paints;nw::drawPreparedFrame(actual->getCanvas(),frame,*prepared,1,paints);
    auto canvas=wanted->getCanvas();canvas->clear(0xfff4f6fa);canvas->translate(32,32);if(laidOut.contentOverflow)canvas->clipRect(SkRect::MakeWH(float(laidOut.properties.width),float(laidOut.properties.height)));
    reference->paint(canvas,0,0);SkPaint paint;paint.setAntiAlias(true);
    for(uint32_t i=0;i<boxes.size();++i){const auto& box=boxes[i].rect;canvas->save();
      // Paint the child's logical box through its transform, as Source does.
      // SkParagraph's independently rounded right/bottom are query geometry.
      canvas->setMatrix(SkMatrix::MakeAll(float(scale),0,float(32+double(box.x())),0,float(scale),float(32+double(box.y())),0,0,1));
      paint.setColor(0xffbbddaa+i*0x00040301);canvas->drawRect(SkRect::MakeWH(float(20+i),float(28+i+(phase?6:0))),paint);childControl[i]->paint(canvas,0,0);canvas->restore();}
    SkPixmap a,b;if(!actual->peekPixels(&a)||!wanted->peekPixels(&b))throw std::runtime_error("Native inline pixels unavailable");
    uint64_t phaseDifferences=0;std::string samples;
    for(int y=0;y<320;++y)for(int x=0;x<512;++x){const bool different=a.getColor(x,y)!=b.getColor(x,y);differences+=different;ink+=a.getColor(x,y)!=0xfff4f6fa;
      if(different&&phaseDifferences++<8)samples+=" ("+std::to_string(x)+","+std::to_string(y)+":"+std::to_string(a.getColor(x,y))+"/"+std::to_string(b.getColor(x,y))+")";}
    if(phaseDifferences)throw std::runtime_error("Native inline phase="+std::to_string(phase)+" diff="+std::to_string(phaseDifferences)+samples);
  }
  if(differences||!ink||!hidden)throw std::runtime_error("Native inline pixels or hidden child control failed: diff="+std::to_string(differences));
  return {provider.measurements,provider.paragraphLayouts,operations,slots,hidden,differences,ink};
}
