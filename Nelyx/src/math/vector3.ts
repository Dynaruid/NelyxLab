// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/vector3.dart.
import { Vector2 } from './vector2.ts';
import { Vector4 } from './vector4.ts';
import { Matrix3 } from './matrix3.ts';
import { Matrix4 } from './matrix4.ts';
import { Quaternion } from './quaternion.ts';
import { Vector } from './vector.ts';
import { hashDoubles } from '../ui/value-math.ts';
import {
  clampNumeric,
  numericString,
  roundNumeric,
  defaultNumericRandom,
  numericIndex,
  numericArrayRange,
  numericValues,
  numericView,
  numericStorage,
  checkedNumericStorage,
  registerNumericObject,
  numericObjectStorage,
} from './numeric-helpers.ts';
import type { NumericRandom } from './vector.ts';
export class Vector3 extends Vector {
  readonly #values: Float64Array;
  constructor(v0: number, v1: number, v2: number);
  constructor(storage: Float64Array);
  constructor(...components: unknown[]) {
    super();
    this.#values =
      components.length === 1
        ? numericView(components[0] as Float64Array, 3)
        : numericValues(components as number[], 3);
    registerNumericObject(this, this.#values, 'Vector3');
  }
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
  static fromFloat64List(storage: Float64Array): Vector3 {
    return new Vector3(storage);
  }
  static fromBuffer(buffer: ArrayBufferLike, offset: number): Vector3 {
    return Vector3.fromFloat64List(new Float64Array(buffer, offset, 3));
  }
  static array(array: readonly number[] | Float64Array, offset: number = 0): Vector3 {
    return (() => {
      const cascade0 = Vector3.zero();
      cascade0.copyFromArray(array, offset);
      return cascade0;
    })();
  }
  static all(value: number): Vector3 {
    return (() => {
      const cascade1 = Vector3.zero();
      cascade1.splat(value);
      return cascade1;
    })();
  }
  static copy(other: Vector3): Vector3 {
    return (() => {
      const cascade2 = Vector3.zero();
      cascade2.setFrom(other);
      return cascade2;
    })();
  }
  static random(rng: NumericRandom | null = null): Vector3 {
    rng ??= defaultNumericRandom();
    return new Vector3(rng.nextDouble(), rng.nextDouble(), rng.nextDouble());
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  static min(a: Vector3, b: Vector3, result: Vector3): void {
    (() => {
      const cascade3 = result;
      cascade3.x = Math.min(a.x, b.x);
      cascade3.y = Math.min(a.y, b.y);
      cascade3.z = Math.min(a.z, b.z);
      return cascade3;
    })();
  }
  static max(a: Vector3, b: Vector3, result: Vector3): void {
    (() => {
      const cascade4 = result;
      cascade4.x = Math.max(a.x, b.x);
      cascade4.y = Math.max(a.y, b.y);
      cascade4.z = Math.max(a.z, b.z);
      return cascade4;
    })();
  }
  static mix(min: Vector3, max: Vector3, a: number, result: Vector3): void {
    (() => {
      const cascade5 = result;
      cascade5.x = min.x + a * (max.x - min.x);
      cascade5.y = min.y + a * (max.y - min.y);
      cascade5.z = min.z + a * (max.z - min.z);
      return cascade5;
    })();
  }
  setValues(x: number, y: number, z: number): void {
    this.#values[2]! = z;
    this.#values[1]! = y;
    this.#values[0]! = x;
  }
  setZero(): void {
    this.#values[2]! = 0.0;
    this.#values[1]! = 0.0;
    this.#values[0]! = 0.0;
  }
  setFrom(other: Vector3): void {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector3');
    this.#values[2]! = otherStorage[2]!;
    this.#values[1]! = otherStorage[1]!;
    this.#values[0]! = otherStorage[0]!;
  }
  splat(arg: number): void {
    this.#values[2]! = arg;
    this.#values[1]! = arg;
    this.#values[0]! = arg;
  }
  toString(): string {
    return `[${numericString(checkedNumericStorage(this.storage, 3)[0]!)},${numericString(checkedNumericStorage(this.storage, 3)[1]!)},${numericString(checkedNumericStorage(this.storage, 3)[2]!)}]`;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof Vector3 &&
      this.#values[2]! === numericObjectStorage(other, 'Vector3')[2]! &&
      this.#values[1]! === numericObjectStorage(other, 'Vector3')[1]! &&
      this.#values[0]! === numericObjectStorage(other, 'Vector3')[0]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 3));
  }
  unaryMinus(): Vector3 {
    return (() => {
      const cascade6 = this.clone();
      cascade6.negate();
      return cascade6;
    })();
  }
  minus(other: Vector3): Vector3 {
    return (() => {
      const cascade7 = this.clone();
      cascade7.sub(other);
      return cascade7;
    })();
  }
  plus(other: Vector3): Vector3 {
    return (() => {
      const cascade8 = this.clone();
      cascade8.add(other);
      return cascade8;
    })();
  }
  divided(scale: number): Vector3 {
    return this.scaled(1.0 / scale);
  }
  times(scale: number): Vector3 {
    return this.scaled(scale);
  }
  at(i: number): number {
    numericIndex(i, this.#values.length);
    return this.#values[i]!;
  }
  setAt(i: number, v: number): void {
    numericIndex(i, this.#values.length);
    this.#values[i]! = v;
  }
  set length(value: number) {
    if (value === 0.0) {
      this.setZero();
    } else {
      let l: number = this.length;
      if (l === 0.0) {
        return;
      }
      l = value / l;
      this.#values[0]! *= l;
      this.#values[1]! *= l;
      this.#values[2]! *= l;
    }
  }
  get length(): number {
    return Math.sqrt(this.length2);
  }
  get length2(): number {
    let sum: number;
    sum = this.#values[2]! * this.#values[2]!;
    sum += this.#values[1]! * this.#values[1]!;
    sum += this.#values[0]! * this.#values[0]!;
    return sum;
  }
  normalize(): number {
    const l: number = this.length;
    if (l === 0.0) {
      return 0.0;
    }
    const d: number = 1.0 / l;
    this.#values[2]! *= d;
    this.#values[1]! *= d;
    this.#values[0]! *= d;
    return l;
  }
  normalizeLength(): number {
    return this.normalize();
  }
  normalized(): Vector3 {
    return (() => {
      const cascade9 = Vector3.copy(this);
      cascade9.normalize();
      return cascade9;
    })();
  }
  normalizeInto(out: Vector3): Vector3 {
    (() => {
      const cascade10 = out;
      cascade10.setFrom(this);
      cascade10.normalize();
      return cascade10;
    })();
    return out;
  }
  distanceTo(arg: Vector3): number {
    return Math.sqrt(this.distanceToSquared(arg));
  }
  distanceToSquared(arg: Vector3): number {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const dz: number = this.#values[2]! - argStorage[2]!;
    const dy: number = this.#values[1]! - argStorage[1]!;
    const dx: number = this.#values[0]! - argStorage[0]!;
    return dx * dx + dy * dy + dz * dz;
  }
  angleTo(other: Vector3): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector3');
    if (
      this.#values[2]! === otherStorage[2]! &&
      this.#values[1]! === otherStorage[1]! &&
      this.#values[0]! === otherStorage[0]!
    ) {
      return 0.0;
    }
    const d: number = this.dot(other) / (this.length * other.length);
    return Math.acos(clampNumeric(d, -1.0, 1.0));
  }
  angleToSigned(other: Vector3, normal: Vector3): number {
    const angle: number = this.angleTo(other);
    const c: Vector3 = this.cross(other);
    const d: number = c.dot(normal);
    return d < 0.0 ? -angle : angle;
  }
  dot(other: Vector3): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector3');
    return (
      this.#values[2]! * otherStorage[2]! +
      this.#values[1]! * otherStorage[1]! +
      this.#values[0]! * otherStorage[0]!
    );
  }
  postmultiply(arg: Matrix3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    const v2: number = this.#values[2]!;
    const v1: number = this.#values[1]!;
    const v0: number = this.#values[0]!;
    this.#values[2]! = v0 * argStorage[6]! + v1 * argStorage[7]! + v2 * argStorage[8]!;
    this.#values[1]! = v0 * argStorage[3]! + v1 * argStorage[4]! + v2 * argStorage[5]!;
    this.#values[0]! = v0 * argStorage[0]! + v1 * argStorage[1]! + v2 * argStorage[2]!;
  }
  cross(other: Vector3): Vector3 {
    const z: number = this.#values[2]!;
    const y: number = this.#values[1]!;
    const x: number = this.#values[0]!;
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector3');
    const oz: number = otherStorage[2]!;
    const oy: number = otherStorage[1]!;
    const ox: number = otherStorage[0]!;
    return new Vector3(y * oz - z * oy, z * ox - x * oz, x * oy - y * ox);
  }
  crossInto(other: Vector3, out: Vector3): Vector3 {
    const z: number = this.#values[2]!;
    const y: number = this.#values[1]!;
    const x: number = this.#values[0]!;
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector3');
    const oz: number = otherStorage[2]!;
    const oy: number = otherStorage[1]!;
    const ox: number = otherStorage[0]!;
    const outStorage: Float64Array = numericObjectStorage(out, 'Vector3');
    outStorage[2]! = x * oy - y * ox;
    outStorage[1]! = z * ox - x * oz;
    outStorage[0]! = y * oz - z * oy;
    return out;
  }
  reflect(normal: Vector3): void {
    const dotProduct: number = 2.0 * normal.dot(this);
    this.#values[2]! -= numericObjectStorage(normal, 'Vector3')[2]! * dotProduct;
    this.#values[1]! -= numericObjectStorage(normal, 'Vector3')[1]! * dotProduct;
    this.#values[0]! -= numericObjectStorage(normal, 'Vector3')[0]! * dotProduct;
  }
  reflected(normal: Vector3): Vector3 {
    return (() => {
      const cascade11 = this.clone();
      cascade11.reflect(normal);
      return cascade11;
    })();
  }
  applyProjection(arg: Matrix4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    const z: number = this.#values[2]!;
    const y: number = this.#values[1]!;
    const x: number = this.#values[0]!;
    const d: number =
      1.0 / (argStorage[15]! + argStorage[11]! * z + argStorage[7]! * y + argStorage[3]! * x);
    this.#values[0]! =
      (argStorage[12]! + argStorage[8]! * z + argStorage[4]! * y + argStorage[0]! * x) * d;
    this.#values[1]! =
      (argStorage[13]! + argStorage[9]! * z + argStorage[5]! * y + argStorage[1]! * x) * d;
    this.#values[2]! =
      (argStorage[14]! + argStorage[10]! * z + argStorage[6]! * y + argStorage[2]! * x) * d;
  }
  applyAxisAngle(axis: Vector3, angle: number): void {
    this.applyQuaternion(Quaternion.axisAngle(axis, angle));
  }
  applyQuaternion(arg: Quaternion): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Quaternion');
    const v2: number = this.#values[2]!;
    const v1: number = this.#values[1]!;
    const v0: number = this.#values[0]!;
    const qw: number = argStorage[3]!;
    const qz: number = argStorage[2]!;
    const qy: number = argStorage[1]!;
    const qx: number = argStorage[0]!;
    const ix: number = qw * v0 + qy * v2 - qz * v1;
    const iy: number = qw * v1 + qz * v0 - qx * v2;
    const iz: number = qw * v2 + qx * v1 - qy * v0;
    const iw: number = -qx * v0 - qy * v1 - qz * v2;
    this.#values[2]! = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    this.#values[1]! = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.#values[0]! = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  }
  applyMatrix3(arg: Matrix3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    const v2: number = this.#values[2]!;
    const v1: number = this.#values[1]!;
    const v0: number = this.#values[0]!;
    this.#values[2]! = argStorage[2]! * v0 + argStorage[5]! * v1 + argStorage[8]! * v2;
    this.#values[1]! = argStorage[1]! * v0 + argStorage[4]! * v1 + argStorage[7]! * v2;
    this.#values[0]! = argStorage[0]! * v0 + argStorage[3]! * v1 + argStorage[6]! * v2;
  }
  applyMatrix4(arg: Matrix4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    const v2: number = this.#values[2]!;
    const v1: number = this.#values[1]!;
    const v0: number = this.#values[0]!;
    this.#values[2]! =
      argStorage[2]! * v0 + argStorage[6]! * v1 + argStorage[10]! * v2 + argStorage[14]!;
    this.#values[1]! =
      argStorage[1]! * v0 + argStorage[5]! * v1 + argStorage[9]! * v2 + argStorage[13]!;
    this.#values[0]! =
      argStorage[0]! * v0 + argStorage[4]! * v1 + argStorage[8]! * v2 + argStorage[12]!;
  }
  relativeError(correct: Vector3): number {
    return this.absoluteError(correct) / correct.length;
  }
  absoluteError(correct: Vector3): number {
    const zDiff: number = this.#values[2]! - numericObjectStorage(correct, 'Vector3')[2]!;
    const yDiff: number = this.#values[1]! - numericObjectStorage(correct, 'Vector3')[1]!;
    const xDiff: number = this.#values[0]! - numericObjectStorage(correct, 'Vector3')[0]!;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff + zDiff * zDiff);
  }
  get isInfinite(): boolean {
    return (
      this.#values[2]! === Infinity ||
      this.#values[2]! === -Infinity ||
      this.#values[1]! === Infinity ||
      this.#values[1]! === -Infinity ||
      this.#values[0]! === Infinity ||
      this.#values[0]! === -Infinity
    );
  }
  get isNaN(): boolean {
    return (
      Number.isNaN(this.#values[2]!) ||
      Number.isNaN(this.#values[1]!) ||
      Number.isNaN(this.#values[0]!)
    );
  }
  add(arg: Vector3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! += argStorage[2]!;
    this.#values[1]! += argStorage[1]!;
    this.#values[0]! += argStorage[0]!;
  }
  addScaled(arg: Vector3, factor: number): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! += argStorage[2]! * factor;
    this.#values[1]! += argStorage[1]! * factor;
    this.#values[0]! += argStorage[0]! * factor;
  }
  sub(arg: Vector3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! -= argStorage[2]!;
    this.#values[1]! -= argStorage[1]!;
    this.#values[0]! -= argStorage[0]!;
  }
  multiply(arg: Vector3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! *= argStorage[2]!;
    this.#values[1]! *= argStorage[1]!;
    this.#values[0]! *= argStorage[0]!;
  }
  divide(arg: Vector3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! /= argStorage[2]!;
    this.#values[1]! /= argStorage[1]!;
    this.#values[0]! /= argStorage[0]!;
  }
  scale(arg: number): void {
    this.#values[2]! *= arg;
    this.#values[1]! *= arg;
    this.#values[0]! *= arg;
  }
  scaled(arg: number): Vector3 {
    return (() => {
      const cascade12 = this.clone();
      cascade12.scale(arg);
      return cascade12;
    })();
  }
  negate(): void {
    this.#values[2]! = -this.#values[2]!;
    this.#values[1]! = -this.#values[1]!;
    this.#values[0]! = -this.#values[0]!;
  }
  absolute(): void {
    this.#values[2]! = Math.abs(this.#values[2]!);
    this.#values[1]! = Math.abs(this.#values[1]!);
    this.#values[0]! = Math.abs(this.#values[0]!);
  }
  clamp(min: Vector3, max: Vector3): void {
    const minStorage: Float64Array = checkedNumericStorage(min.storage, 3);
    const maxStorage: Float64Array = checkedNumericStorage(max.storage, 3);
    this.#values[2]! = clampNumeric(this.#values[2]!, minStorage[2]!, maxStorage[2]!);
    this.#values[1]! = clampNumeric(this.#values[1]!, minStorage[1]!, maxStorage[1]!);
    this.#values[0]! = clampNumeric(this.#values[0]!, minStorage[0]!, maxStorage[0]!);
  }
  clampScalar(min: number, max: number): void {
    this.#values[2]! = clampNumeric(this.#values[2]!, min, max);
    this.#values[1]! = clampNumeric(this.#values[1]!, min, max);
    this.#values[0]! = clampNumeric(this.#values[0]!, min, max);
  }
  floor(): void {
    this.#values[2]! = Math.floor(this.#values[2]!);
    this.#values[1]! = Math.floor(this.#values[1]!);
    this.#values[0]! = Math.floor(this.#values[0]!);
  }
  ceil(): void {
    this.#values[2]! = Math.ceil(this.#values[2]!);
    this.#values[1]! = Math.ceil(this.#values[1]!);
    this.#values[0]! = Math.ceil(this.#values[0]!);
  }
  round(): void {
    this.#values[2]! = roundNumeric(this.#values[2]!);
    this.#values[1]! = roundNumeric(this.#values[1]!);
    this.#values[0]! = roundNumeric(this.#values[0]!);
  }
  roundToZero(): void {
    this.#values[2]! =
      this.#values[2]! < 0.0 ? Math.ceil(this.#values[2]!) : Math.floor(this.#values[2]!);
    this.#values[1]! =
      this.#values[1]! < 0.0 ? Math.ceil(this.#values[1]!) : Math.floor(this.#values[1]!);
    this.#values[0]! =
      this.#values[0]! < 0.0 ? Math.ceil(this.#values[0]!) : Math.floor(this.#values[0]!);
  }
  clone(): Vector3 {
    return Vector3.copy(this);
  }
  copyInto(arg: Vector3): Vector3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    argStorage[2]! = this.#values[2]!;
    argStorage[1]! = this.#values[1]!;
    argStorage[0]! = this.#values[0]!;
    return arg;
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 3);
    array[offset + 2]! = this.#values[2]!;
    array[offset + 1]! = this.#values[1]!;
    array[offset + 0]! = this.#values[0]!;
  }
  copyFromArray(array: readonly number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 3);
    this.#values[2]! = array[offset + 2]!;
    this.#values[1]! = array[offset + 1]!;
    this.#values[0]! = array[offset + 0]!;
  }
  set xy(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xz(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[2]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set yx(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yz(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
  }
  set zx(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set zy(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
  }
  set xyz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xzy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[0]! = argStorage[0]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
  }
  set yxz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yzx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set zxy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
  }
  set zyx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set r(arg: number) {
    this.x = arg;
  }
  set g(arg: number) {
    this.y = arg;
  }
  set b(arg: number) {
    this.z = arg;
  }
  set s(arg: number) {
    this.x = arg;
  }
  set t(arg: number) {
    this.y = arg;
  }
  set p(arg: number) {
    this.z = arg;
  }
  set x(arg: number) {
    this.#values[0]! = arg;
  }
  set y(arg: number) {
    this.#values[1]! = arg;
  }
  set z(arg: number) {
    this.#values[2]! = arg;
  }
  set rg(arg: Vector2) {
    this.xy = arg;
  }
  set rb(arg: Vector2) {
    this.xz = arg;
  }
  set gr(arg: Vector2) {
    this.yx = arg;
  }
  set gb(arg: Vector2) {
    this.yz = arg;
  }
  set br(arg: Vector2) {
    this.zx = arg;
  }
  set bg(arg: Vector2) {
    this.zy = arg;
  }
  set rgb(arg: Vector3) {
    this.xyz = arg;
  }
  set rbg(arg: Vector3) {
    this.xzy = arg;
  }
  set grb(arg: Vector3) {
    this.yxz = arg;
  }
  set gbr(arg: Vector3) {
    this.yzx = arg;
  }
  set brg(arg: Vector3) {
    this.zxy = arg;
  }
  set bgr(arg: Vector3) {
    this.zyx = arg;
  }
  set st(arg: Vector2) {
    this.xy = arg;
  }
  set sp(arg: Vector2) {
    this.xz = arg;
  }
  set ts(arg: Vector2) {
    this.yx = arg;
  }
  set tp(arg: Vector2) {
    this.yz = arg;
  }
  set ps(arg: Vector2) {
    this.zx = arg;
  }
  set pt(arg: Vector2) {
    this.zy = arg;
  }
  set stp(arg: Vector3) {
    this.xyz = arg;
  }
  set spt(arg: Vector3) {
    this.xzy = arg;
  }
  set tsp(arg: Vector3) {
    this.yxz = arg;
  }
  set tps(arg: Vector3) {
    this.yzx = arg;
  }
  set pst(arg: Vector3) {
    this.zxy = arg;
  }
  set pts(arg: Vector3) {
    this.zyx = arg;
  }
  get xx(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[0]!);
  }
  get xy(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[1]!);
  }
  get xz(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[2]!);
  }
  get yx(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[0]!);
  }
  get yy(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[1]!);
  }
  get yz(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[2]!);
  }
  get zx(): Vector2 {
    return new Vector2(this.#values[2]!, this.#values[0]!);
  }
  get zy(): Vector2 {
    return new Vector2(this.#values[2]!, this.#values[1]!);
  }
  get zz(): Vector2 {
    return new Vector2(this.#values[2]!, this.#values[2]!);
  }
  get xxx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get xxy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get xxz(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[2]!);
  }
  get xyx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get xyy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get xyz(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[2]!);
  }
  get xzx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[2]!, this.#values[0]!);
  }
  get xzy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[2]!, this.#values[1]!);
  }
  get xzz(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[2]!, this.#values[2]!);
  }
  get yxx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get yxy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get yxz(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[2]!);
  }
  get yyx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get yyy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get yyz(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[2]!);
  }
  get yzx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[2]!, this.#values[0]!);
  }
  get yzy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[2]!, this.#values[1]!);
  }
  get yzz(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[2]!, this.#values[2]!);
  }
  get zxx(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[0]!, this.#values[0]!);
  }
  get zxy(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[0]!, this.#values[1]!);
  }
  get zxz(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[0]!, this.#values[2]!);
  }
  get zyx(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[1]!, this.#values[0]!);
  }
  get zyy(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[1]!, this.#values[1]!);
  }
  get zyz(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[1]!, this.#values[2]!);
  }
  get zzx(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[2]!, this.#values[0]!);
  }
  get zzy(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[2]!, this.#values[1]!);
  }
  get zzz(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[2]!, this.#values[2]!);
  }
  get xxxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get xxxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get xxxz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[2]!);
  }
  get xxyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get xxyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get xxyz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[2]!);
  }
  get xxzx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[2]!, this.#values[0]!);
  }
  get xxzy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[2]!, this.#values[1]!);
  }
  get xxzz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[2]!, this.#values[2]!);
  }
  get xyxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get xyxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get xyxz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[2]!);
  }
  get xyyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get xyyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get xyyz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[2]!);
  }
  get xyzx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[2]!, this.#values[0]!);
  }
  get xyzy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[2]!, this.#values[1]!);
  }
  get xyzz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[2]!, this.#values[2]!);
  }
  get xzxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[0]!, this.#values[0]!);
  }
  get xzxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[0]!, this.#values[1]!);
  }
  get xzxz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[0]!, this.#values[2]!);
  }
  get xzyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[1]!, this.#values[0]!);
  }
  get xzyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[1]!, this.#values[1]!);
  }
  get xzyz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[1]!, this.#values[2]!);
  }
  get xzzx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[2]!, this.#values[0]!);
  }
  get xzzy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[2]!, this.#values[1]!);
  }
  get xzzz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[2]!, this.#values[2]!);
  }
  get yxxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get yxxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get yxxz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[2]!);
  }
  get yxyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get yxyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get yxyz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[2]!);
  }
  get yxzx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[2]!, this.#values[0]!);
  }
  get yxzy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[2]!, this.#values[1]!);
  }
  get yxzz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[2]!, this.#values[2]!);
  }
  get yyxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get yyxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get yyxz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[2]!);
  }
  get yyyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get yyyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get yyyz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[2]!);
  }
  get yyzx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[2]!, this.#values[0]!);
  }
  get yyzy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[2]!, this.#values[1]!);
  }
  get yyzz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[2]!, this.#values[2]!);
  }
  get yzxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[0]!, this.#values[0]!);
  }
  get yzxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[0]!, this.#values[1]!);
  }
  get yzxz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[0]!, this.#values[2]!);
  }
  get yzyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[1]!, this.#values[0]!);
  }
  get yzyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[1]!, this.#values[1]!);
  }
  get yzyz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[1]!, this.#values[2]!);
  }
  get yzzx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[2]!, this.#values[0]!);
  }
  get yzzy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[2]!, this.#values[1]!);
  }
  get yzzz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[2]!, this.#values[2]!);
  }
  get zxxx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get zxxy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get zxxz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[0]!, this.#values[2]!);
  }
  get zxyx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get zxyy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get zxyz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[1]!, this.#values[2]!);
  }
  get zxzx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[2]!, this.#values[0]!);
  }
  get zxzy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[2]!, this.#values[1]!);
  }
  get zxzz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[2]!, this.#values[2]!);
  }
  get zyxx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get zyxy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get zyxz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[0]!, this.#values[2]!);
  }
  get zyyx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get zyyy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get zyyz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[1]!, this.#values[2]!);
  }
  get zyzx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[2]!, this.#values[0]!);
  }
  get zyzy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[2]!, this.#values[1]!);
  }
  get zyzz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[2]!, this.#values[2]!);
  }
  get zzxx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[0]!, this.#values[0]!);
  }
  get zzxy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[0]!, this.#values[1]!);
  }
  get zzxz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[0]!, this.#values[2]!);
  }
  get zzyx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[1]!, this.#values[0]!);
  }
  get zzyy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[1]!, this.#values[1]!);
  }
  get zzyz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[1]!, this.#values[2]!);
  }
  get zzzx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[2]!, this.#values[0]!);
  }
  get zzzy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[2]!, this.#values[1]!);
  }
  get zzzz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[2]!, this.#values[2]!);
  }
  get r(): number {
    return this.x;
  }
  get g(): number {
    return this.y;
  }
  get b(): number {
    return this.z;
  }
  get s(): number {
    return this.x;
  }
  get t(): number {
    return this.y;
  }
  get p(): number {
    return this.z;
  }
  get x(): number {
    return this.#values[0]!;
  }
  get y(): number {
    return this.#values[1]!;
  }
  get z(): number {
    return this.#values[2]!;
  }
  get rr(): Vector2 {
    return this.xx;
  }
  get rg(): Vector2 {
    return this.xy;
  }
  get rb(): Vector2 {
    return this.xz;
  }
  get gr(): Vector2 {
    return this.yx;
  }
  get gg(): Vector2 {
    return this.yy;
  }
  get gb(): Vector2 {
    return this.yz;
  }
  get br(): Vector2 {
    return this.zx;
  }
  get bg(): Vector2 {
    return this.zy;
  }
  get bb(): Vector2 {
    return this.zz;
  }
  get rrr(): Vector3 {
    return this.xxx;
  }
  get rrg(): Vector3 {
    return this.xxy;
  }
  get rrb(): Vector3 {
    return this.xxz;
  }
  get rgr(): Vector3 {
    return this.xzx;
  }
  get rgg(): Vector3 {
    return this.xyy;
  }
  get rgb(): Vector3 {
    return this.xyz;
  }
  get rbr(): Vector3 {
    return this.xzx;
  }
  get rbg(): Vector3 {
    return this.xzy;
  }
  get rbb(): Vector3 {
    return this.xzz;
  }
  get grr(): Vector3 {
    return this.yxx;
  }
  get grg(): Vector3 {
    return this.yxy;
  }
  get grb(): Vector3 {
    return this.yxz;
  }
  get ggr(): Vector3 {
    return this.yyx;
  }
  get ggg(): Vector3 {
    return this.yyy;
  }
  get ggb(): Vector3 {
    return this.yyz;
  }
  get gbr(): Vector3 {
    return this.yxz;
  }
  get gbg(): Vector3 {
    return this.yzy;
  }
  get gbb(): Vector3 {
    return this.yzz;
  }
  get brr(): Vector3 {
    return this.zxx;
  }
  get brg(): Vector3 {
    return this.zxy;
  }
  get brb(): Vector3 {
    return this.zxz;
  }
  get bgr(): Vector3 {
    return this.zyx;
  }
  get bgg(): Vector3 {
    return this.zyy;
  }
  get bgb(): Vector3 {
    return this.zyz;
  }
  get bbr(): Vector3 {
    return this.zzx;
  }
  get bbg(): Vector3 {
    return this.zzy;
  }
  get bbb(): Vector3 {
    return this.zzz;
  }
  get rrrr(): Vector4 {
    return this.xxxx;
  }
  get rrrg(): Vector4 {
    return this.xxxy;
  }
  get rrrb(): Vector4 {
    return this.xxxz;
  }
  get rrgr(): Vector4 {
    return this.xxyx;
  }
  get rrgg(): Vector4 {
    return this.xxyy;
  }
  get rrgb(): Vector4 {
    return this.xxyz;
  }
  get rrbr(): Vector4 {
    return this.xxzx;
  }
  get rrbg(): Vector4 {
    return this.xxzy;
  }
  get rrbb(): Vector4 {
    return this.xxzz;
  }
  get rgrr(): Vector4 {
    return this.xyxx;
  }
  get rgrg(): Vector4 {
    return this.xyxy;
  }
  get rgrb(): Vector4 {
    return this.xyxz;
  }
  get rggr(): Vector4 {
    return this.xyyx;
  }
  get rggg(): Vector4 {
    return this.xyyy;
  }
  get rggb(): Vector4 {
    return this.xyyz;
  }
  get rgbr(): Vector4 {
    return this.xyzx;
  }
  get rgbg(): Vector4 {
    return this.xyzy;
  }
  get rgbb(): Vector4 {
    return this.xyzz;
  }
  get rbrr(): Vector4 {
    return this.xzxx;
  }
  get rbrg(): Vector4 {
    return this.xzxy;
  }
  get rbrb(): Vector4 {
    return this.xzxz;
  }
  get rbgr(): Vector4 {
    return this.xzyx;
  }
  get rbgg(): Vector4 {
    return this.xzyy;
  }
  get rbgb(): Vector4 {
    return this.xzyz;
  }
  get rbbr(): Vector4 {
    return this.xzzx;
  }
  get rbbg(): Vector4 {
    return this.xzzy;
  }
  get rbbb(): Vector4 {
    return this.xzzz;
  }
  get grrr(): Vector4 {
    return this.yxxx;
  }
  get grrg(): Vector4 {
    return this.yxxy;
  }
  get grrb(): Vector4 {
    return this.yxxz;
  }
  get grgr(): Vector4 {
    return this.yxyx;
  }
  get grgg(): Vector4 {
    return this.yxyy;
  }
  get grgb(): Vector4 {
    return this.yxyz;
  }
  get grbr(): Vector4 {
    return this.yxzx;
  }
  get grbg(): Vector4 {
    return this.yxzy;
  }
  get grbb(): Vector4 {
    return this.yxzz;
  }
  get ggrr(): Vector4 {
    return this.yyxx;
  }
  get ggrg(): Vector4 {
    return this.yyxy;
  }
  get ggrb(): Vector4 {
    return this.yyxz;
  }
  get gggr(): Vector4 {
    return this.yyyx;
  }
  get gggg(): Vector4 {
    return this.yyyy;
  }
  get gggb(): Vector4 {
    return this.yyyz;
  }
  get ggbr(): Vector4 {
    return this.yyzx;
  }
  get ggbg(): Vector4 {
    return this.yyzy;
  }
  get ggbb(): Vector4 {
    return this.yyzz;
  }
  get gbrr(): Vector4 {
    return this.yzxx;
  }
  get gbrg(): Vector4 {
    return this.yzxy;
  }
  get gbrb(): Vector4 {
    return this.yzxz;
  }
  get gbgr(): Vector4 {
    return this.yzyx;
  }
  get gbgg(): Vector4 {
    return this.yzyy;
  }
  get gbgb(): Vector4 {
    return this.yzyz;
  }
  get gbbr(): Vector4 {
    return this.yzzx;
  }
  get gbbg(): Vector4 {
    return this.yzzy;
  }
  get gbbb(): Vector4 {
    return this.yzzz;
  }
  get brrr(): Vector4 {
    return this.zxxx;
  }
  get brrg(): Vector4 {
    return this.zxxy;
  }
  get brrb(): Vector4 {
    return this.zxxz;
  }
  get brgr(): Vector4 {
    return this.zxyx;
  }
  get brgg(): Vector4 {
    return this.zxyy;
  }
  get brgb(): Vector4 {
    return this.zxyz;
  }
  get brbr(): Vector4 {
    return this.zxzx;
  }
  get brbg(): Vector4 {
    return this.zxzy;
  }
  get brbb(): Vector4 {
    return this.zxzz;
  }
  get bgrr(): Vector4 {
    return this.zyxx;
  }
  get bgrg(): Vector4 {
    return this.zyxy;
  }
  get bgrb(): Vector4 {
    return this.zyxz;
  }
  get bggr(): Vector4 {
    return this.zyyx;
  }
  get bggg(): Vector4 {
    return this.zyyy;
  }
  get bggb(): Vector4 {
    return this.zyyz;
  }
  get bgbr(): Vector4 {
    return this.zyzx;
  }
  get bgbg(): Vector4 {
    return this.zyzy;
  }
  get bgbb(): Vector4 {
    return this.zyzz;
  }
  get bbrr(): Vector4 {
    return this.zzxx;
  }
  get bbrg(): Vector4 {
    return this.zzxy;
  }
  get bbrb(): Vector4 {
    return this.zzxz;
  }
  get bbgr(): Vector4 {
    return this.zzyx;
  }
  get bbgg(): Vector4 {
    return this.zzyy;
  }
  get bbgb(): Vector4 {
    return this.zzyz;
  }
  get bbbr(): Vector4 {
    return this.zzzx;
  }
  get bbbg(): Vector4 {
    return this.zzzy;
  }
  get bbbb(): Vector4 {
    return this.zzzz;
  }
  get ss(): Vector2 {
    return this.xx;
  }
  get st(): Vector2 {
    return this.xy;
  }
  get sp(): Vector2 {
    return this.xz;
  }
  get ts(): Vector2 {
    return this.yx;
  }
  get tt(): Vector2 {
    return this.yy;
  }
  get tp(): Vector2 {
    return this.yz;
  }
  get ps(): Vector2 {
    return this.zx;
  }
  get pt(): Vector2 {
    return this.zy;
  }
  get pp(): Vector2 {
    return this.zz;
  }
  get sss(): Vector3 {
    return this.xxx;
  }
  get sst(): Vector3 {
    return this.xxy;
  }
  get ssp(): Vector3 {
    return this.xxz;
  }
  get sts(): Vector3 {
    return this.xyx;
  }
  get stt(): Vector3 {
    return this.xyy;
  }
  get stp(): Vector3 {
    return this.xyz;
  }
  get sps(): Vector3 {
    return this.xzx;
  }
  get spt(): Vector3 {
    return this.xzy;
  }
  get spp(): Vector3 {
    return this.xzz;
  }
  get tss(): Vector3 {
    return this.yxx;
  }
  get tst(): Vector3 {
    return this.yxy;
  }
  get tsp(): Vector3 {
    return this.yxz;
  }
  get tts(): Vector3 {
    return this.yyx;
  }
  get ttt(): Vector3 {
    return this.yyy;
  }
  get ttp(): Vector3 {
    return this.yyz;
  }
  get tps(): Vector3 {
    return this.yzx;
  }
  get tpt(): Vector3 {
    return this.yzy;
  }
  get tpp(): Vector3 {
    return this.yzz;
  }
  get pss(): Vector3 {
    return this.zxx;
  }
  get pst(): Vector3 {
    return this.zxy;
  }
  get psp(): Vector3 {
    return this.zxz;
  }
  get pts(): Vector3 {
    return this.zyx;
  }
  get ptt(): Vector3 {
    return this.zyy;
  }
  get ptp(): Vector3 {
    return this.zyz;
  }
  get pps(): Vector3 {
    return this.zzx;
  }
  get ppt(): Vector3 {
    return this.zzy;
  }
  get ppp(): Vector3 {
    return this.zzz;
  }
  get ssss(): Vector4 {
    return this.xxxx;
  }
  get ssst(): Vector4 {
    return this.xxxy;
  }
  get sssp(): Vector4 {
    return this.xxxz;
  }
  get ssts(): Vector4 {
    return this.xxyx;
  }
  get sstt(): Vector4 {
    return this.xxyy;
  }
  get sstp(): Vector4 {
    return this.xxyz;
  }
  get ssps(): Vector4 {
    return this.xxzx;
  }
  get sspt(): Vector4 {
    return this.xxzy;
  }
  get sspp(): Vector4 {
    return this.xxzz;
  }
  get stss(): Vector4 {
    return this.xyxx;
  }
  get stst(): Vector4 {
    return this.xyxy;
  }
  get stsp(): Vector4 {
    return this.xyxz;
  }
  get stts(): Vector4 {
    return this.xyyx;
  }
  get sttt(): Vector4 {
    return this.xyyy;
  }
  get sttp(): Vector4 {
    return this.xyyz;
  }
  get stps(): Vector4 {
    return this.xyzx;
  }
  get stpt(): Vector4 {
    return this.xyzy;
  }
  get stpp(): Vector4 {
    return this.xyzz;
  }
  get spss(): Vector4 {
    return this.xzxx;
  }
  get spst(): Vector4 {
    return this.xzxy;
  }
  get spsp(): Vector4 {
    return this.xzxz;
  }
  get spts(): Vector4 {
    return this.xzyx;
  }
  get sptt(): Vector4 {
    return this.xzyy;
  }
  get sptp(): Vector4 {
    return this.xzyz;
  }
  get spps(): Vector4 {
    return this.xzzx;
  }
  get sppt(): Vector4 {
    return this.xzzy;
  }
  get sppp(): Vector4 {
    return this.xzzz;
  }
  get tsss(): Vector4 {
    return this.yxxx;
  }
  get tsst(): Vector4 {
    return this.yxxy;
  }
  get tssp(): Vector4 {
    return this.yxxz;
  }
  get tsts(): Vector4 {
    return this.yxyx;
  }
  get tstt(): Vector4 {
    return this.yxyy;
  }
  get tstp(): Vector4 {
    return this.yxyz;
  }
  get tsps(): Vector4 {
    return this.yxzx;
  }
  get tspt(): Vector4 {
    return this.yxzy;
  }
  get tspp(): Vector4 {
    return this.yxzz;
  }
  get ttss(): Vector4 {
    return this.yyxx;
  }
  get ttst(): Vector4 {
    return this.yyxy;
  }
  get ttsp(): Vector4 {
    return this.yyxz;
  }
  get ttts(): Vector4 {
    return this.yyyx;
  }
  get tttt(): Vector4 {
    return this.yyyy;
  }
  get tttp(): Vector4 {
    return this.yyyz;
  }
  get ttps(): Vector4 {
    return this.yyzx;
  }
  get ttpt(): Vector4 {
    return this.yyzy;
  }
  get ttpp(): Vector4 {
    return this.yyzz;
  }
  get tpss(): Vector4 {
    return this.yzxx;
  }
  get tpst(): Vector4 {
    return this.yzxy;
  }
  get tpsp(): Vector4 {
    return this.yzxz;
  }
  get tpts(): Vector4 {
    return this.yzyx;
  }
  get tptt(): Vector4 {
    return this.yzyy;
  }
  get tptp(): Vector4 {
    return this.yzyz;
  }
  get tpps(): Vector4 {
    return this.yzzx;
  }
  get tppt(): Vector4 {
    return this.yzzy;
  }
  get tppp(): Vector4 {
    return this.yzzz;
  }
  get psss(): Vector4 {
    return this.zxxx;
  }
  get psst(): Vector4 {
    return this.zxxy;
  }
  get pssp(): Vector4 {
    return this.zxxz;
  }
  get psts(): Vector4 {
    return this.zxyx;
  }
  get pstt(): Vector4 {
    return this.zxyy;
  }
  get pstp(): Vector4 {
    return this.zxyz;
  }
  get psps(): Vector4 {
    return this.zxzx;
  }
  get pspt(): Vector4 {
    return this.zxzy;
  }
  get pspp(): Vector4 {
    return this.zxzz;
  }
  get ptss(): Vector4 {
    return this.zyxx;
  }
  get ptst(): Vector4 {
    return this.zyxy;
  }
  get ptsp(): Vector4 {
    return this.zyxz;
  }
  get ptts(): Vector4 {
    return this.zyyx;
  }
  get pttt(): Vector4 {
    return this.zyyy;
  }
  get pttp(): Vector4 {
    return this.zyyz;
  }
  get ptps(): Vector4 {
    return this.zyzx;
  }
  get ptpt(): Vector4 {
    return this.zyzy;
  }
  get ptpp(): Vector4 {
    return this.zyzz;
  }
  get ppss(): Vector4 {
    return this.zzxx;
  }
  get ppst(): Vector4 {
    return this.zzxy;
  }
  get ppsp(): Vector4 {
    return this.zzxz;
  }
  get ppts(): Vector4 {
    return this.zzyx;
  }
  get pptt(): Vector4 {
    return this.zzyy;
  }
  get pptp(): Vector4 {
    return this.zzyz;
  }
  get ppps(): Vector4 {
    return this.zzzx;
  }
  get pppt(): Vector4 {
    return this.zzzy;
  }
  get pppp(): Vector4 {
    return this.zzzz;
  }
}
