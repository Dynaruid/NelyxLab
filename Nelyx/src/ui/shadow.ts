// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui Shadow at the pinned painting.dart.
import { invariant } from '../foundation/errors.ts';
import { Offset } from './offset.ts';
import type { Offset as OffsetInput } from './geometry.ts';
import { Paint } from './paint.ts';
import { MaskFilter } from './mask-filter.ts';
import { lerpArgb } from './color-values.ts';
import { hashDoubles } from './value-math.ts';
export interface ShadowOptions {
  readonly color?: number;
  readonly offset?: OffsetInput;
  readonly blurRadius?: number;
}
export class Shadow {
  readonly color: number;
  readonly offset: Offset;
  readonly blurRadius: number;
  constructor({ color = 0xff000000, offset = Offset.zero, blurRadius = 0 }: ShadowOptions = {}) {
    invariant(
      Number.isFinite(blurRadius) && blurRadius >= 0,
      'invalid-shadow',
      'Text shadow blur radius should be non-negative.',
    );
    this.color = color;
    this.offset = offset instanceof Offset ? offset : new Offset(offset.x, offset.y);
    this.blurRadius = blurRadius;
  }
  static convertRadiusToSigma(radius: number): number {
    return radius > 0 ? radius * 0.57735 + 0.5 : 0;
  }
  get blurSigma(): number {
    return Shadow.convertRadiusToSigma(this.blurRadius);
  }
  toPaint(): Paint {
    return new Paint({ color: this.color, maskFilter: MaskFilter.blur('normal', this.blurSigma) });
  }
  scale(factor: number): Shadow {
    return new Shadow({
      color: this.color,
      offset: this.offset.multiply(factor),
      blurRadius: this.blurRadius * factor,
    });
  }
  static lerp(a: Shadow | null, b: Shadow | null, t: number): Shadow | null {
    if (b === null) return a === null ? null : a.scale(1 - t);
    if (a === null) return b.scale(t);
    return new Shadow({
      color: lerpArgb(a.color, b.color, t)!,
      offset: Offset.lerp(a.offset, b.offset, t)!,
      blurRadius: a.blurRadius * (1 - t) + b.blurRadius * t,
    });
  }
  static lerpList(
    a: readonly Shadow[] | null,
    b: readonly Shadow[] | null,
    t: number,
  ): readonly Shadow[] | null {
    if (a === null && b === null) return null;
    const left = a ?? [],
      right = b ?? [],
      common = Math.min(left.length, right.length),
      result: Shadow[] = [];
    for (let n = 0; n < common; n++) result.push(Shadow.lerp(left[n]!, right[n]!, t)!);
    for (let n = common; n < left.length; n++) result.push(left[n]!.scale(1 - t));
    for (let n = common; n < right.length; n++) result.push(right[n]!.scale(t));
    return result;
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof Shadow &&
        other.color === this.color &&
        other.offset.equals(this.offset) &&
        other.blurRadius === this.blurRadius)
    );
  }
  get hashCode(): number {
    return hashDoubles([this.color, this.offset.hashCode, this.blurRadius]);
  }
  toString(): string {
    return `TextShadow(0x${this.color.toString(16)}, ${this.offset}, ${this.blurRadius})`;
  }
}
