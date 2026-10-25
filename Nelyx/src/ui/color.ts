// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Value/color transforms from dart:ui painting.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {FoundationBuildMode} from '../foundation/constants.ts';
import {invariant} from '../foundation/errors.ts';
import {clampDouble} from './math.ts';
import {hashDoubles,lerp} from './value-math.ts';

export class ColorSpace {
  static readonly sRGB=new ColorSpace(0,'sRGB');
  static readonly extendedSRGB=new ColorSpace(1,'extendedSRGB');
  static readonly displayP3=new ColorSpace(2,'displayP3');
  static readonly values=Object.freeze([this.sRGB,this.extendedSRGB,this.displayP3]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  toString():string{return `ColorSpace.${this.name}`;}
}
export interface ColorComponents {readonly alpha:number;readonly red:number;readonly green:number;readonly blue:number;readonly colorSpace?:ColorSpace}
export interface ColorValues {readonly alpha?:number|null;readonly red?:number|null;readonly green?:number|null;readonly blue?:number|null;readonly colorSpace?:ColorSpace|null}
type IntegerComponent=number|bigint;
function byte(value:IntegerComponent):number {
  if(typeof value==='bigint')return Number(value&255n);
  if(!(Number.isSafeInteger(value)))invariant(false,'inexact-color-integer','Use bigint for color integers outside the exact number range');return value&255;
}
function round(value:number):number {
  if(!(Number.isFinite(value)))invariant(false,'nonfinite-integer-conversion','A non-finite double cannot be converted to an integer');
  return value<0?-Math.floor(-value+0.5):Math.floor(value+0.5);
}
function floatToByte(value:number):number{return clampDouble(round(value*255),0,255);}
const finalColorField=Object.freeze({writable:false,configurable:false});
const finalColorFields=Object.freeze({a:finalColorField,r:finalColorField,g:finalColorField,b:finalColorField,colorSpace:finalColorField});

/** Floating components retain color space and precision. toARGB32 is an explicit lossy conversion. */
export class Color {
  readonly a:number;readonly r:number;readonly g:number;readonly b:number;readonly colorSpace:ColorSpace;
  constructor(value:IntegerComponent){
    if(!(typeof value==='bigint'||Number.isSafeInteger(value)))invariant(false,'inexact-color-integer','Use bigint for color integers outside the exact number range');
    const bits=typeof value==='bigint'?Number(BigInt.asUintN(32,value)):value>>>0;
    this.a=(bits>>>24)/255;this.r=((bits>>>16)&255)/255;this.g=((bits>>>8)&255)/255;this.b=(bits&255)/255;this.colorSpace=ColorSpace.sRGB;
    Object.defineProperties(this,finalColorFields);
  }
  static from({alpha,red,green,blue,colorSpace=ColorSpace.sRGB}:ColorComponents):Color {
    // Define own values before installing the prototype, preserving the factory's
    // behavior even when a derived/prototype setter exists. Reuse the final field
    // layout instead of allocating five value descriptors for every interpolation.
    const color=Object.setPrototypeOf({a:alpha,r:red,g:green,b:blue,colorSpace},Color.prototype) as Color;
    Object.defineProperties(color,finalColorFields);return color;
  }
  static fromARGB(a:IntegerComponent,r:IntegerComponent,g:IntegerComponent,b:IntegerComponent):Color{return Color.from({alpha:byte(a)/255,red:byte(r)/255,green:byte(g)/255,blue:byte(b)/255});}
  static fromRGBO(r:IntegerComponent,g:IntegerComponent,b:IntegerComponent,opacity:number):Color{return Color.from({alpha:opacity,red:byte(r)/255,green:byte(g)/255,blue:byte(b)/255});}
  toARGB32():number{return ((floatToByte(this.a)<<24)|(floatToByte(this.r)<<16)|(floatToByte(this.g)<<8)|floatToByte(this.b))>>>0;}
  /** @deprecated Use floating components or explicit toARGB32(). */
  get value():number{return this.toARGB32();}
  get alpha():number{return this.value>>>24;}get opacity():number{return this.alpha/255;}
  get red():number{return this.value>>>16&255;}get green():number{return this.value>>>8&255;}get blue():number{return this.value&255;}
  withValues({alpha=null,red=null,green=null,blue=null,colorSpace=null}:ColorValues={}):Color {
    const updated=alpha!==null||red!==null||green!==null||blue!==null?Color.from({alpha:alpha??this.a,red:red??this.r,green:green??this.g,blue:blue??this.b,colorSpace:this.colorSpace}):this;
    return colorSpace!==null&&colorSpace!==this.colorSpace?transformColor(updated,colorSpace):updated;
  }
  withAlpha(a:IntegerComponent):Color{return Color.fromARGB(a,this.red,this.green,this.blue);}
  withOpacity(opacity:number):Color{if(FoundationBuildMode.debug){if(!(opacity>=0&&opacity<=1))invariant(false,'invalid-color-opacity','Opacity must be in [0,1]');}return this.withAlpha(round(255*opacity));}
  withRed(r:IntegerComponent):Color{return Color.fromARGB(this.alpha,r,this.green,this.blue);}
  withGreen(g:IntegerComponent):Color{return Color.fromARGB(this.alpha,this.red,g,this.blue);}
  withBlue(b:IntegerComponent):Color{return Color.fromARGB(this.alpha,this.red,this.green,b);}
  computeLuminance():number {
    if(FoundationBuildMode.debug){if(!(this.colorSpace!==ColorSpace.extendedSRGB))invariant(false,'extended-color-luminance','Source luminance does not accept extendedSRGB');}
    const linear=(v:number)=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);
    return 0.2126*linear(this.r)+0.7152*linear(this.g)+0.0722*linear(this.b);
  }
  static lerp(x:Color|null,y:Color|null,t:number):Color|null {
    if(FoundationBuildMode.debug){if(!(x?.colorSpace!==ColorSpace.extendedSRGB&&y?.colorSpace!==ColorSpace.extendedSRGB))invariant(false,'extended-color-lerp','Source Color.lerp does not accept extendedSRGB');}
    if(y===null)return x===null?null:x.withValues({alpha:clampDouble(x.a*(1-t),0,1)});
    if(x===null)return y.withValues({alpha:clampDouble(y.a*t,0,1)});
    const space=x.colorSpace===y.colorSpace?x.colorSpace:x.colorSpace===ColorSpace.displayP3||y.colorSpace===ColorSpace.displayP3?ColorSpace.displayP3:x.colorSpace;
    const a=x.colorSpace===y.colorSpace?x:x.withValues({colorSpace:space}),b=x.colorSpace===y.colorSpace?y:y.withValues({colorSpace:space});
    return Color.from({alpha:clampDouble(lerp(a.a,b.a,t),0,1),red:clampDouble(lerp(a.r,b.r,t),0,1),green:clampDouble(lerp(a.g,b.g,t),0,1),blue:clampDouble(lerp(a.b,b.b,t),0,1),colorSpace:space});
  }
  static alphaBlend(foreground:Color,background:Color):Color {
    if(FoundationBuildMode.debug){if(!(foreground.colorSpace===background.colorSpace&&foreground.colorSpace!==ColorSpace.extendedSRGB))invariant(false,'invalid-alpha-blend-space','Source alphaBlend requires equal non-extended color spaces');}
    const alpha=foreground.a;if(alpha===0)return background;
    const inverse=1-alpha,backAlpha=background.a===1?inverse:background.a*inverse,outAlpha=background.a===1?1:alpha+backAlpha;
    if(FoundationBuildMode.debug){if(!(outAlpha!==0))invariant(false,'zero-alpha-blend','Blended alpha must be nonzero');}
    return Color.from({alpha:outAlpha,red:(foreground.r*alpha+background.r*backAlpha)/outAlpha,green:(foreground.g*alpha+background.g*backAlpha)/outAlpha,blue:(foreground.b*alpha+background.b*backAlpha)/outAlpha,colorSpace:foreground.colorSpace});
  }
  static getAlphaFromOpacity(opacity:number):number{return round(clampDouble(opacity,0,1)*255);}
  equals(other:unknown):boolean{return this===other||other instanceof Color&&other.constructor===this.constructor&&other.a===this.a&&other.r===this.r&&other.g===this.g&&other.b===this.b&&other.colorSpace===this.colorSpace;}
  get hashCode():number{return hashDoubles([this.a,this.r,this.g,this.b,this.colorSpace.index]);}
  toString():string{const fixed=(v:number)=>Object.is(v,-0)?'-0.0000':v.toFixed(4);return `Color(alpha: ${fixed(this.a)}, red: ${fixed(this.r)}, green: ${fixed(this.g)}, blue: ${fixed(this.b)}, colorSpace: ${this.colorSpace})`;}
}

