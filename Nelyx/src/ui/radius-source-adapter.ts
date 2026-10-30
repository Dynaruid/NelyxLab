// SPDX-License-Identifier: BSD-3-Clause
// Exact Core Radius private slots represent dart:ui's final x/y fields.
import { Radius } from './radius.ts';
import { canonicalDartGetterObject } from '../foundation/dart-const.ts';
import {
  applyDartType,
  captureDartType,
  hasCapturedDartType,
  runtimeDartType,
} from '../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../foundation/dart-value.ts';
export const sourceRadiusType = applyDartType<Radius>(Radius, 'Radius', [], []);
function exact(value: unknown): value is Radius {
  if (
    value === null ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Radius.prototype
  )
    return false;
  try {
    const radius = value as Radius;
    return typeof radius.x === 'number' && typeof radius.y === 'number';
  } catch {
    return false;
  }
}
registerDartValueSemantics(Radius, {
  accepts: exact,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
function captured(value: Radius): Radius {
  if (!exact(value)) throw new TypeError('Unreviewed source Radius');
  if (!hasCapturedDartType(value, Radius)) captureDartType(value, sourceRadiusType);
  if (runtimeDartType(value) !== sourceRadiusType)
    throw new TypeError('Conflicting source Radius type');
  return value;
}
// Babel's private-field lowering uses two nonenumerable own slots; native JS
// private fields have no reflected keys. Keys come from the actual owned singleton.
const storageKeys = Object.freeze(Reflect.ownKeys(Radius.zero));
if (storageKeys.length !== 0 && storageKeys.length !== 2)
  throw new TypeError('Unreviewed Radius private storage');
function canonical(create: () => Radius): Radius {
  return canonicalDartGetterObject(
    Radius,
    sourceRadiusType,
    [
      ['x', 'double'],
      ['y', 'double'],
    ],
    () => captured(create()),
    storageKeys,
  );
}
// Reuse the actual Core singleton, making Radius.zero and circular(+0) identical.
export const sourceRadiusZero = canonical(() => Radius.zero);
/** @dartParam radius double */
export function constSourceRadiusCircular(owner: typeof Radius, radius: number): Radius {
  if (owner !== Radius) throw new TypeError('Radius factory requires the exact owner');
  return canonical(() =>
    radius === 0 && !Object.is(radius, -0) ? Radius.zero : Radius.circular(radius),
  );
}
/** @dartParam x double @dartParam y double */
export function constSourceRadiusElliptical(owner: typeof Radius, x: number, y: number): Radius {
  if (owner !== Radius) throw new TypeError('Radius factory requires the exact owner');
  return canonical(() =>
    x === 0 && y === 0 && !Object.is(x, -0) && !Object.is(y, -0)
      ? Radius.zero
      : Radius.elliptical(x, y),
  );
}
