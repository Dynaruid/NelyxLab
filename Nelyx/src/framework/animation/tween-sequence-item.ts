// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/animation/tween_sequence.dart; SHA256 a3028f8dc8cdef63d17ad1527d8f8db87703ae76de60e204da77ee0699dfa5a3
import { Animatable } from './tween.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
export class TweenSequenceItem<T> {
  readonly tween: Animatable<T>;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly weight: number;
  /**
   * @dartParam weight double
   * @dartParamOrigin weight inferred
   */
  constructor({ tween, weight }: { readonly tween: Animatable<T>; readonly weight: number }) {
    if (FoundationBuildMode.debug)
      invariant(
        weight > 0,
        'invalid-tween-sequence-weight',
        'Tween sequence weight must be positive',
      );
    this.tween = tween;
    this.weight = weight;
    protect(this, ['tween', 'weight']);
  }
}
