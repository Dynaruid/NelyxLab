// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned gestures/converter.dart physical-to-logical conversion.
import {
  PointerData,
  PointerChange,
  PointerSignalKind,
  PointerDeviceKind,
} from '../../ui/pointer.ts';
import { Offset } from '../../ui/offset.ts';
import {
  PointerAddedEvent,
  PointerHoverEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  PointerRemovedEvent,
  PointerPanZoomStartEvent,
  PointerPanZoomUpdateEvent,
  PointerPanZoomEndEvent,
  PointerScrollEvent,
  PointerScrollInertiaCancelEvent,
  PointerScaleEvent,
  kPrimaryButton,
} from './events.ts';
import type { PointerEvent } from './events.ts';
export type DevicePixelRatioGetter = (viewId: number | string) => number | null;
function synthesiseDownButtons(buttons: number, kind: PointerDeviceKind): number {
  return kind === PointerDeviceKind.mouse || kind === PointerDeviceKind.trackpad
    ? buttons
    : buttons === 0
      ? kPrimaryButton
      : buttons;
}
function toLogicalPixels(physicalPixels: number, devicePixelRatio: number): number {
  return physicalPixels / devicePixelRatio;
}
export class PointerEventConverter {
  private constructor() {}
  /** Repeatable lazy iterable, adapting Dart where/map/whereType. */
  static expand(
    data: Iterable<PointerData>,
    devicePixelRatioForView: DevicePixelRatioGetter,
  ): Iterable<PointerEvent> {
    return {
      *[Symbol.iterator]() {
        for (const datum of data) {
          if (datum.signalKind === PointerSignalKind.unknown) continue;
          const devicePixelRatio = devicePixelRatioForView(datum.viewId);
          if (devicePixelRatio === null) continue;
          const position = new Offset(datum.physicalX, datum.physicalY).divide(devicePixelRatio),
            delta = new Offset(datum.physicalDeltaX, datum.physicalDeltaY).divide(devicePixelRatio),
            radiusMinor = toLogicalPixels(datum.radiusMinor, devicePixelRatio),
            radiusMajor = toLogicalPixels(datum.radiusMajor, devicePixelRatio),
            radiusMin = toLogicalPixels(datum.radiusMin, devicePixelRatio),
            radiusMax = toLogicalPixels(datum.radiusMax, devicePixelRatio),
            timeStamp = datum.timeStamp,
            kind = datum.kind;
          switch (datum.signalKind ?? PointerSignalKind.none) {
            case PointerSignalKind.none:
              switch (datum.change) {
                case PointerChange.add:
                  yield new PointerAddedEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    obscured: datum.obscured,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distance: datum.distance,
                    distanceMax: datum.distanceMax,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.hover:
                  yield new PointerHoverEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    delta: delta,
                    buttons: datum.buttons,
                    obscured: datum.obscured,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distance: datum.distance,
                    distanceMax: datum.distanceMax,
                    size: datum.size,
                    radiusMajor: radiusMajor,
                    radiusMinor: radiusMinor,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    synthesized: datum.synthesized,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.down:
                  yield new PointerDownEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    buttons: synthesiseDownButtons(datum.buttons, kind),
                    obscured: datum.obscured,
                    pressure: datum.pressure,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distanceMax: datum.distanceMax,
                    size: datum.size,
                    radiusMajor: radiusMajor,
                    radiusMinor: radiusMinor,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.move:
                  yield new PointerMoveEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    delta: delta,
                    buttons: synthesiseDownButtons(datum.buttons, kind),
                    obscured: datum.obscured,
                    pressure: datum.pressure,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distanceMax: datum.distanceMax,
                    size: datum.size,
                    radiusMajor: radiusMajor,
                    radiusMinor: radiusMinor,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    platformData: datum.platformData,
                    synthesized: datum.synthesized,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.up:
                  yield new PointerUpEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    buttons: datum.buttons,
                    obscured: datum.obscured,
                    pressure: datum.pressure,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distance: datum.distance,
                    distanceMax: datum.distanceMax,
                    size: datum.size,
                    radiusMajor: radiusMajor,
                    radiusMinor: radiusMinor,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.cancel:
                  yield new PointerCancelEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    buttons: datum.buttons,
                    obscured: datum.obscured,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distance: datum.distance,
                    distanceMax: datum.distanceMax,
                    size: datum.size,
                    radiusMajor: radiusMajor,
                    radiusMinor: radiusMinor,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    orientation: datum.orientation,
                    tilt: datum.tilt,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.remove:
                  yield new PointerRemovedEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    kind: kind,
                    device: datum.device,
                    position: position,
                    obscured: datum.obscured,
                    pressureMin: datum.pressureMin,
                    pressureMax: datum.pressureMax,
                    distanceMax: datum.distanceMax,
                    radiusMin: radiusMin,
                    radiusMax: radiusMax,
                    embedderId: datum.embedderId,
                  });
                  break;
                case PointerChange.panZoomStart:
                  yield new PointerPanZoomStartEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    device: datum.device,
                    position: position,
                    embedderId: datum.embedderId,
                    synthesized: datum.synthesized,
                  });
                  break;
                case PointerChange.panZoomUpdate: {
                  const pan = new Offset(datum.panX, datum.panY).divide(devicePixelRatio),
                    panDelta = new Offset(datum.panDeltaX, datum.panDeltaY).divide(
                      devicePixelRatio,
                    );
                  yield new PointerPanZoomUpdateEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    device: datum.device,
                    position: position,
                    pan: pan,
                    panDelta: panDelta,
                    scale: datum.scale,
                    rotation: datum.rotation,
                    embedderId: datum.embedderId,
                    synthesized: datum.synthesized,
                  });
                  break;
                }
                case PointerChange.panZoomEnd:
                  yield new PointerPanZoomEndEvent({
                    viewId: datum.viewId,
                    timeStamp: timeStamp,
                    pointer: datum.pointerIdentifier,
                    device: datum.device,
                    position: position,
                    embedderId: datum.embedderId,
                    synthesized: datum.synthesized,
                  });
                  break;
              }
              break;
            case PointerSignalKind.scroll:
              if (
                !Number.isFinite(datum.scrollDeltaX) ||
                !Number.isFinite(datum.scrollDeltaY) ||
                devicePixelRatio <= 0
              )
                break;
              {
                const scrollDelta = new Offset(datum.scrollDeltaX, datum.scrollDeltaY).divide(
                  devicePixelRatio,
                );
                yield new PointerScrollEvent({
                  viewId: datum.viewId,
                  timeStamp: timeStamp,
                  kind: kind,
                  device: datum.device,
                  position: position,
                  scrollDelta: scrollDelta,
                  embedderId: datum.embedderId,
                  onRespond: (options) => datum.respond(options),
                });
                break;
              }
            case PointerSignalKind.scrollInertiaCancel:
              yield new PointerScrollInertiaCancelEvent({
                viewId: datum.viewId,
                timeStamp: timeStamp,
                kind: kind,
                device: datum.device,
                position: position,
                embedderId: datum.embedderId,
              });
              break;
            case PointerSignalKind.scale:
              yield new PointerScaleEvent({
                viewId: datum.viewId,
                timeStamp: timeStamp,
                kind: kind,
                device: datum.device,
                position: position,
                embedderId: datum.embedderId,
                scale: datum.scale,
              });
              break;
            case PointerSignalKind.unknown:
              throw new Error('Unreachable pointer signal kind');
          }
        }
      },
    };
  }
}
