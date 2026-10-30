// SPDX-License-Identifier: BSD-3-Clause
// Closed source numeric generic applications for original shape bodies on Core scalar animations.
import type { Animation as CoreAnimation } from '@nelyx/core/framework/animation/animation';
import { Tween, ColorTween } from '@nelyx/core/framework/animation/tween';
import { DartDouble, DartInt } from '@nelyx/core/foundation/dart-numeric';
import type { DartNumeric } from '@nelyx/core/foundation/dart-numeric';
import type { Color } from '@nelyx/core/ui/color';
export type SliderShapeAnimation<T> = T extends DartDouble ? CoreAnimation<number> : never;
export type { SliderShapeAnimation as Animation };
export type SliderShapeTween<T> = T extends DartDouble ? Tween<number> : never;
export function sliderShapeAnimationValue(animation: CoreAnimation<number>): DartDouble {
  return DartDouble.fromSource(animation.value);
}
export function sliderShapeDoubleTween(
  options: {
    readonly begin?: DartDouble | null;
    readonly end?: DartDouble | null;
  } = {},
): Tween<number> {
  return new Tween({ begin: options.begin?.value ?? null, end: options.end?.value ?? null });
}
export function sliderShapeTweenEvaluate(
  tween: ColorTween,
  animation: CoreAnimation<number>,
): Color | null;
export function sliderShapeTweenEvaluate(
  tween: Tween<number>,
  animation: CoreAnimation<number>,
): DartDouble;
export function sliderShapeTweenEvaluate(
  tween: ColorTween | Tween<number>,
  animation: CoreAnimation<number>,
): Color | null | DartDouble {
  if (tween instanceof ColorTween) return tween.evaluate(animation);
  return DartDouble.fromSource(tween.evaluate(animation));
}
export function sliderShapeTweenLerp(tween: ColorTween, t: number): Color | null;
export function sliderShapeTweenLerp(tween: Tween<number>, t: number): DartDouble;
export function sliderShapeTweenLerp(
  tween: ColorTween | Tween<number>,
  t: number,
): Color | null | DartDouble {
  if (tween instanceof ColorTween) return tween.lerp(t);
  return DartDouble.fromSource(tween.lerp(t));
}
function retained(a: DartNumeric, b: DartNumeric): void {
  if ((!DartInt.is(a) && !DartDouble.is(a)) || (!DartInt.is(b) && !DartDouble.is(b)))
    throw new TypeError('Shape math requires retained numeric provenance');
}
export function sliderShapeMathMax<T extends DartNumeric>(a: T, b: T): T {
  retained(a, b);
  if (Number.isNaN(a.value)) return a;
  if (Number.isNaN(b.value)) return b;
  if (a.value > b.value) return a;
  if (b.value > a.value) return b;
  return Object.is(a.value, -0) ? b : a;
}
export function sliderShapeMathMin<T extends DartNumeric>(a: T, b: T): T {
  retained(a, b);
  if (Number.isNaN(a.value)) return a;
  if (Number.isNaN(b.value)) return b;
  if (a.value < b.value) return a;
  if (b.value < a.value) return b;
  return Object.is(b.value, -0) ? b : a;
}
export function sliderShapeMathPow(a: DartNumeric, b: DartNumeric): DartNumeric {
  retained(a, b);
  const value = Math.pow(a.value, b.value);
  return DartInt.is(a) && DartInt.is(b) && b.value >= 0
    ? DartInt.fromSource(value)
    : DartDouble.fromSource(value);
}
export const sliderShapeSqrt = Math.sqrt,
  sliderShapeAtan = Math.atan,
  sliderShapeCos = Math.cos;
export function sliderShapeIsNegative(value: number | DartNumeric): boolean {
  const scalar = typeof value === 'number' ? value : value.value;
  return scalar < 0 || Object.is(scalar, -0);
}
import { debugDisableShadows } from '@nelyx/core/framework/painting/debug';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Path } from '@nelyx/core/ui/path';
export function sliderShapeDebugShadows(): boolean {
  return debugDisableShadows;
}
export function sliderShapeDrawShadow(
  canvas: Canvas,
  path: Path,
  color: Color,
  elevation: number,
  transparentOccluder: boolean,
): void {
  canvas.drawShadow(path, color.toARGB32(), elevation, transparentOccluder);
}
import { BorderRadius, BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import type { Radius } from '@nelyx/core/ui/radius';
import { canonicalDartGetterObject } from '@nelyx/core/internal/foundation/dart-const';
import { applyDartType, captureDartType } from '@nelyx/core/foundation/dart-type-witness';
import { registerDartValueSemantics } from '@nelyx/core/internal/foundation/dart-value';
const borderGeometryType = applyDartType<BorderRadiusGeometry>(
    BorderRadiusGeometry,
    'BorderRadiusGeometry',
    [],
    [],
  ),
  borderType = applyDartType<BorderRadius>(BorderRadius, 'BorderRadius', [], [borderGeometryType]),
  borderStorage = Object.freeze(Reflect.ownKeys(BorderRadius.zero));
if (borderStorage.length !== 0 && borderStorage.length !== 1)
  throw new TypeError('Unreviewed BorderRadius private storage');
registerDartValueSemantics(BorderRadius, {
  accepts: (value: unknown): value is BorderRadius =>
    value instanceof BorderRadius && Object.getPrototypeOf(value) === BorderRadius.prototype,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
export function sliderShapeConstBorderRadiusAll(
  owner: typeof BorderRadius,
  value: Radius,
): BorderRadius {
  if (owner !== BorderRadius)
    throw new TypeError('BorderRadius factory requires the exact Core owner');
  return canonicalDartGetterObject(
    BorderRadius,
    borderType,
    [
      ['topLeft', 'value'],
      ['topRight', 'value'],
      ['bottomLeft', 'value'],
      ['bottomRight', 'value'],
    ],
    () => {
      const result = BorderRadius.all(value);
      captureDartType(result, borderGeometryType);
      captureDartType(result, borderType);
      return result;
    },
    borderStorage,
  );
}
