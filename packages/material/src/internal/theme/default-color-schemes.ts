// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/color_scheme.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { ColorScheme } from '../../color-scheme.ts';
import { Colors } from '../../colors.ts';
import type { MaterialColor } from '../../colors.ts';
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import type { ColorRole } from '../../color-scheme.ts';
const light = Object.freeze(new ColorScheme()),
  dark = Object.freeze(new ColorScheme({ brightness: 'dark' }));
export function defaultMaterialColorScheme(brightness: 'light' | 'dark'): ColorScheme {
  return brightness === 'dark' ? dark : light;
}
export function material2ColorScheme(
  brightness: 'light' | 'dark',
  swatch: MaterialColor,
  card: Color,
): ColorScheme {
  const contrast = (color: Color) =>
    (color.computeLuminance() + 0.05) ** 2 > 0.15 ? 0xff000000 : 0xffffffff;
  const isDark = brightness === 'dark';
  const accent = isDark ? Colors.tealAccent.shade200 : swatch.shade500;
  const primary = swatch.toARGB32(),
    onPrimary = contrast(swatch);
  const secondary = accent.toARGB32(),
    onSecondary = contrast(accent);
  const surface = card.toARGB32(),
    onSurface = isDark ? 0xffffffff : 0xff000000;
  const error = Colors.red.shade700.toARGB32(),
    onError = isDark ? 0xff000000 : 0xffffffff;
  return new ColorScheme({
    brightness,
    primary,
    onPrimary,
    primaryContainer: primary,
    onPrimaryContainer: onPrimary,
    primaryFixed: primary,
    primaryFixedDim: primary,
    onPrimaryFixed: onPrimary,
    onPrimaryFixedVariant: onPrimary,
    secondary,
    onSecondary,
    secondaryContainer: secondary,
    onSecondaryContainer: onSecondary,
    secondaryFixed: secondary,
    secondaryFixedDim: secondary,
    onSecondaryFixed: onSecondary,
    onSecondaryFixedVariant: onSecondary,
    tertiary: secondary,
    onTertiary: onSecondary,
    tertiaryContainer: secondary,
    onTertiaryContainer: onSecondary,
    tertiaryFixed: secondary,
    tertiaryFixedDim: secondary,
    onTertiaryFixed: onSecondary,
    onTertiaryFixedVariant: onSecondary,
    error,
    onError,
    errorContainer: error,
    onErrorContainer: onError,
    surface,
    onSurface,
    surfaceBright: surface,
    surfaceDim: surface,
    surfaceContainerLowest: surface,
    surfaceContainerLow: surface,
    surfaceContainer: surface,
    surfaceContainerHigh: surface,
    surfaceContainerHighest: surface,
    onSurfaceVariant: onSurface,
    outline: onPrimary,
    outlineVariant: onPrimary,
    shadow: 0xff000000,
    scrim: 0xff000000,
    inverseSurface: onSurface,
    onInverseSurface: surface,
    inversePrimary: onPrimary,
    surfaceTint: primary,
  });
}
export function materialSchemeColor(scheme: ColorScheme, role: ColorRole): Color {
  return scheme === light || scheme === dark
    ? constSourceColor(Color, scheme[role])
    : new Color(scheme[role]);
}
