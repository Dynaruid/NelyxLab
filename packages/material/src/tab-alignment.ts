// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol("TabAlignment");
export class TabAlignment {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "start" | "startOffset" | "fill" | "center", own: typeof token) { if (own !== token) throw new TypeError("Expected a canonical TabAlignment"); this.index = index; Object.freeze(this); }
  static readonly start = new TabAlignment(0, "start", token);
  static readonly startOffset = new TabAlignment(1, "startOffset", token);
  static readonly fill = new TabAlignment(2, "fill", token);
  static readonly center = new TabAlignment(3, "center", token);
  static readonly values: readonly TabAlignment[] = Object.freeze([TabAlignment.start, TabAlignment.startOffset, TabAlignment.fill, TabAlignment.center]);
  toString(): string { return "TabAlignment." + this.name; }
}
Object.freeze(TabAlignment.prototype);
Object.freeze(TabAlignment);
