#include "nelyx_skia/core.h"
#include "nelyx_skia/paragraph_queries.h"
#include <cmath>
#include <cstring>
#include <stdexcept>
#include <vector>
#include "include/core/SkMatrix.h"
#include "include/core/SkM44.h"
#include "include/core/SkColorFilter.h"
#include "include/core/SkPathBuilder.h"
#include "include/core/SkPoint3.h"
#include "include/utils/SkShadowUtils.h"
#if defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
#include "include/core/SkVertices.h"
#include "include/utils/SkPaintFilterCanvas.h"
#include "src/core/SkCanvasPriv.h"
#include "src/core/SkColorFilterPriv.h"
#include "src/core/SkDevice.h"
#include "src/core/SkDrawShadowInfo.h"
#include "src/utils/SkShadowTessellator.h"
#endif
#include "paint_effects.h"
#include <unordered_map>

namespace nelyx::skia_core {
#if defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
namespace {
bool drawStableShadow(SkCanvas& canvas,const SkPath& path,const SkDrawShadowRec& rec) {
  if(!canvas.recorder())return false;
  auto* device=SkCanvasPriv::TopDevice(&canvas);const auto matrix=device->localToDevice();
  if(matrix.hasPerspective()||!(rec.fFlags&SkShadowFlags::kDirectionalLight_ShadowFlag)||
     rec.fZPlaneParams.fX!=0||rec.fZPlaneParams.fY!=0||!rec.fZPlaneParams.isFinite()||
     !rec.fLightPos.isFinite()||!std::isfinite(rec.fLightRadius)||
     ((rec.fFlags&SkShadowFlags::kConcaveBlurOnly_ShadowFlag)&&!path.isConvex()))return false;
  // The pinned Skia directional spot tessellator includes the device translation
  // in its polygon/umbra calculations. Fractional scrolling changes the mesh
  // (or makes it fail) even inside a layer, particularly for wide cards. Light
  // direction and a flat Z plane are translation invariant: tessellate without
  // translation, then place the mesh with that exact, unsnapped translation.
  auto neutral=matrix;neutral.setTranslateX(0);neutral.setTranslateY(0);
  sk_sp<SkVertices> spot;
  if(SkColorGetA(rec.fSpotColor)){
    spot=SkShadowTessellator::MakeSpot(path,neutral,rec.fZPlaneParams,rec.fLightPos,rec.fLightRadius,
      (rec.fFlags&SkShadowFlags::kTransparentOccluder_ShadowFlag)!=0,true);
    if(!spot)return false;
  }
  // Skia already generates the ambient mesh without translation.
  SkShadowUtils::DrawShadow(&canvas,path,rec.fZPlaneParams,rec.fLightPos,rec.fLightRadius,
    rec.fAmbientColor,SK_ColorTRANSPARENT,rec.fFlags);
  if(spot){
    SkAutoCanvasRestore restore(&canvas,true);
    const auto placement=device->deviceToGlobal()*SkM44::Translate(matrix.getTranslateX(),matrix.getTranslateY());
    canvas.setMatrix(placement);
    SkPaint paint;paint.setColorFilter(SkColorFilters::Blend(rec.fSpotColor,SkBlendMode::kModulate)->makeComposed(SkColorFilterPriv::MakeGaussian()));
    canvas.drawVertices(spot,SkBlendMode::kDst,paint);
  }
  return true;
}
// Keep shadows as native shadow commands in retained pictures. Resolve their
// mesh at replay, when the complete parent transform and clip are available.
class ShadowReplayCanvas final:public SkPaintFilterCanvas {
  SkCanvas& target;
public:
  explicit ShadowReplayCanvas(SkCanvas& canvas):SkPaintFilterCanvas(&canvas),target(canvas){}
protected:
  bool onFilter(SkPaint&)const override{return true;}
  void onDrawPicture(const SkPicture* picture,const SkMatrix* matrix,const SkPaint* paint)override{
    SkCanvas::onDrawPicture(picture,matrix,paint);
  }
  void onDrawShadowRec(const SkPath& path,const SkDrawShadowRec& rec)override{
    if(!drawStableShadow(target,path,rec))SkNWayCanvas::onDrawShadowRec(path,rec);
  }
};
}
#endif
uint32_t abiVersion() noexcept { return 1; }
uint32_t frameWireVersion() noexcept { return 11; }
sk_sp<SkRuntimeEffect> RuntimeProgramCache::get(const std::string& source) {
  if(source.empty()||source.size()>16384)throw std::runtime_error("runtime program source budget");
  for(unsigned char c:source)if(!(c==9||c==10||c==13||(c>=32&&c<=126)))throw std::runtime_error("runtime program ASCII source required");
  for(auto it=entries.begin();it!=entries.end();++it)if(it->source==source){++hits;auto program=it->program;entries.splice(entries.end(),entries,it);return program;}
  ++misses;auto compiled=SkRuntimeEffect::MakeForShader(SkString(source));
  if(!compiled.effect)throw std::runtime_error(std::string("runtime shader compilation failed: ")+compiled.errorText.c_str());
  if(!compiled.effect->children().empty())throw std::runtime_error("runtime child shaders are unsupported");
  for(const auto& uniform:compiled.effect->uniforms())if(uniform.type>=SkRuntimeEffect::Uniform::Type::kInt)throw std::runtime_error("runtime shaders require float uniforms");
  ++compilations;
  // Admit first so allocation failure preserves the preceding entries and byte accounting.
  entries.push_back({source,compiled.effect});sourceBytes+=source.size();
  while(entries.size()>16||sourceBytes>128*1024){sourceBytes-=entries.front().source.size();entries.pop_front();++evictions;}
  return compiled.effect;
}
void concatMatrix4(SkCanvas& canvas,const std::array<float,16>& columnMajor) {for(const float value:columnMajor)if(!std::isfinite(value))throw std::runtime_error("non-finite matrix value");canvas.concat(SkM44::ColMajor(columnMajor.data()));}
void drawRect(SkCanvas& canvas,const SkRect& rect,const SkPaint& paint) {canvas.drawRect(rect,paint);}
void drawRRect(SkCanvas& canvas,const SkRRect& rect,const SkPaint& paint) {canvas.drawRRect(rect,paint);}
void drawShadow(SkCanvas& canvas,const SkPath& path,SkColor color,float elevation,bool transparentOccluder,float dpr) {
  if(!std::isfinite(elevation)||elevation<0||!std::isfinite(dpr)||dpr<=0||!std::isfinite(dpr*elevation))throw std::runtime_error("invalid shadow elevation/DPR");
  // Flutter DlSkCanvasDispatcher::DrawShadow at the pinned engine revision.
  const auto alpha=SkColorGetA(color);SkColor ambient,spot;
  SkShadowUtils::ComputeTonalColors(SkColorSetA(color,0.039f*alpha),SkColorSetA(color,0.25f*alpha),&ambient,&spot);
  uint32_t flags=SkShadowFlags::kDirectionalLight_ShadowFlag;if(transparentOccluder)flags|=SkShadowFlags::kTransparentOccluder_ShadowFlag;
  const auto height=SkPoint3::Make(0,0,dpr*elevation),light=SkPoint3::Make(0,-1,1);
#if defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
  if(alpha&&elevation>0&&drawStableShadow(canvas,path,{height,light,800.0f/600.0f,ambient,spot,flags}))return;
#endif
  SkShadowUtils::DrawShadow(&canvas,path,height,light,800.0f/600.0f,ambient,spot,flags);
}
void drawPicture(SkCanvas& canvas,const sk_sp<SkPicture>& picture) {
#if defined(SK_GRAPHITE) && !defined(SK_ENABLE_OPTIMIZE_SIZE)
  if(canvas.recorder()){
    SkAutoCanvasRestore restore(&canvas,true);ShadowReplayCanvas replay(canvas);replay.drawPicture(picture);return;
  }
#endif
  canvas.drawPicture(picture);
}
void drawImage(SkCanvas& canvas,const sk_sp<SkImage>& image,const SkRect& destination) {if(!image)throw std::runtime_error("missing image");canvas.drawImageRect(image,destination,SkSamplingOptions(SkFilterMode::kLinear));}
void drawImageRect(SkCanvas& canvas,const sk_sp<SkImage>& image,const SkRect& source,const SkRect& destination,const SkSamplingOptions& sampling,const SkPaint* paint,SkCanvas::SrcRectConstraint constraint) {if(!image)throw std::runtime_error("missing image");canvas.drawImageRect(image,source,destination,sampling,paint,constraint);}
std::unique_ptr<skia::textlayout::Paragraph> buildParagraph(skia::textlayout::ParagraphBuilder& builder) {auto result=builder.Build();if(!result)throw std::runtime_error("paragraph build failed");return result;}
void layoutParagraph(skia::textlayout::Paragraph& paragraph,float width) {if(std::isnan(width)||width<0||(std::isfinite(width)&&width>16777216))throw std::runtime_error("invalid paragraph width");ParagraphAccess access(paragraph);ParagraphQuerySource::willLayout(paragraph);paragraph.layout(width);ParagraphQuerySource::didLayout(paragraph);}
void paintParagraph(skia::textlayout::Paragraph& paragraph,SkCanvas& canvas,float x,float y) {ParagraphAccess access(paragraph);paragraph.paint(&canvas,x,y);}
static uint32_t u32(const uint8_t* bytes) {uint32_t result;std::memcpy(&result,bytes,4);return result;}
static float f32(const uint8_t* bytes) {float result;std::memcpy(&result,bytes,4);if(!std::isfinite(result))throw std::runtime_error("non-finite frame value");return result;}
static void validateRounded(const uint8_t* first,const uint8_t* second) {
  if(u32(second)!=26||u32(second+4)||u32(second+32)||u32(second+36)||u32(second+40)||u32(second+44))throw std::runtime_error("invalid rounded continuation");
  for(int n=0;n<12;++n){const auto value=f32((n<6?first:second)+8+(n%6)*4);if(n>=4&&value<0)throw std::runtime_error("negative rounded corner radius");}
  if(f32(first+16)<f32(first+8)||f32(first+20)<f32(first+12))throw std::runtime_error("invalid rounded bounds");
}
static SkRRect roundedRect(const uint8_t* first,const uint8_t* second) {
  const auto value=[&](int n){return f32((n<6?first:second)+8+(n%6)*4);};
  const SkVector radii[]={{value(4),value(5)},{value(6),value(7)},{value(8),value(9)},{value(10),value(11)}};
  SkRRect result;result.setRectRadii(SkRect::MakeLTRB(value(0),value(1),value(2),value(3)),radii);return result;
}
void replayFrame(SkCanvas& canvas,const uint8_t* bytes,size_t length,FrameResources& resources) {
  RuntimeProgramCache programs;replayFrame(canvas,bytes,length,resources,programs);
}
void replayFrame(SkCanvas& canvas,const uint8_t* bytes,size_t length,FrameResources& resources,RuntimeProgramCache& programs) {
  if(!bytes||length<64||length>256*1024||u32(bytes)!=0x494c5a4f||u32(bytes+4)<1||u32(bytes+4)>11||u32(bytes+8)!=length)throw std::runtime_error("invalid frame header");
  const uint32_t count=u32(bytes+12);if(count>4096||length!=64+static_cast<size_t>(count)*48)throw std::runtime_error("invalid command count");
  for(size_t offset=16;offset<=28;offset+=4)if(!u32(bytes+offset))throw std::runtime_error("invalid frame generation");
  std::unordered_map<uint32_t,detail::PaintEffects> effects;
  std::unordered_map<uint32_t,sk_sp<SkImage>> images;std::unordered_map<uint32_t,skia::textlayout::Paragraph*> paragraphs;std::unordered_map<uint32_t,sk_sp<SkPicture>> pictures;
  std::vector<bool> saves;int layers=0;for(uint32_t i=0;i<count;++i){const auto command=bytes+64+static_cast<size_t>(i)*48;const auto op=u32(command),flags=u32(command+32);if(op<1||op>(u32(bytes+4)==1?9u:u32(bytes+4)==2?17u:u32(bytes+4)==3?20u:u32(bytes+4)==4?23u:u32(bytes+4)==5?26u:u32(bytes+4)==6?30u:u32(bytes+4)==7?34u:u32(bytes+4)==8?35u:u32(bytes+4)==9?37u:38u))throw std::runtime_error("invalid opcode");
    if(op==35){if(u32(command+4)||flags||!u32(command+36)||!u32(command+40)||u32(command+44))throw std::runtime_error("invalid picture header");for(int n=0;n<6;++n)if(f32(command+8+n*4)!=0)throw std::runtime_error("invalid picture padding");auto picture=resources.picture(u32(command+36),u32(command+40));if(!picture)throw std::runtime_error("missing native picture");pictures.emplace(i,std::move(picture));continue;}
    if(op==38){if(u32(command+4)||flags||u32(command+36)||u32(command+40)||u32(command+44))throw std::runtime_error("invalid backdrop header");for(int n=0;n<6;++n)if(f32(command+8+n*4)!=0)throw std::runtime_error("invalid backdrop padding");saves.push_back(true);if(++layers>32)throw std::runtime_error("layer nesting budget exceeded");continue;}
    if(op==37){if(u32(command+4)||flags||u32(command+36)||u32(command+40)||u32(command+44))throw std::runtime_error("invalid full-clip paint header");for(int n=0;n<6;++n)if(f32(command+8+n*4)!=0)throw std::runtime_error("invalid full-clip paint padding");continue;}
    if(op>=31&&op!=36){if((op!=31&&op!=33)||count-i<2||u32(command+48)!=op+1||u32(command+4)||flags>3||!u32(command+36)||!u32(command+40)||u32(command+44))throw std::runtime_error("invalid image draw header");const auto dst=command+48;if(u32(dst+4)||u32(dst+32)||u32(dst+36)||u32(dst+40)||u32(dst+44))throw std::runtime_error("invalid image destination header");for(int n=0;n<6;++n){const float srcValue=f32(command+8+n*4),dstValue=f32(dst+8+n*4);if(n>=4&&(srcValue!=0||dstValue!=0))throw std::runtime_error("invalid image padding");if(n==2||n==3)if(srcValue<0||dstValue<0)throw std::runtime_error("negative image bounds");if(op==33&&n<4&&(srcValue!=std::floor(srcValue)||std::abs(srcValue)>16777216))throw std::runtime_error("invalid nine-patch center");}auto image=resources.image(u32(command+36),u32(command+40));if(!image)throw std::runtime_error("missing draw image");images.emplace(i,std::move(image));++i;continue;}
    if(op>=27&&op!=36){if(op!=27||i==0||u32(command-48)!=10)throw std::runtime_error("orphan paint effect block");auto value=detail::decodePaintEffects(bytes,count,i,resources,programs);const auto end=value.end;effects.emplace(i,std::move(value));i=end-1;continue;}
    if(op>=18&&op<=20){if(op!=18||count-i<3||u32(command+48)!=19||u32(command+96)!=20)throw std::runtime_error("invalid matrix record sequence");for(int part=0;part<3;++part){const auto record=command+part*48;if(u32(record+4)||u32(record+32)||u32(record+36)||u32(record+40)||u32(record+44))throw std::runtime_error("invalid matrix reserved field");for(int n=0;n<6;++n){const auto value=f32(record+8+n*4);if(part==2&&n>=4&&value!=0)throw std::runtime_error("invalid matrix padding");}}i+=2;continue;}
    if(op>=24&&op!=36){if(op==26||count-i<2||u32(command+4)||(op==24?flags!=0:(flags&~3u)!=0)||u32(command+36)||u32(command+40)||u32(command+44))throw std::runtime_error("invalid rounded header");validateRounded(command,command+48);++i;continue;}
    if(op==23)throw std::runtime_error("orphan path operation");
    if(op==21||op==22||op==36){
      if((op!=36&&u32(command+4)>1)||(op==21?flags!=0:(flags&~3u)!=0)||u32(command+40)||u32(command+44))throw std::runtime_error("invalid path header");
      if(op==36){const float elevation=f32(command+8),dpr=f32(command+12);if(elevation<0||dpr<=0||!std::isfinite(elevation*dpr))throw std::runtime_error("invalid shadow elevation/DPR");}
      for(int n=op==36?2:0;n<6;++n)if(f32(command+8+n*4)!=0)throw std::runtime_error("invalid path header padding");
      const auto operations=u32(command+36);if(operations>count-i-1)throw std::runtime_error("truncated path sequence");
      constexpr int arities[]={0,2,2,2,2,4,4,6,6,5,5,0,4,4};uint32_t cursor=i+1;
      for(uint32_t n=0;n<operations;++n){if(cursor>=count)throw std::runtime_error("truncated path operation");const auto row=bytes+64+static_cast<size_t>(cursor)*48;const auto verb=u32(row+4);if(u32(row)!=23||verb<1||verb>(u32(bytes+4)>=5?14u:13u)||u32(row+32)||u32(row+36)||u32(row+40)||u32(row+44))throw std::runtime_error("invalid path operation");if(verb==14){if(count-cursor<2)throw std::runtime_error("truncated rounded path operation");validateRounded(row,row+48);cursor+=2;}else{for(int v=0;v<6;++v){const auto value=f32(row+8+v*4);if(v>=arities[verb]&&value!=0)throw std::runtime_error("invalid path padding");}if(verb>=12&&(f32(row+16)<f32(row+8)||f32(row+20)<f32(row+12)))throw std::runtime_error("invalid path rectangle");++cursor;}}
      i=cursor-1;continue;
    }
    if(op==2||op==15){saves.push_back(op==15);if(op==15&&++layers>32)throw std::runtime_error("layer nesting budget exceeded");}if(op==3){if(saves.empty())throw std::runtime_error("unbalanced restore");if(saves.back())--layers;saves.pop_back();}
    const int floats=op==4?6:(op==7||op==12||op==17)?5:(op==5||op==6||op==8||op==11||op==13||op==14||op==15||op==16)?4:(op==9||op==10)?2:0;for(int n=0;n<floats;++n)f32(command+8+n*4);
    if(((op>=5&&op<=8)||op==11||op==12||op==13||op==16||op==17||(op==15&&(flags&1)))&&(f32(command+16)<0||f32(command+20)<0))throw std::runtime_error("negative frame rectangle");
    if((op==7||op==12||op==17)&&f32(command+24)<0)throw std::runtime_error("negative frame radius");
    if((op==8||op==9)&&(!u32(command+32)||!u32(command+36)))throw std::runtime_error("invalid frame resource");
    if(op==8){auto image=resources.image(u32(command+32),u32(command+36));if(!image)throw std::runtime_error("missing legacy image");images.emplace(i,std::move(image));}else if(op==9)paragraphs.emplace(i,&resources.paragraph(u32(command+32),u32(command+36)));
    if(op==10&&((flags&~0x7ffu)||((flags>>1)&3)>2||((flags>>3)&3)>2||(flags>>6)>28||f32(command+8)<0||f32(command+12)<0))throw std::runtime_error("invalid paint state");
    if((op==15&&(flags&~1u))||((op==16||op==17)&&(flags&~3u)))throw std::runtime_error("invalid clip/layer flags");
  }
  if(!saves.empty())throw std::runtime_error("unbalanced save");
  const float scale=f32(bytes+40);if(scale<=0||scale>16)throw std::runtime_error("invalid frame scale");
  canvas.restoreToCount(1);canvas.save();canvas.scale(scale,scale);SkPaint legacy,paint;legacy.setAntiAlias(true);paint.setAntiAlias(true);
  try {for(uint32_t i=0;i<count;++i){const auto command=bytes+64+static_cast<size_t>(i)*48;const auto op=u32(command),flags=u32(command+32);legacy.setColor(u32(command+4));
    switch(op){
      case 35:drawPicture(canvas,pictures.at(i));break;
      case 1:canvas.clear(u32(command+4));break;
      case 2:canvas.save();break;
      case 3:canvas.restore();break;
      case 4:{SkMatrix matrix;matrix.setAll(f32(command+8),f32(command+16),f32(command+24),f32(command+12),f32(command+20),f32(command+28),0,0,1);canvas.concat(matrix);break;}
      case 5:case 6:case 7:case 8:{const auto rect=SkRect::MakeXYWH(f32(command+8),f32(command+12),f32(command+16),f32(command+20));if(op==5)canvas.clipRect(rect,SkClipOp::kIntersect,true);else if(op==6)drawRect(canvas,rect,legacy);else if(op==7)drawRRect(canvas,SkRRect::MakeRectXY(rect,f32(command+24),f32(command+24)),legacy);else drawImage(canvas,images.at(i),rect);break;}
      case 9:paintParagraph(*paragraphs.at(i),canvas,f32(command+8),f32(command+12));break;
      case 31:case 33:{const auto src=SkRect::MakeXYWH(f32(command+8),f32(command+12),f32(command+16),f32(command+20));const auto next=command+48;const auto dst=SkRect::MakeXYWH(f32(next+8),f32(next+12),f32(next+16),f32(next+20));if(op==31)drawImageRect(canvas,images.at(i),src,dst,detail::effectSampling(flags),&paint,SkCanvas::kStrict_SrcRectConstraint);else canvas.drawImageNine(images.at(i).get(),SkIRect::MakeLTRB(static_cast<int>(src.left()),static_cast<int>(src.top()),static_cast<int>(src.right()),static_cast<int>(src.bottom())),dst,flags==0?SkFilterMode::kNearest:SkFilterMode::kLinear,&paint);++i;break;}
      case 10:paint.reset();paint.setColor(u32(command+4));paint.setStyle((flags&1)?SkPaint::kStroke_Style:SkPaint::kFill_Style);paint.setStrokeWidth(f32(command+8));paint.setStrokeMiter(f32(command+12));paint.setStrokeCap(static_cast<SkPaint::Cap>((flags>>1)&3));paint.setStrokeJoin(static_cast<SkPaint::Join>((flags>>3)&3));paint.setAntiAlias((flags&32)!=0);paint.setBlendMode(static_cast<SkBlendMode>(flags>>6));break;
      case 27:{const auto& value=effects.at(i);value.apply(paint);i=value.end-1;break;}
      case 11:case 12:case 13:case 15:case 16:case 17:{const auto rect=SkRect::MakeXYWH(f32(command+8),f32(command+12),f32(command+16),f32(command+20));if(op==11)drawRect(canvas,rect,paint);else if(op==12)drawRRect(canvas,SkRRect::MakeRectXY(rect,f32(command+24),f32(command+24)),paint);else if(op==13)canvas.drawOval(rect,paint);else if(op==15)canvas.saveLayer((flags&1)?&rect:nullptr,&paint);else if(op==16)canvas.clipRect(rect,(flags&2)?SkClipOp::kDifference:SkClipOp::kIntersect,(flags&1)!=0);else canvas.clipRRect(SkRRect::MakeRectXY(rect,f32(command+24),f32(command+24)),(flags&2)?SkClipOp::kDifference:SkClipOp::kIntersect,(flags&1)!=0);break;}
      case 14:canvas.drawLine(f32(command+8),f32(command+12),f32(command+16),f32(command+20),paint);break;
      case 18:{std::array<float,16> matrix;for(size_t n=0;n<16;++n)matrix[n]=f32(command+(n/6)*48+8+(n%6)*4);concatMatrix4(canvas,matrix);i+=2;break;}
      case 24:case 25:{const auto rect=roundedRect(command,command+48);if(op==24)drawRRect(canvas,rect,paint);else canvas.clipRRect(rect,(flags&2)?SkClipOp::kDifference:SkClipOp::kIntersect,(flags&1)!=0);++i;break;}
      case 21:case 22:case 36:{
        SkPathBuilder builder;builder.setFillType((op==36?(flags&2):u32(command+4))?SkPathFillType::kEvenOdd:SkPathFillType::kWinding);const auto operations=u32(command+36);uint32_t cursor=i+1;
        for(uint32_t n=0;n<operations;++n){const auto row=bytes+64+static_cast<size_t>(cursor)*48;const auto v=[&](int index){return f32(row+8+index*4);};switch(u32(row+4)){
          case 1:builder.moveTo(v(0),v(1));break;case 2:builder.rMoveTo(v(0),v(1));break;case 3:builder.lineTo(v(0),v(1));break;case 4:builder.rLineTo(v(0),v(1));break;
          case 5:builder.quadTo(v(0),v(1),v(2),v(3));break;case 6:builder.rQuadTo(v(0),v(1),v(2),v(3));break;
          case 7:builder.cubicTo(v(0),v(1),v(2),v(3),v(4),v(5));break;case 8:builder.rCubicTo(v(0),v(1),v(2),v(3),v(4),v(5));break;
          case 9:builder.conicTo(v(0),v(1),v(2),v(3),v(4));break;case 10:builder.rConicTo(v(0),v(1),v(2),v(3),v(4));break;
          case 11:builder.close();break;case 12:builder.addRect(SkRect::MakeLTRB(v(0),v(1),v(2),v(3)));break;case 13:builder.addOval(SkRect::MakeLTRB(v(0),v(1),v(2),v(3)));break;
          case 14:builder.addRRect(roundedRect(row,row+48));++cursor;break;
        }++cursor;}const auto path=builder.detach();if(op==21)canvas.drawPath(path,paint);else if(op==36)drawShadow(canvas,path,u32(command+4),f32(command+8),(flags&1)!=0,f32(command+12));else canvas.clipPath(path,(flags&2)?SkClipOp::kDifference:SkClipOp::kIntersect,(flags&1)!=0);i=cursor-1;break;
      }
      case 38:{auto backdrop=paint.refImageFilter();SkPaint composite=paint;composite.setImageFilter(nullptr);canvas.saveLayer(SkCanvas::SaveLayerRec(nullptr,&composite,backdrop.get(),0));break;}
      case 37:canvas.drawPaint(paint);break;
    }
  }}catch(...){canvas.restoreToCount(1);throw;}canvas.restoreToCount(1);
}
}
