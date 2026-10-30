// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { MediaQuery } from './app-data.ts';
import type { Key } from '../../foundation/key.ts';
import type { PointerEvent } from '../../ui/input.ts';
import { RenderConstrainedBox } from '../rendering/boxes.ts';
import type { RenderBox } from '../rendering/object.ts';
import { TapGestureRecognizer } from '../gestures/tap.ts';
import { DoubleTapGestureRecognizer } from '../gestures/multitap.ts';
import type { GestureDoubleTapCallback } from '../gestures/multitap.ts';
import { LongPressGestureRecognizer } from '../gestures/long-press.ts';
import { ForcePressGestureRecognizer } from '../gestures/force-press.ts';
import type {
  GestureForcePressStartCallback,
  GestureForcePressPeakCallback,
  GestureForcePressUpdateCallback,
  GestureForcePressEndCallback,
} from '../gestures/force-press.ts';
import { ScaleGestureRecognizer, kDefaultTrackpadScrollToScaleFactor } from '../gestures/scale.ts';
import type {
  GestureScaleStartCallback,
  GestureScaleUpdateCallback,
  GestureScaleEndCallback,
} from '../gestures/scale.ts';
import type { Offset as SourceOffset } from '../../ui/offset.ts';
import type {
  GestureTapCallback,
  GestureTapDownCallback,
  GestureTapUpCallback,
  GestureTapMoveCallback,
  GestureTapCancelCallback,
} from '../gestures/tap.ts';
import {
  PanGestureRecognizer,
  HorizontalDragGestureRecognizer,
  VerticalDragGestureRecognizer,
} from '../gestures/monodrag.ts';
import type { DragGestureRecognizer, GestureVelocityTrackerBuilder } from '../gestures/monodrag.ts';
import { VelocityTracker } from '../gestures/velocity-tracker.ts';
import type {
  GestureDragDownCallback,
  GestureDragStartCallback,
  GestureDragUpdateCallback,
  GestureDragEndCallback,
  GestureDragCancelCallback,
} from '../gestures/drag-details.ts';
import { DragStartBehavior, MultitouchDragStrategy } from '../gestures/recognizer.ts';
import type { DeviceGestureSettings } from '../gestures/gesture-settings.ts';
import type { PointerDeviceKind } from '../../ui/pointer.ts';
import type { HitTestBehavior } from '../rendering/pointer-listener.ts';
import type { Key as WidgetKey } from '../../foundation/key.ts';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from './raw-gesture-detector.ts';
import type { GestureRecognizerType, GestureRecognizerFactory } from './raw-gesture-detector.ts';
import { RenderObjectWidget, Element, StatelessWidget } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import { EnumProperty } from '../../foundation/diagnostic-properties.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
const longPressCallbacks = [
  'onLongPressDown',
  'onLongPressCancel',
  'onLongPress',
  'onLongPressStart',
  'onLongPressMoveUpdate',
  'onLongPressUp',
  'onLongPressEnd',
  'onSecondaryLongPressDown',
  'onSecondaryLongPressCancel',
  'onSecondaryLongPress',
  'onSecondaryLongPressStart',
  'onSecondaryLongPressMoveUpdate',
  'onSecondaryLongPressUp',
  'onSecondaryLongPressEnd',
  'onTertiaryLongPressDown',
  'onTertiaryLongPressCancel',
  'onTertiaryLongPress',
  'onTertiaryLongPressStart',
  'onTertiaryLongPressMoveUpdate',
  'onTertiaryLongPressUp',
  'onTertiaryLongPressEnd',
] as const;
export interface GestureOptions extends Partial<
  Readonly<Pick<LongPressGestureRecognizer, (typeof longPressCallbacks)[number]>>
