// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Page policy on Nelyx's existing Route/Navigator; full ModalRoute remains separate.
import {Route} from './navigation.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {Animation} from '../animation/animation.ts';
import {ProxyAnimation,kAlwaysCompleteAnimation,kAlwaysDismissedAnimation} from '../animation/animations.ts';
import type {Color} from '../../ui/color.ts';
import type {TraversalEdgeBehavior} from './focus-traversal-policy.ts';
import type {RouteTransitionBinding,RouteTransitionPolicy} from './route-transition-policy.ts';
import {invariant} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {diagnosticValueString} from '../../foundation/debug.ts';
import type {DelegatedTransitionBuilder} from './transitions.ts';
import {bindPageRouteTransition} from './page-route-gesture.ts';
export class RouteSettings {
    readonly name:string|null;
    readonly arguments:unknown;
    constructor({name=null,arguments:argumentsValue=null}:{readonly name?:string|null;readonly arguments?:unknown}={}){this.name=name;this.arguments=argumentsValue;if(new.target===RouteSettings)Object.freeze(this);}
    toString():string{return objectRuntimeType(this,'RouteSettings')+'('+(this.name===null?'none':'"'+this.name+'"')+', '+diagnosticValueString(this.arguments)+')';}
}
/** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>) */
    export type RoutePageBuilder=(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>)=>Widget;
/** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>, Widget) */
    export type RouteTransitionsBuilder=(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget)=>Widget;
