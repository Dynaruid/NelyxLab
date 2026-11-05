// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>
namespace nelyx::v2 {
void validateGraphics(const Document& geometry) {
  std::function<void(const Node&,Affine)> visit;
  visit=[&](const Node& node,Affine parent){
    if(node.extensionSize.x>0)require(!node.layout.enabled&&node.properties.width==node.extensionSize.x&&node.properties.height==node.extensionSize.y,wire::statuses::invalidValue);
    const auto world=parent*Affine{1,0,0,1,node.properties.x,node.properties.y}*node.graphics.transform;
    world.bounds({0,0,node.properties.width,node.properties.height});
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),world);
  };
  for(const auto root:geometry.children[0])visit(geometry.get(root),{});
}
void View::makeDrawItems(Frame& f)const {
  const auto& geometry=*f.scene->document;
  std::function<void(const Node&,Affine,double,Rect,uint32_t,uint32_t)> visit;
  visit=[&](const Node& node,Affine parent,double alpha,Rect clip,uint32_t head,uint32_t depth){
    const auto& property=f.properties[node.id.slot];
    auto world=parent*Affine{1,0,0,1,node.properties.x,node.properties.y}*node.graphics.transform;
    alpha*=property.opacity;
    const auto bounds=world.bounds({0,0,node.properties.width,node.properties.height});
    f.properties[node.id.slot].visible=alpha>0&&world.inverse().has_value();
    if(node.kind==wire::kinds::clip||node.kind==wire::kinds::scrollViewport){
      clip=intersect(clip,bounds);
      f.clips.push_back({world,{0,0,node.properties.width,node.properties.height},node.radius,node.graphics.path,head});
      head=uint32_t(f.clips.size());
    }
    f.items.push_back({node.id,world.tx,world.ty,alpha,clip,world,bounds,head,depth});
    if((node.policy&4u)&&alpha>0)f.modalRoot=node.id;
    if(node.kind==wire::kinds::scrollViewport)
      world=world*Affine{1,0,0,1,(node.properties.flags&1u)?-property.offset:0,(node.properties.flags&1u)?0:-property.offset};
    for(const auto child:geometry.children[node.id.slot])visit(geometry.get(child),world,alpha,clip,head,depth+1);
  };
  f.items.reserve(geometry.count);f.clips.reserve(geometry.count);
  for(const auto root:geometry.children[0])visit(geometry.get(root),{},1,{0,0,f.scene->metrics.width,f.scene->metrics.height},0,0);
}
Handle View::target(double x,double y,const Frame* snapshot)const {
  const auto* frame=snapshot?snapshot:published.get();if(!frame)return {};
  const auto& geometry=*frame->scene->document;
  for(auto it=frame->items.rbegin();it!=frame->items.rend();++it){
    const auto& node=geometry.get(it->node);
    if(it->opacity<=0||!frame->allows(node.id)||!frame->hit(*it,x,y))continue;
    for(const Node* current=&node;current;current=current->parent?&geometry.get(current->parent):nullptr)
      if(current->kind==wire::kinds::scrollViewport)return current->id;
  }return {};
}
}
