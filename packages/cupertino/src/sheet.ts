// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { Listenable } from '@nelyx/core/foundation/notifier';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Curve } from '@nelyx/core/framework/animation/curves';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Builder,
  ColoredBox,
  DecoratedBox,
  Padding,
  SizedBox,
  Stack,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import { FractionalTranslation } from '@nelyx/core/framework/widgets/fractional-translation';
import { InheritedWidget, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  Element,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Navigator, NavigatorController, PopScope } from '@nelyx/core/framework/widgets/navigation';
import type { Route } from '@nelyx/core/framework/widgets/navigation';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import type { ScrollContext } from '@nelyx/core/framework/widgets/scroll-context';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import type { ScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import type { ScrollPosition } from '@nelyx/core/framework/widgets/scroll-position';
import { ScrollPositionWithSingleContext } from '@nelyx/core/framework/widgets/scroll-position-with-single-context';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { pageRouteTransitionBinding } from '@nelyx/core/internal/framework/widgets/page-route-gesture';
import { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { Radius } from '@nelyx/core/ui/radius';
import { Offset } from '@nelyx/core/ui/offset';
import { CupertinoColors } from './colors.ts';
import { CupertinoUserInterfaceLevel, CupertinoUserInterfaceLevelData } from './interface-level.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoBackGestureController } from './internal/route/back-gesture.ts';
import { CupertinoPageRoute } from './route.ts';
import { CupertinoTheme } from './theme.ts';

const defaultTopGap = 0.08;
const stretchDistance = 0.008;
const coverScale = 0.0835;
const primaryCurve = Curves.fastEaseInToSlowEaseOut;
const primaryReverseCurve = primaryCurve.flipped;
const sheetClip = new ShapeBorderClipper({
  shape: new RoundedSuperellipseBorder({
    borderRadius: new BorderRadius({ topLeft: Radius.circular(12), topRight: Radius.circular(12) }),
  }),
});
const dragHandleShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(18) });
const transparent = new Color(0);
const dragPolicy = {
  minFlingVelocity: 2,
  droppedDuration: 300,
  stayThreshold: 0.52,
  curve: Curves.easeOut,
};

function checkTopGap(topGap: number): void {
  invariant(
    topGap >= 0 && topGap <= 0.9,
    'invalid-cupertino-sheet-gap',
    'Cupertino sheet top gap must be in [0, 0.9]',
  );
}

function animationValue(animation: Animation<number>, forward: Curve, reverse: Curve): number {
  const value = animation.value;
  if (value === 0 || value === 1) return value;
  return (animation.status === AnimationStatus.reverse ? reverse : forward).transform(value);
}

export interface CupertinoSheetTransitionOptions extends WidgetOptions {
  readonly primaryRouteAnimation: Animation<number>;
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  readonly topGap?: number;
}

export class CupertinoSheetTransition extends StatefulWidget {
  readonly primaryRouteAnimation: Animation<number>;
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  readonly topGap: number;

  constructor({
    primaryRouteAnimation,
    secondaryRouteAnimation,
    child,
    linearTransition,
    topGap = defaultTopGap,
    key = null,
  }: CupertinoSheetTransitionOptions) {
    super(key);
    checkTopGap(topGap);
    this.primaryRouteAnimation = primaryRouteAnimation;
    this.secondaryRouteAnimation = secondaryRouteAnimation;
    this.child = child;
    this.linearTransition = linearTransition;
    this.topGap = topGap;
  }

