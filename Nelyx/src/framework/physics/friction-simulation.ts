// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Simulation } from './simulation.ts';
import type { SimulationOptions } from './simulation.ts';
import { Tolerance } from './tolerance.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { clampDouble as clamp } from '../../ui/math.ts';
import { fixed } from '../../ui/value-math.ts';
function newtonsMethod({
  initialGuess,
  target,
  f,
  df,
  iterations,
}: {
  initialGuess: number;
  target: number;
  f: (time: number) => number;
  df: (time: number) => number;
  iterations: number;
}): number {
  let guess = initialGuess;
  for (let i = 0; i < iterations; i++) guess = guess - (f(guess) - target) / df(guess);
  return guess;
}
export interface FrictionSimulationOptions extends SimulationOptions {
  readonly constantDeceleration?: number;
}
export class FrictionSimulation extends Simulation {
  protected readonly _drag: number;
  private readonly _dragLog: number;
  protected readonly _x: number;
  protected readonly _v: number;
  private readonly _constantDeceleration: number;
  private _finalTime = Infinity;
  constructor(
    drag: number,
    position: number,
    velocity: number,
    {
      tolerance = Tolerance.defaultTolerance,
      constantDeceleration = 0,
    }: FrictionSimulationOptions = {},
  ) {
    super({ tolerance });
    this._drag = drag;
    this._dragLog = Math.log(drag);
    this._x = position;
    this._v = velocity;
    this._constantDeceleration = constantDeceleration * Math.sign(velocity);
    this._finalTime = newtonsMethod({
      initialGuess: 0,
      target: 0,
      f: (time) => this.dx(time),
      df: (time) =>
        this._v * Math.pow(this._drag, time) * this._dragLog - this._constantDeceleration,
      iterations: 10,
    });
  }
  static through(
    startPosition: number,
    endPosition: number,
    startVelocity: number,
    endVelocity: number,
  ): FrictionSimulation {
    if (FoundationBuildMode.debug) {
      invariant(
        startVelocity === 0 ||
          endVelocity === 0 ||
          Math.sign(startVelocity) === Math.sign(endVelocity),
        'invalid-friction-directions',
        'Velocities must have the same direction',
      );
      invariant(
        Math.abs(startVelocity) >= Math.abs(endVelocity),
        'invalid-friction-speed',
        'Start velocity must not be slower',
      );
      invariant(
        Math.sign(endPosition - startPosition) === Math.sign(startVelocity),
        'invalid-friction-destination',
        'Destination must follow the velocity',
      );
    }
    return new FrictionSimulation(
      FrictionSimulation._dragFor(startPosition, endPosition, startVelocity, endVelocity),
      startPosition,
      startVelocity,
      { tolerance: new Tolerance({ velocity: Math.abs(endVelocity) }) },
    );
  }
  private static _dragFor(
    startPosition: number,
    endPosition: number,
    startVelocity: number,
    endVelocity: number,
  ): number {
    return Math.pow(Math.E, (startVelocity - endVelocity) / (startPosition - endPosition));
  }
  x(time: number): number {
    if (time > this._finalTime) return this.finalX;
    return (
      this._x +
      (this._v * Math.pow(this._drag, time)) / this._dragLog -
      this._v / this._dragLog -
      (this._constantDeceleration / 2) * time * time
    );
  }
  dx(time: number): number {
    return time > this._finalTime
      ? 0
      : this._v * Math.pow(this._drag, time) - this._constantDeceleration * time;
  }
  get finalX(): number {
    return this._constantDeceleration === 0
      ? this._x - this._v / this._dragLog
      : this.x(this._finalTime);
  }
  timeAtX(x: number): number {
    if (x === this._x) return 0;
    if (
      this._v === 0 ||
      (this._v > 0 ? x < this._x || x > this.finalX : x > this._x || x < this.finalX)
    )
      return Infinity;
    return newtonsMethod({
      target: x,
      initialGuess: 0,
      f: (time) => this.x(time),
      df: (time) => this.dx(time),
      iterations: 10,
    });
  }
  isDone(time: number): boolean {
    return Math.abs(this.dx(time)) < this.tolerance.velocity;
  }
  override toString(): string {
    return `${objectRuntimeType(this, 'FrictionSimulation')}(cₓ: ${fixed(this._drag)}, x₀: ${fixed(this._x)}, dx₀: ${fixed(this._v)})`;
  }
}
export class BoundedFrictionSimulation extends FrictionSimulation {
  constructor(
    drag: number,
    position: number,
    velocity: number,
    private readonly _minX: number,
    private readonly _maxX: number,
  ) {
    super(drag, position, velocity);
    if (FoundationBuildMode.debug)
      invariant(
        clamp(position, _minX, _maxX) === position,
        'invalid-bounded-friction-start',
        'Initial position must be in bounds',
      );
  }
  override x(time: number): number {
    return clamp(super.x(time), this._minX, this._maxX);
  }
  override isDone(time: number): boolean {
    return (
      super.isDone(time) ||
      Math.abs(this.x(time) - this._minX) < this.tolerance.distance ||
      Math.abs(this.x(time) - this._maxX) < this.tolerance.distance
    );
  }
  override toString(): string {
    return `${objectRuntimeType(this, 'BoundedFrictionSimulation')}(cₓ: ${fixed(this._drag)}, x₀: ${fixed(this._x)}, dx₀: ${fixed(this._v)}, x: ${fixed(this._minX)}..${fixed(this._maxX)})`;
  }
}
