// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/vector.dart.
import type { Vector2 } from './vector2.ts';
import type { Vector3 } from './vector3.ts';

/** Common numeric storage contract; typed-array views remain caller owned. */
export abstract class Vector {
  abstract get storage(): Float64Array;
}
/** Explicit host random source accepted by vector/quaternion random factories. */
export interface NumericRandom {
  nextDouble(): number;
}
export function dot2(x: Vector2, y: Vector2): number {
  return x.dot(y);
}
export function dot3(x: Vector3, y: Vector3): number {
  return x.dot(y);
}
export function cross3(x: Vector3, y: Vector3, out: Vector3): void {
  x.crossInto(y, out);
}
export function cross2(x: Vector2, y: Vector2): number {
  return x.cross(y);
}
export function cross2A(x: number, y: Vector2, out: Vector2): void {
  const tempy = x * y.x;
  out.x = -x * y.y;
  out.y = tempy;
}
export function cross2B(x: Vector2, y: number, out: Vector2): void {
  const tempy = -y * x.x;
  out.x = y * x.y;
  out.y = tempy;
}
export function buildPlaneVectors(planeNormal: Vector3, u: Vector3, v: Vector3): void {
  if (Math.abs(planeNormal.z) > Math.SQRT1_2) {
    const a = planeNormal.y * planeNormal.y + planeNormal.z * planeNormal.z,
      k = 1 / Math.sqrt(a);
    u.x = 0;
    u.y = -planeNormal.z * k;
    u.z = planeNormal.y * k;
    v.x = a * k;
    v.y = -planeNormal.at(0) * (planeNormal.at(1) * k);
    v.z = planeNormal.at(0) * (-planeNormal.at(2) * k);
  } else {
    const a = planeNormal.x * planeNormal.x + planeNormal.y * planeNormal.y,
      k = 1 / Math.sqrt(a);
    u.x = -planeNormal.at(1) * k;
    u.y = planeNormal.at(0) * k;
    u.z = 0;
    v.x = -planeNormal.at(2) * (planeNormal.at(0) * k);
    v.y = planeNormal.at(2) * (-planeNormal.at(1) * k);
    v.z = a * k;
  }
}
