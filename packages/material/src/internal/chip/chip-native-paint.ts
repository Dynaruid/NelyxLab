// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { nativeShape } from '@nelyx/core/framework/rendering/object';
import type {
  NativePaintEntry,
  NativePaintScalar as Scalar,
} from '@nelyx/core/framework/rendering/object';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Color } from '@nelyx/core/ui/color';
import type { ChipRenderOptions } from './chip-render.ts';

/** Source checkmark policy; every dimension is resolved in its avatar slot. */
export function nativeChipCheckmark(
  o: ChipRenderOptions,
  direction: 'ltr' | 'rtl',
): readonly NativePaintEntry[] {
  const t = o.theme,
    animation = o.checkmarkAnimation;
  if (!t.showCheckmark || animation.isDismissed) return [];
  const entries: NativePaintEntry[] = [];
  if (t.showAvatar)
    entries.push({
      kind: 'shape',
      color: Color.lerp(new Color(0x00000000), new Color(0x60191919), animation.value)!.toARGB32(),
      blendMode: 'srcATop',
      shape: { ...nativeShape(o.avatarBorder, direction), strokeColor: 0, strokeWidth: 0 },
    });
  const fallback =
      t.brightness === 'light'
        ? t.showAvatar
          ? 0xffffffff
          : 0xde000000
        : t.showAvatar
          ? 0xff000000
          : 0xdeffffff,
    base = t.checkmarkColor ?? new Color(fallback),
    reverse = animation.status === AnimationStatus.reverse,
    color = reverse ? Color.lerp(new Color(0x00000000), base, animation.value)! : base,
    phase = reverse ? 1 : animation.value;
  if (phase === 0) return entries;
  const h: Scalar = { op: 'height' },
    width: Scalar = { op: 'width' },
    scale = (coefficient: number): Scalar => ({ op: 'multiply', args: [h, coefficient] }),
    point = (x: number, y: number) => [scale(0.125 + 0.75 * x), scale(0.125 + 0.75 * y)] as const,
    start = point(0.15, 0.45),
    middle = point(0.4, 0.7),
    end = point(0.85, 0.25),
    commands: NonNullable<NativePaintEntry['path']>['commands'][number][] = [['move', ...start]];
  if (phase < 0.5)
    commands.push([
      'line',
      ...point(0.15 + (0.4 - 0.15) * phase * 2, 0.45 + (0.7 - 0.45) * phase * 2),
    ]);
  else {
    commands.push(['line', ...middle]);
    const progress = (phase - 0.5) * 2;
    commands.push(['line', ...point(0.4 + (0.85 - 0.4) * progress, 0.7 + (0.25 - 0.7) * progress)]);
  }
  // Keep endpoint construction explicit so reverse and completed paths agree.
  if (phase === 1) commands[commands.length - 1] = ['line', ...end];
  entries.push({
    kind: 'path',
    color: 0,
    shape: {
      kind: 'rrect',
      radii: Array(8).fill(0),
      strokeWidth: 0,
      strokeColor: color.toARGB32(),
      strokeAlign: 0,
    },
    geometry: { kind: 'program', rect: [0, 0, width, h], strokeWidth: scale(1 / 12) },
    path: { commands },
  });
  return entries;
}
