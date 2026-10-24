// SPDX-License-Identifier: BSD-3-Clause
// Nelyx explicit one-body sheet: fraction resize and body scroll share one drag activity.
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {tickerScheduler} from './ticker-scheduler.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {StatefulWidget,Element} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {SingleTickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationController} from '../animation/animation-controller.ts';
import {TickerCanceled} from '../animation/ticker-future.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {ScrollController} from './scroll-controller.ts';
import {ScrollPositionWithSingleContext} from './scroll-position-with-single-context.ts';
import {ScrollPhysics} from './scroll-physics.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import type {ScrollPosition} from './scroll-position.ts';
import type {ScrollContext} from './scroll-context.ts';
import {AxisDirection} from '../painting/basic-types.ts';
import {LayoutBuilder} from './layout-builder.ts';
import {SizedBox,Align} from './basic.ts';
import {Listener} from './listener.ts';

export type SheetMotionResult={readonly status:'completed'|'cancelled'};
export interface SheetAnimationOptions {readonly duration:number;readonly curve?:Curve}
export class DraggableScrollableController extends ChangeNotifier {
  private binding:DraggableScrollableSheetState|null=null;private retired=false;
  get isAttached():boolean{return this.binding?._attached()??false;}
  private state():DraggableScrollableSheetState{invariant(!this.retired&&this.isAttached,'unattached-sheet-controller','Sheet controller requires its one active laid-out body');return this.binding!;}
  get size():number{return this.state().size;}get pixels():number{return this.sizeToPixels(this.size);}
  sizeToPixels(size:number):number{invariant(Number.isFinite(size),'invalid-sheet-size','Sheet size must be finite');return this.state().availableHeight*size;}
  pixelsToSize(pixels:number):number{invariant(Number.isFinite(pixels),'invalid-sheet-pixels','Sheet pixels must be finite');return pixels/this.state().availableHeight;}
  jumpTo(size:number):void{this.state().jumpTo(size);}
  animateTo(size:number,options:SheetAnimationOptions):Promise<SheetMotionResult>{return this.state().animateTo(size,options);}
  reset():void{const state=this.state();state.jumpTo(state.widget.initialChildSize);state.bodyController.jumpTo(state.bodyController.position.minScrollExtent);}
  _attach(state:DraggableScrollableSheetState):void{invariant(!this.retired&&this.binding===null,'duplicate-sheet-controller','A sheet controller belongs to only one live sheet');this.binding=state;}
  _detach(state:DraggableScrollableSheetState):void{if(this.binding===state)this.binding=null;}
  _changed():void{if(!this.retired)this.notifyListeners();}
  override dispose():void{if(this.retired)return;invariant(this.binding===null,'live-sheet-controller','Detach the sheet before disposing its controller');super.dispose();this.retired=true;}
}
export interface DraggableScrollableSheetOptions extends WidgetOptions {
  /** Attach this controller to exactly one vertical, non-reversed body scroll view. */
  readonly builder:(context:BuildContext,scrollController:ScrollController)=>Widget;
  readonly controller?:DraggableScrollableController|null;
  readonly initialChildSize?:number;readonly minChildSize?:number;readonly maxChildSize?:number;
  readonly expand?:boolean;readonly snap?:boolean;readonly snapSizes?:readonly number[];readonly snapAnimationDuration?:number;
}
export class DraggableScrollableSheet extends StatefulWidget {
  readonly builder:DraggableScrollableSheetOptions['builder'];readonly controller:DraggableScrollableController|null;
  readonly initialChildSize:number;readonly minChildSize:number;readonly maxChildSize:number;
  readonly expand:boolean;readonly snap:boolean;readonly snapSizes:readonly number[];readonly snapAnimationDuration:number;
  constructor({builder,controller=null,initialChildSize=.5,minChildSize=.25,maxChildSize=1,expand=true,snap=false,snapSizes=[],snapAnimationDuration=200,key=null}:DraggableScrollableSheetOptions){
    super(key);invariant(typeof builder==='function','missing-sheet-builder','Sheet requires an explicit body builder');
    invariant([minChildSize,initialChildSize,maxChildSize].every(value=>Number.isFinite(value)&&value>0&&value<=1)&&minChildSize<=initialChildSize&&initialChildSize<=maxChildSize,'invalid-sheet-extents','Require 0 < min <= initial <= max <= 1');
    invariant(Number.isFinite(snapAnimationDuration)&&snapAnimationDuration>=0,'invalid-sheet-duration','Snap duration must be finite and nonnegative');
    invariant(snapSizes.every((value,index)=>Number.isFinite(value)&&value>=minChildSize&&value<=maxChildSize&&(index===0||value>snapSizes[index-1]!)),'invalid-sheet-snaps','Snap sizes must be ordered, unique and within sheet bounds');
    this.builder=builder;this.controller=controller;this.initialChildSize=initialChildSize;this.minChildSize=minChildSize;this.maxChildSize=maxChildSize;this.expand=expand;this.snap=snap;this.snapSizes=Object.freeze([...new Set([minChildSize,...snapSizes,maxChildSize])]);this.snapAnimationDuration=snapAnimationDuration;
  }
  createState():DraggableScrollableSheetState{return new DraggableScrollableSheetState();}
}
export class DraggableScrollableSheetState extends SingleTickerProviderStateMixin<DraggableScrollableSheet> {
  private fraction=.5;private height=0;private owned:DraggableScrollableController|null=null;private animation:AnimationController|null=null;
  private resized=false;private cancelledDispatch=false;private revision=0;private animating=false;private readonly lifetime:{current:DraggableScrollableSheetState|null}={current:this};
  readonly bodyController=new _SheetBodyController(this);
  get size():number{return this.fraction;}get availableHeight():number{return this.height;}
  private get live():boolean{return this.mounted&&(this.context as Element).active;}
  private get controller():DraggableScrollableController{return this.widget.controller??this.owned!;}
  _attached():boolean{return this.live&&this.height>0&&this.bodyController.hasClients;}
  private readonly animationChanged=()=>{if(this.live)this.setSize(this.animation!.value);};
  override initState():void{super.initState();this.fraction=this.widget.initialChildSize;if(this.widget.controller===null)this.owned=new DraggableScrollableController();this.controller._attach(this);this.animation=new AnimationController({vsync:this,value:this.fraction});this.animation.addListener(this.animationChanged);}
  override didUpdateWidget(old:DraggableScrollableSheet):void{super.didUpdateWidget(old);invariant(old.controller===this.widget.controller,'changed-sheet-controller','Use a new Widget key when changing a sheet controller');if(old.minChildSize!==this.widget.minChildSize||old.maxChildSize!==this.widget.maxChildSize){this.stopMotion();const before=this.fraction;this.fraction=this.clamp(before);if(before!==this.fraction){const token=this.lifetime;tickerScheduler(this.context).addPostFrameCallback(()=>{const state=token.current;if(state?.live)state.controller._changed();},{debugLabel:'sheet bounds change'});}}}
  private clamp(size:number):number{return Math.min(this.widget.maxChildSize,Math.max(this.widget.minChildSize,size));}
  private validSize(size:number):void{invariant(Number.isFinite(size)&&size>=0&&size<=1,'invalid-sheet-size','Sheet target must be a finite fraction from 0 to 1');}
  private setSize(size:number):void{const next=this.clamp(size);if(next===this.fraction||!this.live)return;this.fraction=next;this.setState(()=>{});this.controller._changed();}
  private stopMotion():void{this.revision++;this.animating=false;this.animation?.stop();}
  _pointerDown():void{if(!this.live)return;this.stopMotion();this.resized=false;this.cancelledDispatch=false;}
  _pointerCancel():void{this.resized=false;this.cancelledDispatch=true;this.stopMotion();if(this._attached())this.bodyController.position.goIdle();const token=this.lifetime;void Promise.resolve().then(()=>{if(token.current)token.current.cancelledDispatch=false;});}
  _cancelledPointer():boolean{return this.cancelledDispatch;}
  _resize(delta:number):number{invariant(Number.isFinite(delta),'invalid-sheet-delta','Sheet drag delta must be finite');if(!this.live||this.height<=0)return delta;const before=this.fraction,next=this.clamp(before-delta/this.height),used=(before-next)*this.height;if(used!==0){this.resized=true;this.setSize(next);}return delta-used;}
  /** Return true only when the just-ended drag owns sheet settling. Layout-induced idle updates never snap. */
  _endResize(velocity:number):boolean{
    if(!this.live||!this.resized)return false;this.resized=false;
    if(this.fraction>=this.widget.maxChildSize-1e-9&&velocity>=0)return false;
    const revision=++this.revision,token=this.lifetime;
    void Promise.resolve().then(()=>{const state=token.current;if(!state?.live||state.revision!==revision)return;let target=state.fraction;
      if(state.widget.snap){const sizes=state.widget.snapSizes;if(Math.abs(velocity)>=300){target=velocity>0?(sizes.find(value=>value>state.fraction+1e-9)??state.widget.maxChildSize):([...sizes].reverse().find(value=>value<state.fraction-1e-9)??state.widget.minChildSize);}else target=sizes.reduce((best,value)=>Math.abs(value-state.fraction)<Math.abs(best-state.fraction)?value:best);}
      else if(Math.abs(velocity)>=300)target=velocity>0?state.widget.maxChildSize:state.widget.minChildSize;
      if(target!==state.fraction)void state.animateTo(target,{duration:state.widget.snapAnimationDuration,curve:Curves.easeOut}).catch(error=>{const current=token.current;if(current?.live)(current.context.services.reportError??(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets sheet'}))))(error);});
    });return true;
  }
  jumpTo(size:number):void{this.validSize(size);invariant(this._attached(),'unattached-sheet-controller','Sheet jump requires a laid-out active body');this.stopMotion();this.resized=false;this.bodyController.position.goIdle();this.setSize(size);}
  animateTo(size:number,{duration,curve=Curves.easeInOut}:SheetAnimationOptions):Promise<SheetMotionResult>{
    this.validSize(size);invariant(Number.isFinite(duration)&&duration>=0,'invalid-sheet-duration','Sheet animation duration must be finite and nonnegative');invariant(this._attached(),'unattached-sheet-controller','Sheet animation requires a laid-out active body');
    this.stopMotion();this.resized=false;this.bodyController.position.goIdle();const target=this.clamp(size);if(duration===0||target===this.fraction){this.setSize(target);return Promise.resolve({status:'completed'});}
    this.animation!.value=this.fraction;const revision=this.revision,token=this.lifetime;this.animating=true;const future=this.animation!.animateTo(target,{duration,curve}).orCancel;
    return future.then(()=>{const state=token.current;if(!state?.live||state.revision!==revision)return {status:'cancelled'} as const;state.animating=false;return {status:'completed'} as const;},error=>{if(error instanceof TickerCanceled)return {status:'cancelled'} as const;throw error;});
  }
  build(_context:BuildContext):Widget{return new LayoutBuilder((context,constraints)=>{invariant(Number.isFinite(constraints.maxHeight)&&constraints.maxHeight>0&&Number.isFinite(constraints.maxWidth),'unbounded-sheet','Sheet requires a finite positive parent viewport');this.height=constraints.maxHeight;const child=new Listener(this.widget.builder(context,this.bodyController),{onPointerDown:()=>this._pointerDown(),onPointerCancel:()=>this._pointerCancel()});const sized=new SizedBox(constraints.maxWidth,this.height*this.fraction,child);return this.widget.expand?new Align(sized,{alignment:{x:0,y:1}}):sized;});}
  override deactivate():void{this.resized=false;this.stopMotion();super.deactivate();}
  override dispose():void{this.lifetime.current=null;this.controller._detach(this);const errors:unknown[]=[];for(const close of [()=>{this.animation?.removeListener(this.animationChanged);this.animation?.dispose();this.animation=null;},()=>this.bodyController.dispose(),()=>this.owned?.dispose(),()=>super.dispose()])try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Sheet retirement failed');}
}
class _SheetPhysics extends ScrollPhysics {
  constructor(readonly sheet:DraggableScrollableSheetState,parent:ScrollPhysics){super({parent});}
  override applyTo(ancestor:ScrollPhysics|null):ScrollPhysics{return new _SheetPhysics(this.sheet,this.parent!.applyTo(ancestor));}
  override get allowUserScrolling():boolean{for(let policy=this.parent;policy;policy=policy.parent)if(!policy.allowUserScrolling)return false;return true;}
  override get allowImplicitScrolling():boolean{for(let policy=this.parent;policy;policy=policy.parent)if(!policy.allowImplicitScrolling)return false;return true;}
  override shouldAcceptUserOffset(metrics:ScrollMetrics):boolean{return this.allowUserScrolling&&(this.sheet.widget.minChildSize!==this.sheet.widget.maxChildSize||super.shouldAcceptUserOffset(metrics));}
}
class _SheetBodyController extends ScrollController {
  constructor(readonly sheet:DraggableScrollableSheetState){super();}
  override get position():_SheetPosition{return super.position as _SheetPosition;}
  override attach(position:ScrollPosition):void{invariant(!this.hasClients,'duplicate-sheet-body','A sheet requires exactly one body Scrollable');invariant(position.context.axisDirection===AxisDirection.down,'invalid-sheet-body-axis','Sheet body must be vertical and non-reversed');super.attach(position);}
  override createScrollPosition(physics:ScrollPhysics,context:ScrollContext,oldPosition:ScrollPosition|null):ScrollPosition{return new _SheetPosition(this.sheet,{physics:new _SheetPhysics(this.sheet,physics),context,initialPixels:this.initialScrollOffset,keepScrollOffset:this.keepScrollOffset,oldPosition});}
  override dispose():void{invariant(!this.hasClients,'live-sheet-body','Unmount the body before retiring its sheet');super.dispose();}
}
class _SheetPosition extends ScrollPositionWithSingleContext {
  constructor(private readonly sheet:DraggableScrollableSheetState,options:ConstructorParameters<typeof ScrollPositionWithSingleContext>[0]){super(options);}
  override applyUserOffset(delta:number):void{
    if(!this.physics.allowUserScrolling||!this.sheet._attached())return;
    if(delta<0){const remainder=this.sheet._resize(delta);if(remainder!==0&&this.sheet._attached())super.applyUserOffset(remainder);}
    else{const body=Math.min(delta,Math.max(0,this.pixels-this.minScrollExtent));if(body>0)super.applyUserOffset(body);if(!this.sheet._attached())return;const remainder=this.sheet._resize(delta-body);if(remainder!==0&&this.sheet._attached())super.applyUserOffset(remainder);}
  }
  override goBallistic(velocity:number):void{if(this.sheet?._cancelledPointer()){this.goIdle();return;}if(this.sheet?._endResize(velocity)){this.goIdle();return;}super.goBallistic(velocity);}
}
