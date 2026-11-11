// SPDX-License-Identifier: BSD-3-Clause
#include "../engine/core/layout/layout.hpp"
#include <iostream>
#include <stdexcept>
using namespace nelyx::v2;
namespace {
void check(bool value,const char* message){if(!value)throw std::runtime_error(message);}
void finish(LayoutWork& work){for(int i=0;i<20000;++i){if(work.step(64))return;check(!work.waiting(),"Unexpected provider request");}throw std::runtime_error("Materialization did not finish");}
void equal(const Document& actual,const Document& oracle){
  check(actual.count==oracle.count,"Materialized node count differs");
  for(const auto& slot:actual.nodes)if(slot.value){const auto& a=*slot.value;const auto& b=oracle.get(a.id);
    check(sameObservationNode(a,b)&&a.color==b.color&&a.paintBoundedWidth==b.paintBoundedWidth&&
      a.paintBoundedHeight==b.paintBoundedHeight&&a.contentOverflow==b.contentOverflow&&
      a.layoutTransform.a==b.layoutTransform.a&&a.layoutTransform.d==b.layoutTransform.d,
      "Cached materialization differs from full geometry");}
}
}
void checkMaterialization(){
  auto ledger=std::make_shared<Ledger>();
  for(const uint32_t count:{64u,2048u}){
    auto source=std::make_shared<Document>(ledger);source->epoch=1;
    auto root=std::make_shared<Node>(ledger);root->id={1,1};root->kind=wire::kinds::stack;
    root->layout.enabled=1;root->layout.constraintFlags=wire::layoutConstraintFlags::alignment;
    root->layout.alignmentX=-1;root->layout.alignmentY=-1;root->properties.width=200;root->properties.height=100;
    source->nodes.edit(1).value=root;source->children.append(0,root->id);
    for(uint32_t i=2;i<=count+1;++i){auto n=std::make_shared<Node>(ledger);n->id={i,1};n->parent=root->id;
      n->kind=wire::kinds::box;n->order=i-2;
      n->properties.width=20;n->properties.height=10;n->color=0xff123456;
      source->nodes.edit(i).value=n;source->children.append(1,n->id);}
    source->count=source->highWater=count+1;
    LayoutWork first(source,200,100,1,1,nullptr);finish(first);
    auto changed=std::make_shared<Document>(*source);changed->epoch=2;
    auto paint=std::make_shared<Node>(changed->get({2,1}));paint->color=0xff654321;
    ++paint->configurationRevision;changed->nodes.edit(2).value=paint;
    LayoutWork next(changed,200,100,1,1,first.output());finish(next);
    auto layoutOnly=std::make_shared<LayoutOutput>(ledger,1,1);layoutOnly->boxes=first.output()->boxes;
    LayoutWork oracle(changed,200,100,1,1,layoutOnly);finish(oracle);equal(*next.document(),*oracle.document());
    uint32_t shared=0;for(uint32_t i=1;i<=count+1;++i)shared+=first.document()->nodes[i].value==next.document()->nodes[i].value;
    check(shared==count,"Unchanged geometry was cloned or changed paint was reused");
    check(first.document()->get({2,1}).color==0xff123456,"Old immutable reader changed");
    auto moved=std::make_shared<Document>(*changed);moved->epoch=3;
    auto parent=std::make_shared<Node>(moved->get({1,1}));parent->layout.alignmentX=1;++parent->layoutRevision;
    moved->nodes.edit(1).value=parent;
    LayoutWork shifted(moved,200,100,1,1,next.output());finish(shifted);
    LayoutWork fullShift(moved,200,100,1,1,nullptr);finish(fullShift);equal(*shifted.document(),*fullShift.document());
    check(shifted.document()->get({3,1}).properties.x>next.document()->get({3,1}).properties.x,"Parent placement kept old geometry");
    LayoutWork scale(moved,200,100,2,1,shifted.output());finish(scale);
    check(scale.document()->nodes[3].value!=shifted.document()->nodes[3].value,"Scale reused a foreign cohort");
    LayoutWork resize(moved,100,80,1,1,shifted.output());finish(resize);
    LayoutWork fullResize(moved,100,80,1,1,nullptr);finish(fullResize);equal(*resize.document(),*fullResize.document());
    check(resize.document()->get({3,1}).properties.x<shifted.document()->get({3,1}).properties.x,"Resize kept old child placement");
    LayoutWork font(moved,200,100,1,2,shifted.output());finish(font);
    check(font.document()->nodes[3].value!=shifted.document()->nodes[3].value,"Font change reused a foreign cohort");
    auto recycled=std::make_shared<Document>(*moved);recycled->epoch=4;
    auto replacement=std::make_shared<Node>(recycled->get({2,1}));replacement->id.generation=2;
    recycled->nodes.edit(2).value=replacement;
    auto siblings=recycled->children[1];siblings[0]=replacement->id;recycled->children.set(1,std::move(siblings));
    auto revision=std::make_shared<Node>(recycled->get({1,1}));++revision->layoutRevision;recycled->nodes.edit(1).value=revision;
    LayoutWork generation(recycled,200,100,1,1,shifted.output());finish(generation);
    LayoutWork fullGeneration(recycled,200,100,1,1,nullptr);finish(fullGeneration);equal(*generation.document(),*fullGeneration.document());
    check(generation.document()->get({2,2}).id.generation==2,"Recycled generation lost");
  }
  check(ledger->bytes==0,"Materialized cache retained leases after retirement");
  std::cout<<"Materialized geometry sharing 64/2048, full oracle, placement, scale/font, generation and leases PASS.\n";
}
