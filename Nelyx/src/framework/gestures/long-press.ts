// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/long_press.dart with the actual View's timers, clock and arena.
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { EnumProperty } from '../../foundation/diagnostic-properties.ts';
import { invariant } from '../../foundation/errors.ts';
import { Offset } from '../../ui/offset.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import {
  PrimaryPointerGestureRecognizer,
  GestureRecognizerState,
  OffsetPair,
} from './recognizer.ts';
import type { PrimaryPointerGestureRecognizerOptions } from './recognizer.ts';
import type { PositionedGestureDetails } from './gesture-details.ts';
import { GestureDisposition } from './arena.ts';
import { kLongPressTimeout } from './constants.ts';
import { VelocityTracker, Velocity } from './velocity-tracker.ts';
import {
  PointerEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  kPrimaryButton,
  kSecondaryButton,
  kTertiaryButton,
} from './events.ts';
interface Positions {
  readonly globalPosition?: Offset;
  readonly localPosition?: Offset | null;
}
function validate(global: Offset, local: Offset | null): void {
  invariant(
    global instanceof Offset && (local === null || local instanceof Offset),
    'invalid-long-press-position',
    'Long press positions require Offset values',
  );
}
export class LongPressDownDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly kind: PointerDeviceKind | null;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    kind = null,
  }: Positions & { readonly kind?: PointerDeviceKind | null } = {}) {
    super();
    validate(globalPosition, localPosition);
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.kind = kind;
    if (new.target === LongPressDownDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new EnumProperty('kind', this.kind));
  }
}
export class LongPressStartDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  constructor({ globalPosition = Offset.zero, localPosition = null }: Positions = {}) {
    super();
    validate(globalPosition, localPosition);
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    if (new.target === LongPressStartDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
  }
}
export class LongPressMoveUpdateDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly offsetFromOrigin: Offset;
  readonly localOffsetFromOrigin: Offset;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    offsetFromOrigin = Offset.zero,
    localOffsetFromOrigin = null,
  }: Positions & {
    readonly offsetFromOrigin?: Offset;
    readonly localOffsetFromOrigin?: Offset | null;
  } = {}) {
    super();
    validate(globalPosition, localPosition);
    validate(offsetFromOrigin, localOffsetFromOrigin);
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.offsetFromOrigin = offsetFromOrigin;
    this.localOffsetFromOrigin = localOffsetFromOrigin ?? offsetFromOrigin;
    if (new.target === LongPressMoveUpdateDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DiagnosticsProperty('offsetFromOrigin', this.offsetFromOrigin));
    properties.add(new DiagnosticsProperty('localOffsetFromOrigin', this.localOffsetFromOrigin));
  }
}
export class LongPressEndDetails
  extends Diagnosticable(class {})
  implements PositionedGestureDetails
{
  readonly globalPosition: Offset;
  readonly localPosition: Offset;
  readonly velocity: Velocity;
  constructor({
    globalPosition = Offset.zero,
    localPosition = null,
    velocity = Velocity.zero,
  }: Positions & { readonly velocity?: Velocity } = {}) {
    super();
    validate(globalPosition, localPosition);
    invariant(
      velocity instanceof Velocity,
      'invalid-long-press-velocity',
      'Long press end velocity requires Velocity',
    );
    this.globalPosition = globalPosition;
    this.localPosition = localPosition ?? globalPosition;
    this.velocity = velocity;
    if (new.target === LongPressEndDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('globalPosition', this.globalPosition));
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DiagnosticsProperty('velocity', this.velocity));
  }
}
export type GestureLongPressDownCallback = (details: LongPressDownDetails) => void;
export type GestureLongPressCancelCallback = () => void;
export type GestureLongPressCallback = () => void;
export type GestureLongPressUpCallback = () => void;
export type GestureLongPressStartCallback = (details: LongPressStartDetails) => void;
export type GestureLongPressMoveUpdateCallback = (details: LongPressMoveUpdateDetails) => void;
export type GestureLongPressEndCallback = (details: LongPressEndDetails) => void;
type Family = 'onLongPress' | 'onSecondaryLongPress' | 'onTertiaryLongPress';
type DetailSuffix = 'Down' | 'Start' | 'MoveUpdate' | 'End';
type VoidSuffix = '' | 'Cancel' | 'Up';
type DetailCallbackName = `${Family}${DetailSuffix}`;
type VoidCallbackName = `${Family}${VoidSuffix}`;
export interface LongPressGestureRecognizerOptions extends Omit<
  PrimaryPointerGestureRecognizerOptions,
  'deadline'
