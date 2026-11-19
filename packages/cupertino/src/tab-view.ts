// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/tab_view.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { HeroControllerScope } from '@nelyx/core/framework/widgets/heroes';
import {
  Navigator,
  NavigatorController,
  NavigatorState,
} from '@nelyx/core/framework/widgets/navigation';
import type {
  Route,
  RouteDescriptor,
  NavigatorObserver,
  RouteResolver,
  RouteTransition,
} from '@nelyx/core/framework/widgets/navigation';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import { TickerMode } from '@nelyx/core/framework/widgets/ticker-mode';
import { CupertinoPageRoute } from './route.ts';

type WidgetBuilder = (context: BuildContext) => Widget;
export type CupertinoTabNavigatorObserver = (transition: RouteTransition) => void;
const noObservers: readonly CupertinoTabNavigatorObserver[] = Object.freeze([]);

export interface CupertinoTabViewOptions extends WidgetOptions {
  readonly builder?: WidgetBuilder | null;
  readonly navigatorKey?: GlobalKey<NavigatorState> | null;
  readonly defaultTitle?: string | null;
  readonly routes?: Readonly<Record<string, WidgetBuilder>> | null;
  readonly onGenerateRoute?: RouteResolver | null;
  readonly onUnknownRoute?: RouteResolver | null;
  readonly navigatorObservers?: readonly (CupertinoTabNavigatorObserver | NavigatorObserver)[];
  readonly restorationScopeId?: string | null;
}

export class CupertinoTabView extends StatefulWidget {
  readonly builder: WidgetBuilder | null;
  readonly navigatorKey: GlobalKey<NavigatorState> | null;
  readonly defaultTitle: string | null;
  readonly routes: Readonly<Record<string, WidgetBuilder>> | null;
  readonly onGenerateRoute: RouteResolver | null;
  readonly onUnknownRoute: RouteResolver | null;
  readonly navigatorObservers: readonly (CupertinoTabNavigatorObserver | NavigatorObserver)[];
  readonly restorationScopeId: string | null;

  constructor({
    builder = null,
    navigatorKey = null,
    defaultTitle = null,
    routes = null,
    onGenerateRoute = null,
    onUnknownRoute = null,
    navigatorObservers = noObservers,
    restorationScopeId = null,
    key = null,
  }: CupertinoTabViewOptions = {}) {
    super(key);
    invariant(
      builder === null || routes === null || !Object.hasOwn(routes, '/'),
      'conflicting-cupertino-tab-root',
      'CupertinoTabView builder and the routes table both define /',
    );
    this.builder = builder;
    this.navigatorKey = navigatorKey;
    this.defaultTitle = defaultTitle;
    this.routes = routes;
    this.onGenerateRoute = onGenerateRoute;
    this.onUnknownRoute = onUnknownRoute;
    this.navigatorObservers = navigatorObservers;
    this.restorationScopeId = restorationScopeId;
  }

  override createState(): State<CupertinoTabView> {
    return new CupertinoTabViewState();
  }
}

class CupertinoTabViewState extends State<CupertinoTabView> {
  private controller!: NavigatorController;
  private initialRoute!: Route;
  private navigatorKey!: GlobalKey<NavigatorState>;
  private readonly retired = new Set<NavigatorController>();
  private removeObservers: readonly (() => void)[] = [];

  private readonly resolve = (settings: RouteDescriptor): Route => {
    const { builder, defaultTitle, routes, onGenerateRoute, onUnknownRoute } = this.widget;
    const root = settings.name === '/' && builder !== null;
    const page = root
      ? builder
      : routes && Object.hasOwn(routes, settings.name)
        ? routes[settings.name]
        : null;
    if (page)
      return new CupertinoPageRoute({
        builder: page,
        title: root ? defaultTitle : null,
        settings: new RouteSettings({ name: settings.name, arguments: settings.argumentsValue }),
      });
    const generated = onGenerateRoute?.(settings);
    if (generated) return generated;
    invariant(
      onUnknownRoute,
      'unknown-named-route',
      `CupertinoTabView could not resolve "${settings.name}" with its builder, routes or onGenerateRoute. Supply onUnknownRoute to handle this route.`,
    );
    const fallback = onUnknownRoute(settings);
    invariant(
      fallback,
      'invalid-cupertino-tab-fallback',
      `CupertinoTabView.onUnknownRoute must return a Route for "${settings.name}".`,
    );
    return fallback;
  };

  override initState(): void {
    super.initState();
    this.createNavigator();
  }

  private createNavigator(): void {
    this.initialRoute = this.resolve({ name: '/', argumentsValue: null });
    this.navigatorKey =
      this.widget.navigatorKey ?? new GlobalKey('CupertinoTabView navigator', NavigatorState);
    this.controller = new NavigatorController();
    this.updateObservers();
  }

  private updateObservers(): void {
    for (const remove of this.removeObservers) remove();
    this.removeObservers = [...new Set(this.widget.navigatorObservers)]
      .filter(
        (observer): observer is CupertinoTabNavigatorObserver => typeof observer === 'function',
      )
      .map((observer) => this.controller.observeTransitions(observer));
  }

  override didUpdateWidget(old: CupertinoTabView): void {
    super.didUpdateWidget(old);
    if (old.navigatorKey !== this.widget.navigatorKey) {
      const oldController = this.controller;
      this.createNavigator();
      this.retired.add(oldController);
      (this.context as Element).owner.postFrame(() => {
        if (this.retired.delete(oldController)) oldController.dispose();
      });
    } else if (old.navigatorObservers !== this.widget.navigatorObservers) this.updateObservers();
  }

  override build(context: BuildContext): Widget {
    const restorationId = this.widget.restorationScopeId;
    return new HeroControllerScope({
      navigator: this.controller,
      child: new Navigator(this.controller, this.initialRoute, this.navigatorKey, {
        enabled: TickerMode.of(context),
        onGenerateRoute: this.resolve,
        observers: [...new Set(this.widget.navigatorObservers)].filter(
          (observer): observer is NavigatorObserver => typeof observer !== 'function',
        ),
        ...(restorationId === null ? {} : { restorationId }),
      }),
    });
  }

  override dispose(): void {
    for (const remove of this.removeObservers) remove();
    this.controller.dispose();
    for (const previous of this.retired) previous.dispose();
    this.retired.clear();
    super.dispose();
  }
}
