// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Notification} from './notification-listener.ts';
import {ViewportNotificationMixin,ScrollUpdateNotification} from './scroll-notification.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import type {BuildContext} from './framework.ts';
import {protect} from '../../ui/value-math.ts';
import {ViewportOffset} from '../rendering/viewport-offset.ts';
import type {ViewportMoveOptions} from '../rendering/viewport-offset.ts';
import {ScrollMetricsMixin} from './scroll-metrics.ts';
import {ScrollActivity} from './scroll-activity.ts';
import type {ScrollHoldController,ScrollActivityDelegate} from './scroll-activity.ts';
import type {ScrollContext} from './scroll-context.ts';
import type {ScrollPhysics} from './scroll-physics.ts';
import type {ScrollDirection} from '../rendering/viewport-offset.ts';
import {UserScrollNotification} from './scroll-notification.ts';
import {AxisDirection} from '../painting/basic-types.ts';
import type {Axis} from '../painting/basic-types.ts';
import type {Drag} from '../gestures/drag.ts';
import type {DragStartDetails} from '../gestures/drag-details.ts';
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {ValueNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {precisionErrorTolerance} from '../../foundation/constants.ts';
import {Tolerance} from '../physics/tolerance.ts';
import {nearEqual} from '../physics/utils.ts';
import {RenderObject} from '../rendering/object.ts';
import {RenderAbstractViewport} from '../rendering/viewport.ts';
import {MatrixUtils} from '../painting/matrix-utils.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {Rect} from '../../ui/rect.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {clampDouble} from '../../ui/math.ts';
import {PageStorage} from './page-storage.ts';
import {tickerScheduler} from './ticker-scheduler.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
export class ScrollPositionAlignmentPolicy {
  static readonly explicit=new ScrollPositionAlignmentPolicy(0,'explicit');static readonly keepVisibleAtEnd=new ScrollPositionAlignmentPolicy(1,'keepVisibleAtEnd');static readonly keepVisibleAtStart=new ScrollPositionAlignmentPolicy(2,'keepVisibleAtStart');static readonly values=Object.freeze([this.explicit,this.keepVisibleAtEnd,this.keepVisibleAtStart]);private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'ScrollPositionAlignmentPolicy.'+this.name;}
}
export interface EnsureVisibleOptions {readonly alignment?:number;readonly duration?:number;readonly curve?:Curve;readonly alignmentPolicy?:ScrollPositionAlignmentPolicy;readonly targetRenderObject?:RenderObject|null}
export interface ScrollPositionOptions {readonly physics:ScrollPhysics;readonly context:ScrollContext;readonly keepScrollOffset?:boolean;readonly oldPosition?:ScrollPosition|null;readonly debugLabel?:string|null}
/** View retirement can occur inside this owned notifier's callback. Retire
 * immediately, but release ChangeNotifier storage only after its stack drains. */
