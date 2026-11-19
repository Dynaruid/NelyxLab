// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
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
  readonly navigatorObservers?: readonly CupertinoTabNavigatorObserver[];
  readonly restorationScopeId?: string | null;
}

export class CupertinoTabView extends StatefulWidget {
  readonly builder: WidgetBuilder | null;
  readonly navigatorKey: GlobalKey<NavigatorState> | null;
  readonly defaultTitle: string | null;
  readonly routes: Readonly<Record<string, WidgetBuilder>> | null;
  readonly onGenerateRoute: RouteResolver | null;
  readonly onUnknownRoute: RouteResolver | null;
  readonly navigatorObservers: readonly CupertinoTabNavigatorObserver[];
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

  private readonly resolve: RouteResolver = (settings: RouteDescriptor) => {
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
    return onGenerateRoute?.(settings) ?? onUnknownRoute?.(settings) ?? null;
  };

  override initState(): void {
    super.initState();
    this.createNavigator();
  }

  private createNavigator(): void {
    const initial = this.resolve({ name: '/', argumentsValue: null });
    invariant(initial, 'missing-cupertino-tab-root', 'CupertinoTabView requires a route for /');
    this.initialRoute = initial;
    this.navigatorKey =
      this.widget.navigatorKey ?? new GlobalKey('CupertinoTabView navigator', NavigatorState);
    this.controller = new NavigatorController();
    this.updateObservers();
  }

  private updateObservers(): void {
    for (const remove of this.removeObservers) remove();
    this.removeObservers = [...new Set(this.widget.navigatorObservers)].map((observer) =>
      this.controller.observeTransitions(observer),
    );
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
