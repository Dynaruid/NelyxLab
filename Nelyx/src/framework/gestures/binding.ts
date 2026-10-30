// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/binding.dart with explicit View ownership, clock and scheduler ports.
import type { Disposable } from '../../foundation/disposable.ts';
import { invariant, exceptionStack } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import type { FlutterErrorDetailsOptions } from '../../foundation/assertions.ts';
import { DiagnosticsProperty, ErrorDescription } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { Offset } from '../../ui/offset.ts';
import { PointerDeviceKind, PointerDataPacket } from '../../ui/pointer.ts';
import { PointerEventConverter } from './converter.ts';
import type { DevicePixelRatioGetter } from './converter.ts';
import {
  PointerEvent,
  PointerDownEvent,
  PointerUpEvent,
  PointerCancelEvent,
  PointerHoverEvent,
  PointerAddedEvent,
  PointerRemovedEvent,
  PointerSignalEvent,
  PointerPanZoomStartEvent,
  PointerPanZoomUpdateEvent,
  PointerPanZoomEndEvent,
} from './events.ts';
import { HitTestEntry, HitTestResult, isNativeHitTestTarget } from './hit-test.ts';
import type { HitTestTarget, HitTestable, HitTestDispatcher } from './hit-test.ts';
import { PointerRouter } from './pointer-router.ts';
import { GestureArenaManager } from './arena.ts';
import { PointerSignalResolver } from './pointer-signal-resolver.ts';
import { PointerEventResampler } from './resampler.ts';
import { GestureDebug } from './debug.ts';
import { debugPrint } from '../../foundation/print.ts';

