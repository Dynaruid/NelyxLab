// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/desktop_text_selection_toolbar_layout_delegate.dart; SHA256 026363587d7411c1488761105e68147bf41093dd48b769b68b33c983812a5876
import { SingleChildLayoutDelegate } from '../rendering/custom-layout.ts';
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
