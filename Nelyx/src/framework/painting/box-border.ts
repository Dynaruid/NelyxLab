// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter painting/box_border.dart.
import { invariant } from '../../foundation/errors.ts';
import { Canvas } from '../../ui/canvas.ts';
import { Paint } from '../../ui/paint.ts';
import { Path } from '../../ui/path.ts';
import { Rect } from '../../ui/rect.ts';
import { RRect } from '../../ui/rrect.ts';
import { Radius } from '../../ui/radius.ts';
import type { Offset } from '../../ui/geometry.ts';
import { BorderSide, ShapeBorder, paintBorder } from './borders.ts';
import type { BorderSideOptions, PhysicalBorderSides, ShapeBorderOptions } from './borders.ts';
import { BorderRadius } from './border-radius.ts';
import { EdgeInsets, EdgeInsetsDirectional, EdgeInsetsGeometry } from './edge-insets.ts';
import { hashValues, listEquals } from './value-equality.ts';
export type BoxShape = 'rectangle' | 'circle';
export interface BoxBorderPaintOptions extends ShapeBorderOptions {
  readonly shape?: BoxShape;
  readonly borderRadius?: BorderRadius | null;
}
export interface DirectionalBorderSides {
  readonly top?: BorderSide;
  readonly start?: BorderSide;
  readonly end?: BorderSide;
  readonly bottom?: BorderSide;
}
export abstract class BoxBorder extends ShapeBorder {
  abstract get top(): BorderSide;
  abstract get bottom(): BorderSide;
  abstract get isUniform(): boolean;
  static fromLTRB(options: PhysicalBorderSides = {}): Border {
    return new Border(options);
  }
  static fromSTEB(options: DirectionalBorderSides = {}): BorderDirectional {
    return new BorderDirectional(options);
  }
  static all(options: BorderSideOptions = {}): Border {
    return Border.fromBorderSide(new BorderSide(options));
  }
  static fromBorderSide(side: BorderSide): Border {
    return Border.fromBorderSide(side);
  }
  static symmetric(
    options: { readonly vertical?: BorderSide; readonly horizontal?: BorderSide } = {},
  ): Border {
    return Border.symmetric(options);
  }
  override add(
    _other: ShapeBorder,
    _options: { readonly reversed?: boolean } = {},
  ): BoxBorder | null {
    return null;
  }
  static override lerp(a: BoxBorder | null, b: BoxBorder | null, t: number): BoxBorder | null {
    if (a === b) return a;
    if ((a === null || a instanceof Border) && (b === null || b instanceof Border))
      return Border.lerp(a, b, t);
    if (
      (a === null || a instanceof BorderDirectional) &&
      (b === null || b instanceof BorderDirectional)
    )
      return BorderDirectional.lerp(a, b, t);
    if (a instanceof BorderDirectional && b instanceof Border) {
      const swap = a;
      a = b;
      b = swap;
      t = 1 - t;
    }
    if (a instanceof Border && b instanceof BorderDirectional) {
      const top = BorderSide.lerp(a.top, b.top, t),
        bottom = BorderSide.lerp(a.bottom, b.bottom, t),
        none = BorderSide.none;
      if (b.start.equals(none) && b.end.equals(none))
        return new Border({
          top,
          bottom,
          left: BorderSide.lerp(a.left, none, t),
          right: BorderSide.lerp(a.right, none, t),
        });
      if (a.left.equals(none) && a.right.equals(none))
        return new BorderDirectional({
          top,
          bottom,
          start: BorderSide.lerp(none, b.start, t),
          end: BorderSide.lerp(none, b.end, t),
        });
      return t < 0.5
        ? new Border({
            top,
            bottom,
            left: BorderSide.lerp(a.left, none, t * 2),
            right: BorderSide.lerp(a.right, none, t * 2),
          })
        : new BorderDirectional({
            top,
            bottom,
            start: BorderSide.lerp(none, b.start, (t - 0.5) * 2),
            end: BorderSide.lerp(none, b.end, (t - 0.5) * 2),
          });
    }
    const result = b?.lerpFrom(a, t) ?? a?.lerpTo(b, t);
    invariant(
      result == null || result instanceof BoxBorder,
      'invalid-border-lerp',
      'BoxBorder interpolation must return BoxBorder',
    );
    return result ?? (t < 0.5 ? a : b);
  }
  getOuterPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
    invariant(
      textDirection !== null,
      'missing-text-direction',
      'BoxBorder paths require a text direction',
    );
    const path = new Path();
    if (!rect.isEmpty) path.addRect(rect);
    return path;
  }
  getInnerPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
    invariant(
      textDirection !== null,
      'missing-text-direction',
      'BoxBorder paths require a text direction',
    );
    const path = new Path(),
      inner = this.dimensions.resolve(textDirection).deflateRect(rect);
    if (!inner.isEmpty) path.addRect(inner);
    return path;
  }
  override hitTest(rect: Rect, position: Offset): boolean {
    return rect.contains(position);
  }
  override get preferPaintInterior(): boolean {
    return true;
  }
  override paintInterior(canvas: Canvas, rect: Rect, paint: Paint): void {
    canvas.drawRect(rect, paint);
  }
  abstract override paint(canvas: Canvas, rect: Rect, options?: BoxBorderPaintOptions): void;
  static paintNonUniformBorder(
    canvas: Canvas,
    rect: Rect,
    options: BoxBorderPaintOptions & PhysicalBorderSides & { readonly color: number },
  ): void {
    const {
      top = BorderSide.none,
      right = BorderSide.none,
      bottom = BorderSide.none,
      left = BorderSide.none,
      shape = 'rectangle',
      borderRadius = null,
    } = options;
    invariant(
      shape !== 'circle' || borderRadius === null,
      'invalid-border',
      'A circle cannot have a border radius',
    );
    const borderRect =
      shape === 'circle'
        ? RRect.fromRectAndRadius(
            Rect.fromCircle({ center: rect.center, radius: rect.shortestSide / 2 }),
            Radius.circular(rect.width),
          )
        : (borderRadius ?? BorderRadius.zero).toRRect(rect);
    const outer = new EdgeInsets(
        left.strokeOutset,
        top.strokeOutset,
        right.strokeOutset,
        bottom.strokeOutset,
      ).inflateRRect(borderRect),
      inner = new EdgeInsets(
        left.strokeInset,
        top.strokeInset,
        right.strokeInset,
        bottom.strokeInset,
      ).deflateRRect(borderRect),
      paint = new Paint();
    paint.color = options.color;
    canvas.drawDRRect(outer, inner, paint);
  }
}
function paintPhysical(
  canvas: Canvas,
  rect: Rect,
  sides: readonly [BorderSide, BorderSide, BorderSide, BorderSide],
  { shape = 'rectangle', borderRadius = null, textDirection = null }: BoxBorderPaintOptions = {},
): void {
  const [top, right, bottom, left] = sides;
  invariant(shape === 'rectangle' || shape === 'circle', 'invalid-shape', 'Unknown box shape');
  invariant(
    shape !== 'circle' || borderRadius === null,
    'invalid-border',
    'A circle cannot have a border radius',
  );
  // Source Border.paint preserves zero-area hairlines (e.g. M2 Divider).
  if (sides.every((x) => x.equals(top))) {
    if (top.style === 'none') return;
    if (shape === 'circle') {
      const radius = (rect.shortestSide + top.strokeOffset) / 2;
      if (radius >= 0) canvas.drawCircle(rect.center, radius, top.toPaint());
      return;
    }
    if (borderRadius !== null && !borderRadius.equals(BorderRadius.zero)) {
      const nominal = borderRadius.toRRect(rect);
      if (top.width === 0) canvas.drawRRect(nominal, top.toPaint());
      else {
        const paint = new Paint();
        paint.color = top.color;
        canvas.drawDRRect(
          nominal.inflate(top.strokeOutset),
          nominal.deflate(top.strokeInset),
          paint,
        );
      }
      return;
    }
    const bounds = rect.inflate(top.strokeOffset / 2);
    if (!bounds.isEmpty) canvas.drawRect(bounds, top.toPaint());
    return;
  }
  const visible = sides.filter((x) => x.style === 'solid');
  if (!visible.length) return;
  const colors = new Set(visible.map((x) => x.color)),
    hairline = visible.some((x) => x.width === 0),
    rounded = borderRadius !== null && !borderRadius.equals(BorderRadius.zero);
  if (colors.size === 1 && !hairline && (shape === 'circle' || rounded)) {
    const shown = sides.map((x) => (x.style === 'none' ? BorderSide.none : x));
    BoxBorder.paintNonUniformBorder(canvas, rect, {
      shape,
      borderRadius,
      textDirection,
      top: shown[0]!,
      right: shown[1]!,
      bottom: shown[2]!,
      left: shown[3]!,
      color: visible[0]!.color,
    });
    return;
  }
  invariant(
    !rounded &&
      shape === 'rectangle' &&
      sides.every((x) => x.strokeAlign === BorderSide.strokeAlignInside),
    'unsupported-border',
    'Multicolor and nonuniform hairline borders require a rectangle, zero radius and inside stroke alignment',
  );
  paintBorder(canvas, rect, { top, right, bottom, left });
}
export class Border extends BoxBorder {
  readonly top: BorderSide;
  readonly right: BorderSide;
  readonly bottom: BorderSide;
  readonly left: BorderSide;
  constructor({
    top = BorderSide.none,
    right = BorderSide.none,
    bottom = BorderSide.none,
    left = BorderSide.none,
  }: PhysicalBorderSides = {}) {
    super();
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
  }
  static override fromBorderSide(side: BorderSide): Border {
    return new Border({ top: side, right: side, bottom: side, left: side });
  }
  static override all(options: BorderSideOptions = {}): Border {
    return this.fromBorderSide(new BorderSide(options));
  }
  static override symmetric({
    vertical = BorderSide.none,
    horizontal = BorderSide.none,
  }: { readonly vertical?: BorderSide; readonly horizontal?: BorderSide } = {}): Border {
    return new Border({ top: horizontal, bottom: horizontal, left: vertical, right: vertical });
  }
  private get sides(): readonly BorderSide[] {
    return [this.top, this.right, this.bottom, this.left];
  }
  get dimensions(): EdgeInsetsGeometry {
    return new EdgeInsets(
      this.left.strokeInset,
      this.top.strokeInset,
      this.right.strokeInset,
      this.bottom.strokeInset,
    );
  }
  get isUniform(): boolean {
    return this.sides.every((x) => x.equals(this.top));
  }
  static merge(a: Border, b: Border): Border {
    return new Border({
      top: BorderSide.merge(a.top, b.top),
      right: BorderSide.merge(a.right, b.right),
      bottom: BorderSide.merge(a.bottom, b.bottom),
      left: BorderSide.merge(a.left, b.left),
    });
  }
  override add(other: ShapeBorder): BoxBorder | null {
    return other instanceof Border &&
      this.sides.every((x, i) => BorderSide.canMerge(x, other.sides[i]!))
      ? Border.merge(this, other)
      : null;
  }
  scale(t: number): Border {
    return new Border({
      top: this.top.scale(t),
      right: this.right.scale(t),
      bottom: this.bottom.scale(t),
      left: this.left.scale(t),
    });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    return a instanceof Border ? Border.lerp(a, this, t) : super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    return b instanceof Border ? Border.lerp(this, b, t) : super.lerpTo(b, t);
  }
  static override lerp(a: Border | null, b: Border | null, t: number): Border | null {
    if (a === b) return a;
    if (a === null) return b!.scale(t);
    if (b === null) return a.scale(1 - t);
    return new Border({
      top: BorderSide.lerp(a.top, b.top, t),
      right: BorderSide.lerp(a.right, b.right, t),
      bottom: BorderSide.lerp(a.bottom, b.bottom, t),
      left: BorderSide.lerp(a.left, b.left, t),
    });
  }
  paint(canvas: Canvas, rect: Rect, options: BoxBorderPaintOptions = {}): void {
    paintPhysical(canvas, rect, [this.top, this.right, this.bottom, this.left], options);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof Border &&
      other.constructor === this.constructor &&
      listEquals(this.sides, other.sides)
    );
  }
  get hashCode(): number {
    return hashValues(...this.sides);
  }
  override toString(): string {
    return this.isUniform
      ? `Border.all(${this.top})`
      : `Border(top: ${this.top}, right: ${this.right}, bottom: ${this.bottom}, left: ${this.left})`;
  }
}
export class BorderDirectional extends BoxBorder {
  readonly top: BorderSide;
  readonly start: BorderSide;
  readonly end: BorderSide;
  readonly bottom: BorderSide;
  constructor({
    top = BorderSide.none,
    start = BorderSide.none,
    end = BorderSide.none,
    bottom = BorderSide.none,
  }: DirectionalBorderSides = {}) {
    super();
    this.top = top;
    this.start = start;
    this.end = end;
    this.bottom = bottom;
  }
  private get sides(): readonly BorderSide[] {
    return [this.top, this.end, this.bottom, this.start];
  }
  get dimensions(): EdgeInsetsGeometry {
    return new EdgeInsetsDirectional(
      this.start.strokeInset,
      this.top.strokeInset,
      this.end.strokeInset,
      this.bottom.strokeInset,
    );
  }
  get isUniform(): boolean {
    return this.sides.every((x) => x.equals(this.top));
  }
  static merge(a: BorderDirectional, b: BorderDirectional): BorderDirectional {
    return new BorderDirectional({
      top: BorderSide.merge(a.top, b.top),
      start: BorderSide.merge(a.start, b.start),
      end: BorderSide.merge(a.end, b.end),
      bottom: BorderSide.merge(a.bottom, b.bottom),
    });
  }
  override add(other: ShapeBorder): BoxBorder | null {
    if (other instanceof BorderDirectional)
      return this.sides.every((x, i) => BorderSide.canMerge(x, other.sides[i]!))
        ? BorderDirectional.merge(this, other)
        : null;
    if (
      !(other instanceof Border) ||
      !BorderSide.canMerge(this.top, other.top) ||
      !BorderSide.canMerge(this.bottom, other.bottom)
    )
      return null;
    const top = BorderSide.merge(this.top, other.top),
      bottom = BorderSide.merge(this.bottom, other.bottom);
    if (!this.start.equals(BorderSide.none) || !this.end.equals(BorderSide.none))
      return other.left.equals(BorderSide.none) && other.right.equals(BorderSide.none)
        ? new BorderDirectional({ top, bottom, start: this.start, end: this.end })
        : null;
    return new Border({ top, bottom, left: other.left, right: other.right });
  }
  scale(t: number): BorderDirectional {
    return new BorderDirectional({
      top: this.top.scale(t),
      start: this.start.scale(t),
      end: this.end.scale(t),
      bottom: this.bottom.scale(t),
    });
  }
  override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
    return a instanceof BorderDirectional
      ? BorderDirectional.lerp(a, this, t)
      : super.lerpFrom(a, t);
  }
  override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
    return b instanceof BorderDirectional ? BorderDirectional.lerp(this, b, t) : super.lerpTo(b, t);
  }
  static override lerp(
    a: BorderDirectional | null,
    b: BorderDirectional | null,
    t: number,
  ): BorderDirectional | null {
    if (a === b) return a;
    if (a === null) return b!.scale(t);
    if (b === null) return a.scale(1 - t);
    return new BorderDirectional({
      top: BorderSide.lerp(a.top, b.top, t),
      start: BorderSide.lerp(a.start, b.start, t),
      end: BorderSide.lerp(a.end, b.end, t),
      bottom: BorderSide.lerp(a.bottom, b.bottom, t),
    });
  }
  paint(canvas: Canvas, rect: Rect, options: BoxBorderPaintOptions = {}): void {
    let left = this.start,
      right = this.end;
    if (!this.isUniform) {
      invariant(
        options.textDirection === 'ltr' || options.textDirection === 'rtl',
        'missing-text-direction',
        'Directional border painting requires text direction',
      );
      if (options.textDirection === 'rtl') {
        left = this.end;
        right = this.start;
      }
    }
    paintPhysical(canvas, rect, [this.top, right, this.bottom, left], options);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof BorderDirectional &&
      other.constructor === this.constructor &&
      listEquals(this.sides, other.sides)
    );
  }
  get hashCode(): number {
    return hashValues(...this.sides);
  }
  override toString(): string {
    return `BorderDirectional(top: ${this.top}, start: ${this.start}, end: ${this.end}, bottom: ${this.bottom})`;
  }
}
