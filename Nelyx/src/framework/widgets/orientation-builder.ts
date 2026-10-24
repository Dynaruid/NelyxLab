// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/orientation_builder.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';
import {StatelessWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {LayoutBuilder} from './layout-builder.ts';
/** Source enum literals; no runtime enum values/index/name ABI. */
export type Orientation='portrait'|'landscape';
export type OrientationWidgetBuilder=(context:BuildContext,orientation:Orientation)=>Widget;
export class OrientationBuilder extends StatelessWidget {
  constructor(readonly builder:OrientationWidgetBuilder,options:WidgetOptions={}){super(options.key??null);invariant(typeof builder==='function','invalid-orientation-builder','A synchronous builder is required');}
  build(_context?:BuildContext):Widget{return new LayoutBuilder((context,constraints)=>this.builder(context,constraints.maxWidth>constraints.maxHeight?'landscape':'portrait'));}
}