export interface GestureSamplingScheduler {
  readonly currentSystemFrameTimeStamp: number;
  addPostFrameCallback(
    callback: (timeStamp: number) => void,
    options?: { readonly debugLabel?: string },
  ): void;
}
export interface GestureTimerPort {
  every(interval: number, callback: () => void): Disposable;
}
interface SamplingHost {
  performance?: { now(): number };
  setInterval?: (callback: () => void, interval: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}
const samplingHost = () => globalThis as unknown as SamplingHost;
function monotonicNow(): number {
  const clock = samplingHost().performance;
  invariant(clock, 'missing-sampling-clock', 'This host must inject a monotonic SamplingClock');
  return clock.now();
}
/** Explicit millisecond clock adapts DateTime/Stopwatch. A View injects its
 * monotonic input/frame timebase; the public default retains wall-clock now. */
export class SamplingClock {
  constructor(
    private readonly readNow: () => number = () => Date.now(),
    private readonly readMonotonic: () => number = monotonicNow,
  ) {}
  now(): number {
    return this.readNow();
  }
  stopwatch(): SamplingStopwatch {
    return new SamplingStopwatch(this.readMonotonic);
  }
}
export class SamplingStopwatch {
  private elapsedValue = 0;
  private started: number | null = null;
  constructor(private readonly read: () => number) {}
  start(): void {
    if (this.started === null) this.started = this.read();
  }
  stop(): void {
    if (this.started !== null) {
      this.elapsedValue += this.read() - this.started;
      this.started = null;
    }
  }
  reset(): void {
    this.elapsedValue = 0;
    if (this.started !== null) this.started = this.read();
  }
  get elapsedMicroseconds(): number {
    return Math.trunc(
      (this.elapsedValue + (this.started === null ? 0 : this.read() - this.started)) * 1000,
    );
  }
  get isRunning(): boolean {
    return this.started !== null;
  }
}
const defaultSamplingOffset = -38,
  samplingInterval = 16.667;
const defaultTimers: GestureTimerPort = {
  every(interval, callback) {
    const host = samplingHost();
    invariant(
      host.setInterval && host.clearInterval,
      'missing-sampling-timer',
      'This host must inject gesture timers',
    );
    const timer = host.setInterval(callback, interval);
    return {
      dispose() {
        host.clearInterval!(timer);
      },
    };
  },
};
class Resampler {
  private readonly resamplers = new Map<unknown, PointerEventResampler>();
  private frameCallbackScheduled = false;
  private frameTime: number | null = null;
  private frameTimeAge: SamplingStopwatch | null = null;
  private lastSampleTime = 0;
  private lastEventTime = 0;
  private timer: Disposable | null = null;
  private generation = 0;
  constructor(
    private readonly handle: (event: PointerEvent) => void,
    private readonly changed: () => void,
    private readonly scheduler: GestureSamplingScheduler,
    private readonly timers: GestureTimerPort,
    private readonly streamKey: (event: PointerEvent) => unknown,
  ) {}
  addOrDispatch(event: PointerEvent): void {
    if (event.kind === PointerDeviceKind.touch) {
      this.lastEventTime = event.timeStamp;
      const key = this.streamKey(event);
      let resampler = this.resamplers.get(key);
      if (!resampler) {
        resampler = new PointerEventResampler();
        this.resamplers.set(key, resampler);
      }
      resampler.addEvent(event);
    } else this.handle(event);
  }
  private notifySampleTimeChanged(): void {
    if (FoundationBuildMode.debug && GestureDebug.debugPrintResamplingMargin)
      debugPrint(String(this.lastEventTime - this.lastSampleTime) + 'ms');
    this.changed();
  }
  private startTimer(): void {
    this.timer?.dispose();
    const generation = this.generation;
    this.timer = this.timers.every(samplingInterval, () => {
      if (this.generation === generation) this.notifySampleTimeChanged();
    });
  }
  sample(samplingOffset: number, clock: SamplingClock): void {
    const generation = this.generation;
    if (this.frameTime === null) {
      this.frameTime = clock.now();
      this.frameTimeAge = clock.stopwatch();
      this.frameTimeAge.start();
    }
    if (this.timer === null) this.startTimer();
    const elapsedIntervals = Math.trunc(this.frameTimeAge!.elapsedMicroseconds / 16667),
      sampleTime = this.frameTime + elapsedIntervals * samplingInterval + samplingOffset,
      nextSampleTime = sampleTime + samplingInterval;
    const snapshot = [...this.resamplers.values()];
    for (const resampler of snapshot) {
      if (this.generation !== generation) return;
      resampler.sample(sampleTime, nextSampleTime, this.handle);
    }
    if (this.generation !== generation) return;
    for (const [key, resampler] of this.resamplers)
      if (!resampler.hasPendingEvents && !resampler.isDown) this.resamplers.delete(key);
    this.lastSampleTime = sampleTime;
    if (this.resamplers.size === 0) {
      this.timer?.dispose();
      this.timer = null;
      return;
    }
    if (!this.frameCallbackScheduled) {
      this.frameCallbackScheduled = true;
      this.scheduler.addPostFrameCallback(
        () => {
          if (this.generation !== generation) return;
          this.frameCallbackScheduled = false;
          this.frameTime = this.scheduler.currentSystemFrameTimeStamp;
          this.frameTimeAge!.reset();
          this.startTimer();
          this.notifySampleTimeChanged();
        },
        { debugLabel: 'Resampler.startTimer' },
      );
    }
  }
  stop(discard = false): void {
    const generation = ++this.generation;
    this.timer?.dispose();
    this.timer = null;
    this.frameCallbackScheduled = false;
    const current = [...this.resamplers.values()];
    this.resamplers.clear();
    this.frameTime = null;
    this.frameTimeAge = null;
    if (!discard)
      for (const resampler of current) {
        if (this.generation !== generation) return;
        resampler.stop(this.handle);
      }
  }
}
export interface GestureBindingOptions {
  readonly devicePixelRatioForView: DevicePixelRatioGetter;
  readonly implicitViewId?: number | string;
  /** Add render targets; this binding appends itself as the final target. */
  readonly hitTestInView?: (
    result: HitTestResult,
    position: Offset,
    viewId: number | string,
  ) => void;
  readonly pointerRouter?: PointerRouter;
  readonly gestureArena?: GestureArenaManager;
  readonly pointerSignalResolver?: PointerSignalResolver;
  readonly scheduler?: GestureSamplingScheduler;
  readonly clock?: SamplingClock;
  readonly timers?: GestureTimerPort;
  readonly streamKey?: (event: PointerEvent) => unknown;
  readonly beforeDispatch?: (event: PointerEvent) => boolean;
  /** Run a recognizer callback with its actual originating event time. */
  readonly invokeCallback?: <T>(timestamp: number, callback: () => T) => T;
  readonly beforeHitTestDispatch?: (event: PointerEvent, result: HitTestResult | null) => void;
  readonly shouldDispatchToTarget?: (event: PointerEvent, entry: HitTestEntry) => boolean;
  /** The renderer can bridge its existing transport callbacks at the target. */
  readonly dispatchToTarget?: (event: PointerEvent, entry: HitTestEntry) => void;
  /** Logical embedding hover/signal namespaces can overlap contact IDs. */
  readonly allowIndependentHitTest?: (event: PointerEvent) => boolean;
  readonly createCancelEvent?: (last: PointerEvent | null, pointer: number) => PointerCancelEvent;
}
export class FlutterErrorDetailsForPointerEventDispatcher extends FlutterErrorDetails {
  readonly event: PointerEvent | null;
  readonly hitTestEntry: HitTestEntry | null;
  constructor(
    options: FlutterErrorDetailsOptions & {
      readonly event?: PointerEvent | null;
      readonly hitTestEntry?: HitTestEntry | null;
    },
  ) {
    super(options);
    this.event = options.event ?? null;
    this.hitTestEntry = options.hitTestEntry ?? null;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('Event', this.event, { level: 'debug' }));
    properties.add(new DiagnosticsProperty('HitTestEntry', this.hitTestEntry, { level: 'debug' }));
  }
}
/** A live View's actual queue/hit-path/route/arena/signal owner. Platform
 * registration is supplied by the application rather than a process singleton. */
