// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {DragUpdateDetails,DragEndDetails} from './drag-details.ts';
/** Source extension hooks. Concrete drag consumers override the hooks they use. */
export abstract class Drag {
  update(_details:DragUpdateDetails):void{}
  end(_details:DragEndDetails):void{}
  cancel():void{}
}
