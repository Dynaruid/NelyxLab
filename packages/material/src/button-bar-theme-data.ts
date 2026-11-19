// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/button_bar_theme.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { invariant } from '@nelyx/core/foundation/errors';
import type { VerticalDirection } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { hashValues, valueEquals } from '@nelyx/core/framework/painting/value-equality';
import type { MainAxisAlignment } from '@nelyx/core/framework/rendering/boxes';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import type { ButtonBarLayoutBehavior, ButtonTextTheme } from './button-theme.ts';

export interface ButtonBarThemeDataOptions {
  readonly alignment?: MainAxisAlignment | null;
  readonly mainAxisSize?: 'min' | 'max' | null;
  readonly buttonTextTheme?: ButtonTextTheme | null;
  readonly buttonMinWidth?: number | null;
  readonly buttonHeight?: number | null;
  readonly buttonPadding?: EdgeInsetsGeometry | null;
  readonly buttonAlignedDropdown?: boolean | null;
  readonly layoutBehavior?: ButtonBarLayoutBehavior | null;
  readonly overflowDirection?: VerticalDirection | null;
}

const fields = [
  'alignment',
  'mainAxisSize',
  'buttonTextTheme',
  'buttonMinWidth',
  'buttonHeight',
  'buttonPadding',
  'buttonAlignedDropdown',
  'layoutBehavior',
  'overflowDirection',
] as const;

/** @deprecated Use OverflowBar and its child button themes. */
export class ButtonBarThemeData extends Diagnosticable(class {}) {
  readonly alignment: MainAxisAlignment | null;
  readonly mainAxisSize: 'min' | 'max' | null;
  readonly buttonTextTheme: ButtonTextTheme | null;
  readonly buttonMinWidth: number | null;
  readonly buttonHeight: number | null;
  readonly buttonPadding: EdgeInsetsGeometry | null;
  readonly buttonAlignedDropdown: boolean | null;
  readonly layoutBehavior: ButtonBarLayoutBehavior | null;
  readonly overflowDirection: VerticalDirection | null;

  constructor({
    alignment = null,
    mainAxisSize = null,
    buttonTextTheme = null,
    buttonMinWidth = null,
    buttonHeight = null,
    buttonPadding = null,
    buttonAlignedDropdown = null,
    layoutBehavior = null,
    overflowDirection = null,
  }: ButtonBarThemeDataOptions = {}) {
    super();
    invariant(
      (buttonMinWidth === null || buttonMinWidth >= 0) &&
        (buttonHeight === null || buttonHeight >= 0),
      'invalid-button-bar-theme-size',
      'Button bar dimensions must be nonnegative',
    );
    this.alignment = alignment;
    this.mainAxisSize = mainAxisSize;
    this.buttonTextTheme = buttonTextTheme;
    this.buttonMinWidth = buttonMinWidth;
    this.buttonHeight = buttonHeight;
    this.buttonPadding = buttonPadding;
    this.buttonAlignedDropdown = buttonAlignedDropdown;
    this.layoutBehavior = layoutBehavior;
    this.overflowDirection = overflowDirection;
    if (new.target === ButtonBarThemeData) Object.freeze(this);
  }

  copyWith(options: ButtonBarThemeDataOptions = {}): ButtonBarThemeData {
    return new ButtonBarThemeData(
      Object.fromEntries(fields.map((field) => [field, options[field] ?? this[field]])),
    );
  }

  static lerp(
    a: ButtonBarThemeData | null,
    b: ButtonBarThemeData | null,
    t: number,
  ): ButtonBarThemeData | null {
    if (a === b) return a;
    const edge = t < 0.5 ? a : b;
    return new ButtonBarThemeData({
      alignment: edge?.alignment ?? null,
      mainAxisSize: edge?.mainAxisSize ?? null,
      buttonTextTheme: edge?.buttonTextTheme ?? null,
      buttonMinWidth: lerpDouble(a?.buttonMinWidth ?? null, b?.buttonMinWidth ?? null, t),
      buttonHeight: lerpDouble(a?.buttonHeight ?? null, b?.buttonHeight ?? null, t),
      buttonPadding: EdgeInsetsGeometry.lerp(a?.buttonPadding ?? null, b?.buttonPadding ?? null, t),
      buttonAlignedDropdown: edge?.buttonAlignedDropdown ?? null,
      layoutBehavior: edge?.layoutBehavior ?? null,
      overflowDirection: edge?.overflowDirection ?? null,
    });
  }

  equals(other: unknown): boolean {
    return (
      other instanceof ButtonBarThemeData &&
      fields.every((field) => valueEquals(this[field], other[field]))
    );
  }

  get hashCode(): number {
    return hashValues(...fields.map((field) => this[field]));
  }

  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const field of fields)
      properties.add(new DiagnosticsProperty(field, this[field], { defaultValue: null }));
  }
}
