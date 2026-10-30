// SPDX-License-Identifier: BSD-3-Clause
import { ValueNotifier, ValueListenable } from '../../foundation/notifier.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { invariant } from '../../foundation/errors.ts';
import { Ticker } from './ticker.ts';
import type { TickerProvider } from './ticker.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
/** Pinned Source status and value/listener contract; legacy numeric helpers below remain compatible. */
export class AnimationStatus {
  static readonly dismissed = new AnimationStatus(0, 'dismissed');
  static readonly forward = new AnimationStatus(1, 'forward');
  static readonly reverse = new AnimationStatus(2, 'reverse');
  static readonly completed = new AnimationStatus(3, 'completed');
  static readonly values = Object.freeze([
    this.dismissed,
    this.forward,
    this.reverse,
    this.completed,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  get isDismissed(): boolean {
    return this === AnimationStatus.dismissed;
  }
  get isCompleted(): boolean {
    return this === AnimationStatus.completed;
  }
  get isAnimating(): boolean {
    return this === AnimationStatus.forward || this === AnimationStatus.reverse;
  }
  get isForwardOrCompleted(): boolean {
    return this === AnimationStatus.forward || this === AnimationStatus.completed;
  }
  toString(): string {
    return 'AnimationStatus.' + this.name;
  }
}
export type AnimationStatusListener = (status: AnimationStatus) => void;
export type ValueListenableTransformer<T> = (value: T) => T;
export abstract class Animation<T> extends ValueListenable<T> {
  static fromValueListenable<T>(
    listenable: ValueListenable<T>,
    { transformer = null }: { readonly transformer?: ValueListenableTransformer<T> | null } = {},
  ): Animation<T> {
    return new _ValueListenableDelegateAnimation(listenable, transformer);
  }
  abstract addStatusListener(listener: AnimationStatusListener): void;
  abstract removeStatusListener(listener: AnimationStatusListener): void;
  abstract get status(): AnimationStatus;
  get isDismissed(): boolean {
    return this.status.isDismissed;
  }
  get isCompleted(): boolean {
    return this.status.isCompleted;
  }
  get isAnimating(): boolean {
    return this.status.isAnimating;
  }
  get isForwardOrCompleted(): boolean {
    return this.status.isForwardOrCompleted;
  }
  drive<U>(child: { animate(parent: Animation<number>): Animation<U> }): Animation<U> {
    invariant(
      typeof this.value === 'number',
      'invalid-animation-drive',
      'Animatable.drive requires a numeric parent',
    );
    return child.animate(this as unknown as Animation<number>);
  }
  toString(): string {
    return `${describeIdentity(this)}(${this.toStringDetails()})`;
  }
  toStringDetails(): string {
    switch (this.status) {
      case AnimationStatus.forward:
        return '▶';
      case AnimationStatus.reverse:
        return '◀';
      case AnimationStatus.completed:
        return '⏭';
      default:
        return '⏮';
    }
  }
}
class _ValueListenableDelegateAnimation<T> extends Animation<T> {
  constructor(
    private readonly listenable: ValueListenable<T>,
    private readonly transformer: ValueListenableTransformer<T> | null,
  ) {
    super();
  }
  addListener(listener: () => void): void {
    this.listenable.addListener(listener);
  }
  removeListener(listener: () => void): void {
    this.listenable.removeListener(listener);
  }
  addStatusListener(_listener: AnimationStatusListener): void {}
  removeStatusListener(_listener: AnimationStatusListener): void {}
  get status(): AnimationStatus {
    return AnimationStatus.forward;
  }
  get value(): T {
    return this.transformer?.(this.listenable.value) ?? this.listenable.value;
  }
}
export type Curve = (t: number) => number;
export const linear: Curve = (t) => t;
export const easeInOut: Curve = (t) => t * t * (3 - 2 * t);
export class Tween {
  constructor(
    readonly begin: number,
    readonly end: number,
  ) {}
  transform(t: number): number {
    return this.begin + (this.end - this.begin) * t;
  }
}
export class AnimationController extends ValueNotifier<number> {
  private readonly ticker: Ticker;
  private animation:
    | {
        start: number;
        target: number;
        duration: number;
        curve: Curve;
        resolve: () => void;
        reject: (error: Error) => void;
      }
    | undefined;
  private animationClosed = false;
  constructor(
    vsync: FrameScheduler | TickerProvider,
    readonly duration = 300,
    value = 0,
  ) {
    super(value);
    this.ticker =
      'createTicker' in vsync
        ? vsync.createTicker((elapsed) => this.advance(elapsed))
        : new Ticker(vsync, (elapsed) => this.advance(elapsed));
  }
  animateTo(target: number, duration = this.duration, curve: Curve = linear): Promise<void> {
    invariant(
      !this.animationClosed &&
        Number.isFinite(target) &&
        Number.isFinite(duration) &&
        duration >= 0,
      'invalid-animation',
      'Animation target/duration must be finite and controller live',
    );
    this.stop();
    if (duration === 0) {
      this.value = target;
      return Promise.resolve();
    }
    const promise = new Promise<void>((resolve, reject) => {
      this.animation = { start: this.value, target, duration, curve, resolve, reject };
    });
    this.ticker.start();
    return promise;
  }
  forward(): Promise<void> {
    return this.animateTo(1);
  }
  reverse(): Promise<void> {
    return this.animateTo(0);
  }
  setMuted(owner: object, muted: boolean): void {
    this.ticker.setMuted(owner, muted);
  }
  private advance(elapsed: number): void {
    const animation = this.animation;
    if (!animation) return;
    const t = Math.min(1, elapsed / animation.duration);
    this.value = new Tween(animation.start, animation.target).transform(animation.curve(t));
    if (this.animation !== animation) return;
    if (t === 1) {
      this.animation = undefined;
      this.ticker.stop();
      animation.resolve();
    }
  }
  stop(): void {
    this.ticker.stop();
    const previous = this.animation;
    this.animation = undefined;
    if (previous) {
      const error = new Error('Animation canceled');
      error.name = 'AbortError';
      previous.reject(error);
    }
  }
  override dispose(): void {
    if (this.animationClosed) return;
    this.animationClosed = true;
    this.stop();
    this.ticker.dispose();
    super.dispose();
  }
}
