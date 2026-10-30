// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import type { Animation } from '../animation/animation.ts';
import { AnimationStatus } from '../animation/animation.ts';
import {
  ProxyAnimation,
  ReverseAnimation,
  kAlwaysCompleteAnimation,
  kAlwaysDismissedAnimation,
} from '../animation/animations.ts';
/** @dartType Widget Function(BuildContext, Animation<double>, Widget?) */
export type AnimatedTransitionBuilder = (
  context: BuildContext,
  animation: Animation<number>,
  child: Widget | null,
) => Widget;
export interface DualTransitionBuilderOptions extends WidgetOptions {
  /** @dartType Animation<double> */
  readonly animation: Animation<number>;
  /** @dartType Widget Function(BuildContext, Animation<double>, Widget?) */
  readonly forwardBuilder: AnimatedTransitionBuilder;
  /** @dartType Widget Function(BuildContext, Animation<double>, Widget?) */
  readonly reverseBuilder: AnimatedTransitionBuilder;
  readonly child?: Widget | null;
}
/** A reversal in the middle of a transition keeps the current visual recipe. */
export class DualTransitionBuilder extends StatefulWidget {
  /** @dartType Animation<double> */
  readonly animation: Animation<number>;
  /** @dartType Widget Function(BuildContext, Animation<double>, Widget?) */
  readonly forwardBuilder: AnimatedTransitionBuilder;
  /** @dartType Widget Function(BuildContext, Animation<double>, Widget?) */
  readonly reverseBuilder: AnimatedTransitionBuilder;
  readonly child: Widget | null;
  /** @dartParam animation Animation<double>
   * @dartParam forwardBuilder Widget Function(BuildContext, Animation<double>, Widget?)
   * @dartParam reverseBuilder Widget Function(BuildContext, Animation<double>, Widget?) */
  constructor({
    animation,
    forwardBuilder,
    reverseBuilder,
    child = null,
    key = null,
  }: DualTransitionBuilderOptions) {
    super(key);
    this.animation = animation;
    this.forwardBuilder = forwardBuilder;
    this.reverseBuilder = reverseBuilder;
    this.child = child;
  }
  createState(): State {
    return new DualTransitionBuilderState();
  }
}
class DualTransitionBuilderState extends State<DualTransitionBuilder> {
  private effective!: AnimationStatus;
  private readonly forwardAnimation = new ProxyAnimation();
  private readonly reverseAnimation = new ProxyAnimation();
  private readonly changed = (current: AnimationStatus) => {
    const old = this.effective;
    if (!current.isAnimating || !old.isAnimating || current === old) this.effective = current;
    if (old !== this.effective) this.updateAnimations();
  };
  override initState(): void {
    super.initState();
    this.effective = this.widget.animation.status;
    this.widget.animation.addStatusListener(this.changed);
    this.updateAnimations();
  }
  override didUpdateWidget(old: DualTransitionBuilder): void {
    super.didUpdateWidget(old);
    if (old.animation !== this.widget.animation) {
      old.animation.removeStatusListener(this.changed);
      this.widget.animation.addStatusListener(this.changed);
      this.changed(this.widget.animation.status);
    }
  }
  private updateAnimations(): void {
    if (
      this.effective === AnimationStatus.dismissed ||
      this.effective === AnimationStatus.forward
    ) {
      this.forwardAnimation.parent = this.widget.animation;
      this.reverseAnimation.parent = kAlwaysDismissedAnimation;
    } else {
      this.forwardAnimation.parent = kAlwaysCompleteAnimation;
      this.reverseAnimation.parent = new ReverseAnimation(this.widget.animation);
    }
  }
  override dispose(): void {
    this.widget.animation.removeStatusListener(this.changed);
    super.dispose();
  }
  build(context: BuildContext): Widget {
    return this.widget.forwardBuilder(
      context,
      this.forwardAnimation,
      this.widget.reverseBuilder(context, this.reverseAnimation, this.widget.child),
    );
  }
}
