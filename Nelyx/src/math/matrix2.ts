// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/matrix2.dart.
import { Vector2 } from './vector2.ts';
import { invariant } from '../foundation/errors.ts';
import { hashDoubles } from '../ui/value-math.ts';
import {
  numericIndex,
  numericArrayRange,
  numericValues,
  numericStorage,
  matrixIndexedStorage,
  registerNumericObject,
  numericObjectStorage,
} from './numeric-helpers.ts';
export class Matrix2 {
  readonly #values: Float64Array;
  constructor(v0: number, v1: number, v2: number, v3: number);
  constructor(...components: unknown[]) {
    this.#values = numericValues(components as number[], 4);
    registerNumericObject(this, this.#values, 'Matrix2');
  }
  static zero(): Matrix2 {
    return new Matrix2(0, 0, 0, 0);
  }
  static fromList(values: readonly number[] | Float64Array): Matrix2 {
    values = numericArrayRange(values, 0, 4);
    return (() => {
      const cascade0 = Matrix2.zero();
      cascade0.setValues(values[0]!, values[1]!, values[2]!, values[3]!);
      return cascade0;
    })();
  }
  static identity(): Matrix2 {
    return (() => {
      const cascade1 = Matrix2.zero();
      numericObjectStorage(cascade1, 'Matrix2')[0]! = 1.0;
      numericObjectStorage(cascade1, 'Matrix2')[3]! = 1.0;
      return cascade1;
    })();
  }
  static copy(other: Matrix2): Matrix2 {
    return (() => {
      const cascade2 = Matrix2.zero();
      cascade2.setFrom(other);
      return cascade2;
    })();
  }
  static columns(arg0: Vector2, arg1: Vector2): Matrix2 {
    return (() => {
      const cascade3 = Matrix2.zero();
      cascade3.setColumns(arg0, arg1);
      return cascade3;
    })();
  }
  static outer(u: Vector2, v: Vector2): Matrix2 {
    return (() => {
      const cascade4 = Matrix2.zero();
      cascade4.setOuter(u, v);
      return cascade4;
    })();
  }
  static rotation(radians: number): Matrix2 {
    return (() => {
      const cascade5 = Matrix2.zero();
      cascade5.setRotation(radians);
      return cascade5;
    })();
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  static solve(A: Matrix2, x: Vector2, b: Vector2): void {
    const a11: number = A.entry(0, 0);
    const a12: number = A.entry(0, 1);
    const a21: number = A.entry(1, 0);
    const a22: number = A.entry(1, 1);
    const bx: number = b.x;
    const by: number = b.y;
    let det: number = a11 * a22 - a12 * a21;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    (() => {
      const cascade6 = x;
      cascade6.x = det * (a22 * bx - a12 * by);
      cascade6.y = det * (a11 * by - a21 * bx);
      return cascade6;
    })();
  }
  index(row: number, col: number): number {
    return col * 2 + row;
  }
  entry(row: number, col: number): number {
    numericIndex(row, 2);
    numericIndex(col, 2);
    invariant(
      row >= 0 && row < this.dimension,
      'invalid-numeric-argument',
      'Numeric precondition failed',
    );
    invariant(
      col >= 0 && col < this.dimension,
      'invalid-numeric-argument',
      'Numeric precondition failed',
    );
    return this.#values[this.index(row, col)]!;
  }
  setEntry(row: number, col: number, v: number): void {
    numericIndex(row, 2);
    numericIndex(col, 2);
    invariant(
      row >= 0 && row < this.dimension,
      'invalid-numeric-argument',
      'Numeric precondition failed',
    );
    invariant(
      col >= 0 && col < this.dimension,
      'invalid-numeric-argument',
      'Numeric precondition failed',
    );
    this.#values[this.index(row, col)]! = v;
  }
  setValues(arg0: number, arg1: number, arg2: number, arg3: number): void {
    this.#values[3]! = arg3;
    this.#values[2]! = arg2;
    this.#values[1]! = arg1;
    this.#values[0]! = arg0;
  }
  setColumns(arg0: Vector2, arg1: Vector2): void {
    const arg0Storage: Float64Array = numericObjectStorage(arg0, 'Vector2');
    const arg1Storage: Float64Array = numericObjectStorage(arg1, 'Vector2');
    this.#values[0]! = arg0Storage[0]!;
    this.#values[1]! = arg0Storage[1]!;
    this.#values[2]! = arg1Storage[0]!;
    this.#values[3]! = arg1Storage[1]!;
  }
  setFrom(arg: Matrix2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  setOuter(u: Vector2, v: Vector2): void {
    const uStorage: Float64Array = numericObjectStorage(u, 'Vector2');
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector2');
    this.#values[0]! = uStorage[0]! * vStorage[0]!;
    this.#values[1]! = uStorage[0]! * vStorage[1]!;
    this.#values[2]! = uStorage[1]! * vStorage[0]!;
    this.#values[3]! = uStorage[1]! * vStorage[1]!;
  }
  splatDiagonal(arg: number): void {
    this.#values[0]! = arg;
    this.#values[3]! = arg;
  }
  setDiagonal(arg: Vector2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    this.#values[0]! = argStorage[0]!;
    this.#values[3]! = argStorage[1]!;
  }
  toString(): string {
    return `[0] ${this.getRow(0)}
[1] ${this.getRow(1)}
`;
  }
  get dimension(): number {
    return 2;
  }
  at(i: number): number {
    numericIndex(i, this.#values.length);
    return this.#values[i]!;
  }
  setAt(i: number, v: number): void {
    numericIndex(i, this.#values.length);
    this.#values[i]! = v;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof Matrix2 &&
      this.#values[0]! === numericObjectStorage(other, 'Matrix2')[0]! &&
      this.#values[1]! === numericObjectStorage(other, 'Matrix2')[1]! &&
      this.#values[2]! === numericObjectStorage(other, 'Matrix2')[2]! &&
      this.#values[3]! === numericObjectStorage(other, 'Matrix2')[3]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 4));
  }
  get row0(): Vector2 {
    return this.getRow(0);
  }
  get row1(): Vector2 {
    return this.getRow(1);
  }
  set row0(arg: Vector2) {
    this.setRow(0, arg);
  }
  set row1(arg: Vector2) {
    this.setRow(1, arg);
  }
  setRow(row: number, arg: Vector2): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 2);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    checkedRowStorage[this.index(row, 0)]! = argStorage[0]!;
    checkedRowStorage[this.index(row, 1)]! = argStorage[1]!;
  }
  getRow(row: number): Vector2 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 2);
    const r = Vector2.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector2');
    rStorage[0]! = checkedRowStorage[this.index(row, 0)]!;
    rStorage[1]! = checkedRowStorage[this.index(row, 1)]!;
    return r;
  }
  setColumn(column: number, arg: Vector2): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 2);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    const entry: number = column * 2;
    checkedRowStorage[entry + 1]! = argStorage[1]!;
    checkedRowStorage[entry + 0]! = argStorage[0]!;
  }
  getColumn(column: number): Vector2 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 2);
    const r = Vector2.zero();
    const entry: number = column * 2;
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector2');
    rStorage[1]! = checkedRowStorage[entry + 1]!;
    rStorage[0]! = checkedRowStorage[entry + 0]!;
    return r;
  }
  clone(): Matrix2 {
    return Matrix2.copy(this);
  }
  copyInto(arg: Matrix2): Matrix2 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    argStorage[0]! = this.#values[0]!;
    argStorage[1]! = this.#values[1]!;
    argStorage[2]! = this.#values[2]!;
    argStorage[3]! = this.#values[3]!;
    return arg;
  }
  times(arg: number): Matrix2;
  times(arg: Matrix2): Matrix2;
  times(arg: Vector2): Vector2;
  times(arg: unknown): unknown {
    let result: unknown;
    if (typeof arg === 'number') {
      result = this.scaled(arg);
    } else if (arg instanceof Vector2) {
      result = this.transformed(arg);
    } else if (arg instanceof Matrix2) {
      result = this.multiplied(arg);
    } else {
      throw new Error('Invalid numeric argument');
    }
    return result;
  }
  plus(arg: Matrix2): Matrix2 {
    return (() => {
      const cascade7 = this.clone();
      cascade7.add(arg);
      return cascade7;
    })();
  }
  minus(arg: Matrix2): Matrix2 {
    return (() => {
      const cascade8 = this.clone();
      cascade8.sub(arg);
      return cascade8;
    })();
  }
  unaryMinus(): Matrix2 {
    return (() => {
      const cascade9 = this.clone();
      cascade9.negate();
      return cascade9;
    })();
  }
  setZero(): void {
    this.#values[0]! = 0.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 0.0;
  }
  setIdentity(): void {
    this.#values[0]! = 1.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 1.0;
  }
  transposed(): Matrix2 {
    return (() => {
      const cascade10 = this.clone();
      cascade10.transpose();
      return cascade10;
    })();
  }
  transpose(): void {
    const temp: number = this.#values[2]!;
    this.#values[2]! = this.#values[1]!;
    this.#values[1]! = temp;
  }
  absolute(): Matrix2 {
    const r = Matrix2.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Matrix2');
    rStorage[0]! = Math.abs(this.#values[0]!);
    rStorage[1]! = Math.abs(this.#values[1]!);
    rStorage[2]! = Math.abs(this.#values[2]!);
    rStorage[3]! = Math.abs(this.#values[3]!);
    return r;
  }
  determinant(): number {
    return this.#values[0]! * this.#values[3]! - this.#values[1]! * this.#values[2]!;
  }
  dotRow(i: number, v: Vector2): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, i, 2);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector2');
    return checkedRowStorage[i]! * vStorage[0]! + checkedRowStorage[2 + i]! * vStorage[1]!;
  }
  dotColumn(j: number, v: Vector2): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, j, 2);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector2');
    return checkedRowStorage[j * 2]! * vStorage[0]! + checkedRowStorage[j * 2 + 1]! * vStorage[1]!;
  }
  trace(): number {
    let t = 0.0;
    t += this.#values[0]!;
    t += this.#values[3]!;
    return t;
  }
  infinityNorm(): number {
    let norm = 0.0;
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[0]!);
      rowNorm += Math.abs(this.#values[1]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[2]!);
      rowNorm += Math.abs(this.#values[3]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    return norm;
  }
  relativeError(correct: Matrix2): number {
    const diff: Matrix2 = correct.minus(this);
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = diff.infinityNorm();
    return diffNorm / correctNorm;
  }
  absoluteError(correct: Matrix2): number {
    const thisNorm: number = this.infinityNorm();
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = Math.abs(thisNorm - correctNorm);
    return diffNorm;
  }
  invert(): number {
    const det: number = this.determinant();
    if (det === 0.0) {
      return 0.0;
    }
    const invDet: number = 1.0 / det;
    const temp: number = this.#values[0]!;
    this.#values[0]! = this.#values[3]! * invDet;
    this.#values[1]! = -this.#values[1]! * invDet;
    this.#values[2]! = -this.#values[2]! * invDet;
    this.#values[3]! = temp * invDet;
    return det;
  }
  copyInverse(arg: Matrix2): number {
    const det: number = arg.determinant();
    if (det === 0.0) {
      this.setFrom(arg);
      return 0.0;
    }
    const invDet: number = 1.0 / det;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[0]! = argStorage[3]! * invDet;
    this.#values[1]! = -argStorage[1]! * invDet;
    this.#values[2]! = -argStorage[2]! * invDet;
    this.#values[3]! = argStorage[0]! * invDet;
    return det;
  }
  setRotation(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = c;
    this.#values[1]! = s;
    this.#values[2]! = -s;
    this.#values[3]! = c;
  }
  scaleAdjoint(scale: number): void {
    const temp: number = this.#values[0]!;
    this.#values[0]! = this.#values[3]! * scale;
    this.#values[2]! = -this.#values[2]! * scale;
    this.#values[1]! = -this.#values[1]! * scale;
    this.#values[3]! = temp * scale;
  }
  scale(scale: number): void {
    this.#values[0]! = this.#values[0]! * scale;
    this.#values[1]! = this.#values[1]! * scale;
    this.#values[2]! = this.#values[2]! * scale;
    this.#values[3]! = this.#values[3]! * scale;
  }
  scaled(scale: number): Matrix2 {
    return (() => {
      const cascade11 = this.clone();
      cascade11.scale(scale);
      return cascade11;
    })();
  }
  add(o: Matrix2): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix2');
    this.#values[0]! = this.#values[0]! + oStorage[0]!;
    this.#values[1]! = this.#values[1]! + oStorage[1]!;
    this.#values[2]! = this.#values[2]! + oStorage[2]!;
    this.#values[3]! = this.#values[3]! + oStorage[3]!;
  }
  sub(o: Matrix2): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix2');
    this.#values[0]! = this.#values[0]! - oStorage[0]!;
    this.#values[1]! = this.#values[1]! - oStorage[1]!;
    this.#values[2]! = this.#values[2]! - oStorage[2]!;
    this.#values[3]! = this.#values[3]! - oStorage[3]!;
  }
  negate(): void {
    this.#values[0]! = -this.#values[0]!;
    this.#values[1]! = -this.#values[1]!;
    this.#values[2]! = -this.#values[2]!;
    this.#values[3]! = -this.#values[3]!;
  }
  multiply(arg: Matrix2): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[2]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[3]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    const n00: number = argStorage[0]!;
    const n01: number = argStorage[2]!;
    const n10: number = argStorage[1]!;
    const n11: number = argStorage[3]!;
    this.#values[0]! = m00 * n00 + m01 * n10;
    this.#values[2]! = m00 * n01 + m01 * n11;
    this.#values[1]! = m10 * n00 + m11 * n10;
    this.#values[3]! = m10 * n01 + m11 * n11;
  }
  multiplied(arg: Matrix2): Matrix2 {
    return (() => {
      const cascade12 = this.clone();
      cascade12.multiply(arg);
      return cascade12;
    })();
  }
  transposeMultiply(arg: Matrix2): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[1]!;
    const m10: number = this.#values[2]!;
    const m11: number = this.#values[3]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[0]! = m00 * argStorage[0]! + m01 * argStorage[1]!;
    this.#values[2]! = m00 * argStorage[2]! + m01 * argStorage[3]!;
    this.#values[1]! = m10 * argStorage[0]! + m11 * argStorage[1]!;
    this.#values[3]! = m10 * argStorage[2]! + m11 * argStorage[3]!;
  }
  multiplyTranspose(arg: Matrix2): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[2]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[3]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[0]! = m00 * argStorage[0]! + m01 * argStorage[2]!;
    this.#values[2]! = m00 * argStorage[1]! + m01 * argStorage[3]!;
    this.#values[1]! = m10 * argStorage[0]! + m11 * argStorage[2]!;
    this.#values[3]! = m10 * argStorage[1]! + m11 * argStorage[3]!;
  }
  transform(arg: Vector2): Vector2 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    const x: number = this.#values[0]! * argStorage[0]! + this.#values[2]! * argStorage[1]!;
    const y: number = this.#values[1]! * argStorage[0]! + this.#values[3]! * argStorage[1]!;
    argStorage[0]! = x;
    argStorage[1]! = y;
    return arg;
  }
  transformed(arg: Vector2, out: Vector2 | null = null): Vector2 {
    if (out === null) {
      out = Vector2.copy(arg);
    } else {
      out.setFrom(arg);
    }
    return this.transform(out);
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 4);
    const i = offset;
    array[i + 3]! = this.#values[3]!;
    array[i + 2]! = this.#values[2]!;
    array[i + 1]! = this.#values[1]!;
    array[i + 0]! = this.#values[0]!;
  }
  copyFromArray(array: readonly number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 4);
    const i = offset;
    this.#values[3]! = array[i + 3]!;
    this.#values[2]! = array[i + 2]!;
    this.#values[1]! = array[i + 1]!;
    this.#values[0]! = array[i + 0]!;
  }
}
