// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter painting/borders.dart. Colors use ARGB8.
import {invariant} from '../../foundation/errors.ts';
import {Canvas} from '../../ui/canvas.ts';
import {Paint} from '../../ui/paint.ts';
import {Path} from '../../ui/path.ts';
import {Rect} from '../../ui/rect.ts';
import type {Offset} from '../../ui/geometry.ts';
import {Color} from '../../ui/color.ts';
import {assertSourceColorInterface} from '../../ui/color-source-adapter.ts';
import {EdgeInsets,EdgeInsetsGeometry} from './edge-insets.ts';
import {hashValues,listEquals} from './value-equality.ts';

// Retain the owning Color between source lerps; public paint fields keep the Core ARGB8 ABI.
const borderColors=new WeakMap<BorderSide,Color>();
function borderColor(side:BorderSide):Color{return borderColors.get(side)??new Color(side.color);}
function retainBorderColor(side:BorderSide,color:Color):BorderSide{borderColors.set(side,color);return side;}
/** Bind an analyzer-resolved owning Color without quantizing its equality/interpolation state to the ARGB8 paint ABI. */
export function withSourceBorderSideColor(side:BorderSide,color:Color):BorderSide{assertSourceColorInterface(color);return retainBorderColor(side.copyWith({color:color.toARGB32()}),color);}
/** Source-facing value receiver; the public BorderSide.color paint field remains ARGB8. */
export function sourceBorderSideColor(side:BorderSide):Color{return borderColor(side);}
export type BorderStyle='none'|'solid';
export interface BorderSideOptions {readonly color?:number;readonly width?:number;readonly style?:BorderStyle;readonly strokeAlign?:number}
export class BorderSide {
  static readonly strokeAlignInside=-1;static readonly strokeAlignCenter=0;static readonly strokeAlignOutside=1;
  static readonly none=new BorderSide({width:0,style:'none'});
  readonly color:number;readonly width:number;readonly style:BorderStyle;readonly strokeAlign:number;
  constructor({color=0xff000000,width=1,style='solid',strokeAlign=-1}:BorderSideOptions={}){invariant(Number.isFinite(width)&&width>=0&&Number.isFinite(strokeAlign),'invalid-border','Border width must be nonnegative and strokeAlign finite');invariant(style==='none'||style==='solid','invalid-border','Unknown border style');invariant(Number.isInteger(color)&&color>=0&&color<=0xffffffff,'invalid-color','Expected ARGB8');this.color=color;this.width=width;this.style=style;this.strokeAlign=strokeAlign;borderColors.set(this,new Color(color));}
  copyWith(options:BorderSideOptions={}):BorderSide{return retainBorderColor(new BorderSide({color:options.color??this.color,width:options.width??this.width,style:options.style??this.style,strokeAlign:options.strokeAlign??this.strokeAlign}),options.color===undefined?borderColor(this):new Color(options.color));}
  scale(t:number):BorderSide{return retainBorderColor(new BorderSide({color:this.color,width:Math.max(0,this.width*t),style:t<=0?'none':this.style}),borderColor(this));}
  toPaint():Paint{const paint=new Paint();paint.color=this.style==='none'?0:this.color;paint.strokeWidth=this.style==='none'?0:this.width;paint.style='stroke';return paint;}
  static canMerge(a:BorderSide,b:BorderSide):boolean{return a.empty||b.empty||borderColor(a).equals(borderColor(b))&&a.style===b.style;}
  private get empty():boolean{return this.style==='none'&&this.width===0;}
  static merge(a:BorderSide,b:BorderSide):BorderSide{invariant(this.canMerge(a,b),'incompatible-border','Border sides cannot merge');if(a.empty&&b.empty)return this.none;if(a.empty)return b;if(b.empty)return a;return retainBorderColor(new BorderSide({color:a.color,width:a.width+b.width,style:a.style,strokeAlign:Math.max(a.strokeAlign,b.strokeAlign)}),borderColor(a));}
  static lerp(a:BorderSide,b:BorderSide,t:number):BorderSide{if(a===b||t===0)return a;if(t===1)return b;const width=a.width*(1-t)+b.width*t;if(width<0)return this.none;const same=a.style===b.style&&a.strokeAlign===b.strokeAlign;const color=Color.lerp(same||a.style==='solid'?borderColor(a):borderColor(a).withAlpha(0),same||b.style==='solid'?borderColor(b):borderColor(b).withAlpha(0),t)!;return retainBorderColor(new BorderSide({color:color.toARGB32(),width,style:same?a.style:'solid',strokeAlign:a.strokeAlign===b.strokeAlign?a.strokeAlign:a.strokeAlign*(1-t)+b.strokeAlign*t}),color);}
  get strokeInset():number{return this.width*(1-(1+this.strokeAlign)/2);}get strokeOutset():number{return this.width*(1+this.strokeAlign)/2;}get strokeOffset():number{return this.width*this.strokeAlign;}
  equals(other:unknown):boolean{return other instanceof BorderSide&&other.constructor===this.constructor&&borderColor(other).equals(borderColor(this))&&other.width===this.width&&other.style===this.style&&other.strokeAlign===this.strokeAlign;}
  get hashCode():number{return hashValues(borderColor(this),this.width,this.style,this.strokeAlign);}
  toStringShort():string{return 'BorderSide';}
  toString():string{return `BorderSide(color: 0x${this.color.toString(16).padStart(8,'0')}, width: ${this.width}, style: ${this.style}, strokeAlign: ${this.strokeAlign})`;}
}
export interface ShapeBorderOptions {readonly textDirection?:'ltr'|'rtl'|null}
export abstract class ShapeBorder {
  abstract get dimensions():EdgeInsetsGeometry;
  add(_other:ShapeBorder,_options:{readonly reversed?:boolean}={}):ShapeBorder|null{return null;}
  plus(other:ShapeBorder):ShapeBorder{return this.add(other)??other.add(this,{reversed:true})??new _CompoundBorder([other,this]);}
  abstract scale(t:number):ShapeBorder;
  lerpFrom(a:ShapeBorder|null,t:number):ShapeBorder|null{return a===null?this.scale(t):null;}
  lerpTo(b:ShapeBorder|null,t:number):ShapeBorder|null{return b===null?this.scale(1-t):null;}
  static lerp(a:ShapeBorder|null,b:ShapeBorder|null,t:number):ShapeBorder|null{if(a===b)return a;return b?.lerpFrom(a,t)??a?.lerpTo(b,t)??b?.lerpTo(a,1-t)??a?.lerpFrom(b,1-t)??(t<.5?a:b);}
  abstract getOuterPath(rect:Rect,options?:ShapeBorderOptions):Path;
  abstract getInnerPath(rect:Rect,options?:ShapeBorderOptions):Path;
  hitTest(_rect:Rect,_position:Offset,_options:ShapeBorderOptions={}):boolean{throw new Error('General Path.contains is not implemented; this shape must provide hitTest');}
  get preferPaintInterior():boolean{return false;}
  paintInterior(_canvas:Canvas,_rect:Rect,_paint:Paint,_options:ShapeBorderOptions={}):void{throw new Error(`${this.constructor.name} does not support paintInterior`);}
  abstract paint(canvas:Canvas,rect:Rect,options?:ShapeBorderOptions):void;
  toString():string{return `${this.constructor.name}()`;}
}
export abstract class OutlinedBorder extends ShapeBorder {
  constructor(readonly side:BorderSide=BorderSide.none){super();}
  get dimensions():EdgeInsetsGeometry{return EdgeInsets.all(Math.max(this.side.strokeInset,0));}
  abstract copyWith(options?:{readonly side?:BorderSide}):OutlinedBorder;
  static override lerp(a:OutlinedBorder|null,b:OutlinedBorder|null,t:number):OutlinedBorder|null{const value=ShapeBorder.lerp(a,b,t);invariant(value===null||value instanceof OutlinedBorder,'invalid-shape-lerp','OutlinedBorder interpolation returned another shape type');return value;}
}
class _CompoundBorder extends ShapeBorder {
  constructor(readonly borders:readonly ShapeBorder[]){super();invariant(borders.length>=2&&!borders.some(x=>x instanceof _CompoundBorder),'invalid-compound-border','Compound borders require two or more flattened shapes');}
  get dimensions():EdgeInsetsGeometry{return this.borders.reduce((result,border)=>result.add(border.dimensions),EdgeInsets.zero as EdgeInsetsGeometry);}
  override add(other:ShapeBorder,{reversed=false}:{readonly reversed?:boolean}={}):ShapeBorder{if(!(other instanceof _CompoundBorder)){const index=reversed?this.borders.length-1:0,ours=this.borders[index]!,merged=ours.add(other,{reversed})??other.add(ours,{reversed:!reversed});if(merged){const result=[...this.borders];result[index]=merged;return new _CompoundBorder(result);}}const added=other instanceof _CompoundBorder?other.borders:[other];return new _CompoundBorder(reversed?[...this.borders,...added]:[...added,...this.borders]);}
  scale(t:number):ShapeBorder{return new _CompoundBorder(this.borders.map(x=>x.scale(t)));}
  override lerpFrom(a:ShapeBorder|null,t:number):ShapeBorder{return _CompoundBorder.lerp(a,this,t)!;}
  override lerpTo(b:ShapeBorder|null,t:number):ShapeBorder{return _CompoundBorder.lerp(this,b,t)!;}
  static override lerp(a:ShapeBorder|null,b:ShapeBorder|null,t:number):ShapeBorder|null{const aa=a instanceof _CompoundBorder?a.borders:[a],bb=b instanceof _CompoundBorder?b.borders:[b],result:ShapeBorder[]=[];for(let i=0;i<Math.max(aa.length,bb.length);i++){const x=aa[i],y=bb[i],value=x&&y?(x.lerpTo(y,t)??y.lerpFrom(x,t)):null;if(value)result.push(value);else{if(y)result.push(y.scale(t));if(x)result.push(x.scale(1-t));}}return result.length===1?result[0]!:result.length===0?null:new _CompoundBorder(result);}
  getOuterPath(rect:Rect,options:ShapeBorderOptions={}):Path{return this.borders[0]!.getOuterPath(rect,options);}
  getInnerPath(rect:Rect,options:ShapeBorderOptions={}):Path{for(const border of this.borders.slice(0,-1))rect=border.dimensions.resolve(options.textDirection??null).deflateRect(rect);return this.borders[this.borders.length-1]!.getInnerPath(rect,options);}
  override hitTest(rect:Rect,point:Offset,options:ShapeBorderOptions={}):boolean{return this.borders[0]!.hitTest(rect,point,options);}
  override get preferPaintInterior():boolean{return this.borders.every(x=>x.preferPaintInterior);}
  override paintInterior(canvas:Canvas,rect:Rect,paint:Paint,options:ShapeBorderOptions={}):void{this.borders[0]!.paintInterior(canvas,rect,paint,options);}
  paint(canvas:Canvas,rect:Rect,options:ShapeBorderOptions={}):void{for(const border of this.borders){border.paint(canvas,rect,options);rect=border.dimensions.resolve(options.textDirection??null).deflateRect(rect);}}
  equals(other:unknown):boolean{return other instanceof _CompoundBorder&&listEquals(this.borders,other.borders);}
  get hashCode():number{return hashValues(this.borders);}
  override toString():string{return [...this.borders].reverse().join(' + ');}
}
export interface PhysicalBorderSides {readonly top?:BorderSide;readonly right?:BorderSide;readonly bottom?:BorderSide;readonly left?:BorderSide}
export function paintBorder(canvas:Canvas,rect:Rect,{top=BorderSide.none,right=BorderSide.none,bottom=BorderSide.none,left=BorderSide.none}:PhysicalBorderSides={}):void{
  const l=rect.left,r=rect.right,t=rect.top,b=rect.bottom;
  const sides:readonly [BorderSide,readonly number[]][]=[[top,[l,t,r,t,r-right.width,t+top.width,l+left.width,t+top.width]],[right,[r,t,r,b,r-right.width,b-bottom.width,r-right.width,t+top.width]],[bottom,[r,b,l,b,l+left.width,b-bottom.width,r-right.width,b-bottom.width]],[left,[l,b,l,t,l+left.width,t+top.width,l+left.width,b-bottom.width]]];
  for(const [side,points] of sides){if(side.style==='none')continue;const path=new Path(),paint=new Paint();paint.color=side.color;paint.strokeWidth=0;paint.style=side.width===0?'stroke':'fill';path.moveTo(points[0]!,points[1]!);path.lineTo(points[2]!,points[3]!);if(side.width!==0){path.lineTo(points[4]!,points[5]!);path.lineTo(points[6]!,points[7]!);}canvas.drawPath(path,paint);}
}
