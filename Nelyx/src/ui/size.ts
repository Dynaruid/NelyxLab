// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui geometry.dart at the recorded upstream pin.
import {invariant} from '../foundation/errors.ts';
import {OffsetBase} from './offset-base.ts';
import {Offset} from './offset.ts';
import {lerp,modulo,truncateDivide,fixed} from './value-math.ts';

/** Immutable extent. Negative and nonfinite values are valid CPU geometry. */
export class Size extends OffsetBase {
  constructor(width:number,height:number) {super(width,height);}
  static copy(source:Size):Size {return new Size(source.width,source.height);}
  static square(dimension:number):Size {return new Size(dimension,dimension);}
  static fromWidth(width:number):Size {return new Size(width,Infinity);}
  static fromHeight(height:number):Size {return new Size(Infinity,height);}
  static fromRadius(radius:number):Size {return new Size(radius*2,radius*2);}
  static readonly zero=new Size(0,0);
  static readonly infinite=new Size(Infinity,Infinity);
  get width():number {return this.horizontal;}
  get height():number {return this.vertical;}
  get aspectRatio():number {if(this.height!==0)return this.width/this.height;if(this.width>0)return Infinity;if(this.width<0)return -Infinity;return 0;}
  get isEmpty():boolean {return this.width<=0||this.height<=0;}
  subtract(other:Size):Offset;
  subtract(other:Offset):Size;
  subtract(other:OffsetBase):OffsetBase;
  subtract(other:OffsetBase):OffsetBase {
    if(other instanceof Size)return new Offset(this.width-other.width,this.height-other.height);
    invariant(other instanceof Offset,'invalid-size-subtract','Size subtraction requires a Size or Offset');
    return new Size(this.width-other.dx,this.height-other.dy);
  }
  add(other:Offset):Size {return new Size(this.width+other.dx,this.height+other.dy);}
  multiply(operand:number):Size {return new Size(this.width*operand,this.height*operand);}
  divide(operand:number):Size {return new Size(this.width/operand,this.height/operand);}
  truncateDivide(operand:number):Size {return new Size(truncateDivide(this.width,operand),truncateDivide(this.height,operand));}
  modulo(operand:number):Size {return new Size(modulo(this.width,operand),modulo(this.height,operand));}
  get shortestSide():number {return Math.min(Math.abs(this.width),Math.abs(this.height));}
  get longestSide():number {return Math.max(Math.abs(this.width),Math.abs(this.height));}
  topLeft(origin:Offset):Offset {return origin;}
  topCenter(origin:Offset):Offset {return new Offset(origin.dx+this.width/2,origin.dy);}
  topRight(origin:Offset):Offset {return new Offset(origin.dx+this.width,origin.dy);}
  centerLeft(origin:Offset):Offset {return new Offset(origin.dx,origin.dy+this.height/2);}
  center(origin:Offset):Offset {return new Offset(origin.dx+this.width/2,origin.dy+this.height/2);}
  centerRight(origin:Offset):Offset {return new Offset(origin.dx+this.width,origin.dy+this.height/2);}
  bottomLeft(origin:Offset):Offset {return new Offset(origin.dx,origin.dy+this.height);}
  bottomCenter(origin:Offset):Offset {return new Offset(origin.dx+this.width/2,origin.dy+this.height);}
  bottomRight(origin:Offset):Offset {return new Offset(origin.dx+this.width,origin.dy+this.height);}
  contains(offset:Offset):boolean {return offset.dx>=0&&offset.dx<this.width&&offset.dy>=0&&offset.dy<this.height;}
  get flipped():Size {return new Size(this.height,this.width);}
  static lerp(a:Size|null,b:Size|null,t:number):Size|null {
    if(b===null)return a===null?null:a.multiply(1-t);
    if(a===null)return b.multiply(t);
    return new Size(lerp(a.width,b.width,t),lerp(a.height,b.height,t));
  }
  override equals(other:unknown):boolean {return other instanceof Size&&other.width===this.width&&other.height===this.height;}
  override toString():string {return `Size(${fixed(this.width)}, ${fixed(this.height)})`;}
}
