// SPDX-License-Identifier: BSD-3-Clause
// Host ABI for the complete pinned stretch classes. The existing renderer has
// no fragment-program backend; ImageFilter.isShaderFilterSupported is false.
import { State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { SizedBox, Transform } from './basic.ts';
import { ClipRect } from './clip.ts';
import { ImageFiltered } from './image-filtered.ts';
import { CustomPaint } from './custom-paint.ts';
import type { CustomPainter } from '../rendering/custom-paint.ts';
import { MediaQuery } from './app-data.ts';
import type { AlignmentGeometry } from '../painting/alignment.ts';
import type { Matrix4 } from '../../math/matrix4.ts';
import type { ImageFilter } from '../../ui/image-filter.ts';
import type { FilterQuality } from '../../ui/paint-effects-data.ts';
import type { Clip } from '../../ui/clip.ts';
import type { TickerFuture } from '../animation/ticker-future.ts';
import {
  applyDartType,
  captureDartType,
  dartNullType,
  runtimeDartType,
} from '../../foundation/dart-type-witness.ts';
import { canonicalDartObject, registerDartConstSingletons } from '../../foundation/dart-const.ts';
import { ScrollPhysics, BouncingScrollPhysics, ScrollDecelerationRate } from './scroll-physics.ts';
import { Listenable } from '../../foundation/notifier.ts';
import { CustomPainter as PainterBase } from '../rendering/custom-paint.ts';
import {
  ScrollNotification,
  ScrollStartNotification,
  ScrollUpdateNotification,
  ScrollEndNotification,
  OverscrollNotification,
  UserScrollNotification,
} from './scroll-notification.ts';
import { GlowingOverscrollIndicator } from './overscroll-indicator.ts';
import { AxisDirection } from '../painting/basic-types.ts';
import type { Color } from '../../ui/color.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { Offset } from '../../ui/offset.ts';
import type { Paint } from '../../ui/paint.ts';

export abstract class StretchStateHost<T extends StatefulWidget> extends State<T> {}
export const stretchListenableType = applyDartType<Listenable>(Listenable, 'Listenable', [], []);
export const stretchAxisDirectionType = applyDartType<AxisDirection>(
  AxisDirection,
  'AxisDirection',
  [],
  [],
);
export const stretchPainterType = applyDartType<PainterBase>(
  PainterBase,
  'CustomPainter',
  [],
  [stretchListenableType],
);
export function stretchGlow({
  axisDirection,
  color,
  child,
}: {
  axisDirection: AxisDirection;
  color: Color;
  child: Widget;
}): GlowingOverscrollIndicator {
  return new GlowingOverscrollIndicator({ axisDirection, color: color.toARGB32(), child });
}
/** Only the shader-only painter needs this operation. Current Canvas lacks it;
 * the capability-false original branch never calls it. A backend/test Canvas
 * may provide the exact operation, but missing support is always an error. */
export function stretchDrawPoints(
  canvas: Canvas,
  mode: 'points',
  points: readonly Offset[],
  paint: Paint,
): void {
  const operation: unknown = Reflect.get(canvas, 'drawPoints');
  if (typeof operation !== 'function')
    throw new Error('drawPoints is unavailable on the current shader-filter backend');
  Reflect.apply(operation, canvas, [mode, points, paint]);
}
function checked<T>(value: unknown, type: abstract new (...arguments_: never[]) => T): T {
  if (!(value instanceof type)) throw new TypeError('Expected ' + type.name);
  return value;
}
export const stretchIsStart = (value: unknown): value is ScrollStartNotification =>
  value instanceof ScrollStartNotification;
export const stretchCastStart = (value: unknown): ScrollStartNotification =>
  checked(value, ScrollStartNotification);
export const stretchIsUpdate = (value: unknown): value is ScrollUpdateNotification =>
  value instanceof ScrollUpdateNotification;
export const stretchCastUpdate = (value: unknown): ScrollUpdateNotification =>
  checked(value, ScrollUpdateNotification);
export const stretchIsEnd = (value: unknown): value is ScrollEndNotification =>
  value instanceof ScrollEndNotification;
export const stretchCastEnd = (value: unknown): ScrollEndNotification =>
  checked(value, ScrollEndNotification);
export const stretchIsOverscroll = (value: unknown): value is OverscrollNotification =>
  value instanceof OverscrollNotification;
export const stretchCastOverscroll = (value: unknown): OverscrollNotification =>
  checked(value, OverscrollNotification);
const notificationType = applyDartType<ScrollNotification>(
  ScrollNotification,
  'ScrollNotification',
  [],
  [],
);
const notificationTypes = new Map<object, object>([
  [ScrollNotification.prototype, notificationType],
  ...[
    ScrollStartNotification,
    ScrollUpdateNotification,
    ScrollEndNotification,
    OverscrollNotification,
    UserScrollNotification,
  ].map(
    (type) =>
      [
        type.prototype,
        applyDartType(
          type,
          type === ScrollStartNotification
            ? 'ScrollStartNotification'
            : type === ScrollUpdateNotification
              ? 'ScrollUpdateNotification'
              : type === ScrollEndNotification
                ? 'ScrollEndNotification'
                : type === OverscrollNotification
                  ? 'OverscrollNotification'
                  : 'UserScrollNotification',
          [],
          [notificationType],
        ),
      ] as [object, object],
  ),
]);
/** Exact reviewed host constructors plus explicitly captured source subclasses.
 * A new uncaptured subtype is rejected instead of inferred from its name. */
export function stretchNotificationRuntimeType(value: ScrollNotification | null): object {
  return value === null
    ? dartNullType
    : (notificationTypes.get(Object.getPrototypeOf(value)) ?? runtimeDartType(value));
}
const physicsType = applyDartType<ScrollPhysics>(ScrollPhysics, 'ScrollPhysics', [], []),
  bouncingType = applyDartType<BouncingScrollPhysics>(
    BouncingScrollPhysics,
    'BouncingScrollPhysics',
    [],
    [physicsType],
  );
registerDartConstSingletons(ScrollDecelerationRate, [
  ScrollDecelerationRate.normal,
  ScrollDecelerationRate.fast,
]);
export function stretchConstBouncing(
  owner: typeof BouncingScrollPhysics,
  {
    decelerationRate = ScrollDecelerationRate.normal,
    parent = null,
  }: { decelerationRate?: ScrollDecelerationRate; parent?: ScrollPhysics | null } = {},
): BouncingScrollPhysics {
  if (
    owner !== BouncingScrollPhysics ||
    parent !== null ||
    !(
      decelerationRate === ScrollDecelerationRate.normal ||
      decelerationRate === ScrollDecelerationRate.fast
    )
  )
    throw new TypeError('Only the selected parent-free bouncing constants are admitted');
  return canonicalDartObject(
    owner,
    bouncingType,
    [
      ['parent', 'value'],
      ['decelerationRate', 'value'],
    ],
    () => {
      const value = new BouncingScrollPhysics({ decelerationRate });
      captureDartType(value, bouncingType);
      return value;
    },
  );
}
export function stretchMediaWidth(context: BuildContext): number {
  return MediaQuery.of(context).width;
}
export function stretchMediaHeight(context: BuildContext): number {
  return MediaQuery.of(context).height;
}
export function stretchClip({
  child,
  clipBehavior,
}: {
  child: Widget;
  clipBehavior: Clip;
}): ClipRect {
  return new ClipRect(child, { clipBehavior });
}
export function stretchTransform({
  child,
  transform,
  alignment,
  filterQuality,
}: {
  child: Widget;
  transform: Matrix4;
  alignment: AlignmentGeometry;
  filterQuality: FilterQuality | null;
}): Transform {
  return new Transform(child, transform.storage, null, { alignment, filterQuality });
}
export function stretchImageFiltered({
  child,
  imageFilter,
  enabled,
}: {
  child: Widget;
  imageFilter: ImageFilter;
  enabled: boolean;
}): ImageFiltered {
  return new ImageFiltered(child, { imageFilter, enabled });
}
export function stretchCustomPaint({
  child,
  painter,
}: {
  child: Widget;
  painter: CustomPainter | null;
}): CustomPaint {
  return new CustomPaint(child, { painter });
}
let shrink: SizedBox | undefined;
export function stretchConstShrink(
  owner: typeof SizedBox,
  ...arguments_: readonly unknown[]
): SizedBox {
  if (owner !== SizedBox || arguments_.length)
    throw new TypeError('Only the selected argument-free SizedBox.shrink const is admitted');
  if (!shrink) {
    shrink = SizedBox.shrink();
    Object.freeze(shrink.childWidgets);
    Object.freeze(shrink);
  }
  return shrink;
}
/** Dart Future.whenComplete observes the primary TickerFuture. Cancellation
 * leaves it pending; whenCompleteOrCancel would change source ownership. */
export function stretchWhenComplete(future: TickerFuture, action: () => void): Promise<void> {
  return future.finally(action);
}
export abstract class StretchFragmentShader {
  abstract setFloat(index: number, value: number): void;
  abstract dispose(): void;
}
export abstract class StretchFragmentProgram {
  abstract fragmentShader(): StretchFragmentShader;
  static fromAsset(_asset: string): Promise<StretchFragmentProgram> {
    return Promise.reject(
      new Error('Fragment programs are unavailable on the current ImageFilter backend'),
    );
  }
}
