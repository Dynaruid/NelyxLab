// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded upstream pin.
import {invariant} from '../../foundation/errors.ts';import {RenderRotatedBox} from '../rendering/rotated-box.ts';import type {RenderBox} from '../rendering/object.ts';import {RenderObjectWidget,SingleChildRenderObjectElement} from './framework.ts';import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
export interface RotatedBoxOptions extends WidgetOptions {readonly quarterTurns:number}
export class RotatedBox extends RenderObjectWidget {
  readonly childWidgets:readonly Widget[];readonly quarterTurns:number;
  constructor(child:Widget|undefined,{key=null,quarterTurns}:RotatedBoxOptions){invariant(Number.isSafeInteger(quarterTurns),'invalid-quarter-turns','Quarter turns must be a safe integer');super(key);this.childWidgets=Object.freeze(child?[child]:[]);this.quarterTurns=quarterTurns===0?0:quarterTurns;}
  get child():Widget|undefined{return this.childWidgets[0];}
  override createElement():SingleChildRenderObjectElement{return new SingleChildRenderObjectElement(this);}
  createRenderObject(_context?:BuildContext):RenderRotatedBox{return new RenderRotatedBox({quarterTurns:this.quarterTurns});}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{(render as RenderRotatedBox).quarterTurns=this.quarterTurns;}
}
