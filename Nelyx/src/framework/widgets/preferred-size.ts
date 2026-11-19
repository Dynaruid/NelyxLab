// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Size } from '../../ui/geometry.ts';
import { StatelessWidget } from './framework.ts';
import type { Widget, WidgetOptions } from './framework.ts';

export interface PreferredSizeWidget extends Widget {
  readonly preferredSize: Size;
}

export interface PreferredSizeOptions extends WidgetOptions {
  readonly preferredSize: Size;
  readonly child: Widget;
}

export class PreferredSize extends StatelessWidget implements PreferredSizeWidget {
  readonly preferredSize: Size;
  readonly child: Widget;

  constructor({ child, preferredSize, key = null }: PreferredSizeOptions) {
    super(key);
    this.preferredSize = preferredSize;
    this.child = child;
  }

  override build(): Widget {
    return this.child;
  }
}
