// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Offset } from '../../ui/offset.ts';
import { invariant } from '../../foundation/errors.ts';
import {
  PointerEvent,
  PointerMoveEvent,
  PointerHoverEvent,
  PointerRemovedEvent,
  PointerUpEvent,
} from './events.ts';
export type HandleEventCallback = (event: PointerEvent) => void;
/** Source single-stream interpolation. SamplingClock/per-View scheduling and
 * actual device grouping belong to GestureBinding's owner, not this value queue. */
export class PointerEventResampler {
  private readonly queuedEvents: PointerEvent[] = [];
  private head = 0;
  private last: PointerEvent | null = null;
  private next: PointerEvent | null = null;
  private position = Offset.zero;
  private tracked = false;
  private down = false;
  private pointerIdentifier = 0;
  private hasButtons = 0;
  private toHoverEvent(
    event: PointerEvent,
    position: Offset,
    delta: Offset,
    timeStamp: number,
    _buttons: number,
  ): PointerHoverEvent {
    // The source uses event.buttons rather than its buttons argument.
    return new PointerHoverEvent({
      viewId: event.viewId,
      timeStamp,
      kind: event.kind,
      device: event.device,
      position,
      delta,
      buttons: event.buttons,
      obscured: event.obscured,
      pressureMin: event.pressureMin,
      pressureMax: event.pressureMax,
      distance: event.distance,
      distanceMax: event.distanceMax,
      size: event.size,
      radiusMajor: event.radiusMajor,
      radiusMinor: event.radiusMinor,
      radiusMin: event.radiusMin,
      radiusMax: event.radiusMax,
      orientation: event.orientation,
      tilt: event.tilt,
      synthesized: event.synthesized,
      embedderId: event.embedderId,
    });
  }
  private toMoveEvent(
    event: PointerEvent,
    position: Offset,
    delta: Offset,
    pointer: number,
    timeStamp: number,
    buttons: number,
  ): PointerMoveEvent {
    return new PointerMoveEvent({
      viewId: event.viewId,
      timeStamp,
      pointer,
      kind: event.kind,
      device: event.device,
      position,
      delta,
      buttons,
      obscured: event.obscured,
      pressure: event.pressure,
      pressureMin: event.pressureMin,
      pressureMax: event.pressureMax,
      distanceMax: event.distanceMax,
      size: event.size,
      radiusMajor: event.radiusMajor,
      radiusMinor: event.radiusMinor,
      radiusMin: event.radiusMin,
      radiusMax: event.radiusMax,
      orientation: event.orientation,
      tilt: event.tilt,
      platformData: event.platformData,
      synthesized: event.synthesized,
      embedderId: event.embedderId,
    });
  }
  private toMoveOrHoverEvent(
    event: PointerEvent,
    position: Offset,
    delta: Offset,
    pointer: number,
    timeStamp: number,
    isDown: boolean,
    buttons: number,
  ): PointerEvent {
    return isDown
      ? this.toMoveEvent(event, position, delta, pointer, timeStamp, buttons)
      : this.toHoverEvent(event, position, delta, timeStamp, buttons);
  }
  private positionAt(sampleTime: number): Offset {
    let x = this.next?.position.dx ?? 0,
      y = this.next?.position.dy ?? 0;
    const nextTime = this.next?.timeStamp ?? 0,
      lastTime = this.last?.timeStamp ?? 0;
    if (nextTime > sampleTime && nextTime > lastTime) {
      const scalar = (sampleTime - lastTime) / (nextTime - lastTime),
        lastX = this.last?.position.dx ?? 0,
        lastY = this.last?.position.dy ?? 0;
      x = lastX + (x - lastX) * scalar;
      y = lastY + (y - lastY) * scalar;
    }
    return new Offset(x, y);
  }
  private processPointerEvents(sampleTime: number): void {
    for (let index = this.head; index < this.queuedEvents.length; index++) {
      const event = this.queuedEvents[index]!;
      if (event.timeStamp <= sampleTime || this.last === null) {
        this.last = event;
        this.next = event;
        continue;
      }
      if ((this.next?.timeStamp ?? 0) < sampleTime) {
        this.next = event;
        break;
      }
    }
  }
  private dequeueAndSampleNonHoverOrMovePointerEventsUntil(
    sampleTime: number,
    nextSampleTime: number,
    callback: HandleEventCallback,
  ): void {
    let endTime = sampleTime;
    for (let index = this.head; index < this.queuedEvents.length; index++) {
      const event = this.queuedEvents[index]!;
      if (event.timeStamp > sampleTime) {
        if (event.timeStamp >= nextSampleTime) break;
        if (event instanceof PointerUpEvent || event instanceof PointerRemovedEvent) {
          endTime = event.timeStamp;
          continue;
        }
        if (!(event instanceof PointerMoveEvent) && !(event instanceof PointerHoverEvent)) break;
      }
    }
    while (this.hasPendingEvents) {
      const event = this.queuedEvents[this.head]!;
      if (event.timeStamp > endTime) break;
      const wasTracked = this.tracked,
        wasDown = this.down,
        hadButtons = this.hasButtons;
      this.tracked = !(event instanceof PointerRemovedEvent);
      this.down = event.down;
      this.hasButtons = event.buttons;
      const position = this.positionAt(sampleTime);
      if (this.tracked && !wasTracked) this.position = position;
      const pointer = event.pointer;
      invariant(
        !wasDown || this.pointerIdentifier === pointer,
        'resampler-pointer-changed',
        'A sampled contact cannot change pointer identity',
      );
      this.pointerIdentifier = pointer;
      if (!(event instanceof PointerMoveEvent) && !(event instanceof PointerHoverEvent)) {
        if (!position.equals(this.position)) {
          const delta = position.subtract(this.position);
          callback(
            this.toMoveOrHoverEvent(
              event,
              position,
              delta,
              this.pointerIdentifier,
              sampleTime,
              wasDown,
              hadButtons,
            ),
          );
          this.position = position;
        }
        callback(event.copyWith({ position, delta: Offset.zero, pointer, timeStamp: sampleTime }));
      }
      this.removeFirst();
    }
  }
  private samplePointerPosition(sampleTime: number, callback: HandleEventCallback): void {
    const position = this.positionAt(sampleTime),
      next = this.next;
    if (!position.equals(this.position) && next !== null) {
      const delta = position.subtract(this.position);
      callback(
        this.toMoveOrHoverEvent(
          next,
          position,
          delta,
          this.pointerIdentifier,
          sampleTime,
          this.down,
          this.hasButtons,
        ),
      );
      this.position = position;
    }
  }
  private removeFirst(): PointerEvent {
    const event = this.queuedEvents[this.head++]!;
    if (this.head === this.queuedEvents.length) {
      this.queuedEvents.length = 0;
      this.head = 0;
    } else if (this.head > 1024 && this.head * 2 > this.queuedEvents.length) {
      this.queuedEvents.splice(0, this.head);
      this.head = 0;
    }
    return event;
  }
  addEvent(event: PointerEvent): void {
    this.queuedEvents.push(event);
  }
  sample(sampleTime: number, nextSampleTime: number, callback: HandleEventCallback): void {
    this.processPointerEvents(sampleTime);
    this.dequeueAndSampleNonHoverOrMovePointerEventsUntil(sampleTime, nextSampleTime, callback);
    if (this.tracked) this.samplePointerPosition(sampleTime, callback);
  }
  stop(callback: HandleEventCallback): void {
    while (this.hasPendingEvents) callback(this.removeFirst());
    this.pointerIdentifier = 0;
    this.down = false;
    this.tracked = false;
    this.position = Offset.zero;
    this.next = null;
    this.last = null;
  }
  get hasPendingEvents(): boolean {
    return this.head < this.queuedEvents.length;
  }
  get isTracked(): boolean {
    return this.tracked;
  }
  get isDown(): boolean {
    return this.down;
  }
}
