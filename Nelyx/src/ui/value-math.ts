// SPDX-License-Identifier: BSD-3-Clause
// Internal numeric adaptations for immutable Flutter geometry values.
import { invariant } from '../foundation/errors.ts';
export function number(value: number): number {
  if (!(typeof value === 'number'))
    invariant(false, 'invalid-geometry-number', 'Geometry components must be numbers');
  return value;
}
export function clamp(value: number, minimum: number, maximum: number): number {
  if (!(minimum <= maximum && !Number.isNaN(minimum) && !Number.isNaN(maximum)))
    invariant(false, 'invalid-clamp', 'Clamp bounds must be ordered and not NaN');
  if (value < minimum) return minimum;
  if (value > maximum || Number.isNaN(value)) return maximum;
  return value;
}
export function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}
export function modulo(a: number, b: number): number {
  const r = a % b;
  return r === 0 ? 0 : r < 0 ? r + Math.abs(b) : r;
}
/** Dart VM double ~/ double converted back to double, including int64 saturation. */
export function truncateDivide(a: number, b: number): number {
  const q = a / b;
  if (!Number.isFinite(q))
    invariant(false, 'unsupported-truncate', 'Cannot truncate a non-finite quotient');
  const v = Math.trunc(q);
  return v === 0 ? 0 : Math.min(2 ** 63, Math.max(-(2 ** 63), v));
}
/** Stable local hash; equal values hash equally. Dart's VM-dependent hash integer is not an ABI. */
export function hashDoubles(values: readonly number[]): number {
  const view = new DataView(new ArrayBuffer(8));
  let hash = 2166136261;
  for (const value of values) {
    view.setFloat64(0, value === 0 ? 0 : value);
    for (let i = 0; i < 8; i++) hash = Math.imul(hash ^ view.getUint8(i), 16777619);
  }
  return hash >>> 0;
}
export function fixed(value: number): string {
  return Object.is(value, -0) ? '-0.0' : value.toFixed(1);
}
/** Resolved toStringAsFixed(1) calls retain and validate their explicit argument. */
export function fixedOne(value: number, fractionDigits: 1): string {
  if (!(fractionDigits === 1))
    invariant(
      false,
      'unsupported-fixed-digits',
      'This fixed decimal adapter supports one fractional digit',
    );
  return fixed(value);
}
/** Exact UI integer boundary; unrestricted Dart int values require another representation. */
export function checkedInteger(value: number): number {
  if (!Number.isSafeInteger(value))
    invariant(
      false,
      'unsupported-dart-integer',
      'Dart integer is outside the exact JavaScript number range',
    );
  return value === 0 ? 0 : value;
}
/** Dart rounds ties away from zero; JavaScript Math.round rounds negative ties up. */
export function roundInteger(value: number): number {
  return checkedInteger(value < 0 ? -Math.round(-value) : Math.round(value));
}
/** Keep final value fields immutable while permitting Dart-style subclass fields. */
const finalValueDescriptor: PropertyDescriptor = Object.freeze({
  writable: false,
  configurable: false,
});
export function protect(target: object, keys: readonly string[]): void {
  for (const key of keys) Object.defineProperty(target, key, finalValueDescriptor);
}
/** Compile a fixed field layout once; instances still permit subclass fields.
 * Numeric/duplicate keys retain protect's observable definition order. */
export function finalFieldProtector(keys: readonly string[]): (target: object) => void {
  const fields = Object.freeze([...keys]),
    descriptors: PropertyDescriptorMap = Object.create(null);
  for (const key of fields) {
    if (Object.hasOwn(descriptors, key) || /^(0|[1-9][0-9]*)$/.test(key))
      return (target) => protect(target, fields);
    descriptors[key] = finalValueDescriptor;
  }
  Object.freeze(descriptors);
  return (target) => {
    Object.defineProperties(target, descriptors);
  };
}
