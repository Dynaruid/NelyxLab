// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source Duration values use milliseconds; the actual monotonic clock is injectable.
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {SamplingClock} from './binding.ts';
import type {SamplingStopwatch} from './binding.ts';
import {LeastSquaresSolver} from './lsq-solver.ts';
export class Velocity {
  readonly pixelsPerSecond:Offset;
  constructor({pixelsPerSecond}:{readonly pixelsPerSecond:Offset}){invariant(pixelsPerSecond instanceof Offset,'invalid-velocity','Velocity requires an Offset');this.pixelsPerSecond=pixelsPerSecond;if(new.target===Velocity)Object.freeze(this);}
  static readonly zero=new Velocity({pixelsPerSecond:Offset.zero});
  negate():Velocity{return new Velocity({pixelsPerSecond:this.pixelsPerSecond.negate()});}
  subtract(other:Velocity):Velocity{return new Velocity({pixelsPerSecond:this.pixelsPerSecond.subtract(other.pixelsPerSecond)});}
  add(other:Velocity):Velocity{return new Velocity({pixelsPerSecond:this.pixelsPerSecond.add(other.pixelsPerSecond)});}
  clampMagnitude(minValue:number,maxValue:number):Velocity{invariant(minValue>=0&&maxValue>=minValue,'invalid-velocity-clamp','Velocity limits must be nonnegative and ordered');const squared=this.pixelsPerSecond.distanceSquared;if(squared>maxValue*maxValue)return new Velocity({pixelsPerSecond:this.pixelsPerSecond.divide(this.pixelsPerSecond.distance).multiply(maxValue)});if(squared<minValue*minValue)return new Velocity({pixelsPerSecond:this.pixelsPerSecond.divide(this.pixelsPerSecond.distance).multiply(minValue)});return this;}
  equals(other:unknown):boolean{return other instanceof Velocity&&this.pixelsPerSecond.equals(other.pixelsPerSecond);}
  get hashCode():number{return this.pixelsPerSecond.hashCode;}
  toString():string{return 'Velocity('+this.pixelsPerSecond.dx.toFixed(1)+', '+this.pixelsPerSecond.dy.toFixed(1)+')';}
}
export class VelocityEstimate {
  readonly pixelsPerSecond:Offset;readonly confidence:number;readonly duration:number;readonly offset:Offset;
  constructor({pixelsPerSecond,confidence,duration,offset}:{readonly pixelsPerSecond:Offset;readonly confidence:number;readonly duration:number;readonly offset:Offset}){invariant(pixelsPerSecond instanceof Offset&&offset instanceof Offset,'invalid-velocity-estimate','Velocity estimate requires Offset values');this.pixelsPerSecond=pixelsPerSecond;this.confidence=confidence;this.duration=duration;this.offset=offset;if(new.target===VelocityEstimate)Object.freeze(this);}
  toString():string{return 'VelocityEstimate('+this.pixelsPerSecond.dx.toFixed(1)+', '+this.pixelsPerSecond.dy.toFixed(1)+'; offset: '+this.offset+', duration: '+this.duration+'ms, confidence: '+this.confidence.toFixed(1)+')';}
}
class PointAtTime {constructor(readonly point:Offset,readonly time:number){}toString():string{return '_PointAtTime('+this.point+' at '+this.time+'ms)';}}
const stoppedEstimate=()=>new VelocityEstimate({pixelsPerSecond:Offset.zero,confidence:1,duration:0,offset:Offset.zero});
export interface VelocityTrackerOptions {readonly clock?:SamplingClock}
export class VelocityTracker {
  private stopwatch:SamplingStopwatch|null=null;private readonly samples:(PointAtTime|null)[]=Array(20).fill(null);protected index=0;
  constructor(readonly kind:PointerDeviceKind,private readonly options:VelocityTrackerOptions={}){invariant(kind instanceof PointerDeviceKind,'invalid-velocity-device','Velocity tracker requires a device kind');}
  static withKind(kind:PointerDeviceKind,options:VelocityTrackerOptions={}):VelocityTracker{return new VelocityTracker(kind,options);}
  protected get sinceLastSample():SamplingStopwatch{return this.stopwatch??= (this.options.clock??new SamplingClock()).stopwatch();}
  protected get moveStopped():boolean{return Math.trunc(this.sinceLastSample.elapsedMicroseconds/1000)>40;}
  addPosition(time:number,position:Offset):void{invariant(Number.isFinite(time)&&position instanceof Offset,'invalid-velocity-sample','Velocity samples require a finite millisecond timestamp and Offset');this.sinceLastSample.start();this.sinceLastSample.reset();this.index=(this.index+1)%20;this.samples[this.index]=new PointAtTime(position,time);}
  getVelocityEstimate():VelocityEstimate|null {
    if(this.moveStopped)return stoppedEstimate();
    const x:number[]=[],y:number[]=[],w:number[]=[],time:number[]=[];let sampleCount=0,index=this.index;
    const newest=this.samples[index];if(newest==null)return null;let previous=newest,oldest=newest;
    do{const sample=this.samples[index];if(sample==null)break;const age=newest.time-sample.time,delta=Math.abs(sample.time-previous.time);previous=sample;if(age>100||delta>40)break;oldest=sample;x.push(sample.point.dx);y.push(sample.point.dy);w.push(1);time.push(-age);index=(index===0?20:index)-1;sampleCount++;}while(sampleCount<20);
    if(sampleCount>=3){const xFit=new LeastSquaresSolver(time,x,w).solve(2),yFit=new LeastSquaresSolver(time,y,w).solve(2);if(xFit!==null&&yFit!==null)return new VelocityEstimate({pixelsPerSecond:new Offset(xFit.coefficients[1]!*1000,yFit.coefficients[1]!*1000),confidence:xFit.confidence*yFit.confidence,duration:newest.time-oldest.time,offset:newest.point.subtract(oldest.point)});}
    return new VelocityEstimate({pixelsPerSecond:Offset.zero,confidence:1,duration:newest.time-oldest.time,offset:newest.point.subtract(oldest.point)});
  }
  getVelocity():Velocity{const estimate=this.getVelocityEstimate();return estimate===null||estimate.pixelsPerSecond.equals(Offset.zero)?Velocity.zero:new Velocity({pixelsPerSecond:estimate.pixelsPerSecond});}
}
export class IOSScrollViewFlingVelocityTracker extends VelocityTracker {
  protected readonly touchSamples:(PointAtTime|null)[]=Array(20).fill(null);
  override addPosition(time:number,position:Offset):void{invariant(Number.isFinite(time)&&position instanceof Offset,'invalid-velocity-sample','Velocity samples require a finite millisecond timestamp and Offset');this.sinceLastSample.start();this.sinceLastSample.reset();const previous=this.touchSamples[this.index];if(FoundationBuildMode.debug)invariant(previous==null||previous.time<=time,'non-monotonic-velocity-sample','A touch sample must not precede its predecessor');this.index=(this.index+1)%20;this.touchSamples[this.index]=new PointAtTime(position,time);}
  protected previousVelocityAt(index:number):Offset{const end=this.touchSamples[((this.index+index)%20+20)%20],start=this.touchSamples[((this.index+index-1)%20+20)%20];if(end==null||start==null)return Offset.zero;const dt=end.time-start.time;if(FoundationBuildMode.debug)invariant(dt>=0,'negative-velocity-interval','Touch samples must be monotonic');return dt>0?end.point.subtract(start.point).multiply(1000).divide(dt):Offset.zero;}
  protected estimateWithWeights(a:number,b:number,c:number):VelocityEstimate{if(this.moveStopped)return stoppedEstimate();const estimated=this.previousVelocityAt(-2).multiply(a).add(this.previousVelocityAt(-1).multiply(b)).add(this.previousVelocityAt(0).multiply(c)),newest=this.touchSamples[this.index];let oldest:PointAtTime|null=null;for(let i=1;i<=20;i++){oldest=this.touchSamples[(this.index+i)%20]??null;if(oldest!==null)break;}if(oldest===null||newest==null){if(FoundationBuildMode.debug)invariant(false,'empty-touch-velocity-history','There must be at least one touch sample');return new VelocityEstimate({pixelsPerSecond:Offset.zero,confidence:0,duration:0,offset:Offset.zero});}return new VelocityEstimate({pixelsPerSecond:estimated,confidence:1,duration:newest.time-oldest.time,offset:newest.point.subtract(oldest.point)});}
  override getVelocityEstimate():VelocityEstimate{return this.estimateWithWeights(0.6,0.35,0.05);}
}
export class MacOSScrollViewFlingVelocityTracker extends IOSScrollViewFlingVelocityTracker {
  override getVelocityEstimate():VelocityEstimate{return this.estimateWithWeights(0.15,0.65,0.2);}
}
