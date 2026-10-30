// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { describeIdentity } from '../../foundation/diagnostics-identity.ts';
import { fixed } from '../../ui/value-math.ts';
import { Curves } from '../animation/curves.ts';
import type { Curve } from '../animation/curves.ts';

export class ScrollDirection {
  static readonly idle = new ScrollDirection(0, 'idle');
  static readonly forward = new ScrollDirection(1, 'forward');
  static readonly reverse = new ScrollDirection(2, 'reverse');
  static readonly values = Object.freeze([
    ScrollDirection.idle,
    ScrollDirection.forward,
    ScrollDirection.reverse,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'ScrollDirection.' + this.name;
  }
}
export function flipScrollDirection(direction: ScrollDirection): ScrollDirection {
  switch (direction) {
    case ScrollDirection.idle:
      return direction;
    case ScrollDirection.forward:
      return ScrollDirection.reverse;
    case ScrollDirection.reverse:
      return ScrollDirection.forward;
    default:
      throw new TypeError('Unknown ScrollDirection');
  }
}
export interface ViewportAnimationOptions {
  readonly duration: number;
  readonly curve: Curve;
}
export interface ViewportMoveOptions {
  readonly duration?: number | null;
  readonly curve?: Curve | null;
  readonly clamp?: boolean | null;
}
/** Source duration boundary uses milliseconds; the View owns any animation clock. */
export abstract class ViewportOffset extends ChangeNotifier {
  constructor() {
    super();
    ChangeNotifier.maybeDispatchObjectCreation(this);
  }
  static fixed(value: number): ViewportOffset {
    return new _FixedViewportOffset(value);
  }
  static zero(): ViewportOffset {
    return new _FixedViewportOffset(0);
  }
  abstract get pixels(): number;
  abstract get hasPixels(): boolean;
  abstract applyViewportDimension(viewportDimension: number): boolean;
  abstract applyContentDimensions(minScrollExtent: number, maxScrollExtent: number): boolean;
  abstract correctBy(correction: number): void;
  abstract jumpTo(pixels: number): void;
  abstract animateTo(to: number, options: ViewportAnimationOptions): Promise<void>;
  abstract get userScrollDirection(): ScrollDirection;
  abstract get allowImplicitScrolling(): boolean;
  moveTo(to: number, { duration, curve }: ViewportMoveOptions = {}): Promise<void> {
    if (duration == null || duration === 0) {
      this.jumpTo(to);
      return Promise.resolve();
    }
    return this.animateTo(to, { duration, curve: curve ?? Curves.ease });
  }
  debugFillDescription(description: string[]): void {
    if (this.hasPixels) description.push('offset: ' + fixed(this.pixels));
  }
  override toString(): string {
    const description: string[] = [];
    this.debugFillDescription(description);
    return `${describeIdentity(this)}(${description.join(', ')})`;
  }
}
class _FixedViewportOffset extends ViewportOffset {
  constructor(private _pixels: number) {
    super();
  }
  get pixels(): number {
    return this._pixels;
  }
  get hasPixels(): boolean {
    return true;
  }
  applyViewportDimension(_viewportDimension: number): boolean {
    return true;
  }
  applyContentDimensions(_minScrollExtent: number, _maxScrollExtent: number): boolean {
    return true;
  }
  correctBy(correction: number): void {
    this._pixels += correction;
  }
  jumpTo(_pixels: number): void {}
  async animateTo(_to: number, _options: ViewportAnimationOptions): Promise<void> {}
  get userScrollDirection(): ScrollDirection {
    return ScrollDirection.idle;
  }
  get allowImplicitScrolling(): boolean {
    return false;
  }
}
