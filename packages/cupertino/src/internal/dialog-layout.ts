// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/dialog.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  ColoredBox,
  Column,
  Positioned,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import {
  MultiChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { ScrollUpdateNotification } from '@nelyx/core/framework/widgets/scroll-notification';
import type { Size } from '@nelyx/core/ui/geometry';

export const dialogDividerThickness = 0.3;

export function dialogDivider(color: number): Widget {
  return new SizedBox(dialogDividerThickness, dialogDividerThickness, new ColoredBox({ color }));
}

export class DialogActionsLayout extends MultiChildRenderObjectWidget {
  override createRenderObject(context: BuildContext): RenderDialogActionsLayout {
    return new RenderDialogActionsLayout(Directionality.of(context));
  }

  override updateRenderObject(context: BuildContext, render: RenderDialogActionsLayout): void {
    render.configure(Directionality.of(context));
  }
}

class RenderDialogActionsLayout extends RenderBox {
  constructor(private direction: 'ltr' | 'rtl') {
    super();
  }

  configure(direction: 'ltr' | 'rtl'): void {
    if (this.direction === direction) return;
    this.direction = direction;
    this.markNeedsLayout();
  }

  private horizontal(width: number): boolean {
    const slot = (width - dialogDividerThickness) / 2;
    return (
      this.children.length === 3 &&
      slot >= 0 &&
      this.children[0]!.getMaxIntrinsicWidth(Infinity) <= slot &&
      this.children[2]!.getMaxIntrinsicWidth(Infinity) <= slot
    );
  }

  private intrinsicHeight(
    width: number,
    measure: (child: RenderBox, width: number) => number,
  ): number {
    const children = this.children as readonly RenderBox[];
    if (this.horizontal(width)) {
      const slot = (width - dialogDividerThickness) / 2;
      return Math.max(measure(children[0]!, slot), measure(children[2]!, slot));
    }
    return children.reduce((height, child) => height + measure(child, width), 0);
  }

  protected override computeMinIntrinsicHeight(width: number): number {
    return this.intrinsicHeight(width, (child, w) => child.getMinIntrinsicHeight(w));
  }

  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.intrinsicHeight(width, (child, w) => child.getMaxIntrinsicHeight(w));
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return constraints.constrain({
      width: constraints.maxWidth,
      height: this.getMinIntrinsicHeight(constraints.maxWidth),
    });
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    const width = constraints.maxWidth;
    invariant(Number.isFinite(width), 'dialog-actions-width', 'Dialog actions need bounded width');
    const children = this.children as readonly RenderBox[];
    if (this.horizontal(width)) {
      const slot = (width - dialogDividerThickness) / 2;
      const size = this.getDryLayout(constraints);
      for (const [index, child] of children.entries()) {
        const childWidth = index === 1 ? dialogDividerThickness : slot;
        child.layout(BoxConstraints.tightFor(childWidth, size.height), { parentUsesSize: true });
        const start = index === 0 ? 0 : index === 1 ? slot : slot + dialogDividerThickness;
        child.layoutOffset = {
          x: this.direction === 'ltr' ? start : width - start - childWidth,
          y: 0,
        };
      }
      return size;
    }
    const rowConstraints = new BoxConstraints(width, width);
    let y = 0;
    for (const child of children) {
      child.layout(rowConstraints, { parentUsesSize: true });
      child.layoutOffset = { x: 0, y };
      y += child.size.height;
    }
    return constraints.constrain({ width, height: y });
  }
}

export class PriorityDialogColumn extends MultiChildRenderObjectWidget {
  constructor(
    top: Widget,
    bottom: Widget,
    readonly bottomMinHeight: number,
  ) {
    super([top, bottom]);
  }

  override createRenderObject(): RenderPriorityDialogColumn {
    return new RenderPriorityDialogColumn(this.bottomMinHeight);
  }

  override updateRenderObject(_context: BuildContext, render: RenderPriorityDialogColumn): void {
    render.configure(this.bottomMinHeight);
  }
}

