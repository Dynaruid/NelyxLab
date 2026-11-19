// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxPainter, Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets, EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Offset } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import type { TextDirection } from '@nelyx/core/ui/typography';

export interface UnderlineTabIndicatorOptions {
  readonly borderRadius?: BorderRadius | null;
  readonly borderSide?: BorderSide;
  readonly insets?: EdgeInsetsGeometry;
}

export class UnderlineTabIndicator extends Decoration {
  constructor({
    borderRadius = null,
    borderSide = new BorderSide({ color: 0xffffffff, width: 2 }),
    insets = EdgeInsets.zero,
  }: UnderlineTabIndicatorOptions = {}) {
    super();
    this.borderRadius = borderRadius;
    this.borderSide = borderSide;
    this.insets = insets;
  }

  readonly borderRadius: BorderRadius | null;
  readonly borderSide: BorderSide;
  readonly insets: EdgeInsetsGeometry;

  override lerpFrom(a: Decoration | null, t: number): Decoration | null {
    if (!(a instanceof UnderlineTabIndicator)) return super.lerpFrom(a, t);
    return new UnderlineTabIndicator({
      borderSide: BorderSide.lerp(a.borderSide, this.borderSide, t),
      insets: EdgeInsetsGeometry.lerp(a.insets, this.insets, t)!,
    });
  }

  override lerpTo(b: Decoration | null, t: number): Decoration | null {
    if (!(b instanceof UnderlineTabIndicator)) return super.lerpTo(b, t);
    return b.lerpFrom(this, t);
  }

  override createBoxPainter(onChanged: (() => void) | null = null): BoxPainter {
    return new UnderlinePainter(this, onChanged);
  }

  override getClipPath(rect: Rect, direction: TextDirection): Path {
    const underline = underlineRect(this, rect, direction);
    const path = new Path();
    if (this.borderRadius) path.addRRect(this.borderRadius.toRRect(underline));
    else path.addRect(underline);
    return path;
  }
}

function underlineRect(
  indicator: UnderlineTabIndicator,
  rect: Rect,
  direction: TextDirection,
): Rect {
  const inset = indicator.insets.resolve(direction).deflateRect(rect);
  return Rect.fromLTWH(
    inset.left,
    inset.bottom - indicator.borderSide.width,
    inset.width,
    indicator.borderSide.width,
  );
}

class UnderlinePainter extends BoxPainter {
  constructor(
    readonly decoration: UnderlineTabIndicator,
    onChanged: (() => void) | null,
  ) {
    super(onChanged);
  }

  override paint(
    canvas: Canvas,
    offset: Offset,
    { size, textDirection }: ImageConfiguration,
  ): void {
    this.assertLive();
    if (!size || !textDirection) return;
    const { borderSide, borderRadius } = this.decoration;
    const rect = underlineRect(
      this.decoration,
      Rect.fromLTWH(offset.x, offset.y, size.width, size.height),
      textDirection,
    );
    if (borderRadius) {
      canvas.drawRRect(borderRadius.toRRect(rect), new Paint({ color: borderSide.color }));
      return;
    }
    const paint = borderSide.toPaint();
    paint.strokeCap = 'square';
    const line = rect.deflate(borderSide.width / 2);
    canvas.drawLine(line.bottomLeft, line.bottomRight, paint);
  }
}
