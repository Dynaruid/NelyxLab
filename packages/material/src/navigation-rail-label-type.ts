// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol('NavigationRailLabelType');
export class NavigationRailLabelType {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'none' | 'selected' | 'all',
    own: typeof token,
  ) {
    if (own !== token) throw new TypeError('Expected a canonical NavigationRailLabelType');
    this.index = index;
    Object.freeze(this);
  }
  static readonly none = new NavigationRailLabelType(0, 'none', token);
  static readonly selected = new NavigationRailLabelType(1, 'selected', token);
  static readonly all = new NavigationRailLabelType(2, 'all', token);
  static readonly values: readonly NavigationRailLabelType[] = Object.freeze([
    NavigationRailLabelType.none,
    NavigationRailLabelType.selected,
    NavigationRailLabelType.all,
  ]);
  toString(): string {
    return 'NavigationRailLabelType.' + this.name;
  }
}
Object.freeze(NavigationRailLabelType.prototype);
Object.freeze(NavigationRailLabelType);
