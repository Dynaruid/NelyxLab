// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {FoundationPlatform} from '../../foundation/platform.ts';import type {TargetPlatform} from '../../foundation/platform.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';import {LogicalKeyboardKey} from '../../services/keyboard-key.ts';
import {MultitouchDragStrategy} from '../gestures/recognizer.ts';
import {VelocityTracker,IOSScrollViewFlingVelocityTracker,MacOSScrollViewFlingVelocityTracker} from '../gestures/velocity-tracker.ts';import type {GestureVelocityTrackerBuilder} from '../gestures/monodrag.ts';
import {ScrollPhysics,ClampingScrollPhysics,BouncingScrollPhysics,RangeMaintainingScrollPhysics,ScrollDecelerationRate} from './scroll-physics.ts';
import {ScrollViewKeyboardDismissBehavior} from './scroll-view.ts';
import {InheritedWidget} from './framework.ts';import type {BuildContext,Widget,WidgetOptions} from './framework.ts';import type {ScrollableDetails} from './scrollable-helpers.ts';
import {setEquals} from '../../foundation/collections.ts';import {invariant} from '../../foundation/errors.ts';import {objectRuntimeType} from '../../foundation/object.ts';
import {RawScrollbar} from './scrollbar.ts';import {GlowingOverscrollIndicator} from './overscroll-indicator.ts';
export class AndroidOverscrollIndicator {static readonly stretch=new AndroidOverscrollIndicator(0,'stretch');static readonly glow=new AndroidOverscrollIndicator(1,'glow');static readonly values=Object.freeze([this.stretch,this.glow]);private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'AndroidOverscrollIndicator.'+this.name;}}
export interface ScrollBehaviorCopyOptions {readonly scrollbars?:boolean|null;readonly overscroll?:boolean|null;readonly dragDevices?:Set<PointerDeviceKind>|null;readonly multitouchDragStrategy?:MultitouchDragStrategy|null;readonly pointerAxisModifiers?:Set<LogicalKeyboardKey>|null;readonly physics?:ScrollPhysics|null;readonly platform?:TargetPlatform|null;readonly keyboardDismissBehavior?:ScrollViewKeyboardDismissBehavior|null}
export class ScrollBehavior {
  private static readonly bouncing=new BouncingScrollPhysics({parent:new RangeMaintainingScrollPhysics()});private static readonly bouncingDesktop=new BouncingScrollPhysics({decelerationRate:ScrollDecelerationRate.fast,parent:new RangeMaintainingScrollPhysics()});private static readonly clamping=new ClampingScrollPhysics({parent:new RangeMaintainingScrollPhysics()});
  copyWith({scrollbars=true,overscroll=true,...options}:ScrollBehaviorCopyOptions={}):ScrollBehavior{return new _WrappedScrollBehavior(this,{...options,scrollbars:scrollbars??true,overscroll:overscroll??true});}
  getPlatform(_context:BuildContext):TargetPlatform{return FoundationPlatform.defaultTargetPlatform;}
  get dragDevices():Set<PointerDeviceKind>{return new Set([PointerDeviceKind.touch,PointerDeviceKind.stylus,PointerDeviceKind.invertedStylus,PointerDeviceKind.trackpad,PointerDeviceKind.unknown]);}
  get pointerAxisModifiers():Set<LogicalKeyboardKey>{return new Set([LogicalKeyboardKey.shiftLeft,LogicalKeyboardKey.shiftRight]);}
  getMultitouchDragStrategy(context:BuildContext):MultitouchDragStrategy{const platform=this.getPlatform(context);return platform==='iOS'||platform==='macOS'?MultitouchDragStrategy.averageBoundaryPointers:MultitouchDragStrategy.latestPointer;}
  buildScrollbar(context:BuildContext,child:Widget,details:ScrollableDetails):Widget{const platform=this.getPlatform(context);if(platform==='linux'||platform==='macOS'||platform==='windows'){invariant(details.controller,'missing-scrollbar-controller','Desktop scroll chrome requires its Scrollable controller');return new RawScrollbar({controller:details.controller,child});}return child;}
  buildOverscrollIndicator(context:BuildContext,child:Widget,details:ScrollableDetails):Widget{const platform=this.getPlatform(context);return platform==='android'||platform==='fuchsia'?new GlowingOverscrollIndicator({axisDirection:details.direction,color:0xffffffff,child}):child;}
  velocityTrackerBuilder(context:BuildContext):GestureVelocityTrackerBuilder{switch(this.getPlatform(context)){case 'iOS':return event=>new IOSScrollViewFlingVelocityTracker(event.kind);case 'macOS':return event=>new MacOSScrollViewFlingVelocityTracker(event.kind);default:return event=>VelocityTracker.withKind(event.kind);}}
  getScrollPhysics(context:BuildContext):ScrollPhysics{switch(this.getPlatform(context)){case 'iOS':return ScrollBehavior.bouncing;case 'macOS':return ScrollBehavior.bouncingDesktop;default:return ScrollBehavior.clamping;}}
  shouldNotify(_oldDelegate:ScrollBehavior):boolean{return false;}
  getKeyboardDismissBehavior(_context:BuildContext):ScrollViewKeyboardDismissBehavior{return ScrollViewKeyboardDismissBehavior.manual;}
  toString():string{return objectRuntimeType(this,'ScrollBehavior');}
}
class _WrappedScrollBehavior extends ScrollBehavior {
  readonly scrollbars:boolean;readonly overscroll:boolean;private readonly devices:Set<PointerDeviceKind>|null;private readonly modifiers:Set<LogicalKeyboardKey>|null;private readonly strategy:MultitouchDragStrategy|null;private readonly physics:ScrollPhysics|null;private readonly platform:TargetPlatform|null;private readonly keyboardDismiss:ScrollViewKeyboardDismissBehavior|null;
  constructor(private readonly delegate:ScrollBehavior,{scrollbars=true,overscroll=true,dragDevices=null,pointerAxisModifiers=null,multitouchDragStrategy=null,physics=null,platform=null,keyboardDismissBehavior=null}:ScrollBehaviorCopyOptions){super();this.scrollbars=scrollbars??true;this.overscroll=overscroll??true;this.devices=dragDevices===null?null:new Set(dragDevices);this.modifiers=pointerAxisModifiers===null?null:new Set(pointerAxisModifiers);this.strategy=multitouchDragStrategy;this.physics=physics;this.platform=platform;this.keyboardDismiss=keyboardDismissBehavior;}
  override get dragDevices():Set<PointerDeviceKind>{return this.devices===null?this.delegate.dragDevices:new Set(this.devices);}override get pointerAxisModifiers():Set<LogicalKeyboardKey>{return this.modifiers===null?this.delegate.pointerAxisModifiers:new Set(this.modifiers);}
  override getPlatform(context:BuildContext):TargetPlatform{return this.platform??this.delegate.getPlatform(context);}override getMultitouchDragStrategy(context:BuildContext):MultitouchDragStrategy{return this.strategy??this.delegate.getMultitouchDragStrategy(context);}
  override buildScrollbar(context:BuildContext,child:Widget,details:ScrollableDetails):Widget{return this.scrollbars?this.delegate.buildScrollbar(context,child,details):child;}
  override buildOverscrollIndicator(context:BuildContext,child:Widget,details:ScrollableDetails):Widget{return this.overscroll?this.delegate.buildOverscrollIndicator(context,child,details):child;}
  override getScrollPhysics(context:BuildContext):ScrollPhysics{return this.physics??this.delegate.getScrollPhysics(context);}override velocityTrackerBuilder(context:BuildContext):GestureVelocityTrackerBuilder{return this.delegate.velocityTrackerBuilder(context);}
  override getKeyboardDismissBehavior(context:BuildContext):ScrollViewKeyboardDismissBehavior{return this.keyboardDismiss??this.delegate.getKeyboardDismissBehavior(context);}
  override copyWith({scrollbars,overscroll,dragDevices,pointerAxisModifiers,multitouchDragStrategy,physics,platform,keyboardDismissBehavior}:ScrollBehaviorCopyOptions={}):ScrollBehavior{return this.delegate.copyWith({scrollbars:scrollbars??this.scrollbars,overscroll:overscroll??this.overscroll,dragDevices:dragDevices??this.dragDevices,pointerAxisModifiers:pointerAxisModifiers??this.pointerAxisModifiers,multitouchDragStrategy:multitouchDragStrategy??this.strategy,physics:physics??this.physics,platform:platform??this.platform,keyboardDismissBehavior:keyboardDismissBehavior??this.keyboardDismiss});}
  override shouldNotify(oldDelegate:ScrollBehavior):boolean{invariant(oldDelegate instanceof _WrappedScrollBehavior,'invalid-scroll-behavior-covariance','Wrapped behavior comparison requires another wrapped behavior');return oldDelegate.delegate.constructor!==this.delegate.constructor||oldDelegate.scrollbars!==this.scrollbars||oldDelegate.overscroll!==this.overscroll||!setEquals(oldDelegate.dragDevices,this.dragDevices)||oldDelegate.strategy!==this.strategy||!setEquals(oldDelegate.pointerAxisModifiers,this.pointerAxisModifiers)||oldDelegate.physics!==this.physics||oldDelegate.platform!==this.platform||this.delegate.shouldNotify(oldDelegate.delegate);}
}
const defaultBehavior=new ScrollBehavior();
export class ScrollConfiguration extends InheritedWidget {
  readonly behavior:ScrollBehavior;
  constructor({behavior,child,...options}:WidgetOptions&{readonly behavior:ScrollBehavior;readonly child:Widget}){super(child,options.key??null);this.behavior=behavior;}
  static of(context:BuildContext):ScrollBehavior{return context.maybeDependOn(ScrollConfiguration)?.behavior??defaultBehavior;}
  updateShouldNotify(old:this):boolean{return this.behavior.constructor!==old.behavior.constructor||this.behavior!==old.behavior&&this.behavior.shouldNotify(old.behavior);}
}
