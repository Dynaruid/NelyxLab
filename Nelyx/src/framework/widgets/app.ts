// SPDX-License-Identifier: BSD-3-Clause
// Application composition is per View; no process-global navigator, locale or restoration owner.
import { Element, InheritedWidget, StatefulWidget, State } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import {
  MediaQuery,
  Localizations,
  Directionality,
  AppTheme,
  darkAppTheme,
  lightAppTheme,
  mediaFromView,
} from './app-data.ts';
import type { AppThemeData, LocalizationResource, LocalizationsDelegate } from './app-data.ts';
import { NavigationNotification, Navigator, NavigatorController, Route } from './navigation.ts';
import type {
  NavigatorObserver,
  NavigatorState,
  RouteDescriptor,
  RouteResolver,
} from './navigation.ts';
import { NotificationListener } from './notification-listener.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import { RootRestorationScope } from './restoration.ts';
import type { RestorationManager } from '../../services/restoration.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import {
  Builder,
  Center,
  ColoredBox,
  Positioned,
  SizedBox,
  Stack,
  Text,
  Transform,
} from './basic.ts';
import { GlobalKey } from './global-key.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { ExcludeSemantics } from './semantics.ts';
import { ShortcutRegistrar } from './shortcuts.ts';
import { TextStyle } from '../painting/text-style.ts';
import { FontWeight } from '../../ui/typography.ts';

import { localeFromTag, resolveAppLocale } from './app-locales.ts';
export {
  resolveLocale,
  resolveAppLocale,
  localeDirection,
  canonicalLocaleTag,
} from './app-locales.ts';
export type { LocaleListResolutionCallback, LocaleResolutionCallback } from './app-locales.ts';
import type { LocaleListResolutionCallback, LocaleResolutionCallback } from './app-locales.ts';
import { localeDirection } from './app-locales.ts';
import { defaultGenerateInitialRoutes } from './app-routes.ts';
export { defaultGenerateInitialRoutes } from './app-routes.ts';
import { Router, NavigatorRouterDelegate } from './router.ts';
import type { RouterOptions } from './router.ts';
import { AppDiagnostics } from './app-diagnostics.ts';
import type { InspectorButtonBuilder } from './app-diagnostics.ts';
export type { InspectorButtonBuilder, InspectorButtonOptions } from './app-diagnostics.ts';

export interface WidgetsAppOptions extends WidgetOptions {
  readonly title?: string;
  readonly onGenerateTitle?: (context: BuildContext) => string;
  /** Design package route factory over the existing Core Navigator and JSON route settings. */
  readonly pageRouteBuilder?: (
    settings: RouteDescriptor,
    builder: (context: BuildContext) => Widget,
  ) => Route;
  readonly home?: Widget;
  readonly child?: Widget;
  readonly navigatorController?: NavigatorController;
  readonly navigatorKey?: GlobalKey<NavigatorState> | null;
  readonly navigatorObservers?: readonly NavigatorObserver[];
  readonly onNavigationNotification?: ((notification: NavigationNotification) => boolean) | null;
  readonly debugShowCheckedModeBanner?: boolean;
  readonly debugShowWidgetInspector?: boolean;
  readonly showPerformanceOverlay?: boolean;
  readonly showSemanticsDebugger?: boolean;
  readonly inspectorButtonBuilder?: InspectorButtonBuilder;
  readonly initialRoute?: Route | string;
  readonly routes?: Readonly<Record<string, (context: BuildContext) => Widget>>;
  readonly onUnknownRoute?: RouteResolver;
  readonly onGenerateInitialRoutes?: (name: string) => readonly Route[];
  readonly locale?: string;
  readonly supportedLocales?: readonly string[];
  readonly messages?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly localizationsDelegates?: readonly LocalizationsDelegate[];
  readonly theme?: AppThemeData;
  readonly builder?: (context: BuildContext, child: Widget) => Widget;
  readonly restorationScopeId?: string;
  readonly restorationManager?: RestorationManager;
  readonly navigatorRestorationId?: string;
  readonly onGenerateRoute?: RouteResolver;
  readonly localeListResolutionCallback?: LocaleListResolutionCallback;
  readonly localeResolutionCallback?: LocaleResolutionCallback;
}

