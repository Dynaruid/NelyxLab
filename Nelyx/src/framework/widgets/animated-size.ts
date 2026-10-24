// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatefulWidget,SingleChildRenderObjectWidget} from './framework.ts';import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {SingleTickerProviderStateMixin} from './ticker-provider.ts';import type {TickerProvider} from '../animation/ticker.ts';
import {RenderAnimatedSize} from '../rendering/animated-size.ts';import type {RenderObject} from '../rendering/object.ts';
import {Alignment} from '../painting/alignment.ts';import type {AlignmentGeometry} from '../painting/alignment.ts';
import {Curves} from '../animation/curves.ts';import type {Curve} from '../animation/curves.ts';import type {Clip} from '../../ui/clip.ts';import {Directionality} from './app-data.ts';
export interface AnimatedSizeOptions extends WidgetOptions {readonly duration:number;readonly reverseDuration?:number|null;readonly child?:Widget|null;readonly alignment?:AlignmentGeometry;readonly curve?:Curve;readonly clipBehavior?:Clip;readonly onEnd?:(()=>void)|null}
export class AnimatedSize extends StatefulWidget {
  readonly duration:number;readonly reverseDuration:number|null;readonly child:Widget|null;readonly alignment:AlignmentGeometry;readonly curve:Curve;readonly clipBehavior:Clip;readonly onEnd:(()=>void)|null;
  constructor({key=null,duration,reverseDuration=null,child=null,alignment=Alignment.center,curve=Curves.linear,clipBehavior='hardEdge',onEnd=null}:AnimatedSizeOptions){super(key);this.duration=duration;this.reverseDuration=reverseDuration;this.child=child;this.alignment=alignment;this.curve=curve;this.clipBehavior=clipBehavior;this.onEnd=onEnd;}
  createState():AnimatedSizeState{return new AnimatedSizeState();}
}
class AnimatedSizeState extends SingleTickerProviderStateMixin<AnimatedSize>{build():Widget{return new AnimatedSizeRenderWidget(this.widget,this);}}
class AnimatedSizeRenderWidget extends SingleChildRenderObjectWidget {
  constructor(readonly configuration:AnimatedSize,readonly vsync:TickerProvider){super(configuration.child??undefined);}
  createRenderObject(context:BuildContext):RenderAnimatedSize{const c=this.configuration;return new RenderAnimatedSize({duration:c.duration,reverseDuration:c.reverseDuration,alignment:c.alignment,curve:c.curve,clipBehavior:c.clipBehavior,onEnd:c.onEnd,vsync:this.vsync,textDirection:Directionality.maybeOf(context)});}
  updateRenderObject(context:BuildContext,render:RenderObject):void{if(!(render instanceof RenderAnimatedSize))throw new Error('Wrong AnimatedSize renderer');const c=this.configuration;render.alignment=c.alignment;render.duration=c.duration;render.reverseDuration=c.reverseDuration;render.curve=c.curve;render.vsync=this.vsync;render.textDirection=Directionality.maybeOf(context);render.clipBehavior=c.clipBehavior;render.onEnd=c.onEnd;}
}
