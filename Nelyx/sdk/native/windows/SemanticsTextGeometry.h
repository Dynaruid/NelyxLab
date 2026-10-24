// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SemanticsTextDocument.h"
#include "TextInputDocument.h"
#include "nelyx_skia/paragraph_queries.h"
#include <array>

namespace Nelyx::WindowsSemantics {
using LogicalBox=Nelyx::WindowsInput::Rect;
struct LogicalPoint {double x=0,y=0;};
struct ParagraphScreenMapping {
  std::weak_ptr<void> context;
  std::function<bool()> active;
  std::function<std::optional<uint64_t>()> revision;
  std::function<std::optional<ScreenBox>(LogicalBox const&)> screenBox;
  std::function<std::optional<LogicalPoint>(double,double)> viewPoint;
};
struct CoreParagraphFrame {
  Nelyx::WindowsInput::CoreGeometry geometry;
  std::array<double,16> transform{};
  double paintX=0,paintY=0;uint64_t ticket=0;
  nelyx::skia_core::ParagraphQueryIdentity identity;
};
/** Same double-precision inversion and homogeneous screen ray as Core matrix4.ts.
 * A singular painted plane is unavailable, including a singular full 4x4 matrix. */
class ParagraphTransform final {
public:
  explicit ParagraphTransform(std::array<double,16> value):value_(value){
    for(const auto number:value)require(std::isfinite(number));std::array<std::array<double,8>,4> rows{};
    for(size_t row=0;row<4;++row)for(size_t column=0;column<8;++column)rows[row][column]=column<4?value[column*4+row]:double(column-4==row);
    for(size_t column=0;column<4;++column){
      size_t pivot=column;for(size_t row=column+1;row<4;++row)if(std::abs(rows[row][column])>std::abs(rows[pivot][column]))pivot=row;
      const auto divisor=rows[pivot][column];if(divisor==0||!std::isfinite(divisor))return;std::swap(rows[column],rows[pivot]);for(auto& number:rows[column])number/=divisor;
      for(size_t row=0;row<4;++row)if(row!=column){const auto factor=rows[row][column];for(size_t n=0;n<8;++n)rows[row][n]-=factor*rows[column][n];}
    }
    std::array<double,16> inverse{};for(size_t n=0;n<16;++n){inverse[n]=rows[n%4][4+n/4];if(!std::isfinite(inverse[n]))return;}inverse_=inverse;
  }
  std::optional<LogicalPoint> point(double x,double y)const{
    const auto w=value_[3]*x+value_[7]*y+value_[15];if(w==0)return std::nullopt;LogicalPoint result{(value_[0]*x+value_[4]*y+value_[12])/w,(value_[1]*x+value_[5]*y+value_[13])/w};return finite(result)?std::optional<LogicalPoint>(result):std::nullopt;
  }
  std::optional<LogicalPoint> unproject(double px,double py)const{
    if(!inverse_||!std::isfinite(px)||!std::isfinite(py))return std::nullopt;const auto& m=*inverse_;
    const auto x=m[0]*px+m[4]*py+m[12],y=m[1]*px+m[5]*py+m[13],z=m[2]*px+m[6]*py+m[14],w=m[3]*px+m[7]*py+m[15],weight=w*m[10]-m[11]*z;
    if(weight==0||!std::isfinite(weight))return std::nullopt;LogicalPoint result{(x*m[10]-m[8]*z)/weight,(y*m[10]-m[9]*z)/weight};return finite(result)?std::optional<LogicalPoint>(result):std::nullopt;
  }
  std::optional<LogicalBox> box(LogicalBox const& value)const{
    const std::array<std::pair<double,double>,4> corners{{{value.x,value.y},{value.x+value.width,value.y},{value.x,value.y+value.height},{value.x+value.width,value.y+value.height}}};
    std::optional<LogicalBox> result;for(const auto& corner:corners){const auto projected=point(corner.first,corner.second);if(!projected)return std::nullopt;if(!result)result=LogicalBox{projected->x,projected->y,0,0};else{const auto right=std::max(result->x+result->width,projected->x),bottom=std::max(result->y+result->height,projected->y);result->x=std::min(result->x,projected->x);result->y=std::min(result->y,projected->y);result->width=right-result->x;result->height=bottom-result->y;}}return result;
  }
private:
  static bool finite(LogicalPoint point){return std::isfinite(point.x)&&std::isfinite(point.y);}
  std::array<double,16> value_;std::optional<std::array<double,16>> inverse_;
};

/** Immutable Core frame plus a live native surface mapper. Engine reads finish
 * before screen conversion; a reentrant native move/resize/retirement rejects
 * the entire reply. Caller owns the COM/UI apartment and peer lifetime. */
class TextParagraphGeometry final {
public:
  TextParagraphGeometry(CoreParagraphFrame frame,ParagraphScreenMapping mapping,TextSnapshot const& text):frame_(std::move(frame)),mapping_(std::move(mapping)),transform_(frame_.transform){
    Nelyx::WindowsInput::TextInputDocument::validateGeometry(frame_.geometry);TextDocument::validateText(text.text);
    require(!text.obscured&&frame_.identity.owner==frame_.geometry.owner.id&&frame_.identity.ownerGeneration==frame_.geometry.owner.generation&&frame_.identity.units==text.text.size()&&frame_.ticket>0&&frame_.ticket<=9007199254740991ULL&&std::isfinite(frame_.paintX)&&std::isfinite(frame_.paintY));
    const auto bytes=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text.text.data(),static_cast<int>(text.text.size()),nullptr,0,nullptr,nullptr);require(bytes>0||text.text.empty());std::string body(static_cast<size_t>(bytes),0);if(bytes)require(WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text.text.data(),static_cast<int>(text.text.size()),body.data(),bytes,nullptr,nullptr)==bytes);require(body==frame_.identity.text);
    require(!text.characters.empty()&&text.characters.size()<=4097);characters_=text.characters;require(characters_.front()==0&&characters_.back()==static_cast<int>(text.text.size()));int previous=-1;for(const auto at:characters_){require(at>previous&&TextDocument::scalarBoundary(text.text,at));previous=at;}
    require(mapping_.active&&mapping_.revision&&mapping_.screenBox&&mapping_.viewPoint);
  }
  std::optional<std::vector<ScreenBox>> rectangles(int start,int end)const{
    if(start<0||start>end||static_cast<uint32_t>(end)>frame_.identity.units)return std::nullopt;const auto revision=begin();if(!revision)return std::nullopt;
    auto context=mapping_.context.lock();if(!context)return std::nullopt;const auto ranges=nelyx::skia_core::ParagraphQuerySource::ranges(frame_.ticket,context.get(),frame_.identity,{{static_cast<uint32_t>(start),static_cast<uint32_t>(end)}});context.reset();if(!ranges)return std::nullopt;
    std::vector<ScreenBox> result;for(const auto& box:ranges->front()){const auto mapped=screen(box);if(!mapped)return std::nullopt;if(mapped->height>0)result.push_back(*mapped);}return current(*revision)?std::optional<std::vector<ScreenBox>>(std::move(result)):std::nullopt;
  }
  std::optional<std::vector<TextSpan>> visibleRanges()const{
    const auto revision=begin();if(!revision)return std::nullopt;
    if(frame_.identity.units==0){if(!sourceCurrent())return std::nullopt;const auto caret=mapping_.screenBox(frame_.geometry.caret);if(!caret||!current(*revision))return std::nullopt;return caret->height>0?std::vector<TextSpan>{{0,0}}:std::vector<TextSpan>{};}
    std::vector<std::pair<uint32_t,uint32_t>> spans;for(size_t i=1;i<characters_.size();++i)spans.emplace_back(static_cast<uint32_t>(characters_[i-1]),static_cast<uint32_t>(characters_[i]));
    auto context=mapping_.context.lock();if(!context)return std::nullopt;const auto ranges=nelyx::skia_core::ParagraphQuerySource::ranges(frame_.ticket,context.get(),frame_.identity,spans);context.reset();if(!ranges)return std::nullopt;
    std::vector<TextSpan> result;for(size_t i=0;i<ranges->size();++i){bool visible=false;for(const auto& box:(*ranges)[i]){const auto mapped=screen(box);if(!mapped)return std::nullopt;visible=visible||mapped->height>0;}if(visible){const auto start=static_cast<int>(spans[i].first),end=static_cast<int>(spans[i].second);if(!result.empty()&&result.back().end==start)result.back().end=end;else result.push_back({start,end});}}
    return current(*revision)?std::optional<std::vector<TextSpan>>(std::move(result)):std::nullopt;
  }
  std::optional<int> hit(double screenX,double screenY)const{
    if(!std::isfinite(screenX)||!std::isfinite(screenY))return std::nullopt;
    const auto revision=begin();if(!revision)return std::nullopt;const auto view=mapping_.viewPoint(screenX,screenY);if(!view||!current(*revision))return std::nullopt;
    const auto local=transform_.unproject(view->x,view->y);if(!local)return std::nullopt;const double x=local->x-frame_.paintX,y=local->y-frame_.paintY;
    auto context=mapping_.context.lock();if(!context)return std::nullopt;const auto hit=nelyx::skia_core::ParagraphQuerySource::hit(frame_.ticket,context.get(),frame_.identity,static_cast<float>(x),static_cast<float>(y));context.reset();if(!hit||!current(*revision))return std::nullopt;
    int position=static_cast<int>(hit->position);
    // This is Core TextPainter's observed-cluster correction, followed by
    // RenderEditable's original grapheme stops; no native segmentation occurs.
    if(hit->hasGlyph&&position>static_cast<int>(hit->start)&&position<static_cast<int>(hit->end)){const bool left=x<(double(hit->glyph.left)+hit->glyph.right)/2;position=static_cast<int>(left!=hit->glyph.rtl?hit->start:hit->end);}
    const auto after=std::lower_bound(characters_.begin(),characters_.end(),position);if(after!=characters_.end()&&*after==position)return position;
    const auto before=after==characters_.begin()?0:*(after-1),following=after==characters_.end()?static_cast<int>(frame_.identity.units):*after;return position-before<following-position?before:following;
  }
