// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/basic.dart at the recorded pin.
import { RenderOffstage } from '../rendering/offstage.ts';
import type { RenderBox } from '../rendering/object.ts';
import { SingleChildRenderObjectWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
export interface OffstageOptions extends WidgetOptions {
  readonly offstage?: boolean;
}
export class Offstage extends SingleChildRenderObjectWidget {
  readonly offstage: boolean;
  constructor(child?: Widget, { key = null, offstage = true }: OffstageOptions = {}) {
    super(child, { key });
    this.offstage = offstage;
  }
  createRenderObject(_context?: BuildContext): RenderOffstage {
    return new RenderOffstage({ offstage: this.offstage });
  }
  override updateRenderObject(_context: BuildContext, render: RenderBox): void {
    (render as RenderOffstage).offstage = this.offstage;
  }
}
