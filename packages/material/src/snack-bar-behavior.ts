// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol("SnackBarBehavior");
export class SnackBarBehavior {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "fixed" | "floating", own: typeof token) { if (own !== token) throw new TypeError("Expected a canonical SnackBarBehavior"); this.index = index; Object.freeze(this); }
  static readonly fixed = new SnackBarBehavior(0, "fixed", token);
  static readonly floating = new SnackBarBehavior(1, "floating", token);
  static readonly values: readonly SnackBarBehavior[] = Object.freeze([SnackBarBehavior.fixed, SnackBarBehavior.floating]);
  toString(): string { return "SnackBarBehavior." + this.name; }
}
Object.freeze(SnackBarBehavior.prototype);
Object.freeze(SnackBarBehavior);
