// SPDX-License-Identifier: BSD-3-Clause
import { Color } from '@nelyx/core/ui/color';
import { captureSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Theme } from '../../theme.ts';
import { ThemeData } from '../../theme-data.ts';
import type { ColorScheme } from '../../color-scheme.ts';
/** Material's public ColorScheme uses ARGB; source Dart uses Color receivers. */
export class SourceDateColorScheme {
  constructor(readonly source: ColorScheme) {}
  get surface(): Color {
    return captureSourceColor(new Color(this.source.surface));
  }
  get secondary(): Color {
    return captureSourceColor(new Color(this.source.secondary));
  }
  get surfaceContainerHigh(): Color {
    return captureSourceColor(new Color(this.source.surfaceContainerHigh));
  }
}
export class SourceDateThemeData {
  readonly colorScheme: SourceDateColorScheme;
  constructor(readonly source: ThemeData) {
    this.colorScheme = new SourceDateColorScheme(source.colorScheme);
  }
  // The current public ThemeData contract is Material 3 only.
  get useMaterial3(): boolean {
    return true;
  }
  get platform() {
    return this.source.platform;
  }
  get datePickerTheme() {
    return this.source.datePickerTheme;
  }
  get textTheme() {
    return this.source.textTheme;
  }
  get dialogTheme() {
    return this.source.dialogTheme;
  }
  get iconTheme() {
    return this.source.iconTheme;
  }
  get brightness() {
    return this.source.brightness;
  }
  get shadowColor() {
    return this.source.shadowColor;
  }
}
const themes = new WeakMap<ThemeData, SourceDateThemeData>();
export class SourceDateTheme {
  static of(context: BuildContext): SourceDateThemeData {
    const source = Theme.of(context);
    let result = themes.get(source);
    if (!result) {
      result = new SourceDateThemeData(source);
      themes.set(source, result);
    }
    return result;
  }
}
