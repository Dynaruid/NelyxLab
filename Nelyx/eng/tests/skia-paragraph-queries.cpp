// SPDX-License-Identifier: BSD-3-Clause
#include "nelyx_skia/core.h"
#include <SemanticsTextGeometry.h>
#include <sstream>
#include "nelyx_skia/paragraph_queries.h"
#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkTypeface.h"
#include "include/ports/SkTypeface_win.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skunicode/include/SkUnicode_icu.h"
#include <chrono>
#include <future>
#include <iostream>
#include <source_location>
#include <thread>
extern "C" void C_SetICU(void const*);
using namespace nelyx::skia_core;
namespace para=skia::textlayout;
static void check(bool value,char const* message,std::source_location location=std::source_location::current()){if(!value)throw std::runtime_error(std::string(message)+" at line "+std::to_string(location.line()));}
template<class F> static bool rejects(F action){try{action();return false;}catch(std::invalid_argument const&){return true;}}
int main(int argc,char** argv){
 try{
  check(argc==4,"Expected bundled font and current ICU inputs");check(SUCCEEDED(CoInitializeEx(nullptr,COINIT_MULTITHREADED)),"Native font COM apartment");struct Apartment {~Apartment(){CoUninitialize();}} apartment;auto font=SkData::MakeFromFileName(argv[1]),icu=SkData::MakeFromFileName(argv[2]);check(font&&icu,"Native input files must exist");C_SetICU(icu->data());
  auto manager=SkFontMgr_New_DirectWrite();auto face=manager->makeFromData(font);check(face!=nullptr,"Actual bundled font decode");auto provider=sk_make_sp<para::TypefaceFontProvider>();provider->registerTypeface(face,SkString("QueryFixture"));
  auto fonts=sk_make_sp<para::FontCollection>();fonts->setAssetFontManager(provider);fonts->setDefaultFontManager(manager);fonts->getParagraphCache()->turnOn(false);
  para::TextStyle style;style.setFontFamilies({SkString("QueryFixture")});style.setFontSize(20);para::ParagraphStyle settings;settings.setTextStyle(style);settings.setMaxLines(128);
  auto unicode=SkUnicodes::ICU::Make();check(unicode!=nullptr,"Actual ICU Unicode engine");const std::string text="A😀 é אבג wrapped text\n한글";
  const auto build=[&](std::string const& body){auto builder=para::ParagraphBuilder::make(settings,fonts,unicode);builder->addText(body.c_str(),body.size());return std::shared_ptr<para::Paragraph>(buildParagraph(*builder));};
  auto paragraph=build(text);auto context=std::make_shared<int>(1);const auto units=SkUnicode::convertUtf8ToUtf16(text.data(),static_cast<int>(text.size())).size();
  ParagraphQueryIdentity identity{"Core View","Core paragraph",text,1,1,static_cast<uint32_t>(units)};auto source=ParagraphQuerySource::create(paragraph,context,text);
  check(rejects([&]{source->bind(identity);}),"An unlaid paragraph cannot publish a read ticket");layoutParagraph(*paragraph,130);const auto ticket=source->bind(identity);check(ticket>0&&source->bind(identity)==ticket,"One stable ticket for this exact private Core resource");
  const std::vector<std::pair<uint32_t,uint32_t>> ranges{{0,static_cast<uint32_t>(units)},{1,3},{3,3}};
  const auto observed=ParagraphQuerySource::ranges(ticket,context.get(),identity,ranges);check(observed&&observed->size()==ranges.size(),"Core read ticket returns actual shaped ranges");
  {
   ParagraphAccess access(*paragraph);
   for(size_t i=0;i<ranges.size();++i){const auto expected=paragraph->getRectsForRange(ranges[i].first,ranges[i].second,para::RectHeightStyle::kTight,para::RectWidthStyle::kTight);check((*observed)[i].size()==expected.size(),"Native queries use the original paragraph's range fragments");for(size_t j=0;j<expected.size();++j){const auto& box=(*observed)[i][j];check(box.left==expected[j].rect.left()&&box.top==expected[j].rect.top()&&box.right==expected[j].rect.right()&&box.bottom==expected[j].rect.bottom(),"No second text layout or ratio-derived rectangle");}}
   check((*observed)[0].size()>1,"Actual wraps and hard breaks stay separate fragments");
   const auto hit=ParagraphQuerySource::hit(ticket,context.get(),identity,31,12);check(hit.has_value(),"A nested same-thread engine read is allowed");const auto expected=paragraph->getGlyphPositionAtCoordinate(31,12);check(hit->position==static_cast<uint32_t>(expected.position)&&hit->upstream==(expected.affinity==para::Affinity::kUpstream),"Point hits retain actual paragraph UTF16 position and affinity");
  }
  auto foreign=identity;foreign.resource="another Core resource";check(!ParagraphQuerySource::ranges(ticket,context.get(),foreign,ranges),"A ticket cannot authorize another Core resource");foreign=identity;foreign.text[0]='B';check(!ParagraphQuerySource::hit(ticket,context.get(),foreign,10,10),"Equal-length foreign text cannot reuse the source ticket");
  auto otherContext=std::make_shared<int>(2);check(!ParagraphQuerySource::hit(ticket,otherContext.get(),identity,10,10),"A different actual native context cannot read this paragraph");check(rejects([&]{source->bind(foreign);}),"The native owner cannot be rebound to a foreign document");check(rejects([&]{ParagraphQuerySource::ranges(ticket,context.get(),identity,{{0,static_cast<uint32_t>(units+1)}});}),"Out-of-document native ranges are rejected");
  namespace Sem=Nelyx::WindowsSemantics;
  Sem::TextSnapshot shadow;const auto wide=SkUnicode::convertUtf8ToUtf16(text.data(),static_cast<int>(text.size()));for(const auto unit:wide)shadow.text.push_back(static_cast<wchar_t>(unit));std::istringstream stops(argv[3]);std::string stop;while(std::getline(stops,stop,','))shadow.characters.push_back(std::stoi(stop));
  Sem::CoreParagraphFrame frame;frame.identity=identity;frame.ticket=ticket;frame.geometry={{{"Core View"},1},1,1,{0,0,200,150},{0,0,200,150},{7,9,1,20},7,29,1};frame.transform={1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1};frame.paintX=7;frame.paintY=9;
  bool live=true;uint64_t revision=1;Sem::ParagraphScreenMapping mapping;mapping.context=context;mapping.active=[&]{return live;};mapping.revision=[&]{return std::optional<uint64_t>(revision);};mapping.screenBox=[](Sem::LogicalBox const& box)->std::optional<Sem::ScreenBox>{return Sem::ScreenBox{100+box.x*2,200+box.y*2,box.width*2,box.height*2};};mapping.viewPoint=[](double x,double y)->std::optional<Sem::LogicalPoint>{return Sem::LogicalPoint{(x-100)/2,(y-200)/2};};
  Sem::TextParagraphGeometry geometry(frame,mapping,shadow);const auto screen=geometry.rectangles(0,static_cast<int>(units));check(screen&&screen->size()==(*observed)[0].size(),"Core paragraphs project into separate native screen fragments");check(std::abs(screen->front().x-(100+(double((*observed)[0][0].left)+7)*2))<1e-9&&std::abs(screen->front().y-(200+(double((*observed)[0][0].top)+9)*2))<1e-9,"Native screen ranges apply the Core paint origin exactly once");
  const auto visible=geometry.visibleRanges();check(visible&&!visible->empty()&&visible->front().start==0&&visible->back().end==static_cast<int>(units),"Visible source ranges use Core grapheme stops");const auto direct=ParagraphQuerySource::hit(ticket,context.get(),identity,10,10);const auto point=geometry.hit(100+(10+7)*2,200+(10+9)*2);check(direct&&point&&*point==static_cast<int>(direct->position),"Screen hit uses the original paragraph, Core transform and scroll origin");
  // A quarter turn reverses the x extrema. Compute the expected first fragment
  // independently, then clip it before applying the controlled screen mapper.
  auto rotated=frame;rotated.transform={0,1,0,0,-1,0,0,0,0,0,1,0,80,5,0,1};rotated.geometry.clip={30,10,50,55};
  Sem::TextParagraphGeometry quarterTurn(rotated,mapping,shadow);const auto turned=quarterTurn.rectangles(0,1);const auto initial=ParagraphQuerySource::ranges(ticket,context.get(),identity,{{0,1}});check(turned&&initial&&!initial->front().empty(),"A transformed Core frame reads its original source fragment");
  const auto& firstBox=initial->front().front();const double expectedLeft=std::max(80-(double(firstBox.bottom)+9),30.),expectedTop=std::max(double(firstBox.left)+7+5,10.),expectedRight=std::min(80-(double(firstBox.top)+9),80.),expectedBottom=std::min(double(firstBox.right)+7+5,65.);
  check(expectedRight>expectedLeft&&expectedBottom>expectedTop&&turned->size()==1,"The independent clipped quarter-turn fragment is visible");check(std::abs(turned->front().x-(100+expectedLeft*2))<1e-9&&std::abs(turned->front().y-(200+expectedTop*2))<1e-9&&std::abs(turned->front().width-(expectedRight-expectedLeft)*2)<1e-9&&std::abs(turned->front().height-(expectedBottom-expectedTop)*2)<1e-9,"Range corners rotate through Core, then clip before native screen conversion");
  auto clipped=frame;clipped.geometry.clip={1000,1000,1,1};Sem::TextParagraphGeometry clippedOut(clipped,mapping,shadow);check(clippedOut.rectangles(0,static_cast<int>(units))->empty()&&clippedOut.visibleRanges()->empty(),"A live Core clip excludes every original glyph rather than reporting unavailable");
  auto changed=mapping;changed.screenBox=[&](Sem::LogicalBox const& box){auto result=mapping.screenBox(box);++revision;return result;};Sem::TextParagraphGeometry reentrant(frame,changed,shadow);check(!reentrant.rectangles(0,static_cast<int>(units)),"A coordinate change during screen conversion invalidates the entire reply");
  auto hidden=mapping;hidden.screenBox=[](Sem::LogicalBox const&)->std::optional<Sem::ScreenBox>{return Sem::ScreenBox{};};Sem::TextParagraphGeometry offscreen(frame,hidden,shadow);check(offscreen.rectangles(0,static_cast<int>(units))->empty()&&offscreen.visibleRanges()->empty(),"A known hidden mapping is a genuine empty visible result");live=false;check(!geometry.rectangles(0,static_cast<int>(units)),"A retired mapper is unavailable rather than offscreen");live=true;
  auto perspective=frame.transform;perspective[3]=.01;perspective[7]=.02;Sem::ParagraphTransform transform(perspective);const auto projected=transform.point(20,10);const auto local=transform.unproject(projected->x,projected->y);check(local&&std::abs(local->x-20)<1e-9&&std::abs(local->y-10)<1e-9,"Core homogeneous painted-plane unprojection survives perspective");auto singular=frame.transform;singular[10]=0;check(!Sem::ParagraphTransform(singular).unproject(10,10),"A singular full matrix cannot invent a native hit");
  auto emptyParagraph=build("");auto emptySource=ParagraphQuerySource::create(emptyParagraph,context,std::string{});layoutParagraph(*emptyParagraph,130);auto emptyIdentity=identity;emptyIdentity.text="";emptyIdentity.units=0;auto emptyFrame=frame;emptyFrame.identity=emptyIdentity;emptyFrame.ticket=emptySource->bind(emptyIdentity);Sem::TextSnapshot empty;empty.characters={0};Sem::TextParagraphGeometry emptyGeometry(emptyFrame,mapping,empty);const auto emptyVisible=emptyGeometry.visibleRanges();check(emptyVisible&&emptyVisible->size()==1&&emptyVisible->front().start==0&&emptyVisible->front().end==0,"An empty live paragraph exposes the actual Core caret range");emptySource->retire();check(!emptyGeometry.visibleRanges(),"An empty retired source cannot manufacture a visible caret from old geometry");
  std::promise<bool> result;auto ready=result.get_future();auto access=std::make_unique<ParagraphAccess>(*paragraph);
  std::thread reader([&]{try{result.set_value(!ParagraphQuerySource::ranges(ticket,context.get(),identity,ranges)&&!ParagraphQuerySource::hit(ticket,context.get(),identity,10,10));}catch(...){result.set_exception(std::current_exception());}});
  const bool immediate=ready.wait_for(std::chrono::seconds(2))==std::future_status::ready;access.reset();reader.join();check(immediate&&ready.get(),"A busy JS/paint gate returns unavailable instead of blocking the UI reader");
  layoutParagraph(*paragraph,140);check(!geometry.rectangles(0,static_cast<int>(units)),"Retained projected frames cannot read relaid-out source paragraphs");check(!ParagraphQuerySource::ranges(ticket,context.get(),identity,ranges),"Relayout invalidates all prior Core read tickets");check(rejects([&]{source->bind(identity);}),"A relaid-out source cannot revive the retired ticket");source->retire();source->retire();
  auto replacement=build(text);auto replacementContext=std::make_shared<int>(3);auto next=ParagraphQuerySource::create(replacement,replacementContext,text);layoutParagraph(*replacement,130);const auto nextTicket=next->bind(identity);check(nextTicket!=ticket,"Recreated private paragraphs get a new native ticket");check(!ParagraphQuerySource::ranges(ticket,context.get(),identity,ranges),"Retained old references cannot read a replacement resource");
  const void* expiredContext=replacementContext.get();replacementContext.reset();check(!ParagraphQuerySource::ranges(nextTicket,expiredContext,identity,ranges),"Native context retirement withdraws its source");next->retire();
  std::cout<<"PASS-scoped original SkParagraph Core resource queries, exact range/hit replies, controlled context/screen mapping, Core projected range/visible/hit, reentrant mapping, nonblocking gate, relayout and retirement\n";return 0;
 }catch(std::exception const& error){std::cerr<<error.what()<<'\n';return 1;}catch(Nelyx::WindowsSemantics::TextError const& error){std::cerr<<"Core text geometry error "<<std::hex<<error.result<<'\n';return 1;}
}
