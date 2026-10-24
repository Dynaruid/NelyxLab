// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned Flutter painting/text_scaler.dart.
import {invariant} from '../../foundation/errors.ts';
function bounds(min:number,max:number):void{invariant(Number.isFinite(min)&&min>=0&&!Number.isNaN(max)&&max>=min,'invalid-text-scale','Invalid text scaler clamp bounds');}
function size(value:number):void{invariant(Number.isFinite(value)&&value>=0,'invalid-font-size','Font size must be finite and nonnegative');}
let identity:TextScaler|undefined;
export abstract class TextScaler {
  static get noScaling():TextScaler{return identity??=new LinearTextScaler(1);}
  static linear(factor:number):TextScaler{invariant(Number.isFinite(factor)&&factor>=0,'invalid-text-scale','Text scale factor must be finite and nonnegative');return factor===1?TextScaler.noScaling:new LinearTextScaler(factor);}
  abstract scale(fontSize:number):number;
  /** Compatibility estimate; layout calls scale separately for each font size. */
  abstract get textScaleFactor():number;
  equals(other:unknown):boolean{return this===other;}
  clamp({minScaleFactor=0,maxScaleFactor=Infinity}:{readonly minScaleFactor?:number;readonly maxScaleFactor?:number}={}):TextScaler{bounds(minScaleFactor,maxScaleFactor);if(minScaleFactor===0&&maxScaleFactor===Infinity)return this;return minScaleFactor===maxScaleFactor?TextScaler.linear(minScaleFactor):new ClampedTextScaler(this,minScaleFactor,maxScaleFactor);}
}
class LinearTextScaler extends TextScaler {
  constructor(readonly textScaleFactor:number){super();Object.freeze(this);}
  scale(fontSize:number):number{size(fontSize);return fontSize*this.textScaleFactor;}
  override equals(other:unknown):boolean{return this===other||other instanceof LinearTextScaler&&other.textScaleFactor===this.textScaleFactor;}
  override clamp({minScaleFactor=0,maxScaleFactor=Infinity}:{readonly minScaleFactor?:number;readonly maxScaleFactor?:number}={}):TextScaler{bounds(minScaleFactor,maxScaleFactor);const next=Math.min(maxScaleFactor,Math.max(minScaleFactor,this.textScaleFactor));return next===this.textScaleFactor?this:TextScaler.linear(next);}
}
class ClampedTextScaler extends TextScaler {
  constructor(private readonly scaler:TextScaler,private readonly min:number,private readonly max:number){super();Object.freeze(this);}
  get textScaleFactor():number{return Math.min(this.max,Math.max(this.min,this.scaler.textScaleFactor));}
  scale(fontSize:number):number{size(fontSize);return Math.min(this.max*fontSize,Math.max(this.min*fontSize,this.scaler.scale(fontSize)));}
  override equals(other:unknown):boolean{return this===other||other instanceof ClampedTextScaler&&this.min===other.min&&this.max===other.max&&this.scaler.equals(other.scaler);}
  override clamp({minScaleFactor=0,maxScaleFactor=Infinity}:{readonly minScaleFactor?:number;readonly maxScaleFactor?:number}={}):TextScaler{bounds(minScaleFactor,maxScaleFactor);const min=Math.max(this.min,minScaleFactor),max=Math.min(this.max,maxScaleFactor);return max<=min?TextScaler.linear(Math.min(maxScaleFactor,Math.max(minScaleFactor,this.min))):new ClampedTextScaler(this.scaler,min,max);}
}
