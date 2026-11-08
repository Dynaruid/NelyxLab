// SPDX-License-Identifier: BSD-3-Clause
#pragma once
#include "SemanticsTextGeometry.h"
namespace Nelyx::WindowsSemantics {
struct CoreSemanticsSnapshot {
  uint64_t commit=0,source=0,surface=0;std::string id,role;
  Nelyx::WindowsInput::Owner owner;Nelyx::WindowsInput::CoreGeometry frame;
  LogicalBox bounds;bool enabled=false,focusable=false,focused=false,canActivate=false,hasGeometry=false;
  std::optional<TextSnapshot> text;std::optional<CoreParagraphFrame> paragraph;
};
inline void attachParagraphQueries(CoreSemanticsSnapshot& snapshot,ParagraphScreenMapping mapping){
  if(!snapshot.paragraph||!snapshot.text)return;
  auto source=std::make_shared<TextParagraphGeometry>(*snapshot.paragraph,std::move(mapping),*snapshot.text);
  snapshot.text->rectangles=[source](int start,int end){return source->rectangles(start,end);};
  snapshot.text->visibleRanges=[source]{return source->visibleRanges();};snapshot.text->hit=[source](double x,double y){return source->hit(x,y);};
}
}
