// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol("PopupMenuPosition");
export class PopupMenuPosition {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "over" | "under", own: typeof token) { if (own !== token) throw new TypeError("Expected a canonical PopupMenuPosition"); this.index = index; Object.freeze(this); }
  static readonly over = new PopupMenuPosition(0, "over", token);
  static readonly under = new PopupMenuPosition(1, "under", token);
  static readonly values: readonly PopupMenuPosition[] = Object.freeze([PopupMenuPosition.over, PopupMenuPosition.under]);
  toString(): string { return "PopupMenuPosition." + this.name; }
}
Object.freeze(PopupMenuPosition.prototype);
Object.freeze(PopupMenuPosition);
