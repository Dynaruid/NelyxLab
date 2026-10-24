// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded upstream pin.
import {Alignment} from '../painting/alignment.ts';import type {AlignmentGeometry} from '../painting/alignment.ts';import type {BoxFit} from '../painting/box-fit.ts';import type {Clip} from '../../ui/clip.ts';import {RenderFittedBox} from '../rendering/fitted-box.ts';import type {RenderBox} from '../rendering/object.ts';import {RenderObjectWidget,SingleChildRenderObjectElement} from './framework.ts';import type {BuildContext,Widget,WidgetOptions} from './framework.ts';import {Directionality} from './app-data.ts';
export interface FittedBoxOptions extends WidgetOptions {readonly fit?:BoxFit;readonly alignment?:AlignmentGeometry;readonly clipBehavior?:Clip}
export class FittedBox extends RenderObjectWidget {
  readonly childWidgets:readonly Widget[];readonly fit:BoxFit;readonly alignment:AlignmentGeometry;readonly clipBehavior:Clip;
  constructor(child?:Widget,{key=null,fit='contain',alignment=Alignment.center,clipBehavior='none'}:FittedBoxOptions={}){super(key);this.childWidgets=Object.freeze(child?[child]:[]);this.fit=fit;this.alignment=alignment;this.clipBehavior=clipBehavior;}
  get child():Widget|undefined{return this.childWidgets[0];}
  override createElement():SingleChildRenderObjectElement{return new SingleChildRenderObjectElement(this);}
  createRenderObject(context:BuildContext):RenderFittedBox{return new RenderFittedBox({fit:this.fit,alignment:this.alignment,textDirection:context.maybeDependOn(Directionality)?.direction??null,clipBehavior:this.clipBehavior});}
  override updateRenderObject(context:BuildContext,render:RenderBox):void{const box=render as RenderFittedBox;box.fit=this.fit;box.alignment=this.alignment;box.textDirection=context.maybeDependOn(Directionality)?.direction??null;box.clipBehavior=this.clipBehavior;}
}
