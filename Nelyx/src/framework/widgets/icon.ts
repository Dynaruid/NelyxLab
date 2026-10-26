// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned Icon composition on the owning Core text/semantics/transform/font pipeline.
import {StatelessWidget,LeafRenderObjectWidget,LeafRenderObjectElement} from './framework.ts';import type {Widget,WidgetOptions,BuildContext} from './framework.ts';import {IconData,IconDataProperty,isCapturedIconData} from './icon-data.ts';import {IconTheme} from './icon-theme.ts';import {Directionality,MediaQuery} from './app-data.ts';import {SizedBox} from './basic.ts';import {Semantics} from './semantics.ts';import {TextSpan} from '../painting/text-span.ts';import {TextStyle,textStyleConstructionIsPlain} from '../painting/text-style.ts';import {TextScaler} from '../painting/text-scaler.ts';import {FontVariation,FontWeight,isOwnedTypographyValue} from '../../ui/typography.ts';import {Paint} from '../../ui/paint.ts';import type {BlendMode} from '../../ui/paint.ts';import type {Color} from '../../ui/color.ts';import type {Shadow} from '../../ui/shadow.ts';import {invariant} from '../../foundation/errors.ts';import {DiagnosticsProperty,StringProperty} from '../../foundation/diagnostics.ts';import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';import {DoubleProperty,IterableProperty,EnumProperty} from '../../foundation/diagnostic-properties.ts';import {ColorProperty} from '../painting/color-property.generated.ts';
import {resolveTextInput} from './text-input.ts';
import {RenderIconGlyph} from '../rendering/icon-glyph.ts';
import type {IconGlyphConfiguration} from '../rendering/icon-glyph.ts';
import type {RenderObject} from '../rendering/object.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';

