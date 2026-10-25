// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {FontWeight,FontVariation,TextHeightBehavior,kTextHeightNone,isOwnedTypographyValue} from '../../ui/typography.ts';
import type {FontStyle,FontFeature,TextDecoration,TextDecorationStyle,TextLeadingDistribution,TextBaseline,TextAlign,Hyphens} from '../../ui/typography.ts';
import {Shadow} from '../../ui/shadow.ts';
import {Paint} from '../../ui/paint.ts';
import {invariant} from '../../foundation/errors.ts';
import type {TextRunStyle} from '../../ui/text-styles.ts';
import {freezeRunStyle} from '../../ui/text-style-validation.ts';
import {ParagraphStyle} from '../../ui/paragraph-style.ts';
import {TextScaler} from './text-scaler.ts';
import type {StrutStyle} from './strut-style.ts';
import type {TextOverflow} from './text-painter.ts';
import {RenderComparison} from './basic-types.ts';
import {Color} from '../../ui/color.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty,StringProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder,DiagnosticsNode} from '../../foundation/diagnostics.ts';
import {DoubleProperty,EnumProperty,FlagProperty,IterableProperty,MessageProperty} from '../../foundation/diagnostic-properties.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {fixed,protect} from '../../ui/value-math.ts';

export interface TextStyleOptions {
  readonly inherit?:boolean;readonly color?:number|null;readonly backgroundColor?:number|null;
  readonly fontFamily?:string|null;readonly fontFamilyFallback?:readonly string[]|null;readonly package?:string|null;
  readonly fontSize?:number|null;readonly fontWeight?:FontWeight|null;readonly fontStyle?:FontStyle|null;
  readonly letterSpacing?:number|null;readonly wordSpacing?:number|null;readonly textBaseline?:TextBaseline|null;
  readonly height?:number|null;readonly leadingDistribution?:TextLeadingDistribution|null;readonly locale?:string|null;
  readonly foreground?:Paint|null;readonly background?:Paint|null;readonly shadows?:readonly Shadow[]|null;
  readonly decoration?:TextDecoration|null;readonly decorationColor?:number|null;readonly decorationThickness?:number|null;readonly decorationStyle?:TextDecorationStyle|null;
  readonly fontFeatures?:readonly FontFeature[]|null;readonly fontVariations?:readonly FontVariation[]|null;
  readonly debugLabel?:string|null;readonly overflow?:TextOverflow|null;
}
export interface TextStyleApplyOptions {
  readonly color?:number|null;readonly backgroundColor?:number|null;readonly decoration?:TextDecoration|null;readonly decorationColor?:number|null;readonly decorationStyle?:TextDecorationStyle|null;
  readonly decorationThicknessFactor?:number;readonly decorationThicknessDelta?:number;
  readonly fontFamily?:string|null;readonly fontFamilyFallback?:readonly string[]|null;readonly package?:string|null;
  readonly fontSizeFactor?:number;readonly fontSizeDelta?:number;readonly fontWeightDelta?:number;readonly fontStyle?:FontStyle|null;
  readonly letterSpacingFactor?:number;readonly letterSpacingDelta?:number;readonly wordSpacingFactor?:number;readonly wordSpacingDelta?:number;readonly heightFactor?:number;readonly heightDelta?:number;
  readonly textBaseline?:TextBaseline|null;readonly leadingDistribution?:TextLeadingDistribution|null;readonly locale?:string|null;
  readonly shadows?:readonly Shadow[]|null;readonly fontFeatures?:readonly FontFeature[]|null;readonly fontVariations?:readonly FontVariation[]|null;readonly overflow?:TextOverflow|null;
}
export interface TextStyleParagraphOptions {
  readonly textAlign?:TextAlign|null;readonly textDirection?:'ltr'|'rtl'|null;readonly textScaler?:TextScaler;readonly ellipsis?:string|null;readonly maxLines?:number|null;
  readonly textHeightBehavior?:TextHeightBehavior|null;readonly hyphens?:Hyphens|null;readonly locale?:string|null;
  readonly fontFamily?:string|null;readonly fontSize?:number|null;readonly fontWeight?:FontWeight|null;readonly fontStyle?:FontStyle|null;readonly height?:number|null;readonly strutStyle?:StrutStyle|null;
}
const ordinaryFields=['fontSize','fontWeight','fontStyle','letterSpacing','wordSpacing','textBaseline','height','leadingDistribution','locale','foreground','background','shadows','fontFeatures','fontVariations','decoration','decorationColor','decorationStyle','decorationThickness','overflow'] as const;
const layoutFields=['inherit','fontFamily','fontSize','fontStyle','letterSpacing','wordSpacing','textBaseline','height','leadingDistribution','locale','foreground','background','overflow'] as const;
const paintFields=['color','backgroundColor','decorationColor','decorationStyle','decorationThickness'] as const;
const paintIdentities=new WeakMap<Paint,number>();let nextPaintIdentity=0;
const unscaledRuns=new WeakMap<TextStyle,TextRunStyle>();
// One recent result per live base value; pairs of long-lived theme styles do
// not grow a cross-product cache, and retired base values keep no cache owner.
const mergedStyles=new WeakMap<TextStyle,{other:TextStyle;debug:boolean;style:TextStyle}>();
function paintIdentity(paint:Paint|null):number|null{if(paint===null)return null;let id=paintIdentities.get(paint);if(id===undefined){id=++nextPaintIdentity;paintIdentities.set(paint,id);}return id;}
function listEquals<T>(a:readonly T[]|null,b:readonly T[]|null,equal:(left:T,right:T)=>boolean):boolean{return a===b||a!==null&&b!==null&&a.length===b.length&&a.every((value,index)=>equal(value,b[index]!));}
/** ARGB numbers and immutable list snapshots are Nelyx's value adapters; Paint keeps source identity. */
export class TextStyle extends Diagnosticable(class {}) {
  readonly inherit:boolean;readonly color:number|null;readonly backgroundColor:number|null;
  readonly fontFamily:string|null;private readonly rawFontFamily:string|null;private readonly rawFontFamilyFallback:readonly string[]|null;private readonly packageName:string|null;
  readonly fontSize:number|null;readonly fontWeight:FontWeight|null;readonly fontStyle:FontStyle|null;readonly letterSpacing:number|null;readonly wordSpacing:number|null;readonly textBaseline:TextBaseline|null;
  readonly height:number|null;readonly leadingDistribution:TextLeadingDistribution|null;readonly locale:string|null;
  readonly foreground:Paint|null;readonly background:Paint|null;readonly shadows:readonly Shadow[]|null;
  readonly decoration:TextDecoration|null;readonly decorationColor:number|null;readonly decorationThickness:number|null;readonly decorationStyle:TextDecorationStyle|null;
  readonly fontFeatures:readonly FontFeature[]|null;readonly fontVariations:readonly FontVariation[]|null;readonly debugLabel:string|null;readonly overflow:TextOverflow|null;
  constructor(o:TextStyleOptions={}){
    super();this.inherit=o.inherit??true;invariant(typeof this.inherit==='boolean','invalid-text-style','TextStyle inherit must be boolean');
    this.color=o.color??null;this.backgroundColor=o.backgroundColor??null;this.packageName=o.package??null;
    // The pinned constructor interpolates a null family as the literal "null" when package is specified.
    this.fontFamily=this.packageName===null?o.fontFamily??null:`packages/${this.packageName}/${o.fontFamily??null}`;
    this.rawFontFamily=this.packageName===null?this.fontFamily:this.fontFamily!.slice(`packages/${this.packageName}/`.length);
    this.rawFontFamilyFallback=o.fontFamilyFallback?Object.freeze([...o.fontFamilyFallback]):null;
    this.fontSize=o.fontSize??null;this.fontWeight=o.fontWeight??null;this.fontStyle=o.fontStyle??null;
    this.letterSpacing=o.letterSpacing??null;this.wordSpacing=o.wordSpacing??null;this.textBaseline=o.textBaseline??null;this.height=o.height??null;this.leadingDistribution=o.leadingDistribution??null;this.locale=o.locale??null;
    this.foreground=o.foreground??null;this.background=o.background??null;
    invariant((this.foreground===null||this.foreground instanceof Paint)&&(this.background===null||this.background instanceof Paint),'invalid-text-style','Text foreground/background must be Paint');
    if(FoundationBuildMode.debug){assertPaintColors(this.color,this.foreground,this.backgroundColor,this.background);invariant(this.height===null||!Number.isNaN(this.height),'invalid-text-style','TextStyle.height must not be NaN');}
    this.shadows=o.shadows?Object.freeze(o.shadows.map(s=>Object.freeze(new Shadow({color:s.color,offset:{x:s.offset.x,y:s.offset.y},blurRadius:s.blurRadius})))):null;
    this.fontFeatures=o.fontFeatures?Object.freeze([...o.fontFeatures]):null;this.fontVariations=o.fontVariations?Object.freeze([...o.fontVariations]):null;
    this.decoration=o.decoration??null;this.decorationColor=o.decorationColor??null;this.decorationThickness=o.decorationThickness??null;this.decorationStyle=o.decorationStyle??null;
    this.debugLabel=o.debugLabel??null;this.overflow=o.overflow??null;
    invariant(this.packageName===null||typeof this.packageName==='string'&&!this.packageName.includes('\0'),'invalid-text-style','Invalid font package');
    invariant(this.debugLabel===null||typeof this.debugLabel==='string','invalid-text-style','Invalid debug label');
    invariant(this.overflow===null||['clip','fade','ellipsis','visible'].includes(this.overflow),'invalid-text-style','Invalid text overflow');
    const run=TextStyle.snapshotRunStyle(this,TextScaler.noScaling);
    // The validated immutable adapter remains owned by this value. Borrowed
    // Paint and custom scalers still take a fresh snapshot at every run boundary.
    if(new.target===TextStyle&&this.foreground===null&&this.background===null&&isOwnedTypographyValue(this.fontWeight)&&isOwnedTypographyValue(this.decoration)&&this.fontFeatures?.every(isOwnedTypographyValue)!==false&&this.fontVariations?.every(isOwnedTypographyValue)!==false)unscaledRuns.set(this,run);
    // As with TextSpan/StrutStyle, exact immutable values need one freeze,
    // while derived styles must still be able to initialize their own fields.
    if(new.target===TextStyle)Object.freeze(this);else protect(this,Object.keys(this));
  }
  get fontFamilyFallback():readonly string[]|null{return this.packageName===null?this.rawFontFamilyFallback:this.rawFontFamilyFallback?.map(value=>`packages/${this.packageName}/${value}`)??null;}
  private options():TextStyleOptions{return {
    inherit:this.inherit,color:this.color,backgroundColor:this.backgroundColor,fontFamily:this.rawFontFamily,fontFamilyFallback:this.rawFontFamilyFallback,package:this.packageName,debugLabel:this.debugLabel,
    fontSize:this.fontSize,fontWeight:this.fontWeight,fontStyle:this.fontStyle,letterSpacing:this.letterSpacing,wordSpacing:this.wordSpacing,textBaseline:this.textBaseline,height:this.height,
    leadingDistribution:this.leadingDistribution,locale:this.locale,foreground:this.foreground,background:this.background,shadows:this.shadows,fontFeatures:this.fontFeatures,fontVariations:this.fontVariations,
    decoration:this.decoration,decorationColor:this.decorationColor,decorationStyle:this.decorationStyle,decorationThickness:this.decorationThickness,overflow:this.overflow
  };}
  copyWith(o:TextStyleOptions={}):TextStyle {
    if(FoundationBuildMode.debug)assertPaintColors(o.color??null,o.foreground??null,o.backgroundColor??null,o.background??null);
    const original=this.options(),result={...original};
    for(const key of Object.keys(original) as (keyof TextStyleOptions)[])if(o[key]!=null)(result as Record<string,unknown>)[key]=o[key];
    result.color=this.foreground===null&&o.foreground==null?o.color??this.color:null;
    result.backgroundColor=this.background===null&&o.background==null?o.backgroundColor??this.backgroundColor:null;
    result.debugLabel=FoundationBuildMode.debug?o.debugLabel??(this.debugLabel===null?null:`(${this.debugLabel}).copyWith`):null;
    return new TextStyle(result);
  }
  apply(o:TextStyleApplyOptions={}):TextStyle {
    const fontSizeFactor=o.fontSizeFactor??1,fontSizeDelta=o.fontSizeDelta??0,fontWeightDelta=o.fontWeightDelta??0;
    const letterSpacingFactor=o.letterSpacingFactor??1,letterSpacingDelta=o.letterSpacingDelta??0,wordSpacingFactor=o.wordSpacingFactor??1,wordSpacingDelta=o.wordSpacingDelta??0;
    const decorationThicknessFactor=o.decorationThicknessFactor??1,decorationThicknessDelta=o.decorationThicknessDelta??0,heightFactor=o.heightFactor??1,heightDelta=o.heightDelta??0;
    invariant(Number.isSafeInteger(fontWeightDelta),'invalid-font-weight','fontWeightDelta must be an exact integer');
    if(FoundationBuildMode.debug){for(const [value,factor,delta] of [[this.fontSize,fontSizeFactor,fontSizeDelta],[this.letterSpacing,letterSpacingFactor,letterSpacingDelta],[this.wordSpacing,wordSpacingFactor,wordSpacingDelta],[this.decorationThickness,decorationThicknessFactor,decorationThicknessDelta]])invariant(value!==null||factor===1&&delta===0,'unspecified-text-style-value','Cannot apply factor/delta to an unspecified text value');invariant(this.fontWeight!==null||fontWeightDelta===0,'unspecified-text-style-value','Cannot apply delta to an unspecified font weight');}
    const modified=(value:number|null,factor:number,delta:number)=>value===null?null:value*factor+delta;
    return new TextStyle({...this.options(),color:this.foreground===null?o.color??this.color:null,backgroundColor:this.background===null?o.backgroundColor??this.backgroundColor:null,
      fontFamily:o.fontFamily??this.rawFontFamily,fontFamilyFallback:o.fontFamilyFallback??this.rawFontFamilyFallback,package:o.package??this.packageName,
      fontSize:modified(this.fontSize,fontSizeFactor,fontSizeDelta),fontWeight:this.fontWeight===null?null:FontWeight.values[Math.min(8,Math.max(0,this.fontWeight.index+fontWeightDelta))]!,fontStyle:o.fontStyle??this.fontStyle,
      letterSpacing:modified(this.letterSpacing,letterSpacingFactor,letterSpacingDelta),wordSpacing:modified(this.wordSpacing,wordSpacingFactor,wordSpacingDelta),
      height:this.height===null||this.height===kTextHeightNone?this.height:modified(this.height,heightFactor,heightDelta),textBaseline:o.textBaseline??this.textBaseline,leadingDistribution:o.leadingDistribution??this.leadingDistribution,locale:o.locale??this.locale,
      shadows:o.shadows??this.shadows,fontFeatures:o.fontFeatures??this.fontFeatures,fontVariations:o.fontVariations??this.fontVariations,decoration:o.decoration??this.decoration,decorationColor:o.decorationColor??this.decorationColor,decorationStyle:o.decorationStyle??this.decorationStyle,decorationThickness:modified(this.decorationThickness,decorationThicknessFactor,decorationThicknessDelta),overflow:o.overflow??this.overflow,
      debugLabel:FoundationBuildMode.debug&&this.debugLabel!==null?`(${this.debugLabel}).apply`:null});
  }
  merge(other:TextStyle|null|undefined):TextStyle {
    if(!other)return this;if(!other.inherit)return other;
    const shared=this.constructor===TextStyle&&other.constructor===TextStyle;
    const previous=shared?mergedStyles.get(this):undefined;if(previous?.other===other&&previous.debug===FoundationBuildMode.debug)return previous.style;
    const {inherit:_inherit,...options}=other.options();
    options.debugLabel=FoundationBuildMode.debug&&(this.debugLabel!==null||other.debugLabel!==null)?`(${this.debugLabel??'unknown'}).merge(${other.debugLabel??'unknown'})`:null;
    const result=this.copyWith(options);
    if(shared)mergedStyles.set(this,{other,debug:FoundationBuildMode.debug,style:result});
    return result;
  }
  static lerp(a:TextStyle|null,b:TextStyle|null,t:number):TextStyle|null {
    if(a===b)return a;
    const selected=t<.5?a:b,debugLabel=FoundationBuildMode.debug?`lerp(${a?.debugLabel??'unknown'} ⎯${fixed(t)}→ ${b?.debugLabel??'unknown'})`:null;
    if(a===null||b===null){const value=(a??b)!;return new TextStyle({inherit:value.inherit,color:colorLerp(a?.color??null,b?.color??null,t),backgroundColor:a===null?colorLerp(null,b!.backgroundColor,t):colorLerp(null,a.backgroundColor,t),fontWeight:FontWeight.lerp(a?.fontWeight??null,b?.fontWeight??null,t),fontVariations:lerpFontVariations(a?.fontVariations??null,b?.fontVariations??null,t),decorationColor:colorLerp(a?.decorationColor??null,b?.decorationColor??null,t),...TextStyle.stepFields(selected),debugLabel});}
    if(FoundationBuildMode.debug&&a.inherit!==b.inherit){const fields=['fontSize','letterSpacing','wordSpacing','height','decorationColor','decorationThickness'] as const;invariant((a.foreground!==null||b.foreground!==null||a.color!==null||b.color!==null)&&(a.background!==null||b.background!==null||a.backgroundColor!==null||b.backgroundColor!==null)&&fields.every(field=>a[field]!==null||b[field]!==null),'incompatible-text-style-inherit','TextStyle.lerp cannot change inherit while numeric/color fields are unspecified in both styles');}
    const foreground=a.foreground!==null||b.foreground!==null?selected!.foreground??paintFromColor(selected!.color):null;
    const background=a.background!==null||b.background!==null?selected!.background??paintFromColor(selected!.backgroundColor):null;
    return new TextStyle({inherit:selected!.inherit,...TextStyle.stepFields(selected),color:foreground===null?colorLerp(a.color,b.color,t):null,backgroundColor:background===null?colorLerp(a.backgroundColor,b.backgroundColor,t):null,foreground,background,fontWeight:FontWeight.lerp(a.fontWeight,b.fontWeight,t),fontSize:styleNumberLerp(a.fontSize,b.fontSize,t),letterSpacing:styleNumberLerp(a.letterSpacing,b.letterSpacing,t),wordSpacing:styleNumberLerp(a.wordSpacing,b.wordSpacing,t),height:styleNumberLerp(a.height,b.height,t),decorationThickness:styleNumberLerp(a.decorationThickness,b.decorationThickness,t),decorationColor:colorLerp(a.decorationColor,b.decorationColor,t),shadows:Shadow.lerpList(a.shadows,b.shadows,t),fontVariations:lerpFontVariations(a.fontVariations,b.fontVariations,t),debugLabel});
  }
  private static stepFields(style:TextStyle|null):TextStyleOptions{return {fontSize:style?.fontSize??null,fontStyle:style?.fontStyle??null,letterSpacing:style?.letterSpacing??null,wordSpacing:style?.wordSpacing??null,textBaseline:style?.textBaseline??null,height:style?.height??null,leadingDistribution:style?.leadingDistribution??null,locale:style?.locale??null,foreground:style?.foreground??null,background:style?.background??null,shadows:style?.shadows??null,fontFeatures:style?.fontFeatures??null,decoration:style?.decoration??null,decorationStyle:style?.decorationStyle??null,decorationThickness:style?.decorationThickness??null,fontFamily:style?.rawFontFamily??null,fontFamilyFallback:style?.rawFontFamilyFallback??null,package:style?.packageName??null,overflow:style?.overflow??null};}
  /** Snapshot mutable Paint only at this boundary, before a paragraph is built. */
  toRunStyle(scaler:TextScaler=TextScaler.noScaling):TextRunStyle{return scaler===TextScaler.noScaling?unscaledRuns.get(this)??TextStyle.snapshotRunStyle(this,scaler):TextStyle.snapshotRunStyle(this,scaler);}
  private static snapshotRunStyle(style:TextStyle,scaler:TextScaler):TextRunStyle {
    const fallback=style.packageName===null?style.rawFontFamilyFallback:style.rawFontFamilyFallback?.map(value=>`packages/${style.packageName}/${value}`)??null;
    return freezeRunStyle({...(style.foreground!==null?{foreground:style.foreground.snapshot()}:style.color!==null?{color:style.color}:undefined),...(style.background!==null?{background:style.background.snapshot()}:style.backgroundColor!==null?{backgroundColor:style.backgroundColor}:undefined),
      ...(style.fontFamily!==null||fallback!==null?{fontFamilies:[...(style.fontFamily!==null?[style.fontFamily]:[]),...(fallback??[])]}:undefined),...(style.fontSize!==null?{fontSize:scaler.scale(style.fontSize)}:undefined),...(style.fontWeight?{fontWeight:style.fontWeight.value}:undefined),...(style.fontStyle?{fontStyle:style.fontStyle}:undefined),...(style.textBaseline?{textBaseline:style.textBaseline}:undefined),
      ...(style.letterSpacing!==null?{letterSpacing:style.letterSpacing}:undefined),...(style.wordSpacing!==null?{wordSpacing:style.wordSpacing}:undefined),...(style.height!==null?{height:style.height}:undefined),...(style.leadingDistribution?{leadingDistribution:style.leadingDistribution}:undefined),...(style.locale!==null?{locale:style.locale}:undefined),
      ...(style.decoration?{decoration:style.decoration.mask}:undefined),...(style.decorationColor!==null?{decorationColor:style.decorationColor}:undefined),...(style.decorationThickness!==null?{decorationThickness:style.decorationThickness}:undefined),...(style.decorationStyle?{decorationStyle:style.decorationStyle}:undefined),...(style.fontFeatures?{fontFeatures:style.fontFeatures.map(f=>({name:f.feature,value:f.value}))}:undefined),...(style.fontVariations?{fontVariations:style.fontVariations.map(f=>({axis:f.axis,value:f.value}))}:undefined),...(style.shadows?{shadows:style.shadows.map(s=>({color:s.color,offset:s.offset,blurSigma:s.blurSigma}))}:undefined)});
  }
  getTextStyle({textScaleFactor=1,textScaler=TextScaler.noScaling}:{readonly textScaleFactor?:number;readonly textScaler?:TextScaler}={}):TextRunStyle {
    if(FoundationBuildMode.debug)invariant(textScaler===TextScaler.noScaling||textScaleFactor===1,'ambiguous-text-scale','textScaleFactor cannot be specified with textScaler');
    const run=this.toRunStyle(textScaler===TextScaler.noScaling?TextScaler.linear(textScaleFactor):textScaler);
    if(run.backgroundColor===undefined)return run;
    const {backgroundColor,...rest}=run;return freezeRunStyle({...rest,background:new Paint({color:backgroundColor}).snapshot()});
  }
  getParagraphStyle(o:TextStyleParagraphOptions={}):ParagraphStyle {
    const scaler=o.textScaler??TextScaler.noScaling;
    return new ParagraphStyle({textAlign:o.textAlign??null,textDirection:o.textDirection??null,fontWeight:o.fontWeight??this.fontWeight,fontStyle:o.fontStyle??this.fontStyle,fontFamily:o.fontFamily??this.fontFamily,fontSize:scaler.scale(o.fontSize??this.fontSize??14),height:o.height??this.height,textHeightBehavior:o.textHeightBehavior??(this.leadingDistribution===null?null:new TextHeightBehavior({leadingDistribution:this.leadingDistribution})),hyphens:o.hyphens??null,strutStyle:o.strutStyle?.toStyle(scaler)??null,maxLines:o.maxLines??null,ellipsis:o.ellipsis??null,locale:o.locale??null});
  }
  compareTo(other:TextStyle):RenderComparison {
    if(this===other)return RenderComparison.identical;
    if(layoutFields.some(field=>this[field]!==other[field])||this.fontWeight?.value!==other.fontWeight?.value||!this.equalLists(other))return RenderComparison.layout;
    if(paintFields.some(field=>this[field]!==other[field])||this.decoration?.mask!==other.decoration?.mask)return RenderComparison.paint;
    return RenderComparison.identical;
  }
  private equalLists(other:TextStyle):boolean{return listEquals(this.fontFamilyFallback,other.fontFamilyFallback,(a,b)=>a===b)&&listEquals(this.shadows,other.shadows,(a,b)=>a.equals(b))&&listEquals(this.fontFeatures,other.fontFeatures,(a,b)=>a.feature===b.feature&&a.value===b.value)&&listEquals(this.fontVariations,other.fontVariations,(a,b)=>a.axis===b.axis&&a.value===b.value);}
  equals(other:unknown):boolean{return this===other||other instanceof TextStyle&&other.constructor===this.constructor&&this.packageName===other.packageName&&this.compareTo(other)===RenderComparison.identical;}
  /** Stable local value hash; Dart VM's randomized Object.hash is not a wire contract. */
  get hashCode():number {
    const value=[...layoutFields.map(field=>field==='foreground'?paintIdentity(this.foreground):field==='background'?paintIdentity(this.background):this[field]),...paintFields.map(field=>this[field]),this.fontWeight?.value??null,this.decoration?.mask??null,this.fontFamilyFallback,this.packageName,this.shadows?.map(s=>[s.color,s.offset.x,s.offset.y,s.blurRadius])??null,this.fontFeatures?.map(f=>[f.feature,f.value])??null,this.fontVariations?.map(f=>[f.axis,f.value])??null];
    let hash=2166136261;for(const c of JSON.stringify(value))hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;
  }
  override toStringShort():string{return objectRuntimeType(this,'TextStyle');}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder,{prefix=''}:{readonly prefix?:string}={}):void {
    super.debugFillProperties(properties);if(this.debugLabel!==null)properties.add(new MessageProperty(prefix+'debugLabel',this.debugLabel));
    const colorProperty=(name:string,value:number|null,level?:'fine')=>new DiagnosticsProperty(prefix+name,value===null?null:new Color(value),{defaultValue:null,typeName:'Color',...(level?{level}:{})});
    const styles:DiagnosticsNode[]=[colorProperty('color',this.color),colorProperty('backgroundColor',this.backgroundColor),new StringProperty(prefix+'family',this.fontFamily,{defaultValue:null,quoted:false}),new IterableProperty(prefix+'familyFallback',this.fontFamilyFallback,{defaultValue:null,elementType:'String'}),new DoubleProperty(prefix+'size',this.fontSize,{defaultValue:null}),new DiagnosticsProperty(prefix+'weight',this.fontWeight,{defaultValue:null,...this.fontWeight?{description:String((this.fontWeight.index+1)*100)}:{}}),new EnumProperty(prefix+'style',this.fontStyle,{defaultValue:null}),new DoubleProperty(prefix+'letterSpacing',this.letterSpacing,{defaultValue:null}),new DoubleProperty(prefix+'wordSpacing',this.wordSpacing,{defaultValue:null}),new EnumProperty(prefix+'baseline',this.textBaseline,{defaultValue:null}),new DoubleProperty(prefix+'height',this.height,{unit:'x',defaultValue:null}),new EnumProperty(prefix+'leadingDistribution',this.leadingDistribution,{defaultValue:null}),new DiagnosticsProperty(prefix+'locale',this.locale,{defaultValue:null}),new DiagnosticsProperty(prefix+'foreground',this.foreground,{defaultValue:null}),new DiagnosticsProperty(prefix+'background',this.background,{defaultValue:null})];
    if(this.decoration!==null||this.decorationColor!==null||this.decorationStyle!==null||this.decorationThickness!==null){const description:string[]=[];if(this.decorationStyle!==null)description.push(this.decorationStyle);styles.push(colorProperty('decorationColor',this.decorationColor,'fine'));if(this.decorationColor!==null)description.push(String(new Color(this.decorationColor)));styles.push(new DiagnosticsProperty(prefix+'decoration',this.decoration,{defaultValue:null,level:'hidden'}));if(this.decoration!==null){const names=['underline','overline','lineThrough'].filter((_name,index)=>(this.decoration!.mask&(1<<index))!==0);description.push(names.length===0?'TextDecoration.none':names.length===1?'TextDecoration.'+names[0]:'TextDecoration.combine(['+names.map(name=>'TextDecoration.'+name).join(', ')+'])');}if(FoundationBuildMode.debug)invariant(description.length>0,'empty-decoration-description','Pinned TextStyle decoration summary is empty');styles.push(new MessageProperty(prefix+'decoration',description.join(' ')),new DoubleProperty(prefix+'decorationThickness',this.decorationThickness,{unit:'x',defaultValue:null}));}
    const specified=styles.some(node=>!node.isFiltered('info'));properties.add(new DiagnosticsProperty(prefix+'inherit',this.inherit,{level:!specified&&this.inherit?'fine':'info'}));for(const node of styles)properties.add(node);
    if(!specified)properties.add(new FlagProperty('inherit',this.inherit,{ifTrue:prefix+'<all styles inherited>',ifFalse:prefix+'<no style specified>'}));
    // The pinned source appends overflow to its local list after copying it to properties.
  }
}
function assertPaintColors(color:number|null,foreground:Paint|null,backgroundColor:number|null,background:Paint|null):void{invariant(color===null||foreground===null,'ambiguous-text-paint','Cannot provide both color and foreground');invariant(backgroundColor===null||background===null,'ambiguous-text-paint','Cannot provide both backgroundColor and background');}
function paintFromColor(color:number|null):Paint{invariant(color!==null,'missing-text-paint-color','Pinned TextStyle.lerp requires the selected color when adapting to Paint');return new Paint({color});}
function colorLerp(a:number|null,b:number|null,t:number):number|null{return Color.lerp(a===null?null:new Color(a),b===null?null:new Color(b),t)?.toARGB32()??null;}
function styleNumberLerp(a:number|null,b:number|null,t:number):number|null{a??=b;b??=a;if(a===b)return a;invariant(a!==null&&b!==null&&Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(t),'invalid-text-style-lerp','Text style interpolation requires finite unequal values');return a*(1-t)+b*t;}
/** Axis map fallback preserves all axes; order is an explicit insertion-order adapter for Dart HashSet. */
export function lerpFontVariations(a:readonly FontVariation[]|null,b:readonly FontVariation[]|null,t:number):readonly FontVariation[]|null {
  if(t===0)return a;if(t===1)return b;if(!a?.length||!b?.length)return t<.5?a:b;
  const result:FontVariation[]=[];let index=0;const min=Math.min(a.length,b.length);
  for(;index<min;index++){if(a[index]!.axis!==b[index]!.axis)break;result.push(FontVariation.lerp(a[index]!,b[index]!,t)!);}
  if(index<Math.max(a.length,b.length)){
    const axes=new Set<string>(),left=new Map<string,FontVariation>(),right=new Map<string,FontVariation>();
    for(let i=index;i<a.length;i++){left.set(a[i]!.axis,a[i]!);axes.add(a[i]!.axis);}for(let i=index;i<b.length;i++){right.set(b[i]!.axis,b[i]!);axes.add(b[i]!.axis);}
    for(const axis of axes){const value=FontVariation.lerp(left.get(axis)??null,right.get(axis)??null,t);if(value!==null)result.push(value);}
  }return result;
}
