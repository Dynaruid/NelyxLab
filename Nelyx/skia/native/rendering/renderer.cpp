#include "renderer.h"
#include "font_services.h"
#include "nelyx_skia/core.h"
#include <chrono>
#include <cstring>
#include <sstream>
#include <stdexcept>
#include <unordered_map>
#include <atomic>
#include "include/core/SkCanvas.h"
#include "include/core/SkColorSpace.h"
#include "include/core/SkData.h"
#include "include/core/SkFontMgr.h"
#include "include/core/SkGraphics.h"
#include "include/core/SkImage.h"
#include "include/core/SkMatrix.h"
#include "include/core/SkPaint.h"
#include "include/core/SkPicture.h"
#include "include/core/SkPictureRecorder.h"
#include "include/core/SkRRect.h"
#include "include/core/SkSurface.h"
#include "include/core/SkTypeface.h"
#include "../platforms/vulkan/device.h"
#include "include/gpu/graphite/Context.h"
#include "include/gpu/graphite/Image.h"
#include "include/gpu/graphite/Recorder.h"
#include "include/gpu/graphite/Recording.h"
#include "include/gpu/graphite/Surface.h"
#include "modules/skparagraph/include/FontCollection.h"
#include "modules/skparagraph/include/Paragraph.h"
#include "modules/skparagraph/include/ParagraphBuilder.h"
#include "modules/skparagraph/include/TypefaceFontProvider.h"
#include "modules/skunicode/include/SkUnicode_icu.h"

