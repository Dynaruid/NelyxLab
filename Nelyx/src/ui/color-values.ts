// SPDX-License-Identifier: BSD-3-Clause
// Internal ARGB8 adaptations; full ui.Color/color-space values remain separate.
import { invariant } from '../foundation/errors.ts';
export function lerpArgb(a: number | null, b: number | null, t: number): number | null {
  invariant(Number.isFinite(t), 'invalid-color-lerp', 'Color interpolation must be finite');
  if (a === null && b === null) return null;
  const byte = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  if (a === null) return ((byte((b! >>> 24) * t) << 24) | (b! & 0xffffff)) >>> 0;
  if (b === null) return ((byte((a >>> 24) * (1 - t)) << 24) | (a & 0xffffff)) >>> 0;
  let result = 0;
  for (const shift of [24, 16, 8, 0])
    result |= byte(((a >>> shift) & 255) * (1 - t) + ((b >>> shift) & 255) * t) << shift;
  return result >>> 0;
}
export function withArgbOpacity(color: number, opacity: number): number {
  invariant(
    Number.isFinite(opacity) && opacity >= 0 && opacity <= 1,
    'invalid-opacity',
    'Opacity must be in [0,1]',
  );
  return ((Math.round(opacity * 255) << 24) | (color & 0xffffff)) >>> 0;
}
