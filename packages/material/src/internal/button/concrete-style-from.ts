// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/size';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { ButtonStyle } from '../../button-style.ts';
import type { ButtonLayerBuilder } from '../../button-style.ts';
import type { IconAlignment } from '../../icon-alignment.ts';
import type { VisualDensity, MaterialTapTargetSize } from '../../theme-data.ts';
import type { InteractiveInkFeatureFactory } from '../../ink-feature.ts';
import {
  colorAll,
  colorProperty,
  doubleAll,
  doubleProperty,
  textAll,
  textPropertyAll,
  insetsAll,
  sizeAll,
  shapeAll,
  sideAll,
  cursorProperty,
} from './style-properties.ts';
// The public source parameter declarations remain on each concrete button owner.
export interface ConcreteStyleFromValues {
  readonly foregroundColor?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly disabledForegroundColor?: Color | null;
  readonly disabledBackgroundColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly iconColor?: Color | null;
  readonly iconSize?: number | null;
  readonly iconAlignment?: IconAlignment | null;
  readonly disabledIconColor?: Color | null;
  readonly overlayColor?: Color | null;
  readonly elevation?: number | null;
  readonly textStyle?: TextStyle | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly minimumSize?: Size | null;
  readonly fixedSize?: Size | null;
  readonly maximumSize?: Size | null;
  readonly side?: BorderSide | null;
  readonly shape?: OutlinedBorder | null;
  readonly enabledMouseCursor?: MouseCursor | null;
  readonly disabledMouseCursor?: MouseCursor | null;
  readonly visualDensity?: VisualDensity | null;
  readonly tapTargetSize?: MaterialTapTargetSize | null;
  readonly animationDuration?: number | null;
  readonly enableFeedback?: boolean | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly splashFactory?: InteractiveInkFeatureFactory | null;
  readonly backgroundBuilder?: ButtonLayerBuilder | null;
  readonly foregroundBuilder?: ButtonLayerBuilder | null;
}
export function concreteStyleFrom(
  o: ConcreteStyleFromValues,
  variant: 'filled' | 'elevated' | 'text' | 'outlined',
): ButtonStyle {
  const defaultColor = (enabled: Color | null, disabled: Color | null) =>
    enabled === null && disabled === null
      ? null
      : colorProperty((states) => (states.contains(WidgetState.disabled) ? disabled : enabled));
  const foreground = o.foregroundColor ?? null,
    overlay = o.overlayColor ?? null,
    overlayBase = overlay ?? foreground;
  const background = o.backgroundColor ?? null,
    disabledBackground = o.disabledBackgroundColor ?? null,
    icon = o.iconColor ?? null,
    disabledIcon = o.disabledIconColor ?? null;
  return new ButtonStyle({
    textStyle:
      variant === 'filled' || variant === 'elevated'
        ? textPropertyAll(o.textStyle ?? null)
        : textAll(o.textStyle ?? null),
    foregroundColor: defaultColor(foreground, o.disabledForegroundColor ?? null),
    backgroundColor:
      (variant === 'text' || variant === 'outlined') &&
      background !== null &&
      disabledBackground === null
        ? colorAll(background)
        : defaultColor(background, disabledBackground),
    overlayColor:
      overlayBase === null
        ? null
        : overlay !== null && overlay.a === 0
          ? colorAll(overlay)
          : colorProperty((states) =>
              states.contains(WidgetState.pressed)
                ? overlayBase.withOpacity(0.1)
                : states.contains(WidgetState.hovered)
                  ? overlayBase.withOpacity(0.08)
                  : states.contains(WidgetState.focused)
                    ? overlayBase.withOpacity(0.1)
                    : null,
            ),
    shadowColor: colorAll(o.shadowColor ?? null),
    surfaceTintColor: colorAll(o.surfaceTintColor ?? null),
    iconColor:
      variant === 'text' && icon !== null && disabledIcon === null
        ? colorAll(icon)
        : defaultColor(icon, disabledIcon),
    iconSize: doubleAll(o.iconSize ?? null),
    iconAlignment: o.iconAlignment ?? null,
    elevation:
      o.elevation == null
        ? null
        : variant === 'elevated'
          ? doubleProperty((states) =>
              states.contains(WidgetState.disabled)
                ? 0
                : states.contains(WidgetState.pressed)
                  ? o.elevation! + 6
                  : states.contains(WidgetState.hovered) || states.contains(WidgetState.focused)
                    ? o.elevation! + 2
                    : o.elevation!,
            )
          : doubleAll(o.elevation),
    padding: insetsAll(o.padding ?? null),
    minimumSize: sizeAll(o.minimumSize ?? null),
    fixedSize: sizeAll(o.fixedSize ?? null),
    maximumSize: sizeAll(o.maximumSize ?? null),
    side: sideAll(o.side ?? null),
    shape: shapeAll(o.shape ?? null),
    mouseCursor: cursorProperty((states) =>
      states.contains(WidgetState.disabled)
        ? (o.disabledMouseCursor ?? null)
        : (o.enabledMouseCursor ?? null),
    ),
    visualDensity: o.visualDensity ?? null,
    tapTargetSize: o.tapTargetSize ?? null,
    animationDuration: o.animationDuration ?? null,
    enableFeedback: o.enableFeedback ?? null,
    alignment: o.alignment ?? null,
    splashFactory: o.splashFactory ?? null,
    backgroundBuilder: o.backgroundBuilder ?? null,
    foregroundBuilder: o.foregroundBuilder ?? null,
  });
}
