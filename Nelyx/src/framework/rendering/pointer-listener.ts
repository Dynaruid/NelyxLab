// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter rendering/proxy_box.dart, with Nelyx's logical render hit-test builder.
import {RenderProxyBox} from './boxes.ts';
import type {RenderBox,RenderObject,HitTestEntry} from './object.ts';
import type {HitTestEntry as SourceHitTestEntry} from '../gestures/hit-test.ts';
import {PointerDownEvent,PointerMoveEvent,PointerUpEvent,PointerHoverEvent,PointerCancelEvent,PointerPanZoomStartEvent,PointerPanZoomUpdateEvent,PointerPanZoomEndEvent,PointerSignalEvent} from '../gestures/events.ts';
import type {PointerEvent} from '../gestures/events.ts';
import {contains,identity,inversePaintTransform,transform,multiply} from '../../ui/geometry.ts';
import type {Offset,TransformMatrix,Size} from '../../ui/geometry.ts';
import type {BoxConstraints} from './constraints.ts';
import {EnumProperty,FlagsSummary} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {invariant} from '../../foundation/errors.ts';
export type PointerDownEventListener=(event:PointerDownEvent)=>void;
export type PointerMoveEventListener=(event:PointerMoveEvent)=>void;
export type PointerUpEventListener=(event:PointerUpEvent)=>void;
export type PointerCancelEventListener=(event:PointerCancelEvent)=>void;
export type PointerPanZoomStartEventListener=(event:PointerPanZoomStartEvent)=>void;
export type PointerPanZoomUpdateEventListener=(event:PointerPanZoomUpdateEvent)=>void;
export type PointerPanZoomEndEventListener=(event:PointerPanZoomEndEvent)=>void;
export type PointerSignalEventListener=(event:PointerSignalEvent)=>void;
export class HitTestBehavior {
  static readonly deferToChild=new HitTestBehavior(0,'deferToChild');static readonly opaque=new HitTestBehavior(1,'opaque');static readonly translucent=new HitTestBehavior(2,'translucent');
  static readonly values=Object.freeze([HitTestBehavior.deferToChild,HitTestBehavior.opaque,HitTestBehavior.translucent]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}
  toString():string{return 'HitTestBehavior.'+this.name;}
}
export abstract class RenderProxyBoxWithHitTestBehavior extends RenderProxyBox {
  private behaviorValue:HitTestBehavior;
  constructor({behavior=HitTestBehavior.deferToChild,child}:{readonly behavior?:HitTestBehavior;readonly child?:RenderBox<RenderObject>}={}){super(child);invariant(behavior instanceof HitTestBehavior,'invalid-hit-test-behavior','Expected HitTestBehavior');this.behaviorValue=behavior;}
  get behavior():HitTestBehavior{return this.behaviorValue;}
  set behavior(value:HitTestBehavior){this.assertCanMutateLayoutProperty();invariant(value instanceof HitTestBehavior,'invalid-hit-test-behavior','Expected HitTestBehavior');if(value!==this.behaviorValue){this.behaviorValue=value;this.markNeedsPaint();}}
  protected override hitTestSelf(_position:Offset):boolean{return this.behavior===HitTestBehavior.opaque;}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean {
    invariant(this.hasSize,'missing-hit-test-size','Hit testing requires layout');if(!contains({x:0,y:0,...this.size},position))return false;
    let hit=false;const child=this.child;if(child){const matrix=inversePaintTransform(this.childTransform(child));if(matrix)hit=child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal));}
    hit=hit||this.hitTestSelf(position);if(hit||this.behavior===HitTestBehavior.translucent)result.push({target:this,transform:toLocal});return hit;
  }
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new EnumProperty('behavior',this.behavior,{defaultValue:null}));}
}
export interface PointerListenerCallbacks {
  readonly onPointerDown?:PointerDownEventListener|undefined;readonly onPointerMove?:PointerMoveEventListener|undefined;readonly onPointerUp?:PointerUpEventListener|undefined;readonly onPointerHover?:((event:PointerHoverEvent)=>void)|undefined;readonly onPointerCancel?:PointerCancelEventListener|undefined;
  readonly onPointerPanZoomStart?:PointerPanZoomStartEventListener|undefined;readonly onPointerPanZoomUpdate?:PointerPanZoomUpdateEventListener|undefined;readonly onPointerPanZoomEnd?:PointerPanZoomEndEventListener|undefined;readonly onPointerSignal?:PointerSignalEventListener|undefined;
}
export interface RenderPointerListenerOptions extends PointerListenerCallbacks {readonly behavior?:HitTestBehavior;readonly child?:RenderBox<RenderObject>}
export class RenderPointerListener extends RenderProxyBoxWithHitTestBehavior {
  onPointerDown:PointerListenerCallbacks['onPointerDown'];onPointerMove:PointerListenerCallbacks['onPointerMove'];onPointerUp:PointerListenerCallbacks['onPointerUp'];onPointerHover:PointerListenerCallbacks['onPointerHover'];onPointerCancel:PointerListenerCallbacks['onPointerCancel'];
  onPointerPanZoomStart:PointerListenerCallbacks['onPointerPanZoomStart'];onPointerPanZoomUpdate:PointerListenerCallbacks['onPointerPanZoomUpdate'];onPointerPanZoomEnd:PointerListenerCallbacks['onPointerPanZoomEnd'];onPointerSignal:PointerListenerCallbacks['onPointerSignal'];
  constructor(options:RenderPointerListenerOptions={}){super(options);this.updateCallbacks(options);}
  updateCallbacks(options:PointerListenerCallbacks):void{this.onPointerDown=options.onPointerDown;this.onPointerMove=options.onPointerMove;this.onPointerUp=options.onPointerUp;this.onPointerHover=options.onPointerHover;this.onPointerCancel=options.onPointerCancel;this.onPointerPanZoomStart=options.onPointerPanZoomStart;this.onPointerPanZoomUpdate=options.onPointerPanZoomUpdate;this.onPointerPanZoomEnd=options.onPointerPanZoomEnd;this.onPointerSignal=options.onPointerSignal;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.child?super.computeDryLayout(constraints):constraints.biggest;}
  protected override performLayout(constraints:BoxConstraints):Size{return this.child?super.performLayout(constraints):constraints.biggest;}
  override handleEvent(event:PointerEvent,_entry:SourceHitTestEntry):void {
    if(event instanceof PointerDownEvent)this.onPointerDown?.(event);else if(event instanceof PointerMoveEvent)this.onPointerMove?.(event);else if(event instanceof PointerUpEvent)this.onPointerUp?.(event);else if(event instanceof PointerHoverEvent)this.onPointerHover?.(event);else if(event instanceof PointerCancelEvent)this.onPointerCancel?.(event);else if(event instanceof PointerPanZoomStartEvent)this.onPointerPanZoomStart?.(event);else if(event instanceof PointerPanZoomUpdateEvent)this.onPointerPanZoomUpdate?.(event);else if(event instanceof PointerPanZoomEndEvent)this.onPointerPanZoomEnd?.(event);else if(event instanceof PointerSignalEvent)this.onPointerSignal?.(event);
  }
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new FlagsSummary('listeners',new Map<string,unknown>([['down',this.onPointerDown],['move',this.onPointerMove],['up',this.onPointerUp],['hover',this.onPointerHover],['cancel',this.onPointerCancel],['panZoomStart',this.onPointerPanZoomStart],['panZoomUpdate',this.onPointerPanZoomUpdate],['panZoomEnd',this.onPointerPanZoomEnd],['signal',this.onPointerSignal]].map(([key,value])=>[key as string,value??null])),{ifEmpty:'<none>'}));}
}
RenderProxyBox._registerGeometryLayoutSemantics(RenderPointerListener.prototype);
