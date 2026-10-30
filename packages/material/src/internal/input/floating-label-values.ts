// SPDX-License-Identifier: BSD-3-Clause
// Internal access to the canonical source-private floating-label coordinate.
import type { FloatingLabelAlignment } from '../../floating-label-alignment.ts';
const coordinates = new WeakMap<FloatingLabelAlignment, number>();
export function registerFloatingLabelAlignment(value: FloatingLabelAlignment, x: number): void {
  if (coordinates.has(value)) throw new TypeError('Floating label coordinates are immutable');
  coordinates.set(value, x);
}
export function floatingLabelAlignmentX(value: FloatingLabelAlignment): number {
  const x = coordinates.get(value);
  if (x === undefined) throw new TypeError('Expected a canonical FloatingLabelAlignment');
  return x;
}