export class GestureBinding implements HitTestTarget, HitTestable, HitTestDispatcher, Disposable {
  readonly pointerRouter: PointerRouter;
  readonly gestureArena: GestureArenaManager;
  readonly pointerSignalResolver: PointerSignalResolver;
  resamplingEnabled = false;
  samplingOffset = defaultSamplingOffset;
  private readonly pendingPointerEvents: PointerEvent[] = [];
  private readonly hitTests = new Map<number, HitTestResult>();
  private readonly lastEvents = new Map<number, PointerEvent>();
  private lockCount = 0;
  private flushing = false;
  private processing = false;
  private live = true;
  private closing = false;
  private resampler: Resampler | null = null;
  private dispatchGeneration = 0;
  constructor(private readonly options: GestureBindingOptions) {
    this.pointerRouter = options.pointerRouter ?? new PointerRouter();
    this.gestureArena = options.gestureArena ?? new GestureArenaManager();
    this.pointerSignalResolver = options.pointerSignalResolver ?? new PointerSignalResolver();
  }
  invokeCallback<T>(timestamp: number | null, callback: () => T): T {
    return timestamp === null || !this.options.invokeCallback
      ? callback()
      : this.options.invokeCallback(timestamp, callback);
  }
  get locked(): boolean {
    return this.lockCount > 0;
  }
  get isClosed(): boolean {
    return !this.live || this.closing;
  }
  get debugSamplingClock(): SamplingClock | null {
    return null;
  }
  get samplingClock(): SamplingClock {
    return (
      this.options.clock ??
      (FoundationBuildMode.debug ? this.debugSamplingClock : null) ??
      new SamplingClock()
    );
  }
  /** Actual frame epoch for boundary-pointer drag aggregation. */
  get currentSystemFrameTimeStamp(): number {
    invariant(
      this.options.scheduler,
      'missing-gesture-scheduler',
      'This View must supply its actual frame scheduler',
    );
    return this.options.scheduler.currentSystemFrameTimeStamp;
  }
  async lockEvents(callback: () => void | PromiseLike<void>): Promise<void> {
    this.checkOpen();
    this.lockCount++;
    try {
      await callback();
    } finally {
      this.lockCount--;
      if (this.live && !this.locked) this.unlocked();
    }
  }
  protected unlocked(): void {
    this.flushPointerEventQueue();
  }
  /** Embedding admission queues while locked/reentrant; public source dispatch remains strict. */
  enqueuePointerEvent(event: PointerEvent): void {
    if (!this.live || this.closing) return;
    this.pendingPointerEvents.push(event);
    if (!this.locked && !this.processing) this.flushPointerEventQueue();
  }
  handlePointerDataPacket(packet: PointerDataPacket): void {
    if (!this.live || this.closing) return;
    try {
      const admitted = [
        ...PointerEventConverter.expand(packet.data, this.options.devicePixelRatioForView),
      ];
      if (!this.live || this.closing) return;
      this.pendingPointerEvents.push(...admitted);
      if (!this.locked && !this.processing) this.flushPointerEventQueue();
    } catch (exception) {
      FlutterError.reportError(
        new FlutterErrorDetails({
          exception,
          stack: exceptionStack(exception),
          library: 'gestures library',
          context: new ErrorDescription('while handling a pointer data packet'),
        }),
      );
    }
  }
  cancelPointer(pointer: number): void {
    if (!this.live || this.closing) return;
    const schedule = this.pendingPointerEvents.length === 0 && !this.locked;
    this.pendingPointerEvents.unshift(this.cancelEvent(pointer));
    if (schedule)
      void Promise.resolve().then(() => {
        if (this.live && !this.locked && !this.processing) this.flushPointerEventQueue();
      });
  }
  private cancelEvent(pointer: number): PointerCancelEvent {
    const last = this.lastEvents.get(pointer) ?? null;
    if (this.options.createCancelEvent) return this.options.createCancelEvent(last, pointer);
    return new PointerCancelEvent({
      pointer,
      ...(last
        ? {
            viewId: last.viewId,
            kind: last.kind === PointerDeviceKind.trackpad ? PointerDeviceKind.touch : last.kind,
            device: last.device,
            position: last.position,
            buttons: 0,
          }
        : {}),
    });
  }
  private flushPointerEventQueue(): void {
    if (!this.live || this.closing || this.locked || this.processing || this.flushing) return;
    this.flushing = true;
    try {
      while (this.live && !this.closing && !this.locked && this.pendingPointerEvents.length)
        this.handlePointerEvent(this.pendingPointerEvents.shift()!);
    } finally {
      this.flushing = false;
    }
  }
  private runProcessing(action: () => void): void {
    invariant(
      !this.processing,
      'reentrant-pointer-dispatch',
      'Direct pointer dispatch cannot be nested',
    );
    this.processing = true;
    try {
      action();
    } finally {
      this.processing = false;
      if (this.live && !this.closing && !this.locked && !this.flushing)
        this.flushPointerEventQueue();
    }
  }
  handlePointerEvent(event: PointerEvent): void {
    this.checkOpen();
    invariant(
      !this.locked,
      'locked-pointer-dispatch',
      'Use packet/embedding admission while input is locked',
    );
    this.runProcessing(() => {
      if (this.resamplingEnabled) {
        this.getResampler().addOrDispatch(event);
        if (this.live && !this.closing)
          this.getResampler().sample(this.samplingOffset, this.samplingClock);
      } else {
        this.resampler?.stop();
        if (this.live && !this.closing) this.handlePointerEventImmediately(event);
      }
    });
  }
  private getResampler(): Resampler {
    if (!this.resampler) {
      invariant(
        this.options.scheduler,
        'missing-gesture-sampling-scheduler',
        'Resampling requires an actual View scheduler',
      );
      this.resampler = new Resampler(
        (event) => this.handlePointerEventImmediately(event),
        () => this.handleSampleTimeChanged(),
        this.options.scheduler,
        this.options.timers ?? defaultTimers,
        this.options.streamKey ?? ((event) => event.device),
      );
    }
    return this.resampler;
  }
  private handleSampleTimeChanged(): void {
    if (!this.live || this.closing || this.locked || this.processing) return;
    this.runProcessing(() => {
      if (this.resamplingEnabled)
        this.getResampler().sample(this.samplingOffset, this.samplingClock);
      else this.resampler?.stop();
    });
  }
  private handlePointerEventImmediately(event: PointerEvent, bypassPreparation = false): void {
    if (!this.live || (this.closing && !bypassPreparation)) return;
    if (!bypassPreparation && this.options.beforeDispatch?.(event) === false) return;
    let result: HitTestResult | null = null;
    if (
      event instanceof PointerDownEvent ||
      event instanceof PointerSignalEvent ||
      event instanceof PointerHoverEvent ||
      event instanceof PointerPanZoomStartEvent
    ) {
      invariant(
        !this.hitTests.has(event.pointer) || this.options.allowIndependentHitTest?.(event) === true,
        'duplicate-pointer-hit-path',
        'Pointer already has a retained hit-test result',
      );
      result = new HitTestResult();
      this.hitTestInView(result, event.position, event.viewId);
      if (event instanceof PointerDownEvent || event instanceof PointerPanZoomStartEvent) {
        this.hitTests.set(event.pointer, result);
        this.lastEvents.set(event.pointer, event);
      }
      if (FoundationBuildMode.debug && GestureDebug.debugPrintHitTestResults)
        debugPrint(event.toString({ minLevel: 'debug' }) + ': ' + result);
    } else if (
      event instanceof PointerUpEvent ||
      event instanceof PointerCancelEvent ||
      event instanceof PointerPanZoomEndEvent
    ) {
      result = this.hitTests.get(event.pointer) ?? null;
      this.hitTests.delete(event.pointer);
      this.lastEvents.delete(event.pointer);
    } else if (event.down || event instanceof PointerPanZoomUpdateEvent) {
      result = this.hitTests.get(event.pointer) ?? null;
      if (result) this.lastEvents.set(event.pointer, event);
    }
    if (
      FoundationBuildMode.debug &&
      GestureDebug.debugPrintMouseHoverEvents &&
      event instanceof PointerHoverEvent
    )
      debugPrint(event.toString());
    const generation = this.dispatchGeneration;
    this.options.beforeHitTestDispatch?.(event, result);
    if (
      this.live &&
      this.dispatchGeneration === generation &&
      (result !== null ||
        event instanceof PointerAddedEvent ||
        event instanceof PointerRemovedEvent)
    )
      this.dispatchEvent(event, result);
  }
  hitTestInView(result: HitTestResult, position: Offset, viewId: number | string): void {
    this.options.hitTestInView?.(result, position, viewId);
    result.add(new HitTestEntry(this));
  }
  hitTest(result: HitTestResult, position: Offset): void {
    invariant(
      this.options.implicitViewId !== undefined,
      'missing-implicit-pointer-view',
      'Implicit hit testing requires an actual View identity',
    );
    this.hitTestInView(result, position, this.options.implicitViewId);
  }
  hasPlatformViewAt(position: Offset, viewId: number | string): boolean {
    this.checkOpen();
    const result = new HitTestResult();
    this.hitTestInView(result, position, viewId);
    return result.path.some((entry) => isNativeHitTestTarget(entry.target));
  }
  dispatchEvent(event: PointerEvent, result: HitTestResult | null): void {
    invariant(
      !this.locked || this.closing,
      'locked-pointer-dispatch',
      'Pointer dispatch is locked',
    );
    if (result === null) {
      invariant(
        event instanceof PointerAddedEvent || event instanceof PointerRemovedEvent,
        'missing-pointer-hit-result',
        'Only added/removed events bypass hit testing',
      );
      try {
        this.pointerRouter.route(event);
      } catch (exception) {
        this.reportDispatchError(exception, event, null);
      }
      return;
    }
    const generation = this.dispatchGeneration;
    let completed = false;
    try {
      for (const entry of result.path) {
        if (!this.live || this.dispatchGeneration !== generation) break;
        try {
          if (this.options.shouldDispatchToTarget?.(event, entry) !== false) {
            const local = event.transformed(entry.transform);
            if (this.options.dispatchToTarget) this.options.dispatchToTarget(local, entry);
            else entry.target.handleEvent(local, entry);
          }
        } catch (exception) {
          this.reportDispatchError(exception, event, entry);
        }
      }
      completed = this.live && this.dispatchGeneration === generation;
    } finally {
      if (!completed && event instanceof PointerSignalEvent)
        this.pointerSignalResolver.cancel(event);
    }
  }
  private reportDispatchError(
    exception: unknown,
    event: PointerEvent,
    entry: HitTestEntry | null,
  ): void {
    FlutterError.reportError(
      new FlutterErrorDetailsForPointerEventDispatcher({
        exception,
        stack: exceptionStack(exception),
        library: 'gesture library',
        context: new ErrorDescription(
          entry
            ? 'while dispatching a pointer event'
            : 'while dispatching a non-hit-tested pointer event',
        ),
        event,
        hitTestEntry: entry,
        informationCollector: () => [
          new DiagnosticsProperty('Event', event, { style: 'errorProperty' }),
          ...(entry
            ? [new DiagnosticsProperty('Target', entry.target, { style: 'errorProperty' })]
            : []),
        ],
      }),
    );
  }
  handleEvent(event: PointerEvent, _entry: HitTestEntry): void {
    try {
      this.pointerRouter.route(event);
    } finally {
      if (event instanceof PointerDownEvent || event instanceof PointerPanZoomStartEvent)
        this.gestureArena.close(event.pointer);
      else if (event instanceof PointerUpEvent || event instanceof PointerPanZoomEndEvent)
        this.gestureArena.sweep(event.pointer);
      else if (event instanceof PointerCancelEvent) this.gestureArena.cancel(event.pointer);
      else if (event instanceof PointerSignalEvent) this.pointerSignalResolver.resolve(event);
    }
  }
  protected resetGestureBinding(): void {
    this.hitTests.clear();
    this.lastEvents.clear();
  }
  /** Hide/retirement cancels already-dispatched contacts and drops unsampled admissions. */
  cancelActivePointers(): void {
    this.dispatchGeneration++;
    this.resampler?.stop(true);
    this.pendingPointerEvents.length = 0;
    const pointers = [...this.hitTests.keys()],
      errors: unknown[] = [];
    for (const pointer of pointers)
      try {
        this.handlePointerEventImmediately(this.cancelEvent(pointer), true);
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Gesture contact cancellation failed');
  }
  private checkOpen(): void {
    invariant(
      this.live && !this.closing,
      'closed-gesture-binding',
      'GestureBinding owner is closed',
    );
  }
  dispose(): void {
    if (!this.live || this.closing) return;
    this.closing = true;
    const errors: unknown[] = [];
    try {
      this.cancelActivePointers();
    } catch (error) {
      errors.push(error);
    } finally {
      this.live = false;
      this.pendingPointerEvents.length = 0;
      this.resampler?.stop(true);
      this.resetGestureBinding();
    }
    if (errors.length) throw new AggregateError(errors, 'GestureBinding retirement failed');
  }
}
