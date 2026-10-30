// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  RenderSliverMultiBoxAdaptor,
  SliverMultiBoxAdaptorParentData,
} from './sliver-multi-box-adaptor.ts';
import type {
  RenderSliverBoxChildManager,
  EstimateMaxScrollOffsetOptions,
} from './sliver-multi-box-adaptor.ts';
import { SliverGeometry, SliverLayoutDimensions } from './sliver.ts';
import type { SliverConstraints, ItemExtentBuilder } from './sliver.ts';
import type { RenderBox } from './object.ts';
import type { BoxConstraints } from './constraints.ts';
import { FoundationBuildMode, precisionErrorTolerance } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';

const dartRound = (value: number): number => (value < 0 ? -Math.round(-value) : Math.round(value));
const maxExtentQueries = 1_000_000;
/** Source fixed/explicit-varied extent algorithms. Extent queries remain
 * source-linear and can be numerous; only actual render children are bounded.
 * A nonterminating extent builder is rejected after a finite query budget. */
export abstract class RenderSliverFixedExtentBoxAdaptor extends RenderSliverMultiBoxAdaptor {
  constructor({ childManager }: { readonly childManager: RenderSliverBoxChildManager }) {
    super({ childManager });
  }
  abstract get itemExtent(): number | null;
  get itemExtentBuilder(): ItemExtentBuilder | null {
    return null;
  }
  private _currentLayoutDimensions: SliverLayoutDimensions | null = null;
  protected indexToLayoutOffset(_deprecatedItemExtent: number, index: number): number {
    const builder = this.itemExtentBuilder;
    if (builder === null) return this.itemExtent! * index;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      invariant(
        i < maxExtentQueries,
        'sliver-extent-query-budget',
        'Explicit extent lookup exceeded its finite query budget',
      );
      const childCount = this.childManager.estimatedChildCount;
      if (childCount !== null && i > childCount - 1) break;
      const extent = builder(i, this.layoutDimensions);
      if (extent === null) break;
      offset += extent;
    }
    return offset;
  }
  protected getMinChildIndexForScrollOffset(
    scrollOffset: number,
    _deprecatedItemExtent: number,
  ): number {
    const builder = this.itemExtentBuilder;
    if (builder !== null) return this._getChildIndexForScrollOffset(scrollOffset, builder);
    const extent = this.itemExtent!;
    if (extent > 0) {
      const actual = scrollOffset / extent,
        round = dartRound(actual);
      if (Math.abs(actual * extent - round * extent) < precisionErrorTolerance) return round;
      return Math.floor(actual);
    }
    return 0;
  }
  protected getMaxChildIndexForScrollOffset(
    scrollOffset: number,
    _deprecatedItemExtent: number,
  ): number {
    const builder = this.itemExtentBuilder;
    if (builder !== null) return this._getChildIndexForScrollOffset(scrollOffset, builder);
    const extent = this.itemExtent!;
    if (extent > 0) {
      const actual = scrollOffset / extent - 1,
        round = dartRound(actual);
      if (Math.abs(actual * extent - round * extent) < precisionErrorTolerance)
        return Math.max(0, round);
      return Math.max(0, Math.ceil(actual));
    }
    return 0;
  }
  protected estimateMaxScrollOffset(
    constraints: SliverConstraints,
    options: EstimateMaxScrollOffsetOptions,
  ): number {
    return this.childManager.estimateMaxScrollOffset(constraints, options);
  }
  protected computeMaxScrollOffset(
    _constraints: SliverConstraints,
    _deprecatedItemExtent: number,
  ): number {
    const builder = this.itemExtentBuilder;
    if (builder === null) return this.childManager.childCount * this.itemExtent!;
    let offset = 0;
    for (let i = 0; i < this.childManager.childCount; i++) {
      invariant(
        i < maxExtentQueries,
        'sliver-extent-query-budget',
        'Explicit extent count exceeded its finite query budget',
      );
      const extent = builder(i, this.layoutDimensions);
      if (extent === null) break;
      offset += extent;
    }
    return offset;
  }
  private _getChildIndexForScrollOffset(scrollOffset: number, callback: ItemExtentBuilder): number {
    if (scrollOffset === 0) return 0;
    let position = 0,
      index = 0;
    while (position < scrollOffset) {
      invariant(
        index < maxExtentQueries,
        'sliver-extent-query-budget',
        'Explicit extent search exceeded its finite query budget',
      );
      const childCount = this.childManager.estimatedChildCount;
      if (childCount !== null && index > childCount - 1) break;
      const extent = callback(index, this.layoutDimensions);
      if (extent === null) break;
      position += extent;
      ++index;
    }
    return index - 1;
  }
  private _getChildConstraints(index: number): BoxConstraints {
    const extent =
      this.itemExtentBuilder === null
        ? this.itemExtent
        : this.itemExtentBuilder(index, this.layoutDimensions);
    invariant(
      extent !== null && Number.isFinite(extent) && extent >= 0,
      'invalid-sliver-item-extent',
      'A materialized child must have a finite nonnegative explicit extent',
    );
    return this.constraints.asBoxConstraints({ minExtent: extent, maxExtent: extent });
  }
  get layoutDimensions(): SliverLayoutDimensions {
    return (
      this._currentLayoutDimensions ??
      new SliverLayoutDimensions({
        scrollOffset: this.constraints.scrollOffset,
        precedingScrollExtent: this.constraints.precedingScrollExtent,
        viewportMainAxisExtent: this.constraints.viewportMainAxisExtent,
        crossAxisExtent: this.constraints.crossAxisExtent,
      })
    );
  }
  protected override paintExtentOf(child: RenderBox): number {
    if (this.itemExtentBuilder === null) return this.itemExtent!;
    const extent = this.itemExtentBuilder(this.indexOf(child), this.layoutDimensions);
    invariant(
      extent !== null,
      'missing-sliver-item-extent',
      'Materialized child must have an explicit extent',
    );
    return extent;
  }
  override debugAssertDoesMeetConstraints(): void {
    super.debugAssertDoesMeetConstraints();
    if (
      FoundationBuildMode.debug &&
      this.itemExtentBuilder === null &&
      Number.isFinite(this.geometry!.scrollExtent)
    ) {
      const extent = this.itemExtent!,
        count = this.geometry!.scrollExtent / extent,
        diff = Math.abs(Math.round(count) - count);
      invariant(
        !(diff * extent > precisionErrorTolerance && diff > precisionErrorTolerance),
        'uneven-fixed-sliver-extent',
        'Fixed sliver scroll extent must be an even multiple of itemExtent',
      );
    }
  }
  protected override performLayout(_constraints: SliverConstraints): void {
    if (FoundationBuildMode.debug) {
      invariant(
        (this.itemExtent !== null && this.itemExtentBuilder === null) ||
          (this.itemExtent === null && this.itemExtentBuilder !== null),
        'invalid-fixed-sliver-extent-source',
        'Exactly one extent source must be present',
      );
      invariant(
        this.itemExtentBuilder !== null ||
          (Number.isFinite(this.itemExtent!) && this.itemExtent! >= 0),
        'invalid-fixed-sliver-extent',
        'Item extent must be finite and nonnegative',
      );
    }
    const constraints = this.constraints;
    this.childManager.didStartLayout();
    this.childManager.setDidUnderflow(false);
    const scrollOffset =
        constraints.scrollOffset +
        (this.childManager.boundedChildren ? 0 : constraints.cacheOrigin),
      remainingExtent = this.childManager.boundedChildren
        ? constraints.remainingPaintExtent
        : constraints.remainingCacheExtent,
      targetEndScrollOffset = scrollOffset + remainingExtent;
    invariant(
      scrollOffset >= 0 && remainingExtent >= 0,
      'invalid-fixed-sliver-cache-range',
      'Scroll cache offset and remaining extent must be nonnegative',
    );
    this._currentLayoutDimensions = new SliverLayoutDimensions({
      scrollOffset: constraints.scrollOffset,
      precedingScrollExtent: constraints.precedingScrollExtent,
      viewportMainAxisExtent: constraints.viewportMainAxisExtent,
      crossAxisExtent: constraints.crossAxisExtent,
    });
    const deprecatedExtraItemExtent = -1,
      prepared = this.childManager.boundedChildren ? this.childManager.preparationIndex : null;
    let firstIndex = this.getMinChildIndexForScrollOffset(scrollOffset, deprecatedExtraItemExtent),
      targetLastIndex = Number.isFinite(targetEndScrollOffset)
        ? this.getMaxChildIndexForScrollOffset(targetEndScrollOffset, deprecatedExtraItemExtent)
        : null;
    if (prepared != null) {
      firstIndex = Math.min(firstIndex, prepared);
      if (targetLastIndex !== null) targetLastIndex = Math.max(targetLastIndex, prepared);
    }
    if (this.firstChild !== null)
      this.collectGarbage(
        this.calculateLeadingGarbage({ firstIndex }),
        targetLastIndex !== null
          ? this.calculateTrailingGarbage({ lastIndex: targetLastIndex })
          : 0,
      );
    else this.collectGarbage(0, 0);
    if (this.firstChild === null) {
      const layoutOffset = this.indexToLayoutOffset(deprecatedExtraItemExtent, firstIndex);
      if (!this.addInitialChild({ index: firstIndex, layoutOffset })) {
        const max =
          firstIndex <= 0 ? 0 : this.computeMaxScrollOffset(constraints, deprecatedExtraItemExtent);
        this.geometry = new SliverGeometry({ scrollExtent: max, maxPaintExtent: max });
        this.childManager.didFinishLayout();
        return;
      }
    }
    let trailingChildWithLayout: RenderBox | null = null;
    for (let index = this.indexOf(this.firstChild!) - 1; index >= firstIndex; --index) {
      const child = this.insertAndLayoutLeadingChild(this._getChildConstraints(index));
      if (child === null) {
        this.geometry = new SliverGeometry({
          scrollOffsetCorrection: this.indexToLayoutOffset(deprecatedExtraItemExtent, index),
        });
        return;
      }
      (child.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = this.indexToLayoutOffset(
        deprecatedExtraItemExtent,
        index,
      );
      trailingChildWithLayout ??= child;
    }
    if (trailingChildWithLayout === null) {
      this.firstChild!.layout(this._getChildConstraints(this.indexOf(this.firstChild!)));
      (this.firstChild!.parentData as SliverMultiBoxAdaptorParentData).layoutOffset =
        this.indexToLayoutOffset(deprecatedExtraItemExtent, firstIndex);
      trailingChildWithLayout = this.firstChild;
    }
    let estimatedMaxScrollOffset = Infinity;
    for (
      let index = this.indexOf(trailingChildWithLayout!) + 1;
      targetLastIndex === null || index <= targetLastIndex;
      ++index
    ) {
      let child = this.childAfter(trailingChildWithLayout!);
      if (child === null || this.indexOf(child) !== index) {
        child = this.insertAndLayoutChild(this._getChildConstraints(index), {
          after: trailingChildWithLayout,
        });
        if (child === null) {
          estimatedMaxScrollOffset = this.indexToLayoutOffset(deprecatedExtraItemExtent, index);
          break;
        }
      } else child.layout(this._getChildConstraints(index));
      trailingChildWithLayout = child;
      (child.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = this.indexToLayoutOffset(
        deprecatedExtraItemExtent,
        this.indexOf(child),
      );
    }
    const lastIndex = this.indexOf(this.lastChild!),
      leadingScrollOffset = this.indexToLayoutOffset(deprecatedExtraItemExtent, firstIndex),
      trailingScrollOffset = this.indexToLayoutOffset(deprecatedExtraItemExtent, lastIndex + 1);
    if (FoundationBuildMode.debug) {
      invariant(
        firstIndex === 0 ||
          this.childScrollOffset(this.firstChild!)! - scrollOffset <= precisionErrorTolerance,
        'invalid-fixed-sliver-leading-offset',
        'Leading child offset must not exceed cache offset',
      );
      this.debugAssertChildListIsNonEmptyAndContiguous();
      invariant(
        this.indexOf(this.firstChild!) === firstIndex &&
          (targetLastIndex === null || lastIndex <= targetLastIndex),
        'invalid-fixed-sliver-index-range',
        'Laid-out children must fit the requested index range',
      );
    }
    estimatedMaxScrollOffset = Math.min(
      estimatedMaxScrollOffset,
      this.estimateMaxScrollOffset(constraints, {
        firstIndex,
        lastIndex,
        leadingScrollOffset,
        trailingScrollOffset,
      }),
    );
    const paintExtent = this.calculatePaintOffset(constraints, {
        from: leadingScrollOffset,
        to: trailingScrollOffset,
      }),
      cacheExtent = this.calculateCacheOffset(constraints, {
        from: leadingScrollOffset,
        to: trailingScrollOffset,
      }),
      targetEndScrollOffsetForPaint = constraints.scrollOffset + constraints.remainingPaintExtent,
      targetLastIndexForPaint = Number.isFinite(targetEndScrollOffsetForPaint)
        ? this.getMaxChildIndexForScrollOffset(
            targetEndScrollOffsetForPaint,
            deprecatedExtraItemExtent,
          )
        : null;
    this.geometry = new SliverGeometry({
      scrollExtent: estimatedMaxScrollOffset,
      paintExtent,
      cacheExtent,
      maxPaintExtent: estimatedMaxScrollOffset,
      hasVisualOverflow:
        (targetLastIndexForPaint !== null && lastIndex >= targetLastIndexForPaint) ||
        constraints.scrollOffset > 0,
    });
    if (estimatedMaxScrollOffset === trailingScrollOffset) this.childManager.setDidUnderflow(true);
    this.childManager.didFinishLayout();
  }
}
export class RenderSliverFixedExtentList extends RenderSliverFixedExtentBoxAdaptor {
  private _itemExtent: number;
  constructor({
    childManager,
    itemExtent,
  }: {
    readonly childManager: RenderSliverBoxChildManager;
    readonly itemExtent: number;
  }) {
    super({ childManager });
    this._itemExtent = itemExtent;
  }
  get itemExtent(): number {
    return this._itemExtent;
  }
  set itemExtent(value: number) {
    this.assertCanMutateLayoutProperty();
    if (this._itemExtent === value) return;
    this._itemExtent = value;
    this.markNeedsLayout();
  }
}
export class RenderSliverVariedExtentList extends RenderSliverFixedExtentBoxAdaptor {
  private _itemExtentBuilder: ItemExtentBuilder;
  constructor({
    childManager,
    itemExtentBuilder,
  }: {
    readonly childManager: RenderSliverBoxChildManager;
    readonly itemExtentBuilder: ItemExtentBuilder;
  }) {
    super({ childManager });
    this._itemExtentBuilder = itemExtentBuilder;
  }
  get itemExtentBuilder(): ItemExtentBuilder {
    return this._itemExtentBuilder;
  }
  set itemExtentBuilder(value: ItemExtentBuilder) {
    this.assertCanMutateLayoutProperty();
    if (this._itemExtentBuilder === value) return;
    this._itemExtentBuilder = value;
    this.markNeedsLayout();
  }
  get itemExtent(): null {
    return null;
  }
}