export interface PageRouteOptions {
    readonly settings?:RouteSettings|null;
    readonly requestFocus?:boolean|null;
    readonly traversalEdgeBehavior?:TraversalEdgeBehavior|null;
    readonly directionalTraversalEdgeBehavior?:TraversalEdgeBehavior|null;
    readonly fullscreenDialog?:boolean;
    readonly allowSnapshotting?:boolean;
    readonly barrierDismissible?:boolean;
}
export abstract class PageRoute<T=unknown> extends Route<T> {
    readonly settings:RouteSettings;
    readonly fullscreenDialog:boolean;
    readonly allowSnapshotting:boolean;
    readonly requestFocus:boolean|null;
    readonly traversalEdgeBehavior:TraversalEdgeBehavior|null;
    readonly directionalTraversalEdgeBehavior:TraversalEdgeBehavior|null;
    private readonly dismissible:boolean;
    private binding:RouteTransitionBinding|null=null;
    private closed=false;
    private result:T|null=null;
    private completePopped!:(value:T|null)=>void;
    private completeTransition!:(value:T|null)=>void;
    private poppedComplete=false;
    private closeBackGesture:(()=>void)|null=null;
    readonly popped=new Promise<T|null>(resolve=>{this.completePopped=resolve;});
    readonly completed=new Promise<T|null>(resolve=>{this.completeTransition=resolve;});
    constructor({settings=null,requestFocus=null,traversalEdgeBehavior=null,directionalTraversalEdgeBehavior=null,fullscreenDialog=false,allowSnapshotting=true,barrierDismissible=false}:PageRouteOptions={}){
        let route:PageRoute<T>;
        const actualSettings=settings??new RouteSettings();
        super(context=>route.buildPage(context,route.animation??kAlwaysCompleteAnimation,route.secondaryAnimation??kAlwaysDismissedAnimation),actualSettings.name??'',actualSettings.arguments);
        route=this;this.settings=actualSettings;this.requestFocus=requestFocus;this.traversalEdgeBehavior=traversalEdgeBehavior;this.directionalTraversalEdgeBehavior=directionalTraversalEdgeBehavior;this.fullscreenDialog=fullscreenDialog;this.allowSnapshotting=allowSnapshotting;this.dismissible=barrierDismissible;
    }
    override get opaque():boolean{return true;}
    get barrierDismissible():boolean{return this.dismissible;}
    abstract get barrierColor():Color|null;
    abstract get barrierLabel():string|null;
    abstract get maintainState():boolean;
    abstract get transitionDuration():number;
    get reverseTransitionDuration():number{return this.transitionDuration;}
    get currentResult():T|null{return null;}
    /** @dartReturn Animation<double>? */
    get animation():Animation<number>|null{return this.binding?.animation??null;}
    /** @dartReturn Animation<double>? */
    get secondaryAnimation():Animation<number>|null{return this.binding?.secondaryAnimation??null;}
    get isCurrent():boolean{return this.binding?.isCurrent()??false;}
    get isActive():boolean{return this.binding?.isActive()??false;}
    get isFirst():boolean{return this.binding?.isFirst()??false;}
    get popGestureInProgress():boolean{return this.binding?.popGestureInProgress()??false;}
    get popGestureEnabled():boolean{return !this.fullscreenDialog&&!this.isFirst&&this.isCurrent&&this.binding?.canPopGesture()===true&&this.animation?.isCompleted===true&&this.secondaryAnimation?.isDismissed===true&&!this.popGestureInProgress;}
    /** @dartParam progress double */
    handleStartBackGesture({progress=0}:{readonly progress?:number}={}):void{
        invariant(this.isCurrent&&this.binding!==null,'inactive-back-route','Predictive back requires the current mounted route');invariant(this.closeBackGesture===null,'duplicate-back-gesture','A predictive route gesture is already active');const binding=this.binding;binding.animation.value=progress;binding.navigator.didStartUserGesture();let closed=false,removeRetirement:(()=>void)|null=null;
        const close=()=>{if(closed)return;closed=true;removeRetirement?.();binding.animation.removeStatusListener(close);this.closeBackGesture=null;if(binding.navigator.isAttached&&binding.navigator.userGestureInProgress)binding.navigator.didStopUserGesture();};this.closeBackGesture=close;removeRetirement=binding.addRetirementListener(close);
    }
    /** @dartParam progress double */
    handleUpdateBackGestureProgress({progress}:{readonly progress:number}):void{if(this.isCurrent&&this.binding)this.binding.animation.value=progress;}
    handleCancelBackGesture():void{this.endBackGesture(true);}
    handleCommitBackGesture():void{this.endBackGesture(false);}
    private endBackGesture(animateForward:boolean):void{
        const binding=this.binding,close=this.closeBackGesture;if(binding===null||close===null)return;const controller=binding.animation;
        if(this.isCurrent){if(animateForward){if(!controller.isCompleted)controller.forward();}else{binding.navigator.pop();if(controller.isAnimating)controller.reverse({from:controller.upperBound});}}
        if(controller.isAnimating)controller.addStatusListener(close);else close();
    }
    protected get navigatorContext():BuildContext|null{return this.binding?.context??null;}
    get debugLabel():string{return objectRuntimeType(this,'TransitionRoute');}
    /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
    get delegatedTransition():DelegatedTransitionBuilder|null{return null;}
    /** @dartType Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
    receivedTransition:DelegatedTransitionBuilder|null=null;
    override didChangeNext(next:Route|null):void{this.receiveTransition(next);super.didChangeNext(next);}
    override didPopNext(next:Route):void{this.receiveTransition(next);super.didPopNext(next);}
    private receiveTransition(next:Route|null):void{this.receivedTransition=next instanceof PageRoute&&this.canTransitionTo(next)&&next.delegatedTransition!==this.delegatedTransition?next.delegatedTransition:null;}
    canTransitionTo(next:Route):boolean{return next instanceof PageRoute;}
    canTransitionFrom(previous:Route):boolean{return previous instanceof PageRoute;}
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    abstract buildPage(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>):Widget;
    /** @dartParam _animation Animation<double>
     * @dartParam _secondaryAnimation Animation<double> */
    buildTransitions(_context:BuildContext,_animation:Animation<number>,_secondaryAnimation:Animation<number>,child:Widget):Widget{return child;}
    override didComplete(result:unknown):void{if(this.poppedComplete)return;this.poppedComplete=true;this.result=(result??this.currentResult) as T|null;this.completePopped(this.result);}
    dispose():void{invariant(this.binding===null,'page-route-in-use','A mounted PageRoute belongs to its Navigator');this.closed=true;this.didComplete(null);this.completeTransition(this.result);}
    override get transitionPolicy():RouteTransitionPolicy{return this.policy;}
    private readonly policy:RouteTransitionPolicy={
        get barrierColor(){return owner(this).barrierColor;},
        get barrierLabel(){return owner(this).barrierLabel;},
        get barrierDismissible(){return owner(this).barrierDismissible;},
        get maintainState(){return owner(this).maintainState;},
        get requestFocus(){return owner(this).requestFocus;},
        get traversalEdgeBehavior(){return owner(this).traversalEdgeBehavior;},
        get directionalTraversalEdgeBehavior(){return owner(this).directionalTraversalEdgeBehavior;},
        transitionDuration:()=>this.transitionDuration,
        reverseTransitionDuration:()=>this.reverseTransitionDuration,
        attach:binding=>{invariant(!this.closed&&this.binding===null,'page-route-in-use','PageRoute cannot be installed twice');this.binding=binding;bindPageRouteTransition(this,binding);},
        detach:()=>{this.binding=null;bindPageRouteTransition(this,null);this.dispose();},
        canTransitionTo:next=>this.canTransitionTo(owner(next)),
        canTransitionFrom:previous=>this.canTransitionFrom(owner(previous)),
        buildPage:context=>this.buildPage(context,this.animation??kAlwaysCompleteAnimation,this.secondaryAnimation??kAlwaysDismissedAnimation),
        buildTransitions:(context,animation,secondary,child)=>buildFlexibleTransitions(this,context,animation,secondary,child),
    };
    private readonly registerPolicy=owners.set(this.policy,this);
}
/** @dartParam animation Animation<double>
 * @dartParam secondaryAnimation Animation<double> */
