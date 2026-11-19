// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Based on Flutter 71e4717a61786faab4c7aa39825989305ed29e8a, cupertino/refresh.dart.
import { invariant } from '@nelyx/core/foundation/errors';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import {
  GrowthDirection,
  RenderSliverSingleBoxAdapter,
  SliverGeometry,
} from '@nelyx/core/framework/rendering/sliver';
import type { SliverConstraints } from '@nelyx/core/framework/rendering/sliver';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Center, Positioned, SizedBox, Stack } from '@nelyx/core/framework/widgets/basic';
import {
  SingleChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  Element,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { CupertinoActivityIndicator } from './activity-indicator.ts';

export enum RefreshIndicatorMode {
  inactive = 'inactive',
  drag = 'drag',
  armed = 'armed',
  refresh = 'refresh',
  done = 'done',
}

export type RefreshCallback = () => Promise<void>;
export type RefreshControlIndicatorBuilder = (
  context: BuildContext,
  mode: RefreshIndicatorMode,
  pulledExtent: number,
  refreshTriggerPullDistance: number,
  refreshIndicatorExtent: number,
) => Widget;

export interface CupertinoSliverRefreshControlOptions extends WidgetOptions {
  readonly refreshTriggerPullDistance?: number;
  readonly refreshIndicatorExtent?: number;
  readonly builder?: RefreshControlIndicatorBuilder | null;
  readonly onRefresh?: RefreshCallback | null;
}

export class CupertinoSliverRefreshControl extends StatefulWidget {
  readonly refreshTriggerPullDistance: number;
  readonly refreshIndicatorExtent: number;
  readonly builder: RefreshControlIndicatorBuilder | null;
  readonly onRefresh: RefreshCallback | null;

  constructor({
    key = null,
    refreshTriggerPullDistance = 100,
    refreshIndicatorExtent = 60,
    builder = CupertinoSliverRefreshControl.buildRefreshIndicator,
    onRefresh = null,
  }: CupertinoSliverRefreshControlOptions = {}) {
    super(key);
    invariant(
      Number.isFinite(refreshTriggerPullDistance) &&
        Number.isFinite(refreshIndicatorExtent) &&
        refreshTriggerPullDistance > 0 &&
        refreshIndicatorExtent >= 0 &&
        refreshIndicatorExtent <= refreshTriggerPullDistance,
      'invalid-cupertino-refresh-extents',
      'Expected 0 <= indicator extent <= trigger distance and a positive trigger distance',
    );
    this.refreshTriggerPullDistance = refreshTriggerPullDistance;
    this.refreshIndicatorExtent = refreshIndicatorExtent;
    this.builder = builder;
    this.onRefresh = onRefresh;
  }

  static state(context: BuildContext): RefreshIndicatorMode {
    const state = context.findAncestorStateOfType(CupertinoRefreshState);
    invariant(state, 'missing-cupertino-refresh', 'No CupertinoSliverRefreshControl ancestor');
    return state.mode;
  }

  static buildRefreshIndicator(
    _context: BuildContext,
    mode: RefreshIndicatorMode,
    pulledExtent: number,
    refreshTriggerPullDistance: number,
    _refreshIndicatorExtent: number,
  ): Widget {
    const progress = Math.min(1, Math.max(0, pulledExtent / refreshTriggerPullDistance));
    const radius = 14;
    let child: Widget;
    switch (mode) {
      case RefreshIndicatorMode.drag:
        child = new Opacity(CupertinoActivityIndicator.partiallyRevealed({ radius, progress }), {
          opacity: Curves.easeInOut.transform(Math.min(1, progress / 0.35)),
        });
        break;
      case RefreshIndicatorMode.armed:
      case RefreshIndicatorMode.refresh:
        child = new CupertinoActivityIndicator({ radius });
        break;
      case RefreshIndicatorMode.done:
        if (progress === 0) return new SizedBox(0, 0);
        child = new CupertinoActivityIndicator({ radius: radius * progress });
        break;
      default:
        return new SizedBox(0, 0);
    }
    return new Stack([new Positioned(new Center(child), { top: 16, left: 0, right: 0 })], {
      clipBehavior: 'none',
    });
  }

  override createState(): State<CupertinoSliverRefreshControl> {
    return new CupertinoRefreshState();
  }
}

class CupertinoRefreshState extends State<CupertinoSliverRefreshControl> {
  mode = RefreshIndicatorMode.inactive;
  private held = false;
  private pulledExtent = 0;

  private arm(): void {
    this.mode = RefreshIndicatorMode.armed;
    (this.context as Element).owner.postFrame(() => {
      if (!this.mounted) return;
      const callback = this.widget.onRefresh;
      if (!callback) {
        this.finish();
        return;
      }
      this.setState(() => {
        this.held = true;
      });
      void this.runRefresh(callback);
    });
  }

  private async runRefresh(callback: RefreshCallback): Promise<void> {
    const { owner } = this.context as Element;
    const messenger = this.context.services.binaryMessenger;
    try {
      if (messenger) void HapticFeedback.mediumImpact(messenger).catch(() => {});
      await callback();
    } catch (exception) {
      owner.reportError(new FlutterErrorDetails({ exception, library: 'Cupertino refresh' }));
    } finally {
      if (this.mounted) this.finish();
    }
  }

  private finish(): void {
    this.setState(() => {
      this.mode =
        this.pulledExtent <= this.widget.refreshTriggerPullDistance * 0.1
          ? RefreshIndicatorMode.inactive
          : RefreshIndicatorMode.done;
      this.held = false;
    });
  }

  override build(): Widget {
    return new RefreshSliver(
      new LayoutBuilder((context, constraints) => {
        const {
          builder,
          refreshTriggerPullDistance: trigger,
          refreshIndicatorExtent: extent,
        } = this.widget;
        const pulled = constraints.maxHeight;
        this.pulledExtent = pulled;
        switch (this.mode) {
          case RefreshIndicatorMode.inactive:
          case RefreshIndicatorMode.drag:
            if (pulled >= trigger) this.arm();
            else this.mode = pulled > 0 ? RefreshIndicatorMode.drag : RefreshIndicatorMode.inactive;
            break;
          case RefreshIndicatorMode.armed:
            if (this.held && pulled <= extent) this.mode = RefreshIndicatorMode.refresh;
            break;
          case RefreshIndicatorMode.done:
            if (pulled <= trigger * 0.1) this.mode = RefreshIndicatorMode.inactive;
            break;
        }
        return pulled > 0 && builder
          ? builder(context, this.mode, pulled, trigger, extent)
          : SizedBox.expand();
      }),
      this.held ? this.widget.refreshIndicatorExtent : 0,
    );
  }
}

class RefreshSliver extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    private readonly retainedExtent: number,
  ) {
    super(child);
  }
  override createRenderObject(): RenderRefreshSliver {
    return new RenderRefreshSliver(this.retainedExtent);
  }
  override updateRenderObject(_context: BuildContext, render: RenderRefreshSliver): void {
    render.updateExtent(this.retainedExtent);
  }
}