class RenderPriorityDialogColumn extends RenderBox {
  constructor(private bottomMinHeight: number) {
    super();
  }

  protected override get childCountLimit(): number {
    return 2;
  }

  configure(bottomMinHeight: number): void {
    if (this.bottomMinHeight === bottomMinHeight) return;
    this.bottomMinHeight = bottomMinHeight;
    this.markNeedsLayout();
  }

  private heights(width: number, limit: number): { readonly top: number; readonly bottom: number } {
    const [top, bottom] = this.children as readonly [RenderBox, RenderBox];
    const topIntrinsic = top.getMinIntrinsicHeight(width);
    const bottomIntrinsic = bottom.getMinIntrinsicHeight(width);
    if (topIntrinsic + bottomIntrinsic <= limit)
      return { top: topIntrinsic, bottom: bottomIntrinsic };
    const reserve = Math.min(this.bottomMinHeight, bottomIntrinsic);
    const topHeight = Math.min(topIntrinsic, Math.max(0, limit - reserve));
    return { top: topHeight, bottom: Math.min(bottomIntrinsic, limit - topHeight) };
  }

  protected override computeMinIntrinsicHeight(width: number): number {
    const [top, bottom] = this.children as readonly [RenderBox, RenderBox];
    return top.getMinIntrinsicHeight(width) + bottom.getMinIntrinsicHeight(width);
  }

  protected override computeMaxIntrinsicHeight(width: number): number {
    const [top, bottom] = this.children as readonly [RenderBox, RenderBox];
    return top.getMaxIntrinsicHeight(width) + bottom.getMaxIntrinsicHeight(width);
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    const width = constraints.maxWidth;
    const height = this.heights(width, constraints.maxHeight);
    return constraints.constrain({ width, height: height.top + height.bottom });
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    const width = constraints.maxWidth;
    invariant(
      Number.isFinite(width),
      'dialog-column-width',
      'Dialog sections require finite width',
    );
    const [top, bottom] = this.children as readonly [RenderBox, RenderBox];
    const height = this.heights(width, constraints.maxHeight);
    top.layout(BoxConstraints.tightFor(width, height.top), { parentUsesSize: true });
    bottom.layout(BoxConstraints.tightFor(width, height.bottom), { parentUsesSize: true });
    top.layoutOffset = { x: 0, y: 0 };
    bottom.layoutOffset = { x: 0, y: height.top };
    return constraints.constrain({ width, height: height.top + height.bottom });
  }
}

export class DialogOverscrollBackground extends StatefulWidget {
  constructor(
    readonly color: number,
    readonly child: Widget,
  ) {
    super();
  }
  override createState(): State<DialogOverscrollBackground> {
    return new DialogOverscrollBackgroundState();
  }
}

class DialogOverscrollBackgroundState extends State<DialogOverscrollBackground> {
  private top = 0;
  private bottom = 0;

  private readonly onScroll = (notification: ScrollUpdateNotification): boolean => {
    if (notification.depth !== 0) return false;
    const { pixels, minScrollExtent, maxScrollExtent, viewportDimension } = notification.metrics;
    const top = Math.min(viewportDimension, Math.max(0, minScrollExtent - pixels));
    const bottom = Math.min(viewportDimension, Math.max(0, pixels - maxScrollExtent));
    if (top !== this.top || bottom !== this.bottom)
      this.setState(() => {
        this.top = top;
        this.bottom = bottom;
      });
    return false;
  };

  override build(): Widget {
    const color = this.widget.color;
    return new Stack([
      Positioned.fill(
        new Column(
          [
            new SizedBox(undefined, this.top, new ColoredBox({ color })),
            new SizedBox(undefined, this.bottom, new ColoredBox({ color })),
          ],
          { mainAxisAlignment: 'spaceBetween', crossAlign: 'stretch' },
        ),
      ),
      new NotificationListener({
        child: this.widget.child,
        notificationType: ScrollUpdateNotification,
        onNotification: this.onScroll,
      }),
    ]);
  }
}
