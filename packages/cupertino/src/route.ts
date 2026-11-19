// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/route.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Tween } from '@nelyx/core/framework/animation/tween';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import {
  SpringDescription,
  SpringSimulation,
} from '@nelyx/core/framework/physics/spring-simulation';
import { Tolerance } from '@nelyx/core/framework/physics/tolerance';
import { Offset } from '@nelyx/core/ui/offset';
import type { ImageFilter } from '@nelyx/core/ui/image-filter';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import {
  SlideTransition,
  DecoratedBoxTransition,
  FadeTransition,
  ScaleTransition,
} from '@nelyx/core/framework/widgets/transitions';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { cupertinoEdgeShadowTween } from './internal/route/edge-shadow.ts';
import { Page, PageRoute, PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import type {
  PageOptions,
  PageRouteOptions,
  RouteSettings,
  RouteTransitionsBuilder,
} from '@nelyx/core/framework/widgets/pages';
import { Navigator, Route } from '@nelyx/core/framework/widgets/navigation';
import { Align, Builder } from '@nelyx/core/framework/widgets/basic';
import { FractionalTranslation } from '@nelyx/core/framework/widgets/fractional-translation';
import { TraversalEdgeBehavior } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import { PageTransitionsBuilder } from '@nelyx/core/framework/widgets/page-transitions-builder';
import type { DelegatedTransitionBuilder } from '@nelyx/core/framework/widgets/transitions';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoDynamicColor } from './colors.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { coreCupertinoColor, resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
import {
  CupertinoBackGestureDetector,
  startCupertinoBackGesture,
} from './internal/route/back-gesture.ts';

const rightMiddleTween = new Tween<Offset>({ begin: new Offset(1, 0), end: Offset.zero });
const middleLeftTween = new Tween<Offset>({ begin: Offset.zero, end: new Offset(-1 / 3, 0) });
const bottomUpTween = new Tween<Offset>({ begin: new Offset(0, 1), end: Offset.zero });
const popupSpring = new SpringDescription({ mass: 1, stiffness: 522.35, damping: 45.7099552 });
const popupTolerance = new Tolerance({ velocity: 0.03 });

export const kCupertinoModalBarrierColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0x33000000),
  darkColor: new Color(0x7a000000),
});

export interface CupertinoModalPopupRouteOptions {
  readonly builder: (context: BuildContext) => Widget;
  readonly barrierLabel?: string;
  readonly barrierColor?: CupertinoColor | null;
  readonly barrierDismissible?: boolean;
  readonly semanticsDismissible?: boolean;
  readonly filter?: ImageFilter | null;
  readonly settings?: RouteSettings | null;
  readonly requestFocus?: boolean | null;
  readonly anchorPoint?: Offset | null;
}

export class CupertinoModalPopupRoute<T = unknown> extends PageRouteBuilder<T> {
  readonly builder: CupertinoModalPopupRouteOptions['builder'];
  readonly anchorPoint: Offset | null;
  declare readonly semanticsDismissible: boolean;

  constructor({
    builder,
    barrierLabel = 'Dismiss',
    barrierColor = kCupertinoModalBarrierColor,
    barrierDismissible = true,
    semanticsDismissible = false,
    filter = null,
    settings = null,
    requestFocus = null,
    anchorPoint = null,
  }: CupertinoModalPopupRouteOptions) {
    super({
      settings,
      requestFocus,
      barrierLabel,
      barrierColor: barrierColor === null ? null : coreCupertinoColor(barrierColor),
      barrierDismissible,
      semanticsDismissible,
      barrierFilter: filter,
      opaque: false,
      fullscreenDialog: true,
      traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
      transitionDuration: 335,
      reverseTransitionDuration: 335,
      pageBuilder: () =>
        new CupertinoUserInterfaceLevel({
          data: CupertinoUserInterfaceLevelData.elevated,
          child: new DisplayFeatureSubScreen({ anchorPoint, child: new Builder(builder) }),
        }),
      transitionsBuilder: (_context, animation, _secondary, child) =>
        new Align(
          new FractionalTranslation(child, {
            translation: bottomUpTween.transform(animation.value),
          }),
          { alignment: Alignment.bottomCenter },
        ),
    });
    this.builder = builder;
    this.anchorPoint = anchorPoint;
  }

