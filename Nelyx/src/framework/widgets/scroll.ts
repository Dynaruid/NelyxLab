import {markTraversalScrollable} from './focus-traversal-context.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Reviewed selected scroll/viewport ownership from Doroti Widgets/scroll_position.cs, scroll_view.cs.
import {ValueNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import type {Size} from '../../ui/geometry.ts';
import {PointerScrollEvent} from '../gestures/events.ts';
import type {PointerSignalEvent} from '../gestures/events.ts';
import type {Rect} from '../../ui/types.ts';
import type {Key} from '../../foundation/key.ts';
import {ValueKey} from '../../foundation/key.ts';
import {BoxConstraints} from '../rendering/constraints.ts';
import {RenderBox} from '../rendering/object.ts';
import type {PaintingContext} from '../painting/context.ts';
import {Ticker} from '../animation/ticker.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
import {FrictionSimulation} from '../physics/spring.ts';
import {ClampingScrollPhysics,RangeMaintainingScrollPhysics} from './scroll-physics.ts';
import type {ScrollPhysics as ViewScrollPhysics} from './scroll-physics.ts';
import {FixedScrollMetrics} from './scroll-metrics.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import {AxisDirection} from '../painting/basic-types.ts';
import {RawGestureDetector,RawGestureDetectorState,GestureRecognizerFactoryWithHandlers} from './raw-gesture-detector.ts';
import type {GestureRecognizerFactories} from './raw-gesture-detector.ts';
import {VerticalDragGestureRecognizer} from '../gestures/monodrag.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {GlobalKey} from './global-key.ts';
import {MediaQuery} from './app-data.ts';
import {Listener} from './listener.ts';
import {StatefulWidget,State,RenderObjectWidget,StatelessWidget,Element} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
/** Compatibility methods remain on the former direct module; policies use the source implementation. */
export class ScrollPhysics extends ClampingScrollPhysics {
  constructor(){super({parent:new RangeMaintainingScrollPhysics()});}
  clamp(offset:number,max:number):number{return Math.min(max,Math.max(0,offset));}
  simulation(offset:number,velocity:number):FrictionSimulation{return new FrictionSimulation(0.025,offset,velocity);}
  override recommendDeferredLoading(velocity:number,metrics:ScrollMetrics|ScrollPosition,context:BuildContext):boolean{return super.recommendDeferredLoading(velocity,metrics instanceof ScrollPosition?metrics.metrics:metrics,context);}
}
export type ScrollActivity='idle'|'drag'|'ballistic';
/** A finite vertical viewport owns one position and consumes real metric/physics policies. */
export class ScrollPosition extends ValueNotifier<number> {
  private static nextId=0;
  readonly semanticsId='scroll-'+(++ScrollPosition.nextId);
  private ticker:Ticker|undefined;
  private extent=0;
  private owner:object|undefined;
  private activityValue:ScrollActivity='idle';
  readonly isScrollingNotifier=new ValueNotifier(false);
  private activityMutationDepth=0;
  private overscrollValue=0;
  private velocityValue=0;
  private viewport:number|null=null;private dimensionsKnown=false;private ratio=1;private clock:FrameScheduler|undefined;private releaseClosing:(()=>void)|undefined;
  private attachmentEpoch=0;private scrollClosed=false;private pendingDimensions:ScrollMetrics|undefined;
  constructor(offset=0,readonly physics:ViewScrollPhysics=new ScrollPhysics()){super(offset);invariant(Number.isFinite(offset)&&offset>=0,'invalid-scroll-offset','Scroll offset must be nonnegative');}
  private ensureScrollAlive():void{this.ensureAlive();invariant(!this.scrollClosed,'disposed-scroll-position','Scroll position is closed');}
  get metrics():FixedScrollMetrics{return new FixedScrollMetrics({minScrollExtent:this.dimensionsKnown?0:null,maxScrollExtent:this.dimensionsKnown?this.extent:null,pixels:this.offset,viewportDimension:this.viewport,axisDirection:AxisDirection.down,devicePixelRatio:this.ratio});}
  get pixels():number{return this.offset;}
  get minScrollExtent():number{return 0;}
  get hasContentDimensions():boolean{return this.dimensionsKnown;}
  get hasPixels():boolean{return true;}
  get hasViewportDimension():boolean{return this.viewport!==null;}
  get viewportDimension():number{invariant(this.viewport!==null,'unavailable-scroll-viewport','Viewport dimensions have not been applied');return this.viewport;}
  get devicePixelRatio():number{return this.ratio;}
  get axisDirection():AxisDirection{return AxisDirection.down;}
  get offset():number{return this.value;}
  get maxScrollExtent():number{return this.extent;}
  get activity():ScrollActivity{return this.activityValue;}
  get overscroll():number{return this.overscrollValue;}
  get velocity():number{return this.velocityValue;}
  /** Publish the final scrolling state after an atomic activity replacement. */
  private mutateActivity<T>(callback:()=>T):T{
    this.activityMutationDepth++;let value:T|undefined;const errors:unknown[]=[];
    try{value=callback();}catch(error){errors.push(error);}
    finally{this.activityMutationDepth--;if(!this.activityMutationDepth&&!this.scrollClosed)try{this.isScrollingNotifier.value=this.activityValue!=='idle';}catch(error){errors.push(error);}}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Scroll activity and notification failed');return value as T;
  }
  recommendDeferredLoading(context:BuildContext):boolean{return this.physics.recommendDeferredLoading(this.velocityValue,this.metrics,context);}
  attach(owner:object,scheduler?:FrameScheduler):()=>void{
    this.ensureScrollAlive();invariant(!this.owner,'scroll-already-attached','ScrollController supports one viewport');this.stop();this.owner=owner;const epoch=++this.attachmentEpoch;
    if(scheduler){this.clock=scheduler;try{const subscription=scheduler.observeDispose(()=>{this.pendingDimensions=undefined;this.stop();});this.releaseClosing=()=>subscription.dispose();}catch(error){this.owner=undefined;this.clock=undefined;this.attachmentEpoch++;throw error;}}
    return ()=>{if(this.owner!==owner||this.attachmentEpoch!==epoch)return;this.owner=undefined;this.attachmentEpoch++;this.pendingDimensions=undefined;this.clock=undefined;const release=this.releaseClosing;this.releaseClosing=undefined;const errors:unknown[]=[];try{this.stop();}catch(error){errors.push(error);}try{release?.();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Scroll viewport retirement failed');};
  }
  applyDimensions(max:number,viewportDimension?:number,devicePixelRatio?:number,scheduler?:FrameScheduler):void{
    this.ensureScrollAlive();invariant(Number.isFinite(max),'invalid-scroll-extent','Scroll extent must be finite');invariant(viewportDimension===undefined||Number.isFinite(viewportDimension)&&viewportDimension>=0,'invalid-scroll-viewport','Viewport dimension must be finite and nonnegative');invariant(devicePixelRatio===undefined||Number.isFinite(devicePixelRatio)&&devicePixelRatio>0,'invalid-scroll-density','Device pixel ratio must be positive');
    const previous=this.metrics,nextExtent=Math.max(0,max),nextViewport=viewportDimension??this.viewport,nextRatio=devicePixelRatio??this.ratio;
    if(this.dimensionsKnown&&nextExtent===this.extent&&nextViewport===this.viewport&&nextRatio===this.ratio)return;
    this.extent=nextExtent;this.viewport=nextViewport;this.ratio=nextRatio;this.dimensionsKnown=true;
    const oldPosition=previous.hasContentDimensions&&previous.hasViewportDimension?previous:this.metrics;
    const clock=scheduler??this.clock;if(!clock){const corrected=this.physics.adjustPositionForNewDimensions({oldPosition,newPosition:this.metrics,isScrolling:this.activityValue!=='idle',velocity:this.velocityValue});if(corrected!==this.offset)this.jumpTo(corrected);return;}
    if(this.pendingDimensions)return;this.pendingDimensions=oldPosition;const epoch=this.attachmentEpoch,owner=this.owner;
    clock.addPostFrame(()=>{if(this.scrollClosed||this.attachmentEpoch!==epoch||this.owner!==owner)return;const old=this.pendingDimensions;this.pendingDimensions=undefined;if(!old)return;const velocity=this.velocityValue,wasBallistic=this.activityValue==='ballistic',ticker=this.ticker,corrected=this.physics.adjustPositionForNewDimensions({oldPosition:old,newPosition:this.metrics,isScrolling:this.activityValue!=='idle',velocity});invariant(Number.isFinite(corrected),'invalid-scroll-correction','Physics correction must be finite');if(corrected!==this.offset)this.value=corrected;else this.notifyListeners();if(this.scrollClosed||this.attachmentEpoch!==epoch||this.owner!==owner||this.ticker!==ticker)return;if(wasBallistic&&this.activityValue==='ballistic'||this.activityValue==='idle'&&(this.offset<0||this.offset>this.extent))this.fling(velocity,clock);});
  }
  private applyOffset(offset:number):void{this.overscrollValue=0;if(offset===this.offset)return;const rejected=this.physics.applyBoundaryConditions(this.metrics,offset);invariant(Number.isFinite(rejected)&&Math.abs(rejected)<=Math.abs(offset-this.offset),'invalid-scroll-boundary','Boundary rejection must not exceed the proposed motion');this.overscrollValue=rejected;this.value=offset-rejected;}
  /** Legacy programmatic jumps remain clamped; actual user/ballistic offsets use the selected physics. */
  jumpTo(offset:number):void{this.ensureScrollAlive();invariant(Number.isFinite(offset),'invalid-scroll-offset','Scroll offset must be finite');this.stop();this.overscrollValue=offset-Math.min(this.extent,Math.max(0,offset));this.value=Math.min(this.extent,Math.max(0,offset));}
  scrollBy(delta:number):void{this.jumpTo(this.offset+delta);}
  beginDrag():void{this.mutateActivity(()=>{this.ensureScrollAlive();this.stop();if(this.physics.shouldAcceptUserOffset(this.metrics))this.activityValue='drag';});}
  dragBy(delta:number):void{this.ensureScrollAlive();invariant(Number.isFinite(delta),'invalid-scroll-offset','Drag delta must be finite');if(!delta)return;if(this.activityValue!=='drag')this.beginDrag();if(this.activityValue!=='drag')return;this.applyOffset(this.offset-this.physics.applyPhysicsToUserOffset(this.metrics,-delta));}
  fling(velocity:number,scheduler:FrameScheduler):void{
    this.mutateActivity(()=>{
    this.ensureScrollAlive();invariant(Number.isFinite(velocity),'invalid-scroll-velocity','Scroll velocity must be finite');this.stop();const simulation=this.physics.createBallisticSimulation(this.metrics,velocity);if(!simulation)return;
    this.activityValue='ballistic';this.velocityValue=velocity;const epoch=this.attachmentEpoch;
    try{const ticker=new Ticker(scheduler,elapsed=>this.mutateActivity(()=>{if(this.ticker!==ticker||this.scrollClosed||this.attachmentEpoch!==epoch)return;try{const seconds=elapsed/1000,raw=simulation.x(seconds);this.velocityValue=simulation.dx(seconds);invariant(Number.isFinite(raw)&&Number.isFinite(this.velocityValue),'invalid-scroll-simulation','Simulation produced a non-finite position or velocity');this.applyOffset(raw);if(this.ticker!==ticker||this.scrollClosed||this.attachmentEpoch!==epoch)return;if(this.overscrollValue!==0||simulation.isDone(seconds)){this.stop();if(this.offset<0||this.offset>this.extent)this.fling(0,scheduler);}}catch(error){if(this.ticker===ticker){try{this.stop();}catch(failure){throw new AggregateError([error,failure],'Scroll simulation and retirement failed');}}throw error;}}));this.ticker=ticker;ticker.start();}
    catch(error){try{this.stop();}catch(failure){throw new AggregateError([error,failure],'Scroll ticker creation and retirement failed');}throw error;}
    });
  }
  stop():void{this.mutateActivity(()=>{const ticker=this.ticker;this.ticker=undefined;this.activityValue='idle';this.velocityValue=0;ticker?.dispose();});}
  override dispose():void{this.scrollClosed=true;this.attachmentEpoch++;this.owner=undefined;this.pendingDimensions=undefined;this.clock=undefined;const release=this.releaseClosing;this.releaseClosing=undefined;const errors:unknown[]=[];try{this.stop();}catch(error){errors.push(error);}try{release?.();}catch(error){errors.push(error);}try{this.isScrollingNotifier.dispose();}catch(error){errors.push(error);}try{super.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Scroll position retirement failed');}
}
export class ScrollController extends ScrollPosition {}
function scrollSignalHandler(context:BuildContext,controller:ScrollController):(event:PointerSignalEvent)=>void {
  invariant(context instanceof Element,'invalid-scroll-context','Scroll signal handling requires an Element');const owner=context.owner;
  return event=>{if(!(event instanceof PointerScrollEvent)||!event.scrollDelta.dy||!context.mounted||owner.disposed)return;
    const delta=event.scrollDelta.dy;if(!controller.physics.shouldAcceptUserOffset(controller.metrics)||Math.min(controller.maxScrollExtent,Math.max(0,controller.offset+delta))===controller.offset)return;
    owner.gestureBinding.pointerSignalResolver.register(event,signal=>{if(!context.mounted||owner.disposed){signal.respond({allowPlatformDefault:true});return;}const previous=controller.offset;controller.scrollBy(delta);signal.respond({allowPlatformDefault:controller.offset===previous});});
  };
}
function revealRect(controller:ScrollController,height:number,rect:Rect):Rect {
  const {x,y,width,height:rectHeight}=rect,delta=y<0?y:y+rectHeight>height?Math.min(y,y+rectHeight-height):0;
  const previous=Math.min(controller.offset,controller.maxScrollExtent);if(delta||controller.offset!==previous)controller.jumpTo(previous+delta);return {x,y:y-(controller.offset-previous),width,height:rectHeight};
}
/** Recognizers are replaced during this actual viewport's layout, as in Scrollable.setCanDrag. */
class ScrollGestureOwner {
  private readonly key=new GlobalKey<RawGestureDetectorState>('scroll gesture');private factories:GestureRecognizerFactories=new Map();private canDrag:boolean|null=null;private controller:ScrollController|undefined;
  constructor(private readonly context:()=>BuildContext,private readonly readController:()=>ScrollController,private readonly scheduler:()=>FrameScheduler){}
  build(child:Widget):Widget{return new RawGestureDetector(child,{key:this.key,gestures:this.factories,behavior:HitTestBehavior.opaque,excludeFromSemantics:true});}
  readonly updateDuringLayout=()=>{
    const context=this.context(),controller=this.readController();invariant(context instanceof Element,'invalid-scroll-context','Scroll drag requires its actual View Element');const canDrag=controller.physics.shouldAcceptUserOffset(controller.metrics);
    if(this.canDrag===canDrag&&this.controller===controller)return;
    const state=this.key.currentState;invariant(state,'missing-scroll-gesture-owner','Viewport layout requires its mounted raw gesture owner');
    if(this.controller&&this.controller!==controller)state.replaceGestureRecognizers(new Map());
    this.canDrag=canDrag;this.controller=controller;
    const current=()=>context.mounted&&!context.owner.disposed&&this.readController()===controller;
    this.factories=canDrag?new Map([[VerticalDragGestureRecognizer,new GestureRecognizerFactoryWithHandlers(VerticalDragGestureRecognizer,()=>new VerticalDragGestureRecognizer({binding:context.owner.gestureBinding,debugOwner:this}),recognizer=>{
      recognizer.gestureSettings=MediaQuery.maybeGestureSettingsOf(context);recognizer.minFlingDistance=controller.physics.minFlingDistance;recognizer.minFlingVelocity=controller.physics.minFlingVelocity;recognizer.maxFlingVelocity=controller.physics.maxFlingVelocity;
      recognizer.onStart=()=>{if(current())controller.beginDrag();};recognizer.onUpdate=details=>{if(current())controller.dragBy(-details.delta.dy);};recognizer.onEnd=details=>{if(current())controller.fling(-details.velocity.pixelsPerSecond.dy,this.scheduler());};recognizer.onCancel=()=>{if(current())controller.stop();};
    })]]):new Map();
    state.replaceGestureRecognizers(this.factories);
  };
}
/** A bounded vertical viewport for finite, eagerly built page content; long item collections use LazyList. */
export class SingleChildScrollView extends StatefulWidget {
  constructor(readonly child:Widget,readonly controller:ScrollController,readonly scheduler:FrameScheduler,key:Key|null=null){super(key);markTraversalScrollable(this,'vertical',this.controller);}
  createState():State{return new SingleScrollState();}
}
class SingleScrollState extends State<SingleChildScrollView> {
  private release:(()=>void)|undefined;
  private readonly drag=new ScrollGestureOwner(()=>this.context,()=>this.widget.controller,()=>this.widget.scheduler);
  private readonly changed=()=>this.setState(()=>{});
  private connect():void{this.release=this.widget.controller.attach(this,this.widget.scheduler);this.widget.controller.addListener(this.changed);}
  override initState():void{this.connect();}
  override didUpdateWidget(old:SingleChildScrollView):void{if(old.controller!==this.widget.controller){old.controller.removeListener(this.changed);this.release?.();this.connect();}}
  override dispose():void{this.widget.controller.removeListener(this.changed);this.release?.();}
  build():Widget {
    const {controller,scheduler,child}=this.widget;
    return new Listener(this.drag.build(new PageViewport(child,controller,scheduler,this.context.services.readMetrics().scale,this.drag.updateDuringLayout)),{onPointerDown:()=>controller.stop(),onPointerCancel:()=>controller.stop(),onPointerSignal:scrollSignalHandler(this.context,controller)});
  }
}
class PageViewport extends RenderObjectWidget {
  constructor(readonly child:Widget,readonly controller:ScrollController,readonly scheduler:FrameScheduler,readonly devicePixelRatio:number,readonly updateGestures:()=>void){super();}
  get childWidgets():readonly Widget[]{return [this.child];}
  createRenderObject():RenderBox{return new RenderPageViewport();}
  updateRenderObject(_context:BuildContext,object:RenderBox):void {
    const render=object as RenderPageViewport;render.configuration=this;
    const canScroll=this.controller.hasContentDimensions&&this.controller.physics.shouldAcceptUserOffset(this.controller.metrics);
    render.semantics={id:this.controller.semanticsId,role:'list',name:'Scrollable page',enabled:true,scrollPosition:this.controller.offset,actions:canScroll?{'scroll-forward':()=>this.controller.scrollBy(render.size.height),'scroll-backward':()=>this.controller.scrollBy(-render.size.height)}:{}};render.markNeedsLayout();
  }
}
class RenderPageViewport extends RenderBox {
  protected override get childCountLimit():number{return 1;}
  configuration!:PageViewport;
  override get clips():boolean{return true;}
  override setChildren(children:readonly RenderBox[]):void{invariant(children.length<=1,'invalid-render-child','Page viewport accepts one child');super.setChildren(children);}
  override showOnScreen(rect:Rect={x:0,y:0,...this.size}):void{super.showOnScreen(this.configuration.controller.physics.allowImplicitScrolling?revealRect(this.configuration.controller,this.size.height,rect):rect);}
  protected performLayout(constraints:BoxConstraints):Size {
    invariant(Number.isFinite(constraints.maxWidth)&&Number.isFinite(constraints.maxHeight),'unbounded-scroll-viewport','SingleChildScrollView requires bounded width and height');
    const child=this.children[0];child?.layout(new BoxConstraints(constraints.minWidth,constraints.maxWidth,0,Infinity),{parentUsesSize:true});
    const size=constraints.constrain({width:child?.size.width??0,height:constraints.maxHeight}),{controller,scheduler}=this.configuration;
    controller.applyDimensions((child?.size.height??0)-size.height,size.height,this.configuration.devicePixelRatio,scheduler);this.configuration.updateGestures();if(child)child.layoutOffset={x:0,y:-controller.offset};
    return size;
  }
  override paint(context:PaintingContext):void{context.save();context.clip({x:0,y:0,...this.size});super.paint(context);context.restore();}
}
export interface LazyListOptions {readonly itemCount:number;readonly itemExtent:number;readonly height:number;readonly itemBuilder:(index:number)=>Widget;readonly controller:ScrollController;readonly scheduler:FrameScheduler;readonly cacheExtent?:number;readonly keepAliveCount?:number;readonly key?:Key}
/** Fixed-extent sliver list. Only viewport/cache items are built; retained offscreen State has an explicit count bound. */
export class LazyList extends StatefulWidget {
  constructor(readonly options:LazyListOptions){super(options.key??null);markTraversalScrollable(this,'vertical',options.controller);}
  createState():State{return new LazyListState();}
}
class LazyListState extends State<LazyList> {
  private retained=new Map<number,Widget>();
  private readonly drag=new ScrollGestureOwner(()=>this.context,()=>this.widget.options.controller,()=>this.widget.options.scheduler);
  private releaseViewport:(()=>void)|undefined;
  private readonly changed=()=>this.setState(()=>{});
  override initState():void{this.connect();}
  private connect():void{this.releaseViewport=this.widget.options.controller.attach(this,this.widget.options.scheduler);this.widget.options.controller.addListener(this.changed);}
  override didUpdateWidget(old:LazyList):void{if(old.options.controller!==this.widget.options.controller){old.options.controller.removeListener(this.changed);this.releaseViewport?.();this.connect();}if(old.options.itemBuilder!==this.widget.options.itemBuilder)this.retained.clear();}
  override dispose():void{this.widget.options.controller.removeListener(this.changed);this.releaseViewport?.();this.retained.clear();}
  build():Widget{
    const options=this.widget.options,{itemCount,itemExtent,height,controller,scheduler}=options,cache=options.cacheExtent??itemExtent*2,keep=options.keepAliveCount??0;
    invariant(Number.isSafeInteger(itemCount)&&itemCount>=0&&Number.isFinite(itemExtent)&&itemExtent>0&&Number.isFinite(height)&&height>=0&&Number.isFinite(cache)&&cache>=0&&Number.isSafeInteger(keep)&&keep>=0&&keep<=64,'invalid-lazy-list','List requires finite viewport/extent/cache and bounded keep-alive');
    controller.applyDimensions(itemCount*itemExtent-height,height,this.context.services.readMetrics().scale,scheduler);const offset=controller.offset;
    const first=Math.min(itemCount,Math.max(0,Math.floor((offset-cache)/itemExtent))),last=Math.max(first,Math.min(itemCount,Math.ceil((offset+height+cache)/itemExtent)));
    invariant(last-first+keep<=256,'list-cache-budget','Viewport/cache/keep-alive exceeds 256 live items');
    const active:number[]=[];for(let index=first;index<last;index++){active.push(index);if(!this.retained.has(index))this.retained.set(index,options.itemBuilder(index));}
    const inactive=[...this.retained.keys()].filter(index=>!active.includes(index)).reverse().slice(0,keep);
    const indices=[...active,...inactive.filter(index=>index<itemCount)];for(const index of this.retained.keys())if(!indices.includes(index))this.retained.delete(index);
    const viewport=new SliverViewport(indices.map(index=>{const child=this.retained.get(index)!;return new SliverItem(child,child.key??new ValueKey(index,controller));}),indices,itemExtent,height,offset,first,last,controller,this.drag.updateDuringLayout);
    return new Listener(this.drag.build(viewport),{onPointerDown:()=>controller.stop(),onPointerCancel:()=>controller.stop(),onPointerSignal:scrollSignalHandler(this.context,controller)});
  }
}
class SliverItem extends StatelessWidget {
  constructor(readonly child:Widget,key:Key){super(key);}
  build():Widget{return this.child;}
}
class SliverViewport extends RenderObjectWidget {
  constructor(readonly childWidgets:readonly Widget[],readonly indices:readonly number[],readonly extent:number,readonly height:number,readonly offset:number,readonly first:number,readonly last:number,readonly controller:ScrollController,readonly updateGestures:()=>void){super();}
  createRenderObject():RenderBox{return new RenderSliverList();}
  updateRenderObject(_context:BuildContext,object:RenderBox):void{const render=object as RenderSliverList;render.configuration=this;const canScroll=this.controller.hasContentDimensions&&this.controller.physics.shouldAcceptUserOffset(this.controller.metrics);render.semantics={id:this.controller.semanticsId,role:'list',name:'Scrollable list',enabled:true,scrollPosition:this.offset,actions:canScroll?{'scroll-forward':()=>this.controller.scrollBy(this.height),'scroll-backward':()=>this.controller.scrollBy(-this.height)}:{}};render.markNeedsLayout();}
}
class RenderSliverList extends RenderBox {
  configuration!:SliverViewport;
  override get clips():boolean{return true;}
  override showOnScreen(rect:Rect={x:0,y:0,...this.size}):void {
    super.showOnScreen(this.configuration.controller.physics.allowImplicitScrolling?revealRect(this.configuration.controller,this.size.height,rect):rect);
  }
  protected performLayout(constraints:BoxConstraints):Size{
    const {indices,extent,height,offset}=this.configuration;invariant(Number.isFinite(constraints.maxWidth),'unbounded-list','LazyList needs a bounded width');
    // A retained Widget can reconcile to a fresh RenderBox after policy/owner
    // replacement. Every bounded live child needs valid geometry before paint.
    this.children.forEach((child,index)=>{const item=indices[index]!;child.layout(BoxConstraints.tight({width:constraints.maxWidth,height:extent}));child.layoutOffset={x:0,y:item*extent-offset};});
    this.configuration.updateGestures();
    return constraints.constrain({width:constraints.maxWidth,height});
  }
  override paint(context:PaintingContext):void{context.save();context.clip({x:0,y:0,...this.size});for(const child of this.children)if(child.layoutOffset.y+child.size.height>0&&child.layoutOffset.y<this.size.height)this.paintChild(context,child);context.restore();}
}
