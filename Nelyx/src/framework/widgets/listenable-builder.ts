// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// ListenableBuilder from pinned widgets/transitions.dart; positional constructor retained.
import type {Listenable} from '../../foundation/notifier.ts';
import type {Key} from '../../foundation/key.ts';
import {AnimatedWidget} from './animated-widget.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {protect} from '../../ui/value-math.ts';
export type TransitionBuilder=(context:BuildContext,child:Widget|null)=>Widget;
export interface ListenableBuilderOptions extends WidgetOptions {readonly listenable:Listenable;readonly builder:TransitionBuilder;readonly child?:Widget|null}
export class ListenableBuilder extends AnimatedWidget {
  readonly builder:TransitionBuilder;readonly child:Widget|null;
  constructor(options:ListenableBuilderOptions);
  constructor(listenable:Listenable,builder:(context:BuildContext)=>Widget,key?:Key|null);
  constructor(value:Listenable|ListenableBuilderOptions,builder?:((context:BuildContext)=>Widget),key:Key|null=null){
    const options:ListenableBuilderOptions=builder===undefined?value as ListenableBuilderOptions:{listenable:value as Listenable,builder,key};
    super(options);this.builder=options.builder;this.child=options.child??null;protect(this,['builder','child']);
  }
  build(context:BuildContext):Widget{return this.builder(context,this.child);}
}
