// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui geometry.dart at the recorded upstream pin.
import { OffsetBase } from './offset-base.ts';
import { Rect } from './rect.ts';
import type { Size } from './size.ts';
import { lerp, modulo, truncateDivide, fixed } from './value-math.ts';

/** Immutable point/vector; x/y also satisfy Nelyx's structural coordinate DTO. */
export class Offset extends OffsetBase {
  constructor(dx: number, dy: number) {
    super(dx, dy);
  }
  static fromDirection(direction: number, distance = 1): Offset {
    return new Offset(distance * Math.cos(direction), distance * Math.sin(direction));
  }
  static readonly zero = new Offset(0, 0);
  static readonly infinite = new Offset(Infinity, Infinity);
  get dx(): number {
    return this.horizontal;
  }
  get dy(): number {
    return this.vertical;
  }
  get x(): number {
    return this.dx;
  }
  get y(): number {
    return this.dy;
  }
  get distance(): number {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
  }
  get distanceSquared(): number {
    return this.dx * this.dx + this.dy * this.dy;
  }
  get direction(): number {
    return Math.atan2(this.dy, this.dx);
  }
  scale(scaleX: number, scaleY: number): Offset {
    return new Offset(this.dx * scaleX, this.dy * scaleY);
  }
  translate(translateX: number, translateY: number): Offset {
    return new Offset(this.dx + translateX, this.dy + translateY);
  }
  negate(): Offset {
    return new Offset(-this.dx, -this.dy);
  }
  subtract(other: Offset): Offset {
    return new Offset(this.dx - other.dx, this.dy - other.dy);
  }
  add(other: Offset): Offset {
    return new Offset(this.dx + other.dx, this.dy + other.dy);
  }
  multiply(operand: number): Offset {
    return new Offset(this.dx * operand, this.dy * operand);
  }
  divide(operand: number): Offset {
    return new Offset(this.dx / operand, this.dy / operand);
  }
  truncateDivide(operand: number): Offset {
    return new Offset(truncateDivide(this.dx, operand), truncateDivide(this.dy, operand));
  }
  modulo(operand: number): Offset {
    return new Offset(modulo(this.dx, operand), modulo(this.dy, operand));
  }
  /** Named form of Dart's Offset & Size rectangle constructor. */
  and(other: Size): Rect {
    return Rect.fromLTWH(this.dx, this.dy, other.width, other.height);
  }
  static lerp(a: Offset | null, b: Offset | null, t: number): Offset | null {
    if (b === null) return a === null ? null : a.multiply(1 - t);
    if (a === null) return b.multiply(t);
    return new Offset(lerp(a.dx, b.dx, t), lerp(a.dy, b.dy, t));
  }
  override equals(other: unknown): boolean {
    return other instanceof Offset && other.dx === this.dx && other.dy === this.dy;
  }
  override toString(): string {
    return `Offset(${fixed(this.dx)}, ${fixed(this.dy)})`;
  }
}