  get filter(): ImageFilter | null {
    return this.barrierFilter;
  }

  override createSimulation({ forward }: { readonly forward: boolean }): SpringSimulation {
    return new SpringSimulation(
      popupSpring,
      this.animation?.value ?? (forward ? 0 : 1),
      forward ? 1 : 0,
      0,
      { tolerance: popupTolerance, snapToEnd: true },
    );
  }
}

export interface ShowCupertinoModalPopupOptions extends Omit<
  CupertinoModalPopupRouteOptions,
  'settings'
> {
  readonly useRootNavigator?: boolean;
  readonly routeSettings?: RouteSettings | null;
}

export function showCupertinoModalPopup<T = unknown>(
  context: BuildContext,
  {
    barrierColor = kCupertinoModalBarrierColor,
    useRootNavigator = true,
    routeSettings = null,
    ...options
  }: ShowCupertinoModalPopupOptions,
): Promise<T | undefined> {
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  return navigator.push(
    new CupertinoModalPopupRoute<T>({
      ...options,
      barrierColor: barrierColor === null ? null : resolveCupertinoColor(barrierColor, context),
      settings: routeSettings,
    }),
  );
}

const dialogScale = new Tween<number>({ begin: 1.3, end: 1 });

export interface CupertinoDialogRouteOptions {
  readonly context: BuildContext;
  readonly builder: (context: BuildContext) => Widget;
  readonly barrierDismissible?: boolean;
  readonly barrierColor?: CupertinoColor | null;
  readonly barrierLabel?: string | null;
  readonly transitionDuration?: number;
  readonly transitionBuilder?: RouteTransitionsBuilder | null;
  readonly settings?: RouteSettings | null;
  readonly requestFocus?: boolean | null;
  readonly anchorPoint?: Offset | null;
}

export class CupertinoDialogRoute<T = unknown> extends PageRouteBuilder<T> {
  transitionBuilder: RouteTransitionsBuilder | null;
  readonly anchorPoint: Offset | null;

  constructor({
    builder,
    context,
    barrierDismissible = true,
    barrierColor,
    barrierLabel,
    transitionDuration = 250,
    transitionBuilder = null,
    settings = null,
    requestFocus = null,
    anchorPoint = null,
  }: CupertinoDialogRouteOptions) {
    super({
      settings,
      opaque: false,
      barrierDismissible,
      barrierColor: resolveCupertinoColor(barrierColor ?? kCupertinoModalBarrierColor, context),
      barrierLabel: barrierLabel ?? CupertinoLocalizations.of(context).modalBarrierDismissLabel,
      requestFocus,
      traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
      transitionDuration,
      reverseTransitionDuration: transitionDuration,
      pageBuilder: () =>
        new Semantics({
          scopesRoute: true,
          explicitChildNodes: true,
          child: new DisplayFeatureSubScreen({ anchorPoint, child: new Builder(builder) }),
        }),
    });
    this.transitionBuilder = transitionBuilder;
    this.anchorPoint = anchorPoint;
  }

  override createSimulation({ forward }: { readonly forward: boolean }): SpringSimulation {
    return new SpringSimulation(
      popupSpring,
      this.animation?.value ?? (forward ? 0 : 1),
      forward ? 1 : 0,
      0,
      { tolerance: popupTolerance, snapToEnd: true },
    );
  }
  override buildTransitions(
    context: BuildContext,
    animation: Animation<number>,
    secondary: Animation<number>,
    child: Widget,
  ): Widget {
    if (this.transitionBuilder) return this.transitionBuilder(context, animation, secondary, child);
    return new FadeTransition({
      opacity: animation,
      child:
        animation.status === AnimationStatus.reverse
          ? child
          : new ScaleTransition({
              scale: animation.drive(dialogScale),
              child,
            }),
    });
  }
}

