// SPDX-License-Identifier: BSD-3-Clause
// Nelyx coordinated two-viewport contract on the shared Flutter-derived scroll pipeline.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {ScrollController} from './scroll-controller.ts';
import {ScrollPositionWithSingleContext} from './scroll-position-with-single-context.ts';
import type {ScrollPosition,ScrollPositionOptions} from './scroll-position.ts';
import type {ScrollContext} from './scroll-context.ts';
import type {ScrollPhysics} from './scroll-physics.ts';
import {FixedScrollMetrics} from './scroll-metrics.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import {ScrollActivity,BallisticScrollActivity,DrivenScrollActivity} from './scroll-activity.ts';
import type {ScrollHoldController} from './scroll-activity.ts';
import type {Drag} from '../gestures/drag.ts';
import type {DragStartDetails} from '../gestures/drag-details.ts';
import {ScrollDirection} from '../rendering/viewport-offset.ts';
import type {ViewportAnimationOptions} from '../rendering/viewport-offset.ts';
import {State,StatefulWidget,Element} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import {CustomScrollView} from './scroll-view.ts';
import {SliverFillRemaining} from './sliver-overlap.ts';
import {Axis} from '../painting/basic-types.ts';

class PulseActivity extends ScrollActivity {
  get shouldIgnorePointer():boolean{return false;}
  get isScrolling():boolean{return true;}
  get velocity():number{return 0;}
}
class FollowingActivity extends ScrollActivity {
  constructor(position:NestedPosition,private readonly leader:NestedPosition){super(position);}
  override dispatchScrollStartNotification(metrics:ScrollMetrics,context:BuildContext|null):void{const activity=this.leader.activity;if(activity&&!(activity instanceof FollowingActivity))activity.dispatchScrollStartNotification(metrics,context);else super.dispatchScrollStartNotification(metrics,context);}
  override dispatchScrollUpdateNotification(metrics:ScrollMetrics,context:BuildContext,delta:number):void{const activity=this.leader.activity;if(activity&&!(activity instanceof FollowingActivity))activity.dispatchScrollUpdateNotification(metrics,context,delta);else super.dispatchScrollUpdateNotification(metrics,context,delta);}
  override dispatchOverscrollNotification(metrics:ScrollMetrics,context:BuildContext,delta:number):void{const activity=this.leader.activity;if(activity&&!(activity instanceof FollowingActivity))activity.dispatchOverscrollNotification(metrics,context,delta);else super.dispatchOverscrollNotification(metrics,context,delta);}
  override dispatchScrollEndNotification(metrics:ScrollMetrics,context:BuildContext):void{const activity=this.leader.activity;if(activity&&!(activity instanceof FollowingActivity))activity.dispatchScrollEndNotification(metrics,context);else super.dispatchScrollEndNotification(metrics,context);}
  get shouldIgnorePointer():boolean{return this.leader.activity?.shouldIgnorePointer??false;}
  get isScrolling():boolean{return true;}
  get velocity():number{return this.leader.activity?.velocity??0;}
}
class NestedPosition extends ScrollPositionWithSingleContext {
  // Super construction invokes virtual activity methods before this field is assigned.
  private coordinator:NestedScrollController|undefined;
  constructor(owner:NestedScrollController,options:ScrollPositionOptions){super(options);this.coordinator=owner;}
  _belongsTo(owner:NestedScrollController):boolean{return this.coordinator===owner;}
  _idle():void{
    const context=this.context.storageContext;
    if(context instanceof Element&&!context.active){
      // Scrollable detaches its controller after children/notification contexts unmount.
      // Stop the owned ticker directly; a new idle transition would dispatch into dead UI.
      const errors:unknown[]=[];
      try{this.activity?.dispose();}catch(error){errors.push(error);}
      try{this.isScrollingNotifier.value=false;}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Detached nested activity retirement failed');
      return;
    }
    super.goIdle();
  }
  _publish(delta:number):void{if(delta!==0){this.notifyListeners();this.didUpdateScrollPositionBy(delta);}}
  _canDrag(value:boolean):void{this.context.setCanDrag(value&&this.physics.allowUserScrolling);}
  override canScrollBy(delta:number):boolean{return this.coordinator?.ready?this.physics.allowUserScrolling&&this.coordinator.canScrollBy(delta):super.canScrollBy(delta);}
  protected override applyNewDimensions():void{super.applyNewDimensions();this.coordinator?._dimensionsChanged();}
  override goIdle():void{if(this.coordinator?.ready)this.coordinator._idle();else super.goIdle();}
  override goBallistic(velocity:number):void{if(this.coordinator?.ready)this.coordinator._ballistic(this,velocity);else super.goBallistic(velocity);}
  override setPixels(value:number):number{if(this.coordinator?._isDriver(this))return this.coordinator._setTotal(value);return super.setPixels(value);}
  override applyUserOffset(delta:number):void{if(this.coordinator?.ready)this.coordinator._userOffset(this,delta);else super.applyUserOffset(delta);}
  override pointerScroll(delta:number):void{if(this.coordinator?.ready)this.coordinator._pointer(this,delta);else super.pointerScroll(delta);}
  override jumpTo(value:number):void{if(this.coordinator?.ready)this.coordinator._jumpRole(this,value);else super.jumpTo(value);}
  override animateTo(value:number,options:ViewportAnimationOptions):Promise<void>{return this.coordinator?.ready?this.coordinator._animateRole(this,value,options):super.animateTo(value,options);}
  override hold(callback:()=>void):ScrollHoldController{this.coordinator?._idle();return super.hold(callback);}
  override drag(details:DragStartDetails,callback:()=>void):Drag{this.coordinator?._idle();const drag=super.drag(details,callback);if(this.coordinator?.ready)this.coordinator._follow(this);return drag;}
}
class RoleController extends ScrollController {
  constructor(private readonly coordinator:NestedScrollController,readonly role:'outer'|'inner'){super({keepScrollOffset:true,debugLabel:'nested '+role});}
  override createScrollPosition(physics:ScrollPhysics,context:ScrollContext,oldPosition:ScrollPosition|null):ScrollPosition{
    if(oldPosition!==null)this.coordinator._idle();
    return new NestedPosition(this.coordinator,{physics,context,keepScrollOffset:this.keepScrollOffset,oldPosition,debugLabel:this.debugLabel});
  }
  override attach(position:ScrollPosition):void{
    invariant(position instanceof NestedPosition&&position._belongsTo(this.coordinator)&&!this.hasClients,'invalid-nested-position','A nested role requires one position created by this coordinator');
    this.coordinator._checkPeer(this,position);super.attach(position);
  }
  override detach(position:ScrollPosition):void{try{this.coordinator._idle();}finally{super.detach(position);}}
}
/**
 * One outer and one inner viewport in the same View and axis. Positive input collapses
 * the outer header first; negative input unwinds inner content first. Motion clamps at
 * combined bounds. Both viewports share one ballistic/driven ticker and end together.
 * Overlap handles are explicit; this controller does not infer or steal body controllers.
 */