> {
  readonly onTap?: GestureTapCallback | null;
  readonly onTapDown?: GestureTapDownCallback | null;
  readonly onTapUp?: GestureTapUpCallback | null;
  readonly onTapMove?: GestureTapMoveCallback | null;
  readonly onTapCancel?: GestureTapCancelCallback | null;
  readonly onSecondaryTap?: GestureTapCallback | null;
  readonly onSecondaryTapDown?: GestureTapDownCallback | null;
  readonly onSecondaryTapUp?: GestureTapUpCallback | null;
  readonly onSecondaryTapCancel?: GestureTapCancelCallback | null;
  readonly onTertiaryTapDown?: GestureTapDownCallback | null;
  readonly onTertiaryTapUp?: GestureTapUpCallback | null;
  readonly onTertiaryTapCancel?: GestureTapCancelCallback | null;
  readonly onDoubleTapDown?: GestureTapDownCallback | null;
  readonly onDoubleTap?: GestureDoubleTapCallback | null;
  readonly onDoubleTapCancel?: GestureTapCancelCallback | null;
  readonly onForcePressStart?: GestureForcePressStartCallback | null;
  readonly onForcePressPeak?: GestureForcePressPeakCallback | null;
  readonly onForcePressUpdate?: GestureForcePressUpdateCallback | null;
  readonly onForcePressEnd?: GestureForcePressEndCallback | null;
  readonly onScaleStart?: GestureScaleStartCallback | null;
  readonly onScaleUpdate?: GestureScaleUpdateCallback | null;
  readonly onScaleEnd?: GestureScaleEndCallback | null;
  readonly trackpadScrollCausesScale?: boolean;
  readonly trackpadScrollToScaleFactor?: SourceOffset;
  readonly onPanDown?: GestureDragDownCallback | null;
  readonly onPanStart?: GestureDragStartCallback | null;
  readonly onPanUpdate?: GestureDragUpdateCallback | null;
  readonly onPanEnd?: GestureDragEndCallback | null;
  readonly onPanCancel?: GestureDragCancelCallback | null;
  readonly onHorizontalDragDown?: GestureDragDownCallback | null;
  readonly onHorizontalDragStart?: GestureDragStartCallback | null;
  readonly onHorizontalDragUpdate?: GestureDragUpdateCallback | null;
  readonly onHorizontalDragEnd?: GestureDragEndCallback | null;
  readonly onHorizontalDragCancel?: GestureDragCancelCallback | null;
  readonly onVerticalDragDown?: GestureDragDownCallback | null;
  readonly onVerticalDragStart?: GestureDragStartCallback | null;
  readonly onVerticalDragUpdate?: GestureDragUpdateCallback | null;
  readonly onVerticalDragEnd?: GestureDragEndCallback | null;
  readonly onVerticalDragCancel?: GestureDragCancelCallback | null;
  /** Compatibility callbacks are adapted from actual pan details. */
  readonly onDrag?: (dx: number, dy: number) => void;
  readonly onDragEnd?: (vx: number, vy: number) => void;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly multitouchDragStrategy?: MultitouchDragStrategy;
  readonly velocityTrackerBuilder?: GestureVelocityTrackerBuilder;
  readonly onlyAcceptDragOnThreshold?: boolean;
  readonly supportedDevices?: Set<PointerDeviceKind> | null;
  readonly gestureSettings?: DeviceGestureSettings | null;
  readonly behavior?: HitTestBehavior;
  readonly excludeFromSemantics?: boolean;
  readonly label?: string;
  readonly semanticsId?: string;
  readonly enabled?: boolean;
  readonly key?: WidgetKey;
}
const tapCallbacks = [
  'onTap',
  'onTapDown',
  'onTapUp',
  'onTapMove',
  'onTapCancel',
  'onSecondaryTap',
  'onSecondaryTapDown',
  'onSecondaryTapUp',
  'onSecondaryTapCancel',
  'onTertiaryTapDown',
  'onTertiaryTapUp',
  'onTertiaryTapCancel',
] as const;
/** Actual source callback families compose recognizers owned by this View. */
export class GestureDetector extends StatelessWidget {
  constructor(
    readonly child: Widget | null = null,
    readonly options: GestureOptions = {},
  ) {
    super(options.key ?? null);
  }
  get dragStartBehavior(): DragStartBehavior {
    return this.options.dragStartBehavior ?? DragStartBehavior.start;
  }
  build(context: BuildContext): Widget {
    invariant(
      context instanceof Element,
      'invalid-context',
      'GestureDetector requires its actual Element owner',
    );
    const binding = context.owner.gestureBinding,
      gestures = new Map<GestureRecognizerType, GestureRecognizerFactory>(),
      options = this.options;
    const gestureSettings =
      options.gestureSettings === undefined
        ? MediaQuery.maybeGestureSettingsOf(context)
        : options.gestureSettings;
    const havePan =
        options.onPanStart != null ||
        options.onPanUpdate != null ||
        options.onPanEnd != null ||
        options.onDrag !== undefined ||
        options.onDragEnd !== undefined,
      haveScale =
        options.onScaleStart != null || options.onScaleUpdate != null || options.onScaleEnd != null;
    const haveVertical =
        options.onVerticalDragStart != null ||
        options.onVerticalDragUpdate != null ||
        options.onVerticalDragEnd != null,
      haveHorizontal =
        options.onHorizontalDragStart != null ||
        options.onHorizontalDragUpdate != null ||
        options.onHorizontalDragEnd != null;
    invariant(
      !(havePan && haveScale),
      'ambiguous-pan-scale-gestures',
      'Pan and scale cannot both be configured',
    );
    invariant(
      !((havePan || haveScale) && haveVertical && haveHorizontal),
      'ambiguous-pan-axis-gestures',
      'Both directional drags would hide the pan/scale recognizer',
    );
    if (options.enabled !== false) {
      if (tapCallbacks.some((name) => options[name] != null))
        gestures.set(
          TapGestureRecognizer,
          new GestureRecognizerFactoryWithHandlers(
            TapGestureRecognizer,
            () =>
              new TapGestureRecognizer({
                binding,
                debugOwner: this,
                supportedDevices: options.supportedDevices,
              }),
            (instance) => {
              for (const name of tapCallbacks)
                (instance as unknown as Record<string, unknown>)[name] = options[name] ?? null;
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
      if (
        options.onDoubleTapDown != null ||
        options.onDoubleTap != null ||
        options.onDoubleTapCancel != null
      )
        gestures.set(
          DoubleTapGestureRecognizer,
          new GestureRecognizerFactoryWithHandlers(
            DoubleTapGestureRecognizer,
            () =>
              new DoubleTapGestureRecognizer({
                binding,
                debugOwner: this,
                supportedDevices: options.supportedDevices,
              }),
            (instance) => {
              instance.onDoubleTapDown = options.onDoubleTapDown ?? null;
              instance.onDoubleTap = options.onDoubleTap ?? null;
              instance.onDoubleTapCancel = options.onDoubleTapCancel ?? null;
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
      if (longPressCallbacks.some((name) => options[name] != null))
        gestures.set(
          LongPressGestureRecognizer,
          new GestureRecognizerFactoryWithHandlers(
            LongPressGestureRecognizer,
            () =>
              new LongPressGestureRecognizer({
                binding,
                debugOwner: this,
                supportedDevices: options.supportedDevices,
              }),
            (instance) => {
              for (const name of longPressCallbacks)
                (instance as unknown as Record<string, unknown>)[name] = options[name] ?? null;
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
      const addDrag = (
        type: new (
          options: ConstructorParameters<typeof PanGestureRecognizer>[0],
        ) => DragGestureRecognizer,
        down: GestureDragDownCallback | null | undefined,
        start: GestureDragStartCallback | null | undefined,
        update: GestureDragUpdateCallback | null | undefined,
        end: GestureDragEndCallback | null | undefined,
        cancel: GestureDragCancelCallback | null | undefined,
      ) => {
        if (down == null && start == null && update == null && end == null && cancel == null)
          return;
        gestures.set(
          type,
          new GestureRecognizerFactoryWithHandlers(
            type,
            () =>
              new type({ binding, debugOwner: this, supportedDevices: options.supportedDevices }),
            (instance) => {
              instance.onDown = down ?? null;
              instance.onStart = start ?? null;
              instance.onUpdate = update ?? null;
              instance.onEnd = end ?? null;
              instance.onCancel = cancel ?? null;
              instance.dragStartBehavior = this.dragStartBehavior;
              instance.multitouchDragStrategy =
                options.multitouchDragStrategy ?? MultitouchDragStrategy.latestPointer;
              instance.onlyAcceptDragOnThreshold = options.onlyAcceptDragOnThreshold ?? false;
              instance.velocityTrackerBuilder =
                options.velocityTrackerBuilder ??
                ((event) => VelocityTracker.withKind(event.kind, { clock: binding.samplingClock }));
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
      };
      addDrag(
        VerticalDragGestureRecognizer,
        options.onVerticalDragDown,
        options.onVerticalDragStart,
        options.onVerticalDragUpdate,
        options.onVerticalDragEnd,
        options.onVerticalDragCancel,
      );
      addDrag(
        HorizontalDragGestureRecognizer,
        options.onHorizontalDragDown,
        options.onHorizontalDragStart,
        options.onHorizontalDragUpdate,
        options.onHorizontalDragEnd,
        options.onHorizontalDragCancel,
      );
      addDrag(
        PanGestureRecognizer,
        options.onPanDown,
        options.onPanStart,
        options.onPanUpdate ??
          (options.onDrag
            ? (details) => options.onDrag!(details.delta.dx, details.delta.dy)
            : null),
        options.onPanEnd ??
          (options.onDragEnd
            ? (details) =>
                options.onDragEnd!(
                  details.velocity.pixelsPerSecond.dx,
                  details.velocity.pixelsPerSecond.dy,
                )
            : null),
        options.onPanCancel,
      );
      if (haveScale)
        gestures.set(
          ScaleGestureRecognizer,
          new GestureRecognizerFactoryWithHandlers(
            ScaleGestureRecognizer,
            () =>
              new ScaleGestureRecognizer({
                binding,
                debugOwner: this,
                supportedDevices: options.supportedDevices,
              }),
            (instance) => {
              instance.onStart = options.onScaleStart ?? null;
              instance.onUpdate = options.onScaleUpdate ?? null;
              instance.onEnd = options.onScaleEnd ?? null;
              instance.dragStartBehavior = this.dragStartBehavior;
              instance.trackpadScrollCausesScale = options.trackpadScrollCausesScale ?? false;
              instance.trackpadScrollToScaleFactor =
                options.trackpadScrollToScaleFactor ?? kDefaultTrackpadScrollToScaleFactor;
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
      if (
        options.onForcePressStart != null ||
        options.onForcePressPeak != null ||
        options.onForcePressUpdate != null ||
        options.onForcePressEnd != null
      )
        gestures.set(
          ForcePressGestureRecognizer,
          new GestureRecognizerFactoryWithHandlers(
            ForcePressGestureRecognizer,
            () =>
              new ForcePressGestureRecognizer({
                binding,
                debugOwner: this,
                supportedDevices: options.supportedDevices,
              }),
            (instance) => {
              instance.onStart = options.onForcePressStart ?? null;
              instance.onPeak = options.onForcePressPeak ?? null;
              instance.onUpdate = options.onForcePressUpdate ?? null;
              instance.onEnd = options.onForcePressEnd ?? null;
              instance.gestureSettings = gestureSettings;
              instance.supportedDevices = options.supportedDevices ?? null;
            },
          ),
        );
    }
    return new RawGestureDetector(this.child, {
      gestures,
      ...(options.behavior ? { behavior: options.behavior } : {}),
      excludeFromSemantics: options.excludeFromSemantics ?? false,
      ...(options.label !== undefined ? { label: options.label } : {}),
      ...(options.semanticsId !== undefined ? { semanticsId: options.semanticsId } : {}),
      enabled: options.enabled !== false,
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new EnumProperty('startBehavior', this.dragStartBehavior));
  }
}
/** @deprecated Use framework/widgets/listener for concrete source events.
 * This retained callback consumes the narrower embedding DTO synchronously. */
export class Listener extends RenderObjectWidget {
  /** Return true to consume a wheel event before its scroll ancestors. */
  constructor(
    readonly child: Widget,
    readonly onPointer: (event: PointerEvent) => void | boolean,
    key: Key | null = null,
  ) {
    super(key);
  }
  get childWidgets(): readonly Widget[] {
    return [this.child];
  }
  createRenderObject(): RenderBox {
    return new RenderConstrainedBox();
  }
  updateRenderObject(_context: BuildContext, render: RenderBox): void {
    render.onPointer = this.onPointer;
  }
}
