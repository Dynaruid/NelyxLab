// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter rendering/tweens.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { Tween } from '../animation/tween.ts';
import { Alignment, AlignmentGeometry } from '../painting/alignment.ts';

export class AlignmentTween extends Tween<Alignment> {
  override lerp(t: number): Alignment {
    return Alignment.lerp(this.begin, this.end, t)!;
  }
}
export class AlignmentGeometryTween extends Tween<AlignmentGeometry | null> {
  override lerp(t: number): AlignmentGeometry | null {
    return AlignmentGeometry.lerp(this.begin, this.end, t);
  }
}
