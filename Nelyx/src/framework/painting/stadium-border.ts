// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned Stadium and both complete private transition contracts on the current Core shape/geometry owners.
import { OutlinedBorder, BorderSide, ShapeBorder } from './borders.ts';
import type { ShapeBorderOptions } from './borders.ts';
import { CircleBorder } from './circle-border.ts';
import { RoundedRectangleBorder } from './rounded-rectangle-border.ts';
import { BorderRadius, BorderRadiusGeometry } from './border-radius.ts';
import { Rect } from '../../ui/rect.ts';
import { RRect } from '../../ui/rrect.ts';
import { Radius } from '../../ui/radius.ts';
import { Path } from '../../ui/path.ts';
import type { Offset } from '../../ui/geometry.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { Paint } from '../../ui/paint.ts';
import { hashValues } from './value-equality.ts';
const interpolate = (a: number, b: number, t: number) => a * (1 - t) + b * t;
abstract class StadiumGeometry extends OutlinedBorder {
  protected abstract rounded(rect: Rect, options: ShapeBorderOptions): RRect;
  getOuterPath(rect: Rect, options: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addRRect(this.rounded(rect, options));
    return path;
  }
  getInnerPath(rect: Rect, options: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addRRect(this.rounded(rect, options).deflate(this.side.strokeInset));
    return path;
  }
  override hitTest(rect: Rect, position: Offset, options: ShapeBorderOptions = {}): boolean {
    return this.rounded(rect, options).contains(position);
  }
  override get preferPaintInterior(): boolean {
    return true;
  }
  override paintInterior(
    canvas: Canvas,
    rect: Rect,
    paint: Paint,
    options: ShapeBorderOptions = {},
  ): void {
    canvas.drawRRect(this.rounded(rect, options), paint);
  }
  paint(canvas: Canvas, rect: Rect, options: ShapeBorderOptions = {}): void {
    if (this.side.style === 'solid')
      canvas.drawRRect(
        this.rounded(rect, options).inflate(this.side.strokeOffset / 2),
        this.side.toPaint(),
      );
  }
}
export class StadiumBorder extends StadiumGeometry {
  constructor({ side = BorderSide.none }: { readonly side?: BorderSide } = {}) {
    super(side);
  }
  protected rounded(rect: Rect): RRect {
    return RRect.fromRectAndRadius(rect, Radius.circular(rect.shortestSide / 2));
  }
  scale(t: number): StadiumBorder {
    return new StadiumBorder({ side: this.side.scale(t) });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    if (a instanceof StadiumBorder)
      return new StadiumBorder({ side: BorderSide.lerp(a.side, this.side, t) });
    if (a instanceof CircleBorder)
      return new StadiumToCircleBorder({
        side: BorderSide.lerp(a.side, this.side, t),
        circularity: 1 - t,
        eccentricity: a.eccentricity,
      });
    if (a instanceof RoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side: BorderSide.lerp(a.side, this.side, t),
        borderRadius: a.borderRadius,
        rectilinearity: 1 - t,
      });
    return super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    if (b instanceof StadiumBorder)
      return new StadiumBorder({ side: BorderSide.lerp(this.side, b.side, t) });
    if (b instanceof CircleBorder)
      return new StadiumToCircleBorder({
        side: BorderSide.lerp(this.side, b.side, t),
        circularity: t,
        eccentricity: b.eccentricity,
      });
    if (b instanceof RoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side: BorderSide.lerp(this.side, b.side, t),
        borderRadius: b.borderRadius,
        rectilinearity: t,
      });
    return super.lerpTo(b, t);
  }
  copyWith({ side = null }: { readonly side?: BorderSide | null } = {}): StadiumBorder {
    return new StadiumBorder({ side: side ?? this.side });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof StadiumBorder &&
      other.constructor === this.constructor &&
      this.side.equals(other.side)
    );
  }
  get hashCode(): number {
    return this.side.hashCode;
  }
  override toString(): string {
    return `${this.constructor.name}(${this.side})`;
  }
}
interface CircleTransitionOptions {
  readonly side?: BorderSide;
  readonly circularity?: number;
  readonly eccentricity: number;
}
class StadiumToCircleBorder extends StadiumGeometry {
  readonly circularity: number;
  readonly eccentricity: number;
  constructor({ side = BorderSide.none, circularity = 0, eccentricity }: CircleTransitionOptions) {
    super(side);
    this.circularity = circularity;
    this.eccentricity = eccentricity;
  }
  private adjustedRect(rect: Rect): Rect {
    if (this.circularity === 0 || rect.width === rect.height) return rect;
    const delta =
      (Math.abs(rect.height - rect.width) / 2) * this.circularity * (1 - this.eccentricity);
    return rect.width < rect.height
      ? Rect.fromLTRB(rect.left, rect.top + delta, rect.right, rect.bottom - delta)
      : Rect.fromLTRB(rect.left + delta, rect.top, rect.right - delta, rect.bottom);
  }
  private adjustedRadius(rect: Rect): BorderRadius {
    const circle = BorderRadius.circular(rect.shortestSide / 2);
    if (this.eccentricity === 0) return circle;
    const radius =
      rect.width < rect.height
        ? Radius.elliptical(rect.width / 2, ((0.5 + this.eccentricity / 2) * rect.height) / 2)
        : Radius.elliptical(((0.5 + this.eccentricity / 2) * rect.width) / 2, rect.height / 2);
    return BorderRadius.lerp(circle, BorderRadius.all(radius), this.circularity)!;
  }
  protected rounded(rect: Rect): RRect {
    return this.adjustedRadius(rect).toRRect(this.adjustedRect(rect));
  }
  scale(t: number): ShapeBorder {
    return new StadiumToCircleBorder({
      side: this.side.scale(t),
      circularity: t,
      eccentricity: this.eccentricity,
    });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    const side = a instanceof OutlinedBorder ? BorderSide.lerp(a.side, this.side, t) : this.side;
    if (a instanceof StadiumBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: this.circularity * t,
        eccentricity: this.eccentricity,
      });
    if (a instanceof CircleBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: this.circularity + (1 - this.circularity) * (1 - t),
        eccentricity: a.eccentricity,
      });
    if (a instanceof StadiumToCircleBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: interpolate(a.circularity, this.circularity, t),
        eccentricity: interpolate(a.eccentricity, this.eccentricity, t),
      });
    return super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    const side = b instanceof OutlinedBorder ? BorderSide.lerp(this.side, b.side, t) : this.side;
    if (b instanceof StadiumBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: this.circularity * (1 - t),
        eccentricity: this.eccentricity,
      });
    if (b instanceof CircleBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: this.circularity + (1 - this.circularity) * t,
        eccentricity: b.eccentricity,
      });
    if (b instanceof StadiumToCircleBorder)
      return new StadiumToCircleBorder({
        side,
        circularity: interpolate(this.circularity, b.circularity, t),
        eccentricity: interpolate(this.eccentricity, b.eccentricity, t),
      });
    return super.lerpTo(b, t);
  }
  copyWith({
    side = null,
    circularity = null,
    eccentricity = null,
  }: {
    readonly side?: BorderSide | null;
    readonly circularity?: number | null;
    readonly eccentricity?: number | null;
  } = {}): StadiumToCircleBorder {
    return new StadiumToCircleBorder({
      side: side ?? this.side,
      circularity: circularity ?? this.circularity,
      eccentricity: eccentricity ?? this.eccentricity,
    });
  }
  // The pinned source deliberately omits eccentricity in this private transition's equality/hash.
  equals(other: unknown): boolean {
    return (
      other instanceof StadiumToCircleBorder &&
      other.constructor === this.constructor &&
      this.side.equals(other.side) &&
      this.circularity === other.circularity
    );
  }
  get hashCode(): number {
    return hashValues(this.side, this.circularity);
  }
  override toString(): string {
    return `StadiumBorder(${this.side}, ${(this.circularity * 100).toFixed(1)}% of the way to being a CircleBorder${this.eccentricity !== 0 ? ` that is ${(this.eccentricity * 100).toFixed(1)}% oval` : ''})`;
  }
}
interface RectangleTransitionOptions {
  readonly side?: BorderSide;
  readonly borderRadius?: BorderRadiusGeometry;
  readonly rectilinearity?: number;
}
class StadiumToRoundedRectangleBorder extends StadiumGeometry {
  readonly borderRadius: BorderRadiusGeometry;
  readonly rectilinearity: number;
  constructor({
    side = BorderSide.none,
    borderRadius = BorderRadius.zero,
    rectilinearity = 0,
  }: RectangleTransitionOptions = {}) {
    super(side);
    this.borderRadius = borderRadius;
    this.rectilinearity = rectilinearity;
  }
  private adjustedRadius(rect: Rect): BorderRadiusGeometry {
    return BorderRadiusGeometry.lerp(
      this.borderRadius,
      BorderRadius.all(Radius.circular(rect.shortestSide / 2)),
      1 - this.rectilinearity,
    )!;
  }
  protected rounded(rect: Rect, { textDirection = null }: ShapeBorderOptions): RRect {
    return this.adjustedRadius(rect).resolve(textDirection).toRRect(rect);
  }
  override getInnerPath(rect: Rect, options: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addRRect(
      this.rounded(rect, options).deflate(interpolate(this.side.width, 0, this.side.strokeAlign)),
    );
    return path;
  }
  override hitTest(
    rect: Rect,
    position: Offset,
    { textDirection = null }: ShapeBorderOptions = {},
  ): boolean {
    const radius = this.adjustedRadius(rect).resolve(textDirection);
    return radius.equals(BorderRadius.zero)
      ? rect.contains(position)
      : radius.toRRect(rect).contains(position);
  }
  override paintInterior(
    canvas: Canvas,
    rect: Rect,
    paint: Paint,
    { textDirection = null }: ShapeBorderOptions = {},
  ): void {
    const radius = this.adjustedRadius(rect);
    if (radius.equals(BorderRadius.zero)) canvas.drawRect(rect, paint);
    else canvas.drawRRect(radius.resolve(textDirection).toRRect(rect), paint);
  }
  scale(t: number): ShapeBorder {
    return new StadiumToRoundedRectangleBorder({
      side: this.side.scale(t),
      borderRadius: this.borderRadius.multiply(t),
      rectilinearity: t,
    });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    const side = a instanceof OutlinedBorder ? BorderSide.lerp(a.side, this.side, t) : this.side;
    if (a instanceof StadiumBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: this.borderRadius,
        rectilinearity: this.rectilinearity * t,
      });
    if (a instanceof RoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: this.borderRadius,
        rectilinearity: this.rectilinearity + (1 - this.rectilinearity) * (1 - t),
      });
    if (a instanceof StadiumToRoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: BorderRadiusGeometry.lerp(a.borderRadius, this.borderRadius, t)!,
        rectilinearity: interpolate(a.rectilinearity, this.rectilinearity, t),
      });
    return super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    const side = b instanceof OutlinedBorder ? BorderSide.lerp(this.side, b.side, t) : this.side;
    if (b instanceof StadiumBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: this.borderRadius,
        rectilinearity: this.rectilinearity * (1 - t),
      });
    if (b instanceof RoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: this.borderRadius,
        rectilinearity: this.rectilinearity + (1 - this.rectilinearity) * t,
      });
    if (b instanceof StadiumToRoundedRectangleBorder)
      return new StadiumToRoundedRectangleBorder({
        side,
        borderRadius: BorderRadiusGeometry.lerp(this.borderRadius, b.borderRadius, t)!,
        rectilinearity: interpolate(this.rectilinearity, b.rectilinearity, t),
      });
    return super.lerpTo(b, t);
  }
  copyWith({
    side = null,
    borderRadius = null,
    rectilinearity = null,
  }: {
    readonly side?: BorderSide | null;
    readonly borderRadius?: BorderRadiusGeometry | null;
    readonly rectilinearity?: number | null;
  } = {}): StadiumToRoundedRectangleBorder {
    return new StadiumToRoundedRectangleBorder({
      side: side ?? this.side,
      borderRadius: borderRadius ?? this.borderRadius,
      rectilinearity: rectilinearity ?? this.rectilinearity,
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof StadiumToRoundedRectangleBorder &&
      other.constructor === this.constructor &&
      this.side.equals(other.side) &&
      this.borderRadius.equals(other.borderRadius) &&
      this.rectilinearity === other.rectilinearity
    );
  }
  get hashCode(): number {
    return hashValues(this.side, this.borderRadius, this.rectilinearity);
  }
  override toString(): string {
    return `StadiumBorder(${this.side}, ${this.borderRadius}, ${(this.rectilinearity * 100).toFixed(1)}% of the way to being a RoundedRectangleBorder)`;
  }
}
