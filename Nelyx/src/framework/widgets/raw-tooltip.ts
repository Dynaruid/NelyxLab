// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter widgets/raw_tooltip.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
// Existing bounded OverlayEntry transports the overlay; the State owns its lifetime.
import {StatefulWidget,Element,SingleChildRenderObjectWidget} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions,BuildOwner} from './framework.ts';
import {SingleTickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationController} from '../animation/animation-controller.ts';import {AnimationStatus} from '../animation/animation.ts';import type {Animation} from '../animation/animation.ts';
import {AnimationStyle} from '../animation/animation-style.ts';import {CurvedAnimation} from '../animation/animations.ts';import {Curves} from '../animation/curves.ts';
import {Overlay,OverlayEntry} from './overlay.ts';import {InheritedTheme} from './inherited-theme.ts';import {MediaQuery,Directionality} from './app-data.ts';
import {MouseRegion} from './mouse-region.ts';import {RenderMouseRegion} from '../rendering/mouse-region.ts';
import {Listener} from './listener.ts';import {HitTestBehavior} from '../rendering/pointer-listener.ts';import {Semantics} from './semantics.ts';
import {IgnorePointer} from './pointer-blocking.ts';import {SelectionContainer} from './selection-container.ts';import {Positioned} from './basic.ts';
import {TapGestureRecognizer} from '../gestures/tap.ts';import {LongPressGestureRecognizer} from '../gestures/long-press.ts';import {PointerDownEvent} from '../gestures/events.ts';
import type {PointerEvent,PointerEnterEvent,PointerExitEvent} from '../gestures/events.ts';import {PointerDeviceKind} from '../../ui/pointer.ts';
import type {GestureBinding} from '../gestures/binding.ts';import type {SemanticsNode,Rect} from '../../ui/types.ts';import type {KeyEvent as TransportKeyEvent} from '../../ui/input.ts';
import {KeyDownEvent,KeyRepeatEvent} from '../../services/hardware-keyboard.ts';import type {KeyEvent} from '../../services/hardware-keyboard.ts';import {LogicalKeyboardKey} from '../../services/keyboard-key.ts';import type {KeyEventResult} from './focus.ts';
import {Feedback} from './feedback.ts';import {SemanticsService} from '../semantics/semantics-service.ts';
import {scrollChromeTimer} from './scroll-chrome-timers.ts';import type {Disposable} from '../../foundation/disposable.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';import {RenderBox} from '../rendering/object.ts';import type {RenderObject,HitTestEntry} from '../rendering/object.ts';import {BoxConstraints} from '../rendering/constraints.ts';
import {Offset} from '../../ui/offset.ts';import {Size} from '../../ui/size.ts';import type {Size as SizeLike,TransformMatrix} from '../../ui/geometry.ts';import {contains,identity,inversePaintTransform,multiply,translate,fullTransform,transform} from '../../ui/geometry.ts';import {Matrix4} from '../../math/matrix4.ts';
import {positionDependentBox} from '../painting/geometry.ts';import {protect} from '../../ui/value-math.ts';import {valueEquals,hashValues} from '../painting/value-equality.ts';import {invariant} from '../../foundation/errors.ts';
import {StringProperty,DiagnosticsProperty} from '../../foundation/diagnostics.ts';import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';import {FlagProperty} from '../../foundation/diagnostic-properties.ts';

