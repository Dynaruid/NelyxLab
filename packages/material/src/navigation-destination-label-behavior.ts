// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const enumToken = Symbol("NavigationDestinationLabelBehavior");
export class NavigationDestinationLabelBehavior {
  private readonly enumBrand = enumToken;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "alwaysShow" | "alwaysHide" | "onlyShowSelected", token: typeof enumToken) { if (token !== enumToken) throw new TypeError("Expected a canonical NavigationDestinationLabelBehavior"); this.index = index; Object.freeze(this); }
  static readonly alwaysShow = new NavigationDestinationLabelBehavior(0, "alwaysShow", enumToken);
  static readonly alwaysHide = new NavigationDestinationLabelBehavior(1, "alwaysHide", enumToken);
  static readonly onlyShowSelected = new NavigationDestinationLabelBehavior(2, "onlyShowSelected", enumToken);
  static readonly values: readonly NavigationDestinationLabelBehavior[] = Object.freeze([NavigationDestinationLabelBehavior.alwaysShow, NavigationDestinationLabelBehavior.alwaysHide, NavigationDestinationLabelBehavior.onlyShowSelected]);
  toString(): string { return "NavigationDestinationLabelBehavior." + this.name; }
}
Object.freeze(NavigationDestinationLabelBehavior.prototype);
Object.freeze(NavigationDestinationLabelBehavior);
