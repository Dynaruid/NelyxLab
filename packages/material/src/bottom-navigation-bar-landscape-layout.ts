// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol('BottomNavigationBarLandscapeLayout');
export class BottomNavigationBarLandscapeLayout {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'spread' | 'centered' | 'linear',
    own: typeof token,
  ) {
    if (own !== token)
      throw new TypeError('Expected a canonical BottomNavigationBarLandscapeLayout');
    this.index = index;
    Object.freeze(this);
  }
  static readonly spread = new BottomNavigationBarLandscapeLayout(0, 'spread', token);
  static readonly centered = new BottomNavigationBarLandscapeLayout(1, 'centered', token);
  static readonly linear = new BottomNavigationBarLandscapeLayout(2, 'linear', token);
  static readonly values: readonly BottomNavigationBarLandscapeLayout[] = Object.freeze([
    BottomNavigationBarLandscapeLayout.spread,
    BottomNavigationBarLandscapeLayout.centered,
    BottomNavigationBarLandscapeLayout.linear,
  ]);
  toString(): string {
    return 'BottomNavigationBarLandscapeLayout.' + this.name;
  }
}
Object.freeze(BottomNavigationBarLandscapeLayout.prototype);
Object.freeze(BottomNavigationBarLandscapeLayout);
