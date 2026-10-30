import { registerInputDecorationTheme } from './internal/theme/theme-value-wrappers.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Modern inherited data mode; obsolete standalone value aliases are excluded.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { Theme } from './theme.ts';
import { InputDecorationThemeData } from './input-decoration-theme-data.ts';
export { InputDecorationThemeData } from './input-decoration-theme-data.ts';
export type {
  InputDecorationThemeDataOptions,
  InputDecorationThemeDataCopyOptions,
} from './input-decoration-theme-data.ts';
export class InputDecorationTheme extends InheritedTheme {
  readonly data: InputDecorationThemeData;
  constructor(
    data: InputDecorationThemeData | null = null,
    child: Widget | null = null,
    options: WidgetOptions = {},
  ) {
    super(child ?? new SizedBox(), options.key ?? null);
    if (data !== null && !(data instanceof InputDecorationThemeData))
      throw new TypeError('InputDecorationTheme requires canonical data');
    this.data = data ?? new InputDecorationThemeData();
    registerInputDecorationTheme(this);
  }
  static of(context: BuildContext): InputDecorationThemeData {
    return (
      context.maybeDependOn(InputDecorationTheme)?.data ?? Theme.of(context).inputDecorationTheme
    );
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new InputDecorationTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    this.data.debugFillProperties(properties);
  }
}