export interface ShowCupertinoDialogOptions extends Omit<
  CupertinoDialogRouteOptions,
  'context' | 'settings' | 'transitionDuration' | 'transitionBuilder'
> {
  readonly useRootNavigator?: boolean;
  readonly routeSettings?: RouteSettings | null;
}

export function showCupertinoDialog<T = unknown>(
  context: BuildContext,
  {
    barrierDismissible = false,
    useRootNavigator = true,
    routeSettings = null,
    ...options
  }: ShowCupertinoDialogOptions,
): Promise<T | undefined> {
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  return navigator.push(
    new CupertinoDialogRoute<T>({
      ...options,
      barrierDismissible,
      context,
      settings: routeSettings,
    }),
  );
}
// These built-in transition widgets already listen to both animations. Keep one
// per route/child so the outer transition builder does not rebuild their static
// gesture and semantic descendants on every animation tick.
const builtTransitions = new WeakMap<
  object,
  {
    animation: Animation<number>;
    secondaryAnimation: Animation<number>;
    child: Widget;
    linearTransition: boolean;
    fullscreenDialog: boolean;
    widget: Widget;
  }
>();
export interface CupertinoPageTransitionOptions extends WidgetOptions {
  /** @dartType Animation<double> */
  readonly primaryRouteAnimation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
}
export class CupertinoPageTransition extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly primaryRouteAnimation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  /** @dartParam primaryRouteAnimation Animation<double>
   * @dartParam secondaryRouteAnimation Animation<double> */
  constructor({
    key = null,
    primaryRouteAnimation,
    secondaryRouteAnimation,
    child,
    linearTransition,
  }: CupertinoPageTransitionOptions) {
    super(key);
    this.primaryRouteAnimation = primaryRouteAnimation;
    this.secondaryRouteAnimation = secondaryRouteAnimation;
    this.child = child;
    this.linearTransition = linearTransition;
  }
  /** @dartParam _animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  static delegatedTransition(
    context: BuildContext,
    _animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    _allowSnapshotting: boolean,
    child: Widget | null,
  ): Widget | null {
    const animation = new CurvedAnimation({
      parent: secondaryAnimation,
      curve: Curves.linearToEaseOut,
      reverseCurve: Curves.easeInToLinear,
    });
    const position = middleLeftTween.animate(animation);
    animation.dispose();
    return new SlideTransition({
      position,
      textDirection: Directionality.of(context),
      transformHitTests: false,
      child,
    });
  }
  createState(): State {
    return new CupertinoPageTransitionState();
  }
}
class CupertinoPageTransitionState extends State<CupertinoPageTransition> {
  private primaryPosition!: Animation<Offset>;
  private secondaryPosition!: Animation<Offset>;
  private primaryShadow!: Animation<Decoration>;
  private primaryCurve: CurvedAnimation | null = null;
  private secondaryCurve: CurvedAnimation | null = null;
  private shadowCurve: CurvedAnimation | null = null;
  override initState(): void {
    super.initState();
    this.setupAnimations();
  }
  override didUpdateWidget(old: CupertinoPageTransition): void {
    super.didUpdateWidget(old);
    if (
      old.primaryRouteAnimation !== this.widget.primaryRouteAnimation ||
      old.secondaryRouteAnimation !== this.widget.secondaryRouteAnimation ||
      old.linearTransition !== this.widget.linearTransition
    ) {
      this.disposeCurves();
      this.setupAnimations();
    }
  }
  private disposeCurves(): void {
    this.primaryCurve?.dispose();
    this.secondaryCurve?.dispose();
    this.shadowCurve?.dispose();
    this.primaryCurve = null;
    this.secondaryCurve = null;
    this.shadowCurve = null;
  }
  private setupAnimations(): void {
    if (!this.widget.linearTransition) {
      this.primaryCurve = new CurvedAnimation({
        parent: this.widget.primaryRouteAnimation,
        curve: Curves.fastEaseInToSlowEaseOut,
        reverseCurve: Curves.fastEaseInToSlowEaseOut.flipped,
      });
      this.secondaryCurve = new CurvedAnimation({
        parent: this.widget.secondaryRouteAnimation,
        curve: Curves.linearToEaseOut,
        reverseCurve: Curves.easeInToLinear,
      });
      this.shadowCurve = new CurvedAnimation({
        parent: this.widget.primaryRouteAnimation,
        curve: Curves.linearToEaseOut,
      });
    }
    this.primaryPosition = rightMiddleTween.animate(
      this.primaryCurve ?? this.widget.primaryRouteAnimation,
    );
    this.secondaryPosition = middleLeftTween.animate(
      this.secondaryCurve ?? this.widget.secondaryRouteAnimation,
    );
    this.primaryShadow = cupertinoEdgeShadowTween.animate(
      this.shadowCurve ?? this.widget.primaryRouteAnimation,
    );
  }
  override dispose(): void {
    this.disposeCurves();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const direction = Directionality.of(context);
    return new SlideTransition({
      position: this.secondaryPosition,
      textDirection: direction,
      transformHitTests: false,
      child: new SlideTransition({
        position: this.primaryPosition,
        textDirection: direction,
        child: new DecoratedBoxTransition({
          decoration: this.primaryShadow,
          child: this.widget.child,
        }),
      }),
    });
  }
}
export interface CupertinoFullscreenDialogTransitionOptions extends CupertinoPageTransitionOptions {}
export class CupertinoFullscreenDialogTransition extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly primaryRouteAnimation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  /** @dartParam primaryRouteAnimation Animation<double>
   * @dartParam secondaryRouteAnimation Animation<double> */
  constructor({
    key = null,
    primaryRouteAnimation,
    secondaryRouteAnimation,
    child,
    linearTransition,
  }: CupertinoFullscreenDialogTransitionOptions) {
    super(key);
    this.primaryRouteAnimation = primaryRouteAnimation;
    this.secondaryRouteAnimation = secondaryRouteAnimation;
    this.child = child;
    this.linearTransition = linearTransition;
  }
  createState(): State {
    return new CupertinoFullscreenDialogTransitionState();
  }
}
class CupertinoFullscreenDialogTransitionState extends State<CupertinoFullscreenDialogTransition> {
  private primaryPosition!: Animation<Offset>;
  private secondaryPosition!: Animation<Offset>;
  private primaryCurve: CurvedAnimation | null = null;
  private secondaryCurve: CurvedAnimation | null = null;
  override initState(): void {
    super.initState();
    this.setupAnimations();
  }
  override didUpdateWidget(old: CupertinoFullscreenDialogTransition): void {
    super.didUpdateWidget(old);
    if (
      old.primaryRouteAnimation !== this.widget.primaryRouteAnimation ||
      old.secondaryRouteAnimation !== this.widget.secondaryRouteAnimation ||
      old.linearTransition !== this.widget.linearTransition
    ) {
      this.disposeCurves();
      this.setupAnimations();
    }
  }
  private disposeCurves(): void {
    this.primaryCurve?.dispose();
    this.secondaryCurve?.dispose();
    this.primaryCurve = null;
    this.secondaryCurve = null;
  }
  private setupAnimations(): void {
    this.primaryCurve = new CurvedAnimation({
      parent: this.widget.primaryRouteAnimation,
      curve: Curves.linearToEaseOut,
      reverseCurve: Curves.linearToEaseOut.flipped,
    });
    this.primaryPosition = bottomUpTween.animate(this.primaryCurve);
    if (!this.widget.linearTransition)
      this.secondaryCurve = new CurvedAnimation({
        parent: this.widget.secondaryRouteAnimation,
        curve: Curves.linearToEaseOut,
        reverseCurve: Curves.easeInToLinear,
      });
    this.secondaryPosition = middleLeftTween.animate(
      this.secondaryCurve ?? this.widget.secondaryRouteAnimation,
    );
  }
  override dispose(): void {
    this.disposeCurves();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    return new SlideTransition({
      position: this.secondaryPosition,
      textDirection: Directionality.of(context),
      transformHitTests: false,
      child: new SlideTransition({ position: this.primaryPosition, child: this.widget.child }),
    });
  }
}

