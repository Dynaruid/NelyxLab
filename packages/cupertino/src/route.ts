// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import type {Widget,WidgetOptions,BuildContext} from '@nelyx/core/framework/widgets/framework';
import type {Animation} from '@nelyx/core/framework/animation/animation';
import {CurvedAnimation} from '@nelyx/core/framework/animation/animations';
import {Curves} from '@nelyx/core/framework/animation/curves';
import {Tween} from '@nelyx/core/framework/animation/tween';
import {Offset} from '@nelyx/core/ui/offset';
import type {Decoration} from '@nelyx/core/framework/painting/decoration';
import {SlideTransition,DecoratedBoxTransition} from '@nelyx/core/framework/widgets/transitions';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {cupertinoEdgeShadowTween} from './internal/route/edge-shadow.ts';
import {PageRoute} from '@nelyx/core/framework/widgets/pages';
import type {PageRouteOptions} from '@nelyx/core/framework/widgets/pages';
import {Route} from '@nelyx/core/framework/widgets/navigation';
import {PageTransitionsBuilder} from '@nelyx/core/framework/widgets/page-transitions-builder';
import type {DelegatedTransitionBuilder} from '@nelyx/core/framework/widgets/transitions';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import type {ValueListenable} from '@nelyx/core/foundation/notifier';
import {Color} from '@nelyx/core/ui/color';
import {invariant} from '@nelyx/core/foundation/errors';
import {CupertinoBackGestureDetector,startCupertinoBackGesture} from './internal/route/back-gesture.ts';

