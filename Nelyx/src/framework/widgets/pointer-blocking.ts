// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded pin.
import {RenderIgnorePointer,RenderAbsorbPointer} from '../rendering/pointer-blocking.ts';import type {RenderBox} from '../rendering/object.ts';import {SingleChildRenderObjectWidget} from './framework.ts';import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
export interface IgnorePointerOptions extends WidgetOptions {readonly ignoring?:boolean}
export class IgnorePointer extends SingleChildRenderObjectWidget {
  readonly ignoring:boolean;
  constructor(child?:Widget,{key=null,ignoring=true}:IgnorePointerOptions={}){super(child,{key});this.ignoring=ignoring;}
  createRenderObject(_context?:BuildContext):RenderIgnorePointer{return new RenderIgnorePointer({ignoring:this.ignoring});}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{(render as RenderIgnorePointer).ignoring=this.ignoring;}
}
export interface AbsorbPointerOptions extends WidgetOptions {readonly absorbing?:boolean}
export class AbsorbPointer extends SingleChildRenderObjectWidget {
  readonly absorbing:boolean;
  constructor(child?:Widget,{key=null,absorbing=true}:AbsorbPointerOptions={}){super(child,{key});this.absorbing=absorbing;}
  createRenderObject(_context?:BuildContext):RenderAbsorbPointer{return new RenderAbsorbPointer({absorbing:this.absorbing});}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{(render as RenderAbsorbPointer).absorbing=this.absorbing;}
}
