// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <numbers>

namespace nelyx::v2 {
namespace {
// Source's stable overlap sweep and knot walk, evaluated from published Core
// geometry. Paint order and physical hit testing retain their own order.
inline int semanticNumberCompare(double a,double b){
  if(a==b)return a==0&&std::signbit(a)!=std::signbit(b)?(std::signbit(a)?-1:1):0;
  return a<b?-1:1;
}
using SemanticHandles=std::vector<Handle,LedgerAllocator<Handle>>;
struct SemanticOrderBox {Affine matrix;Rect rect;};
inline void orderSemantics(Frame& frame,const std::shared_ptr<Ledger>& ledger){
  const auto& document=*frame.scene->document;
  using Children=std::vector<SemanticHandles,LedgerAllocator<SemanticHandles>>;
  Children children{LedgerAllocator<SemanticHandles>{ledger}};
  children.reserve(document.highWater+1);
  for(uint32_t i=0;i<=document.highWater;++i)children.emplace_back(LedgerAllocator<Handle>{ledger});
  std::vector<const DrawItem*,LedgerAllocator<const DrawItem*>> items(document.highWater+1,nullptr,LedgerAllocator<const DrawItem*>{ledger});
  std::vector<SemanticOrderBox,LedgerAllocator<SemanticOrderBox>> boxes(document.highWater+1,{},LedgerAllocator<SemanticOrderBox>{ledger});
  const auto exposed=[&](Handle node){const auto* value=frame.semantic(node);return value&&frame.allowsSemantics(node)&&
    !(value->flags&wire::semanticsFlags::hidden)&&items[node.slot]&&items[node.slot]->opacity>0;};
  for(const auto& item:frame.items)items[item.node.slot]=&item;
  for(const auto& item:frame.items){const auto node=item.node;if(!exposed(node))continue;
    auto parent=document.get(node).parent;
    while(parent&&!exposed(parent))parent=document.get(parent).parent;
    auto& semantic=frame.semantics[node.slot];semantic.parent=parent;
    children[parent.slot].push_back(node);
    const auto& source=document.get(node);
    auto& box=boxes[node.slot];box.rect=source.layoutPaintValues&&source.layoutPaintValues->semanticsRect?
      *source.layoutPaintValues->semanticsRect:Rect{0,0,source.properties.width,source.properties.height};
    if(parent){const auto relative=item.world.relativeTo(items[parent.slot]->world);require(relative.has_value());box.matrix=*relative;}
    else box.matrix=item.world;
  }
  const auto point=[&](Handle node,bool end,bool center=false,double inset=0){const auto& b=boxes[node.slot];const auto& r=b.rect;
    return b.matrix.map({r.x+(center?r.width/2:end?r.width-inset:inset),r.y+(center?r.height/2:end?r.height-inset:inset)});};
  struct Edge{Handle node;double offset;bool leading;};
  struct Group{double offset;SemanticHandles nodes;Group(double value,const std::shared_ptr<Ledger>& book):offset(value),nodes(LedgerAllocator<Handle>{book}){}};
  const auto sweep=[&](const SemanticHandles& nodes,bool horizontal){
    std::vector<Edge,LedgerAllocator<Edge>> edges{LedgerAllocator<Edge>{ledger}};edges.reserve(nodes.size()*2);
    for(const auto node:nodes){const auto a=point(node,false,false,.1),b=point(node,true,false,.1);
      edges.push_back({node,horizontal?a.x:a.y,true});edges.push_back({node,horizontal?b.x:b.y,false});}
    std::stable_sort(edges.begin(),edges.end(),[](const auto& a,const auto& b){return semanticNumberCompare(a.offset,b.offset)<0;});
    std::vector<Group,LedgerAllocator<Group>> groups{LedgerAllocator<Group>{ledger}};
    std::optional<Group> group;int depth=0;
    for(const auto& edge:edges){if(edge.leading){++depth;if(!group)group.emplace(edge.offset,ledger);group->nodes.push_back(edge.node);}else --depth;
      if(!depth){require(group.has_value(),wire::statuses::invalidValue);groups.push_back(std::move(*group));group.reset();}}
    std::stable_sort(groups.begin(),groups.end(),[](const auto& a,const auto& b){return semanticNumberCompare(a.offset,b.offset)<0;});
    return groups;
  };
  const auto knot=[&](const SemanticHandles& nodes,uint32_t direction){
    SemanticHandles result{LedgerAllocator<Handle>{ledger}};if(nodes.size()<=1){result=nodes;return result;}
    std::vector<int32_t,LedgerAllocator<int32_t>> edges(nodes.size(),-1,LedgerAllocator<int32_t>{ledger});
    for(size_t i=0;i<nodes.size();++i){const auto a=point(nodes[i],false,true);
      for(size_t j=0;j<nodes.size();++j){if(i==j||edges[j]==int32_t(i))continue;const auto b=point(nodes[j],false,true);
        const auto theta=std::atan2(b.y-a.y,b.x-a.x),pi=std::numbers::pi;
        if(direction==1?(-pi/4<theta&&theta<3*pi/4):(theta< -3*pi/4||theta>3*pi/4))edges[i]=int32_t(j);}}
    std::vector<size_t,LedgerAllocator<size_t>> start{LedgerAllocator<size_t>{ledger}};start.reserve(nodes.size());
    for(size_t i=0;i<nodes.size();++i)start.push_back(i);
    std::stable_sort(start.begin(),start.end(),[&](size_t i,size_t j){const auto a=point(nodes[i],false),b=point(nodes[j],false);
      const auto vertical=semanticNumberCompare(a.y,b.y);return vertical?vertical>0:semanticNumberCompare(a.x,b.x)>0;});
    std::vector<uint8_t,LedgerAllocator<uint8_t>> visited(nodes.size(),0,LedgerAllocator<uint8_t>{ledger});
    // A one-edge graph needs no recursive stack proportional to sibling count.
    std::vector<size_t,LedgerAllocator<size_t>> path{LedgerAllocator<size_t>{ledger}};
    for(auto i:start){path.clear();while(!visited[i]){visited[i]=1;path.push_back(i);if(edges[i]<0)break;i=size_t(edges[i]);}
      for(auto at=path.rbegin();at!=path.rend();++at)result.push_back(nodes[*at]);}
    std::reverse(result.begin(),result.end());return result;
  };
  uint32_t index=0;
  std::function<void(Handle,uint32_t)> visit=[&](Handle parent,uint32_t inherited){
    const auto* semantic=parent?frame.semantic(parent):nullptr;
    const auto direction=semantic&&semantic->metadata.direction?semantic->metadata.direction:inherited;
    // The canonical render pipeline passes its semantic children in this same
    // order to SemanticsNode.updateWith; preserve it before geometric sorting.
    auto& nodes=children[parent.slot];
    if(direction){SemanticHandles ordered{LedgerAllocator<Handle>{ledger}};
      for(const auto& vertical:sweep(nodes,false)){auto groups=sweep(vertical.nodes,true);if(direction==2)std::reverse(groups.begin(),groups.end());
        for(const auto& group:groups){const auto values=knot(group.nodes,direction);ordered.insert(ordered.end(),values.begin(),values.end());}}
      nodes=std::move(ordered);
    }
    size_t begin=0;
    while(begin<nodes.size()){const auto& key=frame.semantic(nodes[begin])->metadata.sort;size_t end=begin+1;
      while(end<nodes.size()){const auto& next=frame.semantic(nodes[end])->metadata.sort;
        if(bool(key)!=bool(next)||(key&&key->name!=next->name))break;++end;}
      if(key)std::stable_sort(nodes.begin()+begin,nodes.begin()+end,[&](Handle a,Handle b){return
        frame.semantic(a)->metadata.sort->order<frame.semantic(b)->metadata.sort->order;});
      begin=end;
    }
    for(const auto node:nodes){frame.semantics[node.slot].traversal=index++;visit(node,direction);}
  };
  visit({},0);
}
}
}