using namespace skia::textlayout;
namespace {
struct PixelReadResult {std::atomic<bool> called{false};std::unique_ptr<const SkImage::AsyncReadResult> pixels;};
std::shared_ptr<PixelReadResult> beginRead(skgpu::graphite::Context& context,SkSurface& surface,const SkImageInfo& info){
  auto result=std::make_shared<PixelReadResult>();auto* completion=new std::shared_ptr<PixelReadResult>(result);
  context.asyncRescaleAndReadPixels(&surface,info,info.bounds(),SkImage::RescaleGamma::kSrc,SkImage::RescaleMode::kNearest,[](void* pointer,std::unique_ptr<const SkImage::AsyncReadResult> value){std::unique_ptr<std::shared_ptr<PixelReadResult>> hold(static_cast<std::shared_ptr<PixelReadResult>*>(pointer));(*hold)->pixels=std::move(value);(*hold)->called.store(true,std::memory_order_release);},completion);return result;
}
bool copyRead(const std::shared_ptr<PixelReadResult>& result,void* pixels,uint32_t width,uint32_t height){if(!result->called.load(std::memory_order_acquire)||!result->pixels)return false;for(uint32_t y=0;y<height;++y)std::memcpy(static_cast<uint8_t*>(pixels)+y*static_cast<size_t>(width)*4,static_cast<const uint8_t*>(result->pixels->data(0))+y*result->pixels->rowBytes(0),static_cast<size_t>(width)*4);return true;}
}
static void rectJson(std::ostream& out,const SkRect& r) {
  out<<"{\"x\":"<<r.x()<<",\"y\":"<<r.y()<<",\"width\":"<<r.width()<<",\"height\":"<<r.height()<<"}";
}
static void stringJson(std::ostream& out,const char* text) {
  out<<'"';for(const unsigned char* c=reinterpret_cast<const unsigned char*>(text);*c;++c){if(*c=='"' || *c=='\\')out<<'\\'<<*c;else if(*c<32){const char* hex="0123456789abcdef";out<<"\\u00"<<hex[*c>>4]<<hex[*c&15];}else out<<*c;}out<<'"';
}
struct SkiaRenderer::Impl {
  std::unique_ptr<nelyx::vulkan::Device> gpu;
  std::unique_ptr<skgpu::graphite::Recorder> recorder;
  sk_sp<SkSurface> surface,window;
  struct FontAsset {
    sk_sp<FontCollection> fonts=sk_make_sp<FontCollection>();
    uint32_t typeface=0;
    std::string family;
    ~FontAsset(){fonts->clearCaches();}
  };
  struct ParagraphAsset {std::shared_ptr<FontAsset> font;std::unique_ptr<Paragraph> value;};
  std::unordered_map<uint32_t,sk_sp<SkImage>> images;
  std::unordered_map<uint32_t,sk_sp<SkPicture>> pictures;
  size_t pictureBytes=0;
  nelyx::skia_core::RuntimeProgramCache runtimePrograms;
  std::unordered_map<uint32_t,std::shared_ptr<FontAsset>> fonts;
  sk_sp<SkUnicode> unicode;
  std::unordered_map<uint32_t,ParagraphAsset> paragraphs;
  void releaseSurfaces() {if(surface){surface.reset();}if(window){window.reset();}
  }
  ~Impl() {
    if(gpu){try{gpu->retire();gpu->releaseWindow(recorder.get());}catch(...){/* Explicit close retains this owner on uncertain completion. */}}
    pictures.clear();paragraphs.clear();
    fonts.clear();unicode.reset();
    releaseSurfaces();images.clear();
    recorder.reset();if(gpu){gpu.reset();}
  }
  Paragraph& paragraph(uint32_t id) {
    const auto found=paragraphs.find(id);if(found==paragraphs.end())throw std::runtime_error("stale paragraph resource");
    return *found->second.value;
  }
  struct Resources : nelyx::skia_core::FrameResources {
    Impl& owner;explicit Resources(Impl& value):owner(value){}
    sk_sp<SkImage> image(uint32_t id) override {const auto found=owner.images.find(id);if(found==owner.images.end())throw std::runtime_error("stale image resource");return found->second;}
    Paragraph& paragraph(uint32_t id) override {return owner.paragraph(id);}
    sk_sp<SkPicture> picture(uint32_t id,uint32_t generation) override {const auto found=owner.pictures.find(id);if(generation!=1||found==owner.pictures.end())throw std::runtime_error("stale native picture");return found->second;}
  };
};
SkiaRenderer::SkiaRenderer():impl(std::make_unique<Impl>()){}
void SkiaRenderer::initialize(const std::string& image,const std::string& font,const std::string& icu,bool gpu,uint64_t borrowedWindow,uint32_t linuxKind,uint64_t borrowedDisplay) {
  if(!gpu)throw std::runtime_error("Native hardware Vulkan renderer required");
  nelyx::font_services::initialize(icu);
  impl->unicode=SkUnicodes::ICU::Make();if(!impl->unicode)throw std::runtime_error("ICU Unicode service failed");
  if(gpu){
  if(linuxKind)impl->gpu=std::make_unique<nelyx::vulkan::Device>(nelyx::vulkan::WindowTarget{linuxKind==1?nelyx::vulkan::WindowKind::Xlib:nelyx::vulkan::WindowKind::Wayland,borrowedDisplay,borrowedWindow});
  else impl->gpu=std::make_unique<nelyx::vulkan::Device>(borrowedWindow);
  impl->recorder=impl->gpu->context()->makeRecorder();if(!impl->recorder)throw std::runtime_error("Graphite Vulkan recorder failed");
  }
  if(!image.empty())loadAsset(1,1,image,"");
  if(!font.empty())loadAsset(1,2,font,"NelyxDefaultFont");
}
void SkiaRenderer::loadAsset(uint32_t id,uint32_t kind,const std::string& path,const std::string& family) {
  if(path.empty())throw std::runtime_error("invalid asset path");
  auto data=SkData::MakeFromFileName(path.c_str());if(!data || data->size()>16*1024*1024)throw std::runtime_error("asset bytes unavailable or exceed budget");
  const auto begin=static_cast<const uint8_t*>(data->data());loadAssetBytes(id,kind,std::vector<uint8_t>(begin,begin+data->size()),family);
}
void SkiaRenderer::loadAssetBytes(uint32_t id,uint32_t kind,const std::vector<uint8_t>& bytes,const std::string& family) {
  if(!id || (kind!=1 && kind!=2) || bytes.empty() || bytes.size()>16*1024*1024)throw std::runtime_error("invalid asset identity/kind/byte budget");
  if(impl->images.size()+impl->fonts.size()>=64)throw std::runtime_error("native asset count budget exhausted");
  auto data=SkData::MakeWithCopy(bytes.data(),bytes.size());if(!data)throw std::runtime_error("asset data allocation failed");
  if(kind==1){
    if(impl->images.contains(id))throw std::runtime_error("duplicate image identity");
    auto image=SkImages::DeferredFromEncodedData(data);
    if(!image || image->width()<=0 || image->height()<=0 || image->width()>8192 || image->height()>8192 || static_cast<uint64_t>(image->width())*image->height()>16*1024*1024)throw std::runtime_error("image decode/dimension budget failed");
    if(impl->recorder){
      image=SkImages::TextureFromImage(impl->recorder.get(),image);if(!image)throw std::runtime_error("Graphite Vulkan image upload failed");
      auto upload=impl->recorder->snap();if(!upload)throw std::runtime_error("Graphite image upload recording failed");
      skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=upload.get();if(impl->gpu->context()->insertRecording(insert)!=skgpu::graphite::InsertStatus::kSuccess)throw std::runtime_error("Graphite image upload recording rejected");
      impl->gpu->retire();
    }
    impl->images.emplace(id,std::move(image));return;
  }
  if(impl->fonts.contains(id) || family.empty() || family.size()>256)throw std::runtime_error("duplicate font identity or invalid family");
  auto manager=nelyx::font_services::manager();
  auto face=manager->makeFromData(data);if(!face)throw std::runtime_error("Bundled font decode failed");
  auto asset=std::make_shared<Impl::FontAsset>();asset->typeface=face->uniqueID();asset->family=family;
  auto provider=sk_make_sp<TypefaceFontProvider>();provider->registerTypeface(face,SkString(family.c_str()));
  asset->fonts->setAssetFontManager(provider);asset->fonts->setDefaultFontManager(manager);
  // Paragraphs themselves own shaping results. Avoid an additional unbounded
  // cache retaining layouts after the app releases their producer references.
  asset->fonts->getParagraphCache()->turnOn(false);impl->fonts.emplace(id,std::move(asset));
}
void SkiaRenderer::releaseAsset(uint32_t id,uint32_t kind){
  if(kind==1){if(!impl->images.erase(id))throw std::runtime_error("image already released");}
  else if(kind==2){if(!impl->fonts.erase(id))throw std::runtime_error("font already released");}
  else throw std::runtime_error("invalid asset kind");
}
SkiaRenderer::~SkiaRenderer(){try{close();}catch(...){impl.release();/* Never release resources with unproven completion. */}}
void SkiaRenderer::close(){
  if(!impl)return;
  retireGpu();
  if(impl->gpu){
    impl->gpu->releaseWindow(impl->recorder.get());
    impl->pictures.clear();impl->pictureBytes=0;impl->paragraphs.clear();impl->fonts.clear();impl->unicode.reset();
    impl->releaseSurfaces();impl->images.clear();impl->runtimePrograms.clear();impl->recorder.reset();
    impl->gpu->drain();
  }
  impl.reset();SkGraphics::PurgeFontCache();
}
std::string SkiaRenderer::driver() const{
  return impl->gpu?impl->gpu->description()+" / Graphite native Vulkan"+(impl->gpu->hasWindow()?" / swapchainMaintenance1":" / offscreen"):"uninitialized";
}
std::string SkiaRenderer::runtimeShaderStats() const{
  const auto s=impl->runtimePrograms.stats();std::ostringstream out;
  out<<"{\"entries\":"<<s.entries<<",\"sourceBytes\":"<<s.sourceBytes<<",\"hits\":"<<s.hits<<",\"misses\":"<<s.misses<<",\"compilations\":"<<s.compilations<<",\"evictions\":"<<s.evictions<<"}";return out.str();
}
void SkiaRenderer::resize(uint32_t width,uint32_t height) {
  if(width>8192 || height>8192 || static_cast<uint64_t>(width)*height>16*1024*1024)throw std::runtime_error("native surface backing budget");
  retireGpu();
  if(impl->gpu)impl->gpu->resizeWindow(impl->recorder.get(),width,height);
  impl->releaseSurfaces();if(!width || !height)return;
  impl->surface=SkSurfaces::RenderTarget(impl->recorder.get(),SkImageInfo::Make(width,height,kRGBA_8888_SkColorType,kPremul_SkAlphaType));
  if(!impl->surface)throw std::runtime_error("Graphite Vulkan/raster surface creation failed");
}
bool SkiaRenderer::readPixels(uint32_t width,uint32_t height,void* pixels) {
  if(impl->gpu){
    if(!impl->surface||!pixels)return false;
    auto result=beginRead(*impl->gpu->context(),*impl->surface,SkImageInfo::Make(width,height,kBGRA_8888_SkColorType,kPremul_SkAlphaType));
    try{impl->gpu->retire();}catch(...){throw RasterizationUnconfirmed("Native surface readback completion unconfirmed; owner must close before reuse");}return copyRead(result,pixels,width,height);
  }
  return impl->surface && impl->surface->readPixels(SkImageInfo::Make(width,height,kBGRA_8888_SkColorType,kPremul_SkAlphaType),pixels,static_cast<size_t>(width)*4,0,0);
}
void SkiaRenderer::render(const std::vector<uint8_t>& bytes) {
  if(!impl->surface)throw std::runtime_error("render surface unavailable");
  Impl::Resources resources(*impl);
  nelyx::skia_core::replayFrame(*impl->surface->getCanvas(),bytes.data(),bytes.size(),resources,impl->runtimePrograms);
  if(impl->gpu){
    if(impl->gpu->hasWindow())impl->gpu->present(impl->recorder.get(),impl->surface.get());
    else {auto recording=impl->recorder->snap();if(!recording)throw std::runtime_error("Graphite recording unavailable");skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=recording.get();if(impl->gpu->context()->insertRecording(insert)!=skgpu::graphite::InsertStatus::kSuccess)throw std::runtime_error("Graphite recording rejected");}
  }
  retireGpu();
}
void SkiaRenderer::recordPicture(uint32_t id,const std::vector<uint8_t>& bytes){
  // Match the frame resource owner: one bounded build, two admitted frames and64 cached producers.
  if(!id||impl->pictures.contains(id)||impl->pictures.size()>=4096*3+64)throw std::runtime_error("native picture identity/count budget");
  SkPictureRecorder recorder;auto* canvas=recorder.beginRecording(SkRect::MakeLTRB(SK_ScalarMin,SK_ScalarMin,SK_ScalarMax,SK_ScalarMax));Impl::Resources resources(*impl);
  nelyx::skia_core::replayFrame(*canvas,bytes.data(),bytes.size(),resources,impl->runtimePrograms);auto picture=recorder.finishRecordingAsPicture();if(!picture)throw std::runtime_error("native picture recording failed");
  const auto cost=picture->approximateBytesUsed();if(cost>32*1024*1024||impl->pictureBytes+cost>32*1024*1024)throw std::runtime_error("native picture byte budget");
  impl->pictures.emplace(id,std::move(picture));impl->pictureBytes+=cost;
}
void SkiaRenderer::rasterizePicture(uint32_t id,uint32_t width,uint32_t height,void* rgba,uint32_t length){
  const auto found=impl->pictures.find(id);if(found==impl->pictures.end())throw std::runtime_error("stale native picture");
  if(!rgba||!width||!height||width>8192||height>8192||static_cast<uint64_t>(width)*height>16*1024*1024||static_cast<uint64_t>(width)*height*4>length)throw std::runtime_error("native raster image dimensions/buffer budget");
  auto info=SkImageInfo::Make(width,height,kRGBA_8888_SkColorType,kPremul_SkAlphaType,SkColorSpace::MakeSRGB());auto surface=SkSurfaces::RenderTarget(impl->recorder.get(),info);if(!surface)throw std::runtime_error("native rasterization GPU surface unavailable");
  try{surface->getCanvas()->clear(SK_ColorTRANSPARENT);surface->getCanvas()->drawPicture(found->second);
  auto recording=impl->recorder->snap();if(!recording)throw std::runtime_error("native picture GPU recording unavailable");skgpu::graphite::InsertRecordingInfo insert;insert.fRecording=recording.get();if(impl->gpu->context()->insertRecording(insert)!=skgpu::graphite::InsertStatus::kSuccess)throw std::runtime_error("native picture GPU recording rejected");
  retireGpu();auto result=beginRead(*impl->gpu->context(),*surface,info);
  retireGpu();if(!copyRead(result,rgba,width,height))throw std::runtime_error("native picture GPU readback failed");
  }catch(...){throw RasterizationUnconfirmed("Native picture GPU completion/readback unconfirmed; owner must close before reuse");}
}
void SkiaRenderer::releasePicture(uint32_t id){const auto found=impl->pictures.find(id);if(found==impl->pictures.end())throw std::runtime_error("native picture already released");impl->pictureBytes-=found->second->approximateBytesUsed();impl->pictures.erase(found);}
void SkiaRenderer::retireGpu() {
  if(impl->gpu)impl->gpu->retire();
}
std::string SkiaRenderer::layout(uint32_t id,const std::string& text,float width,float size,const std::string& locale,bool rtl,uint32_t color,uint32_t maxLines,const std::string& ellipsis) {
  return layoutWithFont(id,1,text,width,size,locale,rtl,color,maxLines,ellipsis);
}
std::string SkiaRenderer::layoutWithFont(uint32_t id,uint32_t font,const std::string& text,float width,float size,const std::string& locale,bool rtl,uint32_t color,uint32_t maxLines,const std::string& ellipsis) {
  const auto selected=impl->fonts.find(font);if(selected==impl->fonts.end())throw std::runtime_error("stale font resource");
  const auto asset=selected->second;
  if(impl->paragraphs.contains(id))throw std::runtime_error("duplicate paragraph id");
  if(impl->paragraphs.size()>=64)throw std::runtime_error("paragraph resource budget exhausted");
  const auto start=std::chrono::steady_clock::now();TextStyle style;style.setFontFamilies({SkString(asset->family.c_str())});style.setFontSize(size);style.setColor(color);style.setLocale(SkString(locale.c_str()));
  ParagraphStyle paragraphStyle;paragraphStyle.setTextStyle(style);paragraphStyle.setTextDirection(rtl?TextDirection::kRtl:TextDirection::kLtr);paragraphStyle.setTextAlign(TextAlign::kStart);
  paragraphStyle.setMaxLines(maxLines);paragraphStyle.setEllipsis(SkString(ellipsis.c_str()));
  auto builder=ParagraphBuilder::make(paragraphStyle,asset->fonts,impl->unicode);builder->addText(text.c_str(),text.size());auto paragraph=nelyx::skia_core::buildParagraph(*builder);const auto built=std::chrono::steady_clock::now();nelyx::skia_core::layoutParagraph(*paragraph,width);const auto laidOut=std::chrono::steady_clock::now();
  std::vector<LineMetrics> lines;paragraph->getLineMetrics(lines);if(lines.size()>128)throw std::runtime_error("paragraph line budget exhausted");
  std::ostringstream out;out.precision(9);out<<"{\"width\":"<<paragraph->getMaxWidth()<<",\"height\":"<<paragraph->getHeight()<<",\"alphabeticBaseline\":"<<paragraph->getAlphabeticBaseline()<<",\"ideographicBaseline\":"<<paragraph->getIdeographicBaseline()<<",\"minIntrinsicWidth\":"<<paragraph->getMinIntrinsicWidth()<<",\"maxIntrinsicWidth\":"<<paragraph->getMaxIntrinsicWidth()<<",\"longestLine\":"<<paragraph->getLongestLine()<<",\"overflow\":"<<(paragraph->didExceedMaxLines()?"true":"false")<<",\"unresolvedGlyphs\":"<<paragraph->unresolvedGlyphs()<<",\"lines\":[";
  bool first=true;for(const auto& line:lines) {if(!first)out<<',';first=false;
    out<<"{\"start\":"<<line.fStartIndex<<",\"end\":"<<line.fEndIndex<<",\"baseline\":"<<line.fBaseline<<",\"bounds\":";
    rectJson(out,SkRect::MakeXYWH(static_cast<float>(line.fLeft),static_cast<float>(line.fBaseline-line.fAscent),static_cast<float>(line.fWidth),static_cast<float>(line.fAscent+line.fDescent)));out<<'}';}
  const auto measured=std::chrono::steady_clock::now();auto ms=[](auto from,auto to){return std::chrono::duration<double,std::milli>(to-from).count();};out<<"],\"nativeTimings\":{\"buildMs\":"<<ms(start,built)<<",\"layoutMs\":"<<ms(built,laidOut)<<",\"geometryMs\":"<<ms(laidOut,measured)<<",\"totalMs\":"<<ms(start,measured)<<"}}";const auto result=out.str();if(result.size()>=32768)throw std::runtime_error("paragraph geometry output budget exhausted");
  impl->paragraphs.emplace(id,Impl::ParagraphAsset{asset,std::move(paragraph)});return result;
}
std::string SkiaRenderer::glyphs(uint32_t id) {
  std::ostringstream out;out.precision(9);out<<'[';bool first=true;
  impl->paragraph(id).visit([&](int line,const Paragraph::VisitorInfo* info){
    if(!info)return;if(!first)out<<',';first=false;auto face=info->font.refTypeface();SkString family;face->getFamilyName(&family);
    std::vector<SkRect> bounds(info->count);info->font.getBounds({info->glyphs,static_cast<size_t>(info->count)},{bounds.data(),bounds.size()},nullptr);
    out<<"{\"line\":"<<line<<",\"fontFamily\":";stringJson(out,family.c_str());out<<",\"typefaceId\":"<<face->uniqueID()<<",\"fontSource\":\""<<(face->uniqueID()==impl->paragraphs.at(id).font->typeface?"bundled":"system-fallback")<<"\",\"glyphs\":[";
    for(int i=0;i<info->count;++i){if(i)out<<',';out<<info->glyphs[i];}out<<"],\"utf8Starts\":[";
    for(int i=0;i<info->count;++i){if(i)out<<',';out<<info->utf8Starts[i];}out<<"],\"inkBounds\":[";
    for(int i=0;i<info->count;++i){if(i)out<<',';auto rect=bounds[i];rect.offset(info->origin.x()+info->positions[i].x(),info->origin.y()+info->positions[i].y());rectJson(out,rect);}out<<"]}";
  });out<<']';const auto result=out.str();if(result.size()>=262144)throw std::runtime_error("glyph geometry budget exhausted");return result;
}
std::string SkiaRenderer::range(uint32_t id,uint32_t start,uint32_t end) {
  const auto boxes=impl->paragraph(id).getRectsForRange(start,end,RectHeightStyle::kTight,RectWidthStyle::kTight);
  std::ostringstream out;out.precision(9);out<<'[';bool first=true;for(const auto& box:boxes){if(!first)out<<',';first=false;rectJson(out,box.rect);}out<<']';return out.str();
}
std::string SkiaRenderer::hit(uint32_t id,float x,float y) {
  auto& paragraph=impl->paragraph(id);const auto pos=paragraph.getGlyphPositionAtCoordinate(x,y);Paragraph::GlyphInfo glyph;
  std::ostringstream out;out.precision(9);out<<"{\"position\":"<<pos.position<<",\"affinity\":"<<static_cast<int>(pos.affinity);
  if(paragraph.getClosestUTF16GlyphInfoAt(x,y,&glyph)) {out<<",\"start\":"<<glyph.fGraphemeClusterTextRange.start<<",\"end\":"<<glyph.fGraphemeClusterTextRange.end<<",\"direction\":"<<static_cast<int>(glyph.fDirection)<<",\"bounds\":";rectJson(out,glyph.fGraphemeLayoutBounds);}
  out<<'}';return out.str();
}
void SkiaRenderer::release(uint32_t id) {if(!impl->paragraphs.erase(id))throw std::runtime_error("paragraph already released");}