export type TooltipComponentBuilder=(context:BuildContext,animation:Animation<number>)=>Widget;
export type TooltipPositionDelegate=(context:TooltipPositionContext)=>Offset;
export type TooltipTriggeredCallback=()=>void;
export class TooltipPositionContext {
  readonly target:Offset;readonly targetSize:Size;readonly tooltipSize:Size;readonly overlaySize:Size;
  /** @dartType double */ readonly verticalOffset:number;
  readonly preferBelow:boolean;
  /** @dartParam verticalOffset double */
  constructor({target,targetSize,tooltipSize,verticalOffset,preferBelow=true,overlaySize=Size.infinite}:{readonly target:Offset;readonly targetSize:Size;readonly tooltipSize:Size;readonly verticalOffset:number;readonly preferBelow?:boolean;readonly overlaySize?:Size}){this.target=target;this.targetSize=targetSize;this.tooltipSize=tooltipSize;this.verticalOffset=verticalOffset;this.preferBelow=preferBelow;this.overlaySize=overlaySize;protect(this,['target','targetSize','tooltipSize','verticalOffset','preferBelow','overlaySize']);}
  equals(other:unknown):boolean{return this===other||other instanceof TooltipPositionContext&&other.constructor===this.constructor&&valueEquals(this.target,other.target)&&valueEquals(this.targetSize,other.targetSize)&&valueEquals(this.tooltipSize,other.tooltipSize)&&valueEquals(this.overlaySize,other.overlaySize)&&this.verticalOffset===other.verticalOffset&&this.preferBelow===other.preferBelow;}
  get hashCode():number{return hashValues([this.target,this.targetSize,this.tooltipSize,this.overlaySize,this.verticalOffset,this.preferBelow]);}
}
export class TooltipTriggerMode {
  static readonly manual=new TooltipTriggerMode(0,'manual');static readonly longPress=new TooltipTriggerMode(1,'longPress');static readonly tap=new TooltipTriggerMode(2,'tap');static readonly values=Object.freeze([this.manual,this.longPress,this.tap]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'TooltipTriggerMode.'+this.name;}
}
const defaultAnimationStyle=new AnimationStyle({curve:Curves.fastOutSlowIn,duration:150,reverseDuration:75});
export interface RawTooltipOptions extends WidgetOptions {
  readonly semanticsTooltip:string|null;readonly tooltipBuilder:TooltipComponentBuilder;readonly child:Widget;
  readonly hoverDelay?:number;readonly touchDelay?:number;readonly dismissDelay?:number;readonly enableTapToDismiss?:boolean;readonly triggerMode?:TooltipTriggerMode;readonly enableFeedback?:boolean;readonly onTriggered?:TooltipTriggeredCallback|null;readonly animationStyle?:AnimationStyle;readonly positionDelegate?:TooltipPositionDelegate|null;readonly ignorePointer?:boolean;
}
const opened=new Set<RawTooltipState>();
interface OpenScope {readonly states:Set<RawTooltipState>;readonly early:(event:KeyEvent)=>KeyEventResult;readonly fallback:(event:TransportKeyEvent)=>boolean}
const openScopes=new WeakMap<BuildOwner,OpenScope>();
function escape(event:KeyEvent):boolean{return (event instanceof KeyDownEvent||event instanceof KeyRepeatEvent)&&event.logicalKey.equals(LogicalKeyboardKey.escape);}
function dismiss(states:Iterable<RawTooltipState>):boolean{const values=[...states];if(!values.length)return false;for(const state of values)state.dismissTooltip();return true;}
function register(state:RawTooltipState,owner:BuildOwner):void{
  let scope=openScopes.get(owner);if(!scope){const states=new Set<RawTooltipState>();scope={states,early:event=>escape(event)&&dismiss(states)?'handled':'ignored',fallback:event=>!owner.focus.primaryFocus&&event.kind==='down'&&event.key==='Escape'&&dismiss(states)};openScopes.set(owner,scope);owner.focus.addEarlyKeyEventHandler(scope.early);owner.keyHandlers.add(scope.fallback);}scope.states.add(state);opened.add(state);
}
function unregister(state:RawTooltipState,owner:BuildOwner):void{opened.delete(state);const scope=openScopes.get(owner);if(!scope)return;scope.states.delete(state);if(!scope.states.size){owner.focus.removeEarlyKeyEventHandler(scope.early);owner.keyHandlers.delete(scope.fallback);openScopes.delete(owner);}}
export class RawTooltip extends StatefulWidget {
  readonly semanticsTooltip:string|null;readonly tooltipBuilder:TooltipComponentBuilder;readonly child:Widget;readonly hoverDelay:number;readonly touchDelay:number;readonly dismissDelay:number;readonly enableTapToDismiss:boolean;readonly triggerMode:TooltipTriggerMode;readonly enableFeedback:boolean;readonly onTriggered:TooltipTriggeredCallback|null;readonly animationStyle:AnimationStyle;readonly positionDelegate:TooltipPositionDelegate|null;readonly ignorePointer:boolean;
  constructor(o:RawTooltipOptions){super(o.key??null);this.semanticsTooltip=o.semanticsTooltip;this.tooltipBuilder=o.tooltipBuilder;this.child=o.child;this.hoverDelay=o.hoverDelay??0;this.touchDelay=o.touchDelay??1500;this.dismissDelay=o.dismissDelay??100;this.enableTapToDismiss=o.enableTapToDismiss??true;this.triggerMode=o.triggerMode??TooltipTriggerMode.longPress;this.enableFeedback=o.enableFeedback??true;this.onTriggered=o.onTriggered??null;this.animationStyle=o.animationStyle??defaultAnimationStyle;this.positionDelegate=o.positionDelegate??null;this.ignorePointer=o.ignorePointer??false;invariant(typeof this.tooltipBuilder==='function'&&TooltipTriggerMode.values.includes(this.triggerMode),'invalid-raw-tooltip','Tooltip requires a builder and a supported trigger mode');protect(this,['semanticsTooltip','tooltipBuilder','child','hoverDelay','touchDelay','dismissDelay','enableTapToDismiss','triggerMode','enableFeedback','onTriggered','animationStyle','positionDelegate','ignorePointer']);}
  static dismissAllToolTips():boolean{return dismiss(opened);}
  createState():RawTooltipState{return new RawTooltipState();}
  override debugFillProperties(p:DiagnosticPropertiesBuilder):void{super.debugFillProperties(p);const empty=this.semanticsTooltip===null||this.semanticsTooltip==='';p.add(new StringProperty('semantics',this.semanticsTooltip,{showName:empty,...(empty?{defaultValue:null}:{})}));p.add(new DiagnosticsProperty('hover delay',this.hoverDelay,{defaultValue:null}));p.add(new DiagnosticsProperty('touch delay',this.touchDelay,{defaultValue:null}));p.add(new DiagnosticsProperty('dismiss delay',this.dismissDelay,{defaultValue:null}));p.add(new DiagnosticsProperty('triggerMode',this.triggerMode,{defaultValue:null}));p.add(new FlagProperty('enableFeedback',this.enableFeedback,{ifTrue:'true',showName:true}));p.add(new DiagnosticsProperty('positionDelegate',this.positionDelegate,{defaultValue:null}));p.add(new DiagnosticsProperty('animationStyle',this.animationStyle,{defaultValue:defaultAnimationStyle}));}
}
class ExclusiveMouseRegion extends MouseRegion {
  override createRenderObject():RenderMouseRegion{return new RenderExclusiveMouseRegion(this.options);}
}
class RenderExclusiveMouseRegion extends RenderMouseRegion {
  private static outermost=true;private static found=false;
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{
    const outer=RenderExclusiveMouseRegion.outermost;RenderExclusiveMouseRegion.outermost=false;let hit=false;
    try{if(contains({x:0,y:0,...this.size},position)){const child=this.child,matrix=child?inversePaintTransform(this.childTransform(child)):null;hit=!!child&&!!matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal))||this.hitTestSelf(position);if((hit||this.hitTestBehavior==='translucent')&&!RenderExclusiveMouseRegion.found){RenderExclusiveMouseRegion.found=true;result.push({target:this,transform:toLocal});}}return hit;}
    finally{if(outer){RenderExclusiveMouseRegion.outermost=true;RenderExclusiveMouseRegion.found=false;}}
  }
}
/** Source position decisions with live sibling geometry at paint/hit/semantics.
 * This prevents an OverlayEntry from lagging behind a moved/transformed anchor. */
