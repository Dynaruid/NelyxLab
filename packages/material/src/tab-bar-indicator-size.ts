// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol("TabBarIndicatorSize");
export class TabBarIndicatorSize {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "tab" | "label", own: typeof token) { if (own !== token) throw new TypeError("Expected a canonical TabBarIndicatorSize"); this.index = index; Object.freeze(this); }
  static readonly tab = new TabBarIndicatorSize(0, "tab", token);
  static readonly label = new TabBarIndicatorSize(1, "label", token);
  static readonly values: readonly TabBarIndicatorSize[] = Object.freeze([TabBarIndicatorSize.tab, TabBarIndicatorSize.label]);
  toString(): string { return "TabBarIndicatorSize." + this.name; }
}
Object.freeze(TabBarIndicatorSize.prototype);
Object.freeze(TabBarIndicatorSize);
