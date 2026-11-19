// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/material/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import type { RawMenuOverlayInfo } from '@nelyx/core/framework/widgets/raw-menu-anchor';
import type { Size } from '@nelyx/core/ui/geometry';
import type { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import type { TextDirection } from '@nelyx/core/ui/typography';

export class MenuPanelLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly info: RawMenuOverlayInfo,
    readonly alignment: AlignmentGeometry,
    readonly adjustment: Offset,
    readonly direction: TextDirection,
    readonly insets: EdgeInsets,
    readonly avoided: readonly Rect[],
    readonly limits: BoxConstraints,
    readonly anchoredWidth: boolean,
    readonly nested: boolean,
    readonly heightFactor: number,
  ) {
    super();
  }

  private allowedRegion(size: Size): Rect {
    const area = this.insets.deflateRect(Rect.fromLTWH(0, 0, size.width, size.height));
    const available = Rect.fromLTRB(
      area.left,
      area.top,
      Math.max(area.left, area.right),
      Math.max(area.top, area.bottom),
    );
    const center = this.info.anchorRect.center;
    let nearest = available;
    let distance = Infinity;
    for (const screen of DisplayFeatureSubScreen.subScreensInBounds(available, this.avoided)) {
      const dx = Math.max(screen.left - center.dx, 0, center.dx - screen.right);
      const dy = Math.max(screen.top - center.dy, 0, center.dy - screen.bottom);
      const candidate = Math.hypot(dx, dy);
      if (candidate < distance) {
        distance = candidate;
        nearest = screen;
      }
    }
    return nearest;
  }

  override getConstraintsForChild(parent: BoxConstraints): BoxConstraints {
    const region = this.allowedRegion(parent.biggest);
    const bounds = this.limits.enforce(BoxConstraints.loose(region.size));
    if (!this.anchoredWidth) return bounds;
    return bounds.copyWith({ minWidth: bounds.constrainWidth(this.info.anchorRect.width) });
  }

  override getPositionForChild(size: Size, child: Size): { x: number; y: number } {
    const region = this.allowedRegion(size);
    const { anchorRect: anchor, position } = this.info;
    const ltr = this.direction === 'ltr';
    const preferred = this.alignment.resolve(this.direction).withinRect(anchor);
    const dx =
      this.alignment instanceof AlignmentDirectional && !ltr
        ? -this.adjustment.dx
        : this.adjustment.dx;
    const expandedHeight =
      this.heightFactor > 0.01
        ? Math.min(child.height / this.heightFactor, region.height)
        : child.height;
    const right = Math.max(region.left, region.right - child.width);
    const bottom = Math.max(region.top, region.bottom - expandedHeight);
    let x = position ? anchor.left + position.dx : preferred.dx + dx - (ltr ? 0 : child.width);
    let y = position ? anchor.top + position.dy : preferred.dy + this.adjustment.dy;
    if (this.nested && !position) {
      const after = anchor.right + this.adjustment.dx;
      const before = anchor.left - child.width - this.adjustment.dx;
      if (x < region.left && after <= right) x = after;
      else if (x > right && before >= region.left) x = before;
    }
    if (y < region.top && anchor.bottom <= bottom) {
      y = anchor.bottom;
    } else if (y > bottom && anchor.top - expandedHeight >= region.top) {
      y = anchor.top - expandedHeight - (!this.nested && !position ? this.adjustment.dy : 0);
    }
    y = Math.max(region.top, Math.min(bottom, y));
    if (!position && y + expandedHeight <= anchor.center.dy) y += expandedHeight - child.height;
    return { x: Math.max(region.left, Math.min(right, x)), y };
  }

  override shouldRelayout(old: MenuPanelLayout): boolean {
    return (
      this.info !== old.info ||
      this.alignment !== old.alignment ||
      this.adjustment !== old.adjustment ||
      this.direction !== old.direction ||
      !this.insets.equals(old.insets) ||
      this.avoided !== old.avoided ||
      !this.limits.equals(old.limits) ||
      this.anchoredWidth !== old.anchoredWidth ||
      this.nested !== old.nested ||
      this.heightFactor !== old.heightFactor
    );
  }
}
