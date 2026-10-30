// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { ValueNotifier } from '../../foundation/notifier.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Offset } from '../../ui/offset.ts';
import { captureMatrix4, matrix4FromAffine } from '../../ui/matrix4.ts';
import { Rect } from '../../ui/rect.ts';
import type { Size } from '../../ui/geometry.ts';
import { Size as SourceSize } from '../../ui/size.ts';
import type { Clip } from '../../ui/clip.ts';
import { GlobalKey } from './global-key.ts';
import { Tween } from '../animation/tween.ts';
import { RenderBox } from '../rendering/object.ts';
import type { BoxConstraints } from '../rendering/constraints.ts';
import { LayoutBuilder } from './layout-builder.ts';
import { Listener } from './listener.ts';
import type { ListenerOptions } from './listener.ts';
import { GestureDetector } from './gesture-detector.ts';
import type { GestureOptions } from './gesture-detector.ts';
import { Transform } from './basic.ts';
import { ClipRect } from './clip.ts';
import { OverflowBox } from './overflow-box.ts';
import type { OverflowBoxOptions } from './overflow-box.ts';
import type { Alignment } from '../painting/alignment.ts';
import { PointerEvent, PointerScrollEvent, PointerScaleEvent } from '../gestures/events.ts';
export abstract class ViewerStatefulHost extends StatefulWidget {
  constructor({ key = null }: { key?: Key | null } = {}) {
    super(key);
  }
}
export abstract class ViewerStateHost<
  W extends StatefulWidget,
> extends TickerProviderStateMixin<W> {}
/** The selected source controller uses Matrix4 value equality, not identity. */
export class ViewerValueNotifierHost<T extends Matrix4> extends ValueNotifier<T> {
  constructor(value: T) {
    super(value, (a, b) => a.equals(b));
  }
}
export function viewerGlobalKey(): GlobalKey<State<StatefulWidget>> {
  return new GlobalKey();
}
export function viewerNumberTween({
  begin = null,
  end = null,
}: {
  begin?: number | null;
  end?: number | null;
}): Tween<number> {
  return new Tween({ begin, end });
}
export function viewerOffsetTween({
  begin = null,
  end = null,
}: {
  begin?: Offset | null;
  end?: Offset | null;
}): Tween<Offset> {
  return new Tween({ begin, end });
}
export function viewerLayoutBuilder({
  builder,
}: {
  builder: (context: BuildContext, constraints: BoxConstraints) => Widget;
}): LayoutBuilder {
  return new LayoutBuilder(builder);
}
export function viewerListener({
  child,
  ...options
}: ListenerOptions & { child: Widget }): Listener {
  return new Listener(child, options);
}
export function viewerGestureDetector({
  child,
  ...options
}: GestureOptions & { child: Widget }): GestureDetector {
  return new GestureDetector(child, options);
}
export function viewerTransform({
  transform,
  alignment = null,
  child,
}: {
  transform: Matrix4;
  alignment?: Alignment | null;
  child: Widget;
}): Transform {
  return new Transform(child, Array.from(transform.storage), null, { alignment });
}
export function viewerOverflowBox({
  child,
  ...options
}: OverflowBoxOptions & { child: Widget }): OverflowBox {
  return new OverflowBox(child, options);
}
export function viewerClipRect({
  child,
  clipBehavior,
}: {
  child: Widget;
  clipBehavior: Clip;
}): ClipRect {
  return new ClipRect(child, { clipBehavior });
}
export function viewerOffsetRect(offset: Offset, size: Size): Rect {
  return Rect.fromLTWH(offset.dx, offset.dy, size.width, size.height);
}
export function viewerIsInfinite(value: number): boolean {
  return value === Infinity || value === -Infinity;
}
export function viewerFixed(value: number, digits: number): string {
  if (!Number.isInteger(digits) || digits < 0 || digits > 20)
    throw new RangeError('Invalid Dart fixed precision');
  return Object.is(value, -0) ? '-' + (0).toFixed(digits) : value.toFixed(digits);
}
export function viewerParseDouble(value: string): number {
  const result = Number(value);
  if (value.trim() === '' || (Number.isNaN(result) && value.trim() !== 'NaN'))
    throw new TypeError('Invalid double');
  return result;
}
export function viewerKeyContext(key: GlobalKey): BuildContext | null {
  return key.currentContext ?? null;
}
export function viewerEventTransform(event: PointerEvent): Matrix4 | null {
  const value = event.transform;
  return value === null
    ? null
    : Matrix4.fromList(value.length === 16 ? value : matrix4FromAffine(value));
}
export function viewerTransformDelta({
  transform,
  untransformedEndPosition,
  transformedEndPosition = null,
  untransformedDelta,
}: {
  transform: Matrix4 | null;
  untransformedEndPosition: Offset;
  transformedEndPosition?: Offset | null;
  untransformedDelta: Offset;
}): Offset {
  return PointerEvent.transformDeltaViaPositions({
    transform: transform === null ? null : captureMatrix4(Array.from(transform.storage)),
    untransformedEndPosition,
    untransformedDelta,
    ...(transformedEndPosition === null ? {} : { transformedEndPosition }),
  });
}
export function viewerIsRenderBox(value: unknown): value is RenderBox {
  return value instanceof RenderBox;
}
export function viewerCastRenderBox(value: unknown): RenderBox {
  if (!viewerIsRenderBox(value)) throw new TypeError('Expected RenderBox');
  return value;
}
export function viewerIsScrollEvent(value: unknown): value is PointerScrollEvent {
  return value instanceof PointerScrollEvent;
}
export function viewerCastScrollEvent(value: unknown): PointerScrollEvent {
  if (!viewerIsScrollEvent(value)) throw new TypeError('Expected PointerScrollEvent');
  return value;
}
export function viewerIsScaleEvent(value: unknown): value is PointerScaleEvent {
  return value instanceof PointerScaleEvent;
}
export function viewerCastScaleEvent(value: unknown): PointerScaleEvent {
  if (!viewerIsScaleEvent(value)) throw new TypeError('Expected PointerScaleEvent');
  return value;
}

export function viewerDouble(value: number): number {
  return value;
}

export type ViewerSourceList<T> = readonly T[];
export function viewerRenderSize(render: RenderBox): SourceSize {
  const value = render.size;
  return value instanceof SourceSize ? value : new SourceSize(value.width, value.height);
}