const p3ToSrgb=[1.2249401,-0.2249402,0,-0.0420569,1.0420571,0,-0.0196376,-0.0786507,1.0982884] as const;
const srgbToP3=[0.8224622,0.1775380,0,0.0331942,0.9668058,0,0.0170806,0.0723974,0.9105220] as const;
function eotf(v:number):number{return v<0?-eotf(-v):v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
function oetf(v:number):number{return v<0?-oetf(-v):v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055;}
function transformColor(color:Color,destination:ColorSpace):Color {
  const source=color.colorSpace;
  // Preserve this pin's _ClampTransform, including its unused child transform.
  // The identity transform likewise returns the original Color without relabeling.
  if(source===ColorSpace.extendedSRGB||source===ColorSpace.displayP3&&destination===ColorSpace.sRGB)return Color.from({alpha:clampDouble(color.a,0,1),red:clampDouble(color.r,0,1),green:clampDouble(color.g,0,1),blue:clampDouble(color.b,0,1),colorSpace:destination});
  if(source===ColorSpace.sRGB&&destination===ColorSpace.extendedSRGB)return color;
  const matrix=source===ColorSpace.displayP3?p3ToSrgb:srgbToP3,r=eotf(color.r),g=eotf(color.g),b=eotf(color.b);
  return Color.from({alpha:color.a,red:oetf(matrix[0]*r+matrix[1]*g+matrix[2]*b),green:oetf(matrix[3]*r+matrix[4]*g+matrix[5]*b),blue:oetf(matrix[6]*r+matrix[7]*g+matrix[8]*b),colorSpace:destination});
}
