// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/scale.dart; Duration values use milliseconds and View clocks.
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { IntProperty, DoubleProperty } from '../../foundation/diagnostic-properties.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { Offset } from '../../ui/offset.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import { OneSequenceGestureRecognizer, DragStartBehavior } from './recognizer.ts';
import type { GestureRecognizerOptions } from './recognizer.ts';
import { GestureDisposition } from './arena.ts';
import {
  PointerEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  PointerPanZoomStartEvent,
  PointerPanZoomUpdateEvent,
  PointerPanZoomEndEvent,
  computePanSlop,
  computeScaleSlop,
} from './events.ts';
import { Velocity, VelocityTracker } from './velocity-tracker.ts';
import { kMinFlingVelocity, kMaxFlingVelocity } from './constants.ts';
export const kDefaultMouseScrollToScaleFactor = 200;
export const kDefaultTrackpadScrollToScaleFactor = new Offset(
  0,
  -1 / kDefaultMouseScrollToScaleFactor,
);
type ScaleState = 'ready' | 'possible' | 'accepted' | 'started';
class PointerPanZoomData {
  private constructor(
    readonly parent: ScaleGestureRecognizer,
    private readonly position: Offset,
    private readonly pan: Offset,
    private readonly scaleValue: number,
    private readonly rotationValue: number,
  ) {}
  static fromStartEvent(
    parent: ScaleGestureRecognizer,
    event: PointerPanZoomStartEvent,
  ): PointerPanZoomData {
    return new PointerPanZoomData(parent, event.position, Offset.zero, 1, 0);
  }
  static fromUpdateEvent(
    parent: ScaleGestureRecognizer,
    event: PointerPanZoomUpdateEvent,
  ): PointerPanZoomData {
    return new PointerPanZoomData(parent, event.position, event.pan, event.scale, event.rotation);
  }
  get focalPoint(): Offset {
    return this.parent.trackpadScrollCausesScale ? this.position : this.position.add(this.pan);
  }
  get scale(): number {
    return this.parent.trackpadScrollCausesScale
      ? this.scaleValue *
          Math.exp(
            this.pan.dx * this.parent.trackpadScrollToScaleFactor.dx +
              this.pan.dy * this.parent.trackpadScrollToScaleFactor.dy,
          )
      : this.scaleValue;
  }
  get rotation(): number {
    return this.rotationValue;
  }
  toString(): string {
    return (
      '_PointerPanZoomData(parent: ' +
      this.parent +
      ', _position: ' +
      this.position +
      ', _pan: ' +
      this.pan +
      ', _scale: ' +
      this.scaleValue +
      ', _rotation: ' +
      this.rotationValue +
      ')'
    );
  }
}
export class ScaleStartDetails extends Diagnosticable(class {}) {
  readonly focalPoint: Offset;
  readonly localFocalPoint: Offset;
  readonly pointerCount: number;
  readonly sourceTimeStamp: number | null;
  readonly kind: PointerDeviceKind | null;
  constructor({
    focalPoint = Offset.zero,
    localFocalPoint = null,
    pointerCount = 0,
    sourceTimeStamp = null,
    kind = null,
  }: {
    readonly focalPoint?: Offset;
    readonly localFocalPoint?: Offset | null;
    readonly pointerCount?: number;
    readonly sourceTimeStamp?: number | null;
    readonly kind?: PointerDeviceKind | null;
  } = {}) {
    super();
    this.focalPoint = focalPoint;
    this.localFocalPoint = localFocalPoint ?? focalPoint;
    this.pointerCount = pointerCount;
    this.sourceTimeStamp = sourceTimeStamp;
    this.kind = kind;
    if (new.target === ScaleStartDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('focalPoint', this.focalPoint));
    properties.add(new DiagnosticsProperty('localFocalPoint', this.localFocalPoint));
    properties.add(new IntProperty('pointerCount', this.pointerCount));
    properties.add(new DiagnosticsProperty('sourceTimeStamp', this.sourceTimeStamp));
  }
}
export class ScaleUpdateDetails extends Diagnosticable(class {}) {
  readonly focalPoint: Offset;
  readonly localFocalPoint: Offset;
  readonly scale: number;
  readonly horizontalScale: number;
  readonly verticalScale: number;
  readonly rotation: number;
  readonly pointerCount: number;
  readonly focalPointDelta: Offset;
  readonly sourceTimeStamp: number | null;
  constructor({
    focalPoint = Offset.zero,
    localFocalPoint = null,
    scale = 1,
    horizontalScale = 1,
    verticalScale = 1,
    rotation = 0,
    pointerCount = 0,
    focalPointDelta = Offset.zero,
    sourceTimeStamp = null,
  }: {
    readonly focalPoint?: Offset;
    readonly localFocalPoint?: Offset | null;
    readonly scale?: number;
    readonly horizontalScale?: number;
    readonly verticalScale?: number;
    readonly rotation?: number;
    readonly pointerCount?: number;
    readonly focalPointDelta?: Offset;
    readonly sourceTimeStamp?: number | null;
  } = {}) {
    super();
    invariant(
      scale >= 0 && horizontalScale >= 0 && verticalScale >= 0,
      'negative-scale-details',
      'Scale factors must be nonnegative',
    );
    this.focalPoint = focalPoint;
    this.localFocalPoint = localFocalPoint ?? focalPoint;
    this.scale = scale;
    this.horizontalScale = horizontalScale;
    this.verticalScale = verticalScale;
    this.rotation = rotation;
    this.pointerCount = pointerCount;
    this.focalPointDelta = focalPointDelta;
    this.sourceTimeStamp = sourceTimeStamp;
    if (new.target === ScaleUpdateDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('focalPointDelta', this.focalPointDelta));
    properties.add(new DiagnosticsProperty('focalPoint', this.focalPoint));
    properties.add(new DiagnosticsProperty('localFocalPoint', this.localFocalPoint));
    properties.add(new DoubleProperty('scale', this.scale));
    properties.add(new DoubleProperty('horizontalScale', this.horizontalScale));
    properties.add(new DoubleProperty('verticalScale', this.verticalScale));
    properties.add(new DoubleProperty('rotation', this.rotation));
    properties.add(new IntProperty('pointerCount', this.pointerCount));
    properties.add(new DiagnosticsProperty('sourceTimeStamp', this.sourceTimeStamp));
  }
}
export class ScaleEndDetails extends Diagnosticable(class {}) {
  readonly velocity: Velocity;
  readonly scaleVelocity: number;
  readonly pointerCount: number;
  constructor({
    velocity = Velocity.zero,
    scaleVelocity = 0,
    pointerCount = 0,
  }: {
    readonly velocity?: Velocity;
    readonly scaleVelocity?: number;
    readonly pointerCount?: number;
  } = {}) {
    super();
    this.velocity = velocity;
    this.scaleVelocity = scaleVelocity;
    this.pointerCount = pointerCount;
    if (new.target === ScaleEndDetails) Object.freeze(this);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('velocity', this.velocity));
    properties.add(new DoubleProperty('scaleVelocity', this.scaleVelocity));
    properties.add(new IntProperty('pointerCount', this.pointerCount));
  }
}
export type GestureScaleStartCallback = (details: ScaleStartDetails) => void;
export type GestureScaleUpdateCallback = (details: ScaleUpdateDetails) => void;
export type GestureScaleEndCallback = (details: ScaleEndDetails) => void;
function isFlingGesture(velocity: Velocity): boolean {
  return velocity.pixelsPerSecond.distanceSquared > kMinFlingVelocity * kMinFlingVelocity;
}
class LineBetweenPointers {
  readonly pointerStartLocation: Offset;
  readonly pointerStartId: number;
  readonly pointerEndLocation: Offset;
  readonly pointerEndId: number;
  constructor({
    pointerStartLocation = Offset.zero,
    pointerStartId = 0,
    pointerEndLocation = Offset.zero,
    pointerEndId = 1,
  }: {
    readonly pointerStartLocation?: Offset;
    readonly pointerStartId?: number;
    readonly pointerEndLocation?: Offset;
    readonly pointerEndId?: number;
  } = {}) {
    invariant(
      pointerStartId !== pointerEndId,
      'identical-scale-line-pointers',
      'Scale line requires distinct pointer identifiers',
    );
    this.pointerStartLocation = pointerStartLocation;
    this.pointerStartId = pointerStartId;
    this.pointerEndLocation = pointerEndLocation;
    this.pointerEndId = pointerEndId;
  }
}
export interface ScaleGestureRecognizerOptions extends GestureRecognizerOptions {
  readonly dragStartBehavior?: DragStartBehavior;
  readonly trackpadScrollCausesScale?: boolean;
  readonly trackpadScrollToScaleFactor?: Offset;
}
export class ScaleGestureRecognizer extends OneSequenceGestureRecognizer {
  dragStartBehavior: DragStartBehavior;
  trackpadScrollCausesScale: boolean;
  trackpadScrollToScaleFactor: Offset;
  onStart: GestureScaleStartCallback | null = null;
  onUpdate: GestureScaleUpdateCallback | null = null;
  onEnd: GestureScaleEndCallback | null = null;
  private state: ScaleState = 'ready';
  private lastTransform: TransformMatrix | null = null;
  private initialFocalPoint = Offset.zero;
  private currentFocalPoint: Offset | null = null;
  private initialSpan = 0;
  private currentSpan = 0;
  private initialHorizontalSpan = 0;
  private currentHorizontalSpan = 0;
  private initialVerticalSpan = 0;
  private currentVerticalSpan = 0;
  private localFocalPoint = Offset.zero;
  private initialLine: LineBetweenPointers | null = null;
  private currentLine: LineBetweenPointers | null = null;
  private readonly pointerLocations = new Map<number, Offset>();
  private readonly pointerQueue: number[] = [];
  private readonly velocityTrackers = new Map<number, VelocityTracker>();
  private scaleVelocityTracker: VelocityTracker | null = null;
  private delta = Offset.zero;
  private readonly pointerPanZooms = new Map<number, PointerPanZoomData>();
  private initialPanZoomScaleFactor = 1;
  private initialPanZoomRotationFactor = 0;
  private initialEventTimestamp: number | null = null;
  constructor(options: ScaleGestureRecognizerOptions) {
    super(options);
    this.dragStartBehavior = options.dragStartBehavior ?? DragStartBehavior.down;
    this.trackpadScrollCausesScale = options.trackpadScrollCausesScale ?? false;
    this.trackpadScrollToScaleFactor =
      options.trackpadScrollToScaleFactor ?? kDefaultTrackpadScrollToScaleFactor;
  }
  get pointerCount(): number {
    return 2 * this.pointerPanZooms.size + this.pointerQueue.length;
  }
  private get pointerScaleFactor(): number {
    return this.initialSpan > 0 ? this.currentSpan / this.initialSpan : 1;
  }
  private get pointerHorizontalScaleFactor(): number {
    return this.initialHorizontalSpan > 0
      ? this.currentHorizontalSpan / this.initialHorizontalSpan
      : 1;
  }
  private get pointerVerticalScaleFactor(): number {
    return this.initialVerticalSpan > 0 ? this.currentVerticalSpan / this.initialVerticalSpan : 1;
  }
  private get scaleFactor(): number {
    let scale = this.pointerScaleFactor;
    for (const p of this.pointerPanZooms.values())
      scale *= p.scale / this.initialPanZoomScaleFactor;
    return scale;
  }
  private get horizontalScaleFactor(): number {
    let scale = this.pointerHorizontalScaleFactor;
    for (const p of this.pointerPanZooms.values())
      scale *= p.scale / this.initialPanZoomScaleFactor;
    return scale;
  }
  private get verticalScaleFactor(): number {
    let scale = this.pointerVerticalScaleFactor;
    for (const p of this.pointerPanZooms.values())
      scale *= p.scale / this.initialPanZoomScaleFactor;
    return scale;
  }
  private computeRotationFactor(): number {
    let factor = 0;
    if (this.initialLine !== null && this.currentLine !== null) {
      const f = this.initialLine.pointerStartLocation,
        s = this.initialLine.pointerEndLocation,
        nf = this.currentLine.pointerStartLocation,
        ns = this.currentLine.pointerEndLocation;
      factor = Math.atan2(nf.dy - ns.dy, nf.dx - ns.dx) - Math.atan2(f.dy - s.dy, f.dx - s.dx);
    }
    for (const p of this.pointerPanZooms.values()) factor += p.rotation;
    return factor - this.initialPanZoomRotationFactor;
  }
  protected override addAllowedPointer(event: PointerDownEvent): void {
    super.addAllowedPointer(event);
    this.velocityTrackers.set(
      event.pointer,
      VelocityTracker.withKind(event.kind, { clock: this.binding.samplingClock }),
    );
    this.initialEventTimestamp = event.timeStamp;
    if (this.state === 'ready') {
      this.state = 'possible';
      this.initialSpan = 0;
      this.currentSpan = 0;
      this.initialHorizontalSpan = 0;
      this.currentHorizontalSpan = 0;
      this.initialVerticalSpan = 0;
      this.currentVerticalSpan = 0;
    }
  }
  /** Source admits panzoom regardless of supported-device/button filtering. */
  protected override isPointerPanZoomAllowed(_event: PointerPanZoomStartEvent): boolean {
    return true;
  }
  protected override addAllowedPointerPanZoom(event: PointerPanZoomStartEvent): void {
    super.addAllowedPointerPanZoom(event);
    this.startTrackingPointer(event.pointer, event.transform);
    this.velocityTrackers.set(
      event.pointer,
      VelocityTracker.withKind(event.kind, { clock: this.binding.samplingClock }),
    );
    this.initialEventTimestamp = event.timeStamp;
    if (this.state === 'ready') {
      this.state = 'possible';
      this.initialPanZoomScaleFactor = 1;
      this.initialPanZoomRotationFactor = 0;
    }
  }
  protected override handleEvent(event: PointerEvent): void {
    invariant(this.state !== 'ready', 'ready-scale-dispatch', 'Scale is not tracking');
    try {
      let changed = false,
        shouldStart = false;
      if (event instanceof PointerMoveEvent) {
        const tracker = this.velocityTrackers.get(event.pointer)!;
        if (!event.synthesized) tracker.addPosition(event.timeStamp, event.position);
        this.pointerLocations.set(event.pointer, event.position);
        shouldStart = true;
        this.lastTransform = event.transform;
      } else if (event instanceof PointerDownEvent) {
        this.pointerLocations.set(event.pointer, event.position);
        this.pointerQueue.push(event.pointer);
        changed = true;
        shouldStart = true;
        this.lastTransform = event.transform;
      } else if (event instanceof PointerUpEvent || event instanceof PointerCancelEvent) {
        this.pointerLocations.delete(event.pointer);
        this.removeQueuedPointer(event.pointer);
        changed = true;
        this.lastTransform = event.transform;
      } else if (event instanceof PointerPanZoomStartEvent) {
        invariant(
          !this.pointerPanZooms.has(event.pointer),
          'duplicate-scale-panzoom',
          'Panzoom already exists',
        );
        this.pointerPanZooms.set(event.pointer, PointerPanZoomData.fromStartEvent(this, event));
        changed = true;
        shouldStart = true;
        this.lastTransform = event.transform;
      } else if (event instanceof PointerPanZoomUpdateEvent) {
        invariant(
          this.pointerPanZooms.has(event.pointer),
          'missing-scale-panzoom',
          'Panzoom must start before updating',
        );
        if (!event.synthesized && !this.trackpadScrollCausesScale)
          this.velocityTrackers.get(event.pointer)!.addPosition(event.timeStamp, event.pan);
        this.pointerPanZooms.set(event.pointer, PointerPanZoomData.fromUpdateEvent(this, event));
        this.lastTransform = event.transform;
        shouldStart = true;
      } else if (event instanceof PointerPanZoomEndEvent) {
        invariant(
          this.pointerPanZooms.has(event.pointer),
          'missing-scale-panzoom',
          'Panzoom must start before ending',
        );
        this.pointerPanZooms.delete(event.pointer);
        changed = true;
      }
      this.updateLines();
      this.update();
      if (!changed || this.reconfigure(event.pointer))
        if (!this.isDisposed) this.advanceStateMachine(shouldStart, event);
    } finally {
      if (!this.isDisposed) this.stopTrackingIfPointerNoLongerDown(event);
    }
  }
  private removeQueuedPointer(pointer: number): void {
    const index = this.pointerQueue.indexOf(pointer);
    if (index >= 0) this.pointerQueue.splice(index, 1);
  }
  private update(): void {
    const previous = this.currentFocalPoint;
    let focal = Offset.zero;
    for (const position of this.pointerLocations.values()) focal = focal.add(position);
    for (const p of this.pointerPanZooms.values()) focal = focal.add(p.focalPoint);
    this.currentFocalPoint = focal.divide(
      Math.max(1, this.pointerLocations.size + this.pointerPanZooms.size),
    );
    if (previous === null) {
      this.localFocalPoint = PointerEvent.transformPosition(
        this.lastTransform,
        this.currentFocalPoint,
      );
      this.delta = Offset.zero;
    } else {
      const localPrevious = this.localFocalPoint;
      this.localFocalPoint = PointerEvent.transformPosition(
        this.lastTransform,
        this.currentFocalPoint,
      );
      this.delta = this.localFocalPoint.subtract(localPrevious);
    }
    const count = this.pointerLocations.size;
    let pointerFocal = Offset.zero;
    for (const position of this.pointerLocations.values())
      pointerFocal = pointerFocal.add(position);
    if (count > 0) pointerFocal = pointerFocal.divide(count);
    let total = 0,
      horizontal = 0,
      vertical = 0;
    for (const position of this.pointerLocations.values()) {
      total += pointerFocal.subtract(position).distance;
      horizontal += Math.abs(pointerFocal.dx - position.dx);
      vertical += Math.abs(pointerFocal.dy - position.dy);
    }
    this.currentSpan = count > 0 ? total / count : 0;
    this.currentHorizontalSpan = count > 0 ? horizontal / count : 0;
    this.currentVerticalSpan = count > 0 ? vertical / count : 0;
  }
  private updateLines(): void {
    const count = this.pointerLocations.size;
    invariant(
      this.pointerQueue.length >= count,
      'invalid-scale-pointer-queue',
      'Scale pointer queue is incomplete',
    );
    if (count < 2) this.initialLine = this.currentLine;
    else if (
      this.initialLine !== null &&
      this.initialLine.pointerStartId === this.pointerQueue[0] &&
      this.initialLine.pointerEndId === this.pointerQueue[1]
    )
      this.currentLine = new LineBetweenPointers({
        pointerStartId: this.pointerQueue[0]!,
        pointerStartLocation: this.pointerLocations.get(this.pointerQueue[0]!)!,
        pointerEndId: this.pointerQueue[1]!,
        pointerEndLocation: this.pointerLocations.get(this.pointerQueue[1]!)!,
      });
    else {
      this.initialLine = new LineBetweenPointers({
        pointerStartId: this.pointerQueue[0]!,
        pointerStartLocation: this.pointerLocations.get(this.pointerQueue[0]!)!,
        pointerEndId: this.pointerQueue[1]!,
        pointerEndLocation: this.pointerLocations.get(this.pointerQueue[1]!)!,
      });
      this.currentLine = this.initialLine;
    }
  }
  private rebasePanZoom(): void {
    if (this.pointerPanZooms.size === 0) {
      this.initialPanZoomScaleFactor = 1;
      this.initialPanZoomRotationFactor = 0;
    } else {
      this.initialPanZoomScaleFactor = this.scaleFactor / this.pointerScaleFactor;
      this.initialPanZoomRotationFactor = 0;
      for (const p of this.pointerPanZooms.values())
        this.initialPanZoomRotationFactor += p.rotation;
    }
  }
  private reconfigure(pointer: number): boolean {
    this.initialFocalPoint = this.currentFocalPoint!;
    this.initialSpan = this.currentSpan;
    this.initialLine = this.currentLine;
    this.initialHorizontalSpan = this.currentHorizontalSpan;
    this.initialVerticalSpan = this.currentVerticalSpan;
    this.rebasePanZoom();
    if (this.state === 'started') {
      try {
        if (this.onEnd !== null) {
          let velocity = this.velocityTrackers.get(pointer)!.getVelocity();
          if (isFlingGesture(velocity)) {
            const pixels = velocity.pixelsPerSecond;
            if (pixels.distanceSquared > kMaxFlingVelocity * kMaxFlingVelocity)
              velocity = new Velocity({
                pixelsPerSecond: pixels.divide(pixels.distance).multiply(kMaxFlingVelocity),
              });
            this.invokeCallback('onEnd', () =>
              this.onEnd!(
                new ScaleEndDetails({
                  velocity,
                  scaleVelocity: this.scaleVelocityTracker?.getVelocity().pixelsPerSecond.dx ?? -1,
                  pointerCount: this.pointerCount,
                }),
              ),
            );
          } else
            this.invokeCallback('onEnd', () =>
              this.onEnd!(
                new ScaleEndDetails({
                  scaleVelocity: this.scaleVelocityTracker?.getVelocity().pixelsPerSecond.dx ?? -1,
                  pointerCount: this.pointerCount,
                }),
              ),
            );
        }
      } finally {
        if (!this.isDisposed) {
          this.state = 'accepted';
          this.scaleVelocityTracker = VelocityTracker.withKind(PointerDeviceKind.touch, {
            clock: this.binding.samplingClock,
          });
        }
      }
      return false;
    }
    this.scaleVelocityTracker = VelocityTracker.withKind(PointerDeviceKind.touch, {
      clock: this.binding.samplingClock,
    });
    return true;
  }
  private advanceStateMachine(shouldStart: boolean, event: PointerEvent): void {
    if (this.state === 'ready') this.state = 'possible';
    if (this.state === 'possible') {
      const spanDelta = Math.abs(this.currentSpan - this.initialSpan),
        focalDelta = this.currentFocalPoint!.subtract(this.initialFocalPoint).distance;
      if (
        spanDelta > computeScaleSlop(event.kind) ||
        focalDelta > computePanSlop(event.kind, this.gestureSettings) ||
        Math.max(
          this.scaleFactor / this.pointerScaleFactor,
          this.pointerScaleFactor / this.scaleFactor,
        ) > 1.05
      )
        this.resolve(GestureDisposition.accepted);
    } else if (this.state === 'accepted' || this.state === 'started')
      this.resolve(GestureDisposition.accepted);
    if (this.isDisposed) return;
    if (this.state === 'accepted' && shouldStart) {
      this.initialEventTimestamp = event.timeStamp;
      this.state = 'started';
      this.dispatchOnStartCallbackIfNeeded();
    }
    if (!this.isDisposed && this.state === 'started') {
      this.scaleVelocityTracker?.addPosition(event.timeStamp, new Offset(this.scaleFactor, 0));
      if (this.onUpdate !== null)
        this.invokeCallback('onUpdate', () =>
          this.onUpdate!(
            new ScaleUpdateDetails({
              scale: this.scaleFactor,
              horizontalScale: this.horizontalScaleFactor,
              verticalScale: this.verticalScaleFactor,
              focalPoint: this.currentFocalPoint!,
              localFocalPoint: this.localFocalPoint,
              rotation: this.computeRotationFactor(),
              pointerCount: this.pointerCount,
              focalPointDelta: this.delta,
              sourceTimeStamp: event.timeStamp,
            }),
          ),
        );
    }
  }
  private dispatchOnStartCallbackIfNeeded(): void {
    invariant(this.state === 'started', 'unstarted-scale-callback', 'Scale has not started');
    try {
      if (this.onStart !== null)
        this.invokeCallback('onStart', () =>
          this.onStart!(
            new ScaleStartDetails({
              focalPoint: this.currentFocalPoint!,
              localFocalPoint: this.localFocalPoint,
              pointerCount: this.pointerCount,
              sourceTimeStamp: this.initialEventTimestamp,
              kind: this.pointerQueue.length
                ? this.getKindForPointer(this.pointerQueue[0]!)
                : this.pointerPanZooms.size
                  ? this.getKindForPointer(this.pointerPanZooms.keys().next().value!)
                  : null,
            }),
          ),
        );
    } finally {
      this.initialEventTimestamp = null;
    }
  }
  override acceptGesture(_pointer: number): void {
    if (this.isDisposed) return;
    if (this.state === 'possible') {
      this.state = 'started';
      this.dispatchOnStartCallbackIfNeeded();
      if (this.isDisposed) return;
      if (this.dragStartBehavior === DragStartBehavior.start) {
        this.initialFocalPoint = this.currentFocalPoint!;
        this.initialSpan = this.currentSpan;
        this.initialLine = this.currentLine;
        this.initialHorizontalSpan = this.currentHorizontalSpan;
        this.initialVerticalSpan = this.currentVerticalSpan;
        this.rebasePanZoom();
      }
    }
  }
  override rejectGesture(pointer: number): void {
    if (this.isDisposed) return;
    this.pointerPanZooms.delete(pointer);
    this.pointerLocations.delete(pointer);
    this.removeQueuedPointer(pointer);
    this.stopTrackingPointer(pointer);
  }
  protected override didStopTrackingLastPointer(_pointer: number): void {
    try {
      if (this.state === 'possible') this.resolve(GestureDisposition.rejected);
      else if (FoundationBuildMode.debug)
        invariant(
          this.state === 'accepted',
          'invalid-final-scale-state',
          'Final scale tracking must be accepted',
        );
    } finally {
      this.state = 'ready';
    }
  }
  override dispose(): void {
    if (this.isDisposed) return;
    try {
      super.dispose();
    } finally {
      this.velocityTrackers.clear();
      this.scaleVelocityTracker = null;
      this.pointerLocations.clear();
      this.pointerQueue.length = 0;
      this.pointerPanZooms.clear();
      this.initialLine = null;
      this.currentLine = null;
      this.currentFocalPoint = null;
      this.lastTransform = null;
      this.initialEventTimestamp = null;
      this.state = 'ready';
    }
  }
  override get debugDescription(): string {
    return 'scale';
  }
}
