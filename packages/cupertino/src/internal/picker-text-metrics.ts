// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/date_picker.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Element } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';

export interface PickerTextMetrics {
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
}

export function observePickerFonts(
  context: BuildContext,
  invalidate: () => void,
): (() => void) | undefined {
  const fonts = context instanceof Element ? context.owner.systemFonts : null;
  if (!fonts) return undefined;
  fonts.addListener(invalidate);
  return () => fonts.removeListener(invalidate);
}

/** Measure the actual locale and face without applying accessibility text scaling. */
export function measurePickerText<T>(
  context: BuildContext,
  style: TextStyle,
  direction: 'ltr' | 'rtl',
  measure: (measureText: (text: string) => PickerTextMetrics) => T,
): T {
  const { defaultFont: font, text, resources } = context.services;
  if (!font) throw new Error('Picker text measurement requires an application font');
  const painter = new TextPainter(
    { textDirection: direction, maxLines: 1 },
    {
      font,
      text,
      resources,
      scale: context.services.readMetrics('scale').scale,
    },
  );
  const measured = new Map<string, PickerTextMetrics>();
  try {
    return measure((value) => {
      let metrics = measured.get(value);
      if (metrics === undefined) {
        painter.text = new TextSpan({ style, text: value });
        painter.layout();
        metrics = {
          width: painter.maxIntrinsicWidth,
          height: painter.height,
          baseline: painter.computeDistanceToActualBaseline('alphabetic'),
        };
        measured.set(value, metrics);
      }
      return metrics;
    });
  } finally {
    painter.dispose();
  }
}
