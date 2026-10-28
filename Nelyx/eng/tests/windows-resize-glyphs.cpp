// SPDX-License-Identifier: BSD-3-Clause
#include "windows-resize-glyphs.h"
#include <cassert>
#include <iostream>
int main(){
 assert(resizeMaterialShortOrigin(35,1174,1199,2)==35);
 assert(resizeMaterialShortOrigin(35,1174,1200,2)==59);
 assert(resizeMaterialShortOrigin(35,1174,1300,2)==59);
 assert(resizeMaterialShortOrigin(59,1300,1174,2)==35);
 assert(resizeMaterialShortOrigin(22,700,750,1.25)==37);
 assert(resizeMaterialShortOrigin(37,750,700,1.25)==22);
 try{resizeMaterialShortOrigin(0,0,100,2);assert(false);}catch(const std::invalid_argument&){}
 const auto text=[](int x,int y){return y>=10&&y<=20&&((x>=5&&x<=9)||(x>=15&&x<=19));};
 const auto reference=resizeGlyphBounds(0,0,40,48,text);assert(reference.width==15&&reference.height==11);
 const auto overlay=resizeGlyphBounds(0,0,40,48,[&](int x,int y){return text(x,y)||(x>=8&&x<=12&&y>=2&&y<=6);},reference.anchor);
 assert(overlay.width==reference.width&&overlay.height==reference.height&&overlay.y==reference.y);
 const auto icon=resizeGlyphBounds(0,0,80,48,[&](int x,int y){return text(x,y)||(x>=50&&x<=54&&y>=8&&y<=24);},reference.anchor);assert(icon.width==reference.width&&icon.height==reference.height);
 const auto antialiased=resizeGlyphBounds(0,0,40,48,[](int x,int y){return (x>=5&&x<=9&&y>=12&&y<=20)||(x==7&&y==10)||(x>=15&&x<=19&&y>=10&&y<=20);},reference.anchor);assert(antialiased.height==reference.height);
 const auto stretched=resizeGlyphBounds(0,0,40,48,[](int x,int y){return y>=2&&y<=20&&((x>=5&&x<=9)||(x>=15&&x<=19));},reference.anchor);assert(stretched.height>reference.height);
 const auto wide=resizeGlyphBounds(0,0,40,48,[](int x,int y){return y>=10&&y<=20&&((x>=5&&x<=9)||(x>=25&&x<=29));},reference.anchor);assert(wide.width!=reference.width);
 const auto translated=resizeGlyphBounds(0,0,40,48,[&](int x,int y){return text(x,y-25);},reference.anchor);assert(!translated.pixels);
 const auto background=resizeGlyphBounds(0,0,40,48,[](int,int){return true;},reference.anchor);assert(background.width>reference.width&&background.height>reference.height);
 std::cout<<"PASS text=1 separate-overlay=1 vertical-stretch=1 horizontal-stretch=1 translation=1 exposed-background=1 responsive-origin=1\n";
}
