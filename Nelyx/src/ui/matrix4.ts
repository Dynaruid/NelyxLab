// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { Matrix2D } from './geometry.ts';
/** Column-major storage, matching Flutter Canvas.transform and vector_math. */
export type Matrix4Storage = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
const capturedMatrices = new WeakSet<object>();
/** @internal Only storage captured here is deeply immutable and validated. */
export function isCapturedMatrix4(value: readonly number[]): boolean {
  return capturedMatrices.has(value);
}
export const matrix4Identity: Matrix4Storage = freezeValues([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);
function freezeValues(values: number[]): Matrix4Storage {
  invariant(values.length === 16, 'invalid-transform', 'Matrix4 requires sixteen values');
  invariant(values.every(Number.isFinite), 'invalid-transform', 'Matrix4 values must be finite');
  const result = Object.freeze(values) as Matrix4Storage;
  capturedMatrices.add(result);
  return result;
}
export function captureMatrix4(value: readonly number[] | Float64Array): Matrix4Storage {
  // Only our own fully validated, frozen storage can cross another admission
  // boundary without copying. Frozen caller arrays and typed arrays still copy.
  if (capturedMatrices.has(value)) return value as Matrix4Storage;
  invariant(value.length === 16, 'invalid-transform', 'Matrix4 requires sixteen values');
  return freezeValues(Array.from(value));
}
export function matrix4FromAffine(value: Matrix2D): Matrix4Storage {
  return freezeValues([
    value[0],
    value[1],
    0,
    0,
    value[2],
    value[3],
    0,
    0,
    0,
    0,
    1,
    0,
    value[4],
    value[5],
    0,
    1,
  ]);
}
/** Full 4x4 composition; z components remain available to subsequent transforms. */
export function multiplyMatrix4(a: Matrix4Storage, b: Matrix4Storage): Matrix4Storage {
  const values = Array<number>(16);
  for (let column = 0; column < 16; column += 4) {
    const b0 = b[column]!,
      b1 = b[column + 1]!,
      b2 = b[column + 2]!,
      b3 = b[column + 3]!;
    // Retain the original accumulation order, including its initial +0.
    // Avoid interpreter inner loops and a second copy of owned output storage.
    for (let row = 0; row < 4; row++)
      values[column + row] =
        0 + a[row]! * b0 + a[row + 4]! * b1 + a[row + 8]! * b2 + a[row + 12]! * b3;
  }
  return freezeValues(values);
}
/** Double-precision pivoting; a small nonzero determinant is not treated as singular. */
export function inverseMatrix4(matrix: Matrix4Storage): Matrix4Storage | null {
  const rows = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 8 }, (_, column) =>
      column < 4 ? matrix[column * 4 + row]! : Number(column - 4 === row),
    ),
  );
  for (let column = 0; column < 4; column++) {
    let pivot = column;
    for (let row = column + 1; row < 4; row++)
      if (Math.abs(rows[row]![column]!) > Math.abs(rows[pivot]![column]!)) pivot = row;
    const divisor = rows[pivot]![column]!;
    if (divisor === 0 || !Number.isFinite(divisor)) return null;
    [rows[column], rows[pivot]] = [rows[pivot]!, rows[column]!];
    for (let n = 0; n < 8; n++) rows[column]![n]! /= divisor;
    for (let row = 0; row < 4; row++)
      if (row !== column) {
        const factor = rows[row]![column]!;
        for (let n = 0; n < 8; n++) rows[row]![n]! -= factor * rows[column]![n]!;
      }
  }
  const result = Array.from({ length: 16 }, (_, n) => rows[n % 4]![4 + Math.floor(n / 4)]!);
  return result.every(Number.isFinite) ? captureMatrix4(result) : null;
}
/** PointerEvent.removePerspectiveTransform isolates the painted XY plane before hit-test inversion. */
export function removePerspectiveMatrix4(matrix: Matrix4Storage): Matrix4Storage {
  const values = [...matrix];
  for (const n of [2, 6, 8, 9, 11, 14]) values[n] = 0;
  values[10] = 1;
  return captureMatrix4(values);
}
/** MatrixUtils.transformPoint: transform (x,y,0,1), then normalize homogeneous w. */
export function transformMatrix4Point(
  matrix: Matrix4Storage,
  point: { readonly x: number; readonly y: number },
): { x: number; y: number } {
  const x = matrix[0] * point.x + matrix[4] * point.y + matrix[12],
    y = matrix[1] * point.x + matrix[5] * point.y + matrix[13],
    w = matrix[3] * point.x + matrix[7] * point.y + matrix[15];
  return w === 1 ? { x, y } : { x: x / w, y: y / w };
}
/** Screen-ray intersection with the local z=0 plane. Null preserves an
 * unavailable projection instead of inventing a document position at zero. */
export function tryUnprojectMatrix4Point(
  matrix: Matrix4Storage,
  point: { readonly x: number; readonly y: number },
): { x: number; y: number } | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const inverse = inverseMatrix4(matrix);
  if (!inverse) return null;
  // Keep the ray homogeneous: its far point may lie at infinity even when
  // the intersection with the painted plane is finite.
  const x = inverse[0] * point.x + inverse[4] * point.y + inverse[12],
    y = inverse[1] * point.x + inverse[5] * point.y + inverse[13],
    z = inverse[2] * point.x + inverse[6] * point.y + inverse[14],
    w = inverse[3] * point.x + inverse[7] * point.y + inverse[15];
  const weight = w * inverse[10] - inverse[11] * z;
  if (weight === 0 || !Number.isFinite(weight)) return null;
  const result = {
    x: (x * inverse[10] - inverse[8] * z) / weight,
    y: (y * inverse[10] - inverse[9] * z) / weight,
  };
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}
/** RenderBox.globalToLocal retains its zero fallback for a degenerate plane. */
export function unprojectMatrix4Point(
  matrix: Matrix4Storage,
  point: { readonly x: number; readonly y: number },
): { x: number; y: number } {
  return tryUnprojectMatrix4Point(matrix, point) ?? { x: 0, y: 0 };
}
