// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter painting/gradient.dart.
import {invariant} from '../../foundation/errors.ts';
import {Gradient as UiGradient} from '../../ui/shader.ts';
import type {Shader} from '../../ui/shader.ts';
import type {Rect as RectInput} from '../../ui/types.ts';
import {Rect} from '../../ui/rect.ts';
import {Matrix4} from '../../math/matrix4.ts';
import type {TileMode} from '../../ui/paint-effects-data.ts';
import {lerpArgb,withArgbOpacity} from '../../ui/color-values.ts';
import {Alignment,AlignmentGeometry} from './alignment.ts';
import {valueEquals,listEquals,hashValues} from './value-equality.ts';
type Direction='ltr'|'rtl'|null;
export interface GradientShaderOptions {readonly textDirection?:Direction}
export interface GradientOptions {readonly colors:readonly number[];readonly stops?:readonly number[]|null;readonly transform?:GradientTransform|null}
class _ColorsAndStops {constructor(readonly colors:readonly number[],readonly stops:readonly number[]) {}}
function _sample(colors:readonly number[],stops:readonly number[],t:number):number {invariant(colors.length>0&&stops.length===colors.length,'invalid-gradient','Invalid gradient samples');if(t<=stops[0]!)return colors[0]!;if(t>=stops[stops.length-1]!)return colors[colors.length-1]!;let index=stops.length-1;while(index>=0&&stops[index]!>t)index--;invariant(index>=0&&index+1<colors.length,'invalid-gradient','Invalid gradient stop order');return lerpArgb(colors[index]!,colors[index+1]!, (t-stops[index]!)/(stops[index+1]!-stops[index]!))!;}
function _interpolateColorsAndStops(aColors:readonly number[],aStops:readonly number[],bColors:readonly number[],bStops:readonly number[],t:number):_ColorsAndStops {invariant(aColors.length>=2&&bColors.length>=2&&aColors.length===aStops.length&&bColors.length===bStops.length,'invalid-gradient','Gradient interpolation needs matching stops and two colors');const stops=[...new Set([...aStops,...bStops])].sort((a,b)=>a-b);return new _ColorsAndStops(stops.map(stop=>lerpArgb(_sample(aColors,aStops,stop),_sample(bColors,bStops,stop),t)!),stops);}
function rect(value:RectInput):Rect{return value instanceof Rect?value:Rect.fromLTWH(value.x,value.y,value.width,value.height);}
export abstract class GradientTransform {abstract transform(bounds:RectInput,options?:GradientShaderOptions):Matrix4|null;}
export class GradientRotation extends GradientTransform {
 constructor(readonly radians:number){super();}
 transform(bounds:RectInput,_options:GradientShaderOptions={}):Matrix4 {const center=rect(bounds).center,sine=Math.sin(this.radians),oneMinusCos=1-Math.cos(this.radians),result=Matrix4.identity();result.translateByDouble(sine*center.y+oneMinusCos*center.x,-sine*center.x+oneMinusCos*center.y,0,1);result.rotateZ(this.radians);return result;}
 equals(other:unknown):boolean{return this===other||other instanceof GradientRotation&&other.constructor===this.constructor&&other.radians===this.radians;}
 get hashCode():number{return hashValues(this.radians);}
 toString():string{return `GradientRotation(radians: ${this.radians})`;}
}
export abstract class Gradient {
 readonly colors:readonly number[];readonly stops:readonly number[]|null;readonly transform:GradientTransform|null;
 constructor({colors,stops=null,transform=null}:GradientOptions){this.colors=colors;this.stops=stops;this.transform=transform;}
 protected _impliedStops():readonly number[]{if(this.stops!==null)return this.stops;invariant(this.colors.length>=2,'invalid-gradient','colors list must have at least two colors');return this.colors.map((_,index)=>index/(this.colors.length-1));}
 protected _resolveTransform(bounds:RectInput,textDirection:Direction):Float64Array|null{return this.transform?.transform(bounds,{textDirection})?.storage??null;}
 abstract createShader(bounds:RectInput,options?:GradientShaderOptions):Shader;
 abstract scale(factor:number):Gradient;
 abstract withOpacity(opacity:number):Gradient;
 fromColor(color:number):Gradient{return new LinearGradient({colors:this.colors.map(()=>color),stops:this.stops,transform:this.transform});}
 lerpFrom(a:Gradient|null,t:number):Gradient|null{return a===null?this.scale(t):null;}
 lerpTo(b:Gradient|null,t:number):Gradient|null{return b===null?this.scale(1-t):null;}
 static lerp(a:Gradient|null,b:Gradient|null,t:number):Gradient|null{if(a===b)return a;const result=b?.lerpFrom(a,t)??a?.lerpTo(b,t);if(result)return result;return t<.5?a!.scale(1-t*2):b!.scale((t-.5)*2);}
 protected sameBase(other:Gradient):boolean{return listEquals(this.colors,other.colors)&&listEquals(this.stops,other.stops)&&valueEquals(this.transform,other.transform);}
}
export interface LinearGradientOptions extends GradientOptions {readonly begin?:AlignmentGeometry;readonly end?:AlignmentGeometry;readonly tileMode?:TileMode}
export class LinearGradient extends Gradient {
 readonly begin:AlignmentGeometry;readonly end:AlignmentGeometry;readonly tileMode:TileMode;
 constructor({begin=Alignment.centerLeft,end=Alignment.centerRight,tileMode='clamp',...options}:LinearGradientOptions){super(options);this.begin=begin;this.end=end;this.tileMode=tileMode;}
 createShader(bounds:RectInput,{textDirection=null}:GradientShaderOptions={}):Shader{const r=rect(bounds);return UiGradient.linear(this.begin.resolve(textDirection).withinRect(r),this.end.resolve(textDirection).withinRect(r),this.colors,this._impliedStops(),this.tileMode,this._resolveTransform(r,textDirection));}
 private copy(colors:readonly number[]):LinearGradient{return new LinearGradient({begin:this.begin,end:this.end,tileMode:this.tileMode,colors,stops:this.stops,transform:this.transform});}
 scale(factor:number):LinearGradient{return this.copy(this.colors.map(color=>lerpArgb(null,color,factor)!));}
 withOpacity(opacity:number):LinearGradient{return this.copy(this.colors.map(color=>withArgbOpacity(color,opacity)));}
 override fromColor(color:number):LinearGradient{return this.copy(this.colors.map(()=>color));}
 override lerpFrom(a:Gradient|null,t:number):Gradient|null{return a===null||a instanceof LinearGradient?LinearGradient.lerp(a,this,t):super.lerpFrom(a,t);}
 override lerpTo(b:Gradient|null,t:number):Gradient|null{return b===null||b instanceof LinearGradient?LinearGradient.lerp(this,b,t):super.lerpTo(b,t);}
 static override lerp(a:LinearGradient|null,b:LinearGradient|null,t:number):LinearGradient|null{if(a===b)return a;if(a===null)return b!.scale(t);if(b===null)return a.scale(1-t);const values=_interpolateColorsAndStops(a.colors,a._impliedStops(),b.colors,b._impliedStops(),t);return new LinearGradient({begin:AlignmentGeometry.lerp(a.begin,b.begin,t)!,end:AlignmentGeometry.lerp(a.end,b.end,t)!,colors:values.colors,stops:values.stops,tileMode:t<.5?a.tileMode:b.tileMode,transform:t<.5?a.transform:b.transform});}
 equals(other:unknown):boolean{return this===other||other instanceof LinearGradient&&other.constructor===this.constructor&&this.begin.equals(other.begin)&&this.end.equals(other.end)&&this.tileMode===other.tileMode&&this.sameBase(other);}
 get hashCode():number{return hashValues(this.begin,this.end,this.tileMode,this.transform,this.colors,this.stops);}
 toString():string{return `LinearGradient(begin: ${this.begin}, end: ${this.end}, colors: [${this.colors}], stops: ${this.stops}, tileMode: ${this.tileMode}, transform: ${this.transform})`;}
}
export interface RadialGradientOptions extends GradientOptions {readonly center?:AlignmentGeometry;readonly radius?:number;readonly tileMode?:TileMode;readonly focal?:AlignmentGeometry|null;readonly focalRadius?:number}
export class RadialGradient extends Gradient {
 readonly center:AlignmentGeometry;readonly radius:number;readonly tileMode:TileMode;readonly focal:AlignmentGeometry|null;readonly focalRadius:number;
 constructor({center=Alignment.center,radius=.5,tileMode='clamp',focal=null,focalRadius=0,...options}:RadialGradientOptions){super(options);this.center=center;this.radius=radius;this.tileMode=tileMode;this.focal=focal;this.focalRadius=focalRadius;}
 createShader(bounds:RectInput,{textDirection=null}:GradientShaderOptions={}):Shader{const r=rect(bounds);return UiGradient.radial(this.center.resolve(textDirection).withinRect(r),this.radius*r.shortestSide,this.colors,this._impliedStops(),this.tileMode,this._resolveTransform(r,textDirection),this.focal?.resolve(textDirection).withinRect(r)??null,this.focalRadius*r.shortestSide);}
 private copy(colors:readonly number[]):RadialGradient{return new RadialGradient({center:this.center,radius:this.radius,tileMode:this.tileMode,focal:this.focal,focalRadius:this.focalRadius,colors,stops:this.stops,transform:this.transform});}
 scale(factor:number):RadialGradient{return this.copy(this.colors.map(color=>lerpArgb(null,color,factor)!));}
 withOpacity(opacity:number):RadialGradient{return this.copy(this.colors.map(color=>withArgbOpacity(color,opacity)));}
 override fromColor(color:number):RadialGradient{return this.copy(this.colors.map(()=>color));}
 override lerpFrom(a:Gradient|null,t:number):Gradient|null{return a===null||a instanceof RadialGradient?RadialGradient.lerp(a,this,t):super.lerpFrom(a,t);}
 override lerpTo(b:Gradient|null,t:number):Gradient|null{return b===null||b instanceof RadialGradient?RadialGradient.lerp(this,b,t):super.lerpTo(b,t);}
 static override lerp(a:RadialGradient|null,b:RadialGradient|null,t:number):RadialGradient|null{if(a===b)return a;if(a===null)return b!.scale(t);if(b===null)return a.scale(1-t);const values=_interpolateColorsAndStops(a.colors,a._impliedStops(),b.colors,b._impliedStops(),t);return new RadialGradient({center:AlignmentGeometry.lerp(a.center,b.center,t)!,radius:Math.max(0,a.radius*(1-t)+b.radius*t),focal:AlignmentGeometry.lerp(a.focal,b.focal,t),focalRadius:Math.max(0,a.focalRadius*(1-t)+b.focalRadius*t),colors:values.colors,stops:values.stops,tileMode:t<.5?a.tileMode:b.tileMode,transform:t<.5?a.transform:b.transform});}
 equals(other:unknown):boolean{return this===other||other instanceof RadialGradient&&other.constructor===this.constructor&&this.center.equals(other.center)&&this.radius===other.radius&&this.tileMode===other.tileMode&&valueEquals(this.focal,other.focal)&&this.focalRadius===other.focalRadius&&this.sameBase(other);}
 get hashCode():number{return hashValues(this.center,this.radius,this.tileMode,this.transform,this.colors,this.stops,this.focal,this.focalRadius);}
 toString():string{return `RadialGradient(center: ${this.center}, radius: ${this.radius}, colors: [${this.colors}], stops: ${this.stops}, tileMode: ${this.tileMode}, focal: ${this.focal}, focalRadius: ${this.focalRadius}, transform: ${this.transform})`;}
}
export interface SweepGradientOptions extends GradientOptions {readonly center?:AlignmentGeometry;readonly startAngle?:number;readonly endAngle?:number;readonly tileMode?:TileMode}
export class SweepGradient extends Gradient {
 readonly center:AlignmentGeometry;readonly startAngle:number;readonly endAngle:number;readonly tileMode:TileMode;
 constructor({center=Alignment.center,startAngle=0,endAngle=Math.PI*2,tileMode='clamp',...options}:SweepGradientOptions){super(options);this.center=center;this.startAngle=startAngle;this.endAngle=endAngle;this.tileMode=tileMode;}
 createShader(bounds:RectInput,{textDirection=null}:GradientShaderOptions={}):Shader{const r=rect(bounds);return UiGradient.sweep(this.center.resolve(textDirection).withinRect(r),this.colors,this._impliedStops(),this.tileMode,this.startAngle,this.endAngle,this._resolveTransform(r,textDirection));}
 private copy(colors:readonly number[]):SweepGradient{return new SweepGradient({center:this.center,startAngle:this.startAngle,endAngle:this.endAngle,tileMode:this.tileMode,colors,stops:this.stops,transform:this.transform});}
 scale(factor:number):SweepGradient{return this.copy(this.colors.map(color=>lerpArgb(null,color,factor)!));}
 withOpacity(opacity:number):SweepGradient{return this.copy(this.colors.map(color=>withArgbOpacity(color,opacity)));}
 override fromColor(color:number):SweepGradient{return this.copy(this.colors.map(()=>color));}
 override lerpFrom(a:Gradient|null,t:number):Gradient|null{return a===null||a instanceof SweepGradient?SweepGradient.lerp(a,this,t):super.lerpFrom(a,t);}
 override lerpTo(b:Gradient|null,t:number):Gradient|null{return b===null||b instanceof SweepGradient?SweepGradient.lerp(this,b,t):super.lerpTo(b,t);}
 static override lerp(a:SweepGradient|null,b:SweepGradient|null,t:number):SweepGradient|null{if(a===b)return a;if(a===null)return b!.scale(t);if(b===null)return a.scale(1-t);const values=_interpolateColorsAndStops(a.colors,a._impliedStops(),b.colors,b._impliedStops(),t);return new SweepGradient({center:AlignmentGeometry.lerp(a.center,b.center,t)!,startAngle:Math.max(0,a.startAngle*(1-t)+b.startAngle*t),endAngle:Math.max(0,a.endAngle*(1-t)+b.endAngle*t),colors:values.colors,stops:values.stops,tileMode:t<.5?a.tileMode:b.tileMode,transform:t<.5?a.transform:b.transform});}
 equals(other:unknown):boolean{return this===other||other instanceof SweepGradient&&other.constructor===this.constructor&&this.center.equals(other.center)&&this.startAngle===other.startAngle&&this.endAngle===other.endAngle&&this.tileMode===other.tileMode&&this.sameBase(other);}
 get hashCode():number{return hashValues(this.center,this.startAngle,this.endAngle,this.tileMode,this.transform,this.colors,this.stops);}
 toString():string{return `SweepGradient(center: ${this.center}, startAngle: ${this.startAngle}, endAngle: ${this.endAngle}, colors: [${this.colors}], stops: ${this.stops}, tileMode: ${this.tileMode}, transform: ${this.transform})`;}
}
