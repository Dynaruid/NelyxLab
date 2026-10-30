// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol('TabIndicatorAnimation');
export class TabIndicatorAnimation {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'linear' | 'elastic',
    own: typeof token,
  ) {
    if (own !== token) throw new TypeError('Expected a canonical TabIndicatorAnimation');
    this.index = index;
    Object.freeze(this);
  }
  static readonly linear = new TabIndicatorAnimation(0, 'linear', token);
  static readonly elastic = new TabIndicatorAnimation(1, 'elastic', token);
  static readonly values: readonly TabIndicatorAnimation[] = Object.freeze([
    TabIndicatorAnimation.linear,
    TabIndicatorAnimation.elastic,
  ]);
  toString(): string {
    return 'TabIndicatorAnimation.' + this.name;
  }
}
Object.freeze(TabIndicatorAnimation.prototype);
Object.freeze(TabIndicatorAnimation);
