// SPDX-License-Identifier: BSD-3-Clause
// Host-driven Flutter ticker adaptation. Elapsed milliseconds continue while muted/hidden.
import type {Disposable} from '../../foundation/disposable.ts';
import {invariant} from '../../foundation/errors.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
import {TickerFuture} from './ticker-future.ts';
export interface TickerProvider {
  createTicker(onTick:(elapsedMilliseconds:number)=>void):Ticker;
  /** Host adaptation: widget providers expose their actual View's accessibility policy. */
  readonly disableAnimations?:boolean;
}
export interface TickerOptions {readonly debugLabel?:string}
export class Ticker {
  private callbackId:number|undefined;
  private readonly visibility:Disposable;
  private readonly closing:Disposable;
  private startTime:number|undefined;
  private carriedElapsed=0;
  private elapsed:number|undefined;
  private closed=false;
  private future:TickerFuture|undefined;
  private manuallyMuted=false;
  private forced=false;
  private muteOwners=new Set<object>();
  readonly debugLabel:string|undefined;
  get muted():boolean{return this.manuallyMuted||this.muteOwners.size>0;}
  set muted(value:boolean){invariant(!this.closed,'disposed-ticker','Muting a disposed Ticker');this.manuallyMuted=value;this.updateBinding();}
  get forceFrames():boolean{return this.forced;}
  set forceFrames(value:boolean){invariant(!this.closed&&typeof value==='boolean','invalid-force-frames','forceFrames requires a live Ticker and a boolean');if(this.forced===value)return;this.forced=value;this.updateBinding();}
  constructor(private readonly scheduler:FrameScheduler,private readonly tick:(elapsedMilliseconds:number)=>void,options:TickerOptions={}){
    this.debugLabel=options.debugLabel;
    this.visibility=scheduler.observeVisibility(()=>this.updateBinding());this.closing=scheduler.observeDispose(()=>this.dispose());
  }
  get active():boolean{return !!this.future;}
  get isActive():boolean{return this.active;}
  get isTicking():boolean{return this.active&&!this.muted&&(this.scheduler.framesEnabled||this.scheduler.phase!=='idle');}
  get scheduled():boolean{return this.callbackId!==undefined;}
  get shouldScheduleTick():boolean{return !this.closed&&this.active&&!this.muted&&!this.scheduled&&(this.scheduler.framesEnabled||this.forceFrames);}
  get lastElapsedDuration():number|undefined{return this.elapsed;}
  setMuted(owner:object,muted:boolean):void{if(this.closed)return;if(muted)this.muteOwners.add(owner);else this.muteOwners.delete(owner);this.updateBinding();}
  private updateBinding():void{
    if(this.closed||!this.active||this.muted||!this.scheduler.framesEnabled&&!this.forceFrames)this.unscheduleTick();
    else if(this.shouldScheduleTick)this.scheduleTick();
  }
  scheduleTick(options:{readonly rescheduling?:boolean}={}):void{
    invariant(this.shouldScheduleTick,'invalid-ticker-schedule','Ticker is muted, inactive, closed, hidden or already scheduled');
    this.callbackId=this.scheduler.scheduleFrameCallback(timestamp=>this.advance(timestamp),{...options,scheduleNewFrame:false});
    try{if(this.forceFrames)this.scheduler.scheduleForcedFrame();else this.scheduler.scheduleFrame();}catch(error){this.unscheduleTick();throw error;}
  }
  unscheduleTick():void{if(this.callbackId!==undefined){this.scheduler.cancelFrameCallbackWithId(this.callbackId);this.callbackId=undefined;}}
  start():TickerFuture {
    invariant(!this.closed&&!this.active,'invalid-ticker','Ticker is disposed or already running');
    const future=new TickerFuture();this.future=future;this.carriedElapsed=0;this.elapsed=undefined;
    this.startTime=this.scheduler.phase!=='idle'&&this.scheduler.phase!=='post-frame'?this.scheduler.timestamp:undefined;
    try{this.updateBinding();}catch(error){this.stop({canceled:true});throw error;}return future;
  }
  stop(options:{readonly canceled?:boolean}={}):void {
    const future=this.future;if(!future)return;this.future=undefined;this.unscheduleTick();this.startTime=undefined;this.elapsed=undefined;this.carriedElapsed=0;
    if(options.canceled)future.cancel(this);else future.finish();
  }
  absorbTicker(original:Ticker):void{
    invariant(!this.closed&&!this.active&&!this.scheduled&&original!==this&&!original.closed,'invalid-ticker-absorption','Absorption requires an inactive destination and a live distinct source');
    this.future=original.future;original.future=undefined;
    if(this.scheduler===original.scheduler){this.startTime=original.startTime;this.carriedElapsed=original.carriedElapsed;}
    else{this.startTime=undefined;this.carriedElapsed=original.elapsed??original.carriedElapsed;}
    this.elapsed=original.elapsed;original.dispose();this.updateBinding();
  }
  dispose():void {
    if(this.closed)return;this.closed=true;this.stop({canceled:true});this.unscheduleTick();this.visibility.dispose();this.closing.dispose();this.muteOwners.clear();
  }
  toString():string{return `Ticker(${this.debugLabel??''}${this.active?', active':''}${this.muted?', muted':''})`;}
  private advance(timestamp:number):void{
    this.callbackId=undefined;const future=this.future;if(!future||this.closed||this.muted)return;
    this.startTime??=timestamp;this.elapsed=this.carriedElapsed+Math.max(0,timestamp-this.startTime);
    try{this.tick(this.elapsed);}finally{if(this.future===future&&this.shouldScheduleTick)this.scheduleTick({rescheduling:true});}
  }
}
