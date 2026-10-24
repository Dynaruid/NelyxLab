// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter painting/edge_insets.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import {number,clamp,modulo,truncateDivide,hashDoubles,fixed} from '../../ui/value-math.ts';
import {Offset} from '../../ui/offset.ts';
import {Size} from '../../ui/size.ts';
import {Rect} from '../../ui/rect.ts';
import {RRect} from '../../ui/rrect.ts';
import {Radius} from '../../ui/radius.ts';
import type {Insets} from '../../ui/geometry.ts';
type Direction='ltr'|'rtl'|null;
export interface EdgeInsetsOptions {readonly left?:number;readonly top?:number;readonly right?:number;readonly bottom?:number}
export interface EdgeInsetsDirectionalOptions {readonly start?:number;readonly top?:number;readonly end?:number;readonly bottom?:number}
export interface EdgeInsetsCopyWithOptions {readonly left?:number|null;readonly top?:number|null;readonly right?:number|null;readonly bottom?:number|null}
export interface EdgeInsetsDirectionalCopyWithOptions {readonly start?:number|null;readonly top?:number|null;readonly end?:number|null;readonly bottom?:number|null}
export interface EdgeInsetsSymmetricOptions {readonly horizontal?:number;readonly vertical?:number}
function interpolate(a:number,b:number,t:number):number{if(a===b||Number.isNaN(a)&&Number.isNaN(b))return a;invariant(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(t),'invalid-insets-lerp','Unequal inset components and interpolation factor must be finite');return a*(1-t)+b*t;}
function requireDirection(value:Direction):'ltr'|'rtl'{invariant(value==='ltr'||value==='rtl','missing-text-direction','Directional insets require ltr or rtl');return value;}

