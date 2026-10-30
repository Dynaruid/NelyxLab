// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed gestures/tap_and_drag.dart; Duration and timer ports use milliseconds.
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import {
  EnumProperty,
  IntProperty,
  DoubleProperty,
} from '../../foundation/diagnostic-properties.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { Offset } from '../../ui/offset.ts';
import { checkedInteger } from '../../ui/value-math.ts';
import { inverse } from '../../ui/geometry.ts';
import type { PointerDeviceKind } from '../../ui/pointer.ts';
import { Velocity } from './velocity-tracker.ts';
import type { PositionedGestureDetails } from './gesture-details.ts';
import { OneSequenceGestureRecognizer, OffsetPair, DragStartBehavior } from './recognizer.ts';
import type { GestureRecognizerOptions, GestureRecognizerTimerPort } from './recognizer.ts';
import { GestureDisposition } from './arena.ts';
import {
  PointerEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  kPrimaryButton,
  computeHitSlop,
  computePanSlop,
} from './events.ts';
import { kDoubleTapTimeout, kDoubleTapSlop, kPressTimeout } from './constants.ts';
const debugAssert = (condition: boolean): void => {
  if (FoundationBuildMode.debug)
    invariant(condition, 'invalid-tap-and-drag', 'Invalid tap-and-drag state');
};
interface TapPositions {
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly consecutiveTapCount: number;
}
export class TapDragDownDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly kind: PointerDeviceKind | null;
  readonly consecutiveTapCount: number;
  constructor({
    globalPosition,
    localPosition,
    kind = null,
    consecutiveTapCount,
  }: TapPositions & { readonly kind?: PointerDeviceKind | null }) {
    super();
    this.globalPosition = globalPosition;
    this.localPosition = localPosition;
    this.kind = kind;
    this.consecutiveTapCount = checkedInteger(consecutiveTapCount);
    if (new.target === TapDragDownDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new IntProperty('consecutiveTapCount', this.consecutiveTapCount));
  }
}
export class TapDragUpDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly kind: PointerDeviceKind;
  readonly consecutiveTapCount: number;
  constructor({
    globalPosition,
    localPosition,
    kind,
    consecutiveTapCount,
  }: TapPositions & { readonly kind: PointerDeviceKind }) {
    super();
    this.globalPosition = globalPosition;
    this.localPosition = localPosition;
    this.kind = kind;
    this.consecutiveTapCount = checkedInteger(consecutiveTapCount);
    if (new.target === TapDragUpDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new IntProperty('consecutiveTapCount', this.consecutiveTapCount));
  }
}
export class TapDragStartDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly sourceTimeStamp: number | null;
  readonly kind: PointerDeviceKind | null;
  readonly consecutiveTapCount: number;
  constructor({
    globalPosition,
    localPosition,
    sourceTimeStamp = null,
    kind = null,
    consecutiveTapCount,
  }: TapPositions & {
    readonly sourceTimeStamp?: number | null;
    readonly kind?: PointerDeviceKind | null;
  }) {
    super();
    this.globalPosition = globalPosition;
    this.localPosition = localPosition;
    this.sourceTimeStamp = sourceTimeStamp;
    this.kind = kind;
    this.consecutiveTapCount = checkedInteger(consecutiveTapCount);
    if (new.target === TapDragStartDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DiagnosticsProperty('sourceTimeStamp', this.sourceTimeStamp));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new IntProperty('consecutiveTapCount', this.consecutiveTapCount));
  }
}
export class TapDragUpdateDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly sourceTimeStamp: number | null;
  readonly delta: Offset;
  readonly primaryDelta: number | null;
  readonly kind: PointerDeviceKind | null;
  readonly offsetFromOrigin: Offset;
  readonly localOffsetFromOrigin: Offset;
  readonly consecutiveTapCount: number;
  constructor({
    globalPosition,
    localPosition,
    sourceTimeStamp = null,
    delta = Offset.zero,
    primaryDelta = null,
    kind = null,
    offsetFromOrigin,
    localOffsetFromOrigin,
    consecutiveTapCount,
  }: TapPositions & {
    readonly sourceTimeStamp?: number | null;
    readonly delta?: Offset;
    readonly primaryDelta?: number | null;
    readonly kind?: PointerDeviceKind | null;
    readonly offsetFromOrigin: Offset;
    readonly localOffsetFromOrigin: Offset;
  }) {
    super();
    debugAssert(
      primaryDelta === null ||
        (primaryDelta === delta.dx && delta.dy === 0) ||
        (primaryDelta === delta.dy && delta.dx === 0),
    );
    this.globalPosition = globalPosition;
    this.localPosition = localPosition;
    this.sourceTimeStamp = sourceTimeStamp;
    this.delta = delta;
    this.primaryDelta = primaryDelta;
    this.kind = kind;
    this.offsetFromOrigin = offsetFromOrigin;
    this.localOffsetFromOrigin = localOffsetFromOrigin;
    this.consecutiveTapCount = checkedInteger(consecutiveTapCount);
    if (new.target === TapDragUpdateDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DiagnosticsProperty('sourceTimeStamp', this.sourceTimeStamp));
    properties.add(new DiagnosticsProperty('delta', this.delta));
    properties.add(new DoubleProperty('primaryDelta', this.primaryDelta));
    properties.add(new EnumProperty('kind', this.kind));
    properties.add(new DiagnosticsProperty('offsetFromOrigin', this.offsetFromOrigin));
    properties.add(new DiagnosticsProperty('localOffsetFromOrigin', this.localOffsetFromOrigin));
    properties.add(new IntProperty('consecutiveTapCount', this.consecutiveTapCount));
  }
}
export class TapDragEndDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly velocity: Velocity;
  readonly primaryVelocity: number | null;
  readonly consecutiveTapCount: number;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    velocity = Velocity.zero,
    primaryVelocity = null,
    consecutiveTapCount,
  }: {
    readonly globalPosition?: Offset;
    readonly localPosition?: Offset | null;
    readonly velocity?: Velocity;
    readonly primaryVelocity?: number | null;
    readonly consecutiveTapCount: number;
  }) {
    super();
    debugAssert(
      primaryVelocity === null ||
        primaryVelocity === velocity.pixelsPerSecond.dx ||
        primaryVelocity === velocity.pixelsPerSecond.dy,
    );
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.velocity = velocity;
    this.primaryVelocity = primaryVelocity;
    this.consecutiveTapCount = checkedInteger(consecutiveTapCount);
    if (new.target === TapDragEndDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DiagnosticsProperty('velocity', this.velocity));
    properties.add(new DoubleProperty('primaryVelocity', this.primaryVelocity));
    properties.add(new IntProperty('consecutiveTapCount', this.consecutiveTapCount));
  }
}
export type GestureTapDragDownCallback = (details: TapDragDownDetails) => void;
export type GestureTapDragUpCallback = (details: TapDragUpDetails) => void;
export type GestureTapDragStartCallback = (details: TapDragStartDetails) => void;
export type GestureTapDragUpdateCallback = (details: TapDragUpdateDetails) => void;
export type GestureTapDragEndCallback = (details: TapDragEndDetails) => void;
export type GestureCancelCallback = () => void;
class GestureTimer {
  isActive = true;
  private handle: Disposable | null = null;
  constructor(timers: GestureRecognizerTimerPort, delay: number, callback: () => void) {
    this.handle = timers.after(delay, () => {
      if (!this.isActive) return;
      this.isActive = false;
      callback();
    });
  }
  cancel(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.handle?.dispose();
    this.handle = null;
  }
}
/** Source mixin represented by an internal base; it has no additional runtime brand. */
abstract class TapStatusTrackingRecognizer extends OneSequenceGestureRecognizer {
  protected down: PointerDownEvent | null = null;
  protected up: PointerUpEvent | null = null;
  private count = 0;
  private origin: OffsetPair | null = null;
  private previousButtons: number | null = null;
  private tapTimer: GestureTimer | null = null;
  private lastTapOffset: Offset | null = null;
  abstract maxConsecutiveTap: number | null;
  onTapTrackStart: (() => void) | null = null;
  onTapTrackReset: (() => void) | null = null;
  get currentDown(): PointerDownEvent | null {
    return this.down;
  }
  get currentUp(): PointerUpEvent | null {
    return this.up;
  }
  get consecutiveTapCount(): number {
    return this.count;
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    super.addAllowedPointer(event);
    if (this.tapTimer !== null && !this.tapTimer.isActive) this.resetTapTracker();
    if (this.maxConsecutiveTap === this.count) this.resetTapTracker();
    this.up = null;
    if (this.down !== null && !this.sameSeries(event)) this.count = 1;
    else this.count++;
    this.stopTapTimer();
    this.down = event;
    this.previousButtons = event.buttons;
    this.lastTapOffset = event.position;
    this.origin = new OffsetPair({ local: event.localPosition, global: event.position });
    this.onTapTrackStart?.();
  }
  protected override handleEvent(event: PointerEvent): void {
    if (event instanceof PointerMoveEvent) {
      debugAssert(this.origin !== null);
      if (
        event.position.subtract(this.origin!.global).distance >
        computeHitSlop(event.kind, this.gestureSettings)
      ) {
        this.stopTapTimer();
        this.previousButtons = null;
        this.lastTapOffset = null;
      }
    } else if (event instanceof PointerUpEvent) {
      this.up = event;
      if (this.down !== null) {
        this.stopTapTimer();
        this.tapTimer = new GestureTimer(this.timers, kDoubleTapTimeout, () => {});
      }
    } else if (event instanceof PointerCancelEvent) this.resetTapTracker();
  }
  override rejectGesture(_pointer: number): void {
    this.resetTapTracker();
  }
  private sameSeries(event: PointerDownEvent): boolean {
    return (
      this.tapTimer !== null &&
      this.lastTapOffset !== null &&
      event.position.subtract(this.lastTapOffset).distance <= kDoubleTapSlop &&
      this.previousButtons === event.buttons
    );
  }
  private stopTapTimer(): void {
    this.tapTimer?.cancel();
    this.tapTimer = null;
  }
  private resetTapTracker(): void {
    this.stopTapTimer();
    this.previousButtons = null;
    this.origin = null;
    this.lastTapOffset = null;
    this.count = 0;
    this.down = this.up = null;
    this.onTapTrackReset?.();
  }
  override dispose(): void {
    const errors: unknown[] = [];
    try {
      this.resetTapTracker();
    } catch (error) {
      errors.push(error);
    }
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Tap tracker retirement failed');
  }
}
export interface BaseTapAndDragGestureRecognizerOptions extends GestureRecognizerOptions {
  readonly eagerVictoryOnDrag?: boolean;
}
export abstract class BaseTapAndDragGestureRecognizer extends TapStatusTrackingRecognizer {
  dragStartBehavior = DragStartBehavior.start;
  dragUpdateThrottleFrequency: number | null = null;
  override maxConsecutiveTap: number | null = null;
  eagerVictoryOnDrag: boolean;
  onTapDown: GestureTapDragDownCallback | null = null;
  onTapUp: GestureTapDragUpCallback | null = null;
  onDragStart: GestureTapDragStartCallback | null = null;
  onDragUpdate: GestureTapDragUpdateCallback | null = null;
  onDragEnd: GestureTapDragEndCallback | null = null;
  onCancel: GestureCancelCallback | null = null;
  private pastSlop = false;
  private sentTapDown = false;
  private wonPrimary = false;
  private primary: number | null = null;
  private deadlineTimer: GestureTimer | null = null;
  private dragState: 'ready' | 'possible' | 'accepted' = 'ready';
  private startEvent: PointerEvent | null = null;
  private initialPosition: OffsetPair = OffsetPair.zero;
  private currentPosition: OffsetPair = OffsetPair.zero;
  protected globalDistanceMoved = 0;
  private globalDistanceAllAxes = 0;
  private lastUpdate: TapDragUpdateDetails | null = null;
  private throttleTimer: GestureTimer | null = null;
  private readonly accepted = new Set<number>();
  private retiringTap = false;
  constructor(options: BaseTapAndDragGestureRecognizerOptions) {
    super(options);
    this.eagerVictoryOnDrag = options.eagerVictoryOnDrag ?? true;
  }
  protected abstract getDeltaForDetails(delta: Offset): Offset;
  protected abstract getPrimaryValueFromOffset(value: Offset): number | null;
  protected abstract hasSufficientGlobalDistanceToAccept(kind: PointerDeviceKind): boolean;
  protected override isPointerAllowed(event: PointerDownEvent): boolean {
    if (this.primary === null) {
      if (
        event.buttons !== kPrimaryButton ||
        (this.onTapDown === null &&
          this.onDragStart === null &&
          this.onDragUpdate === null &&
          this.onDragEnd === null &&
          this.onTapUp === null &&
          this.onCancel === null)
      )
        return false;
    } else if (event.pointer !== this.primary) return false;
    return super.isPointerAllowed(event);
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    if (this.dragState !== 'ready' || this.retiringTap) return;
    super.addAllowedPointer(event);
    if (this.isDisposed || this.retiringTap) return;
    this.primary = event.pointer;
    this.globalDistanceMoved = this.globalDistanceAllAxes = 0;
    this.dragState = 'possible';
    this.initialPosition = new OffsetPair({ global: event.position, local: event.localPosition });
    this.currentPosition = this.initialPosition;
    this.deadlineTimer = new GestureTimer(this.timers, kPressTimeout, () => {
      if (!this.isDisposed && !this.retiringTap) this.exceedDeadline();
    });
  }
  protected override handleNonAllowedPointer(event: PointerDownEvent): void {
    if (event.buttons !== kPrimaryButton && !this.wonPrimary) super.handleNonAllowedPointer(event);
  }
  override acceptGesture(pointer: number): void {
    if (pointer !== this.primary) return;
    this.stopDeadline();
    debugAssert(!this.accepted.has(pointer));
    this.accepted.add(pointer);
    if (this.currentDown !== null) this.checkTapDown(this.currentDown);
    if (this.isDisposed || this.retiringTap) return;
    this.wonPrimary = true;
    if (this.startEvent !== null && this.eagerVictoryOnDrag) {
      debugAssert(this.dragState === 'accepted' && this.currentUp === null);
      this.acceptDrag(this.startEvent);
    }
    if (this.startEvent !== null && !this.eagerVictoryOnDrag) {
      debugAssert(this.dragState === 'possible' && this.currentUp === null);
      this.dragState = 'accepted';
      this.acceptDrag(this.startEvent);
    }
    if (this.currentUp !== null) this.checkTapUp(this.currentUp);
  }
  protected override didStopTrackingLastPointer(pointer: number): void {
    switch (this.dragState) {
      case 'ready':
        this.checkCancel();
        this.resolve(GestureDisposition.rejected);
        break;
      case 'possible':
        if (this.pastSlop) {
          if (this.wonPrimary) {
            if (this.currentDown !== null) {
              if (!this.accepted.delete(pointer))
                this.resolvePointer(pointer, GestureDisposition.rejected);
              this.dragState = 'accepted';
              this.acceptDrag(this.currentDown);
              this.checkDragEnd();
            }
          } else {
            this.checkCancel();
            this.resolve(GestureDisposition.rejected);
          }
        } else if (this.currentUp !== null) this.checkTapUp(this.currentUp);
        break;
      case 'accepted':
        this.checkDragEnd();
        break;
    }
    this.stopDeadline();
    this.startEvent = null;
    this.dragState = 'ready';
    this.pastSlop = false;
  }
  protected override handleEvent(event: PointerEvent): void {
    if (event.pointer !== this.primary) return;
    super.handleEvent(event);
    if (this.isDisposed || this.retiringTap) return;
    if (event instanceof PointerMoveEvent) {
      this.pastSlop ||=
        event.position.subtract(this.initialPosition.global).distance >
        computeHitSlop(event.kind, this.gestureSettings);
      if (this.dragState === 'accepted') {
        this.currentPosition = OffsetPair.fromEventPosition(event);
        this.checkDragUpdate(event);
      } else if (this.dragState === 'possible') {
        if (this.startEvent === null) this.checkDrag(event);
        if (this.startEvent !== null && this.wonPrimary) {
          this.dragState = 'accepted';
          this.acceptDrag(this.startEvent);
        }
      }
    } else if (event instanceof PointerUpEvent) {
      if (this.dragState === 'possible') this.stopTrackingIfPointerNoLongerDown(event);
      else if (this.dragState === 'accepted') this.giveUpPointer(event.pointer);
    } else if (event instanceof PointerCancelEvent) {
      this.dragState = 'ready';
      this.giveUpPointer(event.pointer);
    }
  }
  override rejectGesture(pointer: number): void {
    if (pointer !== this.primary) return;
    super.rejectGesture(pointer);
    this.stopDeadline();
    this.giveUpPointer(pointer);
    this.resetTaps();
    this.resetThrottle();
  }
  override dispose(): void {
    if (this.isDisposed || this.retiringTap) return;
    this.retiringTap = true;
    const errors: unknown[] = [];
    for (const close of [
      () => this.stopDeadline(),
      () => {
        this.throttleTimer?.cancel();
        this.throttleTimer = null;
        this.lastUpdate = null;
      },
      () => super.dispose(),
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Tap-and-drag retirement failed');
  }
  override get debugDescription(): string {
    return 'tap_and_drag';
  }
  private acceptDrag(event: PointerEvent): void {
    debugAssert(this.dragState === 'accepted');
    if (!this.wonPrimary) return;
    if (this.dragStartBehavior === DragStartBehavior.start) {
      this.initialPosition = this.initialPosition.add(
        new OffsetPair({ global: event.delta, local: event.localDelta }),
      );
      this.currentPosition = this.initialPosition;
    }
    this.checkDragStart(event);
    if (this.isDisposed || this.retiringTap) return;
    const localDelta = event.localDelta;
    if (!localDelta.equals(Offset.zero)) {
      this.currentPosition = OffsetPair.fromEventPosition(event);
      const correctedLocal = this.initialPosition.local.add(localDelta),
        globalDelta = PointerEvent.transformDeltaViaPositions({
          transform: event.transform === null ? null : inverse(event.transform),
          untransformedDelta: localDelta,
          untransformedEndPosition: correctedLocal,
        });
      this.checkDragUpdate(
        event,
        this.initialPosition.add(new OffsetPair({ local: localDelta, global: globalDelta })),
      );
    }
  }
  private checkDrag(event: PointerMoveEvent): void {
    const localToGlobal = event.transform === null ? null : inverse(event.transform),
      local = this.getDeltaForDetails(event.localDelta);
    this.globalDistanceMoved +=
      PointerEvent.transformDeltaViaPositions({
        transform: localToGlobal,
        untransformedDelta: local,
        untransformedEndPosition: event.localPosition,
      }).distance * Math.sign(this.getPrimaryValueFromOffset(local) ?? 1);
    this.globalDistanceAllAxes += PointerEvent.transformDeltaViaPositions({
      transform: localToGlobal,
      untransformedDelta: event.localDelta,
      untransformedEndPosition: event.localPosition,
    }).distance;
    if (
      this.hasSufficientGlobalDistanceToAccept(event.kind) ||
      (this.wonPrimary &&
        Math.abs(this.globalDistanceAllAxes) > computePanSlop(event.kind, this.gestureSettings))
    ) {
      this.startEvent = event;
      if (this.eagerVictoryOnDrag) {
        this.dragState = 'accepted';
        if (!this.wonPrimary) this.resolve(GestureDisposition.accepted);
      }
    }
  }
  private checkTapDown(event: PointerDownEvent): void {
    if (this.sentTapDown) return;
    const details = new TapDragDownDetails({
      globalPosition: event.position,
      localPosition: event.localPosition,
      kind: this.getKindForPointer(event.pointer),
      consecutiveTapCount: this.consecutiveTapCount,
    });
    if (this.onTapDown !== null) this.invokeCallback('onTapDown', () => this.onTapDown!(details));
    this.sentTapDown = true;
  }
  private checkTapUp(event: PointerUpEvent): void {
    if (!this.wonPrimary) return;
    const details = new TapDragUpDetails({
      kind: event.kind,
      globalPosition: event.position,
      localPosition: event.localPosition,
      consecutiveTapCount: this.consecutiveTapCount,
    });
    if (this.onTapUp !== null)
      this.invokeCallback('onTapUp', () => this.onTapUp!(details), {
        inputTimestamp: event.timeStamp,
      });
    this.resetTaps();
    if (!this.accepted.delete(event.pointer))
      this.resolvePointer(event.pointer, GestureDisposition.rejected);
  }
  private checkDragStart(event: PointerEvent): void {
    if (this.onDragStart !== null) {
      const details = new TapDragStartDetails({
        sourceTimeStamp: event.timeStamp,
        globalPosition: this.initialPosition.global,
        localPosition: this.initialPosition.local,
        kind: this.getKindForPointer(event.pointer),
        consecutiveTapCount: this.consecutiveTapCount,
      });
      this.invokeCallback('onDragStart', () => this.onDragStart!(details));
    }
    this.startEvent = null;
  }
  private checkDragUpdate(event: PointerEvent, corrected?: OffsetPair): void {
    const global = corrected?.global ?? event.position,
      local = corrected?.local ?? event.localPosition,
      details = new TapDragUpdateDetails({
        sourceTimeStamp: event.timeStamp,
        delta: event.localDelta,
        globalPosition: global,
        kind: this.getKindForPointer(event.pointer),
        localPosition: local,
        offsetFromOrigin: global.subtract(this.initialPosition.global),
        localOffsetFromOrigin: local.subtract(this.initialPosition.local),
        consecutiveTapCount: this.consecutiveTapCount,
      });
    if (this.dragUpdateThrottleFrequency !== null) {
      this.lastUpdate = details;
      this.throttleTimer ??= new GestureTimer(this.timers, this.dragUpdateThrottleFrequency, () => {
        if (!this.isDisposed && !this.retiringTap) this.flushThrottledUpdate();
      });
    } else if (this.onDragUpdate !== null)
      this.invokeCallback('onDragUpdate', () => this.onDragUpdate!(details));
  }
  private flushThrottledUpdate(): void {
    debugAssert(this.lastUpdate !== null);
    if (this.onDragUpdate !== null)
      this.invokeCallback('onDragUpdate', () => this.onDragUpdate!(this.lastUpdate!));
    this.throttleTimer = null;
    this.lastUpdate = null;
  }
  private checkDragEnd(): void {
    if (this.throttleTimer !== null) {
      this.throttleTimer.cancel();
      this.flushThrottledUpdate();
    }
    if (this.isDisposed || this.retiringTap) return;
    const details = new TapDragEndDetails({
      globalPosition: this.currentPosition.global,
      localPosition: this.currentPosition.local,
      primaryVelocity: 0,
      consecutiveTapCount: this.consecutiveTapCount,
    });
    if (this.onDragEnd !== null) this.invokeCallback('onDragEnd', () => this.onDragEnd!(details));
    this.resetTaps();
    this.resetThrottle();
  }
  private checkCancel(): void {
    if (!this.sentTapDown) return;
    if (this.onCancel !== null) this.invokeCallback('onCancel', this.onCancel);
    this.resetThrottle();
    this.resetTaps();
  }
  private exceedDeadline(): void {
    if (this.currentDown !== null) {
      this.checkTapDown(this.currentDown);
      if (this.consecutiveTapCount > 1 && !this.isDisposed && !this.retiringTap)
        this.resolve(GestureDisposition.accepted);
    }
  }
  private giveUpPointer(pointer: number): void {
    this.stopTrackingPointer(pointer);
    if (!this.accepted.delete(pointer)) this.resolvePointer(pointer, GestureDisposition.rejected);
  }
  private resetTaps(): void {
    this.sentTapDown = false;
    this.wonPrimary = false;
    this.primary = null;
  }
  private resetThrottle(): void {
    if (this.dragUpdateThrottleFrequency === null) return;
    this.lastUpdate = null;
    this.throttleTimer?.cancel();
    this.throttleTimer = null;
  }
  private stopDeadline(): void {
    this.deadlineTimer?.cancel();
    this.deadlineTimer = null;
  }
}
export class TapAndHorizontalDragGestureRecognizer extends BaseTapAndDragGestureRecognizer {
  protected override hasSufficientGlobalDistanceToAccept(kind: PointerDeviceKind): boolean {
    return Math.abs(this.globalDistanceMoved) > computeHitSlop(kind, this.gestureSettings);
  }
  protected override getDeltaForDetails(delta: Offset): Offset {
    return new Offset(delta.dx, 0);
  }
  protected override getPrimaryValueFromOffset(value: Offset): number {
    return value.dx;
  }
  override get debugDescription(): string {
    return 'tap and horizontal drag';
  }
}
export class TapAndPanGestureRecognizer extends BaseTapAndDragGestureRecognizer {
  protected override hasSufficientGlobalDistanceToAccept(kind: PointerDeviceKind): boolean {
    return Math.abs(this.globalDistanceMoved) > computePanSlop(kind, this.gestureSettings);
  }
  protected override getDeltaForDetails(delta: Offset): Offset {
    return delta;
  }
  protected override getPrimaryValueFromOffset(_value: Offset): number | null {
    return null;
  }
  override get debugDescription(): string {
    return 'tap and pan';
  }
}
/** @deprecated Source alias retained with its own runtime class. */
export class TapAndDragGestureRecognizer extends BaseTapAndDragGestureRecognizer {
  protected override hasSufficientGlobalDistanceToAccept(kind: PointerDeviceKind): boolean {
    return Math.abs(this.globalDistanceMoved) > computePanSlop(kind, this.gestureSettings);
  }
  protected override getDeltaForDetails(delta: Offset): Offset {
    return delta;
  }
  protected override getPrimaryValueFromOffset(_value: Offset): number | null {
    return null;
  }
  override get debugDescription(): string {
    return 'tap and pan';
  }
}
