// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter animation/tween.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {Animation} from './animation.ts';
import type {AnimationStatus,AnimationStatusListener} from './animation.ts';
import type {Curve} from './curves.ts';
import {Color} from '../../ui/color.ts';
import {Offset} from '../../ui/offset.ts';
import {Size} from '../../ui/size.ts';
import {Rect} from '../../ui/rect.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {objectRuntimeType} from '../../foundation/object.ts';

export type AnimatableCallback<T>=(value:number)=>T;
export abstract class Animatable<T> {
  static fromCallback<T>(callback:AnimatableCallback<T>):Animatable<T>{return new CallbackAnimatable(callback);}
  abstract transform(t:number):T;
  evaluate(animation:Animation<number>):T{return this.transform(animation.value);}
  animate(parent:Animation<number>):Animation<T>{return new AnimatedEvaluation(parent,this);}
  chain(parent:Animatable<number>):Animatable<T>{return new ChainedEvaluation(parent,this);}
}
class CallbackAnimatable<T> extends Animatable<T> {constructor(private readonly callback:AnimatableCallback<T>){super();}transform(t:number):T{return this.callback(t);}}
class AnimatedEvaluation<T> extends Animation<T> {
  constructor(readonly parent:Animation<number>,private readonly evaluatable:Animatable<T>){super();}
  addListener(listener:()=>void):void{this.parent.addListener(listener);}removeListener(listener:()=>void):void{this.parent.removeListener(listener);}
  addStatusListener(listener:AnimationStatusListener):void{this.parent.addStatusListener(listener);}removeStatusListener(listener:AnimationStatusListener):void{this.parent.removeStatusListener(listener);}
  get status():AnimationStatus{return this.parent.status;}get value():T{return this.evaluatable.evaluate(this.parent);}
  override toString():string{return `${this.parent}➩${this.evaluatable}➩${this.value}`;}
  override toStringDetails():string{return `${super.toStringDetails()} ${this.evaluatable}`;}
}
class ChainedEvaluation<T> extends Animatable<T> {
  constructor(private readonly parent:Animatable<number>,private readonly evaluatable:Animatable<T>){super();}
  transform(t:number):T{return this.evaluatable.transform(this.parent.transform(t));}
  toString():string{return `${this.parent}➩${this.evaluatable}`;}
}
/** Explicit adapter for Dart's user-defined +, -, * operators, which JS cannot overload. */
export type TweenInterpolator<T>=(begin:T,end:T,t:number)=>T;
export interface TweenOptions<T> {readonly begin?:T|null;readonly end?:T|null;readonly interpolator?:TweenInterpolator<T>}
export class Tween<T=number> extends Animatable<T> {
  begin:T|null;end:T|null;
  private readonly interpolator:TweenInterpolator<T>|undefined;
  constructor({begin=null,end=null,interpolator}:TweenOptions<T>={}){super();this.begin=begin;this.end=end;this.interpolator=interpolator;}
  lerp(t:number):T {
    invariant(this.begin!==null&&this.end!==null,'null-tween-endpoint','Tween.lerp requires non-null endpoints');
    if(this.interpolator)return this.interpolator(this.begin,this.end,t);
    const a=this.begin,b=this.end;
    if(typeof a==='number'&&typeof b==='number')return (a+(b-a)*t) as T;
    if(a instanceof Offset&&b instanceof Offset)return a.add(b.subtract(a).multiply(t)) as T;
    if(a instanceof Size&&b instanceof Size)return a.add(b.subtract(a).multiply(t)) as T;
    throw new FlutterError(`Cannot lerp between "${a}" and "${b}".\nUse the dedicated ColorTween, RectTween, IntTween or StepTween, or provide a Tween interpolator for custom Dart operators.`);
  }
  transform(t:number):T{return t===0?this.begin as T:t===1?this.end as T:this.lerp(t);}
  toString():string{return `${objectRuntimeType(this,'Animatable')}(${this.begin} → ${this.end})`;}
}
export class ReverseTween<T> extends Tween<T> {
  constructor(readonly parent:Tween<T>){super({begin:parent.end,end:parent.begin});}
  override lerp(t:number):T{return this.parent.lerp(1-t);}
}
export class ColorTween extends Tween<Color|null> {override lerp(t:number):Color|null{return Color.lerp(this.begin,this.end,t);}}
export class SizeTween extends Tween<Size|null> {override lerp(t:number):Size|null{return Size.lerp(this.begin,this.end,t);}}
export class RectTween extends Tween<Rect|null> {override lerp(t:number):Rect|null{return Rect.lerp(this.begin,this.end,t);}}
function integerTweenValue(begin:number|null,end:number|null,t:number,floor:boolean):number {
  invariant(begin!==null&&end!==null&&Number.isSafeInteger(begin)&&Number.isSafeInteger(end),'inexact-integer-tween','Numeric IntTween and StepTween require exact integer endpoints');
  const value=begin+(end-begin)*t,result=floor?Math.floor(value):value<0?-Math.floor(-value+0.5):Math.floor(value+0.5);
  invariant(Number.isSafeInteger(result),'inexact-integer-tween','Numeric integer interpolation exceeded the exact number range');return result===0?0:result;
}
export class IntTween extends Tween<number> {override lerp(t:number):number{return integerTweenValue(this.begin,this.end,t,false);}}
export class StepTween extends Tween<number> {override lerp(t:number):number{return integerTweenValue(this.begin,this.end,t,true);}}
export class ConstantTween<T> extends Tween<T> {
  constructor(value:T){super({begin:value,end:value});}
  override lerp(_t:number):T{return this.begin as T;}
  override toString():string{return `${objectRuntimeType(this,'ConstantTween')}(value: ${this.begin})`;}
}
export class CurveTween extends Animatable<number> {
  curve:Curve;constructor({curve}:{readonly curve:Curve}){super();this.curve=curve;}
  transform(t:number):number {
    if(t===0||t===1){if(FoundationBuildMode.debug){const value=this.curve.transform(t),rounded=value<0?-Math.floor(-value+0.5):Math.floor(value+0.5);invariant(rounded===t,'invalid-curve-tween-endpoint','CurveTween requires curves mapping endpoints near 0 and 1');}return t;}
    return this.curve.transform(t);
  }
  toString():string{return `${objectRuntimeType(this,'CurveTween')}(curve: ${this.curve})`;}
}