  static delegateTransition(
    context: BuildContext,
    _animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    _allowSnapshotting: boolean,
    child: Widget | null,
  ): Widget {
    if (child === null) return new SizedBox();
    const coversSheet = CupertinoSheetRoute.hasParentSheet(context);
    const linear = Navigator.of(context).userGestureInProgress;
    const tint = new Color(
      CupertinoTheme.brightnessOf(context) === 'dark' ? 0xffc8c8c8 : 0xff000000,
    );
    const deviceRadius = MediaQuery.viewPaddingOf(context).top * 0.9;
    const initialRadius = deviceRadius > 20 ? deviceRadius : 0;
    return new ListenableBuilder(secondaryAnimation, () => {
      const progress = linear
        ? secondaryAnimation.value
        : animationValue(secondaryAnimation, Curves.linearToEaseOut, Curves.easeInToLinear);
      if (progress === 0) return child;
      let surface = child;
      if (coversSheet) surface = new ClipPath(surface, { clipper: sheetClip });
      else {
        const top = Radius.circular(initialRadius + (12 - initialRadius) * progress);
        const bottom = Radius.circular(12 * progress);
        const clipper = new ShapeBorderClipper({
          shape: new RoundedSuperellipseBorder({
            borderRadius: new BorderRadius({
              topLeft: top,
              topRight: top,
              bottomLeft: bottom,
              bottomRight: bottom,
            }),
          }),
        });
        surface = new ClipPath(
          new Stack([
            surface,
            SizedBox.expand(new ColoredBox({ color: tint.withOpacity(0.1 * progress).toARGB32() })),
          ]),
          { clipper },
        );
      }
      return new FractionalTranslation(
        Transform.scale(surface, {
          scale: 1 - coverScale * progress,
          alignment: Alignment.topCenter,
          filterQuality: 'medium',
        }),
        {
          translation: new Offset(0, (coversSheet ? -0.005 : 0.07) * progress),
          transformHitTests: !coversSheet,
        },
      );
    });
  }

  override createState(): State<CupertinoSheetTransition> {
    return new CupertinoSheetTransitionState();
  }
}

class SheetStretchScope extends InheritedWidget {
  constructor(
    readonly controller: AnimationController,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: SheetStretchScope): boolean {
    return old.controller !== this.controller;
  }
}

class CupertinoSheetTransitionState extends SingleTickerProviderStateMixin<CupertinoSheetTransition> {
  private stretch!: AnimationController;
  override initState(): void {
    super.initState();
    this.stretch = new AnimationController({ vsync: this, duration: 1 });
  }

  override build(context: BuildContext): Widget {
    const {
      primaryRouteAnimation: primary,
      secondaryRouteAnimation: secondary,
      linearTransition,
      child,
      topGap,
    } = this.widget;
    const height = MediaQuery.of(context).height;
    const incomingEnd = CupertinoSheetRoute.hasParentSheet(context) ? -0.02 : 0;
    const surface = new SheetStretchScope(this.stretch, child);
    return new ListenableBuilder(Listenable.merge([primary, secondary, this.stretch]), () => {
      const enter = linearTransition
        ? primary.value
        : animationValue(primary, primaryCurve, primaryReverseCurve);
      const cover = animationValue(secondary, Curves.linearToEaseOut, Curves.easeInToLinear);
      return new Padding(
        EdgeInsets.fromLTRB(
          0,
          Math.max(0, topGap - stretchDistance * this.stretch.value) * height,
          0,
          0,
        ),
        new FractionalTranslation(
          Transform.scale(
            new FractionalTranslation(surface, {
              translation: new Offset(0, 1 + (incomingEnd - 1) * enter),
            }),
            {
              scale: 1 - coverScale * cover,
              alignment: Alignment.topCenter,
              filterQuality: 'medium',
            },
          ),
          { translation: new Offset(0, -0.005 * cover), transformHitTests: false },
        ),
      );
    });
  }

  override dispose(): void {
    this.stretch.dispose();
    super.dispose();
  }
}

type SheetBuilder = (context: BuildContext) => Widget;
export type CupertinoSheetScrollableBuilder = (
  context: BuildContext,
  controller: ScrollController,
) => Widget;

export interface CupertinoSheetRouteOptions {
  readonly builder?: SheetBuilder | null;
  readonly scrollableBuilder?: CupertinoSheetScrollableBuilder | null;
  readonly settings?: RouteSettings | null;
  readonly enableDrag?: boolean;
  readonly showDragHandle?: boolean;
  readonly topGap?: number | null;
}

export class CupertinoSheetRoute<T = unknown> extends PageRoute<T> {
  readonly sheetBuilder: SheetBuilder | null;
  readonly scrollableBuilder: CupertinoSheetScrollableBuilder | null;
  readonly enableDrag: boolean;
  readonly showDragHandle: boolean;
  readonly topGap: number;
  private readonly customTopGap: boolean;

