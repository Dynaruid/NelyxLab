// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/sheet.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Listenable } from '@nelyx/core/foundation/notifier';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Tween } from '@nelyx/core/framework/animation/tween';
import { IOSScrollViewFlingVelocityTracker } from '@nelyx/core/framework/gestures/velocity-tracker';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import {
  AnnotatedRegion,
  systemUiOverlayStyleAnnotation,
} from '@nelyx/core/framework/widgets/annotated-region';
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
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import {
  Navigator,
  NavigatorController,
  PopScope,
  routeOf,
} from '@nelyx/core/framework/widgets/navigation';
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
import { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
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
const stretchedTopGap = 0.072;
const stretchDistance = defaultTopGap - stretchedTopGap;
const coverScale = 0.0835;
const deviceCornerSmoothing = 0.9;
const roundedDeviceCornersThreshold = 20;
const sheetMinimumFlingVelocity = 2;
const droppedSheetDragDuration = 300;
const primaryCurve = Curves.fastEaseInToSlowEaseOut;
const primaryReverseCurve = primaryCurve.flipped;
const bottomUp = new Tween({ begin: new Offset(0, 1), end: Offset.zero });
const bottomUpOverOtherSheet = new Tween({ begin: new Offset(0, 1), end: new Offset(0, -0.02) });
const midUp = new Tween({ begin: Offset.zero, end: new Offset(0, -0.005) });
const topDown = new Tween({ begin: Offset.zero, end: new Offset(0, 0.07) });
const contrastOpacity = new Tween({ begin: 0, end: 0.1 });
const coveredScale = new Tween({ begin: 1, end: 1 - coverScale });
const sheetStatusBarStyle = new SystemUiOverlayStyle({
  statusBarBrightness: 'dark',
  statusBarIconBrightness: 'light',
});
const sheetClip = new ShapeBorderClipper({
  shape: new RoundedSuperellipseBorder({
    borderRadius: new BorderRadius({ topLeft: Radius.circular(12), topRight: Radius.circular(12) }),
  }),
});
const dragHandleShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(18) });
const transparent = new Color(0);
const dragPolicy = {
  minFlingVelocity: sheetMinimumFlingVelocity,
  droppedDuration: droppedSheetDragDuration,
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

export interface CupertinoSheetTransitionOptions extends WidgetOptions {
  readonly primaryRouteAnimation: Animation<number>;
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  readonly topGap?: number;
  /** @internal Whether the previous route is a sheet in this Navigator. */
  readonly coveringSheet?: boolean;
}

export class CupertinoSheetTransition extends StatefulWidget {
  readonly primaryRouteAnimation: Animation<number>;
  readonly secondaryRouteAnimation: Animation<number>;
  readonly child: Widget;
  readonly linearTransition: boolean;
  readonly topGap: number;
  readonly coveringSheet: boolean;

  constructor({
    primaryRouteAnimation,
    secondaryRouteAnimation,
    child,
    linearTransition,
    topGap = defaultTopGap,
    coveringSheet = false,
    key = null,
  }: CupertinoSheetTransitionOptions) {
    super(key);
    checkTopGap(topGap);
    this.primaryRouteAnimation = primaryRouteAnimation;
    this.secondaryRouteAnimation = secondaryRouteAnimation;
    this.child = child;
    this.linearTransition = linearTransition;
    this.topGap = topGap;
    this.coveringSheet = coveringSheet;
  }

  static delegateTransition(
    context: BuildContext,
    _animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    _allowSnapshotting: boolean,
    child: Widget | null,
  ): Widget {
    if (child === null) return new SizedBox();
    const coversSheet =
      routeOf(context) instanceof CupertinoSheetRoute ||
      CupertinoSheetRoute.hasParentSheet(context);
    return new CoveredSheetTransition(
      secondaryAnimation,
      coversSheet,
      !coversSheet && (Navigator.maybeOf(context)?.userGestureInProgress ?? false),
      child,
    );
  }

  override createState(): State<CupertinoSheetTransition> {
    return new CupertinoSheetTransitionState();
  }
}

class CoveredSheetTransition extends StatefulWidget {
  constructor(
    readonly animation: Animation<number>,
    readonly coversSheet: boolean,
    readonly linear: boolean,
    readonly child: Widget,
  ) {
    super();
  }
  override createState(): State<CoveredSheetTransition> {
    return new CoveredSheetTransitionState();
  }
}

class CoveredSheetTransitionState extends State<CoveredSheetTransition> {
  private curve!: CurvedAnimation;
  private createCurve(): CurvedAnimation {
    return new CurvedAnimation({
      parent: this.widget.animation,
      curve: Curves.linearToEaseOut,
      reverseCurve: Curves.easeInToLinear,
    });
  }
  override initState(): void {
    super.initState();
    this.curve = this.createCurve();
  }
  override didUpdateWidget(old: CoveredSheetTransition): void {
    super.didUpdateWidget(old);
    if (old.animation !== this.widget.animation) {
      this.curve.dispose();
      this.curve = this.createCurve();
    }
  }
  override build(context: BuildContext): Widget {
    const { linear, coversSheet, animation, child } = this.widget;
    const tint = new Color(
      CupertinoTheme.brightnessOf(context) === 'dark' ? 0xffc8c8c8 : 0xff000000,
    );
    const deviceRadius = (MediaQuery.maybeViewPaddingOf(context)?.top ?? 0) * deviceCornerSmoothing;
    const initialRadius = deviceRadius > roundedDeviceCornersThreshold ? deviceRadius : 0;
    const gap = MediaQuery.of(context).height * defaultTopGap;
    return new ListenableBuilder({
      listenable: this.curve,
      child,
      builder: (_context, child) => {
        const progress = linear ? animation.value : this.curve.value;
        const inner = child ?? new SizedBox();
        let panel: Widget = new ClipPath(inner, { clipper: sheetClip });
        if (!coversSheet) {
          const top = Radius.circular(
            progress === 0 ? 0 : initialRadius + (12 - initialRadius) * progress,
          );
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
          panel = new ClipPath(
            new Stack([
              inner,
              SizedBox.expand(
                new ColoredBox({
                  color: tint.withOpacity(contrastOpacity.transform(progress)).toARGB32(),
                }),
              ),
            ]),
            { clipper, clipBehavior: progress === 0 ? 'none' : 'antiAlias' },
          );
        }
        const moved = new FractionalTranslation(
          Transform.scale(panel, {
            scale: coveredScale.transform(progress),
            alignment: Alignment.topCenter,
            filterQuality: 'medium',
          }),
          {
            translation: (coversSheet ? midUp : topDown).transform(progress),
            transformHitTests: !coversSheet,
          },
        );
        if (coversSheet) return moved;
        return new Stack([
          new AnnotatedRegion(new SizedBox(Infinity, gap), {
            annotationType: systemUiOverlayStyleAnnotation,
            value: sheetStatusBarStyle,
          }),
          moved,
        ]);
      },
    });
  }
  override dispose(): void {
    this.curve.dispose();
    super.dispose();
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
  private enterCurve!: CurvedAnimation;
  private coverCurve!: CurvedAnimation;
  override initState(): void {
    super.initState();
    this.stretch = new AnimationController({ vsync: this, duration: 1 });
    this.makeCurves();
  }

  private makeCurves(): void {
    this.enterCurve = new CurvedAnimation({
      parent: this.widget.primaryRouteAnimation,
      curve: primaryCurve,
      reverseCurve: primaryReverseCurve,
    });
    this.coverCurve = new CurvedAnimation({
      parent: this.widget.secondaryRouteAnimation,
      curve: Curves.linearToEaseOut,
      reverseCurve: Curves.easeInToLinear,
    });
  }

  override didUpdateWidget(old: CupertinoSheetTransition): void {
    super.didUpdateWidget(old);
    if (
      old.primaryRouteAnimation !== this.widget.primaryRouteAnimation ||
      old.secondaryRouteAnimation !== this.widget.secondaryRouteAnimation
    ) {
      this.enterCurve.dispose();
      this.coverCurve.dispose();
      this.makeCurves();
    }
  }

  override build(context: BuildContext): Widget {
    const {
      primaryRouteAnimation: primary,
      secondaryRouteAnimation: secondary,
      linearTransition,
      child,
      topGap,
      coveringSheet,
    } = this.widget;
    const height = MediaQuery.of(context).height;
    const incoming =
      coveringSheet || CupertinoSheetRoute.hasParentSheet(context)
        ? bottomUpOverOtherSheet
        : bottomUp;
    const surface = new SheetStretchScope(this.stretch, child);
    return new ListenableBuilder(Listenable.merge([primary, secondary, this.stretch]), () => {
      const enter = linearTransition ? primary.value : this.enterCurve.value;
      const cover = this.coverCurve.value;
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
              translation: incoming.transform(enter),
            }),
            {
              scale: coveredScale.transform(cover),
              alignment: Alignment.topCenter,
              filterQuality: 'medium',
            },
          ),
          { translation: midUp.transform(cover), transformHitTests: false },
        ),
      );
    });
  }

  override dispose(): void {
    this.enterCurve.dispose();
    this.coverCurve.dispose();
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
  private previousIsSheet = false;

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
  override didChangePrevious(previous: Route | null): void {
    this.previousIsSheet = previous instanceof CupertinoSheetRoute;
    super.didChangePrevious(previous);
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
      coveringSheet: this.previousIsSheet,
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

type SheetDragSource = 'surface' | SheetScrollPosition;
type SheetDragStart = (source: SheetDragSource) => boolean;
type SheetDragUpdate = (source: SheetDragSource, delta: number) => void;
type SheetDragEnd = (source: SheetDragSource, velocity: number) => void;
type GetSheetDragged = () => boolean;

class CupertinoSheetSurfaceState extends State<CupertinoSheetSurface> {
  private gesture: CupertinoBackGestureController | null = null;
  private dragSource: SheetDragSource | null = null;
  private stretch: AnimationController | null = null;
  private readonly controller = new SheetScrollController(this);

  private get height(): number {
    if (!this.mounted) return 0;
    const context = this.context;
    if (context instanceof Element && !context.active) return 0;
    const render = context.findRenderObject();
    return render instanceof RenderBox && render.attached && render.hasSize
      ? render.size.height
      : 0;
  }

  readonly isDraggedDown: GetSheetDragged = () => (this.widget.route.animation?.value ?? 1) < 1;

  readonly beginDrag: SheetDragStart = (source) => {
    if (this.gesture !== null) return this.dragSource === source;
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
    this.dragSource = source;
    return true;
  };

  readonly dragBy: SheetDragUpdate = (source, delta) => {
    const gesture = this.gesture;
    const height = this.height;
    if (!gesture || this.dragSource !== source || height <= 0) return;
    const stretch = source === 'surface' ? this.stretch : null;
    if (stretch && this.widget.route.animation?.value === 1 && (stretch.value > 0 || delta < 0))
      stretch.value = clampDouble(stretch.value - delta / (height * stretchDistance), 0, 1);
    else gesture.dragUpdate(delta / (source === 'surface' ? height : height * (1 - defaultTopGap)));
  };

  readonly endDrag: SheetDragEnd = (source, velocity) => {
    if (this.dragSource !== source) return;
    const gesture = this.gesture;
    this.gesture = null;
    this.dragSource = null;
    if (!gesture) return;
    const height = this.height;
    if (source === 'surface' && this.stretch && this.stretch.value > 0) {
      this.stretch.animateBack(0, { duration: 180, curve: Curves.easeOut });
      gesture.close();
    } else gesture.dragEnd(height > 0 ? velocity / height : 0);
  };

  ownsScrollDrag(position: SheetScrollPosition): boolean {
    return this.dragSource === position;
  }

  transferScrollDrag(from: SheetScrollPosition, to: SheetScrollPosition): void {
    if (this.dragSource === from) this.dragSource = to;
  }

  retireScrollDrag(position: SheetScrollPosition): void {
    if (!this.mounted || this.dragSource !== position) return;
    const context = this.context;
    if (!(context instanceof Element)) return;
    context.owner.postFrame(() => {
      if (this.mounted && context.active) this.endDrag(position, 0);
    });
  }

  override build(context: BuildContext): Widget {
    const route = this.widget.route;
    const data = MediaQuery.of(context);
    this.stretch = context.maybeDependOn(SheetStretchScope)?.controller ?? null;
    const builder = new Builder((context) =>
      route.scrollableBuilder
        ? route.scrollableBuilder(context, this.controller)
        : route.sheetBuilder!(context),
    );
    let child: Widget = builder;
    if (route.showDragHandle) {
      child = new Stack(
        [
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
        ],
        { fit: 'expand' },
      );
    }
    if (!route.enableDrag) return child;
    return new GestureDetector(child, {
      behavior: HitTestBehavior.translucent,
      velocityTrackerBuilder: (event) => new IOSScrollViewFlingVelocityTracker(event.kind),
      onVerticalDragStart: () => {
        this.beginDrag('surface');
      },
      onVerticalDragUpdate: (details) => this.dragBy('surface', details.primaryDelta ?? 0),
      onVerticalDragEnd: (details) => this.endDrag('surface', details.primaryVelocity ?? 0),
      onVerticalDragCancel: () => this.endDrag('surface', 0),
    });
  }

  override dispose(): void {
    const gesture = this.gesture;
    this.gesture = null;
    this.dragSource = null;
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
    return new SheetScrollPosition(
      physics,
      context,
      oldPosition,
      this.surface,
      this.initialScrollOffset,
      this.keepScrollOffset,
    );
  }
}

class SheetScrollPosition extends ScrollPositionWithSingleContext {
  constructor(
    physics: ScrollPhysics,
    context: ScrollContext,
    oldPosition: ScrollPosition | null,
    private readonly surface: CupertinoSheetSurfaceState,
    initialPixels: number,
    keepScrollOffset: boolean,
  ) {
    super({ physics, context, oldPosition, initialPixels, keepScrollOffset });
    if (oldPosition instanceof SheetScrollPosition)
      this.surface.transferScrollDrag(oldPosition, this);
  }

  override _restoreAbsorbedPosition(other: ScrollPosition): boolean {
    const restored = super._restoreAbsorbedPosition(other);
    if (restored && other instanceof SheetScrollPosition)
      this.surface.transferScrollDrag(other, this);
    return restored;
  }

  override applyUserOffset(delta: number): void {
    const canDragSheet =
      this.axisDirection === AxisDirection.down &&
      this.pixels <= this.minScrollExtent &&
      (delta > 0 || this.surface.isDraggedDown());
    if (canDragSheet && this.surface.beginDrag(this)) this.surface.dragBy(this, delta);
    else super.applyUserOffset(delta);
  }

  override goBallistic(velocity: number): void {
    // Super may call this before the derived position finishes initializing.
    if (this.surface?.ownsScrollDrag(this)) {
      const dismissingFling = velocity < 0 && this.pixels <= this.minScrollExtent;
      this.surface.endDrag(this, dismissingFling ? -velocity : 0);
      if (dismissingFling) velocity = 0;
    }
    super.goBallistic(velocity);
  }

  override dispose(): void {
    this.surface.retireScrollDrag(this);
    super.dispose();
  }
}
