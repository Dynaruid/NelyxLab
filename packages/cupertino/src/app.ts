// SPDX-License-Identifier: BSD-3-Clause
// Functional Cupertino application composition on Nelyx WidgetsApp contracts.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { WidgetsApp, appNavigatorController } from '@nelyx/core/framework/widgets/app';
import type { WidgetsAppOptions } from '@nelyx/core/framework/widgets/app';
import { AppFocus } from '@nelyx/core/framework/widgets/app-focus';
import type { AppFocusOptions } from '@nelyx/core/framework/widgets/app-focus';
import { Builder } from '@nelyx/core/framework/widgets/basic';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import type { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { DefaultSelectionStyle } from '@nelyx/core/framework/widgets/default-selection-style';
import { TapRegionSurface } from '@nelyx/core/framework/widgets/tap-region';
import { Router } from '@nelyx/core/framework/widgets/router';
import type { RouterOptions } from '@nelyx/core/framework/widgets/router';
import { HeroControllerScope } from '@nelyx/core/framework/widgets/heroes';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { CupertinoPageRoute } from './route.ts';
import { CupertinoTheme, CupertinoThemeData } from './theme.ts';
import { CupertinoScrollBehavior } from './scroll-behavior.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
export interface CupertinoAppOptions
  extends Omit<WidgetsAppOptions, 'theme' | 'builder' | 'pageRouteBuilder'>, AppFocusOptions {
  readonly theme?: CupertinoThemeData | null;
  readonly scrollBehavior?: ScrollBehavior | null;
  readonly builder?: (context: BuildContext, child: Widget) => Widget;
}
const defaultBehavior = Object.freeze(new CupertinoScrollBehavior());
/** Route/controller/locale/restoration APIs follow shared WidgetsApp. */
export class CupertinoApp extends StatelessWidget {
  constructor(readonly options: CupertinoAppOptions) {
    super(options.key ?? null);
  }
  static router<T>({
    routerConfig,
    ...options
  }: Omit<
    CupertinoAppOptions,
    | 'child'
    | 'home'
    | 'routes'
    | 'initialRoute'
    | 'navigatorController'
    | 'navigatorRestorationId'
    | 'onGenerateRoute'
    | 'onUnknownRoute'
    | 'onGenerateInitialRoutes'
  > & {
    readonly routerConfig: RouterOptions<T>;
  }): CupertinoApp {
    return new CupertinoApp({ ...options, child: new Router(routerConfig) });
  }
  build(): Widget {
    const { key: _key, theme, scrollBehavior, builder, shortcuts, actions, ...app } = this.options;
    return new WidgetsApp({
      ...app,
      pageRouteBuilder: (settings, builder) =>
        new CupertinoPageRoute({
          settings: new RouteSettings({ name: settings.name, arguments: settings.argumentsValue }),
          builder,
        }),
      builder: (_context, child) =>
        new ScrollConfiguration({
          behavior: scrollBehavior ?? defaultBehavior,
          child: new CupertinoUserInterfaceLevel({
            data: CupertinoUserInterfaceLevelData.base,
            child: new CupertinoTheme(
              theme ?? new CupertinoThemeData(),
              new Builder((context) => {
                const data = CupertinoTheme.of(context),
                  content = builder?.(context, child) ?? child;
                const navigator = appNavigatorController(child),
                  routed = navigator
                    ? new HeroControllerScope({ navigator, child: content })
                    : content;
                return new AppTheme(
                  {
                    background: data.scaffoldBackgroundColor,
                    surface: data.barBackgroundColor,
                    foreground: data.textTheme.textStyle.color ?? 0xff000000,
                    accent: data.primaryColor,
                    onAccent: data.primaryContrastingColor,
                    radius: 10,
                  },
                  new DefaultTextStyle(
                    data.textTheme.textStyle,
                    new DefaultSelectionStyle({
                      cursorColor: data.primaryColor,
                      selectionColor: ((data.primaryColor & 0xffffff) | 0x33000000) >>> 0,
                      child: new AppFocus(new TapRegionSurface(routed), {
                        ...(shortcuts ? { shortcuts } : {}),
                        ...(actions ? { actions } : {}),
                      }),
                    }),
                  ),
                );
              }),
            ),
          }),
        }),
    });
  }
}
