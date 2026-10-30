// SPDX-License-Identifier: BSD-3-Clause
// Source constructor/representation and owning-View boundaries; scrollbar
// state, animation decisions, hit testing and drag algorithms stay generated.
import { Widget, StatefulWidget, State, Element } from './framework.ts';
import type { BuildContext } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
import { invariant } from '../../foundation/errors.ts';
import { GlobalKey } from './global-key.ts';
import { scrollChromeTimer } from './scroll-chrome-timers.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { DartMap } from '../../foundation/dart-collections.ts';
import { GestureRecognizer } from '../gestures/recognizer.ts';
import {
  GestureRecognizerFactory,
  RawGestureDetector,
  RawGestureDetectorState,
} from './raw-gesture-detector.ts';
import type { GestureRecognizerType } from './raw-gesture-detector.ts';
import { NotificationListener } from './notification-listener.ts';
import {
  ScrollNotification,
  ScrollUpdateNotification,
  OverscrollNotification,
  ScrollEndNotification,
} from './scroll-notification.ts';
import { ScrollMetricsNotification } from './scroll-position.ts';
import { MediaQuery } from './app-data.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { RepaintBoundary } from './repaint-boundary.ts';
import { Listener } from './listener.ts';
import type { ListenerOptions } from './listener.ts';
import { MouseRegion } from './mouse-region.ts';
import type { MouseRegionOptions } from './mouse-region.ts';
import { CustomPaint } from './custom-paint.ts';
import { scrollbarCorePainter } from './scrollbar-painter-source-adapter.ts';
import type { ScrollbarCustomPainterContract } from './scrollbar-painter-source-adapter.ts';
import { PointerScrollEvent, PointerScrollInertiaCancelEvent } from '../gestures/events.ts';
import type { PointerEvent, PointerSignalEvent } from '../gestures/events.ts';
import { RenderBox } from '../rendering/object.ts';
import { Offset } from '../../ui/offset.ts';
import { DeviceGestureSettings } from '../gestures/gesture-settings.ts';
export type ScrollbarFuture<T> = Promise<T>;
export abstract class ScrollbarStatefulHost extends StatefulWidget {
  constructor({ key = null }: { key?: Key | null } = {}) {
    super(key);
  }
}
export abstract class ScrollbarStateHost<
  T extends StatefulWidget,
> extends TickerProviderStateMixin<T> {}
export class ScrollbarTimer {
  private readonly handle: Disposable;
  constructor(milliseconds: number, callback: () => void) {
    this.handle = scrollChromeTimer(milliseconds, callback);
  }
  cancel(): void {
    this.handle.dispose();
  }
}
export function scrollbarGlobalKey(): GlobalKey<State<StatefulWidget>> {
  return new GlobalKey();
}
export function scrollbarGestureKey(): GlobalKey<RawGestureDetectorState> {
  return new GlobalKey();
}
function owner(state: State<StatefulWidget>): Element {
  invariant(
    state.mounted && state.context instanceof Element,
    'invalid-scrollbar-owner',
    'Scrollbar services require their actual mounted View',
  );
  return state.context;
}
export function scrollbarPostFrame(
  state: State<StatefulWidget>,
  callback: (duration: number) => void,
  options: { debugLabel?: string } = {},
): void {
  tickerScheduler(owner(state)).addPostFrameCallback(callback, options);
}
export function scrollbarRegisterSignal(
  state: State<StatefulWidget>,
  event: PointerSignalEvent,
  callback: (event: PointerEvent) => void,
): void {
  owner(state).owner.gestureBinding.pointerSignalResolver.register(event, callback);
}
export function scrollbarMediaPadding(context: BuildContext): EdgeInsets {
  const value = MediaQuery._safeAreaOf(context);
  return EdgeInsets.fromLTRB(value.left, value.top, value.right, value.bottom);
}
export function scrollbarLocalToGlobal(render: RenderBox, position: Offset): Offset {
  const value = render.localToGlobal(position);
  return new Offset(value.x, value.y);
}
const gestureKeys = Object.freeze({
  accepts: (value: unknown): value is GestureRecognizerType =>
    typeof value === 'function' && value.prototype instanceof GestureRecognizer,
  hash: (value: unknown) => value,
  equals: (stored: GestureRecognizerType, query: unknown) => stored === query,
});
export function scrollbarGestureMap(): DartMap<GestureRecognizerType, GestureRecognizerFactory> {
  return new DartMap(
    gestureKeys,
    (value): value is GestureRecognizerFactory => value instanceof GestureRecognizerFactory,
  );
}
export function scrollbarRawGestureDetector({
  child,
  gestures,
  key,
}: {
  child: Widget;
  gestures: DartMap<GestureRecognizerType, GestureRecognizerFactory>;
  key: GlobalKey<RawGestureDetectorState>;
}): RawGestureDetector {
  return new RawGestureDetector(child, {
    key,
    gestures: new Map(Array.from(gestures.entries, (entry) => [entry.key, entry.value])),
  });
}
export function scrollbarMetricsListener(options: {
  child: Widget;
  onNotification: (value: ScrollMetricsNotification) => boolean;
}): NotificationListener<ScrollMetricsNotification> {
  return new NotificationListener({ ...options, notificationType: ScrollMetricsNotification });
}
export function scrollbarNotificationListener(options: {
  child: Widget;
  onNotification: (value: ScrollNotification) => boolean;
}): NotificationListener<ScrollNotification> {
  return new NotificationListener({ ...options, notificationType: ScrollNotification });
}
export function scrollbarRepaintBoundary({ child }: { child: Widget }): RepaintBoundary {
  return new RepaintBoundary(child);
}
export function scrollbarListener({
  child,
  ...options
}: ListenerOptions & { child: Widget }): Listener {
  return new Listener(child, options);
}
export function scrollbarMouseRegion({
  child,
  ...options
}: MouseRegionOptions & { child: Widget }): MouseRegion {
  return new MouseRegion(child, options);
}
export function scrollbarCustomPaint({
  child,
  key,
  foregroundPainter,
}: {
  child: Widget;
  key: GlobalKey;
  foregroundPainter: ScrollbarCustomPainterContract;
}): CustomPaint {
  return new CustomPaint(child, {
    key,
    foregroundPainter: scrollbarCorePainter(foregroundPainter),
  });
}
const zeroSlop = new DeviceGestureSettings({ touchSlop: 0 });
export function scrollbarConstGestureSettings(
  type: typeof DeviceGestureSettings,
  { touchSlop }: { touchSlop: number },
): DeviceGestureSettings {
  invariant(
    type === DeviceGestureSettings && touchSlop === 0 && !Object.is(touchSlop, -0),
    'unreviewed-scrollbar-gesture-constant',
    'Only the original zero-slop constant is admitted',
  );
  return zeroSlop;
}
export function scrollbarIsScrollUpdate(value: unknown): value is ScrollUpdateNotification {
  return value instanceof ScrollUpdateNotification;
}
export function scrollbarIsOverscroll(value: unknown): value is OverscrollNotification {
  return value instanceof OverscrollNotification;
}
export function scrollbarIsScrollEnd(value: unknown): value is ScrollEndNotification {
  return value instanceof ScrollEndNotification;
}
export function scrollbarIsPointerScroll(value: unknown): value is PointerScrollEvent {
  return value instanceof PointerScrollEvent;
}
export function scrollbarCastPointerScroll(value: unknown): PointerScrollEvent {
  if (!(value instanceof PointerScrollEvent))
    throw new TypeError('Expected actual PointerScrollEvent');
  return value;
}
export function scrollbarIsInertiaCancel(value: unknown): value is PointerScrollInertiaCancelEvent {
  return value instanceof PointerScrollInertiaCancelEvent;
}

