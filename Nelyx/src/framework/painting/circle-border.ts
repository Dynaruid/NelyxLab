// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned painting/circle_border.dart geometry on the owning Core ShapeBorder/Path.
import { OutlinedBorder, BorderSide, ShapeBorder } from './borders.ts';
import type { ShapeBorderOptions } from './borders.ts';
import { hashValues } from './value-equality.ts';
import { Rect } from '../../ui/rect.ts';
import { Path } from '../../ui/path.ts';
import type { Canvas } from '../../ui/canvas.ts';
import type { Paint } from '../../ui/paint.ts';
import type { Offset } from '../../ui/geometry.ts';
import { clampDouble } from '../../ui/math.ts';
import { invariant } from '../../foundation/errors.ts';
export class CircleBorder extends OutlinedBorder {
  /** @dartType double */ readonly eccentricity: number;
  constructor({
    side = BorderSide.none,
    eccentricity = 0,
  }: { readonly side?: BorderSide; /** @dartType double */ readonly eccentricity?: number } = {}) {
    super(side);
    invariant(
      Number.isFinite(eccentricity) && eccentricity >= 0 && eccentricity <= 1,
      'invalid-circle-eccentricity',
      'Circle eccentricity must be in [0,1]',
    );
    this.eccentricity = eccentricity;
  }
  private adjust(rect: Rect): Rect {
    if (this.eccentricity === 0 || rect.width === rect.height)
      return Rect.fromCircle({ center: rect.center, radius: rect.shortestSide / 2 });
    const delta = ((1 - this.eccentricity) * Math.abs(rect.width - rect.height)) / 2;
    return rect.width < rect.height
      ? Rect.fromLTRB(rect.left, rect.top + delta, rect.right, rect.bottom - delta)
      : Rect.fromLTRB(rect.left + delta, rect.top, rect.right - delta, rect.bottom);
  }
  /** @dartParam t double */
  scale(t: number): CircleBorder {
    return new CircleBorder({ side: this.side.scale(t), eccentricity: this.eccentricity });
  }
  /** @dartParam t double */
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    return a instanceof CircleBorder
      ? new CircleBorder({
          side: BorderSide.lerp(a.side, this.side, t),
          eccentricity: clampDouble(a.eccentricity * (1 - t) + this.eccentricity * t, 0, 1),
        })
      : super.lerpFrom(a, t);
  }
  /** @dartParam t double */
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    return b instanceof CircleBorder
      ? new CircleBorder({
          side: BorderSide.lerp(this.side, b.side, t),
          eccentricity: clampDouble(this.eccentricity * (1 - t) + b.eccentricity * t, 0, 1),
        })
      : super.lerpTo(b, t);
  }
  copyWith({
    side = null,
    eccentricity = null,
  }: {
    readonly side?: BorderSide | null;
    /** @dartType double? */ readonly eccentricity?: number | null;
  } = {}): CircleBorder {
    return new CircleBorder({
      side: side ?? this.side,
      eccentricity: eccentricity ?? this.eccentricity,
    });
  }
  getOuterPath(rect: Rect, _options: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addOval(this.adjust(rect));
    return path;
  }
  getInnerPath(rect: Rect, _options: ShapeBorderOptions = {}): Path {
    const path = new Path();
    path.addOval(this.adjust(rect).deflate(this.side.strokeInset));
    return path;
  }
  override hitTest(rect: Rect, position: Offset, _options: ShapeBorderOptions = {}): boolean {
    const r = this.adjust(rect);
    if (r.isEmpty) return false;
    const x = (position.x - r.center.x) / (r.width / 2),
      y = (position.y - r.center.y) / (r.height / 2);
    return r.contains(position) && x * x + y * y <= 1;
  }
  override get preferPaintInterior(): boolean {
    return true;
  }
  override paintInterior(
    canvas: Canvas,
    rect: Rect,
    paint: Paint,
    _options: ShapeBorderOptions = {},
  ): void {
    if (this.eccentricity === 0) canvas.drawCircle(rect.center, rect.shortestSide / 2, paint);
    else canvas.drawOval(this.adjust(rect), paint);
  }
  paint(canvas: Canvas, rect: Rect, _options: ShapeBorderOptions = {}): void {
    if (this.side.style === 'none') return;
    if (this.eccentricity === 0)
      canvas.drawCircle(
        rect.center,
        (rect.shortestSide + this.side.strokeOffset) / 2,
        this.side.toPaint(),
      );
    else
      canvas.drawOval(this.adjust(rect).inflate(this.side.strokeOffset / 2), this.side.toPaint());
  }
  equals(other: unknown): boolean {
    return (
      other instanceof CircleBorder &&
      other.constructor === this.constructor &&
      other.side.equals(this.side) &&
      other.eccentricity === this.eccentricity
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(this.side, this.eccentricity);
  }
  override toString(): string {
    return `${this.constructor.name}(${this.side}${this.eccentricity !== 0 ? `, eccentricity: ${this.eccentricity}` : ''})`;
  }
}