export class NestedScrollController extends ChangeNotifier {
  private readonly outer=new RoleController(this,'outer');
  private readonly inner=new RoleController(this,'inner');
  private driver:NestedPosition|null=null;
  private changing=false;
  private retired=false;
  constructor(){super();this.outer.addListener(this.changed);this.inner.addListener(this.changed);}
  private readonly changed=()=>this.notifyListeners();
  get outerController():ScrollController{return this.outer;}
  get innerController():ScrollController{return this.inner;}
  get hasClients():boolean{return this.outer.hasClients&&this.inner.hasClients;}
  get ready():boolean{return !this.retired&&this.hasClients&&this.outer.position.hasContentDimensions&&this.inner.position.hasContentDimensions;}
  private pair():readonly [NestedPosition,NestedPosition]{this.ensureAlive();invariant(this.ready,'unlaid-nested-scroll','Nested motion requires both laid-out viewports');return [this.outer.position as NestedPosition,this.inner.position as NestedPosition];}
  get offset():number{const [outer,inner]=this.pair();return outer.pixels+inner.pixels;}
  get metrics():FixedScrollMetrics{const [outer,inner]=this.pair();return new FixedScrollMetrics({minScrollExtent:outer.minScrollExtent+inner.minScrollExtent,maxScrollExtent:outer.maxScrollExtent+inner.maxScrollExtent,pixels:outer.pixels+inner.pixels,viewportDimension:outer.viewportDimension,axisDirection:outer.axisDirection,devicePixelRatio:outer.devicePixelRatio});}
  /** @internal */ _checkPeer(role:RoleController,position:NestedPosition):void{
    this.ensureAlive();const peer=role===this.outer?this.inner:this.outer;if(!peer.hasClients)return;
    invariant(peer.position.context.storageContext.services.owner===position.context.storageContext.services.owner,'foreign-nested-view','Nested viewports must share the same live View owner');
    invariant(peer.position.context.axisDirection===position.axisDirection,'different-nested-axis','Nested viewports must share an axis direction');
  }
  /** @internal */ _dimensionsChanged():void{if(!this.ready)return;const [outer,inner]=this.pair(),canDrag=this.metrics.maxScrollExtent>this.metrics.minScrollExtent;outer._canDrag(canDrag);inner._canDrag(canDrag);}
  canScrollBy(delta:number):boolean{const metrics=this.metrics;return delta>0?metrics.pixels<metrics.maxScrollExtent:delta<0&&metrics.pixels>metrics.minScrollExtent;}
  private transaction(body:()=>void):void{this.ensureAlive();invariant(!this.changing,'reentrant-nested-motion','Cannot change nested motion from an active update callback');this.changing=true;try{body();}finally{this.changing=false;}}
  /** @internal */ _idle():void{
    if(this.retired)return;invariant(!this.changing,'reentrant-nested-motion','Cannot replace nested activity from an active update callback');this.driver=null;const errors:unknown[]=[];
    for(const controller of [this.outer,this.inner])if(controller.hasClients)try{(controller.position as NestedPosition)._idle();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Nested scroll stop failed');
  }
  /** @internal */ _follow(origin:NestedPosition):void{const [outer,inner]=this.pair(),peer=origin===outer?inner:outer;peer.beginActivity(new FollowingActivity(peer,origin));}
  /** @internal */ _isDriver(position:NestedPosition):boolean{return this.driver===position;}
  private applyPair(outerValue:number,innerValue:number):void{
    const [outer,inner]=this.pair(),outerDelta=outerValue-outer.pixels,innerDelta=innerValue-inner.pixels;
    // Publish only after both offsets are coherent, including to application listeners.
    outer.correctPixels(outerValue);inner.correctPixels(innerValue);const errors:unknown[]=[];
    for(const [position,delta]of [[outer,outerDelta],[inner,innerDelta]] as const)try{position._publish(delta);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Nested offset notification failed');
  }
  private applyDelta(delta:number):number{
    const [outer,inner]=this.pair(),initial=outer.pixels+inner.pixels;let a=outer.pixels,b=inner.pixels;
    if(delta>0){const take=Math.min(delta,Math.max(0,outer.maxScrollExtent-a));a+=take;delta-=take;b=Math.min(inner.maxScrollExtent,b+delta);}
    else{const take=Math.min(-delta,Math.max(0,b-inner.minScrollExtent));b-=take;delta+=take;a=Math.max(outer.minScrollExtent,a+delta);}
    this.applyPair(a,b);return a+b-initial;
  }
  /** @internal */ _setTotal(value:number):number{invariant(Number.isFinite(value),'invalid-nested-offset','Nested offsets must be finite');const before=this.offset;this.transaction(()=>this.applyDelta(value-before));return value-this.offset;}
  private pulse(body:()=>void):void{const [outer,inner]=this.pair();this._idle();const errors:unknown[]=[];try{outer.beginActivity(new PulseActivity(outer));inner.beginActivity(new PulseActivity(inner));this.transaction(body);}catch(error){errors.push(error);}try{this._idle();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Nested scroll pulse failed');}
  /** @internal */ _pointer(origin:NestedPosition,delta:number):void{invariant(Number.isFinite(delta),'invalid-nested-offset','Nested input must be finite');if(delta===0){this._idle();return;}this.pulse(()=>{for(const position of this.pair())position.updateUserScrollDirection(delta>0?ScrollDirection.reverse:ScrollDirection.forward);this.applyDelta(delta);});}
  /** @internal */ _userOffset(origin:NestedPosition,delta:number):void{invariant(Number.isFinite(delta),'invalid-nested-offset','Nested input must be finite');const adjusted=origin.physics.applyPhysicsToUserOffset(this.metrics,delta);this.transaction(()=>{for(const position of this.pair())position.updateUserScrollDirection(adjusted>0?ScrollDirection.forward:ScrollDirection.reverse);const consumed=this.applyDelta(-adjusted),overscroll=-adjusted-consumed;if(Math.abs(overscroll)>1e-10){const [outer]=this.pair();outer.didOverscrollBy(overscroll);}});}
  /** @internal */ _ballistic(origin:NestedPosition,velocity:number):void{
    invariant(Number.isFinite(velocity),'invalid-nested-velocity','Nested velocity must be finite');const simulation=origin.physics.createBallisticSimulation(this.metrics,velocity);
    if(simulation===null){this._idle();return;}this.driver=origin;origin.beginActivity(new BallisticScrollActivity(origin,simulation,origin.context.vsync,true));this._follow(origin);
  }
  jumpTo(value:number):void{invariant(Number.isFinite(value),'invalid-nested-offset','Nested offsets must be finite');this.pulse(()=>{const [outer,inner]=this.pair(),a=Math.max(outer.minScrollExtent,Math.min(outer.maxScrollExtent,value-inner.minScrollExtent)),b=Math.max(inner.minScrollExtent,Math.min(inner.maxScrollExtent,value-a));this.applyPair(a,b);});}
  /** @internal */ _jumpRole(position:NestedPosition,value:number):void{invariant(Number.isFinite(value),'invalid-nested-offset','Nested offsets must be finite');this.pulse(()=>{const [outer,inner]=this.pair(),next=Math.max(position.minScrollExtent,Math.min(position.maxScrollExtent,value));this.applyPair(position===outer?next:outer.pixels,position===inner?next:inner.pixels);});}
  animateTo(value:number,options:ViewportAnimationOptions):Promise<void>{
    const [outer]=this.pair();invariant(Number.isFinite(value),'invalid-nested-offset','Nested offsets must be finite');
    invariant(Number.isFinite(options.duration)&&options.duration>0&&typeof options.curve?.transform==='function','invalid-nested-animation','Nested animation requires positive finite duration and a curve');
    this._idle();const target=Math.max(this.metrics.minScrollExtent,Math.min(this.metrics.maxScrollExtent,value));this.driver=outer;
    try{const activity=new DrivenScrollActivity(outer,{from:this.offset,to:target,...options,vsync:outer.context.vsync});outer.beginActivity(activity);this._follow(outer);return activity.done;}
    catch(error){try{this._idle();}catch(cleanup){throw new AggregateError([error,cleanup],'Nested animation startup cleanup failed');}throw error;}
  }
  /** @internal */ _animateRole(position:NestedPosition,value:number,options:ViewportAnimationOptions):Promise<void>{return this.animateTo(this.offset+value-position.pixels,options);}
  override dispose():void{if(this.retired)return;invariant(!this.outer.hasClients&&!this.inner.hasClients&&!this.changing,'live-nested-controller','Unmount both nested viewports before disposing their controller');this.outer.removeListener(this.changed);this.inner.removeListener(this.changed);this.outer.dispose();this.inner.dispose();super.dispose();this.retired=true;}
}
export interface NestedScrollViewOptions extends WidgetOptions {
  readonly headerSlivers:readonly Widget[];
  readonly bodyBuilder:(context:BuildContext,innerController:ScrollController)=>Widget;
  readonly controller?:NestedScrollController|null;
  readonly scrollDirection?:Axis;
  readonly reverse?:boolean;
  readonly physics?:ScrollPhysics|null;
  readonly restorationId?:string|null;
}
/** Body must attach the provided controller to exactly one same-axis scroll view. */
export class NestedScrollView extends StatefulWidget {
  readonly headerSlivers:readonly Widget[];readonly bodyBuilder:NestedScrollViewOptions['bodyBuilder'];readonly controller:NestedScrollController|null;readonly scrollDirection:Axis;readonly reverse:boolean;readonly physics:ScrollPhysics|null;readonly restorationId:string|null;
  constructor({headerSlivers,bodyBuilder,controller=null,scrollDirection=Axis.vertical,reverse=false,physics=null,restorationId=null,...options}:NestedScrollViewOptions){super(options.key??null);invariant(typeof bodyBuilder==='function','missing-nested-body','Nested body requires a builder');this.headerSlivers=Object.freeze([...headerSlivers]);this.bodyBuilder=bodyBuilder;this.controller=controller;this.scrollDirection=scrollDirection;this.reverse=reverse;this.physics=physics;this.restorationId=restorationId;}
  createState():State<NestedScrollView>{return new NestedScrollViewState();}
}
class NestedScrollViewState extends State<NestedScrollView> {
  private owned:NestedScrollController|null=null;
  override initState():void{super.initState();if(this.widget.controller===null)this.owned=new NestedScrollController();}
  override didUpdateWidget(old:NestedScrollView):void{super.didUpdateWidget(old);invariant(old.controller===this.widget.controller,'changed-nested-controller','Use a new Widget key when changing the nested coordinator');}
  build(context:BuildContext):Widget{const controller=this.widget.controller??this.owned!;return new CustomScrollView({controller:controller.outerController,scrollDirection:this.widget.scrollDirection,reverse:this.widget.reverse,physics:this.widget.physics,restorationId:this.widget.restorationId,slivers:[...this.widget.headerSlivers,new SliverFillRemaining({child:this.widget.bodyBuilder(context,controller.innerController)})]});}
  override dispose():void{try{this.owned?.dispose();}finally{super.dispose();}}
}
