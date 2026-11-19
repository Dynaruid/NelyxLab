// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/shadows.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { Offset } from '@nelyx/core/ui/offset';
import { ReadonlyThemeMap } from './internal/theme/theme-types.ts';

const keyUmbraOpacity = 0x33000000;
const keyPenumbraOpacity = 0x24000000;
const ambientShadowOpacity = 0x1f000000;

type ShadowGeometry = readonly [offsetY: number, blurRadius: number, spreadRadius?: number];

function shadow(color: number, [offsetY, blurRadius, spreadRadius = 0]: ShadowGeometry): BoxShadow {
  return Object.freeze(
    new BoxShadow({ color, offset: new Offset(0, offsetY), blurRadius, spreadRadius }),
  );
}

function layers(
  umbra: ShadowGeometry,
  penumbra: ShadowGeometry,
  ambient: ShadowGeometry,
): readonly BoxShadow[] {
  return Object.freeze([
    shadow(keyUmbraOpacity, umbra),
    shadow(keyPenumbraOpacity, penumbra),
    shadow(ambientShadowOpacity, ambient),
  ]);
}

/** Material elevation shadows in umbra, penumbra and ambient order. */
export const kElevationToShadow: ReadonlyMap<number, readonly BoxShadow[]> = new ReadonlyThemeMap([
  [0, Object.freeze([])],
  [1, layers([2, 1, -1], [1, 1], [1, 3])],
  [2, layers([3, 1, -2], [2, 2], [1, 5])],
  [3, layers([3, 3, -2], [3, 4], [1, 8])],
  [4, layers([2, 4, -1], [4, 5], [1, 10])],
  [6, layers([3, 5, -1], [6, 10], [1, 18])],
  [8, layers([5, 5, -3], [8, 10, 1], [3, 14, 2])],
  [9, layers([5, 6, -3], [9, 12, 1], [3, 16, 2])],
  [12, layers([7, 8, -4], [12, 17, 2], [5, 22, 4])],
  [16, layers([8, 10, -5], [16, 24, 2], [6, 30, 5])],
  [24, layers([11, 15, -7], [24, 38, 3], [9, 46, 8])],
]);
