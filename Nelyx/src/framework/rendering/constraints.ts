// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/box.dart at the pin in upstream/flutter-coverage.json.
import {invariant} from '../../foundation/errors.ts';
import type {Size,Insets} from '../../ui/geometry.ts';
export interface ConstraintValidation {readonly isAppliedConstraint?:boolean;readonly informationCollector?:()=>Iterable<unknown>}
/** Box and sliver protocols validate their own geometry when applied. */
export abstract class Constraints {
  /** Dart Object equality defaults to identity; value constraint types override it. */
  equals(other:unknown):boolean{return this===other;}
  abstract get isTight():boolean;
  abstract get isNormalized():boolean;
  debugAssertIsValid(_options:ConstraintValidation={}):boolean{invariant(this.isNormalized,'invalid-constraints','Constraints are not normalized');return true;}
}
export interface BoxConstraintValues {readonly minWidth?:number;readonly maxWidth?:number;readonly minHeight?:number;readonly maxHeight?:number}
const clamp=(value:number,min:number,max:number)=>value<min?min:value>max?max:Number.isNaN(value)?max:value;
const size=(width:number,height:number):Size=>Object.freeze({width,height});
export class BoxConstraints extends Constraints {
  /** Raw values can be normalized; applying a constraint validates it in all builds. */
  constructor(readonly minWidth=0,readonly maxWidth=Infinity,readonly minHeight=0,readonly maxHeight=Infinity){super();invariant([minWidth,maxWidth,minHeight,maxHeight].every(value=>typeof value==='number'),'invalid-constraints','Constraint values must be numbers');}
  static tight(value:Size):BoxConstraints{return new BoxConstraints(value.width,value.width,value.height,value.height);}
  static tightFor(width?:number|null,height?:number|null):BoxConstraints{return new BoxConstraints(width??0,width??Infinity,height??0,height??Infinity);}
  static tightForFinite(width=Infinity,height=Infinity):BoxConstraints{return new BoxConstraints(width!==Infinity?width:0,width,height!==Infinity?height:0,height);}
  static loose(value:Size):BoxConstraints{return new BoxConstraints(0,value.width,0,value.height);}
  static expand(width?:number|null,height?:number|null):BoxConstraints{return BoxConstraints.tightFor(width??Infinity,height??Infinity);}
  static fromViewConstraints(value:Required<BoxConstraintValues>):BoxConstraints{return new BoxConstraints(value.minWidth,value.maxWidth,value.minHeight,value.maxHeight);}
  copyWith(value:BoxConstraintValues={}):BoxConstraints{return new BoxConstraints(value.minWidth??this.minWidth,value.maxWidth??this.maxWidth,value.minHeight??this.minHeight,value.maxHeight??this.maxHeight);}
  get hasTightWidth():boolean{return this.minWidth>=this.maxWidth;}
  get hasTightHeight():boolean{return this.minHeight>=this.maxHeight;}
  get isTight():boolean{return this.hasTightWidth&&this.hasTightHeight;}
  get hasBoundedWidth():boolean{return this.maxWidth<Infinity;}
  get hasBoundedHeight():boolean{return this.maxHeight<Infinity;}
  get hasInfiniteWidth():boolean{return this.minWidth>=Infinity;}
  get hasInfiniteHeight():boolean{return this.minHeight>=Infinity;}
  get isNormalized():boolean{return this.minWidth>=0&&this.minWidth<=this.maxWidth&&this.minHeight>=0&&this.minHeight<=this.maxHeight;}
  override debugAssertIsValid(options:ConstraintValidation={}):boolean{
    const valid=this.isNormalized&&(!options.isAppliedConstraint||!this.hasInfiniteWidth&&!this.hasInfiniteHeight);
    if(!valid)invariant(false,'invalid-constraints',`${this.toString()}${options.isAppliedConstraint?' cannot be applied to a finite render box':''}${options.informationCollector?' '+[...options.informationCollector()].join(' '):''}`);return true;
  }
  normalize():BoxConstraints{if(this.isNormalized)return this;const width=this.minWidth>=0?this.minWidth:0,height=this.minHeight>=0?this.minHeight:0;return new BoxConstraints(width,width>this.maxWidth?width:this.maxWidth,height,height>this.maxHeight?height:this.maxHeight);}
  get flipped():BoxConstraints{return new BoxConstraints(this.minHeight,this.maxHeight,this.minWidth,this.maxWidth);}
  widthConstraints():BoxConstraints{return new BoxConstraints(this.minWidth,this.maxWidth);}
  heightConstraints():BoxConstraints{return new BoxConstraints(0,Infinity,this.minHeight,this.maxHeight);}
  constrainWidth(width=Infinity):number{this.debugAssertIsValid();return clamp(width,this.minWidth,this.maxWidth);}
  constrainHeight(height=Infinity):number{this.debugAssertIsValid();return clamp(height,this.minHeight,this.maxHeight);}
  constrain(value:Size):Size{return size(this.constrainWidth(value.width),this.constrainHeight(value.height));}
  constrainDimensions(width:number,height:number):Size{return this.constrain({width,height});}
  get biggest():Size{return this.constrainDimensions(Infinity,Infinity);}
  get smallest():Size{return this.constrainDimensions(0,0);}
  isSatisfiedBy(value:Size):boolean{this.debugAssertIsValid();return this.minWidth<=value.width&&value.width<=this.maxWidth&&this.minHeight<=value.height&&value.height<=this.maxHeight;}
  constrainSizeAndAttemptToPreserveAspectRatio(value:Size):Size{
    this.debugAssertIsValid();if(this.isTight)return this.smallest;if(value.width<=0||value.height<=0)return this.constrain(value);
    let {width,height}=value;const ratio=width/height;
    if(width>this.maxWidth){width=this.maxWidth;height=width/ratio;}if(height>this.maxHeight){height=this.maxHeight;width=height*ratio;}
    if(width<this.minWidth){width=this.minWidth;height=width/ratio;}if(height<this.minHeight){height=this.minHeight;width=height*ratio;}
    return this.constrainDimensions(width,height);
  }
  loosen():BoxConstraints{this.debugAssertIsValid();return new BoxConstraints(0,this.maxWidth,0,this.maxHeight);}
  deflate(edges:Insets):BoxConstraints{
    this.debugAssertIsValid();invariant(Object.values(edges).every(Number.isFinite),'invalid-insets','Insets must be finite');
    const horizontal=edges.left+edges.right,vertical=edges.top+edges.bottom,width=Math.max(0,this.minWidth-horizontal),height=Math.max(0,this.minHeight-vertical);
    return new BoxConstraints(width,Math.max(width,this.maxWidth-horizontal),height,Math.max(height,this.maxHeight-vertical));
  }
  enforce(parent:BoxConstraints):BoxConstraints{parent.debugAssertIsValid();return new BoxConstraints(clamp(this.minWidth,parent.minWidth,parent.maxWidth),clamp(this.maxWidth,parent.minWidth,parent.maxWidth),clamp(this.minHeight,parent.minHeight,parent.maxHeight),clamp(this.maxHeight,parent.minHeight,parent.maxHeight));}
  tighten(width?:number|null,height?:number|null):BoxConstraints{this.debugAssertIsValid();return new BoxConstraints(width==null?this.minWidth:this.constrainWidth(width),width==null?this.maxWidth:this.constrainWidth(width),height==null?this.minHeight:this.constrainHeight(height),height==null?this.maxHeight:this.constrainHeight(height));}
  private map(transform:(value:number)=>number):BoxConstraints{return new BoxConstraints(transform(this.minWidth),transform(this.maxWidth),transform(this.minHeight),transform(this.maxHeight));}
  multiply(factor:number):BoxConstraints{return this.map(value=>value*factor);}
  divide(factor:number):BoxConstraints{return this.map(value=>value/factor);}
  truncatingDivide(factor:number):BoxConstraints{return this.map(value=>{const quotient=value/factor;invariant(Number.isFinite(quotient),'invalid-constraint-division','Integer division requires finite quotients');return Math.trunc(quotient);});}
  modulo(factor:number):BoxConstraints{return this.map(value=>{const remainder=value%factor;return remainder<0?remainder+Math.abs(factor):remainder;});}
  static lerp(a:BoxConstraints|null|undefined,b:BoxConstraints|null|undefined,t:number):BoxConstraints|null{
    invariant(Number.isFinite(t),'invalid-interpolation','Constraint interpolation requires finite t');if(a===b||a==null&&b==null)return a??null;
    if(a==null)return b!.multiply(t).normalize();if(b==null)return a.multiply(1-t).normalize();a.debugAssertIsValid();b.debugAssertIsValid();
    const mix=(start:number,end:number)=>{invariant(Number.isFinite(start)&&Number.isFinite(end)||start===Infinity&&end===Infinity,'incompatible-constraints','Cannot interpolate finite and infinite constraints');return start===Infinity?Infinity:start*(1-t)+end*t;};
    return new BoxConstraints(mix(a.minWidth,b.minWidth),mix(a.maxWidth,b.maxWidth),mix(a.minHeight,b.minHeight),mix(a.maxHeight,b.maxHeight)).normalize();
  }
  equals(other:unknown):boolean{this.debugAssertIsValid();if(other===this)return true;if(!(other instanceof BoxConstraints)||other.constructor!==this.constructor)return false;other.debugAssertIsValid();return this.minWidth===other.minWidth&&this.maxWidth===other.maxWidth&&this.minHeight===other.minHeight&&this.maxHeight===other.maxHeight;}
  get hashCode():number{this.debugAssertIsValid();let hash=2166136261;for(const char of [this.minWidth,this.maxWidth,this.minHeight,this.maxHeight].join(','))hash=Math.imul(hash^char.charCodeAt(0),16777619);return hash>>>0;}
  toString():string{
    const annotation=this.isNormalized?'':'; NOT NORMALIZED';if(this.minWidth===Infinity&&this.minHeight===Infinity)return `BoxConstraints(biggest${annotation})`;
    if(this.minWidth===0&&this.maxWidth===Infinity&&this.minHeight===0&&this.maxHeight===Infinity)return `BoxConstraints(unconstrained${annotation})`;
    const describe=(min:number,max:number,dimension:string)=>min===max?`${dimension}=${min.toFixed(1)}`:`${min.toFixed(1)}<=${dimension}<=${max.toFixed(1)}`;
    return `BoxConstraints(${describe(this.minWidth,this.maxWidth,'w')}, ${describe(this.minHeight,this.maxHeight,'h')}${annotation})`;
  }
}
