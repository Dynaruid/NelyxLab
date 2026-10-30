// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pure color calculation adapter. No UI, View, browser or native runtime dependency.
import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  SchemeFidelity,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeVibrant,
  SchemeExpressive,
  SchemeContent,
  SchemeRainbow,
  SchemeFruitSalad,
} from '@material/material-color-utilities';
import type { DynamicScheme } from '@material/material-color-utilities';
import { invariant } from '@nelyx/core/foundation/errors';
import { DynamicSchemeVariant } from '../../dynamic-scheme-variant.ts';
import type { ColorRole } from '../../color-scheme.ts';

/** @dartParam contrastLevel double */
export function seedColorRoles(
  seedArgb: number,
  brightness: 'light' | 'dark',
  variant: DynamicSchemeVariant,
  contrastLevel: number,
  roles: readonly ColorRole[],
): Record<ColorRole, number> {
  invariant(
    DynamicSchemeVariant.values.includes(variant),
    'invalid-dynamic-scheme-variant',
    'Expected a canonical DynamicSchemeVariant',
  );
  invariant(
    Number.isFinite(contrastLevel) && contrastLevel >= -1 && contrastLevel <= 1,
    'invalid-contrast-level',
    'contrastLevel must be between -1.0 and 1.0 inclusive',
  );
  const hct = Hct.fromInt(seedArgb),
    dark = brightness === 'dark';
  let scheme: DynamicScheme;
  switch (variant.name) {
    case 'tonalSpot':
      scheme = new SchemeTonalSpot(hct, dark, contrastLevel);
      break;
    case 'fidelity':
      scheme = new SchemeFidelity(hct, dark, contrastLevel);
      break;
    case 'monochrome':
      scheme = new SchemeMonochrome(hct, dark, contrastLevel);
      break;
    case 'neutral':
      scheme = new SchemeNeutral(hct, dark, contrastLevel);
      break;
    case 'vibrant':
      scheme = new SchemeVibrant(hct, dark, contrastLevel);
      break;
    case 'expressive':
      scheme = new SchemeExpressive(hct, dark, contrastLevel);
      break;
    case 'content':
      scheme = new SchemeContent(hct, dark, contrastLevel);
      break;
    case 'rainbow':
      scheme = new SchemeRainbow(hct, dark, contrastLevel);
      break;
    case 'fruitSalad':
      scheme = new SchemeFruitSalad(hct, dark, contrastLevel);
      break;
  }
  return Object.fromEntries(
    roles.map((role) => {
      // These are the original ColorScheme factory bindings, including tint=primary.
      const token =
        role === 'onInverseSurface'
          ? 'inverseOnSurface'
          : role === 'surfaceTint'
            ? 'primary'
            : role;
      return [role, MaterialDynamicColors[token].getArgb(scheme)];
    }),
  ) as Record<ColorRole, number>;
}
