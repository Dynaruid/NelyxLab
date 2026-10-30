// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  RenderSliverMultiBoxAdaptor,
  SliverMultiBoxAdaptorParentData,
} from './sliver-multi-box-adaptor.ts';
import type { RenderSliverBoxChildManager } from './sliver-multi-box-adaptor.ts';
import { SliverGeometry } from './sliver.ts';
import type { SliverConstraints } from './sliver.ts';
import type { BoxConstraints } from './constraints.ts';
import type { RenderObject, RenderBox } from './object.ts';
import { axisDirectionIsReversed } from '../painting/basic-types.ts';
import { FoundationBuildMode, precisionErrorTolerance } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { protect, modulo, truncateDivide } from '../../ui/value-math.ts';

export interface SliverGridGeometryOptions {
  readonly scrollOffset: number;
  readonly crossAxisOffset: number;
  readonly mainAxisExtent: number;
  readonly crossAxisExtent: number;
}
export class SliverGridGeometry implements SliverGridGeometryOptions {
  readonly scrollOffset: number;
  readonly crossAxisOffset: number;
  readonly mainAxisExtent: number;
  readonly crossAxisExtent: number;
  constructor({
    scrollOffset,
    crossAxisOffset,
    mainAxisExtent,
    crossAxisExtent,
  }: SliverGridGeometryOptions) {
    this.scrollOffset = scrollOffset;
    this.crossAxisOffset = crossAxisOffset;
    this.mainAxisExtent = mainAxisExtent;
    this.crossAxisExtent = crossAxisExtent;
    protect(this, ['scrollOffset', 'crossAxisOffset', 'mainAxisExtent', 'crossAxisExtent']);
  }
  get trailingScrollOffset(): number {
    return this.scrollOffset + this.mainAxisExtent;
  }
  getBoxConstraints(constraints: SliverConstraints): BoxConstraints {
    return constraints.asBoxConstraints({
      minExtent: this.mainAxisExtent,
      maxExtent: this.mainAxisExtent,
      crossAxisExtent: this.crossAxisExtent,
    });
  }
  toString(): string {
    return `SliverGridGeometry(scrollOffset: ${diagnosticDoubleString(this.scrollOffset)}, crossAxisOffset: ${diagnosticDoubleString(this.crossAxisOffset)}, mainAxisExtent: ${diagnosticDoubleString(this.mainAxisExtent)}, crossAxisExtent: ${diagnosticDoubleString(this.crossAxisExtent)})`;
  }
}
export abstract class SliverGridLayout {
  abstract getMinChildIndexForScrollOffset(scrollOffset: number): number;
  abstract getMaxChildIndexForScrollOffset(scrollOffset: number): number;
  abstract getGeometryForChildIndex(index: number): SliverGridGeometry;
  abstract computeMaxScrollOffset(childCount: number): number;
}
export interface SliverGridRegularTileLayoutOptions {
  readonly crossAxisCount: number;
  readonly mainAxisStride: number;
  readonly crossAxisStride: number;
  readonly childMainAxisExtent: number;
  readonly childCrossAxisExtent: number;
  readonly reverseCrossAxis: boolean;
}
export class SliverGridRegularTileLayout
  extends SliverGridLayout
  implements SliverGridRegularTileLayoutOptions
{
  readonly crossAxisCount: number;
  readonly mainAxisStride: number;
  readonly crossAxisStride: number;
  readonly childMainAxisExtent: number;
  readonly childCrossAxisExtent: number;
  readonly reverseCrossAxis: boolean;
  constructor({
    crossAxisCount,
    mainAxisStride,
    crossAxisStride,
    childMainAxisExtent,
    childCrossAxisExtent,
    reverseCrossAxis,
  }: SliverGridRegularTileLayoutOptions) {
    super();
    invariant(
      Number.isSafeInteger(crossAxisCount) && crossAxisCount > 0,
      'invalid-grid-cross-count',
      'Grid cross-axis count must be a positive safe integer',
    );
    if (FoundationBuildMode.debug)
      invariant(
        mainAxisStride >= 0 &&
          crossAxisStride >= 0 &&
          childMainAxisExtent >= 0 &&
          childCrossAxisExtent >= 0,
        'invalid-grid-layout-extents',
        'Grid strides and child extents must be nonnegative',
      );
    this.crossAxisCount = crossAxisCount;
    this.mainAxisStride = mainAxisStride;
    this.crossAxisStride = crossAxisStride;
    this.childMainAxisExtent = childMainAxisExtent;
    this.childCrossAxisExtent = childCrossAxisExtent;
    this.reverseCrossAxis = reverseCrossAxis;
    protect(this, [
      'crossAxisCount',
      'mainAxisStride',
      'crossAxisStride',
      'childMainAxisExtent',
      'childCrossAxisExtent',
      'reverseCrossAxis',
    ]);
  }
  getMinChildIndexForScrollOffset(scrollOffset: number): number {
    return this.mainAxisStride > precisionErrorTolerance
      ? this.crossAxisCount * truncateDivide(scrollOffset, this.mainAxisStride)
      : 0;
  }
  getMaxChildIndexForScrollOffset(scrollOffset: number): number {
    return this.mainAxisStride > 0
      ? Math.max(0, this.crossAxisCount * Math.ceil(scrollOffset / this.mainAxisStride) - 1)
      : 0;
  }
  private _getOffsetFromStartInCrossAxis(start: number): number {
    return this.reverseCrossAxis
      ? this.crossAxisCount * this.crossAxisStride -
          start -
          this.childCrossAxisExtent -
          (this.crossAxisStride - this.childCrossAxisExtent)
      : start;
  }
  getGeometryForChildIndex(index: number): SliverGridGeometry {
    const crossAxisStart = modulo(index, this.crossAxisCount) * this.crossAxisStride;
    return new SliverGridGeometry({
      scrollOffset: truncateDivide(index, this.crossAxisCount) * this.mainAxisStride,
      crossAxisOffset: this._getOffsetFromStartInCrossAxis(crossAxisStart),
      mainAxisExtent: this.childMainAxisExtent,
      crossAxisExtent: this.childCrossAxisExtent,
    });
  }
  computeMaxScrollOffset(childCount: number): number {
    if (childCount === 0) return 0;
    const mainAxisCount = truncateDivide(childCount - 1, this.crossAxisCount) + 1,
      spacing = this.mainAxisStride - this.childMainAxisExtent;
    return this.mainAxisStride * mainAxisCount - spacing;
  }
}
export abstract class SliverGridDelegate {
  abstract getLayout(constraints: SliverConstraints): SliverGridLayout;
  abstract shouldRelayout(oldDelegate: SliverGridDelegate): boolean;
}
export interface SliverGridDelegateOptions {
  readonly mainAxisSpacing?: number;
  readonly crossAxisSpacing?: number;
  readonly childAspectRatio?: number;
  readonly mainAxisExtent?: number | null;
}
export class SliverGridDelegateWithFixedCrossAxisCount extends SliverGridDelegate {
  readonly crossAxisCount: number;
  readonly mainAxisSpacing: number;
  readonly crossAxisSpacing: number;
  readonly childAspectRatio: number;
  readonly mainAxisExtent: number | null;
  constructor({
    crossAxisCount,
    mainAxisSpacing = 0,
    crossAxisSpacing = 0,
    childAspectRatio = 1,
    mainAxisExtent = null,
  }: SliverGridDelegateOptions & { readonly crossAxisCount: number }) {
    super();
    invariant(
      Number.isSafeInteger(crossAxisCount) && crossAxisCount > 0,
      'invalid-grid-cross-count',
      'Grid cross-axis count must be a positive safe integer',
    );
    if (FoundationBuildMode.debug)
      invariant(
        mainAxisSpacing >= 0 &&
          crossAxisSpacing >= 0 &&
          childAspectRatio > 0 &&
          (mainAxisExtent === null || mainAxisExtent >= 0),
        'invalid-grid-delegate',
        'Grid spacing/extent must be nonnegative and aspect ratio positive',
      );
    this.crossAxisCount = crossAxisCount;
    this.mainAxisSpacing = mainAxisSpacing;
    this.crossAxisSpacing = crossAxisSpacing;
    this.childAspectRatio = childAspectRatio;
    this.mainAxisExtent = mainAxisExtent;
    protect(this, [
      'crossAxisCount',
      'mainAxisSpacing',
      'crossAxisSpacing',
      'childAspectRatio',
      'mainAxisExtent',
    ]);
  }
  getLayout(constraints: SliverConstraints): SliverGridLayout {
    if (FoundationBuildMode.debug)
      invariant(
        this.crossAxisCount > 0 &&
          this.mainAxisSpacing >= 0 &&
          this.crossAxisSpacing >= 0 &&
          this.childAspectRatio > 0,
        'invalid-grid-delegate',
        'Invalid fixed-count grid delegate',
      );
    const usable = Math.max(
        0,
        constraints.crossAxisExtent - this.crossAxisSpacing * (this.crossAxisCount - 1),
      ),
      cross = usable / this.crossAxisCount,
      main = this.mainAxisExtent ?? cross / this.childAspectRatio;
    return new SliverGridRegularTileLayout({
      crossAxisCount: this.crossAxisCount,
      mainAxisStride: main + this.mainAxisSpacing,
      crossAxisStride: cross + this.crossAxisSpacing,
      childMainAxisExtent: main,
      childCrossAxisExtent: cross,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    });
  }
  shouldRelayout(oldDelegate: SliverGridDelegate): boolean {
    invariant(
      oldDelegate instanceof SliverGridDelegateWithFixedCrossAxisCount,
      'invalid-covariant-grid-delegate',
      'Fixed-count relayout requires the same delegate type',
    );
    return (
      oldDelegate.crossAxisCount !== this.crossAxisCount ||
      oldDelegate.mainAxisSpacing !== this.mainAxisSpacing ||
      oldDelegate.crossAxisSpacing !== this.crossAxisSpacing ||
      oldDelegate.childAspectRatio !== this.childAspectRatio ||
      oldDelegate.mainAxisExtent !== this.mainAxisExtent
    );
  }
}
export class SliverGridDelegateWithMaxCrossAxisExtent extends SliverGridDelegate {
  readonly maxCrossAxisExtent: number;
  readonly mainAxisSpacing: number;
  readonly crossAxisSpacing: number;
  readonly childAspectRatio: number;
  readonly mainAxisExtent: number | null;
  constructor({
    maxCrossAxisExtent,
    mainAxisSpacing = 0,
    crossAxisSpacing = 0,
    childAspectRatio = 1,
    mainAxisExtent = null,
  }: SliverGridDelegateOptions & { readonly maxCrossAxisExtent: number }) {
    super();
    if (FoundationBuildMode.debug)
      invariant(
        maxCrossAxisExtent > 0 &&
          mainAxisSpacing >= 0 &&
          crossAxisSpacing >= 0 &&
          childAspectRatio > 0 &&
          (mainAxisExtent === null || mainAxisExtent >= 0),
        'invalid-grid-delegate',
        'Grid maximum extent/aspect ratio must be positive and spacing/extent nonnegative',
      );
    this.maxCrossAxisExtent = maxCrossAxisExtent;
    this.mainAxisSpacing = mainAxisSpacing;
    this.crossAxisSpacing = crossAxisSpacing;
    this.childAspectRatio = childAspectRatio;
    this.mainAxisExtent = mainAxisExtent;
    protect(this, [
      'maxCrossAxisExtent',
      'mainAxisSpacing',
      'crossAxisSpacing',
      'childAspectRatio',
      'mainAxisExtent',
    ]);
  }
  getLayout(constraints: SliverConstraints): SliverGridLayout {
    if (FoundationBuildMode.debug)
      invariant(
        constraints.crossAxisExtent > 0 &&
          this.maxCrossAxisExtent > 0 &&
          this.mainAxisSpacing >= 0 &&
          this.crossAxisSpacing >= 0 &&
          this.childAspectRatio > 0,
        'invalid-grid-delegate',
        'Invalid max-extent grid delegate',
      );
    const count = Math.max(
        1,
        Math.ceil(constraints.crossAxisExtent / (this.maxCrossAxisExtent + this.crossAxisSpacing)),
      ),
      usable = Math.max(0, constraints.crossAxisExtent - this.crossAxisSpacing * (count - 1)),
      cross = usable / count,
      main = this.mainAxisExtent ?? cross / this.childAspectRatio;
    return new SliverGridRegularTileLayout({
      crossAxisCount: count,
      mainAxisStride: main + this.mainAxisSpacing,
      crossAxisStride: cross + this.crossAxisSpacing,
      childMainAxisExtent: main,
      childCrossAxisExtent: cross,
      reverseCrossAxis: axisDirectionIsReversed(constraints.crossAxisDirection),
    });
  }
  shouldRelayout(oldDelegate: SliverGridDelegate): boolean {
    invariant(
      oldDelegate instanceof SliverGridDelegateWithMaxCrossAxisExtent,
      'invalid-covariant-grid-delegate',
      'Max-extent relayout requires the same delegate type',
    );
    return (
      oldDelegate.maxCrossAxisExtent !== this.maxCrossAxisExtent ||
      oldDelegate.mainAxisSpacing !== this.mainAxisSpacing ||
      oldDelegate.crossAxisSpacing !== this.crossAxisSpacing ||
      oldDelegate.childAspectRatio !== this.childAspectRatio ||
      oldDelegate.mainAxisExtent !== this.mainAxisExtent
    );
  }
}
export class SliverGridParentData extends SliverMultiBoxAdaptorParentData {
  crossAxisOffset: number | null = null;
  override toString(): string {
    return `crossAxisOffset=${this.crossAxisOffset === null ? 'null' : diagnosticDoubleString(this.crossAxisOffset)}; ${super.toString()}`;
  }
}
export class RenderSliverGrid extends RenderSliverMultiBoxAdaptor {
  private _gridDelegate: SliverGridDelegate;
  constructor({
    childManager,
    gridDelegate,
  }: {
    readonly childManager: RenderSliverBoxChildManager;
    readonly gridDelegate: SliverGridDelegate;
  }) {
    super({ childManager });
    this._gridDelegate = gridDelegate;
  }
  override setupParentData(child: RenderObject): void {
    if (!(child.parentData instanceof SliverGridParentData))
      child.parentData = new SliverGridParentData();
  }
  get gridDelegate(): SliverGridDelegate {
    return this._gridDelegate;
  }
  set gridDelegate(value: SliverGridDelegate) {
    this.assertCanMutateLayoutProperty();
    if (this._gridDelegate === value) return;
    if (
      value.constructor !== this._gridDelegate.constructor ||
      value.shouldRelayout(this._gridDelegate)
    )
      this.markNeedsLayout();
    this._gridDelegate = value;
  }
  override childCrossAxisPosition(child: RenderBox): number {
    const offset = (child.parentData as SliverGridParentData).crossAxisOffset;
    invariant(
      offset !== null,
      'missing-grid-cross-offset',
      'Grid child must have a cross-axis offset',
    );
    return offset;
  }
  protected override performLayout(_constraints: SliverConstraints): void {
    const constraints = this.constraints;
    this.childManager.didStartLayout();
    this.childManager.setDidUnderflow(false);
    const scrollOffset = constraints.scrollOffset + constraints.cacheOrigin,
      remainingExtent = constraints.remainingCacheExtent,
      targetEndScrollOffset = scrollOffset + remainingExtent;
    invariant(
      scrollOffset >= 0 && remainingExtent >= 0,
      'invalid-grid-cache-range',
      'Grid cache offset and extent must be nonnegative',
    );
    const layout = this.gridDelegate.getLayout(constraints),
      firstIndex = layout.getMinChildIndexForScrollOffset(scrollOffset),
      targetLastIndex = Number.isFinite(targetEndScrollOffset)
        ? layout.getMaxChildIndexForScrollOffset(targetEndScrollOffset)
        : null;
    if (this.firstChild !== null)
      this.collectGarbage(
        this.calculateLeadingGarbage({ firstIndex }),
        targetLastIndex === null
          ? 0
          : this.calculateTrailingGarbage({ lastIndex: targetLastIndex }),
      );
    else this.collectGarbage(0, 0);
    const firstGeometry = layout.getGeometryForChildIndex(firstIndex);
    if (
      this.firstChild === null &&
      !this.addInitialChild({ index: firstIndex, layoutOffset: firstGeometry.scrollOffset })
    ) {
      const max = layout.computeMaxScrollOffset(this.childManager.childCount);
      this.geometry = new SliverGeometry({ scrollExtent: max, maxPaintExtent: max });
      this.childManager.didFinishLayout();
      return;
    }
    const leadingScrollOffset = firstGeometry.scrollOffset;
    let trailingScrollOffset = firstGeometry.trailingScrollOffset,
      trailingChildWithLayout: RenderBox | null = null,
      reachedEnd = false;
    for (let index = this.indexOf(this.firstChild!) - 1; index >= firstIndex; --index) {
      const geometry = layout.getGeometryForChildIndex(index),
        child = this.insertAndLayoutLeadingChild(geometry.getBoxConstraints(constraints));
      invariant(
        child !== null,
        'missing-grid-leading-child',
        'Grid layout requires the preceding child',
      );
      const data = child.parentData as SliverGridParentData;
      data.layoutOffset = geometry.scrollOffset;
      data.crossAxisOffset = geometry.crossAxisOffset;
      trailingChildWithLayout ??= child;
      trailingScrollOffset = Math.max(trailingScrollOffset, geometry.trailingScrollOffset);
    }
    if (trailingChildWithLayout === null) {
      this.firstChild!.layout(firstGeometry.getBoxConstraints(constraints));
      const data = this.firstChild!.parentData as SliverGridParentData;
      data.layoutOffset = firstGeometry.scrollOffset;
      data.crossAxisOffset = firstGeometry.crossAxisOffset;
      trailingChildWithLayout = this.firstChild;
    }
    for (
      let index = this.indexOf(trailingChildWithLayout!) + 1;
      targetLastIndex === null || index <= targetLastIndex;
      ++index
    ) {
      const geometry = layout.getGeometryForChildIndex(index),
        childConstraints = geometry.getBoxConstraints(constraints);
      let child = this.childAfter(trailingChildWithLayout!);
      if (child === null || this.indexOf(child) !== index) {
        child = this.insertAndLayoutChild(childConstraints, { after: trailingChildWithLayout });
        if (child === null) {
          reachedEnd = true;
          break;
        }
      } else child.layout(childConstraints);
      trailingChildWithLayout = child;
      const data = child.parentData as SliverGridParentData;
      data.layoutOffset = geometry.scrollOffset;
      data.crossAxisOffset = geometry.crossAxisOffset;
      trailingScrollOffset = Math.max(trailingScrollOffset, geometry.trailingScrollOffset);
    }
    const lastIndex = this.indexOf(this.lastChild!);
    if (FoundationBuildMode.debug) {
      this.debugAssertChildListIsNonEmptyAndContiguous();
      invariant(
        this.indexOf(this.firstChild!) === firstIndex &&
          (targetLastIndex === null || lastIndex <= targetLastIndex),
        'invalid-grid-child-range',
        'Grid child range must match the layout request',
      );
    }
    const estimatedTotalExtent = reachedEnd
      ? trailingScrollOffset
      : this.childManager.estimateMaxScrollOffset(constraints, {
          firstIndex,
          lastIndex,
          leadingScrollOffset,
          trailingScrollOffset,
        });
    const paintExtent = this.calculatePaintOffset(constraints, {
        from: Math.min(constraints.scrollOffset, leadingScrollOffset),
        to: trailingScrollOffset,
      }),
      cacheExtent = this.calculateCacheOffset(constraints, {
        from: leadingScrollOffset,
        to: trailingScrollOffset,
      });
    this.geometry = new SliverGeometry({
      scrollExtent: estimatedTotalExtent,
      paintExtent,
      maxPaintExtent: estimatedTotalExtent,
      cacheExtent,
      hasVisualOverflow:
        estimatedTotalExtent > paintExtent ||
        constraints.scrollOffset > 0 ||
        constraints.overlap !== 0,
    });
    if (estimatedTotalExtent === trailingScrollOffset) this.childManager.setDidUnderflow(true);
    this.childManager.didFinishLayout();
  }
}