export abstract class EdgeInsetsGeometry {
  protected abstract get _left():number;protected abstract get _right():number;protected abstract get _start():number;protected abstract get _end():number;protected abstract get _top():number;protected abstract get _bottom():number;
  static all(value:number):EdgeInsetsGeometry{return EdgeInsets.all(value);}
  static only(value:EdgeInsetsOptions={}):EdgeInsetsGeometry{return EdgeInsets.only(value);}
  static directional(value:EdgeInsetsDirectionalOptions={}):EdgeInsetsGeometry{return EdgeInsetsDirectional.only(value);}
  static symmetric(value:EdgeInsetsSymmetricOptions={}):EdgeInsetsGeometry{return EdgeInsets.symmetric(value);}
  static fromLTRB(left:number,top:number,right:number,bottom:number):EdgeInsetsGeometry{return EdgeInsets.fromLTRB(left,top,right,bottom);}
  static fromSTEB(start:number,top:number,end:number,bottom:number):EdgeInsetsGeometry{return EdgeInsetsDirectional.fromSTEB(start,top,end,bottom);}
  static fromViewPadding(padding:Insets,devicePixelRatio:number):EdgeInsetsGeometry{return EdgeInsets.fromViewPadding(padding,devicePixelRatio);}
  static get zero():EdgeInsetsGeometry{return physicalZero;}
  static get infinity():EdgeInsetsGeometry{return infiniteInsets;}
  get isNonNegative():boolean{return this._left>=0&&this._right>=0&&this._start>=0&&this._end>=0&&this._top>=0&&this._bottom>=0;}
  get horizontal():number{return this._left+this._right+this._start+this._end;}
  get vertical():number{return this._top+this._bottom;}
  along(axis:'horizontal'|'vertical'):number{invariant(axis==='horizontal'||axis==='vertical','invalid-axis','Insets axis must be horizontal or vertical');return axis==='horizontal'?this.horizontal:this.vertical;}
  get collapsedSize():Size{return new Size(this.horizontal,this.vertical);}
  get flipped():EdgeInsetsGeometry{return new MixedEdgeInsets(this._right,this._left,this._end,this._start,this._bottom,this._top);}
  inflateSize(size:{readonly width:number;readonly height:number}):Size{return new Size(size.width+this.horizontal,size.height+this.vertical);}
  deflateSize(size:{readonly width:number;readonly height:number}):Size{return new Size(size.width-this.horizontal,size.height-this.vertical);}
  subtract(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return new MixedEdgeInsets(this._left-other._left,this._right-other._right,this._start-other._start,this._end-other._end,this._top-other._top,this._bottom-other._bottom);}
  add(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return new MixedEdgeInsets(this._left+other._left,this._right+other._right,this._start+other._start,this._end+other._end,this._top+other._top,this._bottom+other._bottom);}
  clamp(minimum:EdgeInsetsGeometry,maximum:EdgeInsetsGeometry):EdgeInsetsGeometry{return new MixedEdgeInsets(clamp(this._left,minimum._left,maximum._left),clamp(this._right,minimum._right,maximum._right),clamp(this._start,minimum._start,maximum._start),clamp(this._end,minimum._end,maximum._end),clamp(this._top,minimum._top,maximum._top),clamp(this._bottom,minimum._bottom,maximum._bottom));}
  protected clampToPhysical(minimum:EdgeInsetsGeometry,maximum:EdgeInsetsGeometry):EdgeInsets{return new EdgeInsets(clamp(this._left,minimum._left,maximum._left),clamp(this._top,minimum._top,maximum._top),clamp(this._right,minimum._right,maximum._right),clamp(this._bottom,minimum._bottom,maximum._bottom));}
  abstract negate():EdgeInsetsGeometry;abstract multiply(value:number):EdgeInsetsGeometry;abstract divide(value:number):EdgeInsetsGeometry;abstract truncateDivide(value:number):EdgeInsetsGeometry;abstract modulo(value:number):EdgeInsetsGeometry;
  static lerp(a:EdgeInsetsGeometry|null,b:EdgeInsetsGeometry|null,t:number):EdgeInsetsGeometry|null{if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);if(a instanceof EdgeInsets&&b instanceof EdgeInsets)return EdgeInsets.lerp(a,b,t);if(a instanceof EdgeInsetsDirectional&&b instanceof EdgeInsetsDirectional)return EdgeInsetsDirectional.lerp(a,b,t);return new MixedEdgeInsets(interpolate(a._left,b._left,t),interpolate(a._right,b._right,t),interpolate(a._start,b._start,t),interpolate(a._end,b._end,t),interpolate(a._top,b._top,t),interpolate(a._bottom,b._bottom,t));}
  abstract resolve(direction:Direction):EdgeInsets;
  equals(other:unknown):boolean{return other instanceof EdgeInsetsGeometry&&other._left===this._left&&other._right===this._right&&other._start===this._start&&other._end===this._end&&other._top===this._top&&other._bottom===this._bottom;}
  get hashCode():number{return hashDoubles([this._left,this._right,this._start,this._end,this._top,this._bottom]);}
  toString():string{if(this._start===0&&this._end===0){if(this._left===0&&this._right===0&&this._top===0&&this._bottom===0)return 'EdgeInsets.zero';if(this._left===this._right&&this._right===this._top&&this._top===this._bottom)return `EdgeInsets.all(${fixed(this._left)})`;return `EdgeInsets(${fixed(this._left)}, ${fixed(this._top)}, ${fixed(this._right)}, ${fixed(this._bottom)})`;}if(this._left===0&&this._right===0)return `EdgeInsetsDirectional(${fixed(this._start)}, ${fixed(this._top)}, ${fixed(this._end)}, ${fixed(this._bottom)})`;return `EdgeInsets(${fixed(this._left)}, ${fixed(this._top)}, ${fixed(this._right)}, ${fixed(this._bottom)}) + EdgeInsetsDirectional(${fixed(this._start)}, 0.0, ${fixed(this._end)}, 0.0)`;}
}

