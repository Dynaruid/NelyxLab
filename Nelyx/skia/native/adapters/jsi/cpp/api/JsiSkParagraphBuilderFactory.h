#pragma once

#include <memory>
#include <utility>
#include <array>
#include <cmath>
#include <vector>

#include <jsi/jsi.h>

#include "JsiSkConverters.h"
#include "JsiSkNativeObjects.h"
#include "JsiSkParagraphBuilder.h"
#include "JsiSkParagraphStyle.h"
#include "JsiSkTypefaceFontProvider.h"
#include "JsiNativeServiceAudit.h"

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdocumentation"

#include "modules/skparagraph/include/ParagraphBuilder.h"

#pragma clang diagnostic pop

namespace RNSkia {

namespace jsi = facebook::jsi;

namespace para = skia::textlayout;

/**
 Implementation of the ParagraphBuilderFactory for making ParagraphBuilder JSI
 object
 */
class JsiSkParagraphBuilderFactory
    : public JsiSkNativeObject<JsiSkParagraphBuilderFactory> {
public:
  static constexpr const char *CLASS_NAME = "ParagraphBuilderFactory";
  int nelyxTextStyleVersion() { return 1; }
  int nelyxTextBoundaryVersion() { return 2; }
  int nelyxTextBoxVersion() { return 1; }
  int nelyxParagraphApiVersion() { return 2; }
  int nelyxTextTransactionVersion() { return 1; }

  JSI_HOST_FUNCTION(nelyxBuildAndLayout) {
    if(count!=4)throw jsi::JSError(runtime,"Text transaction requires style, provider, closed operations and width");
    const auto width=arguments[3].asNumber();
    if(std::isnan(width)||width<0||(std::isfinite(width)&&width>16777216))throw jsi::JSError(runtime,"Invalid text transaction width");
    auto provider=getJsiObject<JsiSkTypefaceFontProvider>(runtime,arguments[1]);
    if(!provider->nelyxOwnedBy(getContext().get()))throw jsi::JSError(runtime,"Foreign transaction font provider");
    auto input=arguments[2].asObject(runtime).asArray(runtime);
    if(input.size(runtime)>2048)throw jsi::JSError(runtime,"Text transaction operation budget");
    size_t metadata=0,units=0,bytes=0,depth=0,placeholders=0;
    const auto string=[&](const jsi::Value& value,size_t maximum){
      auto source=value.asString(runtime);size_t length=0;
      auto countUnits=[&](bool,const void*,size_t count){if(count>1048576||length>1048576-count)length=1048577;else length+=count;};source.getStringData(runtime,countUnits);
      if(length>maximum||metadata>1048576-length*2)throw jsi::JSError(runtime,"Text transaction string/metadata budget");
      metadata+=length*2;return std::pair(source.utf8(runtime),length);
    };
    const auto styleBudget=[&](const jsi::Value& value){
      if(value.isUndefined()||value.isNull())return;
      auto style=value.asObject(runtime);
      for(const auto name:{"fontFamilies","fontFeatures","fontVariations","shadows"}){
        auto property=style.getProperty(runtime,name);if(property.isUndefined()||property.isNull())continue;
        auto list=property.asObject(runtime).asArray(runtime);const size_t maximum=std::strcmp(name,"fontFamilies")==0?256:64;
        if(list.size(runtime)>maximum)throw jsi::JSError(runtime,"Text transaction style array budget");
        metadata+=list.size(runtime)*64;if(metadata>1048576)throw jsi::JSError(runtime,"Text transaction metadata budget");
        for(size_t i=0;i<list.size(runtime);++i){
          auto item=list.getValueAtIndex(runtime,i);
          if(std::strcmp(name,"fontFamilies")==0)string(item,256);
          else if(std::strcmp(name,"fontFeatures")==0)string(item.asObject(runtime).getProperty(runtime,"name"),4);
          else if(std::strcmp(name,"fontVariations")==0)string(item.asObject(runtime).getProperty(runtime,"axis"),4);
        }
      }
      auto locale=style.getProperty(runtime,"locale");if(!locale.isUndefined()&&!locale.isNull())string(locale,128);
    };
    auto paragraphInput=arguments[0].asObject(runtime);
    styleBudget(paragraphInput.getProperty(runtime,"textStyle"));styleBudget(paragraphInput.getProperty(runtime,"strutStyle"));
    auto ellipsis=paragraphInput.getProperty(runtime,"ellipsis");if(!ellipsis.isUndefined()&&!ellipsis.isNull())string(ellipsis,4096);
    auto paragraphStyle=JsiSkParagraphStyle::fromValue(runtime,arguments[0]);
    struct Operation {unsigned kind;para::TextStyle style;std::shared_ptr<SkPaint> foreground,background;std::string text;std::array<double,5> placeholder{};};
    std::vector<Operation> operations;operations.reserve(input.size(runtime));
    for(size_t i=0;i<input.size(runtime);++i){
      auto row=input.getValueAtIndex(runtime,i).asObject(runtime);const auto kind=row.getProperty(runtime,"kind").asNumber();
      if(!std::isfinite(kind)||std::floor(kind)!=kind||kind<0||kind>3)throw jsi::JSError(runtime,"Invalid text transaction operation");
      Operation operation;operation.kind=static_cast<unsigned>(kind);
      if(operation.kind==0){
        if(++depth>32)throw jsi::JSError(runtime,"Text transaction style depth");
        auto style=row.getProperty(runtime,"style");styleBudget(style);operation.style=JsiSkTextStyle::fromValue(runtime,style);
        for(unsigned paint=0;paint<2;++paint){auto value=row.getProperty(runtime,paint?"background":"foreground");if(!value.isUndefined()&&!value.isNull()){
          auto wrapped=getJsiObject<JsiSkPaint>(runtime,value);if(!wrapped->nelyxOwnedBy(getContext().get()))throw jsi::JSError(runtime,"Foreign transaction Paint");
          (paint?operation.background:operation.foreground)=std::make_shared<SkPaint>(*wrapped->getObject());
        }}
      }else if(operation.kind==1){if(!depth)throw jsi::JSError(runtime,"Unbalanced text transaction style");--depth;
      }else if(operation.kind==2){
        auto text=string(row.getProperty(runtime,"text"),4096);units+=text.second;bytes+=text.first.size();
        if(units>4096||bytes>16384)throw jsi::JSError(runtime,"Text transaction content budget");operation.text=std::move(text.first);
      }else{
        auto values=row.getProperty(runtime,"placeholder").asObject(runtime).asArray(runtime);
        if(values.size(runtime)!=5||++placeholders>64||++units>4096)throw jsi::JSError(runtime,"Text transaction placeholder budget");
        for(unsigned j=0;j<5;++j){const auto number=values.getValueAtIndex(runtime,j).asNumber();if(!std::isfinite(number)||std::abs(number)>16777216)throw jsi::JSError(runtime,"Invalid transaction placeholder");operation.placeholder[j]=number;}
        if(operation.placeholder[0]<0||operation.placeholder[1]<0||operation.placeholder[2]<0||operation.placeholder[2]>5||std::floor(operation.placeholder[2])!=operation.placeholder[2]||operation.placeholder[3]<0||operation.placeholder[3]>1||std::floor(operation.placeholder[3])!=operation.placeholder[3])throw jsi::JSError(runtime,"Invalid transaction placeholder policy");
      }
      operations.push_back(std::move(operation));
    }
    if(depth)throw jsi::JSError(runtime,"Unbalanced text transaction style");
    JsiSkParagraphBuilder builder(getContext(),std::move(paragraphStyle),provider->getObject(),provider->paragraphFonts());
    for(const auto& operation:operations){
      if(operation.kind==0)builder.pushStyle(operation.style,operation.foreground?JsiOptional<std::shared_ptr<SkPaint>>(operation.foreground):JsiOptional<std::shared_ptr<SkPaint>>(),operation.background?JsiOptional<std::shared_ptr<SkPaint>>(operation.background):JsiOptional<std::shared_ptr<SkPaint>>());
      else if(operation.kind==1)builder.pop();
      else if(operation.kind==2)builder.addText(operation.text);
      else{const auto& p=operation.placeholder;builder.addPlaceholder(p[0],p[1],p[2],p[3],p[4]);}
    }
    auto paragraph=builder.build();builder.dispose();paragraph->layout(width);
    auto metrics=paragraph->nelyxTextMetrics();metrics.push_back(paragraph->getMaxWidth());metrics.push_back(paragraph->getHeight());
    auto result=jsi::Object(runtime);
    result.setProperty(runtime,"paragraph",makeJsiObject(runtime,paragraph));
    result.setProperty(runtime,"metrics",RNJsi::JSIConverter<std::vector<double>>::toJSI(runtime,metrics));
    result.setProperty(runtime,"lines",paragraph->getLineMetrics(runtime,jsi::Value::undefined(),nullptr,0));
    std::vector<double> boxes;
    {nelyx::skia_core::ParagraphAccess access(*paragraph->getObject());for(const auto& box:paragraph->getObject()->getRectsForPlaceholders())boxes.insert(boxes.end(),{box.rect.x(),box.rect.y(),box.rect.width(),box.rect.height(),double(box.direction)});}
    result.setProperty(runtime,"boxes",RNJsi::JSIConverter<std::vector<double>>::toJSI(runtime,boxes));
    result.setProperty(runtime,"operations",double(operations.size()));result.setProperty(runtime,"textBytes",double(bytes));
    NativeServiceAudit::recordEngine({{3,1},{4,operations.size()},{5,bytes}});
    return result;
  }

  std::shared_ptr<JsiSkParagraphBuilder>
  Make(JsiOptional<para::ParagraphStyle> paragraphStyle,
       JsiOptional<std::shared_ptr<JsiSkTypefaceFontProvider>> fontMgr) {
    return std::make_shared<JsiSkParagraphBuilder>(
        getContext(),
        paragraphStyle.has_value() ? *paragraphStyle : para::ParagraphStyle(),
        fontMgr.has_value() ? (*fontMgr)->getObject() : nullptr,
        fontMgr.has_value() ? (*fontMgr)->paragraphFonts() : nullptr);
  }

  static void definePrototype(jsi::Runtime &runtime, jsi::Object &prototype) {
    installMethod(runtime, prototype, "Make",
                  &JsiSkParagraphBuilderFactory::Make);
    installMethod(runtime, prototype, "nelyxTextStyleVersion",
                  &JsiSkParagraphBuilderFactory::nelyxTextStyleVersion);
    installMethod(runtime, prototype, "nelyxTextBoundaryVersion",
                  &JsiSkParagraphBuilderFactory::nelyxTextBoundaryVersion);
    installMethod(runtime, prototype, "nelyxTextBoxVersion",
                  &JsiSkParagraphBuilderFactory::nelyxTextBoxVersion);
    installMethod(runtime, prototype, "nelyxParagraphApiVersion",
                  &JsiSkParagraphBuilderFactory::nelyxParagraphApiVersion);
    installMethod(runtime,prototype,"nelyxTextTransactionVersion",&JsiSkParagraphBuilderFactory::nelyxTextTransactionVersion);
    installHostMethod(runtime,prototype,"nelyxBuildAndLayout",&JsiSkParagraphBuilderFactory::nelyxBuildAndLayout);
  }

  size_t getMemoryPressure() override { return kMinMemoryPressure; }

  explicit JsiSkParagraphBuilderFactory(
      std::shared_ptr<RNSkPlatformContext> context)
      : JsiSkNativeObject<JsiSkParagraphBuilderFactory>(std::move(context)) {}
};

} // namespace RNSkia
