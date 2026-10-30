// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/matrix4.dart.
import { Vector2 } from './vector2.ts';
import { Vector3 } from './vector3.ts';
import { Vector4 } from './vector4.ts';
import { Matrix2 } from './matrix2.ts';
import { Matrix3 } from './matrix3.ts';
import { Quaternion } from './quaternion.ts';
import { invariant } from '../foundation/errors.ts';
import { hashDoubles } from '../ui/value-math.ts';
import {
  numericIndex,
  numericArrayRange,
  numericValues,
  numericView,
  numericStorage,
  checkedNumericStorage,
  matrixIndexedStorage,
  registerNumericObject,
  numericObjectStorage,
} from './numeric-helpers.ts';
export class Matrix4 {
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
    v9: number,
    v10: number,
    v11: number,
    v12: number,
    v13: number,
    v14: number,
    v15: number,
  );
  constructor(storage: Float64Array);
  constructor(...components: unknown[]) {
    this.#values =
      components.length === 1
        ? numericView(components[0] as Float64Array, 16)
        : numericValues(components as number[], 16);
    registerNumericObject(this, this.#values, 'Matrix4');
  }
  // The typed array already supplies sixteen positive zeros. Admit that
  // owned view instead of building and validating a component argument list.
  static zero(): Matrix4 {
    return new Matrix4(new Float64Array(16));
  }
  static fromFloat64List(storage: Float64Array): Matrix4 {
    return new Matrix4(storage);
  }
  static fromBuffer(buffer: ArrayBufferLike, offset: number): Matrix4 {
    return Matrix4.fromFloat64List(new Float64Array(buffer, offset, 16));
  }
  static fromList(values: readonly number[] | Float64Array): Matrix4 {
    values = numericArrayRange(values, 0, 16);
    return (() => {
      const cascade0 = Matrix4.zero();
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
        values[9]!,
        values[10]!,
        values[11]!,
        values[12]!,
        values[13]!,
        values[14]!,
        values[15]!,
      );
      return cascade0;
    })();
  }
  static identity(): Matrix4 {
    const result = Matrix4.zero(),
      storage = numericObjectStorage(result, 'Matrix4');
    storage[0]! = 1.0;
    storage[5]! = 1.0;
    storage[10]! = 1.0;
    storage[15]! = 1.0;
    return result;
  }
  static copy(other: Matrix4): Matrix4 {
    return (() => {
      const cascade2 = Matrix4.zero();
      cascade2.setFrom(other);
      return cascade2;
    })();
  }
  static inverted(other: Matrix4): Matrix4 {
    const r = Matrix4.zero();
    const determinant: number = r.copyInverse(other);
    if (determinant === 0.0) {
      throw new Error('Invalid numeric argument');
    }
    return r;
  }
  static columns(arg0: Vector4, arg1: Vector4, arg2: Vector4, arg3: Vector4): Matrix4 {
    return (() => {
      const cascade3 = Matrix4.zero();
      cascade3.setColumns(arg0, arg1, arg2, arg3);
      return cascade3;
    })();
  }
  static outer(u: Vector4, v: Vector4): Matrix4 {
    return (() => {
      const cascade4 = Matrix4.zero();
      cascade4.setOuter(u, v);
      return cascade4;
    })();
  }
  static rotationX(radians: number): Matrix4 {
    return (() => {
      const cascade5 = Matrix4.zero();
      numericObjectStorage(cascade5, 'Matrix4')[15]! = 1.0;
      cascade5.setRotationX(radians);
      return cascade5;
    })();
  }
  static rotationY(radians: number): Matrix4 {
    return (() => {
      const cascade6 = Matrix4.zero();
      numericObjectStorage(cascade6, 'Matrix4')[15]! = 1.0;
      cascade6.setRotationY(radians);
      return cascade6;
    })();
  }
  static rotationZ(radians: number): Matrix4 {
    return (() => {
      const cascade7 = Matrix4.zero();
      numericObjectStorage(cascade7, 'Matrix4')[15]! = 1.0;
      cascade7.setRotationZ(radians);
      return cascade7;
    })();
  }
  static translation(translation: Vector3): Matrix4 {
    return (() => {
      const cascade8 = Matrix4.zero();
      cascade8.setIdentity();
      cascade8.setTranslation(translation);
      return cascade8;
    })();
  }
  static translationValues(x: number, y: number, z: number): Matrix4 {
    return (() => {
      const cascade9 = Matrix4.zero();
      cascade9.setIdentity();
      cascade9.setTranslationRaw(x, y, z);
      return cascade9;
    })();
  }
  static diagonal3(scale: Vector3): Matrix4 {
    const m = Matrix4.zero();
    const mStorage: Float64Array = numericObjectStorage(m, 'Matrix4');
    const scaleStorage: Float64Array = numericObjectStorage(scale, 'Vector3');
    mStorage[15]! = 1.0;
    mStorage[10]! = scaleStorage[2]!;
    mStorage[5]! = scaleStorage[1]!;
    mStorage[0]! = scaleStorage[0]!;
    return m;
  }
  static diagonal3Values(x: number, y: number, z: number): Matrix4 {
    return (() => {
      const cascade10 = Matrix4.zero();
      numericObjectStorage(cascade10, 'Matrix4')[15]! = 1.0;
      numericObjectStorage(cascade10, 'Matrix4')[10]! = z;
      numericObjectStorage(cascade10, 'Matrix4')[5]! = y;
      numericObjectStorage(cascade10, 'Matrix4')[0]! = x;
      return cascade10;
    })();
  }
  static skewX(alpha: number): Matrix4 {
    const m = Matrix4.identity();
    numericObjectStorage(m, 'Matrix4')[4]! = Math.tan(alpha);
    return m;
  }
  static skewY(beta: number): Matrix4 {
    const m = Matrix4.identity();
    numericObjectStorage(m, 'Matrix4')[1]! = Math.tan(beta);
    return m;
  }
  static skew(alpha: number, beta: number): Matrix4 {
    const m = Matrix4.identity();
    numericObjectStorage(m, 'Matrix4')[1]! = Math.tan(beta);
    numericObjectStorage(m, 'Matrix4')[4]! = Math.tan(alpha);
    return m;
  }
  static compose(translation: Vector3, rotation: Quaternion, scale: Vector3): Matrix4 {
    return (() => {
      const cascade11 = Matrix4.zero();
      cascade11.setFromTranslationRotationScale(translation, rotation, scale);
      return cascade11;
    })();
  }
  get storage(): Float64Array {
    return numericStorage(this.#values);
  }
  static solve2(A: Matrix4, x: Vector2, b: Vector2): void {
    const a11: number = A.entry(0, 0);
    const a12: number = A.entry(0, 1);
    const a21: number = A.entry(1, 0);
    const a22: number = A.entry(1, 1);
    const bx: number = b.x - numericObjectStorage(A, 'Matrix4')[8]!;
    const by: number = b.y - numericObjectStorage(A, 'Matrix4')[9]!;
    let det: number = a11 * a22 - a12 * a21;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    (() => {
      const cascade12 = x;
      cascade12.x = det * (a22 * bx - a12 * by);
      cascade12.y = det * (a11 * by - a21 * bx);
      return cascade12;
    })();
  }
  static solve3(A: Matrix4, x: Vector3, b: Vector3): void {
    const a0x: number = A.entry(0, 0);
    const a0y: number = A.entry(1, 0);
    const a0z: number = A.entry(2, 0);
    const a1x: number = A.entry(0, 1);
    const a1y: number = A.entry(1, 1);
    const a1z: number = A.entry(2, 1);
    const a2x: number = A.entry(0, 2);
    const a2y: number = A.entry(1, 2);
    const a2z: number = A.entry(2, 2);
    const bx: number = b.x - numericObjectStorage(A, 'Matrix4')[12]!;
    const by: number = b.y - numericObjectStorage(A, 'Matrix4')[13]!;
    const bz: number = b.z - numericObjectStorage(A, 'Matrix4')[14]!;
    let rx: number, ry: number, rz: number;
    let det: number;
    rx = a1y * a2z - a1z * a2y;
    ry = a1z * a2x - a1x * a2z;
    rz = a1x * a2y - a1y * a2x;
    det = a0x * rx + a0y * ry + a0z * rz;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    const x_: number = det * (bx * rx + by * ry + bz * rz);
    rx = -(a2y * bz - a2z * by);
    ry = -(a2z * bx - a2x * bz);
    rz = -(a2x * by - a2y * bx);
    const y_: number = det * (a0x * rx + a0y * ry + a0z * rz);
    rx = -(by * a1z - bz * a1y);
    ry = -(bz * a1x - bx * a1z);
    rz = -(bx * a1y - by * a1x);
    const z_: number = det * (a0x * rx + a0y * ry + a0z * rz);
    (() => {
      const cascade13 = x;
      cascade13.x = x_;
      cascade13.y = y_;
      cascade13.z = z_;
      return cascade13;
    })();
  }
  static solve(A: Matrix4, x: Vector4, b: Vector4): void {
    const a00: number = numericObjectStorage(A, 'Matrix4')[0]!;
    const a01: number = numericObjectStorage(A, 'Matrix4')[1]!;
    const a02: number = numericObjectStorage(A, 'Matrix4')[2]!;
    const a03: number = numericObjectStorage(A, 'Matrix4')[3]!;
    const a10: number = numericObjectStorage(A, 'Matrix4')[4]!;
    const a11: number = numericObjectStorage(A, 'Matrix4')[5]!;
    const a12: number = numericObjectStorage(A, 'Matrix4')[6]!;
    const a13: number = numericObjectStorage(A, 'Matrix4')[7]!;
    const a20: number = numericObjectStorage(A, 'Matrix4')[8]!;
    const a21: number = numericObjectStorage(A, 'Matrix4')[9]!;
    const a22: number = numericObjectStorage(A, 'Matrix4')[10]!;
    const a23: number = numericObjectStorage(A, 'Matrix4')[11]!;
    const a30: number = numericObjectStorage(A, 'Matrix4')[12]!;
    const a31: number = numericObjectStorage(A, 'Matrix4')[13]!;
    const a32: number = numericObjectStorage(A, 'Matrix4')[14]!;
    const a33: number = numericObjectStorage(A, 'Matrix4')[15]!;
    const b00: number = a00 * a11 - a01 * a10;
    const b01: number = a00 * a12 - a02 * a10;
    const b02: number = a00 * a13 - a03 * a10;
    const b03: number = a01 * a12 - a02 * a11;
    const b04: number = a01 * a13 - a03 * a11;
    const b05: number = a02 * a13 - a03 * a12;
    const b06: number = a20 * a31 - a21 * a30;
    const b07: number = a20 * a32 - a22 * a30;
    const b08: number = a20 * a33 - a23 * a30;
    const b09: number = a21 * a32 - a22 * a31;
    const b10: number = a21 * a33 - a23 * a31;
    const b11: number = a22 * a33 - a23 * a32;
    const bX: number = checkedNumericStorage(b.storage, 4)[0]!;
    const bY: number = checkedNumericStorage(b.storage, 4)[1]!;
    const bZ: number = checkedNumericStorage(b.storage, 4)[2]!;
    const bW: number = checkedNumericStorage(b.storage, 4)[3]!;
    let det: number = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (det !== 0.0) {
      det = 1.0 / det;
    }
    (() => {
      const cascade14 = x;
      cascade14.x =
        det *
        ((a11 * b11 - a12 * b10 + a13 * b09) * bX -
          (a10 * b11 - a12 * b08 + a13 * b07) * bY +
          (a10 * b10 - a11 * b08 + a13 * b06) * bZ -
          (a10 * b09 - a11 * b07 + a12 * b06) * bW);
      cascade14.y =
        det *
        -(
          (a01 * b11 - a02 * b10 + a03 * b09) * bX -
          (a00 * b11 - a02 * b08 + a03 * b07) * bY +
          (a00 * b10 - a01 * b08 + a03 * b06) * bZ -
          (a00 * b09 - a01 * b07 + a02 * b06) * bW
        );
      cascade14.z =
        det *
        ((a31 * b05 - a32 * b04 + a33 * b03) * bX -
          (a30 * b05 - a32 * b02 + a33 * b01) * bY +
          (a30 * b04 - a31 * b02 + a33 * b00) * bZ -
          (a30 * b03 - a31 * b01 + a32 * b00) * bW);
      cascade14.w =
        det *
        -(
          (a21 * b05 - a22 * b04 + a23 * b03) * bX -
          (a20 * b05 - a22 * b02 + a23 * b01) * bY +
          (a20 * b04 - a21 * b02 + a23 * b00) * bZ -
          (a20 * b03 - a21 * b01 + a22 * b00) * bW
        );
      return cascade14;
    })();
  }
  static tryInvert(other: Matrix4): Matrix4 | null {
    const r = Matrix4.zero();
    const determinant: number = r.copyInverse(other);
    if (determinant === 0.0) {
      return null;
    }
    return r;
  }
  index(row: number, col: number): number {
    return col * 4 + row;
  }
  entry(row: number, col: number): number {
    numericIndex(row, 4);
    numericIndex(col, 4);
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
    numericIndex(row, 4);
    numericIndex(col, 4);
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
  splatDiagonal(arg: number): void {
    this.#values[0]! = arg;
    this.#values[5]! = arg;
    this.#values[10]! = arg;
    this.#values[15]! = arg;
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
    arg9: number,
    arg10: number,
    arg11: number,
    arg12: number,
    arg13: number,
    arg14: number,
    arg15: number,
  ): void {
    this.#values[15]! = arg15;
    this.#values[14]! = arg14;
    this.#values[13]! = arg13;
    this.#values[12]! = arg12;
    this.#values[11]! = arg11;
    this.#values[10]! = arg10;
    this.#values[9]! = arg9;
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
  setColumns(arg0: Vector4, arg1: Vector4, arg2: Vector4, arg3: Vector4): void {
    const arg0Storage: Float64Array = numericObjectStorage(arg0, 'Vector4');
    const arg1Storage: Float64Array = numericObjectStorage(arg1, 'Vector4');
    const arg2Storage: Float64Array = numericObjectStorage(arg2, 'Vector4');
    const arg3Storage: Float64Array = numericObjectStorage(arg3, 'Vector4');
    this.#values[0]! = arg0Storage[0]!;
    this.#values[1]! = arg0Storage[1]!;
    this.#values[2]! = arg0Storage[2]!;
    this.#values[3]! = arg0Storage[3]!;
    this.#values[4]! = arg1Storage[0]!;
    this.#values[5]! = arg1Storage[1]!;
    this.#values[6]! = arg1Storage[2]!;
    this.#values[7]! = arg1Storage[3]!;
    this.#values[8]! = arg2Storage[0]!;
    this.#values[9]! = arg2Storage[1]!;
    this.#values[10]! = arg2Storage[2]!;
    this.#values[11]! = arg2Storage[3]!;
    this.#values[12]! = arg3Storage[0]!;
    this.#values[13]! = arg3Storage[1]!;
    this.#values[14]! = arg3Storage[2]!;
    this.#values[15]! = arg3Storage[3]!;
  }
  setFrom(arg: Matrix4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    this.#values[15]! = argStorage[15]!;
    this.#values[14]! = argStorage[14]!;
    this.#values[13]! = argStorage[13]!;
    this.#values[12]! = argStorage[12]!;
    this.#values[11]! = argStorage[11]!;
    this.#values[10]! = argStorage[10]!;
    this.#values[9]! = argStorage[9]!;
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
  setFromTranslationRotation(arg0: Vector3, arg1: Quaternion): void {
    const arg1Storage: Float64Array = numericObjectStorage(arg1, 'Quaternion');
    const x: number = arg1Storage[0]!;
    const y: number = arg1Storage[1]!;
    const z: number = arg1Storage[2]!;
    const w: number = arg1Storage[3]!;
    const x2: number = x + x;
    const y2: number = y + y;
    const z2: number = z + z;
    const xx: number = x * x2;
    const xy: number = x * y2;
    const xz: number = x * z2;
    const yy: number = y * y2;
    const yz: number = y * z2;
    const zz: number = z * z2;
    const wx: number = w * x2;
    const wy: number = w * y2;
    const wz: number = w * z2;
    const arg0Storage: Float64Array = numericObjectStorage(arg0, 'Vector3');
    this.#values[0]! = 1.0 - (yy + zz);
    this.#values[1]! = xy + wz;
    this.#values[2]! = xz - wy;
    this.#values[3]! = 0.0;
    this.#values[4]! = xy - wz;
    this.#values[5]! = 1.0 - (xx + zz);
    this.#values[6]! = yz + wx;
    this.#values[7]! = 0.0;
    this.#values[8]! = xz + wy;
    this.#values[9]! = yz - wx;
    this.#values[10]! = 1.0 - (xx + yy);
    this.#values[11]! = 0.0;
    this.#values[12]! = arg0Storage[0]!;
    this.#values[13]! = arg0Storage[1]!;
    this.#values[14]! = arg0Storage[2]!;
    this.#values[15]! = 1.0;
  }
  setFromTranslationRotationScale(
    translation: Vector3,
    rotation: Quaternion,
    scale: Vector3,
  ): void {
    this.setFromTranslationRotation(translation, rotation);
    this.scaleByVector3(scale);
  }
  setUpper2x2(arg: Matrix2): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix2');
    this.#values[0]! = argStorage[0]!;
    this.#values[1]! = argStorage[1]!;
    this.#values[4]! = argStorage[2]!;
    this.#values[5]! = argStorage[3]!;
  }
  setDiagonal(arg: Vector4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    this.#values[0]! = argStorage[0]!;
    this.#values[5]! = argStorage[1]!;
    this.#values[10]! = argStorage[2]!;
    this.#values[15]! = argStorage[3]!;
  }
  setOuter(u: Vector4, v: Vector4): void {
    const uStorage: Float64Array = numericObjectStorage(u, 'Vector4');
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector4');
    this.#values[0]! = uStorage[0]! * vStorage[0]!;
    this.#values[1]! = uStorage[0]! * vStorage[1]!;
    this.#values[2]! = uStorage[0]! * vStorage[2]!;
    this.#values[3]! = uStorage[0]! * vStorage[3]!;
    this.#values[4]! = uStorage[1]! * vStorage[0]!;
    this.#values[5]! = uStorage[1]! * vStorage[1]!;
    this.#values[6]! = uStorage[1]! * vStorage[2]!;
    this.#values[7]! = uStorage[1]! * vStorage[3]!;
    this.#values[8]! = uStorage[2]! * vStorage[0]!;
    this.#values[9]! = uStorage[2]! * vStorage[1]!;
    this.#values[10]! = uStorage[2]! * vStorage[2]!;
    this.#values[11]! = uStorage[2]! * vStorage[3]!;
    this.#values[12]! = uStorage[3]! * vStorage[0]!;
    this.#values[13]! = uStorage[3]! * vStorage[1]!;
    this.#values[14]! = uStorage[3]! * vStorage[2]!;
    this.#values[15]! = uStorage[3]! * vStorage[3]!;
  }
  toString(): string {
    return (
      `[0] ${this.getRow(0)}
[1] ${this.getRow(1)}
` +
      `[2] ${this.getRow(2)}
[3] ${this.getRow(3)}
`
    );
  }
  get dimension(): number {
    return 4;
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
      other instanceof Matrix4 &&
      this.#values[0]! === numericObjectStorage(other, 'Matrix4')[0]! &&
      this.#values[1]! === numericObjectStorage(other, 'Matrix4')[1]! &&
      this.#values[2]! === numericObjectStorage(other, 'Matrix4')[2]! &&
      this.#values[3]! === numericObjectStorage(other, 'Matrix4')[3]! &&
      this.#values[4]! === numericObjectStorage(other, 'Matrix4')[4]! &&
      this.#values[5]! === numericObjectStorage(other, 'Matrix4')[5]! &&
      this.#values[6]! === numericObjectStorage(other, 'Matrix4')[6]! &&
      this.#values[7]! === numericObjectStorage(other, 'Matrix4')[7]! &&
      this.#values[8]! === numericObjectStorage(other, 'Matrix4')[8]! &&
      this.#values[9]! === numericObjectStorage(other, 'Matrix4')[9]! &&
      this.#values[10]! === numericObjectStorage(other, 'Matrix4')[10]! &&
      this.#values[11]! === numericObjectStorage(other, 'Matrix4')[11]! &&
      this.#values[12]! === numericObjectStorage(other, 'Matrix4')[12]! &&
      this.#values[13]! === numericObjectStorage(other, 'Matrix4')[13]! &&
      this.#values[14]! === numericObjectStorage(other, 'Matrix4')[14]! &&
      this.#values[15]! === numericObjectStorage(other, 'Matrix4')[15]!
    );
  }
  get hashCode(): number {
    return hashDoubles(Array.from(this.#values).slice(0, 16));
  }
  get row0(): Vector4 {
    return this.getRow(0);
  }
  get row1(): Vector4 {
    return this.getRow(1);
  }
  get row2(): Vector4 {
    return this.getRow(2);
  }
  get row3(): Vector4 {
    return this.getRow(3);
  }
  set row0(arg: Vector4) {
    this.setRow(0, arg);
  }
  set row1(arg: Vector4) {
    this.setRow(1, arg);
  }
  set row2(arg: Vector4) {
    this.setRow(2, arg);
  }
  set row3(arg: Vector4) {
    this.setRow(3, arg);
  }
  setRow(row: number, arg: Vector4): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 4);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    checkedRowStorage[this.index(row, 0)]! = argStorage[0]!;
    checkedRowStorage[this.index(row, 1)]! = argStorage[1]!;
    checkedRowStorage[this.index(row, 2)]! = argStorage[2]!;
    checkedRowStorage[this.index(row, 3)]! = argStorage[3]!;
  }
  getRow(row: number): Vector4 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, row, 4);
    const r = Vector4.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector4');
    rStorage[0]! = checkedRowStorage[this.index(row, 0)]!;
    rStorage[1]! = checkedRowStorage[this.index(row, 1)]!;
    rStorage[2]! = checkedRowStorage[this.index(row, 2)]!;
    rStorage[3]! = checkedRowStorage[this.index(row, 3)]!;
    return r;
  }
  setColumn(column: number, arg: Vector4): void {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 4);
    const entry: number = column * 4;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    checkedRowStorage[entry + 3]! = argStorage[3]!;
    checkedRowStorage[entry + 2]! = argStorage[2]!;
    checkedRowStorage[entry + 1]! = argStorage[1]!;
    checkedRowStorage[entry + 0]! = argStorage[0]!;
  }
  getColumn(column: number): Vector4 {
    const checkedRowStorage = matrixIndexedStorage(this.#values, column, 4);
    const r = Vector4.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Vector4');
    const entry: number = column * 4;
    rStorage[3]! = checkedRowStorage[entry + 3]!;
    rStorage[2]! = checkedRowStorage[entry + 2]!;
    rStorage[1]! = checkedRowStorage[entry + 1]!;
    rStorage[0]! = checkedRowStorage[entry + 0]!;
    return r;
  }
  clone(): Matrix4 {
    return Matrix4.copy(this);
  }
  copyInto(arg: Matrix4): Matrix4 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    argStorage[0]! = this.#values[0]!;
    argStorage[1]! = this.#values[1]!;
    argStorage[2]! = this.#values[2]!;
    argStorage[3]! = this.#values[3]!;
    argStorage[4]! = this.#values[4]!;
    argStorage[5]! = this.#values[5]!;
    argStorage[6]! = this.#values[6]!;
    argStorage[7]! = this.#values[7]!;
    argStorage[8]! = this.#values[8]!;
    argStorage[9]! = this.#values[9]!;
    argStorage[10]! = this.#values[10]!;
    argStorage[11]! = this.#values[11]!;
    argStorage[12]! = this.#values[12]!;
    argStorage[13]! = this.#values[13]!;
    argStorage[14]! = this.#values[14]!;
    argStorage[15]! = this.#values[15]!;
    return arg;
  }
  unaryMinus(): Matrix4 {
    return (() => {
      const cascade15 = this.clone();
      cascade15.negate();
      return cascade15;
    })();
  }
  times(arg: number): Matrix4;
  times(arg: Matrix4): Matrix4;
  times(arg: Vector3): Vector3;
  times(arg: Vector4): Vector4;
  times(arg: unknown): unknown {
    let result: unknown;
    if (typeof arg === 'number') {
      result = this.scaledByDouble(arg, arg, arg, 1.0);
    } else if (arg instanceof Vector4) {
      result = this.transformed(arg);
    } else if (arg instanceof Vector3) {
      result = this.transformed3(arg);
    } else if (arg instanceof Matrix4) {
      result = this.multiplied(arg);
    } else {
      throw new Error('Invalid numeric argument');
    }
    return result;
  }
  plus(arg: Matrix4): Matrix4 {
    return (() => {
      const cascade16 = this.clone();
      cascade16.add(arg);
      return cascade16;
    })();
  }
  minus(arg: Matrix4): Matrix4 {
    return (() => {
      const cascade17 = this.clone();
      cascade17.sub(arg);
      return cascade17;
    })();
  }
  translate(x: unknown, y: number = 0.0, z: number = 0.0): void {
    if (x instanceof Vector3) {
      this.translateByVector3(x);
    } else if (x instanceof Vector4) {
      this.translateByVector4(x);
    } else if (typeof x === 'number') {
      this.translateByDouble(x, y, z, 1.0);
    } else {
      throw new Error('Invalid numeric argument');
    }
  }
  translateByDouble(tx: number, ty: number, tz: number, tw: number): void {
    const storage = this.#values;
    const t1: number = storage[0]! * tx + storage[4]! * ty + storage[8]! * tz + storage[12]! * tw;
    storage[12]! = t1;
    const t2: number = storage[1]! * tx + storage[5]! * ty + storage[9]! * tz + storage[13]! * tw;
    storage[13]! = t2;
    const t3: number = storage[2]! * tx + storage[6]! * ty + storage[10]! * tz + storage[14]! * tw;
    storage[14]! = t3;
    const t4: number = storage[3]! * tx + storage[7]! * ty + storage[11]! * tz + storage[15]! * tw;
    storage[15]! = t4;
  }
  translateByVector2(v2: Vector2): void {
    this.translateByDouble(v2.x, v2.y, 0.0, 1.0);
  }
  translateByVector3(v3: Vector3): void {
    this.translateByDouble(v3.x, v3.y, v3.z, 1.0);
  }
  translateByVector4(v4: Vector4): void {
    this.translateByDouble(v4.x, v4.y, v4.z, v4.w);
  }
  leftTranslate(x: unknown, y: number = 0.0, z: number = 0.0): void {
    if (x instanceof Vector3) {
      this.leftTranslateByVector3(x);
    } else if (x instanceof Vector4) {
      this.leftTranslateByVector4(x);
    } else if (typeof x === 'number') {
      this.leftTranslateByDouble(x, y, z, 1.0);
    } else {
      throw new Error('Invalid numeric argument');
    }
  }
  leftTranslateByDouble(tx: number, ty: number, tz: number, tw: number): void {
    const r1: number = this.#values[3]!;
    this.#values[0]! += tx * r1;
    this.#values[1]! += ty * r1;
    this.#values[2]! += tz * r1;
    this.#values[3]! = tw * r1;
    const r2: number = this.#values[7]!;
    this.#values[4]! += tx * r2;
    this.#values[5]! += ty * r2;
    this.#values[6]! += tz * r2;
    this.#values[7]! = tw * r2;
    const r3: number = this.#values[11]!;
    this.#values[8]! += tx * r3;
    this.#values[9]! += ty * r3;
    this.#values[10]! += tz * r3;
    this.#values[11]! = tw * r3;
    const r4: number = this.#values[15]!;
    this.#values[12]! += tx * r4;
    this.#values[13]! += ty * r4;
    this.#values[14]! += tz * r4;
    this.#values[15]! = tw * r4;
  }
  leftTranslateByVector2(v2: Vector2): void {
    this.leftTranslateByDouble(v2.x, v2.y, 0.0, 1.0);
  }
  leftTranslateByVector3(v3: Vector3): void {
    this.leftTranslateByDouble(v3.x, v3.y, v3.z, 1.0);
  }
  leftTranslateByVector4(v4: Vector4): void {
    this.leftTranslateByDouble(v4.x, v4.y, v4.z, v4.w);
  }
  rotate(axis: Vector3, angle: number): void {
    const len: number = axis.length;
    const axisStorage: Float64Array = numericObjectStorage(axis, 'Vector3');
    const x: number = axisStorage[0]! / len;
    const y: number = axisStorage[1]! / len;
    const z: number = axisStorage[2]! / len;
    const c: number = Math.cos(angle);
    const s: number = Math.sin(angle);
    const C: number = 1.0 - c;
    const m11: number = x * x * C + c;
    const m12: number = x * y * C - z * s;
    const m13: number = x * z * C + y * s;
    const m21: number = y * x * C + z * s;
    const m22: number = y * y * C + c;
    const m23: number = y * z * C - x * s;
    const m31: number = z * x * C - y * s;
    const m32: number = z * y * C + x * s;
    const m33: number = z * z * C + c;
    const t1: number = this.#values[0]! * m11 + this.#values[4]! * m21 + this.#values[8]! * m31;
    const t2: number = this.#values[1]! * m11 + this.#values[5]! * m21 + this.#values[9]! * m31;
    const t3: number = this.#values[2]! * m11 + this.#values[6]! * m21 + this.#values[10]! * m31;
    const t4: number = this.#values[3]! * m11 + this.#values[7]! * m21 + this.#values[11]! * m31;
    const t5: number = this.#values[0]! * m12 + this.#values[4]! * m22 + this.#values[8]! * m32;
    const t6: number = this.#values[1]! * m12 + this.#values[5]! * m22 + this.#values[9]! * m32;
    const t7: number = this.#values[2]! * m12 + this.#values[6]! * m22 + this.#values[10]! * m32;
    const t8: number = this.#values[3]! * m12 + this.#values[7]! * m22 + this.#values[11]! * m32;
    const t9: number = this.#values[0]! * m13 + this.#values[4]! * m23 + this.#values[8]! * m33;
    const t10: number = this.#values[1]! * m13 + this.#values[5]! * m23 + this.#values[9]! * m33;
    const t11: number = this.#values[2]! * m13 + this.#values[6]! * m23 + this.#values[10]! * m33;
    const t12: number = this.#values[3]! * m13 + this.#values[7]! * m23 + this.#values[11]! * m33;
    this.#values[0]! = t1;
    this.#values[1]! = t2;
    this.#values[2]! = t3;
    this.#values[3]! = t4;
    this.#values[4]! = t5;
    this.#values[5]! = t6;
    this.#values[6]! = t7;
    this.#values[7]! = t8;
    this.#values[8]! = t9;
    this.#values[9]! = t10;
    this.#values[10]! = t11;
    this.#values[11]! = t12;
  }
  rotateX(angle: number): void {
    const cosAngle: number = Math.cos(angle);
    const sinAngle: number = Math.sin(angle);
    const t1: number = this.#values[4]! * cosAngle + this.#values[8]! * sinAngle;
    const t2: number = this.#values[5]! * cosAngle + this.#values[9]! * sinAngle;
    const t3: number = this.#values[6]! * cosAngle + this.#values[10]! * sinAngle;
    const t4: number = this.#values[7]! * cosAngle + this.#values[11]! * sinAngle;
    const t5: number = this.#values[4]! * -sinAngle + this.#values[8]! * cosAngle;
    const t6: number = this.#values[5]! * -sinAngle + this.#values[9]! * cosAngle;
    const t7: number = this.#values[6]! * -sinAngle + this.#values[10]! * cosAngle;
    const t8: number = this.#values[7]! * -sinAngle + this.#values[11]! * cosAngle;
    this.#values[4]! = t1;
    this.#values[5]! = t2;
    this.#values[6]! = t3;
    this.#values[7]! = t4;
    this.#values[8]! = t5;
    this.#values[9]! = t6;
    this.#values[10]! = t7;
    this.#values[11]! = t8;
  }
  rotateY(angle: number): void {
    const cosAngle: number = Math.cos(angle);
    const sinAngle: number = Math.sin(angle);
    const t1: number = this.#values[0]! * cosAngle + this.#values[8]! * -sinAngle;
    const t2: number = this.#values[1]! * cosAngle + this.#values[9]! * -sinAngle;
    const t3: number = this.#values[2]! * cosAngle + this.#values[10]! * -sinAngle;
    const t4: number = this.#values[3]! * cosAngle + this.#values[11]! * -sinAngle;
    const t5: number = this.#values[0]! * sinAngle + this.#values[8]! * cosAngle;
    const t6: number = this.#values[1]! * sinAngle + this.#values[9]! * cosAngle;
    const t7: number = this.#values[2]! * sinAngle + this.#values[10]! * cosAngle;
    const t8: number = this.#values[3]! * sinAngle + this.#values[11]! * cosAngle;
    this.#values[0]! = t1;
    this.#values[1]! = t2;
    this.#values[2]! = t3;
    this.#values[3]! = t4;
    this.#values[8]! = t5;
    this.#values[9]! = t6;
    this.#values[10]! = t7;
    this.#values[11]! = t8;
  }
  rotateZ(angle: number): void {
    const cosAngle: number = Math.cos(angle);
    const sinAngle: number = Math.sin(angle);
    const t1: number = this.#values[0]! * cosAngle + this.#values[4]! * sinAngle;
    const t2: number = this.#values[1]! * cosAngle + this.#values[5]! * sinAngle;
    const t3: number = this.#values[2]! * cosAngle + this.#values[6]! * sinAngle;
    const t4: number = this.#values[3]! * cosAngle + this.#values[7]! * sinAngle;
    const t5: number = this.#values[0]! * -sinAngle + this.#values[4]! * cosAngle;
    const t6: number = this.#values[1]! * -sinAngle + this.#values[5]! * cosAngle;
    const t7: number = this.#values[2]! * -sinAngle + this.#values[6]! * cosAngle;
    const t8: number = this.#values[3]! * -sinAngle + this.#values[7]! * cosAngle;
    this.#values[0]! = t1;
    this.#values[1]! = t2;
    this.#values[2]! = t3;
    this.#values[3]! = t4;
    this.#values[4]! = t5;
    this.#values[5]! = t6;
    this.#values[6]! = t7;
    this.#values[7]! = t8;
  }
  scale(x: unknown, y: number | null = null, z: number | null = null): void {
    if (x instanceof Vector3) {
      this.scaleByVector3(x);
    } else if (x instanceof Vector4) {
      this.scaleByVector4(x);
    } else if (typeof x === 'number') {
      this.scaleByDouble(x, y ?? x, z ?? x, 1.0);
    } else {
      throw new Error('Invalid numeric argument');
    }
  }
  scaleByDouble(sx: number, sy: number, sz: number, sw: number): void {
    this.#values[0]! *= sx;
    this.#values[1]! *= sx;
    this.#values[2]! *= sx;
    this.#values[3]! *= sx;
    this.#values[4]! *= sy;
    this.#values[5]! *= sy;
    this.#values[6]! *= sy;
    this.#values[7]! *= sy;
    this.#values[8]! *= sz;
    this.#values[9]! *= sz;
    this.#values[10]! *= sz;
    this.#values[11]! *= sz;
    this.#values[12]! *= sw;
    this.#values[13]! *= sw;
    this.#values[14]! *= sw;
    this.#values[15]! *= sw;
  }
  scaleByVector3(v3: Vector3): void {
    this.scaleByDouble(v3.x, v3.y, v3.z, 1.0);
  }
  scaleByVector4(v4: Vector4): void {
    this.scaleByDouble(v4.x, v4.y, v4.z, v4.w);
  }
  scaled(x: unknown, y: number | null = null, z: number | null = null): Matrix4 {
    return (() => {
      const cascade18 = this.clone();
      cascade18.scale(x, y, z);
      return cascade18;
    })();
  }
  scaledByDouble(x: number, y: number, z: number, t: number): Matrix4 {
    return (() => {
      const cascade19 = this.clone();
      cascade19.scaleByDouble(x, y, z, t);
      return cascade19;
    })();
  }
  scaledByVector3(v3: Vector3): Matrix4 {
    return (() => {
      const cascade20 = this.clone();
      cascade20.scaleByVector3(v3);
      return cascade20;
    })();
  }
  scaledByVector4(v4: Vector4): Matrix4 {
    return (() => {
      const cascade21 = this.clone();
      cascade21.scaleByVector4(v4);
      return cascade21;
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
    this.#values[9]! = 0.0;
    this.#values[10]! = 0.0;
    this.#values[11]! = 0.0;
    this.#values[12]! = 0.0;
    this.#values[13]! = 0.0;
    this.#values[14]! = 0.0;
    this.#values[15]! = 0.0;
  }
  setIdentity(): void {
    this.#values[0]! = 1.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[3]! = 0.0;
    this.#values[4]! = 0.0;
    this.#values[5]! = 1.0;
    this.#values[6]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[8]! = 0.0;
    this.#values[9]! = 0.0;
    this.#values[10]! = 1.0;
    this.#values[11]! = 0.0;
    this.#values[12]! = 0.0;
    this.#values[13]! = 0.0;
    this.#values[14]! = 0.0;
    this.#values[15]! = 1.0;
  }
  transposed(): Matrix4 {
    return (() => {
      const cascade22 = this.clone();
      cascade22.transpose();
      return cascade22;
    })();
  }
  transpose(): void {
    let temp: number;
    temp = this.#values[4]!;
    this.#values[4]! = this.#values[1]!;
    this.#values[1]! = temp;
    temp = this.#values[8]!;
    this.#values[8]! = this.#values[2]!;
    this.#values[2]! = temp;
    temp = this.#values[12]!;
    this.#values[12]! = this.#values[3]!;
    this.#values[3]! = temp;
    temp = this.#values[9]!;
    this.#values[9]! = this.#values[6]!;
    this.#values[6]! = temp;
    temp = this.#values[13]!;
    this.#values[13]! = this.#values[7]!;
    this.#values[7]! = temp;
    temp = this.#values[14]!;
    this.#values[14]! = this.#values[11]!;
    this.#values[11]! = temp;
  }
  absolute(): Matrix4 {
    const r = Matrix4.zero();
    const rStorage: Float64Array = numericObjectStorage(r, 'Matrix4');
    rStorage[0]! = Math.abs(this.#values[0]!);
    rStorage[1]! = Math.abs(this.#values[1]!);
    rStorage[2]! = Math.abs(this.#values[2]!);
    rStorage[3]! = Math.abs(this.#values[3]!);
    rStorage[4]! = Math.abs(this.#values[4]!);
    rStorage[5]! = Math.abs(this.#values[5]!);
    rStorage[6]! = Math.abs(this.#values[6]!);
    rStorage[7]! = Math.abs(this.#values[7]!);
    rStorage[8]! = Math.abs(this.#values[8]!);
    rStorage[9]! = Math.abs(this.#values[9]!);
    rStorage[10]! = Math.abs(this.#values[10]!);
    rStorage[11]! = Math.abs(this.#values[11]!);
    rStorage[12]! = Math.abs(this.#values[12]!);
    rStorage[13]! = Math.abs(this.#values[13]!);
    rStorage[14]! = Math.abs(this.#values[14]!);
    rStorage[15]! = Math.abs(this.#values[15]!);
    return r;
  }
  determinant(): number {
    const det2_01_01: number =
      this.#values[0]! * this.#values[5]! - this.#values[1]! * this.#values[4]!;
    const det2_01_02: number =
      this.#values[0]! * this.#values[6]! - this.#values[2]! * this.#values[4]!;
    const det2_01_03: number =
      this.#values[0]! * this.#values[7]! - this.#values[3]! * this.#values[4]!;
    const det2_01_12: number =
      this.#values[1]! * this.#values[6]! - this.#values[2]! * this.#values[5]!;
    const det2_01_13: number =
      this.#values[1]! * this.#values[7]! - this.#values[3]! * this.#values[5]!;
    const det2_01_23: number =
      this.#values[2]! * this.#values[7]! - this.#values[3]! * this.#values[6]!;
    const det3_201_012: number =
      this.#values[8]! * det2_01_12 -
      this.#values[9]! * det2_01_02 +
      this.#values[10]! * det2_01_01;
    const det3_201_013: number =
      this.#values[8]! * det2_01_13 -
      this.#values[9]! * det2_01_03 +
      this.#values[11]! * det2_01_01;
    const det3_201_023: number =
      this.#values[8]! * det2_01_23 -
      this.#values[10]! * det2_01_03 +
      this.#values[11]! * det2_01_02;
    const det3_201_123: number =
      this.#values[9]! * det2_01_23 -
      this.#values[10]! * det2_01_13 +
      this.#values[11]! * det2_01_12;
    return (
      -det3_201_123 * this.#values[12]! +
      det3_201_023 * this.#values[13]! -
      det3_201_013 * this.#values[14]! +
      det3_201_012 * this.#values[15]!
    );
  }
  dotRow(i: number, v: Vector4): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, i, 4);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector4');
    return (
      checkedRowStorage[i]! * vStorage[0]! +
      checkedRowStorage[4 + i]! * vStorage[1]! +
      checkedRowStorage[8 + i]! * vStorage[2]! +
      checkedRowStorage[12 + i]! * vStorage[3]!
    );
  }
  dotColumn(j: number, v: Vector4): number {
    const checkedRowStorage = matrixIndexedStorage(this.#values, j, 4);
    const vStorage: Float64Array = numericObjectStorage(v, 'Vector4');
    return (
      checkedRowStorage[j * 4]! * vStorage[0]! +
      checkedRowStorage[j * 4 + 1]! * vStorage[1]! +
      checkedRowStorage[j * 4 + 2]! * vStorage[2]! +
      checkedRowStorage[j * 4 + 3]! * vStorage[3]!
    );
  }
  trace(): number {
    let t = 0.0;
    t += this.#values[0]!;
    t += this.#values[5]!;
    t += this.#values[10]!;
    t += this.#values[15]!;
    return t;
  }
  infinityNorm(): number {
    let norm = 0.0;
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[0]!);
      rowNorm += Math.abs(this.#values[1]!);
      rowNorm += Math.abs(this.#values[2]!);
      rowNorm += Math.abs(this.#values[3]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[4]!);
      rowNorm += Math.abs(this.#values[5]!);
      rowNorm += Math.abs(this.#values[6]!);
      rowNorm += Math.abs(this.#values[7]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[8]!);
      rowNorm += Math.abs(this.#values[9]!);
      rowNorm += Math.abs(this.#values[10]!);
      rowNorm += Math.abs(this.#values[11]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    {
      let rowNorm = 0.0;
      rowNorm += Math.abs(this.#values[12]!);
      rowNorm += Math.abs(this.#values[13]!);
      rowNorm += Math.abs(this.#values[14]!);
      rowNorm += Math.abs(this.#values[15]!);
      norm = rowNorm > norm ? rowNorm : norm;
    }
    return norm;
  }
  relativeError(correct: Matrix4): number {
    const diff: Matrix4 = correct.minus(this);
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = diff.infinityNorm();
    return diffNorm / correctNorm;
  }
  absoluteError(correct: Matrix4): number {
    const thisNorm: number = this.infinityNorm();
    const correctNorm: number = correct.infinityNorm();
    const diffNorm: number = Math.abs(thisNorm - correctNorm);
    return diffNorm;
  }
  getTranslation(): Vector3 {
    const z: number = this.#values[14]!;
    const y: number = this.#values[13]!;
    const x: number = this.#values[12]!;
    return new Vector3(x, y, z);
  }
  setTranslation(t: Vector3): void {
    const tStorage: Float64Array = numericObjectStorage(t, 'Vector3');
    const z: number = tStorage[2]!;
    const y: number = tStorage[1]!;
    const x: number = tStorage[0]!;
    this.#values[14]! = z;
    this.#values[13]! = y;
    this.#values[12]! = x;
  }
  setTranslationRaw(x: number, y: number, z: number): void {
    this.#values[14]! = z;
    this.#values[13]! = y;
    this.#values[12]! = x;
  }
  getRotation(): Matrix3 {
    const r = Matrix3.zero();
    this.copyRotation(r);
    return r;
  }
  copyRotation(rotation: Matrix3): void {
    const rStorage: Float64Array = numericObjectStorage(rotation, 'Matrix3');
    rStorage[0]! = this.#values[0]!;
    rStorage[1]! = this.#values[1]!;
    rStorage[2]! = this.#values[2]!;
    rStorage[3]! = this.#values[4]!;
    rStorage[4]! = this.#values[5]!;
    rStorage[5]! = this.#values[6]!;
    rStorage[6]! = this.#values[8]!;
    rStorage[7]! = this.#values[9]!;
    rStorage[8]! = this.#values[10]!;
  }
  setRotation(r: Matrix3): void {
    const rStorage: Float64Array = numericObjectStorage(r, 'Matrix3');
    this.#values[0]! = rStorage[0]!;
    this.#values[1]! = rStorage[1]!;
    this.#values[2]! = rStorage[2]!;
    this.#values[4]! = rStorage[3]!;
    this.#values[5]! = rStorage[4]!;
    this.#values[6]! = rStorage[5]!;
    this.#values[8]! = rStorage[6]!;
    this.#values[9]! = rStorage[7]!;
    this.#values[10]! = rStorage[8]!;
  }
  getNormalMatrix(): Matrix3 {
    return (() => {
      const cascade23 = Matrix3.identity();
      cascade23.copyNormalMatrix(this);
      return cascade23;
    })();
  }
  getMaxScaleOnAxis(): number {
    const scaleXSq: number =
      this.#values[0]! * this.#values[0]! +
      this.#values[1]! * this.#values[1]! +
      this.#values[2]! * this.#values[2]!;
    const scaleYSq: number =
      this.#values[4]! * this.#values[4]! +
      this.#values[5]! * this.#values[5]! +
      this.#values[6]! * this.#values[6]!;
    const scaleZSq: number =
      this.#values[8]! * this.#values[8]! +
      this.#values[9]! * this.#values[9]! +
      this.#values[10]! * this.#values[10]!;
    return Math.sqrt(Math.max(scaleXSq, Math.max(scaleYSq, scaleZSq)));
  }
  transposeRotation(): void {
    let temp: number;
    temp = this.#values[1]!;
    this.#values[1]! = this.#values[4]!;
    this.#values[4]! = temp;
    temp = this.#values[2]!;
    this.#values[2]! = this.#values[8]!;
    this.#values[8]! = temp;
    temp = this.#values[4]!;
    this.#values[4]! = this.#values[1]!;
    this.#values[1]! = temp;
    temp = this.#values[6]!;
    this.#values[6]! = this.#values[9]!;
    this.#values[9]! = temp;
    temp = this.#values[8]!;
    this.#values[8]! = this.#values[2]!;
    this.#values[2]! = temp;
    temp = this.#values[9]!;
    this.#values[9]! = this.#values[6]!;
    this.#values[6]! = temp;
  }
  invert(): number {
    return this.copyInverse(this);
  }
  copyInverse(arg: Matrix4): number {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    const a00: number = argStorage[0]!;
    const a01: number = argStorage[1]!;
    const a02: number = argStorage[2]!;
    const a03: number = argStorage[3]!;
    const a10: number = argStorage[4]!;
    const a11: number = argStorage[5]!;
    const a12: number = argStorage[6]!;
    const a13: number = argStorage[7]!;
    const a20: number = argStorage[8]!;
    const a21: number = argStorage[9]!;
    const a22: number = argStorage[10]!;
    const a23: number = argStorage[11]!;
    const a30: number = argStorage[12]!;
    const a31: number = argStorage[13]!;
    const a32: number = argStorage[14]!;
    const a33: number = argStorage[15]!;
    const b00: number = a00 * a11 - a01 * a10;
    const b01: number = a00 * a12 - a02 * a10;
    const b02: number = a00 * a13 - a03 * a10;
    const b03: number = a01 * a12 - a02 * a11;
    const b04: number = a01 * a13 - a03 * a11;
    const b05: number = a02 * a13 - a03 * a12;
    const b06: number = a20 * a31 - a21 * a30;
    const b07: number = a20 * a32 - a22 * a30;
    const b08: number = a20 * a33 - a23 * a30;
    const b09: number = a21 * a32 - a22 * a31;
    const b10: number = a21 * a33 - a23 * a31;
    const b11: number = a22 * a33 - a23 * a32;
    const det: number = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (det === 0.0) {
      this.setFrom(arg);
      return 0.0;
    }
    const invDet: number = 1.0 / det;
    const storage = this.#values;
    storage[0]! = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
    storage[1]! = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
    storage[2]! = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
    storage[3]! = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
    storage[4]! = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
    storage[5]! = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
    storage[6]! = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
    storage[7]! = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
    storage[8]! = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
    storage[9]! = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
    storage[10]! = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
    storage[11]! = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
    storage[12]! = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
    storage[13]! = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
    storage[14]! = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
    storage[15]! = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
    return det;
  }
  invertRotation(): number {
    const det: number = this.determinant();
    if (det === 0.0) {
      return 0.0;
    }
    const invDet: number = 1.0 / det;
    let ix: number;
    let iy: number;
    let iz: number;
    let jx: number;
    let jy: number;
    let jz: number;
    let kx: number;
    let ky: number;
    let kz: number;
    ix = invDet * (this.#values[5]! * this.#values[10]! - this.#values[6]! * this.#values[9]!);
    iy = invDet * (this.#values[2]! * this.#values[9]! - this.#values[1]! * this.#values[10]!);
    iz = invDet * (this.#values[1]! * this.#values[6]! - this.#values[2]! * this.#values[5]!);
    jx = invDet * (this.#values[6]! * this.#values[8]! - this.#values[4]! * this.#values[10]!);
    jy = invDet * (this.#values[0]! * this.#values[10]! - this.#values[2]! * this.#values[8]!);
    jz = invDet * (this.#values[2]! * this.#values[4]! - this.#values[0]! * this.#values[6]!);
    kx = invDet * (this.#values[4]! * this.#values[9]! - this.#values[5]! * this.#values[8]!);
    ky = invDet * (this.#values[1]! * this.#values[8]! - this.#values[0]! * this.#values[9]!);
    kz = invDet * (this.#values[0]! * this.#values[5]! - this.#values[1]! * this.#values[4]!);
    this.#values[0]! = ix;
    this.#values[1]! = iy;
    this.#values[2]! = iz;
    this.#values[4]! = jx;
    this.#values[5]! = jy;
    this.#values[6]! = jz;
    this.#values[8]! = kx;
    this.#values[9]! = ky;
    this.#values[10]! = kz;
    return det;
  }
  setRotationX(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = 1.0;
    this.#values[1]! = 0.0;
    this.#values[2]! = 0.0;
    this.#values[4]! = 0.0;
    this.#values[5]! = c;
    this.#values[6]! = s;
    this.#values[8]! = 0.0;
    this.#values[9]! = -s;
    this.#values[10]! = c;
    this.#values[3]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[11]! = 0.0;
  }
  setRotationY(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = c;
    this.#values[1]! = 0.0;
    this.#values[2]! = -s;
    this.#values[4]! = 0.0;
    this.#values[5]! = 1.0;
    this.#values[6]! = 0.0;
    this.#values[8]! = s;
    this.#values[9]! = 0.0;
    this.#values[10]! = c;
    this.#values[3]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[11]! = 0.0;
  }
  setRotationZ(radians: number): void {
    const c: number = Math.cos(radians);
    const s: number = Math.sin(radians);
    this.#values[0]! = c;
    this.#values[1]! = s;
    this.#values[2]! = 0.0;
    this.#values[4]! = -s;
    this.#values[5]! = c;
    this.#values[6]! = 0.0;
    this.#values[8]! = 0.0;
    this.#values[9]! = 0.0;
    this.#values[10]! = 1.0;
    this.#values[3]! = 0.0;
    this.#values[7]! = 0.0;
    this.#values[11]! = 0.0;
  }
  scaleAdjoint(scale: number): void {
    const a1: number = this.#values[0]!;
    const b1: number = this.#values[4]!;
    const c1: number = this.#values[8]!;
    const d1: number = this.#values[12]!;
    const a2: number = this.#values[1]!;
    const b2: number = this.#values[5]!;
    const c2: number = this.#values[9]!;
    const d2: number = this.#values[13]!;
    const a3: number = this.#values[2]!;
    const b3: number = this.#values[6]!;
    const c3: number = this.#values[10]!;
    const d3: number = this.#values[14]!;
    const a4: number = this.#values[3]!;
    const b4: number = this.#values[7]!;
    const c4: number = this.#values[11]!;
    const d4: number = this.#values[15]!;
    this.#values[0]! =
      (b2 * (c3 * d4 - c4 * d3) - c2 * (b3 * d4 - b4 * d3) + d2 * (b3 * c4 - b4 * c3)) * scale;
    this.#values[1]! =
      -(a2 * (c3 * d4 - c4 * d3) - c2 * (a3 * d4 - a4 * d3) + d2 * (a3 * c4 - a4 * c3)) * scale;
    this.#values[2]! =
      (a2 * (b3 * d4 - b4 * d3) - b2 * (a3 * d4 - a4 * d3) + d2 * (a3 * b4 - a4 * b3)) * scale;
    this.#values[3]! =
      -(a2 * (b3 * c4 - b4 * c3) - b2 * (a3 * c4 - a4 * c3) + c2 * (a3 * b4 - a4 * b3)) * scale;
    this.#values[4]! =
      -(b1 * (c3 * d4 - c4 * d3) - c1 * (b3 * d4 - b4 * d3) + d1 * (b3 * c4 - b4 * c3)) * scale;
    this.#values[5]! =
      (a1 * (c3 * d4 - c4 * d3) - c1 * (a3 * d4 - a4 * d3) + d1 * (a3 * c4 - a4 * c3)) * scale;
    this.#values[6]! =
      -(a1 * (b3 * d4 - b4 * d3) - b1 * (a3 * d4 - a4 * d3) + d1 * (a3 * b4 - a4 * b3)) * scale;
    this.#values[7]! =
      (a1 * (b3 * c4 - b4 * c3) - b1 * (a3 * c4 - a4 * c3) + c1 * (a3 * b4 - a4 * b3)) * scale;
    this.#values[8]! =
      (b1 * (c2 * d4 - c4 * d2) - c1 * (b2 * d4 - b4 * d2) + d1 * (b2 * c4 - b4 * c2)) * scale;
    this.#values[9]! =
      -(a1 * (c2 * d4 - c4 * d2) - c1 * (a2 * d4 - a4 * d2) + d1 * (a2 * c4 - a4 * c2)) * scale;
    this.#values[10]! =
      (a1 * (b2 * d4 - b4 * d2) - b1 * (a2 * d4 - a4 * d2) + d1 * (a2 * b4 - a4 * b2)) * scale;
    this.#values[11]! =
      -(a1 * (b2 * c4 - b4 * c2) - b1 * (a2 * c4 - a4 * c2) + c1 * (a2 * b4 - a4 * b2)) * scale;
    this.#values[12]! =
      -(b1 * (c2 * d3 - c3 * d2) - c1 * (b2 * d3 - b3 * d2) + d1 * (b2 * c3 - b3 * c2)) * scale;
    this.#values[13]! =
      (a1 * (c2 * d3 - c3 * d2) - c1 * (a2 * d3 - a3 * d2) + d1 * (a2 * c3 - a3 * c2)) * scale;
    this.#values[14]! =
      -(a1 * (b2 * d3 - b3 * d2) - b1 * (a2 * d3 - a3 * d2) + d1 * (a2 * b3 - a3 * b2)) * scale;
    this.#values[15]! =
      (a1 * (b2 * c3 - b3 * c2) - b1 * (a2 * c3 - a3 * c2) + c1 * (a2 * b3 - a3 * b2)) * scale;
  }
  absoluteRotate(arg: Vector3): Vector3 {
    const m00: number = Math.abs(this.#values[0]!);
    const m01: number = Math.abs(this.#values[4]!);
    const m02: number = Math.abs(this.#values[8]!);
    const m10: number = Math.abs(this.#values[1]!);
    const m11: number = Math.abs(this.#values[5]!);
    const m12: number = Math.abs(this.#values[9]!);
    const m20: number = Math.abs(this.#values[2]!);
    const m21: number = Math.abs(this.#values[6]!);
    const m22: number = Math.abs(this.#values[10]!);
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x: number = argStorage[0]!;
    const y: number = argStorage[1]!;
    const z: number = argStorage[2]!;
    argStorage[0]! = x * m00 + y * m01 + z * m02 + 0.0;
    argStorage[1]! = x * m10 + y * m11 + z * m12 + 0.0;
    argStorage[2]! = x * m20 + y * m21 + z * m22 + 0.0;
    return arg;
  }
  add(o: Matrix4): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix4');
    this.#values[0]! = this.#values[0]! + oStorage[0]!;
    this.#values[1]! = this.#values[1]! + oStorage[1]!;
    this.#values[2]! = this.#values[2]! + oStorage[2]!;
    this.#values[3]! = this.#values[3]! + oStorage[3]!;
    this.#values[4]! = this.#values[4]! + oStorage[4]!;
    this.#values[5]! = this.#values[5]! + oStorage[5]!;
    this.#values[6]! = this.#values[6]! + oStorage[6]!;
    this.#values[7]! = this.#values[7]! + oStorage[7]!;
    this.#values[8]! = this.#values[8]! + oStorage[8]!;
    this.#values[9]! = this.#values[9]! + oStorage[9]!;
    this.#values[10]! = this.#values[10]! + oStorage[10]!;
    this.#values[11]! = this.#values[11]! + oStorage[11]!;
    this.#values[12]! = this.#values[12]! + oStorage[12]!;
    this.#values[13]! = this.#values[13]! + oStorage[13]!;
    this.#values[14]! = this.#values[14]! + oStorage[14]!;
    this.#values[15]! = this.#values[15]! + oStorage[15]!;
  }
  sub(o: Matrix4): void {
    const oStorage: Float64Array = numericObjectStorage(o, 'Matrix4');
    this.#values[0]! = this.#values[0]! - oStorage[0]!;
    this.#values[1]! = this.#values[1]! - oStorage[1]!;
    this.#values[2]! = this.#values[2]! - oStorage[2]!;
    this.#values[3]! = this.#values[3]! - oStorage[3]!;
    this.#values[4]! = this.#values[4]! - oStorage[4]!;
    this.#values[5]! = this.#values[5]! - oStorage[5]!;
    this.#values[6]! = this.#values[6]! - oStorage[6]!;
    this.#values[7]! = this.#values[7]! - oStorage[7]!;
    this.#values[8]! = this.#values[8]! - oStorage[8]!;
    this.#values[9]! = this.#values[9]! - oStorage[9]!;
    this.#values[10]! = this.#values[10]! - oStorage[10]!;
    this.#values[11]! = this.#values[11]! - oStorage[11]!;
    this.#values[12]! = this.#values[12]! - oStorage[12]!;
    this.#values[13]! = this.#values[13]! - oStorage[13]!;
    this.#values[14]! = this.#values[14]! - oStorage[14]!;
    this.#values[15]! = this.#values[15]! - oStorage[15]!;
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
    this.#values[9]! = -this.#values[9]!;
    this.#values[10]! = -this.#values[10]!;
    this.#values[11]! = -this.#values[11]!;
    this.#values[12]! = -this.#values[12]!;
    this.#values[13]! = -this.#values[13]!;
    this.#values[14]! = -this.#values[14]!;
    this.#values[15]! = -this.#values[15]!;
  }
  multiply(arg: Matrix4): void {
    const storage = this.#values;
    const m00: number = storage[0]!;
    const m01: number = storage[4]!;
    const m02: number = storage[8]!;
    const m03: number = storage[12]!;
    const m10: number = storage[1]!;
    const m11: number = storage[5]!;
    const m12: number = storage[9]!;
    const m13: number = storage[13]!;
    const m20: number = storage[2]!;
    const m21: number = storage[6]!;
    const m22: number = storage[10]!;
    const m23: number = storage[14]!;
    const m30: number = storage[3]!;
    const m31: number = storage[7]!;
    const m32: number = storage[11]!;
    const m33: number = storage[15]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    const n00: number = argStorage[0]!;
    const n01: number = argStorage[4]!;
    const n02: number = argStorage[8]!;
    const n03: number = argStorage[12]!;
    const n10: number = argStorage[1]!;
    const n11: number = argStorage[5]!;
    const n12: number = argStorage[9]!;
    const n13: number = argStorage[13]!;
    const n20: number = argStorage[2]!;
    const n21: number = argStorage[6]!;
    const n22: number = argStorage[10]!;
    const n23: number = argStorage[14]!;
    const n30: number = argStorage[3]!;
    const n31: number = argStorage[7]!;
    const n32: number = argStorage[11]!;
    const n33: number = argStorage[15]!;
    storage[0]! = m00 * n00 + m01 * n10 + m02 * n20 + m03 * n30;
    storage[4]! = m00 * n01 + m01 * n11 + m02 * n21 + m03 * n31;
    storage[8]! = m00 * n02 + m01 * n12 + m02 * n22 + m03 * n32;
    storage[12]! = m00 * n03 + m01 * n13 + m02 * n23 + m03 * n33;
    storage[1]! = m10 * n00 + m11 * n10 + m12 * n20 + m13 * n30;
    storage[5]! = m10 * n01 + m11 * n11 + m12 * n21 + m13 * n31;
    storage[9]! = m10 * n02 + m11 * n12 + m12 * n22 + m13 * n32;
    storage[13]! = m10 * n03 + m11 * n13 + m12 * n23 + m13 * n33;
    storage[2]! = m20 * n00 + m21 * n10 + m22 * n20 + m23 * n30;
    storage[6]! = m20 * n01 + m21 * n11 + m22 * n21 + m23 * n31;
    storage[10]! = m20 * n02 + m21 * n12 + m22 * n22 + m23 * n32;
    storage[14]! = m20 * n03 + m21 * n13 + m22 * n23 + m23 * n33;
    storage[3]! = m30 * n00 + m31 * n10 + m32 * n20 + m33 * n30;
    storage[7]! = m30 * n01 + m31 * n11 + m32 * n21 + m33 * n31;
    storage[11]! = m30 * n02 + m31 * n12 + m32 * n22 + m33 * n32;
    storage[15]! = m30 * n03 + m31 * n13 + m32 * n23 + m33 * n33;
  }
  leftMultiply(arg: Matrix4): void {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    const m00: number = argStorage[0]!;
    const m01: number = argStorage[4]!;
    const m02: number = argStorage[8]!;
    const m03: number = argStorage[12]!;
    const m10: number = argStorage[1]!;
    const m11: number = argStorage[5]!;
    const m12: number = argStorage[9]!;
    const m13: number = argStorage[13]!;
    const m20: number = argStorage[2]!;
    const m21: number = argStorage[6]!;
    const m22: number = argStorage[10]!;
    const m23: number = argStorage[14]!;
    const m30: number = argStorage[3]!;
    const m31: number = argStorage[7]!;
    const m32: number = argStorage[11]!;
    const m33: number = argStorage[15]!;
    const bStorage: Float64Array = this.#values;
    const n00: number = bStorage[0]!;
    const n01: number = bStorage[4]!;
    const n02: number = bStorage[8]!;
    const n03: number = bStorage[12]!;
    const n10: number = bStorage[1]!;
    const n11: number = bStorage[5]!;
    const n12: number = bStorage[9]!;
    const n13: number = bStorage[13]!;
    const n20: number = bStorage[2]!;
    const n21: number = bStorage[6]!;
    const n22: number = bStorage[10]!;
    const n23: number = bStorage[14]!;
    const n30: number = bStorage[3]!;
    const n31: number = bStorage[7]!;
    const n32: number = bStorage[11]!;
    const n33: number = bStorage[15]!;
    bStorage[0]! = m00 * n00 + m01 * n10 + m02 * n20 + m03 * n30;
    bStorage[4]! = m00 * n01 + m01 * n11 + m02 * n21 + m03 * n31;
    bStorage[8]! = m00 * n02 + m01 * n12 + m02 * n22 + m03 * n32;
    bStorage[12]! = m00 * n03 + m01 * n13 + m02 * n23 + m03 * n33;
    bStorage[1]! = m10 * n00 + m11 * n10 + m12 * n20 + m13 * n30;
    bStorage[5]! = m10 * n01 + m11 * n11 + m12 * n21 + m13 * n31;
    bStorage[9]! = m10 * n02 + m11 * n12 + m12 * n22 + m13 * n32;
    bStorage[13]! = m10 * n03 + m11 * n13 + m12 * n23 + m13 * n33;
    bStorage[2]! = m20 * n00 + m21 * n10 + m22 * n20 + m23 * n30;
    bStorage[6]! = m20 * n01 + m21 * n11 + m22 * n21 + m23 * n31;
    bStorage[10]! = m20 * n02 + m21 * n12 + m22 * n22 + m23 * n32;
    bStorage[14]! = m20 * n03 + m21 * n13 + m22 * n23 + m23 * n33;
    bStorage[3]! = m30 * n00 + m31 * n10 + m32 * n20 + m33 * n30;
    bStorage[7]! = m30 * n01 + m31 * n11 + m32 * n21 + m33 * n31;
    bStorage[11]! = m30 * n02 + m31 * n12 + m32 * n22 + m33 * n32;
    bStorage[15]! = m30 * n03 + m31 * n13 + m32 * n23 + m33 * n33;
  }
  multiplied(arg: Matrix4): Matrix4 {
    return (() => {
      const cascade24 = this.clone();
      cascade24.multiply(arg);
      return cascade24;
    })();
  }
  transposeMultiply(arg: Matrix4): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[1]!;
    const m02: number = this.#values[2]!;
    const m03: number = this.#values[3]!;
    const m10: number = this.#values[4]!;
    const m11: number = this.#values[5]!;
    const m12: number = this.#values[6]!;
    const m13: number = this.#values[7]!;
    const m20: number = this.#values[8]!;
    const m21: number = this.#values[9]!;
    const m22: number = this.#values[10]!;
    const m23: number = this.#values[11]!;
    const m30: number = this.#values[12]!;
    const m31: number = this.#values[13]!;
    const m32: number = this.#values[14]!;
    const m33: number = this.#values[15]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    this.#values[0]! =
      m00 * argStorage[0]! + m01 * argStorage[1]! + m02 * argStorage[2]! + m03 * argStorage[3]!;
    this.#values[4]! =
      m00 * argStorage[4]! + m01 * argStorage[5]! + m02 * argStorage[6]! + m03 * argStorage[7]!;
    this.#values[8]! =
      m00 * argStorage[8]! + m01 * argStorage[9]! + m02 * argStorage[10]! + m03 * argStorage[11]!;
    this.#values[12]! =
      m00 * argStorage[12]! + m01 * argStorage[13]! + m02 * argStorage[14]! + m03 * argStorage[15]!;
    this.#values[1]! =
      m10 * argStorage[0]! + m11 * argStorage[1]! + m12 * argStorage[2]! + m13 * argStorage[3]!;
    this.#values[5]! =
      m10 * argStorage[4]! + m11 * argStorage[5]! + m12 * argStorage[6]! + m13 * argStorage[7]!;
    this.#values[9]! =
      m10 * argStorage[8]! + m11 * argStorage[9]! + m12 * argStorage[10]! + m13 * argStorage[11]!;
    this.#values[13]! =
      m10 * argStorage[12]! + m11 * argStorage[13]! + m12 * argStorage[14]! + m13 * argStorage[15]!;
    this.#values[2]! =
      m20 * argStorage[0]! + m21 * argStorage[1]! + m22 * argStorage[2]! + m23 * argStorage[3]!;
    this.#values[6]! =
      m20 * argStorage[4]! + m21 * argStorage[5]! + m22 * argStorage[6]! + m23 * argStorage[7]!;
    this.#values[10]! =
      m20 * argStorage[8]! + m21 * argStorage[9]! + m22 * argStorage[10]! + m23 * argStorage[11]!;
    this.#values[14]! =
      m20 * argStorage[12]! + m21 * argStorage[13]! + m22 * argStorage[14]! + m23 * argStorage[15]!;
    this.#values[3]! =
      m30 * argStorage[0]! + m31 * argStorage[1]! + m32 * argStorage[2]! + m33 * argStorage[3]!;
    this.#values[7]! =
      m30 * argStorage[4]! + m31 * argStorage[5]! + m32 * argStorage[6]! + m33 * argStorage[7]!;
    this.#values[11]! =
      m30 * argStorage[8]! + m31 * argStorage[9]! + m32 * argStorage[10]! + m33 * argStorage[11]!;
    this.#values[15]! =
      m30 * argStorage[12]! + m31 * argStorage[13]! + m32 * argStorage[14]! + m33 * argStorage[15]!;
  }
  multiplyTranspose(arg: Matrix4): void {
    const m00: number = this.#values[0]!;
    const m01: number = this.#values[4]!;
    const m02: number = this.#values[8]!;
    const m03: number = this.#values[12]!;
    const m10: number = this.#values[1]!;
    const m11: number = this.#values[5]!;
    const m12: number = this.#values[9]!;
    const m13: number = this.#values[13]!;
    const m20: number = this.#values[2]!;
    const m21: number = this.#values[6]!;
    const m22: number = this.#values[10]!;
    const m23: number = this.#values[14]!;
    const m30: number = this.#values[3]!;
    const m31: number = this.#values[7]!;
    const m32: number = this.#values[11]!;
    const m33: number = this.#values[15]!;
    const argStorage: Float64Array = numericObjectStorage(arg, 'Matrix4');
    this.#values[0]! =
      m00 * argStorage[0]! + m01 * argStorage[4]! + m02 * argStorage[8]! + m03 * argStorage[12]!;
    this.#values[4]! =
      m00 * argStorage[1]! + m01 * argStorage[5]! + m02 * argStorage[9]! + m03 * argStorage[13]!;
    this.#values[8]! =
      m00 * argStorage[2]! + m01 * argStorage[6]! + m02 * argStorage[10]! + m03 * argStorage[14]!;
    this.#values[12]! =
      m00 * argStorage[3]! + m01 * argStorage[7]! + m02 * argStorage[11]! + m03 * argStorage[15]!;
    this.#values[1]! =
      m10 * argStorage[0]! + m11 * argStorage[4]! + m12 * argStorage[8]! + m13 * argStorage[12]!;
    this.#values[5]! =
      m10 * argStorage[1]! + m11 * argStorage[5]! + m12 * argStorage[9]! + m13 * argStorage[13]!;
    this.#values[9]! =
      m10 * argStorage[2]! + m11 * argStorage[6]! + m12 * argStorage[10]! + m13 * argStorage[14]!;
    this.#values[13]! =
      m10 * argStorage[3]! + m11 * argStorage[7]! + m12 * argStorage[11]! + m13 * argStorage[15]!;
    this.#values[2]! =
      m20 * argStorage[0]! + m21 * argStorage[4]! + m22 * argStorage[8]! + m23 * argStorage[12]!;
    this.#values[6]! =
      m20 * argStorage[1]! + m21 * argStorage[5]! + m22 * argStorage[9]! + m23 * argStorage[13]!;
    this.#values[10]! =
      m20 * argStorage[2]! + m21 * argStorage[6]! + m22 * argStorage[10]! + m23 * argStorage[14]!;
    this.#values[14]! =
      m20 * argStorage[3]! + m21 * argStorage[7]! + m22 * argStorage[11]! + m23 * argStorage[15]!;
    this.#values[3]! =
      m30 * argStorage[0]! + m31 * argStorage[4]! + m32 * argStorage[8]! + m33 * argStorage[12]!;
    this.#values[7]! =
      m30 * argStorage[1]! + m31 * argStorage[5]! + m32 * argStorage[9]! + m33 * argStorage[13]!;
    this.#values[11]! =
      m30 * argStorage[2]! + m31 * argStorage[6]! + m32 * argStorage[10]! + m33 * argStorage[14]!;
    this.#values[15]! =
      m30 * argStorage[3]! + m31 * argStorage[7]! + m32 * argStorage[11]! + m33 * argStorage[15]!;
  }
  decompose(translation: Vector3, rotation: Quaternion, scale: Vector3): void {
    const v: Vector3 = (Matrix4._decomposeV ??= Vector3.zero());
    let sx: number = (() => {
      const cascade25 = v;
      cascade25.setValues(this.#values[0]!, this.#values[1]!, this.#values[2]!);
      return cascade25;
    })().length;
    const sy: number = (() => {
      const cascade26 = v;
      cascade26.setValues(this.#values[4]!, this.#values[5]!, this.#values[6]!);
      return cascade26;
    })().length;
    const sz: number = (() => {
      const cascade27 = v;
      cascade27.setValues(this.#values[8]!, this.#values[9]!, this.#values[10]!);
      return cascade27;
    })().length;
    if (this.determinant() < 0) {
      sx = -sx;
    }
    numericObjectStorage(translation, 'Vector3')[0]! = this.#values[12]!;
    numericObjectStorage(translation, 'Vector3')[1]! = this.#values[13]!;
    numericObjectStorage(translation, 'Vector3')[2]! = this.#values[14]!;
    const invSX: number = 1.0 / sx;
    const invSY: number = 1.0 / sy;
    const invSZ: number = 1.0 / sz;
    const m: Matrix4 = (Matrix4._decomposeM ??= Matrix4.zero());
    m.setFrom(this);
    numericObjectStorage(m, 'Matrix4')[0]! *= invSX;
    numericObjectStorage(m, 'Matrix4')[1]! *= invSX;
    numericObjectStorage(m, 'Matrix4')[2]! *= invSX;
    numericObjectStorage(m, 'Matrix4')[4]! *= invSY;
    numericObjectStorage(m, 'Matrix4')[5]! *= invSY;
    numericObjectStorage(m, 'Matrix4')[6]! *= invSY;
    numericObjectStorage(m, 'Matrix4')[8]! *= invSZ;
    numericObjectStorage(m, 'Matrix4')[9]! *= invSZ;
    numericObjectStorage(m, 'Matrix4')[10]! *= invSZ;
    const r: Matrix3 = (Matrix4._decomposeR ??= Matrix3.zero());
    m.copyRotation(r);
    rotation.setFromRotation(r);
    numericObjectStorage(scale, 'Vector3')[0]! = sx;
    numericObjectStorage(scale, 'Vector3')[1]! = sy;
    numericObjectStorage(scale, 'Vector3')[2]! = sz;
  }
  private static _decomposeV: Vector3 | null = null;
  private static _decomposeM: Matrix4 | null = null;
  private static _decomposeR: Matrix3 | null = null;
  rotate3(arg: Vector3): Vector3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x_: number =
      this.#values[0]! * argStorage[0]! +
      this.#values[4]! * argStorage[1]! +
      this.#values[8]! * argStorage[2]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! +
      this.#values[5]! * argStorage[1]! +
      this.#values[9]! * argStorage[2]!;
    const z_: number =
      this.#values[2]! * argStorage[0]! +
      this.#values[6]! * argStorage[1]! +
      this.#values[10]! * argStorage[2]!;
    argStorage[0]! = x_;
    argStorage[1]! = y_;
    argStorage[2]! = z_;
    return arg;
  }
  rotated3(arg: Vector3, out: Vector3 | null = null): Vector3 {
    if (out === null) {
      out = Vector3.copy(arg);
    } else {
      out.setFrom(arg);
    }
    return this.rotate3(out);
  }
  transform3(arg: Vector3): Vector3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x_: number =
      this.#values[0]! * argStorage[0]! +
      this.#values[4]! * argStorage[1]! +
      this.#values[8]! * argStorage[2]! +
      this.#values[12]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! +
      this.#values[5]! * argStorage[1]! +
      this.#values[9]! * argStorage[2]! +
      this.#values[13]!;
    const z_: number =
      this.#values[2]! * argStorage[0]! +
      this.#values[6]! * argStorage[1]! +
      this.#values[10]! * argStorage[2]! +
      this.#values[14]!;
    argStorage[0]! = x_;
    argStorage[1]! = y_;
    argStorage[2]! = z_;
    return arg;
  }
  transformed3(arg: Vector3, out: Vector3 | null = null): Vector3 {
    if (out === null) {
      out = Vector3.copy(arg);
    } else {
      out.setFrom(arg);
    }
    return this.transform3(out);
  }
  transform(arg: Vector4): Vector4 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector4');
    const x_: number =
      this.#values[0]! * argStorage[0]! +
      this.#values[4]! * argStorage[1]! +
      this.#values[8]! * argStorage[2]! +
      this.#values[12]! * argStorage[3]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! +
      this.#values[5]! * argStorage[1]! +
      this.#values[9]! * argStorage[2]! +
      this.#values[13]! * argStorage[3]!;
    const z_: number =
      this.#values[2]! * argStorage[0]! +
      this.#values[6]! * argStorage[1]! +
      this.#values[10]! * argStorage[2]! +
      this.#values[14]! * argStorage[3]!;
    const w_: number =
      this.#values[3]! * argStorage[0]! +
      this.#values[7]! * argStorage[1]! +
      this.#values[11]! * argStorage[2]! +
      this.#values[15]! * argStorage[3]!;
    argStorage[0]! = x_;
    argStorage[1]! = y_;
    argStorage[2]! = z_;
    argStorage[3]! = w_;
    return arg;
  }
  perspectiveTransform(arg: Vector3): Vector3 {
    const argStorage: Float64Array = numericObjectStorage(arg, 'Vector3');
    const x_: number =
      this.#values[0]! * argStorage[0]! +
      this.#values[4]! * argStorage[1]! +
      this.#values[8]! * argStorage[2]! +
      this.#values[12]!;
    const y_: number =
      this.#values[1]! * argStorage[0]! +
      this.#values[5]! * argStorage[1]! +
      this.#values[9]! * argStorage[2]! +
      this.#values[13]!;
    const z_: number =
      this.#values[2]! * argStorage[0]! +
      this.#values[6]! * argStorage[1]! +
      this.#values[10]! * argStorage[2]! +
      this.#values[14]!;
    const w_: number =
      1.0 /
      (this.#values[3]! * argStorage[0]! +
        this.#values[7]! * argStorage[1]! +
        this.#values[11]! * argStorage[2]! +
        this.#values[15]!);
    argStorage[0]! = x_ * w_;
    argStorage[1]! = y_ * w_;
    argStorage[2]! = z_ * w_;
    return arg;
  }
  transformed(arg: Vector4, out: Vector4 | null = null): Vector4 {
    if (out === null) {
      out = Vector4.copy(arg);
    } else {
      out.setFrom(arg);
    }
    return this.transform(out);
  }
  copyIntoArray(array: number[] | Float64Array, offset: number = 0): void {
    array = numericArrayRange(array, offset, 16);
    const i = offset;
    array[i + 15]! = this.#values[15]!;
    array[i + 14]! = this.#values[14]!;
    array[i + 13]! = this.#values[13]!;
    array[i + 12]! = this.#values[12]!;
    array[i + 11]! = this.#values[11]!;
    array[i + 10]! = this.#values[10]!;
    array[i + 9]! = this.#values[9]!;
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
    array = numericArrayRange(array, offset, 16);
    const i = offset;
    this.#values[15]! = array[i + 15]!;
    this.#values[14]! = array[i + 14]!;
    this.#values[13]! = array[i + 13]!;
    this.#values[12]! = array[i + 12]!;
    this.#values[11]! = array[i + 11]!;
    this.#values[10]! = array[i + 10]!;
    this.#values[9]! = array[i + 9]!;
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
        const cascade28 = Vector3.array(array, j);
        cascade28.applyMatrix4(this);
        return cascade28;
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
    const x: number = this.#values[4]!;
    const y: number = this.#values[5]!;
    const z: number = this.#values[6]!;
    return new Vector3(x, y, z);
  }
  get forward(): Vector3 {
    const x: number = this.#values[8]!;
    const y: number = this.#values[9]!;
    const z: number = this.#values[10]!;
    return new Vector3(x, y, z);
  }
  isIdentity(): boolean {
    return (
      this.#values[0]! === 1.0 &&
      this.#values[1]! === 0.0 &&
      this.#values[2]! === 0.0 &&
      this.#values[3]! === 0.0 &&
      this.#values[4]! === 0.0 &&
      this.#values[5]! === 1.0 &&
      this.#values[6]! === 0.0 &&
      this.#values[7]! === 0.0 &&
      this.#values[8]! === 0.0 &&
      this.#values[9]! === 0.0 &&
      this.#values[10]! === 1.0 &&
      this.#values[11]! === 0.0 &&
      this.#values[12]! === 0.0 &&
      this.#values[13]! === 0.0 &&
      this.#values[14]! === 0.0 &&
      this.#values[15]! === 1.0
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
      this.#values[8]! === 0.0 &&
      this.#values[9]! === 0.0 &&
      this.#values[10]! === 0.0 &&
      this.#values[11]! === 0.0 &&
      this.#values[12]! === 0.0 &&
      this.#values[13]! === 0.0 &&
      this.#values[14]! === 0.0 &&
      this.#values[15]! === 0.0
    );
  }
}
