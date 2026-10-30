// SPDX-License-Identifier: BSD-3-Clause
import type { Skia } from './skia/types/Skia.ts';
import type { SkPaint, PaintStyle, StrokeCap, StrokeJoin } from './skia/types/Drawing.ts';
import type { BlendMode } from './skia/types/Paint/BlendMode.ts';
import { blendModes } from '@nelyx/core/ui/paint';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
export function configurePaint(api: Skia, paint: SkPaint, value: PaintSnapshot): void {
  paint.setColor(api.Color(value.color));
  paint.setAntiAlias(value.isAntiAlias);
  paint.setStyle((value.style === 'stroke' ? 1 : 0) as PaintStyle);
  paint.setStrokeWidth(value.strokeWidth);
  paint.setStrokeMiter(value.strokeMiterLimit);
  paint.setStrokeCap(['butt', 'round', 'square'].indexOf(value.strokeCap) as StrokeCap);
  paint.setStrokeJoin(['miter', 'round', 'bevel'].indexOf(value.strokeJoin) as StrokeJoin);
  paint.setBlendMode(blendModes.indexOf(value.blendMode) as BlendMode);
}
