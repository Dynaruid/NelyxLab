// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/grid_tile.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Positioned, Stack } from '@nelyx/core/framework/widgets/basic';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';

export interface GridTileOptions extends WidgetOptions {
  readonly child: Widget;
  readonly header?: Widget | null;
  readonly footer?: Widget | null;
}

export class GridTile extends StatelessWidget {
  readonly child: Widget;
  readonly header: Widget | null;
  readonly footer: Widget | null;

  constructor({ child, header = null, footer = null, key = null }: GridTileOptions) {
    super(key);
    this.child = child;
    this.header = header;
    this.footer = footer;
  }

  override build(): Widget {
    if (!this.header && !this.footer) return this.child;
    return new Stack([
      Positioned.fill(this.child),
      ...(this.header ? [new Positioned(this.header, { top: 0, left: 0, right: 0 })] : []),
      ...(this.footer ? [new Positioned(this.footer, { bottom: 0, left: 0, right: 0 })] : []),
    ]);
  }
}
