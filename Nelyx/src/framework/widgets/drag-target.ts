// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source widgets/drag_target.dart with actual View hit paths and retained overlay entries.
import {invariant} from '../../foundation/errors.ts';
import type {Key} from '../../foundation/key.ts';
import {Offset} from '../../ui/offset.ts';
import {StatefulWidget,State,Element} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import {MetaData,Positioned} from './basic.ts';
import {Listener} from './listener.ts';
import {IgnorePointer} from './pointer-blocking.ts';
import {ExcludeSemantics} from './semantics.ts';
import {Overlay,OverlayEntry} from './overlay.ts';
import type {OverlayState} from './overlay.ts';
import {MediaQuery} from './app-data.ts';
import {RenderBox} from '../rendering/object.ts';
import {RenderMetaData} from '../rendering/meta-data.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {HitTestResult} from '../gestures/hit-test.ts';
import type {GestureBinding} from '../gestures/binding.ts';
import {Drag} from '../gestures/drag.ts';
import {ImmediateMultiDragGestureRecognizer,HorizontalMultiDragGestureRecognizer,VerticalMultiDragGestureRecognizer,DelayedMultiDragGestureRecognizer} from '../gestures/multidrag.ts';
import type {MultiDragGestureRecognizer,GestureMultiDragStartCallback} from '../gestures/multidrag.ts';
import type {AllowedButtonsFilter} from '../gestures/recognizer.ts';
import type {PointerDownEvent} from '../gestures/events.ts';
import type {DeviceGestureSettings} from '../gestures/gesture-settings.ts';
import {DragUpdateDetails,DragEndDetails} from '../gestures/drag-details.ts';
import {Velocity} from '../gestures/velocity-tracker.ts';
import {kLongPressTimeout} from '../gestures/constants.ts';
export type DragTargetWillAccept<T>=(data:T|null)=>boolean;
export type DragTargetWillAcceptWithDetails<T>=(details:DragTargetDetails<T>)=>boolean;
export type DragTargetAccept<T>=(data:T)=>void;
export type DragTargetAcceptWithDetails<T>=(details:DragTargetDetails<T>)=>void;
export type DragTargetBuilder<T>=(context:BuildContext,candidateData:readonly (T|null)[],rejectedData:readonly unknown[])=>Widget;
export type DragUpdateCallback=(details:DragUpdateDetails)=>void;
export type DraggableCanceledCallback=(velocity:Velocity,offset:Offset)=>void;
export type DragEndCallback=(details:DraggableDetails)=>void;
export type DragTargetLeave<T>=(data:T|null)=>void;
export type DragTargetMove<T>=(details:DragTargetDetails<T>)=>void;
export type DragAnchorStrategy=(draggable:Draggable<unknown>,context:BuildContext,position:Offset)=>Offset;
export function childDragAnchorStrategy(_draggable:Draggable<unknown>,context:BuildContext,position:Offset):Offset{const render=context.findRenderObject();invariant(render instanceof RenderBox,'missing-draggable-render-box','Child anchoring requires the actual RenderBox');const local=render.globalToLocal({x:position.dx,y:position.dy});return new Offset(local.x,local.y);}
export function pointerDragAnchorStrategy(_draggable:Draggable<unknown>,_context:BuildContext,_position:Offset):Offset{return Offset.zero;}
function cleanup(operations:readonly (()=>void)[],message:string):void{const errors:unknown[]=[];for(const operation of operations)try{operation();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,message);}
export class DraggableDetails {
  readonly wasAccepted:boolean;readonly velocity:Velocity;readonly offset:Offset;
  constructor({wasAccepted=false,velocity,offset}:{readonly wasAccepted?:boolean;readonly velocity:Velocity;readonly offset:Offset}){this.wasAccepted=wasAccepted;this.velocity=velocity;this.offset=offset;if(new.target===DraggableDetails)Object.freeze(this);}
}
export class DragTargetDetails<T> {
  readonly data:T;readonly offset:Offset;
  constructor({data,offset}:{readonly data:T;readonly offset:Offset}){this.data=data;this.offset=offset;if(new.target===DragTargetDetails)Object.freeze(this);}
}
type Axis='horizontal'|'vertical';
export interface DraggableOptions<T> {
  readonly key?:Key|null;readonly data?:T|null;readonly axis?:Axis|null;readonly affinity?:Axis|null;readonly childWhenDragging?:Widget|null;readonly feedbackOffset?:Offset;readonly dragAnchorStrategy?:DragAnchorStrategy;readonly maxSimultaneousDrags?:number|null;
  readonly onDragStarted?:()=>void;readonly onDragUpdate?:DragUpdateCallback;readonly onDraggableCanceled?:DraggableCanceledCallback;readonly onDragEnd?:DragEndCallback;readonly onDragCompleted?:()=>void;readonly ignoringFeedbackSemantics?:boolean;readonly ignoringFeedbackPointer?:boolean;readonly rootOverlay?:boolean;readonly hitTestBehavior?:HitTestBehavior;readonly allowedButtonsFilter?:AllowedButtonsFilter;readonly gestureSettings?:DeviceGestureSettings|null;
}
export class Draggable<T=unknown> extends StatefulWidget {
  constructor(readonly child:Widget,readonly feedback:Widget,readonly options:DraggableOptions<T>={}){super(options.key??null);const max=options.maxSimultaneousDrags;invariant(max==null||Number.isSafeInteger(max)&&max>=0,'invalid-drag-limit','Maximum simultaneous drags must be a nonnegative integer');invariant(options.axis==null||options.axis==='horizontal'||options.axis==='vertical','invalid-drag-axis','Unknown axis');invariant(options.affinity==null||options.affinity==='horizontal'||options.affinity==='vertical','invalid-drag-affinity','Unknown affinity');}
  createRecognizer(onStart:GestureMultiDragStartCallback,context:BuildContext):MultiDragGestureRecognizer{invariant(context instanceof Element,'invalid-draggable-context','Draggable requires its actual Element binding');const options={binding:context.owner.gestureBinding,debugOwner:this,...(this.options.allowedButtonsFilter?{allowedButtonsFilter:this.options.allowedButtonsFilter}:{})},Type=this.options.affinity==='horizontal'?HorizontalMultiDragGestureRecognizer:this.options.affinity==='vertical'?VerticalMultiDragGestureRecognizer:ImmediateMultiDragGestureRecognizer,recognizer=new Type(options);recognizer.onStart=onStart;return recognizer;}
  createState():State{return new DraggableState<T>();}
}
export interface LongPressDraggableOptions<T> extends DraggableOptions<T> {readonly delay?:number;readonly hapticFeedbackOnStart?:boolean}
export class LongPressDraggable<T=unknown> extends Draggable<T> {
  constructor(child:Widget,feedback:Widget,options:LongPressDraggableOptions<T>={}){super(child,feedback,options);}
  get delay():number{return (this.options as LongPressDraggableOptions<T>).delay??kLongPressTimeout;}
  get hapticFeedbackOnStart():boolean{return (this.options as LongPressDraggableOptions<T>).hapticFeedbackOnStart??true;}
  override createRecognizer(onStart:GestureMultiDragStartCallback,context:BuildContext):DelayedMultiDragGestureRecognizer{invariant(context instanceof Element,'invalid-draggable-context','Draggable requires its actual Element binding');const recognizer=new DelayedMultiDragGestureRecognizer({binding:context.owner.gestureBinding,debugOwner:this,delay:this.delay,...(this.options.allowedButtonsFilter?{allowedButtonsFilter:this.options.allowedButtonsFilter}:{})});recognizer.onStart=position=>{const result=onStart(position);if(result!==null&&this.hapticFeedbackOnStart&&context.mounted){const channel=context.services.platformServices?.channels.platform;if(channel)void channel.invokeMethod('HapticFeedback.vibrate','HapticFeedbackType.selectionClick').catch(error=>context.services.reportError?.(error));}return result;};return recognizer;}
}
class DraggableState<T> extends State<Draggable<T>> {
  private recognizer:MultiDragGestureRecognizer|null=null;private activeCount=0;private retiring=false;private readonly avatars=new Set<DragAvatar<T>>();private completionOptions!:DraggableOptions<T>;
  override initState():void{this.completionOptions=this.widget.options;this.recognizer=this.widget.createRecognizer(position=>this.startDrag(position),this.context);}
  override didChangeDependencies():void{if(this.recognizer)this.recognizer.gestureSettings=this.widget.options.gestureSettings===undefined?MediaQuery.maybeGestureSettingsOf(this.context):this.widget.options.gestureSettings;}
  override didUpdateWidget(_old:Draggable<T>):void{this.completionOptions=this.widget.options;this.didChangeDependencies();}
  private readonly routePointer=(event:PointerDownEvent):void=>{const max=this.widget.options.maxSimultaneousDrags;if(!this.retiring&&(max==null||this.activeCount<max))this.recognizer?.addPointer(event);};
  private startDrag(position:Offset):Drag|null{const widget=this.widget,options=widget.options,max=options.maxSimultaneousDrags;if(this.retiring||!this.mounted||max!=null&&this.activeCount>=max)return null;invariant(this.context instanceof Element,'invalid-draggable-context','Draggable requires an Element');const context=this.context,anchor=(options.dragAnchorStrategy??childDragAnchorStrategy)(widget as Draggable<unknown>,context,position),overlay=Overlay.of(context,{rootOverlay:options.rootOverlay??false});this.setState(()=>{this.activeCount++;});let avatar:DragAvatar<T>|undefined;try{avatar=new DragAvatar({binding:context.owner.gestureBinding,overlayState:overlay,viewId:context.services.owner.id,data:options.data??null,axis:options.axis??null,initialPosition:position,dragStartPoint:anchor,feedback:widget.feedback,feedbackOffset:options.feedbackOffset??Offset.zero,ignoringFeedbackSemantics:options.ignoringFeedbackSemantics??true,ignoringFeedbackPointer:options.ignoringFeedbackPointer??true,onDragUpdate:details=>{if(this.mounted&&!this.retiring&&this.context.mounted)this.widget.options.onDragUpdate?.(details);},onDragEnd:(velocity,offset,wasAccepted)=>{if(avatar)this.avatars.delete(avatar);this.activeCount--;if(this.mounted&&!this.retiring&&this.context.mounted)this.setState(()=>{});const current=this.completionOptions;cleanup([()=>{if(this.mounted&&!this.retiring&&this.context.mounted)current.onDragEnd?.(new DraggableDetails({wasAccepted,velocity,offset}));},()=>{if(wasAccepted)current.onDragCompleted?.();else current.onDraggableCanceled?.(velocity,offset); }],'Draggable completion callbacks failed');}});this.avatars.add(avatar);if(this.retiring||!this.mounted){avatar.cancel();return null;}widget.options.onDragStarted?.();return avatar;}catch(error){try{if(avatar)avatar.cancel();else{this.activeCount--;if(this.mounted&&!this.retiring&&this.context.mounted)this.setState(()=>{});}}catch(retirement){throw new AggregateError([error,retirement],'Draggable start failed');}throw error;}}
  override dispose():void{this.retiring=true;const recognizer=this.recognizer;this.recognizer=null;try{cleanup([()=>recognizer?.dispose(),...[...this.avatars].map(avatar=>()=>avatar.cancel())],'Draggable retirement failed');}finally{this.avatars.clear();}}
  build(context:BuildContext):Widget{Overlay.of(context,{rootOverlay:this.widget.options.rootOverlay??false});const options=this.widget.options,max=options.maxSimultaneousDrags,canDrag=max==null||this.activeCount<max;return new Listener(this.activeCount===0||options.childWhenDragging==null?this.widget.child:options.childWhenDragging,{behavior:options.hitTestBehavior??HitTestBehavior.deferToChild,...(canDrag?{onPointerDown:this.routePointer}:{})});}
}
export interface DragTargetOptions<T> {
  /** TS erases T; supply an actual runtime data guard instead of a fake reified type. */
  readonly isDataType:(value:unknown)=>value is T;readonly builder:DragTargetBuilder<T>;readonly key?:Key|null;readonly onWillAccept?:DragTargetWillAccept<T>;readonly onWillAcceptWithDetails?:DragTargetWillAcceptWithDetails<T>;readonly onAccept?:DragTargetAccept<T>;readonly onAcceptWithDetails?:DragTargetAcceptWithDetails<T>;readonly onLeave?:DragTargetLeave<T>;readonly onMove?:DragTargetMove<T>;readonly hitTestBehavior?:HitTestBehavior;
}
export class DragTarget<T=unknown> extends StatefulWidget {
  constructor(readonly options:DragTargetOptions<T>){super(options.key??null);invariant(!(options.onWillAccept&&options.onWillAcceptWithDetails),'ambiguous-drag-acceptance','Specify onWillAccept or onWillAcceptWithDetails');}
  createState():State{return new DragTargetState<T>();}
}
class DragTargetState<T> extends State<DragTarget<T>> {
  private readonly candidateAvatars:DragAvatar<unknown>[]=[];private readonly rejectedAvatars:DragAvatar<unknown>[]=[];private retiring=false;
  isExpectedDataType(data:unknown):boolean{return data===null||this.widget.options.isDataType(data);}
  didEnter(avatar:DragAvatar<unknown>):boolean{if(!this.mounted||this.retiring||!this.context.mounted)return false;invariant(!this.candidateAvatars.includes(avatar)&&!this.rejectedAvatars.includes(avatar),'duplicate-drag-target-entry','Avatar is already inside target');const options=this.widget.options,data=avatar.data as T|null,accept=(!options.onWillAccept&&!options.onWillAcceptWithDetails)||!!options.onWillAccept?.(data)||data!==null&&!!options.onWillAcceptWithDetails?.(new DragTargetDetails({data,offset:avatar.lastOffset}));if(!this.mounted||this.retiring||!this.context.mounted)return false;this.setState(()=>{(accept?this.candidateAvatars:this.rejectedAvatars).push(avatar);});return accept;}
  didLeave(avatar:DragAvatar<unknown>):void{if(!this.mounted||this.retiring||!this.context.mounted)return;this.setState(()=>{for(const list of [this.candidateAvatars,this.rejectedAvatars]){const index=list.indexOf(avatar);if(index>=0)list.splice(index,1);}});this.widget.options.onLeave?.(avatar.data as T|null);}
  didDrop(avatar:DragAvatar<unknown>):void{if(!this.mounted||this.retiring||!this.context.mounted)return;invariant(this.candidateAvatars.includes(avatar),'unaccepted-drag-drop','Only accepted candidates can drop');this.setState(()=>{this.candidateAvatars.splice(this.candidateAvatars.indexOf(avatar),1);});if(avatar.data!==null){const data=avatar.data as T;this.widget.options.onAccept?.(data);if(this.mounted&&!this.retiring&&this.context.mounted)this.widget.options.onAcceptWithDetails?.(new DragTargetDetails({data,offset:avatar.lastOffset}));}}
  didMove(avatar:DragAvatar<unknown>):void{if(this.mounted&&!this.retiring&&this.context.mounted&&avatar.data!==null)this.widget.options.onMove?.(new DragTargetDetails({data:avatar.data as T,offset:avatar.lastOffset}));}
  override dispose():void{this.retiring=true;this.candidateAvatars.length=0;this.rejectedAvatars.length=0;}
  build(context:BuildContext):Widget{return new MetaData(this.widget.options.builder(context,this.candidateAvatars.map(avatar=>avatar.data as T|null),this.rejectedAvatars.map(avatar=>avatar.data)),{metaData:this,behavior:this.widget.options.hitTestBehavior??HitTestBehavior.translucent});}
}
interface DragAvatarOptions<T> {
  readonly binding:GestureBinding;readonly overlayState:OverlayState;readonly viewId:number|string;readonly data:T|null;readonly axis:Axis|null;readonly initialPosition:Offset;readonly dragStartPoint:Offset;readonly feedback:Widget;readonly feedbackOffset:Offset;readonly ignoringFeedbackSemantics:boolean;readonly ignoringFeedbackPointer:boolean;readonly onDragUpdate:DragUpdateCallback;readonly onDragEnd:(velocity:Velocity,offset:Offset,wasAccepted:boolean)=>void;
}
class DragAvatar<T> extends Drag {
  private activeTarget:DragTargetState<unknown>|null=null;private readonly enteredTargets:DragTargetState<unknown>[]=[];private position:Offset;lastOffset:Offset;private overlayOffset=Offset.zero;private entry:OverlayEntry|null=null;private live=true;
  get data():T|null{return this.options.data;}
  constructor(private readonly options:DragAvatarOptions<T>){super();this.position=options.initialPosition;this.lastOffset=this.position.subtract(options.dragStartPoint);this.entry=new OverlayEntry({builder:()=>this.build()});options.overlayState.insert(this.entry);try{this.updateDrag(this.position);}catch(error){this.live=false;cleanup([()=>this.leaveAllEntered(),()=>this.retireEntry(),()=>{throw error;}],'Drag avatar admission failed');}}
  override update(details:DragUpdateDetails):void{if(!this.live)return;const old=this.position;this.position=this.position.add(this.restrictAxis(details.delta));this.updateDrag(this.position);if(this.live&&!old.equals(this.position))this.options.onDragUpdate(details);}
  override end(details:DragEndDetails):void{this.finishDrag('dropped',new Velocity({pixelsPerSecond:this.restrictAxis(details.velocity.pixelsPerSecond)}));}
  override cancel():void{this.finishDrag('canceled');}
  private updateDrag(position:Offset):void{if(!this.live)return;this.lastOffset=position.subtract(this.options.dragStartPoint);if(this.options.overlayState.mounted){const box=this.options.overlayState.context.findRenderObject();invariant(box instanceof RenderBox,'missing-drag-overlay-box','Overlay feedback requires its actual RenderBox');const local=box.globalToLocal({x:position.dx,y:position.dy});this.overlayOffset=new Offset(local.x,local.y).subtract(this.options.dragStartPoint);this.entry?.markNeedsBuild();}const result=new HitTestResult();this.options.binding.hitTestInView(result,position.add(this.options.feedbackOffset),this.options.viewId);const targets:DragTargetState<unknown>[]=[];for(const entry of result.path)if(entry.target instanceof RenderMetaData&&entry.target.metaData instanceof DragTargetState&&entry.target.metaData.isExpectedDataType(this.data))targets.push(entry.target.metaData as DragTargetState<unknown>);const listsMatch=this.enteredTargets.length>0&&targets.length>=this.enteredTargets.length&&this.enteredTargets.every((target,index)=>target===targets[index]);if(listsMatch&&(this.activeTarget!==null||targets.length===this.enteredTargets.length)){const snapshot=[...this.enteredTargets];for(const target of snapshot){target.didMove(this as DragAvatar<unknown>);if(!this.live)return;}return;}this.leaveAllEntered();if(!this.live)return;let active:DragTargetState<unknown>|null=null;for(const target of targets){this.enteredTargets.push(target);const accepted=target.didEnter(this as DragAvatar<unknown>);if(!this.live)return;if(accepted){active=target;break;}}const snapshot1=[...this.enteredTargets];for(const target of snapshot1){target.didMove(this as DragAvatar<unknown>);if(!this.live)return;}this.activeTarget=active;}
  private leaveAllEntered():void{const targets=this.enteredTargets.splice(0);this.activeTarget=null;cleanup(targets.map(target=>()=>target.didLeave(this as DragAvatar<unknown>)),'Drag target leave callbacks failed');}
  private retireEntry():void{const entry=this.entry;this.entry=null;if(!entry)return;cleanup([()=>{if(entry.overlay)entry.remove();},()=>entry.dispose()],'Drag feedback retirement failed');}
  private finishDrag(kind:'dropped'|'canceled',velocity:Velocity=Velocity.zero):void{if(!this.live)return;this.live=false;let accepted=false;cleanup([()=>{if(kind==='dropped'&&this.activeTarget!==null){const target=this.activeTarget;target.didDrop(this as DragAvatar<unknown>);accepted=true;const index=this.enteredTargets.indexOf(target);if(index>=0)this.enteredTargets.splice(index,1);}},()=>this.leaveAllEntered(),()=>this.retireEntry(),()=>this.options.onDragEnd(velocity,this.lastOffset,accepted)],'Drag completion/retirement failed');}
  private build():Widget{let child:Widget=new IgnorePointer(this.options.feedback,{ignoring:this.options.ignoringFeedbackPointer});if(this.options.ignoringFeedbackSemantics)child=new ExcludeSemantics(child);return new Positioned(child,{left:this.overlayOffset.dx,top:this.overlayOffset.dy});}
  private restrictAxis(offset:Offset):Offset{return this.options.axis==='horizontal'?new Offset(offset.dx,0):this.options.axis==='vertical'?new Offset(0,offset.dy):offset;}
}
