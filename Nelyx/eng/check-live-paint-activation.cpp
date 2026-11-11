// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/state.hpp"
#include <stdexcept>
#include <iostream>
using namespace nelyx::v2;
namespace {
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
Writer command(uint32_t op,Handle id,const Writer& payload){Writer bytes(16+payload.bytes.size());
  bytes.u16(0,uint16_t(op));bytes.u32(4,uint32_t(bytes.bytes.size()));writeHandle(bytes,8,id);
  std::copy(payload.bytes.begin(),payload.bytes.end(),bytes.bytes.begin()+16);return bytes;}
}
void checkLivePaintActivation(){
  auto ledger=std::make_shared<Ledger>();
  {
    auto owner=std::make_unique<View>(1,ledger);auto& view=*owner;Resources resources{};
    auto source=std::make_shared<Document>(ledger);auto node=std::make_shared<Node>(ledger);
    node->id={1,1};node->kind=wire::kinds::box;node->properties.width=100;node->properties.height=80;
    source->nodes.edit(1).value=node;source->children.append(0,node->id);source->count=source->highWater=1;
    view.document=transact(source,resources,{nullptr,0},0).document;
    auto scene=std::make_shared<Scene>();scene->document=view.document;scene->metrics=view.metrics;
    scene->preparation=7;scene->epoch=1;view.nextScene=1;view.active=scene;
    const auto before=view.active;
    NativePaint paint(ledger,1);auto& entry=paint.entries[0];entry.kind=wire::nativePaintKinds::ripple;
    entry.reference={1,1};entry.color=0xff123456;entry.progress=0.5;entry.transform={0,0,0,0,0,0};
    auto bytes=command(wire::commands::nativePaint,{1,1},nativePaintBytes(paint));
    auto update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(update.retainedUpdates.size()==1,"Live paint transaction lost its change set");
    view.requestContent();check(!view.activateRetainedUpdate(update),"Pending content was bypassed");view.demand.reset();
    ++view.metrics.epoch;check(!view.activateRetainedUpdate(update),"Foreign metrics reused preparation");--view.metrics.epoch;
    ++view.fontRevision;check(!view.activateRetainedUpdate(update),"Foreign font reused preparation");--view.fontRevision;
    check(view.activateRetainedUpdate(update),"Live-only paint required Content");view.document=update.document;
    check(view.active->preparation==7&&view.active->epoch==2&&!view.demand&&!view.preparing,"Prepared base was replaced");
    check(!before->document->get({1,1}).nativePaint,"Old reader was mutated");
    Frame frame;frame.scene=view.active;frame.properties.resize(2);frame.properties[1].opacity=1;
    view.makeDrawItems(frame);check(frame.items.size()==1&&frame.items[0].paint&&frame.paintNodes==1,"Live paint was not evaluated");
    auto geometry=std::make_shared<Document>(*view.document);resolveNativePaint(*geometry);
    auto oracle=std::make_shared<Scene>(*view.active);oracle->document=geometry;
    Frame full;full.scene=oracle;full.properties=frame.properties;view.makeDrawItems(full);
    check(nativePaintBytes(*full.items[0].paint).bytes==nativePaintBytes(*frame.items[0].paint).bytes,"Live frame differs from full preparation");
    entry.reference={};entry.kind=wire::nativePaintKinds::shape;entry.progress=0;
    bytes=command(wire::commands::nativePaint,{1,1},nativePaintBytes(paint));
    auto staticPaint=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(!view.activateRetainedUpdate(staticPaint),"Static recorded paint bypassed Content");
    bytes=command(wire::commands::nativePaint,{1,1},Writer(0));
    update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(view.activateRetainedUpdate(update),"Clearing live paint required Content");view.document=update.document;
    check(!view.active->document->get({1,1}).nativePaint&&frame.scene->document->get({1,1}).nativePaint,"Clear invalidated a retained frame");
  }
  {
    auto owner=std::make_unique<View>(1,ledger);auto& view=*owner;Resources resources{};
    auto source=std::make_shared<Document>(ledger);auto node=std::make_shared<Node>(ledger);
    node->id={1,1};node->kind=wire::kinds::box;node->layout.enabled=1;
    node->layout.constraintFlags=wire::layoutChildConstraints::inherit|wire::layoutConstraintFlags::expandEmpty;
    node->layoutBuilder=LayoutBuilderStyle{1,1,{wire::bounds::finite,0,100},{wire::bounds::finite,0,80}};
    source->nodes.edit(1).value=node;source->children.append(0,node->id);source->count=source->highWater=1;
    view.document=transact(source,resources,{nullptr,0},0).document;
    auto geometry=std::make_shared<Document>(*view.document);auto placed=std::make_shared<Node>(*node);
    placed->properties.width=100;placed->properties.height=80;geometry->nodes.edit(1).value=placed;
    auto scene=std::make_shared<Scene>();scene->document=geometry;scene->metrics=view.metrics;scene->preparation=9;view.active=scene;
    Writer payload(wire::layoutBuilderBytes);payload.u64(0,2);payload.u64(8,2);
    payload.u32(16,wire::bounds::finite);payload.f64(32,100);payload.u32(40,wire::bounds::finite);payload.f64(56,80);
    auto bytes=command(wire::commands::layoutBuilder,{1,1},payload);
    auto update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(view.activateRetainedUpdate(update),"Completed same-input builder required Content");view.document=update.document;
    check(view.active->document->get({1,1}).properties.width==100&&view.active->document->get({1,1}).layoutBuilder->revision==2,
      "Metadata promotion lost materialized geometry or builder revision");
    check(scene->document->get({1,1}).layoutBuilder->revision==1,"Metadata changed an old reader");
    payload.u64(0,3);payload.u64(8,3);payload.f64(32,90);bytes=command(wire::commands::layoutBuilder,{1,1},payload);
    update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(update.retainedUpdates.empty()&&!view.activateRetainedUpdate(update),"Changed constraints bypassed layout");
    payload.f64(32,100);payload.u64(8,2);bytes=command(wire::commands::layoutBuilder,{1,1},payload);
    update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},1);
    check(update.retainedUpdates.empty(),"Pending builder bypassed layout");
    payload.u64(8,3);bytes=command(wire::commands::layoutBuilder,{1,1},payload);
    Writer color(16);color.u32(0,0xff123456);const auto mixed=command(wire::commands::paint,{1,1},color);
    bytes.bytes.insert(bytes.bytes.end(),mixed.bytes.begin(),mixed.bytes.end());
    update=transact(view.document,resources,{bytes.bytes.data(),bytes.bytes.size()},2);
    check(update.retainedUpdates.empty(),"Mixed static paint reused a stale preparation");
  }
  check(ledger->bytes==0,"Live activation retained leases");
  std::cout<<"Live paint activation, full frame oracle, immutable readers, metrics/font/demand fences, static fallback and leases PASS.\n";
}
