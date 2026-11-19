// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Header motion adapted from Flutter sliver_persistent_header.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import {
  applyGrowthDirectionToScrollDirection,
  RenderSliverSingleBoxAdapter,
  SliverGeometry,
  SliverPhysicalParentData,
} from './sliver.ts';
import type { SliverConstraints } from './sliver.ts';
import type { Constraints } from './constraints.ts';
import type { RenderBox, RenderObject, ShowOnScreenOptions } from './object.ts';
import { RenderObjectWithLayoutCallbackMixin } from './layout-callback.ts';
import { ScrollDirection } from './viewport-offset.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';
import type { TickerProvider } from '../animation/ticker.ts';
import { Axis } from '../painting/basic-types.ts';
import { Offset } from '../../ui/offset.ts';
import type { Rect } from '../../ui/types.ts';

export interface PersistentHeaderLayoutInfo {
  readonly constraints: SliverConstraints;
  readonly shrinkOffset: number;
  readonly overlapsContent: boolean;
}
export interface FloatingHeaderSnapConfiguration {
  readonly vsync: TickerProvider;
  readonly duration?: number;
  readonly curve?: Curve;
}

export interface OverScrollHeaderStretchConfiguration {
  readonly stretchTriggerOffset: number;
  readonly onStretchTrigger?: (() => void | Promise<void>) | null;
}