class TooltipPositionWidget extends SingleChildRenderObjectWidget {
  constructor(child:Widget,readonly target:()=>RenderBox|null,readonly positionDelegate:TooltipPositionDelegate|null){super(child);}
  createRenderObject():RenderTooltipPosition{return new RenderTooltipPosition(this.target,this.positionDelegate);}
  updateRenderObject(_context:BuildContext,object:RenderObject):void{const r=object as RenderTooltipPosition;r.target=this.target;r.positionDelegate=this.positionDelegate;r.markNeedsLayout();}
}
class RenderTooltipPosition extends RenderProxyBox {
  private cachedKey:readonly unknown[]|null=null;private cachedOffset=Offset.zero;
  constructor(public target:()=>RenderBox|null,public positionDelegate:TooltipPositionDelegate|null){super();}
  protected override computeDryLayout(c:BoxConstraints):SizeLike{return c.biggest;}
  protected override performLayout(c:BoxConstraints):SizeLike{invariant(c.hasBoundedWidth&&c.hasBoundedHeight,'unbounded-tooltip','Tooltip overlay requires its actual bounded View');this.child?.layout(c.loosen(),{parentUsesSize:true});this.cachedKey=null;return c.biggest;}
  private position():Offset|null{
    const target=this.target(),child=this.child;if(!target?.attached||!target.hasSize||!child?.hasSize||!this.hasSize)return null;
    for(let node:RenderObject=target;node.parent;node=node.parent)if(!node.parent.paintsChild(node))return null;
    const matrix=target.getTransformTo(this);if(Matrix4.fromList(fullTransform(matrix)).determinant()===0)return null;
    const point=transform(matrix,{x:target.size.width/2,y:target.size.height/2}),key=[point.x,point.y,target.size.width,target.size.height,child.size.width,child.size.height,this.size.width,this.size.height,this.positionDelegate];
    if(!this.cachedKey||key.some((v,i)=>v!==this.cachedKey![i])){const context=new TooltipPositionContext({target:new Offset(point.x,point.y),targetSize:new Size(target.size.width,target.size.height),tooltipSize:new Size(child.size.width,child.size.height),overlaySize:new Size(this.size.width,this.size.height),verticalOffset:0});const offset=this.positionDelegate?.(context)??positionDependentBox({size:this.size,childSize:child.size,target:context.target,preferBelow:true});invariant(Number.isFinite(offset.x)&&Number.isFinite(offset.y),'invalid-tooltip-position','Tooltip position must be finite');this.cachedOffset=offset;this.cachedKey=key;}return this.cachedOffset;
  }
  protected override childTransform(child:RenderObject):TransformMatrix{const p=this.position();return multiply(translate(p?.x??0,p?.y??0),child.localTransform);}
  override paint(context:Parameters<RenderProxyBox['paint']>[0]):void{if(this.position())super.paint(context);}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{return this.position()!==null&&super.hitTest(position,result,toLocal);}
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(this.position())super.visitChildrenForSemantics(visitor);}
  override collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void{if(this.position())super.collectSemantics(output,matrix,clip);}
}
const triggerDevices=new Set([PointerDeviceKind.invertedStylus,PointerDeviceKind.stylus,PointerDeviceKind.touch,PointerDeviceKind.unknown,PointerDeviceKind.trackpad]);
export class RawTooltipState extends SingleTickerProviderStateMixin<RawTooltip> {
  private binding!:GestureBinding;
  private timer:Disposable|null=null;private backingController:AnimationController|null=null;private backingAnimation:CurvedAnimation|null=null;private entry:OverlayEntry|null=null;
  private tap:TapGestureRecognizer|null=null;private longPress:LongPressGestureRecognizer|null=null;private status=AnimationStatus.dismissed;private retiring=false;private suspended=false;private readonly hovering=new Set<number>();
  private get owner():BuildOwner{return (this.context as Element).owner;}
  private get live():boolean{return this.mounted&&!this.retiring&&!this.suspended&&(this.context as Element).active;}
  private get controller():AnimationController{return this.backingController??=this.makeController();}
  private makeController():AnimationController{const controller=new AnimationController({vsync:this,duration:this.widget.animationStyle.duration??150,reverseDuration:this.widget.animationStyle.reverseDuration??75});controller.addStatusListener(this.statusChanged);return controller;}
  private get overlayAnimation():CurvedAnimation{return this.backingAnimation??=new CurvedAnimation({parent:this.controller,curve:this.widget.animationStyle.curve??Curves.fastOutSlowIn,reverseCurve:this.widget.animationStyle.reverseCurve});}
  private readonly statusChanged=(status:AnimationStatus)=>{if(!this.live)return;const before=this.status;this.status=status;if(before!==AnimationStatus.dismissed&&status===AnimationStatus.dismissed){unregister(this,this.owner);this.removeEntry();}else if(before===AnimationStatus.dismissed&&status!==AnimationStatus.dismissed){this.showEntry();register(this,this.owner);const messenger=this.context.services.binaryMessenger??this.context.services.platformServices?.defaultBinaryMessenger;if(messenger)void SemanticsService.tooltip(this.widget.semanticsTooltip??'',messenger);}};
  private cancelTimer():void{this.timer?.dispose();this.timer=null;}
  private after(delay:number,callback:()=>void):void{this.cancelTimer();this.timer=scrollChromeTimer(delay,()=>{this.timer=null;if(this.live)callback();});}
  private scheduleShow(delay:number,touchDelay:number|null=null):void{if(!this.live)return;const show=()=>{this.controller.forward();this.cancelTimer();if(touchDelay!==null)this.after(touchDelay,()=>this.controller.reverse());};if(this.controller.isDismissed&&delay>0)this.after(delay,show);else show();}
  dismissTooltip(delay=0):void{if(!this.live)return;this.cancelTimer();if(this.backingController&&(this.backingController.status===AnimationStatus.forward||this.backingController.status===AnimationStatus.completed)){if(delay>0)this.after(delay,()=>this.controller.reverse());else this.controller.reverse();}}
  ensureTooltipVisible():boolean{invariant(this.live,'inactive-tooltip','Tooltip State must be active');this.cancelTimer();if(this.controller.status===AnimationStatus.forward||this.controller.status===AnimationStatus.completed)return false;this.scheduleShow(0);return true;}
  private readonly tapToDismiss=()=>{if(!this.live||!this.widget.enableTapToDismiss)return;this.dismissTooltip();this.hovering.clear();};
  private readonly handleTap=()=>{if(!this.live)return;if(this.controller.isDismissed&&this.widget.enableFeedback)void Feedback.forTap(this.context);this.widget.onTriggered?.();if(this.live)this.scheduleShow(0,this.hovering.size?null:this.widget.touchDelay);};
  private readonly handleLongPress=()=>{if(!this.live)return;if(this.controller.isDismissed&&this.widget.enableFeedback)void Feedback.forLongPress(this.context);this.widget.onTriggered?.();if(this.live)this.scheduleShow(0);};
  private readonly pressUp=()=>{if(this.live&&!this.hovering.size)this.dismissTooltip(this.widget.touchDelay);};
  private readonly pointerDown=(event:PointerDownEvent)=>{if(!this.live)return;const options={binding:this.owner.gestureBinding,debugOwner:this,supportedDevices:triggerDevices};if(this.widget.triggerMode===TooltipTriggerMode.longPress){const r=this.longPress??=new LongPressGestureRecognizer(options);r.onLongPressCancel=this.tapToDismiss;r.onLongPress=this.handleLongPress;r.onLongPressUp=this.pressUp;r.addPointer(event);}else if(this.widget.triggerMode===TooltipTriggerMode.tap){const r=this.tap??=new TapGestureRecognizer(options);r.onTapCancel=this.tapToDismiss;r.onTap=this.handleTap;r.addPointer(event);}};
  private readonly globalPointer=(event:PointerEvent)=>{if(!this.live||this.tap?.primaryPointer===event.pointer||this.longPress?.primaryPointer===event.pointer)return;if(this.timer===null&&this.controller.isDismissed||!(event instanceof PointerDownEvent))return;this.tapToDismiss();};
  private readonly mouseEnter=(event:PointerEnterEvent)=>{if(!this.live)return;this.hovering.add(event.device);const others=[...(openScopes.get(this.owner)?.states??[])].filter(t=>!t.hovering.size);for(const state of others)state.dismissTooltip();this.scheduleShow(others.length?0:this.widget.hoverDelay);};
  private readonly mouseExit=(event:PointerExitEvent)=>{if(!this.live||!this.hovering.size)return;this.hovering.delete(event.device);if(!this.hovering.size)this.dismissTooltip(this.widget.dismissDelay);};
  override initState():void{super.initState();this.binding=this.owner.gestureBinding;this.binding.pointerRouter.addGlobalRoute(this.globalPointer);}
  override didChangeDependencies():void{super.didChangeDependencies();this.entry?.markNeedsBuild();}
  override didUpdateWidget(old:RawTooltip):void{super.didUpdateWidget(old);if(!old.animationStyle.equals(this.widget.animationStyle)){if(this.backingController){this.backingController.duration=this.widget.animationStyle.duration??150;this.backingController.reverseDuration=this.widget.animationStyle.reverseDuration??75;}if(this.backingAnimation){this.backingAnimation.curve=this.widget.animationStyle.curve??Curves.fastOutSlowIn;this.backingAnimation.reverseCurve=this.widget.animationStyle.reverseCurve;}}this.entry?.markNeedsBuild();}
  private removeEntry():void{const entry=this.entry;this.entry=null;if(!entry)return;if(entry.overlay)entry.remove();entry.dispose();}
  private showEntry():void{if(this.entry||!this.live)return;this.entry=new OverlayEntry({builder:()=>this.buildOverlay()});Overlay.of(this.context).insert(this.entry);}
  private buildOverlay():Widget{
    const context=this.context,media=context.maybeDependOn(MediaQuery)?.data,direction=Directionality.maybeOf(context);let child:Widget=new TooltipPositionWidget(new IgnorePointer(new ExclusiveMouseRegion(this.widget.tooltipBuilder(context,this.overlayAnimation),{onEnter:this.mouseEnter,onExit:this.mouseExit}),{ignoring:this.widget.ignorePointer}),()=>{if(!this.live)return null;const render=context.findRenderObject();return render instanceof RenderBox?render:null;},this.widget.positionDelegate);
    child=SelectionContainer.disabled({child});child=InheritedTheme.captureAll(context,child);if(direction)child=new Directionality(direction,child);if(media)child=new MediaQuery(media,child);return Positioned.fill(child,{bottom:media?.keyboardInset??0});
  }
  override deactivate():void{this.suspended=true;this.cancelTimer();this.hovering.clear();unregister(this,this.owner);this.backingController?.stop();super.deactivate();}
  override activate():void{super.activate();this.suspended=false;if(this.status!==AnimationStatus.dismissed){this.showEntry();register(this,this.owner);if(this.status===AnimationStatus.forward)this.controller.forward();else if(this.status===AnimationStatus.reverse)this.controller.reverse();}}
  override dispose():void{this.retiring=true;const errors:unknown[]=[];const cleanup=[()=>this.binding.pointerRouter.removeGlobalRoute(this.globalPointer),()=>unregister(this,this.owner),()=>this.removeEntry(),()=>{if(this.longPress){this.longPress.onLongPressCancel=null;this.longPress.dispose();}},()=>{if(this.tap){this.tap.onTapCancel=null;this.tap.dispose();}},()=>this.cancelTimer(),()=>this.backingController?.dispose(),()=>this.backingAnimation?.dispose(),()=>super.dispose()];for(const close of cleanup)try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Tooltip retirement failed');}
  build(context:BuildContext):Widget{if(this.widget.semanticsTooltip==='')return this.widget.child;Overlay.of(context);return new ExclusiveMouseRegion(new Listener(new Semantics({tooltip:this.widget.semanticsTooltip,child:this.widget.child}),{onPointerDown:this.pointerDown,behavior:HitTestBehavior.opaque}),{onEnter:this.mouseEnter,onExit:this.mouseExit});}
}