/** Source mixin policy on the existing canonical PageRoute adapter. */
export abstract class CupertinoRouteTransitionMixin<T = unknown> extends PageRoute<T> {
  static readonly kTransitionDuration = 500;
  abstract get title(): string | null;
  abstract buildContent(context: BuildContext): Widget;
  private previousTitleNotifier: ValueNotifier<string | null> | null = null;
  get previousTitle(): ValueListenable<string | null> {
    invariant(
      this.previousTitleNotifier !== null,
      'uninstalled-cupertino-previous-title',
      'Cannot read previousTitle before route installation',
    );
    return this.previousTitleNotifier;
  }
  override didChangePrevious(previous: Route | null): void {
    const title = previous instanceof CupertinoRouteTransitionMixin ? previous.title : null;
    if (this.previousTitleNotifier === null) this.previousTitleNotifier = new ValueNotifier(title);
    else this.previousTitleNotifier.value = title;
    super.didChangePrevious(previous);
  }
  override dispose(): void {
    builtTransitions.delete(this);
    this.previousTitleNotifier?.dispose();
    super.dispose();
  }
  override get transitionDuration(): number {
    return CupertinoRouteTransitionMixin.kTransitionDuration;
  }
  override get barrierColor(): Color | null {
    return this.fullscreenDialog ? null : cupertinoPageTransitionBarrierColor;
  }
  override get barrierLabel(): string | null {
    return null;
  }
  override canTransitionTo(next: Route): boolean {
    return (
      (!(next instanceof PageRoute) || !next.fullscreenDialog) &&
      (next instanceof CupertinoRouteTransitionMixin ||
        (next instanceof PageRoute && next.delegatedTransition !== null))
    );
  }
  override canTransitionFrom(previous: Route): boolean {
    return previous instanceof PageRoute && !this.fullscreenDialog;
  }
  /** @dartParam _animation Animation<double>
   * @dartParam _secondaryAnimation Animation<double> */
  buildPage(
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
  static buildPageTransitions<T>(
    route: PageRoute<T>,
    _context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    const linearTransition = route.popGestureInProgress,
      fullscreenDialog = route.fullscreenDialog,
      cached = builtTransitions.get(route);
    if (
      cached &&
      cached.animation === animation &&
      cached.secondaryAnimation === secondaryAnimation &&
      cached.child === child &&
      cached.linearTransition === linearTransition &&
      cached.fullscreenDialog === fullscreenDialog
    )
      return cached.widget;
    const widget = fullscreenDialog
      ? new CupertinoFullscreenDialogTransition({
          primaryRouteAnimation: animation,
          secondaryRouteAnimation: secondaryAnimation,
          linearTransition,
          child,
        })
      : new CupertinoPageTransition({
          primaryRouteAnimation: animation,
          secondaryRouteAnimation: secondaryAnimation,
          linearTransition,
          child: new CupertinoBackGestureDetector(
            () => route.popGestureEnabled,
            () => startCupertinoBackGesture(route),
            child,
          ),
        });
    builtTransitions.set(route, {
      animation,
      secondaryAnimation,
      child,
      linearTransition,
      fullscreenDialog,
      widget,
    });
    return widget;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions(
    context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return CupertinoRouteTransitionMixin.buildPageTransitions(
      this,
      context,
      animation,
      secondaryAnimation,
      child,
    );
  }
}
const cupertinoPageTransitionBarrierColor = new Color(0x18000000);
export interface CupertinoPageRouteOptions extends Pick<
  PageRouteOptions,
  'settings' | 'requestFocus' | 'fullscreenDialog' | 'allowSnapshotting' | 'barrierDismissible'
> {
  readonly builder: (context: BuildContext) => Widget;
  readonly title?: string | null;
  readonly maintainState?: boolean;
}
export class CupertinoPageRoute<T = unknown> extends CupertinoRouteTransitionMixin<T> {
  readonly builder: (context: BuildContext) => Widget;
  private readonly routeTitle: string | null;
  override readonly maintainState: boolean;
  constructor({
    builder,
    title = null,
    maintainState = true,
    ...options
  }: CupertinoPageRouteOptions) {
    super(options);
    this.builder = builder;
    this.routeTitle = title;
    this.maintainState = maintainState;
  }
  override get title(): string | null {
    return this.routeTitle;
  }
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  override get delegatedTransition(): DelegatedTransitionBuilder | null {
    return CupertinoPageTransition.delegatedTransition;
  }
  buildContent(context: BuildContext): Widget {
    return this.builder(context);
  }
  override get debugLabel(): string {
    return super.debugLabel + '(' + this.settings.name + ')';
  }
}

export interface CupertinoPageOptions<T = unknown> extends PageOptions<T> {
  readonly child: Widget;
  readonly title?: string | null;
  readonly maintainState?: boolean;
  readonly fullscreenDialog?: boolean;
  readonly allowSnapshotting?: boolean;
}

export class CupertinoPage<T = unknown> extends Page<T> {
  readonly child: Widget;
  readonly title: string | null;
  readonly maintainState: boolean;
  readonly fullscreenDialog: boolean;
  readonly allowSnapshotting: boolean;

  constructor({
    child,
    title = null,
    maintainState = true,
    fullscreenDialog = false,
    allowSnapshotting = true,
    ...settings
  }: CupertinoPageOptions<T>) {
    super(settings);
    this.child = child;
    this.title = title;
    this.maintainState = maintainState;
    this.fullscreenDialog = fullscreenDialog;
    this.allowSnapshotting = allowSnapshotting;
  }

  override createRoute(_context: BuildContext): PageRoute<T> {
    return new PageBasedCupertinoRoute(this);
  }
}

class PageBasedCupertinoRoute<T> extends CupertinoRouteTransitionMixin<T> {
  constructor(page: CupertinoPage<T>) {
    super({ settings: page, allowSnapshotting: page.allowSnapshotting });
  }

  private get page(): CupertinoPage<T> {
    return this.settings as CupertinoPage<T>;
  }
  override get title(): string | null {
    return this.page.title;
  }
  override get fullscreenDialog(): boolean {
    return this.page.fullscreenDialog;
  }
  override get maintainState(): boolean {
    return this.page.maintainState;
  }
  override get delegatedTransition(): DelegatedTransitionBuilder | null {
    return this.fullscreenDialog ? null : CupertinoPageTransition.delegatedTransition;
  }
  override buildContent(): Widget {
    return this.page.child;
  }
  override get debugLabel(): string {
    return super.debugLabel + '(' + this.settings.name + ')';
  }
}

export class CupertinoPageTransitionsBuilder extends PageTransitionsBuilder {
  override get transitionDuration(): number {
    return CupertinoRouteTransitionMixin.kTransitionDuration;
  }
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  override get delegatedTransition(): DelegatedTransitionBuilder | null {
    return CupertinoPageTransition.delegatedTransition;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions<T>(
    route: PageRoute<T>,
    context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return CupertinoRouteTransitionMixin.buildPageTransitions(
      route,
      context,
      animation,
      secondaryAnimation,
      child,
    );
  }
}
