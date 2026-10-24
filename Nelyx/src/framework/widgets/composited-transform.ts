// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../../foundation/errors.ts';
import {LayerLink} from '../rendering/layer.ts';
import {RenderLeaderLayer,RenderFollowerLayer} from '../rendering/proxy-layer.ts';
import {Alignment} from '../painting/alignment.ts';
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import type {RenderObject} from '../rendering/object.ts';
import type {Offset} from '../../ui/geometry.ts';
export interface CompositedTransformTargetOptions extends WidgetOptions {readonly link:LayerLink}
export class CompositedTransformTarget extends SingleChildRenderObjectWidget {
  readonly link:LayerLink;
  constructor(child:Widget|undefined,options:CompositedTransformTargetOptions){super(child,options);invariant(options.link instanceof LayerLink,'invalid-layer-link','Expected LayerLink');this.link=options.link;}
  createRenderObject():RenderLeaderLayer{return new RenderLeaderLayer({link:this.link});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderLeaderLayer,'invalid-leader-render','Target requires RenderLeaderLayer');render.link=this.link;}
}
export interface CompositedTransformFollowerOptions extends WidgetOptions {readonly link:LayerLink;readonly showWhenUnlinked?:boolean;readonly offset?:Offset;readonly targetAnchor?:Alignment;readonly followerAnchor?:Alignment}
export class CompositedTransformFollower extends SingleChildRenderObjectWidget {
  readonly link:LayerLink;readonly showWhenUnlinked:boolean;readonly offset:Offset;readonly targetAnchor:Alignment;readonly followerAnchor:Alignment;
  constructor(child:Widget|undefined,options:CompositedTransformFollowerOptions){super(child,options);invariant(options.link instanceof LayerLink,'invalid-layer-link','Expected LayerLink');invariant(options.showWhenUnlinked===undefined||typeof options.showWhenUnlinked==='boolean','invalid-follower-visibility','Expected boolean visibility');const offset=options.offset??{x:0,y:0};invariant([offset.x,offset.y].every(Number.isFinite),'invalid-follower-offset','Follower offset must be finite');this.link=options.link;this.showWhenUnlinked=options.showWhenUnlinked??true;this.offset=Object.freeze({x:offset.x,y:offset.y});this.targetAnchor=options.targetAnchor??Alignment.topLeft;this.followerAnchor=options.followerAnchor??Alignment.topLeft;invariant(this.targetAnchor instanceof Alignment&&this.followerAnchor instanceof Alignment,'invalid-follower-anchor','Expected physical Alignment anchors');}
  createRenderObject():RenderFollowerLayer{return new RenderFollowerLayer({link:this.link,showWhenUnlinked:this.showWhenUnlinked,offset:this.offset,leaderAnchor:this.targetAnchor,followerAnchor:this.followerAnchor});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderFollowerLayer,'invalid-follower-render','Follower requires RenderFollowerLayer');render.link=this.link;render.showWhenUnlinked=this.showWhenUnlinked;render.offset=this.offset;render.leaderAnchor=this.targetAnchor;render.followerAnchor=this.followerAnchor;}
}
