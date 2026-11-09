// SPDX-License-Identifier: BSD-3-Clause
import {
  registerNativeWidgetAdapter,
  StatefulElement,
} from '@nelyx/core/framework/widgets/framework';
import { RawTooltip, RawTooltipState } from '@nelyx/core/framework/widgets/raw-tooltip';
import type { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import { ErrorDescription } from '@nelyx/core/foundation/diagnostics';
import { Offset } from '@nelyx/core/ui/offset';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { TapDownDetails, TapUpDetails, TapMoveDetails } from '@nelyx/core/framework/gestures/tap';
import {
  DragDownDetails,
  DragStartDetails,
  DragUpdateDetails,
  DragEndDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import {
  LongPressDownDetails,
  LongPressStartDetails,
  LongPressMoveUpdateDetails,
  LongPressEndDetails,
} from '@nelyx/core/framework/gestures/long-press';
import { Velocity } from '@nelyx/core/framework/gestures/velocity-tracker';
import { OriginalNativeNode } from './native-node.ts';
import type { EngineEvent, GestureEvent, GestureDetails } from '../engine-client/codec.ts';
import { protocol as p } from '../engine-client/schema.ts';
import { installOriginalRawGestures } from './raw-gesture.ts';

const tapNames = ['onTap', 'onTapDown', 'onTapUp', 'onTapMove', 'onTapCancel'];
const longNames = [
  'onLongPress',
  'onLongPressDown',
  'onLongPressStart',
  'onLongPressMoveUpdate',
  'onLongPressEnd',
  'onLongPressUp',
  'onLongPressCancel',
];
const dragNames = ['Down', 'Start', 'Update', 'End', 'Cancel'];
const admitted = new Set([
  ...tapNames,
  ...longNames,
  'onDoubleTap',
  ...['onPan', 'onHorizontalDrag', 'onVerticalDrag'].flatMap((prefix) =>
    dragNames.map((name) => prefix + name),
  ),
  'onDrag',
  'onDragEnd',
  'dragStartBehavior',
  'onlyAcceptDragOnThreshold',
  'behavior',
  'excludeFromSemantics',
  'label',
  'enabled',
  'supportedDevices',
  'key',
]);
/** Canonical details are constructed from Content-owned published coordinates and recognizer state. */
export function installOriginalGestures(owner: BuildOwner, fail: (reason: string) => never): void {
  installOriginalRawGestures(owner, fail);
  registerNativeWidgetAdapter(owner, 'raw-tooltip', (widget, context) => {
    if (
      Object.getPrototypeOf(widget) !== RawTooltip.prototype ||
      !(context instanceof StatefulElement) ||
      Object.getPrototypeOf(context.stateObject) !== RawTooltipState.prototype
    )
      return fail('custom-raw-tooltip');
    return (context.stateObject as RawTooltipState).buildNative(context);
  });
  registerNativeWidgetAdapter(owner, 'gesture-detector', (widget, context) => {
    if (Object.getPrototypeOf(widget) !== GestureDetector.prototype)
      return fail('custom-gesture-detector');
    const source = widget as GestureDetector,
      options = source.options;
    let devices = 63;
    if (options.supportedDevices) {
      if (Object.getPrototypeOf(options.supportedDevices) !== Set.prototype)
        return fail('custom-gesture-devices');
      devices = 0;
      for (const kind of options.supportedDevices) {
        if (!PointerDeviceKind.values.includes(kind)) return fail('gesture-device-kind');
        devices |= 1 << p.pointerKinds[kind.name];
      }
    }
    for (const [key, value] of Object.entries(options))
      if (value != null && value !== false && !admitted.has(key))
        return fail('gesture-option:' + key);
    if (options.behavior && !HitTestBehavior.values.includes(options.behavior))
      return fail('gesture-hit-test-behavior');
    if (options.dragStartBehavior && !DragStartBehavior.values.includes(options.dragStartBehavior))
      return fail('gesture-drag-start-behavior');
    const settings = MediaQuery.maybeGestureSettingsOf(context);
    if (settings?.touchSlop != null && settings.touchSlop !== 18)
      return fail('gesture-device-settings');
    const has = (names: readonly string[]) =>
      names.some((name) => typeof Reflect.get(options, name) === 'function');
    const enabled = options.enabled !== false,
      tap = enabled && has(tapNames),
      double = enabled && options.onDoubleTap != null,
      long = enabled && has(longNames),
      pan = enabled && has(['onPanStart', 'onPanUpdate', 'onPanEnd', 'onDrag', 'onDragEnd']),
      horizontal =
        enabled && has(['onHorizontalDragStart', 'onHorizontalDragUpdate', 'onHorizontalDragEnd']),
      vertical =
        enabled && has(['onVerticalDragStart', 'onVerticalDragUpdate', 'onVerticalDragEnd']);
    if (pan && horizontal && vertical) return fail('ambiguous-pan-axis-gestures');
    if (pan && (horizontal || vertical)) return fail('competing-pan-axis-gestures');
    const semantics = !options.excludeFromSemantics,
      behavior = options.behavior?.index ?? (source.child === null ? 2 : 0);
    const invoke = (name: string, ...args: unknown[]) => {
      if (!context.mounted) return;
      const callback = Reflect.get(options, name) as
        | ((...args: unknown[]) => void)
        | null
        | undefined;
      if (!callback) return;
      try {
        callback(...args);
      } catch (exception) {
        FlutterError.reportError(
          new FlutterErrorDetails({
            exception,
            library: 'gesture',
            context: new ErrorDescription('while handling ' + name),
          }),
        );
      }
    };
    const details = (event: GestureEvent | EngineEvent): GestureDetails => {
      const value = 'sequence' in event ? event.details : event.gesture;
      return value ?? fail('native-gesture-details');
    };
    const positions = (event: GestureEvent | EngineEvent) => {
      const data = details(event);
      return {
        globalPosition: new Offset(event.x, event.y),
        localPosition: new Offset(data.localX, data.localY),
      };
    };
    const pointerKind = (data: GestureDetails) => PointerDeviceKind[data.pointerKind];
    const tapDown = (event: GestureEvent | EngineEvent) =>
      invoke(
        'onTapDown',
        new TapDownDetails({ ...positions(event), kind: pointerKind(details(event)) }),
      );
    const tapUp = (event: GestureEvent | EngineEvent) =>
      invoke(
        'onTapUp',
        new TapUpDetails({ ...positions(event), kind: pointerKind(details(event)) }),
      );
    const longDown = (event: GestureEvent | EngineEvent) =>
      invoke(
        'onLongPressDown',
        new LongPressDownDetails({
          ...positions(event),
          kind:
            details(event).flags & p.gestureDetailFlags.semantic
              ? null
              : pointerKind(details(event)),
        }),
      );
    const longStart = (event: GestureEvent | EngineEvent) => {
      invoke('onLongPressStart', new LongPressStartDetails(positions(event)));
      invoke('onLongPress');
    };
    const longEnd = (event: GestureEvent | EngineEvent) => {
      const data = details(event);
      invoke(
        'onLongPressEnd',
        new LongPressEndDetails({
          ...positions(event),
          velocity: new Velocity({ pixelsPerSecond: new Offset(data.velocityX, data.velocityY) }),
        }),
      );
      invoke('onLongPressUp');
    };
    const drag = (event: GestureEvent) => {
      const data = details(event),
        h = !!(data.flags & p.gestureDetailFlags.horizontal),
        v = !!(data.flags & p.gestureDetailFlags.vertical),
        prefix = pan ? 'onPan' : h ? 'onHorizontalDrag' : v ? 'onVerticalDrag' : null;
      if (!prefix) {
        if (event.kind === 'dragCancel') {
          if (horizontal) invoke('onHorizontalDragCancel');
          if (vertical) invoke('onVerticalDragCancel');
        }
        return;
      }
      const position = positions(event),
        kind = pointerKind(data);
      if (event.kind === 'dragDown') invoke(prefix + 'Down', new DragDownDetails(position));
      else if (event.kind === 'panStart')
        invoke(
          prefix + 'Start',
          new DragStartDetails({ ...position, kind, sourceTimeStamp: data.timestamp * 1000 }),
        );
      else if (event.kind === 'panUpdate') {
        invoke(
          prefix + 'Update',
          new DragUpdateDetails({
            ...position,
            kind,
            sourceTimeStamp: data.timestamp * 1000,
            delta: new Offset(data.deltaX, data.deltaY),
            primaryDelta: h ? data.deltaX : v ? data.deltaY : null,
          }),
        );
        if (pan) invoke('onDrag', data.deltaX, data.deltaY);
      } else if (event.kind === 'panEnd') {
        invoke(
          prefix + 'End',
          new DragEndDetails({
            ...position,
            velocity: new Velocity({ pixelsPerSecond: new Offset(data.velocityX, data.velocityY) }),
            primaryVelocity: h ? data.velocityX : v ? data.velocityY : null,
          }),
        );
        if (pan) invoke('onDragEnd', data.velocityX, data.velocityY);
      } else if (event.kind === 'dragCancel') invoke(prefix + 'Cancel');
    };
    return new OriginalNativeNode('box', source.child ? [source.child] : [], {
      layout: { childConstraints: 'inherit' },
      pointerHitTest: behavior === 1 ? 'self' : behavior === 2 ? 'translucent' : 'deferToChild',
      canonicalGestures: true,
      gestureDevices: devices,
      dragStartDown: options.dragStartBehavior === DragStartBehavior.down,
      freePan: pan,
      dragThreshold: options.onlyAcceptDragOnThreshold === true,
      gestures:
        (tap ? p.gestures.tap : 0) |
        (double ? p.gestures.doubleTap : 0) |
        (long ? p.gestures.longPress : 0) |
        (pan || horizontal ? p.gestures.panX : 0) |
        (pan || vertical ? p.gestures.panY : 0),
      ...(semantics
        ? {
            semanticsPolicy: { mergeIntoParent: true, mergeDescendants: true },
            semantics: {
              role: 'group',
              label: options.label ?? '',
              flags: enabled ? 0 : p.semanticsFlags.disabled,
              actions:
                (tap ? p.semanticsActions.activate : 0) | (long ? p.semanticsActions.longPress : 0),
            },
          }
        : {}),
      onGesture: (event) => {
        switch (event.kind) {
          case 'tapDown':
            tapDown(event);
            break;
          case 'tapUp':
            tapUp(event);
            break;
          case 'tap':
            invoke('onTap');
            break;
          case 'tapCancel':
            invoke('onTapCancel');
            break;
          case 'tapMove': {
            const data = details(event);
            invoke(
              'onTapMove',
              new TapMoveDetails({
                ...positions(event),
                kind: pointerKind(data),
                delta: new Offset(data.deltaX, data.deltaY),
              }),
            );
            break;
          }
          case 'doubleTap':
            invoke('onDoubleTap');
            break;
          case 'longPressDown':
            longDown(event);
            break;
          case 'longPress':
            longStart(event);
            break;
          case 'longPressCancel':
            invoke('onLongPressCancel');
            break;
          case 'longPressMove': {
            const data = details(event);
            invoke(
              'onLongPressMoveUpdate',
              new LongPressMoveUpdateDetails({
                ...positions(event),
                offsetFromOrigin: new Offset(event.x - data.originX, event.y - data.originY),
                localOffsetFromOrigin: new Offset(
                  data.localX - data.localOriginX,
                  data.localY - data.localOriginY,
                ),
              }),
            );
            break;
          }
          case 'longPressEnd':
            longEnd(event);
            break;
          case 'dragDown':
          case 'panStart':
          case 'panUpdate':
          case 'panEnd':
          case 'dragCancel':
            drag(event);
            break;
        }
      },
      onAction: (action, event) => {
        if (!event) return fail('native-semantic-gesture-details');
        if (action === 'activate' && tap) {
          tapDown(event);
          tapUp(event);
          invoke('onTap');
        } else if (action === 'longPress' && long) {
          longDown(event);
          longStart(event);
          longEnd(event);
        }
      },
    });
  });
}
