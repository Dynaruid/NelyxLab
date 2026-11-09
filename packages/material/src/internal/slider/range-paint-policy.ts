// SPDX-License-Identifier: BSD-3-Clause
import {
  WidgetState,
  WidgetStatePropertyAll,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceSizeType, captureSourceSize } from '@nelyx/core/ui/size-source';
import { Size } from '@nelyx/core/ui/size';
import type { SliderThemeData } from '../../slider-theme.ts';

const sizeType = nullableDartType(sourceSizeType);
/** The original painter and native configuration share pressed-size policy. */
export function materialRangeSliderPaintThemes(theme: SliderThemeData, active: boolean) {
  const normal = theme.thumbSize?.resolve(emptyWidgetStateSet()),
    pressed = emptyWidgetStateSet();
  pressed.add(WidgetState.pressed);
  const pressedWidth = theme.thumbSize?.resolve(pressed)?.width;
  let gap = theme.trackGap,
    width = normal?.width;
  if (active && width != null && pressedWidth != null && gap != null) {
    const delta = width - pressedWidth;
    width = pressedWidth;
    if (gap > 0) gap -= delta / 2;
  }
  return {
    track: gap === theme.trackGap ? theme : theme.copyWith({ trackGap: gap }),
    thumb:
      width != null && normal
        ? theme.copyWith({
            thumbSize: new WidgetStatePropertyAll(
              sizeType,
              captureSourceSize(new Size(width, normal.height)),
            ),
          })
        : theme,
  };
}