export class EdgeInsets extends EdgeInsetsGeometry implements Insets {
  readonly #values:readonly [number,number,number,number];
  constructor(left=0,top=0,right=0,bottom=0){super();this.#values=Object.freeze([number(left),number(top),number(right),number(bottom)]);}
  get left():number{return this.#values[0];}get top():number{return this.#values[1];}get right():number{return this.#values[2];}get bottom():number{return this.#values[3];}
  protected get _left():number{return this.left;}protected get _right():number{return this.right;}protected get _top():number{return this.top;}protected get _bottom():number{return this.bottom;}protected get _start():number{return 0;}protected get _end():number{return 0;}
  static override get zero():EdgeInsets{return physicalZero;}
  static override fromLTRB(left:number,top:number,right:number,bottom:number):EdgeInsets{return new EdgeInsets(left,top,right,bottom);}
  static override all(value:number):EdgeInsets{return new EdgeInsets(value,value,value,value);}
  static override only(value:EdgeInsetsOptions={}):EdgeInsets{const {left=0,top=0,right=0,bottom=0}=value;return new EdgeInsets(left,top,right,bottom);}
  static override symmetric(value:EdgeInsetsSymmetricOptions={}):EdgeInsets{const {horizontal=0,vertical=0}=value;return new EdgeInsets(horizontal,vertical,horizontal,vertical);}
  static override fromViewPadding(padding:Insets,devicePixelRatio:number):EdgeInsets{return new EdgeInsets(padding.left/devicePixelRatio,padding.top/devicePixelRatio,padding.right/devicePixelRatio,padding.bottom/devicePixelRatio);}
  /** @deprecated Use fromViewPadding. */
  static fromWindowPadding(padding:Insets,devicePixelRatio:number):EdgeInsets{return EdgeInsets.fromViewPadding(padding,devicePixelRatio);}
  get topLeft():Offset{return new Offset(this.left,this.top);}get topRight():Offset{return new Offset(-this.right,this.top);}get bottomLeft():Offset{return new Offset(this.left,-this.bottom);}get bottomRight():Offset{return new Offset(-this.right,-this.bottom);}
  override get flipped():EdgeInsets{return new EdgeInsets(this.right,this.bottom,this.left,this.top);}
  inflateRect(rect:Rect):Rect{return Rect.fromLTRB(rect.left-this.left,rect.top-this.top,rect.right+this.right,rect.bottom+this.bottom);}
  deflateRect(rect:Rect):Rect{return Rect.fromLTRB(rect.left+this.left,rect.top+this.top,rect.right-this.right,rect.bottom-this.bottom);}
  inflateRRect(rect:RRect):RRect{return RRect.fromLTRBAndCorners(rect.left-this.left,rect.top-this.top,rect.right+this.right,rect.bottom+this.bottom,{topLeft:rect.tlRadius.add(Radius.elliptical(this.left,this.top)).clamp({minimum:Radius.zero}),topRight:rect.trRadius.add(Radius.elliptical(this.right,this.top)).clamp({minimum:Radius.zero}),bottomRight:rect.brRadius.add(Radius.elliptical(this.right,this.bottom)).clamp({minimum:Radius.zero}),bottomLeft:rect.blRadius.add(Radius.elliptical(this.left,this.bottom)).clamp({minimum:Radius.zero})});}
  deflateRRect(rect:RRect):RRect{return RRect.fromLTRBAndCorners(rect.left+this.left,rect.top+this.top,rect.right-this.right,rect.bottom-this.bottom,{topLeft:rect.tlRadius.subtract(Radius.elliptical(this.left,this.top)).clamp({minimum:Radius.zero}),topRight:rect.trRadius.subtract(Radius.elliptical(this.right,this.top)).clamp({minimum:Radius.zero}),bottomRight:rect.brRadius.subtract(Radius.elliptical(this.right,this.bottom)).clamp({minimum:Radius.zero}),bottomLeft:rect.blRadius.subtract(Radius.elliptical(this.left,this.bottom)).clamp({minimum:Radius.zero})});}
  override subtract(other:EdgeInsets):EdgeInsets;
  override subtract(other:EdgeInsetsGeometry):EdgeInsetsGeometry;
  override subtract(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return other instanceof EdgeInsets?this.minus(other):super.subtract(other);}
  override add(other:EdgeInsets):EdgeInsets;
  override add(other:EdgeInsetsGeometry):EdgeInsetsGeometry;
  override add(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return other instanceof EdgeInsets?this.plus(other):super.add(other);}
  override clamp(minimum:EdgeInsetsGeometry,maximum:EdgeInsetsGeometry):EdgeInsets{return this.clampToPhysical(minimum,maximum);}
  minus(other:EdgeInsets):EdgeInsets{return new EdgeInsets(this.left-other.left,this.top-other.top,this.right-other.right,this.bottom-other.bottom);}
  plus(other:EdgeInsets):EdgeInsets{return new EdgeInsets(this.left+other.left,this.top+other.top,this.right+other.right,this.bottom+other.bottom);}
  negate():EdgeInsets{return new EdgeInsets(-this.left,-this.top,-this.right,-this.bottom);}
  multiply(value:number):EdgeInsets{return new EdgeInsets(this.left*value,this.top*value,this.right*value,this.bottom*value);}
  divide(value:number):EdgeInsets{return new EdgeInsets(this.left/value,this.top/value,this.right/value,this.bottom/value);}
  truncateDivide(value:number):EdgeInsets{return new EdgeInsets(truncateDivide(this.left,value),truncateDivide(this.top,value),truncateDivide(this.right,value),truncateDivide(this.bottom,value));}
  modulo(value:number):EdgeInsets{return new EdgeInsets(modulo(this.left,value),modulo(this.top,value),modulo(this.right,value),modulo(this.bottom,value));}
  static override lerp(a:EdgeInsets|null,b:EdgeInsets|null,t:number):EdgeInsets|null{if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);return new EdgeInsets(interpolate(a.left,b.left,t),interpolate(a.top,b.top,t),interpolate(a.right,b.right,t),interpolate(a.bottom,b.bottom,t));}
  resolve(_direction:Direction):EdgeInsets{return this;}
  copyWith(value:EdgeInsetsCopyWithOptions={}):EdgeInsets{return new EdgeInsets(value.left??this.left,value.top??this.top,value.right??this.right,value.bottom??this.bottom);}
}

export class EdgeInsetsDirectional extends EdgeInsetsGeometry {
  readonly #values:readonly [number,number,number,number];
  constructor(start=0,top=0,end=0,bottom=0){super();this.#values=Object.freeze([number(start),number(top),number(end),number(bottom)]);}
  get start():number{return this.#values[0];}get top():number{return this.#values[1];}get end():number{return this.#values[2];}get bottom():number{return this.#values[3];}
  protected get _start():number{return this.start;}protected get _end():number{return this.end;}protected get _top():number{return this.top;}protected get _bottom():number{return this.bottom;}protected get _left():number{return 0;}protected get _right():number{return 0;}
  static override get zero():EdgeInsetsDirectional{return directionalZero;}
  static override fromSTEB(start:number,top:number,end:number,bottom:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(start,top,end,bottom);}
  static override all(value:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(value,value,value,value);}
  static override only(value:EdgeInsetsDirectionalOptions={}):EdgeInsetsDirectional{const {start=0,top=0,end=0,bottom=0}=value;return new EdgeInsetsDirectional(start,top,end,bottom);}
  static override symmetric(value:EdgeInsetsSymmetricOptions={}):EdgeInsetsDirectional{const {horizontal=0,vertical=0}=value;return new EdgeInsetsDirectional(horizontal,vertical,horizontal,vertical);}
  override get isNonNegative():boolean{return this.start>=0&&this.top>=0&&this.end>=0&&this.bottom>=0;}
  override get flipped():EdgeInsetsDirectional{return new EdgeInsetsDirectional(this.end,this.bottom,this.start,this.top);}
  override subtract(other:EdgeInsetsDirectional):EdgeInsetsDirectional;
  override subtract(other:EdgeInsetsGeometry):EdgeInsetsGeometry;
  override subtract(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return other instanceof EdgeInsetsDirectional?this.minus(other):super.subtract(other);}
  override add(other:EdgeInsetsDirectional):EdgeInsetsDirectional;
  override add(other:EdgeInsetsGeometry):EdgeInsetsGeometry;
  override add(other:EdgeInsetsGeometry):EdgeInsetsGeometry{return other instanceof EdgeInsetsDirectional?this.plus(other):super.add(other);}
  minus(other:EdgeInsetsDirectional):EdgeInsetsDirectional{return new EdgeInsetsDirectional(this.start-other.start,this.top-other.top,this.end-other.end,this.bottom-other.bottom);}
  plus(other:EdgeInsetsDirectional):EdgeInsetsDirectional{return new EdgeInsetsDirectional(this.start+other.start,this.top+other.top,this.end+other.end,this.bottom+other.bottom);}
  negate():EdgeInsetsDirectional{return new EdgeInsetsDirectional(-this.start,-this.top,-this.end,-this.bottom);}
  multiply(value:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(this.start*value,this.top*value,this.end*value,this.bottom*value);}
  divide(value:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(this.start/value,this.top/value,this.end/value,this.bottom/value);}
  truncateDivide(value:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(truncateDivide(this.start,value),truncateDivide(this.top,value),truncateDivide(this.end,value),truncateDivide(this.bottom,value));}
  modulo(value:number):EdgeInsetsDirectional{return new EdgeInsetsDirectional(modulo(this.start,value),modulo(this.top,value),modulo(this.end,value),modulo(this.bottom,value));}
  static override lerp(a:EdgeInsetsDirectional|null,b:EdgeInsetsDirectional|null,t:number):EdgeInsetsDirectional|null{if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);return new EdgeInsetsDirectional(interpolate(a.start,b.start,t),interpolate(a.top,b.top,t),interpolate(a.end,b.end,t),interpolate(a.bottom,b.bottom,t));}
  resolve(direction:Direction):EdgeInsets{return requireDirection(direction)==='rtl'?new EdgeInsets(this.end,this.top,this.start,this.bottom):new EdgeInsets(this.start,this.top,this.end,this.bottom);}
  copyWith(value:EdgeInsetsDirectionalCopyWithOptions={}):EdgeInsetsDirectional{return new EdgeInsetsDirectional(value.start??this.start,value.top??this.top,value.end??this.end,value.bottom??this.bottom);}
}

class MixedEdgeInsets extends EdgeInsetsGeometry {
  readonly #values:readonly [number,number,number,number,number,number];
  constructor(left:number,right:number,start:number,end:number,top:number,bottom:number){super();this.#values=Object.freeze([number(left),number(right),number(start),number(end),number(top),number(bottom)]);}
  static fromLRSETB(left:number,right:number,start:number,end:number,top:number,bottom:number):MixedEdgeInsets{return new MixedEdgeInsets(left,right,start,end,top,bottom);}
  protected get _left():number{return this.#values[0];}protected get _right():number{return this.#values[1];}protected get _start():number{return this.#values[2];}protected get _end():number{return this.#values[3];}protected get _top():number{return this.#values[4];}protected get _bottom():number{return this.#values[5];}
  private map(f:(value:number)=>number):MixedEdgeInsets{return new MixedEdgeInsets(f(this._left),f(this._right),f(this._start),f(this._end),f(this._top),f(this._bottom));}
  negate():MixedEdgeInsets{return this.map(value=>-value);}multiply(value:number):MixedEdgeInsets{return this.map(x=>x*value);}divide(value:number):MixedEdgeInsets{return this.map(x=>x/value);}truncateDivide(value:number):MixedEdgeInsets{return this.map(x=>truncateDivide(x,value));}modulo(value:number):MixedEdgeInsets{return this.map(x=>modulo(x,value));}
  resolve(direction:Direction):EdgeInsets{return requireDirection(direction)==='rtl'?new EdgeInsets(this._end+this._left,this._top,this._start+this._right,this._bottom):new EdgeInsets(this._start+this._left,this._top,this._end+this._right,this._bottom);}
}
const physicalZero=new EdgeInsets(),directionalZero=new EdgeInsetsDirectional(),infiniteInsets=new MixedEdgeInsets(Infinity,Infinity,Infinity,Infinity,Infinity,Infinity);
