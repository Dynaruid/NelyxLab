// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter painting/alignment.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {Rect} from '../../ui/rect.ts';
import type {Size} from '../../ui/geometry.ts';
import {number,modulo,truncateDivide,hashDoubles,protect,fixed} from '../../ui/value-math.ts';
type Direction='ltr'|'rtl'|null;
function requireDirection(value:Direction):'ltr'|'rtl' {invariant(value==='ltr'||value==='rtl','missing-text-direction','Directional alignment requires ltr or rtl');return value;}
/** Preserve ui.lerpDouble's equal/NaN shortcut and finite debug contract in all builds. */
function interpolate(a:number,b:number,t:number):number {if(a===b||Number.isNaN(a)&&Number.isNaN(b))return a;invariant(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(t),'invalid-alignment-lerp','Unequal alignment components and interpolation factor must be finite');return a*(1-t)+b*t;}
function stringify(x:number,y:number,directional=false):string {
  const names=directional?[['topStart','topCenter','topEnd'],['centerStart','center','centerEnd'],['bottomStart','bottomCenter','bottomEnd']]:[['topLeft','topCenter','topRight'],['centerLeft','center','centerRight'],['bottomLeft','bottomCenter','bottomRight']];
  const type=directional?'AlignmentDirectional':'Alignment';
  return Number.isInteger(x)&&x>=-1&&x<=1&&Number.isInteger(y)&&y>=-1&&y<=1?`${type}.${names[y+1]![x+1]}`:`${type}(${fixed(x)}, ${fixed(y)})`;
}
export abstract class AlignmentGeometry {
  protected abstract get _x():number;
  protected abstract get _start():number;
  protected abstract get _y():number;
  static xy(x:number,y:number):Alignment {return new Alignment(x,y);}
  static directional(start:number,y:number):AlignmentDirectional {return new AlignmentDirectional(start,y);}
  static get topLeft():AlignmentGeometry {return Alignment.topLeft;}
  static get topCenter():AlignmentGeometry {return Alignment.topCenter;}
  static get topRight():AlignmentGeometry {return Alignment.topRight;}
  static get topStart():AlignmentGeometry {return AlignmentDirectional.topStart;}
  static get topEnd():AlignmentGeometry {return AlignmentDirectional.topEnd;}
  static get centerLeft():AlignmentGeometry {return Alignment.centerLeft;}
  static get center():AlignmentGeometry {return Alignment.center;}
  static get centerRight():AlignmentGeometry {return Alignment.centerRight;}
  static get centerStart():AlignmentGeometry {return AlignmentDirectional.centerStart;}
  static get centerEnd():AlignmentGeometry {return AlignmentDirectional.centerEnd;}
  static get bottomLeft():AlignmentGeometry {return Alignment.bottomLeft;}
  static get bottomCenter():AlignmentGeometry {return Alignment.bottomCenter;}
  static get bottomRight():AlignmentGeometry {return Alignment.bottomRight;}
  static get bottomStart():AlignmentGeometry {return AlignmentDirectional.bottomStart;}
  static get bottomEnd():AlignmentGeometry {return AlignmentDirectional.bottomEnd;}
  add(other:AlignmentGeometry):AlignmentGeometry {return new MixedAlignment(this._x+other._x,this._start+other._start,this._y+other._y);}
  abstract negate():AlignmentGeometry;
  abstract multiply(value:number):AlignmentGeometry;
  abstract divide(value:number):AlignmentGeometry;
  abstract truncateDivide(value:number):AlignmentGeometry;
  abstract modulo(value:number):AlignmentGeometry;
  abstract resolve(direction:Direction):Alignment;
  static lerp(a:AlignmentGeometry|null,b:AlignmentGeometry|null,t:number):AlignmentGeometry|null {
    if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);
    if(a instanceof Alignment&&b instanceof Alignment)return Alignment.lerp(a,b,t);
    if(a instanceof AlignmentDirectional&&b instanceof AlignmentDirectional)return AlignmentDirectional.lerp(a,b,t);
    return new MixedAlignment(interpolate(a._x,b._x,t),interpolate(a._start,b._start,t),interpolate(a._y,b._y,t));
  }
  equals(other:unknown):boolean {return other instanceof AlignmentGeometry&&other._x===this._x&&other._start===this._start&&other._y===this._y;}
  get hashCode():number {return hashDoubles([this._x,this._start,this._y]);}
  toString():string {if(this._start===0)return stringify(this._x,this._y);if(this._x===0)return stringify(this._start,this._y,true);return `${stringify(this._x,this._y)} + ${stringify(this._start,0,true)}`;}
}
export class Alignment extends AlignmentGeometry {
  readonly #horizontal:number;readonly #vertical:number;
  constructor(x:number,y:number){super();this.#horizontal=number(x);this.#vertical=number(y);}
  get x():number{return this.#horizontal;}get y():number{return this.#vertical;}
  protected get _x():number {return this.x;}protected get _start():number {return 0;}protected get _y():number {return this.y;}
  static override get topLeft():Alignment{return physicalAlignments.topLeft;}static override get topCenter():Alignment{return physicalAlignments.topCenter;}static override get topRight():Alignment{return physicalAlignments.topRight;}
  static override get centerLeft():Alignment{return physicalAlignments.centerLeft;}static override get center():Alignment{return physicalAlignments.center;}static override get centerRight():Alignment{return physicalAlignments.centerRight;}
  static override get bottomLeft():Alignment{return physicalAlignments.bottomLeft;}static override get bottomCenter():Alignment{return physicalAlignments.bottomCenter;}static override get bottomRight():Alignment{return physicalAlignments.bottomRight;}
  override add(other:Alignment):Alignment;
  override add(other:AlignmentGeometry):AlignmentGeometry;
  override add(other:AlignmentGeometry):AlignmentGeometry {return other instanceof Alignment?this.plus(other):super.add(other);}
  plus(other:Alignment):Alignment {return new Alignment(this.x+other.x,this.y+other.y);}
  subtract(other:Alignment):Alignment {return new Alignment(this.x-other.x,this.y-other.y);}
  negate():Alignment {return new Alignment(-this.x,-this.y);}
  multiply(value:number):Alignment {return new Alignment(this.x*value,this.y*value);}
  divide(value:number):Alignment {return new Alignment(this.x/value,this.y/value);}
  truncateDivide(value:number):Alignment {return new Alignment(truncateDivide(this.x,value),truncateDivide(this.y,value));}
  modulo(value:number):Alignment {return new Alignment(modulo(this.x,value),modulo(this.y,value));}
  alongOffset(other:{readonly dx:number;readonly dy:number}):Offset {const cx=other.dx/2,cy=other.dy/2;return new Offset(cx+this.x*cx,cy+this.y*cy);}
  alongSize(other:Size):Offset {const cx=other.width/2,cy=other.height/2;return new Offset(cx+this.x*cx,cy+this.y*cy);}
  withinRect(rect:Rect):Offset {const hw=rect.width/2,hh=rect.height/2;return new Offset(rect.left+hw+this.x*hw,rect.top+hh+this.y*hh);}
  inscribe(size:Size,rect:Rect):Rect {const w=size.width,h=size.height,hw=(rect.width-w)/2,hh=(rect.height-h)/2;return Rect.fromLTWH(rect.left+hw+this.x*hw,rect.top+hh+this.y*hh,w,h);}
  static override lerp(a:Alignment|null,b:Alignment|null,t:number):Alignment|null {if(a===b)return a;if(a===null)return new Alignment(interpolate(0,b!.x,t),interpolate(0,b!.y,t));if(b===null)return new Alignment(interpolate(a.x,0,t),interpolate(a.y,0,t));return new Alignment(interpolate(a.x,b.x,t),interpolate(a.y,b.y,t));}
  resolve(_direction:Direction):Alignment {return this;}
  private static _stringify(x:number,y:number):string {return stringify(x,y);}
  override toString():string {return Alignment._stringify(this.x,this.y);}
}
export class AlignmentDirectional extends AlignmentGeometry {
  readonly #logical:number;readonly #vertical:number;
  constructor(start:number,y:number){super();this.#logical=number(start);this.#vertical=number(y);}
  get start():number{return this.#logical;}get y():number{return this.#vertical;}
  protected get _x():number {return 0;}protected get _start():number {return this.start;}protected get _y():number {return this.y;}
  static override get topStart():AlignmentDirectional{return directionalAlignments.topStart;}static override get topCenter():AlignmentDirectional{return directionalAlignments.topCenter;}static override get topEnd():AlignmentDirectional{return directionalAlignments.topEnd;}
  static override get centerStart():AlignmentDirectional{return directionalAlignments.centerStart;}static override get center():AlignmentDirectional{return directionalAlignments.center;}static override get centerEnd():AlignmentDirectional{return directionalAlignments.centerEnd;}
  static override get bottomStart():AlignmentDirectional{return directionalAlignments.bottomStart;}static override get bottomCenter():AlignmentDirectional{return directionalAlignments.bottomCenter;}static override get bottomEnd():AlignmentDirectional{return directionalAlignments.bottomEnd;}
  override add(other:AlignmentDirectional):AlignmentDirectional;
  override add(other:AlignmentGeometry):AlignmentGeometry;
  override add(other:AlignmentGeometry):AlignmentGeometry {return other instanceof AlignmentDirectional?this.plus(other):super.add(other);}
  plus(other:AlignmentDirectional):AlignmentDirectional {return new AlignmentDirectional(this.start+other.start,this.y+other.y);}
  subtract(other:AlignmentDirectional):AlignmentDirectional {return new AlignmentDirectional(this.start-other.start,this.y-other.y);}
  negate():AlignmentDirectional {return new AlignmentDirectional(-this.start,-this.y);}
  multiply(value:number):AlignmentDirectional {return new AlignmentDirectional(this.start*value,this.y*value);}
  divide(value:number):AlignmentDirectional {return new AlignmentDirectional(this.start/value,this.y/value);}
  truncateDivide(value:number):AlignmentDirectional {return new AlignmentDirectional(truncateDivide(this.start,value),truncateDivide(this.y,value));}
  modulo(value:number):AlignmentDirectional {return new AlignmentDirectional(modulo(this.start,value),modulo(this.y,value));}
  static override lerp(a:AlignmentDirectional|null,b:AlignmentDirectional|null,t:number):AlignmentDirectional|null {if(a===b)return a;if(a===null)return new AlignmentDirectional(interpolate(0,b!.start,t),interpolate(0,b!.y,t));if(b===null)return new AlignmentDirectional(interpolate(a.start,0,t),interpolate(a.y,0,t));return new AlignmentDirectional(interpolate(a.start,b.start,t),interpolate(a.y,b.y,t));}
  resolve(direction:Direction):Alignment {return new Alignment(requireDirection(direction)==='rtl'?-this.start:this.start,this.y);}
  private static _stringify(start:number,y:number):string {return stringify(start,y,true);}
  override toString():string {return AlignmentDirectional._stringify(this.start,this.y);}
}
class MixedAlignment extends AlignmentGeometry {
  protected readonly _x:number;protected readonly _start:number;protected readonly _y:number;
  constructor(x:number,start:number,y:number){super();this._x=number(x);this._start=number(start);this._y=number(y);protect(this,['_x','_start','_y']);}
  negate():MixedAlignment {return new MixedAlignment(-this._x,-this._start,-this._y);}
  multiply(v:number):MixedAlignment {return new MixedAlignment(this._x*v,this._start*v,this._y*v);}
  divide(v:number):MixedAlignment {return new MixedAlignment(this._x/v,this._start/v,this._y/v);}
  truncateDivide(v:number):MixedAlignment {return new MixedAlignment(truncateDivide(this._x,v),truncateDivide(this._start,v),truncateDivide(this._y,v));}
  modulo(v:number):MixedAlignment {return new MixedAlignment(modulo(this._x,v),modulo(this._start,v),modulo(this._y,v));}
  resolve(direction:Direction):Alignment {return new Alignment(requireDirection(direction)==='rtl'?this._x-this._start:this._x+this._start,this._y);}
}
// Own getters survive RN Babel's loose static-field transform and preserve identity.
const physicalAlignments=Object.freeze({topLeft:new Alignment(-1,-1),topCenter:new Alignment(0,-1),topRight:new Alignment(1,-1),centerLeft:new Alignment(-1,0),center:new Alignment(0,0),centerRight:new Alignment(1,0),bottomLeft:new Alignment(-1,1),bottomCenter:new Alignment(0,1),bottomRight:new Alignment(1,1)});
const directionalAlignments=Object.freeze({topStart:new AlignmentDirectional(-1,-1),topCenter:new AlignmentDirectional(0,-1),topEnd:new AlignmentDirectional(1,-1),centerStart:new AlignmentDirectional(-1,0),center:new AlignmentDirectional(0,0),centerEnd:new AlignmentDirectional(1,0),bottomStart:new AlignmentDirectional(-1,1),bottomCenter:new AlignmentDirectional(0,1),bottomEnd:new AlignmentDirectional(1,1)});
