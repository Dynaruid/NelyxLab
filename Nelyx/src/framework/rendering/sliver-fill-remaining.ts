// SPDX-License-Identifier: BSD-3-Clause
// Nelyx fill-remaining contract: bounded inner viewport or intrinsic non-scroll content.
import { invariant } from '../../foundation/errors.ts';
import {
  RenderSliverSingleBoxAdapter,
  SliverGeometry,
  SliverPhysicalParentData,
} from './sliver.ts';
import type { SliverConstraints } from './sliver.ts';
import type { RenderBox } from './object.ts';
import { Axis } from '../painting/basic-types.ts';
import { Offset } from '../../ui/offset.ts';
export interface FillRemainingConfiguration {
  readonly hasScrollBody?: boolean;
  readonly fillOverscroll?: boolean;
}
function validate(value: FillRemainingConfiguration): void {
  invariant(
    (value.hasScrollBody === undefined || typeof value.hasScrollBody === 'boolean') &&
      (value.fillOverscroll === undefined || typeof value.fillOverscroll === 'boolean'),
    'invalid-fill-remaining-mode',
    'Fill remaining flags must be boolean',
  );
  invariant(
    !(value.hasScrollBody ?? true) || !value.fillOverscroll,
    'invalid-fill-remaining-mode',
    'Overscroll fill requires a non-scroll body',
  );
}
export class RenderSliverFillRemaining extends RenderSliverSingleBoxAdapter {
  private scrollBody = true;
  private overscroll = false;
  constructor(
    configuration: FillRemainingConfiguration & { readonly child?: RenderBox | null } = {},
  ) {
    validate(configuration);
    super({ child: configuration.child ?? null });
    this.configure(configuration);
  }
  configure(configuration: FillRemainingConfiguration): void {
    this.assertCanMutateLayoutProperty();
    validate(configuration);
    const scroll = configuration.hasScrollBody ?? true,
      over = configuration.fillOverscroll ?? false;
    if (this.scrollBody === scroll && this.overscroll === over) return;
    this.scrollBody = scroll;
    this.overscroll = over;
    this.markNeedsLayout();
  }
  get hasScrollBody(): boolean {
    return this.scrollBody;
  }
  get fillOverscroll(): boolean {
    return this.overscroll;
  }
  protected override performLayout(constraints: SliverConstraints): void {
    const child = this.child,
      extra = this.overscroll ? Math.max(0, -constraints.overlap) : 0;
    let scrollExtent: number, childExtent: number;
    if (this.scrollBody) {
      childExtent = Math.max(
        0,
        constraints.remainingPaintExtent - Math.min(0, constraints.overlap),
      );
      scrollExtent = constraints.viewportMainAxisExtent;
    } else {
      const intrinsic = child
        ? constraints.axis === Axis.vertical
          ? child.getMaxIntrinsicHeight(constraints.crossAxisExtent)
          : child.getMaxIntrinsicWidth(constraints.crossAxisExtent)
        : 0;
      invariant(
        Number.isFinite(intrinsic) && intrinsic >= 0,
        'unbounded-fill-content',
        'Non-scroll fill content requires finite intrinsic extent',
      );
      scrollExtent = Math.max(
        0,
        constraints.viewportMainAxisExtent - constraints.precedingScrollExtent,
        intrinsic,
      );
      childExtent = scrollExtent + extra;
    }
    if (child)
      child.layout(
        constraints.asBoxConstraints({ minExtent: childExtent, maxExtent: childExtent }),
        { parentUsesSize: true },
      );
    const origin = this.overscroll ? Math.min(0, constraints.overlap) : 0,
      painted = Math.min(
        Math.max(0, childExtent - constraints.scrollOffset),
        constraints.remainingPaintExtent - origin,
      );
    this.geometry = new SliverGeometry({
      scrollExtent,
      paintOrigin: origin,
      paintExtent: painted,
      layoutExtent: Math.min(
        painted,
        this.calculatePaintOffset(constraints, { from: 0, to: scrollExtent }),
      ),
      maxPaintExtent: childExtent,
      cacheExtent: this.calculateCacheOffset(constraints, { from: 0, to: scrollExtent }),
      hasVisualOverflow: constraints.scrollOffset > 0 || painted < childExtent,
    });
    if (child) {
      const position = this._getRightWayUp(constraints)
          ? -constraints.scrollOffset
          : painted - childExtent + constraints.scrollOffset,
        data = child.parentData;
      invariant(
        data instanceof SliverPhysicalParentData,
        'invalid-fill-parent-data',
        'Fill child requires physical sliver parent data',
      );
      data.paintOffset =
        constraints.axis === Axis.vertical ? new Offset(0, position) : new Offset(position, 0);
    }
  }
}
