// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AxisDirection } from '../painting/basic-types.ts';
import type { Clip } from '../../ui/clip.ts';
import type { ScrollController } from './scroll-controller.ts';
import type { ScrollPhysics } from './scroll-physics.ts';
import type { ScrollMetrics } from './scroll-metrics.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { protect } from '../../ui/value-math.ts';
import { Scrollable } from './scrollable.ts';
import type { ScrollableState } from './scrollable.ts';
import { PrimaryScrollController } from './primary-scroll-controller.ts';
import { Intent, ContextAction } from './actions.ts';
import type { BuildContext } from './framework.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorSummary, ErrorDescription, ErrorHint } from '../../foundation/diagnostics.ts';
import { hashValues } from '../painting/value-equality.ts';
import { Axis, axisDirectionToAxis, axisDirectionIsReversed } from '../painting/basic-types.ts';
import { RenderBox } from '../rendering/object.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Rect } from '../../ui/rect.ts';
import { Curves } from '../animation/curves.ts';
import { invariant } from '../../foundation/errors.ts';
export interface ScrollableDetailsOptions {
  readonly direction: AxisDirection;
  readonly controller?: ScrollController | null;
  readonly physics?: ScrollPhysics | null;
  readonly clipBehavior?: Clip | null;
  readonly decorationClipBehavior?: Clip | null;
}
export class ScrollableDetails {
  readonly direction: AxisDirection;
  readonly controller: ScrollController | null;
  readonly physics: ScrollPhysics | null;
  readonly decorationClipBehavior: Clip | null;
  constructor({
    direction,
    controller = null,
    physics = null,
    clipBehavior = null,
    decorationClipBehavior = null,
  }: ScrollableDetailsOptions) {
    this.direction = direction;
    this.controller = controller;
    this.physics = physics;
    this.decorationClipBehavior = clipBehavior ?? decorationClipBehavior;
    protect(this, ['direction', 'controller', 'physics', 'decorationClipBehavior']);
  }
  static vertical({
    reverse = false,
    ...options
  }: Omit<ScrollableDetailsOptions, 'direction' | 'clipBehavior'> & {
    readonly reverse?: boolean;
  } = {}): ScrollableDetails {
    return new ScrollableDetails({
      ...options,
      direction: reverse ? AxisDirection.up : AxisDirection.down,
    });
  }
  static horizontal({
    reverse = false,
    ...options
  }: Omit<ScrollableDetailsOptions, 'direction' | 'clipBehavior'> & {
    readonly reverse?: boolean;
  } = {}): ScrollableDetails {
    return new ScrollableDetails({
      ...options,
      direction: reverse ? AxisDirection.left : AxisDirection.right,
    });
  }
  get clipBehavior(): Clip | null {
    return this.decorationClipBehavior;
  }
  copyWith({
    direction,
    controller,
    physics,
    decorationClipBehavior,
  }: Partial<ScrollableDetailsOptions> = {}): ScrollableDetails {
    return new ScrollableDetails({
      direction: direction ?? this.direction,
      controller: controller ?? this.controller,
      physics: physics ?? this.physics,
      decorationClipBehavior: decorationClipBehavior ?? this.decorationClipBehavior,
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof ScrollableDetails &&
        other.constructor === this.constructor &&
        other.direction === this.direction &&
        other.controller === this.controller &&
        other.physics === this.physics &&
        other.decorationClipBehavior === this.decorationClipBehavior)
    );
  }
  get hashCode(): number {
    return hashValues(this.direction, this.controller, this.physics, this.decorationClipBehavior);
  }
  toString(): string {
    const values = ['axisDirection: ' + this.direction];
    if (this.controller !== null) values.push('scroll controller: ' + this.controller);
    if (this.physics !== null) values.push('scroll physics: ' + this.physics);
    if (this.decorationClipBehavior !== null)
      values.push('decorationClipBehavior: Clip.' + this.decorationClipBehavior);
    return `${describeIdentity(this)}(${values.join(', ')})`;
  }
}
export class ScrollIncrementType {
  static readonly line = new ScrollIncrementType(0, 'line');
  static readonly page = new ScrollIncrementType(1, 'page');
  static readonly values = Object.freeze([this.line, this.page]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'ScrollIncrementType.' + this.name;
  }
}
export class ScrollIncrementDetails {
  readonly type: ScrollIncrementType;
  readonly metrics: ScrollMetrics;
  constructor(options: { readonly type: ScrollIncrementType; readonly metrics: ScrollMetrics });
  constructor(type: ScrollIncrementType, metrics: ScrollMetrics);
  constructor(
    options:
      | ScrollIncrementType
      | { readonly type: ScrollIncrementType; readonly metrics: ScrollMetrics },
    metrics?: ScrollMetrics,
  ) {
    if (options instanceof ScrollIncrementType) {
      invariant(
        metrics !== undefined,
        'missing-scroll-increment-metrics',
        'Scroll increment details require metrics',
      );
      this.type = options;
      this.metrics = metrics;
    } else {
      this.type = options.type;
      this.metrics = options.metrics;
    }
    protect(this, ['type', 'metrics']);
  }
}
export type ScrollIncrementCalculator = (details: ScrollIncrementDetails) => number;
export class ScrollIntent extends Intent {
  readonly direction: AxisDirection;
  readonly type: ScrollIncrementType;
  constructor({
    direction,
    type = ScrollIncrementType.line,
  }: {
    readonly direction: AxisDirection;
    readonly type?: ScrollIncrementType;
  }) {
    super();
    this.direction = direction;
    this.type = type;
    protect(this, ['direction', 'type']);
  }
}
export class ScrollAction extends ContextAction<ScrollIntent> {
  constructor() {
    super(ScrollIntent);
  }
  override isEnabled(_intent: ScrollIntent, context?: BuildContext | null): boolean {
    if (context == null) return false;
    if (Scrollable.maybeOf(context) !== null) return true;
    const primary = PrimaryScrollController.maybeOf(context);
    return primary !== null && primary.hasClients;
  }
  private static calculateIncrement(state: ScrollableState, type: ScrollIncrementType): number {
    if (FoundationBuildMode.debug) {
      invariant(
        state.position.hasPixels,
        'unlaid-scroll-action',
        'Scroll position must have pixels',
      );
      invariant(
        state.resolvedPhysics === null ||
          state.resolvedPhysics.shouldAcceptUserOffset(state.position),
        'blocked-scroll-action-increment',
        'Scroll physics must accept user offsets',
      );
    }
    if (state.widget.incrementCalculator !== null)
      return state.widget.incrementCalculator(
        new ScrollIncrementDetails({ type, metrics: state.position }),
      );
    return type === ScrollIncrementType.line ? 50 : 0.8 * state.position.viewportDimension;
  }
  static getDirectionalIncrement(state: ScrollableState, intent: ScrollIntent): number {
    if (axisDirectionToAxis(intent.direction) !== axisDirectionToAxis(state.axisDirection))
      return 0;
    const increment = ScrollAction.calculateIncrement(state, intent.type);
    return intent.direction === state.axisDirection ? increment : -increment;
  }
  override invoke(intent: ScrollIntent, context?: BuildContext | null): void {
    if (FoundationBuildMode.debug)
      invariant(
        context != null,
        'missing-scroll-action-context',
        'Cannot scroll without a context.',
      );
    let state = Scrollable.maybeOf(context!);
    if (state === null) {
      const primary = PrimaryScrollController.of(context!);
      if (FoundationBuildMode.debug && [...primary.positions].length !== 1)
        throw FlutterError.fromParts([
          new ErrorSummary(
            'A ScrollAction was invoked with the PrimaryScrollController, but more than one ScrollPosition is attached.',
          ),
          new ErrorDescription(
            'Only one ScrollPosition can be manipulated by a ScrollAction at a time.',
          ),
          new ErrorHint(
            'The PrimaryScrollController can be inherited automatically by descendant ScrollViews based on the TargetPlatform and scroll direction. By default, the PrimaryScrollController is automatically inherited on mobile platforms for vertical ScrollViews. ScrollView.primary can also override this behavior.',
          ),
        ]);
      const notification = primary.position.context.notificationContext;
      if (notification !== null) state = Scrollable.maybeOf(notification);
      if (state === null) return;
    }
    if (FoundationBuildMode.debug)
      invariant(
        state.position.hasPixels,
        'unlaid-scroll-action',
        'Scrollable must be laid out before it can be scrolled via a ScrollAction',
      );
    if (
      state.resolvedPhysics !== null &&
      !state.resolvedPhysics.shouldAcceptUserOffset(state.position)
    )
      return;
    const increment = ScrollAction.getDirectionalIncrement(state, intent);
    if (increment === 0) return;
    const services = context!.services;
    void state.position
      .moveTo(state.position.pixels + increment, { duration: 100, curve: Curves.easeInOut })
      .catch((exception) => {
        if (services.reportError) services.reportError(exception);
        else
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'widgets library' }),
          );
      });
  }
}
/** Pinned edge-scroll algorithm. Generation and mounted checks protect asynchronous View retirement. */
export class EdgeDraggingAutoScroller {
  readonly velocityScalar: number;
  readonly onScrollViewScrolled: (() => void) | null;
  private target: Rect = Rect.zero;
  private active = false;
  private generation = 0;
  constructor(
    readonly scrollable: ScrollableState,
    {
      velocityScalar,
      onScrollViewScrolled = null,
    }: { readonly velocityScalar: number; readonly onScrollViewScrolled?: (() => void) | null },
  ) {
    invariant(
      Number.isFinite(velocityScalar) && velocityScalar > 0,
      'invalid-auto-scroll-velocity',
      'Edge scroll velocity scalar must be finite and positive',
    );
    this.velocityScalar = velocityScalar;
    this.onScrollViewScrolled = onScrollViewScrolled;
  }
  get scrolling(): boolean {
    return this.active;
  }
  startAutoScrollIfNecessary(dragTarget: Rect): void {
    if (
      !this.scrollable.mounted ||
      (this.scrollable.resolvedPhysics !== null &&
        !this.scrollable.resolvedPhysics.shouldAcceptUserOffset(this.scrollable.position))
    ) {
      this.stopAutoScroll();
      return;
    }
    const origin = this.scrollable.deltaToScrollOrigin;
    this.target = dragTarget.translate(origin.dx, origin.dy);
    if (this.active) return;
    this.active = true;
    const generation = ++this.generation;
    void this.scroll(generation).catch((error) => {
      if (generation === this.generation) {
        this.active = false;
        if (this.scrollable.mounted) this.scrollable.context.services.reportError?.(error);
      }
    });
  }
  stopAutoScroll(): void {
    this.active = false;
    this.generation++;
  }
  private async scroll(generation: number): Promise<void> {
    while (this.active && generation === this.generation && this.scrollable.mounted) {
      if (
        this.scrollable.resolvedPhysics !== null &&
        !this.scrollable.resolvedPhysics.shouldAcceptUserOffset(this.scrollable.position)
      ) {
        this.active = false;
        return;
      }
      const render = this.scrollable.context.findRenderObject();
      invariant(
        render instanceof RenderBox && render.hasSize,
        'missing-auto-scroll-render-box',
        'Edge scrolling requires a mounted sized Scrollable',
      );
      const transform = Matrix4.fromList(render.getTransformTo(null)),
        globalRect = MatrixUtils.transformRect(
          transform,
          Rect.fromLTWH(0, 0, render.size.width, render.size.height),
        ),
        targetBounds = MatrixUtils.transformRect(transform, this.target);
      invariant(
        globalRect.width + 1e-10 >= targetBounds.width &&
          globalRect.height + 1e-10 >= targetBounds.height,
        'oversized-auto-scroll-target',
        'Drag target cannot exceed the viewport size',
      );
      const axis = axisDirectionToAxis(this.scrollable.axisDirection),
        origin = this.scrollable.deltaToScrollOrigin,
        start = axis === Axis.vertical ? globalRect.top + origin.dy : globalRect.left + origin.dx,
        end = start + (axis === Axis.vertical ? globalRect.height : globalRect.width),
        proxyStart = axis === Axis.vertical ? this.target.top : this.target.left,
        proxyEnd = axis === Axis.vertical ? this.target.bottom : this.target.right,
        position = this.scrollable.position;
      let next: number | null = null;
      const reversed = axisDirectionIsReversed(this.scrollable.axisDirection),
        before = reversed ? proxyEnd > end : proxyStart < start,
        after = reversed ? proxyStart < start : proxyEnd > end;
      if (before && position.pixels > position.minScrollExtent)
        next = Math.max(
          position.minScrollExtent,
          position.pixels - Math.min(reversed ? proxyEnd - end : start - proxyStart, 20),
        );
      else if (after && position.pixels < position.maxScrollExtent)
        next = Math.min(
          position.maxScrollExtent,
          position.pixels + Math.min(reversed ? start - proxyStart : proxyEnd - end, 20),
        );
      if (next === null || Math.abs(next - position.pixels) < 1) {
        this.active = false;
        return;
      }
      const duration = Math.round(1000 / this.velocityScalar);
      invariant(
        duration > 0,
        'zero-auto-scroll-duration',
        'Velocity scalar must produce a positive animation duration',
      );
      await position.animateTo(next, { duration, curve: Curves.linear });
      if (!this.active || generation !== this.generation) return;
      if (!this.scrollable.mounted) {
        this.active = false;
        return;
      }
      this.onScrollViewScrolled?.();
    }
    if (generation === this.generation) this.active = false;
  }
}
