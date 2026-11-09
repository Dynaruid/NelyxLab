// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  SingleChildLayoutDelegate,
  registerNativeSingleChildLayout,
} from '../rendering/custom-layout.ts';
import {
  NativeLayoutBuilder,
  nativeLayoutExpression as expr,
  nativeLayoutInput as input,
} from '../rendering/native-layout.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { Offset } from '../../ui/offset.ts';
import type { Size } from '../../ui/geometry.ts';
export class TextSelectionToolbarLayoutDelegate extends SingleChildLayoutDelegate {
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly fitsAbove: boolean | null;
  constructor({
    anchorAbove,
    anchorBelow,
    fitsAbove = null,
  }: {
    readonly anchorAbove: Offset;
    readonly anchorBelow: Offset;
    readonly fitsAbove?: boolean | null;
  }) {
    super();
    this.anchorAbove = anchorAbove;
    this.anchorBelow = anchorBelow;
    this.fitsAbove = fitsAbove;
  }
  static centerOn(position: number, width: number, max: number): number {
    if (position - width / 2 < 0) return 0;
    if (position + width / 2 > max) return max - width;
    return position - width / 2;
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.loosen();
  }
  override getPositionForChild(size: Size, childSize: Size): Offset {
    const above = this.fitsAbove ?? this.anchorAbove.dy >= childSize.height,
      anchor = above ? this.anchorAbove : this.anchorBelow;
    return new Offset(
      TextSelectionToolbarLayoutDelegate.centerOn(anchor.dx, childSize.width, size.width),
      above ? Math.max(0, anchor.dy - childSize.height) : anchor.dy,
    );
  }
  override shouldRelayout(old: SingleChildLayoutDelegate): boolean {
    return (
      !(old instanceof TextSelectionToolbarLayoutDelegate) ||
      !old.anchorAbove.equals(this.anchorAbove) ||
      !old.anchorBelow.equals(this.anchorBelow) ||
      old.fitsAbove !== this.fitsAbove
    );
  }
}
registerNativeSingleChildLayout(
  TextSelectionToolbarLayoutDelegate.prototype,
  (delegate, children) => {
    const b = new NativeLayoutBuilder();
    b.assert(expr('finite', input.maxWidth));
    b.assert(expr('finite', input.maxHeight));
    if (children) {
      const child = b.child(0, [0, input.maxWidth, 0, input.maxHeight]);
      const above =
        delegate.fitsAbove === null
          ? expr('greaterEqual', delegate.anchorAbove.dy, child.height)
          : Number(delegate.fitsAbove);
      const anchorX = expr('select', above, delegate.anchorAbove.dx, delegate.anchorBelow.dx);
      const half = expr('divide', child.width, 2);
      const x = expr(
        'select',
        expr('less', expr('subtract', anchorX, half), 0),
        0,
        expr(
          'select',
          expr('greater', expr('add', anchorX, half), input.maxWidth),
          expr('subtract', input.maxWidth, child.width),
          expr('subtract', anchorX, half),
        ),
      );
      const y = expr(
        'select',
        above,
        expr('max', 0, expr('subtract', delegate.anchorAbove.dy, child.height)),
        delegate.anchorBelow.dy,
      );
      b.place(0, x, y);
      b.baseline(
        expr('add', child.baseline, y),
        child.hasBaseline,
        expr('add', child.ideographicBaseline, y),
        child.hasIdeographicBaseline,
      );
    }
    b.size(input.maxWidth, input.maxHeight);
    const intrinsic = [{ kind: 'result' as const, values: [0] }];
    return {
      children,
      layout: b.commands,
      minWidth: intrinsic,
      maxWidth: intrinsic,
      minHeight: intrinsic,
      maxHeight: intrinsic,
    };
  },
);
