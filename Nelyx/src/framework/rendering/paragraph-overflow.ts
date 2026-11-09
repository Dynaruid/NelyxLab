// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Canonical paragraph paint policy from pinned rendering/paragraph.dart.
import type { TextLayout } from '../../ui/types.ts';
import type { Size } from '../../ui/geometry.ts';
import { Paint } from '../../ui/paint.ts';
import type { Shader } from '../../ui/shader.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { TextOverflow, TextWidthBasis } from '../painting/text-painter.ts';
import type { NativePaintEntry, NativePaintScalar } from './native-paint.ts';

/** The same Source fade policy, recorded without reading final geometry. */
export function nativeParagraphFade(
  direction: 'ltr' | 'rtl',
): Omit<NativePaintEntry, 'reference' | 'paragraph'> {
  const width: NativePaintScalar = { op: 'width' },
    height: NativePaintScalar = { op: 'height' },
    horizontal: NativePaintScalar = { op: 'contentOverflowX' },
    probeWidth: NativePaintScalar = { op: 'overflowProbeWidth' },
    select = (yes: NativePaintScalar, no: NativePaintScalar): NativePaintScalar => ({
      op: 'select',
      args: [horizontal, yes, no],
    });
  return {
    kind: 'linearMask',
    color: 0,
    shape: {
      kind: 'rrect',
      radii: Array<number>(8).fill(0),
      strokeWidth: 0,
      strokeAlign: 0,
      strokeColor: 0,
    },
    geometry: { kind: 'program', rect: [0, 0, width, height], visible: { op: 'contentOverflow' } },
    gradient: [
      select(direction === 'rtl' ? probeWidth : { op: 'subtract', args: [width, probeWidth] }, 0),
      select(0, {
        op: 'subtract',
        args: [height, { op: 'divide', args: [{ op: 'overflowProbeHeight' }, 2] }],
      }),
      select(direction === 'rtl' ? 0 : width, 0),
      select(0, height),
    ],
  };
}
export interface ParagraphLayoutOptions {
  readonly softWrap?: boolean;
  readonly overflow?: TextOverflow;
  readonly textWidthBasis?: TextWidthBasis;
}
export function paragraphHasOverflow(
  paragraph: TextLayout | undefined,
  size: Size,
  contentWidth?: number,
): boolean {
  return (
    !!paragraph &&
    (paragraph.overflow ||
      paragraph.height > size.height ||
      (contentWidth === undefined
        ? paragraph.longestLine > size.width + 0.01
        : contentWidth > size.width))
  );
}
export function paintParagraphOverflow(
  context: PaintingContext,
  paragraph: TextLayout,
  size: Size,
  options: ParagraphLayoutOptions,
  paint: () => void,
  contentWidth?: number,
  overflowShader?: Shader,
): void {
  if (!paragraphHasOverflow(paragraph, size, contentWidth) || options.overflow === 'visible') {
    paint();
    return;
  }
  const bounds = { x: 0, y: 0, ...size },
    fade = options.overflow === 'fade';
  if (fade) context.saveLayer(bounds, new Paint());
  else context.save();
  try {
    context.clipRect(bounds);
    paint();
    if (fade && overflowShader)
      context.drawRect(bounds, new Paint({ blendMode: 'modulate', shader: overflowShader }));
  } finally {
    context.restore();
  }
}
