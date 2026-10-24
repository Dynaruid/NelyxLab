// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import type {Clip} from '../../ui/clip.ts';
import type {Rect} from '../../ui/types.ts';
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {CustomClipper,RenderClipRect,RenderClipRRect,RenderClipOval,RenderClipPath} from '../rendering/clip.ts';
import type {Path} from '../../ui/path.ts';
import type {RoundedClip} from '../rendering/clip.ts';
import type {RRect} from '../../ui/rrect.ts';
import {BorderRadius,BorderRadiusGeometry} from '../painting/border-radius.ts';
import {Directionality} from './app-data.ts';
import type {RenderObject} from '../rendering/object.ts';
export interface ClipOptions<T> extends WidgetOptions {readonly clipper?:CustomClipper<T>|null;readonly clipBehavior?:Clip}
function options<T>(value:ClipOptions<T>):void{invariant(Object.keys(value).every(key=>['key','clipper','clipBehavior'].includes(key)),'unsupported-clip','Unknown clip widget option');invariant(value.clipper==null||value.clipper instanceof CustomClipper,'invalid-clipper','Clipper must extend CustomClipper');invariant(value.clipBehavior===undefined||['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(value.clipBehavior),'invalid-clip','Unknown clip behavior');}
export class ClipRect extends SingleChildRenderObjectWidget {
  readonly clipper:CustomClipper<Rect>|null;readonly clipBehavior:Clip;
  constructor(child?:Widget,configuration:ClipOptions<Rect>={}){super(child,configuration);options(configuration);this.clipper=configuration.clipper??null;this.clipBehavior=configuration.clipBehavior??'hardEdge';}
  createRenderObject(_context:BuildContext):RenderClipRect{return new RenderClipRect({clipper:this.clipper,clipBehavior:this.clipBehavior});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderClipRect,'invalid-clip-render','ClipRect requires RenderClipRect');render.clipper=this.clipper;render.clipBehavior=this.clipBehavior;}
  override didUnmountRenderObject(render:RenderObject):void{invariant(render instanceof RenderClipRect,'invalid-clip-render','ClipRect requires RenderClipRect');render.clipper=null;}
}
export interface ClipRRectOptions extends ClipOptions<RRect|RoundedClip> {readonly borderRadius?:number|BorderRadiusGeometry}
export class ClipRRect extends SingleChildRenderObjectWidget {
  readonly clipper:CustomClipper<RRect|RoundedClip>|null;readonly clipBehavior:Clip;readonly borderRadius:number|BorderRadiusGeometry;
  constructor(child?:Widget,configuration:ClipRRectOptions={}){super(child,configuration);const {borderRadius=BorderRadius.zero,...base}=configuration;options(base);invariant(borderRadius instanceof BorderRadiusGeometry||typeof borderRadius==='number'&&Number.isFinite(borderRadius)&&Number.isFinite(Math.fround(borderRadius))&&borderRadius>=0,'invalid-clip-radius','ClipRRect requires BorderRadiusGeometry or a legacy uniform radius');this.clipper=configuration.clipper??null;this.clipBehavior=configuration.clipBehavior??'antiAlias';this.borderRadius=borderRadius;}
  createRenderObject(context:BuildContext):RenderClipRRect{return new RenderClipRRect({clipper:this.clipper,clipBehavior:this.clipBehavior,borderRadius:this.borderRadius,textDirection:context.maybeDependOn(Directionality)?.direction??null});}
  updateRenderObject(context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderClipRRect,'invalid-clip-render','ClipRRect requires RenderClipRRect');render.clipper=this.clipper;render.clipBehavior=this.clipBehavior;render.borderRadius=this.borderRadius;render.textDirection=context.maybeDependOn(Directionality)?.direction??null;}
}
export class ClipOval extends SingleChildRenderObjectWidget {
  readonly clipper:CustomClipper<Rect>|null;readonly clipBehavior:Clip;
  constructor(child?:Widget,configuration:ClipOptions<Rect>={}){super(child,configuration);options(configuration);this.clipper=configuration.clipper??null;this.clipBehavior=configuration.clipBehavior??'antiAlias';}
  createRenderObject(_context:BuildContext):RenderClipOval{return new RenderClipOval({clipper:this.clipper,clipBehavior:this.clipBehavior});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderClipOval,'invalid-clip-render','ClipOval requires RenderClipOval');render.clipper=this.clipper;render.clipBehavior=this.clipBehavior;}
  override didUnmountRenderObject(render:RenderObject):void{invariant(render instanceof RenderClipOval,'invalid-clip-render','ClipOval requires RenderClipOval');render.clipper=null;}
}
export class ClipPath extends SingleChildRenderObjectWidget {
  readonly clipper:CustomClipper<Path>|null;readonly clipBehavior:Clip;
  constructor(child?:Widget,configuration:ClipOptions<Path>={}){super(child,configuration);options(configuration);this.clipper=configuration.clipper??null;this.clipBehavior=configuration.clipBehavior??'antiAlias';}
  createRenderObject(context:BuildContext):RenderClipPath{return new RenderClipPath({clipper:this.clipper,clipBehavior:this.clipBehavior,...(context.services.paths?{paths:context.services.paths}:{})});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderClipPath,'invalid-clip-render','ClipPath requires RenderClipPath');render.clipper=this.clipper;render.clipBehavior=this.clipBehavior;}
  override didUnmountRenderObject(render:RenderObject):void{invariant(render instanceof RenderClipPath,'invalid-clip-render','ClipPath requires RenderClipPath');render.clipper=null;}
}
