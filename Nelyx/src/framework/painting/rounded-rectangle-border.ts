// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Rounded-rectangle geometry from the pinned painting/rounded_rectangle_border.dart.
import { OutlinedBorder, BorderSide, ShapeBorder } from './borders.ts';
import type { ShapeBorderOptions } from './borders.ts';
import { BorderRadius, BorderRadiusGeometry } from './border-radius.ts';
import { hashValues } from './value-equality.ts';
import { Path } from '../../ui/path.ts';
import { Paint } from '../../ui/paint.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { Rect } from '../../ui/rect.ts';
import type { Offset } from '../../ui/geometry.ts';
export class RoundedRectangleBorder extends OutlinedBorder {
  readonly borderRadius: BorderRadiusGeometry;
  constructor({
    side = BorderSide.none,
    borderRadius = BorderRadius.zero,
  }: { readonly side?: BorderSide; readonly borderRadius?: BorderRadiusGeometry } = {}) {
    super(side);
    this.borderRadius = borderRadius;
  }
  scale(t: number): RoundedRectangleBorder {
    return new RoundedRectangleBorder({
      side: this.side.scale(t),
      borderRadius: this.borderRadius.multiply(t),
    });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    return a instanceof RoundedRectangleBorder
      ? new RoundedRectangleBorder({
          side: BorderSide.lerp(a.side, this.side, t),
          borderRadius: BorderRadiusGeometry.lerp(a.borderRadius, this.borderRadius, t)!,
        })
      : super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    return b instanceof RoundedRectangleBorder
      ? new RoundedRectangleBorder({
          side: BorderSide.lerp(this.side, b.side, t),
          borderRadius: BorderRadiusGeometry.lerp(this.borderRadius, b.borderRadius, t)!,
        })
      : super.lerpTo(b, t);
  }
  copyWith({
    side = this.side,
    borderRadius = this.borderRadius,
  }: {
    readonly side?: BorderSide;
    readonly borderRadius?: BorderRadiusGeometry;
  } = {}): RoundedRectangleBorder {
    return new RoundedRectangleBorder({ side, borderRadius });
  }
  getOuterPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addRRect(this.borderRadius.resolve(textDirection).toRRect(rect));
    return path;
  }
  getInnerPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addRRect(
      this.borderRadius.resolve(textDirection).toRRect(rect).deflate(this.side.strokeInset),
    );
    return path;
  }
  override hitTest(
    rect: Rect,
    position: Offset,
    { textDirection = null }: ShapeBorderOptions = {},
  ): boolean {
    return this.borderRadius.resolve(textDirection).toRRect(rect).contains(position);
  }
  override get preferPaintInterior(): boolean {
    return true;
  }
  override paintInterior(
    canvas: Canvas,
    rect: Rect,
    paint: Paint,
    { textDirection = null }: ShapeBorderOptions = {},
  ): void {
    if (this.borderRadius.equals(BorderRadius.zero)) canvas.drawRect(rect, paint);
    else canvas.drawRRect(this.borderRadius.resolve(textDirection).toRRect(rect), paint);
  }
  paint(canvas: Canvas, rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): void {
    if (this.side.style === 'none') return;
    const border = this.borderRadius.resolve(textDirection).toRRect(rect);
    if (this.side.width === 0) canvas.drawRRect(border, this.side.toPaint());
    else
      canvas.drawDRRect(
        border.inflate(this.side.strokeOutset),
        border.deflate(this.side.strokeInset),
        new Paint({ color: this.side.color }),
      );
  }
  equals(other: unknown): boolean {
    return (
      other instanceof RoundedRectangleBorder &&
      other.constructor === this.constructor &&
      other.side.equals(this.side) &&
      other.borderRadius.equals(this.borderRadius)
    );
  }
  get hashCode(): number {
    return hashValues(this.side, this.borderRadius);
  }
  override toString(): string {
    return `RoundedRectangleBorder(${this.side}, ${this.borderRadius})`;
  }
}