export interface TitleOptions extends WidgetOptions {
  readonly title: string;
  readonly child: Widget;
}

/** Supplies an application title to descendants within this View. */
export class Title extends InheritedWidget {
  readonly title: string;

  constructor({ title, child, key = null }: TitleOptions) {
    super(child, key);
    this.title = title;
  }

  static maybeOf(context: BuildContext): string | null {
    return context.maybeDependOn(Title)?.title ?? null;
  }

  override updateShouldNotify(old: this): boolean {
    return this.title !== old.title;
  }
}

export class WidgetsApp extends StatefulWidget {
  constructor(readonly options: WidgetsAppOptions) {
    super(options.key ?? null);
    const routed = !!(
      options.home ||
      options.initialRoute ||
      options.routes ||
      options.onGenerateRoute
    );
    invariant(
      !!options.child !== routed,
      'invalid-app-content',
      'Choose child or home/routes/initialRoute',
    );
    invariant(
      !(options.home && options.routes && Object.hasOwn(options.routes, '/')),
      'duplicate-home-route',
      'home and routes[/] cannot both be provided',
    );
    invariant(
      options.child === undefined || options.navigatorRestorationId === undefined,
      'invalid-app-restoration',
      'A custom child owns its own Navigator restoration',
    );
  }
  static router<T>({
    routerConfig,
    ...options
  }: Omit<
    WidgetsAppOptions,
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
  > & { readonly routerConfig: RouterOptions<T> }): WidgetsApp {
    return new WidgetsApp({ ...options, child: new Router(routerConfig) });
  }
  createState(): State {
    return new WidgetsAppState();
  }
}
/** The App builder receives the actual routing Widget, preserving controller identity. */
export function appNavigatorController(child: Widget): NavigatorController | null {
  return child instanceof Navigator
    ? child.controller
    : child instanceof Router && child.options.routerDelegate instanceof NavigatorRouterDelegate
      ? child.options.routerDelegate.navigator
      : null;
}
const noLocalizationDelegates: readonly LocalizationsDelegate[] = Object.freeze([]);
type LoadedLocalizations = {
  readonly locale: string;
  readonly resources: ReadonlyMap<LocalizationResource, object>;
};

// CheckedModeBanner from widgets/banner.dart at Flutter
// 71e4717a61786faab4c7aa39825989305ed29e8a, Copyright 2014 The Flutter Authors.
const debugBannerLabel = new Text('DEBUG', {
  style: new TextStyle({
    inherit: false,
    fontSize: 10,
    fontWeight: FontWeight.w900,
    color: 0xffffffff,
  }),
  textScale: 1,
  maxLines: 1,
});
const debugBannerBackground = new ColoredBox({
  color: 0xa0b71c1c,
  child: new Center(debugBannerLabel),
});

function checkedModeBanner(direction: 'ltr' | 'rtl'): Widget {
  const rtl = direction === 'rtl';
  return new Positioned(
    new ExcludeSemantics(
      new IgnorePointer(Transform.rotate(debugBannerBackground, rtl ? -Math.PI / 4 : Math.PI / 4)),
    ),
    { top: 18, ...(rtl ? { left: -23 } : { right: -23 }), width: 100, height: 12 },
  );
}

