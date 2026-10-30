// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/lsq_solver.dart; typed array views retain the source QR order.
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
class Vector {
  private readonly elements: Float64Array;
  constructor(
    size: number,
    elements?: Float64Array,
    private readonly offset = 0,
  ) {
    this.elements = elements ?? new Float64Array(size);
    this.length = size;
  }
  readonly length: number;
  get(i: number): number {
    return this.elements[i + this.offset]!;
  }
  set(i: number, value: number): void {
    this.elements[i + this.offset] = value;
  }
  dot(other: Vector): number {
    let result = 0;
    for (let i = 0; i < this.length; i++) result += this.get(i) * other.get(i);
    return result;
  }
  norm(): number {
    return Math.sqrt(this.dot(this));
  }
}
class Matrix {
  private readonly elements: Float64Array;
  constructor(
    rows: number,
    private readonly columns: number,
  ) {
    this.elements = new Float64Array(rows * columns);
  }
  get(row: number, col: number): number {
    return this.elements[row * this.columns + col]!;
  }
  set(row: number, col: number, value: number): void {
    this.elements[row * this.columns + col] = value;
  }
  getRow(row: number): Vector {
    return new Vector(this.columns, this.elements, row * this.columns);
  }
}
export class PolynomialFit {
  readonly coefficients: Float64Array;
  private confidenceValue: number | undefined;
  constructor(degree: number) {
    invariant(
      Number.isSafeInteger(degree) && degree >= 0,
      'invalid-polynomial-degree',
      'Polynomial degree must be nonnegative',
    );
    this.coefficients = new Float64Array(degree + 1);
  }
  get confidence(): number {
    invariant(
      this.confidenceValue !== undefined,
      'uninitialized-polynomial-confidence',
      'Confidence has not been calculated',
    );
    return this.confidenceValue;
  }
  set confidence(value: number) {
    this.confidenceValue = value;
  }
  toString(): string {
    return (
      objectRuntimeType(this, 'PolynomialFit') +
      '([' +
      Array.from(this.coefficients, (c) => c.toPrecision(3)).join(', ') +
      '], confidence: ' +
      this.confidence.toFixed(3) +
      ')'
    );
  }
}
export class LeastSquaresSolver {
  constructor(
    readonly x: readonly number[],
    readonly y: readonly number[],
    readonly w: readonly number[],
  ) {
    invariant(
      x.length === y.length && y.length === w.length,
      'unequal-fit-samples',
      'Fit sample arrays must have equal lengths',
    );
  }
  solve(degree: number): PolynomialFit | null {
    invariant(
      Number.isSafeInteger(degree) && degree >= 0,
      'invalid-polynomial-degree',
      'Polynomial degree must be nonnegative',
    );
    if (degree > this.x.length) return null;
    const result = new PolynomialFit(degree),
      m = this.x.length,
      n = degree + 1,
      a = new Matrix(n, m);
    for (let h = 0; h < m; h++) {
      a.set(0, h, this.w[h]!);
      for (let i = 1; i < n; i++) a.set(i, h, a.get(i - 1, h) * this.x[h]!);
    }
    const q = new Matrix(n, m),
      r = new Matrix(n, n);
    for (let j = 0; j < n; j++) {
      for (let h = 0; h < m; h++) q.set(j, h, a.get(j, h));
      for (let i = 0; i < j; i++) {
        const dot = q.getRow(j).dot(q.getRow(i));
        for (let h = 0; h < m; h++) q.set(j, h, q.get(j, h) - dot * q.get(i, h));
      }
      const norm = q.getRow(j).norm();
      if (norm < 1e-10) return null;
      const inverseNorm = 1 / norm;
      for (let h = 0; h < m; h++) q.set(j, h, q.get(j, h) * inverseNorm);
      for (let i = 0; i < n; i++) r.set(j, i, i < j ? 0 : q.getRow(j).dot(a.getRow(i)));
    }
    const wy = new Vector(m);
    for (let h = 0; h < m; h++) wy.set(h, this.y[h]! * this.w[h]!);
    for (let i = n - 1; i >= 0; i--) {
      result.coefficients[i] = q.getRow(i).dot(wy);
      for (let j = n - 1; j > i; j--)
        result.coefficients[i] = result.coefficients[i]! - r.get(i, j) * result.coefficients[j]!;
      result.coefficients[i] = result.coefficients[i]! / r.get(i, i);
    }
    let yMean = 0;
    for (let h = 0; h < m; h++) yMean += this.y[h]!;
    yMean /= m;
    let sumSquaredError = 0,
      sumSquaredTotal = 0;
    for (let h = 0; h < m; h++) {
      let term = 1,
        err = this.y[h]! - result.coefficients[0]!;
      for (let i = 1; i < n; i++) {
        term *= this.x[h]!;
        err -= term * result.coefficients[i]!;
      }
      sumSquaredError += this.w[h]! * this.w[h]! * err * err;
      const v = this.y[h]! - yMean;
      sumSquaredTotal += this.w[h]! * this.w[h]! * v * v;
    }
    result.confidence = sumSquaredTotal <= 1e-10 ? 1 : 1 - sumSquaredError / sumSquaredTotal;
    return result;
  }
}