  constructor({
    builder = null,
    scrollableBuilder = null,
    settings = null,
    enableDrag = true,
    showDragHandle = false,
    topGap = null,
  }: CupertinoSheetRouteOptions) {
    super({ settings });
    invariant(
      builder || scrollableBuilder,
      'missing-cupertino-sheet-builder',
      'CupertinoSheetRoute requires a builder',
    );
    checkTopGap(topGap ?? defaultTopGap);
    this.sheetBuilder = builder;
    this.scrollableBuilder = scrollableBuilder;
    this.enableDrag = enableDrag;
    this.showDragHandle = showDragHandle;
    this.topGap = topGap ?? defaultTopGap;
    this.customTopGap = topGap !== null;
  }

  override get opaque(): boolean {
    return false;
  }
  override get barrierColor(): Color {
    return transparent;
  }
  override get barrierLabel(): null {
    return null;
  }
  override get maintainState(): boolean {
    return true;
  }
  override get transitionDuration(): number {
    return 500;
  }
  override get delegatedTransition() {
    return this.customTopGap ? null : CupertinoSheetTransition.delegateTransition;
  }
  override canTransitionFrom(): boolean {
    return !this.customTopGap;
  }
  override canTransitionTo(next: Route): boolean {
    return !this.customTopGap && next instanceof CupertinoSheetRoute;
  }

  static hasParentSheet(context: BuildContext): boolean {
    return context.maybeDependOn(CupertinoSheetScope) !== undefined;
  }

  static popSheet(context: BuildContext): void {
    if (this.hasParentSheet(context)) Navigator.of(context, { rootNavigator: true }).pop();
  }

  buildContent(context: BuildContext): Widget {
    return MediaQuery.removePadding({
      context,
      removeTop: true,
      child: new ClipPath(
        new CupertinoUserInterfaceLevel({
          data: CupertinoUserInterfaceLevelData.elevated,
          child: new CupertinoSheetScope(new CupertinoSheetSurface(this)),
        }),
        { clipper: sheetClip },
      ),
    });
  }

  override buildPage(context: BuildContext): Widget {
    return this.buildContent(context);
  }

  override buildTransitions(
    _context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new CupertinoSheetTransition({
      primaryRouteAnimation: animation,
      secondaryRouteAnimation: secondaryAnimation,
      child,
      linearTransition: this.popGestureInProgress,
      topGap: this.topGap,
    });
  }
}

class CupertinoSheetScope extends InheritedWidget {
  override updateShouldNotify(): boolean {
    return false;
  }
}

export interface ShowCupertinoSheetOptions extends CupertinoSheetRouteOptions {
  readonly context: BuildContext;
  readonly pageBuilder?: SheetBuilder | null;
  readonly useNestedNavigation?: boolean;
}

export function showCupertinoSheet<T = unknown>({
  context,
  pageBuilder = null,
  useNestedNavigation = false,
  builder = null,
  scrollableBuilder = null,
  ...options
}: ShowCupertinoSheetOptions): Promise<T | undefined> {
  const effective = builder ?? pageBuilder;
  invariant(
    (effective || scrollableBuilder) && !(effective && scrollableBuilder),
    'invalid-cupertino-sheet-builder',
    'Provide either a Cupertino sheet builder or a scrollable builder',
  );
  const route = useNestedNavigation
    ? new CupertinoSheetRoute<T>({
        ...options,
        scrollableBuilder: (_context, controller) =>
          new SheetNavigator(
            scrollableBuilder ? (context) => scrollableBuilder(context, controller) : effective!,
          ),
      })
    : new CupertinoSheetRoute<T>({ ...options, builder: effective, scrollableBuilder });
  return Navigator.of(context, { rootNavigator: true }).push(route);
}

class SheetNavigator extends StatefulWidget {
  constructor(readonly builder: SheetBuilder) {
    super();
  }
  override createState(): State<SheetNavigator> {
    return new SheetNavigatorState();
  }
}

class SheetNavigatorState extends State<SheetNavigator> {
  private readonly controller = new NavigatorController();
  private readonly root = new CupertinoPageRoute({
    builder: (context) => this.widget.builder(context),
  });
  private readonly handleBack = async (): Promise<boolean> => {
    if (!this.controller.canPop) return true;
    await this.controller.maybePop();
    return false;
  };
  override build(): Widget {
    return new PopScope({
      onWillPop: this.handleBack,
      child: new Navigator(this.controller, this.root),
    });
  }
  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}

