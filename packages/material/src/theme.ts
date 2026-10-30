// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Tween } from '@nelyx/core/framework/animation/tween';
import {
  ImplicitlyAnimatedWidget,
  AnimatedWidgetBaseState,
} from '@nelyx/core/framework/widgets/implicit-animations';
import type {
  ImplicitlyAnimatedWidgetOptions,
  TweenVisitor,
} from '@nelyx/core/framework/widgets/implicit-animations';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { CupertinoTheme, InheritedCupertinoTheme } from '@nelyx/cupertino/theme';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import {
  ThemeData,
  MaterialBasedCupertinoThemeData,
  CupertinoBasedMaterialThemeData,
} from './theme-data.ts';
import { MaterialThemeScope, maybeMaterialThemeScopeOf } from './internal/theme/theme-scope.ts';
import { materialScriptCategoryOf } from './material-localizations.ts';

/** Source Duration represented by the existing host millisecond API. */
export const kThemeAnimationDuration = 200;
export interface ThemeOptions extends WidgetOptions {
  readonly data: ThemeData;
  readonly child: Widget;
}
export class Theme extends StatelessWidget {
  private static fallbackData: ThemeData | null = null;
  readonly data: ThemeData;
  readonly child: Widget;
  constructor(options: ThemeOptions);
  constructor(data: ThemeData, child: Widget, options?: WidgetOptions);
  constructor(first: ThemeOptions | ThemeData, child?: Widget, options: WidgetOptions = {}) {
    const input = first instanceof ThemeData ? { data: first, child, ...options } : first;
    super(input.key ?? null);
    if (!(input.data instanceof ThemeData) || !(input.child instanceof Widget)) {
      throw new TypeError('Theme requires ThemeData and a child Widget');
    }
    this.data = input.data;
    this.child = input.child;
  }
  static of(context: BuildContext): ThemeData {
    const scope = maybeMaterialThemeScopeOf(context);
    const category = materialScriptCategoryOf(context);
    const cupertino = context.maybeDependOn(InheritedCupertinoTheme);
    const data =
      scope?.data ??
      (cupertino
        ? new CupertinoBasedMaterialThemeData({ themeData: cupertino.theme.data }).materialTheme
        : (Theme.fallbackData ??= ThemeData.fallback()));
    return ThemeData.localize(data, data.typography.geometryThemeFor(category));
  }
  static brightnessOf(context: BuildContext): 'light' | 'dark' {
    return (
      maybeMaterialThemeScopeOf(context)?.data.brightness ??
      MediaQuery.of(context).platformBrightness ??
      'light'
    );
  }
  static maybeBrightnessOf(context: BuildContext): 'light' | 'dark' | null {
    return (
      maybeMaterialThemeScopeOf(context)?.data.brightness ??
      MediaQuery.maybePlatformBrightnessOf(context)
    );
  }
  override build(context: BuildContext): Widget {
    const selection = DefaultSelectionStyle.of(context);
    const cupertino = (
      context.maybeDependOn(InheritedCupertinoTheme)?.theme.data ??
      new MaterialBasedCupertinoThemeData({ materialTheme: this.data })
    ).resolveFrom(context);
    return new InheritedMaterialTheme(
      this,
      new CupertinoTheme(
        cupertino,
        new IconTheme(
          this.data.iconTheme,
          new DefaultSelectionStyle({
            cursorColor: this.data.textSelectionTheme.cursorColor ?? selection.cursorColor,
            selectionColor: this.data.textSelectionTheme.selectionColor ?? selection.selectionColor,
            child: this.child,
          }),
        ),
      ),
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('data', this.data, { showName: false, typeName: 'ThemeData' }),
    );
  }
}
class InheritedMaterialTheme extends MaterialThemeScope {
  constructor(
    readonly theme: Theme,
    child: Widget,
  ) {
    super(theme.data, child);
  }
  override resolveData(context: BuildContext): ThemeData {
    const category = materialScriptCategoryOf(context);
    context.maybeDependOn(InheritedCupertinoTheme);
    return ThemeData.localize(this.data, this.data.typography.geometryThemeFor(category));
  }
  override wrap(_context: BuildContext, child: Widget): Widget {
    return new Theme(this.data, child);
  }
  override updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
export {
  ThemeData,
  VisualDensity,
  MaterialTapTargetSize,
  MaterialBasedCupertinoThemeData,
  CupertinoBasedMaterialThemeData,
} from './theme-data.ts';
export type { ThemeDataOptions, ThemeDataRawOptions, VisualDensityOptions } from './theme-data.ts';
export { Adaptation, ThemeExtension } from './theme-data.ts';
export type { ThemeAdaptation, ThemeExtensionEntry, ThemeType } from './theme-data.ts';
export { ColorScheme, DynamicSchemeVariant } from './color-scheme.ts';
export type {
  ColorSchemeOptions,
  ColorSchemeFromSeedOptions,
  ColorSchemeFromImageOptions,
  ColorRole,
} from './color-scheme.ts';

/** Nullable endpoints follow the source Tween contract until lerp is evaluated. */
export class ThemeDataTween extends Tween<ThemeData> {
  /** @dartParam t double */
  override lerp(t: number): ThemeData {
    if (this.begin === null || this.end === null)
      throw new TypeError('ThemeDataTween endpoints must be non-null');
    return ThemeData.lerp(this.begin, this.end, t);
  }
}
export interface AnimatedThemeOptions extends Omit<ImplicitlyAnimatedWidgetOptions, 'duration'> {
  readonly data: ThemeData;
  readonly child: Widget;
  readonly duration?: number;
}
export class AnimatedTheme extends ImplicitlyAnimatedWidget {
  readonly data: ThemeData;
  readonly child: Widget;
  constructor(options: AnimatedThemeOptions) {
    super({ ...options, duration: options.duration ?? kThemeAnimationDuration });
    this.data = options.data;
    this.child = options.child;
    Object.freeze(this);
  }
  override createState(): AnimatedWidgetBaseState<AnimatedTheme> {
    return new AnimatedThemeState();
  }
}
class AnimatedThemeState extends AnimatedWidgetBaseState<AnimatedTheme> {
  private data: Tween<ThemeData> | null = null;
  protected override forEachTween(visitor: TweenVisitor): void {
    this.data = visitor(
      this.data,
      this.widget.data,
      (value) => new ThemeDataTween({ begin: value }),
    );
  }
  override build(_context: BuildContext): Widget {
    return new Theme(this.data!.evaluate(this.animation), this.widget.child);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('data', this.data, {
        showName: false,
        defaultValue: null,
        typeName: 'ThemeDataTween',
      }),
    );
  }
}
