// SPDX-License-Identifier: BSD-3-Clause
import {
  registerNativeWidgetAdapter,
  StatefulElement,
} from '@nelyx/core/framework/widgets/framework';
import { RawTooltip, RawTooltipState } from '@nelyx/core/framework/widgets/raw-tooltip';
import type { BuildOwner, BuildContext } from '@nelyx/core/framework/widgets/framework';
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
import type { SceneNodeOptions } from '../engine-client/scene.ts';
import { sourceNativeNode } from './native-node.ts';
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
/** One per Source binding; event conversion procedures are shared by all cells. */
class NativeGestureDispatcher {
  constructor(
    private readonly context: BuildContext,
    private readonly options: GestureDetector['options'],
    private readonly fail: (reason: string) => never,
    private readonly tap: boolean,
    private readonly long: boolean,
    private readonly pan: boolean,
    private readonly horizontal: boolean,
    private readonly vertical: boolean,
  ) {}
  private invoke(name: string, ...args: unknown[]) {
    if (!this.context.mounted) return;
    const callback = Reflect.get(this.options, name) as
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
  }
  private details(event: GestureEvent | EngineEvent): GestureDetails {
    const { fail } = this;
    const value = 'sequence' in event ? event.details : event.gesture;
    return value ?? fail('native-gesture-details');
  }
  private positions(event: GestureEvent | EngineEvent) {
    const data = this.details(event);
    return {
      globalPosition: new Offset(event.x, event.y),
      localPosition: new Offset(data.localX, data.localY),
    };
  }
  private pointerKind(data: GestureDetails) {
    return PointerDeviceKind[data.pointerKind];
  }
  private tapDown(event: GestureEvent | EngineEvent) {
    return this.invoke(
      'onTapDown',
      new TapDownDetails({ ...this.positions(event), kind: this.pointerKind(this.details(event)) }),
    );
  }
  private tapUp(event: GestureEvent | EngineEvent) {
    return this.invoke(
      'onTapUp',
      new TapUpDetails({ ...this.positions(event), kind: this.pointerKind(this.details(event)) }),
    );
  }
  private longDown(event: GestureEvent | EngineEvent) {
    return this.invoke(
      'onLongPressDown',
      new LongPressDownDetails({
        ...this.positions(event),
        kind:
          this.details(event).flags & p.gestureDetailFlags.semantic
            ? null
            : this.pointerKind(this.details(event)),
      }),
    );
  }
  private longStart(event: GestureEvent | EngineEvent) {
    this.invoke('onLongPressStart', new LongPressStartDetails(this.positions(event)));
    this.invoke('onLongPress');
  }
  private longEnd(event: GestureEvent | EngineEvent) {
    const data = this.details(event);
    this.invoke(
      'onLongPressEnd',
      new LongPressEndDetails({
        ...this.positions(event),
        velocity: new Velocity({ pixelsPerSecond: new Offset(data.velocityX, data.velocityY) }),
      }),
    );
    this.invoke('onLongPressUp');
  }
  private drag(event: GestureEvent) {
    const data = this.details(event),
      h = !!(data.flags & p.gestureDetailFlags.horizontal),
      v = !!(data.flags & p.gestureDetailFlags.vertical),
      prefix = this.pan ? 'onPan' : h ? 'onHorizontalDrag' : v ? 'onVerticalDrag' : null;
    if (!prefix) {
      if (event.kind === 'dragCancel') {
        if (this.horizontal) this.invoke('onHorizontalDragCancel');
        if (this.vertical) this.invoke('onVerticalDragCancel');
      }
      return;
    }
    const position = this.positions(event),
      kind = this.pointerKind(data);
    if (event.kind === 'dragDown') this.invoke(prefix + 'Down', new DragDownDetails(position));
    else if (event.kind === 'panStart')
      this.invoke(
        prefix + 'Start',
        new DragStartDetails({ ...position, kind, sourceTimeStamp: data.timestamp * 1000 }),
      );
    else if (event.kind === 'panUpdate') {
      this.invoke(
        prefix + 'Update',
        new DragUpdateDetails({
          ...position,
          kind,
          sourceTimeStamp: data.timestamp * 1000,
          delta: new Offset(data.deltaX, data.deltaY),
          primaryDelta: h ? data.deltaX : v ? data.deltaY : null,
        }),
      );
      if (this.pan) this.invoke('onDrag', data.deltaX, data.deltaY);
    } else if (event.kind === 'panEnd') {
      this.invoke(
        prefix + 'End',
        new DragEndDetails({
          ...position,
          velocity: new Velocity({ pixelsPerSecond: new Offset(data.velocityX, data.velocityY) }),
          primaryVelocity: h ? data.velocityX : v ? data.velocityY : null,
        }),
      );
      if (this.pan) this.invoke('onDragEnd', data.velocityX, data.velocityY);
    } else if (event.kind === 'dragCancel') this.invoke(prefix + 'Cancel');
  }
  gesture(event: GestureEvent): void {
    switch (event.kind) {
      case 'tapDown':
        this.tapDown(event);
        break;
      case 'tapUp':
        this.tapUp(event);
        break;
      case 'tap':
        this.invoke('onTap');
        break;
      case 'tapCancel':
        this.invoke('onTapCancel');
        break;
      case 'tapMove': {
        const data = this.details(event);
        this.invoke(
          'onTapMove',
          new TapMoveDetails({
            ...this.positions(event),
            kind: this.pointerKind(data),
            delta: new Offset(data.deltaX, data.deltaY),
          }),
        );
        break;
      }
      case 'doubleTap':
        this.invoke('onDoubleTap');
        break;
      case 'longPressDown':
        this.longDown(event);
        break;
      case 'longPress':
        this.longStart(event);
        break;
      case 'longPressCancel':
        this.invoke('onLongPressCancel');
        break;
      case 'longPressMove': {
        const data = this.details(event);
        this.invoke(
          'onLongPressMoveUpdate',
          new LongPressMoveUpdateDetails({
            ...this.positions(event),
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
        this.longEnd(event);
        break;
      case 'dragDown':
      case 'panStart':
      case 'panUpdate':
      case 'panEnd':
      case 'dragCancel':
        this.drag(event);
        break;
    }
  }
  action(
    action: Parameters<NonNullable<SceneNodeOptions['onAction']>>[0],
    event?: EngineEvent,
  ): void {
    const { fail } = this;
    if (!event) return fail('native-semantic-gesture-details');
    if (action === 'activate' && this.tap) {
      this.tapDown(event);
      this.tapUp(event);
      this.invoke('onTap');
    } else if (action === 'longPress' && this.long) {
      this.longDown(event);
      this.longStart(event);
      this.longEnd(event);
    }
  }
}
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
    const dispatch = new NativeGestureDispatcher(
      context,
      options,
      fail,
      tap,
      long,
      pan,
      horizontal,
      vertical,
    );
    return sourceNativeNode('box', source.child ? [source.child] : [], {
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
      onGesture: (event) => dispatch.gesture(event),
      onAction: (action, event) => dispatch.action(action, event),
    });
  });
}
