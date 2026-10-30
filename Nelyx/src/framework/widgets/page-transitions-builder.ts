// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State, StatelessWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { PageRoute } from './pages.ts';
import type { Animation } from '../animation/animation.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { Cubic, Curves } from '../animation/curves.ts';
import { CurveTween, Tween } from '../animation/tween.ts';
import { Offset } from '../../ui/offset.ts';
import { Color } from '../../ui/color.ts';
import { Listenable } from '../../foundation/notifier.ts';
import { Alignment } from '../painting/alignment.ts';
import { Align, ColoredBox, SizedBox } from './basic.ts';
import { LayoutBuilder } from './layout-builder.ts';
import { ClipRect } from './clip.ts';
import { OverflowBox } from './overflow-box.ts';
import { FractionalTranslation } from './fractional-translation.ts';
import { AnimatedBuilder, FadeTransition, SlideTransition } from './transitions.ts';
import type { DelegatedTransitionBuilder } from './transitions.ts';
/** Source builder policy on the canonical Core route/animation/widget owners. */
export abstract class PageTransitionsBuilder {
  /** @dartReturn Widget? Function(BuildContext, Animation<double>, Animation<double>, bool, Widget?)? */
  get delegatedTransition(): DelegatedTransitionBuilder | null {
    return null;
  }
  get transitionDuration(): number {
    return 300;
  }
  get reverseTransitionDuration(): number {
    return this.transitionDuration;
  }
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  abstract buildTransitions<T>(
    route: PageRoute<T>,
    context: BuildContext,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget;
}
class FadeUpwardsPageTransition extends StatelessWidget {
  /** @dartType Animatable<double> */
  private static readonly fastOutSlowInTween = new CurveTween({ curve: Curves.fastOutSlowIn });
  /** @dartType Animatable<double> */
  private static readonly easeInTween = new CurveTween({ curve: Curves.easeIn });
  private readonly position: Animation<Offset>;
  /** @dartType Animation<double> */
  private readonly opacity: Animation<number>;
  /** @dartParam animation Animation<double> */
  constructor(
    animation: Animation<number>,
    private readonly child: Widget,
  ) {
    super();
    this.position = new Tween<Offset>({ begin: new Offset(0, 0.25), end: Offset.zero })
      .chain(FadeUpwardsPageTransition.fastOutSlowInTween)
      .animate(animation);
    this.opacity = FadeUpwardsPageTransition.easeInTween.animate(animation);
  }
  build(): Widget {
    return new SlideTransition({
      position: this.position,
      child: new FadeTransition({ opacity: this.opacity, child: this.child }),
    });
  }
}
export class FadeUpwardsPageTransitionsBuilder extends PageTransitionsBuilder {
  /** @dartParam animation Animation<double>
   * @dartParam _secondaryAnimation Animation<double>? */
  override buildTransitions<T>(
    _route: PageRoute<T> | null,
    _context: BuildContext | null,
    animation: Animation<number>,
    _secondaryAnimation: Animation<number> | null,
    child: Widget,
  ): Widget {
    return new FadeUpwardsPageTransition(animation, child);
  }
}
const primaryTranslation = new Tween<Offset>({ begin: new Offset(0, 0.05), end: Offset.zero });
const secondaryTranslation = new Tween<Offset>({ begin: Offset.zero, end: new Offset(0, -0.025) });
/** @dartType Tween<double> */
const scrimOpacity = new Tween<number>({ begin: 0, end: 0.25 });
const transitionCurve = new Cubic(0.2, 0, 0, 1);
class OpenUpwardsPageTransition extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly animation: Animation<number>;
  /** @dartType Animation<double> */
  readonly secondaryAnimation: Animation<number>;
  readonly child: Widget;
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  constructor(animation: Animation<number>, secondaryAnimation: Animation<number>, child: Widget) {
    super();
    this.animation = animation;
    this.secondaryAnimation = secondaryAnimation;
    this.child = child;
  }
  createState(): State {
    return new OpenUpwardsPageTransitionState();
  }
}
class OpenUpwardsPageTransitionState extends State<OpenUpwardsPageTransition> {
  private primary!: CurvedAnimation;
  private secondary!: CurvedAnimation;
  override initState(): void {
    super.initState();
    this.setAnimations();
  }
  override didUpdateWidget(old: OpenUpwardsPageTransition): void {
    super.didUpdateWidget(old);
    if (
      old.animation !== this.widget.animation ||
      old.secondaryAnimation !== this.widget.secondaryAnimation
    ) {
      this.disposeAnimations();
      this.setAnimations();
    }
  }
  private setAnimations(): void {
    this.primary = new CurvedAnimation({
      parent: this.widget.animation,
      curve: transitionCurve,
      reverseCurve: transitionCurve.flipped,
    });
    this.secondary = new CurvedAnimation({
      parent: this.widget.secondaryAnimation,
      curve: transitionCurve,
      reverseCurve: transitionCurve.flipped,
    });
  }
  private disposeAnimations(): void {
    this.primary.dispose();
    this.secondary.dispose();
  }
  override dispose(): void {
    this.disposeAnimations();
    super.dispose();
  }
  build(): Widget {
    return new LayoutBuilder((_context, constraints) => {
      const size = constraints.biggest,
        clip = new Tween<number>({ begin: 0, end: size.height }).animate(this.primary),
        opacity = scrimOpacity.animate(this.primary),
        primary = primaryTranslation.animate(this.primary),
        secondary = secondaryTranslation.animate(this.secondary);
      return new AnimatedBuilder({
        animation: Listenable.merge([this.widget.animation, this.widget.secondaryAnimation]),
        builder: () =>
          new ColoredBox({
            color: new Color(0xff000000).withOpacity(opacity.value).toARGB32(),
            child: new Align(
              new ClipRect(
                new SizedBox(
                  undefined,
                  clip.value,
                  new OverflowBox(
                    new FractionalTranslation(
                      new FractionalTranslation(this.widget.child, { translation: primary.value }),
                      { translation: secondary.value },
                    ),
                    { alignment: Alignment.bottomLeft, maxHeight: size.height },
                  ),
                ),
              ),
              { alignment: Alignment.bottomLeft },
            ),
          }),
      });
    });
  }
}
export class OpenUpwardsPageTransitionsBuilder extends PageTransitionsBuilder {
  /** @dartParam animation Animation<double>
   * @dartParam secondaryAnimation Animation<double> */
  override buildTransitions<T>(
    _route: PageRoute<T> | null,
    _context: BuildContext | null,
    animation: Animation<number>,
    secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new OpenUpwardsPageTransition(animation, secondaryAnimation, child);
  }
}