interface IconStyleCapture {readonly size:number;readonly color:number;readonly weight:FontWeight|null;readonly debug:boolean;readonly style:TextStyle}
// One recent value per live glyph definition. No size/colour cross-product,
// Widget/State/context, native resource or borrowed style input is retained.
const iconStyles=new WeakMap<IconData,IconStyleCapture>();
function sameIconVariations(previous:readonly FontVariation[]|null,current:readonly FontVariation[]):boolean{
  if(previous===null||previous.length!==current.length)return false;
  for(let index=0;index<current.length;index++)if(previous[index]!.axis!==current[index]!.axis||!Object.is(previous[index]!.value,current[index]!.value))return false;
  return true;
}
function captureIconStyle(icon:IconData,options:ConstructorParameters<typeof TextStyle>[0]):TextStyle{
  const value=options!,size=value.fontSize,color=value.color,weight=value.fontWeight??null;
  const share=isCapturedIconData(icon)&&value.fontFamilyFallback===null&&value.shadows==null&&value.foreground===null&&value.fontVariations?.every(isOwnedTypographyValue)===true&&typeof size==='number'&&typeof color==='number'&&(value.fontFamily===null||typeof value.fontFamily==='string')&&(value.package===null||typeof value.package==='string')&&(weight===null||isOwnedTypographyValue(weight))&&textStyleConstructionIsPlain();
  if(!share)return new TextStyle(value);
  const debug=FoundationBuildMode.debug,previous=iconStyles.get(icon);
  if(previous&&Object.is(previous.size,size)&&Object.is(previous.color,color)&&previous.weight===weight&&previous.debug===debug&&sameIconVariations(previous.style.fontVariations,value.fontVariations!))return previous.style;
  const style=new TextStyle(value);iconStyles.set(icon,{size,color,weight,debug,style});return style;
}
export interface IconOptions extends WidgetOptions {readonly size?:number|null;readonly fill?:number|null;readonly weight?:number|null;readonly grade?:number|null;readonly opticalSize?:number|null;readonly color?:Color|null;readonly shadows?:readonly Shadow[]|null;readonly semanticLabel?:string|null;readonly textDirection?:'ltr'|'rtl'|null;readonly applyTextScaling?:boolean|null;readonly blendMode?:BlendMode|null;readonly fontWeight?:FontWeight|null;}
export class Icon extends StatelessWidget {
  readonly size:number|null;readonly fill:number|null;readonly weight:number|null;readonly grade:number|null;readonly opticalSize:number|null;readonly color:Color|null;readonly shadows:readonly Shadow[]|null;readonly semanticLabel:string|null;readonly textDirection:'ltr'|'rtl'|null;readonly applyTextScaling:boolean|null;readonly blendMode:BlendMode|null;readonly fontWeight:FontWeight|null;
  constructor(readonly icon:IconData|null,{key=null,size=null,fill=null,weight=null,grade=null,opticalSize=null,color=null,shadows=null,semanticLabel=null,textDirection=null,applyTextScaling=null,blendMode=null,fontWeight=null}:IconOptions={}){super(key);invariant(icon===null||icon instanceof IconData,'invalid-icon-data','Icon requires the owning Core IconData');invariant(fill===null||fill>=0&&fill<=1,'invalid-icon-fill','Icon fill must be within [0,1]');invariant(weight===null||weight>0,'invalid-icon-weight','Icon weight must be positive');invariant(opticalSize===null||opticalSize>0,'invalid-icon-optical-size','Icon optical size must be positive');this.size=size;this.fill=fill;this.weight=weight;this.grade=grade;this.opticalSize=opticalSize;this.color=color;this.shadows=shadows;this.semanticLabel=semanticLabel;this.textDirection=textDirection;this.applyTextScaling=applyTextScaling;this.blendMode=blendMode;this.fontWeight=fontWeight;}
  build(context:BuildContext):Widget{const textDirection=this.textDirection??Directionality.maybeOf(context);invariant(textDirection!==null,'missing-directionality','Icon requires Directionality or an explicit textDirection');const theme=IconTheme.of(context),applyTextScaling=this.applyTextScaling??theme.applyTextScaling??false,tentativeSize=this.size??theme.size??14,size=applyTextScaling?MediaQuery.textScalerOf(context).scale(tentativeSize):tentativeSize,icon=this.icon;if(icon===null)return new Semantics({label:this.semanticLabel,child:new SizedBox(size,size)});
    const opacity=theme.opacity??1;let color=this.color??theme.color!;if(opacity!==1)color=color.withOpacity(color.opacity*opacity);const foreground=this.blendMode===null?null:new Paint({blendMode:this.blendMode,color:color.toARGB32()}),variations:FontVariation[]=[];for(const [axis,value]of [['FILL',this.fill??theme.fill],['wght',this.weight??theme.weight],['GRAD',this.grade??theme.grade],['opsz',this.opticalSize??theme.opticalSize]] as const)if(value!==null)variations.push(new FontVariation(axis,value));
    const style=captureIconStyle(icon,{fontVariations:variations,inherit:false,color:foreground===null?color.toARGB32():null,fontSize:size,fontFamily:icon.fontFamily,fontWeight:this.fontWeight,package:icon.fontPackage,fontFamilyFallback:icon.fontFamilyFallback,shadows:this.shadows??theme.shadows,height:1,leadingDistribution:'even',foreground}),text=String.fromCodePoint(icon.codePoint),resolved=resolveTextInput(context,text,{direction:textDirection,overflow:'visible',style,textScaler:TextScaler.noScaling},{inheritDefaultStyle:false,defaultFontSize:14});
    return new IconGlyphWidget({size,mirror:icon.matchTextDirection&&textDirection==='rtl',label:this.semanticLabel,labelDirection:this.semanticLabel===null?null:Directionality.maybeOf(context),paragraph:{span:new TextSpan({text,style}),style:resolved.style,scaler:resolved.scaler,placeholders:emptyPlaceholders,input:resolved.input,paragraphOptions:resolved.paragraphOptions,painterOptions:resolved.painterOptions}});
  }
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new IconDataProperty('icon',this.icon,{ifNull:'<empty>',showName:false}));for(const f of ['size','fill','weight','grade','opticalSize'] as const)properties.add(new DoubleProperty(f,this[f],{defaultValue:null}));properties.add(new ColorProperty('color',this.color,{defaultValue:null}));properties.add(new IterableProperty('shadows',this.shadows,{defaultValue:null,elementType:'Shadow'}));properties.add(new StringProperty('semanticLabel',this.semanticLabel,{defaultValue:null}));properties.add(new EnumProperty('textDirection',this.textDirection,{defaultValue:null,typeName:'TextDirection'}));properties.add(new DiagnosticsProperty('applyTextScaling',this.applyTextScaling,{defaultValue:null,typeName:'bool'}));}
}
const emptyPlaceholders=Object.freeze([]);
class IconGlyphWidget extends LeafRenderObjectWidget {
  constructor(readonly configuration:IconGlyphConfiguration){super();}
  override createElement():LeafRenderObjectElement{return new IconGlyphElement(this);}
  createRenderObject(context:BuildContext):RenderIconGlyph{const input=this.configuration.paragraph.input;return new RenderIconGlyph(this.configuration,{text:context.services.text,resources:context.services.resources,font:input.font,scale:input.scale});}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{(render as RenderIconGlyph).configure(this.configuration);}
}
class IconGlyphElement extends LeafRenderObjectElement {
  // The render primitive owns its paragraph directly. It is not a projected
  // Widget child, and the ordinary leaf sync must not detach it after a build.
  protected override synchronizeRenderObjectChildren():void{}
}