export interface PersistentHeaderConfiguration {
  readonly minExtent: number;
  readonly maxExtent: number;
  readonly pinned?: boolean;
  readonly floating?: boolean;
  readonly snapConfiguration?: FloatingHeaderSnapConfiguration | null;
  readonly stretchConfiguration?: OverScrollHeaderStretchConfiguration | null;
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
  const { snapConfiguration: snap, stretchConfiguration: stretch } = value;
  invariant(
    !snap ||
      (value.floating && Number.isFinite(snap.duration ?? 200) && (snap.duration ?? 200) >= 0),
    'invalid-header-snap',
    'Snap requires a floating header and a finite nonnegative duration',
  );
  invariant(
    !stretch || (Number.isFinite(stretch.stretchTriggerOffset) && stretch.stretchTriggerOffset > 0),
    'invalid-header-stretch-trigger',
    'The stretch trigger offset must be finite and positive',
  );
}
/** The child fills the current extent. Floating and stretch motion are opt-in. */
export class RenderSliverPersistentHeader extends RenderObjectWithLayoutCallbackMixin(
  RenderSliverSingleBoxAdapter,
) {
  private minimum = 0;
  private maximum = 0;
  private pinnedHeader = false;
  private floatingHeader = false;
  private snap: FloatingHeaderSnapConfiguration | null = null;
  private stretch: OverScrollHeaderStretchConfiguration | null = null;
  private snapController: AnimationController | null = null;
  private stretchTriggered = false;
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
    const pinned = configuration.pinned ?? false;
    const floating = configuration.floating ?? false;
    const snap = configuration.snapConfiguration ?? null;
    const stretch = configuration.stretchConfiguration ?? null;
    if (
      this.minimum === configuration.minExtent &&
      this.maximum === configuration.maxExtent &&
      this.pinnedHeader === pinned &&
      this.floatingHeader === floating &&
      this.snap === snap &&
      this.stretch === stretch
    )
      return;
    if (this.pinnedHeader !== pinned || this.floatingHeader !== floating)
      this.previousOffset = null;
    if (this.snap?.vsync !== snap?.vsync) this.disposeSnapController();
    else if (this.maximum !== configuration.maxExtent) this.stopFloatingSnap();
    if (this.stretch?.stretchTriggerOffset !== stretch?.stretchTriggerOffset)
      this.stretchTriggered = false;
    this.minimum = configuration.minExtent;
    this.maximum = configuration.maxExtent;
    this.pinnedHeader = pinned;
    this.floatingHeader = floating;
    this.snap = snap;
    this.stretch = stretch;
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
  /** @internal The scrollable reports the last scroll direction before entering idle. */
  startFloatingSnap(direction: ScrollDirection): void {
    const snap = this.snap;
    if (
      !snap ||
      !this.attached ||
      this.previousOffset === null ||
      direction === ScrollDirection.idle
    )
      return;
    const logical = applyGrowthDirectionToScrollDirection(
      direction,
      this.constraints.growthDirection,
    );
    const target =
      logical === ScrollDirection.forward ? 0 : Math.min(this.maximum, this.previousOffset);
    this.animateFloatingOffset(target, snap.duration ?? 200, snap.curve ?? Curves.easeOut);
  }
  /** @internal Input can continue scrolling from the current animation position. */
  stopFloatingSnap(): void {
    this.snapController?.stop();
  }
  private animateFloatingOffset(target: number, duration: number, curve: Curve): void {
    if (!this.snap) return;
    if (this.effectiveOffset === target) {
      this.stopFloatingSnap();
      return;
    }
    if (duration === 0) {
      this.stopFloatingSnap();
      this.effectiveOffset = target;
      this.markNeedsLayout();
      return;
    }
    let controller = this.snapController;
    if (!controller) {
      controller = AnimationController.unbounded({ vsync: this.snap.vsync });
      this.snapController = controller;
      const motion = controller;
      motion.addListener(() => {
        if (this.effectiveOffset === motion.value) return;
        this.effectiveOffset = motion.value;
        this.markNeedsLayout();
      });
    }
    controller.value = this.effectiveOffset;
    controller.animateTo(target, { duration, curve });
  }
  private disposeSnapController(): void {
    const controller = this.snapController;
    this.snapController = null;
    controller?.dispose();
  }
  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) this.disposeSnapController();
    }
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) this.disposeSnapController();
    }
  }
  override showOnScreen(rect: Rect = this.paintBounds, options: ShowOnScreenOptions = {}): void {
    if (this.snap && this.attached && this.previousOffset !== null) {
      if (this.effectiveOffset > 0) {
        this.animateFloatingOffset(0, options.duration ?? 0, options.curve ?? Curves.ease);
        // Reveal the header's current painted bounds to the surrounding viewports.
        super.showOnScreen(this.paintBounds, {
          ...options,
          descendant: this,
          targetRect: this.paintBounds,
        });
        return;
      }
      this.stopFloatingSnap();
    }
    super.showOnScreen(rect, options);
  }
  private updateStretch(stretchOffset: number): void {
    const config = this.stretch;
    const onTrigger = config?.onStretchTrigger;
    const crossed = !!config && stretchOffset >= config.stretchTriggerOffset;
    if (crossed && !this.stretchTriggered && onTrigger) {
      void Promise.resolve()
        .then(() => {
          if (this.attached && this.stretch?.onStretchTrigger === onTrigger) return onTrigger();
        })
        .catch((error: unknown) =>
          FlutterError.reportError(
            new FlutterErrorDetails({ exception: error, library: 'rendering library' }),
          ),
        );
    }
    this.stretchTriggered = crossed;
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
    const stretchOffset = this.stretch && offset === 0 ? Math.max(0, -constraints.overlap) : 0;
    const extent =
        Math.max(this.minimum, this.maximum - Math.min(effective, this.maximum)) + stretchOffset,
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
    const origin =
        this.pinnedHeader && stretchOffset === 0
          ? Math.min(constraints.remainingPaintExtent, Math.max(0, constraints.overlap))
          : Math.min(0, constraints.overlap),
      available = Math.max(0, constraints.remainingPaintExtent - origin);
    const painted = Math.min(
      available,
      this.pinnedHeader ? extent : Math.max(0, this.maximum - effective) + stretchOffset,
    );
    this.geometry = new SliverGeometry({
      scrollExtent: this.maximum,
      paintOrigin: origin,
      paintExtent: painted,
      layoutExtent: Math.min(painted, Math.max(0, this.maximum - offset)),
      maxPaintExtent: this.maximum + stretchOffset,
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
    this.updateStretch(stretchOffset);
  }
}
