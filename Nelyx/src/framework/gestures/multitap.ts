// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/multitap.dart with actual View arena/router and owned timers.
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { EnumProperty, IntProperty } from '../../foundation/diagnostic-properties.ts';
import { invariant } from '../../foundation/errors.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { Offset } from '../../ui/offset.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import { GestureRecognizer, OffsetPair } from './recognizer.ts';
import type { GestureRecognizerOptions, GestureRecognizerTimerPort } from './recognizer.ts';
import type { GestureBinding } from './binding.ts';
import { GestureDisposition } from './arena.ts';
import type { GestureArenaEntry } from './arena.ts';
import type { PointerRoute } from './pointer-router.ts';
import type { DeviceGestureSettings } from './gesture-settings.ts';
import type { PositionedGestureDetails } from './gesture-details.ts';
import {
  PointerEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  kPrimaryButton,
  computeHitSlop,
} from './events.ts';
import { TapDownDetails, TapUpDetails } from './tap.ts';
import type { GestureTapDownCallback, GestureTapCancelCallback } from './tap.ts';
import {
  kDoubleTapMinTime,
  kDoubleTapSlop,
  kDoubleTapTouchSlop,
  kDoubleTapTimeout,
} from './constants.ts';
export type GestureDoubleTapCallback = () => void;
export type GestureMultiTapDownCallback = (pointer: number, details: TapDownDetails) => void;
export type GestureMultiTapUpCallback = (pointer: number, details: TapUpDetails) => void;
export type GestureMultiTapCallback = (pointer: number) => void;
export type GestureMultiTapCancelCallback = (pointer: number) => void;
function cleanup(operations: readonly (() => void)[], message: string): void {
  const errors: unknown[] = [];
  for (const operation of operations)
    try {
      operation();
    } catch (error) {
      errors.push(error);
    }
  if (errors.length) throw new AggregateError(errors, message);
}
class CountdownZoned {
  private timeoutValue = false;
  private timer: Disposable | null = null;
  private live = true;
  constructor(duration: number, timers: GestureRecognizerTimerPort) {
    this.timer = timers.after(duration, () => {
      if (!this.live) return;
      this.timer = null;
      this.timeoutValue = true;
    });
  }
  get timeout(): boolean {
    return this.timeoutValue;
  }
  dispose(): void {
    this.live = false;
    const timer = this.timer;
    this.timer = null;
    timer?.dispose();
  }
}
interface TapTrackerOptions {
  readonly event: PointerDownEvent;
  readonly entry: GestureArenaEntry;
  readonly doubleTapMinTime: number;
  readonly gestureSettings: DeviceGestureSettings | null;
  readonly binding: GestureBinding;
  readonly timers: GestureRecognizerTimerPort;
}
class TapTracker {
  readonly pointer: number;
  readonly entry: GestureArenaEntry;
  readonly initialButtons: number;
  readonly gestureSettings: DeviceGestureSettings | null;
  private readonly initialGlobalPosition: Offset;
  private readonly doubleTapMinTimeCountdown: CountdownZoned;
  private isTrackingPointer = false;
  constructor(options: TapTrackerOptions) {
    this.pointer = options.event.pointer;
    this.entry = options.entry;
    this.initialGlobalPosition = options.event.position;
    this.initialButtons = options.event.buttons;
    this.gestureSettings = options.gestureSettings;
    this.binding = options.binding;
    this.doubleTapMinTimeCountdown = new CountdownZoned(options.doubleTapMinTime, options.timers);
  }
  protected readonly binding: GestureBinding;
  startTrackingPointer(route: PointerRoute, transform: TransformMatrix | null): void {
    if (!this.isTrackingPointer) {
      this.binding.pointerRouter.addRoute(this.pointer, route, transform);
      this.isTrackingPointer = true;
    }
  }
  stopTrackingPointer(route: PointerRoute): void {
    if (this.isTrackingPointer) {
      this.isTrackingPointer = false;
      this.binding.pointerRouter.removeRoute(this.pointer, route);
    }
  }
  isWithinGlobalTolerance(event: PointerEvent, tolerance: number): boolean {
    return event.position.subtract(this.initialGlobalPosition).distance <= tolerance;
  }
  hasElapsedMinTime(): boolean {
    return this.doubleTapMinTimeCountdown.timeout;
  }
  hasSameButton(event: PointerDownEvent): boolean {
    return event.buttons === this.initialButtons;
  }
  releaseCountdown(): void {
    this.doubleTapMinTimeCountdown.dispose();
  }
  retire(route: PointerRoute): void {
    cleanup(
      [() => this.stopTrackingPointer(route), () => this.releaseCountdown()],
      'Tap tracker retirement failed',
    );
  }
}
export class DoubleTapGestureRecognizer extends GestureRecognizer {
  onDoubleTapDown: GestureTapDownCallback | null = null;
  onDoubleTap: GestureDoubleTapCallback | null = null;
  onDoubleTapCancel: GestureTapCancelCallback | null = null;
  private doubleTapTimer: Disposable | null = null;
  private timerGeneration = 0;
  private firstTap: TapTracker | null = null;
  private readonly trackers = new Map<number, TapTracker>();
  private readonly ownedTrackers = new Set<TapTracker>();
  private readonly heldTrackers = new Set<TapTracker>();
  private resetting = false;
  constructor(options: GestureRecognizerOptions) {
    super({
      ...options,
      allowedButtonsFilter:
        options.allowedButtonsFilter ?? ((buttons) => buttons === kPrimaryButton),
    });
  }
  protected override isPointerAllowed(event: PointerDownEvent): boolean {
    if (
      this.firstTap === null &&
      this.onDoubleTapDown === null &&
      this.onDoubleTap === null &&
      this.onDoubleTapCancel === null
    )
      return false;
    const allowed = super.isPointerAllowed(event);
    if (!allowed) this.reset();
    return allowed;
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    invariant(
      !this.resetting,
      'reentrant-double-tap-reset',
      'Cannot admit a contact during double-tap reset',
    );
    if (this.firstTap !== null) {
      if (!this.firstTap.isWithinGlobalTolerance(event, kDoubleTapSlop)) return;
      if (!this.firstTap.hasElapsedMinTime() || !this.firstTap.hasSameButton(event)) {
        this.reset();
        if (!this.isDisposed) this.trackTap(event);
        return;
      }
      if (this.onDoubleTapDown !== null) {
        const details = new TapDownDetails({
          globalPosition: event.position,
          localPosition: event.localPosition,
          kind: this.getKindForPointer(event.pointer),
        });
        this.invokeCallback('onDoubleTapDown', () => this.onDoubleTapDown!(details));
      }
    }
    if (!this.isDisposed) this.trackTap(event);
  }
  private trackTap(event: PointerDownEvent): void {
    this.stopDoubleTapTimer();
    const entry = this.binding.gestureArena.add(event.pointer, this);
    let tracker: TapTracker | undefined;
    try {
      tracker = new TapTracker({
        event,
        entry,
        doubleTapMinTime: kDoubleTapMinTime,
        gestureSettings: this.gestureSettings,
        binding: this.binding,
        timers: this.timers,
      });
      this.ownedTrackers.add(tracker);
      invariant(
        !this.trackers.has(event.pointer),
        'duplicate-double-tap-contact',
        'Double-tap requires a distinct source contact identifier',
      );
      this.trackers.set(event.pointer, tracker);
      tracker.startTrackingPointer(this.handleEvent, event.transform);
    } catch (error) {
      this.trackers.delete(event.pointer);
      cleanup(
        [
          () => {
            if (tracker) this.retireTracker(tracker);
          },
          () => entry.resolve(GestureDisposition.rejected),
          () => {
            throw error;
          },
        ],
        'Double-tap admission failed',
      );
    }
  }
  private readonly handleEvent = (event: PointerEvent) => {
    if (this.isDisposed || (this.binding.isClosed && !(event instanceof PointerCancelEvent)))
      return;
    const tracker = this.trackers.get(event.pointer);
    if (!tracker) return;
    try {
      if (event instanceof PointerUpEvent) {
        if (this.firstTap === null) this.registerFirstTap(tracker);
        else this.registerSecondTap(tracker);
      } else if (event instanceof PointerMoveEvent) {
        if (!tracker.isWithinGlobalTolerance(event, kDoubleTapTouchSlop)) this.reject(tracker);
      } else if (event instanceof PointerCancelEvent) this.reject(tracker);
    } catch (error) {
      try {
        this.reset();
      } catch (retirement) {
        throw new AggregateError([error, retirement], 'Double-tap dispatch failed');
      }
      throw error;
    }
  };
  /** Source ordinary arena wins intentionally do nothing. */
  override acceptGesture(_pointer: number): void {}
  override rejectGesture(pointer: number): void {
    if (this.isDisposed) return;
    let tracker = this.trackers.get(pointer);
    if (tracker === undefined && this.firstTap?.pointer === pointer) tracker = this.firstTap;
    if (tracker) this.reject(tracker);
  }
  private retireTracker(tracker: TapTracker): void {
    this.ownedTrackers.delete(tracker);
    tracker.retire(this.handleEvent);
  }
  private releaseHeldTracker(tracker: TapTracker): void {
    this.heldTrackers.delete(tracker);
    this.binding.gestureArena.release(tracker.pointer);
  }
  private reject(tracker: TapTracker): void {
    if (this.trackers.get(tracker.pointer) === tracker) this.trackers.delete(tracker.pointer);
    try {
      tracker.entry.resolve(GestureDisposition.rejected);
    } finally {
      this.retireTracker(tracker);
    }
    if (this.firstTap !== null) {
      if (tracker === this.firstTap) this.reset();
      else {
        this.checkCancel();
        if (this.trackers.size === 0) this.reset();
      }
    }
  }
  private reset(): void {
    if (this.resetting) return;
    this.resetting = true;
    const first = this.firstTap,
      hadTrackers = this.trackers.size !== 0;
    this.firstTap = null;
    const operations: (() => void)[] = [() => this.stopDoubleTapTimer()];
    if (first) {
      if (hadTrackers) operations.push(() => this.checkCancel());
      operations.push(
        () => this.reject(first),
        () => this.releaseHeldTracker(first),
      );
    }
    operations.push(() => this.clearTrackers());
    try {
      cleanup(operations, 'Double-tap reset failed');
    } finally {
      this.resetting = false;
    }
  }
  private registerFirstTap(tracker: TapTracker): void {
    let registered = false;
    try {
      this.startDoubleTapTimer();
      this.heldTrackers.add(tracker);
      this.binding.gestureArena.hold(tracker.pointer);
      this.freezeTracker(tracker);
      this.trackers.delete(tracker.pointer);
      this.clearTrackers();
      if (!this.isDisposed) {
        this.firstTap = tracker;
        registered = true;
      }
    } finally {
      if (!registered)
        cleanup(
          [
            () => this.retireTracker(tracker),
            () => tracker.entry.resolve(GestureDisposition.rejected),
            () => this.releaseHeldTracker(tracker),
          ],
          'First double-tap retirement failed',
        );
    }
  }
  private registerSecondTap(tracker: TapTracker): void {
    invariant(this.firstTap, 'missing-first-double-tap', 'No first tap is waiting');
    try {
      this.firstTap.entry.resolve(GestureDisposition.accepted);
      tracker.entry.resolve(GestureDisposition.accepted);
      this.freezeTracker(tracker);
      this.trackers.delete(tracker.pointer);
      this.checkUp(tracker.initialButtons);
    } finally {
      cleanup(
        [() => this.retireTracker(tracker), () => this.reset()],
        'Second double-tap retirement failed',
      );
    }
  }
  private clearTrackers(): void {
    const trackers = [...this.trackers.values()];
    cleanup(
      trackers.map((tracker) => () => this.reject(tracker)),
      'Double-tap trackers failed to retire',
    );
    invariant(
      this.trackers.size === 0,
      'retained-double-tap-tracker',
      'Double-tap tracker was not released',
    );
  }
  private freezeTracker(tracker: TapTracker): void {
    tracker.stopTrackingPointer(this.handleEvent);
  }
  private startDoubleTapTimer(): void {
    if (this.doubleTapTimer !== null) return;
    const generation = ++this.timerGeneration;
    this.doubleTapTimer = this.timers.after(kDoubleTapTimeout, () => {
      if (!this.isDisposed && !this.binding.isClosed && this.timerGeneration === generation)
        this.reset();
    });
  }
  private stopDoubleTapTimer(): void {
    this.timerGeneration++;
    const timer = this.doubleTapTimer;
    this.doubleTapTimer = null;
    timer?.dispose();
  }
  private checkUp(_buttons: number): void {
    if (this.onDoubleTap !== null) this.invokeCallback('onDoubleTap', this.onDoubleTap);
  }
  private checkCancel(): void {
    if (this.onDoubleTapCancel !== null)
      this.invokeCallback('onDoubleTapCancel', this.onDoubleTapCancel);
  }
  override dispose(): void {
    if (!this.beginDispose()) return;
    try {
      this.reset();
    } finally {
      this.firstTap = null;
      this.trackers.clear();
      const trackers = [...this.ownedTrackers],
        held = [...this.heldTrackers];
      this.ownedTrackers.clear();
      this.heldTrackers.clear();
      try {
        cleanup(
          [
            () => this.stopDoubleTapTimer(),
            ...trackers.flatMap((tracker) => [
              () => tracker.retire(this.handleEvent),
              () => tracker.entry.resolve(GestureDisposition.rejected),
            ]),
            ...held.map((tracker) => () => this.binding.gestureArena.release(tracker.pointer)),
          ],
          'Double-tap retirement failed',
        );
      } finally {
        this.finishDispose();
      }
    }
  }
  override get debugDescription(): string {
    return 'double tap';
  }
}
interface TapGestureOptions extends TapTrackerOptions {
  readonly owner: MultiTapGestureRecognizer;
  readonly longTapDelay: number;
  readonly dispatchCancel: (pointer: number) => void;
  readonly dispatchTap: (pointer: number, position: OffsetPair) => void;
  readonly dispatchLongTap: (pointer: number, position: OffsetPair) => void;
}
class TapGesture extends TapTracker {
  private wonArena = false;
  private timer: Disposable | null = null;
  private lastPosition: OffsetPair;
  private finalPosition: OffsetPair | null = null;
  private live = true;
  /* oxlint-disable no-unsafe-finally -- Reject cleanup when directory ownership or rollback safety cannot be established. */
  constructor(private readonly options: TapGestureOptions) {
    super(options);
    this.lastPosition = OffsetPair.fromEventPosition(options.event);
    try {
      this.startTrackingPointer(this.handleEvent, options.event.transform);
      invariant(
        Number.isFinite(options.longTapDelay),
        'invalid-long-tap-delay',
        'Long-tap delay must be finite milliseconds',
      );
      if (options.longTapDelay > 0)
        this.timer = options.timers.after(options.longTapDelay, () => {
          if (!this.live || options.owner.isDisposed || this.binding.isClosed) return;
          this.timer = null;
          options.dispatchLongTap(this.pointer, this.lastPosition);
        });
    } catch (error) {
      try {
        this.retire(this.handleEvent);
      } finally {
        throw error;
      }
    }
  }
  /* oxlint-enable no-unsafe-finally */
  private readonly handleEvent = (event: PointerEvent) => {
    if (
      !this.live ||
      this.options.owner.isDisposed ||
      (this.binding.isClosed && !(event instanceof PointerCancelEvent))
    )
      return;
    invariant(
      event.pointer === this.pointer,
      'mismatched-multitap-pointer',
      'Tap event pointer differs',
    );
    if (event instanceof PointerMoveEvent) {
      if (!this.isWithinGlobalTolerance(event, computeHitSlop(event.kind, this.gestureSettings)))
        this.cancel();
      else this.lastPosition = OffsetPair.fromEventPosition(event);
    } else if (event instanceof PointerCancelEvent) this.cancel();
    else if (event instanceof PointerUpEvent) {
      this.stopTrackingPointer(this.handleEvent);
      this.finalPosition = OffsetPair.fromEventPosition(event);
      this.check();
    }
  };
  override stopTrackingPointer(route: PointerRoute): void {
    const timer = this.timer;
    this.timer = null;
    cleanup(
      [() => timer?.dispose(), () => super.stopTrackingPointer(route)],
      'Multitap route retirement failed',
    );
  }
  accept(): void {
    if (!this.live) return;
    this.wonArena = true;
    this.check();
  }
  reject(): void {
    if (!this.live) return;
    this.live = false;
    cleanup(
      [
        () => this.stopTrackingPointer(this.handleEvent),
        () => this.options.dispatchCancel(this.pointer),
        () => this.releaseCountdown(),
      ],
      'Multitap rejection failed',
    );
  }
  cancel(): void {
    if (!this.live) return;
    if (this.wonArena) this.reject();
    else this.entry.resolve(GestureDisposition.rejected);
  }
  private check(): void {
    if (this.wonArena && this.finalPosition !== null && this.live) {
      this.live = false;
      try {
        this.options.dispatchTap(this.pointer, this.finalPosition);
      } finally {
        this.releaseCountdown();
      }
    }
  }
  retireOwned(): void {
    this.live = false;
    this.retire(this.handleEvent);
  }
}
export interface MultiTapGestureRecognizerOptions extends GestureRecognizerOptions {
  readonly longTapDelay?: number;
}
export class MultiTapGestureRecognizer extends GestureRecognizer {
  onTapDown: GestureMultiTapDownCallback | null = null;
  onTapUp: GestureMultiTapUpCallback | null = null;
  onTap: GestureMultiTapCallback | null = null;
  onTapCancel: GestureMultiTapCancelCallback | null = null;
  onLongTapDown: GestureMultiTapDownCallback | null = null;
  longTapDelay: number;
  private readonly gestureMap = new Map<number, TapGesture>();
  private readonly ownedGestures = new Set<TapGesture>();
  constructor(options: MultiTapGestureRecognizerOptions) {
    super(options);
    this.longTapDelay = options.longTapDelay ?? 0;
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    invariant(
      !this.gestureMap.has(event.pointer),
      'duplicate-multitap-pointer',
      'Multitap requires a distinct source contact identifier',
    );
    const entry = this.binding.gestureArena.add(event.pointer, this);
    let gesture: TapGesture;
    try {
      gesture = new TapGesture({
        event,
        entry,
        doubleTapMinTime: kDoubleTapMinTime,
        gestureSettings: this.gestureSettings,
        binding: this.binding,
        timers: this.timers,
        owner: this,
        longTapDelay: this.longTapDelay,
        dispatchCancel: (pointer) => this.dispatchCancel(pointer),
        dispatchTap: (pointer, position) => this.dispatchTap(pointer, position),
        dispatchLongTap: (pointer, position) => this.dispatchLongTap(pointer, position),
      });
    } catch (error) {
      entry.resolve(GestureDisposition.rejected);
      throw error;
    }
    this.gestureMap.set(event.pointer, gesture);
    this.ownedGestures.add(gesture);
    if (this.onTapDown !== null)
      this.invokeCallback('onTapDown', () =>
        this.onTapDown!(
          event.pointer,
          new TapDownDetails({
            globalPosition: event.position,
            localPosition: event.localPosition,
            kind: event.kind,
          }),
        ),
      );
  }
  override acceptGesture(pointer: number): void {
    if (this.isDisposed) return;
    const gesture = this.gestureMap.get(pointer);
    invariant(gesture, 'unknown-multitap-acceptance', 'No tap owns this pointer');
    gesture.accept();
  }
  override rejectGesture(pointer: number): void {
    if (this.isDisposed) return;
    this.gestureMap.get(pointer)?.reject();
  }
  private dispatchCancel(pointer: number): void {
    const gesture = this.gestureMap.get(pointer);
    if (!gesture && this.isDisposed) return;
    invariant(gesture, 'unknown-multitap-cancel', 'No tap owns this pointer');
    this.gestureMap.delete(pointer);
    try {
      if (this.onTapCancel !== null)
        this.invokeCallback('onTapCancel', () => this.onTapCancel!(pointer));
    } finally {
      this.ownedGestures.delete(gesture);
      gesture.retireOwned();
    }
  }
  private dispatchTap(pointer: number, position: OffsetPair): void {
    const gesture = this.gestureMap.get(pointer);
    invariant(gesture, 'unknown-multitap-up', 'No tap owns this pointer');
    this.gestureMap.delete(pointer);
    try {
      if (this.onTapUp !== null)
        this.invokeCallback('onTapUp', () =>
          this.onTapUp!(
            pointer,
            new TapUpDetails({
              kind: this.getKindForPointer(pointer),
              localPosition: position.local,
              globalPosition: position.global,
            }),
          ),
        );
      if (this.onTap !== null) this.invokeCallback('onTap', () => this.onTap!(pointer));
    } finally {
      this.ownedGestures.delete(gesture);
      gesture.retireOwned();
    }
  }
  private dispatchLongTap(pointer: number, position: OffsetPair): void {
    invariant(this.gestureMap.has(pointer), 'unknown-long-tap', 'No tap owns this pointer');
    if (this.onLongTapDown !== null)
      this.invokeCallback('onLongTapDown', () =>
        this.onLongTapDown!(
          pointer,
          new TapDownDetails({
            globalPosition: position.global,
            localPosition: position.local,
            kind: this.getKindForPointer(pointer),
          }),
        ),
      );
  }
  override dispose(): void {
    if (!this.beginDispose()) return;
    const gestures = [...this.ownedGestures];
    try {
      cleanup(
        gestures.flatMap((gesture) => [
          () => gesture.cancel(),
          () => {
            if (this.gestureMap.get(gesture.pointer) === gesture) gesture.reject();
          },
          () => gesture.retireOwned(),
        ]),
        'Multitap retirement failed',
      );
    } finally {
      this.gestureMap.clear();
      this.ownedGestures.clear();
      this.finishDispose();
    }
  }
  override get debugDescription(): string {
    return 'multitap';
  }
}
export type GestureSerialTapDownCallback = (details: SerialTapDownDetails) => void;
export type GestureSerialTapCancelCallback = (details: SerialTapCancelDetails) => void;
export type GestureSerialTapUpCallback = (details: SerialTapUpDetails) => void;
export class SerialTapDownDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly kind: PointerDeviceKind;
  readonly buttons: number;
  readonly count: number;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    kind,
    buttons = 0,
    count = 1,
  }: {
    readonly globalPosition?: Offset;
    readonly localPosition?: Offset | null;
    readonly kind: PointerDeviceKind;
    readonly buttons?: number;
    readonly count?: number;
  }) {
    super();
    invariant(
      count > 0 && Number.isSafeInteger(count),
      'invalid-serial-tap-count',
      'Serial tap count must be positive',
    );
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.kind = kind;
    this.buttons = buttons;
    this.count = count;
    if (new.target === SerialTapDownDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new IntProperty('buttons', this.buttons));
    properties.add(new IntProperty('count', this.count));
  }
}
export class SerialTapCancelDetails extends Diagnosticable(class {}) {
  readonly count: number;
  constructor({ count = 1 }: { readonly count?: number } = {}) {
    super();
    invariant(
      count > 0 && Number.isSafeInteger(count),
      'invalid-serial-tap-count',
      'Serial tap count must be positive',
    );
    this.count = count;
    if (new.target === SerialTapCancelDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new IntProperty('count', this.count));
  }
}
export class SerialTapUpDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly kind: PointerDeviceKind | null;
  readonly count: number;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    kind = null,
    count = 1,
  }: {
    readonly globalPosition?: Offset;
    readonly localPosition?: Offset | null;
    readonly kind?: PointerDeviceKind | null;
    readonly count?: number;
  } = {}) {
    super();
    invariant(
      count > 0 && Number.isSafeInteger(count),
      'invalid-serial-tap-count',
      'Serial tap count must be positive',
    );
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.kind = kind;
    this.count = count;
    if (new.target === SerialTapUpDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new IntProperty('count', this.count));
  }
}
export class SerialTapGestureRecognizer extends GestureRecognizer {
  onSerialTapDown: GestureSerialTapDownCallback | null = null;
  onSerialTapCancel: GestureSerialTapCancelCallback | null = null;
  onSerialTapUp: GestureSerialTapUpCallback | null = null;
  private serialTapTimer: Disposable | null = null;
  private timerGeneration = 0;
  private readonly completedTaps: TapTracker[] = [];
  private readonly ownedTrackers = new Set<TapTracker>();
  private readonly gestureResolutions = new Map<number, GestureDisposition>();
  private pendingTap: TapTracker | null = null;
  private resetting = false;
  get isTrackingPointer(): boolean {
    return this.pendingTap !== null;
  }
  protected override isPointerAllowed(event: PointerDownEvent): boolean {
    if (
      this.onSerialTapDown === null &&
      this.onSerialTapCancel === null &&
      this.onSerialTapUp === null
    )
      return false;
    return super.isPointerAllowed(event);
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    invariant(
      !this.resetting,
      'reentrant-serial-tap-reset',
      'Cannot admit a tap during serial reset',
    );
    const last = this.completedTaps.at(-1);
    if ((last && !this.representsSameSeries(last, event)) || this.pendingTap !== null) this.reset();
    if (!this.isDisposed) this.trackTap(event);
  }
  private representsSameSeries(tap: TapTracker, event: PointerDownEvent): boolean {
    return (
      tap.hasElapsedMinTime() &&
      tap.hasSameButton(event) &&
      tap.isWithinGlobalTolerance(event, kDoubleTapSlop)
    );
  }
  private trackTap(event: PointerDownEvent): void {
    this.stopSerialTapTimer();
    if (this.onSerialTapDown !== null) {
      const details = new SerialTapDownDetails({
        globalPosition: event.position,
        localPosition: event.localPosition,
        kind: this.getKindForPointer(event.pointer),
        buttons: event.buttons,
        count: this.completedTaps.length + 1,
      });
      this.invokeCallback('onSerialTapDown', () => this.onSerialTapDown!(details));
    }
    if (this.isDisposed) return;
    const entry = this.binding.gestureArena.add(event.pointer, this);
    let tracker: TapTracker | undefined;
    try {
      tracker = new TapTracker({
        gestureSettings: this.gestureSettings,
        event,
        entry,
        doubleTapMinTime: kDoubleTapMinTime,
        binding: this.binding,
        timers: this.timers,
      });
      this.ownedTrackers.add(tracker);
      invariant(this.pendingTap === null, 'pending-serial-tap', 'A tap is already pending');
      this.pendingTap = tracker;
      tracker.startTrackingPointer(this.handleEvent, event.transform);
    } catch (error) {
      this.pendingTap = null;
      cleanup(
        [
          () => {
            if (tracker) {
              this.ownedTrackers.delete(tracker);
              tracker.retire(this.handleEvent);
            }
          },
          () => entry.resolve(GestureDisposition.rejected),
          () => {
            throw error;
          },
        ],
        'Serial tap admission failed',
      );
    }
  }
  private readonly handleEvent = (event: PointerEvent) => {
    if (this.isDisposed || (this.binding.isClosed && !(event instanceof PointerCancelEvent)))
      return;
    const tracker = this.pendingTap;
    invariant(
      tracker && tracker.pointer === event.pointer,
      'mismatched-serial-tap-pointer',
      'No matching tap is pending',
    );
    try {
      if (event instanceof PointerUpEvent) this.registerTap(event, tracker);
      else if (event instanceof PointerMoveEvent) {
        if (!tracker.isWithinGlobalTolerance(event, kDoubleTapTouchSlop)) this.reset();
      } else if (event instanceof PointerCancelEvent) this.reset();
    } catch (error) {
      try {
        this.reset();
      } catch (retirement) {
        throw new AggregateError([error, retirement], 'Serial-tap dispatch failed');
      }
      throw error;
    }
  };
  override acceptGesture(pointer: number): void {
    if (this.isDisposed) return;
    invariant(
      this.pendingTap?.pointer === pointer,
      'unknown-serial-tap-acceptance',
      'No matching tap is pending',
    );
    this.gestureResolutions.set(pointer, GestureDisposition.accepted);
  }
  override rejectGesture(pointer: number): void {
    if (this.isDisposed) return;
    this.gestureResolutions.set(pointer, GestureDisposition.rejected);
    this.reset();
  }
  private rejectPendingTap(): void {
    const tracker = this.pendingTap;
    invariant(tracker, 'missing-pending-serial-tap', 'No tap is pending');
    this.pendingTap = null;
    try {
      this.checkCancel(this.completedTaps.length + 1);
    } finally {
      cleanup(
        [
          () => {
            if (!this.gestureResolutions.has(tracker.pointer))
              tracker.entry.resolve(GestureDisposition.rejected);
          },
          () => {
            this.ownedTrackers.delete(tracker);
            tracker.retire(this.handleEvent);
          },
        ],
        'Pending serial-tap retirement failed',
      );
    }
  }
  private reset(): void {
    if (this.resetting) return;
    this.resetting = true;
    try {
      cleanup(
        [
          () => {
            if (this.pendingTap !== null) this.rejectPendingTap();
          },
          () => {
            const completed = this.completedTaps.splice(0);
            this.gestureResolutions.clear();
            cleanup(
              completed.map((tracker) => () => {
                this.ownedTrackers.delete(tracker);
                tracker.releaseCountdown();
              }),
              'Completed serial-tap retirement failed',
            );
          },
          () => this.stopSerialTapTimer(),
        ],
        'Serial-tap reset failed',
      );
    } finally {
      this.pendingTap = null;
      this.resetting = false;
    }
  }
  private registerTap(event: PointerUpEvent, tracker: TapTracker): void {
    invariant(
      tracker === this.pendingTap && tracker.pointer === event.pointer,
      'mismatched-serial-tap-up',
      'Tap up does not match',
    );
    let completed = false;
    try {
      this.startSerialTapTimer();
      invariant(
        this.gestureResolutions.get(event.pointer) !== GestureDisposition.rejected,
        'rejected-serial-tap-up',
        'Rejected tap cannot complete',
      );
      if (!this.gestureResolutions.has(event.pointer))
        tracker.entry.resolve(GestureDisposition.accepted);
      if (this.isDisposed) return;
      invariant(
        this.gestureResolutions.get(event.pointer) === GestureDisposition.accepted,
        'unaccepted-serial-tap-up',
        'Tap was not accepted',
      );
      this.stopTrackingPointer(tracker);
      this.pendingTap = null;
      this.checkUp(event, tracker);
      if (!this.isDisposed) {
        this.completedTaps.push(tracker);
        completed = true;
      }
    } finally {
      if (!completed) {
        this.ownedTrackers.delete(tracker);
        tracker.retire(this.handleEvent);
      }
    }
  }
  private stopTrackingPointer(tracker: TapTracker): void {
    tracker.stopTrackingPointer(this.handleEvent);
  }
  private startSerialTapTimer(): void {
    if (this.serialTapTimer !== null) return;
    const generation = ++this.timerGeneration;
    this.serialTapTimer = this.timers.after(kDoubleTapTimeout, () => {
      if (!this.isDisposed && !this.binding.isClosed && this.timerGeneration === generation)
        this.reset();
    });
  }
  private stopSerialTapTimer(): void {
    this.timerGeneration++;
    const timer = this.serialTapTimer;
    this.serialTapTimer = null;
    timer?.dispose();
  }
  private checkUp(event: PointerUpEvent, tracker: TapTracker): void {
    if (this.onSerialTapUp !== null) {
      const details = new SerialTapUpDetails({
        globalPosition: event.position,
        localPosition: event.localPosition,
        kind: this.getKindForPointer(tracker.pointer),
        count: this.completedTaps.length + 1,
      });
      this.invokeCallback('onSerialTapUp', () => this.onSerialTapUp!(details));
    }
  }
  private checkCancel(count: number): void {
    if (this.onSerialTapCancel !== null) {
      const details = new SerialTapCancelDetails({ count });
      this.invokeCallback('onSerialTapCancel', () => this.onSerialTapCancel!(details));
    }
  }
  override dispose(): void {
    if (!this.beginDispose()) return;
    try {
      this.reset();
    } finally {
      this.pendingTap = null;
      const trackers = [...this.ownedTrackers];
      this.ownedTrackers.clear();
      try {
        cleanup(
          [
            ...trackers.flatMap((tracker) => [
              () => tracker.retire(this.handleEvent),
              () => tracker.entry.resolve(GestureDisposition.rejected),
            ]),
            () => this.stopSerialTapTimer(),
          ],
          'Serial-tap retirement failed',
        );
      } finally {
        this.completedTaps.length = 0;
        this.gestureResolutions.clear();
        this.finishDispose();
      }
    }
  }
  override get debugDescription(): string {
    return 'serial tap';
  }
}
