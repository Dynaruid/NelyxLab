// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter painting/border_radius.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';
import {Radius} from '../../ui/radius.ts';
import {RRect} from '../../ui/rrect.ts';
import type {Rect} from '../../ui/types.ts';
import {hashDoubles,fixed,protect} from '../../ui/value-math.ts';
export interface BorderRadiusOptions {readonly topLeft?:Radius;readonly topRight?:Radius;readonly bottomLeft?:Radius;readonly bottomRight?:Radius;readonly topStart?:Radius;readonly topEnd?:Radius;readonly bottomStart?:Radius;readonly bottomEnd?:Radius}
export interface BorderRadiusHorizontalOptions {readonly left?:Radius;readonly right?:Radius;readonly start?:Radius;readonly end?:Radius}
export interface BorderRadiusVerticalOptions {readonly top?:Radius;readonly bottom?:Radius}
type Components=readonly [Radius,Radius,Radius,Radius,Radius,Radius,Radius,Radius];
type Direction='ltr'|'rtl'|null;
const visual=['topLeft','topRight','bottomLeft','bottomRight'] as const,logical=['topStart','topEnd','bottomStart','bottomEnd'] as const;
function radius(value:Radius|undefined):Radius {const r=value===undefined?Radius.zero:value;invariant(r instanceof Radius,'invalid-border-radius','Corner values must be Radius instances');return r;}
function options(value:object,keys:readonly string[]):void {invariant(Object.keys(value).every(k=>keys.includes(k)),'unsupported-border-radius','Unknown or incompatible corner option');}
function direction(value:Direction):'ltr'|'rtl' {invariant(value==='ltr'||value==='rtl','missing-text-direction','A directional border radius requires ltr or rtl');return value;}
export abstract class BorderRadiusGeometry {
  protected abstract get components():Components;
  protected componentAt(index:number):Radius{return this.components[index]!;}
  protected get _topLeft():Radius{return this.componentAt(0);}protected get _topRight():Radius{return this.componentAt(1);}protected get _bottomLeft():Radius{return this.componentAt(2);}protected get _bottomRight():Radius{return this.componentAt(3);}
  protected get _topStart():Radius{return this.componentAt(4);}protected get _topEnd():Radius{return this.componentAt(5);}protected get _bottomStart():Radius{return this.componentAt(6);}protected get _bottomEnd():Radius{return this.componentAt(7);}
  protected abstract map(operation:(radius:Radius)=>Radius):BorderRadiusGeometry;
  static all(value:Radius):BorderRadiusGeometry {return BorderRadius.all(value);}
  static circular(value:number):BorderRadiusGeometry {return BorderRadius.circular(value);}
  static only(value:BorderRadiusOptions={}):BorderRadiusGeometry {return BorderRadius.only(value);}
  static directional(value:BorderRadiusOptions={}):BorderRadiusGeometry {return BorderRadiusDirectional.only(value);}
  static vertical(value:BorderRadiusVerticalOptions={}):BorderRadiusGeometry {return BorderRadius.vertical(value);}
  static horizontal(value:BorderRadiusHorizontalOptions={}):BorderRadiusGeometry {options(value,['left','right','start','end']);invariant((value.left===undefined&&value.right===undefined)||(value.start===undefined&&value.end===undefined),'mixed-border-radius','Cannot combine left/right with start/end');return value.start!==undefined||value.end!==undefined?BorderRadiusDirectional.horizontal(value):BorderRadius.horizontal(value);}
  static get zero():BorderRadiusGeometry {return BorderRadius.zero;}
  subtract(other:BorderRadiusGeometry):BorderRadiusGeometry {return new MixedBorderRadius(Array.from({length:8},(_,i)=>this.componentAt(i).subtract(other.componentAt(i))) as unknown as Components);}
  add(other:BorderRadiusGeometry):BorderRadiusGeometry {return new MixedBorderRadius(Array.from({length:8},(_,i)=>this.componentAt(i).add(other.componentAt(i))) as unknown as Components);}
  negate():BorderRadiusGeometry {return this.map(r=>r.negate());}
  multiply(value:number):BorderRadiusGeometry {return this.map(r=>r.multiply(value));}
  divide(value:number):BorderRadiusGeometry {return this.map(r=>r.divide(value));}
  truncateDivide(value:number):BorderRadiusGeometry {return this.map(r=>r.truncateDivide(value));}
  modulo(value:number):BorderRadiusGeometry {return this.map(r=>r.modulo(value));}
  static lerp(a:BorderRadiusGeometry|null,b:BorderRadiusGeometry|null,t:number):BorderRadiusGeometry|null {if(a===b)return a;a??=BorderRadius.zero;b??=BorderRadius.zero;return a.add(b.subtract(a).multiply(t));}
  abstract resolve(value:Direction):BorderRadius;
  equals(other:unknown):boolean {if(this===other)return true;if(!(other instanceof BorderRadiusGeometry)||this.constructor!==other.constructor)return false;for(let i=0;i<8;i++)if(!other.componentAt(i).equals(this.componentAt(i)))return false;return true;}
  get hashCode():number {return hashDoubles(this.components.flatMap(r=>[r.x,r.y]));}
  toString():string {
    const c=this.components,describe=(values:readonly Radius[],keys:readonly string[],name:string):string|undefined=>{const first=values[0]!;if(values.every(r=>r.equals(first))){if(first.equals(Radius.zero))return undefined;return first.x===first.y?`${name}.circular(${fixed(first.x)})`:`${name}.all(${first})`;}return `${name}.only(${values.flatMap((r,i)=>r.equals(Radius.zero)?[]:[`${keys[i]}: ${r}`]).join(', ')})`;};
    const a=describe(c.slice(0,4),visual,'BorderRadius'),b=describe(c.slice(4),logical,'BorderRadiusDirectional');return a&&b?`${a} + ${b}`:a??b??'BorderRadius.zero';
  }
}
export class BorderRadius extends BorderRadiusGeometry {
  readonly #corners:readonly [Radius,Radius,Radius,Radius];
  constructor(value:BorderRadiusOptions={}){super();options(value,visual);this.#corners=Object.freeze([radius(value.topLeft),radius(value.topRight),radius(value.bottomLeft),radius(value.bottomRight)]);}
  get topLeft():Radius{return this.#corners[0];}get topRight():Radius{return this.#corners[1];}get bottomLeft():Radius{return this.#corners[2];}get bottomRight():Radius{return this.#corners[3];}
  static override only(value:BorderRadiusOptions={}):BorderRadius {return new BorderRadius(value);}
  static override all(value:Radius):BorderRadius {return new BorderRadius({topLeft:value,topRight:value,bottomLeft:value,bottomRight:value});}
  static override circular(value:number):BorderRadius {return BorderRadius.all(Radius.circular(value));}
  static override vertical(value:BorderRadiusVerticalOptions={}):BorderRadius {options(value,['top','bottom']);return new BorderRadius({topLeft:radius(value.top),topRight:radius(value.top),bottomLeft:radius(value.bottom),bottomRight:radius(value.bottom)});}
  static override horizontal(value:BorderRadiusHorizontalOptions={}):BorderRadius {options(value,['left','right']);return new BorderRadius({topLeft:radius(value.left),bottomLeft:radius(value.left),topRight:radius(value.right),bottomRight:radius(value.right)});}
  static override get zero():BorderRadius {return physicalZero;}
  protected get components():Components {return [this.topLeft,this.topRight,this.bottomLeft,this.bottomRight,Radius.zero,Radius.zero,Radius.zero,Radius.zero];}
  protected override componentAt(index:number):Radius {switch(index){case 0:return this.topLeft;case 1:return this.topRight;case 2:return this.bottomLeft;case 3:return this.bottomRight;default:return Radius.zero;}}
  protected map(operation:(radius:Radius)=>Radius):BorderRadius {return new BorderRadius({topLeft:operation(this.topLeft),topRight:operation(this.topRight),bottomLeft:operation(this.bottomLeft),bottomRight:operation(this.bottomRight)});}
  copyWith(value:{readonly topLeft?:Radius|null;readonly topRight?:Radius|null;readonly bottomLeft?:Radius|null;readonly bottomRight?:Radius|null}={}):BorderRadius {options(value,visual);return new BorderRadius({topLeft:value.topLeft??this.topLeft,topRight:value.topRight??this.topRight,bottomLeft:value.bottomLeft??this.bottomLeft,bottomRight:value.bottomRight??this.bottomRight});}
  toRRect(value:Rect):RRect {return RRect.fromRectAndCorners(value,{topLeft:this.topLeft.clamp({minimum:Radius.zero}),topRight:this.topRight.clamp({minimum:Radius.zero}),bottomLeft:this.bottomLeft.clamp({minimum:Radius.zero}),bottomRight:this.bottomRight.clamp({minimum:Radius.zero})});}
  override add(other:BorderRadius):BorderRadius;
  override add(other:BorderRadiusGeometry):BorderRadiusGeometry;
  override add(other:BorderRadiusGeometry):BorderRadiusGeometry {return other instanceof BorderRadius?new BorderRadius({topLeft:this.topLeft.add(other.topLeft),topRight:this.topRight.add(other.topRight),bottomLeft:this.bottomLeft.add(other.bottomLeft),bottomRight:this.bottomRight.add(other.bottomRight)}):super.add(other);}
  override subtract(other:BorderRadius):BorderRadius;
  override subtract(other:BorderRadiusGeometry):BorderRadiusGeometry;
  override subtract(other:BorderRadiusGeometry):BorderRadiusGeometry {return other instanceof BorderRadius?new BorderRadius({topLeft:this.topLeft.subtract(other.topLeft),topRight:this.topRight.subtract(other.topRight),bottomLeft:this.bottomLeft.subtract(other.bottomLeft),bottomRight:this.bottomRight.subtract(other.bottomRight)}):super.subtract(other);}
  override negate():BorderRadius {return this.map(r=>r.negate());}override multiply(v:number):BorderRadius {return this.map(r=>r.multiply(v));}override divide(v:number):BorderRadius {return this.map(r=>r.divide(v));}override truncateDivide(v:number):BorderRadius {return this.map(r=>r.truncateDivide(v));}override modulo(v:number):BorderRadius {return this.map(r=>r.modulo(v));}
  static override lerp(a:BorderRadius|null,b:BorderRadius|null,t:number):BorderRadius|null {if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);return new BorderRadius({topLeft:Radius.lerp(a.topLeft,b.topLeft,t)!,topRight:Radius.lerp(a.topRight,b.topRight,t)!,bottomLeft:Radius.lerp(a.bottomLeft,b.bottomLeft,t)!,bottomRight:Radius.lerp(a.bottomRight,b.bottomRight,t)!});}
  resolve(_value:Direction):BorderRadius {return this;}
}
export class BorderRadiusDirectional extends BorderRadiusGeometry {
  readonly #corners:readonly [Radius,Radius,Radius,Radius];
  constructor(value:BorderRadiusOptions={}){super();options(value,logical);this.#corners=Object.freeze([radius(value.topStart),radius(value.topEnd),radius(value.bottomStart),radius(value.bottomEnd)]);}
  get topStart():Radius{return this.#corners[0];}get topEnd():Radius{return this.#corners[1];}get bottomStart():Radius{return this.#corners[2];}get bottomEnd():Radius{return this.#corners[3];}
  static override only(value:BorderRadiusOptions={}):BorderRadiusDirectional {return new BorderRadiusDirectional(value);}
  static override all(value:Radius):BorderRadiusDirectional {return new BorderRadiusDirectional({topStart:value,topEnd:value,bottomStart:value,bottomEnd:value});}
  static override circular(value:number):BorderRadiusDirectional {return BorderRadiusDirectional.all(Radius.circular(value));}
  static override vertical(value:BorderRadiusVerticalOptions={}):BorderRadiusDirectional {options(value,['top','bottom']);return new BorderRadiusDirectional({topStart:radius(value.top),topEnd:radius(value.top),bottomStart:radius(value.bottom),bottomEnd:radius(value.bottom)});}
  static override horizontal(value:BorderRadiusHorizontalOptions={}):BorderRadiusDirectional {options(value,['start','end']);return new BorderRadiusDirectional({topStart:radius(value.start),bottomStart:radius(value.start),topEnd:radius(value.end),bottomEnd:radius(value.end)});}
  static override get zero():BorderRadiusDirectional {return directionalZero;}
  protected get components():Components {return [Radius.zero,Radius.zero,Radius.zero,Radius.zero,this.topStart,this.topEnd,this.bottomStart,this.bottomEnd];}
  protected override componentAt(index:number):Radius {switch(index){case 4:return this.topStart;case 5:return this.topEnd;case 6:return this.bottomStart;case 7:return this.bottomEnd;default:return Radius.zero;}}
  protected map(operation:(radius:Radius)=>Radius):BorderRadiusDirectional {return new BorderRadiusDirectional({topStart:operation(this.topStart),topEnd:operation(this.topEnd),bottomStart:operation(this.bottomStart),bottomEnd:operation(this.bottomEnd)});}
  override add(other:BorderRadiusDirectional):BorderRadiusDirectional;
  override add(other:BorderRadiusGeometry):BorderRadiusGeometry;
  override add(other:BorderRadiusGeometry):BorderRadiusGeometry {return other instanceof BorderRadiusDirectional?new BorderRadiusDirectional({topStart:this.topStart.add(other.topStart),topEnd:this.topEnd.add(other.topEnd),bottomStart:this.bottomStart.add(other.bottomStart),bottomEnd:this.bottomEnd.add(other.bottomEnd)}):super.add(other);}
  override subtract(other:BorderRadiusDirectional):BorderRadiusDirectional;
  override subtract(other:BorderRadiusGeometry):BorderRadiusGeometry;
  override subtract(other:BorderRadiusGeometry):BorderRadiusGeometry {return other instanceof BorderRadiusDirectional?new BorderRadiusDirectional({topStart:this.topStart.subtract(other.topStart),topEnd:this.topEnd.subtract(other.topEnd),bottomStart:this.bottomStart.subtract(other.bottomStart),bottomEnd:this.bottomEnd.subtract(other.bottomEnd)}):super.subtract(other);}
  override negate():BorderRadiusDirectional {return this.map(r=>r.negate());}override multiply(v:number):BorderRadiusDirectional {return this.map(r=>r.multiply(v));}override divide(v:number):BorderRadiusDirectional {return this.map(r=>r.divide(v));}override truncateDivide(v:number):BorderRadiusDirectional {return this.map(r=>r.truncateDivide(v));}override modulo(v:number):BorderRadiusDirectional {return this.map(r=>r.modulo(v));}
  static override lerp(a:BorderRadiusDirectional|null,b:BorderRadiusDirectional|null,t:number):BorderRadiusDirectional|null {if(a===b)return a;if(a===null)return b!.multiply(t);if(b===null)return a.multiply(1-t);return new BorderRadiusDirectional({topStart:Radius.lerp(a.topStart,b.topStart,t)!,topEnd:Radius.lerp(a.topEnd,b.topEnd,t)!,bottomStart:Radius.lerp(a.bottomStart,b.bottomStart,t)!,bottomEnd:Radius.lerp(a.bottomEnd,b.bottomEnd,t)!});}
  resolve(value:Direction):BorderRadius {return direction(value)==='rtl'?new BorderRadius({topLeft:this.topEnd,topRight:this.topStart,bottomLeft:this.bottomEnd,bottomRight:this.bottomStart}):new BorderRadius({topLeft:this.topStart,topRight:this.topEnd,bottomLeft:this.bottomStart,bottomRight:this.bottomEnd});}
}
class MixedBorderRadius extends BorderRadiusGeometry {
  protected readonly components:Components;
  constructor(values:Components){super();this.components=Object.freeze([...values]) as Components;protect(this,['components']);}
  protected map(operation:(radius:Radius)=>Radius):MixedBorderRadius {return new MixedBorderRadius(this.components.map(operation) as unknown as Components);}
  resolve(value:Direction):BorderRadius {const c=this.components;return direction(value)==='rtl'?new BorderRadius({topLeft:c[0].add(c[5]),topRight:c[1].add(c[4]),bottomLeft:c[2].add(c[7]),bottomRight:c[3].add(c[6])}):new BorderRadius({topLeft:c[0].add(c[4]),topRight:c[1].add(c[5]),bottomLeft:c[2].add(c[6]),bottomRight:c[3].add(c[7])});}
}
// Keep an own getter when RN Babel lowers class fields using assignment semantics.
const physicalZero=BorderRadius.all(Radius.zero);
const directionalZero=BorderRadiusDirectional.all(Radius.zero);
