// SPDX-License-Identifier: BSD-3-Clause
#include "../state.hpp"
#include <algorithm>
#include <functional>
namespace nelyx::v2 {
bool Frame::sameInputGeometry(const Frame& other, Handle node)const {
  if(device!=other.device||scene->metrics.epoch!=other.scene->metrics.epoch)return false;
  const auto sameRect=[](Rect a,Rect b){return a.x==b.x&&a.y==b.y&&a.width==b.width&&a.height==b.height;};
  for(uint32_t depth=0;node&&depth<=wire::limits::depth;++depth){
    if(!scene->document->contains(node)||!other.scene->document->contains(node))return false;
    const auto& a=scene->document->get(node);const auto& b=other.scene->document->get(node);
    const auto ap=a.physicalPaint(),bp=b.physicalPaint();
    if(bool(ap)!=bool(bp)||(ap&&!sameNativePaintHit(*ap,*bp)))return false;
    if(a.parent!=b.parent||a.kind!=b.kind||((a.policy^b.policy)&(120u|wire::eventPolicies::roundedHitTest))||a.properties.width!=b.properties.width||
      a.properties.height!=b.properties.height||a.properties.flags!=b.properties.flags||
      ((a.kind==wire::kinds::clip||a.kind==wire::kinds::path)&&
        (a.radius!=b.radius||a.graphics.path!=b.graphics.path||a.clipStyle!=b.clipStyle))||
      ((a.policy&wire::eventPolicies::roundedHitTest)&&a.radius!=b.radius))return false;
    const auto left=std::find_if(items.begin(),items.end(),[&](const auto& item){return item.node==node;});
    const auto right=std::find_if(other.items.begin(),other.items.end(),[&](const auto& item){return item.node==node;});
    if(left==items.end()||right==other.items.end()||!sameRect(left->clip,right->clip))return false;
    const auto& x=left->world;const auto& y=right->world;
    if(x.a!=y.a||x.b!=y.b||x.c!=y.c||x.d!=y.d||x.tx!=y.tx||x.ty!=y.ty)return false;
    node=a.parent;
  }
  return !node;
}
void validateGraphics(const Document& geometry) {
  std::function<void(const Node&,Affine)> visit;
  visit=[&](const Node& node,Affine parent){
    if(node.extensionSize.x>0)require(!node.layout.enabled&&node.properties.width==node.extensionSize.x&&node.properties.height==node.extensionSize.y,wire::statuses::invalidValue);
    const auto world=parent*Affine{1,0,0,1,node.properties.x,node.properties.y}*node.graphics.effective(node.properties.width,node.properties.height);
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
    auto world=parent*Affine{1,0,0,1,node.properties.x,node.properties.y}*node.graphics.effective(node.properties.width,node.properties.height);
    alpha*=property.opacity;
    const auto bounds=world.bounds({0,0,node.properties.width,node.properties.height});
    f.properties[node.id.slot].visible=(alpha>0||(node.policy&wire::eventPolicies::canonicalHitTest))&&world.inverse().has_value();
    bool overflowClip=(node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&node.contentOverflow;
    if((node.layout.constraintFlags&wire::layoutConstraintFlags::clipOverflow)&&!overflowClip)
      for(const auto child:geometry.children[node.id.slot]){const auto& p=geometry.get(child).properties;
        if(p.x<0||p.y<0||p.x+p.width>node.properties.width||p.y+p.height>node.properties.height){overflowClip=true;break;}}
    const auto physical=node.physicalPaint();
    const bool styledClip=node.kind==wire::kinds::clip&&node.clipStyle.has_value();
    const bool clips=(physical&&physical->clip!=0)||(node.kind==wire::kinds::clip&&(!styledClip||node.clipStyle->behavior!=wire::clipBehaviors::none))||node.kind==wire::kinds::scrollViewport||overflowClip;
    if(clips)clip=intersect(clip,bounds);
    if(physical||node.kind==wire::kinds::clip||node.kind==wire::kinds::scrollViewport||overflowClip){
      // Canonical default rect/rrect/path clippers hit their proxy rectangle;
      // Oval clips its hit geometry even when painting uses Clip.none.
      const bool defaultShape=styledClip&&!overflowClip;
      f.clips.push_back({world,{0,0,node.properties.width,node.properties.height},overflowClip||defaultShape?0:node.radius,
        defaultShape?nullptr:node.graphics.path,head,defaultShape&&node.clipStyle->shape==wire::clipShapes::oval});
      head=uint32_t(f.clips.size());
    }
    const bool hardEdge=overflowClip||(physical&&physical->clip==1)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::hardEdge);
    const bool saveLayer=clips&&!overflowClip&&((physical&&physical->clip==3)||(styledClip&&node.clipStyle->behavior==wire::clipBehaviors::antiAliasWithSaveLayer));
    f.items.push_back({node.id,world.tx,world.ty,alpha,clip,world,bounds,head,depth,
      (clips?wire::nodeFlags::clipsChildren:0u)|(hardEdge?wire::nodeFlags::hardEdgeClip:0u)|
      (overflowClip?wire::nodeFlags::rectangularClip:0u)|(saveLayer?wire::nodeFlags::clipSaveLayer:0u)});
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
    if((it->opacity<=0&&!(node.policy&wire::eventPolicies::canonicalHitTest))||!frame->allows(node.id)||!frame->hit(*it,x,y))continue;
    for(const Node* current=&node;current;current=current->parent?&geometry.get(current->parent):nullptr)
      if(current->kind==wire::kinds::scrollViewport)return current->id;
  }return {};
}
}
