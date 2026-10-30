// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/painting/matrix_utils.dart; SHA256 a017d3af30f73868861159dbffeb58d89617b1d871db146ddd2f30768965ea78
import { Matrix4 } from '../../math/matrix4.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
export class MatrixUtilsBase {
  protected constructor() {}
  private static readonly _minMax: Float64Array = new Float64Array(4);
  static multiplyInPlace(a: Matrix4, b: Matrix4): void {
    const aStorage: Float64Array = a.storage;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m00: number = aStorage[0]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m01: number = aStorage[4]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m02: number = aStorage[8]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m03: number = aStorage[12]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m10: number = aStorage[1]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m11: number = aStorage[5]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m12: number = aStorage[9]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m13: number = aStorage[13]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m20: number = aStorage[2]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m21: number = aStorage[6]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m22: number = aStorage[10]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m23: number = aStorage[14]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m30: number = aStorage[3]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m31: number = aStorage[7]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m32: number = aStorage[11]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const m33: number = aStorage[15]!;
    const bStorage: Float64Array = b.storage;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n00: number = bStorage[0]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n01: number = bStorage[4]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n02: number = bStorage[8]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n03: number = bStorage[12]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n10: number = bStorage[1]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n11: number = bStorage[5]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n12: number = bStorage[9]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n13: number = bStorage[13]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n20: number = bStorage[2]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n21: number = bStorage[6]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n22: number = bStorage[10]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n23: number = bStorage[14]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n30: number = bStorage[3]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n31: number = bStorage[7]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n32: number = bStorage[11]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const n33: number = bStorage[15]!;
    bStorage[0] = m00 * n00 + m01 * n10 + m02 * n20 + m03 * n30;
    bStorage[4] = m00 * n01 + m01 * n11 + m02 * n21 + m03 * n31;
    bStorage[8] = m00 * n02 + m01 * n12 + m02 * n22 + m03 * n32;
    bStorage[12] = m00 * n03 + m01 * n13 + m02 * n23 + m03 * n33;
    bStorage[1] = m10 * n00 + m11 * n10 + m12 * n20 + m13 * n30;
    bStorage[5] = m10 * n01 + m11 * n11 + m12 * n21 + m13 * n31;
    bStorage[9] = m10 * n02 + m11 * n12 + m12 * n22 + m13 * n32;
    bStorage[13] = m10 * n03 + m11 * n13 + m12 * n23 + m13 * n33;
    bStorage[2] = m20 * n00 + m21 * n10 + m22 * n20 + m23 * n30;
    bStorage[6] = m20 * n01 + m21 * n11 + m22 * n21 + m23 * n31;
    bStorage[10] = m20 * n02 + m21 * n12 + m22 * n22 + m23 * n32;
    bStorage[14] = m20 * n03 + m21 * n13 + m22 * n23 + m23 * n33;
    bStorage[3] = m30 * n00 + m31 * n10 + m32 * n20 + m33 * n30;
    bStorage[7] = m30 * n01 + m31 * n11 + m32 * n21 + m33 * n31;
    bStorage[11] = m30 * n02 + m31 * n12 + m32 * n22 + m33 * n32;
    bStorage[15] = m30 * n03 + m31 * n13 + m32 * n23 + m33 * n33;
  }
  static matrixEquals(a: Matrix4 | null, b: Matrix4 | null): boolean {
    if (a === b) {
      return true;
    }
    if (FoundationBuildMode.debug)
      invariant(
        a !== null || b !== null,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (a === null) {
      return MatrixUtilsBase.isIdentity(b!);
    }
    if (b === null) {
      return MatrixUtilsBase.isIdentity(a);
    }
    return (
      a.storage[0]! === b.storage[0]! &&
      a.storage[1]! === b.storage[1]! &&
      a.storage[2]! === b.storage[2]! &&
      a.storage[3]! === b.storage[3]! &&
      a.storage[4]! === b.storage[4]! &&
      a.storage[5]! === b.storage[5]! &&
      a.storage[6]! === b.storage[6]! &&
      a.storage[7]! === b.storage[7]! &&
      a.storage[8]! === b.storage[8]! &&
      a.storage[9]! === b.storage[9]! &&
      a.storage[10]! === b.storage[10]! &&
      a.storage[11]! === b.storage[11]! &&
      a.storage[12]! === b.storage[12]! &&
      a.storage[13]! === b.storage[13]! &&
      a.storage[14]! === b.storage[14]! &&
      a.storage[15]! === b.storage[15]!
    );
  }
  static isIdentity(a: Matrix4): boolean {
    return (
      a.storage[0]! === 1 &&
      a.storage[1]! === 0 &&
      a.storage[2]! === 0 &&
      a.storage[3]! === 0 &&
      a.storage[4]! === 0 &&
      a.storage[5]! === 1 &&
      a.storage[6]! === 0 &&
      a.storage[7]! === 0 &&
      a.storage[8]! === 0 &&
      a.storage[9]! === 0 &&
      a.storage[10]! === 1 &&
      a.storage[11]! === 0 &&
      a.storage[12]! === 0 &&
      a.storage[13]! === 0 &&
      a.storage[14]! === 0 &&
      a.storage[15]! === 1
    );
  }
  static transformPoint(transform: Matrix4, point: Offset): Offset {
    const storage: Float64Array = transform.storage;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const x: number = point.dx;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const y: number = point.dy;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rx: number = storage[0]! * x + storage[4]! * y + storage[12]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const ry: number = storage[1]! * x + storage[5]! * y + storage[13]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rw: number = storage[3]! * x + storage[7]! * y + storage[15]!;
    if (rw === 1) {
      return new Offset(rx, ry);
    } else {
      return new Offset(rx / rw, ry / rw);
    }
  }
  private static _safeTransformRect(transform: Matrix4, rect: Rect): Rect {
    const storage: Float64Array = transform.storage;
    const isAffine: boolean = storage[3]! === 0 && storage[7]! === 0 && storage[15]! === 1;
    MatrixUtilsBase._accumulate(storage, rect.left, rect.top, true, isAffine);
    MatrixUtilsBase._accumulate(storage, rect.right, rect.top, false, isAffine);
    MatrixUtilsBase._accumulate(storage, rect.left, rect.bottom, false, isAffine);
    MatrixUtilsBase._accumulate(storage, rect.right, rect.bottom, false, isAffine);
    return Rect.fromLTRB(
      MatrixUtilsBase._minMax[0]!,
      MatrixUtilsBase._minMax[1]!,
      MatrixUtilsBase._minMax[2]!,
      MatrixUtilsBase._minMax[3]!,
    );
  }
  /**
   * @dartParam x double
   * @dartParamOrigin x explicit
   * @dartParam y double
   * @dartParamOrigin y explicit
   */
  private static _accumulate(
    m: Float64Array,
    x: number,
    y: number,
    first: boolean,
    isAffine: boolean,
  ): void {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const w: number = isAffine ? 1 : 1 / (m[3]! * x + m[7]! * y + m[15]!);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const tx: number = (m[0]! * x + m[4]! * y + m[12]!) * w;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const ty: number = (m[1]! * x + m[5]! * y + m[13]!) * w;
    if (first) {
      MatrixUtilsBase._minMax[0] = MatrixUtilsBase._minMax[2] = tx;
      MatrixUtilsBase._minMax[1] = MatrixUtilsBase._minMax[3] = ty;
    } else {
      if (tx < MatrixUtilsBase._minMax[0]!) {
        MatrixUtilsBase._minMax[0] = tx;
      }
      if (ty < MatrixUtilsBase._minMax[1]!) {
        MatrixUtilsBase._minMax[1] = ty;
      }
      if (tx > MatrixUtilsBase._minMax[2]!) {
        MatrixUtilsBase._minMax[2] = tx;
      }
      if (ty > MatrixUtilsBase._minMax[3]!) {
        MatrixUtilsBase._minMax[3] = ty;
      }
    }
  }
  static transformRect(transform: Matrix4, rect: Rect): Rect {
    const storage: Float64Array = transform.storage;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const x: number = rect.left;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const y: number = rect.top;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const w: number = rect.right - x;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const h: number = rect.bottom - y;
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      return MatrixUtilsBase._safeTransformRect(transform, rect);
    }
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const wx: number = storage[0]! * w;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const hx: number = storage[4]! * h;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const rx: number = storage[0]! * x + storage[4]! * y + storage[12]!;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const wy: number = storage[1]! * w;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const hy: number = storage[5]! * h;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const ry: number = storage[1]! * x + storage[5]! * y + storage[13]!;
    if (storage[3]! === 0 && storage[7]! === 0 && storage[15]! === 1) {
      /**
       * @dartType double
       * @dartTypeOrigin inferred
       */
      let left: number = rx;
      /**
       * @dartType double
       * @dartTypeOrigin inferred
       */
      let right: number = rx;
      if (wx < 0) {
        left += wx;
      } else {
        right += wx;
      }
      if (hx < 0) {
        left += hx;
      } else {
        right += hx;
      }
      /**
       * @dartType double
       * @dartTypeOrigin inferred
       */
      let top: number = ry;
      /**
       * @dartType double
       * @dartTypeOrigin inferred
       */
      let bottom: number = ry;
      if (wy < 0) {
        top += wy;
      } else {
        bottom += wy;
      }
      if (hy < 0) {
        top += hy;
      } else {
        bottom += hy;
      }
      return Rect.fromLTRB(left, top, right, bottom);
    } else {
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const ww: number = storage[3]! * w;
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const hw: number = storage[7]! * h;
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const rw: number = storage[3]! * x + storage[7]! * y + storage[15]!;
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const ulx: number = rx / rw;
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const uly: number = ry / rw;
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const urx: number = (rx + wx) / (rw + ww);
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const ury: number = (ry + wy) / (rw + ww);
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const llx: number = (rx + hx) / (rw + hw);
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const lly: number = (ry + hy) / (rw + hw);
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const lrx: number = (rx + wx + hx) / (rw + ww + hw);
      /**
       * @dartType double
       * @dartTypeOrigin explicit
       */
      const lry: number = (ry + wy + hy) / (rw + ww + hw);
      return Rect.fromLTRB(
        MatrixUtilsBase._min4(ulx, urx, llx, lrx),
        MatrixUtilsBase._min4(uly, ury, lly, lry),
        MatrixUtilsBase._max4(ulx, urx, llx, lrx),
        MatrixUtilsBase._max4(uly, ury, lly, lry),
      );
    }
  }
  /**
   * @dartParam a double
   * @dartParamOrigin a explicit
   * @dartParam b double
   * @dartParamOrigin b explicit
   * @dartParam c double
   * @dartParamOrigin c explicit
   * @dartParam d double
   * @dartParamOrigin d explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  private static _min4(a: number, b: number, c: number, d: number): number {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const e: number = a < b ? a : b;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const f: number = c < d ? c : d;
    return e < f ? e : f;
  }
  /**
   * @dartParam a double
   * @dartParamOrigin a explicit
   * @dartParam b double
   * @dartParamOrigin b explicit
   * @dartParam c double
   * @dartParamOrigin c explicit
   * @dartParam d double
   * @dartParamOrigin d explicit
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  private static _max4(a: number, b: number, c: number, d: number): number {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const e: number = a > b ? a : b;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const f: number = c > d ? c : d;
    return e > f ? e : f;
  }
  static forceToPoint(offset: Offset): Matrix4 {
    const result: Matrix4 = Matrix4.zero();
    const storage: Float64Array = result.storage;
    storage[10] = 1;
    storage[12] = offset.dx;
    storage[13] = offset.dy;
    storage[15] = 1;
    return result;
  }
}
