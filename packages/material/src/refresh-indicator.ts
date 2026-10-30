// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Doroti Material refresh responsibility on canonical Core scroll/ticker/animation owners.
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AlwaysStoppedAnimation } from '@nelyx/core/framework/animation/animations';
import { Tween, ColorTween, CurveTween } from '@nelyx/core/framework/animation/tween';
import { Interval } from '@nelyx/core/framework/animation/curves';
import { TickerCanceled } from '@nelyx/core/framework/animation/ticker-future';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import {
  ScrollNotification,
  ScrollStartNotification,
  ScrollUpdateNotification,
  OverscrollNotification,
  ScrollEndNotification,
  defaultScrollNotificationPredicate,
} from '@nelyx/core/framework/widgets/scroll-notification';
import type { ScrollNotificationPredicate } from '@nelyx/core/framework/widgets/scroll-notification';
import { OverscrollIndicatorNotification } from '@nelyx/core/framework/widgets/overscroll-indicator';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Stack, Positioned, Padding, Align, SizedBox } from '@nelyx/core/framework/widgets/basic';
import {
  SizeTransition,
  ScaleTransition,
  AnimatedBuilder,
} from '@nelyx/core/framework/widgets/transitions';
import { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { CupertinoActivityIndicator } from '@nelyx/cupertino/activity-indicator';
import { RefreshProgressIndicator } from './progress-indicator.ts';
import { Theme } from './theme.ts';
import { MaterialLocalizations } from './material-localizations.ts';

export const RefreshIndicatorStatus = Object.freeze({
  drag: 'drag',
  armed: 'armed',
  snap: 'snap',
  refresh: 'refresh',
  done: 'done',
  canceled: 'canceled',
} as const);
export type RefreshIndicatorStatus =
  (typeof RefreshIndicatorStatus)[keyof typeof RefreshIndicatorStatus];
export const RefreshIndicatorTriggerMode = Object.freeze({
  anywhere: 'anywhere',
  onEdge: 'onEdge',
} as const);
export type RefreshIndicatorTriggerMode =
  (typeof RefreshIndicatorTriggerMode)[keyof typeof RefreshIndicatorTriggerMode];
export type RefreshCallback = () => Promise<void>;
export interface RefreshIndicatorOptions extends WidgetOptions {
  readonly child: Widget;
  readonly onRefresh: RefreshCallback;
  /** @dartType double */ readonly displacement?: number;
  /** @dartType double */ readonly edgeOffset?: number;
  readonly color?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly notificationPredicate?: ScrollNotificationPredicate;
  readonly semanticsLabel?: string | null;
  readonly semanticsValue?: string | null;
  /** @dartType double */ readonly strokeWidth?: number;
  readonly triggerMode?: RefreshIndicatorTriggerMode;
  /** @dartType double */ readonly elevation?: number;
}
export interface RefreshIndicatorNoSpinnerOptions extends Omit<
  RefreshIndicatorOptions,
  'displacement' | 'edgeOffset' | 'color' | 'backgroundColor' | 'strokeWidth'
> {
  readonly onStatusChange?: ((status: RefreshIndicatorStatus | null) => void) | null;
}
type IndicatorType = 'material' | 'adaptive' | 'noSpinner';
const namedOptions = new WeakMap<
  RefreshIndicatorOptions,
  { type: IndicatorType; callback: ((status: RefreshIndicatorStatus | null) => void) | null }
>();
const indicatorTypes = new WeakMap<RefreshIndicator, IndicatorType>();
export class RefreshIndicator extends StatefulWidget {
  readonly child: Widget;
  readonly onRefresh: RefreshCallback;
  readonly onStatusChange: ((status: RefreshIndicatorStatus | null) => void) | null;
  /** @dartType double */ readonly displacement: number;
  /** @dartType double */ readonly edgeOffset: number;
  readonly color: Color | null;
  readonly backgroundColor: Color | null;
  readonly notificationPredicate: ScrollNotificationPredicate;
  readonly semanticsLabel: string | null;
  readonly semanticsValue: string | null;
  /** @dartType double */ readonly strokeWidth: number;
  readonly triggerMode: RefreshIndicatorTriggerMode;
  /** @dartType double */ readonly elevation: number;
  constructor(options: RefreshIndicatorOptions) {
    super(options.key ?? null);
    const named = namedOptions.get(options);
    indicatorTypes.set(this, named?.type ?? 'material');
    this.child = options.child;
    this.onRefresh = options.onRefresh;
    this.onStatusChange = named?.callback ?? null;
    this.displacement = options.displacement ?? 40;
    this.edgeOffset = options.edgeOffset ?? 0;
    this.color = options.color ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.notificationPredicate =
      options.notificationPredicate ?? defaultScrollNotificationPredicate;
    this.semanticsLabel = options.semanticsLabel ?? null;
    this.semanticsValue = options.semanticsValue ?? null;
    this.strokeWidth = options.strokeWidth ?? RefreshProgressIndicator.defaultStrokeWidth;
    this.triggerMode = options.triggerMode ?? RefreshIndicatorTriggerMode.onEdge;
    this.elevation = options.elevation ?? 2;
    invariant(
      Number.isFinite(this.elevation) && this.elevation >= 0,
      'invalid-refresh-elevation',
      'Refresh elevation must be finite and nonnegative',
    );
    invariant(
      typeof this.onRefresh === 'function' && typeof this.notificationPredicate === 'function',
      'invalid-refresh-callback',
      'Refresh requires callback functions',
    );
    invariant(
      Object.values(RefreshIndicatorTriggerMode).includes(this.triggerMode),
      'invalid-refresh-trigger',
      'Refresh trigger mode must be onEdge or anywhere',
    );
    Object.freeze(this);
  }
  static adaptive(options: RefreshIndicatorOptions): RefreshIndicator {
    return RefreshIndicator.named(options, 'adaptive', null);
  }
  static noSpinner(options: RefreshIndicatorNoSpinnerOptions): RefreshIndicator {
    return RefreshIndicator.named(
      {
        key: options.key ?? null,
        onRefresh: options.onRefresh,
        child: options.child,
        notificationPredicate: options.notificationPredicate ?? defaultScrollNotificationPredicate,
        semanticsLabel: options.semanticsLabel ?? null,
        semanticsValue: options.semanticsValue ?? null,
        triggerMode: options.triggerMode ?? RefreshIndicatorTriggerMode.onEdge,
        elevation: options.elevation ?? 2,
        displacement: 0,
        edgeOffset: 0,
        color: null,
        backgroundColor: null,
        strokeWidth: 0,
      },
      'noSpinner',
      options.onStatusChange ?? null,
    );
  }
  private static named(
    options: RefreshIndicatorOptions,
    type: IndicatorType,
    callback: ((status: RefreshIndicatorStatus | null) => void) | null,
  ): RefreshIndicator {
    const input: RefreshIndicatorOptions = {
      key: options.key ?? null,
      onRefresh: options.onRefresh,
      child: options.child,
      displacement: options.displacement ?? 40,
      edgeOffset: options.edgeOffset ?? 0,
      color: options.color ?? null,
      backgroundColor: options.backgroundColor ?? null,
      notificationPredicate: options.notificationPredicate ?? defaultScrollNotificationPredicate,
      semanticsLabel: options.semanticsLabel ?? null,
      semanticsValue: options.semanticsValue ?? null,
      strokeWidth: options.strokeWidth ?? RefreshProgressIndicator.defaultStrokeWidth,
      triggerMode: options.triggerMode ?? RefreshIndicatorTriggerMode.onEdge,
      elevation: options.elevation ?? 2,
    };
    namedOptions.set(input, { type, callback });
    try {
      return new RefreshIndicator(input);
    } finally {
      namedOptions.delete(input);
    }
  }
  override createState(): RefreshIndicatorState {
    return new RefreshIndicatorState();
  }
}
interface RefreshRequest {
  readonly future: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  started: boolean;
  complete: (() => void) | null;
  report: ((error: unknown) => void) | null;
}
/** The application continuation holds a cleared-on-dispose token, never a State or View. */
function finishRequest(request: RefreshRequest, failed: boolean, error?: unknown): void {
  const complete = request.complete,
    report = request.report;
  request.complete = null;
  request.report = null;
  if (failed) request.reject(error);
  else request.resolve();
  complete?.();
  if (failed) report?.(error);
}
export class RefreshIndicatorState extends TickerProviderStateMixin<RefreshIndicator> {
  private position!: AnimationController;
  private scale!: AnimationController;
  /** @dartType Animation<double> */ private positionFactor!: Animation<number>;
  /** @dartType Animation<double> */ private scaleFactor!: Animation<number>;
  /** @dartType Animation<double> */ private value!: Animation<number>;
  private valueColor!: Animation<Color | null>;
  private effectiveColor!: Color;
  private status: RefreshIndicatorStatus | null = null;
  private indicatorAtTop: boolean | null = null;
  /** @dartType double? */ private dragOffset: number | null = null;
  private request: RefreshRequest | null = null;
  private revision = 0;
  private retired = false;
  override initState(): void {
    super.initState();
    this.position = new AnimationController({ vsync: this });
    this.scale = new AnimationController({ vsync: this });
    this.positionFactor = this.position.drive(new Tween({ begin: 0, end: 1.5 }));
    this.value = this.position.drive(new Tween({ begin: 0, end: 0.75 }));
    this.scaleFactor = this.scale.drive(new Tween({ begin: 1, end: 0 }));
  }
  override didChangeDependencies(): void {
    this.setupColor();
    super.didChangeDependencies();
  }
  override didUpdateWidget(old: RefreshIndicator): void {
    super.didUpdateWidget(old);
    if (old.color !== this.widget.color) this.setupColor();
  }
  private setupColor(): void {
    this.effectiveColor =
      this.widget.color ?? new Color(Theme.of(this.context).colorScheme.primary);
    const color = this.effectiveColor;
    this.valueColor =
      color.alpha === 0
        ? new AlwaysStoppedAnimation<Color>(color)
        : this.position.drive(
            new ColorTween({ begin: color.withAlpha(0), end: color.withAlpha(color.alpha) }).chain(
              new CurveTween({ curve: new Interval(0, 1 / 1.5) }),
            ),
          );
  }
  private start(direction: AxisDirection): boolean {
    if (direction !== AxisDirection.down && direction !== AxisDirection.up) return false;
    // Pinned source treats both supported vertical directions as the top indicator.
    this.indicatorAtTop = true;
    this.dragOffset = 0;
    this.scale.value = 0;
    this.position.value = 0;
    return true;
  }
  private setStatus(status: RefreshIndicatorStatus, notify = true): void {
    this.setState(() => {
      this.status = status;
      if (notify) this.widget.onStatusChange?.(status);
    });
  }
  private shouldStart(notification: ScrollNotification): boolean {
    return (
      ((notification instanceof ScrollStartNotification && notification.dragDetails !== null) ||
        (notification instanceof ScrollUpdateNotification &&
          notification.dragDetails !== null &&
          this.widget.triggerMode === RefreshIndicatorTriggerMode.anywhere)) &&
      ((notification.metrics.axisDirection === AxisDirection.up &&
        notification.metrics.extentAfter === 0) ||
        (notification.metrics.axisDirection === AxisDirection.down &&
          notification.metrics.extentBefore === 0)) &&
      this.status === null &&
      this.start(notification.metrics.axisDirection)
    );
  }
  private readonly scrollNotification = (notification: ScrollNotification): boolean => {
    if (!this.widget.notificationPredicate(notification)) return false;
    if (this.shouldStart(notification)) {
      this.setStatus(RefreshIndicatorStatus.drag);
      return false;
    }
    const direction = notification.metrics.axisDirection,
      topNow = direction === AxisDirection.down || direction === AxisDirection.up ? true : null;
    if (topNow !== this.indicatorAtTop) {
      if (
        this.status === RefreshIndicatorStatus.drag ||
        this.status === RefreshIndicatorStatus.armed
      )
        void this.dismiss(RefreshIndicatorStatus.canceled);
    } else if (notification instanceof ScrollUpdateNotification) {
      if (
        this.status === RefreshIndicatorStatus.drag ||
        this.status === RefreshIndicatorStatus.armed
      ) {
        invariant(
          notification.scrollDelta !== null,
          'missing-refresh-scroll-delta',
          'Drag scroll updates require a scroll delta',
        );
        this.dragOffset =
          this.dragOffset! +
          (direction === AxisDirection.down ? -notification.scrollDelta : notification.scrollDelta);
        this.checkDragOffset(notification.metrics.viewportDimension);
      }
      if (this.status === RefreshIndicatorStatus.armed && notification.dragDetails === null)
        this.showIndicator(true);
    } else if (notification instanceof OverscrollNotification) {
      if (
        this.status === RefreshIndicatorStatus.drag ||
        this.status === RefreshIndicatorStatus.armed
      ) {
        this.dragOffset =
          this.dragOffset! +
          (direction === AxisDirection.down ? -notification.overscroll : notification.overscroll);
        this.checkDragOffset(notification.metrics.viewportDimension);
      }
    } else if (notification instanceof ScrollEndNotification) {
      if (this.status === RefreshIndicatorStatus.armed) {
        if (this.position.value < 1) void this.dismiss(RefreshIndicatorStatus.canceled);
        else this.showIndicator(true);
      } else if (this.status === RefreshIndicatorStatus.drag)
        void this.dismiss(RefreshIndicatorStatus.canceled);
    }
    return false;
  };
  private readonly indicatorNotification = (
    notification: OverscrollIndicatorNotification,
  ): boolean => {
    if (
      notification.depth !== 0 ||
      !notification.leading ||
      this.status !== RefreshIndicatorStatus.drag
    )
      return false;
    notification.disallowIndicator();
    return true;
  };
  /** @dartParam containerExtent double */
  private checkDragOffset(containerExtent: number): void {
    let next = this.dragOffset! / (containerExtent * 0.25);
    if (this.status === RefreshIndicatorStatus.armed) next = Math.max(next, 1 / 1.5);
    this.position.value = clampDouble(next, 0, 1);
    if (
      this.status === RefreshIndicatorStatus.drag &&
      this.valueColor.value!.alpha === this.effectiveColor.alpha
    ) {
      this.status = RefreshIndicatorStatus.armed;
      this.widget.onStatusChange?.(this.status);
    }
  }
  private async dismiss(
    mode: typeof RefreshIndicatorStatus.canceled | typeof RefreshIndicatorStatus.done,
  ): Promise<void> {
    const revision = ++this.revision;
    await Promise.resolve();
    if (this.retired || !this.mounted || revision !== this.revision) return;
    this.setStatus(mode);
    try {
      await (
        mode === RefreshIndicatorStatus.done
          ? this.scale.animateTo(1, { duration: 200 })
          : this.position.animateTo(0, { duration: 200 })
      ).orCancel;
    } catch (error) {
      if (!(error instanceof TickerCanceled)) throw error;
      return;
    }
    if (!this.retired && this.mounted && revision === this.revision && this.status === mode) {
      this.dragOffset = null;
      this.indicatorAtTop = null;
      this.setState(() => {
        this.status = null;
      });
    }
  }
  private showIndicator(gesture: boolean): Promise<void> {
    const revision = ++this.revision;
    let resolve!: () => void, reject!: (error: unknown) => void;
    const future = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    const request: RefreshRequest = {
      future,
      resolve,
      reject,
      started: false,
      complete: () => {
        if (this.request === request) {
          this.request = null;
          if (!this.retired && this.mounted && this.status === RefreshIndicatorStatus.refresh)
            void this.dismiss(RefreshIndicatorStatus.done);
        }
      },
      report: gesture
        ? (this.context.services.reportError ??
          ((error) =>
            FlutterError.reportError(
              new FlutterErrorDetails({ exception: error, library: 'material refresh' }),
            )))
        : null,
    };
    this.request = request;
    if (gesture) void future.catch(() => {});
    this.setStatus(RefreshIndicatorStatus.snap);
    void this.position.animateTo(1 / 1.5, { duration: 150 }).orCancel.then(
      () => {
        if (
          this.retired ||
          !this.mounted ||
          revision !== this.revision ||
          this.status !== RefreshIndicatorStatus.snap
        )
          return;
        this.setStatus(RefreshIndicatorStatus.refresh, false);
        request.started = true;
        const callback = this.widget.onRefresh;
        // The callback and token are the only values retained by application async work.
        let result: Promise<void>;
        try {
          result = callback();
        } catch (error) {
          finishRequest(request, true, error);
          return;
        }
        void Promise.resolve(result).then(
          () => finishRequest(request, false),
          (error) => finishRequest(request, true, error),
        );
      },
      (error) => {
        if (!request.started) {
          request.complete = null;
          request.report = null;
          request.reject(error);
        }
      },
    );
    return future;
  }
  /** Completes with application work; disposal cancels an unadmitted snap, and detaches admitted UI work. */
  show({ atTop = true }: { readonly atTop?: boolean } = {}): Promise<void> {
    invariant(
      !this.retired && this.mounted,
      'unmounted-refresh-indicator',
      'Refresh show requires a mounted State',
    );
    if (
      this.status === RefreshIndicatorStatus.refresh ||
      this.status === RefreshIndicatorStatus.snap
    )
      return this.request!.future;
    if (this.status === null) this.start(atTop ? AxisDirection.down : AxisDirection.up);
    return this.showIndicator(false);
  }
  override build(context: BuildContext): Widget {
    const child = new NotificationListener({
      notificationType: ScrollNotification,
      onNotification: this.scrollNotification,
      child: new NotificationListener({
        notificationType: OverscrollIndicatorNotification,
        onNotification: this.indicatorNotification,
        child: this.widget.child,
      }),
    });
    if (this.status === null) return new Stack([child]);
    const indeterminate =
      this.status === RefreshIndicatorStatus.refresh || this.status === RefreshIndicatorStatus.done;
    const indicator = new AnimatedBuilder({
      animation: this.position,
      builder: (context) => {
        const type = indicatorTypes.get(this.widget)!;
        if (type === 'noSpinner') return new SizedBox();
        if (type === 'adaptive' && ['iOS', 'macOS'].includes(Theme.of(context).platform))
          return new CupertinoActivityIndicator({ color: this.widget.color });
        return new RefreshProgressIndicator({
          semanticsLabel:
            this.widget.semanticsLabel ??
            MaterialLocalizations.of(context).refreshIndicatorSemanticLabel,
          semanticsValue: this.widget.semanticsValue,
          value: indeterminate ? null : this.value.value,
          valueColor: this.valueColor,
          backgroundColor: this.widget.backgroundColor,
          strokeWidth: this.widget.strokeWidth,
          elevation: this.widget.elevation,
        });
      },
    });
    const content = new SizeTransition({
      sizeFactor: this.positionFactor,
      alignment: new AlignmentDirectional(-1, this.indicatorAtTop ? 1 : -1),
      child: new Padding(
        this.indicatorAtTop
          ? EdgeInsets.only({ top: this.widget.displacement })
          : EdgeInsets.only({ bottom: this.widget.displacement }),
        new Align(new ScaleTransition({ scale: this.scaleFactor, child: indicator }), {
          alignment: this.indicatorAtTop ? Alignment.topCenter : Alignment.bottomCenter,
        }),
      ),
    });
    return new Stack([
      child,
      new Positioned(content, {
        left: 0,
        right: 0,
        ...(this.indicatorAtTop
          ? { top: this.widget.edgeOffset }
          : { bottom: this.widget.edgeOffset }),
      }),
    ]);
  }
  override dispose(): void {
    this.retired = true;
    this.revision++;
    const request = this.request;
    this.request = null;
    if (request) {
      request.complete = null;
      request.report = null;
      if (!request.started) request.reject(new TickerCanceled());
    }
    this.position.dispose();
    this.scale.dispose();
    super.dispose();
  }
}