> {
  readonly duration?: number | null;
}
export class LongPressGestureRecognizer extends PrimaryPointerGestureRecognizer {
  onLongPressDown: GestureLongPressDownCallback | null = null;
  onLongPressCancel: GestureLongPressCancelCallback | null = null;
  onLongPress: GestureLongPressCallback | null = null;
  onLongPressStart: GestureLongPressStartCallback | null = null;
  onLongPressMoveUpdate: GestureLongPressMoveUpdateCallback | null = null;
  onLongPressUp: GestureLongPressUpCallback | null = null;
  onLongPressEnd: GestureLongPressEndCallback | null = null;
  onSecondaryLongPressDown: GestureLongPressDownCallback | null = null;
  onSecondaryLongPressCancel: GestureLongPressCancelCallback | null = null;
  onSecondaryLongPress: GestureLongPressCallback | null = null;
  onSecondaryLongPressStart: GestureLongPressStartCallback | null = null;
  onSecondaryLongPressMoveUpdate: GestureLongPressMoveUpdateCallback | null = null;
  onSecondaryLongPressUp: GestureLongPressUpCallback | null = null;
  onSecondaryLongPressEnd: GestureLongPressEndCallback | null = null;
  onTertiaryLongPressDown: GestureLongPressDownCallback | null = null;
  onTertiaryLongPressCancel: GestureLongPressCancelCallback | null = null;
  onTertiaryLongPress: GestureLongPressCallback | null = null;
  onTertiaryLongPressStart: GestureLongPressStartCallback | null = null;
  onTertiaryLongPressMoveUpdate: GestureLongPressMoveUpdateCallback | null = null;
  onTertiaryLongPressUp: GestureLongPressUpCallback | null = null;
  onTertiaryLongPressEnd: GestureLongPressEndCallback | null = null;
  private longPressAccepted = false;
  private longPressOrigin: OffsetPair | null = null;
  private initialButtons: number | null = null;
  private velocityTracker: VelocityTracker | null = null;
  constructor(options: LongPressGestureRecognizerOptions) {
    super({
      ...options,
      deadline: options.duration ?? kLongPressTimeout,
      postAcceptSlopTolerance: options.postAcceptSlopTolerance ?? null,
      allowedButtonsFilter:
        options.allowedButtonsFilter ?? LongPressGestureRecognizer.defaultButtons,
    });
  }
  private static defaultButtons(buttons: number): boolean {
    return (
      buttons === kPrimaryButton || buttons === kSecondaryButton || buttons === kTertiaryButton
    );
  }
  private familyForButtons(buttons: number | null): Family | null {
    return buttons === kPrimaryButton
      ? 'onLongPress'
      : buttons === kSecondaryButton
        ? 'onSecondaryLongPress'
        : buttons === kTertiaryButton
          ? 'onTertiaryLongPress'
          : null;
  }
  private family(): Family {
    const result = this.familyForButtons(this.initialButtons);
    invariant(result, 'unhandled-long-press-buttons', 'No supported initial button mask');
    return result;
  }
  protected override isPointerAllowed(event: PointerDownEvent): boolean {
    const prefix = this.familyForButtons(event.buttons);
    if (prefix === null) return false;
    if (
      (['', 'Down', 'Cancel', 'Start', 'MoveUpdate', 'End', 'Up'] as const).every(
        (suffix) => this[`${prefix}${suffix}`] === null,
      )
    )
      return false;
    return super.isPointerAllowed(event);
  }
  protected override didExceedDeadline(): void {
    this.resolve(GestureDisposition.accepted);
    if (this.isDisposed) return;
    this.longPressAccepted = true;
    super.acceptGesture(this.primaryPointer!);
    if (!this.isDisposed) this.checkLongPressStart();
  }
  protected override handlePrimaryPointer(event: PointerEvent): void {
    if (!event.synthesized) {
      if (event instanceof PointerDownEvent) {
        this.velocityTracker = VelocityTracker.withKind(event.kind, {
          clock: this.binding.samplingClock,
        });
        this.velocityTracker.addPosition(event.timeStamp, event.localPosition);
      }
      if (event instanceof PointerMoveEvent) {
        invariant(
          this.velocityTracker,
          'missing-long-press-velocity',
          'A move must follow a non-synthesized down',
        );
        this.velocityTracker.addPosition(event.timeStamp, event.localPosition);
      }
    }
    if (event instanceof PointerUpEvent) {
      try {
        if (this.longPressAccepted) this.checkLongPressEnd(event);
        else this.resolve(GestureDisposition.rejected);
      } finally {
        this.reset();
      }
    } else if (event instanceof PointerCancelEvent) {
      try {
        this.checkLongPressCancel();
      } finally {
        this.reset();
      }
    } else if (event instanceof PointerDownEvent) {
      this.longPressOrigin = OffsetPair.fromEventPosition(event);
      this.initialButtons = event.buttons;
      this.checkLongPressDown(event);
    } else if (event instanceof PointerMoveEvent) {
      if (event.buttons !== this.initialButtons && !this.longPressAccepted) {
        try {
          this.resolve(GestureDisposition.rejected);
        } finally {
          this.stopTrackingPointer(this.primaryPointer!);
        }
      } else if (this.longPressAccepted) this.checkLongPressMoveUpdate(event);
    }
  }
  private invokeDetails<T>(prefix: Family, suffix: DetailSuffix, details: T): void {
    if (this.isDisposed) return;
    const name = `${prefix}${suffix}` as DetailCallbackName;
    if (this[name] !== null)
      this.invokeCallback(name, () => (this[name] as unknown as (details: T) => void)(details));
  }
  private invokeVoid(prefix: Family, suffix: VoidSuffix): void {
    if (this.isDisposed) return;
    const name = `${prefix}${suffix}` as VoidCallbackName,
      callback = this[name];
    if (callback !== null) this.invokeCallback(name, callback);
  }
  private checkLongPressDown(event: PointerDownEvent): void {
    invariant(this.longPressOrigin, 'missing-long-press-origin', 'No press origin');
    const details = new LongPressDownDetails({
      globalPosition: this.longPressOrigin.global,
      localPosition: this.longPressOrigin.local,
      kind: this.getKindForPointer(event.pointer),
    });
    this.invokeDetails(this.family(), 'Down', details);
  }
  private checkLongPressCancel(): void {
    if (this.state === GestureRecognizerState.possible) {
      const prefix = this.family();
      const name = `${prefix}Cancel` as VoidCallbackName,
        callback = this[name];
      if (callback !== null) this.invokeCallback(name, callback);
    }
  }
  private checkLongPressStart(): void {
    const prefix = this.family();
    invariant(this.longPressOrigin, 'missing-long-press-origin', 'No press origin');
    this.invokeDetails(
      prefix,
      'Start',
      new LongPressStartDetails({
        globalPosition: this.longPressOrigin.global,
        localPosition: this.longPressOrigin.local,
      }),
    );
    this.invokeVoid(prefix, '');
  }
  private checkLongPressMoveUpdate(event: PointerEvent): void {
    invariant(this.longPressOrigin, 'missing-long-press-origin', 'No press origin');
    const details = new LongPressMoveUpdateDetails({
      globalPosition: event.position,
      localPosition: event.localPosition,
      offsetFromOrigin: event.position.subtract(this.longPressOrigin.global),
      localOffsetFromOrigin: event.localPosition.subtract(this.longPressOrigin.local),
    });
    this.invokeDetails(this.family(), 'MoveUpdate', details);
  }
  private checkLongPressEnd(event: PointerEvent): void {
    invariant(this.velocityTracker, 'missing-long-press-velocity', 'No press velocity tracker');
    const estimate = this.velocityTracker.getVelocityEstimate(),
      velocity =
        estimate === null
          ? Velocity.zero
          : new Velocity({ pixelsPerSecond: estimate.pixelsPerSecond }),
      details = new LongPressEndDetails({
        globalPosition: event.position,
        localPosition: event.localPosition,
        velocity,
      });
    this.velocityTracker = null;
    const prefix = this.family();
    this.invokeDetails(prefix, 'End', details);
    this.invokeVoid(prefix, 'Up');
  }
  private reset(): void {
    this.longPressAccepted = false;
    this.longPressOrigin = null;
    this.initialButtons = null;
    this.velocityTracker = null;
  }
  protected override resolve(disposition: GestureDisposition): void {
    let failed = false,
      failure: unknown;
    if (disposition === GestureDisposition.rejected) {
      if (this.longPressAccepted) this.reset();
      else
        try {
          this.checkLongPressCancel();
        } catch (error) {
          failed = true;
          failure = error;
        }
    }
    try {
      super.resolve(disposition);
    } catch (error) {
      if (failed) throw new AggregateError([failure, error], 'Long press cancellation failed');
      throw error;
    }
    if (failed) throw failure;
  }
  /** Source ignores ordinary arena wins; only its actual deadline starts the press. */
  override acceptGesture(_pointer: number): void {}
  override get debugDescription(): string {
    return 'long press';
  }
  override dispose(): void {
    if (this.isDisposed) return;
    try {
      super.dispose();
    } finally {
      this.reset();
    }
  }
}