const rightMiddleTween=new Tween<Offset>({begin:new Offset(1,0),end:Offset.zero});
const middleLeftTween=new Tween<Offset>({begin:Offset.zero,end:new Offset(-1/3,0)});
const bottomUpTween=new Tween<Offset>({begin:new Offset(0,1),end:Offset.zero});
// These built-in transition widgets already listen to both animations. Keep one
// per route/child so the outer transition builder does not rebuild their static
// gesture and semantic descendants on every animation tick.
const builtTransitions=new WeakMap<object,{animation:Animation<number>;secondaryAnimation:Animation<number>;child:Widget;linearTransition:boolean;fullscreenDialog:boolean;widget:Widget}>();
export interface CupertinoPageTransitionOptions extends WidgetOptions {
    /** @dartType Animation<double> */
    readonly primaryRouteAnimation:Animation<number>;
    /** @dartType Animation<double> */
    readonly secondaryRouteAnimation:Animation<number>;
    readonly child:Widget;
    readonly linearTransition:boolean;
}
export class CupertinoPageTransition extends StatefulWidget {
    /** @dartType Animation<double> */
    readonly primaryRouteAnimation:Animation<number>;
    /** @dartType Animation<double> */
    readonly secondaryRouteAnimation:Animation<number>;
    readonly child:Widget;
    readonly linearTransition:boolean;
    /** @dartParam primaryRouteAnimation Animation<double>
     * @dartParam secondaryRouteAnimation Animation<double> */
    constructor({key=null,primaryRouteAnimation,secondaryRouteAnimation,child,linearTransition}:CupertinoPageTransitionOptions){
        super(key);this.primaryRouteAnimation=primaryRouteAnimation;this.secondaryRouteAnimation=secondaryRouteAnimation;this.child=child;this.linearTransition=linearTransition;
    }
    /** @dartParam _animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    static delegatedTransition(context:BuildContext,_animation:Animation<number>,secondaryAnimation:Animation<number>,_allowSnapshotting:boolean,child:Widget|null):Widget|null{
        const animation=new CurvedAnimation({parent:secondaryAnimation,curve:Curves.linearToEaseOut,reverseCurve:Curves.easeInToLinear});
        const position=middleLeftTween.animate(animation);animation.dispose();
        return new SlideTransition({position,textDirection:Directionality.of(context),transformHitTests:false,child});
    }
    createState():State{return new CupertinoPageTransitionState();}
}
class CupertinoPageTransitionState extends State<CupertinoPageTransition> {
    private primaryPosition!:Animation<Offset>;
    private secondaryPosition!:Animation<Offset>;
    private primaryShadow!:Animation<Decoration>;
    private primaryCurve:CurvedAnimation|null=null;
    private secondaryCurve:CurvedAnimation|null=null;
    private shadowCurve:CurvedAnimation|null=null;
    override initState():void{super.initState();this.setupAnimations();}
    override didUpdateWidget(old:CupertinoPageTransition):void{super.didUpdateWidget(old);if(old.primaryRouteAnimation!==this.widget.primaryRouteAnimation||old.secondaryRouteAnimation!==this.widget.secondaryRouteAnimation||old.linearTransition!==this.widget.linearTransition){this.disposeCurves();this.setupAnimations();}}
    private disposeCurves():void{this.primaryCurve?.dispose();this.secondaryCurve?.dispose();this.shadowCurve?.dispose();this.primaryCurve=null;this.secondaryCurve=null;this.shadowCurve=null;}
    private setupAnimations():void{
        if(!this.widget.linearTransition){
            this.primaryCurve=new CurvedAnimation({parent:this.widget.primaryRouteAnimation,curve:Curves.fastEaseInToSlowEaseOut,reverseCurve:Curves.fastEaseInToSlowEaseOut.flipped});
            this.secondaryCurve=new CurvedAnimation({parent:this.widget.secondaryRouteAnimation,curve:Curves.linearToEaseOut,reverseCurve:Curves.easeInToLinear});
            this.shadowCurve=new CurvedAnimation({parent:this.widget.primaryRouteAnimation,curve:Curves.linearToEaseOut});
        }
        this.primaryPosition=rightMiddleTween.animate(this.primaryCurve??this.widget.primaryRouteAnimation);
        this.secondaryPosition=middleLeftTween.animate(this.secondaryCurve??this.widget.secondaryRouteAnimation);
        this.primaryShadow=cupertinoEdgeShadowTween.animate(this.shadowCurve??this.widget.primaryRouteAnimation);
    }
    override dispose():void{this.disposeCurves();super.dispose();}
    build(context:BuildContext):Widget{
        const direction=Directionality.of(context);
        return new SlideTransition({position:this.secondaryPosition,textDirection:direction,transformHitTests:false,child:new SlideTransition({position:this.primaryPosition,textDirection:direction,child:new DecoratedBoxTransition({decoration:this.primaryShadow,child:this.widget.child})})});
    }
}
export interface CupertinoFullscreenDialogTransitionOptions extends CupertinoPageTransitionOptions {}
export class CupertinoFullscreenDialogTransition extends StatefulWidget {
    /** @dartType Animation<double> */
    readonly primaryRouteAnimation:Animation<number>;
    /** @dartType Animation<double> */
    readonly secondaryRouteAnimation:Animation<number>;
    readonly child:Widget;
    readonly linearTransition:boolean;
    /** @dartParam primaryRouteAnimation Animation<double>
     * @dartParam secondaryRouteAnimation Animation<double> */
    constructor({key=null,primaryRouteAnimation,secondaryRouteAnimation,child,linearTransition}:CupertinoFullscreenDialogTransitionOptions){
        super(key);this.primaryRouteAnimation=primaryRouteAnimation;this.secondaryRouteAnimation=secondaryRouteAnimation;this.child=child;this.linearTransition=linearTransition;
    }
    createState():State{return new CupertinoFullscreenDialogTransitionState();}
}
class CupertinoFullscreenDialogTransitionState extends State<CupertinoFullscreenDialogTransition> {
    private primaryPosition!:Animation<Offset>;
    private secondaryPosition!:Animation<Offset>;
    private primaryCurve:CurvedAnimation|null=null;
    private secondaryCurve:CurvedAnimation|null=null;
    override initState():void{super.initState();this.setupAnimations();}
    override didUpdateWidget(old:CupertinoFullscreenDialogTransition):void{super.didUpdateWidget(old);if(old.primaryRouteAnimation!==this.widget.primaryRouteAnimation||old.secondaryRouteAnimation!==this.widget.secondaryRouteAnimation||old.linearTransition!==this.widget.linearTransition){this.disposeCurves();this.setupAnimations();}}
    private disposeCurves():void{this.primaryCurve?.dispose();this.secondaryCurve?.dispose();this.primaryCurve=null;this.secondaryCurve=null;}
    private setupAnimations():void{
        this.primaryCurve=new CurvedAnimation({parent:this.widget.primaryRouteAnimation,curve:Curves.linearToEaseOut,reverseCurve:Curves.linearToEaseOut.flipped});
        this.primaryPosition=bottomUpTween.animate(this.primaryCurve);
        if(!this.widget.linearTransition)this.secondaryCurve=new CurvedAnimation({parent:this.widget.secondaryRouteAnimation,curve:Curves.linearToEaseOut,reverseCurve:Curves.easeInToLinear});
        this.secondaryPosition=middleLeftTween.animate(this.secondaryCurve??this.widget.secondaryRouteAnimation);
    }
    override dispose():void{this.disposeCurves();super.dispose();}
    build(context:BuildContext):Widget{return new SlideTransition({position:this.secondaryPosition,textDirection:Directionality.of(context),transformHitTests:false,child:new SlideTransition({position:this.primaryPosition,child:this.widget.child})});}
}

