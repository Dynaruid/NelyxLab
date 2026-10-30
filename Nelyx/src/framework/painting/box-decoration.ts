// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter painting/box_decoration.dart.
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { Canvas } from '../../ui/canvas.ts';
import { Rect } from '../../ui/rect.ts';
import { Path } from '../../ui/path.ts';
import { Paint } from '../../ui/paint.ts';
import type { BlendMode } from '../../ui/paint.ts';
import type { Offset, Size } from '../../ui/geometry.ts';
import { lerpArgb } from '../../ui/color-values.ts';
import { Decoration, BoxPainter } from './decoration.ts';
import { BoxBorder, Border, BorderDirectional } from './box-border.ts';
import type { BoxShape } from './box-border.ts';
import { BorderSide } from './borders.ts';
import { BorderRadiusGeometry } from './border-radius.ts';
import { EdgeInsets, EdgeInsetsGeometry } from './edge-insets.ts';
import { BoxShadow } from './box-shadow.ts';
import { Gradient } from './gradient.ts';
import { ImageConfiguration } from './image-configuration.ts';
import { DecorationImage } from './decoration-image.ts';
import type { DecorationImagePainter } from './decoration-image.ts';
import { debugDisableShadows } from './debug.ts';
import { hashValues, listEquals, valueEquals } from './value-equality.ts';
export interface BoxDecorationOptions {
  readonly color?: number | null;
  readonly image?: DecorationImage | null;
  readonly border?: BoxBorder | null;
  readonly borderRadius?: BorderRadiusGeometry | null;
  readonly boxShadow?: readonly BoxShadow[] | null;
  readonly gradient?: Gradient | null;
  readonly backgroundBlendMode?: BlendMode | null;
  readonly shape?: BoxShape;
}
export class BoxDecoration extends Decoration {
  readonly color: number | null;
  readonly image: DecorationImage | null;
  readonly border: BoxBorder | null;
  readonly borderRadius: BorderRadiusGeometry | null;
  readonly boxShadow: readonly BoxShadow[] | null;
  readonly gradient: Gradient | null;
  readonly backgroundBlendMode: BlendMode | null;
  readonly shape: BoxShape;
  constructor({
    color = null,
    image = null,
    border = null,
    borderRadius = null,
    boxShadow = null,
    gradient = null,
    backgroundBlendMode = null,
    shape = 'rectangle',
  }: BoxDecorationOptions = {}) {
    super();
    invariant(
      image === null || image instanceof DecorationImage,
      'invalid-decoration-image',
      'BoxDecoration.image must be a DecorationImage',
    );
    invariant(
      backgroundBlendMode === null || color !== null || gradient !== null,
      'invalid-decoration',
      'backgroundBlendMode requires color or gradient',
    );
    invariant(shape === 'rectangle' || shape === 'circle', 'invalid-shape', 'Unknown box shape');
    this.color = color;
    this.image = image;
    this.border = border;
    this.borderRadius = borderRadius;
    this.boxShadow = boxShadow;
    this.gradient = gradient;
    this.backgroundBlendMode = backgroundBlendMode;
    this.shape = shape;
    this.debugAssertIsValid();
  }
  override debugAssertIsValid(): boolean {
    invariant(
      this.shape !== 'circle' || this.borderRadius === null,
      'invalid-decoration',
      'A circle cannot have a border radius',
    );
    return true;
  }
  copyWith(options: BoxDecorationOptions = {}): BoxDecoration {
    return new BoxDecoration({
      color: options.color ?? this.color,
      image: options.image ?? this.image,
      border: options.border ?? this.border,
      borderRadius: options.borderRadius ?? this.borderRadius,
      boxShadow: options.boxShadow ?? this.boxShadow,
      gradient: options.gradient ?? this.gradient,
      backgroundBlendMode: options.backgroundBlendMode ?? this.backgroundBlendMode,
      shape: options.shape ?? this.shape,
    });
  }
  override get padding(): EdgeInsetsGeometry {
    return this.border?.dimensions ?? EdgeInsets.zero;
  }
  override get isComplex(): boolean {
    return this.boxShadow !== null;
  }
  override getClipPath(rect: Rect, textDirection: 'ltr' | 'rtl'): Path {
    const path = new Path();
    if (rect.isEmpty) return path;
    if (this.shape === 'circle')
      path.addOval(Rect.fromCircle({ center: rect.center, radius: rect.shortestSide / 2 }));
    else if (this.borderRadius !== null)
      path.addRRect(this.borderRadius.resolve(textDirection).toRRect(rect));
    else path.addRect(rect);
    return path;
  }
  scale(factor: number): BoxDecoration {
    return new BoxDecoration({
      color: lerpArgb(null, this.color, factor),
      image: DecorationImage.lerp(null, this.image, factor),
      border: BoxBorder.lerp(null, this.border, factor),
      borderRadius: BorderRadiusGeometry.lerp(null, this.borderRadius, factor),
      boxShadow: BoxShadow.lerpList(null, this.boxShadow, factor),
      gradient: this.gradient?.scale(factor) ?? null,
      shape: this.shape,
    });
  }
  override lerpFrom(a: Decoration | null, t: number): BoxDecoration | null {
    return a === null
      ? this.scale(t)
      : a instanceof BoxDecoration
        ? BoxDecoration.lerp(a, this, t)
        : null;
  }
  override lerpTo(b: Decoration | null, t: number): BoxDecoration | null {
    return b === null
      ? this.scale(1 - t)
      : b instanceof BoxDecoration
        ? BoxDecoration.lerp(this, b, t)
        : null;
  }
  static override lerp(
    a: BoxDecoration | null,
    b: BoxDecoration | null,
    t: number,
  ): BoxDecoration | null {
    if (a === b) return a;
    if (a === null) return b!.scale(t);
    if (b === null) return a.scale(1 - t);
    if (t === 0) return a;
    if (t === 1) return b;
    return new BoxDecoration({
      color: lerpArgb(a.color, b.color, t),
      image: DecorationImage.lerp(a.image, b.image, t),
      border: BoxBorder.lerp(a.border, b.border, t),
      borderRadius: BorderRadiusGeometry.lerp(a.borderRadius, b.borderRadius, t),
      boxShadow: BoxShadow.lerpList(a.boxShadow, b.boxShadow, t),
      gradient: Gradient.lerp(a.gradient, b.gradient, t),
      shape: t < 0.5 ? a.shape : b.shape,
    });
  }
  override hitTest(
    size: Size,
    point: Offset,
    { textDirection = null }: { readonly textDirection?: 'ltr' | 'rtl' | null } = {},
  ): boolean {
    const rect = Rect.fromLTWH(0, 0, size.width, size.height);
    if (!rect.contains(point)) return false;
    if (this.shape === 'circle') {
      const dx = point.x - size.width / 2,
        dy = point.y - size.height / 2,
        radius = Math.min(size.width, size.height) / 2;
      return dx * dx + dy * dy <= radius * radius;
    }
    return this.borderRadius?.resolve(textDirection).toRRect(rect).contains(point) ?? true;
  }
  override createBoxPainter(onChanged: (() => void) | null = null): BoxPainter {
    invariant(
      this.image === null || onChanged !== null,
      'missing-image-change-callback',
      'A decoration image requires onChanged',
    );
    return new _BoxDecorationPainter(this, onChanged);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof BoxDecoration &&
      other.constructor === this.constructor &&
      other.color === this.color &&
      valueEquals(other.image, this.image) &&
      valueEquals(other.border, this.border) &&
      valueEquals(other.borderRadius, this.borderRadius) &&
      listEquals(other.boxShadow, this.boxShadow) &&
      valueEquals(other.gradient, this.gradient) &&
      other.backgroundBlendMode === this.backgroundBlendMode &&
      other.shape === this.shape
    );
  }
  get hashCode(): number {
    return hashValues(
      this.color,
      this.image,
      this.border,
      this.borderRadius,
      this.boxShadow,
      this.gradient,
      this.backgroundBlendMode,
      this.shape,
    );
  }
  override toString(): string {
    return `BoxDecoration(color: ${this.color}, image: ${this.image}, border: ${this.border}, borderRadius: ${this.borderRadius}, boxShadow: ${this.boxShadow}, gradient: ${this.gradient}, backgroundBlendMode: ${this.backgroundBlendMode}, shape: ${this.shape})`;
  }
}
class _BoxDecorationPainter extends BoxPainter {
  private imagePainter: DecorationImagePainter | null = null;
  private background: Paint | null = null;
  private cachedRect: Rect | null = null;
  private cachedDirection: 'ltr' | 'rtl' | null = null;
  constructor(
    private readonly decoration: BoxDecoration,
    onChanged: (() => void) | null,
  ) {
    super(onChanged);
  }
  private backgroundPaint(rect: Rect, textDirection: 'ltr' | 'rtl' | null): Paint {
    if (
      this.background === null ||
      (this.decoration.gradient !== null &&
        (!rect.equals(this.cachedRect) || textDirection !== this.cachedDirection))
    ) {
      this.background?.shader?.dispose();
      this.background = null;
      const paint = new Paint();
      if (this.decoration.color !== null) paint.color = this.decoration.color;
      if (this.decoration.backgroundBlendMode !== null)
        paint.blendMode = this.decoration.backgroundBlendMode;
      if (this.decoration.gradient !== null)
        paint.shader = this.decoration.gradient.createShader(rect, { textDirection });
      this.background = paint;
      this.cachedRect = rect;
      this.cachedDirection = textDirection;
    }
    return this.background;
  }
  private paintBox(
    canvas: Canvas,
    rect: Rect,
    paint: Paint,
    textDirection: 'ltr' | 'rtl' | null,
  ): void {
    if (rect.isEmpty) return;
    if (this.decoration.shape === 'circle')
      canvas.drawCircle(rect.center, rect.shortestSide / 2, paint);
    else if (this.decoration.borderRadius !== null)
      canvas.drawRRect(this.decoration.borderRadius.resolve(textDirection).toRRect(rect), paint);
    else canvas.drawRect(rect, paint);
  }
  private adjustedRect(rect: Rect, direction: 'ltr' | 'rtl' | null): Rect {
    const border = this.decoration.border;
    let sides: readonly [BorderSide, BorderSide, BorderSide, BorderSide];
    if (border instanceof Border) sides = [border.left, border.top, border.right, border.bottom];
    else if (border instanceof BorderDirectional && direction !== null)
      sides = [
        direction === 'rtl' ? border.end : border.start,
        border.top,
        direction === 'rtl' ? border.start : border.end,
        border.bottom,
      ];
    else return rect;
    const adjusted = sides.map((x) =>
      x.color >>> 24 === 255 && x.style === 'solid' ? x.strokeInset / 2 : 0,
    );
    return new EdgeInsets(adjusted[0]!, adjusted[1]!, adjusted[2]!, adjusted[3]!).deflateRect(rect);
  }
  paint(canvas: Canvas, offset: Offset, configuration: ImageConfiguration): void {
    this.assertLive();
    invariant(
      configuration.size !== null,
      'missing-decoration-size',
      'BoxPainter requires configuration.size',
    );
    const rect = Rect.fromLTWH(
        offset.x,
        offset.y,
        configuration.size.width,
        configuration.size.height,
      ),
      direction = configuration.textDirection;
    for (const shadow of this.decoration.boxShadow ?? []) {
      const bounds = rect.shift(shadow.offset).inflate(shadow.spreadRadius),
        clip = FoundationBuildMode.debug && debugDisableShadows && shadow.blurStyle === 'outer';
      if (clip) canvas.save();
      try {
        if (clip) canvas.clipRect(bounds);
        this.paintBox(canvas, bounds, shadow.toPaint(), direction);
      } finally {
        if (clip) canvas.restore();
      }
    }
    if (this.decoration.color !== null || this.decoration.gradient !== null)
      this.paintBox(
        canvas,
        this.adjustedRect(rect, direction),
        this.backgroundPaint(rect, direction),
        direction,
      );
    if (this.decoration.image) {
      this.imagePainter ??= this.decoration.image.createPainter(this.onChanged!);
      let clip: Path | null = null;
      if (this.decoration.shape === 'circle') {
        clip = new Path();
        clip.addOval(Rect.fromCircle({ center: rect.center, radius: rect.shortestSide / 2 }));
      } else if (this.decoration.borderRadius !== null) {
        clip = new Path();
        clip.addRRect(this.decoration.borderRadius.resolve(direction).toRRect(rect));
      }
      this.imagePainter.paint(canvas, rect, clip, configuration);
    }
    this.decoration.border?.paint(canvas, rect, {
      shape: this.decoration.shape,
      borderRadius: this.decoration.borderRadius?.resolve(direction) ?? null,
      textDirection: direction,
    });
  }
  override dispose(): void {
    if (this.debugDisposed) return;
    const errors: unknown[] = [];
    for (const cleanup of [
      () => this.imagePainter?.dispose(),
      () => this.background?.shader?.dispose(),
      () => super.dispose(),
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    this.imagePainter = null;
    this.background = null;
    this.cachedRect = null;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, 'BoxDecoration painter disposal failed');
  }
  toString(): string {
    return `BoxPainter for ${this.decoration}`;
  }
}
