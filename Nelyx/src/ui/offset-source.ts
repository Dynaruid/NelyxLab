// SPDX-License-Identifier: BSD-3-Clause
// Exact Core Offset source value/type/const boundary, with the existing owning prototype.
import { Offset } from './offset.ts';
import { OffsetBase } from './offset-base.ts';
import { sourceOffsetBaseType } from './size-source.ts';
import {
  applyDartType,
  captureDartType,
  hasCapturedDartType,
} from '../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../foundation/dart-value.ts';
import { canonicalDartObject } from '../foundation/dart-const.ts';
export const sourceOffsetType = applyDartType<Offset>(Offset, 'Offset', [], [sourceOffsetBaseType]);
export function captureSourceOffset(value: Offset): Offset {
  if (Object.getPrototypeOf(value) !== Offset.prototype)
    throw new TypeError('Source Offset requires the exact Core owner');
  if (!hasCapturedDartType(value, OffsetBase)) captureDartType(value, sourceOffsetBaseType);
  if (!hasCapturedDartType(value, Offset)) captureDartType(value, sourceOffsetType);
  return value;
}
registerDartValueSemantics(Offset, {
  accepts: (value: unknown): value is Offset =>
    value instanceof Offset && Object.getPrototypeOf(value) === Offset.prototype,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
function canonical(create: () => Offset): Offset {
  return canonicalDartObject(
    Offset,
    sourceOffsetType,
    [
      ['horizontal', 'double'],
      ['vertical', 'double'],
    ],
    () => captureSourceOffset(create()),
  );
}
export const sourceOffsetZero = canonical(() => Offset.zero);
export const sourceOffsetInfinite = canonical(() => Offset.infinite);
/** @dartParam dx double
 * @dartParam dy double */
export function constSourceOffset(owner: typeof Offset, dx: number, dy: number): Offset {
  if (owner !== Offset) throw new TypeError('Offset factory requires the exact Core owner');
  return canonical(() =>
    dx === 0 && dy === 0 && !Object.is(dx, -0) && !Object.is(dy, -0)
      ? Offset.zero
      : new Offset(dx, dy),
  );
}
