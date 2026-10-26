// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Selected dart:ui text value contracts at the recorded pin.
import {invariant} from '../foundation/errors.ts';
import {protect,hashDoubles,checkedInteger} from './value-math.ts';
export type TextAlign='left'|'right'|'center'|'justify'|'start'|'end';
export type FontStyle='normal'|'italic';
export type TextLeadingDistribution='proportional'|'even';
export type TextDecorationStyle='solid'|'double'|'dotted'|'dashed'|'wavy';
export type PlaceholderAlignment='baseline'|'aboveBaseline'|'belowBaseline'|'top'|'bottom'|'middle';
export type TextBaseline='alphabetic'|'ideographic';
export const Hyphens=Object.freeze({manual:'manual',hidden:'hidden'} as const);
export type Hyphens=typeof Hyphens[keyof typeof Hyphens];
export const kTextHeightNone=0;
const ownedTypographyValues=new WeakSet<object>();
/** @internal Only these constructors establish immutable typography ownership. */
export function isOwnedTypographyValue(value:object|null):boolean{return value===null||ownedTypographyValues.has(value);}
export class FontWeight {
  static readonly w100=new FontWeight(100);static readonly w200=new FontWeight(200);static readonly w300=new FontWeight(300);static readonly w400=new FontWeight(400);static readonly w500=new FontWeight(500);static readonly w600=new FontWeight(600);static readonly w700=new FontWeight(700);static readonly w800=new FontWeight(800);static readonly w900=new FontWeight(900);
  static readonly normal=FontWeight.w400;static readonly bold=FontWeight.w700;
  static readonly values=Object.freeze([FontWeight.w100,FontWeight.w200,FontWeight.w300,FontWeight.w400,FontWeight.w500,FontWeight.w600,FontWeight.w700,FontWeight.w800,FontWeight.w900]);
  constructor(readonly value:number){invariant(Number.isInteger(value)&&value>=1&&value<=1000,'invalid-font-weight','Font weight must be an integer1..1000');Object.freeze(this);ownedTypographyValues.add(this);}
  static lerp(a:FontWeight|null,b:FontWeight|null,t:number):FontWeight|null{if(a===null&&b===null)return null;invariant(Number.isFinite(t),'invalid-lerp','Font weight interpolation must be finite');const begin=(a??FontWeight.normal).value,value=begin+((b??FontWeight.normal).value-begin)*t;return new FontWeight(Math.min(900,Math.max(100,Math.round(value))));}
  /** @deprecated Use value, which is more precise. */
  get index():number{return Math.max(0,Math.min(8,Math.trunc(this.value/100)-1));}
  equals(other:unknown):boolean{return other instanceof FontWeight&&other.value===this.value;}
  toString():string{return this.value%100===0?'FontWeight.w'+FontWeight.values[this.index]!.value:`FontWeight(${this.value})`;}
}
function tag(value:string):void{invariant(/^[\x20-\x7e]{4}$/.test(value),'invalid-font-tag','OpenType tag must contain four printable ASCII characters');}
export class FontFeature {
  constructor(readonly feature:string,readonly value=1){tag(feature);invariant(Number.isInteger(value)&&value>=0&&value<=0xffffffff,'invalid-font-feature','Font feature value must be uint32');Object.freeze(this);ownedTypographyValues.add(this);}
  static enable(feature:string):FontFeature{return new FontFeature(feature);}
  static disable(feature:string):FontFeature{return new FontFeature(feature,0);}
  static tabularFigures():FontFeature{return new FontFeature('tnum');}
  static proportionalFigures():FontFeature{return new FontFeature('pnum');}
  static stylisticSet(value:number):FontFeature{invariant(Number.isInteger(value)&&value>=1&&value<=20,'invalid-font-feature','Stylistic set must be1..20');return new FontFeature('ss'+String(value).padStart(2,'0'));}
}
export class FontVariation {
  constructor(readonly axis:string,readonly value:number){tag(axis);invariant(Number.isFinite(value),'invalid-font-variation','Font variation must be finite');Object.freeze(this);ownedTypographyValues.add(this);}
  static lerp(a:FontVariation|null,b:FontVariation|null,t:number):FontVariation|null{if(a?.axis!==b?.axis||a===null&&b===null)return t<.5?a:b;const value=a!.value===b!.value?a!.value:a!.value*(1-t)+b!.value*t;return new FontVariation(a!.axis,Math.min(32768-1/65536,Math.max(-32768,value)));}
  static weight(value:number):FontVariation{invariant(value>=1&&value<=1000,'invalid-font-variation','Weight axis must be1..1000');return new FontVariation('wght',value);}
  static width(value:number):FontVariation{invariant(value>=0,'invalid-font-variation','Width axis must be nonnegative');return new FontVariation('wdth',value);}
  static opticalSize(value:number):FontVariation{invariant(value>0,'invalid-font-variation','Optical size must be positive');return new FontVariation('opsz',value);}
}
export class TextDecoration {
  static readonly none=new TextDecoration(0);static readonly underline=new TextDecoration(1);static readonly overline=new TextDecoration(2);static readonly lineThrough=new TextDecoration(4);
  private constructor(readonly mask:number){Object.freeze(this);ownedTypographyValues.add(this);}
  static combine(values:Iterable<TextDecoration>):TextDecoration{let mask=0;for(const value of values)mask|=value.mask;return new TextDecoration(mask);}
  contains(other:TextDecoration):boolean{return (this.mask&other.mask)===other.mask;}
}
export class TextHeightBehavior {
  readonly applyHeightToFirstAscent:boolean;readonly applyHeightToLastDescent:boolean;readonly leadingDistribution:TextLeadingDistribution;
  constructor({applyHeightToFirstAscent=true,applyHeightToLastDescent=true,leadingDistribution='proportional'}:{readonly applyHeightToFirstAscent?:boolean;readonly applyHeightToLastDescent?:boolean;readonly leadingDistribution?:TextLeadingDistribution}={}){invariant(typeof applyHeightToFirstAscent==='boolean'&&typeof applyHeightToLastDescent==='boolean'&&['proportional','even'].includes(leadingDistribution),'invalid-text-height','Invalid text height behavior');this.applyHeightToFirstAscent=applyHeightToFirstAscent;this.applyHeightToLastDescent=applyHeightToLastDescent;this.leadingDistribution=leadingDistribution;if(new.target===TextHeightBehavior){Object.freeze(this);ownedTypographyValues.add(this);}else protect(this,['applyHeightToFirstAscent','applyHeightToLastDescent','leadingDistribution']);}
  /** @internal Native paragraph flag representation excludes leading distribution. */
  static _fromEncoded(encoded:number,leadingDistribution:TextLeadingDistribution):TextHeightBehavior{checkedInteger(encoded);return new TextHeightBehavior({applyHeightToFirstAscent:(encoded&1)===0,applyHeightToLastDescent:(encoded&2)===0,leadingDistribution});}
  _encode():number{return (this.applyHeightToFirstAscent?0:1)|(this.applyHeightToLastDescent?0:2);}
  equals(other:unknown):boolean{return other instanceof TextHeightBehavior&&other.constructor===this.constructor&&other.applyHeightToFirstAscent===this.applyHeightToFirstAscent&&other.applyHeightToLastDescent===this.applyHeightToLastDescent&&other.leadingDistribution===this.leadingDistribution;}
  get hashCode():number{return hashDoubles([this.applyHeightToFirstAscent?1:0,this.applyHeightToLastDescent?1:0,this.leadingDistribution==='proportional'?0:1]);}
  toString():string{return `TextHeightBehavior(applyHeightToFirstAscent: ${this.applyHeightToFirstAscent}, applyHeightToLastDescent: ${this.applyHeightToLastDescent}, leadingDistribution: TextLeadingDistribution.${this.leadingDistribution})`;}
}
