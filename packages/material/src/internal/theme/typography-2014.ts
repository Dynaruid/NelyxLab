// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/typography.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight } from '@nelyx/core/ui/typography';

function geometry(
  debugLabel: string,
  fontSize: number,
  fontWeight: FontWeight,
  textBaseline: 'alphabetic' | 'ideographic',
  letterSpacing?: number,
): TextStyle {
  return new TextStyle({
    debugLabel,
    inherit: false,
    fontSize,
    fontWeight,
    textBaseline,
    letterSpacing: letterSpacing ?? null,
  });
}

export const material2014TextGeometry = {
  englishLike: {
    displayLarge: geometry('englishLike displayLarge 2014', 112, FontWeight.w100, 'alphabetic'),
    displayMedium: geometry('englishLike displayMedium 2014', 56, FontWeight.w400, 'alphabetic'),
    displaySmall: geometry('englishLike displaySmall 2014', 45, FontWeight.w400, 'alphabetic'),
    headlineLarge: geometry('englishLike headlineLarge 2014', 40, FontWeight.w400, 'alphabetic'),
    headlineMedium: geometry('englishLike headlineMedium 2014', 34, FontWeight.w400, 'alphabetic'),
    headlineSmall: geometry('englishLike headlineSmall 2014', 24, FontWeight.w400, 'alphabetic'),
    titleLarge: geometry('englishLike titleLarge 2014', 20, FontWeight.w500, 'alphabetic'),
    titleMedium: geometry('englishLike titleMedium 2014', 16, FontWeight.w400, 'alphabetic'),
    titleSmall: geometry('englishLike titleSmall 2014', 14, FontWeight.w500, 'alphabetic', 0.1),
    bodyLarge: geometry('englishLike bodyLarge 2014', 14, FontWeight.w500, 'alphabetic'),
    bodyMedium: geometry('englishLike bodyMedium 2014', 14, FontWeight.w400, 'alphabetic'),
    bodySmall: geometry('englishLike bodySmall 2014', 12, FontWeight.w400, 'alphabetic'),
    labelLarge: geometry('englishLike labelLarge 2014', 14, FontWeight.w500, 'alphabetic'),
    labelMedium: geometry('englishLike labelMedium 2014', 12, FontWeight.w400, 'alphabetic'),
    labelSmall: geometry('englishLike labelSmall 2014', 10, FontWeight.w400, 'alphabetic', 1.5),
  },
  dense: {
    displayLarge: geometry('dense displayLarge 2014', 112, FontWeight.w100, 'ideographic'),
    displayMedium: geometry('dense displayMedium 2014', 56, FontWeight.w400, 'ideographic'),
    displaySmall: geometry('dense displaySmall 2014', 45, FontWeight.w400, 'ideographic'),
    headlineLarge: geometry('dense headlineLarge 2014', 40, FontWeight.w400, 'ideographic'),
    headlineMedium: geometry('dense headlineMedium 2014', 34, FontWeight.w400, 'ideographic'),
    headlineSmall: geometry('dense headlineSmall 2014', 24, FontWeight.w400, 'ideographic'),
    titleLarge: geometry('dense titleLarge 2014', 21, FontWeight.w500, 'ideographic'),
    titleMedium: geometry('dense titleMedium 2014', 17, FontWeight.w400, 'ideographic'),
    titleSmall: geometry('dense titleSmall 2014', 15, FontWeight.w500, 'ideographic'),
    bodyLarge: geometry('dense bodyLarge 2014', 15, FontWeight.w500, 'ideographic'),
    bodyMedium: geometry('dense bodyMedium 2014', 15, FontWeight.w400, 'ideographic'),
    bodySmall: geometry('dense bodySmall 2014', 13, FontWeight.w400, 'ideographic'),
    labelLarge: geometry('dense labelLarge 2014', 15, FontWeight.w500, 'ideographic'),
    labelMedium: geometry('dense labelMedium 2014', 12, FontWeight.w400, 'ideographic'),
    labelSmall: geometry('dense labelSmall 2014', 11, FontWeight.w400, 'ideographic'),
  },
  tall: {
    displayLarge: geometry('tall displayLarge 2014', 112, FontWeight.w400, 'alphabetic'),
    displayMedium: geometry('tall displayMedium 2014', 56, FontWeight.w400, 'alphabetic'),
    displaySmall: geometry('tall displaySmall 2014', 45, FontWeight.w400, 'alphabetic'),
    headlineLarge: geometry('tall headlineLarge 2014', 40, FontWeight.w400, 'alphabetic'),
    headlineMedium: geometry('tall headlineMedium 2014', 34, FontWeight.w400, 'alphabetic'),
    headlineSmall: geometry('tall headlineSmall 2014', 24, FontWeight.w400, 'alphabetic'),
    titleLarge: geometry('tall titleLarge 2014', 21, FontWeight.w700, 'alphabetic'),
    titleMedium: geometry('tall titleMedium 2014', 17, FontWeight.w400, 'alphabetic'),
    titleSmall: geometry('tall titleSmall 2014', 15, FontWeight.w500, 'alphabetic'),
    bodyLarge: geometry('tall bodyLarge 2014', 15, FontWeight.w700, 'alphabetic'),
    bodyMedium: geometry('tall bodyMedium 2014', 15, FontWeight.w400, 'alphabetic'),
    bodySmall: geometry('tall bodySmall 2014', 13, FontWeight.w400, 'alphabetic'),
    labelLarge: geometry('tall labelLarge 2014', 15, FontWeight.w700, 'alphabetic'),
    labelMedium: geometry('tall labelMedium 2014', 12, FontWeight.w400, 'alphabetic'),
    labelSmall: geometry('tall labelSmall 2014', 11, FontWeight.w400, 'alphabetic'),
  },
} as const;
