// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/app.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import {
  StatelessWidget,
  StatefulWidget,
  State,
  Widget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import {
  WidgetsApp,
  appNavigatorController,
  canonicalLocaleTag,
  localizedDirectionality,
} from '@nelyx/core/framework/widgets/app';
import type { WidgetsAppOptions } from '@nelyx/core/framework/widgets/app';
import type { InspectorButtonBuilder } from '@nelyx/core/framework/widgets/app';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { Router } from '@nelyx/core/framework/widgets/router';
import type { RouterOptions } from '@nelyx/core/framework/widgets/router';
import { AppFocus } from '@nelyx/core/framework/widgets/app-focus';
import type { AppFocusOptions } from '@nelyx/core/framework/widgets/app-focus';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import {
  AnnotatedRegion,
  systemUiOverlayStyleAnnotation,
} from '@nelyx/core/framework/widgets/annotated-region';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import {
  AppTheme,
  Localizations,
  MediaQuery,
  darkAppTheme,
} from '@nelyx/core/framework/widgets/app-data';
import type { AppThemeData } from '@nelyx/core/framework/widgets/app-data';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { TapRegionSurface } from '@nelyx/core/framework/widgets/tap-region';
import { ShortcutRegistrar } from '@nelyx/core/framework/widgets/shortcuts';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import type { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { HeroControllerScope } from '@nelyx/core/framework/widgets/heroes';
import { CupertinoThemeData } from '@nelyx/cupertino/theme';
import { cupertinoCatalogDelegate } from '@nelyx/cupertino/cupertino-localizations';
import { Theme, AnimatedTheme, kThemeAnimationDuration } from './theme.ts';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight, TextDecoration } from '@nelyx/core/ui/typography';
import { MaterialPageRoute } from './page.ts';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Curve } from '@nelyx/core/framework/animation/curves';
import { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { ThemeData } from './theme-data.ts';
import { materialCatalogDelegate } from './material-localizations.ts';
import { ColorScheme } from './color-scheme.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { MaterialScrollBehavior } from './scroll-behavior.ts';
import { ScaffoldMessenger } from './scaffold-messenger.ts';
import type { ScaffoldMessengerState } from './scaffold-messenger.ts';
export const ThemeMode = Object.freeze({
  system: 'system',
  light: 'light',
  dark: 'dark',
} as const);
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];
export interface MaterialAppOptions
  extends Omit<WidgetsAppOptions, 'theme' | 'builder' | 'pageRouteBuilder'>, AppFocusOptions {
  readonly themeAnimationDuration?: number;
  readonly themeAnimationCurve?: Curve;
  readonly themeAnimationStyle?: AnimationStyle | null;
  readonly theme?: ThemeData | null;
  readonly darkTheme?: ThemeData | null;
  readonly highContrastTheme?: ThemeData | null;
  readonly highContrastDarkTheme?: ThemeData | null;
  readonly themeMode?: ThemeMode | null;
  readonly scrollBehavior?: ScrollBehavior | null;
  readonly scaffoldMessengerKey?: GlobalKey<ScaffoldMessengerState> | null;
  readonly debugShowMaterialGrid?: boolean;
  readonly builder?: (context: BuildContext, child: Widget) => Widget;
}

const materialInspectorButton: InspectorButtonBuilder = (_context, button) => {
  const { action, label, moveRight, selected, onPressed } = button;
  const icon =
    action === 'exit'
      ? Icons.close
      : action === 'move'
        ? moveRight
          ? Icons.arrow_right
          : Icons.arrow_left
        : action === 'select'
          ? Icons.search
          : Icons.touch_app;
  const options = {
    icon: new Icon(icon),
    iconSize: 20,
    tooltip: label,
    onPressed,
    ...(action === 'tapBehavior' ? { isSelected: selected } : {}),
  };
  return action === 'select' || action === 'exit' || selected
    ? IconButton.filled(options)
    : new IconButton(options);
};
type RouterAppOptions<T> = Omit<
  MaterialAppOptions,
  | 'child'
  | 'home'
  | 'routes'
  | 'initialRoute'
  | 'navigatorController'
  | 'navigatorKey'
  | 'navigatorObservers'
  | 'navigatorRestorationId'
  | 'onGenerateRoute'
  | 'onUnknownRoute'
  | 'onGenerateInitialRoutes'
