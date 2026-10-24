// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../../foundation/errors.ts';
import type {State,BuildContext} from './framework.ts';
/** Releases its State reference when disposed, including while a key/deferred load is pending. */
export class DisposableBuildContext<T extends State=State> {
  private state:T|null;
  constructor(state:T){invariant(state.mounted,'unmounted-image-context','DisposableBuildContext needs a mounted State');this.state=state;}
  get context():BuildContext|null{invariant(this.state===null||this.state.mounted,'disposed-image-context','The State was disposed before its DisposableBuildContext');return this.state?.context??null;}
  dispose():void{this.state=null;}
}
