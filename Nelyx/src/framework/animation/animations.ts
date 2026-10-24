// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter animation/animations.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {Animation,AnimationStatus} from './animation.ts';import type {AnimationStatusListener} from './animation.ts';
import type {Curve} from './curves.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {AnimationLazyListenerMixin,AnimationEagerListenerMixin,AnimationLocalListenersMixin,AnimationLocalStatusListenersMixin} from './listener-helpers.ts';
/** Source mixin expressed as an abstract superclass; direct parent subscriptions retain callback identity. */
export abstract class AnimationWithParentMixin<T> extends Animation<T> {
  abstract readonly parent:Animation<T>;
  addListener(listener:()=>void):void{this.parent.addListener(listener);}removeListener(listener:()=>void):void{this.parent.removeListener(listener);}
  addStatusListener(listener:AnimationStatusListener):void{this.parent.addStatusListener(listener);}removeStatusListener(listener:AnimationStatusListener):void{this.parent.removeStatusListener(listener);}
  get status():AnimationStatus{return this.parent.status;}
}
export class AlwaysStoppedAnimation<T> extends Animation<T> {
  constructor(readonly value:T){super();}
  addListener(_listener:()=>void):void{}removeListener(_listener:()=>void):void{}addStatusListener(_listener:AnimationStatusListener):void{}removeStatusListener(_listener:AnimationStatusListener):void{}
  get status():AnimationStatus{return AnimationStatus.forward;}
  override toStringDetails():string{return `${super.toStringDetails()} ${this.value}; paused`;}
}
class ConstantAnimation extends AlwaysStoppedAnimation<number> {constructor(value:number,private readonly constantStatus:AnimationStatus,private readonly label:string){super(value);}override get status():AnimationStatus{return this.constantStatus;}override toString():string{return this.label;}}
export const kAlwaysCompleteAnimation:Animation<number>=new ConstantAnimation(1,AnimationStatus.completed,'kAlwaysCompleteAnimation');
export const kAlwaysDismissedAnimation:Animation<number>=new ConstantAnimation(0,AnimationStatus.dismissed,'kAlwaysDismissedAnimation');
const LazyAnimation=AnimationLocalStatusListenersMixin(AnimationLocalListenersMixin(AnimationLazyListenerMixin(Animation)));
const EagerAnimation=AnimationLocalStatusListenersMixin(AnimationLocalListenersMixin(AnimationEagerListenerMixin(Animation)));

export class ProxyAnimation extends LazyAnimation {
  private currentParent:Animation<number>|null;
  private savedStatus:AnimationStatus|null=null;
  private savedValue:number|null=null;
  constructor(animation:Animation<number>|null=null){super();this.currentParent=animation;if(animation===null){this.savedStatus=AnimationStatus.dismissed;this.savedValue=0;}}
  get parent():Animation<number>|null{return this.currentParent;}
  set parent(value:Animation<number>|null){
    if(value===this.currentParent)return;
    if(this.currentParent!==null){this.savedStatus=this.currentParent.status;this.savedValue=this.currentParent.value;if(this.isListening)this.didStopListening();}
    this.currentParent=value;
    if(this.currentParent!==null){
      if(this.isListening)this.didStartListening();
      if(this.savedValue!==this.currentParent.value)this.notifyListeners();
      if(this.savedStatus!==this.currentParent.status)this.notifyStatusListeners(this.currentParent.status);
      this.savedStatus=null;this.savedValue=null;
    }
  }
  didStartListening():void{this.currentParent?.addListener(this.notifyListeners);this.currentParent?.addStatusListener(this.notifyStatusListeners);}
  didStopListening():void{this.currentParent?.removeListener(this.notifyListeners);this.currentParent?.removeStatusListener(this.notifyStatusListeners);}
  get status():AnimationStatus{return this.currentParent?.status??this.savedStatus!;}
  get value():number{return this.currentParent?.value??this.savedValue!;}
  override toString():string{return this.parent===null?`${objectRuntimeType(this,'ProxyAnimation')}(null; ${super.toStringDetails()} ${this.value.toFixed(3)})`:`${this.parent}➩${objectRuntimeType(this,'ProxyAnimation')}`;}
}

