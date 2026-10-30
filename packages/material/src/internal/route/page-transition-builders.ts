// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { PageTransitionsBuilder } from '@nelyx/core/framework/widgets/page-transitions-builder';
import type { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { ReverseAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { Tween, CurveTween } from '@nelyx/core/framework/animation/tween';
import { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import { DualTransitionBuilder } from '@nelyx/core/framework/widgets/dual-transition-builder';
import { FadeTransition, SlideTransition } from '@nelyx/core/framework/widgets/transitions';
import type { DelegatedTransitionBuilder } from '@nelyx/core/framework/widgets/transitions';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { routeOpacityOf } from '@nelyx/core/framework/widgets/navigation';
import { materialTransitionThemeOf } from '../theme/transition-theme-context.ts';
import { Colors } from '../../colors.ts';
import {
  createZoomTransition,
  createZoomNoCacheTransition,
  zoomSnapshotAwareDelegatedTransition,
} from './zoom-transition.ts';
import { zoomProfileForceDisableSnapshotting } from './zoom-profile.ts';

const transitionCurve = Curves.easeInOutCubicEmphasized;
const forwardTranslation = new Tween<Offset>({
  begin: new Offset(0.25, 0),
  end: Offset.zero,
}).chain(new CurveTween({ curve: transitionCurve }));
const backwardTranslation = new Tween<Offset>({
  begin: Offset.zero,
  end: new Offset(0.25, 0),
}).chain(new CurveTween({ curve: transitionCurve }));
const secondaryBackwardTranslation = new Tween<Offset>({
  begin: Offset.zero,
  end: new Offset(-0.25, 0),
}).chain(new CurveTween({ curve: transitionCurve }));
const secondaryForwardTranslation = new Tween<Offset>({
  begin: new Offset(-0.25, 0),
  end: Offset.zero,
}).chain(new CurveTween({ curve: transitionCurve }));
/** @dartType Animatable<double> */
const fadeInTransition = new Tween<number>({ begin: 0, end: 1 }).chain(
  new CurveTween({ curve: new Interval(0, 0.75) }),
);
/** @dartType Animatable<double> */
const fadeOutTransition = new Tween<number>({ begin: 1, end: 0 }).chain(
  new CurveTween({ curve: new Interval(0, 0.25) }),
);

/** @dartParam secondaryAnimation Animation<double> */
function delegatedTransition(
  context: BuildContext,
  secondaryAnimation: Animation<number>,
  backgroundColor: Color | null,
  child: Widget | null,
): Widget {
  const builder = new DualTransitionBuilder({
    animation: new ReverseAnimation(secondaryAnimation),
    forwardBuilder: (_context, animation, child) =>
      new FadeTransition({
        opacity: fadeInTransition.animate(animation),
        child: new SlideTransition({
          position: secondaryForwardTranslation.animate(animation),
          child,
        }),
      }),
    reverseBuilder: (_context, animation, child) =>
      new FadeTransition({
        opacity: fadeOutTransition.animate(animation),
        child: new SlideTransition({
          position: secondaryBackwardTranslation.animate(animation),
          child,
        }),
      }),
    child,
  });
  if (!(routeOpacityOf(context) ?? true)) return builder;
  const color = secondaryAnimation.isAnimating
    ? (backgroundColor ?? new Color(materialTransitionThemeOf(context).colorScheme.surface))
    : Colors.transparent;
  return new ColoredBox({ color: color.toARGB32(), child: builder });
}

class FadeForwardsPageTransition extends StatelessWidget {
  /** @dartType Animation<double> */
  private readonly animation: Animation<number>;
  /** @dartType Animation<double> */
  private readonly secondaryAnimation: Animation<number>;
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  constructor(
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    private readonly backgroundColor: Color | null,
    private readonly child: Widget | null,
  ) {
    super();
    this.animation = animation;
    this.secondaryAnimation = secondaryAnimation;
  }
  build(context: BuildContext): Widget {
    return new DualTransitionBuilder({
      animation: this.animation,
      forwardBuilder: (_context, animation, child) =>
        new FadeTransition({
          opacity: fadeInTransition.animate(animation),
          child: new SlideTransition({ position: forwardTranslation.animate(animation), child }),
        }),
      reverseBuilder: (_context, animation, child) =>
        new IgnorePointer(
          new FadeTransition({
            opacity: fadeOutTransition.animate(animation),
            child: new SlideTransition({ position: backwardTranslation.animate(animation), child }),
          }),
          { ignoring: animation.status === AnimationStatus.forward },
        ),
      child: delegatedTransition(
        context,
        this.secondaryAnimation,
        this.backgroundColor,
        this.child,
      ),
    });
  }
}

export interface FadeForwardsPageTransitionsBuilderOptions {
  readonly backgroundColor?: Color | null;
}
/** Android U transition recipe. Platform default theme selection is separate. */
export class FadeForwardsPageTransitionsBuilder extends PageTransitionsBuilder {
  readonly backgroundColor: Color | null;
  /** @dartType int */
  static readonly kTransitionMilliseconds = 450;
  constructor({ backgroundColor = null }: FadeForwardsPageTransitionsBuilderOptions = {}) {
    super();
    this.backgroundColor = backgroundColor;
  }
  override get transitionDuration(): number {
    return FadeForwardsPageTransitionsBuilder.kTransitionMilliseconds;
  }
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  override get delegatedTransition(): DelegatedTransitionBuilder {
    return (context, _animation, secondaryAnimation, _allowSnapshotting, child) =>
      delegatedTransition(context, secondaryAnimation, this.backgroundColor, child);
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions<T>(
    _route: PageRoute<T> | null,
    _context: BuildContext | null,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new FadeForwardsPageTransition(
      animation,
      secondaryAnimation,
      this.backgroundColor,
      child,
    );
  }
}

export interface ZoomPageTransitionsBuilderOptions {
  readonly allowSnapshotting?: boolean;
  readonly allowEnterRouteSnapshotting?: boolean;
  readonly backgroundColor?: Color | null;
}
export class ZoomPageTransitionsBuilder extends PageTransitionsBuilder {
  readonly allowSnapshotting: boolean;
  readonly allowEnterRouteSnapshotting: boolean;
  readonly backgroundColor: Color | null;
  constructor({
    allowSnapshotting = true,
    allowEnterRouteSnapshotting = true,
    backgroundColor = null,
  }: ZoomPageTransitionsBuilderOptions = {}) {
    super();
    this.allowSnapshotting = allowSnapshotting;
    this.allowEnterRouteSnapshotting = allowEnterRouteSnapshotting;
    this.backgroundColor = backgroundColor;
  }
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  override get delegatedTransition(): DelegatedTransitionBuilder {
    return (context, animation, secondaryAnimation, allowSnapshotting, child) =>
      zoomSnapshotAwareDelegatedTransition(
        context,
        animation,
        secondaryAnimation,
        child,
        allowSnapshotting && this.allowSnapshotting,
        this.allowEnterRouteSnapshotting,
        this.backgroundColor,
      );
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
    if (zoomProfileForceDisableSnapshotting())
      return createZoomNoCacheTransition(animation, secondaryAnimation, child);
    return createZoomTransition(
      animation,
      secondaryAnimation,
      this.allowSnapshotting && route.allowSnapshotting,
      this.allowEnterRouteSnapshotting,
      this.backgroundColor,
      child,
    );
  }
}
