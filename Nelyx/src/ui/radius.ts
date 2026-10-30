// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui geometry.dart at the recorded upstream pin.
import { number, clamp, lerp, modulo, truncateDivide, hashDoubles, fixed } from './value-math.ts';
export interface RadiusClampOptions {
  readonly minimum?: Radius | null;
  readonly maximum?: Radius | null;
}
export interface RadiusClampValuesOptions {
  readonly minimumX?: number | null;
  readonly minimumY?: number | null;
  readonly maximumX?: number | null;
  readonly maximumY?: number | null;
}
export class Radius {
  readonly #horizontal: number;
  readonly #vertical: number;
  constructor(x: number, y: number = x) {
    this.#horizontal = number(x);
    this.#vertical = number(y);
  }
  get x(): number {
    return this.#horizontal;
  }
  get y(): number {
    return this.#vertical;
  }
  static circular(radius: number): Radius {
    return new Radius(radius, radius);
  }
  static elliptical(x: number, y: number): Radius {
    return new Radius(x, y);
  }
  static readonly zero = Radius.circular(0);
  clamp(options: RadiusClampOptions = {}): Radius {
    const minimum = options.minimum ?? Radius.circular(-Infinity),
      maximum = options.maximum ?? Radius.circular(Infinity);
    return new Radius(clamp(this.x, minimum.x, maximum.x), clamp(this.y, minimum.y, maximum.y));
  }
  clampValues(options: RadiusClampValuesOptions = {}): Radius {
    return new Radius(
      clamp(this.x, options.minimumX ?? -Infinity, options.maximumX ?? Infinity),
      clamp(this.y, options.minimumY ?? -Infinity, options.maximumY ?? Infinity),
    );
  }
  negate(): Radius {
    return new Radius(-this.x, -this.y);
  }
  subtract(other: Radius): Radius {
    return new Radius(this.x - other.x, this.y - other.y);
  }
  add(other: Radius): Radius {
    return new Radius(this.x + other.x, this.y + other.y);
  }
  multiply(operand: number): Radius {
    return new Radius(this.x * operand, this.y * operand);
  }
  divide(operand: number): Radius {
    return new Radius(this.x / operand, this.y / operand);
  }
  truncateDivide(operand: number): Radius {
    return new Radius(truncateDivide(this.x, operand), truncateDivide(this.y, operand));
  }
  modulo(operand: number): Radius {
    return new Radius(modulo(this.x, operand), modulo(this.y, operand));
  }
  static lerp(a: Radius | null, b: Radius | null, t: number): Radius | null {
    if (b === null) return a === null ? null : new Radius(a.x * (1 - t), a.y * (1 - t));
    if (a === null) return new Radius(b.x * t, b.y * t);
    return new Radius(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof Radius &&
        this.constructor === other.constructor &&
        other.x === this.x &&
        other.y === this.y)
    );
  }
  get hashCode(): number {
    return hashDoubles([this.x, this.y]);
  }
  toString(): string {
    return this.x === this.y
      ? `Radius.circular(${fixed(this.x)})`
      : `Radius.elliptical(${fixed(this.x)}, ${fixed(this.y)})`;
  }
}
