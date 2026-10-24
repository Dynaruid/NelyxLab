// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source proxy_box.dart gesture actions feed Nelyx's actual retained semantics tree.
import type {SemanticsTransportProperties} from './semantics-transport.ts';
import type {SemanticsConfiguration} from '../semantics/semantics.ts';
import {RenderProxyBoxWithHitTestBehavior} from './pointer-listener.ts';
import {HitTestBehavior} from './pointer-listener.ts';
import type {RenderBox,RenderObject} from './object.ts';
import type {SemanticsNode,Rect,SemanticsAction as TransportAction} from '../../ui/types.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {Offset} from '../../ui/offset.ts';
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {DragUpdateDetails} from '../gestures/drag-details.ts';
import type {GestureDragUpdateCallback} from '../gestures/drag-details.ts';
import type {GestureTapCallback} from '../gestures/tap.ts';
import {IterableProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {invariant} from '../../foundation/errors.ts';
let nextSemanticsGestureId=0;
export interface RenderSemanticsGestureHandlerOptions {readonly child?:RenderBox<RenderObject>;readonly behavior?:HitTestBehavior;readonly onTap?:GestureTapCallback|null;readonly onLongPress?:GestureTapCallback|null;readonly onHorizontalDragUpdate?:GestureDragUpdateCallback|null;readonly onVerticalDragUpdate?:GestureDragUpdateCallback|null;readonly scrollFactor?:number}
export class RenderSemanticsGestureHandler extends RenderProxyBoxWithHitTestBehavior {
  private readonly generatedId='gesture-semantics-'+ ++nextSemanticsGestureId;semanticsId:string|null=null;semanticsLabel='';semanticsEnabled=true;
  private validActionsValue:Set<SemanticsAction>|null=null;private tap:GestureTapCallback|null;private longPress:GestureTapCallback|null;private horizontal:GestureDragUpdateCallback|null;private vertical:GestureDragUpdateCallback|null;scrollFactor:number;
  constructor(options:RenderSemanticsGestureHandlerOptions={}){super(options);this.tap=options.onTap??null;this.longPress=options.onLongPress??null;this.horizontal=options.onHorizontalDragUpdate??null;this.vertical=options.onVerticalDragUpdate??null;this.scrollFactor=options.scrollFactor??0.8;}
  protected override get hasSourceSemanticsConfiguration():boolean{return this.semanticsId===null&&!this.semanticsLabel;}
  private readonly performScrollLeft=()=>this.semanticScroll(true,false);private readonly performScrollRight=()=>this.semanticScroll(true,true);private readonly performScrollUp=()=>this.semanticScroll(false,false);private readonly performScrollDown=()=>this.semanticScroll(false,true);
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{
    super.describeSemanticsConfiguration(config);
    if(this.onTap!==null&&this.isValidAction(SemanticsAction.tap))config.onTap=this.onTap;
    if(this.onLongPress!==null&&this.isValidAction(SemanticsAction.longPress))config.onLongPress=this.onLongPress;
    if(this.onHorizontalDragUpdate!==null){if(this.isValidAction(SemanticsAction.scrollRight))config.onScrollRight=this.performScrollRight;if(this.isValidAction(SemanticsAction.scrollLeft))config.onScrollLeft=this.performScrollLeft;}
    if(this.onVerticalDragUpdate!==null){if(this.isValidAction(SemanticsAction.scrollUp))config.onScrollUp=this.performScrollUp;if(this.isValidAction(SemanticsAction.scrollDown))config.onScrollDown=this.performScrollDown;}
  }
  get validActions():Set<SemanticsAction>|null{return this.validActionsValue;}
  set validActions(value:Set<SemanticsAction>|null){if(this.validActionsValue===value||this.validActionsValue!==null&&value!==null&&this.validActionsValue.size===value.size&&[...value].every(action=>this.validActionsValue!.has(action)))return;this.validActionsValue=value;this.markNeedsSemanticsUpdate();}
  get onTap():GestureTapCallback|null{return this.tap;}set onTap(value:GestureTapCallback|null){if(value===this.tap)return;const had=this.tap!==null;this.tap=value;if((value!==null)!==had)this.markNeedsSemanticsUpdate();}
  get onLongPress():GestureTapCallback|null{return this.longPress;}set onLongPress(value:GestureTapCallback|null){if(value===this.longPress)return;const had=this.longPress!==null;this.longPress=value;if((value!==null)!==had)this.markNeedsSemanticsUpdate();}
  get onHorizontalDragUpdate():GestureDragUpdateCallback|null{return this.horizontal;}set onHorizontalDragUpdate(value:GestureDragUpdateCallback|null){if(value===this.horizontal)return;const had=this.horizontal!==null;this.horizontal=value;if((value!==null)!==had)this.markNeedsSemanticsUpdate();}
  get onVerticalDragUpdate():GestureDragUpdateCallback|null{return this.vertical;}set onVerticalDragUpdate(value:GestureDragUpdateCallback|null){if(value===this.vertical)return;const had=this.vertical!==null;this.vertical=value;if((value!==null)!==had)this.markNeedsSemanticsUpdate();}
  private isValidAction(action:SemanticsAction):boolean{return this.validActionsValue===null||this.validActionsValue.has(action);}
  private semanticScroll(horizontal:boolean,positive:boolean):void{if(this.debugDisposed||!this.semanticsEnabled)return;const callback=horizontal?this.horizontal:this.vertical;if(callback!==null){const delta=(horizontal?this.size.width:this.size.height)*this.scrollFactor*(positive?1:-1),center=this.localToGlobal({x:this.size.width/2,y:this.size.height/2});callback(new DragUpdateDetails({delta:new Offset(horizontal?delta:0,horizontal?0:delta),primaryDelta:delta,globalPosition:new Offset(center.x,center.y)}));}}
  override get semanticsTransport():SemanticsTransportProperties|null {
    const actions:Partial<Record<TransportAction,()=>void>>={};
    const live=(callback:()=>void)=>()=>{if(!this.debugDisposed&&this.semanticsEnabled)callback();};
    if(this.tap!==null&&this.isValidAction(SemanticsAction.tap))actions.activate=live(()=>this.tap?.());
    if(this.longPress!==null&&this.isValidAction(SemanticsAction.longPress))actions['long-press']=live(()=>this.longPress?.());
    if(this.horizontal!==null){if(this.isValidAction(SemanticsAction.scrollLeft))actions['scroll-left']=()=>this.semanticScroll(true,false);if(this.isValidAction(SemanticsAction.scrollRight))actions['scroll-right']=()=>this.semanticScroll(true,true);}
    if(this.vertical!==null){if(this.isValidAction(SemanticsAction.scrollUp))actions['scroll-up']=()=>this.semanticScroll(false,false);if(this.isValidAction(SemanticsAction.scrollDown))actions['scroll-down']=()=>this.semanticScroll(false,true);}
    const forward=actions['scroll-down']??actions['scroll-right'],backward=actions['scroll-up']??actions['scroll-left'];if(forward)actions['scroll-forward']=forward;if(backward)actions['scroll-backward']=backward;
    invariant(!this.semanticsLabel||this.semanticsId,'missing-semantics-id','Accessible gestures require stable semanticsId');
    return Object.keys(actions).length||this.semanticsLabel?{id:this.semanticsId??this.generatedId,role:this.semanticsLabel?'button':'group',name:this.semanticsLabel,enabled:this.semanticsEnabled,actions,...(actions.activate?{activate:actions.activate}:{})}:null;
  }
  override collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void{this.semantics=this.semanticsTransport??undefined;super.collectSemantics(output,matrix,clip);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);const gestures:string[]=[];if(this.tap!==null)gestures.push('tap');if(this.longPress!==null)gestures.push('long press');if(this.horizontal!==null)gestures.push('horizontal scroll');if(this.vertical!==null)gestures.push('vertical scroll');if(!gestures.length)gestures.push('<none>');properties.add(new IterableProperty('gestures',gestures));}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){this.tap=null;this.longPress=null;this.horizontal=null;this.vertical=null;this.validActionsValue=null;}}}
}
