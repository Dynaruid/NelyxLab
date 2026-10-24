// SPDX-License-Identifier: BSD-3-Clause
// Own contact between the existing Navigator and source-backed page policies.
import type {Animation} from '../animation/animation.ts';
import type {AnimationController} from '../animation/animation-controller.ts';
import type {BuildContext,Widget} from './framework.ts';
import type {TraversalEdgeBehavior} from './focus-traversal-policy.ts';
import type {Color} from '../../ui/color.ts';
import type {NavigatorController} from './navigation.ts';
export interface RouteTransitionBinding {
    readonly animation:AnimationController;
    readonly secondaryAnimation:Animation<number>;
    readonly context:BuildContext;
    readonly navigator:NavigatorController;
    readonly isCurrent:()=>boolean;
    readonly isActive:()=>boolean;
    readonly isFirst:()=>boolean;
    readonly popGestureInProgress:()=>boolean;
    readonly canPopGesture:()=>boolean;
    readonly addRetirementListener:(listener:()=>void)=>()=>void;
}
export interface RouteTransitionPolicy {
    readonly barrierColor:Color|null;
    readonly barrierLabel:string|null;
    readonly barrierDismissible:boolean;
    readonly maintainState:boolean;
    readonly requestFocus:boolean|null;
    readonly traversalEdgeBehavior:TraversalEdgeBehavior|null;
    readonly directionalTraversalEdgeBehavior:TraversalEdgeBehavior|null;
    transitionDuration(context:BuildContext):number;
    reverseTransitionDuration(context:BuildContext):number;
    attach(binding:RouteTransitionBinding):void;
    detach():void;
    canTransitionTo(next:RouteTransitionPolicy):boolean;
    canTransitionFrom(previous:RouteTransitionPolicy):boolean;
    buildPage(context:BuildContext):Widget;
    buildTransitions(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget):Widget;
}
