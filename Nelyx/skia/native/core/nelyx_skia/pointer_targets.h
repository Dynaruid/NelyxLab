// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <array>
#include <map>
#include <vector>
#include <span>
#include <cmath>
#include <stdexcept>
namespace nelyx::pointer_targets {
inline constexpr size_t maxNodes=128,maxTrees=16,rowWords=8;
struct Node {std::array<double,8> row{};};
struct Tree {double revision=0;std::vector<Node> nodes;};
class Session {
  using Matrix=std::array<double,6>;
  static Matrix inverseTranslation(double dx,double dy){return {1.,-0.,-0.,1.,(0.*dy-1.*dx)/1.,(0.*dx-1.*dy)/1.};}
  static Matrix concatenate(const Matrix& a,const Matrix& b){
    bool unsignedB=true;for(double n:b)if(n==0&&std::signbit(n))unsignedB=false;
    if(a[4]==0&&a[5]==0&&unsignedB)return b;
    return {a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]};
  }
  double owner_;bool closed_=false;
  std::map<size_t,Tree> trees_;
  [[noreturn]] static void fail(){throw std::invalid_argument("Invalid pointer target transaction");}
  static size_t integer(double n,size_t max){if(!std::isfinite(n)||n<0||n>double(max)||std::floor(n)!=n)fail();return size_t(n);}
public:
  explicit Session(double owner):owner_(owner){if(!integer(owner,9007199254740991ULL))fail();}
  // Header magic/version/owner/tree/revision/nodeCount/changeCount, then
  // changed rows. IDs are dense preorder indices, parent always smaller.
  void patch(std::span<const double> p){
    if(closed_||p.size()<7||p.size()>7+maxNodes*rowWords||p[0]!=0x4e4c5054||p[1]!=2||p[2]!=owner_)fail();
    auto key=integer(p[3],9007199254740991ULL),revision=integer(p[4],9007199254740991ULL),count=integer(p[5],maxNodes),changes=integer(p[6],maxNodes);
    if(!key||!revision||!count||p.size()!=7+changes*rowWords)fail();
    auto found=trees_.find(key);if(found==trees_.end()&&trees_.size()>=maxTrees)fail();
    Tree next=found==trees_.end()?Tree{}:found->second;
    if(revision<=next.revision)fail();next.nodes.resize(count);
    std::array<bool,maxNodes> changed{};
    for(size_t i=0;i<changes;++i){auto row=p.subspan(7+i*rowWords,rowWords);auto id=integer(row[0],count);if(!id||changed[id-1])fail();changed[id-1]=true;
      for(double value:row)if(!std::isfinite(value))fail();
      if(integer(row[1],id-1)==0&&id!=1)fail();if(id==1&&row[1]!=0)fail();
      if(row[2]<0||row[3]<0)fail();integer(row[6],4);integer(row[7],1);
      std::copy(row.begin(),row.end(),next.nodes[id-1].row.begin());}
    for(size_t i=0;i<count;++i)if(next.nodes[i].row[0]!=double(i+1))fail();
    // Limit nesting before recursive query, including a malicious reparent.
    for(size_t i=0;i<count;++i){size_t depth=0,current=i;while(next.nodes[current].row[1]){if(++depth>32)fail();current=size_t(next.nodes[current].row[1])-1;}}
    next.revision=double(revision);trees_[key]=std::move(next);
  }
  std::vector<double> query(std::span<const double> p){
    if(closed_||p.size()!=12||p[0]!=owner_)fail();auto key=integer(p[1],9007199254740991ULL);auto found=trees_.find(key);
    if(found==trees_.end()||found->second.revision!=p[2])fail();for(double n:p)if(!std::isfinite(n))fail();
    const auto& nodes=found->second.nodes;size_t visits=0;std::vector<double> path;
    if(p[5]==1){
      // No JS callback runs here. The last numeric row is an opaque TS
      // boundary; only pure single-child ancestors can precede it.
      if(nodes.size()<3||nodes.size()>33)fail();
      for(size_t i=0;i<nodes.size();++i)if(nodes[i].row[1]!=double(i)||
        (i+1==nodes.size()?nodes[i].row[6]!=4:nodes[i].row[6]>3))fail();
      Matrix matrix{};std::copy(p.begin()+6,p.end(),matrix.begin());double x=p[3],y=p[4],terminal=0,edgeX=0,edgeY=0;
      for(size_t i=0;i<nodes.size();++i){
        ++visits;const auto& row=nodes[i].row;
        if(row[6]!=4&&!(x>=0&&y>=0&&x<row[2]&&y<row[3]))break;
        path.insert(path.end(),{double(i+1),x,y});path.insert(path.end(),matrix.begin(),matrix.end());path.insert(path.end(),{edgeX,edgeY});
        if(row[6]==4){terminal=double(i+1);break;}
        const auto& child=nodes[i+1].row;const double dx=0.+child[4],dy=0.+child[5];
        const auto inverse=inverseTranslation(dx,dy);
        const double nextX=inverse[0]*x+inverse[2]*y+inverse[4],nextY=inverse[1]*x+inverse[3]*y+inverse[5];
        matrix=concatenate(inverse,matrix);
        if(!std::isfinite(nextX)||!std::isfinite(nextY))return {p[2],-1.,double(visits),0.};
        for(double n:matrix)if(!std::isfinite(n))return {p[2],-1.,double(visits),0.};
        x=nextX;y=nextY;edgeX=inverse[4];edgeY=inverse[5];
      }
      std::vector<double> result{p[2],terminal,double(visits),double(path.size()/11)};result.insert(result.end(),path.begin(),path.end());return result;
    }
    if(p[5]!=0)fail();for(const auto& node:nodes)if(node.row[6]==4)fail();
    auto walk=[&](auto&& walk,size_t id,double x,double y,Matrix matrix)->bool {
      ++visits;const auto& row=nodes[id-1].row;
      if(!(x>=0&&y>=0&&x<row[2]&&y<row[3]))return false;
      bool hit=false;
      for(size_t i=nodes.size();i>id;--i)if(nodes[i-1].row[1]==double(id)){
        const auto& child=nodes[i-1].row;const double dx=0.+child[4],dy=0.+child[5];
        const auto inverse=inverseTranslation(dx,dy),local=concatenate(inverse,matrix);
        if(walk(walk,i,inverse[0]*x+inverse[2]*y+inverse[4],inverse[1]*x+inverse[3]*y+inverse[5],local)){hit=true;break;}}
      const auto behavior=size_t(row[6]);bool self=behavior==0?row[7]!=0:behavior==1;
      bool returns=hit||self;
      if((behavior==0&&self)||(behavior!=0&&(returns||behavior==2))){path.push_back(double(id));path.insert(path.end(),matrix.begin(),matrix.end());}
      return returns;
    };
    Matrix matrix{};std::copy(p.begin()+6,p.end(),matrix.begin());const auto hit=walk(walk,1,p[3],p[4],matrix);
    std::vector<double> result{p[2],hit?1.:0.,double(visits),double(path.size()/7)};result.insert(result.end(),path.begin(),path.end());return result;
  }
  void drop(double id){if(closed_)fail();trees_.erase(integer(id,9007199254740991ULL));}
  void close(){trees_.clear();closed_=true;}
  size_t trees()const{return trees_.size();}
};
}
