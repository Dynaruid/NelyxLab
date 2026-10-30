// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned material/elevation_overlay.dart, including the complete SurfaceTint token table.
import { Color } from '@nelyx/core/ui/color';
const levels = Object.freeze([
  [0, 0],
  [1, 0.05],
  [3, 0.08],
  [6, 0.11],
  [8, 0.12],
  [12, 0.14],
] as const);
function tintOpacity(elevation: number): number {
  if (elevation < levels[0][0]) return levels[0][1];
  let index = 0;
  while (elevation >= levels[index]![0]) {
    if (elevation === levels[index]![0] || index + 1 === levels.length) return levels[index]![1];
    index++;
  }
  const lower = levels[index - 1]!,
    upper = levels[index]!,
    t = (elevation - lower[0]) / (upper[0] - lower[0]);
  return lower[1] + t * (upper[1] - lower[1]);
}
export class ElevationOverlay {
  /** @dartParam elevation double */ static applySurfaceTint(
    color: Color,
    surfaceTint: Color | null,
    elevation: number,
  ): Color {
    return surfaceTint !== null && !surfaceTint.equals(new Color(0))
      ? Color.alphaBlend(surfaceTint.withOpacity(tintOpacity(elevation)), color)
      : color;
  }
}
