// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Internal shared inherited protocol for Visibility and IndexedStack.
import {InheritedWidget} from './framework.ts';
import type {Widget} from './framework.ts';
export class _VisibilityScope extends InheritedWidget {
  constructor(readonly isVisible:boolean,child:Widget){super(child);}
  override updateShouldNotify(old:this):boolean{return this.isVisible!==old.isVisible;}
}
