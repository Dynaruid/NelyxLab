// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/desktop_text_selection_toolbar_layout_delegate.dart; SHA256 026363587d7411c1488761105e68147bf41093dd48b769b68b33c983812a5876
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
import { protect } from '../../ui/value-math.ts';
import type { Size } from '../../ui/geometry.ts';
export class DesktopTextSelectionToolbarLayoutDelegate extends SingleChildLayoutDelegate {
  readonly anchor: Offset;
  constructor({ anchor }: { readonly anchor: Offset }) {
    super();
    this.anchor = anchor;
    protect(this, ['anchor']);
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.loosen();
  }
  override getPositionForChild(size: Size, childSize: Size): Offset {
    const overhang: Offset = new Offset(
      this.anchor.dx + childSize.width - size.width,
      this.anchor.dy + childSize.height - size.height,
    );
    return new Offset(
      overhang.dx > 0 ? this.anchor.dx - overhang.dx : this.anchor.dx,
      overhang.dy > 0 ? this.anchor.dy - overhang.dy : this.anchor.dy,
    );
  }
  override shouldRelayout(oldDelegate: DesktopTextSelectionToolbarLayoutDelegate): boolean {
    return !this.anchor.equals(oldDelegate.anchor);
  }
}
registerNativeSingleChildLayout(
  DesktopTextSelectionToolbarLayoutDelegate.prototype,
  (delegate, children) => {
    const b = new NativeLayoutBuilder();
    b.assert(expr('finite', input.maxWidth));
    b.assert(expr('finite', input.maxHeight));
    if (children) {
      const child = b.child(0, [0, input.maxWidth, 0, input.maxHeight]);
      const x = expr('min', delegate.anchor.dx, expr('subtract', input.maxWidth, child.width));
      const y = expr('min', delegate.anchor.dy, expr('subtract', input.maxHeight, child.height));
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
