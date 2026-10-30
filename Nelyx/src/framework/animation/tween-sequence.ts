// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter animation/tween_sequence.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { Animatable } from './tween.ts';
import type { TweenSequenceItem } from './tween-sequence-item.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
class Interval {
  constructor(
    readonly start: number,
    readonly end: number,
  ) {
    if (FoundationBuildMode.debug)
      invariant(
        end > start,
        'invalid-tween-sequence-interval',
        'Tween sequence interval must be increasing',
      );
  }
  contains(t: number): boolean {
    return t >= this.start && t < this.end;
  }
  value(t: number): number {
    return (t - this.start) / (this.end - this.start);
  }
  toString(): string {
    return `<${this.start}, ${this.end}>`;
  }
}
export class TweenSequence<T> extends Animatable<T> {
  private readonly items: readonly TweenSequenceItem<T>[];
  private readonly intervals: Interval[] = [];
  constructor(items: readonly TweenSequenceItem<T>[]) {
    super();
    if (FoundationBuildMode.debug)
      invariant(items.length > 0, 'empty-tween-sequence', 'TweenSequence requires items');
    this.items = [...items];
    let totalWeight = 0;
    for (const item of this.items) totalWeight += item.weight;
    if (FoundationBuildMode.debug)
      invariant(
        totalWeight > 0,
        'invalid-tween-sequence-total',
        'Tween sequence total weight must be positive',
      );
    let start = 0;
    for (let i = 0; i < this.items.length; i++) {
      const end = i === this.items.length - 1 ? 1 : start + this.items[i]!.weight / totalWeight;
      this.intervals.push(new Interval(start, end));
      start = end;
    }
  }
  private evaluateAt(t: number, index: number): T {
    return this.items[index]!.tween.transform(this.intervals[index]!.value(t));
  }
  transform(t: number): T {
    if (FoundationBuildMode.debug)
      invariant(
        t >= 0 && t <= 1,
        'invalid-tween-sequence-progress',
        'TweenSequence progress must be in [0,1]',
      );
    if (t === 1) return this.evaluateAt(t, this.items.length - 1);
    for (let index = 0; index < this.items.length; index++)
      if (this.intervals[index]!.contains(t)) return this.evaluateAt(t, index);
    throw new Error(`StateError: TweenSequence.evaluate() could not find an interval for ${t}`);
  }
  toString(): string {
    return `TweenSequence(${this.items.length} items)`;
  }
}
export class FlippedTweenSequence extends TweenSequence<number> {
  override transform(t: number): number {
    return 1 - super.transform(1 - t);
  }
}
