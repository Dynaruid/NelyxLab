// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter physics/tolerance.dart; positional construction remains compatible.
import { objectRuntimeType } from '../../foundation/object.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { protect } from '../../ui/value-math.ts';
export interface ToleranceOptions {
  readonly distance?: number;
  readonly time?: number;
  readonly velocity?: number;
}
export class Tolerance {
  private static readonly _epsilonDefault: number = 0.001;
  static readonly defaultTolerance: Tolerance = new Tolerance();
  readonly distance: number;
  readonly time: number;
  readonly velocity: number;
  constructor(
    distance: number | ToleranceOptions = Tolerance._epsilonDefault,
    time: number = Tolerance._epsilonDefault,
    velocity: number = Tolerance._epsilonDefault,
  ) {
    this.distance =
      typeof distance === 'number' ? distance : (distance.distance ?? Tolerance._epsilonDefault);
    this.time = typeof distance === 'number' ? time : (distance.time ?? Tolerance._epsilonDefault);
    this.velocity =
      typeof distance === 'number' ? velocity : (distance.velocity ?? Tolerance._epsilonDefault);
    protect(this, ['distance', 'time', 'velocity']);
  }
  toString(): string {
    return `${objectRuntimeType(this, 'Tolerance')}(distance: ±${diagnosticDoubleString(this.distance)}, time: ±${diagnosticDoubleString(this.time)}, velocity: ±${diagnosticDoubleString(this.velocity)})`;
  }
}
