// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { protect, hashDoubles, checkedInteger } from './value-math.ts';
export const TextAffinity = Object.freeze({
  upstream: 'upstream',
  downstream: 'downstream',
} as const);
export type TextAffinity = (typeof TextAffinity)[keyof typeof TextAffinity];
export class TextPosition {
  readonly offset: number;
  readonly affinity: TextAffinity;
  constructor({
    offset,
    affinity = TextAffinity.downstream,
  }: {
    readonly offset: number;
    readonly affinity?: TextAffinity;
  }) {
    this.offset = checkedInteger(offset);
    this.affinity = affinity;
    protect(this, ['offset', 'affinity']);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof TextPosition &&
      other.constructor === this.constructor &&
      other.offset === this.offset &&
      other.affinity === this.affinity
    );
  }
  get hashCode(): number {
    return hashDoubles([this.offset, this.affinity === TextAffinity.upstream ? 0 : 1]);
  }
  toString(): string {
    return `TextPosition(offset: ${this.offset}, affinity: TextAffinity.${this.affinity})`;
  }
}
