// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InkFeature } from './internal/material/material-ink-owner.ts';
import type { InkFeatureOptions } from './internal/material/material-ink-owner.ts';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Matrix4 } from '@nelyx/core/math/matrix4';
import type { Paint } from '@nelyx/core/ui/paint';
import type { Offset } from '@nelyx/core/ui/offset';
import type { Rect } from '@nelyx/core/ui/rect';
import { Color } from '@nelyx/core/ui/color';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { MatrixUtils } from '@nelyx/core/framework/painting/matrix-utils';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { invariant } from '@nelyx/core/foundation/errors';
export type RectCallback = () => Rect;
export interface InteractiveInkFeatureOptions extends InkFeatureOptions {
  readonly color: Color;
  readonly customBorder?: ShapeBorder | null;
}
export interface InkCircleOptions {
  readonly canvas: Canvas;
  readonly transform: Matrix4;
  readonly paint: Paint;
  readonly center: Offset /** @dartType double */;
  readonly radius: number;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly customBorder?: ShapeBorder | null;
  readonly borderRadius?: BorderRadius;
  readonly clipCallback?: RectCallback | null;
}
export abstract class InteractiveInkFeature extends InkFeature {
  private currentColor: Color;
  private currentBorder: ShapeBorder | null;
  constructor({ color, customBorder = null, ...options }: InteractiveInkFeatureOptions) {
    super(options);
    invariant(
      color instanceof Color,
      'invalid-ink-color',
      'Interactive ink requires the owning Core Color',
    );
    this.currentColor = color;
    this.currentBorder = customBorder;
  }
  /** The original base contract intentionally has no confirmation/cancellation reaction. */
  confirm(): void {}
  cancel(): void {}
  protected assertLive(): void {
    invariant(!this.debugDisposed, 'disposed-interactive-ink', 'InteractiveInkFeature is disposed');
  }
  get color(): Color {
    return this.currentColor;
  }
  set color(value: Color) {
    this.assertLive();
    if (value.equals(this.currentColor)) return;
    this.currentColor = value;
    this.controller.markNeedsPaint();
  }
  get customBorder(): ShapeBorder | null {
    return this.currentBorder;
  }
  set customBorder(value: ShapeBorder | null) {
    this.assertLive();
    if (valueEquals(value, this.currentBorder)) return;
    this.currentBorder = value;
    this.controller.markNeedsPaint();
  }
  protected paintInkCircle({
    canvas,
    transform,
    paint,
    center,
    radius,
    textDirection = null,
    customBorder = null,
    borderRadius = BorderRadius.zero,
    clipCallback = null,
  }: InkCircleOptions): void {
    const origin = MatrixUtils.getAsTranslation(transform);
    canvas.save();
    try {
      if (origin === null) canvas.transform(transform.storage);
      else canvas.translate(origin.x, origin.y);
      if (clipCallback !== null) {
        const rect = clipCallback();
        if (customBorder !== null)
          canvas.clipPath(customBorder.getOuterPath(rect, { textDirection }));
        else if (!borderRadius.equals(BorderRadius.zero))
          canvas.clipRRect(borderRadius.toRRect(rect));
        else canvas.clipRect(rect);
      }
      canvas.drawCircle(center, radius, paint);
    } finally {
      canvas.restore();
    }
  }
}
export interface InkFactoryOptions extends InteractiveInkFeatureOptions {
  readonly position: Offset;
  readonly textDirection: 'ltr' | 'rtl';
  readonly containedInkWell?: boolean;
  readonly rectCallback?: RectCallback | null;
  readonly borderRadius?: BorderRadius | null /** @dartType double? */;
  readonly radius?: number | null;
}
export abstract class InteractiveInkFeatureFactory {
  abstract create(options: InkFactoryOptions): InteractiveInkFeature;
}
