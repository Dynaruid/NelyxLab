// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/vector2.dart.
import { Vector3 } from './vector3.ts';
import { Vector4 } from './vector4.ts';
import { Matrix2 } from './matrix2.ts';
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
export class Vector2 extends Vector {
  readonly #values: Float64Array;
  constructor(v0: number, v1: number);
  constructor(storage: Float64Array);
  constructor(...components: unknown[]) {
    super();
    this.#values =
      components.length === 1
        ? numericView(components[0] as Float64Array, 2)
        : numericValues(components as number[], 2);
    registerNumericObject(this, this.#values, 'Vector2');
  }
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }
  static fromFloat64List(storage: Float64Array): Vector2 {
    return new Vector2(storage);
  }
  static fromBuffer(buffer: ArrayBufferLike, offset: number): Vector2 {
    return Vector2.fromFloat64List(new Float64Array(buffer, offset, 2));
  }
  static array(array: readonly number[] | Float64Array, offset: number = 0): Vector2 {
    return (() => {
      const cascade0 = Vector2.zero();
      cascade0.copyFromArray(array, offset);
      return cascade0;
    })();
  }
  static all(value: number): Vector2 {
    return (() => {
      const cascade1 = Vector2.zero();
      cascade1.splat(value);
      return cascade1;
    })();
  }
  static copy(other: Vector2): Vector2 {
    return (() => {
      const cascade2 = Vector2.zero();
      cascade2.setFrom(other);
      return cascade2;
    })();
  }
  static random(rng: NumericRandom | null = null): Vector2 {
    rng ??= defaultNumericRandom();
    return new Vector2(rng.nextDouble(), rng.nextDouble());
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  static min(a: Vector2, b: Vector2, result: Vector2): void {
    (() => {
      const cascade3 = result;
      cascade3.x = Math.min(a.x, b.x);
      cascade3.y = Math.min(a.y, b.y);
      return cascade3;
    })();
  }
  static max(a: Vector2, b: Vector2, result: Vector2): void {
    (() => {
      const cascade4 = result;
      cascade4.x = Math.max(a.x, b.x);
      cascade4.y = Math.max(a.y, b.y);
      return cascade4;
    })();
  }
  static mix(min: Vector2, max: Vector2, a: number, result: Vector2): void {
    (() => {
      const cascade5 = result;
      cascade5.x = min.x + a * (max.x - min.x);
      cascade5.y = min.y + a * (max.y - min.y);
      return cascade5;
    })();
  }
  setValues(x_: number, y_: number): void {
    this.#values[1]! = y_;
    this.#values[0]! = x_;
  }
  setZero(): void {
    this.#values[1]! = 0.0;
    this.#values[0]! = 0.0;
  }
  setFrom(other: Vector2): void {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector2');
    this.#values[1]! = otherStorage[1]!;
    this.#values[0]! = otherStorage[0]!;
  }
  splat(arg: number): void {
    this.#values[1]! = arg;
    this.#values[0]! = arg;
  }
  toString(): string {
    return `[${numericString(this.#values[0]!)},${numericString(this.#values[1]!)}]`;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof Vector2 &&
      this.#values[1]! === numericObjectStorage(other, 'Vector2')[1]! &&
      this.#values[0]! === numericObjectStorage(other, 'Vector2')[0]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 2));
  }
  unaryMinus(): Vector2 {
    return (() => {
      const cascade6 = this.clone();
      cascade6.negate();
      return cascade6;
    })();
  }
  minus(other: Vector2): Vector2 {
    return (() => {
      const cascade7 = this.clone();
      cascade7.sub(other);
      return cascade7;
    })();
  }
  plus(other: Vector2): Vector2 {
    return (() => {
      const cascade8 = this.clone();
      cascade8.add(other);
      return cascade8;
    })();
  }
  divided(scale: number): Vector2 {
    return (() => {
      const cascade9 = this.clone();
      cascade9.scale(1.0 / scale);
      return cascade9;
    })();
  }
  times(scale: number): Vector2 {
    return (() => {
      const cascade10 = this.clone();
      cascade10.scale(scale);
      return cascade10;
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
      this.#values[1]! *= l;
      this.#values[0]! *= l;
    }
  }
  get length(): number {
    return Math.sqrt(this.length2);
  }
  get length2(): number {
    return this.#values[1]! * this.#values[1]! + this.#values[0]! * this.#values[0]!;
  }
  normalize(): number {
    const l: number = this.length;
    if (l === 0.0) {
      return 0.0;
    }
    const d: number = 1.0 / l;
    this.#values[1]! *= d;
    this.#values[0]! *= d;
    return l;
  }
  normalizeLength(): number {
    return this.normalize();
  }
  normalized(): Vector2 {
    return (() => {
      const cascade11 = this.clone();
      cascade11.normalize();
      return cascade11;
    })();
  }
  normalizeInto(out: Vector2): Vector2 {
    (() => {
      const cascade12 = out;
      cascade12.setFrom(this);
      cascade12.normalize();
      return cascade12;
    })();
    return out;
  }
  distanceTo(arg: Vector2): number {
    return Math.sqrt(this.distanceToSquared(arg));
  }
  distanceToSquared(arg: Vector2): number {
    const dx: number = this.x - arg.x;
    const dy: number = this.y - arg.y;
    return dx * dx + dy * dy;
  }
  angleTo(other: Vector2): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector2');
    if (this.#values[1]! === otherStorage[1]! && this.#values[0]! === otherStorage[0]!) {
      return 0.0;
    }
    const d: number = this.dot(other) / (this.length * other.length);
    return Math.acos(clampNumeric(d, -1.0, 1.0));
  }
  angleToSigned(other: Vector2): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector2');
    if (this.#values[1]! === otherStorage[1]! && this.#values[0]! === otherStorage[0]!) {
      return 0.0;
    }
    const s: number = this.cross(other);
    const c: number = this.dot(other);
    return Math.atan2(s, c);
  }
  dot(other: Vector2): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector2');
    return this.#values[1]! * otherStorage[1]! + this.#values[0]! * otherStorage[0]!;
  }
  postmultiply(arg: Matrix2): void {
    const argStorage: Float64Array = checkedNumericStorage(arg.storage, 4);
    const v1: number = this.#values[1]!;
    const v0: number = this.#values[0]!;
    this.#values[1]! = v0 * argStorage[2]! + v1 * argStorage[3]!;
    this.#values[0]! = v0 * argStorage[0]! + v1 * argStorage[1]!;
  }
  cross(other: Vector2): number {
    const otherStorage: Float64Array = numericObjectStorage(other, 'Vector2');
    return this.#values[0]! * otherStorage[1]! - this.#values[1]! * otherStorage[0]!;
  }
  scaleOrthogonalInto(scale: number, out: Vector2): Vector2 {
    out.setValues(-scale * this.#values[1]!, scale * this.#values[0]!);
    return out;
  }
  reflect(normal: Vector2): void {
    const dotProduct: number = normal.dot(this) * 2;
    this.#values[1]! -= numericObjectStorage(normal, 'Vector2')[1]! * dotProduct;
    this.#values[0]! -= numericObjectStorage(normal, 'Vector2')[0]! * dotProduct;
  }
  reflected(normal: Vector2): Vector2 {
    return (() => {
      const cascade13 = this.clone();
      cascade13.reflect(normal);
      return cascade13;
    })();
  }
  relativeError(correct: Vector2): number {
    return this.absoluteError(correct) / correct.length;
  }
  absoluteError(correct: Vector2): number {
    const yDiff: number = this.#values[1]! - numericObjectStorage(correct, 'Vector2')[1]!;
    const xDiff: number = this.#values[0]! - numericObjectStorage(correct, 'Vector2')[0]!;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
  }
  get isInfinite(): boolean {
    return (
      this.#values[1]! === Infinity ||
      this.#values[1]! === -Infinity ||
      this.#values[0]! === Infinity ||
      this.#values[0]! === -Infinity
    );
  }
  get isNaN(): boolean {
    return Number.isNaN(this.#values[1]!) || Number.isNaN(this.#values[0]!);
  }
  add(arg: Vector2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! += argStorage[1]!;
    this.#values[0]! += argStorage[0]!;
  }
  addScaled(arg: Vector2, factor: number): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! += argStorage[1]! * factor;
    this.#values[0]! += argStorage[0]! * factor;
  }
  sub(arg: Vector2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! -= argStorage[1]!;
    this.#values[0]! -= argStorage[0]!;
  }
  multiply(arg: Vector2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! *= argStorage[1]!;
    this.#values[0]! *= argStorage[0]!;
  }
  divide(arg: Vector2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! /= argStorage[1]!;
    this.#values[0]! /= argStorage[0]!;
  }
  scale(arg: number): void {
    this.#values[1]! *= arg;
    this.#values[0]! *= arg;
  }
  scaled(arg: number): Vector2 {
    return (() => {
      const cascade14 = this.clone();
      cascade14.scale(arg);
      return cascade14;
    })();
  }
  negate(): void {
    this.#values[1]! = -this.#values[1]!;
    this.#values[0]! = -this.#values[0]!;
  }
  absolute(): void {
    this.#values[1]! = Math.abs(this.#values[1]!);
    this.#values[0]! = Math.abs(this.#values[0]!);
  }
  clamp(min: Vector2, max: Vector2): void {
    const minStorage: Float64Array = numericObjectStorage(min, 'Vector2');
    const maxStorage: Float64Array = numericObjectStorage(max, 'Vector2');
    this.#values[1]! = clampNumeric(this.#values[1]!, minStorage[1]!, maxStorage[1]!);
    this.#values[0]! = clampNumeric(this.#values[0]!, minStorage[0]!, maxStorage[0]!);
  }
  clampScalar(min: number, max: number): void {
    this.#values[1]! = clampNumeric(this.#values[1]!, min, max);
    this.#values[0]! = clampNumeric(this.#values[0]!, min, max);
  }
  floor(): void {
    this.#values[1]! = Math.floor(this.#values[1]!);
    this.#values[0]! = Math.floor(this.#values[0]!);
  }
  ceil(): void {
    this.#values[1]! = Math.ceil(this.#values[1]!);
    this.#values[0]! = Math.ceil(this.#values[0]!);
  }
  round(): void {
    this.#values[1]! = roundNumeric(this.#values[1]!);
    this.#values[0]! = roundNumeric(this.#values[0]!);
  }
  roundToZero(): void {
    this.#values[1]! =
      this.#values[1]! < 0.0 ? Math.ceil(this.#values[1]!) : Math.floor(this.#values[1]!);
    this.#values[0]! =
      this.#values[0]! < 0.0 ? Math.ceil(this.#values[0]!) : Math.floor(this.#values[0]!);
  }
  clone(): Vector2 {
    return Vector2.copy(this);
  }
  copyInto(arg: Vector2): Vector2 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    argStorage[1]! = this.#values[1]!;
    argStorage[0]! = this.#values[0]!;
    return arg;
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 2);
    array[offset + 1]! = this.#values[1]!;
    array[offset + 0]! = this.#values[0]!;
  }
  copyFromArray(array: readonly number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 2);
    this.#values[1]! = array[offset + 1]!;
    this.#values[0]! = array[offset + 0]!;
  }
  set xy(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  set yx(arg: Vector2) {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[1]! = argStorage[0]!;
    this.#values[0]! = argStorage[1]!;
  }
  set r(arg: number) {
    this.x = arg;
  }
  set g(arg: number) {
    this.y = arg;
  }
  set s(arg: number) {
    this.x = arg;
  }
  set t(arg: number) {
    this.y = arg;
  }
  set x(arg: number) {
    this.#values[0]! = arg;
  }
  set y(arg: number) {
    this.#values[1]! = arg;
  }
  set rg(arg: Vector2) {
    this.xy = arg;
  }
  set gr(arg: Vector2) {
    this.yx = arg;
  }
  set st(arg: Vector2) {
    this.xy = arg;
  }
  set ts(arg: Vector2) {
    this.yx = arg;
  }
  get xx(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[0]!);
  }
  get xy(): Vector2 {
    return new Vector2(this.#values[0]!, this.#values[1]!);
  }
  get yx(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[0]!);
  }
  get yy(): Vector2 {
    return new Vector2(this.#values[1]!, this.#values[1]!);
  }
  get xxx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get xxy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get xyx(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get xyy(): Vector3 {
    return new Vector3(this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get yxx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get yxy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get yyx(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get yyy(): Vector3 {
    return new Vector3(this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get xxxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get xxxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get xxyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get xxyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get xyxx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get xyxy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get xyyx(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get xyyy(): Vector4 {
    return new Vector4(this.#values[0]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get yxxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[0]!);
  }
  get yxxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[0]!, this.#values[1]!);
  }
  get yxyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[0]!);
  }
  get yxyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[0]!, this.#values[1]!, this.#values[1]!);
  }
  get yyxx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[0]!);
  }
  get yyxy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[0]!, this.#values[1]!);
  }
  get yyyx(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[0]!);
  }
  get yyyy(): Vector4 {
    return new Vector4(this.#values[1]!, this.#values[1]!, this.#values[1]!, this.#values[1]!);
  }
  get r(): number {
    return this.x;
  }
  get g(): number {
    return this.y;
  }
  get s(): number {
    return this.x;
  }
  get t(): number {
    return this.y;
  }
  get x(): number {
    return this.#values[0]!;
  }
  get y(): number {
    return this.#values[1]!;
  }
  get rr(): Vector2 {
    return this.xx;
  }
  get rg(): Vector2 {
    return this.xy;
  }
  get gr(): Vector2 {
    return this.yx;
  }
  get gg(): Vector2 {
    return this.yy;
  }
  get rrr(): Vector3 {
    return this.xxx;
  }
  get rrg(): Vector3 {
    return this.xxy;
  }
  get rgr(): Vector3 {
    return this.xyx;
  }
  get rgg(): Vector3 {
    return this.xyy;
  }
  get grr(): Vector3 {
    return this.yxx;
  }
  get grg(): Vector3 {
    return this.yxy;
  }
  get ggr(): Vector3 {
    return this.yyx;
  }
  get ggg(): Vector3 {
    return this.yyy;
  }
  get rrrr(): Vector4 {
    return this.xxxx;
  }
  get rrrg(): Vector4 {
    return this.xxxy;
  }
  get rrgr(): Vector4 {
    return this.xxyx;
  }
  get rrgg(): Vector4 {
    return this.xxyy;
  }
  get rgrr(): Vector4 {
    return this.xyxx;
  }
  get rgrg(): Vector4 {
    return this.xyxy;
  }
  get rggr(): Vector4 {
    return this.xyyx;
  }
  get rggg(): Vector4 {
    return this.xyyy;
  }
  get grrr(): Vector4 {
    return this.yxxx;
  }
  get grrg(): Vector4 {
    return this.yxxy;
  }
  get grgr(): Vector4 {
    return this.yxyx;
  }
  get grgg(): Vector4 {
    return this.yxyy;
  }
  get ggrr(): Vector4 {
    return this.yyxx;
  }
  get ggrg(): Vector4 {
    return this.yyxy;
  }
  get gggr(): Vector4 {
    return this.yyyx;
  }
  get gggg(): Vector4 {
    return this.yyyy;
  }
  get ss(): Vector2 {
    return this.xx;
  }
  get st(): Vector2 {
    return this.xy;
  }
  get ts(): Vector2 {
    return this.yx;
  }
  get tt(): Vector2 {
    return this.yy;
  }
  get sss(): Vector3 {
    return this.xxx;
  }
  get sst(): Vector3 {
    return this.xxy;
  }
  get sts(): Vector3 {
    return this.xyx;
  }
  get stt(): Vector3 {
    return this.xyy;
  }
  get tss(): Vector3 {
    return this.yxx;
  }
  get tst(): Vector3 {
    return this.yxy;
  }
  get tts(): Vector3 {
    return this.yyx;
  }
  get ttt(): Vector3 {
    return this.yyy;
  }
  get ssss(): Vector4 {
    return this.xxxx;
  }
  get ssst(): Vector4 {
    return this.xxxy;
  }
  get ssts(): Vector4 {
    return this.xxyx;
  }
  get sstt(): Vector4 {
    return this.xxyy;
  }
  get stss(): Vector4 {
    return this.xyxx;
  }
  get stst(): Vector4 {
    return this.xyxy;
  }
  get stts(): Vector4 {
    return this.xyyx;
  }
  get sttt(): Vector4 {
    return this.xyyy;
  }
  get tsss(): Vector4 {
    return this.yxxx;
  }
  get tsst(): Vector4 {
    return this.yxxy;
  }
  get tsts(): Vector4 {
    return this.yxyx;
  }
  get tstt(): Vector4 {
    return this.yxyy;
  }
  get ttss(): Vector4 {
    return this.yyxx;
  }
  get ttst(): Vector4 {
    return this.yyxy;
  }
  get ttts(): Vector4 {
    return this.yyyx;
  }
  get tttt(): Vector4 {
    return this.yyyy;
  }
}
