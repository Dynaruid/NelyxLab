// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter animation/listener_helpers.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {exceptionStack,invariant} from '../../foundation/errors.ts';
import {HashedObserverList,ObserverList} from '../../foundation/observer-list.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {DiagnosticsProperty,ErrorDescription} from '../../foundation/diagnostics.ts';
import type {AnimationStatus,AnimationStatusListener} from './animation.ts';

// Constructor rest parameters are TypeScript mixin plumbing, not Dart value erasure.
type MixinConstructor<T=object> = abstract new (...args:any[])=>T;
/** Dart protected mixin hooks are public in TS so separately composed mixins can call them. */
export interface AnimationListenerLifecycle {didRegisterListener():void;didUnregisterListener():void}
export interface AnimationLazyListener extends AnimationListenerLifecycle {
  readonly isListening:boolean;didStartListening():void;didStopListening():void;
}
export interface AnimationEagerListener extends AnimationListenerLifecycle {dispose():void}
export interface AnimationLocalListeners {
  addListener(listener:()=>void):void;removeListener(listener:()=>void):void;
  clearListeners():void;notifyListeners():void;
}
export interface AnimationLocalStatusListeners {
  addStatusListener(listener:AnimationStatusListener):void;removeStatusListener(listener:AnimationStatusListener):void;
  clearStatusListeners():void;notifyStatusListeners(status:AnimationStatus):void;
}

export function AnimationLazyListenerMixin<TBase extends MixinConstructor>(Base:TBase):TBase & MixinConstructor<AnimationLazyListener> {
  abstract class Lazy extends Base implements AnimationLazyListener {
    private listenerCounter=0;
    abstract didStartListening():void;
    abstract didStopListening():void;
    didRegisterListener():void {
      if(FoundationBuildMode.debug)invariant(this.listenerCounter>=0,'invalid-animation-listener-count','Listener count must be nonnegative');
      if(this.listenerCounter===0)this.didStartListening();
      this.listenerCounter+=1;
    }
    didUnregisterListener():void {
      if(FoundationBuildMode.debug)invariant(this.listenerCounter>=1,'invalid-animation-listener-count','No registered animation listener to remove');
      this.listenerCounter-=1;
      if(this.listenerCounter===0)this.didStopListening();
    }
    get isListening():boolean{return this.listenerCounter>0;}
  }
  return Lazy;
}

export function AnimationEagerListenerMixin<TBase extends MixinConstructor>(Base:TBase):TBase & MixinConstructor<AnimationEagerListener> {
  abstract class Eager extends Base implements AnimationEagerListener {
    didRegisterListener():void{}
    didUnregisterListener():void{}
    dispose():void{}
  }
  return Eager;
}

export function AnimationLocalListenersMixin<TBase extends MixinConstructor<AnimationListenerLifecycle>>(Base:TBase):TBase & MixinConstructor<AnimationLocalListeners> {
  abstract class Local extends Base implements AnimationLocalListeners {
    private readonly animationListeners=new HashedObserverList<()=>void>();
    addListener(listener:()=>void):void{this.didRegisterListener();this.animationListeners.add(listener);}
    removeListener(listener:()=>void):void{if(this.animationListeners.remove(listener))this.didUnregisterListener();}
    clearListeners():void{this.animationListeners.clear();}
    // Bound once: Dart method tear-offs compare equal across add/remove calls.
    readonly notifyListeners=():void=>{
      for(const listener of this.animationListeners.toList({growable:false})){
        try{if(this.animationListeners.contains(listener))listener();}
        catch(exception){reportListenerError(this,exception,false);}
      }
    };
  }
  return Local;
}

export function AnimationLocalStatusListenersMixin<TBase extends MixinConstructor<AnimationListenerLifecycle>>(Base:TBase):TBase & MixinConstructor<AnimationLocalStatusListeners> {
  abstract class LocalStatus extends Base implements AnimationLocalStatusListeners {
    private readonly animationStatusListeners=new ObserverList<AnimationStatusListener>();
    addStatusListener(listener:AnimationStatusListener):void{this.didRegisterListener();this.animationStatusListeners.add(listener);}
    removeStatusListener(listener:AnimationStatusListener):void{if(this.animationStatusListeners.remove(listener))this.didUnregisterListener();}
    clearStatusListeners():void{this.animationStatusListeners.clear();}
    readonly notifyStatusListeners=(status:AnimationStatus):void=>{
      for(const listener of this.animationStatusListeners.toList({growable:false})){
        try{if(this.animationStatusListeners.contains(listener))listener(status);}
        catch(exception){reportListenerError(this,exception,true);}
      }
    };
  }
  return LocalStatus;
}

function reportListenerError(owner:object,exception:unknown,status:boolean):void {
  const type=owner.constructor.name,kind=status?'status listeners':'listeners';
  FlutterError.reportError(new FlutterErrorDetails({
    exception,stack:exceptionStack(exception),library:'animation library',
    context:new ErrorDescription(`while notifying ${kind} for ${type}`),
    informationCollector:FoundationBuildMode.debug?()=>[
      new DiagnosticsProperty(`The ${type} notifying ${kind} was`,owner,{style:'errorProperty'}),
    ]:null,
  }));
}
