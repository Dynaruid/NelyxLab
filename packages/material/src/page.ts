// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/page.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Page, PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { PageOptions, PageRouteOptions } from '@nelyx/core/framework/widgets/pages';
import { Route } from '@nelyx/core/framework/widgets/navigation';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import type { DelegatedTransitionBuilder } from '@nelyx/core/framework/widgets/transitions';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { invariant } from '@nelyx/core/foundation/errors';
import { pageRouteTransitionBinding } from '@nelyx/core/internal/framework/widgets/page-route-gesture';
import { CupertinoPageTransitionsBuilder } from '@nelyx/cupertino/route';
import { ZoomPageTransitionsBuilder } from './page-transitions-theme.ts';
import { Theme } from './theme.ts';
const cupertinoDefault = new CupertinoPageTransitionsBuilder(),
  zoomDefault = new ZoomPageTransitionsBuilder();
export abstract class MaterialRouteTransitionMixin<T = unknown> extends PageRoute<T> {
  abstract buildContent(context: BuildContext): Widget;
  private pageTransitionBuilder() {
    const context = this.navigatorContext;
    invariant(
      context !== null,
      'uninstalled-material-route',
      'Material route duration requires its installed Navigator',
    );
    const data = Theme.of(context);
    return (
      data.pageTransitionsTheme.builders.get(data.platform) ??
      (['iOS', 'macOS'].includes(data.platform) ? cupertinoDefault : zoomDefault)
    );
  }
  override get transitionDuration(): number {
    return this.pageTransitionBuilder().transitionDuration;
  }
  override get reverseTransitionDuration(): number {
    return this.pageTransitionBuilder().reverseTransitionDuration;
  }
  // Push duration is read by the canonical owner immediately after policy attachment.
  override didPop(result: unknown): boolean {
    const binding = pageRouteTransitionBinding(this);
    if (binding) binding.animation.reverseDuration = this.reverseTransitionDuration;
    return super.didPop(result);
  }
  override get barrierColor() {
    return null;
  }
  override get barrierLabel() {
    return null;
  }
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  override get delegatedTransition(): DelegatedTransitionBuilder | null {
    return MaterialRouteTransitionMixin.delegate;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  private static delegate(
    context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    allowSnapshotting: boolean,
    child: Widget | null,
  ): Widget | null {
    const data = Theme.of(context);
    return (
      data.pageTransitionsTheme.delegatedTransition(data.platform)?.(
        context,
        animation,
        secondaryAnimation,
        allowSnapshotting,
        child,
      ) ?? null
    );
  }
  override canTransitionTo(next: Route): boolean {
    return (
      (!(next instanceof PageRoute) || !next.fullscreenDialog) &&
      (next instanceof MaterialRouteTransitionMixin ||
        (next instanceof PageRoute && next.delegatedTransition !== null))
    );
  }
  override canTransitionFrom(previous: Route): boolean {
    return previous instanceof PageRoute && !this.fullscreenDialog;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildPage(
    context: BuildContext,
    _animation: Animation<number>,
    _secondaryAnimation: Animation<number>,
  ): Widget {
    return new Semantics({
      scopesRoute: true,
      explicitChildNodes: true,
      child: this.buildContent(context),
    });
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions(
    context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return Theme.of(context).pageTransitionsTheme.buildTransitions(
      this,
      context,
      animation,
      secondaryAnimation,
      child,
    );
  }
}
export interface MaterialPageRouteOptions extends PageRouteOptions {
  readonly builder: (context: BuildContext) => Widget;
  readonly maintainState?: boolean;
}
export class MaterialPageRoute<T = unknown> extends MaterialRouteTransitionMixin<T> {
  override readonly builder: (context: BuildContext) => Widget;
  override readonly maintainState: boolean;
  constructor({ builder, maintainState = true, ...options }: MaterialPageRouteOptions) {
    super(options);
    this.builder = builder;
    this.maintainState = maintainState;
    invariant(this.opaque, 'nonopaque-material-route', 'MaterialPageRoute must be opaque');
  }
  override buildContent(context: BuildContext): Widget {
    return this.builder(context);
  }
  override get debugLabel(): string {
    return super.debugLabel + '(' + this.settings.name + ')';
  }
}

export interface MaterialPageOptions<T = unknown> extends PageOptions<T> {
  readonly child: Widget;
  readonly maintainState?: boolean;
  readonly fullscreenDialog?: boolean;
  readonly allowSnapshotting?: boolean;
}

export class MaterialPage<T = unknown> extends Page<T> {
  readonly child: Widget;
  readonly maintainState: boolean;
  readonly fullscreenDialog: boolean;
  readonly allowSnapshotting: boolean;

  constructor({
    child,
    maintainState = true,
    fullscreenDialog = false,
    allowSnapshotting = true,
    ...settings
  }: MaterialPageOptions<T>) {
    super(settings);
    this.child = child;
    this.maintainState = maintainState;
    this.fullscreenDialog = fullscreenDialog;
    this.allowSnapshotting = allowSnapshotting;
  }

  override createRoute(_context: BuildContext): PageRoute<T> {
    return new PageBasedMaterialRoute(this);
  }
}

class PageBasedMaterialRoute<T> extends MaterialRouteTransitionMixin<T> {
  constructor(page: MaterialPage<T>) {
    super({ settings: page, allowSnapshotting: page.allowSnapshotting });
  }

  private get page(): MaterialPage<T> {
    return this.settings as MaterialPage<T>;
  }

  override get fullscreenDialog(): boolean {
    return this.page.fullscreenDialog;
  }
  override get maintainState(): boolean {
    return this.page.maintainState;
  }
  override buildContent(): Widget {
    return this.page.child;
  }
  override get debugLabel(): string {
    return super.debugLabel + '(' + this.settings.name + ')';
  }
}
