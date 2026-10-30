// SPDX-License-Identifier: BSD-3-Clause
// Staged at ui/color-source-adapter.ts. Reviewed dart:ui Color boundary for the
// complete Cupertino source closure; no ARGB32 reduction of floating state.
import { Color, ColorSpace, type ColorComponents } from './color.ts';
import {
  canonicalDartObject,
  registerDartConstSingletons,
  type DartConstField,
} from '../foundation/dart-const.ts';
import {
  applyDartType,
  captureDartType,
  hasCapturedDartType,
  runtimeDartType,
  isDartType,
} from '../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../foundation/dart-value.ts';

export const sourceColorType = applyDartType<Color>(Color, 'Color', [], []);
export const sourceColorSpaceType = applyDartType<ColorSpace>(ColorSpace, 'ColorSpace', [], []);
for (const value of ColorSpace.values) captureDartType(value, sourceColorSpaceType);
registerDartConstSingletons(ColorSpace, ColorSpace.values);
const fields: readonly DartConstField[] = [
  ['a', 'double'],
  ['r', 'double'],
  ['g', 'double'],
  ['b', 'double'],
  ['colorSpace', 'value'],
];
const isExactColor = (value: unknown): value is Color =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Color.prototype;
registerDartValueSemantics(Color, {
  accepts: isExactColor,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
registerDartValueSemantics(ColorSpace, {
  accepts: (value: unknown): value is ColorSpace => ColorSpace.values.includes(value as ColorSpace),
  equals: (value, other) => value === other,
  hash: (value) => value.index,
  string: (value) => value.toString(),
});
function owner(owner: typeof Color): void {
  if (owner !== Color) throw new TypeError('Color factory requires the exact reviewed owner');
}
export function captureSourceColor(value: Color): Color {
  if (!isExactColor(value) || !ColorSpace.values.includes(value.colorSpace))
    throw new TypeError('Unreviewed source Color representation');
  if (hasCapturedDartType(value, Color)) {
    if (runtimeDartType(value) !== sourceColorType)
      throw new TypeError('Conflicting source Color type');
    return value;
  }
  captureDartType(value, sourceColorType);
  return value;
}
function constant(create: () => Color): Color {
  return canonicalDartObject(Color, sourceColorType, fields, () => captureSourceColor(create()));
}
/** @dartParam value int */
export function constSourceColor(type: typeof Color, value: number | bigint): Color {
  owner(type);
  return constant(() => new Color(value));
}
export function constSourceColorFrom(type: typeof Color, values: ColorComponents): Color {
  owner(type);
  return constant(() => Color.from(values));
}
/** @dartParam a int @dartParam r int @dartParam g int @dartParam b int */
export function constSourceColorARGB(
  type: typeof Color,
  a: number | bigint,
  r: number | bigint,
  g: number | bigint,
  b: number | bigint,
): Color {
  owner(type);
  return constant(() => Color.fromARGB(a, r, g, b));
}
/** @dartParam r int @dartParam g int @dartParam b int @dartParam opacity double */
export function constSourceColorRGBO(
  type: typeof Color,
  r: number | bigint,
  g: number | bigint,
  b: number | bigint,
  opacity: number,
): Color {
  owner(type);
  return constant(() => Color.fromRGBO(r, g, b, opacity));
}

/** Admit the reviewed source Color interface without recapturing a subclass as final Color. */
export function assertSourceColorInterface(value: Color): void {
  if (!isExactColor(value) && !isDartType(value, sourceColorType))
    throw new TypeError('Unreviewed source Color interface');
}
/** @dartParam opacity double */
export function sourceColorWithOpacity(value: Color, opacity: number): Color {
  assertSourceColorInterface(value);
  return captureSourceColor(value.withOpacity(opacity));
}
/** @dartParam t double */
export function sourceColorLerp(a: Color | null, b: Color | null, t: number): Color | null {
  if (a !== null) assertSourceColorInterface(a);
  if (b !== null) assertSourceColorInterface(b);
  const value = Color.lerp(a, b, t);
  return value === null ? null : captureSourceColor(value);
}