class CupertinoSheetSurface extends StatefulWidget {
  constructor(readonly route: CupertinoSheetRoute) {
    super();
  }
  override createState(): State<CupertinoSheetSurface> {
    return new CupertinoSheetSurfaceState();
  }
}

class CupertinoSheetSurfaceState extends State<CupertinoSheetSurface> {
  private gesture: CupertinoBackGestureController | null = null;
  private stretch: AnimationController | null = null;
  private height = 0;
  private readonly controller = new SheetScrollController(this);

  beginDrag(): boolean {
    if (this.gesture !== null) return true;
    const route = this.widget.route;
    const binding = pageRouteTransitionBinding(route);
    if (
      !route.enableDrag ||
      !route.isCurrent ||
      !binding ||
      !binding.navigator.canPop ||
      !route.animation?.isCompleted ||
      route.popGestureInProgress ||
      this.height <= 0
    )
      return false;
    this.gesture = new CupertinoBackGestureController(binding, dragPolicy);
    return true;
  }

  dragBy(delta: number): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const stretch = this.stretch;
    if (stretch && this.widget.route.animation?.value === 1 && (stretch.value > 0 || delta < 0))
      stretch.value = clampDouble(stretch.value - delta / (this.height * stretchDistance), 0, 1);
    else gesture.dragUpdate(delta / this.height);
  }

  endDrag(velocity: number): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture) return;
    if (this.stretch && this.stretch.value > 0) {
      this.stretch.animateBack(0, { duration: 180, curve: Curves.easeOut });
      gesture.close();
    } else gesture.dragEnd(velocity / this.height);
  }

  override build(context: BuildContext): Widget {
    const route = this.widget.route;
    const data = MediaQuery.of(context);
    this.height = data.height;
    this.stretch = context.maybeDependOn(SheetStretchScope)?.controller ?? null;
    const builder = new Builder((context) =>
      route.scrollableBuilder
        ? route.scrollableBuilder(context, this.controller)
        : route.sheetBuilder!(context),
    );
    let child: Widget = builder;
    if (route.showDragHandle) {
      child = new Stack([
        new MediaQuery({ ...data, padding: EdgeInsets.fromLTRB(0, 15, 0, 0) }, builder),
        new Align(
          new Padding(
            EdgeInsets.fromLTRB(0, 5, 0, 0),
            new SizedBox(
              36,
              5,
              new DecoratedBox(undefined, {
                decoration: new ColorShapeDecoration(
                  dragHandleShape,
                  resolveCupertinoColor(CupertinoColors.tertiaryLabel, context),
                ),
              }),
            ),
          ),
          { alignment: Alignment.topCenter },
        ),
      ]);
    }
    if (!route.enableDrag) return child;
    return new GestureDetector(child, {
      onVerticalDragStart: () => {
        this.beginDrag();
      },
      onVerticalDragUpdate: (details) => this.dragBy(details.primaryDelta ?? 0),
      onVerticalDragEnd: (details) => this.endDrag(details.primaryVelocity ?? 0),
      onVerticalDragCancel: () => this.endDrag(0),
    });
  }

  override dispose(): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture) (this.context as Element).owner.postFrame(() => gesture.close());
    this.controller.dispose();
    super.dispose();
  }
}

class SheetScrollController extends ScrollController {
  constructor(private readonly surface: CupertinoSheetSurfaceState) {
    super();
  }

  override createScrollPosition(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
  ): ScrollPosition {
    return new SheetScrollPosition(physics, context, oldPosition, this.surface);
  }
}

class SheetScrollPosition extends ScrollPositionWithSingleContext {
  private draggingSheet = false;

  constructor(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
    private readonly surface: CupertinoSheetSurfaceState,
  ) {
    super({ physics, context, oldPosition });
  }

  override applyUserOffset(delta: number): void {
    if (
      !this.draggingSheet &&
      this.axisDirection === AxisDirection.down &&
      this.pixels <= this.minScrollExtent &&
      delta > 0
    )
      this.draggingSheet = this.surface.beginDrag();
    if (this.draggingSheet) this.surface.dragBy(delta);
    else super.applyUserOffset(delta);
  }

  override goBallistic(velocity: number): void {
    if (this.draggingSheet) {
      this.draggingSheet = false;
      this.surface.endDrag(-velocity);
      super.goBallistic(0);
    } else super.goBallistic(velocity);
  }
}
