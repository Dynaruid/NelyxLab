// SPDX-License-Identifier: BSD-3-Clause
// Nelyx keyed swipe/confirmation/animation ownership on the shared gesture/ticker pipeline.
import {invariant} from '../../foundation/errors.ts';
import {Key} from '../../foundation/key.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {StatefulWidget,Element,SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import {SingleTickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationController} from '../animation/animation-controller.ts';
import {AnimationStatus} from '../animation/animation.ts';
import {Curves} from '../animation/curves.ts';
import {GestureDetector} from './gesture-detector.ts';
import type {GestureOptions} from './gesture-detector.ts';
import type {DragUpdateDetails,DragEndDetails} from '../gestures/drag-details.ts';
import {Listener} from './listener.ts';
import {FractionalTranslation} from './fractional-translation.ts';
import {KeyedSubtree} from './basic.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import type {BoxConstraints} from '../rendering/constraints.ts';
import type {Size} from '../../ui/geometry.ts';
import {ClipRect} from './clip.ts';
import {GlobalKey} from './global-key.ts';
import {RenderBox} from '../rendering/object.ts';
import {Directionality} from './app-data.ts';
import {Offset} from '../../ui/offset.ts';

const dismissDirectionToken=Symbol('DismissDirection');
export class DismissDirection {
  private readonly enumBrand=dismissDirectionToken;
  static readonly horizontal=new DismissDirection(1,'horizontal',dismissDirectionToken);static readonly vertical=new DismissDirection(0,'vertical',dismissDirectionToken);
  static readonly startToEnd=new DismissDirection(3,'startToEnd',dismissDirectionToken);static readonly endToStart=new DismissDirection(2,'endToStart',dismissDirectionToken);
  static readonly up=new DismissDirection(4,'up',dismissDirectionToken);static readonly down=new DismissDirection(5,'down',dismissDirectionToken);static readonly none=new DismissDirection(6,'none',dismissDirectionToken);
  static readonly values=Object.freeze([this.vertical,this.horizontal,this.endToStart,this.startToEnd,this.up,this.down,this.none]);
  /** @dartType int */
  readonly index:number;
  /** @dartParam index int */
  private constructor(index:number,readonly name:string,own:typeof dismissDirectionToken){if(own!==dismissDirectionToken)throw new TypeError('Expected a canonical DismissDirection');this.index=index;Object.freeze(this);}toString():string{return 'DismissDirection.'+this.name;}
}
Object.freeze(DismissDirection.prototype);
Object.freeze(DismissDirection);
export type DismissiblePhase='idle'|'drag'|'confirm'|'move'|'settle'|'resize'|'dismissed'|'disposed';
export interface DismissibleOptions {
  readonly key:Key;readonly child:Widget;readonly onDismissed:(direction:DismissDirection)=>void;
  readonly confirmDismiss?:(direction:DismissDirection)=>boolean|Promise<boolean>;
  readonly direction?:DismissDirection;readonly dismissThreshold?:number;readonly minFlingVelocity?:number;
  readonly movementDuration?:number;readonly resizeDuration?:number|null;
}
interface Confirmation {readonly revision:number;readonly direction:DismissDirection}
/** Parent owns its model: remove the key in onDismissed; otherwise the child remains mounted at zero extent. */
export class Dismissible extends StatefulWidget {
  readonly child:Widget;readonly onDismissed:DismissibleOptions['onDismissed'];readonly confirmDismiss:DismissibleOptions['confirmDismiss'];readonly direction:DismissDirection;readonly dismissThreshold:number;readonly minFlingVelocity:number;readonly movementDuration:number;readonly resizeDuration:number|null;
  constructor({key,child,onDismissed,confirmDismiss,direction=DismissDirection.horizontal,dismissThreshold=.4,minFlingVelocity=700,movementDuration=200,resizeDuration=200}:DismissibleOptions){
    super(key);invariant(key instanceof Key&&typeof onDismissed==='function'&&(confirmDismiss===undefined||typeof confirmDismiss==='function'),'invalid-dismissible-owner','Dismissible requires a stable key and model callback');invariant(DismissDirection.values.includes(direction)&&Number.isFinite(dismissThreshold)&&dismissThreshold>0&&dismissThreshold<=1&&Number.isFinite(minFlingVelocity)&&minFlingVelocity>0,'invalid-dismissible-configuration','Dismiss direction/threshold/velocity must be valid');invariant(Number.isFinite(movementDuration)&&movementDuration>=0&&(resizeDuration===null||Number.isFinite(resizeDuration)&&resizeDuration>=0),'invalid-dismissible-duration','Dismiss durations must be finite/nonnegative or null resize');
    this.child=child;this.onDismissed=onDismissed;this.confirmDismiss=confirmDismiss;this.direction=direction;this.dismissThreshold=dismissThreshold;this.minFlingVelocity=minFlingVelocity;this.movementDuration=movementDuration;this.resizeDuration=resizeDuration;
  }
  createState():DismissibleState{return new DismissibleState();}
}
export class DismissibleState extends SingleTickerProviderStateMixin<Dismissible> {
  private animation:AnimationController|undefined;private phaseValue:DismissiblePhase='idle';private dragRatio=0;private fromRatio=0;private toRatio=0;
  private dragging=false;private rtl=false;private notified=false;private retired=false;private pending:Confirmation|undefined;
  private readonly childKey=new GlobalKey('dismissible measured child');
  private readonly completion:{current:DismissibleState|null;revision:number}={current:null,revision:0};
  get phase():DismissiblePhase{return this.phaseValue;}
  get dismissProgress():number{return Math.abs(this.ratio);}
  get isConfirming():boolean{return this.pending!==undefined;}
  private get vertical():boolean{return this.widget.direction===DismissDirection.vertical||this.widget.direction===DismissDirection.up||this.widget.direction===DismissDirection.down;}
  private get ratio():number{return this.phaseValue==='move'||this.phaseValue==='settle'?this.fromRatio+(this.toRatio-this.fromRatio)*this.animation!.value:this.dragRatio;}
  private live():boolean{return !this.retired&&this.mounted&&this.context instanceof Element&&this.context.active;}
  private readonly animationChanged=()=>{if(this.live())this.setState(()=>{});};
  private readonly animationStatus=(status:AnimationStatus)=>{if(status!==AnimationStatus.completed||!this.live())return;
    if(this.phaseValue==='settle'){this.dragRatio=0;this.phaseValue='idle';this.setState(()=>{});}
    else if(this.phaseValue==='move'){this.dragRatio=this.toRatio;if(this.widget.resizeDuration===null||this.widget.resizeDuration===0)this.finishDismiss();else{this.phaseValue='resize';this.animation!.value=0;void this.animation!.animateTo(1,{duration:this.widget.resizeDuration,curve:Curves.easeOut});}}
    else if(this.phaseValue==='resize')this.finishDismiss();
  };
  override initState():void{super.initState();this.completion.current=this;this.animation=new AnimationController({vsync:this,duration:this.widget.movementDuration});this.animation.addListener(this.animationChanged);this.animation.addStatusListener(this.animationStatus);}
  override didChangeDependencies():void{super.didChangeDependencies();const rtl=this.context.maybeDependOn(Directionality)?.direction==='rtl';if(rtl!==this.rtl&&this.phaseValue!=='idle'&&this.phaseValue!=='dismissed')this.reset();this.rtl=rtl;}
  override didUpdateWidget(old:Dismissible):void{super.didUpdateWidget(old);if(old.direction!==this.widget.direction&&this.phaseValue!=='dismissed')this.reset();}
  private actualDirection(ratio:number):DismissDirection{return this.vertical?(ratio<0?DismissDirection.up:DismissDirection.down):(ratio<0!==this.rtl?DismissDirection.endToStart:DismissDirection.startToEnd);}
  private allows(ratio:number):boolean{const direction=this.widget.direction;return direction!==DismissDirection.none&&(direction===DismissDirection.horizontal||direction===DismissDirection.vertical||direction===this.actualDirection(ratio));}
  private extent():number{const child=this.childKey.currentContext?.findRenderObject();if(!(child instanceof RenderBox)||!child.hasSize)return 0;const extent=this.vertical?child.size.height:child.size.width;return Number.isFinite(extent)&&extent>0?extent:0;}
  private start():void{if(!this.live()||this.pending||!['idle','settle'].includes(this.phaseValue)||this.extent()===0)return;const ratio=this.ratio;this.animation!.stop();this.completion.revision++;this.dragRatio=ratio;this.dragging=true;this.phaseValue='drag';this.setState(()=>{});}
  private dragUpdate(details:DragUpdateDetails):void{if(!this.dragging)return;const extent=this.extent();if(extent===0){this.cancelGesture();return;}const delta=details.primaryDelta??(this.vertical?details.delta.dy:details.delta.dx);invariant(Number.isFinite(delta),'invalid-dismiss-delta','Dismiss delta must be finite');const ratio=Math.max(-1,Math.min(1,this.dragRatio+delta/extent));this.dragRatio=this.allows(ratio)?ratio:0;this.setState(()=>{});}
  private end(details:DragEndDetails):void{
    if(!this.dragging)return;this.dragging=false;const ratio=this.dragRatio,velocity=details.primaryVelocity??0;
    const fling=Number.isFinite(velocity)&&Math.abs(velocity)>=this.widget.minFlingVelocity&&Math.abs(ratio)>.05&&Math.sign(velocity)===Math.sign(ratio);
    if(!this.allows(ratio)||Math.abs(ratio)<this.widget.dismissThreshold&&!fling){this.animate(0,'settle');return;}
    const direction=this.actualDirection(ratio),operation:Confirmation={revision:++this.completion.revision,direction},completion=this.completion,confirm=this.widget.confirmDismiss;this.pending=operation;this.phaseValue='confirm';this.setState(()=>{});
    // No closure retains State: disposal clears the token even if application confirmation hangs.
    void Promise.resolve().then(()=>completion.current&&completion.revision===operation.revision?(confirm===undefined?true:confirm(direction)):false).then(value=>completion.current?.decision(operation,value),error=>completion.current?.decisionFailed(operation,error));
  }
  private decision(operation:Confirmation,value:boolean):void{if(this.pending!==operation)return;this.pending=undefined;if(!this.live()||this.completion.revision!==operation.revision)return;if(typeof value!=='boolean'){this.decisionFailed(operation,new Error('Dismiss confirmation must return boolean'));return;}this.animate(value?Math.sign(this.dragRatio):0,value?'move':'settle');}
  private decisionFailed(operation:Confirmation,error:unknown):void{if(this.pending===operation)this.pending=undefined;if(!this.live()||this.completion.revision!==operation.revision)return;this.animate(0,'settle');this.report(error);}
  private animate(target:number,phase:'move'|'settle'):void{const ratio=this.ratio;this.animation!.stop();this.fromRatio=ratio;this.toRatio=target;this.phaseValue=phase;this.animation!.value=0;void this.animation!.animateTo(1,{duration:this.widget.movementDuration,curve:Curves.easeOut});if(this.live())this.setState(()=>{});}
  private cancelGesture():void{if(!this.live())return;if(this.dragging||this.phaseValue==='confirm'){this.completion.revision++;this.dragging=false;this.animate(0,'settle');}}
  private reset(notify=true):void{this.completion.revision++;this.dragging=false;this.animation?.stop();this.phaseValue='idle';this.dragRatio=0;if(notify&&this.live())this.setState(()=>{});}
  private finishDismiss():void{if(this.notified)return;const direction=this.actualDirection(this.dragRatio);this.phaseValue='dismissed';this.notified=true;this.setState(()=>{});try{this.widget.onDismissed(direction);}catch(error){this.report(error);}}
  private report(error:unknown):void{const report=this.live()?this.context.services.reportError:undefined;if(report)report(error);else FlutterError.reportError(new FlutterErrorDetails({exception:error,library:'widgets dismissible'}));}
  override deactivate():void{if(this.phaseValue!=='dismissed')this.reset(false);super.deactivate();}
  build(_context:BuildContext):Widget{
    const ratio=this.ratio,factor=this.phaseValue==='dismissed'?0:this.phaseValue==='resize'?Math.max(0,1-this.animation!.value):1,child=new FractionalTranslation(new KeyedSubtree({key:this.childKey,child:this.widget.child}),{translation:this.vertical?new Offset(0,ratio):new Offset(ratio,0)}),content=new ClipRect(new _DismissibleResize(child,this.vertical,factor));
    const gestures:GestureOptions=this.widget.direction===DismissDirection.none?{}:this.vertical?{onVerticalDragStart:()=>this.start(),onVerticalDragUpdate:details=>this.dragUpdate(details),onVerticalDragEnd:details=>this.end(details),onVerticalDragCancel:()=>this.cancelGesture()}:{onHorizontalDragStart:()=>this.start(),onHorizontalDragUpdate:details=>this.dragUpdate(details),onHorizontalDragEnd:details=>this.end(details),onHorizontalDragCancel:()=>this.cancelGesture()};
    return new Listener(new GestureDetector(content,gestures),{onPointerCancel:()=>this.cancelGesture()});
  }
  override dispose():void{this.retired=true;this.completion.current=null;this.completion.revision++;this.pending=undefined;this.phaseValue='disposed';const errors:unknown[]=[];for(const action of [()=>this.animation?.dispose(),()=>super.dispose()])try{action();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Dismissible retirement failed');}
}

/** Preserve the child's full constraints while its allocated cross-axis extent collapses. */
class _DismissibleResize extends SingleChildRenderObjectWidget {
  constructor(child:Widget,readonly verticalDismiss:boolean,readonly factor:number){super(child);}
  createRenderObject():_RenderDismissibleResize{const render=new _RenderDismissibleResize();render.configure(this.verticalDismiss,this.factor);return render;}
  override updateRenderObject(_context:BuildContext,render:_RenderDismissibleResize):void{render.configure(this.verticalDismiss,this.factor);}
}
class _RenderDismissibleResize extends RenderProxyBox {
  private verticalDismiss=false;private collapseFactor=1;
  configure(vertical:boolean,factor:number):void{this.assertCanMutateLayoutProperty();invariant(Number.isFinite(factor)&&factor>=0&&factor<=1,'invalid-dismiss-collapse','Dismiss collapse factor must be in0..1');if(this.verticalDismiss===vertical&&this.collapseFactor===factor)return;this.verticalDismiss=vertical;this.collapseFactor=factor;this.markNeedsLayout();}
  private scaled(size:Size):Size{return {width:size.width*(this.verticalDismiss?this.collapseFactor:1),height:size.height*(this.verticalDismiss?1:this.collapseFactor)};}
  protected override performLayout(constraints:BoxConstraints):Size{return constraints.constrain(this.scaled(super.performLayout(constraints)));}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return constraints.constrain(this.scaled(super.computeDryLayout(constraints)));}
  protected override computeMinIntrinsicWidth(height:number):number{return super.computeMinIntrinsicWidth(height)*(this.verticalDismiss?this.collapseFactor:1);}
  protected override computeMaxIntrinsicWidth(height:number):number{return super.computeMaxIntrinsicWidth(height)*(this.verticalDismiss?this.collapseFactor:1);}
  protected override computeMinIntrinsicHeight(width:number):number{return super.computeMinIntrinsicHeight(width)*(this.verticalDismiss?1:this.collapseFactor);}
  protected override computeMaxIntrinsicHeight(width:number):number{return super.computeMaxIntrinsicHeight(width)*(this.verticalDismiss?1:this.collapseFactor);}
}