const ReverseAnimationBase=AnimationLocalStatusListenersMixin(AnimationLazyListenerMixin(Animation));
export class ReverseAnimation extends ReverseAnimationBase {
  constructor(readonly parent:Animation<number>){super();}
  addListener(listener:()=>void):void{this.didRegisterListener();this.parent.addListener(listener);}
  removeListener(listener:()=>void):void{this.parent.removeListener(listener);this.didUnregisterListener();}
  didStartListening():void{this.parent.addStatusListener(this.statusChangeHandler);}
  didStopListening():void{this.parent.removeStatusListener(this.statusChangeHandler);}
  private readonly statusChangeHandler=(status:AnimationStatus):void=>{this.notifyStatusListeners(reverseStatus(status));};
  get status():AnimationStatus{return reverseStatus(this.parent.status);}
  get value():number{return 1-this.parent.value;}
  override toString():string{return `${this.parent}➪${objectRuntimeType(this,'ReverseAnimation')}`;}
}
function reverseStatus(status:AnimationStatus):AnimationStatus {
  switch(status){case AnimationStatus.forward:return AnimationStatus.reverse;case AnimationStatus.reverse:return AnimationStatus.forward;case AnimationStatus.completed:return AnimationStatus.dismissed;default:return AnimationStatus.completed;}
}
export class CurvedAnimation extends AnimationWithParentMixin<number> {
  readonly parent:Animation<number>;curve:Curve;reverseCurve:Curve|null;isDisposed=false;private direction:AnimationStatus|null=null;
  private readonly updateDirection=(status:AnimationStatus)=>{this.direction=status.isAnimating?this.direction??status:null;};
  constructor({parent,curve,reverseCurve=null}:{readonly parent:Animation<number>;readonly curve:Curve;readonly reverseCurve?:Curve|null}){super();this.parent=parent;this.curve=curve;this.reverseCurve=reverseCurve;this.updateDirection(parent.status);parent.addStatusListener(this.updateDirection);}
  private get forwardCurve():boolean{return this.reverseCurve===null||(this.direction??this.parent.status)!==AnimationStatus.reverse;}
  get value():number{const curve=this.forwardCurve?this.curve:this.reverseCurve,t=this.parent.value;if(curve===null)return t;if(t===0||t===1){if(FoundationBuildMode.debug){const transformed=curve.transform(t),rounded=transformed<0?-Math.floor(-transformed+0.5):Math.floor(transformed+0.5);invariant(rounded===t,'invalid-animation-curve-endpoint','Curves must map 0 to near zero and 1 to near one');}return t;}return curve.transform(t);}
  dispose():void{if(this.isDisposed)return;this.isDisposed=true;this.parent.removeStatusListener(this.updateDirection);}
  override toString():string{return this.reverseCurve===null?`${this.parent}➩${this.curve}`:this.forwardCurve?`${this.parent}➩${this.curve}ₒₙ/${this.reverseCurve}`:`${this.parent}➩${this.curve}/${this.reverseCurve}ₒₙ`;}
}

export class TrainHoppingAnimation extends EagerAnimation {
  private train:Animation<number>|null;
  private nextTrain:Animation<number>|null;
  private mode:'minimize'|'maximize'|null=null;
  private lastStatus:AnimationStatus|null=null;
  private lastValue:number|null=null;
  onSwitchedTrain:(()=>void)|null;
  constructor(currentTrain:Animation<number>,nextTrain:Animation<number>|null,{onSwitchedTrain=null}:{readonly onSwitchedTrain?:(()=>void)|null}={}){
    super();this.train=currentTrain;this.nextTrain=nextTrain;this.onSwitchedTrain=onSwitchedTrain;
    if(nextTrain!==null){if(currentTrain.value===nextTrain.value){this.train=nextTrain;this.nextTrain=null;}else this.mode=currentTrain.value>nextTrain.value?'maximize':'minimize';}
    this.train.addStatusListener(this.statusChangeHandler);this.train.addListener(this.valueChangeHandler);this.nextTrain?.addListener(this.valueChangeHandler);
  }
  get currentTrain():Animation<number>|null{return this.train;}
  get status():AnimationStatus{return this.liveTrain.status;}
  get value():number{return this.liveTrain.value;}
  private get liveTrain():Animation<number>{invariant(this.train!==null,'disposed-train-hopping-animation','TrainHoppingAnimation used after disposal');return this.train;}
  private readonly statusChangeHandler=(status:AnimationStatus):void=>{
    this.liveTrain;
    if(status!==this.lastStatus){this.notifyStatusListeners(status);this.lastStatus=status;}
  };
  private readonly valueChangeHandler=():void=>{
    let hop=false;const current=this.liveTrain;
    if(this.nextTrain!==null){
      hop=this.mode==='minimize'?this.nextTrain.value<=current.value:this.nextTrain.value>=current.value;
      if(hop){current.removeStatusListener(this.statusChangeHandler);current.removeListener(this.valueChangeHandler);this.train=this.nextTrain;this.nextTrain=null;this.train.addStatusListener(this.statusChangeHandler);this.statusChangeHandler(this.train.status);}
    }
    const value=this.value;if(value!==this.lastValue){this.notifyListeners();this.lastValue=value;}
    if(hop)this.onSwitchedTrain?.();
  };
  override dispose():void{const current=this.liveTrain;current.removeStatusListener(this.statusChangeHandler);current.removeListener(this.valueChangeHandler);this.train=null;this.nextTrain?.removeListener(this.valueChangeHandler);this.nextTrain=null;this.clearListeners();this.clearStatusListeners();super.dispose();}
  override toString():string{return `${this.currentTrain}➩${objectRuntimeType(this,'TrainHoppingAnimation')}(${this.nextTrain===null?'no next':'next: '+this.nextTrain})`;}
}

