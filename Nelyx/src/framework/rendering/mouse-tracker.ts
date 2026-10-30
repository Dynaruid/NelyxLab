// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {ChangeNotifier} from '../../foundation/notifier.ts';import {invariant} from '../../foundation/errors.ts';
import type {Offset,TransformMatrix} from '../../ui/geometry.ts';import type {PointerEvent} from '../../ui/input.ts';
import type {MouseTrackerAnnotation} from '../../services/mouse-tracking.ts';import type {HitTestEntry} from './object.ts';
import type {HitTestEntry as SourceHitTestEntry} from '../gestures/hit-test.ts';
import {PointerEnterEvent,PointerExitEvent,PointerRemovedEvent} from '../gestures/events.ts';
import {MouseCursor,MouseCursorManager,SystemMouseCursors} from '../../services/mouse-cursor.ts';
import type {MethodChannel} from '../../services/platform-channel.ts';
import {pointerEventFromTransport} from '../gestures/pointer-event-adapter.ts';
export type MouseTrackerHitTestEntry=Pick<SourceHitTestEntry,'target'|'transform'>;
interface MouseState {event:PointerEvent;annotations:Map<MouseTrackerAnnotation,TransformMatrix|null>}
export type MouseTrackerHitTest=(position:Offset)=>readonly HitTestEntry[];
function annotations(entries:readonly MouseTrackerHitTestEntry[]):Map<MouseTrackerAnnotation,TransformMatrix|null>{const result=new Map<MouseTrackerAnnotation,TransformMatrix|null>();for(const entry of entries){const target=entry.target as typeof entry.target & Partial<MouseTrackerAnnotation>;if(typeof target.validForMouseTracker==='boolean')result.set(target as MouseTrackerAnnotation,entry.transform);}return result;}
function updateMouseEvents(previous:ReadonlyMap<MouseTrackerAnnotation,TransformMatrix|null>,next:ReadonlyMap<MouseTrackerAnnotation,TransformMatrix|null>,event:PointerEvent,viewId:number|string,active:Map<MouseTrackerAnnotation,TransformMatrix|null>,isLive:()=>boolean):void{
  let source:ReturnType<typeof pointerEventFromTransport>|undefined;
  const send=(kind:'enter'|'exit',annotation:MouseTrackerAnnotation,matrix:TransformMatrix|null)=>{if(kind==='enter'){if(annotation.onEnter)annotation.onEnter(PointerEnterEvent.fromMouseEvent(source??=pointerEventFromTransport(event,{viewId})).transformed(matrix));}else if(annotation.onExit)annotation.onExit(PointerExitEvent.fromMouseEvent(source??=pointerEventFromTransport(event,{viewId})).transformed(matrix));};
  for(const [annotation,matrix]of previous){if(!isLive())break;if(!next.has(annotation)){active.delete(annotation);if(annotation.validForMouseTracker)send('exit',annotation,matrix);}}
  for(const [annotation,matrix]of [...next].reverse()){if(!isLive())break;if(annotation.validForMouseTracker&&!previous.has(annotation)){active.set(annotation,matrix);send('enter',annotation,matrix);}}
  if(isLive()){active.clear();for(const [annotation,matrix]of next)active.set(annotation,matrix);}
}
/** One View's device/annotation state. Device identity uses the embedding pointer id. */
export class MouseTracker extends ChangeNotifier {
  private readonly states=new Map<number,MouseState>();private updating=false;private retired=false;private clearRequested=false;private readonly mouseCursorMixin:MouseCursorManager|null;
  constructor(private readonly hitTestInView:MouseTrackerHitTest,private readonly viewId:number|string=0,cursorChannel:MethodChannel|null=null){super();this.mouseCursorMixin=cursorChannel===null?null:new MouseCursorManager(SystemMouseCursors.basic,cursorChannel);}
  get mouseIsConnected():boolean{return this.states.size>0;}
  debugDeviceActiveCursor(device:number):MouseCursor|null{return this.mouseCursorMixin?.debugDeviceActiveCursor(device)??null;}
  updateWithEvent(event:PointerEvent,hitTestResult?:readonly MouseTrackerHitTestEntry[]):void{
    this.ensureAlive();if(!['mouse','pen'].includes(event.device)||event.kind==='wheel')return;const previous=this.states.get(event.pointer);if(event.kind==='leave'&&!previous)return;
    if(previous&&event.kind!=='leave'&&previous.event.x===event.x&&previous.event.y===event.y)return;
    invariant(!this.updating,'reentrant-mouse-update','MouseTracker updates cannot be recursive');const wasConnected=this.mouseIsConnected;this.updating=true;
    try{const next=event.kind==='leave'?new Map<MouseTrackerAnnotation,TransformMatrix|null>():annotations(hitTestResult??this.hitTestInView(event)),active=new Map(previous?.annotations);if(event.kind==='leave')this.states.delete(event.pointer);else this.states.set(event.pointer,{event,annotations:active});try{updateMouseEvents(previous?.annotations??new Map(),next,event,this.viewId,active,()=>!this.retired&&!this.clearRequested);}finally{if(!this.retired&&!this.clearRequested)this.mouseCursorMixin?.handleDeviceCursorUpdate(event.pointer,event.kind==='leave'?new PointerRemovedEvent({device:event.pointer}):MouseCursorManager._usesOnlyRemovalEvent(this.mouseCursorMixin)?null:pointerEventFromTransport(event,{viewId:this.viewId}),[...next.keys()].filter(annotation=>annotation.validForMouseTracker).map(annotation=>annotation.cursor??MouseCursor.defer));}}finally{this.updating=false;if(this.clearRequested){this.clearRequested=false;this.clearDevices();}}
    if(!this.retired&&wasConnected!==this.mouseIsConnected)this.notifyListeners();
  }
  updateAllDevices():void{
    this.ensureAlive();invariant(!this.updating,'reentrant-mouse-update','MouseTracker updates cannot be recursive');this.updating=true;
    try{const snapshot=[...this.states.values()];for(const state of snapshot){if(this.retired||this.clearRequested)break;const next=annotations(this.hitTestInView(state.event)),previous=state.annotations;state.annotations=new Map(previous);try{updateMouseEvents(previous,next,state.event,this.viewId,state.annotations,()=>!this.retired&&!this.clearRequested);}finally{if(!this.retired&&!this.clearRequested)this.mouseCursorMixin?.handleDeviceCursorUpdate(state.event.pointer,null,[...next.keys()].filter(annotation=>annotation.validForMouseTracker).map(annotation=>annotation.cursor??MouseCursor.defer));}}}finally{this.updating=false;if(this.clearRequested){this.clearRequested=false;this.clearDevices();}}
  }
  /** The View drops its local pointer streams when hidden or detached. */
  clearDevices():void{if(this.retired)return;if(this.updating){this.clearRequested=true;return;}const errors:unknown[]=[];const snapshot1=[...this.states.values()];for(const state of snapshot1)try{this.updateWithEvent({...state.event,kind:'leave'});}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Mouse stream retirement failed');}
  override dispose():void{if(this.retired)return;this.retired=true;this.states.clear();try{this.mouseCursorMixin?.dispose();}finally{super.dispose();}}
}