class RenderRefreshSliver extends RenderSliverSingleBoxAdapter {
  private compensatedExtent = 0;
  constructor(private retainedExtent: number) {
    super();
  }
  updateExtent(value: number): void {
    if (value === this.retainedExtent) return;
    this.retainedExtent = value;
    this.markNeedsLayout();
  }
  protected override performLayout(constraints: SliverConstraints): void {
    invariant(
      constraints.axisDirection === AxisDirection.down &&
        constraints.growthDirection === GrowthDirection.forward,
      'invalid-cupertino-refresh-direction',
      'CupertinoSliverRefreshControl requires downward, forward sliver layout',
    );
    const extent = this.retainedExtent;
    if (extent !== this.compensatedExtent) {
      // Transfer space between overscroll and content without moving the following slivers.
      this.geometry = new SliverGeometry({
        scrollOffsetCorrection: extent - this.compensatedExtent,
      });
      this.compensatedExtent = extent;
      return;
    }
    const overscroll = Math.max(0, -constraints.overlap);
    const child = this.child;
    child?.layout(constraints.asBoxConstraints({ maxExtent: extent + overscroll }), {
      parentUsesSize: true,
    });
    if (extent + overscroll === 0) {
      this.geometry = SliverGeometry.zero;
      return;
    }
    const paintOrigin = -overscroll - constraints.scrollOffset;
    const maxPaintExtent = Math.max(
      0,
      Math.max(child?.size.height ?? 0, extent) - constraints.scrollOffset,
    );
    const availablePaint = constraints.remainingPaintExtent - paintOrigin;
    this.geometry = new SliverGeometry({
      scrollExtent: extent,
      paintOrigin,
      paintExtent: Math.min(maxPaintExtent, availablePaint),
      maxPaintExtent,
      layoutExtent: Math.min(
        Math.max(0, extent - constraints.scrollOffset),
        constraints.remainingPaintExtent,
      ),
      hitTestExtent: 0,
      hasVisualOverflow: constraints.scrollOffset > 0 || maxPaintExtent > availablePaint,
    });
  }
}
