// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned proxy_box.dart leader/follower render objects.
import {invariant} from '../../foundation/errors.ts';
import {RenderProxyBox} from './boxes.ts';
import {LayerHandle,LayerLink,LeaderLayer,FollowerLayer} from './layer.ts';
import {RenderBox} from './object.ts';
import type {RenderObject,HitTestEntry} from './object.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {BoxConstraints} from './constraints.ts';
import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';
import {identity,multiply,inversePaintTransform,transform} from '../../ui/geometry.ts';
import {matrix4Identity} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import {Alignment} from '../painting/alignment.ts';
import type {Rect,SemanticsNode} from '../../ui/types.ts';
function link(value:LayerLink):LayerLink{invariant(value instanceof LayerLink,'invalid-layer-link','Expected LayerLink');return value;}
function offset(value:Offset):Offset{invariant(value&&[value.x,value.y].every(Number.isFinite),'invalid-follower-offset','Follower offset must be finite');return Object.freeze({x:value.x,y:value.y});}
function anchor(value:Alignment):Alignment{invariant(value instanceof Alignment,'invalid-follower-anchor','Follower anchors require physical Alignment');return value;}
export class RenderLeaderLayer extends RenderProxyBox {
  private connection:LayerLink;
  private previousLayoutSize:Size|null=null;
  private readonly retained=new LayerHandle<LeaderLayer>();
  constructor(options:{readonly link:LayerLink;readonly child?:RenderBox<RenderObject>}){super();this.connection=link(options.link);if(options.child)this.child=options.child;}
  get link():LayerLink{return this.connection;}
  set link(value:LayerLink){this.assertCanMutateLayoutProperty();const next=link(value);if(next===this.connection)return;this.connection.leaderSize=null;this.connection=next;if(this.previousLayoutSize)next.leaderSize=this.previousLayoutSize;this.markNeedsPaint();}
  get layer():LeaderLayer|null{return this.retained.layer;}
  get alwaysNeedsCompositing():boolean{return true;}
  protected override performLayout(constraints:BoxConstraints):Size{const size=super.performLayout(constraints);this.previousLayoutSize=size;this.connection.leaderSize=size;return size;}
  override paint(context:PaintingContext):void{const layer=this.retained.layer??new LeaderLayer({link:this.connection}),hold=new LayerHandle(layer);try{layer.link=this.connection;layer.offset={x:0,y:0};context.pushLayer(layer,childContext=>super.paint(childContext),{x:0,y:0},this.paintBounds);this.retained.layer=layer;}finally{hold.dispose();}}
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
export interface RenderFollowerLayerOptions {readonly link:LayerLink;readonly showWhenUnlinked?:boolean;readonly offset?:Offset;readonly leaderAnchor?:Alignment;readonly followerAnchor?:Alignment;readonly child?:RenderBox<RenderObject>}
export class RenderFollowerLayer extends RenderProxyBox {
  private connection:LayerLink;
  private showing:boolean;
  private displacement:Offset;
  private leaderPoint:Alignment;
  private followerPoint:Alignment;
  private readonly retained=new LayerHandle<FollowerLayer>();
  private stopObservingComposition:(()=>void)|null=null;
  private observedCompositionLayer:FollowerLayer|null=null;
  private semanticsTransform:Matrix4Storage|null|undefined;
  private semanticsVisible:boolean|undefined;
  private observeComposition(layer:FollowerLayer):void{
    this.observedCompositionLayer=layer;
    this.stopObservingComposition=layer.addCompositionCallback(()=>{
      if(!this.attached||!layer.attached||this.retained.layer!==layer)return;
      const transform=layer.getLastTransform(),visible=this.connection.leader!==null||this.showing,previous=this.semanticsTransform;
      const same=previous===transform||previous!==undefined&&previous!==null&&transform!==null&&previous.every((value,index)=>Object.is(value,transform[index]));
      if(same&&this.semanticsVisible===visible)return;
      this.semanticsTransform=transform;this.semanticsVisible=visible;
      // A retained follower can move when only its leader repaints. Its own
      // render subtree then has no layout/paint invalidation, but source
      // semantics must use the transform just established by composition.
      this.markNeedsSemanticsUpdate();
    });
  }
  private stopCompositionObservation():void{this.stopObservingComposition?.();this.stopObservingComposition=null;this.observedCompositionLayer=null;this.semanticsTransform=undefined;this.semanticsVisible=undefined;}
  constructor(options:RenderFollowerLayerOptions){super();this.connection=link(options.link);invariant(options.showWhenUnlinked===undefined||typeof options.showWhenUnlinked==='boolean','invalid-follower-visibility','Expected boolean visibility');this.showing=options.showWhenUnlinked??true;this.displacement=offset(options.offset??{x:0,y:0});this.leaderPoint=anchor(options.leaderAnchor??Alignment.topLeft);this.followerPoint=anchor(options.followerAnchor??Alignment.topLeft);if(options.child)this.child=options.child;}
  get link():LayerLink{return this.connection;}
  set link(value:LayerLink){this.assertCanMutateLayoutProperty();const next=link(value);if(next!==this.connection){this.connection=next;this.markNeedsPaint();}}
  get showWhenUnlinked():boolean{return this.showing;}
  set showWhenUnlinked(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-follower-visibility','Expected boolean visibility');if(value!==this.showing){this.showing=value;this.markNeedsPaint();}}
  // Parent layout writes layoutOffset; this source property is the displacement from the leader.
  override get offset():Offset{return this.displacement;}
  override set offset(value:Offset){this.assertCanMutateLayoutProperty();const next=offset(value);if(next.x!==this.displacement.x||next.y!==this.displacement.y){this.displacement=next;this.markNeedsPaint();}}
  get leaderAnchor():Alignment{return this.leaderPoint;}
  set leaderAnchor(value:Alignment){this.assertCanMutateLayoutProperty();const next=anchor(value);if(!next.equals(this.leaderPoint)){this.leaderPoint=next;this.markNeedsPaint();}}
  get followerAnchor():Alignment{return this.followerPoint;}
  set followerAnchor(value:Alignment){this.assertCanMutateLayoutProperty();const next=anchor(value);if(!next.equals(this.followerPoint)){this.followerPoint=next;this.markNeedsPaint();}}
  get layer():FollowerLayer|null{return this.retained.layer;}
  get alwaysNeedsCompositing():boolean{return true;}
  getCurrentTransform():Matrix4Storage{return this.retained.layer?.getLastTransform()??matrix4Identity;}
  protected override childTransform(child:RenderObject):TransformMatrix{return multiply(this.getCurrentTransform(),super.childTransform(child));}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{
    if(!this.connection.leader&&!this.showing)return false;
    for(const child of [...this.children].reverse()){const inverse=inversePaintTransform(this.childTransform(child));if(inverse&&child instanceof RenderBox&&child.hitTest(transform(inverse,position),result,multiply(inverse,toLocal)))return true;}
    return false;
  }
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(this.connection.leader||this.showing)super.visitChildrenForSemantics(visitor);}
  override collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void{if(this.connection.leader||this.showing)super.collectSemantics(output,matrix,clip);}
  override paint(context:PaintingContext):void{
    const size=this.connection.leaderSize;
    invariant(size!==null||this.connection.leader===null||this.leaderPoint.equals(Alignment.topLeft),'missing-leader-size','Leader anchor requires its laid-out size');
    const leader=size?this.leaderPoint.alongSize(size):{x:0,y:0},follower=size?this.followerPoint.alongSize(this.size):{x:0,y:0},effective={x:leader.x-follower.x+this.displacement.x,y:leader.y-follower.y+this.displacement.y};
    const layer=this.retained.layer??new FollowerLayer({link:this.connection}),hold=new LayerHandle(layer);
    // The layer applies the composed follower transform; child recording uses only parent layout.
    try{if(this.observedCompositionLayer!==layer){this.stopCompositionObservation();this.observeComposition(layer);}layer.link=this.connection;layer.showWhenUnlinked=this.showing;layer.linkedOffset=effective;layer.unlinkedOffset={x:0,y:0};context.pushLayer(layer,childContext=>{for(const child of this.children)childContext.paintChild(child,super.childTransform(child));},{x:0,y:0},this.paintBounds);this.retained.layer=layer;}finally{if(this.retained.layer!==layer&&this.observedCompositionLayer===layer)this.stopCompositionObservation();hold.dispose();}
  }
  override detach():void{try{super.detach();}finally{if(!this.attached){this.stopCompositionObservation();this.retained.dispose();}}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){this.stopCompositionObservation();this.retained.dispose();}}}
}
