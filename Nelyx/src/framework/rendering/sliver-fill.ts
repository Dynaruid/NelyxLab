// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port: Flutter 71e4717a, rendering/sliver_fill.dart, RenderSliverFillViewport.
import { RenderSliverFixedExtentBoxAdaptor } from './sliver-fixed-extent-list.ts';
import { SliverMultiBoxAdaptorParentData } from './sliver-multi-box-adaptor.ts';
import type { RenderSliverBoxChildManager } from './sliver-multi-box-adaptor.ts';
import type { RenderObject } from './object.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';

export class RenderSliverFillViewport extends RenderSliverFixedExtentBoxAdaptor {
  private fraction: number;
  private implicitScrolling: boolean;
  constructor({
    childManager,
    viewportFraction = 1,
    allowImplicitScrolling = true,
  }: {
    readonly childManager: RenderSliverBoxChildManager;
    readonly viewportFraction?: number;
    readonly allowImplicitScrolling?: boolean;
  }) {
    super({ childManager });
    if (FoundationBuildMode.debug)
      invariant(
        viewportFraction > 0,
        'invalid-viewport-fraction',
        'Viewport fraction must be positive',
      );
    this.fraction = viewportFraction;
    this.implicitScrolling = allowImplicitScrolling;
  }
  override get itemExtent(): number {
    return this.constraints.viewportMainAxisExtent * this.viewportFraction;
  }
  get viewportFraction(): number {
    return this.fraction;
  }
  set viewportFraction(value: number) {
    if (this.fraction === value) return;
    this.fraction = value;
    this.markNeedsLayout();
  }
  get allowImplicitScrolling(): boolean {
    return this.implicitScrolling;
  }
  set allowImplicitScrolling(value: boolean) {
    if (this.implicitScrolling === value) return;
    this.implicitScrolling = value;
    this.markNeedsSemanticsUpdate();
  }
  override visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    if (this.allowImplicitScrolling) {
      super.visitChildrenForSemantics(visitor);
      return;
    }
    const visibleStart = this.constraints.scrollOffset;
    const visibleEnd = visibleStart + this.constraints.viewportMainAxisExtent;
    for (let child = this.firstChild; child !== null; child = this.childAfter(child)) {
      const childStart = (child.parentData as SliverMultiBoxAdaptorParentData).layoutOffset!;
      if (childStart >= visibleEnd) break;
      if (childStart + this.itemExtent > visibleStart) visitor(child);
    }
  }
}
