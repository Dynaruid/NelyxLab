// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/vector4.dart.
import { Vector2 } from './vector2.ts';
import { Vector3 } from './vector3.ts';
import { Matrix4 } from './matrix4.ts';
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
export class Vector4 extends Vector {
  readonly #values: Float64Array;
  constructor(v0: number, v1: number, v2: number, v3: number);
  constructor(storage: Float64Array);
  constructor(...components: unknown[]) {
    super();
    this.#values =
      components.length === 1
        ? numericView(components[0] as Float64Array, 4)
        : numericValues(components as number[], 4);
    registerNumericObject(this, this.#values, 'Vector4');
  }
  static zero(): Vector4 {
    return new Vector4(0, 0, 0, 0);
  }
  static fromFloat64List(storage: Float64Array): Vector4 {
    return new Vector4(storage);
  }
  static fromBuffer(buffer: ArrayBufferLike, offset: number): Vector4 {
    return Vector4.fromFloat64List(new Float64Array(buffer, offset, 4));
  }
  static array(array: readonly number[] | Float64Array, offset: number = 0): Vector4 {
    return (() => {
      const cascade0 = Vector4.zero();
      cascade0.copyFromArray(array, offset);
      return cascade0;
    })();
  }
  static identity(): Vector4 {
    return (() => {
      const cascade1 = Vector4.zero();
      cascade1.setIdentity();
      return cascade1;
    })();
  }
  static all(value: number): Vector4 {
    return (() => {
      const cascade2 = Vector4.zero();
      cascade2.splat(value);
      return cascade2;
    })();
  }
  static copy(other: Vector4): Vector4 {
    return (() => {
      const cascade3 = Vector4.zero();
      cascade3.setFrom(other);
      return cascade3;
    })();
  }
  static random(rng: NumericRandom | null = null): Vector4 {
    rng ??= defaultNumericRandom();
    return new Vector4(rng.nextDouble(), rng.nextDouble(), rng.nextDouble(), rng.nextDouble());
  }
  static min(a: Vector4, b: Vector4, result: Vector4): void {
    (() => {
      const cascade4 = result;
      cascade4.x = Math.min(a.x, b.x);
      cascade4.y = Math.min(a.y, b.y);
      cascade4.z = Math.min(a.z, b.z);
      cascade4.w = Math.min(a.w, b.w);
      return cascade4;
    })();
  }
  static max(a: Vector4, b: Vector4, result: Vector4): void {
    (() => {
      const cascade5 = result;
      cascade5.x = Math.max(a.x, b.x);
      cascade5.y = Math.max(a.y, b.y);
      cascade5.z = Math.max(a.z, b.z);
      cascade5.w = Math.max(a.w, b.w);
      return cascade5;
    })();
  }
  static mix(min: Vector4, max: Vector4, a: number, result: Vector4): void {
    (() => {
      const cascade6 = result;
      cascade6.x = min.x + a * (max.x - min.x);
      cascade6.y = min.y + a * (max.y - min.y);
      cascade6.z = min.z + a * (max.z - min.z);
      cascade6.w = min.w + a * (max.w - min.w);
      return cascade6;
    })();
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  setValues(x: number, y: number, z: number, w: number): void {
    this.#values[3]! = w;
    this.#values[2]! = z;
    this.#values[1]! = y;
    this.#values[0]! = x;
  }
  setZero(): void {
    this.#values[3]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[1]! = 0.0;
    this.#values[0]! = 0.0;
  }
  setIdentity(): void {
    this.#values[3]! = 1.0;
    this.#values[2]! = 0.0;
    this.#values[1]! = 0.0;
    this.#values[0]! = 0.0;
  }
  setFrom(other: Vector4): void {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector4');
    this.#values[3]! = otherStorage[3]!;
    this.#values[2]! = otherStorage[2]!;
    this.#values[1]! = otherStorage[1]!;
    this.#values[0]! = otherStorage[0]!;
  }
  splat(arg: number): void {
    this.#values[3]! = arg;
    this.#values[2]! = arg;
    this.#values[1]! = arg;
    this.#values[0]! = arg;
  }
  toString(): string {
    return (
      `[${numericString(this.#values[0]!)},${numericString(this.#values[1]!)},` +
      `${numericString(this.#values[2]!)},${numericString(this.#values[3]!)}]`
    );
  }
  equals(other: unknown): boolean {
    return (
      other instanceof Vector4 &&
      this.#values[3]! === numericObjectStorage(other, 'Vector4')[3]! &&
      this.#values[2]! === numericObjectStorage(other, 'Vector4')[2]! &&
      this.#values[1]! === numericObjectStorage(other, 'Vector4')[1]! &&
      this.#values[0]! === numericObjectStorage(other, 'Vector4')[0]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 4));
  }
  unaryMinus(): Vector4 {
    return (() => {
      const cascade7 = this.clone();
      cascade7.negate();
      return cascade7;
    })();
  }
  minus(other: Vector4): Vector4 {
    return (() => {
      const cascade8 = this.clone();
      cascade8.sub(other);
      return cascade8;
    })();
  }
  plus(other: Vector4): Vector4 {
    return (() => {
      const cascade9 = this.clone();
      cascade9.add(other);
      return cascade9;
    })();
  }
  divided(scale: number): Vector4 {
    return (() => {
      const cascade10 = this.clone();
      cascade10.scale(1.0 / scale);
      return cascade10;
    })();
  }
  times(scale: number): Vector4 {
    return (() => {
      const cascade11 = this.clone();
      cascade11.scale(scale);
      return cascade11;
    })();
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
      this.#values[3]! *= l;
      this.#values[2]! *= l;
      this.#values[1]! *= l;
      this.#values[0]! *= l;
    }
  }
  get length(): number {
    return Math.sqrt(this.length2);
  }
  get length2(): number {
    return (
      this.#values[3]! * this.#values[3]! +
      this.#values[2]! * this.#values[2]! +
      this.#values[1]! * this.#values[1]! +
      this.#values[0]! * this.#values[0]!
    );
  }
  normalize(): number {
    const l: number = this.length;
    if (l === 0.0) {
      return 0.0;
    }
    const d: number = 1.0 / l;
    this.#values[3]! *= d;
    this.#values[2]! *= d;
    this.#values[1]! *= d;
    this.#values[0]! *= d;
    return l;
  }
  normalizeLength(): number {
    return this.normalize();
  }
  normalized(): Vector4 {
    return (() => {
      const cascade12 = this.clone();
      cascade12.normalize();
      return cascade12;
    })();
  }
  normalizeInto(out: Vector4): Vector4 {
    (() => {
      const cascade13 = out;
      cascade13.setFrom(this);
      cascade13.normalize();
      return cascade13;
    })();
    return out;
  }
  distanceTo(arg: Vector4): number {
    return Math.sqrt(this.distanceToSquared(arg));
  }
  distanceToSquared(arg: Vector4): number {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    const dw: number = this.#values[3]! - argStorage[3]!;
    const dz: number = this.#values[2]! - argStorage[2]!;
    const dy: number = this.#values[1]! - argStorage[1]!;
    const dx: number = this.#values[0]! - argStorage[0]!;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }
  dot(other: Vector4): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector4');
    return (
      this.#values[3]! * otherStorage[3]! +
      this.#values[2]! * otherStorage[2]! +
      this.#values[1]! * otherStorage[1]! +
      this.#values[0]! * otherStorage[0]!
    );
  }
  applyMatrix4(arg: Matrix4): void {
    const v4: number = this.#values[3]!;
    const v3: number = this.#values[2]!;
    const v2: number = this.#values[1]!;
    const v1: number = this.#values[0]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    this.#values[3]! =
      argStorage[3]! * v1 + argStorage[7]! * v2 + argStorage[11]! * v3 + argStorage[15]! * v4;
    this.#values[2]! =
      argStorage[2]! * v1 + argStorage[6]! * v2 + argStorage[10]! * v3 + argStorage[14]! * v4;
    this.#values[1]! =
      argStorage[1]! * v1 + argStorage[5]! * v2 + argStorage[9]! * v3 + argStorage[13]! * v4;
    this.#values[0]! =
      argStorage[0]! * v1 + argStorage[4]! * v2 + argStorage[8]! * v3 + argStorage[12]! * v4;
  }
  relativeError(correct: Vector4): number {
    return this.minus(correct).length / correct.length;
  }
  absoluteError(correct: Vector4): number {
    const wDiff: number = this.#values[3]! - numericObjectStorage(correct, 'Vector4')[3]!;
    const zDiff: number = this.#values[2]! - numericObjectStorage(correct, 'Vector4')[2]!;
    const yDiff: number = this.#values[1]! - numericObjectStorage(correct, 'Vector4')[1]!;
    const xDiff: number = this.#values[0]! - numericObjectStorage(correct, 'Vector4')[0]!;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff + zDiff * zDiff + wDiff * wDiff);
  }
  get isInfinite(): boolean {
    return (
      this.#values[3]! === Infinity ||
      this.#values[3]! === -Infinity ||
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
      Number.isNaN(this.#values[3]!) ||
      Number.isNaN(this.#values[2]!) ||
      Number.isNaN(this.#values[1]!) ||
      Number.isNaN(this.#values[0]!)
    );
  }
  add(arg: Vector4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! += argStorage[3]!;
    this.#values[2]! += argStorage[2]!;
    this.#values[1]! += argStorage[1]!;
    this.#values[0]! += argStorage[0]!;
  }
  addScaled(arg: Vector4, factor: number): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! += argStorage[3]! * factor;
    this.#values[2]! += argStorage[2]! * factor;
    this.#values[1]! += argStorage[1]! * factor;
    this.#values[0]! += argStorage[0]! * factor;
  }
  sub(arg: Vector4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! -= argStorage[3]!;
    this.#values[2]! -= argStorage[2]!;
    this.#values[1]! -= argStorage[1]!;
    this.#values[0]! -= argStorage[0]!;
  }
  multiply(arg: Vector4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! *= argStorage[3]!;
    this.#values[2]! *= argStorage[2]!;
    this.#values[1]! *= argStorage[1]!;
    this.#values[0]! *= argStorage[0]!;
  }
  div(arg: Vector4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! /= argStorage[3]!;
    this.#values[2]! /= argStorage[2]!;
    this.#values[1]! /= argStorage[1]!;
    this.#values[0]! /= argStorage[0]!;
  }
  scale(arg: number): void {
    this.#values[3]! *= arg;
    this.#values[2]! *= arg;
    this.#values[1]! *= arg;
    this.#values[0]! *= arg;
  }
  scaled(arg: number): Vector4 {
    return (() => {
      const cascade14 = this.clone();
      cascade14.scale(arg);
      return cascade14;
    })();
  }
  negate(): void {
    this.#values[3]! = -this.#values[3]!;
    this.#values[2]! = -this.#values[2]!;
    this.#values[1]! = -this.#values[1]!;
    this.#values[0]! = -this.#values[0]!;
  }
  absolute(): void {
    this.#values[3]! = Math.abs(this.#values[3]!);
    this.#values[2]! = Math.abs(this.#values[2]!);
    this.#values[1]! = Math.abs(this.#values[1]!);
    this.#values[0]! = Math.abs(this.#values[0]!);
  }
  clamp(min: Vector4, max: Vector4): void {
    const minStorage: Float64Array = checkedNumericStorage(min.storage, 4);
    const maxStorage: Float64Array = checkedNumericStorage(max.storage, 4);
    this.#values[3]! = clampNumeric(this.#values[3]!, minStorage[3]!, maxStorage[3]!);
    this.#values[2]! = clampNumeric(this.#values[2]!, minStorage[2]!, maxStorage[2]!);
    this.#values[1]! = clampNumeric(this.#values[1]!, minStorage[1]!, maxStorage[1]!);
    this.#values[0]! = clampNumeric(this.#values[0]!, minStorage[0]!, maxStorage[0]!);
  }
  clampScalar(min: number, max: number): void {
    this.#values[3]! = clampNumeric(this.#values[3]!, min, max);
    this.#values[2]! = clampNumeric(this.#values[2]!, min, max);
    this.#values[1]! = clampNumeric(this.#values[1]!, min, max);
    this.#values[0]! = clampNumeric(this.#values[0]!, min, max);
  }
  floor(): void {
    this.#values[3]! = Math.floor(this.#values[3]!);
    this.#values[2]! = Math.floor(this.#values[2]!);
    this.#values[1]! = Math.floor(this.#values[1]!);
    this.#values[0]! = Math.floor(this.#values[0]!);
  }
  ceil(): void {
    this.#values[3]! = Math.ceil(this.#values[3]!);
    this.#values[2]! = Math.ceil(this.#values[2]!);
    this.#values[1]! = Math.ceil(this.#values[1]!);
    this.#values[0]! = Math.ceil(this.#values[0]!);
  }
  round(): void {
    this.#values[3]! = roundNumeric(this.#values[3]!);
    this.#values[2]! = roundNumeric(this.#values[2]!);
    this.#values[1]! = roundNumeric(this.#values[1]!);
    this.#values[0]! = roundNumeric(this.#values[0]!);
  }
  roundToZero(): void {
    this.#values[3]! =
      this.#values[3]! < 0.0 ? Math.ceil(this.#values[3]!) : Math.floor(this.#values[3]!);
    this.#values[2]! =
      this.#values[2]! < 0.0 ? Math.ceil(this.#values[2]!) : Math.floor(this.#values[2]!);
    this.#values[1]! =
      this.#values[1]! < 0.0 ? Math.ceil(this.#values[1]!) : Math.floor(this.#values[1]!);
    this.#values[0]! =
      this.#values[0]! < 0.0 ? Math.ceil(this.#values[0]!) : Math.floor(this.#values[0]!);
  }
  clone(): Vector4 {
    return Vector4.copy(this);
  }
  copyInto(arg: Vector4): Vector4 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    argStorage[3]! = this.#values[3]!;
    argStorage[2]! = this.#values[2]!;
    argStorage[1]! = this.#values[1]!;
    argStorage[0]! = this.#values[0]!;
    return arg;
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 4);
    array[offset + 3]! = this.#values[3]!;
    array[offset + 2]! = this.#values[2]!;
    array[offset + 1]! = this.#values[1]!;
    array[offset + 0]! = this.#values[0]!;
  }
  copyFromArray(array: readonly number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 4);
    this.#values[3]! = array[offset + 3]!;
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
  set xw(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[3]! = argStorage[1]!;
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
  set yw(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[3]! = argStorage[1]!;
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
  set zw(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[2]! = argStorage[0]!;
    this.#values[3]! = argStorage[1]!;
  }
  set wx(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[3]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set wy(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[3]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
  }
  set wz(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[3]! = argStorage[0]!;
    this.#values[2]! = argStorage[1]!;
  }
  set xyz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xyw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xzy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xzw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xwy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xwz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[0]! = argStorage[0]!;
  }
  set yxz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yxw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yzx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[1]! = argStorage[0]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set yzw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
  }
  set ywx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set ywz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
  }
  set zxy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
  }
  set zxw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set zyx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set zyw(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
  }
  set zwx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set zwy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[2]!;
  }
  set wxy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[1]!;
  }
  set wxz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[0]! = argStorage[1]!;
  }
  set wyx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
  }
  set wyz(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
  }
  set wzx(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
  }
  set wzy(arg: Vector3) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    this.#values[3]! = argStorage[0]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
  }
  set xyzw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xywz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xzyw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xzwy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xwyz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[0]!;
  }
  set xwzy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[0]! = argStorage[0]!;
  }
  set yxzw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yxwz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set yzxw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set yzwx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[3]!;
  }
  set ywxz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set ywzx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[0]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[0]!;
  }
  set zxyw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[1]!;
  }
  set zxwy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set zyxw(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set zywx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[2]!;
    this.#values[0]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
  }
  set zwxy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[0]! = argStorage[2]!;
  }
  set zwyx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[1]!;
    this.#values[0]! = argStorage[3]!;
    this.#values[2]! = argStorage[0]!;
    this.#values[1]! = argStorage[2]!;
  }
  set wxyz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[0]! = argStorage[1]!;
  }
  set wxzy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[0]! = argStorage[1]!;
  }
  set wyxz(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[2]! = argStorage[3]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set wyzx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[0]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
  }
  set wzxy(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[1]! = argStorage[3]!;
    this.#values[2]! = argStorage[1]!;
    this.#values[0]! = argStorage[2]!;
  }
  set wzyx(arg: Vector4) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[3]! = argStorage[0]!;
    this.#values[0]! = argStorage[3]!;
    this.#values[1]! = argStorage[2]!;
    this.#values[2]! = argStorage[1]!;
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
  set a(arg: number) {
    this.w = arg;
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
  set q(arg: number) {
    this.w = arg;
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
  set w(arg: number) {
    this.#values[3]! = arg;
  }
  set rg(arg: Vector2) {
    this.xy = arg;
  }
  set rb(arg: Vector2) {
    this.xz = arg;
  }
  set ra(arg: Vector2) {
    this.xw = arg;
  }
  set gr(arg: Vector2) {
    this.yx = arg;
  }
  set gb(arg: Vector2) {
    this.yz = arg;
  }
  set ga(arg: Vector2) {
    this.yw = arg;
  }
  set br(arg: Vector2) {
    this.zx = arg;
  }
  set bg(arg: Vector2) {
    this.zy = arg;
  }
  set ba(arg: Vector2) {
    this.zw = arg;
  }
  set ar(arg: Vector2) {
    this.wx = arg;
  }
  set ag(arg: Vector2) {
    this.wy = arg;
  }
  set ab(arg: Vector2) {
    this.wz = arg;
  }
  set rgb(arg: Vector3) {
    this.xyz = arg;
  }
  set rga(arg: Vector3) {
    this.xyw = arg;
  }
  set rbg(arg: Vector3) {
    this.xzy = arg;
  }
  set rba(arg: Vector3) {
    this.xzw = arg;
  }
  set rag(arg: Vector3) {
    this.xwy = arg;
  }
  set rab(arg: Vector3) {
    this.xwz = arg;
  }
  set grb(arg: Vector3) {
    this.yxz = arg;
  }
  set gra(arg: Vector3) {
    this.yxw = arg;
  }
  set gbr(arg: Vector3) {
    this.yzx = arg;
  }
  set gba(arg: Vector3) {
    this.yzw = arg;
  }
  set gar(arg: Vector3) {
    this.ywx = arg;
  }
  set gab(arg: Vector3) {
    this.ywz = arg;
  }
  set brg(arg: Vector3) {
    this.zxy = arg;
  }
  set bra(arg: Vector3) {
    this.zxw = arg;
  }
  set bgr(arg: Vector3) {
    this.zyx = arg;
  }
  set bga(arg: Vector3) {
    this.zyw = arg;
  }
  set bar(arg: Vector3) {
    this.zwx = arg;
  }
  set bag(arg: Vector3) {
    this.zwy = arg;
  }
  set arg(arg: Vector3) {
    this.wxy = arg;
  }
  set arb(arg: Vector3) {
    this.wxz = arg;
  }
  set agr(arg: Vector3) {
    this.wyx = arg;
  }
  set agb(arg: Vector3) {
    this.wyz = arg;
  }
  set abr(arg: Vector3) {
    this.wzx = arg;
  }
  set abg(arg: Vector3) {
    this.wzy = arg;
  }
  set rgba(arg: Vector4) {
    this.xyzw = arg;
  }
  set rgab(arg: Vector4) {
    this.xywz = arg;
  }
  set rbga(arg: Vector4) {
    this.xzyw = arg;
  }
  set rbag(arg: Vector4) {
    this.xzwy = arg;
  }
  set ragb(arg: Vector4) {
    this.xwyz = arg;
  }
  set rabg(arg: Vector4) {
    this.xwzy = arg;
  }
  set grba(arg: Vector4) {
    this.yxzw = arg;
  }
  set grab(arg: Vector4) {
    this.yxwz = arg;
  }
  set gbra(arg: Vector4) {
    this.yzxw = arg;
  }
  set gbar(arg: Vector4) {
    this.yzwx = arg;
  }
  set garb(arg: Vector4) {
    this.ywxz = arg;
  }
  set gabr(arg: Vector4) {
    this.ywzx = arg;
  }
  set brga(arg: Vector4) {
    this.zxyw = arg;
  }
  set brag(arg: Vector4) {
    this.zxwy = arg;
  }
  set bgra(arg: Vector4) {
    this.zyxw = arg;
  }
  set bgar(arg: Vector4) {
    this.zywx = arg;
  }
  set barg(arg: Vector4) {
    this.zwxy = arg;
  }
  set bagr(arg: Vector4) {
    this.zwyx = arg;
  }
  set argb(arg: Vector4) {
    this.wxyz = arg;
  }
  set arbg(arg: Vector4) {
    this.wxzy = arg;
  }
  set agrb(arg: Vector4) {
    this.wyxz = arg;
  }
  set agbr(arg: Vector4) {
    this.wyzx = arg;
  }
  set abrg(arg: Vector4) {
    this.wzxy = arg;
  }
  set abgr(arg: Vector4) {
    this.wzyx = arg;
  }
  set st(arg: Vector2) {
    this.xy = arg;
  }
  set sp(arg: Vector2) {
    this.xz = arg;
  }
  set sq(arg: Vector2) {
    this.xw = arg;
  }
  set ts(arg: Vector2) {
    this.yx = arg;
  }
  set tp(arg: Vector2) {
    this.yz = arg;
  }
  set tq(arg: Vector2) {
    this.yw = arg;
  }
  set ps(arg: Vector2) {
    this.zx = arg;
  }
  set pt(arg: Vector2) {
    this.zy = arg;
  }
  set pq(arg: Vector2) {
    this.zw = arg;
  }
  set qs(arg: Vector2) {
    this.wx = arg;
  }
  set qt(arg: Vector2) {
    this.wy = arg;
  }
  set qp(arg: Vector2) {
    this.wz = arg;
  }
  set stp(arg: Vector3) {
    this.xyz = arg;
  }
  set stq(arg: Vector3) {
    this.xyw = arg;
  }
  set spt(arg: Vector3) {
    this.xzy = arg;
  }
  set spq(arg: Vector3) {
    this.xzw = arg;
  }
  set sqt(arg: Vector3) {
    this.xwy = arg;
  }
  set sqp(arg: Vector3) {
    this.xwz = arg;
  }
  set tsp(arg: Vector3) {
    this.yxz = arg;
  }
  set tsq(arg: Vector3) {
    this.yxw = arg;
  }
  set tps(arg: Vector3) {
    this.yzx = arg;
  }
  set tpq(arg: Vector3) {
    this.yzw = arg;
  }
  set tqs(arg: Vector3) {
    this.ywx = arg;
  }
  set tqp(arg: Vector3) {
    this.ywz = arg;
  }
  set pst(arg: Vector3) {
    this.zxy = arg;
  }
  set psq(arg: Vector3) {
    this.zxw = arg;
  }
  set pts(arg: Vector3) {
    this.zyx = arg;
  }
  set ptq(arg: Vector3) {
    this.zyw = arg;
  }
  set pqs(arg: Vector3) {
    this.zwx = arg;
  }
  set pqt(arg: Vector3) {
    this.zwy = arg;
  }
  set qst(arg: Vector3) {
    this.wxy = arg;
  }
  set qsp(arg: Vector3) {
    this.wxz = arg;
  }
  set qts(arg: Vector3) {
    this.wyx = arg;
  }
  set qtp(arg: Vector3) {
    this.wyz = arg;
  }
  set qps(arg: Vector3) {
    this.wzx = arg;
  }
  set qpt(arg: Vector3) {
    this.wzy = arg;
  }
  set stpq(arg: Vector4) {
    this.xyzw = arg;
  }
  set stqp(arg: Vector4) {
    this.xywz = arg;
  }
  set sptq(arg: Vector4) {
    this.xzyw = arg;
  }
  set spqt(arg: Vector4) {
    this.xzwy = arg;
  }
  set sqtp(arg: Vector4) {
    this.xwyz = arg;
  }
  set sqpt(arg: Vector4) {
    this.xwzy = arg;
  }
  set tspq(arg: Vector4) {
    this.yxzw = arg;
  }
  set tsqp(arg: Vector4) {
    this.yxwz = arg;
  }
  set tpsq(arg: Vector4) {
    this.yzxw = arg;
  }
  set tpqs(arg: Vector4) {
    this.yzwx = arg;
  }
  set tqsp(arg: Vector4) {
    this.ywxz = arg;
  }
  set tqps(arg: Vector4) {
    this.ywzx = arg;
  }
  set pstq(arg: Vector4) {
    this.zxyw = arg;
  }
  set psqt(arg: Vector4) {
    this.zxwy = arg;
  }
  set ptsq(arg: Vector4) {
    this.zyxw = arg;
  }
  set ptqs(arg: Vector4) {
    this.zywx = arg;
  }
  set pqst(arg: Vector4) {
    this.zwxy = arg;
  }
  set pqts(arg: Vector4) {
    this.zwyx = arg;
  }
  set qstp(arg: Vector4) {
    this.wxyz = arg;
  }
  set qspt(arg: Vector4) {
    this.wxzy = arg;
  }
  set qtsp(arg: Vector4) {
    this.wyxz = arg;
  }
  set qtps(arg: Vector4) {
    this.wyzx = arg;
  }
  set qpst(arg: Vector4) {
    this.wzxy = arg;
  }
  set qpts(arg: Vector4) {
    this.wzyx = arg;
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
  get xw(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[3]!);
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
  get yw(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[3]!);
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
  get zw(): Vector2 {
    return new Vector2(this.#values[2]!, this.#values[3]!);
  }
  get wx(): Vector2 {
    return new Vector2(this.#values[3]!, this.#values[0]!);
  }
  get wy(): Vector2 {
    return new Vector2(this.#values[3]!, this.#values[1]!);
  }
  get wz(): Vector2 {
    return new Vector2(this.#values[3]!, this.#values[2]!);
  }
  get ww(): Vector2 {
    return new Vector2(this.#values[3]!, this.#values[3]!);
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
  get xxw(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[3]!);
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
  get xyw(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[3]!);
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
  get xzw(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[2]!, this.#values[3]!);
  }
  get xwx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[3]!, this.#values[0]!);
  }
  get xwy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[3]!, this.#values[1]!);
  }
  get xwz(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[3]!, this.#values[2]!);
  }
  get xww(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[3]!, this.#values[3]!);
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
  get yxw(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[3]!);
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
  get yyw(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[3]!);
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
  get yzw(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[2]!, this.#values[3]!);
  }
  get ywx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[3]!, this.#values[0]!);
  }
  get ywy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[3]!, this.#values[1]!);
  }
  get ywz(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[3]!, this.#values[2]!);
  }
  get yww(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[3]!, this.#values[3]!);
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
  get zxw(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[0]!, this.#values[3]!);
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
  get zyw(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[1]!, this.#values[3]!);
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
  get zzw(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[2]!, this.#values[3]!);
  }
  get zwx(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[3]!, this.#values[0]!);
  }
  get zwy(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[3]!, this.#values[1]!);
  }
  get zwz(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[3]!, this.#values[2]!);
  }
  get zww(): Vector3 {
    return new Vector3(this.#values[2]!, this.#values[3]!, this.#values[3]!);
  }
  get wxx(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[0]!, this.#values[0]!);
  }
  get wxy(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[0]!, this.#values[1]!);
  }
  get wxz(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[0]!, this.#values[2]!);
  }
  get wxw(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[0]!, this.#values[3]!);
  }
  get wyx(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[1]!, this.#values[0]!);
  }
  get wyy(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[1]!, this.#values[1]!);
  }
  get wyz(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[1]!, this.#values[2]!);
  }
  get wyw(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[1]!, this.#values[3]!);
  }
  get wzx(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[2]!, this.#values[0]!);
  }
  get wzy(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[2]!, this.#values[1]!);
  }
  get wzz(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[2]!, this.#values[2]!);
  }
  get wzw(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[2]!, this.#values[3]!);
  }
  get wwx(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[3]!, this.#values[0]!);
  }
  get wwy(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[3]!, this.#values[1]!);
  }
  get wwz(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[3]!, this.#values[2]!);
  }
  get www(): Vector3 {
    return new Vector3(this.#values[3]!, this.#values[3]!, this.#values[3]!);
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
  get xxxw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[3]!);
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
  get xxyw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[3]!);
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
  get xxzw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[2]!, this.#values[3]!);
  }
  get xxwx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[3]!, this.#values[0]!);
  }
  get xxwy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[3]!, this.#values[1]!);
  }
  get xxwz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[3]!, this.#values[2]!);
  }
  get xxww(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[3]!, this.#values[3]!);
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
  get xyxw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[3]!);
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
  get xyyw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[3]!);
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
  get xyzw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[2]!, this.#values[3]!);
  }
  get xywx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[3]!, this.#values[0]!);
  }
  get xywy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[3]!, this.#values[1]!);
  }
  get xywz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[3]!, this.#values[2]!);
  }
  get xyww(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[3]!, this.#values[3]!);
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
  get xzxw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[0]!, this.#values[3]!);
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
  get xzyw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[1]!, this.#values[3]!);
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
  get xzzw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[2]!, this.#values[3]!);
  }
  get xzwx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[3]!, this.#values[0]!);
  }
  get xzwy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[3]!, this.#values[1]!);
  }
  get xzwz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[3]!, this.#values[2]!);
  }
  get xzww(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[2]!, this.#values[3]!, this.#values[3]!);
  }
  get xwxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[0]!, this.#values[0]!);
  }
  get xwxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[0]!, this.#values[1]!);
  }
  get xwxz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[0]!, this.#values[2]!);
  }
  get xwxw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[0]!, this.#values[3]!);
  }
  get xwyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[1]!, this.#values[0]!);
  }
  get xwyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[1]!, this.#values[1]!);
  }
  get xwyz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[1]!, this.#values[2]!);
  }
  get xwyw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[1]!, this.#values[3]!);
  }
  get xwzx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[2]!, this.#values[0]!);
  }
  get xwzy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[2]!, this.#values[1]!);
  }
  get xwzz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[2]!, this.#values[2]!);
  }
  get xwzw(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[2]!, this.#values[3]!);
  }
  get xwwx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[3]!, this.#values[0]!);
  }
  get xwwy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[3]!, this.#values[1]!);
  }
  get xwwz(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[3]!, this.#values[2]!);
  }
  get xwww(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[3]!, this.#values[3]!, this.#values[3]!);
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
  get yxxw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[3]!);
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
  get yxyw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[3]!);
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
  get yxzw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[2]!, this.#values[3]!);
  }
  get yxwx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[3]!, this.#values[0]!);
  }
  get yxwy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[3]!, this.#values[1]!);
  }
  get yxwz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[3]!, this.#values[2]!);
  }
  get yxww(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[3]!, this.#values[3]!);
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
  get yyxw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[3]!);
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
  get yyyw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[3]!);
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
  get yyzw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[2]!, this.#values[3]!);
  }
  get yywx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[3]!, this.#values[0]!);
  }
  get yywy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[3]!, this.#values[1]!);
  }
  get yywz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[3]!, this.#values[2]!);
  }
  get yyww(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[3]!, this.#values[3]!);
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
  get yzxw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[0]!, this.#values[3]!);
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
  get yzyw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[1]!, this.#values[3]!);
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
  get yzzw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[2]!, this.#values[3]!);
  }
  get yzwx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[3]!, this.#values[0]!);
  }
  get yzwy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[3]!, this.#values[1]!);
  }
  get yzwz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[3]!, this.#values[2]!);
  }
  get yzww(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[2]!, this.#values[3]!, this.#values[3]!);
  }
  get ywxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[0]!, this.#values[0]!);
  }
  get ywxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[0]!, this.#values[1]!);
  }
  get ywxz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[0]!, this.#values[2]!);
  }
  get ywxw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[0]!, this.#values[3]!);
  }
  get ywyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[1]!, this.#values[0]!);
  }
  get ywyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[1]!, this.#values[1]!);
  }
  get ywyz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[1]!, this.#values[2]!);
  }
  get ywyw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[1]!, this.#values[3]!);
  }
  get ywzx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[2]!, this.#values[0]!);
  }
  get ywzy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[2]!, this.#values[1]!);
  }
  get ywzz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[2]!, this.#values[2]!);
  }
  get ywzw(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[2]!, this.#values[3]!);
  }
  get ywwx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[3]!, this.#values[0]!);
  }
  get ywwy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[3]!, this.#values[1]!);
  }
  get ywwz(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[3]!, this.#values[2]!);
  }
  get ywww(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[3]!, this.#values[3]!, this.#values[3]!);
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
  get zxxw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[0]!, this.#values[3]!);
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
  get zxyw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[1]!, this.#values[3]!);
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
  get zxzw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[2]!, this.#values[3]!);
  }
  get zxwx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[3]!, this.#values[0]!);
  }
  get zxwy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[3]!, this.#values[1]!);
  }
  get zxwz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[3]!, this.#values[2]!);
  }
  get zxww(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[0]!, this.#values[3]!, this.#values[3]!);
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
  get zyxw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[0]!, this.#values[3]!);
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
  get zyyw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[1]!, this.#values[3]!);
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
  get zyzw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[2]!, this.#values[3]!);
  }
  get zywx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[3]!, this.#values[0]!);
  }
  get zywy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[3]!, this.#values[1]!);
  }
  get zywz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[3]!, this.#values[2]!);
  }
  get zyww(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[1]!, this.#values[3]!, this.#values[3]!);
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
  get zzxw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[0]!, this.#values[3]!);
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
  get zzyw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[1]!, this.#values[3]!);
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
  get zzzw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[2]!, this.#values[3]!);
  }
  get zzwx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[3]!, this.#values[0]!);
  }
  get zzwy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[3]!, this.#values[1]!);
  }
  get zzwz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[3]!, this.#values[2]!);
  }
  get zzww(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[2]!, this.#values[3]!, this.#values[3]!);
  }
  get zwxx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[0]!, this.#values[0]!);
  }
  get zwxy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[0]!, this.#values[1]!);
  }
  get zwxz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[0]!, this.#values[2]!);
  }
  get zwxw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[0]!, this.#values[3]!);
  }
  get zwyx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[1]!, this.#values[0]!);
  }
  get zwyy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[1]!, this.#values[1]!);
  }
  get zwyz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[1]!, this.#values[2]!);
  }
  get zwyw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[1]!, this.#values[3]!);
  }
  get zwzx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[2]!, this.#values[0]!);
  }
  get zwzy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[2]!, this.#values[1]!);
  }
  get zwzz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[2]!, this.#values[2]!);
  }
  get zwzw(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[2]!, this.#values[3]!);
  }
  get zwwx(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[3]!, this.#values[0]!);
  }
  get zwwy(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[3]!, this.#values[1]!);
  }
  get zwwz(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[3]!, this.#values[2]!);
  }
  get zwww(): Vector4 {
    return new Vector4(this.#values[2]!, this.#values[3]!, this.#values[3]!, this.#values[3]!);
  }
  get wxxx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get wxxy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get wxxz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[0]!, this.#values[2]!);
  }
  get wxxw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[0]!, this.#values[3]!);
  }
  get wxyx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get wxyy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get wxyz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[1]!, this.#values[2]!);
  }
  get wxyw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[1]!, this.#values[3]!);
  }
  get wxzx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[2]!, this.#values[0]!);
  }
  get wxzy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[2]!, this.#values[1]!);
  }
  get wxzz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[2]!, this.#values[2]!);
  }
  get wxzw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[2]!, this.#values[3]!);
  }
  get wxwx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[3]!, this.#values[0]!);
  }
  get wxwy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[3]!, this.#values[1]!);
  }
  get wxwz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[3]!, this.#values[2]!);
  }
  get wxww(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[0]!, this.#values[3]!, this.#values[3]!);
  }
  get wyxx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get wyxy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get wyxz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[0]!, this.#values[2]!);
  }
  get wyxw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[0]!, this.#values[3]!);
  }
  get wyyx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get wyyy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get wyyz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[1]!, this.#values[2]!);
  }
  get wyyw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[1]!, this.#values[3]!);
  }
  get wyzx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[2]!, this.#values[0]!);
  }
  get wyzy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[2]!, this.#values[1]!);
  }
  get wyzz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[2]!, this.#values[2]!);
  }
  get wyzw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[2]!, this.#values[3]!);
  }
  get wywx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[3]!, this.#values[0]!);
  }
  get wywy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[3]!, this.#values[1]!);
  }
  get wywz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[3]!, this.#values[2]!);
  }
  get wyww(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[1]!, this.#values[3]!, this.#values[3]!);
  }
  get wzxx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[0]!, this.#values[0]!);
  }
  get wzxy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[0]!, this.#values[1]!);
  }
  get wzxz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[0]!, this.#values[2]!);
  }
  get wzxw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[0]!, this.#values[3]!);
  }
  get wzyx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[1]!, this.#values[0]!);
  }
  get wzyy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[1]!, this.#values[1]!);
  }
  get wzyz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[1]!, this.#values[2]!);
  }
  get wzyw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[1]!, this.#values[3]!);
  }
  get wzzx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[2]!, this.#values[0]!);
  }
  get wzzy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[2]!, this.#values[1]!);
  }
  get wzzz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[2]!, this.#values[2]!);
  }
  get wzzw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[2]!, this.#values[3]!);
  }
  get wzwx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[3]!, this.#values[0]!);
  }
  get wzwy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[3]!, this.#values[1]!);
  }
  get wzwz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[3]!, this.#values[2]!);
  }
  get wzww(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[2]!, this.#values[3]!, this.#values[3]!);
  }
  get wwxx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[0]!, this.#values[0]!);
  }
  get wwxy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[0]!, this.#values[1]!);
  }
  get wwxz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[0]!, this.#values[2]!);
  }
  get wwxw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[0]!, this.#values[3]!);
  }
  get wwyx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[1]!, this.#values[0]!);
  }
  get wwyy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[1]!, this.#values[1]!);
  }
  get wwyz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[1]!, this.#values[2]!);
  }
  get wwyw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[1]!, this.#values[3]!);
  }
  get wwzx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[2]!, this.#values[0]!);
  }
  get wwzy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[2]!, this.#values[1]!);
  }
  get wwzz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[2]!, this.#values[2]!);
  }
  get wwzw(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[2]!, this.#values[3]!);
  }
  get wwwx(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[3]!, this.#values[0]!);
  }
  get wwwy(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[3]!, this.#values[1]!);
  }
  get wwwz(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[3]!, this.#values[2]!);
  }
  get wwww(): Vector4 {
    return new Vector4(this.#values[3]!, this.#values[3]!, this.#values[3]!, this.#values[3]!);
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
  get a(): number {
    return this.w;
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
  get q(): number {
    return this.w;
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
  get w(): number {
    return this.#values[3]!;
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
  get ra(): Vector2 {
    return this.xw;
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
  get ga(): Vector2 {
    return this.yw;
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
  get ba(): Vector2 {
    return this.zw;
  }
  get ar(): Vector2 {
    return this.wx;
  }
  get ag(): Vector2 {
    return this.wy;
  }
  get ab(): Vector2 {
    return this.wz;
  }
  get aa(): Vector2 {
    return this.ww;
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
  get rra(): Vector3 {
    return this.xxw;
  }
  get rgr(): Vector3 {
    return this.xyx;
  }
  get rgg(): Vector3 {
    return this.xyy;
  }
  get rgb(): Vector3 {
    return this.xyz;
  }
  get rga(): Vector3 {
    return this.xyw;
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
  get rba(): Vector3 {
    return this.xzw;
  }
  get rar(): Vector3 {
    return this.xwx;
  }
  get rag(): Vector3 {
    return this.xwy;
  }
  get rab(): Vector3 {
    return this.xwz;
  }
  get raa(): Vector3 {
    return this.xww;
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
  get gra(): Vector3 {
    return this.yxw;
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
  get gga(): Vector3 {
    return this.yyw;
  }
  get gbr(): Vector3 {
    return this.yzx;
  }
  get gbg(): Vector3 {
    return this.yzy;
  }
  get gbb(): Vector3 {
    return this.yzz;
  }
  get gba(): Vector3 {
    return this.yzw;
  }
  get gar(): Vector3 {
    return this.ywx;
  }
  get gag(): Vector3 {
    return this.ywy;
  }
  get gab(): Vector3 {
    return this.ywz;
  }
  get gaa(): Vector3 {
    return this.yww;
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
  get bra(): Vector3 {
    return this.zxw;
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
  get bga(): Vector3 {
    return this.zyw;
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
  get bba(): Vector3 {
    return this.zzw;
  }
  get bar(): Vector3 {
    return this.zwx;
  }
  get bag(): Vector3 {
    return this.zwy;
  }
  get bab(): Vector3 {
    return this.zwz;
  }
  get baa(): Vector3 {
    return this.zww;
  }
  get arr(): Vector3 {
    return this.wxx;
  }
  get arg(): Vector3 {
    return this.wxy;
  }
  get arb(): Vector3 {
    return this.wxz;
  }
  get ara(): Vector3 {
    return this.wxw;
  }
  get agr(): Vector3 {
    return this.wyx;
  }
  get agg(): Vector3 {
    return this.wyy;
  }
  get agb(): Vector3 {
    return this.wyz;
  }
  get aga(): Vector3 {
    return this.wyw;
  }
  get abr(): Vector3 {
    return this.wzx;
  }
  get abg(): Vector3 {
    return this.wzy;
  }
  get abb(): Vector3 {
    return this.wzz;
  }
  get aba(): Vector3 {
    return this.wzw;
  }
  get aar(): Vector3 {
    return this.wwx;
  }
  get aag(): Vector3 {
    return this.wwy;
  }
  get aab(): Vector3 {
    return this.wwz;
  }
  get aaa(): Vector3 {
    return this.www;
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
  get rrra(): Vector4 {
    return this.xxxw;
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
  get rrga(): Vector4 {
    return this.xxyw;
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
  get rrba(): Vector4 {
    return this.xxzw;
  }
  get rrar(): Vector4 {
    return this.xxwx;
  }
  get rrag(): Vector4 {
    return this.xxwy;
  }
  get rrab(): Vector4 {
    return this.xxwz;
  }
  get rraa(): Vector4 {
    return this.xxww;
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
  get rgra(): Vector4 {
    return this.xyxw;
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
  get rgga(): Vector4 {
    return this.xyyw;
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
  get rgba(): Vector4 {
    return this.xyzw;
  }
  get rgar(): Vector4 {
    return this.xywx;
  }
  get rgag(): Vector4 {
    return this.xywy;
  }
  get rgab(): Vector4 {
    return this.xywz;
  }
  get rgaa(): Vector4 {
    return this.xyww;
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
  get rbra(): Vector4 {
    return this.xzxw;
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
  get rbga(): Vector4 {
    return this.xzyw;
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
  get rbba(): Vector4 {
    return this.xzzw;
  }
  get rbar(): Vector4 {
    return this.xzwx;
  }
  get rbag(): Vector4 {
    return this.xzwy;
  }
  get rbab(): Vector4 {
    return this.xzwz;
  }
  get rbaa(): Vector4 {
    return this.xzww;
  }
  get rarr(): Vector4 {
    return this.xwxx;
  }
  get rarg(): Vector4 {
    return this.xwxy;
  }
  get rarb(): Vector4 {
    return this.xwxz;
  }
  get rara(): Vector4 {
    return this.xwxw;
  }
  get ragr(): Vector4 {
    return this.xwyx;
  }
  get ragg(): Vector4 {
    return this.xwyy;
  }
  get ragb(): Vector4 {
    return this.xwyz;
  }
  get raga(): Vector4 {
    return this.xwyw;
  }
  get rabr(): Vector4 {
    return this.xwzx;
  }
  get rabg(): Vector4 {
    return this.xwzy;
  }
  get rabb(): Vector4 {
    return this.xwzz;
  }
  get raba(): Vector4 {
    return this.xwzw;
  }
  get raar(): Vector4 {
    return this.xwwx;
  }
  get raag(): Vector4 {
    return this.xwwy;
  }
  get raab(): Vector4 {
    return this.xwwz;
  }
  get raaa(): Vector4 {
    return this.xwww;
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
  get grra(): Vector4 {
    return this.yxxw;
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
  get grga(): Vector4 {
    return this.yxyw;
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
  get grba(): Vector4 {
    return this.yxzw;
  }
  get grar(): Vector4 {
    return this.yxwx;
  }
  get grag(): Vector4 {
    return this.yxwy;
  }
  get grab(): Vector4 {
    return this.yxwz;
  }
  get graa(): Vector4 {
    return this.yxww;
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
  get ggra(): Vector4 {
    return this.yyxw;
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
  get ggga(): Vector4 {
    return this.yyyw;
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
  get ggba(): Vector4 {
    return this.yyzw;
  }
  get ggar(): Vector4 {
    return this.yywx;
  }
  get ggag(): Vector4 {
    return this.yywy;
  }
  get ggab(): Vector4 {
    return this.yywz;
  }
  get ggaa(): Vector4 {
    return this.yyww;
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
  get gbra(): Vector4 {
    return this.yzxw;
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
  get gbga(): Vector4 {
    return this.yzyw;
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
  get gbba(): Vector4 {
    return this.yzzw;
  }
  get gbar(): Vector4 {
    return this.yzwx;
  }
  get gbag(): Vector4 {
    return this.yzwy;
  }
  get gbab(): Vector4 {
    return this.yzwz;
  }
  get gbaa(): Vector4 {
    return this.yzww;
  }
  get garr(): Vector4 {
    return this.ywxx;
  }
  get garg(): Vector4 {
    return this.ywxy;
  }
  get garb(): Vector4 {
    return this.ywxz;
  }
  get gara(): Vector4 {
    return this.ywxw;
  }
  get gagr(): Vector4 {
    return this.ywyx;
  }
  get gagg(): Vector4 {
    return this.ywyy;
  }
  get gagb(): Vector4 {
    return this.ywyz;
  }
  get gaga(): Vector4 {
    return this.ywyw;
  }
  get gabr(): Vector4 {
    return this.ywzx;
  }
  get gabg(): Vector4 {
    return this.ywzy;
  }
  get gabb(): Vector4 {
    return this.ywzz;
  }
  get gaba(): Vector4 {
    return this.ywzw;
  }
  get gaar(): Vector4 {
    return this.ywwx;
  }
  get gaag(): Vector4 {
    return this.ywwy;
  }
  get gaab(): Vector4 {
    return this.ywwz;
  }
  get gaaa(): Vector4 {
    return this.ywww;
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
  get brra(): Vector4 {
    return this.zxxw;
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
  get brga(): Vector4 {
    return this.zxyw;
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
  get brba(): Vector4 {
    return this.zxzw;
  }
  get brar(): Vector4 {
    return this.zxwx;
  }
  get brag(): Vector4 {
    return this.zxwy;
  }
  get brab(): Vector4 {
    return this.zxwz;
  }
  get braa(): Vector4 {
    return this.zxww;
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
  get bgra(): Vector4 {
    return this.zyxw;
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
  get bgga(): Vector4 {
    return this.zyyw;
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
  get bgba(): Vector4 {
    return this.zyzw;
  }
  get bgar(): Vector4 {
    return this.zywx;
  }
  get bgag(): Vector4 {
    return this.zywy;
  }
  get bgab(): Vector4 {
    return this.zywz;
  }
  get bgaa(): Vector4 {
    return this.zyww;
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
  get bbra(): Vector4 {
    return this.zzxw;
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
  get bbga(): Vector4 {
    return this.zzyw;
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
  get bbba(): Vector4 {
    return this.zzzw;
  }
  get bbar(): Vector4 {
    return this.zzwx;
  }
  get bbag(): Vector4 {
    return this.zzwy;
  }
  get bbab(): Vector4 {
    return this.zzwz;
  }
  get bbaa(): Vector4 {
    return this.zzww;
  }
  get barr(): Vector4 {
    return this.zwxx;
  }
  get barg(): Vector4 {
    return this.zwxy;
  }
  get barb(): Vector4 {
    return this.zwxz;
  }
  get bara(): Vector4 {
    return this.zwxw;
  }
  get bagr(): Vector4 {
    return this.zwyx;
  }
  get bagg(): Vector4 {
    return this.zwyy;
  }
  get bagb(): Vector4 {
    return this.zwyz;
  }
  get baga(): Vector4 {
    return this.zwyw;
  }
  get babr(): Vector4 {
    return this.zwzx;
  }
  get babg(): Vector4 {
    return this.zwzy;
  }
  get babb(): Vector4 {
    return this.zwzz;
  }
  get baba(): Vector4 {
    return this.zwzw;
  }
  get baar(): Vector4 {
    return this.zwwx;
  }
  get baag(): Vector4 {
    return this.zwwy;
  }
  get baab(): Vector4 {
    return this.zwwz;
  }
  get baaa(): Vector4 {
    return this.zwww;
  }
  get arrr(): Vector4 {
    return this.wxxx;
  }
  get arrg(): Vector4 {
    return this.wxxy;
  }
  get arrb(): Vector4 {
    return this.wxxz;
  }
  get arra(): Vector4 {
    return this.wxxw;
  }
  get argr(): Vector4 {
    return this.wxyx;
  }
  get argg(): Vector4 {
    return this.wxyy;
  }
  get argb(): Vector4 {
    return this.wxyz;
  }
  get arga(): Vector4 {
    return this.wxyw;
  }
  get arbr(): Vector4 {
    return this.wxzx;
  }
  get arbg(): Vector4 {
    return this.wxzy;
  }
  get arbb(): Vector4 {
    return this.wxzz;
  }
  get arba(): Vector4 {
    return this.wxzw;
  }
  get arar(): Vector4 {
    return this.wxwx;
  }
  get arag(): Vector4 {
    return this.wxwy;
  }
  get arab(): Vector4 {
    return this.wxwz;
  }
  get araa(): Vector4 {
    return this.wxww;
  }
  get agrr(): Vector4 {
    return this.wyxx;
  }
  get agrg(): Vector4 {
    return this.wyxy;
  }
  get agrb(): Vector4 {
    return this.wyxz;
  }
  get agra(): Vector4 {
    return this.wyxw;
  }
  get aggr(): Vector4 {
    return this.wyyx;
  }
  get aggg(): Vector4 {
    return this.wyyy;
  }
  get aggb(): Vector4 {
    return this.wyyz;
  }
  get agga(): Vector4 {
    return this.wyyw;
  }
  get agbr(): Vector4 {
    return this.wyzx;
  }
  get agbg(): Vector4 {
    return this.wyzy;
  }
  get agbb(): Vector4 {
    return this.wyzz;
  }
  get agba(): Vector4 {
    return this.wyzw;
  }
  get agar(): Vector4 {
    return this.wywx;
  }
  get agag(): Vector4 {
    return this.wywy;
  }
  get agab(): Vector4 {
    return this.wywz;
  }
  get agaa(): Vector4 {
    return this.wyww;
  }
  get abrr(): Vector4 {
    return this.wzxx;
  }
  get abrg(): Vector4 {
    return this.wzxy;
  }
  get abrb(): Vector4 {
    return this.wzxz;
  }
  get abra(): Vector4 {
    return this.wzxw;
  }
  get abgr(): Vector4 {
    return this.wzyx;
  }
  get abgg(): Vector4 {
    return this.wzyy;
  }
  get abgb(): Vector4 {
    return this.wzyz;
  }
  get abga(): Vector4 {
    return this.wzyw;
  }
  get abbr(): Vector4 {
    return this.wzzx;
  }
  get abbg(): Vector4 {
    return this.wzzy;
  }
  get abbb(): Vector4 {
    return this.wzzz;
  }
  get abba(): Vector4 {
    return this.wzzw;
  }
  get abar(): Vector4 {
    return this.wzwx;
  }
  get abag(): Vector4 {
    return this.wzwy;
  }
  get abab(): Vector4 {
    return this.wzwz;
  }
  get abaa(): Vector4 {
    return this.wzww;
  }
  get aarr(): Vector4 {
    return this.wwxx;
  }
  get aarg(): Vector4 {
    return this.wwxy;
  }
  get aarb(): Vector4 {
    return this.wwxz;
  }
  get aara(): Vector4 {
    return this.wwxw;
  }
  get aagr(): Vector4 {
    return this.wwyx;
  }
  get aagg(): Vector4 {
    return this.wwyy;
  }
  get aagb(): Vector4 {
    return this.wwyz;
  }
  get aaga(): Vector4 {
    return this.wwyw;
  }
  get aabr(): Vector4 {
    return this.wwzx;
  }
  get aabg(): Vector4 {
    return this.wwzy;
  }
  get aabb(): Vector4 {
    return this.wwzz;
  }
  get aaba(): Vector4 {
    return this.wwzw;
  }
  get aaar(): Vector4 {
    return this.wwwx;
  }
  get aaag(): Vector4 {
    return this.wwwy;
  }
  get aaab(): Vector4 {
    return this.wwwz;
  }
  get aaaa(): Vector4 {
    return this.wwww;
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
  get sq(): Vector2 {
    return this.xw;
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
  get tq(): Vector2 {
    return this.yw;
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
  get pq(): Vector2 {
    return this.zw;
  }
  get qs(): Vector2 {
    return this.wx;
  }
  get qt(): Vector2 {
    return this.wy;
  }
  get qp(): Vector2 {
    return this.wz;
  }
  get qq(): Vector2 {
    return this.ww;
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
  get ssq(): Vector3 {
    return this.xxw;
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
  get stq(): Vector3 {
    return this.xyw;
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
  get spq(): Vector3 {
    return this.xzw;
  }
  get sqs(): Vector3 {
    return this.xwx;
  }
  get sqt(): Vector3 {
    return this.xwy;
  }
  get sqp(): Vector3 {
    return this.xwz;
  }
  get sqq(): Vector3 {
    return this.xww;
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
  get tsq(): Vector3 {
    return this.yxw;
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
  get ttq(): Vector3 {
    return this.yyw;
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
  get tpq(): Vector3 {
    return this.yzw;
  }
  get tqs(): Vector3 {
    return this.ywx;
  }
  get tqt(): Vector3 {
    return this.ywy;
  }
  get tqp(): Vector3 {
    return this.ywz;
  }
  get tqq(): Vector3 {
    return this.yww;
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
  get psq(): Vector3 {
    return this.zxw;
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
  get ptq(): Vector3 {
    return this.zyw;
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
  get ppq(): Vector3 {
    return this.zzw;
  }
  get pqs(): Vector3 {
    return this.zwx;
  }
  get pqt(): Vector3 {
    return this.zwy;
  }
  get pqp(): Vector3 {
    return this.zwz;
  }
  get pqq(): Vector3 {
    return this.zww;
  }
  get qss(): Vector3 {
    return this.wxx;
  }
  get qst(): Vector3 {
    return this.wxy;
  }
  get qsp(): Vector3 {
    return this.wxz;
  }
  get qsq(): Vector3 {
    return this.wxw;
  }
  get qts(): Vector3 {
    return this.wyx;
  }
  get qtt(): Vector3 {
    return this.wyy;
  }
  get qtp(): Vector3 {
    return this.wyz;
  }
  get qtq(): Vector3 {
    return this.wyw;
  }
  get qps(): Vector3 {
    return this.wzx;
  }
  get qpt(): Vector3 {
    return this.wzy;
  }
  get qpp(): Vector3 {
    return this.wzz;
  }
  get qpq(): Vector3 {
    return this.wzw;
  }
  get qqs(): Vector3 {
    return this.wwx;
  }
  get qqt(): Vector3 {
    return this.wwy;
  }
  get qqp(): Vector3 {
    return this.wwz;
  }
  get qqq(): Vector3 {
    return this.www;
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
  get sssq(): Vector4 {
    return this.xxxw;
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
  get sstq(): Vector4 {
    return this.xxyw;
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
  get sspq(): Vector4 {
    return this.xxzw;
  }
  get ssqs(): Vector4 {
    return this.xxwx;
  }
  get ssqt(): Vector4 {
    return this.xxwy;
  }
  get ssqp(): Vector4 {
    return this.xxwz;
  }
  get ssqq(): Vector4 {
    return this.xxww;
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
  get stsq(): Vector4 {
    return this.xyxw;
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
  get sttq(): Vector4 {
    return this.xyyw;
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
  get stpq(): Vector4 {
    return this.xyzw;
  }
  get stqs(): Vector4 {
    return this.xywx;
  }
  get stqt(): Vector4 {
    return this.xywy;
  }
  get stqp(): Vector4 {
    return this.xywz;
  }
  get stqq(): Vector4 {
    return this.xyww;
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
  get spsq(): Vector4 {
    return this.xzxw;
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
  get sptq(): Vector4 {
    return this.xzyw;
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
  get sppq(): Vector4 {
    return this.xzzw;
  }
  get spqs(): Vector4 {
    return this.xzwx;
  }
  get spqt(): Vector4 {
    return this.xzwy;
  }
  get spqp(): Vector4 {
    return this.xzwz;
  }
  get spqq(): Vector4 {
    return this.xzww;
  }
  get sqss(): Vector4 {
    return this.xwxx;
  }
  get sqst(): Vector4 {
    return this.xwxy;
  }
  get sqsp(): Vector4 {
    return this.xwxz;
  }
  get sqsq(): Vector4 {
    return this.xwxw;
  }
  get sqts(): Vector4 {
    return this.xwyx;
  }
  get sqtt(): Vector4 {
    return this.xwyy;
  }
  get sqtp(): Vector4 {
    return this.xwyz;
  }
  get sqtq(): Vector4 {
    return this.xwyw;
  }
  get sqps(): Vector4 {
    return this.xwzx;
  }
  get sqpt(): Vector4 {
    return this.xwzy;
  }
  get sqpp(): Vector4 {
    return this.xwzz;
  }
  get sqpq(): Vector4 {
    return this.xwzw;
  }
  get sqqs(): Vector4 {
    return this.xwwx;
  }
  get sqqt(): Vector4 {
    return this.xwwy;
  }
  get sqqp(): Vector4 {
    return this.xwwz;
  }
  get sqqq(): Vector4 {
    return this.xwww;
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
  get tssq(): Vector4 {
    return this.yxxw;
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
  get tstq(): Vector4 {
    return this.yxyw;
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
  get tspq(): Vector4 {
    return this.yxzw;
  }
  get tsqs(): Vector4 {
    return this.yxwx;
  }
  get tsqt(): Vector4 {
    return this.yxwy;
  }
  get tsqp(): Vector4 {
    return this.yxwz;
  }
  get tsqq(): Vector4 {
    return this.yxww;
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
  get ttsq(): Vector4 {
    return this.yyxw;
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
  get tttq(): Vector4 {
    return this.yyyw;
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
  get ttpq(): Vector4 {
    return this.yyzw;
  }
  get ttqs(): Vector4 {
    return this.yywx;
  }
  get ttqt(): Vector4 {
    return this.yywy;
  }
  get ttqp(): Vector4 {
    return this.yywz;
  }
  get ttqq(): Vector4 {
    return this.yyww;
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
  get tpsq(): Vector4 {
    return this.yzxw;
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
  get tptq(): Vector4 {
    return this.yzyw;
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
  get tppq(): Vector4 {
    return this.yzzw;
  }
  get tpqs(): Vector4 {
    return this.yzwx;
  }
  get tpqt(): Vector4 {
    return this.yzwy;
  }
  get tpqp(): Vector4 {
    return this.yzwz;
  }
  get tpqq(): Vector4 {
    return this.yzww;
  }
  get tqss(): Vector4 {
    return this.ywxx;
  }
  get tqst(): Vector4 {
    return this.ywxy;
  }
  get tqsp(): Vector4 {
    return this.ywxz;
  }
  get tqsq(): Vector4 {
    return this.ywxw;
  }
  get tqts(): Vector4 {
    return this.ywyx;
  }
  get tqtt(): Vector4 {
    return this.ywyy;
  }
  get tqtp(): Vector4 {
    return this.ywyz;
  }
  get tqtq(): Vector4 {
    return this.ywyw;
  }
  get tqps(): Vector4 {
    return this.ywzx;
  }
  get tqpt(): Vector4 {
    return this.ywzy;
  }
  get tqpp(): Vector4 {
    return this.ywzz;
  }
  get tqpq(): Vector4 {
    return this.ywzw;
  }
  get tqqs(): Vector4 {
    return this.ywwx;
  }
  get tqqt(): Vector4 {
    return this.ywwy;
  }
  get tqqp(): Vector4 {
    return this.ywwz;
  }
  get tqqq(): Vector4 {
    return this.ywww;
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
  get pssq(): Vector4 {
    return this.zxxw;
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
  get pstq(): Vector4 {
    return this.zxyw;
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
  get pspq(): Vector4 {
    return this.zxzw;
  }
  get psqs(): Vector4 {
    return this.zxwx;
  }
  get psqt(): Vector4 {
    return this.zxwy;
  }
  get psqp(): Vector4 {
    return this.zxwz;
  }
  get psqq(): Vector4 {
    return this.zxww;
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
  get ptsq(): Vector4 {
    return this.zyxw;
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
  get pttq(): Vector4 {
    return this.zyyw;
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
  get ptpq(): Vector4 {
    return this.zyzw;
  }
  get ptqs(): Vector4 {
    return this.zywx;
  }
  get ptqt(): Vector4 {
    return this.zywy;
  }
  get ptqp(): Vector4 {
    return this.zywz;
  }
  get ptqq(): Vector4 {
    return this.zyww;
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
  get ppsq(): Vector4 {
    return this.zzxw;
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
  get pptq(): Vector4 {
    return this.zzyw;
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
  get pppq(): Vector4 {
    return this.zzzw;
  }
  get ppqs(): Vector4 {
    return this.zzwx;
  }
  get ppqt(): Vector4 {
    return this.zzwy;
  }
  get ppqp(): Vector4 {
    return this.zzwz;
  }
  get ppqq(): Vector4 {
    return this.zzww;
  }
  get pqss(): Vector4 {
    return this.zwxx;
  }
  get pqst(): Vector4 {
    return this.zwxy;
  }
  get pqsp(): Vector4 {
    return this.zwxz;
  }
  get pqsq(): Vector4 {
    return this.zwxw;
  }
  get pqts(): Vector4 {
    return this.zwyx;
  }
  get pqtt(): Vector4 {
    return this.zwyy;
  }
  get pqtp(): Vector4 {
    return this.zwyz;
  }
  get pqtq(): Vector4 {
    return this.zwyw;
  }
  get pqps(): Vector4 {
    return this.zwzx;
  }
  get pqpt(): Vector4 {
    return this.zwzy;
  }
  get pqpp(): Vector4 {
    return this.zwzz;
  }
  get pqpq(): Vector4 {
    return this.zwzw;
  }
  get pqqs(): Vector4 {
    return this.zwwx;
  }
  get pqqt(): Vector4 {
    return this.zwwy;
  }
  get pqqp(): Vector4 {
    return this.zwwz;
  }
  get pqqq(): Vector4 {
    return this.zwww;
  }
  get qsss(): Vector4 {
    return this.wxxx;
  }
  get qsst(): Vector4 {
    return this.wxxy;
  }
  get qssp(): Vector4 {
    return this.wxxz;
  }
  get qssq(): Vector4 {
    return this.wxxw;
  }
  get qsts(): Vector4 {
    return this.wxyx;
  }
  get qstt(): Vector4 {
    return this.wxyy;
  }
  get qstp(): Vector4 {
    return this.wxyz;
  }
  get qstq(): Vector4 {
    return this.wxyw;
  }
  get qsps(): Vector4 {
    return this.wxzx;
  }
  get qspt(): Vector4 {
    return this.wxzy;
  }
  get qspp(): Vector4 {
    return this.wxzz;
  }
  get qspq(): Vector4 {
    return this.wxzw;
  }
  get qsqs(): Vector4 {
    return this.wxwx;
  }
  get qsqt(): Vector4 {
    return this.wxwy;
  }
  get qsqp(): Vector4 {
    return this.wxwz;
  }
  get qsqq(): Vector4 {
    return this.wxww;
  }
  get qtss(): Vector4 {
    return this.wyxx;
  }
  get qtst(): Vector4 {
    return this.wyxy;
  }
  get qtsp(): Vector4 {
    return this.wyxz;
  }
  get qtsq(): Vector4 {
    return this.wyxw;
  }
  get qtts(): Vector4 {
    return this.wyyx;
  }
  get qttt(): Vector4 {
    return this.wyyy;
  }
  get qttp(): Vector4 {
    return this.wyyz;
  }
  get qttq(): Vector4 {
    return this.wyyw;
  }
  get qtps(): Vector4 {
    return this.wyzx;
  }
  get qtpt(): Vector4 {
    return this.wyzy;
  }
  get qtpp(): Vector4 {
    return this.wyzz;
  }
  get qtpq(): Vector4 {
    return this.wyzw;
  }
  get qtqs(): Vector4 {
    return this.wywx;
  }
  get qtqt(): Vector4 {
    return this.wywy;
  }
  get qtqp(): Vector4 {
    return this.wywz;
  }
  get qtqq(): Vector4 {
    return this.wyww;
  }
  get qpss(): Vector4 {
    return this.wzxx;
  }
  get qpst(): Vector4 {
    return this.wzxy;
  }
  get qpsp(): Vector4 {
    return this.wzxz;
  }
  get qpsq(): Vector4 {
    return this.wzxw;
  }
  get qpts(): Vector4 {
    return this.wzyx;
  }
  get qptt(): Vector4 {
    return this.wzyy;
  }
  get qptp(): Vector4 {
    return this.wzyz;
  }
  get qptq(): Vector4 {
    return this.wzyw;
  }
  get qpps(): Vector4 {
    return this.wzzx;
  }
  get qppt(): Vector4 {
    return this.wzzy;
  }
  get qppp(): Vector4 {
    return this.wzzz;
  }
  get qppq(): Vector4 {
    return this.wzzw;
  }
  get qpqs(): Vector4 {
    return this.wzwx;
  }
  get qpqt(): Vector4 {
    return this.wzwy;
  }
  get qpqp(): Vector4 {
    return this.wzwz;
  }
  get qpqq(): Vector4 {
    return this.wzww;
  }
  get qqss(): Vector4 {
    return this.wwxx;
  }
  get qqst(): Vector4 {
    return this.wwxy;
  }
  get qqsp(): Vector4 {
    return this.wwxz;
  }
  get qqsq(): Vector4 {
    return this.wwxw;
  }
  get qqts(): Vector4 {
    return this.wwyx;
  }
  get qqtt(): Vector4 {
    return this.wwyy;
  }
  get qqtp(): Vector4 {
    return this.wwyz;
  }
  get qqtq(): Vector4 {
    return this.wwyw;
  }
  get qqps(): Vector4 {
    return this.wwzx;
  }
  get qqpt(): Vector4 {
    return this.wwzy;
  }
  get qqpp(): Vector4 {
    return this.wwzz;
  }
  get qqpq(): Vector4 {
    return this.wwzw;
  }
  get qqqs(): Vector4 {
    return this.wwwx;
  }
  get qqqt(): Vector4 {
    return this.wwwy;
  }
  get qqqp(): Vector4 {
    return this.wwwz;
  }
  get qqqq(): Vector4 {
    return this.wwww;
  }
}
