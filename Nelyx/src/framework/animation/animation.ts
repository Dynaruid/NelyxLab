// SPDX-License-Identifier: BSD-3-Clause
import { ValueListenable } from '../../foundation/notifier.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { invariant } from '../../foundation/errors.ts';
/** Pinned Source status and value/listener contract. */
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
