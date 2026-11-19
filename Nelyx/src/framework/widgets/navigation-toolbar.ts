// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Size } from '../../ui/geometry.ts';
import type { TextDirection } from '../../ui/typography.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { MultiChildLayoutDelegate } from '../rendering/custom-layout.ts';
import { Directionality } from './app-data.ts';
import { CustomMultiChildLayout, LayoutId } from './custom-layout.ts';
import { StatelessWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';

export interface NavigationToolbarOptions extends WidgetOptions {
  readonly leading?: Widget | null;
  readonly middle?: Widget | null;
  readonly trailing?: Widget | null;
  readonly centerMiddle?: boolean;
  readonly middleSpacing?: number;
}

export class NavigationToolbar extends StatelessWidget {
  static readonly kMiddleSpacing = 16;
  readonly leading: Widget | null;
  readonly middle: Widget | null;
  readonly trailing: Widget | null;
  readonly centerMiddle: boolean;
  readonly middleSpacing: number;

  constructor({
    key = null,
    leading = null,
    middle = null,
    trailing = null,
    centerMiddle = true,
    middleSpacing = NavigationToolbar.kMiddleSpacing,
  }: NavigationToolbarOptions = {}) {
    super(key);
    this.leading = leading;
    this.middle = middle;
    this.trailing = trailing;
    this.centerMiddle = centerMiddle;
    this.middleSpacing = middleSpacing;
  }

  override build(context: BuildContext): Widget {
    const children: LayoutId[] = [];
    if (this.leading) children.push(new LayoutId(this.leading, 'leading'));
    if (this.middle) children.push(new LayoutId(this.middle, 'middle'));
    if (this.trailing) children.push(new LayoutId(this.trailing, 'trailing'));
    return new CustomMultiChildLayout(
      children,
      new ToolbarLayout(this.centerMiddle, this.middleSpacing, Directionality.of(context)),
    );
  }
}

class ToolbarLayout extends MultiChildLayoutDelegate {
  constructor(
    readonly centerMiddle: boolean,
    readonly middleSpacing: number,
    readonly direction: TextDirection,
  ) {
    super();
  }

  override performLayout({ width, height }: Size): void {
    const rtl = this.direction === 'rtl';
    let leadingWidth = 0;
    let trailingWidth = 0;
    if (this.hasChild('leading')) {
      leadingWidth = this.layoutChild(
        'leading',
        new BoxConstraints(0, width, height, height),
      ).width;
      this.positionChild('leading', { x: rtl ? width - leadingWidth : 0, y: 0 });
    }
    if (this.hasChild('trailing')) {
      const trailing = this.layoutChild('trailing', BoxConstraints.loose({ width, height }));
      trailingWidth = trailing.width;
      this.positionChild('trailing', {
        x: rtl ? 0 : width - trailingWidth,
        y: (height - trailing.height) / 2,
      });
    }
    if (this.hasChild('middle')) {
      const maxWidth = Math.max(0, width - leadingWidth - trailingWidth - 2 * this.middleSpacing);
      const middle = this.layoutChild('middle', new BoxConstraints(0, maxWidth, 0, height));
      const margin = leadingWidth + this.middleSpacing;
      let start = margin;
      if (this.centerMiddle) {
        start = (width - middle.width) / 2;
        if (start + middle.width > width - trailingWidth)
          start = width - trailingWidth - middle.width - this.middleSpacing;
        else start = Math.max(start, margin);
      }
      this.positionChild('middle', {
        x: rtl ? width - middle.width - start : start,
        y: (height - middle.height) / 2,
      });
    }
  }

  override shouldRelayout(old: ToolbarLayout): boolean {
    return (
      old.centerMiddle !== this.centerMiddle ||
      old.middleSpacing !== this.middleSpacing ||
      old.direction !== this.direction
    );
  }
}
