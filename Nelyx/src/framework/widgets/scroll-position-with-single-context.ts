// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ScrollPosition } from './scroll-position.ts';
import type { ScrollPositionOptions } from './scroll-position.ts';
import {
  IdleScrollActivity,
  HoldScrollActivity,
  DragScrollActivity,
  BallisticScrollActivity,
  DrivenScrollActivity,
  ScrollDragController,
} from './scroll-activity.ts';
import type {
  ScrollActivity,
  ScrollActivityDelegate,
  ScrollHoldController,
} from './scroll-activity.ts';
import { ScrollDirection } from '../rendering/viewport-offset.ts';
import type { ViewportAnimationOptions } from '../rendering/viewport-offset.ts';
import type { AxisDirection } from '../painting/basic-types.ts';
import type { Drag } from '../gestures/drag.ts';
import type { DragStartDetails } from '../gestures/drag-details.ts';
import { nearEqual } from '../physics/utils.ts';
import { invariant } from '../../foundation/errors.ts';
export interface ScrollPositionWithSingleContextOptions extends ScrollPositionOptions {
  readonly initialPixels?: number | null;
}
export class ScrollPositionWithSingleContext
  extends ScrollPosition
  implements ScrollActivityDelegate
{
  // Dart initializes subclass fields before super; declarations avoid erasing values absorbed by super.
  declare private heldPreviousVelocity: number;
  declare private direction: ScrollDirection;
  declare private currentDrag: ScrollDragController | null;
  constructor({ initialPixels = 0, ...options }: ScrollPositionWithSingleContextOptions) {
    super(options);
    this.heldPreviousVelocity ??= 0;
    this.direction ??= ScrollDirection.idle;
    this.currentDrag ??= null;
    if (!this.hasPixels && initialPixels !== null) this.correctPixels(initialPixels);
    if (this.activity === null) this.goIdle();
  }
  get axisDirection(): AxisDirection {
    return this.context.axisDirection;
  }
  override setPixels(newPixels: number): number {
    invariant(
      this.activity?.isScrolling,
      'invalid-idle-scroll-update',
      'setPixels requires scrolling activity',
    );
    return super.setPixels(newPixels);
  }
  override absorb(other: ScrollPosition): void {
    super.absorb(other);
    if (!(other instanceof ScrollPositionWithSingleContext)) {
      this.goIdle();
      return;
    }
    this.activity!.updateDelegate(this);
    this.direction = other.direction;
    invariant(
      this.currentDrag == null,
      'duplicate-absorbed-scroll-drag',
      'Absorption requires no destination drag',
    );
    if (other.currentDrag != null) {
      this.currentDrag = other.currentDrag;
      this.currentDrag.updateDelegate(this);
      other.currentDrag = null;
    }
  }
  override _restoreAbsorbedPosition(other: ScrollPosition): boolean {
    const restored = super._restoreAbsorbedPosition(other);
    if (restored && other instanceof ScrollPositionWithSingleContext && this.currentDrag != null) {
      const drag = this.currentDrag;
      this.currentDrag = null;
      other.currentDrag = drag;
      if (drag.delegate !== other) drag.updateDelegate(other);
    }
    return restored;
  }
  protected override applyNewDimensions(): void {
    super.applyNewDimensions();
    this.context.setCanDrag(this.physics.shouldAcceptUserOffset(this));
  }
  override beginActivity(newActivity: ScrollActivity | null): void {
    this.heldPreviousVelocity = 0;
    if (newActivity === null) return;
    invariant(
      newActivity.delegate === this,
      'invalid-scroll-activity-delegate',
      'Scroll activity must belong to this position',
    );
    const previousDrag = this.currentDrag;
    this.currentDrag = null;
    const errors: unknown[] = [];
    try {
      super.beginActivity(newActivity);
    } catch (error) {
      errors.push(error);
    }
    try {
      previousDrag?.dispose();
    } catch (error) {
      errors.push(error);
    }
    try {
      if (!this.scrollDisposed && !this.activity!.isScrolling)
        this.updateUserScrollDirection(ScrollDirection.idle);
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Single-context scroll transition failed');
  }
  applyUserOffset(delta: number): void {
    this.updateUserScrollDirection(delta > 0 ? ScrollDirection.forward : ScrollDirection.reverse);
    this.setPixels(this.pixels - this.physics.applyPhysicsToUserOffset(this, delta));
  }
  goIdle(): void {
    this.beginActivity(new IdleScrollActivity(this));
  }
  goBallistic(velocity: number): void {
    this.ensureScrollAlive();
    const simulation = this.physics.createBallisticSimulation(this, velocity);
    this.beginActivity(
      simulation === null
        ? new IdleScrollActivity(this)
        : new BallisticScrollActivity(
            this,
            simulation,
            this.context.vsync,
            this.shouldIgnorePointer,
          ),
    );
  }
  get userScrollDirection(): ScrollDirection {
    return this.direction;
  }
  updateUserScrollDirection(value: ScrollDirection): void {
    if (this.direction === value) return;
    this.direction = value;
    this.didUpdateScrollDirection(value);
  }
  animateTo(to: number, options: ViewportAnimationOptions): Promise<void> {
    this.ensureScrollAlive();
    if (nearEqual(to, this.pixels, this.physics.toleranceFor(this).distance)) {
      this.jumpTo(to);
      return Promise.resolve();
    }
    const activity = new DrivenScrollActivity(this, {
      from: this.pixels,
      to,
      ...options,
      vsync: this.context.vsync,
    });
    this.beginActivity(activity);
    return activity.done;
  }
  jumpTo(value: number): void {
    this.goIdle();
    if (this.scrollDisposed) return;
    if (this.pixels !== value) {
      const previous = this.pixels;
      this.forcePixels(value);
      if (this.scrollDisposed) return;
      this.didStartScroll();
      if (this.scrollDisposed) return;
      this.didUpdateScrollPositionBy(this.pixels - previous);
      if (this.scrollDisposed) return;
      this.didEndScroll();
    }
    if (!this.scrollDisposed) this.goBallistic(0);
  }
  pointerScroll(delta: number): void {
    this.ensureScrollAlive();
    if (delta === 0) {
      this.goBallistic(0);
      return;
    }
    const target = Math.min(
      Math.max(this.pixels + delta, this.minScrollExtent),
      this.maxScrollExtent,
    );
    if (target !== this.pixels) {
      this.goIdle();
      if (this.scrollDisposed) return;
      this.updateUserScrollDirection(
        -delta > 0 ? ScrollDirection.forward : ScrollDirection.reverse,
      );
      if (this.scrollDisposed) return;
      const previous = this.pixels;
      this.isScrollingNotifier.value = true;
      if (this.scrollDisposed) return;
      this.forcePixels(target);
      if (this.scrollDisposed) return;
      this.didStartScroll();
      if (this.scrollDisposed) return;
      this.didUpdateScrollPositionBy(this.pixels - previous);
      if (this.scrollDisposed) return;
      this.didEndScroll();
      if (!this.scrollDisposed) this.goBallistic(0);
    }
  }
  jumpToWithoutSettling(value: number): void {
    this.goIdle();
    if (this.scrollDisposed) return;
    if (this.pixels !== value) {
      const previous = this.pixels;
      this.forcePixels(value);
      if (this.scrollDisposed) return;
      this.didStartScroll();
      if (this.scrollDisposed) return;
      this.didUpdateScrollPositionBy(this.pixels - previous);
      if (this.scrollDisposed) return;
      this.didEndScroll();
    }
  }
  hold(holdCancelCallback: () => void): ScrollHoldController {
    const velocity = this.activity!.velocity,
      activity = new HoldScrollActivity({ delegate: this, onHoldCanceled: holdCancelCallback });
    this.beginActivity(activity);
    this.heldPreviousVelocity = velocity;
    return activity;
  }
  drag(details: DragStartDetails, dragCancelCallback: () => void): Drag {
    const drag = new ScrollDragController({
      delegate: this,
      details,
      onDragCanceled: dragCancelCallback,
      carriedVelocity: this.physics.carriedMomentum(this.heldPreviousVelocity),
      motionStartDistanceThreshold: this.physics.dragStartDistanceMotionThreshold,
    });
    this.beginActivity(new DragScrollActivity(this, drag));
    invariant(
      this.currentDrag === null,
      'duplicate-scroll-drag',
      'A position can own only one drag',
    );
    this.currentDrag = drag;
    return drag;
  }
  override dispose(): void {
    const drag = this.currentDrag;
    this.currentDrag = null;
    try {
      drag?.dispose();
    } finally {
      super.dispose();
    }
  }
}
