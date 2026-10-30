// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Notification, LayoutChangedNotification } from './notification-listener.ts';
import type { NotificationType } from './notification-listener.ts';
import type { BuildContext, Element, NotifiableElementTarget } from './framework.ts';
import type { ScrollMetrics } from './scroll-metrics.ts';
import type {
  DragStartDetails,
  DragUpdateDetails,
  DragEndDetails,
} from '../gestures/drag-details.ts';
import type { ScrollDirection } from '../rendering/viewport-offset.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { fixed, protect } from '../../ui/value-math.ts';
export interface ViewportNotification {
  readonly depth: number;
  _incrementDepth(): void;
  _setDepth(value: number): void;
}
type ViewportNotificationConstructor<Base extends NotificationType<Notification>> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & ViewportNotification;
const viewportNotifications = new WeakSet<Notification>();
export function isViewportNotification(
  value: Notification,
): value is Notification & ViewportNotification {
  return viewportNotifications.has(value);
}
export function ViewportNotificationMixin<Base extends NotificationType<Notification>>(
  Base: Base,
): ViewportNotificationConstructor<Base> {
  abstract class ViewportNotification extends Base {
    protected _depth = 0;
    constructor(...args: any[]) {
      super(...args);
      viewportNotifications.add(this);
    }
    get depth(): number {
      return this._depth;
    }
    _incrementDepth(): void {
      this._depth++;
    }
    _setDepth(value: number): void {
      invariant(
        Number.isSafeInteger(value),
        'invalid-notification-depth',
        'Notification depth must be a safe integer',
      );
      this._depth = value;
    }
    protected override debugFillDescription(description: string[]): void {
      super.debugFillDescription(description);
      description.push(`depth: ${this.depth} (${this.depth === 0 ? 'local' : 'remote'})`);
    }
  }
  return ViewportNotification as unknown as ViewportNotificationConstructor<Base>;
}
type NotifiableConstructor = abstract new (...args: any[]) => Element & NotifiableElementTarget;
export function ViewportElementMixin<Base extends NotifiableConstructor>(Base: Base): Base {
  abstract class ViewportElement extends Base {
    constructor(...args: any[]) {
      super(...args);
    }
    onNotification(notification: Notification): boolean {
      if (isViewportNotification(notification)) notification._incrementDepth();
      return false;
    }
  }
  return ViewportElement as unknown as Base;
}
export interface ScrollNotificationOptions {
  readonly metrics: ScrollMetrics;
  readonly context: BuildContext | null;
}
export abstract class ScrollNotification extends ViewportNotificationMixin(
  LayoutChangedNotification,
) {
  readonly metrics: ScrollMetrics;
  readonly context: BuildContext | null;
  constructor({ metrics, context }: ScrollNotificationOptions) {
    super();
    this.metrics = metrics;
    this.context = context;
    protect(this, ['metrics', 'context']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    description.push('' + this.metrics);
  }
}
export class ScrollStartNotification extends ScrollNotification {
  readonly dragDetails: DragStartDetails | null;
  constructor({
    dragDetails = null,
    ...options
  }: ScrollNotificationOptions & { readonly dragDetails?: DragStartDetails | null }) {
    super(options);
    this.dragDetails = dragDetails;
    protect(this, ['dragDetails']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    if (this.dragDetails !== null) description.push('' + this.dragDetails);
  }
}
export interface ScrollUpdateNotificationOptions extends Omit<
  ScrollNotificationOptions,
  'context'
> {
  readonly context: BuildContext;
  readonly dragDetails?: DragUpdateDetails | null;
  readonly scrollDelta?: number | null;
  readonly depth?: number | null;
}
export class ScrollUpdateNotification extends ScrollNotification {
  readonly dragDetails: DragUpdateDetails | null;
  readonly scrollDelta: number | null;
  constructor({
    dragDetails = null,
    scrollDelta = null,
    depth,
    ...options
  }: ScrollUpdateNotificationOptions) {
    super(options);
    this.dragDetails = dragDetails;
    this.scrollDelta = scrollDelta;
    if (depth != null) this._setDepth(depth);
    protect(this, ['dragDetails', 'scrollDelta']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    description.push(
      'scrollDelta: ' +
        (this.scrollDelta === null ? 'null' : diagnosticDoubleString(this.scrollDelta)),
    );
    if (this.dragDetails !== null) description.push('' + this.dragDetails);
  }
}
export interface OverscrollNotificationOptions extends Omit<ScrollNotificationOptions, 'context'> {
  readonly context: BuildContext;
  readonly dragDetails?: DragUpdateDetails | null;
  readonly overscroll: number;
  readonly velocity?: number;
}
export class OverscrollNotification extends ScrollNotification {
  readonly dragDetails: DragUpdateDetails | null;
  readonly overscroll: number;
  readonly velocity: number;
  constructor({
    dragDetails = null,
    overscroll,
    velocity = 0,
    ...options
  }: OverscrollNotificationOptions) {
    super(options);
    if (FoundationBuildMode.debug)
      invariant(
        Number.isFinite(overscroll) && overscroll !== 0,
        'invalid-overscroll-notification',
        'Overscroll must be finite and nonzero',
      );
    this.dragDetails = dragDetails;
    this.overscroll = overscroll;
    this.velocity = velocity;
    protect(this, ['dragDetails', 'overscroll', 'velocity']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    description.push('overscroll: ' + fixed(this.overscroll), 'velocity: ' + fixed(this.velocity));
    if (this.dragDetails !== null) description.push('' + this.dragDetails);
  }
}
export class ScrollEndNotification extends ScrollNotification {
  readonly dragDetails: DragEndDetails | null;
  constructor({
    dragDetails = null,
    ...options
  }: ScrollNotificationOptions & { readonly dragDetails?: DragEndDetails | null }) {
    super(options);
    this.dragDetails = dragDetails;
    protect(this, ['dragDetails']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    if (this.dragDetails !== null) description.push('' + this.dragDetails);
  }
}
export class UserScrollNotification extends ScrollNotification {
  readonly direction: ScrollDirection;
  constructor({
    direction,
    ...options
  }: ScrollNotificationOptions & { readonly direction: ScrollDirection }) {
    super(options);
    this.direction = direction;
    protect(this, ['direction']);
  }
  protected override debugFillDescription(description: string[]): void {
    super.debugFillDescription(description);
    description.push('direction: ' + this.direction);
  }
}
export type ScrollNotificationPredicate = (notification: ScrollNotification) => boolean;
export function defaultScrollNotificationPredicate(notification: ScrollNotification): boolean {
  return notification.depth === 0;
}