> & {
  readonly routerConfig: RouterOptions<T>;
};
/** @internal Original _themeBuilder's selection order, without OS side effects. */
export function selectMaterialAppTheme(
  options: Pick<
    MaterialAppOptions,
    'theme' | 'darkTheme' | 'highContrastTheme' | 'highContrastDarkTheme' | 'themeMode'
  >,
  brightness: 'light' | 'dark',
  highContrast: boolean,
): ThemeData {
  const mode = options.themeMode ?? ThemeMode.system,
    dark = mode === ThemeMode.dark || (mode === ThemeMode.system && brightness === 'dark');
  invariant(
    Object.values(ThemeMode).includes(mode),
    'invalid-theme-mode',
    'Theme mode must be system, light or dark',
  );
  return (
    (dark && highContrast ? options.highContrastDarkTheme : null) ??
    (dark ? options.darkTheme : null) ??
    (highContrast ? options.highContrastTheme : null) ??
    options.theme ??
    ThemeData.light()
  );
}
const defaultBehavior = Object.freeze(new MaterialScrollBehavior());
const fallbackTextStyle = new TextStyle({
  color: 0xd0ff0000,
  fontFamily: 'monospace',
  fontSize: 48,
  fontWeight: FontWeight.w900,
  decoration: TextDecoration.underline,
  decorationColor: 0xffffff00,
  decorationStyle: 'double',
  debugLabel: 'fallback style; consider putting your text in a Material',
});
const palette = (theme: ThemeData): AppThemeData => ({
  background: theme.colorScheme.surface,
  surface: theme.colorScheme.surface,
  foreground: theme.colorScheme.onSurface,
  accent: theme.colorScheme.primary,
  onAccent: theme.colorScheme.onPrimary,
  radius: 12,
});
function themed(
  data: ThemeData,
  colors: AppThemeData,
  child: Widget,
  options?: MaterialAppOptions,
): Widget {
  const selection = new AppTheme(
    colors,
    new DefaultSelectionStyle({
      cursorColor: data.textSelectionTheme.cursorColor ?? data.colorScheme.primary,
      selectionColor:
        data.textSelectionTheme.selectionColor ??
        ((data.colorScheme.primary & 0xffffff) | 0x66000000) >>> 0,
      child: options
        ? new DefaultTextStyle(fallbackTextStyle, child)
        : new Builder(
            (context) => new DefaultTextStyle(Theme.of(context).textTheme.bodyMedium!, child),
          ),
    }),
  );
  const content = new AnnotatedRegion(selection, {
    annotationType: systemUiOverlayStyleAnnotation,
    value: data.brightness === 'dark' ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
  });
  return options && !options.themeAnimationStyle?.equals(AnimationStyle.noAnimation)
    ? new AnimatedTheme({
        data,
        child: content,
        duration:
          options.themeAnimationStyle?.duration ??
          options.themeAnimationDuration ??
          kThemeAnimationDuration,
        curve: options.themeAnimationStyle?.curve ?? options.themeAnimationCurve ?? Curves.linear,
      })
    : new Theme(data, content);
}
export class MaterialApp extends StatelessWidget {
  readonly child: Widget;
  readonly theme: AppThemeData | ThemeData;
  readonly locale: string;
  readonly messages: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly direction: 'ltr' | 'rtl';
  readonly scrollBehavior: ScrollBehavior | null;
  readonly options: MaterialAppOptions | null;
  constructor(options: MaterialAppOptions);
  constructor(
    child: Widget,
    theme?: AppThemeData | ThemeData,
    locale?: string,
    messages?: Readonly<Record<string, Readonly<Record<string, string>>>>,
    direction?: 'ltr' | 'rtl',
    scrollBehavior?: ScrollBehavior | null,
  );
  constructor(
    first: Widget | MaterialAppOptions,
    theme: AppThemeData | ThemeData = darkAppTheme,
    locale = 'ko-KR',
    messages: Readonly<Record<string, Readonly<Record<string, string>>>> = {},
    direction: 'ltr' | 'rtl' = 'ltr',
    scrollBehavior: ScrollBehavior | null = null,
  ) {
    super(first instanceof Widget ? null : (first.key ?? null));
    this.options = first instanceof Widget ? null : Object.freeze({ ...first });
    this.theme = this.options ? (this.options.theme ?? ThemeData.light()) : theme;
    this.locale = this.options ? (this.options.locale ?? 'ko-KR') : locale;
    this.messages = this.options?.messages ?? messages;
    this.direction = direction;
    this.scrollBehavior = this.options?.scrollBehavior ?? scrollBehavior;
    this.child = first instanceof Widget ? first : this.application(first);
  }
  static router<T>({ routerConfig, ...options }: RouterAppOptions<T>): MaterialApp {
    return new MaterialApp({ ...options, child: new Router(routerConfig) });
  }
  private application(options: MaterialAppOptions): Widget {
    const {
      key: _key,
      theme,
      darkTheme,
      highContrastTheme,
      highContrastDarkTheme,
      themeMode,
      themeAnimationDuration,
      themeAnimationCurve,
      themeAnimationStyle,
      scrollBehavior,
      scaffoldMessengerKey,
      debugShowMaterialGrid: _debugShowMaterialGrid,
      builder,
      shortcuts,
      actions,
      ...app
    } = options;
    return new WidgetsApp({
      ...app,
      inspectorButtonBuilder: app.inspectorButtonBuilder ?? materialInspectorButton,
      supportedLocales: app.supportedLocales ?? ['ko-KR'],
      localizationsDelegates: [
        ...(app.localizationsDelegates ?? []),
        materialCatalogDelegate,
        cupertinoCatalogDelegate,
      ],
      pageRouteBuilder: (settings, builder) =>
        new MaterialPageRoute({
          settings: new RouteSettings({ name: settings.name, arguments: settings.argumentsValue }),
          builder,
        }),
      builder: (context, child) => {
        const data = selectMaterialAppTheme(
            options,
            MediaQuery.maybePlatformBrightnessOf(context) ?? 'light',
            MediaQuery.maybeHighContrastOf(context) ?? false,
          ),
          navigator = appNavigatorController(child);
        const content = new Builder((themedContext) => {
          const built = builder?.(themedContext, child) ?? child;
          return new TapRegionSurface(
            navigator ? new HeroControllerScope({ navigator, child: built }) : built,
          );
        });
        return new ScrollConfiguration({
          behavior: scrollBehavior ?? defaultBehavior,
          child: themed(
            data,
            palette(data),
            new ScaffoldMessenger({
              key: scaffoldMessengerKey ?? null,
              child: new AppFocus(content, {
                ...(shortcuts ? { shortcuts } : {}),
                ...(actions ? { actions } : {}),
              }),
            }),
            options,
          ),
        });
      },
    });
  }
  build(context: BuildContext): Widget {
    if (this.options)
      return FoundationBuildMode.debug
        ? new CustomPaint(this.child, {
            foregroundPainter: this.options.debugShowMaterialGrid ? materialGrid : null,
          })
        : this.child;
    const tag = canonicalLocaleTag(this.locale);
    if (context.maybeDependOn(Localizations) == null)
      context.services.setViewLocale?.(tag, this.direction);
    const colors = this.theme instanceof ThemeData ? palette(this.theme) : this.theme;
    const data =
      this.theme instanceof ThemeData
        ? this.theme
        : new ThemeData({
            colorScheme: new ColorScheme({
              brightness: colors.background === darkAppTheme.background ? 'dark' : 'light',
              primary: colors.accent,
              surface: colors.surface,
              onSurface: colors.foreground,
            }),
            cupertinoOverrideTheme: new CupertinoThemeData({
              brightness: colors.background === darkAppTheme.background ? 'dark' : 'light',
              primaryColor: colors.accent,
              selectionHandleColor: colors.accent,
            }),
          });
    return new ScrollConfiguration({
      behavior: this.scrollBehavior ?? defaultBehavior,
      child: localizedDirectionality(
        tag,
        this.direction,
        new Localizations(
          this.locale,
          this.messages,
          'en',
          themed(
            data,
            colors,
            new ScaffoldMessenger({ child: new AppFocus(new MaterialAppOverlay(this.child)) }),
          ),
        ),
      ),
    });
  }
}

