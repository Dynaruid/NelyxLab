// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/matrix3.dart.
import { Vector2 } from './vector2.ts';
import { Vector3 } from './vector3.ts';
import { Matrix2 } from './matrix2.ts';
import { Matrix4 } from './matrix4.ts';
import { invariant } from '../foundation/errors.ts';
import { hashDoubles } from '../ui/value-math.ts';
import {
  numericIndex,
  numericArrayRange,
  numericValues,
  numericStorage,
  checkedNumericStorage,
  matrixIndexedStorage,
  registerNumericObject,
  numericObjectStorage,
} from './numeric-helpers.ts';
export class Matrix3 {
  readonly #values: Float64Array;
  constructor(
    v0: number,
    v1: number,
    v2: number,
    v3: number,
    v4: number,
    v5: number,
    v6: number,
    v7: number,
    v8: number,
  );
  constructor(...components: unknown[]) {
    this.#values = numericValues(components as number[], 9);
    registerNumericObject(this, this.#values, 'Matrix3');
  }
  static zero(): Matrix3 {
    return new Matrix3(0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
  static fromList(values: readonly number[] | Float64Array): Matrix3 {
    values = numericArrayRange(values, 0, 9);
    return (() => {
      const cascade0 = Matrix3.zero();
      cascade0.setValues(
        values[0]!,
        values[1]!,
        values[2]!,
        values[3]!,
        values[4]!,
        values[5]!,
        values[6]!,
        values[7]!,
        values[8]!,
      );
      return cascade0;
    })();
  }
  static identity(): Matrix3 {
    return (() => {
      const cascade1 = Matrix3.zero();
      numericObjectStorage(cascade1, 'Matrix3')[0]! = 1.0;
      numericObjectStorage(cascade1, 'Matrix3')[4]! = 1.0;
      numericObjectStorage(cascade1, 'Matrix3')[8]! = 1.0;
      return cascade1;
    })();
  }
  static copy(other: Matrix3): Matrix3 {
    return (() => {
      const cascade2 = Matrix3.zero();
      cascade2.setFrom(other);
      return cascade2;
    })();
  }
  static columns(arg0: Vector3, arg1: Vector3, arg2: Vector3): Matrix3 {
    return (() => {
      const cascade3 = Matrix3.zero();
      cascade3.setColumns(arg0, arg1, arg2);
      return cascade3;
    })();
  }
  static outer(u: Vector3, v: Vector3): Matrix3 {
    return (() => {
      const cascade4 = Matrix3.zero();
      cascade4.setOuter(u, v);
      return cascade4;
    })();
  }
  static rotationX(radians: number): Matrix3 {
    return (() => {
      const cascade5 = Matrix3.zero();
      cascade5.setRotationX(radians);
      return cascade5;
    })();
  }
  static rotationY(radians: number): Matrix3 {
    return (() => {
      const cascade6 = Matrix3.zero();
      cascade6.setRotationY(radians);
      return cascade6;
    })();
  }
  static rotationZ(radians: number): Matrix3 {
    return (() => {
      const cascade7 = Matrix3.zero();
      cascade7.setRotationZ(radians);
      return cascade7;
    })();
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  static solve2(A: Matrix3, x: Vector2, b: Vector2): void {
    const a11: number = A.entry(0, 0);
    const a12: number = A.entry(0, 1);
    const a21: number = A.entry(1, 0);
    const a22: number = A.entry(1, 1);
    const bx: number = b.x - checkedNumericStorage(A.storage, 9)[6]!;
    const by: number = b.y - checkedNumericStorage(A.storage, 9)[7]!;
    let det: number = a11 * a22 - a12 * a21;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    (() => {
      const cascade8 = x;
      cascade8.x = det * (a22 * bx - a12 * by);
      cascade8.y = det * (a11 * by - a21 * bx);
      return cascade8;
    })();
  }
  static solve(A: Matrix3, x: Vector3, b: Vector3): void {
    const a0x: number = A.entry(0, 0);
    const a0y: number = A.entry(1, 0);
    const a0z: number = A.entry(2, 0);
    const a1x: number = A.entry(0, 1);
    const a1y: number = A.entry(1, 1);
    const a1z: number = A.entry(2, 1);
    const a2x: number = A.entry(0, 2);
    const a2y: number = A.entry(1, 2);
    const a2z: number = A.entry(2, 2);
    let rx: number, ry: number, rz: number;
    let det: number;
    rx = a1y * a2z - a1z * a2y;
    ry = a1z * a2x - a1x * a2z;
    rz = a1x * a2y - a1y * a2x;
    det = a0x * rx + a0y * ry + a0z * rz;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    const x_: number = det * (b.x * rx + b.y * ry + b.z * rz);
    rx = -(a2y * b.z - a2z * b.y);
    ry = -(a2z * b.x - a2x * b.z);
    rz = -(a2x * b.y - a2y * b.x);
    const y_: number = det * (a0x * rx + a0y * ry + a0z * rz);
    rx = -(b.y * a1z - b.z * a1y);
    ry = -(b.z * a1x - b.x * a1z);
    rz = -(b.x * a1y - b.y * a1x);
    const z_: number = det * (a0x * rx + a0y * ry + a0z * rz);
    (() => {
      const cascade9 = x;
      cascade9.x = x_;
      cascade9.y = y_;
      cascade9.z = z_;
      return cascade9;
    })();
  }
  index(row: number, col: number): number {
    return col * 3 + row;
  }
  entry(row: number, col: number): number {
    numericIndex(row, 3);
    numericIndex(col, 3);
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
    numericIndex(row, 3);
    numericIndex(col, 3);
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
  setValues(
    arg0: number,
    arg1: number,
    arg2: number,
    arg3: number,
    arg4: number,
    arg5: number,
    arg6: number,
    arg7: number,
    arg8: number,
  ): void {
    this.#values[8]! = arg8;
    this.#values[7]! = arg7;
    this.#values[6]! = arg6;
    this.#values[5]! = arg5;
    this.#values[4]! = arg4;
    this.#values[3]! = arg3;
    this.#values[2]! = arg2;
    this.#values[1]! = arg1;
    this.#values[0]! = arg0;
  }
  setColumns(arg0: Vector3, arg1: Vector3, arg2: Vector3): void {
    const arg0Storage: Float64Array = numericObjectStorage(arg0, 'Vector3');
    const arg1Storage: Float64Array = numericObjectStorage(arg1, 'Vector3');
    const arg2Storage: Float64Array = numericObjectStorage(arg2, 'Vector3');
    this.#values[0]! = arg0Storage[0]!;
    this.#values[1]! = arg0Storage[1]!;
    this.#values[2]! = arg0Storage[2]!;
    this.#values[3]! = arg1Storage[0]!;
    this.#values[4]! = arg1Storage[1]!;
    this.#values[5]! = arg1Storage[2]!;
    this.#values[6]! = arg2Storage[0]!;
    this.#values[7]! = arg2Storage[1]!;
    this.#values[8]! = arg2Storage[2]!;
  }
  setFrom(arg: Matrix3): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    this.#values[8]! = argStorage[8]!;
    this.#values[7]! = argStorage[7]!;
    this.#values[6]! = argStorage[6]!;
    this.#values[5]! = argStorage[5]!;
    this.#values[4]! = argStorage[4]!;
    this.#values[3]! = argStorage[3]!;
    this.#values[2]! = argStorage[2]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[0]! = argStorage[0]!;
  }
  setOuter(u: Vector3, v: Vector3): void {
    const uStorage: Float64Array = numericObjectStorage(u, 'Vector3');
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector3');
    this.#values[0]! = uStorage[0]! * vStorage[0]!;
    this.#values[1]! = uStorage[0]! * vStorage[1]!;
    this.#values[2]! = uStorage[0]! * vStorage[2]!;
    this.#values[3]! = uStorage[1]! * vStorage[0]!;
    this.#values[4]! = uStorage[1]! * vStorage[1]!;
    this.#values[5]! = uStorage[1]! * vStorage[2]!;
    this.#values[6]! = uStorage[2]! * vStorage[0]!;
    this.#values[7]! = uStorage[2]! * vStorage[1]!;
    this.#values[8]! = uStorage[2]! * vStorage[2]!;
  }
  splatDiagonal(arg: number): void {
    this.#values[0]! = arg;
    this.#values[4]! = arg;
    this.#values[8]! = arg;
  }
  setDiagonal(arg: Vector3): void {
    this.#values[0]! = checkedNumericStorage(arg.storage, 3)[0]!;
    this.#values[4]! = checkedNumericStorage(arg.storage, 3)[1]!;
    this.#values[8]! = checkedNumericStorage(arg.storage, 3)[2]!;
  }
  setUpper2x2(arg: Matrix2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[0]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[3]! = argStorage[2]!;
    this.#values[4]! = argStorage[3]!;
  }
  toString(): string {
    return `[0] ${this.getRow(0)}
[1] ${this.getRow(1)}
[2] ${this.getRow(2)}
`;
  }
  get dimension(): number {
    return 3;
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
      other instanceof Matrix3 &&
      this.#values[0]! === numericObjectStorage(other, 'Matrix3')[0]! &&
      this.#values[1]! === numericObjectStorage(other, 'Matrix3')[1]! &&
      this.#values[2]! === numericObjectStorage(other, 'Matrix3')[2]! &&
      this.#values[3]! === numericObjectStorage(other, 'Matrix3')[3]! &&
      this.#values[4]! === numericObjectStorage(other, 'Matrix3')[4]! &&
      this.#values[5]! === numericObjectStorage(other, 'Matrix3')[5]! &&
      this.#values[6]! === numericObjectStorage(other, 'Matrix3')[6]! &&
      this.#values[7]! === numericObjectStorage(other, 'Matrix3')[7]! &&
      this.#values[8]! === numericObjectStorage(other, 'Matrix3')[8]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 9));
  }
  get row0(): Vector3 {
    return this.getRow(0);
  }
  get row1(): Vector3 {
    return this.getRow(1);
  }
  get row2(): Vector3 {
    return this.getRow(2);
  }
  set row0(arg: Vector3) {
    this.setRow(0, arg);
  }
  set row1(arg: Vector3) {
    this.setRow(1, arg);
  }
  set row2(arg: Vector3) {
    this.setRow(2, arg);
  }
  setRow(row: number, arg: Vector3): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 3);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    checkedRowStorage[this.index(row, 0)]! = argStorage[0]!;
    checkedRowStorage[this.index(row, 1)]! = argStorage[1]!;
    checkedRowStorage[this.index(row, 2)]! = argStorage[2]!;
  }
  getRow(row: number): Vector3 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 3);
    const r = Vector3.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector3');
    rStorage[0]! = checkedRowStorage[this.index(row, 0)]!;
    rStorage[1]! = checkedRowStorage[this.index(row, 1)]!;
    rStorage[2]! = checkedRowStorage[this.index(row, 2)]!;
    return r;
  }
  setColumn(column: number, arg: Vector3): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 3);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const entry: number = column * 3;
    checkedRowStorage[entry + 2]! = argStorage[2]!;
    checkedRowStorage[entry + 1]! = argStorage[1]!;
    checkedRowStorage[entry + 0]! = argStorage[0]!;
  }
  getColumn(column: number): Vector3 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 3);
    const r = Vector3.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector3');
    const entry: number = column * 3;
    rStorage[2]! = checkedRowStorage[entry + 2]!;
    rStorage[1]! = checkedRowStorage[entry + 1]!;
    rStorage[0]! = checkedRowStorage[entry + 0]!;
    return r;
  }
  clone(): Matrix3 {
    return Matrix3.copy(this);
  }
  copyInto(arg: Matrix3): Matrix3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    argStorage[0]! = this.#values[0]!;
    argStorage[1]! = this.#values[1]!;
    argStorage[2]! = this.#values[2]!;
    argStorage[3]! = this.#values[3]!;
    argStorage[4]! = this.#values[4]!;
    argStorage[5]! = this.#values[5]!;
    argStorage[6]! = this.#values[6]!;
    argStorage[7]! = this.#values[7]!;
    argStorage[8]! = this.#values[8]!;
    return arg;
  }
  times(arg: number): Matrix3;
  times(arg: Matrix3): Matrix3;
  times(arg: Vector3): Vector3;
  times(arg: unknown): unknown {
    let result: unknown;
    if (typeof arg === 'number') {
      result = this.scaled(arg);
    } else if (arg instanceof Vector3) {
      result = this.transformed(arg);
    } else if (arg instanceof Matrix3) {
      result = this.multiplied(arg);
    } else {
      throw new Error('Invalid numeric argument');
    }
    return result;
  }
  plus(arg: Matrix3): Matrix3 {
    return (() => {
      const cascade10 = this.clone();
      cascade10.add(arg);
      return cascade10;
    })();
  }
  minus(arg: Matrix3): Matrix3 {
    return (() => {
      const cascade11 = this.clone();
      cascade11.sub(arg);
      return cascade11;
    })();
  }
  unaryMinus(): Matrix3 {
    return (() => {
      const cascade12 = this.clone();
      cascade12.negate();
      return cascade12;
    })();
  }
  setZero(): void {
    this.#values[0]! = 0.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 0.0;
    this.#values[4]! = 0.0;
    this.#values[5]! = 0.0;
    this.#values[6]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[8]! = 0.0;
  }
  setIdentity(): void {
    this.#values[0]! = 1.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 0.0;
    this.#values[4]! = 1.0;
    this.#values[5]! = 0.0;
    this.#values[6]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[8]! = 1.0;
  }
  transposed(): Matrix3 {
    return (() => {
      const cascade13 = this.clone();
      cascade13.transpose();
      return cascade13;
    })();
  }
  transpose(): void {
    let temp: number;
    temp = this.#values[3]!;
    this.#values[3]! = this.#values[1]!;
    this.#values[1]! = temp;
    temp = this.#values[6]!;
    this.#values[6]! = this.#values[2]!;
    this.#values[2]! = temp;
    temp = this.#values[7]!;
    this.#values[7]! = this.#values[5]!;
    this.#values[5]! = temp;
  }
  absolute(): Matrix3 {
    const r = Matrix3.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Matrix3');
    rStorage[0]! = Math.abs(this.#values[0]!);
    rStorage[1]! = Math.abs(this.#values[1]!);
    rStorage[2]! = Math.abs(this.#values[2]!);
    rStorage[3]! = Math.abs(this.#values[3]!);
    rStorage[4]! = Math.abs(this.#values[4]!);
    rStorage[5]! = Math.abs(this.#values[5]!);
    rStorage[6]! = Math.abs(this.#values[6]!);
    rStorage[7]! = Math.abs(this.#values[7]!);
    rStorage[8]! = Math.abs(this.#values[8]!);
    return r;
  }
  determinant(): number {
    const x: number =
      this.#values[0]! *
      (this.#values[4]! * this.#values[8]! - this.#values[5]! * this.#values[7]!);
    const y: number =
      this.#values[1]! *
      (this.#values[3]! * this.#values[8]! - this.#values[5]! * this.#values[6]!);
    const z: number =
      this.#values[2]! *
      (this.#values[3]! * this.#values[7]! - this.#values[4]! * this.#values[6]!);
    return x - y + z;
  }
  dotRow(i: number, v: Vector3): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, i, 3);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector3');
    return (
      checkedRowStorage[i]! * vStorage[0]! +
      checkedRowStorage[3 + i]! * vStorage[1]! +
      checkedRowStorage[6 + i]! * vStorage[2]!
    );
  }
  dotColumn(j: number, v: Vector3): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, j, 3);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector3');
    return (
      checkedRowStorage[j * 3]! * vStorage[0]! +
      checkedRowStorage[j * 3 + 1]! * vStorage[1]! +
      checkedRowStorage[j * 3 + 2]! * vStorage[2]!
    );
  }
  trace(): number {
    let t = 0.0;
    t += this.#values[0]!;
    t += this.#values[4]!;
    t += this.#values[8]!;
    return t;
  }
  infinityNorm(): number {
    let norm = 0.0;
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[0]!);
      rowNorm += Math.abs(this.#values[1]!);
      rowNorm += Math.abs(this.#values[2]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[3]!);
      rowNorm += Math.abs(this.#values[4]!);
      rowNorm += Math.abs(this.#values[5]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[6]!);
      rowNorm += Math.abs(this.#values[7]!);
      rowNorm += Math.abs(this.#values[8]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    return norm;
  }
  relativeError(correct: Matrix3): number {
    const diff: Matrix3 = correct.minus(this);
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = diff.infinityNorm();
    return diffNorm / correctNorm;
  }
  absoluteError(correct: Matrix3): number {
    const thisNorm: number = this.infinityNorm();
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = Math.abs(thisNorm - correctNorm);
    return diffNorm;
  }
  invert(): number {
    return this.copyInverse(this);
  }
  copyInverse(arg: Matrix3): number {
    const det: number = arg.determinant();
    if (det === 0.0) {
      this.setFrom(arg);
      return 0.0;
    }
    const invDet: number = 1.0 / det;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    const ix: number = invDet * (argStorage[4]! * argStorage[8]! - argStorage[5]! * argStorage[7]!);
    const iy: number = invDet * (argStorage[2]! * argStorage[7]! - argStorage[1]! * argStorage[8]!);
    const iz: number = invDet * (argStorage[1]! * argStorage[5]! - argStorage[2]! * argStorage[4]!);
    const jx: number = invDet * (argStorage[5]! * argStorage[6]! - argStorage[3]! * argStorage[8]!);
    const jy: number = invDet * (argStorage[0]! * argStorage[8]! - argStorage[2]! * argStorage[6]!);
    const jz: number = invDet * (argStorage[2]! * argStorage[3]! - argStorage[0]! * argStorage[5]!);
    const kx: number = invDet * (argStorage[3]! * argStorage[7]! - argStorage[4]! * argStorage[6]!);
    const ky: number = invDet * (argStorage[1]! * argStorage[6]! - argStorage[0]! * argStorage[7]!);
    const kz: number = invDet * (argStorage[0]! * argStorage[4]! - argStorage[1]! * argStorage[3]!);
    this.#values[0]! = ix;
    this.#values[1]! = iy;
    this.#values[2]! = iz;
    this.#values[3]! = jx;
    this.#values[4]! = jy;
    this.#values[5]! = jz;
    this.#values[6]! = kx;
    this.#values[7]! = ky;
    this.#values[8]! = kz;
    return det;
  }
  copyNormalMatrix(arg: Matrix4): void {
    this.copyInverse(arg.getRotation());
    this.transpose();
  }
  setRotationX(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = 1.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 0.0;
    this.#values[4]! = c;
    this.#values[5]! = s;
    this.#values[6]! = 0.0;
    this.#values[7]! = -s;
    this.#values[8]! = c;
  }
  setRotationY(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = c;
    this.#values[1]! = 0.0;
    this.#values[2]! = -s;
    this.#values[3]! = 0.0;
    this.#values[4]! = 1.0;
    this.#values[5]! = 0.0;
    this.#values[6]! = s;
    this.#values[7]! = 0.0;
    this.#values[8]! = c;
  }
  setRotationZ(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = c;
    this.#values[1]! = s;
    this.#values[2]! = 0.0;
    this.#values[3]! = -s;
    this.#values[4]! = c;
    this.#values[5]! = 0.0;
    this.#values[6]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[8]! = 1.0;
  }
  scaleAdjoint(scale: number): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[3]!;
    const m02: number = this.#values[6]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[4]!;
    const m12: number = this.#values[7]!;
    const m20: number = this.#values[2]!;
    const m21: number = this.#values[5]!;
    const m22: number = this.#values[8]!;
    this.#values[0]! = (m11 * m22 - m12 * m21) * scale;
    this.#values[1]! = (m12 * m20 - m10 * m22) * scale;
    this.#values[2]! = (m10 * m21 - m11 * m20) * scale;
    this.#values[3]! = (m02 * m21 - m01 * m22) * scale;
    this.#values[4]! = (m00 * m22 - m02 * m20) * scale;
    this.#values[5]! = (m01 * m20 - m00 * m21) * scale;
    this.#values[6]! = (m01 * m12 - m02 * m11) * scale;
    this.#values[7]! = (m02 * m10 - m00 * m12) * scale;
    this.#values[8]! = (m00 * m11 - m01 * m10) * scale;
  }
  absoluteRotate(arg: Vector3): Vector3 {
    const m00: number = Math.abs(this.#values[0]!);
    const m01: number = Math.abs(this.#values[3]!);
    const m02: number = Math.abs(this.#values[6]!);
    const m10: number = Math.abs(this.#values[1]!);
    const m11: number = Math.abs(this.#values[4]!);
    const m12: number = Math.abs(this.#values[7]!);
    const m20: number = Math.abs(this.#values[2]!);
    const m21: number = Math.abs(this.#values[5]!);
    const m22: number = Math.abs(this.#values[8]!);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x: number = argStorage[0]!;
    const y: number = argStorage[1]!;
    const z: number = argStorage[2]!;
    argStorage[0]! = x * m00 + y * m01 + z * m02;
    argStorage[1]! = x * m10 + y * m11 + z * m12;
    argStorage[2]! = x * m20 + y * m21 + z * m22;
    return arg;
  }
  absoluteRotate2(arg: Vector2): Vector2 {
    const m00: number = Math.abs(this.#values[0]!);
    const m01: number = Math.abs(this.#values[3]!);
    const m10: number = Math.abs(this.#values[1]!);
    const m11: number = Math.abs(this.#values[4]!);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    const x: number = argStorage[0]!;
    const y: number = argStorage[1]!;
    argStorage[0]! = x * m00 + y * m01;
    argStorage[1]! = x * m10 + y * m11;
    return arg;
  }
  transform2(arg: Vector2): Vector2 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector2');
    const x_: number =
      this.#values[0]! * argStorage[0]! + this.#values[3]! * argStorage[1]! + this.#values[6]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! + this.#values[4]! * argStorage[1]! + this.#values[7]!;
    argStorage[0]! = x_;
    argStorage[1]! = y_;
    return arg;
  }
  scale(scale: number): void {
    this.#values[0]! = this.#values[0]! * scale;
    this.#values[1]! = this.#values[1]! * scale;
    this.#values[2]! = this.#values[2]! * scale;
    this.#values[3]! = this.#values[3]! * scale;
    this.#values[4]! = this.#values[4]! * scale;
    this.#values[5]! = this.#values[5]! * scale;
    this.#values[6]! = this.#values[6]! * scale;
    this.#values[7]! = this.#values[7]! * scale;
    this.#values[8]! = this.#values[8]! * scale;
  }
  scaled(scale: number): Matrix3 {
    return (() => {
      const cascade14 = this.clone();
      cascade14.scale(scale);
      return cascade14;
    })();
  }
  add(o: Matrix3): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix3');
    this.#values[0]! = this.#values[0]! + oStorage[0]!;
    this.#values[1]! = this.#values[1]! + oStorage[1]!;
    this.#values[2]! = this.#values[2]! + oStorage[2]!;
    this.#values[3]! = this.#values[3]! + oStorage[3]!;
    this.#values[4]! = this.#values[4]! + oStorage[4]!;
    this.#values[5]! = this.#values[5]! + oStorage[5]!;
    this.#values[6]! = this.#values[6]! + oStorage[6]!;
    this.#values[7]! = this.#values[7]! + oStorage[7]!;
    this.#values[8]! = this.#values[8]! + oStorage[8]!;
  }
  sub(o: Matrix3): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix3');
    this.#values[0]! = this.#values[0]! - oStorage[0]!;
    this.#values[1]! = this.#values[1]! - oStorage[1]!;
    this.#values[2]! = this.#values[2]! - oStorage[2]!;
    this.#values[3]! = this.#values[3]! - oStorage[3]!;
    this.#values[4]! = this.#values[4]! - oStorage[4]!;
    this.#values[5]! = this.#values[5]! - oStorage[5]!;
    this.#values[6]! = this.#values[6]! - oStorage[6]!;
    this.#values[7]! = this.#values[7]! - oStorage[7]!;
    this.#values[8]! = this.#values[8]! - oStorage[8]!;
  }
  negate(): void {
    this.#values[0]! = -this.#values[0]!;
    this.#values[1]! = -this.#values[1]!;
    this.#values[2]! = -this.#values[2]!;
    this.#values[3]! = -this.#values[3]!;
    this.#values[4]! = -this.#values[4]!;
    this.#values[5]! = -this.#values[5]!;
    this.#values[6]! = -this.#values[6]!;
    this.#values[7]! = -this.#values[7]!;
    this.#values[8]! = -this.#values[8]!;
  }
  multiply(arg: Matrix3): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[3]!;
    const m02: number = this.#values[6]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[4]!;
    const m12: number = this.#values[7]!;
    const m20: number = this.#values[2]!;
    const m21: number = this.#values[5]!;
    const m22: number = this.#values[8]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    const n00: number = argStorage[0]!;
    const n01: number = argStorage[3]!;
    const n02: number = argStorage[6]!;
    const n10: number = argStorage[1]!;
    const n11: number = argStorage[4]!;
    const n12: number = argStorage[7]!;
    const n20: number = argStorage[2]!;
    const n21: number = argStorage[5]!;
    const n22: number = argStorage[8]!;
    this.#values[0]! = m00 * n00 + m01 * n10 + m02 * n20;
    this.#values[3]! = m00 * n01 + m01 * n11 + m02 * n21;
    this.#values[6]! = m00 * n02 + m01 * n12 + m02 * n22;
    this.#values[1]! = m10 * n00 + m11 * n10 + m12 * n20;
    this.#values[4]! = m10 * n01 + m11 * n11 + m12 * n21;
    this.#values[7]! = m10 * n02 + m11 * n12 + m12 * n22;
    this.#values[2]! = m20 * n00 + m21 * n10 + m22 * n20;
    this.#values[5]! = m20 * n01 + m21 * n11 + m22 * n21;
    this.#values[8]! = m20 * n02 + m21 * n12 + m22 * n22;
  }
  multiplied(arg: Matrix3): Matrix3 {
    return (() => {
      const cascade15 = this.clone();
      cascade15.multiply(arg);
      return cascade15;
    })();
  }
  transposeMultiply(arg: Matrix3): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[1]!;
    const m02: number = this.#values[2]!;
    const m10: number = this.#values[3]!;
    const m11: number = this.#values[4]!;
    const m12: number = this.#values[5]!;
    const m20: number = this.#values[6]!;
    const m21: number = this.#values[7]!;
    const m22: number = this.#values[8]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    this.#values[0]! = m00 * argStorage[0]! + m01 * argStorage[1]! + m02 * argStorage[2]!;
    this.#values[3]! = m00 * argStorage[3]! + m01 * argStorage[4]! + m02 * argStorage[5]!;
    this.#values[6]! = m00 * argStorage[6]! + m01 * argStorage[7]! + m02 * argStorage[8]!;
    this.#values[1]! = m10 * argStorage[0]! + m11 * argStorage[1]! + m12 * argStorage[2]!;
    this.#values[4]! = m10 * argStorage[3]! + m11 * argStorage[4]! + m12 * argStorage[5]!;
    this.#values[7]! = m10 * argStorage[6]! + m11 * argStorage[7]! + m12 * argStorage[8]!;
    this.#values[2]! = m20 * argStorage[0]! + m21 * argStorage[1]! + m22 * argStorage[2]!;
    this.#values[5]! = m20 * argStorage[3]! + m21 * argStorage[4]! + m22 * argStorage[5]!;
    this.#values[8]! = m20 * argStorage[6]! + m21 * argStorage[7]! + m22 * argStorage[8]!;
  }
  multiplyTranspose(arg: Matrix3): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[3]!;
    const m02: number = this.#values[6]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[4]!;
    const m12: number = this.#values[7]!;
    const m20: number = this.#values[2]!;
    const m21: number = this.#values[5]!;
    const m22: number = this.#values[8]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix3');
    this.#values[0]! = m00 * argStorage[0]! + m01 * argStorage[3]! + m02 * argStorage[6]!;
    this.#values[3]! = m00 * argStorage[1]! + m01 * argStorage[4]! + m02 * argStorage[7]!;
    this.#values[6]! = m00 * argStorage[2]! + m01 * argStorage[5]! + m02 * argStorage[8]!;
    this.#values[1]! = m10 * argStorage[0]! + m11 * argStorage[3]! + m12 * argStorage[6]!;
    this.#values[4]! = m10 * argStorage[1]! + m11 * argStorage[4]! + m12 * argStorage[7]!;
    this.#values[7]! = m10 * argStorage[2]! + m11 * argStorage[5]! + m12 * argStorage[8]!;
    this.#values[2]! = m20 * argStorage[0]! + m21 * argStorage[3]! + m22 * argStorage[6]!;
    this.#values[5]! = m20 * argStorage[1]! + m21 * argStorage[4]! + m22 * argStorage[7]!;
    this.#values[8]! = m20 * argStorage[2]! + m21 * argStorage[5]! + m22 * argStorage[8]!;
  }
  transform(arg: Vector3): Vector3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x_: number =
      this.#values[0]! * argStorage[0]! +
      this.#values[3]! * argStorage[1]! +
      this.#values[6]! * argStorage[2]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! +
      this.#values[4]! * argStorage[1]! +
      this.#values[7]! * argStorage[2]!;
    const z_: number =
      this.#values[2]! * argStorage[0]! +
      this.#values[5]! * argStorage[1]! +
      this.#values[8]! * argStorage[2]!;
    (() => {
      const cascade16 = arg;
      cascade16.x = x_;
      cascade16.y = y_;
      cascade16.z = z_;
      return cascade16;
    })();
    return arg;
  }
  transformed(arg: Vector3, out: Vector3 | null = null): Vector3 {
    if (out === null) {
      out = Vector3.copy(arg);
    } else {
      out.setFrom(arg);
    }
    return this.transform(out);
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 9);
    const i = offset;
    array[i + 8]! = this.#values[8]!;
    array[i + 7]! = this.#values[7]!;
    array[i + 6]! = this.#values[6]!;
    array[i + 5]! = this.#values[5]!;
    array[i + 4]! = this.#values[4]!;
    array[i + 3]! = this.#values[3]!;
    array[i + 2]! = this.#values[2]!;
    array[i + 1]! = this.#values[1]!;
    array[i + 0]! = this.#values[0]!;
  }
  copyFromArray(array: readonly number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 9);
    const i = offset;
    this.#values[8]! = array[i + 8]!;
    this.#values[7]! = array[i + 7]!;
    this.#values[6]! = array[i + 6]!;
    this.#values[5]! = array[i + 5]!;
    this.#values[4]! = array[i + 4]!;
    this.#values[3]! = array[i + 3]!;
    this.#values[2]! = array[i + 2]!;
    this.#values[1]! = array[i + 1]!;
    this.#values[0]! = array[i + 0]!;
  }
  applyToVector3Array(array: number[] | Float64Array, offset: number = 0): number[] | Float64Array {
    for (let i = 0, j = offset; i < array.length; i += 3, j += 3) {
      const v = (() => {
        const cascade17 = Vector3.array(array, j);
        cascade17.applyMatrix3(this);
        return cascade17;
      })();
      array[j]! = checkedNumericStorage(v.storage, 3)[0]!;
      array[j + 1]! = checkedNumericStorage(v.storage, 3)[1]!;
      array[j + 2]! = checkedNumericStorage(v.storage, 3)[2]!;
    }
    return array;
  }
  get right(): Vector3 {
    const x: number = this.#values[0]!;
    const y: number = this.#values[1]!;
    const z: number = this.#values[2]!;
    return new Vector3(x, y, z);
  }
  get up(): Vector3 {
    const x: number = this.#values[3]!;
    const y: number = this.#values[4]!;
    const z: number = this.#values[5]!;
    return new Vector3(x, y, z);
  }
  get forward(): Vector3 {
    const x: number = this.#values[6]!;
    const y: number = this.#values[7]!;
    const z: number = this.#values[8]!;
    return new Vector3(x, y, z);
  }
  isIdentity(): boolean {
    return (
      this.#values[0]! === 1.0 &&
      this.#values[1]! === 0.0 &&
      this.#values[2]! === 0.0 &&
      this.#values[3]! === 0.0 &&
      this.#values[4]! === 1.0 &&
      this.#values[5]! === 0.0 &&
      this.#values[6]! === 0.0 &&
      this.#values[7]! === 0.0 &&
      this.#values[8]! === 1.0
    );
  }
  isZero(): boolean {
    return (
      this.#values[0]! === 0.0 &&
      this.#values[1]! === 0.0 &&
      this.#values[2]! === 0.0 &&
      this.#values[3]! === 0.0 &&
      this.#values[4]! === 0.0 &&
      this.#values[5]! === 0.0 &&
      this.#values[6]! === 0.0 &&
      this.#values[7]! === 0.0 &&
      this.#values[8]! === 0.0
    );
  }
}
