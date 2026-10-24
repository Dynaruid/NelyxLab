// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded pin.
import {Offset as OffsetValue} from '../../ui/offset.ts';import type {Offset} from '../../ui/geometry.ts';import {RenderFractionalTranslation} from '../rendering/fractional-translation.ts';import type {RenderBox} from '../rendering/object.ts';import {SingleChildRenderObjectWidget} from './framework.ts';import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
export interface FractionalTranslationOptions extends WidgetOptions {readonly translation:Offset;readonly transformHitTests?:boolean}
export class FractionalTranslation extends SingleChildRenderObjectWidget {
  readonly translation:OffsetValue;readonly transformHitTests:boolean;
  constructor(child:Widget|undefined,{key=null,translation,transformHitTests=true}:FractionalTranslationOptions){super(child,{key});this.translation=translation instanceof OffsetValue?translation:new OffsetValue(translation.x,translation.y);this.transformHitTests=transformHitTests;}
  createRenderObject(_context?:BuildContext):RenderFractionalTranslation{return new RenderFractionalTranslation({translation:this.translation,transformHitTests:this.transformHitTests});}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{const box=render as RenderFractionalTranslation;box.translation=this.translation;box.transformHitTests=this.transformHitTests;}
}
