// SPDX-License-Identifier: BSD-3-Clause
// Host-driven adaptation of the pinned Flutter scheduler/binding.dart. Units are milliseconds.
import {exceptionStack} from '../../foundation/errors.ts';
import type {Clock} from '../../foundation/clock.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {invariant,NelyxError} from '../../foundation/errors.ts';
import { FlutterError } from "../../foundation/flutter-error.ts";
import { FlutterErrorDetails } from "../../foundation/assertions.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";

export type FramePhase='idle'|'transient'|'mid-frame-microtasks'|'persistent'|'build'|'layout'|'paint'|'semantics'|'post-frame';
export type FrameCallback=(timestamp:number)=>void;
export interface FrameCallbackOptions {readonly rescheduling?:boolean;readonly scheduleNewFrame?:boolean;readonly debugLabel?:string}
export interface SchedulerOptions {readonly reportError?:(error:unknown,phase:FramePhase)=>void;readonly requestForcedFrame?:()=>void}
interface Completion {readonly promise:Promise<void>;readonly resolve:()=>void;readonly reject:(error:Error)=>void}
/** One scheduler per View; the host remains the sole owner of vsync/timer scheduling. */
export class FrameScheduler {
  phase:FramePhase='idle';
  timestamp=0;
  private rawTimestamp=0;
  private lastRaw:number|undefined;
  private dilation=1;
  private visibleValue=true;
  private closed=false;
  private scheduledFrame=false;
  private nextId=0;
  private transient=new Map<number,FrameCallback>();
  private repeating=new Map<number,FrameCallback>();
  private persistent=new Map<number,FrameCallback>();
  private post:FrameCallback[]=[];
  private removed=new Set<number>();
  private visibility=new Set<(visible:boolean)=>void>();
  private closing=new Set<()=>void>();
  private errors:unknown[]=[];
  private insideTransient=false;
  private persistentDispatched=false;
  private firstFrameDeferrals=0;
  private firstSubmitted=false;
  private completion:Completion|undefined;
  constructor(private readonly clock:Clock,private readonly invalidate:()=>void,private readonly options:SchedulerOptions={}) {}
  get disposed():boolean{return this.closed;}
  get visible():boolean{return this.visibleValue;}
  set visible(value:boolean){this.setVisible(value);}
  get framesEnabled():boolean{return this.visibleValue&&!this.closed;}
  get hasScheduledFrame():boolean{return this.scheduledFrame;}
  get transientCallbackCount():number{return this.transient.size+this.repeating.size;}
  get currentFrameTimeStamp():number{invariant(this.phase!=='idle','no-active-frame','Frame timestamp is only valid during a frame');return this.timestamp;}
  get currentSystemFrameTimeStamp():number{return this.rawTimestamp;}
  get timeDilation():number{return this.dilation;}
  set timeDilation(value:number){invariant(!this.closed&&Number.isFinite(value)&&value>0,'invalid-time-dilation','Time dilation must be finite and positive');this.dilation=value;}
  get sendFramesToEngine():boolean{return !this.closed&&(this.firstSubmitted||this.firstFrameDeferrals===0);}
  get firstFrameSubmitted():boolean{return this.firstSubmitted;}
  requestFrame():void {
    if(!this.framesEnabled||this.scheduledFrame)return;this.scheduledFrame=true;
    try{this.invalidate();}catch(error){this.scheduledFrame=false;throw error;}
  }
  scheduleFrame():void{this.requestFrame();}
  /** Request one host frame even when this scheduler's View is hidden. */
  scheduleForcedFrame():void{if(this.closed||this.scheduledFrame)return;this.scheduledFrame=true;try{(this.options.requestForcedFrame??this.invalidate)();}catch(error){this.scheduledFrame=false;throw error;}}
  /** One-shot callbacks added during transient dispatch belong to the next frame. */
  scheduleFrameCallback(callback:FrameCallback,options:FrameCallbackOptions={}):number {
    this.ensureAlive();invariant(!options.rescheduling||this.insideTransient,'invalid-rescheduling','Rescheduling requires a transient callback in scope');
    const id=++this.nextId;this.transient.set(id,callback);
    try{if(options.scheduleNewFrame!==false)this.requestFrame();}catch(error){this.transient.delete(id);throw error;}return id;
  }
  cancelFrameCallbackWithId(id:number):void {
    invariant(Number.isSafeInteger(id)&&id>0,'invalid-frame-callback-id','Frame callback IDs must be positive integers');
    this.transient.delete(id);if(this.insideTransient)this.removed.add(id);
  }
  /** W5 compatibility: a disposable repeating animation registration. */
  addTransient(callback:FrameCallback):Disposable {
    this.ensureAlive();const id=++this.nextId;this.repeating.set(id,callback);
    try{this.requestFrame();}catch(error){this.repeating.delete(id);throw error;}return {dispose:()=>{this.repeating.delete(id);}};
  }
  addPersistentFrameCallback(callback:FrameCallback):Disposable {
    this.ensureAlive();const id=++this.nextId;this.persistent.set(id,callback);return {dispose:()=>{this.persistent.delete(id);}};
  }
  /** Passive post-frame registration follows Flutter: it does not request another frame. */
  addPostFrameCallback(callback:FrameCallback,_options:{readonly debugLabel?:string}={}):void {this.ensureAlive();this.post.push(callback);}
  /** W5 convenience API requests a frame as well as registering a post-frame callback. */
  addPostFrame(callback:FrameCallback):void {const entry:FrameCallback=time=>callback(time);this.addPostFrameCallback(entry);try{this.requestFrame();}catch(error){this.post=this.post.filter(item=>item!==entry);throw error;}}
  get endOfFrame():Promise<void> {
    this.ensureAlive();if(this.completion)return this.completion.promise;
    let resolve!:()=>void,reject!:(error:Error)=>void;
    const promise=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
    // View close has an explicit rejection even if a consumer no longer awaits its frame.
    void promise.catch(()=>{});
    const completion:Completion={promise,resolve,reject};this.completion=completion;
    const callback=()=>{if(this.completion!==completion)return;this.completion=undefined;completion.resolve();};
    this.addPostFrameCallback(callback);
    try{if(this.phase==='idle'||this.phase==='post-frame')this.requestFrame();}
    catch(error){if(this.completion===completion)this.completion=undefined;this.post=this.post.filter(item=>item!==callback);completion.reject(error instanceof Error?error:new Error('Frame admission failed',{cause:error}));throw error;}return promise;
  }
  beginFrame(rawTimestamp=this.clock.now()):void {
    invariant(!this.closed&&this.phase==='idle','reentrant-frame','Frame already active or scheduler disposed');
    invariant(Number.isFinite(rawTimestamp),'invalid-clock','Clock must return finite milliseconds');
    const raw=this.lastRaw===undefined?rawTimestamp:Math.max(this.lastRaw,rawTimestamp);
    this.timestamp=this.lastRaw===undefined?Math.max(0,raw):this.timestamp+(raw-this.lastRaw)/this.dilation;
    this.lastRaw=raw;this.rawTimestamp=raw;this.scheduledFrame=false;this.persistentDispatched=false;this.phase='transient';
    const callbacks=this.transient,repeating=[...this.repeating];this.transient=new Map();this.insideTransient=true;
    try{
      for(const [id,callback]of callbacks){if(this.closed)break;if(!this.removed.has(id))this.invoke(callback);}
      for(const [id,callback]of repeating){if(this.closed)break;if(this.repeating.has(id))this.invoke(callback);}
    }finally{this.insideTransient=false;this.removed.clear();if(!this.closed)this.phase='mid-frame-microtasks';}
  }
  handleBeginFrame(timestamp?:number):void{this.beginFrame(timestamp);}
  /** Hosts with a split begin/draw turn can let JavaScript microtasks run between these calls. */
  runPersistentFrameCallbacks():void {
    if(this.closed)return;
    invariant(this.phase!=='idle'&&this.phase!=='transient'&&this.phase!=='post-frame','invalid-frame-phase','Persistent callbacks require a begun frame');
    if(this.persistentDispatched)return;this.persistentDispatched=true;this.phase='persistent';
    for(const [id,callback]of [...this.persistent]){if(this.closed)break;if(this.persistent.has(id))this.invoke(callback);}
  }
  endFrame():void {
    if(this.closed)return;invariant(this.phase!=='idle'&&this.phase!=='transient','invalid-frame-phase','End frame requires a completed begin phase');
    this.runPersistentFrameCallbacks();if(this.closed)return;
    const callbacks=this.post;this.post=[];this.phase='post-frame';
    try{for(const callback of callbacks){if(this.closed)break;this.invoke(callback);}}
    finally{if(!this.closed){this.phase='idle';if(this.transient.size||this.repeating.size)this.requestFrame();}}
    const errors=this.errors;this.errors=[];if(errors.length)throw new AggregateError(errors,'Frame callbacks failed');
  }
  handleDrawFrame():void{this.runPersistentFrameCallbacks();this.endFrame();}
  deferFirstFrame():void{this.ensureAlive();this.firstFrameDeferrals++;}
  allowFirstFrame():void {
    this.ensureAlive();invariant(this.firstFrameDeferrals>0,'unbalanced-first-frame','allowFirstFrame requires a matching deferral');
    this.firstFrameDeferrals--;if(!this.firstSubmitted&&this.firstFrameDeferrals===0)this.requestFrame();
  }
  markFirstFrameSubmitted():void{if(!this.closed)this.firstSubmitted=true;}
  observeVisibility(callback:(visible:boolean)=>void):Disposable {this.ensureAlive();this.visibility.add(callback);return {dispose:()=>{this.visibility.delete(callback);}};}
  observeDispose(callback:()=>void):Disposable {this.ensureAlive();this.closing.add(callback);return {dispose:()=>{this.closing.delete(callback);}};}
  setVisible(visible:boolean):void {
    if(this.closed||visible===this.visibleValue)return;this.visibleValue=visible;if(!visible)this.scheduledFrame=false;
    const errors:unknown[]=[];
    for(const callback of [...this.visibility])if(this.visibility.has(callback))try{callback(visible);}catch(error){errors.push(error);}
    if(visible)this.requestFrame();if(errors.length)throw new AggregateError(errors,'Scheduler visibility observers failed');
  }
  dispose():void {
    if(this.closed)return;this.closed=true;this.phase='idle';this.scheduledFrame=false;
    this.transient.clear();this.repeating.clear();this.persistent.clear();this.post=[];this.visibility.clear();
    const completion=this.completion;this.completion=undefined;completion?.reject(new NelyxError('frame-canceled','View closed before endOfFrame'));
    const errors=this.errors;this.errors=[];for(const callback of [...this.closing])try{callback();}catch(error){errors.push(error);}this.closing.clear();
    if(errors.length)throw new AggregateError(errors,'Scheduler disposal observers failed');
  }
  private ensureAlive():void{invariant(!this.closed,'closed-scheduler','Scheduler belongs to a closed View');}
  private invoke(callback:FrameCallback):void {
    try{callback(this.timestamp);}catch(error){
      if(this.options.reportError)try{this.options.reportError(error,this.phase);}catch(failure){if(this.closed)throw new AggregateError([error,failure],'Closed scheduler callback reporting failed');this.errors.push(error,failure);}
      else try{FlutterError.reportError(new FlutterErrorDetails({exception:error,stack:exceptionStack(error),library:'scheduler library',context:new ErrorDescription('during a scheduler callback in '+this.phase)}));}catch(failure){if(this.closed)throw new AggregateError([error,failure],'Closed scheduler callback reporting failed');this.errors.push(error,failure);}
    }
  }
}
