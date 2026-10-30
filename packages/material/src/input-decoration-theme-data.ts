// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FloatingLabelBehavior } from './floating-label-behavior.ts';
import { FloatingLabelAlignment } from './floating-label-alignment.ts';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { Color } from '@nelyx/core/ui/color';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { BorderSide } from '@nelyx/core/framework/painting/borders';
import { InputBorder } from './input-border.ts';
import type { VisualDensity } from './theme-data.ts';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { IntProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface InputDecorationThemeDataOptions {
  readonly labelStyle?: TextStyle | null;
  readonly floatingLabelStyle?: TextStyle | null;
  readonly helperStyle?: TextStyle | null;
  /** @dartType int? */
  readonly helperMaxLines?: number | null;
  readonly hintStyle?: TextStyle | null;
  // Source Duration uses the existing host millisecond ABI.
  readonly hintFadeDuration?: number | null;
  /** @dartType int? */
  readonly hintMaxLines?: number | null;
  readonly errorStyle?: TextStyle | null;
  /** @dartType int? */
  readonly errorMaxLines?: number | null;
  readonly floatingLabelBehavior?: FloatingLabelBehavior;
  readonly floatingLabelAlignment?: FloatingLabelAlignment;
  readonly isDense?: boolean;
  readonly contentPadding?: EdgeInsetsGeometry | null;
  readonly isCollapsed?: boolean;
  readonly iconColor?: Color | null;
  readonly prefixStyle?: TextStyle | null;
  readonly prefixIconColor?: Color | null;
  readonly prefixIconConstraints?: BoxConstraints | null;
  readonly suffixStyle?: TextStyle | null;
  readonly suffixIconColor?: Color | null;
  readonly suffixIconConstraints?: BoxConstraints | null;
  readonly counterStyle?: TextStyle | null;
  readonly filled?: boolean;
  readonly fillColor?: Color | null;
  readonly outlineBorder?: BorderSide | null;
  readonly activeIndicatorBorder?: BorderSide | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly errorBorder?: InputBorder | null;
  readonly focusedBorder?: InputBorder | null;
  readonly focusedErrorBorder?: InputBorder | null;
  readonly disabledBorder?: InputBorder | null;
  readonly enabledBorder?: InputBorder | null;
  readonly border?: InputBorder | null;
  readonly alignLabelWithHint?: boolean;
  readonly constraints?: BoxConstraints | null;
  readonly visualDensity?: VisualDensity | null;
}
export interface InputDecorationThemeDataCopyOptions {
  readonly labelStyle?: TextStyle | null;
  readonly floatingLabelStyle?: TextStyle | null;
  readonly helperStyle?: TextStyle | null;
  /** @dartType int? */
  readonly helperMaxLines?: number | null;
  readonly hintStyle?: TextStyle | null;
  readonly hintFadeDuration?: number | null;
  /** @dartType int? */
  readonly hintMaxLines?: number | null;
  readonly errorStyle?: TextStyle | null;
  /** @dartType int? */
  readonly errorMaxLines?: number | null;
  readonly floatingLabelBehavior?: FloatingLabelBehavior | null;
  readonly floatingLabelAlignment?: FloatingLabelAlignment | null;
  readonly isDense?: boolean | null;
  readonly contentPadding?: EdgeInsetsGeometry | null;
  readonly isCollapsed?: boolean | null;
  readonly iconColor?: Color | null;
  readonly prefixStyle?: TextStyle | null;
  readonly prefixIconColor?: Color | null;
  readonly prefixIconConstraints?: BoxConstraints | null;
  readonly suffixStyle?: TextStyle | null;
  readonly suffixIconColor?: Color | null;
  readonly suffixIconConstraints?: BoxConstraints | null;
  readonly counterStyle?: TextStyle | null;
  readonly filled?: boolean | null;
  readonly fillColor?: Color | null;
  readonly activeIndicatorBorder?: BorderSide | null;
  readonly outlineBorder?: BorderSide | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly errorBorder?: InputBorder | null;
  readonly focusedBorder?: InputBorder | null;
  readonly focusedErrorBorder?: InputBorder | null;
  readonly disabledBorder?: InputBorder | null;
  readonly enabledBorder?: InputBorder | null;
  readonly border?: InputBorder | null;
  readonly alignLabelWithHint?: boolean | null;
  readonly constraints?: BoxConstraints | null;
  readonly visualDensity?: VisualDensity | null;
}
export class InputDecorationThemeData extends Diagnosticable(class {}) {
  readonly labelStyle: TextStyle | null;
  readonly floatingLabelStyle: TextStyle | null;
  readonly helperStyle: TextStyle | null;
  /** @dartType int? */
  readonly helperMaxLines: number | null;
  readonly hintStyle: TextStyle | null;
  readonly hintFadeDuration: number | null;
  /** @dartType int? */
  readonly hintMaxLines: number | null;
  readonly errorStyle: TextStyle | null;
  /** @dartType int? */
  readonly errorMaxLines: number | null;
  readonly floatingLabelBehavior: FloatingLabelBehavior;
  readonly floatingLabelAlignment: FloatingLabelAlignment;
  readonly isDense: boolean;
  readonly contentPadding: EdgeInsetsGeometry | null;
  readonly isCollapsed: boolean;
  readonly iconColor: Color | null;
  readonly prefixStyle: TextStyle | null;
  readonly prefixIconColor: Color | null;
  readonly prefixIconConstraints: BoxConstraints | null;
  readonly suffixStyle: TextStyle | null;
  readonly suffixIconColor: Color | null;
  readonly suffixIconConstraints: BoxConstraints | null;
  readonly counterStyle: TextStyle | null;
  readonly filled: boolean;
  readonly fillColor: Color | null;
  readonly outlineBorder: BorderSide | null;
  readonly activeIndicatorBorder: BorderSide | null;
  readonly focusColor: Color | null;
  readonly hoverColor: Color | null;
  readonly errorBorder: InputBorder | null;
  readonly focusedBorder: InputBorder | null;
  readonly focusedErrorBorder: InputBorder | null;
  readonly disabledBorder: InputBorder | null;
  readonly enabledBorder: InputBorder | null;
  readonly border: InputBorder | null;
  readonly alignLabelWithHint: boolean;
  readonly constraints: BoxConstraints | null;
  readonly visualDensity: VisualDensity | null;
  /** @dartParam helperMaxLines int?
   * @dartParam hintMaxLines int?
   * @dartParam errorMaxLines int? */
  constructor(options: InputDecorationThemeDataOptions = {}) {
    super();
    if (options.floatingLabelBehavior === null)
      throw new TypeError('floatingLabelBehavior is non-nullable');
    if (options.floatingLabelAlignment === null)
      throw new TypeError('floatingLabelAlignment is non-nullable');
    if (options.isDense === null) throw new TypeError('isDense is non-nullable');
    if (options.isCollapsed === null) throw new TypeError('isCollapsed is non-nullable');
    if (options.filled === null) throw new TypeError('filled is non-nullable');
    if (options.alignLabelWithHint === null)
      throw new TypeError('alignLabelWithHint is non-nullable');
    this.labelStyle = options.labelStyle ?? null;
    this.floatingLabelStyle = options.floatingLabelStyle ?? null;
    this.helperStyle = options.helperStyle ?? null;
    this.helperMaxLines = options.helperMaxLines ?? null;
    this.hintStyle = options.hintStyle ?? null;
    this.hintFadeDuration = options.hintFadeDuration ?? null;
    this.hintMaxLines = options.hintMaxLines ?? null;
    this.errorStyle = options.errorStyle ?? null;
    this.errorMaxLines = options.errorMaxLines ?? null;
    this.floatingLabelBehavior = options.floatingLabelBehavior ?? FloatingLabelBehavior.auto;
    this.floatingLabelAlignment = options.floatingLabelAlignment ?? FloatingLabelAlignment.start;
    this.isDense = options.isDense ?? false;
    this.contentPadding = options.contentPadding ?? null;
    this.isCollapsed = options.isCollapsed ?? false;
    this.iconColor = options.iconColor ?? null;
    this.prefixStyle = options.prefixStyle ?? null;
    this.prefixIconColor = options.prefixIconColor ?? null;
    this.prefixIconConstraints = options.prefixIconConstraints ?? null;
    this.suffixStyle = options.suffixStyle ?? null;
    this.suffixIconColor = options.suffixIconColor ?? null;
    this.suffixIconConstraints = options.suffixIconConstraints ?? null;
    this.counterStyle = options.counterStyle ?? null;
    this.filled = options.filled ?? false;
    this.fillColor = options.fillColor ?? null;
    this.outlineBorder = options.outlineBorder ?? null;
    this.activeIndicatorBorder = options.activeIndicatorBorder ?? null;
    this.focusColor = options.focusColor ?? null;
    this.hoverColor = options.hoverColor ?? null;
    this.errorBorder = options.errorBorder ?? null;
    this.focusedBorder = options.focusedBorder ?? null;
    this.focusedErrorBorder = options.focusedErrorBorder ?? null;
    this.disabledBorder = options.disabledBorder ?? null;
    this.enabledBorder = options.enabledBorder ?? null;
    this.border = options.border ?? null;
    this.alignLabelWithHint = options.alignLabelWithHint ?? false;
    this.constraints = options.constraints ?? null;
    this.visualDensity = options.visualDensity ?? null;
    if (!FloatingLabelBehavior.values.includes(this.floatingLabelBehavior))
      throw new TypeError('Expected canonical FloatingLabelBehavior');
    if (!(this.floatingLabelAlignment instanceof FloatingLabelAlignment))
      throw new TypeError('Expected canonical FloatingLabelAlignment');
    for (const value of [this.helperMaxLines, this.hintMaxLines, this.errorMaxLines])
      if (value !== null && !Number.isSafeInteger(value))
        throw new TypeError('Input theme maxLines requires a safe source int');
    for (const value of [
      this.errorBorder,
      this.focusedBorder,
      this.focusedErrorBorder,
      this.disabledBorder,
      this.enabledBorder,
      this.border,
    ])
      if (value !== null && !(value instanceof InputBorder))
        throw new TypeError('Input theme borders require the canonical InputBorder');
    if (new.target === InputDecorationThemeData) Object.freeze(this);
  }
  /** @dartParam helperMaxLines int?
   * @dartParam hintMaxLines int?
   * @dartParam errorMaxLines int? */
  copyWith(options: InputDecorationThemeDataCopyOptions = {}): InputDecorationThemeData {
    return new InputDecorationThemeData({
      labelStyle: options.labelStyle ?? this.labelStyle,
      floatingLabelStyle: options.floatingLabelStyle ?? this.floatingLabelStyle,
      helperStyle: options.helperStyle ?? this.helperStyle,
      helperMaxLines: options.helperMaxLines ?? this.helperMaxLines,
      hintStyle: options.hintStyle ?? this.hintStyle,
      hintFadeDuration: options.hintFadeDuration ?? this.hintFadeDuration,
      hintMaxLines: options.hintMaxLines ?? this.hintMaxLines,
      errorStyle: options.errorStyle ?? this.errorStyle,
      errorMaxLines: options.errorMaxLines ?? this.errorMaxLines,
      floatingLabelBehavior: options.floatingLabelBehavior ?? this.floatingLabelBehavior,
      floatingLabelAlignment: options.floatingLabelAlignment ?? this.floatingLabelAlignment,
      isDense: options.isDense ?? this.isDense,
      contentPadding: options.contentPadding ?? this.contentPadding,
      iconColor: options.iconColor ?? this.iconColor,
      isCollapsed: options.isCollapsed ?? this.isCollapsed,
      prefixStyle: options.prefixStyle ?? this.prefixStyle,
      prefixIconColor: options.prefixIconColor ?? this.prefixIconColor,
      prefixIconConstraints: options.prefixIconConstraints ?? this.prefixIconConstraints,
      suffixStyle: options.suffixStyle ?? this.suffixStyle,
      suffixIconColor: options.suffixIconColor ?? this.suffixIconColor,
      suffixIconConstraints: options.suffixIconConstraints ?? this.suffixIconConstraints,
      counterStyle: options.counterStyle ?? this.counterStyle,
      filled: options.filled ?? this.filled,
      fillColor: options.fillColor ?? this.fillColor,
      activeIndicatorBorder: options.activeIndicatorBorder ?? this.activeIndicatorBorder,
      outlineBorder: options.outlineBorder ?? this.outlineBorder,
      focusColor: options.focusColor ?? this.focusColor,
      hoverColor: options.hoverColor ?? this.hoverColor,
      errorBorder: options.errorBorder ?? this.errorBorder,
      focusedBorder: options.focusedBorder ?? this.focusedBorder,
      focusedErrorBorder: options.focusedErrorBorder ?? this.focusedErrorBorder,
      disabledBorder: options.disabledBorder ?? this.disabledBorder,
      enabledBorder: options.enabledBorder ?? this.enabledBorder,
      border: options.border ?? this.border,
      alignLabelWithHint: options.alignLabelWithHint ?? this.alignLabelWithHint,
      constraints: options.constraints ?? this.constraints,
      visualDensity: options.visualDensity ?? this.visualDensity,
    });
  }
  merge(other: InputDecorationThemeData | null): InputDecorationThemeData {
    return other === null
      ? this
      : this.copyWith({
          labelStyle: this.labelStyle ?? other.labelStyle,
          floatingLabelStyle: this.floatingLabelStyle ?? other.floatingLabelStyle,
          helperStyle: this.helperStyle ?? other.helperStyle,
          helperMaxLines: this.helperMaxLines ?? other.helperMaxLines,
          hintStyle: this.hintStyle ?? other.hintStyle,
          hintFadeDuration: this.hintFadeDuration ?? other.hintFadeDuration,
          hintMaxLines: this.hintMaxLines ?? other.hintMaxLines,
          errorStyle: this.errorStyle ?? other.errorStyle,
          errorMaxLines: this.errorMaxLines ?? other.errorMaxLines,
          contentPadding: this.contentPadding ?? other.contentPadding,
          iconColor: this.iconColor ?? other.iconColor,
          prefixStyle: this.prefixStyle ?? other.prefixStyle,
          prefixIconColor: this.prefixIconColor ?? other.prefixIconColor,
          prefixIconConstraints: this.prefixIconConstraints ?? other.prefixIconConstraints,
          suffixStyle: this.suffixStyle ?? other.suffixStyle,
          suffixIconColor: this.suffixIconColor ?? other.suffixIconColor,
          suffixIconConstraints: this.suffixIconConstraints ?? other.suffixIconConstraints,
          counterStyle: this.counterStyle ?? other.counterStyle,
          fillColor: this.fillColor ?? other.fillColor,
          activeIndicatorBorder: this.activeIndicatorBorder ?? other.activeIndicatorBorder,
          outlineBorder: this.outlineBorder ?? other.outlineBorder,
          focusColor: this.focusColor ?? other.focusColor,
          hoverColor: this.hoverColor ?? other.hoverColor,
          errorBorder: this.errorBorder ?? other.errorBorder,
          focusedBorder: this.focusedBorder ?? other.focusedBorder,
          focusedErrorBorder: this.focusedErrorBorder ?? other.focusedErrorBorder,
          disabledBorder: this.disabledBorder ?? other.disabledBorder,
          enabledBorder: this.enabledBorder ?? other.enabledBorder,
          border: this.border ?? other.border,
          constraints: this.constraints ?? other.constraints,
          visualDensity: this.visualDensity ?? other.visualDensity,
        });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof InputDecorationThemeData) || other.constructor !== this.constructor)
      return false;
    return (
      valueEquals(this.labelStyle, other.labelStyle) &&
      valueEquals(this.floatingLabelStyle, other.floatingLabelStyle) &&
      valueEquals(this.helperStyle, other.helperStyle) &&
      valueEquals(this.helperMaxLines, other.helperMaxLines) &&
      valueEquals(this.hintStyle, other.hintStyle) &&
      valueEquals(this.hintFadeDuration, other.hintFadeDuration) &&
      valueEquals(this.hintMaxLines, other.hintMaxLines) &&
      valueEquals(this.errorStyle, other.errorStyle) &&
      valueEquals(this.errorMaxLines, other.errorMaxLines) &&
      valueEquals(this.floatingLabelBehavior, other.floatingLabelBehavior) &&
      valueEquals(this.floatingLabelAlignment, other.floatingLabelAlignment) &&
      valueEquals(this.isDense, other.isDense) &&
      valueEquals(this.contentPadding, other.contentPadding) &&
      valueEquals(this.isCollapsed, other.isCollapsed) &&
      valueEquals(this.iconColor, other.iconColor) &&
      valueEquals(this.prefixStyle, other.prefixStyle) &&
      valueEquals(this.prefixIconColor, other.prefixIconColor) &&
      valueEquals(this.prefixIconConstraints, other.prefixIconConstraints) &&
      valueEquals(this.suffixStyle, other.suffixStyle) &&
      valueEquals(this.suffixIconColor, other.suffixIconColor) &&
      valueEquals(this.suffixIconConstraints, other.suffixIconConstraints) &&
      valueEquals(this.counterStyle, other.counterStyle) &&
      valueEquals(this.filled, other.filled) &&
      valueEquals(this.fillColor, other.fillColor) &&
      valueEquals(this.outlineBorder, other.outlineBorder) &&
      valueEquals(this.activeIndicatorBorder, other.activeIndicatorBorder) &&
      valueEquals(this.focusColor, other.focusColor) &&
      valueEquals(this.hoverColor, other.hoverColor) &&
      valueEquals(this.errorBorder, other.errorBorder) &&
      valueEquals(this.focusedBorder, other.focusedBorder) &&
      valueEquals(this.focusedErrorBorder, other.focusedErrorBorder) &&
      valueEquals(this.disabledBorder, other.disabledBorder) &&
      valueEquals(this.enabledBorder, other.enabledBorder) &&
      valueEquals(this.border, other.border) &&
      valueEquals(this.alignLabelWithHint, other.alignLabelWithHint) &&
      valueEquals(this.constraints, other.constraints) &&
      valueEquals(this.visualDensity, other.visualDensity)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.labelStyle,
      this.floatingLabelStyle,
      this.helperStyle,
      this.helperMaxLines,
      this.hintStyle,
      this.hintMaxLines,
      this.errorStyle,
      this.errorMaxLines,
      this.floatingLabelBehavior,
      this.floatingLabelAlignment,
      this.isDense,
      this.contentPadding,
      this.isCollapsed,
      this.iconColor,
      this.prefixStyle,
      this.prefixIconColor,
      this.prefixIconConstraints,
      this.suffixStyle,
      this.suffixIconColor,
      this.suffixIconConstraints,
      this.counterStyle,
      this.filled,
      this.fillColor,
      this.activeIndicatorBorder,
      this.outlineBorder,
      this.focusColor,
      this.hoverColor,
      this.errorBorder,
      this.focusedBorder,
      this.focusedErrorBorder,
      this.disabledBorder,
      this.enabledBorder,
      this.border,
      this.alignLabelWithHint,
      this.constraints,
      this.hintFadeDuration,
      this.visualDensity,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    const defaults = new InputDecorationThemeData();
    properties.add(
      new DiagnosticsProperty('labelStyle', this.labelStyle, {
        defaultValue: defaults.labelStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('floatingLabelStyle', this.floatingLabelStyle, {
        defaultValue: defaults.floatingLabelStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('helperStyle', this.helperStyle, {
        defaultValue: defaults.helperStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new IntProperty('helperMaxLines', this.helperMaxLines, {
        defaultValue: defaults.helperMaxLines,
      }),
    );
    properties.add(
      new DiagnosticsProperty('hintStyle', this.hintStyle, {
        defaultValue: defaults.hintStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('hintFadeDuration', this.hintFadeDuration, {
        defaultValue: defaults.hintFadeDuration,
        typeName: 'Duration',
      }),
    );
    properties.add(
      new IntProperty('hintMaxLines', this.hintMaxLines, { defaultValue: defaults.hintMaxLines }),
    );
    properties.add(
      new DiagnosticsProperty('errorStyle', this.errorStyle, {
        defaultValue: defaults.errorStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new IntProperty('errorMaxLines', this.errorMaxLines, {
        defaultValue: defaults.errorMaxLines,
      }),
    );
    properties.add(
      new DiagnosticsProperty('floatingLabelBehavior', this.floatingLabelBehavior, {
        defaultValue: defaults.floatingLabelBehavior,
        typeName: 'FloatingLabelBehavior',
      }),
    );
    properties.add(
      new DiagnosticsProperty('floatingLabelAlignment', this.floatingLabelAlignment, {
        defaultValue: defaults.floatingLabelAlignment,
        typeName: 'FloatingLabelAlignment',
      }),
    );
    properties.add(
      new DiagnosticsProperty('isDense', this.isDense, {
        defaultValue: defaults.isDense,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('contentPadding', this.contentPadding, {
        defaultValue: defaults.contentPadding,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(
      new DiagnosticsProperty('isCollapsed', this.isCollapsed, {
        defaultValue: defaults.isCollapsed,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('iconColor', this.iconColor, {
        defaultValue: defaults.iconColor,
        typeName: 'Color',
      }),
    );
    properties.add(
      new DiagnosticsProperty('prefixIconColor', this.prefixIconColor, {
        defaultValue: defaults.prefixIconColor,
        typeName: 'Color',
      }),
    );
    properties.add(
      new DiagnosticsProperty('prefixIconConstraints', this.prefixIconConstraints, {
        defaultValue: defaults.prefixIconConstraints,
        typeName: 'BoxConstraints',
      }),
    );
    properties.add(
      new DiagnosticsProperty('prefixStyle', this.prefixStyle, {
        defaultValue: defaults.prefixStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('suffixIconColor', this.suffixIconColor, {
        defaultValue: defaults.suffixIconColor,
        typeName: 'Color',
      }),
    );
    properties.add(
      new DiagnosticsProperty('suffixIconConstraints', this.suffixIconConstraints, {
        defaultValue: defaults.suffixIconConstraints,
        typeName: 'BoxConstraints',
      }),
    );
    properties.add(
      new DiagnosticsProperty('suffixStyle', this.suffixStyle, {
        defaultValue: defaults.suffixStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('counterStyle', this.counterStyle, {
        defaultValue: defaults.counterStyle,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('filled', this.filled, {
        defaultValue: defaults.filled,
        typeName: 'bool',
      }),
    );
    properties.add(
      new ColorProperty('fillColor', this.fillColor, { defaultValue: defaults.fillColor }),
    );
    properties.add(
      new DiagnosticsProperty('activeIndicatorBorder', this.activeIndicatorBorder, {
        defaultValue: defaults.activeIndicatorBorder,
        typeName: 'BorderSide',
      }),
    );
    properties.add(
      new DiagnosticsProperty('outlineBorder', this.outlineBorder, {
        defaultValue: defaults.outlineBorder,
        typeName: 'BorderSide',
      }),
    );
    properties.add(
      new ColorProperty('focusColor', this.focusColor, { defaultValue: defaults.focusColor }),
    );
    properties.add(
      new ColorProperty('hoverColor', this.hoverColor, { defaultValue: defaults.hoverColor }),
    );
    properties.add(
      new DiagnosticsProperty('errorBorder', this.errorBorder, {
        defaultValue: defaults.errorBorder,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('focusedBorder', this.focusedBorder, {
        defaultValue: defaults.focusedErrorBorder,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('focusedErrorBorder', this.focusedErrorBorder, {
        defaultValue: defaults.focusedErrorBorder,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('disabledBorder', this.disabledBorder, {
        defaultValue: defaults.disabledBorder,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('enabledBorder', this.enabledBorder, {
        defaultValue: defaults.enabledBorder,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('border', this.border, {
        defaultValue: defaults.border,
        typeName: 'InputBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('alignLabelWithHint', this.alignLabelWithHint, {
        defaultValue: defaults.alignLabelWithHint,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('constraints', this.constraints, {
        defaultValue: defaults.constraints,
        typeName: 'BoxConstraints',
      }),
    );
    properties.add(
      new DiagnosticsProperty('visualDensity', this.visualDensity, {
        defaultValue: defaults.visualDensity,
        typeName: 'VisualDensity',
      }),
    );
  }
}
