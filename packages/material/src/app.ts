// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional App composition on the shared Nelyx routing/theme/input ABI.
import { StatelessWidget, StatefulWidget, State, Widget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { WidgetsApp, appNavigatorController } from '@nelyx/core/framework/widgets/app';
import type { WidgetsAppOptions } from '@nelyx/core/framework/widgets/app';
import { Router } from '@nelyx/core/framework/widgets/router';
import type { RouterOptions } from '@nelyx/core/framework/widgets/router';
import { AppFocus } from '@nelyx/core/framework/widgets/app-focus';
import type { AppFocusOptions } from '@nelyx/core/framework/widgets/app-focus';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import { AppTheme, Directionality, Localizations, MediaQuery, darkAppTheme } from '@nelyx/core/framework/widgets/app-data';
import type { AppThemeData } from '@nelyx/core/framework/widgets/app-data';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { TapRegionSurface } from '@nelyx/core/framework/widgets/tap-region';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import type { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { HeroControllerScope } from '@nelyx/core/framework/widgets/heroes';
import { CupertinoThemeData } from '@nelyx/cupertino/theme';
import { Theme,AnimatedTheme,kThemeAnimationDuration } from './theme.ts';
import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';
import {MaterialPageRoute} from './page.ts';
import {RouteSettings} from '@nelyx/core/framework/widgets/pages';
import {Curves} from '@nelyx/core/framework/animation/curves';
import type {Curve} from '@nelyx/core/framework/animation/curves';
import {AnimationStyle} from '@nelyx/core/framework/animation/animation-style';
import { ThemeData } from './theme-data.ts';
import { ColorScheme } from './color-scheme.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { MaterialScrollBehavior } from './scroll-behavior.ts';
export const ThemeMode = Object.freeze({
    system: 'system', light: 'light', dark: 'dark'
} as const);
export type ThemeMode = typeof ThemeMode[keyof typeof ThemeMode];
export interface MaterialAppOptions extends Omit<WidgetsAppOptions, 'theme' | 'builder' | 'pageRouteBuilder'>, AppFocusOptions {
    readonly themeAnimationDuration?:number;
    readonly themeAnimationCurve?:Curve;
    readonly themeAnimationStyle?:AnimationStyle|null;
    readonly theme?: ThemeData | null;
    readonly darkTheme?: ThemeData | null;
    readonly highContrastTheme?: ThemeData | null;
    readonly highContrastDarkTheme?: ThemeData | null;
    readonly themeMode?: ThemeMode | null;
    readonly scrollBehavior?: ScrollBehavior | null;
    readonly builder?: (context: BuildContext, child: Widget) => Widget;
}
type RouterAppOptions<T> = Omit<MaterialAppOptions, 'child' | 'home' | 'routes' | 'initialRoute' | 'navigatorController' | 'navigatorRestorationId' | 'onGenerateRoute' | 'onUnknownRoute' | 'onGenerateInitialRoutes'> & {
    readonly routerConfig: RouterOptions<T>;
};
/** @internal Original _themeBuilder's selection order, without OS side effects. */
export function selectMaterialAppTheme(options: Pick<MaterialAppOptions, 'theme' | 'darkTheme' | 'highContrastTheme' | 'highContrastDarkTheme' | 'themeMode'>, brightness: 'light' | 'dark', highContrast: boolean): ThemeData {
    const mode = options.themeMode ?? ThemeMode.system, dark = mode === ThemeMode.dark || mode === ThemeMode.system && brightness === 'dark';
    invariant(Object.values(ThemeMode).includes(mode), 'invalid-theme-mode', 'Theme mode must be system, light or dark');
    return (dark && highContrast ? options.highContrastDarkTheme : null) ?? (dark ? options.darkTheme : null) ?? (highContrast ? options.highContrastTheme : null) ?? options.theme ?? ThemeData.light();
}
const defaultBehavior = Object.freeze(new MaterialScrollBehavior());
const palette = (theme: ThemeData): AppThemeData => ({
    background: theme.colorScheme.surface, surface: theme.colorScheme.surface, foreground: theme.colorScheme.onSurface, accent: theme.colorScheme.primary, onAccent: theme.colorScheme.onPrimary, radius: 12
});
function themed(data: ThemeData, colors: AppThemeData, child: Widget, options?:MaterialAppOptions): Widget {
    const content = new AppTheme(colors, new DefaultSelectionStyle({
        cursorColor: data.textSelectionTheme.cursorColor ?? data.colorScheme.primary, selectionColor: data.textSelectionTheme.selectionColor ?? ((data.colorScheme.primary & 0xffffff) | 0x66000000) >>> 0,
        child:new Builder(context=>new DefaultTextStyle(Theme.of(context).textTheme.bodyMedium!,child))
    }));
    return options && !options.themeAnimationStyle?.equals(AnimationStyle.noAnimation) ? new AnimatedTheme({data,child:content,duration:options.themeAnimationStyle?.duration??options.themeAnimationDuration??kThemeAnimationDuration,curve:options.themeAnimationStyle?.curve??options.themeAnimationCurve??Curves.linear}) : new Theme(data,content);
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
    constructor(child: Widget, theme?: AppThemeData | ThemeData, locale?: string, messages?: Readonly<Record<string, Readonly<Record<string, string>>>>, direction?: 'ltr' | 'rtl', scrollBehavior?: ScrollBehavior | null);
    constructor(first: Widget | MaterialAppOptions, theme: AppThemeData | ThemeData = darkAppTheme, locale = 'ko-KR', messages: Readonly<Record<string, Readonly<Record<string, string>>>> = {}, direction: 'ltr' | 'rtl' = 'ltr', scrollBehavior: ScrollBehavior | null = null) {
        super(first instanceof Widget ? null : first.key ?? null);
        this.options = first instanceof Widget ? null : Object.freeze({ ...first });
        this.theme = this.options ? this.options.theme ?? ThemeData.light() : theme;
        this.locale = this.options ? this.options.locale ?? 'ko-KR' : locale;
        this.messages = this.options?.messages ?? messages;
        this.direction = direction;
        this.scrollBehavior = this.options?.scrollBehavior ?? scrollBehavior;
        this.child = first instanceof Widget ? first : this.application(first);
    }
    static router<T>({ routerConfig, ...options }: RouterAppOptions<T>): MaterialApp {
        return new MaterialApp({ ...options, child: new Router(routerConfig) });
    }
    private application(options: MaterialAppOptions): Widget {
        const { key: _key, theme, darkTheme, highContrastTheme, highContrastDarkTheme, themeMode, themeAnimationDuration, themeAnimationCurve, themeAnimationStyle, scrollBehavior, builder, shortcuts, actions, ...app } = options;
        return new WidgetsApp({ ...app, supportedLocales:app.supportedLocales??['ko-KR'], pageRouteBuilder:(settings,builder)=>new MaterialPageRoute({settings:new RouteSettings({name:settings.name,arguments:settings.argumentsValue}),builder}), builder: (context, child) => {
                const data = selectMaterialAppTheme(options, MediaQuery.maybePlatformBrightnessOf(context) ?? 'light', MediaQuery.maybeHighContrastOf(context) ?? false), navigator = appNavigatorController(child);
                const content = new Builder(themedContext => {
                    const built = builder?.(themedContext, child) ?? child;
                    return new TapRegionSurface(navigator ? new HeroControllerScope({ navigator, child: built }) : built);
                });
                return new ScrollConfiguration({ behavior: scrollBehavior ?? defaultBehavior, child: themed(data, palette(data), new AppFocus(content, { ...(shortcuts ? { shortcuts } : {}), ...(actions ? { actions } : {}) }), options) });
            } });
    }
    build(): Widget {
        if (this.options)
            return this.child;
        const colors = this.theme instanceof ThemeData ? palette(this.theme) : this.theme;
        const data = this.theme instanceof ThemeData ? this.theme : new ThemeData({ colorScheme: new ColorScheme({
                brightness: colors.background === darkAppTheme.background ? 'dark' : 'light', primary: colors.accent, surface: colors.surface, onSurface: colors.foreground
            }), cupertinoOverrideTheme: new CupertinoThemeData({
                brightness: colors.background === darkAppTheme.background ? 'dark' : 'light', primaryColor: colors.accent, selectionHandleColor: colors.accent
            }) });
        return new ScrollConfiguration({ behavior: this.scrollBehavior ?? defaultBehavior, child: new Directionality(this.direction, new Localizations(this.locale, this.messages, 'en', themed(data, colors, new AppFocus(new MaterialAppOverlay(this.child))))) });
    }
}
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
        if (old.child !== this.widget.child)
            this.entry.markNeedsBuild();
    }
    build(): Widget {
        return new TapRegionSurface(new Overlay({ initialEntries: [this.entry] }));
    }
    override dispose(): void {
        this.entry.dispose();
        super.dispose();
    }
}
