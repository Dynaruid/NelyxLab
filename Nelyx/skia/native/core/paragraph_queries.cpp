// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/paragraph_queries.h"
#include "modules/skunicode/include/SkUnicode.h"
#include <cmath>
#include <stdexcept>
#include <unordered_map>

namespace nelyx::skia_core {
namespace {
struct Registry {
  std::mutex mutex;uint64_t next=0;
  std::unordered_map<skia::textlayout::Paragraph*,std::weak_ptr<ParagraphQuerySource>> sources;
  std::unordered_map<uint64_t,std::weak_ptr<ParagraphQuerySource>> tickets;
};
Registry& registry(){static Registry value;return value;}
std::shared_ptr<ParagraphQuerySource> sourceFor(skia::textlayout::Paragraph* paragraph){
  auto& values=registry();std::shared_ptr<ParagraphQuerySource> result;
  {std::lock_guard lock(values.mutex);const auto found=values.sources.find(paragraph);if(found!=values.sources.end())result=found->second.lock();}return result;
}
std::shared_ptr<ParagraphQuerySource> sourceFor(uint64_t ticket){
  auto& values=registry();std::shared_ptr<ParagraphQuerySource> result;
  {std::lock_guard lock(values.mutex);const auto found=values.tickets.find(ticket);if(found!=values.tickets.end())result=found->second.lock();}return result;
}
ParagraphQueryBox box(skia::textlayout::TextBox const& value){return {value.rect.left(),value.rect.top(),value.rect.right(),value.rect.bottom(),value.direction==skia::textlayout::TextDirection::kRtl};}
void identityValid(ParagraphQueryIdentity const& value){
  constexpr uint64_t safe=9007199254740991ULL;
  if(value.owner.empty()||value.owner.size()>512||value.resource.empty()||value.resource.size()>1024||value.ownerGeneration>safe||value.resourceGeneration>safe||value.units>4096||value.text.size()>16384||value.text.find('\0')!=std::string::npos)throw std::invalid_argument("Invalid Core paragraph query identity");
  const auto decoded=SkUnicode::convertUtf8ToUtf16(value.text.data(),static_cast<int>(value.text.size()));
  if(decoded.size()!=value.units||(!value.text.empty()&&decoded.empty()))throw std::invalid_argument("Core paragraph query text must match UTF16 units");
}
}
struct ParagraphQuerySource::Impl {
  std::recursive_mutex mutex;
  std::shared_ptr<skia::textlayout::Paragraph> paragraph;
  std::weak_ptr<void> context;
  std::optional<std::string> originalText;
  ParagraphQueryIdentity identity;
  uint64_t ticket=0;bool retired=false,mutated=false,layoutReady=false;
  bool matches(uint64_t expected,void const* owner,ParagraphQueryIdentity const& value)const{
    const auto live=context.lock();return !retired&&!mutated&&layoutReady&&ticket==expected&&paragraph&&owner&&live&&live.get()==owner&&identity==value;
  }
};
ParagraphQuerySource::ParagraphQuerySource(std::unique_ptr<Impl> impl):impl_(std::move(impl)){}
std::shared_ptr<ParagraphQuerySource> ParagraphQuerySource::create(std::shared_ptr<skia::textlayout::Paragraph> paragraph,std::shared_ptr<void> context,std::optional<std::string> originalText){
  if(!paragraph||!context)throw std::invalid_argument("A paragraph observation requires actual native owners");
  auto impl=std::make_unique<Impl>();impl->paragraph=std::move(paragraph);impl->context=context;
  // General public Skia paragraphs keep their existing larger text support.
  // Only a Core-budget body may later receive an accessibility query ticket.
  if(originalText&&originalText->size()<=16384)impl->originalText=std::move(originalText);
  auto result=std::shared_ptr<ParagraphQuerySource>(new ParagraphQuerySource(std::move(impl)));auto& values=registry();
  {std::lock_guard lock(values.mutex);const auto previous=values.sources.find(result->impl_->paragraph.get());if(previous!=values.sources.end()&&!previous->second.expired())throw std::invalid_argument("Paragraph already has a native query owner");values.sources[result->impl_->paragraph.get()]=result;}
  return result;
}
ParagraphQuerySource::~ParagraphQuerySource(){retire();}
uint64_t ParagraphQuerySource::bind(ParagraphQueryIdentity identity){
  identityValid(identity);std::lock_guard access(impl_->mutex);
  if(impl_->retired||impl_->mutated||!impl_->layoutReady||impl_->context.expired()||!impl_->originalText||*impl_->originalText!=identity.text)throw std::invalid_argument("Core paragraph source is unlaid, retired, relaid out, or has a different body");
  if(impl_->ticket){if(impl_->identity!=identity)throw std::invalid_argument("Core paragraph ticket owner cannot change");return impl_->ticket;}
  auto self=sourceFor(impl_->paragraph.get());if(self.get()!=this)throw std::runtime_error("Core paragraph query owner is missing");
  auto& values=registry();std::lock_guard lock(values.mutex);if(values.next>=9007199254740991ULL)throw std::runtime_error("Core paragraph ticket space exhausted");
  const auto next=values.next+1;values.tickets.emplace(next,self);impl_->identity=std::move(identity);impl_->ticket=next;values.next=next;return next;
}
void ParagraphQuerySource::retire(){
  if(!impl_)return;std::lock_guard access(impl_->mutex);if(impl_->retired)return;impl_->retired=true;
  auto& values=registry();std::shared_ptr<ParagraphQuerySource> previousOwner;{std::lock_guard lock(values.mutex);if(impl_->ticket)values.tickets.erase(impl_->ticket);const auto previous=values.sources.find(impl_->paragraph.get());if(previous!=values.sources.end()){previousOwner=previous->second.lock();if(!previousOwner||previousOwner.get()==this)values.sources.erase(previous);}}
  impl_->paragraph.reset();impl_->context.reset();impl_->originalText.reset();
}
void ParagraphQuerySource::willLayout(skia::textlayout::Paragraph& paragraph){
  const auto self=sourceFor(&paragraph);if(!self)return;std::lock_guard access(self->impl_->mutex);self->impl_->layoutReady=false;if(!self->impl_->ticket)return;
  self->impl_->mutated=true;auto& values=registry();std::lock_guard lock(values.mutex);values.tickets.erase(self->impl_->ticket);
}
void ParagraphQuerySource::didLayout(skia::textlayout::Paragraph& paragraph){const auto self=sourceFor(&paragraph);if(!self)return;std::lock_guard access(self->impl_->mutex);self->impl_->layoutReady=true;}
ParagraphAccess::ParagraphAccess(skia::textlayout::Paragraph& paragraph):source_(sourceFor(&paragraph)){
  if(source_)lock_=std::unique_lock<std::recursive_mutex>(source_->impl_->mutex);
}
std::optional<std::vector<std::vector<ParagraphQueryBox>>> ParagraphQuerySource::ranges(uint64_t ticket,void const* context,ParagraphQueryIdentity const& identity,std::vector<std::pair<uint32_t,uint32_t>> const& ranges){
  const auto self=sourceFor(ticket);if(!self)return std::nullopt;std::unique_lock access(self->impl_->mutex,std::try_to_lock);
  if(!access.owns_lock()||!self->impl_->matches(ticket,context,identity))return std::nullopt;
  if(ranges.size()>4097)throw std::invalid_argument("Core paragraph range query budget exceeded");
  std::vector<std::vector<ParagraphQueryBox>> result;result.reserve(ranges.size());
  for(const auto& range:ranges){
    if(range.first>range.second||range.second>identity.units)throw std::invalid_argument("Invalid Core paragraph query range");
    const auto boxes=self->impl_->paragraph->getRectsForRange(range.first,range.second,skia::textlayout::RectHeightStyle::kTight,skia::textlayout::RectWidthStyle::kTight);
    std::vector<ParagraphQueryBox> row;row.reserve(boxes.size());for(const auto& item:boxes)row.push_back(box(item));result.push_back(std::move(row));
  }
  return result;
}
std::optional<ParagraphQueryHit> ParagraphQuerySource::hit(uint64_t ticket,void const* context,ParagraphQueryIdentity const& identity,float x,float y){
  const auto self=sourceFor(ticket);if(!self)return std::nullopt;std::unique_lock access(self->impl_->mutex,std::try_to_lock);
  if(!access.owns_lock()||!self->impl_->matches(ticket,context,identity))return std::nullopt;
  if(!std::isfinite(x)||!std::isfinite(y))throw std::invalid_argument("Invalid Core paragraph hit point");
  const auto position=self->impl_->paragraph->getGlyphPositionAtCoordinate(x,y);ParagraphQueryHit result;result.position=position.position;result.upstream=position.affinity==skia::textlayout::Affinity::kUpstream;
  skia::textlayout::Paragraph::GlyphInfo glyph;result.hasGlyph=self->impl_->paragraph->getClosestUTF16GlyphInfoAt(x,y,&glyph);
  if(result.hasGlyph){result.start=static_cast<uint32_t>(glyph.fGraphemeClusterTextRange.start);result.end=static_cast<uint32_t>(glyph.fGraphemeClusterTextRange.end);result.glyph={glyph.fGraphemeLayoutBounds.left(),glyph.fGraphemeLayoutBounds.top(),glyph.fGraphemeLayoutBounds.right(),glyph.fGraphemeLayoutBounds.bottom(),glyph.fDirection==skia::textlayout::TextDirection::kRtl};}
  if(result.position>identity.units||(result.hasGlyph&&(result.start>result.end||result.end>identity.units)))throw std::runtime_error("Native paragraph hit escaped its Core document");return result;
}
}