function buildFlexibleTransitions<T>(route:PageRoute<T>,context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget{
    if(route.receivedTransition===null||secondaryAnimation.isDismissed)return route.buildTransitions(context,animation,secondaryAnimation,child);
    const proxied=route.buildTransitions(context,animation,new ProxyAnimation(),child);
    return route.receivedTransition(context,animation,secondaryAnimation,route.allowSnapshotting,proxied)??proxied;
}
// Explicit policy registration avoids a Navigator -> PageRoute -> Navigator cycle.
type PolicyRoute=Route&Pick<PageRoute,'maintainState'|'requestFocus'|'traversalEdgeBehavior'|'directionalTraversalEdgeBehavior'|'barrierColor'|'barrierLabel'|'barrierDismissible'>;
const owners=new WeakMap<RouteTransitionPolicy,PolicyRoute>();
function owner(policy:RouteTransitionPolicy):PolicyRoute{const route=owners.get(policy);invariant(route,'unregistered-page-route-policy','Unknown PageRoute transition policy');return route;}
export interface PageRouteBuilderOptions extends PageRouteOptions {
    /** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>) */
    readonly pageBuilder:RoutePageBuilder;
    /** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>, Widget) */
    readonly transitionsBuilder?:RouteTransitionsBuilder;
    readonly transitionDuration?:number;
    readonly reverseTransitionDuration?:number;
    readonly opaque?:boolean;
    readonly barrierColor?:Color|null;
    readonly barrierLabel?:string|null;
    readonly maintainState?:boolean;
}
export class PageRouteBuilder<T=unknown> extends PageRoute<T> {
    /** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>) */
    readonly pageBuilder:RoutePageBuilder;
    /** @dartType Widget Function(BuildContext, Animation<double>, Animation<double>, Widget) */
    readonly transitionsBuilder:RouteTransitionsBuilder;
    override readonly transitionDuration:number;
    private readonly reverseDuration:number;
    private readonly builderOpaque:boolean;
    override readonly barrierColor:Color|null;
    override readonly barrierLabel:string|null;
    override readonly maintainState:boolean;
    /** @dartParam pageBuilder Widget Function(BuildContext, Animation<double>, Animation<double>)
     * @dartParam transitionsBuilder Widget Function(BuildContext, Animation<double>, Animation<double>, Widget) */
    constructor({pageBuilder,transitionsBuilder=(_context,_animation,_secondary,child)=>child,transitionDuration=300,reverseTransitionDuration=300,opaque=true,barrierColor=null,barrierLabel=null,maintainState=true,...options}:PageRouteBuilderOptions){
        super(options);invariant(typeof pageBuilder==='function'&&typeof transitionsBuilder==='function','invalid-page-route-builder','Route callbacks must be functions');invariant([transitionDuration,reverseTransitionDuration].every(v=>Number.isFinite(v)&&v>=0),'invalid-page-route-duration','Route durations must be finite nonnegative milliseconds');this.pageBuilder=pageBuilder;this.transitionsBuilder=transitionsBuilder;this.transitionDuration=transitionDuration;this.reverseDuration=reverseTransitionDuration;this.builderOpaque=opaque;this.barrierColor=barrierColor;this.barrierLabel=barrierLabel;this.maintainState=maintainState;
    }
    override get opaque():boolean{return this.builderOpaque;}
    override get reverseTransitionDuration():number{return this.reverseDuration;}
    /** @dartParam animation Animation<double>
     * @dartParam secondary Animation<double> */
    buildPage(context:BuildContext,animation:Animation<number>,secondary:Animation<number>):Widget{return this.pageBuilder(context,animation,secondary);}
    /** @dartParam animation Animation<double>
     * @dartParam secondary Animation<double> */
    override buildTransitions(context:BuildContext,animation:Animation<number>,secondary:Animation<number>,child:Widget):Widget{return this.transitionsBuilder(context,animation,secondary,child);}
}
