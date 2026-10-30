// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/physics/spring_simulation.dart; SHA256 a8e90c8791e2b83aab7356d6af3017e319b7ba5c7a7cd560296edec04c3fa148
import { Simulation } from './simulation.ts';
import { nearZero } from './utils.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { fixed } from '../../ui/value-math.ts';
import { fixedOne } from '../../ui/value-math.ts';
import { protect } from '../../ui/value-math.ts';
import { checkedInteger } from '../../ui/value-math.ts';
import { roundInteger } from '../../ui/value-math.ts';
import type { SimulationOptions } from './simulation.ts';
export class SpringDescription {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly mass: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly stiffness: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly damping: number;
  /**
   * @dartParam mass double
   * @dartParamOrigin mass inferred
   * @dartParam stiffness double
   * @dartParamOrigin stiffness inferred
   * @dartParam damping double
   * @dartParamOrigin damping inferred
   */
  constructor({
    mass,
    stiffness,
    damping,
  }: {
    readonly mass: number;
    readonly stiffness: number;
    readonly damping: number;
  }) {
    this.mass = mass;
    this.stiffness = stiffness;
    this.damping = damping;
    protect(this, ['mass', 'stiffness', 'damping']);
  }
  get duration(): number {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const durationInSeconds: number = Math.sqrt(
      (4 * 3.141592653589793 * 3.141592653589793 * this.mass) / this.stiffness,
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const milliseconds: number = checkedInteger(
      roundInteger(durationInSeconds * checkedInteger(1000)),
    );
    return 0 + checkedInteger(milliseconds) * 1;
  }
  /**
   * @dartReturn double
   * @dartReturnOrigin explicit
   */
  get bounce(): number {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const dampingRatio: number = this.damping / (2 * Math.sqrt(this.mass * this.stiffness));
    return dampingRatio < 1 ? 1 - dampingRatio : 1 / dampingRatio - 1;
  }
  toString(): string {
    return `${objectRuntimeType(this, 'SpringDescription')}(mass: ${fixedOne(this.mass, 1)}, stiffness: ${fixedOne(this.stiffness, 1)}, damping: ${fixedOne(this.damping, 1)})`;
  }
  /**
   * @dartParam mass double
   * @dartParamOrigin mass inferred
   * @dartParam stiffness double
   * @dartParamOrigin stiffness inferred
   * @dartParam ratio double
   * @dartParamOrigin ratio explicit
   */
  static withDampingRatio({
    mass,
    stiffness,
    ratio = 1,
  }: {
    readonly mass: number;
    readonly stiffness: number;
    readonly ratio?: number;
  }): SpringDescription {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = ratio * 2 * Math.sqrt(mass * stiffness);
    return new SpringDescription({ mass: mass, stiffness: stiffness, damping: _initialField0 });
  }
  /**
   * @dartParam bounce double
   * @dartParamOrigin bounce explicit
   */
  static withDurationAndBounce({
    duration = 0 + 500 * 1,
    bounce = 0,
  }: {
    readonly duration?: number;
    readonly bounce?: number;
  } = {}): SpringDescription {
    if (FoundationBuildMode.debug)
      invariant(
        checkedInteger(Math.trunc(duration)) > 0,
        'invalid-spring-duration',
        'Duration must be positive',
      );
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const durationInSeconds: number = checkedInteger(Math.trunc(duration)) / checkedInteger(1000);
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const mass: number = 1;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const stiffness: number =
      (4 * 3.141592653589793 * 3.141592653589793 * mass) / Math.pow(durationInSeconds, 2);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const dampingRatio: number = bounce > 0 ? 1 - bounce : 1 / (bounce + 1);
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    const damping: number = dampingRatio * 2 * Math.sqrt(mass * stiffness);
    return new SpringDescription({ mass: mass, stiffness: stiffness, damping: damping });
  }
}

// Composed manual declarations: tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/spring-simulation.manual.ts
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Explicit existing simulation ports; only SpringDescription is generated.
export interface SpringDescriptionOptions {
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
}
export interface SpringDampingRatioOptions {
  readonly mass: number;
  readonly stiffness: number;
  readonly ratio?: number;
}
/** The TypeScript duration boundary uses integer milliseconds, as the app clock does. */
export interface SpringDurationOptions {
  readonly duration?: number;
  readonly bounce?: number;
}
export class SpringType {
  static readonly criticallyDamped = new SpringType(0, 'criticallyDamped');
  static readonly underDamped = new SpringType(1, 'underDamped');
  static readonly overDamped = new SpringType(2, 'overDamped');
  static readonly values = Object.freeze([
    SpringType.criticallyDamped,
    SpringType.underDamped,
    SpringType.overDamped,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SpringType.' + this.name;
  }
}
export interface SpringSimulationOptions extends SimulationOptions {
  readonly snapToEnd?: boolean;
}
export class SpringSimulation extends Simulation {
  protected readonly _endPosition: number;
  private readonly _solution: SpringSolution;
  private readonly _snapToEnd: boolean;
  constructor(
    spring: SpringDescription,
    start: number,
    end: number,
    velocity: number,
    { snapToEnd = false, ...options }: SpringSimulationOptions = {},
  ) {
    super(options);
    this._endPosition = end;
    this._solution = createSpringSolution(spring, start - end, velocity);
    this._snapToEnd = snapToEnd;
  }
  get type(): SpringType {
    return this._solution.type;
  }
  x(time: number): number {
    return this._snapToEnd && this.isDone(time)
      ? this._endPosition
      : this._endPosition + this._solution.x(time);
  }
  dx(time: number): number {
    return this._snapToEnd && this.isDone(time) ? 0 : this._solution.dx(time);
  }
  isDone(time: number): boolean {
    return (
      nearZero(this._solution.x(time), this.tolerance.distance) &&
      nearZero(this._solution.dx(time), this.tolerance.velocity)
    );
  }
  override toString(): string {
    return `${objectRuntimeType(this, 'SpringSimulation')}(end: ${fixed(this._endPosition)}, ${this.type})`;
  }
}
export class ScrollSpringSimulation extends SpringSimulation {
  override x(time: number): number {
    return this.isDone(time) ? this._endPosition : super.x(time);
  }
}
abstract class SpringSolution {
  abstract x(time: number): number;
  abstract dx(time: number): number;
  abstract get type(): SpringType;
}
function createSpringSolution(
  spring: SpringDescription,
  position: number,
  velocity: number,
): SpringSolution {
  const discriminant = spring.damping * spring.damping - 4 * spring.mass * spring.stiffness;
  return discriminant > 0
    ? OverdampedSolution.fromSpring(spring, position, velocity)
    : discriminant < 0
      ? UnderdampedSolution.fromSpring(spring, position, velocity)
      : CriticalSolution.fromSpring(spring, position, velocity);
}
class CriticalSolution extends SpringSolution {
  static fromSpring(
    spring: SpringDescription,
    distance: number,
    velocity: number,
  ): CriticalSolution {
    const r = -spring.damping / (2 * spring.mass),
      c1 = distance,
      c2 = velocity - r * distance;
    return new CriticalSolution(r, c1, c2);
  }
  constructor(
    private readonly _r: number,
    private readonly _c1: number,
    private readonly _c2: number,
  ) {
    super();
  }
  x(time: number): number {
    return (this._c1 + this._c2 * time) * Math.pow(Math.E, this._r * time);
  }
  dx(time: number): number {
    const power = Math.pow(Math.E, this._r * time);
    return this._r * (this._c1 + this._c2 * time) * power + this._c2 * power;
  }
  get type(): SpringType {
    return SpringType.criticallyDamped;
  }
}
class OverdampedSolution extends SpringSolution {
  static fromSpring(
    spring: SpringDescription,
    distance: number,
    velocity: number,
  ): OverdampedSolution {
    const cmk = spring.damping * spring.damping - 4 * spring.mass * spring.stiffness,
      r1 = (-spring.damping - Math.sqrt(cmk)) / (2 * spring.mass),
      r2 = (-spring.damping + Math.sqrt(cmk)) / (2 * spring.mass),
      c2 = (velocity - r1 * distance) / (r2 - r1),
      c1 = distance - c2;
    return new OverdampedSolution(r1, r2, c1, c2);
  }
  constructor(
    private readonly _r1: number,
    private readonly _r2: number,
    private readonly _c1: number,
    private readonly _c2: number,
  ) {
    super();
  }
  x(time: number): number {
    return (
      this._c1 * Math.pow(Math.E, this._r1 * time) + this._c2 * Math.pow(Math.E, this._r2 * time)
    );
  }
  dx(time: number): number {
    return (
      this._c1 * this._r1 * Math.pow(Math.E, this._r1 * time) +
      this._c2 * this._r2 * Math.pow(Math.E, this._r2 * time)
    );
  }
  get type(): SpringType {
    return SpringType.overDamped;
  }
}
class UnderdampedSolution extends SpringSolution {
  static fromSpring(
    spring: SpringDescription,
    distance: number,
    velocity: number,
  ): UnderdampedSolution {
    const w =
        Math.sqrt(4 * spring.mass * spring.stiffness - spring.damping * spring.damping) /
        (2 * spring.mass),
      r = -spring.damping / 2 / spring.mass,
      c1 = distance,
      c2 = (velocity - r * distance) / w;
    return new UnderdampedSolution(w, r, c1, c2);
  }
  constructor(
    private readonly _w: number,
    private readonly _r: number,
    private readonly _c1: number,
    private readonly _c2: number,
  ) {
    super();
  }
  x(time: number): number {
    return (
      Math.pow(Math.E, this._r * time) *
      (this._c1 * Math.cos(this._w * time) + this._c2 * Math.sin(this._w * time))
    );
  }
  dx(time: number): number {
    const power = Math.pow(Math.E, this._r * time),
      cosine = Math.cos(this._w * time),
      sine = Math.sin(this._w * time);
    return (
      power * (this._c2 * this._w * cosine - this._c1 * this._w * sine) +
      this._r * power * (this._c2 * sine + this._c1 * cosine)
    );
  }
  get type(): SpringType {
    return SpringType.underDamped;
  }
}
