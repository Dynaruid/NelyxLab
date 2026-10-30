// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui geometry.dart at the recorded upstream pin.
import type { Rect as RectGeometry } from './types.ts';
import type { Offset as OffsetGeometry } from './geometry.ts';
import { Offset } from './offset.ts';
import { Size } from './size.ts';
import { number, lerp, hashDoubles, fixed } from './value-math.ts';
function point(x: number, y: number): Offset {
  return new Offset(x, y);
}
/** Exact LTRB value. x/y/width/height also satisfy the existing paint geometry contract. */
export class Rect implements RectGeometry {
  readonly #bounds: readonly [number, number, number, number];
  constructor(left: number, top: number, right: number, bottom: number) {
    this.#bounds = Object.freeze([number(left), number(top), number(right), number(bottom)]);
  }
  get left(): number {
    return this.#bounds[0];
  }
  get top(): number {
    return this.#bounds[1];
  }
  get right(): number {
    return this.#bounds[2];
  }
  get bottom(): number {
    return this.#bounds[3];
  }
  static fromLTRB(left: number, top: number, right: number, bottom: number): Rect {
    return new Rect(left, top, right, bottom);
  }
  static fromLTWH(left: number, top: number, width: number, height: number): Rect {
    return new Rect(left, top, left + width, top + height);
  }
  static fromCircle(options: { readonly center: OffsetGeometry; readonly radius: number }): Rect {
    return Rect.fromCenter({
      center: options.center,
      width: options.radius * 2,
      height: options.radius * 2,
    });
  }
  static fromCenter(options: {
    readonly center: OffsetGeometry;
    readonly width: number;
    readonly height: number;
  }): Rect {
    const { center, width, height } = options,
      { x, y } = center;
    return new Rect(x - width / 2, y - height / 2, x + width / 2, y + height / 2);
  }
  static fromPoints(a: OffsetGeometry, b: OffsetGeometry): Rect {
    const { x: ax, y: ay } = a,
      { x: bx, y: by } = b;
    return new Rect(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by));
  }
  static readonly zero = new Rect(0, 0, 0, 0);
  static readonly largest = new Rect(-1e9, -1e9, 1e9, 1e9);
  get x(): number {
    return this.left;
  }
  get y(): number {
    return this.top;
  }
  get width(): number {
    return this.right - this.left;
  }
  get height(): number {
    return this.bottom - this.top;
  }
  get size(): Size {
    return new Size(this.width, this.height);
  }
  get hasNaN(): boolean {
    return [this.left, this.top, this.right, this.bottom].some(Number.isNaN);
  }
  get isInfinite(): boolean {
    return (
      this.left >= Infinity ||
      this.top >= Infinity ||
      this.right >= Infinity ||
      this.bottom >= Infinity
    );
  }
  get isFinite(): boolean {
    return [this.left, this.top, this.right, this.bottom].every(Number.isFinite);
  }
  get isEmpty(): boolean {
    return this.left >= this.right || this.top >= this.bottom;
  }
  shift(offset: OffsetGeometry): Rect {
    const { x, y } = offset;
    return new Rect(this.left + x, this.top + y, this.right + x, this.bottom + y);
  }
  translate(x: number, y: number): Rect {
    return new Rect(this.left + x, this.top + y, this.right + x, this.bottom + y);
  }
  inflate(delta: number): Rect {
    return new Rect(this.left - delta, this.top - delta, this.right + delta, this.bottom + delta);
  }
  deflate(delta: number): Rect {
    return this.inflate(-delta);
  }
  intersect(other: Rect): Rect {
    return new Rect(
      Math.max(this.left, other.left),
      Math.max(this.top, other.top),
      Math.min(this.right, other.right),
      Math.min(this.bottom, other.bottom),
    );
  }
  expandToInclude(other: Rect): Rect {
    return new Rect(
      Math.min(this.left, other.left),
      Math.min(this.top, other.top),
      Math.max(this.right, other.right),
      Math.max(this.bottom, other.bottom),
    );
  }
  overlaps(other: Rect): boolean {
    if (this.right <= other.left || other.right <= this.left) return false;
    if (this.bottom <= other.top || other.bottom <= this.top) return false;
    return true;
  }
  get shortestSide(): number {
    return Math.min(Math.abs(this.width), Math.abs(this.height));
  }
  get longestSide(): number {
    return Math.max(Math.abs(this.width), Math.abs(this.height));
  }
  get topLeft(): Offset {
    return point(this.left, this.top);
  }
  get topCenter(): Offset {
    return point(this.left + this.width / 2, this.top);
  }
  get topRight(): Offset {
    return point(this.right, this.top);
  }
  get centerLeft(): Offset {
    return point(this.left, this.top + this.height / 2);
  }
  get center(): Offset {
    return point(this.left + this.width / 2, this.top + this.height / 2);
  }
  get centerRight(): Offset {
    return point(this.right, this.top + this.height / 2);
  }
  get bottomLeft(): Offset {
    return point(this.left, this.bottom);
  }
  get bottomCenter(): Offset {
    return point(this.left + this.width / 2, this.bottom);
  }
  get bottomRight(): Offset {
    return point(this.right, this.bottom);
  }
  contains(offset: OffsetGeometry): boolean {
    return (
      offset.x >= this.left &&
      offset.x < this.right &&
      offset.y >= this.top &&
      offset.y < this.bottom
    );
  }
  static lerp(a: Rect | null, b: Rect | null, t: number): Rect | null {
    if (b === null)
      return a === null
        ? null
        : new Rect(a.left * (1 - t), a.top * (1 - t), a.right * (1 - t), a.bottom * (1 - t));
    if (a === null) return new Rect(b.left * t, b.top * t, b.right * t, b.bottom * t);
    return new Rect(
      lerp(a.left, b.left, t),
      lerp(a.top, b.top, t),
      lerp(a.right, b.right, t),
      lerp(a.bottom, b.bottom, t),
    );
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof Rect &&
        this.constructor === other.constructor &&
        other.left === this.left &&
        other.top === this.top &&
        other.right === this.right &&
        other.bottom === this.bottom)
    );
  }
  get hashCode(): number {
    return hashDoubles([this.left, this.top, this.right, this.bottom]);
  }
  toString(): string {
    return `Rect.fromLTRB(${[this.left, this.top, this.right, this.bottom].map(fixed).join(', ')})`;
  }
}
