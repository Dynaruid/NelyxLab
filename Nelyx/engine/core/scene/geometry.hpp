// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "../memory.hpp"
#include <algorithm>
#include <array>
#include <functional>
#include <optional>

namespace nelyx::v2 {
struct Point { double x=0,y=0; };
struct Rect { double x=0,y=0,width=0,height=0; };
inline Rect intersect(Rect a,Rect b) {
  const auto x=std::max(a.x,b.x),y=std::max(a.y,b.y);
  return {x,y,std::max(0.0,std::min(a.x+a.width,b.x+b.width)-x),
    std::max(0.0,std::min(a.y+a.height,b.y+b.height)-y)};
}
struct Affine {
  double a=1,b=0,c=0,d=1,tx=0,ty=0;
  Point map(Point p)const{return {a*p.x+c*p.y+tx,b*p.x+d*p.y+ty};}
  Affine operator*(const Affine& r)const {
    Affine value{a*r.a+c*r.b,b*r.a+d*r.b,a*r.c+c*r.d,b*r.c+d*r.d,
      a*r.tx+c*r.ty+tx,b*r.tx+d*r.ty+ty};
    for(const auto x:{value.a,value.b,value.c,value.d,value.tx,value.ty})
      require(std::isfinite(x)&&std::abs(x)<=1e12,wire::statuses::invalidValue);
    return value;
  }
  std::optional<Affine> inverse()const {
    const double determinant=a*d-b*c;
    if(!std::isfinite(determinant)||determinant==0)return {};
    const Affine value{d/determinant,-b/determinant,-c/determinant,a/determinant,
      (c*ty-d*tx)/determinant,(b*tx-a*ty)/determinant};
    for(const auto x:{value.a,value.b,value.c,value.d,value.tx,value.ty})
      if(!std::isfinite(x))return {};
    return value;
  }
  std::optional<Affine> relativeTo(const Affine& parent)const {
    const auto p=parent.inverse();if(!p)return {};
    const Affine value{p->a*a+p->c*b,p->b*a+p->d*b,p->a*c+p->c*d,p->b*c+p->d*d,
      p->a*tx+p->c*ty+p->tx,p->b*tx+p->d*ty+p->ty};
    for(const auto x:{value.a,value.b,value.c,value.d,value.tx,value.ty})if(!std::isfinite(x))return {};
    return value;
  }
  Rect bounds(Rect r)const {
    const std::array<Point,4> points{map({r.x,r.y}),map({r.x+r.width,r.y}),
      map({r.x,r.y+r.height}),map({r.x+r.width,r.y+r.height})};
    double x=points[0].x,y=points[0].y,right=x,bottom=y;
    for(const auto p:points){require(std::isfinite(p.x)&&std::isfinite(p.y)&&std::abs(p.x)<=1e12&&std::abs(p.y)<=1e12,wire::statuses::invalidValue);x=std::min(x,p.x);y=std::min(y,p.y);right=std::max(right,p.x);bottom=std::max(bottom,p.y);}
    return {x,y,right-x,bottom-y};
  }
};
inline bool inside(Point p,Rect r,double radius=0) {
  if(r.width<=0||r.height<=0||p.x<r.x||p.y<r.y||p.x>=r.x+r.width||p.y>=r.y+r.height)return false;
  radius=std::min({radius,r.width/2,r.height/2});if(radius<=0)return true;
  const double x=p.x-std::clamp(p.x,r.x+radius,r.x+r.width-radius);
  const double y=p.y-std::clamp(p.y,r.y+radius,r.y+r.height-radius);
  return x*x+y*y<=radius*radius;
}
struct PathCommand {uint32_t verb=0;std::array<double,6> values{};};
struct GraphicsPath {
  using Contour=std::vector<Point,LedgerAllocator<Point>>;
  Lease lease;
  uint32_t fillRule;
  std::vector<PathCommand> commands;
  std::vector<Contour,LedgerAllocator<Contour>> contours;
  GraphicsPath(const std::shared_ptr<Ledger>& ledger,std::vector<PathCommand> data,uint32_t rule)
    :lease(ledger,sizeof(GraphicsPath)+data.capacity()*sizeof(PathCommand)),
      fillRule(rule),commands(std::move(data)),contours(LedgerAllocator<Contour>{ledger}) {
    Point current;bool active=false;size_t points=0;
    const auto add=[&](Point p){require(++points<=8192,wire::statuses::budgetExceeded);contours.back().push_back(p);};
    const auto middle=[](Point a,Point b){return Point{(a.x+b.x)/2,(a.y+b.y)/2};};
    const auto distance=[](Point p,Point a,Point b){const double dx=b.x-a.x,dy=b.y-a.y;
      const double length=std::hypot(dx,dy);return length?std::abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/length:std::hypot(p.x-a.x,p.y-a.y);};
    std::function<void(Point,Point,Point,uint32_t)> quad;
    quad=[&](Point a,Point b,Point c,uint32_t depth){if(depth>=16||distance(b,a,c)<=0.25){add(c);return;}
      const auto ab=middle(a,b),bc=middle(b,c),center=middle(ab,bc);quad(a,ab,center,depth+1);quad(center,bc,c,depth+1);};
    std::function<void(Point,Point,Point,Point,uint32_t)> cubic;
    cubic=[&](Point a,Point b,Point c,Point d,uint32_t depth){if(depth>=16||std::max(distance(b,a,d),distance(c,a,d))<=0.25){add(d);return;}
      const auto ab=middle(a,b),bc=middle(b,c),cd=middle(c,d),abc=middle(ab,bc),bcd=middle(bc,cd),center=middle(abc,bcd);
      cubic(a,ab,abc,center,depth+1);cubic(center,bcd,cd,d,depth+1);};
    for(const auto& command:commands){const auto& v=command.values;
      if(command.verb==1){contours.emplace_back(LedgerAllocator<Point>{ledger});current={v[0],v[1]};add(current);active=true;continue;}
      require(active,wire::statuses::invalidValue);
      if(command.verb==2){current={v[0],v[1]};add(current);}
      else if(command.verb==3){const Point end{v[2],v[3]};quad(current,{v[0],v[1]},end,0);current=end;}
      else if(command.verb==4){const Point end{v[4],v[5]};cubic(current,{v[0],v[1]},{v[2],v[3]},end,0);current=end;}
      else {require(command.verb==5,wire::statuses::invalidValue);active=false;}
    }
  }
  bool contains(Point p)const {
    int winding=0;
    for(const auto& contour:contours)if(contour.size()>2){
      auto previous=contour.back();for(const auto current:contour){
        if((previous.y<=p.y&&current.y>p.y)||(previous.y>p.y&&current.y<=p.y)){
          const double x=previous.x+(p.y-previous.y)*(current.x-previous.x)/(current.y-previous.y);
          if(x>p.x)winding+=current.y>previous.y?1:-1;
        }previous=current;
      }
    }
    return fillRule?std::abs(winding)%2!=0:winding!=0;
  }
};
struct GraphicsStyle {
  Affine transform;
  std::optional<Point> origin,alignment;
  double shadowX=0,shadowY=0,shadowSigma=0,strokeWidth=0,blur=0;
  uint32_t shadowColor=0,strokeColor=0;
  std::shared_ptr<const GraphicsPath> path;
  Affine effective(double width,double height)const {
    if(!origin&&!alignment)return transform;
    const double x=(origin?origin->x:0)+(alignment?(alignment->x+1)*width/2:0);
    const double y=(origin?origin->y:0)+(alignment?(alignment->y+1)*height/2:0);
    return Affine{1,0,0,1,x,y}*transform*Affine{1,0,0,1,-x,-y};
  }
};
}
