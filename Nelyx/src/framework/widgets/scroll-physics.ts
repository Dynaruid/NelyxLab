// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { SpringDescription, ScrollSpringSimulation } from '../physics/spring-simulation.ts';
import type { Simulation } from '../physics/simulation.ts';
import { Tolerance } from '../physics/tolerance.ts';
import { BouncingScrollSimulation, ClampingScrollSimulation } from './scroll-simulation.ts';
import type { ScrollMetrics } from './scroll-metrics.ts';
import type { BuildContext } from './framework.ts';
import { kTouchSlop, kMinFlingVelocity, kMaxFlingVelocity } from '../gestures/constants.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import {
  ErrorSummary,
  ErrorDescription,
  DiagnosticsProperty,
} from '../../foundation/diagnostics.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { clampDouble as clamp } from '../../ui/math.ts';
import { protect } from '../../ui/value-math.ts';
export class ScrollDecelerationRate {
  static readonly normal = new ScrollDecelerationRate(0, 'normal');
  static readonly fast = new ScrollDecelerationRate(1, 'fast');
  static readonly values = Object.freeze([
    ScrollDecelerationRate.normal,
    ScrollDecelerationRate.fast,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'ScrollDecelerationRate.' + this.name;
  }
}
export interface ScrollPhysicsOptions {
  readonly parent?: ScrollPhysics | null;
}
export interface ScrollDimensionsChange {
  readonly oldPosition: ScrollMetrics;
  readonly newPosition: ScrollMetrics;
  readonly isScrolling: boolean;
  readonly velocity: number;
}
export interface BouncingScrollPhysicsOptions extends ScrollPhysicsOptions {
  readonly decelerationRate?: ScrollDecelerationRate;
}
/** Policies receive actual viewport metrics; no process-wide DPR is invented. */
export class ScrollPhysics {
  readonly parent: ScrollPhysics | null;
  constructor({ parent = null }: ScrollPhysicsOptions = {}) {
    this.parent = parent;
    protect(this, ['parent']);
  }
  static alwaysScrollable(options: ScrollPhysicsOptions = {}): AlwaysScrollableScrollPhysics {
    return new AlwaysScrollableScrollPhysics(options);
  }
  static bouncing(options: BouncingScrollPhysicsOptions = {}): BouncingScrollPhysics {
    return new BouncingScrollPhysics(options);
  }
  static clamping(options: ScrollPhysicsOptions = {}): ClampingScrollPhysics {
    return new ClampingScrollPhysics(options);
  }
  static neverScrollable(options: ScrollPhysicsOptions = {}): NeverScrollableScrollPhysics {
    return new NeverScrollableScrollPhysics(options);
  }
  static rangeMaintaining(options: ScrollPhysicsOptions = {}): RangeMaintainingScrollPhysics {
    return new RangeMaintainingScrollPhysics(options);
  }
  protected buildParent(ancestor: ScrollPhysics | null): ScrollPhysics | null {
    return this.parent?.applyTo(ancestor) ?? ancestor;
  }
  applyTo(ancestor: ScrollPhysics | null): ScrollPhysics {
    return new ScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  applyPhysicsToUserOffset(position: ScrollMetrics, offset: number): number {
    return this.parent?.applyPhysicsToUserOffset(position, offset) ?? offset;
  }
  shouldAcceptUserOffset(position: ScrollMetrics): boolean {
    if (!this.allowUserScrolling) return false;
    return this.parent
      ? this.parent.shouldAcceptUserOffset(position)
      : position.pixels !== 0 || position.minScrollExtent !== position.maxScrollExtent;
  }
  recommendDeferredLoading(
    velocity: number,
    metrics: ScrollMetrics,
    context: BuildContext,
  ): boolean {
    if (this.parent) return this.parent.recommendDeferredLoading(velocity, metrics, context);
    const view = context.services.readMetrics();
    return Math.abs(velocity) > Math.max(view.physicalWidth, view.physicalHeight);
  }
  applyBoundaryConditions(position: ScrollMetrics, value: number): number {
    return this.parent?.applyBoundaryConditions(position, value) ?? 0;
  }
  adjustPositionForNewDimensions(change: ScrollDimensionsChange): number {
    return this.parent?.adjustPositionForNewDimensions(change) ?? change.newPosition.pixels;
  }
  createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
    return this.parent?.createBallisticSimulation(position, velocity) ?? null;
  }
  private static readonly _kDefaultSpring = SpringDescription.withDampingRatio({
    mass: 0.5,
    stiffness: 100,
    ratio: 1.1,
  });
  get spring(): SpringDescription {
    return this.parent?.spring ?? ScrollPhysics._kDefaultSpring;
  }
  toleranceFor(metrics: ScrollMetrics): Tolerance {
    return (
      this.parent?.toleranceFor(metrics) ??
      new Tolerance({
        velocity: 1 / (0.05 * metrics.devicePixelRatio),
        distance: 1 / metrics.devicePixelRatio,
      })
    );
  }
  get minFlingDistance(): number {
    return this.parent?.minFlingDistance ?? kTouchSlop;
  }
  get minFlingVelocity(): number {
    return this.parent?.minFlingVelocity ?? kMinFlingVelocity;
  }
  get maxFlingVelocity(): number {
    return this.parent?.maxFlingVelocity ?? kMaxFlingVelocity;
  }
  carriedMomentum(existingVelocity: number): number {
    return this.parent?.carriedMomentum(existingVelocity) ?? 0;
  }
  get dragStartDistanceMotionThreshold(): number | null {
    return this.parent?.dragStartDistanceMotionThreshold ?? null;
  }
  get allowImplicitScrolling(): boolean {
    return true;
  }
  get allowUserScrolling(): boolean {
    return true;
  }
  get allowSelectionEdgeScrolling(): boolean {
    return this.parent?.allowSelectionEdgeScrolling ?? true;
  }
  shouldUpdate(old: ScrollPhysics): boolean {
    if (this === old) return false;
    if (Object.getPrototypeOf(this) !== Object.getPrototypeOf(old)) return true;
    if (
      (this.parent ? Object.getPrototypeOf(this.parent) : null) !==
      (old.parent ? Object.getPrototypeOf(old.parent) : null)
    )
      return true;
    return this.parent ? this.parent.shouldUpdate(old.parent!) : false;
  }
  toString(): string {
    const type = objectRuntimeType(this, 'ScrollPhysics');
    return this.parent === null ? type : type + ' -> ' + this.parent;
  }
}
export class RangeMaintainingScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): RangeMaintainingScrollPhysics {
    return new RangeMaintainingScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override adjustPositionForNewDimensions(change: ScrollDimensionsChange): number {
    const { oldPosition, newPosition, velocity } = change;
    let maintainOverscroll = true,
      enforceBoundary = true;
    if (velocity !== 0) {
      maintainOverscroll = false;
      enforceBoundary = false;
    }
    if (
      oldPosition.minScrollExtent === newPosition.minScrollExtent &&
      oldPosition.maxScrollExtent === newPosition.maxScrollExtent
    )
      maintainOverscroll = false;
    if (oldPosition.pixels !== newPosition.pixels) {
      maintainOverscroll = false;
      if (
        [
          oldPosition.minScrollExtent,
          oldPosition.maxScrollExtent,
          newPosition.minScrollExtent,
          newPosition.maxScrollExtent,
        ].every(Number.isFinite)
      )
        enforceBoundary = false;
    }
    if (
      oldPosition.pixels < oldPosition.minScrollExtent ||
      oldPosition.pixels > oldPosition.maxScrollExtent
    )
      enforceBoundary = false;
    if (maintainOverscroll) {
      if (
        oldPosition.pixels < oldPosition.minScrollExtent &&
        newPosition.minScrollExtent > oldPosition.minScrollExtent
      )
        return newPosition.minScrollExtent - (oldPosition.minScrollExtent - oldPosition.pixels);
      if (
        oldPosition.pixels > oldPosition.maxScrollExtent &&
        newPosition.maxScrollExtent < oldPosition.maxScrollExtent
      )
        return newPosition.maxScrollExtent + (oldPosition.pixels - oldPosition.maxScrollExtent);
    }
    const result = super.adjustPositionForNewDimensions(change);
    return enforceBoundary
      ? clamp(result, newPosition.minScrollExtent, newPosition.maxScrollExtent)
      : result;
  }
}
export class BouncingScrollPhysics extends ScrollPhysics {
  readonly decelerationRate: ScrollDecelerationRate;
  constructor({
    decelerationRate = ScrollDecelerationRate.normal,
    ...options
  }: BouncingScrollPhysicsOptions = {}) {
    super(options);
    this.decelerationRate = decelerationRate;
    protect(this, ['decelerationRate']);
  }
  private static readonly _rubberBandHalfLifeSeconds = 0.07;
  private static readonly _rubberBandLambda =
    Math.log(2) / BouncingScrollPhysics._rubberBandHalfLifeSeconds;
  static readonly rubberBandSpring = new SpringDescription({
    mass: 1,
    stiffness:
      1e5 * BouncingScrollPhysics._rubberBandLambda * BouncingScrollPhysics._rubberBandLambda,
    damping: (1e5 + 1) * BouncingScrollPhysics._rubberBandLambda,
  });
  override applyTo(ancestor: ScrollPhysics | null): BouncingScrollPhysics {
    return new BouncingScrollPhysics({
      parent: this.buildParent(ancestor),
      decelerationRate: this.decelerationRate,
    });
  }
  override shouldUpdate(old: BouncingScrollPhysics): boolean {
    if (!(old instanceof BouncingScrollPhysics))
      throw new TypeError('BouncingScrollPhysics.shouldUpdate requires BouncingScrollPhysics');
    return this.decelerationRate !== old.decelerationRate || super.shouldUpdate(old);
  }
  frictionFactor(overscrollFraction: number): number {
    return (
      Math.pow(1 - overscrollFraction, 2) *
      (this.decelerationRate === ScrollDecelerationRate.fast ? 0.26 : 0.52)
    );
  }
  override applyPhysicsToUserOffset(position: ScrollMetrics, offset: number): number {
    if (FoundationBuildMode.debug) {
      invariant(offset !== 0, 'redundant-bouncing-offset', 'User offset must be nonzero');
      invariant(
        position.minScrollExtent <= position.maxScrollExtent,
        'invalid-bouncing-extents',
        'Scroll extents must be ordered',
      );
    }
    if (!position.outOfRange) return offset;
    const start = Math.max(position.minScrollExtent - position.pixels, 0),
      end = Math.max(position.pixels - position.maxScrollExtent, 0),
      past = Math.max(start, end),
      easing = (start > 0 && offset < 0) || (end > 0 && offset > 0),
      friction = this.frictionFactor(
        (easing ? past - Math.abs(offset) : past) / position.viewportDimension,
      ),
      direction = Math.sign(offset);
    if (easing && this.decelerationRate === ScrollDecelerationRate.fast)
      return direction * Math.abs(offset);
    return direction * BouncingScrollPhysics._applyFriction(past, Math.abs(offset), friction);
  }
  private static _applyFriction(extentOutside: number, absDelta: number, gamma: number): number {
    if (FoundationBuildMode.debug)
      invariant(absDelta > 0, 'invalid-friction-delta', 'Absolute delta must be positive');
    let total = 0;
    if (extentOutside > 0) {
      const toLimit = extentOutside / gamma;
      if (absDelta < toLimit) return absDelta * gamma;
      total += extentOutside;
      absDelta -= toLimit;
    }
    return total + absDelta;
  }
  override applyBoundaryConditions(_position: ScrollMetrics, _value: number): number {
    return 0;
  }
  override createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
    const tolerance = this.toleranceFor(position),
      stationary = Math.abs(velocity) < tolerance.velocity,
      rubberBand = stationary && position.outOfRange;
    if (!stationary || position.outOfRange)
      return new BouncingScrollSimulation({
        spring: rubberBand ? BouncingScrollPhysics.rubberBandSpring : this.spring,
        position: position.pixels,
        velocity,
        leadingExtent: position.minScrollExtent,
        trailingExtent: position.maxScrollExtent,
        tolerance,
        constantDeceleration: this.decelerationRate === ScrollDecelerationRate.fast ? 1400 : 0,
      });
    return null;
  }
  override get minFlingVelocity(): number {
    return kMinFlingVelocity * 2;
  }
  override carriedMomentum(existingVelocity: number): number {
    return (
      Math.sign(existingVelocity) *
      Math.min(0.000816 * Math.pow(Math.abs(existingVelocity), 1.967), 40000)
    );
  }
  override get dragStartDistanceMotionThreshold(): number {
    return 3.5;
  }
  override get maxFlingVelocity(): number {
    return this.decelerationRate === ScrollDecelerationRate.fast
      ? kMaxFlingVelocity * 8
      : super.maxFlingVelocity;
  }
  override get spring(): SpringDescription {
    return this.decelerationRate === ScrollDecelerationRate.fast
      ? SpringDescription.withDampingRatio({ mass: 0.3, stiffness: 75, ratio: 1.3 })
      : super.spring;
  }
}
export class ClampingScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): ClampingScrollPhysics {
    return new ClampingScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override applyBoundaryConditions(position: ScrollMetrics, value: number): number {
    if (FoundationBuildMode.debug && value === position.pixels)
      throw FlutterError.fromParts([
        new ErrorSummary(
          `${objectRuntimeType(this, 'ClampingScrollPhysics')}.applyBoundaryConditions() was called redundantly.`,
        ),
        new ErrorDescription(
          `The proposed new position, ${diagnosticDoubleString(value)}, is exactly equal to the current position of the given ${objectRuntimeType(position, 'ScrollMetrics')}, ${diagnosticDoubleString(position.pixels)}.\nThe applyBoundaryConditions method should only be called when the value is going to actually change the pixels, otherwise it is redundant.`,
        ),
        new DiagnosticsProperty('The physics object in question was', this, {
          style: 'errorProperty',
        }),
        new DiagnosticsProperty('The position object in question was', position, {
          style: 'errorProperty',
        }),
      ]);
    if (value < position.pixels && position.pixels <= position.minScrollExtent)
      return value - position.pixels;
    if (position.maxScrollExtent <= position.pixels && position.pixels < value)
      return value - position.pixels;
    if (value < position.minScrollExtent && position.minScrollExtent < position.pixels)
      return value - position.minScrollExtent;
    if (position.pixels < position.maxScrollExtent && position.maxScrollExtent < value)
      return value - position.maxScrollExtent;
    return 0;
  }
  override createBallisticSimulation(position: ScrollMetrics, velocity: number): Simulation | null {
    const tolerance = this.toleranceFor(position);
    if (position.outOfRange) {
      const end =
        position.pixels > position.maxScrollExtent
          ? position.maxScrollExtent
          : position.minScrollExtent;
      return new ScrollSpringSimulation(this.spring, position.pixels, end, Math.min(0, velocity), {
        tolerance,
      });
    }
    if (
      Math.abs(velocity) < tolerance.velocity ||
      (velocity > 0 && position.pixels >= position.maxScrollExtent) ||
      (velocity < 0 && position.pixels <= position.minScrollExtent)
    )
      return null;
    return new ClampingScrollSimulation({ position: position.pixels, velocity, tolerance });
  }
}
export class AlwaysScrollableScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): AlwaysScrollableScrollPhysics {
    return new AlwaysScrollableScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override shouldAcceptUserOffset(_position: ScrollMetrics): boolean {
    return true;
  }
}
export class NeverScrollableScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): NeverScrollableScrollPhysics {
    return new NeverScrollableScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override get allowUserScrolling(): boolean {
    return false;
  }
  override get allowImplicitScrolling(): boolean {
    return false;
  }
}
