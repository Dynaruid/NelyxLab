// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import { RRect } from '@nelyx/core/ui/rrect';
import { Radius } from '@nelyx/core/ui/radius';
import type { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import { CupertinoColors } from './colors.ts';
import { coreCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
const sliderShadows = Object.freeze([
    new BoxShadow({
      color: 0x26000000,
      offset: new Offset(0, 3),
      blurRadius: 8,
    }),
    new BoxShadow({
      color: 0x29000000,
      offset: new Offset(0, 1),
      blurRadius: 1,
    }),
    new BoxShadow({
      color: 0x1a000000,
      offset: new Offset(0, 3),
      blurRadius: 1,
    }),
  ]),
  switchShadows = Object.freeze([
    new BoxShadow({
      color: 0x26000000,
      offset: new Offset(0, 3),
      blurRadius: 8,
    }),
    new BoxShadow({
      color: 0x0f000000,
      offset: new Offset(0, 3),
      blurRadius: 1,
    }),
  ]);
export interface CupertinoThumbPainterOptions {
  readonly color?: CupertinoColor;
  readonly shadows?: readonly BoxShadow[];
}
/** Original complete thumb/shadow geometry on Core Color/BoxShadow/Canvas. */
export class CupertinoThumbPainter {
  static readonly radius = 14;
  static readonly extension = 7;
  readonly color: Color;
  readonly shadows: readonly BoxShadow[];
  constructor({
    color = CupertinoColors.white,
    shadows = sliderShadows,
  }: CupertinoThumbPainterOptions = {}) {
    this.color = coreCupertinoColor(color);
    this.shadows = shadows;
  }
  static switchThumb(options: CupertinoThumbPainterOptions = {}): CupertinoThumbPainter {
    return new CupertinoThumbPainter({ ...options, shadows: options.shadows ?? switchShadows });
  }
  paint(canvas: Canvas, rect: Rect): void {
    const shape = RRect.fromRectAndRadius(rect, Radius.circular(rect.shortestSide / 2));
    for (const shadow of this.shadows)
      canvas.drawRRect(shape.shift(shadow.offset), shadow.toPaint());
    canvas.drawRRect(shape.inflate(0.5), new Paint({ color: 0x0a000000 }));
    canvas.drawRRect(shape, new Paint({ color: this.color.toARGB32() }));
  }
}
