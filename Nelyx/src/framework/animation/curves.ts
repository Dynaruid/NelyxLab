// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {bounce} from './bounce.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
import {diagnosticDoubleString} from '../../foundation/debug.ts';
import {clampDouble} from '../../ui/math.ts';
import {lerp,protect} from '../../ui/value-math.ts';
import {Offset} from '../../ui/offset.ts';
import {SeededRandom} from '../../math/seeded-random.ts';
const fixedTwo=(value:number):string=>Object.is(value,-0)?'-0.00':value.toFixed(2);

export abstract class ParametricCurve<T> {
  transform(t:number):T{if(FoundationBuildMode.debug)invariant(t>=0&&t<=1,'invalid-curve-progress',`Parametric value ${t} is outside [0,1]`);return this.transformInternal(t);}
  protected transformInternal(_t:number):T{throw new Error('UnimplementedError: transformInternal');}
  toString():string{return objectRuntimeType(this,'ParametricCurve');}
}
export abstract class Curve extends ParametricCurve<number> {
  override transform(t:number):number{return t===0||t===1?t:super.transform(t);}
  get flipped():Curve{return new FlippedCurve(this);}
}
class _Linear extends Curve {protected override transformInternal(t:number):number{return t;}}
export class SawTooth extends Curve {
  constructor(readonly count:number){super();protect(this,['count']);}
  protected override transformInternal(t:number):number{t*=this.count;return t-Math.trunc(t);}
  override toString():string{return `${objectRuntimeType(this,'SawTooth')}(${this.count})`;}
}
export class Interval extends Curve {
  readonly curve:Curve;
  constructor(readonly begin:number,readonly end:number,{curve=Curves.linear}:{readonly curve?:Curve}={}){super();this.curve=curve;protect(this,['begin','end','curve']);}
  protected override transformInternal(t:number):number{if(FoundationBuildMode.debug){invariant(this.begin>=0&&this.begin<=1,'invalid-interval-begin','Interval begin must be within [0,1]');invariant(this.end>=0&&this.end<=1&&this.end>=this.begin,'invalid-interval-end','Interval end must be within [begin,1]');}t=clampDouble((t-this.begin)/(this.end-this.begin),0,1);return t===0||t===1?t:this.curve.transform(t);}
  override toString():string{return `${objectRuntimeType(this,'Interval')}(${diagnosticDoubleString(this.begin)}⋯${diagnosticDoubleString(this.end)})${this.curve instanceof _Linear?'':'➩'+this.curve}`;}
}
export class Split extends Curve {
  readonly beginCurve:Curve;readonly endCurve:Curve;
  constructor(readonly split:number,{beginCurve=Curves.linear,endCurve=Curves.easeOutCubic}:{readonly beginCurve?:Curve;readonly endCurve?:Curve}={}){super();this.beginCurve=beginCurve;this.endCurve=endCurve;protect(this,['split','beginCurve','endCurve']);}
  override transform(t:number):number{if(FoundationBuildMode.debug){invariant(t>=0&&t<=1,'invalid-split-progress','Split progress must be within [0,1]');invariant(this.split>=0&&this.split<=1,'invalid-split-point','Split must be within [0,1]');}if(t===0||t===1)return t;if(t===this.split)return this.split;return t<this.split?lerp(0,this.split,this.beginCurve.transform(t/this.split)):lerp(this.split,1,this.endCurve.transform((t-this.split)/(1-this.split)));}
  override toString():string{return `${describeIdentity(this)}(${diagnosticDoubleString(this.split)}, ${this.beginCurve}, ${this.endCurve})`;}
}
export class Threshold extends Curve {
  constructor(readonly threshold:number){super();protect(this,['threshold']);}
  protected override transformInternal(t:number):number{if(FoundationBuildMode.debug)invariant(this.threshold>=0&&this.threshold<=1,'invalid-curve-threshold','Threshold must be within [0,1]');return t<this.threshold?0:1;}
}
export class Cubic extends Curve {
  private static readonly _cubicErrorBound=.001;
  // [0,1] has at most 1074 binary64 halvings before the smallest subnormal
  // step. Keep the loop bounded: Hermes 94aa5e1d can miscompile its unbounded
  // equivalent under -O. Preserve the upstream evaluation order and tolerance.
  private static readonly _cubicMaxIterations=1076;
  constructor(readonly a:number,readonly b:number,readonly c:number,readonly d:number){super();protect(this,['a','b','c','d']);}
  private _evaluateCubic(a:number,b:number,m:number):number{return 3*a*(1-m)*(1-m)*m+3*b*(1-m)*m*m+m*m*m;}
  protected override transformInternal(t:number):number {
    if(Number.isNaN(t))throw new RangeError('t must not be NaN');if(t<=0)return 0;if(t>=1)return 1;
    let start=0,end=1;
    for(let iteration=0;iteration<Cubic._cubicMaxIterations;iteration++){
      const midpoint=(start+end)/2,estimate=this._evaluateCubic(this.a,this.c,midpoint);
      if(Math.abs(t-estimate)<Cubic._cubicErrorBound)return this._evaluateCubic(this.b,this.d,midpoint);
      if(midpoint===start||midpoint===end)break;
      if(estimate<t)start=midpoint;else end=midpoint;
    }
    throw new RangeError('Cubic curve did not converge within its binary64 interval');
  }
  override toString():string{return `${objectRuntimeType(this,'Cubic')}(${fixedTwo(this.a)}, ${fixedTwo(this.b)}, ${fixedTwo(this.c)}, ${fixedTwo(this.d)})`;}
}
export class ThreePointCubic extends Curve {
  constructor(readonly a1:Offset,readonly b1:Offset,readonly midpoint:Offset,readonly a2:Offset,readonly b2:Offset){super();protect(this,['a1','b1','midpoint','a2','b2']);}
  protected override transformInternal(t:number):number{const first=t<this.midpoint.dx,scaleX=first?this.midpoint.dx:1-this.midpoint.dx,scaleY=first?this.midpoint.dy:1-this.midpoint.dy,scaledT=(t-(first?0:this.midpoint.dx))/scaleX;return first?new Cubic(this.a1.dx/scaleX,this.a1.dy/scaleY,this.b1.dx/scaleX,this.b1.dy/scaleY).transform(scaledT)*scaleY:new Cubic((this.a2.dx-this.midpoint.dx)/scaleX,(this.a2.dy-this.midpoint.dy)/scaleY,(this.b2.dx-this.midpoint.dx)/scaleX,(this.b2.dy-this.midpoint.dy)/scaleY).transform(scaledT)*scaleY+this.midpoint.dy;}
  override toString():string{return objectRuntimeType(this,`ThreePointCubic(${this.a1}, ${this.b1}, ${this.midpoint}, ${this.a2}, ${this.b2})`)+' ';}
}
export interface Curve2DSamplingOptions {readonly start?:number;readonly end?:number;readonly tolerance?:number}
export abstract class Curve2D extends ParametricCurve<Offset> {
  generateSamples({start=0,end=1,tolerance=1e-10}:Curve2DSamplingOptions={}):Iterable<Curve2DSample> {
    if(FoundationBuildMode.debug)invariant(end>start,'invalid-curve-sampling-interval','Curve sample end must be greater than start');
    const random=new SeededRandom(this.samplingSeed),first=new Curve2DSample(start,this.transform(start)),last=new Curve2DSample(end,this.transform(end)),samples=[first];
    const flat=(p:Offset,q:Offset,r:Offset):boolean=>{const pr=p.subtract(r),qr=q.subtract(r),z=pr.dx*qr.dy-qr.dx*pr.dy;return z*z<tolerance;};
    const sample=(p:Curve2DSample,q:Curve2DSample,forceSubdivide=false):void=>{
      const t=p.t+(0.45+0.1*random.nextDouble())*(q.t-p.t),r=new Curve2DSample(t,this.transform(t));
      if(!forceSubdivide&&flat(p.value,q.value,r.value))samples.push(q);else{sample(p,r);sample(r,q);}
    };
    sample(first,last,Math.abs(first.value.dx-last.value.dx)<tolerance&&Math.abs(first.value.dy-last.value.dy)<tolerance);
    return samples;
  }
  protected get samplingSeed():number{return 0;}
  findInverse(x:number):number {
    let start=0,end=1,mid=0,count=100;const startValue=x-this.transform(start).dx;
    while((end-start)/2>1e-6&&count>0){mid=(end+start)/2;const value=x-this.transform(mid).dx;if(Math.sign(value)===Math.sign(startValue))start=mid;else end=mid;count--;}
    return mid;
  }
}
export class Curve2DSample {
  constructor(readonly t:number,readonly value:Offset){protect(this,['t','value']);}
  toString():string{return `[(${fixedTwo(this.value.dx)}, ${fixedTwo(this.value.dy)}), ${fixedTwo(this.t)}]`;}
}
export interface CatmullRomSplineOptions {readonly tension?:number;readonly startHandle?:Offset|null;readonly endHandle?:Offset|null}
type CubicSegment=readonly [Offset,Offset,Offset,Offset];
export class CatmullRomSpline extends Curve2D {
  private readonly cubicSegments:CubicSegment[]=[];
  private controlPoints:readonly Offset[]|null;
  private readonly tension:number;
  private readonly startHandle:Offset|null;private readonly endHandle:Offset|null;
  /** startHandle/endHandle widen Source's library-private lazy constructor parameters. */
  constructor(controlPoints:readonly Offset[],{tension=0,startHandle=null,endHandle=null}:CatmullRomSplineOptions={}){
    super();if(FoundationBuildMode.debug)invariant(tension>=0&&tension<=1&&controlPoints.length>3,'invalid-catmull-rom-spline','CatmullRomSpline requires at least four points and tension in [0,1]');
    this.controlPoints=controlPoints;this.tension=tension;this.startHandle=startHandle;this.endHandle=endHandle;
  }
  static precompute(controlPoints:readonly Offset[],options:CatmullRomSplineOptions={}):CatmullRomSpline {const spline=new CatmullRomSpline(controlPoints,options);spline.initializeIfNeeded();spline.controlPoints=null;return spline;}
  private static computeSegments(controlPoints:readonly Offset[],tension:number,startHandle:Offset|null,endHandle:Offset|null):CubicSegment[] {
    if(FoundationBuildMode.debug){invariant(startHandle===null||startHandle.isFinite,'invalid-spline-start-handle','CatmullRomSpline start handle must be finite');invariant(endHandle===null||endHandle.isFinite,'invalid-spline-end-handle','CatmullRomSpline end handle must be finite');for(let i=0;i<controlPoints.length;i++)invariant(controlPoints[i]!.isFinite,'invalid-spline-control-point',`CatmullRomSpline control point ${i} is not finite: ${controlPoints[i]}`);}
    startHandle??=controlPoints[0]!.multiply(2).subtract(controlPoints[1]!);endHandle??=controlPoints.at(-1)!.multiply(2).subtract(controlPoints.at(-2)!);
    const all=[startHandle,...controlPoints,endHandle],reverseTension=1-tension,result:CubicSegment[]=[];
    for(let i=0;i<all.length-3;i++){
      const p0=all[i]!,p1=all[i+1]!,p2=all[i+2]!,p3=all[i+3]!,d10=p1.subtract(p0),d21=p2.subtract(p1),d32=p3.subtract(p2),t01=Math.pow(d10.distance,0.5),t12=Math.pow(d21.distance,0.5),t23=Math.pow(d32.distance,0.5);
      const m1=d21.add(d10.divide(t01).subtract(p2.subtract(p0).divide(t01+t12)).multiply(t12)).multiply(reverseTension);
      const m2=d21.add(d32.divide(t23).subtract(p3.subtract(p1).divide(t12+t23)).multiply(t12)).multiply(reverseTension),sum=m1.add(m2);
      result.push([d21.multiply(-2).add(sum),d21.multiply(3).subtract(m1).subtract(sum),m1,p1]);
    }
    return result;
  }
  private initializeIfNeeded():void{if(this.cubicSegments.length===0)this.cubicSegments.push(...CatmullRomSpline.computeSegments(this.controlPoints!,this.tension,this.startHandle,this.endHandle));}
  protected override get samplingSeed():number{this.initializeIfNeeded();const point=this.cubicSegments[0]![1],seed=(point.dx+point.dy)*10000;return seed<0?-Math.floor(-seed+0.5):Math.floor(seed+0.5);}
  protected override transformInternal(t:number):Offset {
    this.initializeIfNeeded();const length=this.cubicSegments.length,position=t<1?t*length:length,localT=t<1?position%1:1,index=t<1?Math.floor(position):length-1,points=this.cubicSegments[index]!,t2=localT*localT;
    return points[0].multiply(t2).multiply(localT).add(points[1].multiply(t2)).add(points[2].multiply(localT)).add(points[3]);
  }
}
export interface CatmullRomCurveOptions {readonly tension?:number}
export class CatmullRomCurve extends Curve {
  readonly controlPoints:readonly Offset[];readonly tension:number;
  private readonly precomputedSamples:Curve2DSample[]=[];
  constructor(controlPoints:readonly Offset[],{tension=0}:CatmullRomCurveOptions={}){
    super();if(FoundationBuildMode.debug){const reasons:string[]=[];invariant(CatmullRomCurve.validateControlPoints(controlPoints,{tension,reasons}),'invalid-catmull-rom-curve',`Control points ${controlPoints} could not be validated:\n  ${reasons.join('\n  ')}`);}
    this.controlPoints=controlPoints;this.tension=tension;protect(this,['controlPoints','tension']);
  }
  static precompute(controlPoints:readonly Offset[],options:CatmullRomCurveOptions={}):CatmullRomCurve{const curve=new CatmullRomCurve(controlPoints,options);curve.initializeIfNeeded();return curve;}
  private initializeIfNeeded():void{if(this.precomputedSamples.length===0)this.precomputedSamples.push(...CatmullRomSpline.precompute([Offset.zero,...this.controlPoints,new Offset(1,1)],{tension:this.tension}).generateSamples({tolerance:1e-12}));}
  static validateControlPoints(controlPoints:readonly Offset[]|null,{tension=0,reasons=null}:{readonly tension?:number;readonly reasons?:string[]|null}={}):boolean {
    const reason=(text:string):void=>{if(FoundationBuildMode.debug)reasons?.push(text);};
    if(controlPoints===null){reason('Supplied control points cannot be null');return false;}
    if(controlPoints.length<2){reason('There must be at least two points supplied to create a valid curve.');return false;}
    const points=[Offset.zero,...controlPoints,new Offset(1,1)];points.unshift(points[0]!.multiply(2).subtract(points[1]!));points.push(points.at(-1)!.multiply(2).subtract(points.at(-2)!));
    let lastX=-Infinity;
    for(let i=0;i<points.length;i++){
      if(i>1&&i<points.length-2&&(points[i]!.dx<=0||points[i]!.dx>=1)){reason(`Control points must have X values between 0.0 and 1.0, exclusive. Point ${i} has an x value (${points[i]!.dx}) which is outside the range.`);return false;}
      if(points[i]!.dx<=lastX){reason(`Each X coordinate must be greater than the preceding X coordinate (i.e. must be monotonically increasing in X). Point ${i} has an x value of ${points[i]!.dx}, which is not greater than ${lastX}`);return false;}
      lastX=points[i]!.dx;
    }
    let success=true;lastX=-Infinity;const spline=new CatmullRomSpline(points,{tension}),start=spline.findInverse(0),end=spline.findInverse(1),samples=[...spline.generateSamples({start,end})];
    const reject=(text:string):boolean=>{success=false;reason(text);return !FoundationBuildMode.debug||reasons===null;};
    if(Math.abs(samples[0]!.value.dy)>1e-3||Math.abs(1-samples.at(-1)!.value.dy)>1e-3)if(reject(`The curve has more than one Y value at X = ${samples[0]!.value.dx}. Try moving some control points further away from this value of X, or increasing the tension.`))return false;
    for(const sample of samples){
      const x=sample.value.dx;if(sample.t>=start&&sample.t<=end&&(x< -1e-3||x>1+1e-3))if(reject(`The resulting curve has an X value (${x}) which is outside the range [0.0, 1.0], inclusive.`))return false;
      if(x<lastX)if(reject(`The curve has more than one Y value at x = ${x}. Try moving some control points further apart in X, or increasing the tension.`))return false;
      lastX=x;
    }
    return success;
  }
  protected override transformInternal(t:number):number {
    this.initializeIfNeeded();let start=0,end=this.precomputedSamples.length-1,startValue=this.precomputedSamples[start]!.value,endValue=this.precomputedSamples[end]!.value;
    while(end-start>1){const mid=Math.trunc((end+start)/2),value=this.precomputedSamples[mid]!.value;if(t>=value.dx){start=mid;startValue=value;}else{end=mid;endValue=value;}}
    return lerp(startValue.dy,endValue.dy,(t-startValue.dx)/(endValue.dx-startValue.dx));
  }
}
export class FlippedCurve extends Curve {
  constructor(readonly curve:Curve){super();protect(this,['curve']);}
  protected override transformInternal(t:number):number{return 1-this.curve.transform(1-t);}
  override toString():string{return `${objectRuntimeType(this,'FlippedCurve')}(${this.curve})`;}
}
class _DecelerateCurve extends Curve {protected override transformInternal(t:number):number{t=1-t;return 1-t*t;}}
class _BounceInCurve extends Curve {protected override transformInternal(t:number):number{return 1-bounce(1-t);}}
class _BounceOutCurve extends Curve {protected override transformInternal(t:number):number{return bounce(t);}}
class _BounceInOutCurve extends Curve {protected override transformInternal(t:number):number{return t<.5?(1-bounce(1-t*2))*.5:bounce(t*2-1)*.5+.5;}}
export class ElasticInCurve extends Curve {
  constructor(readonly period=.4){super();protect(this,['period']);}
  protected override transformInternal(t:number):number{const s=this.period/4;t-=1;return -Math.pow(2,10*t)*Math.sin((t-s)*(Math.PI*2)/this.period);}
  override toString():string{return `${objectRuntimeType(this,'ElasticInCurve')}(${diagnosticDoubleString(this.period)})`;}
}
export class ElasticOutCurve extends Curve {
  constructor(readonly period=.4){super();protect(this,['period']);}
  protected override transformInternal(t:number):number{const s=this.period/4;return Math.pow(2,-10*t)*Math.sin((t-s)*(Math.PI*2)/this.period)+1;}
  override toString():string{return `${objectRuntimeType(this,'ElasticOutCurve')}(${diagnosticDoubleString(this.period)})`;}
}
export class ElasticInOutCurve extends Curve {
  constructor(readonly period=.4){super();protect(this,['period']);}
  protected override transformInternal(t:number):number{const s=this.period/4;t=2*t-1;return t<0?-.5*Math.pow(2,10*t)*Math.sin((t-s)*(Math.PI*2)/this.period):Math.pow(2,-10*t)*Math.sin((t-s)*(Math.PI*2)/this.period)*.5+1;}
  override toString():string{return `${objectRuntimeType(this,'ElasticInOutCurve')}(${diagnosticDoubleString(this.period)})`;}
}
/** Presets from the pinned Source. */
export class Curves {
  private constructor(){}
  static readonly linear:Curve=new _Linear();
  static readonly decelerate:Curve=new _DecelerateCurve();
  static readonly fastLinearToSlowEaseIn:Cubic=new Cubic(0.18, 1.0, 0.04, 1.0);
  static readonly fastEaseInToSlowEaseOut:ThreePointCubic=new ThreePointCubic(
    new Offset(0.056, 0.024),
    new Offset(0.108, 0.3085),
    new Offset(0.198, 0.541),
    new Offset(0.3655, 1.0),
    new Offset(0.5465, 0.989),
  );
  static readonly ease:Cubic=new Cubic(0.25, 0.1, 0.25, 1.0);
  static readonly easeIn:Cubic=new Cubic(0.42, 0.0, 1.0, 1.0);
  static readonly easeInToLinear:Cubic=new Cubic(0.67, 0.03, 0.65, 0.09);
  static readonly easeInSine:Cubic=new Cubic(0.47, 0.0, 0.745, 0.715);
  static readonly easeInQuad:Cubic=new Cubic(0.55, 0.085, 0.68, 0.53);
  static readonly easeInCubic:Cubic=new Cubic(0.55, 0.055, 0.675, 0.19);
  static readonly easeInQuart:Cubic=new Cubic(0.895, 0.03, 0.685, 0.22);
  static readonly easeInQuint:Cubic=new Cubic(0.755, 0.05, 0.855, 0.06);
  static readonly easeInExpo:Cubic=new Cubic(0.95, 0.05, 0.795, 0.035);
  static readonly easeInCirc:Cubic=new Cubic(0.6, 0.04, 0.98, 0.335);
  static readonly easeInBack:Cubic=new Cubic(0.6, -0.28, 0.735, 0.045);
  static readonly easeOut:Cubic=new Cubic(0.0, 0.0, 0.58, 1.0);
  static readonly linearToEaseOut:Cubic=new Cubic(0.35, 0.91, 0.33, 0.97);
  static readonly easeOutSine:Cubic=new Cubic(0.39, 0.575, 0.565, 1.0);
  static readonly easeOutQuad:Cubic=new Cubic(0.25, 0.46, 0.45, 0.94);
  static readonly easeOutCubic:Cubic=new Cubic(0.215, 0.61, 0.355, 1.0);
  static readonly easeOutQuart:Cubic=new Cubic(0.165, 0.84, 0.44, 1.0);
  static readonly easeOutQuint:Cubic=new Cubic(0.23, 1.0, 0.32, 1.0);
  static readonly easeOutExpo:Cubic=new Cubic(0.19, 1.0, 0.22, 1.0);
  static readonly easeOutCirc:Cubic=new Cubic(0.075, 0.82, 0.165, 1.0);
  static readonly easeOutBack:Cubic=new Cubic(0.175, 0.885, 0.32, 1.275);
  static readonly easeInOut:Cubic=new Cubic(0.42, 0.0, 0.58, 1.0);
  static readonly easeInOutSine:Cubic=new Cubic(0.445, 0.05, 0.55, 0.95);
  static readonly easeInOutQuad:Cubic=new Cubic(0.455, 0.03, 0.515, 0.955);
  static readonly easeInOutCubic:Cubic=new Cubic(0.645, 0.045, 0.355, 1.0);
  static readonly easeInOutCubicEmphasized:ThreePointCubic=new ThreePointCubic(
    new Offset(0.05, 0),
    new Offset(0.133333, 0.06),
    new Offset(0.166666, 0.4),
    new Offset(0.208333, 0.82),
    new Offset(0.25, 1),
  );
  static readonly easeInOutQuart:Cubic=new Cubic(0.77, 0.0, 0.175, 1.0);
  static readonly easeInOutQuint:Cubic=new Cubic(0.86, 0.0, 0.07, 1.0);
  static readonly easeInOutExpo:Cubic=new Cubic(1.0, 0.0, 0.0, 1.0);
  static readonly easeInOutCirc:Cubic=new Cubic(0.785, 0.135, 0.15, 0.86);
  static readonly easeInOutBack:Cubic=new Cubic(0.68, -0.55, 0.265, 1.55);
  static readonly fastOutSlowIn:Cubic=new Cubic(0.4, 0.0, 0.2, 1.0);
  static readonly slowMiddle:Cubic=new Cubic(0.15, 0.85, 0.85, 0.15);
  static readonly bounceIn:Curve=new _BounceInCurve();
  static readonly bounceOut:Curve=new _BounceOutCurve();
  static readonly bounceInOut:Curve=new _BounceInOutCurve();
  static readonly elasticIn:ElasticInCurve=new ElasticInCurve();
  static readonly elasticOut:ElasticOutCurve=new ElasticOutCurve();
  static readonly elasticInOut:ElasticInOutCurve=new ElasticInOutCurve();
}
