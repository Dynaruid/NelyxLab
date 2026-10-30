// SPDX-License-Identifier: BSD-3-Clause
// Internal host adaptations for the reviewed vector_math numeric algorithms.
import { invariant } from '../foundation/errors.ts';
import type { NumericRandom } from './vector.ts';
const numericObjects = new WeakMap<object, { storage: Float64Array; owner: string }>();
export function registerNumericObject(value: object, storage: Float64Array, owner: string): void {
  numericObjects.set(value, { storage, owner });
}
/** Shared-library private fields bypass an overridden public storage getter. */
export function numericObjectStorage(value: object, owner: string): Float64Array {
  const slot = numericObjects.get(value);
  invariant(
    slot?.owner === owner,
    'invalid-numeric-object',
    'Numeric argument has no matching private storage',
  );
  return slot.storage;
}

export function numericString(value: number): string {
  if (Object.is(value, -0)) return '-0.0';
  return Number.isInteger(value) && Math.abs(value) < 1e21 ? `${value}.0` : String(value);
}
export function roundNumeric(value: number): number {
  return value < 0 || Object.is(value, -0) ? -Math.round(-value) : Math.round(value);
}
/** Dart num.compareTo's total order, including signed zero and NaN. */
function compareNumeric(a: number, b: number): number {
  if (a === b) {
    if (a === 0) return Object.is(a, -0) ? (Object.is(b, -0) ? 0 : -1) : Object.is(b, -0) ? 1 : 0;
    return 0;
  }
  if (Number.isNaN(a)) return Number.isNaN(b) ? 0 : 1;
  if (Number.isNaN(b)) return -1;
  return a < b ? -1 : 1;
}
/** num.clamp is distinct from Flutter's optimized clampDouble. */
export function clampNumeric(value: number, minimum: number, maximum: number): number {
  invariant(
    compareNumeric(minimum, maximum) <= 0,
    'invalid-numeric-clamp',
    'Numeric clamp bounds must be ordered',
  );
  if (compareNumeric(value, minimum) < 0) return minimum;
  if (compareNumeric(value, maximum) > 0) return maximum;
  return value;
}
/** Host randomness has no Dart VM seed/sequence compatibility promise. */
export function defaultNumericRandom(): NumericRandom {
  return { nextDouble: () => Math.random() };
}
export function numericIndex(index: number, length: number): void {
  invariant(
    Number.isSafeInteger(index) && index >= 0 && index < length,
    'numeric-index-range',
    'Numeric index is outside storage',
  );
}
export function numericArrayRange<T extends readonly number[] | Float64Array>(
  array: T,
  offset: number,
  count: number,
): T {
  invariant(
    Number.isSafeInteger(offset),
    'numeric-array-range',
    'Numeric array offset must be an integer',
  );
  if (offset >= 0 && offset + count <= array.length) return array;
  // Preserve the source's ordered reads/writes before a later range failure.
  return new Proxy(array, {
    get(target, key) {
      if (typeof key === 'string' && String(Number(key)) === key)
        numericIndex(Number(key), target.length);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      if (typeof key === 'string' && String(Number(key)) === key)
        numericIndex(Number(key), target.length);
      return Reflect.set(target, key, value, target);
    },
  });
}
export function numericValues(values: readonly number[], dimension: number): Float64Array {
  invariant(
    values.length === dimension && values.every((v) => typeof v === 'number'),
    'invalid-numeric-storage',
    'Numeric constructor requires the declared number of numeric components',
  );
  return new Float64Array(values);
}
const checkedViews = new WeakMap<Float64Array, Float64Array>(),
  rawViews = new WeakMap<Float64Array, Float64Array>();
/** Short caller views remain valid constructors; checked internal access keeps Dart range failures. */
export function checkedNumericStorage(storage: Float64Array, dimension: number): Float64Array {
  if (storage.length >= dimension) return storage;
  let view = checkedViews.get(storage);
  if (view) return view;
  const numericKey = (key: PropertyKey): number | null =>
    typeof key === 'string' && String(Number(key)) === key ? Number(key) : null;
  view = new Proxy(storage, {
    get(target, key) {
      const index = numericKey(key);
      if (index !== null) numericIndex(index, target.length);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      const index = numericKey(key);
      if (index !== null) numericIndex(index, target.length);
      return Reflect.set(target, key, value, target);
    },
  });
  checkedViews.set(storage, view);
  rawViews.set(view, storage);
  return view;
}
export function numericStorage(storage: Float64Array): Float64Array {
  return rawViews.get(storage) ?? storage;
}
export function numericView(storage: Float64Array, dimension: number): Float64Array {
  invariant(
    storage instanceof Float64Array,
    'invalid-numeric-storage',
    'Numeric view requires Float64Array storage',
  );
  return checkedNumericStorage(storage, dimension);
}
/** Logical row/column overflow can still address lanes in a longer borrowed view. */
export function matrixIndexedStorage(
  storage: Float64Array,
  index: number,
  dimension: number,
): Float64Array {
  return Number.isSafeInteger(index) && index >= 0 && index < dimension
    ? storage
    : checkedNumericStorage(storage, Infinity);
}
