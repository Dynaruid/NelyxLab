// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Offset } from '../ui/offset.ts';
import { invariant } from '../foundation/errors.ts';
import { hashValues } from '../framework/painting/value-equality.ts';

export const SwipeEdge = Object.freeze({ left: 'left', right: 'right' } as const);
export type SwipeEdge = (typeof SwipeEdge)[keyof typeof SwipeEdge];
export class PredictiveBackEvent {
  /** @dartType double */
  readonly progress: number;
  /** @dartParam progress double */
  private constructor(
    readonly touchOffset: Offset | null,
    progress: number,
    readonly swipeEdge: SwipeEdge,
  ) {
    this.progress = progress;
    Object.freeze(this);
  }
  static fromMap(map: ReadonlyMap<string | null, unknown>): PredictiveBackEvent {
    const touch = map.get('touchOffset'),
      progress = map.get('progress'),
      edge = map.get('swipeEdge');
    invariant(
      typeof progress === 'number' && Number.isFinite(progress) && progress >= 0 && progress <= 1,
      'invalid-back-progress',
      'Back progress must be between zero and one',
    );
    invariant(edge === 0 || edge === 1, 'invalid-back-edge', 'Back swipe edge must be zero or one');
    invariant(
      touch == null ||
        (Array.isArray(touch) &&
          touch.length >= 2 &&
          typeof touch[0] === 'number' &&
          typeof touch[1] === 'number'),
      'invalid-back-touch',
      'Back touch must be a numeric pair or null',
    );
    return new PredictiveBackEvent(
      touch == null ? null : new Offset(touch[0], touch[1]),
      progress,
      edge === 0 ? SwipeEdge.left : SwipeEdge.right,
    );
  }
  get isButtonEvent(): boolean {
    return (
      this.touchOffset === null || (this.progress === 0 && this.touchOffset.equals(Offset.zero))
    );
  }
  equals(other: unknown): boolean {
    return (
      other instanceof PredictiveBackEvent &&
      (this.touchOffset === null
        ? other.touchOffset === null
        : other.touchOffset !== null && this.touchOffset.equals(other.touchOffset)) &&
      this.progress === other.progress &&
      this.swipeEdge === other.swipeEdge
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(this.touchOffset, this.progress, this.swipeEdge);
  }
  toString(): string {
    return `PredictiveBackEvent{touchOffset: ${this.touchOffset}, progress: ${this.progress}, swipeEdge: SwipeEdge.${this.swipeEdge}}`;
  }
}
