// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed port: Flutter 71e4717a, widgets/sliver_fill.dart, viewport and fractional padding.
import { StatelessWidget, SingleChildRenderObjectWidget } from './framework.ts';
import type { BuildContext, WidgetOptions } from './framework.ts';
import { SliverMultiBoxAdaptorWidget, SliverMultiBoxAdaptorElement } from './sliver.ts';
import type { SliverChildDelegate } from './scroll-delegate.ts';
import { RenderSliverFillViewport } from '../rendering/sliver-fill.ts';
import { RenderSliverEdgeInsetsPadding } from '../rendering/sliver-padding.ts';
import type { SliverConstraints } from '../rendering/sliver.ts';
import { Axis } from '../painting/basic-types.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { clampDouble } from '../../ui/math.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';

export interface SliverFillViewportOptions extends WidgetOptions {
  readonly delegate: SliverChildDelegate;
  readonly viewportFraction?: number;
  readonly padEnds?: boolean;
  readonly allowImplicitScrolling?: boolean;
}
export class SliverFillViewport extends StatelessWidget {
  readonly delegate: SliverChildDelegate;
  readonly viewportFraction: number;
  readonly padEnds: boolean;
  readonly allowImplicitScrolling: boolean;
  constructor({
    key = null,
    delegate,
    viewportFraction = 1,
    padEnds = true,
    allowImplicitScrolling = true,
  }: SliverFillViewportOptions) {
    super(key);
    if (FoundationBuildMode.debug)
      invariant(
        viewportFraction > 0,
        'invalid-viewport-fraction',
        'Viewport fraction must be positive',
      );
    this.delegate = delegate;
    this.viewportFraction = viewportFraction;
    this.padEnds = padEnds;
    this.allowImplicitScrolling = allowImplicitScrolling;
  }
  build(): SingleChildRenderObjectWidget {
    return new SliverFractionalPadding(
      this.padEnds ? clampDouble(1 - this.viewportFraction, 0, 1) / 2 : 0,
      new SliverFillViewportRenderObjectWidget({
        delegate: this.delegate,
        viewportFraction: this.viewportFraction,
        allowImplicitScrolling: this.allowImplicitScrolling,
      }),
    );
  }
}
class SliverFillViewportRenderObjectWidget extends SliverMultiBoxAdaptorWidget {
  readonly viewportFraction: number;
  readonly allowImplicitScrolling: boolean;
  constructor({
    delegate,
    viewportFraction = 1,
    allowImplicitScrolling = true,
  }: SliverFillViewportOptions) {
    super({ delegate });
    this.viewportFraction = viewportFraction;
    this.allowImplicitScrolling = allowImplicitScrolling;
  }
  createRenderObject(context: BuildContext): RenderSliverFillViewport {
    invariant(
      context instanceof SliverMultiBoxAdaptorElement,
      'invalid-sliver-context',
      'Viewport sliver requires its actual child manager',
    );
    return new RenderSliverFillViewport({
      childManager: context,
      viewportFraction: this.viewportFraction,
      allowImplicitScrolling: this.allowImplicitScrolling,
    });
  }
  updateRenderObject(_context: BuildContext, render: RenderSliverFillViewport): void {
    render.viewportFraction = this.viewportFraction;
    render.allowImplicitScrolling = this.allowImplicitScrolling;
  }
}
class SliverFractionalPadding extends SingleChildRenderObjectWidget {
  constructor(
    readonly viewportFraction: number,
    sliver: SliverFillViewportRenderObjectWidget,
  ) {
    super(sliver);
  }
  createRenderObject(): RenderSliverFractionalPadding {
    return new RenderSliverFractionalPadding(this.viewportFraction);
  }
  updateRenderObject(_context: BuildContext, render: RenderSliverFractionalPadding): void {
    render.viewportFraction = this.viewportFraction;
  }
}
class RenderSliverFractionalPadding extends RenderSliverEdgeInsetsPadding {
  private fraction: number;
  private lastResolvedConstraints: SliverConstraints | null = null;
  private padding: EdgeInsets | null = null;
  constructor(viewportFraction = 0) {
    super();
    if (FoundationBuildMode.debug)
      invariant(
        viewportFraction >= 0 && viewportFraction <= 0.5,
        'invalid-fractional-padding',
        'Fractional padding must be in [0, 0.5]',
      );
    this.fraction = viewportFraction;
  }
  get viewportFraction(): number {
    return this.fraction;
  }
  set viewportFraction(value: number) {
    if (this.fraction === value) return;
    this.fraction = value;
    this.padding = null;
    this.markNeedsLayout();
  }
  get resolvedPadding(): EdgeInsets | null {
    return this.padding;
  }
  override performLayout(): void {
    if (this.padding === null || !this.lastResolvedConstraints?.equals(this.constraints)) {
      const value = this.constraints.viewportMainAxisExtent * this.viewportFraction;
      this.lastResolvedConstraints = this.constraints;
      this.padding =
        this.constraints.axis === Axis.horizontal
          ? EdgeInsets.symmetric({ horizontal: value })
          : EdgeInsets.symmetric({ vertical: value });
    }
    super.performLayout(this.constraints);
  }
}