class ScrollActivityNotifier extends ValueNotifier<boolean>{
  private notificationDepth=0;private retiring=false;
  protected override ensureAlive():void{super.ensureAlive();invariant(!this.retiring,'disposed-scroll-activity-notifier','Activity notifier used after retirement');}
  override notifyListeners():void{if(this.retiring)return;this.notificationDepth++;try{super.notifyListeners();}finally{if(--this.notificationDepth===0&&this.retiring)super.dispose();}}
  override dispose():void{if(this.retiring)return;this.retiring=true;if(this.notificationDepth===0)super.dispose();}
}
/** Source offset/metrics/activity owner. Reveal-to-RenderAbstractViewport remains unimplemented. */
export abstract class ScrollPosition extends ScrollMetricsMixin(ViewportOffset) {
  readonly physics:ScrollPhysics;readonly context:ScrollContext;readonly keepScrollOffset:boolean;readonly debugLabel:string|null;
  private minimum:number|null=null;private maximum:number|null=null;private currentPixels:number|null=null;private viewport:number|null=null;private dimensions=false;private impliedVelocity=0;
  private changedViewportOrCorrection=true;private pendingDimensions=false;private lastMetrics:ScrollMetrics|null=null;private scheduledMetricsNotification=false;private lastAxis:Axis|null=null;
  private semanticActions:Set<SemanticsAction>|null=null;private currentActivity:ScrollActivity|null=null;protected scrollDisposed=false;
  private notificationDepth=0;private pendingNotifierDisposal=false;
  private absorbedFrom:ScrollPosition|null=null;private absorbedActivity:ScrollActivity|null=null;private absorbedDelegate:ScrollActivityDelegate|null=null;
  protected readonly scheduler:FrameScheduler;
  readonly isScrollingNotifier=new ScrollActivityNotifier(false);
  constructor({physics,context,keepScrollOffset=true,oldPosition=null,debugLabel=null}:ScrollPositionOptions){super();this.physics=physics;this.context=context;this.keepScrollOffset=keepScrollOffset;this.debugLabel=debugLabel;this.scheduler=tickerScheduler(context.storageContext);try{if(oldPosition!==null)this.absorb(oldPosition);if(keepScrollOffset)this.restoreScrollOffset();}catch(error){const failures:unknown[]=[error];for(const release of [()=>{if(oldPosition!==null)this._restoreAbsorbedPosition(oldPosition);},()=>this.dispose()])try{release();}catch(failure){failures.push(failure);}if(failures.length===1)throw error;throw new AggregateError(failures,'ScrollPosition construction failed');}}
  protected ensureScrollAlive():void{this.ensureAlive();invariant(!this.scrollDisposed,'disposed-scroll-position','ScrollPosition used after disposal');}
  get minScrollExtent():number{invariant(this.minimum!==null,'unavailable-scroll-minimum','Content dimensions are unavailable');return this.minimum;}
  get maxScrollExtent():number{invariant(this.maximum!==null,'unavailable-scroll-maximum','Content dimensions are unavailable');return this.maximum;}
  get hasContentDimensions():boolean{return this.minimum!==null&&this.maximum!==null;}get pixels():number{invariant(this.currentPixels!==null,'unavailable-scroll-pixels','Initial pixels have not been supplied');return this.currentPixels;}get hasPixels():boolean{return this.currentPixels!==null;}
  get viewportDimension():number{invariant(this.viewport!==null,'unavailable-scroll-viewport','Viewport dimensions are unavailable');return this.viewport;}get hasViewportDimension():boolean{return this.viewport!==null;}get haveDimensions():boolean{return this.dimensions;}
  abstract get axisDirection():AxisDirection;
  get devicePixelRatio():number{return this.context.devicePixelRatio;}
  get shouldIgnorePointer():boolean{return !this.outOfRange&&(this.activity?.shouldIgnorePointer??true);}
  get activity():ScrollActivity|null{return this.currentActivity;}
  absorb(other:ScrollPosition):void{
    this.ensureScrollAlive();invariant(other!==this&&other.context===this.context&&!this.hasPixels&&this.activity===null&&other.activity!==null,'invalid-scroll-position-absorption','Absorption requires an uninitialized position and a distinct owner with the same ScrollContext');
    if(other.hasContentDimensions){this.minimum=other.minScrollExtent;this.maximum=other.maxScrollExtent;}if(other.hasPixels)this.currentPixels=other.pixels;if(other.hasViewportDimension)this.viewport=other.viewportDimension;
    this.absorbedFrom=other;this.absorbedActivity=other.currentActivity;this.absorbedDelegate=other.currentActivity!.delegate;this.currentActivity=other.currentActivity;other.currentActivity=null;if(other.constructor!==this.constructor)this.activity!.resetActivity();this.context.setIgnorePointer(this.activity!.shouldIgnorePointer);this.isScrollingNotifier.value=this.activity!.isScrolling;
  }
  /** @internal Roll back an uncommitted owner transfer before retiring a failed factory/attachment. */
  _restoreAbsorbedPosition(other:ScrollPosition):boolean{if(this.absorbedFrom!==other||other.currentActivity!==null||this.currentActivity===null||this.currentActivity!==this.absorbedActivity)return false;const activity=this.currentActivity;if(activity.delegate!==this.absorbedDelegate)activity.updateDelegate(this.absorbedDelegate!);this.currentActivity=null;other.currentActivity=activity;this._commitAbsorption();return true;}
  /** @internal Release predecessor references once the actual scroll owner has attached successfully. */
  _commitAbsorption():void{this.absorbedFrom=null;this.absorbedActivity=null;this.absorbedDelegate=null;}
  setPixels(newPixels:number):number{
    this.ensureScrollAlive();invariant(this.hasPixels&&!['persistent','build','layout','paint','semantics'].includes(this.scheduler.phase),'invalid-scroll-position-phase','setPixels requires initial pixels and must run outside build/layout/paint');
    if(newPixels!==this.pixels){const overscroll=this.applyBoundaryConditions(newPixels),oldPixels=this.pixels;this.currentPixels=newPixels-overscroll;if(this.pixels!==oldPixels){if(this.outOfRange)this.context.setIgnorePointer(false);this.notifyListeners();this.didUpdateScrollPositionBy(this.pixels-oldPixels);}if(Math.abs(overscroll)>precisionErrorTolerance){this.didOverscrollBy(overscroll);return overscroll;}}return 0;
  }
  correctPixels(value:number):void{this.ensureScrollAlive();this.currentPixels=value;}
  correctBy(correction:number):void{this.ensureScrollAlive();this.currentPixels=this.pixels+correction;this.changedViewportOrCorrection=true;}
  protected forcePixels(value:number):void{this.ensureScrollAlive();this.impliedVelocity=value-this.pixels;this.currentPixels=value;this.notifyListeners();if(this.scrollDisposed)return;this.scheduler.addPostFrameCallback(()=>{if(!this.scrollDisposed)this.impliedVelocity=0;},{debugLabel:'ScrollPosition.resetVelocity'});}
  protected saveScrollOffset():void{PageStorage.maybeOf(this.context.storageContext)?.writeState(this.context.storageContext,this.pixels);}
  protected restoreScrollOffset():void{if(this.hasPixels)return;const value=PageStorage.maybeOf(this.context.storageContext)?.readState(this.context.storageContext);if(value!=null){invariant(typeof value==='number','invalid-stored-scroll-offset','Stored scroll offsets must be numbers');this.correctPixels(value);}}
  restoreOffset(offset:number,{initialRestore=false}:{readonly initialRestore?:boolean}={}):void{if(initialRestore)this.correctPixels(offset);else this.jumpTo(offset);}
  protected saveOffset():void{this.context.saveOffset(this.pixels);}
  protected applyBoundaryConditions(value:number):number{const result=this.physics.applyBoundaryConditions(this,value);invariant(Math.abs(result)<=Math.abs(value-this.pixels),'invalid-scroll-boundary','Boundary rejection must not exceed the proposed motion');return result;}
  applyViewportDimension(viewportDimension:number):boolean{this.ensureScrollAlive();if(this.viewport!==viewportDimension){this.viewport=viewportDimension;this.changedViewportOrCorrection=true;}return true;}
  private metricsChanged():boolean{const current=this.copyWith();return this.lastMetrics===null||current.extentBefore!==this.lastMetrics.extentBefore||current.extentInside!==this.lastMetrics.extentInside||current.extentAfter!==this.lastMetrics.extentAfter||current.axisDirection!==this.lastMetrics.axisDirection;}
  applyContentDimensions(minScrollExtent:number,maxScrollExtent:number):boolean{
    this.ensureScrollAlive();if(!nearEqual(this.minimum,minScrollExtent,Tolerance.defaultTolerance.distance)||!nearEqual(this.maximum,maxScrollExtent,Tolerance.defaultTolerance.distance)||this.changedViewportOrCorrection||this.lastAxis!==this.axis){
      invariant(minScrollExtent<=maxScrollExtent,'invalid-scroll-extents','Content dimensions must be ordered');this.minimum=minScrollExtent;this.maximum=maxScrollExtent;this.lastAxis=this.axis;const current=this.haveDimensions?this.copyWith():null;this.changedViewportOrCorrection=false;this.pendingDimensions=true;
      if(this.haveDimensions&&!this.correctForNewDimensions(this.lastMetrics!,current!))return false;this.dimensions=true;
    }
    invariant(this.haveDimensions,'unavailable-scroll-dimensions','Content dimensions must be initialized');if(this.pendingDimensions){this.applyNewDimensions();this.pendingDimensions=false;}
    invariant(!this.changedViewportOrCorrection,'invalid-scroll-dimension-correction','Use correctForNewDimensions for offset correction during content layout');
    if(this.metricsChanged()){if(!this.scheduledMetricsNotification){this.scheduledMetricsNotification=true;void Promise.resolve().then(()=>{if(!this.scrollDisposed)this.didUpdateScrollMetrics();});}this.lastMetrics=this.copyWith();}return true;
  }
  protected correctForNewDimensions(oldPosition:ScrollMetrics,newPosition:ScrollMetrics):boolean{const newPixels=this.physics.adjustPositionForNewDimensions({oldPosition,newPosition,isScrolling:this.activity!.isScrolling,velocity:this.activity!.velocity});if(newPixels!==this.pixels){this.correctPixels(newPixels);return false;}return true;}
  protected applyNewDimensions():void{invariant(this.hasPixels&&this.pendingDimensions,'invalid-scroll-dimension-update','New dimensions require initial pixels and a pending layout update');this.activity!.applyNewDimensions();this.updateSemanticActions();}
  private updateSemanticActions():void{
    if(!this.hasPixels||!this.hasContentDimensions)return;let forward:SemanticsAction,backward:SemanticsAction;switch(this.axisDirection){case AxisDirection.up:forward=SemanticsAction.scrollDown;backward=SemanticsAction.scrollUp;break;case AxisDirection.down:forward=SemanticsAction.scrollUp;backward=SemanticsAction.scrollDown;break;case AxisDirection.left:forward=SemanticsAction.scrollRight;backward=SemanticsAction.scrollLeft;break;default:forward=SemanticsAction.scrollLeft;backward=SemanticsAction.scrollRight;}
    const actions=new Set<SemanticsAction>();if(this.pixels>this.minScrollExtent)actions.add(backward);if(this.pixels<this.maxScrollExtent)actions.add(forward);if(this.semanticActions!==null&&actions.size===this.semanticActions.size&&[...actions].every(action=>this.semanticActions!.has(action)))return;this.semanticActions=actions;this.context.setSemanticsActions(new Set(actions));
  }
  override moveTo(to:number,{clamp=true,...options}:ViewportMoveOptions={}):Promise<void>{invariant(clamp!==null,'invalid-scroll-clamp','ScrollPosition.moveTo clamp cannot be null');return super.moveTo(clamp?clampDouble(to,this.minScrollExtent,this.maxScrollExtent):to,options);}
  async ensureVisible(object:RenderObject,{alignment=0,duration=0,curve=Curves.ease,alignmentPolicy=ScrollPositionAlignmentPolicy.explicit,targetRenderObject=null}:EnsureVisibleOptions={}):Promise<void>{
    invariant(object.attached,'detached-ensure-visible','ensureVisible requires an attached render object');const viewport=RenderAbstractViewport.maybeOf(object);if(viewport===null)return;
    let targetRect:Rect|null=null;
    if(targetRenderObject!==null&&targetRenderObject!==object){const bounds=object.paintBounds,targetBounds=targetRenderObject.paintBounds;targetRect=MatrixUtils.transformRect(Matrix4.fromList(targetRenderObject.getTransformTo(object)),Rect.fromLTWH(bounds.x,bounds.y,bounds.width,bounds.height).intersect(Rect.fromLTWH(targetBounds.x,targetBounds.y,targetBounds.width,targetBounds.height)));}
    let policy=alignmentPolicy;
    if(this.axisDirection===AxisDirection.up||this.axisDirection===AxisDirection.left){if(policy===ScrollPositionAlignmentPolicy.keepVisibleAtStart)policy=ScrollPositionAlignmentPolicy.keepVisibleAtEnd;else if(policy===ScrollPositionAlignmentPolicy.keepVisibleAtEnd)policy=ScrollPositionAlignmentPolicy.keepVisibleAtStart;}
    let target:number;
    if(policy===ScrollPositionAlignmentPolicy.explicit)target=clampDouble(viewport.getOffsetToReveal(object,alignment,{rect:targetRect,axis:this.axis}).offset,this.minScrollExtent,this.maxScrollExtent);
    else if(policy===ScrollPositionAlignmentPolicy.keepVisibleAtEnd)target=Math.max(this.pixels,clampDouble(viewport.getOffsetToReveal(object,1,{rect:targetRect,axis:this.axis}).offset,this.minScrollExtent,this.maxScrollExtent));
    else if(policy===ScrollPositionAlignmentPolicy.keepVisibleAtStart)target=Math.min(this.pixels,clampDouble(viewport.getOffsetToReveal(object,0,{rect:targetRect,axis:this.axis}).offset,this.minScrollExtent,this.maxScrollExtent));
    else throw new TypeError('Unknown ScrollPositionAlignmentPolicy');
    if(target===this.pixels)return;if(duration===0){this.jumpTo(target);return;}return this.animateTo(target,{duration,curve});
  }
  get allowImplicitScrolling():boolean{return this.physics.allowImplicitScrolling;}
  /** Whether this position can consume a pointer delta, including coordinated viewports. */
  canScrollBy(delta:number):boolean{return this.physics.shouldAcceptUserOffset(this)&&Math.min(Math.max(this.pixels+delta,this.minScrollExtent),this.maxScrollExtent)!==this.pixels;}
  abstract pointerScroll(delta:number):void;abstract jumpToWithoutSettling(value:number):void;abstract hold(holdCancelCallback:()=>void):ScrollHoldController;abstract drag(details:DragStartDetails,dragCancelCallback:()=>void):Drag;
  beginActivity(newActivity:ScrollActivity|null):void{
    this.ensureScrollAlive();if(newActivity===null)return;invariant(newActivity!==this.activity,'duplicate-scroll-activity','A position cannot replace an activity with itself');const old=this.activity,wasScrolling=old?.isScrolling??false,oldIgnore=old?.shouldIgnorePointer??false,errors:unknown[]=[];
    const attempt=(callback:()=>void)=>{try{callback();}catch(error){errors.push(error);}};
    if(old){if(wasScrolling&&!newActivity.isScrolling)attempt(()=>this.didEndScroll());attempt(()=>old.dispose());}
    if(this.scrollDisposed){attempt(()=>newActivity.dispose());if(errors.length)throw new AggregateError(errors,'Scroll activity transition failed');return;}
    this.currentActivity=newActivity;if(oldIgnore!==newActivity.shouldIgnorePointer)attempt(()=>this.context.setIgnorePointer(newActivity.shouldIgnorePointer));if(!this.scrollDisposed)attempt(()=>{this.isScrollingNotifier.value=newActivity.isScrolling;});if(!this.scrollDisposed&&!wasScrolling&&newActivity.isScrolling)attempt(()=>this.didStartScroll());if(errors.length)throw new AggregateError(errors,'Scroll activity transition failed');
  }
  didStartScroll():void{if(this.scrollDisposed)return;this.activity!.dispatchScrollStartNotification(this.copyWith(),this.context.notificationContext);}
  didUpdateScrollPositionBy(delta:number):void{if(this.scrollDisposed)return;const context=this.context.notificationContext;if(context!==null)this.activity!.dispatchScrollUpdateNotification(this.copyWith(),context,delta);}
  didEndScroll():void{if(this.scrollDisposed)return;const context=this.context.notificationContext;if(context!==null)this.activity!.dispatchScrollEndNotification(this.copyWith(),context);if(this.scrollDisposed)return;this.saveOffset();if(!this.scrollDisposed&&this.keepScrollOffset)this.saveScrollOffset();}
  didOverscrollBy(value:number):void{if(this.scrollDisposed)return;invariant(this.activity?.isScrolling,'invalid-idle-overscroll','Overscroll notifications require scrolling activity');const context=this.context.notificationContext;if(context!==null)this.activity.dispatchOverscrollNotification(this.copyWith(),context,value);}
  didUpdateScrollDirection(direction:ScrollDirection):void{if(this.scrollDisposed)return;new UserScrollNotification({metrics:this.copyWith(),context:this.context.notificationContext,direction}).dispatch(this.context.notificationContext);}
  didUpdateScrollMetrics():void{this.scheduledMetricsNotification=false;if(this.scrollDisposed)return;const context=this.context.notificationContext;if(context!==null)new ScrollMetricsNotification({metrics:this.copyWith(),context}).dispatch(context);}
  recommendDeferredLoading(context:BuildContext):boolean{return this.physics.recommendDeferredLoading(this.activity!.velocity+this.impliedVelocity,this.copyWith(),context);}
  override addListener(listener:()=>void):void{this.ensureScrollAlive();super.addListener(listener);}
  override notifyListeners():void{if(this.scrollDisposed)return;this.updateSemanticActions();if(this.scrollDisposed)return;this.notificationDepth++;try{super.notifyListeners();}finally{if(--this.notificationDepth===0&&this.pendingNotifierDisposal){this.pendingNotifierDisposal=false;super.dispose();}}}
  override dispose():void{if(this.scrollDisposed)return;this.scrollDisposed=true;this.scheduledMetricsNotification=false;const activity=this.currentActivity;this.currentActivity=null;this._commitAbsorption();const errors:unknown[]=[];for(const callback of [()=>activity?.dispose(),()=>this.isScrollingNotifier.dispose(),()=>{if(this.notificationDepth>0)this.pendingNotifierDisposal=true;else super.dispose();}])try{callback();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'ScrollPosition retirement failed');}
  override debugFillDescription(description:string[]):void{if(this.debugLabel!==null)description.push(this.debugLabel);super.debugFillDescription(description);description.push(`range: ${this.minimum?.toFixed(1)}..${this.maximum?.toFixed(1)}`,`viewport: ${this.viewport?.toFixed(1)}`);}
}
/** Notification and position share the original Source library. */
export class ScrollMetricsNotification extends ViewportNotificationMixin(Notification) {
  readonly metrics:ScrollMetrics;readonly context:BuildContext;
  constructor({metrics,context}:{readonly metrics:ScrollMetrics;readonly context:BuildContext}){super();this.metrics=metrics;this.context=context;protect(this,['metrics','context']);}
  asScrollUpdate():ScrollUpdateNotification{return new ScrollUpdateNotification({metrics:this.metrics,context:this.context,depth:this.depth});}
  protected override debugFillDescription(description:string[]):void{super.debugFillDescription(description);description.push(''+this.metrics);}
}
