// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Four pinned M3 token policies; source state precedence and toggleability preserved.
import { WidgetState, WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { Size } from '@nelyx/core/ui/size';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { ButtonStyle } from '../../button-style.ts';
import { VisualDensity } from '../../theme-data.ts';
import type { ThemeData } from '../../theme-data.ts';
import type { ColorRole } from '../../color-scheme.ts';
import {
  colorProperty,
  colorAll,
  doubleAll,
  sizeAll,
  insetsAll,
  shapeAll,
  sideProperty,
} from './style-properties.ts';
export type IconButtonVariant = 'standard' | 'filled' | 'filledTonal' | 'outlined';
export function iconButtonDefaults(
  theme: ThemeData,
  variant: IconButtonVariant,
  toggleable: boolean,
): ButtonStyle {
  const c = theme.colorScheme,
    color = (role: ColorRole) => new Color(c[role]),
    transparent = new Color(0);
  return new ButtonStyle({
    backgroundColor: colorProperty((states) => {
      const selected = states.contains(WidgetState.selected),
        disabled = states.contains(WidgetState.disabled);
      if (variant === 'standard') return transparent;
      if (variant === 'outlined')
        return disabled
          ? selected
            ? color('onSurface').withOpacity(0.12)
            : transparent
          : selected
            ? color('inverseSurface')
            : transparent;
      if (disabled) return color('onSurface').withOpacity(0.12);
      return color(
        selected || !toggleable
          ? variant === 'filled'
            ? 'primary'
            : 'secondaryContainer'
          : 'surfaceContainerHighest',
      );
    }),
    foregroundColor: colorProperty((states) => {
      if (states.contains(WidgetState.disabled)) return color('onSurface').withOpacity(0.38);
      const selected = states.contains(WidgetState.selected);
      if (variant === 'standard') return color(selected ? 'primary' : 'onSurfaceVariant');
      if (variant === 'outlined') return color(selected ? 'onInverseSurface' : 'onSurfaceVariant');
      return color(
        selected || !toggleable
          ? variant === 'filled'
            ? 'onPrimary'
            : 'onSecondaryContainer'
          : variant === 'filled'
            ? 'primary'
            : 'onSurfaceVariant',
      );
    }),
    overlayColor: colorProperty((states) => {
      const selected = states.contains(WidgetState.selected),
        pressed = states.contains(WidgetState.pressed),
        hovered = states.contains(WidgetState.hovered),
        focused = states.contains(WidgetState.focused);
      if (!pressed && !hovered && !focused) return transparent;
      const opacity = pressed ? 0.1 : hovered ? 0.08 : variant === 'outlined' ? 0.08 : 0.1;
      if (variant === 'standard')
        return color(selected ? 'primary' : 'onSurfaceVariant').withOpacity(opacity);
      if (variant === 'outlined')
        return color(
          selected ? 'onInverseSurface' : pressed ? 'onSurface' : 'onSurfaceVariant',
        ).withOpacity(opacity);
      return color(
        selected || !toggleable
          ? variant === 'filled'
            ? 'onPrimary'
            : 'onSecondaryContainer'
          : variant === 'filled'
            ? 'primary'
            : 'onSurfaceVariant',
      ).withOpacity(opacity);
    }),
    elevation: doubleAll(0),
    shadowColor: colorAll(transparent),
    surfaceTintColor: colorAll(transparent),
    padding: insetsAll(EdgeInsets.all(8)),
    minimumSize: sizeAll(new Size(40, 40)),
    maximumSize: sizeAll(Size.infinite),
    iconSize: doubleAll(24),
    side:
      variant === 'outlined'
        ? sideProperty((states) =>
            states.contains(WidgetState.selected)
              ? null
              : new BorderSide({
                  color: states.contains(WidgetState.disabled)
                    ? color('onSurface').withOpacity(0.12).toARGB32()
                    : c.outline,
                }),
          )
        : null,
    shape: shapeAll(new StadiumBorder()),
    mouseCursor: WidgetStateMouseCursor.adaptiveClickable,
    visualDensity: VisualDensity.standard,
    tapTargetSize: theme.materialTapTargetSize,
    animationDuration: 200,
    enableFeedback: true,
    alignment: Alignment.center,
    splashFactory: theme.splashFactory,
  });
}