/** Source mixin policy on the existing canonical PageRoute adapter. */
export abstract class CupertinoRouteTransitionMixin<T=unknown> extends PageRoute<T> {
    static readonly kTransitionDuration=500;
    abstract readonly title:string|null;
    abstract buildContent(context:BuildContext):Widget;
    private previousTitleNotifier:ValueNotifier<string|null>|null=null;
    get previousTitle():ValueListenable<string|null>{invariant(this.previousTitleNotifier!==null,'uninstalled-cupertino-previous-title','Cannot read previousTitle before route installation');return this.previousTitleNotifier;}
    override didChangePrevious(previous:Route|null):void{const title=previous instanceof CupertinoRouteTransitionMixin?previous.title:null;if(this.previousTitleNotifier===null)this.previousTitleNotifier=new ValueNotifier(title);else this.previousTitleNotifier.value=title;super.didChangePrevious(previous);}
    override dispose():void{builtTransitions.delete(this);this.previousTitleNotifier?.dispose();super.dispose();}
    override get transitionDuration():number{return CupertinoRouteTransitionMixin.kTransitionDuration;}
    override get barrierColor():Color|null{return this.fullscreenDialog?null:cupertinoPageTransitionBarrierColor;}
    override get barrierLabel():string|null{return null;}
    override canTransitionTo(next:Route):boolean{return (!(next instanceof PageRoute)||!next.fullscreenDialog)&&(next instanceof CupertinoRouteTransitionMixin||next instanceof PageRoute&&next.delegatedTransition!==null);}
    override canTransitionFrom(previous:Route):boolean{return previous instanceof PageRoute&&!this.fullscreenDialog;}
    /** @dartParam _animation Animation<double>
     * @dartParam _secondaryAnimation Animation<double> */
    buildPage(context:BuildContext,_animation:Animation<number>,_secondaryAnimation:Animation<number>):Widget{return new Semantics({scopesRoute:true,explicitChildNodes:true,child:this.buildContent(context)});}
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    static buildPageTransitions<T>(route:PageRoute<T>,_context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget{
        const linearTransition=route.popGestureInProgress,fullscreenDialog=route.fullscreenDialog,cached=builtTransitions.get(route);
        if(cached&&cached.animation===animation&&cached.secondaryAnimation===secondaryAnimation&&cached.child===child&&cached.linearTransition===linearTransition&&cached.fullscreenDialog===fullscreenDialog)return cached.widget;
        const widget=fullscreenDialog?new CupertinoFullscreenDialogTransition({primaryRouteAnimation:animation,secondaryRouteAnimation:secondaryAnimation,linearTransition,child}):new CupertinoPageTransition({primaryRouteAnimation:animation,secondaryRouteAnimation:secondaryAnimation,linearTransition,child:new CupertinoBackGestureDetector(()=>route.popGestureEnabled,()=>startCupertinoBackGesture(route),child)});
        builtTransitions.set(route,{animation,secondaryAnimation,child,linearTransition,fullscreenDialog,widget});return widget;
    }
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    override buildTransitions(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget{return CupertinoRouteTransitionMixin.buildPageTransitions(this,context,animation,secondaryAnimation,child);}
}
const cupertinoPageTransitionBarrierColor=new Color(0x18000000);
export interface CupertinoPageRouteOptions extends Pick<PageRouteOptions,'settings'|'requestFocus'|'fullscreenDialog'|'allowSnapshotting'|'barrierDismissible'> {
    readonly builder:(context:BuildContext)=>Widget;
    readonly title?:string|null;
    readonly maintainState?:boolean;
}
export class CupertinoPageRoute<T=unknown> extends CupertinoRouteTransitionMixin<T> {
    readonly builder:(context:BuildContext)=>Widget;
    override readonly title:string|null;
    override readonly maintainState:boolean;
    constructor({builder,title=null,maintainState=true,...options}:CupertinoPageRouteOptions){super(options);this.builder=builder;this.title=title;this.maintainState=maintainState;}
    /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
    override get delegatedTransition():DelegatedTransitionBuilder|null{return CupertinoPageTransition.delegatedTransition;}
    buildContent(context:BuildContext):Widget{return this.builder(context);}
    override get debugLabel():string{return super.debugLabel+'('+this.settings.name+')';}
}
export class CupertinoPageTransitionsBuilder extends PageTransitionsBuilder {
    override get transitionDuration():number{return CupertinoRouteTransitionMixin.kTransitionDuration;}
    /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
    override get delegatedTransition():DelegatedTransitionBuilder|null{return CupertinoPageTransition.delegatedTransition;}
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    override buildTransitions<T>(route:PageRoute<T>,context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget{return CupertinoRouteTransitionMixin.buildPageTransitions(route,context,animation,secondaryAnimation,child);}
}
