// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Finite color/shape-only ShapeDecoration receiver shared by design compositions; full image/gradient/shadow APIs remain separate.
import { Decoration, BoxPainter } from './decoration.ts';
import type { ImageConfiguration } from './image-configuration.ts';
import type { ShapeBorder } from './borders.ts';
import type { EdgeInsetsGeometry } from './edge-insets.ts';
import { valueEquals, hashValues } from './value-equality.ts';
import type { Canvas } from '../../ui/canvas.ts';
import { Color } from '../../ui/color.ts';
import { Paint } from '../../ui/paint.ts';
import { Rect } from '../../ui/rect.ts';
import type { Offset } from '../../ui/geometry.ts';
import { invariant } from '../../foundation/errors.ts';
import { OutlinedBorder } from './borders.ts';
import { isNonPaintingCircleBorder } from './circle-border.ts';
const ordinaryDecorations = new WeakSet<ColorShapeDecoration>();
const ordinaryPainters = new WeakSet<BoxPainter>();
export class ColorShapeDecoration extends Decoration {
  constructor(
    readonly shape: ShapeBorder,
    readonly color: Color | null,
  ) {
    super();
    if (new.target === ColorShapeDecoration) ordinaryDecorations.add(this);
  }
  override get padding(): EdgeInsetsGeometry {
    return this.shape.dimensions;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ColorShapeDecoration &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.color, other.color)
    );
  }
  get hashCode(): number {
    return hashValues(this.shape, this.color);
  }
  override getClipPath(rect: Rect, textDirection: 'ltr' | 'rtl'): import('../../ui/path.ts').Path {
    return this.shape.getOuterPath(rect, { textDirection });
  }
  override createBoxPainter(onChanged: (() => void) | null = null): BoxPainter {
    return new ColorShapePainter(this, onChanged);
  }
}
class ColorShapePainter extends BoxPainter {
  constructor(
    private readonly decoration: ColorShapeDecoration,
    onChanged: (() => void) | null,
  ) {
    super(onChanged);
    ordinaryPainters.add(this);
  }
  paint(canvas: Canvas, offset: Offset, configuration: ImageConfiguration): void {
    this.assertLive();
    const size = configuration.size;
    invariant(
      size !== null,
      'missing-color-shape-size',
      'Color/shape decoration requires actual paint size',
    );
    const rect = Rect.fromLTWH(offset.x, offset.y, size.width, size.height),
      options = { textDirection: configuration.textDirection },
      d = this.decoration;
    if (d.color !== null) {
      const paint = new Paint({ color: d.color.toARGB32() });
      if (d.shape.preferPaintInterior) {
        const shape = d.shape,
          adjusted =
            shape instanceof OutlinedBorder &&
            shape.side.color >>> 24 === 255 &&
            shape.side.style === 'solid'
              ? rect.deflate(shape.side.strokeInset / 2)
              : rect;
        shape.paintInterior(canvas, adjusted, paint, options);
      } else canvas.drawPath(d.shape.getOuterPath(rect, options), paint);
    }
    d.shape.paint(canvas, rect, options);
  }
}
const colorShapePaint = ColorShapePainter.prototype.paint;
const boxPainterAssertLive = Object.getOwnPropertyDescriptor(
  BoxPainter.prototype,
  'assertLive',
)!.value;
/** @internal A no-fill, no-border painter has no Canvas or geometry work.
 * Recheck live fields and method descriptors on every call; this is not a
 * cached decoration result and never admits caller painters or shape hooks. */
export function isEmptyColorShapePainter(painter: BoxPainter | null): boolean {
  if (
    painter === null ||
    !ordinaryPainters.has(painter) ||
    Object.getPrototypeOf(painter) !== ColorShapePainter.prototype ||
    Object.getPrototypeOf(ColorShapePainter.prototype) !== BoxPainter.prototype ||
    Object.hasOwn(ColorShapePainter.prototype, 'assertLive') ||
    Object.hasOwn(painter, 'paint') ||
    Object.hasOwn(painter, 'assertLive') ||
    Object.getOwnPropertyDescriptor(BoxPainter.prototype, 'assertLive')?.value !==
      boxPainterAssertLive ||
    Object.getOwnPropertyDescriptor(ColorShapePainter.prototype, 'paint')?.value !== colorShapePaint
  )
    return false;
  const live = Object.getOwnPropertyDescriptor(painter, 'dead'),
    record = Object.getOwnPropertyDescriptor(painter, 'decoration');
  if (!live || !('value' in live) || live.value !== false) return false;
  if (!record || !('value' in record) || !ordinaryDecorations.has(record.value)) return false;
  const decoration = record.value as ColorShapeDecoration;
  if (Object.getPrototypeOf(decoration) !== ColorShapeDecoration.prototype) return false;
  const color = Object.getOwnPropertyDescriptor(decoration, 'color'),
    shape = Object.getOwnPropertyDescriptor(decoration, 'shape');
  return (
    color !== undefined &&
    'value' in color &&
    color.value === null &&
    shape !== undefined &&
    'value' in shape &&
    isNonPaintingCircleBorder(shape.value)
  );
}