export {
  sourceStatefulWidgetType as scrollbarStatefulType,
  sourceStateType as scrollbarStateType,
  sourceTickerStateType as scrollbarTickerStateType,
} from './framework-source-types.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import { widgetStateDiagnosticableType } from './widget-state-diagnostic-source-adapter.ts';

export function scrollbarSetGesture(
  map: DartMap<GestureRecognizerType, GestureRecognizerFactory>,
  key: GestureRecognizerType,
  value: GestureRecognizerFactory,
): void {
  map.set(key, value);
}

import { FoundationPlatform } from '../../foundation/platform.ts';
export function scrollbarIsWeb(): boolean {
  return FoundationPlatform.hostEnvironment.kind === 'web';
}

export type ScrollbarIterable<T> = Iterable<T>;
export function scrollbarIterableLength(value: Iterable<unknown>): number {
  let length = 0;
  for (const _ of value) length++;
  return length;
}

import { MouseCursor } from '../../services/mouse-cursor.ts';
import { SourceWidgetStateMapper, SourceWidgetStatePropertyAll } from './widget-state.generated.ts';
import { dartValueEquals } from '../../foundation/dart-value.ts';
import { scrollbarObjectEquals } from './scrollbar-painter-source-adapter.ts';
export function scrollbarRawObjectEquals(value: unknown, other: unknown): boolean {
  if (value instanceof MouseCursor) return value.equals(other);
  if (value instanceof SourceWidgetStateMapper || value instanceof SourceWidgetStatePropertyAll)
    return dartValueEquals(value, other);
  return scrollbarObjectEquals(value, other);
}

export const scrollbarMouseCursorType = applyDartType<MouseCursor>(
  MouseCursor,
  'MouseCursor',
  [],
  [widgetStateDiagnosticableType],
);

export function scrollbarCastScrollUpdate(value: unknown): ScrollUpdateNotification {
  if (!scrollbarIsScrollUpdate(value))
    throw new TypeError('Expected actual ScrollUpdateNotification');
  return value;
}

export function scrollbarCastOverscroll(value: unknown): OverscrollNotification {
  if (!scrollbarIsOverscroll(value)) throw new TypeError('Expected actual OverscrollNotification');
  return value;
}

export function scrollbarCastScrollEnd(value: unknown): ScrollEndNotification {
  if (!scrollbarIsScrollEnd(value)) throw new TypeError('Expected actual ScrollEndNotification');
  return value;
}

export function scrollbarCastInertiaCancel(value: unknown): PointerScrollInertiaCancelEvent {
  if (!scrollbarIsInertiaCancel(value))
    throw new TypeError('Expected actual PointerScrollInertiaCancelEvent');
  return value;
}
