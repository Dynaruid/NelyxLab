// SPDX-License-Identifier: BSD-3-Clause
// Nelyx persistent header contract on the shared Flutter-derived sliver/layout callback pipeline.
import { invariant } from '../../foundation/errors.ts';
import {
  RenderSliverSingleBoxAdapter,
  SliverGeometry,
  SliverPhysicalParentData,
} from './sliver.ts';
import type { SliverConstraints } from './sliver.ts';
import type { Constraints } from './constraints.ts';
import type { RenderBox, RenderObject } from './object.ts';
import { RenderObjectWithLayoutCallbackMixin } from './layout-callback.ts';
import { Axis } from '../painting/basic-types.ts';
import { Offset } from '../../ui/offset.ts';

export interface PersistentHeaderLayoutInfo {
  readonly constraints: SliverConstraints;
  readonly shrinkOffset: number;
  readonly overlapsContent: boolean;
}
export interface PersistentHeaderConfiguration {
  readonly minExtent: number;
  readonly maxExtent: number;
  readonly pinned?: boolean;
  readonly floating?: boolean;
}
function validate(value: PersistentHeaderConfiguration): void {
  invariant(
    Number.isFinite(value.minExtent) &&
      value.minExtent >= 0 &&
      Number.isFinite(value.maxExtent) &&
      value.maxExtent >= value.minExtent,
    'invalid-header-extents',
    'Header extents must be finite and 0 <= minExtent <= maxExtent',
  );
  invariant(
    (value.pinned === undefined || typeof value.pinned === 'boolean') &&
      (value.floating === undefined || typeof value.floating === 'boolean'),
    'invalid-header-mode',
    'Header modes must be booleans',
  );
}
/** Child fills the exact current header extent; floating reveals on decreasing logical offsets (including programmatic moves), with no implicit snap timer. */
export class RenderSliverPersistentHeader extends RenderObjectWithLayoutCallbackMixin(
  RenderSliverSingleBoxAdapter,
) {
  private minimum = 0;
  private maximum = 0;
  private pinnedHeader = false;
  private floatingHeader = false;
  private callback: ((constraints: Constraints) => void) | null = null;
  private info: PersistentHeaderLayoutInfo | undefined;
  private previousOffset: number | null = null;
  private effectiveOffset = 0;
  private previousAxis: unknown;
  private previousGrowth: unknown;
  private childPosition = 0;
  constructor(
    configuration: PersistentHeaderConfiguration & { readonly child?: RenderBox | null },
  ) {
    validate(configuration);
    super({ child: configuration.child ?? null });
    this.configure(configuration);
  }
  configure(configuration: PersistentHeaderConfiguration): void {
    this.assertCanMutateLayoutProperty();
    validate(configuration);
    const pinned = configuration.pinned ?? false,
      floating = configuration.floating ?? false;
    if (
      this.minimum === configuration.minExtent &&
      this.maximum === configuration.maxExtent &&
      this.pinnedHeader === pinned &&
      this.floatingHeader === floating
    )
      return;
    if (this.pinnedHeader !== pinned || this.floatingHeader !== floating)
      this.previousOffset = null;
    this.minimum = configuration.minExtent;
    this.maximum = configuration.maxExtent;
    this.pinnedHeader = pinned;
    this.floatingHeader = floating;
    this.markNeedsLayout();
  }
  get minExtent(): number {
    return this.minimum;
  }
  get maxExtent(): number {
    return this.maximum;
  }
  get pinned(): boolean {
    return this.pinnedHeader;
  }
  get floating(): boolean {
    return this.floatingHeader;
  }
  /** @internal Shared AbstractLayoutBuilder protocol; no rendering-to-widget dependency. */
  _updateCallback(value: ((constraints: Constraints) => void) | null): void {
    if (this.callback === value) return;
    this.callback = value;
    if (value) this.scheduleLayoutCallback();
  }
  layoutCallback(): void {
    this.callback?.(this.constraints);
  }
  get layoutInfo(): PersistentHeaderLayoutInfo {
    invariant(this.info, 'unlaid-header', 'Header layout info requires actual layout');
    return this.info;
  }
  protected override childMainAxisPosition(_child: RenderBox): number {
    return this.childPosition;
  }
  override childScrollOffset(child: RenderObject): number {
    invariant(
      child === this.child && child.parent === this && this.hasLayoutConstraints,
      'invalid-header-child',
      'Header reveal requires its actual laid-out child',
    );
    // A collapsing/floating child moves inside scroll space; zero would reveal the header's original origin.
    return this.geometry?.visible
      ? this.constraints.scrollOffset + this.childPosition
      : Math.max(0, this.maximum - this.minimum);
  }
  protected override performLayout(constraints: SliverConstraints): void {
    const offset = constraints.scrollOffset,
      identityChanged =
        this.previousAxis !== constraints.axisDirection ||
        this.previousGrowth !== constraints.growthDirection;
    let effective = offset;
    if (this.floatingHeader && !identityChanged && this.previousOffset !== null) {
      const delta = offset - this.previousOffset;
      effective = this.effectiveOffset;
      if (delta < 0)
        effective =
          Math.min(effective, this.maximum - (this.pinnedHeader ? this.minimum : 0)) + delta;
      else if (delta > 0) effective += delta;
      effective = Math.max(0, Math.min(offset, effective));
    }
    this.previousOffset = offset;
    this.effectiveOffset = effective;
    this.previousAxis = constraints.axisDirection;
    this.previousGrowth = constraints.growthDirection;
    const extent = Math.max(this.minimum, this.maximum - Math.min(effective, this.maximum)),
      overlaps =
        constraints.overlap > 0 ||
        (this.floatingHeader && effective < offset) ||
        (this.pinnedHeader && offset > this.maximum - this.minimum);
    this.info = Object.freeze({
      constraints,
      shrinkOffset: Math.min(effective, this.maximum),
      overlapsContent: overlaps,
    });
    if (this.callback) this.runLayoutCallback();
    const child = this.child;
    if (child)
      child.layout(constraints.asBoxConstraints({ minExtent: extent, maxExtent: extent }), {
        parentUsesSize: true,
      });
    const origin = this.pinnedHeader
        ? Math.min(constraints.remainingPaintExtent, Math.max(0, constraints.overlap))
        : Math.min(0, constraints.overlap),
      available = Math.max(0, constraints.remainingPaintExtent - origin);
    const painted = Math.min(
      available,
      this.pinnedHeader ? extent : Math.max(0, this.maximum - effective),
    );
    this.geometry = new SliverGeometry({
      scrollExtent: this.maximum,
      paintOrigin: origin,
      paintExtent: painted,
      layoutExtent: Math.min(painted, Math.max(0, this.maximum - offset)),
      maxPaintExtent: this.maximum,
      maxScrollObstructionExtent: this.pinnedHeader ? this.minimum : 0,
      hitTestExtent: painted,
      cacheExtent: this.calculateCacheOffset(constraints, { from: 0, to: this.maximum }),
      hasVisualOverflow: offset > 0 || painted < extent,
    });
    this.childPosition = this.pinnedHeader ? 0 : Math.min(0, painted - extent);
    if (child) {
      const physical = this._getRightWayUp(constraints)
          ? this.childPosition
          : painted - extent - this.childPosition,
        data = child.parentData;
      invariant(
        data instanceof SliverPhysicalParentData,
        'invalid-header-parent-data',
        'Header child requires physical sliver parent data',
      );
      const next =
        constraints.axis === Axis.vertical ? new Offset(0, physical) : new Offset(physical, 0);
      if (!data.paintOffset.equals(next)) {
        data.paintOffset = next;
        child.markNeedsSemanticsUpdate();
      }
    }
  }
}
