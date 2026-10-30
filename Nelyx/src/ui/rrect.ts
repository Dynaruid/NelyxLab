// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui RRect/_RRectLike at the recorded upstream pin.
import { invariant } from '../foundation/errors.ts';
import type { Rect as RectGeometry } from './types.ts';
import { Rect } from './rect.ts';
import type { Offset as OffsetGeometry } from './geometry.ts';
import { Offset } from './offset.ts';
import { Radius } from './radius.ts';
import { number, lerp, hashDoubles, fixed } from './value-math.ts';
export interface RRectCorners {
  readonly topLeft?: Radius;
  readonly topRight?: Radius;
  readonly bottomRight?: Radius;
  readonly bottomLeft?: Radius;
}
const fields = [
  'left',
  'top',
  'right',
  'bottom',
  'tlRadiusX',
  'tlRadiusY',
  'trRadiusX',
  'trRadiusY',
  'brRadiusX',
  'brRadiusY',
  'blRadiusX',
  'blRadiusY',
] as const;
function rect(left: number, top: number, right: number, bottom: number): Rect {
  return new Rect(left, top, right, bottom);
}
function edges(value: RectGeometry): readonly [number, number, number, number] {
  if (value instanceof Rect) return [value.left, value.top, value.right, value.bottom];
  const { x, y, width, height } = value;
  return [x, y, x + width, y + height];
}
function corner(value: Radius | undefined): Radius {
  const r = value === undefined ? Radius.zero : value;
  invariant(
    r instanceof Radius && r.x >= 0 && r.y >= 0,
    'invalid-rrect-radius',
    'RRect radii must be nonnegative Radius values',
  );
  return r;
}
export class RRect {
  readonly #data: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  get left(): number {
    return this.#data[0];
  }
  get top(): number {
    return this.#data[1];
  }
  get right(): number {
    return this.#data[2];
  }
  get bottom(): number {
    return this.#data[3];
  }
  get tlRadiusX(): number {
    return this.#data[4];
  }
  get tlRadiusY(): number {
    return this.#data[5];
  }
  get trRadiusX(): number {
    return this.#data[6];
  }
  get trRadiusY(): number {
    return this.#data[7];
  }
  get brRadiusX(): number {
    return this.#data[8];
  }
  get brRadiusY(): number {
    return this.#data[9];
  }
  get blRadiusX(): number {
    return this.#data[10];
  }
  get blRadiusY(): number {
    return this.#data[11];
  }
  constructor(left = 0, top = 0, right = 0, bottom = 0, corners: RRectCorners = {}) {
    invariant(
      Object.keys(corners).every((k) =>
        ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].includes(k),
      ),
      'unsupported-rrect',
      'Unknown RRect corner',
    );
    const l = number(left),
      t = number(top),
      r = number(right),
      b = number(bottom);
    const tl = corner(corners.topLeft),
      tr = corner(corners.topRight),
      br = corner(corners.bottomRight),
      bl = corner(corners.bottomLeft);
    this.#data = Object.freeze([l, t, r, b, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  }
  static fromLTRBXY(
    left: number,
    top: number,
    right: number,
    bottom: number,
    radiusX: number,
    radiusY: number,
  ): RRect {
    return RRect.fromLTRBR(left, top, right, bottom, new Radius(radiusX, radiusY));
  }
  static fromLTRBR(
    left: number,
    top: number,
    right: number,
    bottom: number,
    radius: Radius,
  ): RRect {
    return new RRect(left, top, right, bottom, {
      topLeft: radius,
      topRight: radius,
      bottomRight: radius,
      bottomLeft: radius,
    });
  }
  static fromRectXY(value: RectGeometry, radiusX: number, radiusY: number): RRect {
    return RRect.fromLTRBXY(...edges(value), radiusX, radiusY);
  }
  static fromRectAndRadius(value: RectGeometry, radius: Radius): RRect {
    return RRect.fromLTRBR(...edges(value), radius);
  }
  static fromLTRBAndCorners(
    left: number,
    top: number,
    right: number,
    bottom: number,
    corners: RRectCorners = {},
  ): RRect {
    return new RRect(left, top, right, bottom, corners);
  }
  static fromRectAndCorners(value: RectGeometry, corners: RRectCorners = {}): RRect {
    return new RRect(...edges(value), corners);
  }
  static readonly zero = new RRect();
  get tlRadius(): Radius {
    return new Radius(this.tlRadiusX, this.tlRadiusY);
  }
  get trRadius(): Radius {
    return new Radius(this.trRadiusX, this.trRadiusY);
  }
  get brRadius(): Radius {
    return new Radius(this.brRadiusX, this.brRadiusY);
  }
  get blRadius(): Radius {
    return new Radius(this.blRadiusX, this.blRadiusY);
  }
  private get corners(): RRectCorners {
    return {
      topLeft: this.tlRadius,
      topRight: this.trRadius,
      bottomRight: this.brRadius,
      bottomLeft: this.blRadius,
    };
  }
  private values(): number[] {
    return fields.map((k) => this[k]);
  }
  shift(offset: OffsetGeometry): RRect {
    const { x, y } = offset;
    return new RRect(this.left + x, this.top + y, this.right + x, this.bottom + y, this.corners);
  }
  inflate(delta: number): RRect {
    const radius = (x: number, y: number) =>
      new Radius(Math.max(0, x + delta), Math.max(0, y + delta));
    return new RRect(this.left - delta, this.top - delta, this.right + delta, this.bottom + delta, {
      topLeft: radius(this.tlRadiusX, this.tlRadiusY),
      topRight: radius(this.trRadiusX, this.trRadiusY),
      bottomRight: radius(this.brRadiusX, this.brRadiusY),
      bottomLeft: radius(this.blRadiusX, this.blRadiusY),
    });
  }
  deflate(delta: number): RRect {
    return this.inflate(-delta);
  }
  get width(): number {
    return this.right - this.left;
  }
  get height(): number {
    return this.bottom - this.top;
  }
  get outerRect(): Rect {
    return rect(this.left, this.top, this.right, this.bottom);
  }
  get safeInnerRect(): Rect {
    const k = 0.29289321881;
    return rect(
      this.left + Math.max(this.blRadiusX, this.tlRadiusX) * k,
      this.top + Math.max(this.tlRadiusY, this.trRadiusY) * k,
      this.right - Math.max(this.trRadiusX, this.brRadiusX) * k,
      this.bottom - Math.max(this.brRadiusY, this.blRadiusY) * k,
    );
  }
  get middleRect(): Rect {
    return rect(
      this.left + Math.max(this.blRadiusX, this.tlRadiusX),
      this.top + Math.max(this.tlRadiusY, this.trRadiusY),
      this.right - Math.max(this.trRadiusX, this.brRadiusX),
      this.bottom - Math.max(this.brRadiusY, this.blRadiusY),
    );
  }
  get wideMiddleRect(): Rect {
    return rect(
      this.left,
      this.top + Math.max(this.tlRadiusY, this.trRadiusY),
      this.right,
      this.bottom - Math.max(this.brRadiusY, this.blRadiusY),
    );
  }
  get tallMiddleRect(): Rect {
    return rect(
      this.left + Math.max(this.blRadiusX, this.tlRadiusX),
      this.top,
      this.right - Math.max(this.trRadiusX, this.brRadiusX),
      this.bottom,
    );
  }
  get isEmpty(): boolean {
    return this.left >= this.right || this.top >= this.bottom;
  }
  get isFinite(): boolean {
    return [this.left, this.top, this.right, this.bottom].every(Number.isFinite);
  }
  get isRect(): boolean {
    return (
      (this.tlRadiusX === 0 || this.tlRadiusY === 0) &&
      (this.trRadiusX === 0 || this.trRadiusY === 0) &&
      (this.brRadiusX === 0 || this.brRadiusY === 0) &&
      (this.blRadiusX === 0 || this.blRadiusY === 0)
    );
  }
  private get equalRadii(): boolean {
    return (
      this.tlRadius.equals(this.trRadius) &&
      this.trRadius.equals(this.brRadius) &&
      this.brRadius.equals(this.blRadius)
    );
  }
  get isStadium(): boolean {
    return (
      this.equalRadii && (this.width <= 2 * this.tlRadiusX || this.height <= 2 * this.tlRadiusY)
    );
  }
  get isEllipse(): boolean {
    return this.equalRadii && this.width <= 2 * this.tlRadiusX && this.height <= 2 * this.tlRadiusY;
  }
  get isCircle(): boolean {
    return this.width === this.height && this.isEllipse;
  }
  get shortestSide(): number {
    return Math.min(Math.abs(this.width), Math.abs(this.height));
  }
  get longestSide(): number {
    return Math.max(Math.abs(this.width), Math.abs(this.height));
  }
  get hasNaN(): boolean {
    return this.values().some(Number.isNaN);
  }
  get center(): Offset {
    return new Offset(this.left + this.width / 2, this.top + this.height / 2);
  }
  scaleRadii(): RRect {
    let scale = 1;
    const limit = (a: number, b: number, size: number) => {
      const sum = a + b;
      if (sum > size && sum !== 0) scale = Math.min(scale, size / sum);
    };
    limit(this.blRadiusY, this.tlRadiusY, this.height);
    limit(this.tlRadiusX, this.trRadiusX, this.width);
    limit(this.trRadiusY, this.brRadiusY, this.height);
    limit(this.brRadiusX, this.blRadiusX, this.width);
    invariant(scale >= 0, 'invalid-rrect-size', 'Cannot scale radii into inverted bounds');
    if (scale < 1)
      return new RRect(this.left, this.top, this.right, this.bottom, {
        topLeft: this.tlRadius.multiply(scale),
        topRight: this.trRadius.multiply(scale),
        bottomRight: this.brRadius.multiply(scale),
        bottomLeft: this.blRadius.multiply(scale),
      });
    return new RRect(this.left, this.top, this.right, this.bottom, this.corners);
  }
  contains(point: OffsetGeometry): boolean {
    if (
      point.x < this.left ||
      point.x >= this.right ||
      point.y < this.top ||
      point.y >= this.bottom
    )
      return false;
    const s = this.scaleRadii();
    let x: number, y: number, rx: number, ry: number;
    if (point.x < this.left + s.tlRadiusX && point.y < this.top + s.tlRadiusY) {
      x = point.x - this.left - s.tlRadiusX;
      y = point.y - this.top - s.tlRadiusY;
      rx = s.tlRadiusX;
      ry = s.tlRadiusY;
    } else if (point.x > this.right - s.trRadiusX && point.y < this.top + s.trRadiusY) {
      x = point.x - this.right + s.trRadiusX;
      y = point.y - this.top - s.trRadiusY;
      rx = s.trRadiusX;
      ry = s.trRadiusY;
    } else if (point.x > this.right - s.brRadiusX && point.y > this.bottom - s.brRadiusY) {
      x = point.x - this.right + s.brRadiusX;
      y = point.y - this.bottom + s.brRadiusY;
      rx = s.brRadiusX;
      ry = s.brRadiusY;
    } else if (point.x < this.left + s.blRadiusX && point.y > this.bottom - s.blRadiusY) {
      x = point.x - this.left - s.blRadiusX;
      y = point.y - this.bottom + s.blRadiusY;
      rx = s.blRadiusX;
      ry = s.blRadiusY;
    } else return true;
    x /= rx;
    y /= ry;
    return !(x * x + y * y > 1);
  }
  private lerpTo(b: RRect | null, t: number): RRect {
    invariant(
      this.constructor === RRect,
      'invalid-rrect-lerp',
      'RRect interpolation receiver must be concrete RRect',
    );
    const v = this.values().map((a, i) => (b === null ? a * (1 - t) : lerp(a, b[fields[i]!], t)));
    for (let i = 4; i < 12; i++) v[i] = Math.max(0, v[i]!);
    return new RRect(v[0], v[1], v[2], v[3], {
      topLeft: new Radius(v[4]!, v[5]!),
      topRight: new Radius(v[6]!, v[7]!),
      bottomRight: new Radius(v[8]!, v[9]!),
      bottomLeft: new Radius(v[10]!, v[11]!),
    });
  }
  static lerp(a: RRect | null, b: RRect | null, t: number): RRect | null {
    if (a === null) return b === null ? null : b.lerpTo(null, 1 - t);
    return a.lerpTo(b, t);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof RRect &&
        this.constructor === other.constructor &&
        (
          [
            'left',
            'top',
            'right',
            'bottom',
            'tlRadiusX',
            'tlRadiusY',
            'trRadiusX',
            'trRadiusY',
            'blRadiusX',
            'blRadiusY',
            'brRadiusX',
            'brRadiusY',
          ] as const
        ).every((k) => other[k] === this[k]))
    );
  }
  get hashCode(): number {
    return hashDoubles(this.values());
  }
  toString(): string {
    const bounds = [this.left, this.top, this.right, this.bottom].map(fixed).join(', ');
    if (this.equalRadii)
      return this.tlRadiusX === this.tlRadiusY
        ? `RRect.fromLTRBR(${bounds}, ${fixed(this.tlRadiusX)})`
        : `RRect.fromLTRBXY(${bounds}, ${fixed(this.tlRadiusX)}, ${fixed(this.tlRadiusY)})`;
    return `RRect.fromLTRBAndCorners(${bounds}, topLeft: ${this.tlRadius}, topRight: ${this.trRadius}, bottomRight: ${this.brRadius}, bottomLeft: ${this.blRadius})`;
  }
}
