// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter animation/animation_style.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {Curve,Curves} from './curves.ts';
import {invariant} from '../../foundation/errors.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
import {DiagnosticsProperty,DiagnosticableNode} from '../../foundation/diagnostics.ts';
import type {Diagnosticable,DiagnosticsNode,DiagnosticsOptions,DiagnosticPropertiesBuilder,DiagnosticsStringOptions} from '../../foundation/diagnostics.ts';
import {hashDoubles,protect} from '../../ui/value-math.ts';
export interface AnimationStyleOptions {readonly curve?:Curve|null;readonly duration?:number|null;readonly reverseCurve?:Curve|null;readonly reverseDuration?:number|null}
/** Durations use milliseconds, retaining microsecond precision at Source interpolation. */
export class AnimationStyle implements Diagnosticable {
  static readonly noAnimation=new AnimationStyle({duration:0,reverseDuration:0});
  readonly curve:Curve|null;readonly duration:number|null;readonly reverseCurve:Curve|null;readonly reverseDuration:number|null;
  constructor({curve=null,duration=null,reverseCurve=null,reverseDuration=null}:AnimationStyleOptions={}){this.curve=curve;this.duration=duration;this.reverseCurve=reverseCurve;this.reverseDuration=reverseDuration;protect(this,['curve','duration','reverseCurve','reverseDuration']);}
  copyWith({curve=null,duration=null,reverseCurve=null,reverseDuration=null}:AnimationStyleOptions={}):AnimationStyle{return new AnimationStyle({curve:curve??this.curve,duration:duration??this.duration,reverseCurve:reverseCurve??this.reverseCurve,reverseDuration:reverseDuration??this.reverseDuration});}
  merge(other:AnimationStyle|null):AnimationStyle{return other===null?this:this.copyWith(other);}
  static lerp(a:AnimationStyle|null,b:AnimationStyle|null,t:number):AnimationStyle|null {
    if(a===b)return a;
    return new AnimationStyle({curve:interpolate(a?.curve??null,b?.curve??null,t,(a,b,t)=>new LerpedCurve(a,b,t)),duration:interpolate(a?.duration??null,b?.duration??null,t,lerpDuration),reverseCurve:interpolate(a?.reverseCurve??null,b?.reverseCurve??null,t,(a,b,t)=>new LerpedCurve(a,b,t)),reverseDuration:interpolate(a?.reverseDuration??null,b?.reverseDuration??null,t,lerpDuration)});
  }
  equals(other:unknown):boolean{return this===other||other instanceof AnimationStyle&&other.constructor===this.constructor&&equalCurve(other.curve,this.curve)&&other.duration===this.duration&&equalCurve(other.reverseCurve,this.reverseCurve)&&other.reverseDuration===this.reverseDuration;}
  get hashCode():number{return hashDoubles([curveHash(this.curve),this.duration??NaN,curveHash(this.reverseCurve),this.reverseDuration??NaN]);}
  debugFillProperties(properties:DiagnosticPropertiesBuilder):void{properties.add(new DiagnosticsProperty('curve',this.curve,{defaultValue:null}));properties.add(new DiagnosticsProperty('duration',this.duration,{defaultValue:null}));properties.add(new DiagnosticsProperty('reverseCurve',this.reverseCurve,{defaultValue:null}));properties.add(new DiagnosticsProperty('reverseDuration',this.reverseDuration,{defaultValue:null}));}
  toDiagnosticsNode(options:DiagnosticsOptions={}):DiagnosticsNode{return new DiagnosticableNode(this,options);}
  toStringShort():string{return describeIdentity(this);}
  toString(options:DiagnosticsStringOptions={}):string{return this.toDiagnosticsNode({style:'singleLine'}).toString(options);}
}
function interpolate<T>(a:T|null,b:T|null,t:number,lerp:(a:T|null,b:T|null,t:number)=>T):T|null{return a===b||equalCurve(a,b)||t===0?a:t===1?b:lerp(a,b,t);}
function lerpDuration(a:number|null,b:number|null,t:number):number{const microseconds=(a??0)*1000*(1-t)+(b??0)*1000*t,rounded=microseconds<0?-Math.floor(-microseconds+0.5):Math.floor(microseconds+0.5);invariant(Number.isSafeInteger(rounded),'inexact-animation-duration','AnimationStyle duration exceeds the exact microsecond range');return rounded/1000;}
function equalCurve(a:unknown,b:unknown):boolean{return a===b||a!==null&&typeof a==='object'&&'equals'in a&&typeof a.equals==='function'&&a.equals(b);}
const curveHashes=new WeakMap<Curve,number>();let nextCurveHash=1;
function curveHash(curve:Curve|null):number{if(curve===null)return 0;if('hashCode'in curve&&typeof curve.hashCode==='number')return curve.hashCode;let hash=curveHashes.get(curve);if(hash===undefined){hash=nextCurveHash++;curveHashes.set(curve,hash);}return hash;}
class LerpedCurve extends Curve {
  readonly first:Curve;readonly second:Curve;
  constructor(a:Curve|null,b:Curve|null,private readonly amount:number){super();this.first=a??Curves.linear;this.second=b??Curves.linear;protect(this,['first','second','amount']);}
  override transform(t:number):number{return this.first.transform(t)*(1-this.amount)+this.second.transform(t)*this.amount;}
  equals(other:unknown):boolean{return other instanceof LerpedCurve&&equalCurve(other.first,this.first)&&equalCurve(other.second,this.second)&&other.amount===this.amount;}
  get hashCode():number{return hashDoubles([curveHash(this.first),curveHash(this.second),this.amount]);}
  override toString():string{return `_LerpedCurve(${this.first}, ${this.second}, t: ${this.amount})`;}
}