private:
  std::optional<uint64_t> begin()const{if(!mapping_.active())return std::nullopt;return mapping_.revision();}
  bool sourceCurrent()const{const auto context=mapping_.context.lock();return context&&nelyx::skia_core::ParagraphQuerySource::ranges(frame_.ticket,context.get(),frame_.identity,{}).has_value();}
  bool current(uint64_t revision)const{const auto now=begin();return now&&*now==revision&&sourceCurrent();}
  std::optional<ScreenBox> screen(nelyx::skia_core::ParagraphQueryBox const& box)const{
    if(box.right<box.left||box.bottom<box.top)return std::nullopt;const auto projected=transform_.box({double(box.left)+frame_.paintX,double(box.top)+frame_.paintY,double(box.right)-box.left,double(box.bottom)-box.top});if(!projected)return std::nullopt;
    const auto& clip=frame_.geometry.clip;const auto left=std::max(projected->x,clip.x),top=std::max(projected->y,clip.y),right=std::min(projected->x+projected->width,clip.x+clip.width),bottom=std::min(projected->y+projected->height,clip.y+clip.height);
    const bool caret=projected->width==0&&projected->x>=clip.x&&projected->x<clip.x+clip.width;if(bottom<=top||(right<=left&&!caret))return ScreenBox{};return mapping_.screenBox({left,top,std::max(0.,right-left),bottom-top});
  }
  CoreParagraphFrame frame_;ParagraphScreenMapping mapping_;ParagraphTransform transform_;std::vector<int> characters_;
};
}
