// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Simulation } from '../physics/simulation.ts';
import type { SimulationOptions } from '../physics/simulation.ts';
import { FrictionSimulation } from '../physics/friction-simulation.ts';
import { ScrollSpringSimulation } from '../physics/spring-simulation.ts';
import type { SpringDescription } from '../physics/spring-simulation.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { clampDouble as clamp } from '../../ui/math.ts';
import { protect } from '../../ui/value-math.ts';
export interface BouncingScrollSimulationOptions extends SimulationOptions {
  readonly position: number;
  readonly velocity: number;
  readonly leadingExtent: number;
  readonly trailingExtent: number;
  readonly spring: SpringDescription;
  readonly constantDeceleration?: number;
}
export class BouncingScrollSimulation extends Simulation {
  static readonly maxSpringTransferVelocity = 5000;
  readonly leadingExtent: number;
  readonly trailingExtent: number;
  readonly spring: SpringDescription;
  private _frictionSimulation!: FrictionSimulation;
  private _springSimulation!: Simulation;
  private _springTime: number;
  private _timeOffset = 0;
  constructor({
    position,
    velocity,
    leadingExtent,
    trailingExtent,
    spring,
    constantDeceleration = 0,
    ...options
  }: BouncingScrollSimulationOptions) {
    super(options);
    this.leadingExtent = leadingExtent;
    this.trailingExtent = trailingExtent;
    this.spring = spring;
    protect(this, ['leadingExtent', 'trailingExtent', 'spring']);
    if (FoundationBuildMode.debug)
      invariant(
        leadingExtent <= trailingExtent,
        'invalid-bouncing-extents',
        'Scroll extents must be ordered',
      );
    if (position < leadingExtent) {
      this._springSimulation = this._underscrollSimulation(position, velocity);
      this._springTime = -Infinity;
    } else if (position > trailingExtent) {
      this._springSimulation = this._overscrollSimulation(position, velocity);
      this._springTime = -Infinity;
    } else {
      this._frictionSimulation = new FrictionSimulation(0.135, position, velocity, {
        constantDeceleration,
      });
      const finalX = this._frictionSimulation.finalX;
      if (velocity > 0 && finalX > trailingExtent) {
        this._springTime = this._frictionSimulation.timeAtX(trailingExtent);
        this._springSimulation = this._overscrollSimulation(
          trailingExtent,
          Math.min(
            this._frictionSimulation.dx(this._springTime),
            BouncingScrollSimulation.maxSpringTransferVelocity,
          ),
        );
        if (FoundationBuildMode.debug)
          invariant(
            Number.isFinite(this._springTime),
            'invalid-bounce-transition',
            'Spring transfer time must be finite',
          );
      } else if (velocity < 0 && finalX < leadingExtent) {
        this._springTime = this._frictionSimulation.timeAtX(leadingExtent);
        this._springSimulation = this._underscrollSimulation(
          leadingExtent,
          Math.min(
            this._frictionSimulation.dx(this._springTime),
            BouncingScrollSimulation.maxSpringTransferVelocity,
          ),
        );
        if (FoundationBuildMode.debug)
          invariant(
            Number.isFinite(this._springTime),
            'invalid-bounce-transition',
            'Spring transfer time must be finite',
          );
      } else this._springTime = Infinity;
    }
  }
  private _underscrollSimulation(x: number, dx: number): Simulation {
    return new ScrollSpringSimulation(this.spring, x, this.leadingExtent, dx);
  }
  private _overscrollSimulation(x: number, dx: number): Simulation {
    return new ScrollSpringSimulation(this.spring, x, this.trailingExtent, dx);
  }
  private _simulation(time: number): Simulation {
    let simulation: Simulation;
    if (time > this._springTime) {
      this._timeOffset = Number.isFinite(this._springTime) ? this._springTime : 0;
      simulation = this._springSimulation;
    } else {
      this._timeOffset = 0;
      simulation = this._frictionSimulation;
    }
    simulation.tolerance = this.tolerance;
    return simulation;
  }
  x(time: number): number {
    return this._simulation(time).x(time - this._timeOffset);
  }
  dx(time: number): number {
    return this._simulation(time).dx(time - this._timeOffset);
  }
  isDone(time: number): boolean {
    return this._simulation(time).isDone(time - this._timeOffset);
  }
  override toString(): string {
    return `${objectRuntimeType(this, 'BouncingScrollSimulation')}(leadingExtent: ${diagnosticDoubleString(this.leadingExtent)}, trailingExtent: ${diagnosticDoubleString(this.trailingExtent)})`;
  }
}
export interface ClampingScrollSimulationOptions extends SimulationOptions {
  readonly position: number;
  readonly velocity: number;
  readonly friction?: number;
}
export class ClampingScrollSimulation extends Simulation {
  readonly position: number;
  readonly velocity: number;
  readonly friction: number;
  private readonly _duration: number;
  private readonly _distance: number;
  private static readonly _kDecelerationRate = Math.log(0.78) / Math.log(0.9);
  private static readonly _kInflexion = 0.35;
  private static readonly _physicalCoeff = 9.80665 * 39.37 * 160 * 0.84;
  constructor({
    position,
    velocity,
    friction = 0.015,
    ...options
  }: ClampingScrollSimulationOptions) {
    super(options);
    this.position = position;
    this.velocity = velocity;
    this.friction = friction;
    this._duration = this._flingDuration();
    this._distance = this._flingDistance();
    protect(this, ['position', 'velocity', 'friction']);
  }
  private _flingDuration(): number {
    const referenceVelocity =
        (this.friction * ClampingScrollSimulation._physicalCoeff) /
        ClampingScrollSimulation._kInflexion,
      androidDuration = Math.pow(
        Math.abs(this.velocity) / referenceVelocity,
        1 / (ClampingScrollSimulation._kDecelerationRate - 1),
      );
    return (
      ClampingScrollSimulation._kDecelerationRate *
      ClampingScrollSimulation._kInflexion *
      androidDuration
    );
  }
  private _flingDistance(): number {
    const distance = (this.velocity * this._duration) / ClampingScrollSimulation._kDecelerationRate;
    if (FoundationBuildMode.debug) {
      const referenceVelocity =
          (this.friction * ClampingScrollSimulation._physicalCoeff) /
          ClampingScrollSimulation._kInflexion,
        logVelocity = Math.log(Math.abs(this.velocity) / referenceVelocity),
        again =
          this.friction *
          ClampingScrollSimulation._physicalCoeff *
          Math.exp(
            (logVelocity * ClampingScrollSimulation._kDecelerationRate) /
              (ClampingScrollSimulation._kDecelerationRate - 1),
          );
      invariant(
        Math.abs(Math.abs(distance) - again) < this.tolerance.distance,
        'inconsistent-clamping-fling',
        'Fling distance must match the source ballistic formulation',
      );
    }
    return distance;
  }
  x(time: number): number {
    const t = clamp(time / this._duration, 0, 1);
    return (
      this.position +
      this._distance * (1 - Math.pow(1 - t, ClampingScrollSimulation._kDecelerationRate))
    );
  }
  dx(time: number): number {
    const t = clamp(time / this._duration, 0, 1);
    return this.velocity * Math.pow(1 - t, ClampingScrollSimulation._kDecelerationRate - 1);
  }
  isDone(time: number): boolean {
    return time >= this._duration;
  }
}