class WidgetsAppState extends State<WidgetsApp> {
  private readonly contentKey = new GlobalKey();
  // Resizing updates MediaQuery, without publishing a new localization catalog.
  private readonly emptyMessages = Object.freeze({});
  private readonly navigatorKeys = new WeakMap<NavigatorController, GlobalKey>();
  private keyFor(controller: NavigatorController): GlobalKey {
    let key = this.navigatorKeys.get(controller);
    if (!key) this.navigatorKeys.set(controller, (key = new GlobalKey()));
    return key;
  }
  private ownedNavigator: NavigatorController | undefined;
  private readonly retiredNavigators = new Set<NavigatorController>();
  private observer: Disposable | undefined;
  private requestedLocale: string | null = null;
  private localizationsWidget: WidgetsApp | null = null;
  private requestedDelegates: readonly LocalizationsDelegate[] = noLocalizationDelegates;
  private localizationRevision = 0;
  private loadedLocalizations: LoadedLocalizations | null = null;
  private readonly entry = new OverlayEntry({ builder: (context) => this.content(context) });
  // The entry owns content invalidation. Metrics rebuild the ambient media, but
  // must not recreate the unchanged Overlay and rebuild every entry as a side effect.
  private overlay = new Overlay({ initialEntries: [this.entry] });
  override initState(): void {
    this.observer = this.context.services.platformServices?.addObserver({
      didChangeEnvironment: () => {
        if (this.mounted) this.setState(() => {});
      },
    });
  }
  private route: RouteResolver = (settings) => {
    const o = this.widget.options,
      builder =
        settings.name === '/' && o.home
          ? () => this.widget.options.home!
          : o.routes && Object.hasOwn(o.routes, settings.name)
            ? o.routes[settings.name]
            : undefined;
    return builder
      ? (o.pageRouteBuilder?.(settings, builder) ??
          new Route(builder, settings.name, settings.argumentsValue))
      : (o.onGenerateRoute?.(settings) ?? null);
  };
  private requiredRoute: RouteResolver = (settings) => {
    const route = this.route(settings) ?? this.widget.options.onUnknownRoute?.(settings);
    invariant(route, 'unknown-app-route', 'No route for ' + settings.name);
    return route;
  };
  private content(context: BuildContext): Widget {
    const o = this.widget.options;
    let child = o.child;
    if (!child) {
      const controller =
        o.navigatorController ?? (this.ownedNavigator ??= new NavigatorController());
      if (!controller.routes.length) {
        const initial =
          o.initialRoute instanceof Route
            ? [o.initialRoute]
            : (o.onGenerateInitialRoutes?.(o.initialRoute ?? '/') ??
              defaultGenerateInitialRoutes(o.initialRoute ?? '/', this.route, this.requiredRoute));
        invariant(
          initial.length > 0 && initial.length <= 32,
          'invalid-route-stack',
          'Initial routes require 1..32 entries',
        );
        controller.replaceStack(initial);
      }
      child = new Navigator(
        controller,
        controller.routes.length
          ? new Route(
              controller.routes[0]!.builder,
              controller.routes[0]!.name,
              controller.routes[0]!.argumentsValue,
            )
          : this.requiredRoute({ name: '/', argumentsValue: null })!,
        o.navigatorKey ?? this.keyFor(controller),
        {
          ...(o.navigatorRestorationId !== undefined
            ? { restorationId: o.navigatorRestorationId }
            : {}),
          onGenerateRoute: this.requiredRoute,
          ...(o.navigatorObservers ? { observers: o.navigatorObservers } : {}),
        },
      );
    }
    const content = o.builder?.(context, child) ?? child;
    return o.onNavigationNotification
      ? new NotificationListener({
          child: content,
          notificationType: NavigationNotification,
          onNotification: o.onNavigationNotification,
        })
      : content;
  }
  override didUpdateWidget(old: WidgetsApp): void {
    const previous = old.options,
      options = this.widget.options,
      keyChanged = (previous.navigatorKey ?? null) !== (options.navigatorKey ?? null),
      controllerChanged = previous.navigatorController !== options.navigatorController;
    invariant(
      !keyChanged || !options.navigatorController || controllerChanged,
      'navigator-key-change',
      'Changing a Navigator key requires an unused supplied NavigatorController',
    );
    invariant(
      !controllerChanged || keyChanged || !options.navigatorKey,
      'navigator-controller-change',
      'Changing a supplied NavigatorController requires a new Navigator key',
    );
    const owned = this.ownedNavigator;
    if (keyChanged && owned && this.context instanceof Element) {
      this.ownedNavigator = undefined;
      this.retiredNavigators.add(owned);
      this.context.owner.postFrame(() => {
        if (this.retiredNavigators.delete(owned)) owned.dispose();
      });
    }
    this.overlay = new Overlay({ initialEntries: [this.entry] });
  }
  private updateLocalizations(locale: string, delegates: readonly LocalizationsDelegate[]): void {
    const previous = this.requestedDelegates;
    if (this.requestedLocale === locale && this.localizationsWidget === this.widget) return;
    this.localizationsWidget = this.widget;
    if (
      this.requestedLocale === locale &&
      previous.length === delegates.length &&
      delegates.every((delegate, index) => {
        const old = previous[index]!;
        return (
          delegate.constructor === old.constructor &&
          delegate.type === old.type &&
          !delegate.shouldReload(old)
        );
      })
    )
      return;
    this.requestedLocale = locale;
    this.requestedDelegates = [...delegates];
    const revision = ++this.localizationRevision;
    const sourceLocale = localeFromTag(locale);
    const selected = new Set<LocalizationResource>();
    const resources = new Map<LocalizationResource, object>();
    const pending: Promise<void>[] = [];
    const report = (exception: unknown): void => {
      const details = new FlutterErrorDetails({ exception, library: 'widgets localizations' });
      const handler = this.context.services.reportError;
      if (handler) handler(details);
      else FlutterError.reportError(details);
    };
    for (const delegate of delegates) {
      if (selected.has(delegate.type) || !delegate.isSupported(sourceLocale)) continue;
      selected.add(delegate.type);
      try {
        const loaded = delegate.load(sourceLocale);
        if ('then' in loaded && typeof loaded.then === 'function') {
          pending.push(
            Promise.resolve(loaded).then((value) => {
              resources.set(delegate.type, value);
            }),
          );
        } else {
          resources.set(delegate.type, loaded);
        }
      } catch (exception) {
        report(exception);
      }
    }
    if (pending.length === 0) {
      this.loadedLocalizations = { locale, resources };
      return;
    }
    void Promise.allSettled(pending).then((results) => {
      if (!this.mounted || this.localizationRevision !== revision) return;
      for (const result of results) if (result.status === 'rejected') report(result.reason);
      if (this.mounted && this.localizationRevision === revision)
        this.setState(() => {
          this.loadedLocalizations = { locale, resources };
        });
    });
  }
  build(): Widget {
    const o = this.widget.options,
      services = this.context.services.platformServices,
      supported = o.supportedLocales ?? ['en'],
      locale = resolveAppLocale(
        o.locale ? [o.locale] : (services?.environment?.locales ?? null),
        supported,
        o.localeListResolutionCallback,
        o.localeResolutionCallback,
      ),
      theme =
        o.theme ?? (services?.environment?.brightness === 'light' ? lightAppTheme : darkAppTheme);
    this.updateLocalizations(locale, o.localizationsDelegates ?? noLocalizationDelegates);
    const localized = this.loadedLocalizations;
    if (localized === null)
      return new MediaQuery(mediaFromView(this.context), new AppTheme(theme, new SizedBox()));
    const direction = localeDirection(localized.locale);
    const showBanner =
      o.debugShowCheckedModeBanner !== false && this.context.services.defaultFont !== undefined;
    const child = new Builder((context) => {
      let content: Widget = new ShortcutRegistrar(this.overlay, this.contentKey);
      const inspect = FoundationBuildMode.debug && o.debugShowWidgetInspector === true;
      if (inspect || o.showPerformanceOverlay || o.showSemanticsDebugger)
        content = new AppDiagnostics(content, {
          inspect,
          performance: o.showPerformanceOverlay ?? false,
          semantics: o.showSemanticsDebugger ?? false,
          ...(o.inspectorButtonBuilder ? { inspectorButtonBuilder: o.inspectorButtonBuilder } : {}),
        });
      const titled = new Title({
        title: o.onGenerateTitle?.(context) ?? o.title ?? '',
        child: FoundationBuildMode.debug
          ? new Stack(showBanner ? [content, checkedModeBanner(direction)] : [content], {
              fit: 'passthrough',
              clipBehavior: 'hardEdge',
            })
          : content,
      });
      return o.restorationScopeId === undefined
        ? titled
        : new RootRestorationScope({
            restorationId: o.restorationScopeId,
            child: titled,
            ...(o.restorationManager ? { manager: o.restorationManager } : {}),
          });
    });
    return new MediaQuery(
      mediaFromView(this.context),
      new AppTheme(
        theme,
        new Localizations(
          localized.locale,
          o.messages ?? this.emptyMessages,
          supported[0]!,
          new Directionality(direction, child),
          localized.resources,
        ),
      ),
    );
  }
  override dispose(): void {
    this.localizationRevision++;
    this.observer?.dispose();
    this.entry.dispose();
    this.ownedNavigator?.dispose();
    for (const navigator of this.retiredNavigators) navigator.dispose();
    this.retiredNavigators.clear();
    super.dispose();
  }
}