// MaterialApp uses GridPaper from widgets/grid_paper.dart at the pinned revision.
const materialGrid = new (class extends CustomPainter {
  override paint(canvas: Canvas, size: Size): void {
    const line = new Paint({ color: 0xe0f9bbe0 });
    for (let x = 0; x <= size.width; x += 4) {
      line.strokeWidth = x % 8 === 0 ? 1 : 0.25;
      canvas.drawLine({ x, y: 0 }, { x, y: size.height }, line);
    }
    for (let y = 0; y <= size.height; y += 4) {
      line.strokeWidth = y % 8 === 0 ? 1 : 0.25;
      canvas.drawLine({ x: 0, y }, { x: size.width, y }, line);
    }
  }
  override shouldRepaint(): boolean {
    return false;
  }
  override hitTest(): boolean {
    return false;
  }
})();

class MaterialAppOverlay extends StatefulWidget {
  constructor(readonly child: Widget) {
    super();
  }
  createState(): State {
    return new MaterialAppOverlayState();
  }
}
class MaterialAppOverlayState extends State<MaterialAppOverlay> {
  private readonly entry = new OverlayEntry({ builder: () => this.widget.child });
  override didUpdateWidget(old: MaterialAppOverlay): void {
    super.didUpdateWidget(old);
    if (old.child !== this.widget.child) this.entry.markNeedsBuild();
  }
  build(): Widget {
    return new ShortcutRegistrar(
      new TapRegionSurface(new Overlay({ initialEntries: [this.entry] })),
    );
  }
  override dispose(): void {
    this.entry.dispose();
    super.dispose();
  }
}
