// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { Rect } from './types.ts';
import {
  captureMatrix4,
  isCapturedMatrix4,
  matrix4FromAffine,
  multiplyMatrix4,
  inverseMatrix4,
  removePerspectiveMatrix4,
  transformMatrix4Point,
} from './matrix4.ts';
import type { Matrix4Storage } from './matrix4.ts';
export interface Size {
  readonly width: number;
  readonly height: number;
}
export interface Offset {
  readonly x: number;
  readonly y: number;
}
export interface Insets {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export function allInsets(value: number): Insets {
  return Object.freeze({ left: value, top: value, right: value, bottom: value });
}
/** Canvas affine order: x'=a*x+c*y+tx, y'=b*x+d*y+ty. */
export type Matrix2D = readonly [number, number, number, number, number, number];
export type TransformMatrix = Matrix2D | Matrix4Storage;
/** Copy caller-owned storage at render/widget/semantics admission. */
const capturedAffines = new WeakSet<object>(),
  expandedAffines = new WeakMap<object, Matrix4Storage>();
const identityAffines = new WeakSet<object>(),
  unsignedZeroAffines = new WeakSet<object>();
const paintInverses = new WeakMap<object, TransformMatrix | null>();
const affineProducts = new WeakMap<object, { right: Matrix2D; value: Matrix2D }>();
function finiteAffine(values: readonly number[]): boolean {
  return (
    Number.isFinite(values[0]) &&
    Number.isFinite(values[1]) &&
    Number.isFinite(values[2]) &&
    Number.isFinite(values[3]) &&
    Number.isFinite(values[4]) &&
    Number.isFinite(values[5])
  );
}
/** Adopt only fresh private six-lane storage after finite validation. Public
 * admission still copies caller storage, including frozen and iterable input. */
function captureAffineValues(values: number[]): Matrix2D {
  const result = Object.freeze(values) as Matrix2D;
  capturedAffines.add(result);
  if (
    !Object.is(values[0], -0) &&
    !Object.is(values[1], -0) &&
    !Object.is(values[2], -0) &&
    !Object.is(values[3], -0) &&
    !Object.is(values[4], -0) &&
    !Object.is(values[5], -0)
  )
    unsignedZeroAffines.add(result);
  if (
    values[0] === 1 &&
    values[1] === 0 &&
    values[2] === 0 &&
    values[3] === 1 &&
    values[4] === 0 &&
    values[5] === 0
  )
    identityAffines.add(result);
  return result;
}
/** @internal Frozen caller storage alone does not prove captured ownership. */
export function isCapturedTransform(matrix: readonly number[]): boolean {
  return capturedAffines.has(matrix) || isCapturedMatrix4(matrix);
}
export function captureTransform(matrix: readonly number[] | Float64Array): TransformMatrix {
  if (capturedAffines.has(matrix)) return matrix as Matrix2D;
  if (matrix.length === 16) return captureMatrix4(matrix);
  if (!(matrix.length === 6))
    invariant(
      false,
      'invalid-transform',
      'Transform requires six affine or sixteen column-major values',
    );
  const values = Array.from(matrix);
  if (!(values.length === 6))
    invariant(false, 'invalid-transform', 'Transform requires six affine values');
  if (!finiteAffine(values))
    invariant(false, 'invalid-transform', 'Transform values must be finite');
  return captureAffineValues(values);
}
export function fullTransform(matrix: TransformMatrix): Matrix4Storage {
  if (matrix.length !== 6) return matrix;
  // Cache expansions only for owned storage. Mutable caller and uncaptured
  // arithmetic values are always reread; owned products below may be shared.
  if (!capturedAffines.has(matrix)) return matrix4FromAffine(matrix);
  let result = expandedAffines.get(matrix);
  if (!result) {
    result = matrix4FromAffine(matrix);
    expandedAffines.set(matrix, result);
  }
  return result;
}
export const identity: Matrix2D = Object.freeze([1, 0, 0, 1, 0, 0]);
capturedAffines.add(identity);
identityAffines.add(identity);
unsignedZeroAffines.add(identity);
export function multiply(a: Matrix2D, b: Matrix2D): Matrix2D;
export function multiply(a: TransformMatrix, b: TransformMatrix): TransformMatrix;
export function multiply(a: TransformMatrix, b: TransformMatrix): TransformMatrix {
  if (a.length !== 6 || b.length !== 6) return multiplyMatrix4(fullTransform(a), fullTransform(b));
  const owned = capturedAffines.has(a) && capturedAffines.has(b),
    cached = owned ? affineProducts.get(a) : undefined;
  // Hit tests cross many zero-offset wrappers. An owned finite identity
  // product only normalizes signed zero; reuse storage when that cannot change
  // a lane. Mutable inputs and signed-zero-sensitive values still calculate.
  if (owned) {
    if (identityAffines.has(a) && unsignedZeroAffines.has(b)) return b;
    if (identityAffines.has(b) && unsignedZeroAffines.has(a)) return a;
  }
  if (cached?.right === b) return cached.value;
  const value: [number, number, number, number, number, number] = [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  // One latest product per owned left matrix. Mutable inputs and nonfinite
  // arithmetic retain the uncached path and its original IEEE behavior.
  if (owned && finiteAffine(value)) {
    const captured = captureAffineValues(value);
    affineProducts.set(a, { right: b, value: captured });
    return captured;
  }
  return value;
}
export function translate(x: number, y: number): Matrix2D {
  return [1, 0, 0, 1, x, y];
}
export function transform(matrix: TransformMatrix, point: Offset): Offset {
  if (matrix.length === 16) return transformMatrix4Point(matrix, point);
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}
export function inverse(matrix: Matrix2D): Matrix2D | null;
export function inverse(matrix: TransformMatrix): TransformMatrix | null;
export function inverse(matrix: TransformMatrix): TransformMatrix | null {
  if (matrix.length === 16) return inverseMatrix4(matrix);
  const [a, b, c, d, x, y] = matrix,
    det = a * d - b * c;
  if (det === 0 || !Number.isFinite(det)) return null;
  return [d / det, -b / det, -c / det, a / det, (c * y - d * x) / det, (b * x - a * y) / det];
}
export function inversePaintTransform(matrix: TransformMatrix): TransformMatrix | null {
  if (matrix.length !== 6) return inverseMatrix4(removePerspectiveMatrix4(matrix));
  // Only owned, validated immutable matrices may reuse their inverse. Caller
  // arrays (even frozen ones) keep the existing reread/copy behavior.
  if (!capturedAffines.has(matrix)) return inverse(matrix);
  if (paintInverses.has(matrix)) return paintInverses.get(matrix)!;
  const result = inverse(matrix);
  if (result !== null && !result.every(Number.isFinite)) return result;
  const captured = result === null ? null : captureTransform(result);
  paintInverses.set(matrix, captured);
  return captured;
}
export function contains(rect: Rect, point: Offset): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x < rect.x + rect.width &&
    point.y < rect.y + rect.height
  );
}
export function bounds(matrix: TransformMatrix, size: Size): Rect {
  const a = matrix[0],
    b = matrix[1],
    c = matrix.length === 16 ? matrix[4] : matrix[2],
    d = matrix.length === 16 ? matrix[5] : matrix[3],
    tx = matrix.length === 16 ? matrix[12] : matrix[4],
    ty = matrix.length === 16 ? matrix[13] : matrix[5],
    width = size.width,
    height = size.height;
  // Project the four corners without allocating point/coordinate arrays on
  // every semantics, input geometry and hit-test bounds query. Keep the point
  // API's arithmetic order, including its zero terms and homogeneous divide.
  /* oxlint-disable oxc/erasing-op -- Keep source arithmetic order, signed zero and NaN/Infinity propagation in numeric transforms. */
  let x0 = a * 0 + c * 0 + tx,
    y0 = b * 0 + d * 0 + ty,
    x1 = a * width + c * 0 + tx,
    y1 = b * width + d * 0 + ty,
    x2 = a * 0 + c * height + tx,
    y2 = b * 0 + d * height + ty,
    x3 = a * width + c * height + tx,
    y3 = b * width + d * height + ty;
  /* oxlint-enable oxc/erasing-op */
  if (matrix.length === 16) {
    const w0 = matrix[15],
      w1 = matrix[3] * width + matrix[15],
      w2 = matrix[7] * height + matrix[15],
      w3 = matrix[3] * width + matrix[7] * height + matrix[15];
    if (Math.min(w0, w1, w2, w3) <= 0 && Math.max(w0, w1, w2, w3) >= 0)
      return { x: NaN, y: NaN, width: NaN, height: NaN };
    /* oxlint-disable oxc/erasing-op -- Keep source arithmetic order, signed zero and NaN/Infinity propagation in numeric transforms. */
    const q0 = matrix[3] * 0 + matrix[7] * 0 + matrix[15],
      q1 = matrix[3] * width + matrix[7] * 0 + matrix[15],
      q2 = matrix[3] * 0 + matrix[7] * height + matrix[15];
    /* oxlint-enable oxc/erasing-op */
    if (q0 !== 1) {
      x0 /= q0;
      y0 /= q0;
    }
    if (q1 !== 1) {
      x1 /= q1;
      y1 /= q1;
    }
    if (q2 !== 1) {
      x2 /= q2;
      y2 /= q2;
    }
    if (w3 !== 1) {
      x3 /= w3;
      y3 /= w3;
    }
  }
  const x = Math.min(x0, x1, x2, x3),
    y = Math.min(y0, y1, y2, y3);
  return { x, y, width: Math.max(x0, x1, x2, x3) - x, height: Math.max(y0, y1, y2, y3) - y };
}
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
}
export function validSize(size: Size): Size {
  const { width, height } = size;
  if (!(Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0))
    invariant(false, 'invalid-layout', 'Layout size must be finite and nonnegative');
  return Object.freeze({ width, height });
}
