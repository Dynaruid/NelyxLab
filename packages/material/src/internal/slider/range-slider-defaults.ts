// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Color } from '@nelyx/core/ui/color';
import { Theme } from "../../theme.ts";
import { SliderThemeData, ShowValueIndicator } from "../../slider-theme.ts";
import { sliderDefaultShapes } from './slider-shape-defaults.ts';
import { sliderDefaultThumbSize } from './slider-defaults.ts';
/** Pinned range_slider.dart shares the original geometry and colors with the 2023 M3 range slider. */
export function materialRangeSliderDefaults(context: BuildContext, year2023: boolean): SliderThemeData {
    const theme = Theme.of(context), c = theme.colorScheme, modern = !year2023;
    const primary = new Color(c.primary), onSurface = new Color(c.onSurface), s = sliderDefaultShapes;
    return new SliderThemeData({
        trackHeight: modern ? 16 : 4, activeTrackColor: primary,
        inactiveTrackColor: modern ? new Color(c.secondaryContainer) : primary.withOpacity(.24),
        disabledActiveTrackColor: onSurface.withOpacity(modern ? .38 : .32), disabledInactiveTrackColor: onSurface.withOpacity(.12),
        activeTickMarkColor: new Color(c.onPrimary).withOpacity(modern ? 1 : .54),
        inactiveTickMarkColor: modern ? new Color(c.onSecondaryContainer) : primary.withOpacity(.54),
        disabledActiveTickMarkColor: modern ? new Color(c.onInverseSurface) : new Color(c.onPrimary).withOpacity(.12),
        disabledInactiveTickMarkColor: onSurface.withOpacity(modern ? 1 : .12), thumbColor: primary,
        overlappingShapeStrokeColor: new Color(c.surface),
        disabledThumbColor: modern ? onSurface.withOpacity(.38) : Color.alphaBlend(onSurface.withOpacity(.38), new Color(c.surface)),
        overlayColor: primary.withOpacity(.12),
        valueIndicatorTextStyle: (modern ? theme.textTheme.labelLarge : theme.textTheme.bodyLarge)!.copyWith({ color: modern ? c.onInverseSurface : c.onPrimary }),
        valueIndicatorColor: new Color(modern ? c.inverseSurface : c.primary),
        rangeTrackShape: modern ? s.rangeGapped : s.rangeTrack, rangeTickMarkShape: modern ? s.rangeModernTicks : s.rangeTicks,
        rangeThumbShape: modern ? s.rangeHandle : s.rangeThumb, overlayShape: s.overlay,
        rangeValueIndicatorShape: modern ? s.rangeRounded : s.rangeRectangle, showValueIndicator: ShowValueIndicator.onlyForDiscrete,
        minThumbSeparation: modern ? 0 : 8, thumbSize: modern ? sliderDefaultThumbSize : null, trackGap: modern ? 6 : null,
    });
}
