// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved value projection of all five pinned M3 private chip defaults.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { Theme } from '../../theme.ts';
import { ChipThemeData } from '../../chip-theme.ts';
import { withSourceBorderSideColor } from '@nelyx/core/internal/framework/painting/border-side-source';
export type ChipKind = 'RawChip' | 'ActionChip' | 'ChoiceChip' | 'FilterChip' | 'InputChip';
export function chipDefaultsM3(
  context: BuildContext,
  kind: ChipKind,
  enabled: boolean,
  selected = false,
  elevated = false,
): ChipThemeData {
  const theme = Theme.of(context),
    c = theme.colorScheme,
    color = (arg: number) => new Color(arg),
    transparent = new Color(0x00000000),
    input = kind === 'InputChip',
    action = kind === 'ActionChip',
    raw = kind === 'RawChip',
    selection = !raw && !action,
    raised = elevated && !input && !raw,
    onSurface = color(c.onSurface),
    labelColor = action
      ? c.onSurface
      : enabled
        ? selection && selected
          ? c.onSecondaryContainer
          : c.onSurfaceVariant
        : c.onSurface,
    labelStyle = theme.textTheme.labelLarge?.copyWith({ color: labelColor }) ?? null,
    iconColor = enabled
      ? input
        ? selected
          ? c.primary
          : c.onSurfaceVariant
        : selection && selected
          ? c.onSecondaryContainer
          : c.primary
      : c.onSurface;
  const stateColor = raw
    ? null
    : WidgetStateProperty.resolveWith<Color | null>(nullableDartType(sourceColorType), (states) => {
        const disabled = states.contains(WidgetState.disabled),
          chosen = states.contains(WidgetState.selected);
        if (selection && chosen && disabled) return onSurface.withOpacity(0.12);
        if (disabled) return raised ? onSurface.withOpacity(0.12) : null;
        if (selection && chosen) return color(c.secondaryContainer);
        return raised ? color(c.surfaceContainerLow) : null;
      });
  const side =
      !raised && (!selection || !selected)
        ? withSourceBorderSideColor(
            new BorderSide(),
            enabled ? color(c.outlineVariant) : onSurface.withOpacity(0.12),
          )
        : new BorderSide({ color: 0x00000000 }),
    checkColor =
      raw || action
        ? null
        : enabled
          ? input
            ? selected
              ? c.primary
              : c.onSurfaceVariant
            : selected
              ? c.onSecondaryContainer
              : c.primary
          : c.onSurface,
    deleteColor = action
      ? null
      : enabled
        ? selection && selected
          ? c.onSecondaryContainer
          : c.onSurfaceVariant
        : c.onSurface,
    fontSize = labelStyle?.fontSize ?? 14,
    ratio = MediaQuery.textScalerOf(context).scale(fontSize) / 14;
  return new ChipThemeData({
    elevation: raised && enabled ? 1 : 0,
    pressElevation: raw || input ? null : 1,
    shape: new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(8) }),
    showCheckmark: true,
    labelStyle,
    color: stateColor,
    shadowColor: raised ? color(c.shadow) : transparent,
    surfaceTintColor: transparent,
    checkmarkColor: checkColor === null ? null : color(checkColor),
    deleteIconColor: deleteColor === null ? null : color(deleteColor),
    side,
    iconTheme: new IconThemeData({ color: color(iconColor), size: 18 }),
    padding: EdgeInsets.all(8),
    labelPadding: EdgeInsets.symmetric({ horizontal: 8 - 4 * Math.min(1, Math.max(0, ratio - 1)) }),
  });
}
