// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Current-host M3 defaults; canonical parent values and generic identity retained.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { Color } from '@nelyx/core/ui/color';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import {
  sourceOutlinedBorderType,
  captureSourceOutlinedBorder,
} from '@nelyx/core/internal/framework/painting/source-value-types';
import { Theme } from '../../theme.ts';
import type { ThemeData } from '../../theme-data.ts';
import { DatePickerThemeData } from '../../date-picker-theme-data.ts';
import { TextButton } from '../../text-button.ts';
import { Colors } from '../../colors.ts';
import { colorProperty } from '../button/style-properties.ts';
/** @dartType double */
const elevation = 6;
/** @dartType double */
const radius = 28;
/** @dartType double */
const rangeElevation = 0;
export class DatePickerDefaultsM3 extends DatePickerThemeData {
  private cachedTheme: ThemeData | null = null;
  constructor(private readonly context: BuildContext) {
    super({
      elevation,
      shape: new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(radius) }),
      dayShape: WidgetStateProperty.all(
        sourceOutlinedBorderType,
        captureSourceOutlinedBorder(new CircleBorder()),
      ),
      yearShape: WidgetStateProperty.all(
        sourceOutlinedBorderType,
        captureSourceOutlinedBorder(new StadiumBorder()),
      ),
      rangePickerElevation: rangeElevation,
      rangePickerShape: new RoundedRectangleBorder(),
    });
  }
  private get theme(): ThemeData {
    return (this.cachedTheme ??= Theme.of(this.context));
  }
  private role(name: keyof typeof this.theme.colorScheme): Color {
    const value = this.theme.colorScheme[name];
    if (typeof value !== 'number') throw new TypeError('Expected a source color role');
    return new Color(value);
  }
  override get backgroundColor() {
    return this.role('surfaceContainerHigh');
  }
  override get subHeaderForegroundColor() {
    return this.role('onSurface').withOpacity(0.6);
  }
  override get toggleButtonTextStyle() {
    return (
      this.theme.textTheme.titleSmall?.apply({ color: this.subHeaderForegroundColor.toARGB32() }) ??
      null
    );
  }
  override get cancelButtonStyle() {
    return TextButton.styleFrom();
  }
  override get confirmButtonStyle() {
    return TextButton.styleFrom();
  }
  override get shadowColor() {
    return Colors.transparent;
  }
  override get surfaceTintColor() {
    return Colors.transparent;
  }
  override get headerBackgroundColor() {
    return Colors.transparent;
  }
  override get headerForegroundColor() {
    return this.role('onSurfaceVariant');
  }
  override get headerHeadlineStyle() {
    return this.theme.textTheme.headlineLarge;
  }
  override get headerHelpStyle() {
    return this.theme.textTheme.labelLarge;
  }
  override get weekdayStyle() {
    return (
      this.theme.textTheme.bodyLarge?.apply({ color: this.role('onSurface').toARGB32() }) ?? null
    );
  }
  override get dayStyle() {
    return this.theme.textTheme.bodyLarge;
  }
  override get dayForegroundColor() {
    return colorProperty((states) =>
      states.contains(WidgetState.selected)
        ? this.role('onPrimary')
        : states.contains(WidgetState.disabled)
          ? this.role('onSurface').withOpacity(0.38)
          : this.role('onSurface'),
    );
  }
  override get dayBackgroundColor() {
    return colorProperty((states) =>
      states.contains(WidgetState.selected) ? this.role('primary') : null,
    );
  }
  private overlay(
    states: DartSet<WidgetState>,
    selectedRole: 'onPrimary' | 'onPrimaryContainer' = 'onPrimary',
  ): Color | null {
    const role = states.contains(WidgetState.selected) ? selectedRole : 'onSurfaceVariant';
    if (states.contains(WidgetState.pressed)) return this.role(role).withOpacity(0.1);
    if (states.contains(WidgetState.hovered)) return this.role(role).withOpacity(0.08);
    if (states.contains(WidgetState.focused)) return this.role(role).withOpacity(0.1);
    return null;
  }
  override get dayOverlayColor() {
    return colorProperty((states) => this.overlay(states));
  }
  override get todayForegroundColor() {
    return colorProperty((states) =>
      states.contains(WidgetState.selected)
        ? this.role('onPrimary')
        : states.contains(WidgetState.disabled)
          ? this.role('primary').withOpacity(0.38)
          : this.role('primary'),
    );
  }
  override get todayBackgroundColor() {
    return this.dayBackgroundColor;
  }
  override get todayBorder() {
    return new BorderSide({ color: this.role('primary').toARGB32() });
  }
  override get yearStyle() {
    return this.theme.textTheme.bodyLarge;
  }
  override get yearForegroundColor() {
    return colorProperty((states) =>
      states.contains(WidgetState.selected)
        ? this.role('onPrimary')
        : states.contains(WidgetState.disabled)
          ? this.role('onSurfaceVariant').withOpacity(0.38)
          : this.role('onSurfaceVariant'),
    );
  }
  override get yearBackgroundColor() {
    return colorProperty((states) =>
      states.contains(WidgetState.selected) ? this.role('primary') : null,
    );
  }
  override get yearOverlayColor() {
    return colorProperty((states) => this.overlay(states));
  }
  override get rangePickerShadowColor() {
    return Colors.transparent;
  }
  override get rangePickerSurfaceTintColor() {
    return Colors.transparent;
  }
  override get rangeSelectionBackgroundColor() {
    return this.role('secondaryContainer');
  }
  override get rangeSelectionOverlayColor() {
    return colorProperty((states) => {
      if (states.contains(WidgetState.pressed))
        return this.role('onPrimaryContainer').withOpacity(0.1);
      if (states.contains(WidgetState.hovered))
        return this.role('onPrimaryContainer').withOpacity(0.08);
      if (states.contains(WidgetState.focused))
        return this.role('onPrimaryContainer').withOpacity(0.1);
      return null;
    });
  }
  override get rangePickerHeaderBackgroundColor() {
    return Colors.transparent;
  }
  override get rangePickerHeaderForegroundColor() {
    return this.role('onSurfaceVariant');
  }
  override get rangePickerHeaderHeadlineStyle() {
    return this.theme.textTheme.titleLarge;
  }
  override get rangePickerHeaderHelpStyle() {
    return this.theme.textTheme.titleSmall;
  }
}
