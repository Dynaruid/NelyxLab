// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { StatelessWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery, AppTheme } from '@nelyx/core/framework/widgets/app-data';
import type { AppThemeData } from '@nelyx/core/framework/widgets/app-data';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { CupertinoIconThemeData } from './icon-theme-data.ts';
import { registerCupertinoThemeBrightnessReader } from './internal/theme/theme-brightness.ts';
import { themePrimaryColor } from './internal/colors/color-values.ts';
import { CupertinoThemeData } from './theme-data.ts';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
export { CupertinoThemeData, NoDefaultCupertinoThemeData } from './theme-data.ts';
export type { CupertinoThemeDataOptions } from './theme-data.ts';
export interface CupertinoThemeOptions extends WidgetOptions {
  readonly data: CupertinoThemeData;
  readonly child: Widget;
}
export class CupertinoTheme extends StatelessWidget {
  private static readonly fallbackData = new CupertinoThemeData();
  readonly data: CupertinoThemeData;
  readonly child: Widget;
  private readonly palette: AppThemeData | null;
  constructor(options: CupertinoThemeOptions);
  constructor(data: CupertinoThemeData, child: Widget, options?: WidgetOptions);
  constructor(child: Widget, data?: AppThemeData);
  constructor(
    first: CupertinoThemeOptions | CupertinoThemeData | Widget,
    second?: Widget | AppThemeData,
    options: WidgetOptions = {},
  ) {
    const input =
      first instanceof Widget
        ? null
        : first instanceof CupertinoThemeData
          ? { data: first, child: second, ...options }
          : first;
    super(input?.key ?? null);
    this.palette = input ? null : second instanceof Widget ? null : (second ?? cupertinoTheme);
    this.data =
      input?.data ??
      new CupertinoThemeData({
        primaryColor: this.palette!.accent,
        primaryContrastingColor: this.palette!.onAccent ?? 0xffffffff,
        scaffoldBackgroundColor: this.palette!.background,
        barBackgroundColor: this.palette!.surface,
      });
    const child = input?.child ?? first;
    if (!(this.data instanceof CupertinoThemeData) || !(child instanceof Widget)) {
      throw new TypeError('CupertinoTheme requires CupertinoThemeData and a child Widget');
    }
    this.child = child;
  }
  static of(context: BuildContext): CupertinoThemeData {
    return (
      context.maybeDependOn(InheritedCupertinoTheme)?.theme.data ?? this.fallbackData
    ).resolveFrom(context);
  }
  static brightnessOf(context: BuildContext): 'light' | 'dark' {
    return (
      context.maybeDependOn(InheritedCupertinoTheme)?.theme.data.specifiedBrightness ??
      MediaQuery.of(context).platformBrightness ??
      'light'
    );
  }
  static maybeBrightnessOf(context: BuildContext): 'light' | 'dark' | null {
    return (
      context.maybeDependOn(InheritedCupertinoTheme)?.theme.data.specifiedBrightness ??
      MediaQuery.maybePlatformBrightnessOf(context)
    );
  }
  override build(_context: BuildContext): Widget {
    let child = this.child;
    const palette = this.palette;
    if (palette) {
      child = new Builder(
        (context) =>
          new AppTheme(
            palette,
            new DefaultTextStyle(
              CupertinoTheme.of(context).textTheme.textStyle.copyWith({
                color: palette.foreground,
              }),
              this.child,
            ),
          ),
      );
    }
    return new InheritedCupertinoTheme({
      theme: this,
      child: new IconTheme(
        new CupertinoIconThemeData({ color: themePrimaryColor(this.data) }),
        child,
      ),
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    this.data.debugFillProperties(properties);
  }
}
export interface InheritedCupertinoThemeOptions extends WidgetOptions {
  readonly theme: CupertinoTheme;
  readonly child: Widget;
}
export class InheritedCupertinoTheme extends InheritedTheme {
  readonly theme: CupertinoTheme;
  constructor({ key = null, theme, child }: InheritedCupertinoThemeOptions) {
    super(child, key);
    this.theme = theme;
  }
  override wrap(_context: BuildContext, child: Widget): Widget {
    return new CupertinoTheme(this.theme.data, child);
  }
  override updateShouldNotify(old: this): boolean {
    return !this.theme.data.equals(old.theme.data);
  }
}
export const cupertinoTheme: AppThemeData = Object.freeze({
  background: 0xfff2f2f7,
  surface: 0xffffffff,
  foreground: 0xff1c1c1e,
  accent: 0xff007aff,
  radius: 10,
});
registerCupertinoThemeBrightnessReader((context) => CupertinoTheme.maybeBrightnessOf(context));
