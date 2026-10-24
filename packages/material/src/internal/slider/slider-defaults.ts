// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned material/slider.dart defaults; generated shape bodies keep their original owners.
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { constSourceSize, sourceSizeType } from '@nelyx/core/ui/size-source';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { SliderVisualState } from '@nelyx/core/framework/widgets/slider-control';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Theme } from "../../theme.ts";
import { SliderThemeData, ShowValueIndicator, SliderInteraction } from "../../slider-theme.ts";
import { sliderDefaultShapes } from './slider-shape-defaults.ts';
const normalSize = constSourceSize(Size, 4, 44), pressedSize = constSourceSize(Size, 2, 44);
export const sliderDefaultThumbSize = WidgetStateProperty.resolveWith<Size | null>(nullableDartType(sourceSizeType), states => states.contains(WidgetState.disabled) || states.contains(WidgetState.hovered) ? normalSize : states.contains(WidgetState.focused) || states.contains(WidgetState.pressed) ? pressedSize : normalSize);
export function materialSliderDefaults(context: BuildContext, year2023: boolean, visual: SliderVisualState, ambient: SliderThemeData): SliderThemeData {
    const theme = Theme.of(context), c = theme.colorScheme, p = new Color(c.primary), on = new Color(c.onSurface), modern = !year2023, s = sliderDefaultShapes;
    const overlay = p.withOpacity(visual.dragging ? .1 : visual.showHoverHighlight ? .08 : visual.showFocusHighlight ? .1 : 0);
    return new SliderThemeData({
        trackHeight: modern ? 16 : 4, activeTrackColor: p, inactiveTrackColor: new Color(modern ? c.secondaryContainer : c.surfaceContainerHighest), secondaryActiveTrackColor: p.withOpacity(.54), disabledActiveTrackColor: on.withOpacity(.38), disabledInactiveTrackColor: on.withOpacity(.12), disabledSecondaryActiveTrackColor: on.withOpacity(modern ? .38 : .12), activeTickMarkColor: new Color(c.onPrimary).withOpacity(modern ? 1 : .38), inactiveTickMarkColor: modern ? new Color(c.onSecondaryContainer) : new Color(c.onSurfaceVariant).withOpacity(.38), disabledActiveTickMarkColor: modern ? new Color(c.onInverseSurface) : on.withOpacity(.38), disabledInactiveTickMarkColor: on.withOpacity(modern ? 1 : .38), thumbColor: p, disabledThumbColor: modern ? on.withOpacity(.38) : Color.alphaBlend(on.withOpacity(.38), new Color(c.surface)), overlayColor: overlay, valueIndicatorColor: modern ? new Color(c.inverseSurface) : p, valueIndicatorTextStyle: (modern ? theme.textTheme.labelLarge : theme.textTheme.labelMedium)!.copyWith({ color: modern ? c.onInverseSurface : c.onPrimary }), valueIndicatorShape: modern ? s.rounded : s.drop, thumbShape: modern ? s.handle : s.thumb, trackShape: modern ? s.gapped : s.track, overlayShape: s.overlay, tickMarkShape: modern ? s.modernTicks : s.ticks, thumbSize: modern ? sliderDefaultThumbSize : null, trackGap: modern ? 6 : null, showValueIndicator: ShowValueIndicator.onlyForDiscrete, allowedInteraction: SliderInteraction.tapAndSlide
    });
}
