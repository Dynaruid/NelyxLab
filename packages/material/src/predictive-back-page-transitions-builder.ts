// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { PageTransitionsBuilder } from '@nelyx/core/framework/widgets/page-transitions-builder';
import type { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import {
  ProxyAnimation,
  ReverseAnimation,
  CurvedAnimation,
  kAlwaysDismissedAnimation,
} from '@nelyx/core/framework/animation/animations';
import { Tween, ConstantTween } from '@nelyx/core/framework/animation/tween';
import type { Animatable } from '@nelyx/core/framework/animation/tween';
import { TweenSequence } from '@nelyx/core/framework/animation/tween-sequence';
import { TweenSequenceItem } from '@nelyx/core/framework/animation/tween-sequence-item';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { AnimatedBuilder } from '@nelyx/core/framework/widgets/transitions';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { Transform } from '@nelyx/core/framework/widgets/basic';
import { ClipRRect } from '@nelyx/core/framework/widgets/clip';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Offset } from '@nelyx/core/ui/offset';
import type { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { SwipeEdge } from '@nelyx/core/services/predictive-back-event';
import type { PredictiveBackEvent } from '@nelyx/core/services/predictive-back-event';
import type { ServicesBinding, ServicesObserver } from '@nelyx/core/services/binding';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import {
  FadeForwardsPageTransitionsBuilder,
  ZoomPageTransitionsBuilder,
} from './internal/route/page-transition-builders.ts';

export interface PredictiveBackPageTransitionsBuilderOptions {
  readonly fallbackColor?: Color | null;
}
export class PredictiveBackPageTransitionsBuilder extends PageTransitionsBuilder {
  readonly fallbackColor: Color | null;
  constructor({ fallbackColor = null }: PredictiveBackPageTransitionsBuilderOptions = {}) {
    super();
    this.fallbackColor = fallbackColor;
  }
  override get transitionDuration(): number {
    return FadeForwardsPageTransitionsBuilder.kTransitionMilliseconds;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions<T>(
    route: PageRoute<T>,
    _context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new PredictiveBackGestureDetector(
      route,
      (context, phase, startBackEvent, currentBackEvent) =>
        route.popGestureInProgress
          ? new PredictiveBackSharedElementPageTransition(
              true,
              animation,
              secondaryAnimation,
              phase,
              startBackEvent,
              currentBackEvent,
              child,
            )
          : new FadeForwardsPageTransitionsBuilder({
              backgroundColor: this.fallbackColor,
            }).buildTransitions(route, context, animation, secondaryAnimation, child),
    );
  }
}
export class PredictiveBackFullscreenPageTransitionsBuilder extends PageTransitionsBuilder {
  readonly fallbackColor: Color | null;
  constructor({ fallbackColor = null }: PredictiveBackPageTransitionsBuilderOptions = {}) {
    super();
    this.fallbackColor = fallbackColor;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions<T>(
    route: PageRoute<T>,
    _context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new PredictiveBackGestureDetector(route, (context, phase) =>
      route.popGestureInProgress
        ? new PredictiveBackFullscreenPageTransition(
            animation,
            secondaryAnimation,
            () => route.isCurrent,
            phase,
            child,
          )
        : new ZoomPageTransitionsBuilder({ backgroundColor: this.fallbackColor }).buildTransitions(
            route,
            context,
            animation,
            secondaryAnimation,
            child,
          ),
    );
  }
}

type PredictiveBackPhase = 'idle' | 'start' | 'update' | 'commit' | 'cancel';
type PredictiveBackBuilder = (
  context: BuildContext,
  phase: PredictiveBackPhase,
  start: PredictiveBackEvent | null,
  current: PredictiveBackEvent | null,
) => Widget;
type PredictiveBackRoute = Pick<
  PageRoute,
  | 'isCurrent'
  | 'popGestureEnabled'
  | 'popGestureInProgress'
  | 'handleStartBackGesture'
  | 'handleUpdateBackGestureProgress'
  | 'handleCancelBackGesture'
  | 'handleCommitBackGesture'
>;
class PredictiveBackGestureDetector extends StatefulWidget {
  constructor(
    readonly route: PredictiveBackRoute,
    readonly builder: PredictiveBackBuilder,
  ) {
    super();
  }
  createState(): State {
    return new PredictiveBackGestureDetectorState();
  }
}
class PredictiveBackGestureDetectorState
  extends State<PredictiveBackGestureDetector>
  implements ServicesObserver
{
  private phase: PredictiveBackPhase = 'idle';
  private startBackEvent: PredictiveBackEvent | null = null;
  private currentBackEvent: PredictiveBackEvent | null = null;
  private service: ServicesBinding | undefined;
  private subscription: Disposable | null = null;
  private setPhase(phase: PredictiveBackPhase): void {
    if (this.phase !== phase && this.mounted)
      this.setState(() => {
        this.phase = phase;
      });
  }
  private setEvents(start: PredictiveBackEvent | null, current: PredictiveBackEvent | null): void {
    if (
      this.mounted &&
      (!(this.startBackEvent?.equals(start) ?? start === null) ||
        !(this.currentBackEvent?.equals(current) ?? current === null))
    )
      this.setState(() => {
        this.startBackEvent = start;
        this.currentBackEvent = current;
      });
  }
  handleStartBackGesture(event: PredictiveBackEvent): boolean {
    this.setPhase('start');
    if (event.isButtonEvent || !this.widget.route.isCurrent || !this.widget.route.popGestureEnabled)
      return false;
    this.widget.route.handleStartBackGesture({ progress: 1 - event.progress });
    this.setEvents(event, event);
    return true;
  }
  handleUpdateBackGestureProgress(event: PredictiveBackEvent): void {
    this.setPhase('update');
    this.widget.route.handleUpdateBackGestureProgress({ progress: 1 - event.progress });
    this.setEvents(this.startBackEvent, event);
  }
  handleCancelBackGesture(): void {
    this.setPhase('cancel');
    this.widget.route.handleCancelBackGesture();
    this.setEvents(null, null);
  }
  handleCommitBackGesture(): void {
    this.setPhase('commit');
    this.widget.route.handleCommitBackGesture();
    this.setEvents(null, null);
  }
  override initState(): void {
    super.initState();
    this.bindService();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.bindService();
  }
  private bindService(): void {
    const service = this.context.services.platformServices;
    if (service === this.service) return;
    this.subscription?.dispose();
    this.service = service;
    this.subscription = service && !service.isClosed ? service.addObserver(this) : null;
  }
  override dispose(): void {
    this.subscription?.dispose();
    this.subscription = null;
    this.service = undefined;
    super.dispose();
  }
  build(context: BuildContext): Widget {
    return this.widget.builder(
      context,
      this.widget.route.popGestureInProgress ? this.phase : 'idle',
      this.startBackEvent,
      this.currentBackEvent,
    );
  }
}

class PredictiveBackSharedElementPageTransition extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly animation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryAnimation: Animation<number>;
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  constructor(
    readonly isDelegatedTransition: boolean,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    readonly phase: PredictiveBackPhase,
    readonly startBackEvent: PredictiveBackEvent | null,
    readonly currentBackEvent: PredictiveBackEvent | null,
    readonly child: Widget,
  ) {
    super();
    this.animation = animation;
    this.secondaryAnimation = secondaryAnimation;
  }
  createState(): State {
    return new PredictiveBackSharedElementPageTransitionState();
  }
}
class PredictiveBackSharedElementPageTransitionState extends State<PredictiveBackSharedElementPageTransition> {
  /** @dartType double */
  private static readonly minScale = 0.9;
  /** @dartType double */
  private static readonly divisionFactor = 20;
  /** @dartType double */
  private static readonly margin = 8;
  /** @dartType double */
  private static readonly yPositionFactor = 0.1;
  /** @dartType int */
  private static readonly commitMilliseconds = 400;
  private static readonly commitInterval = new Interval(
    0,
    PredictiveBackSharedElementPageTransitionState.commitMilliseconds /
      FadeForwardsPageTransitionsBuilder.kTransitionMilliseconds,
    { curve: Curves.easeInOutCubicEmphasized },
  );
  /** @dartType double */
  static readonly deviceBorderRadius = 32;
  /** @dartType Tween<double> */
  private readonly borderRadiusTween = new Tween<number>({
    begin: 0,
    end: PredictiveBackSharedElementPageTransitionState.deviceBorderRadius,
  });
  /** @dartType Tween<double> */
  private readonly opacityTween = new Tween<number>({ begin: 1, end: 0 });
  /** @dartType Tween<double> */
  private readonly scaleTween = new Tween<number>({
    begin: 1,
    end: PredictiveBackSharedElementPageTransitionState.minScale,
  });
  private readonly commitAnimation = new ProxyAnimation();
  private readonly bounceAnimation = new ProxyAnimation();
  private readonly animation = new ProxyAnimation();
  /** @dartType double */
  private lastBounceAnimationValue = 0;
  private curvedAnimation: CurvedAnimation | null = null;
  private curvedAnimationReversed: CurvedAnimation | null = null;
  private positionAnimation!: Animation<Offset>;
  private lastDrag = Offset.zero;
  /** @dartReturn double
   * @dartParam screenHeight double */
  private yShift(screenHeight: number): number {
    /** @dartType double */
    const startTouchY = this.widget.startBackEvent?.touchOffset?.dy ?? 0;
    /** @dartType double */
    const currentTouchY = this.widget.currentBackEvent?.touchOffset?.dy ?? 0;
    /** @dartType double */
    const yShiftMax =
      screenHeight / PredictiveBackSharedElementPageTransitionState.divisionFactor -
      PredictiveBackSharedElementPageTransitionState.margin;
    /** @dartType double */
    const rawYShift = currentTouchY - startTouchY;
    /** @dartType double */
    const easedYShift =
      Curves.easeOut.transform(clampDouble(Math.abs(rawYShift) / screenHeight, 0, 1)) *
      Math.sign(rawYShift) *
      yShiftMax;
    return clampDouble(easedYShift, -yShiftMax, yShiftMax);
  }
  private updateAnimations(width: number, height: number): void {
    const commit = this.widget.phase === 'commit';
    this.animation.parent = commit ? this.curvedAnimationReversed : this.widget.animation;
    this.bounceAnimation.parent = commit
      ? new Tween<number>({ begin: 0, end: this.lastBounceAnimationValue }).animate(
          this.curvedAnimation!,
        )
      : new ReverseAnimation(this.widget.animation);
    this.commitAnimation.parent = commit ? this.animation : kAlwaysDismissedAnimation;
    /** @dartType double */
    const xShift =
      width / PredictiveBackSharedElementPageTransitionState.divisionFactor -
      PredictiveBackSharedElementPageTransitionState.margin;
    this.positionAnimation = new Tween<Offset>({
      begin: commit
        ? this.lastDrag
        : new Offset(
            this.widget.currentBackEvent?.swipeEdge === SwipeEdge.right ? -xShift : xShift,
            this.yShift(height),
          ),
      end: commit
        ? new Offset(height * PredictiveBackSharedElementPageTransitionState.yPositionFactor, 0)
        : Offset.zero,
    }).animate(this.animation);
  }
  private updateCurvedAnimations(): void {
    this.curvedAnimation?.dispose();
    this.curvedAnimationReversed?.dispose();
    this.curvedAnimation = new CurvedAnimation({
      parent: this.widget.animation,
      curve: PredictiveBackSharedElementPageTransitionState.commitInterval,
    });
    this.curvedAnimationReversed = new CurvedAnimation({
      parent: new ReverseAnimation(this.widget.animation),
      curve: PredictiveBackSharedElementPageTransitionState.commitInterval,
    });
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.updateCurvedAnimations();
    const media = MediaQuery.of(this.context);
    this.updateAnimations(media.width, media.height);
  }
  override didUpdateWidget(old: PredictiveBackSharedElementPageTransition): void {
    super.didUpdateWidget(old);
    if (old.animation !== this.widget.animation) this.updateCurvedAnimations();
    if (old.phase !== this.widget.phase && this.widget.phase === 'commit') {
      const media = MediaQuery.of(this.context);
      this.updateAnimations(media.width, media.height);
    }
  }
  override dispose(): void {
    this.animation.parent = null;
    this.bounceAnimation.parent = null;
    this.commitAnimation.parent = null;
    this.curvedAnimation?.dispose();
    this.curvedAnimationReversed?.dispose();
    super.dispose();
  }
  build(_context: BuildContext): Widget {
    return new AnimatedBuilder({
      animation: this.widget.animation,
      child: this.widget.child,
      builder: (context, child) => {
        this.lastBounceAnimationValue = this.bounceAnimation.value;
        const media = MediaQuery.of(context),
          position =
            this.widget.phase === 'commit'
              ? this.positionAnimation.value
              : (this.lastDrag = new Offset(
                  this.positionAnimation.value.dx,
                  this.yShift(media.height),
                ));
        return Transform.scale(
          Transform.translate(
            new Opacity(
              new ClipRRect(child ?? undefined, {
                borderRadius:
                  MediaQuery.displayCornerRadiiOf(context) ??
                  BorderRadius.circular(this.borderRadiusTween.evaluate(this.bounceAnimation)),
              }),
              { opacity: this.opacityTween.evaluate(this.commitAnimation) },
            ),
            position,
          ),
          { scale: this.scaleTween.evaluate(this.bounceAnimation) },
        );
      },
    });
  }
}

class PredictiveBackFullscreenPageTransition extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly animation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryAnimation: Animation<number>;
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  constructor(
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    readonly getIsCurrent: () => boolean,
    readonly phase: PredictiveBackPhase,
    readonly child: Widget,
  ) {
    super();
    this.animation = animation;
    this.secondaryAnimation = secondaryAnimation;
  }
  createState(): State {
    return new PredictiveBackFullscreenPageTransitionState();
  }
}
class PredictiveBackFullscreenPageTransitionState extends State<PredictiveBackFullscreenPageTransition> {
  /** @dartType double */
  private static readonly scaleStart = 1;
  /** @dartType double */
  private static readonly scaleCommit = 0.95;
  /** @dartType double */
  private static readonly opacityFullyOpened = 1;
  /** @dartType double */
  private static readonly opacityStartTransition = 0.95;
  /** @dartType double */
  private static readonly commitAt = 0.65;
  /** @dartType double */
  private static readonly weightPreCommit = PredictiveBackFullscreenPageTransitionState.commitAt;
  /** @dartType double */
  private static readonly weightPostCommit =
    1 - PredictiveBackFullscreenPageTransitionState.weightPreCommit;
  /** @dartType double */
  private static readonly screenWidthDivisionFactor = 20;
  /** @dartType double */
  private static readonly xShiftAdjustment = 8;
  private static readonly commitDuration = 100;
  /** @dartType Animatable<double> */
  private readonly primaryOpacityTween = new Tween<number>({
    begin: PredictiveBackFullscreenPageTransitionState.opacityStartTransition,
    end: PredictiveBackFullscreenPageTransitionState.opacityFullyOpened,
  });
  /** @dartType Animatable<double> */
  private readonly primaryScaleTween = sequence(
    PredictiveBackFullscreenPageTransitionState.scaleStart,
    PredictiveBackFullscreenPageTransitionState.scaleStart,
    PredictiveBackFullscreenPageTransitionState.scaleCommit,
    PredictiveBackFullscreenPageTransitionState.scaleStart,
  );
  /** @dartType ConstantTween<double> */
  private readonly secondaryScaleTweenCurrent = new ConstantTween<number>(
    PredictiveBackFullscreenPageTransitionState.scaleStart,
  );
  /** @dartType TweenSequence<double> */
  private readonly secondaryTweenScale = sequence(
    PredictiveBackFullscreenPageTransitionState.scaleCommit,
    PredictiveBackFullscreenPageTransitionState.scaleStart,
    PredictiveBackFullscreenPageTransitionState.scaleStart,
    PredictiveBackFullscreenPageTransitionState.scaleStart,
  );
  /** @dartType ConstantTween<double> */
  private readonly secondaryOpacityTweenCurrent = new ConstantTween<number>(
    PredictiveBackFullscreenPageTransitionState.opacityFullyOpened,
  );
  /** @dartType TweenSequence<double> */
  private readonly secondaryOpacityTween = sequence(
    PredictiveBackFullscreenPageTransitionState.opacityFullyOpened,
    PredictiveBackFullscreenPageTransitionState.opacityStartTransition,
    PredictiveBackFullscreenPageTransitionState.opacityFullyOpened,
    PredictiveBackFullscreenPageTransitionState.opacityFullyOpened,
  );
  private primaryPositionTween!: Animatable<Offset>;
  private secondaryPositionTween!: Animatable<Offset>;
  private secondaryCurrentPositionTween!: Animatable<Offset>;
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    /** @dartType double */
    const screenWidth = MediaQuery.of(this.context).width;
    /** @dartType double */
    const xShift =
      screenWidth / PredictiveBackFullscreenPageTransitionState.screenWidthDivisionFactor -
      PredictiveBackFullscreenPageTransitionState.xShiftAdjustment;
    this.primaryPositionTween = sequence(
      Offset.zero,
      Offset.zero,
      new Offset(xShift, 0),
      Offset.zero,
    );
    this.secondaryCurrentPositionTween = new ConstantTween(Offset.zero);
    this.secondaryPositionTween = new Tween({ begin: new Offset(xShift, 0), end: Offset.zero });
  }
  private secondaryBuilder(_context: BuildContext, child: Widget | null): Widget {
    const current = this.widget.getIsCurrent(),
      animation = this.widget.secondaryAnimation;
    return Transform.translate(
      Transform.scale(
        new Opacity(child ?? undefined, {
          opacity: (current
            ? this.secondaryOpacityTweenCurrent
            : this.secondaryOpacityTween
          ).evaluate(animation),
        }),
        {
          scale: (current ? this.secondaryScaleTweenCurrent : this.secondaryTweenScale).evaluate(
            animation,
          ),
        },
      ),
      (current ? this.secondaryCurrentPositionTween : this.secondaryPositionTween).evaluate(
        animation,
      ),
    );
  }
  private primaryBuilder(_context: BuildContext, child: Widget | null): Widget {
    return Transform.translate(
      Transform.scale(
        new Opacity(
          new AnimatedOpacity({
            opacity:
              this.widget.phase === 'commit'
                ? 0
                : this.widget.animation.value < PredictiveBackFullscreenPageTransitionState.commitAt
                  ? 0
                  : 1,
            duration: PredictiveBackFullscreenPageTransitionState.commitDuration,
            child,
          }),
          { opacity: this.primaryOpacityTween.evaluate(this.widget.animation) },
        ),
        { scale: this.primaryScaleTween.evaluate(this.widget.animation) },
      ),
      this.primaryPositionTween.evaluate(this.widget.animation),
    );
  }
  build(context: BuildContext): Widget {
    return new AnimatedBuilder({
      animation: this.widget.secondaryAnimation,
      builder: (context, child) => this.secondaryBuilder(context, child),
      child: new AnimatedBuilder({
        animation: this.widget.animation,
        builder: (context, child) => this.primaryBuilder(context, child),
        child: new ClipRRect(this.widget.child, {
          borderRadius:
            MediaQuery.displayCornerRadiiOf(context) ??
            BorderRadius.circular(
              PredictiveBackSharedElementPageTransitionState.deviceBorderRadius,
            ),
        }),
      }),
    });
  }
}
/** Own extraction of the source's repeated two-item recipe; parameter types carry no invented Dart signature. */
function sequence<T>(a: T, b: T, c: T, d: T): TweenSequence<T> {
  return new TweenSequence([
    new TweenSequenceItem({ tween: new Tween({ begin: a, end: b }), weight: 0.65 }),
    new TweenSequenceItem({ tween: new Tween({ begin: c, end: d }), weight: 1 - 0.65 }),
  ]);
}
