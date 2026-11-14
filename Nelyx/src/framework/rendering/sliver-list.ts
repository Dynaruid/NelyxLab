// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  RenderSliverMultiBoxAdaptor,
  SliverMultiBoxAdaptorParentData,
} from './sliver-multi-box-adaptor.ts';
import type { RenderSliverBoxChildManager } from './sliver-multi-box-adaptor.ts';
import { SliverGeometry } from './sliver.ts';
import type { SliverConstraints } from './sliver.ts';
import type { RenderBox } from './object.ts';
import { FoundationBuildMode, precisionErrorTolerance } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';

/** Source dead-reckoning list layout. Long seeks still measure intermediate
 * rows; streaming garbage collection bounds active render nodes. The lazy
 * manager may retire detached local subtrees between streaming batches, while
 * GlobalKey subtrees retain the source end-of-frame retake semantics. */
export class RenderSliverList extends RenderSliverMultiBoxAdaptor {
  private streamingRetirement = false;
  /** @internal The real widget manager uses this scope for local owner retirement. */
  override get _retireInactiveChildrenDuringLayout(): boolean {
    return this.streamingRetirement || super._retireInactiveChildrenDuringLayout;
  }
  private collectStreamingGarbage(leading: number, trailing: number): void {
    this.streamingRetirement = true;
    try {
      this.collectGarbage(leading, trailing);
    } finally {
      this.streamingRetirement = false;
    }
  }
  constructor({ childManager }: { readonly childManager: RenderSliverBoxChildManager }) {
    super({ childManager });
  }
  protected override performLayout(_constraints: SliverConstraints): void {
    const constraints = this.constraints;
    this.childManager.didStartLayout();
    this.childManager.setDidUnderflow(false);
    const scrollOffset = constraints.scrollOffset + constraints.cacheOrigin,
      remainingExtent = constraints.remainingCacheExtent,
      targetEndScrollOffset = scrollOffset + remainingExtent,
      childConstraints = constraints.asBoxConstraints();
    invariant(
      scrollOffset >= 0 && remainingExtent >= 0,
      'invalid-list-cache-range',
      'List cache offset and extent must be nonnegative',
    );
    let leadingGarbage = 0,
      trailingGarbage = 0,
      reachedEnd = false;
    if (this.firstChild === null && !this.addInitialChild()) {
      this.geometry = SliverGeometry.zero;
      this.childManager.didFinishLayout();
      return;
    }
    let leadingChildWithLayout: RenderBox | null = null,
      trailingChildWithLayout: RenderBox | null = null,
      earliestUsefulChild = this.firstChild;
    if (this.childScrollOffset(this.firstChild!) === null) {
      let leadingChildrenWithoutLayoutOffset = 0;
      while (earliestUsefulChild !== null && this.childScrollOffset(earliestUsefulChild) === null) {
        earliestUsefulChild = this.childAfter(earliestUsefulChild);
        leadingChildrenWithoutLayoutOffset++;
      }
      this.collectGarbage(leadingChildrenWithoutLayoutOffset, 0);
      if (this.firstChild === null && !this.addInitialChild()) {
        this.geometry = SliverGeometry.zero;
        this.childManager.didFinishLayout();
        return;
      }
    }
    earliestUsefulChild = this.firstChild;
    for (
      let earliestScrollOffset = this.childScrollOffset(earliestUsefulChild!)!;
      earliestScrollOffset > scrollOffset;
      earliestScrollOffset = this.childScrollOffset(earliestUsefulChild!)!
    ) {
      // Only measured children beyond the new cache range can retire here.
      // Retain the current first child as the dead-reckoning anchor; preserving
      // in-range children also preserves their State during small reverse moves.
      let offCacheTrailing = 0,
        walker = this.lastChild;
      while (walker !== null && walker !== this.firstChild) {
        const offset = this.childScrollOffset(walker);
        if (offset === null || offset < targetEndScrollOffset) break;
        offCacheTrailing++;
        walker = this.childBefore(walker);
      }
      if (offCacheTrailing > 0) {
        this.collectStreamingGarbage(0, offCacheTrailing);
        if ((trailingChildWithLayout as RenderBox | null)?.parent !== this)
          trailingChildWithLayout = null;
      }
      earliestUsefulChild = this.insertAndLayoutLeadingChild(childConstraints, {
        parentUsesSize: true,
      });
      if (earliestUsefulChild === null) {
        (this.firstChild!.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = 0;
        if (scrollOffset === 0) {
          this.firstChild!.layout(childConstraints, { parentUsesSize: true });
          earliestUsefulChild = this.firstChild;
          leadingChildWithLayout = earliestUsefulChild;
          trailingChildWithLayout ??= earliestUsefulChild;
          break;
        }
        this.geometry = new SliverGeometry({ scrollOffsetCorrection: -scrollOffset });
        return;
      }
      const firstChildScrollOffset = earliestScrollOffset - this.paintExtentOf(this.firstChild!);
      if (firstChildScrollOffset < -precisionErrorTolerance) {
        this.geometry = new SliverGeometry({ scrollOffsetCorrection: -firstChildScrollOffset });
        (this.firstChild!.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = 0;
        return;
      }
      (earliestUsefulChild.parentData as SliverMultiBoxAdaptorParentData).layoutOffset =
        firstChildScrollOffset;
      leadingChildWithLayout = earliestUsefulChild;
      trailingChildWithLayout ??= earliestUsefulChild;
    }
    if (FoundationBuildMode.debug)
      invariant(
        this.childScrollOffset(this.firstChild!)! > -precisionErrorTolerance,
        'negative-list-leading-offset',
        'First list child offset must be nonnegative within tolerance',
      );
    if (scrollOffset < precisionErrorTolerance) {
      while (this.indexOf(this.firstChild!) > 0) {
        const earliestScrollOffset = this.childScrollOffset(this.firstChild!)!;
        earliestUsefulChild = this.insertAndLayoutLeadingChild(childConstraints, {
          parentUsesSize: true,
        });
        invariant(
          earliestUsefulChild !== null,
          'missing-list-leading-child',
          'Source zero-offset recovery requires its preceding child',
        );
        const firstChildScrollOffset = earliestScrollOffset - this.paintExtentOf(this.firstChild!);
        (this.firstChild!.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = 0;
        if (firstChildScrollOffset < -precisionErrorTolerance) {
          this.geometry = new SliverGeometry({ scrollOffsetCorrection: -firstChildScrollOffset });
          return;
        }
      }
    }
    if (leadingChildWithLayout === null) {
      earliestUsefulChild!.layout(childConstraints, { parentUsesSize: true });
      leadingChildWithLayout = earliestUsefulChild;
      trailingChildWithLayout = earliestUsefulChild;
    }
    let inLayoutRange = true,
      child: RenderBox | null = earliestUsefulChild,
      index = this.indexOf(child!),
      endScrollOffset = this.childScrollOffset(child!)! + this.paintExtentOf(child!);
    const advance = (): boolean => {
      invariant(child !== null, 'missing-list-walker', 'List walk requires a current child');
      if (child === trailingChildWithLayout) inLayoutRange = false;
      child = this.childAfter(child);
      if (child === null) inLayoutRange = false;
      index++;
      if (!inLayoutRange) {
        if (child === null || this.indexOf(child) !== index) {
          child = this.insertAndLayoutChild(childConstraints, {
            after: trailingChildWithLayout,
            parentUsesSize: true,
          });
          if (child === null) return false;
        } else child.layout(childConstraints, { parentUsesSize: true });
        trailingChildWithLayout = child;
      }
      invariant(child !== null, 'missing-list-walker', 'Successful list advance requires a child');
      (child.parentData as SliverMultiBoxAdaptorParentData).layoutOffset = endScrollOffset;
      endScrollOffset = this.childScrollOffset(child)! + this.paintExtentOf(child);
      return true;
    };
    while (endScrollOffset < scrollOffset) {
      // Host adaptation: retirement during a long forward walk keeps active
      // render nodes below the finite owner budget without guessing heights.
      if (leadingGarbage > 0) {
        this.collectStreamingGarbage(leadingGarbage, 0);
        leadingGarbage = 0;
      }
      leadingGarbage++;
      if (!advance()) {
        this.collectGarbage(leadingGarbage - 1, 0);
        const extent =
          this.childScrollOffset(this.lastChild!)! + this.paintExtentOf(this.lastChild!);
        this.geometry = new SliverGeometry({ scrollExtent: extent, maxPaintExtent: extent });
        return;
      }
    }
    while (endScrollOffset < targetEndScrollOffset) {
      if (!advance()) {
        reachedEnd = true;
        break;
      }
    }
    if (child !== null) {
      child = this.childAfter(child);
      while (child !== null) {
        trailingGarbage++;
        child = this.childAfter(child);
      }
    }
    this.collectGarbage(leadingGarbage, trailingGarbage);
    if (FoundationBuildMode.debug) this.debugAssertChildListIsNonEmptyAndContiguous();
    const estimatedMaxScrollOffset = reachedEnd
      ? endScrollOffset
      : this.childManager.estimateMaxScrollOffset(constraints, {
          firstIndex: this.indexOf(this.firstChild!),
          lastIndex: this.indexOf(this.lastChild!),
          leadingScrollOffset: this.childScrollOffset(this.firstChild!),
          trailingScrollOffset: endScrollOffset,
        });
    if (FoundationBuildMode.debug)
      invariant(
        estimatedMaxScrollOffset >= endScrollOffset - this.childScrollOffset(this.firstChild!)!,
        'invalid-list-estimated-extent',
        'Estimated list extent must cover its current range',
      );
    const paintExtent = this.calculatePaintOffset(constraints, {
        from: this.childScrollOffset(this.firstChild!)!,
        to: endScrollOffset,
      }),
      cacheExtent = this.calculateCacheOffset(constraints, {
        from: this.childScrollOffset(this.firstChild!)!,
        to: endScrollOffset,
      }),
      targetEndScrollOffsetForPaint = constraints.scrollOffset + constraints.remainingPaintExtent;
    this.geometry = new SliverGeometry({
      scrollExtent: estimatedMaxScrollOffset,
      paintExtent,
      cacheExtent,
      maxPaintExtent: estimatedMaxScrollOffset,
      hasVisualOverflow:
        endScrollOffset > targetEndScrollOffsetForPaint || constraints.scrollOffset > 0,
    });
    if (estimatedMaxScrollOffset === endScrollOffset) this.childManager.setDidUnderflow(true);
    this.childManager.didFinishLayout();
  }
}
