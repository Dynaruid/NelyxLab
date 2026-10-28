// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>
struct ResizeGlyphBounds{int x=0,y=0,width=0,height=0,pixels=0,anchor=-1;};
// Material's short header keeps its 18px title. At 600 logical pixels only
// horizontal Padding changes from 16 to 28; use the displayed client width.
inline int resizeMaterialShortOrigin(int referenceX,int referenceWidth,int width,double scale){
 if(referenceWidth<=0||width<=0||!std::isfinite(scale)||scale<=0)throw std::invalid_argument("Invalid responsive header extent");
 const auto padding=[&](int extent){return extent/scale<600?16:28;};
 return referenceX+static_cast<int>(std::lround((padding(width)-padding(referenceWidth))*scale));
}
// Track components crossing a calibrated text row. A separate pointer overlay
// above the letters is not text. Scaling extends the same components; a text
// translation that misses the row is an explicit missing-glyph observation.
template<class Dark> ResizeGlyphBounds resizeGlyphBounds(int left,int top,int right,int bottom,Dark dark,int anchor=-1){
 const int width=right-left,height=bottom-top;if(width<=0||height<=0)return {};
 std::vector<unsigned char> mask(width*height);int maximum=0;
 for(int y=0;y<height;y++){int count=0;for(int x=0;x<width;x++){const bool ink=dark(left+x,top+y);mask[y*width+x]=ink;count+=ink;}
   if(anchor<0&&count>maximum){maximum=count;}}
 if(anchor<0){for(int y=0;y<height;y++){int count=0;for(int x=0;x<width;x++)count+=mask[y*width+x];if(count==maximum&&count){anchor=top+y;break;}}}
 ResizeGlyphBounds result;result.anchor=anchor;std::vector<ResizeGlyphBounds> components;std::vector<int> queue;queue.reserve(mask.size());
 for(int index=0;index<int(mask.size());index++)if(mask[index]==1){
   queue.clear();queue.push_back(index);mask[index]=2;int a=right,b=bottom,c=-1,d=-1;bool crosses=false;
   for(size_t cursor=0;cursor<queue.size();cursor++){
     const auto current=queue[cursor];const int x=current%width,y=current/width,px=left+x,py=top+y;
     a=std::min(a,px);b=std::min(b,py);c=std::max(c,px);d=std::max(d,py);crosses|=py==anchor;
     // One transparent pixel can separate diagonally antialiased strokes.
     for(int dy=-2;dy<=2;dy++)for(int dx=-2;dx<=2;dx++){const int nx=x+dx,ny=y+dy;if(nx>=0&&nx<width&&ny>=0&&ny<height){const auto next=ny*width+nx;if(mask[next]==1){mask[next]=2;queue.push_back(next);}}}
   }
   if(crosses)components.push_back({a,b,c-a+1,d-b+1,int(queue.size()),anchor});
 }
 // A separate back icon can change its hover contrast. Track the widest text
 // group, joining normal letter/word gaps but not a distant navigation icon.
 std::sort(components.begin(),components.end(),[](auto const& a,auto const& b){return a.x<b.x;});
 int letterHeight=0;for(const auto& part:components)letterHeight=std::max(letterHeight,part.height);const int gap=(letterHeight+1)/2;
 ResizeGlyphBounds group;group.anchor=anchor;
 const auto finish=[&]{if(group.width>result.width)result=group;};
 for(const auto& part:components){
   if(!group.pixels){group=part;continue;}
   if(part.x>group.x+group.width+gap){finish();group=part;continue;}
   const auto end=std::max(group.x+group.width,part.x+part.width),bottom=std::max(group.y+group.height,part.y+part.height);
   group.y=std::min(group.y,part.y);group.width=end-group.x;group.height=bottom-group.y;group.pixels+=part.pixels;
 }
 finish();return result;
}
