// SPDX-License-Identifier: BSD-3-Clause
import { SourceQuad } from './quad.generated.ts';
import { Vector3 } from './vector3.ts';
import { hashDoubles } from '../ui/value-math.ts';
export function isSourceQuad(value: unknown): value is SourceQuad {
  return value instanceof SourceQuad;
}
export function castSourceQuad(value: unknown): SourceQuad {
  if (!isSourceQuad(value)) throw new TypeError('Expected SourceQuad');
  return value;
}
export function vectorSourceString(value: Vector3): string {
  return value.toString();
}
/** Object.hash is VM-seeded; only equal-value hash consistency is a portable contract. */
export function quadPointHash(a: Vector3, b: Vector3, c: Vector3, d: Vector3): number {
  return hashDoubles([a.hashCode, b.hashCode, c.hashCode, d.hashCode]);
}
