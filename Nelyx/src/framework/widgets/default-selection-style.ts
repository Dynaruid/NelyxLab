// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {InheritedTheme} from './inherited-theme.ts';
import {StatelessWidget} from './framework.ts';
import type {BuildContext,Widget} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import type {MouseCursor} from '../../services/mouse-cursor.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
export interface DefaultSelectionStyleOptions {readonly key?:Key|null;readonly cursorColor?:number|null;readonly selectionColor?:number|null;readonly mouseCursor?:MouseCursor|null;readonly child:Widget}
/** Source inherited selection theme; colors use the existing ARGB host value ABI. */
export class DefaultSelectionStyle extends InheritedTheme {
  static readonly defaultColor=0x80808080;
  readonly cursorColor:number|null;readonly selectionColor:number|null;readonly mouseCursor:MouseCursor|null;
  constructor({key=null,cursorColor=null,selectionColor=null,mouseCursor=null,child}:DefaultSelectionStyleOptions){super(child,key);this.cursorColor=cursorColor;this.selectionColor=selectionColor;this.mouseCursor=mouseCursor;}
  static fallback({key=null}:{readonly key?:Key|null}={}):DefaultSelectionStyle{return new DefaultSelectionStyle({key,child:new NullSelectionStyleWidget()});}
  static of(context:BuildContext):DefaultSelectionStyle{return context.maybeDependOn(DefaultSelectionStyle)??this.fallback();}
  static merge(options:DefaultSelectionStyleOptions):Widget{return new MergedSelectionStyle(options);}
  override wrap(_context:BuildContext,child:Widget):Widget{return new DefaultSelectionStyle({cursorColor:this.cursorColor,selectionColor:this.selectionColor,mouseCursor:this.mouseCursor,child});}
  override updateShouldNotify(old:this):boolean{return this.cursorColor!==old.cursorColor||this.selectionColor!==old.selectionColor||this.mouseCursor!==old.mouseCursor;}
}
class MergedSelectionStyle extends StatelessWidget {
  constructor(readonly options:DefaultSelectionStyleOptions){super();}
  build(context:BuildContext):Widget{const parent=DefaultSelectionStyle.of(context),options=this.options;return new DefaultSelectionStyle({...options,cursorColor:options.cursorColor??parent.cursorColor,selectionColor:options.selectionColor??parent.selectionColor,mouseCursor:options.mouseCursor??parent.mouseCursor});}
}
class NullSelectionStyleWidget extends StatelessWidget {
  build():Widget{throw new FlutterError('A DefaultSelectionStyle constructed with DefaultSelectionStyle.fallback cannot be incorporated into the widget tree, it is meant only to provide a fallback value returned by DefaultSelectionStyle.of() when no enclosing default selection style is present in a BuildContext.');}
}