export abstract class CompoundAnimation<T> extends LazyAnimation {
  readonly first:Animation<T>;readonly next:Animation<T>;
  private lastStatus:AnimationStatus|null=null;
  private lastValue:T|null=null;
  constructor({first,next}:{readonly first:Animation<T>;readonly next:Animation<T>}){super();this.first=first;this.next=next;}
  abstract override get value():T;
  didStartListening():void{this.first.addListener(this.maybeNotifyListeners);this.first.addStatusListener(this.maybeNotifyStatusListeners);this.next.addListener(this.maybeNotifyListeners);this.next.addStatusListener(this.maybeNotifyStatusListeners);}
  didStopListening():void{this.first.removeListener(this.maybeNotifyListeners);this.first.removeStatusListener(this.maybeNotifyStatusListeners);this.next.removeListener(this.maybeNotifyListeners);this.next.removeStatusListener(this.maybeNotifyStatusListeners);}
  get status():AnimationStatus{return this.next.status.isAnimating?this.next.status:this.first.status;}
  private readonly maybeNotifyStatusListeners=(_status:AnimationStatus):void=>{if(this.status!==this.lastStatus){this.lastStatus=this.status;this.notifyStatusListeners(this.status);}};
  private readonly maybeNotifyListeners=():void=>{if(!valueEquals(this.value,this.lastValue)){this.lastValue=this.value;this.notifyListeners();}};
  override toString():string{return `${objectRuntimeType(this,'CompoundAnimation')}(${this.first}, ${this.next})`;}
}
function valueEquals(a:unknown,b:unknown):boolean{return a===b||(typeof a==='number'||typeof a==='bigint')&&(typeof b==='number'||typeof b==='bigint')&&a==b||a!==null&&typeof a==='object'&&'equals'in a&&typeof a.equals==='function'&&a.equals(b);}
export class AnimationMean extends CompoundAnimation<number> {
  constructor({left,right}:{readonly left:Animation<number>;readonly right:Animation<number>}){super({first:left,next:right});}
  get value():number{return (this.first.value+this.next.value)/2;}
}
/** bigint is the explicit adapter for Dart integer values outside JS's exact number range. */
export class AnimationMax<T extends number|bigint> extends CompoundAnimation<T> {
  constructor(first:Animation<T>,next:Animation<T>){super({first,next});}
  get value():T{const a=this.first.value,b=this.next.value;if(typeof a==='number'&&Number.isNaN(a))return a;if(typeof b==='number'&&Number.isNaN(b))return b;return (typeof a==='number'&&typeof b==='number'?Math.max(a,b):a===0&&b===0n&&Object.is(a,-0)?b:b===0&&a===0n&&Object.is(b,-0)?a:a>=b?a:b) as T;}
}
export class AnimationMin<T extends number|bigint> extends CompoundAnimation<T> {
  constructor(first:Animation<T>,next:Animation<T>){super({first,next});}
  get value():T{const a=this.first.value,b=this.next.value;if(typeof a==='number'&&Number.isNaN(a))return a;if(typeof b==='number'&&Number.isNaN(b))return b;return (typeof a==='number'&&typeof b==='number'?Math.min(a,b):a===0&&b===0n&&Object.is(a,-0)?a:b===0&&a===0n&&Object.is(b,-0)?b:a<=b?a:b) as T;}
}
