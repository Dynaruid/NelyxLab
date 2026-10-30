// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol('BottomNavigationBarType');
export class BottomNavigationBarType {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'fixed' | 'shifting',
    own: typeof token,
  ) {
    if (own !== token) throw new TypeError('Expected a canonical BottomNavigationBarType');
    this.index = index;
    Object.freeze(this);
  }
  static readonly fixed = new BottomNavigationBarType(0, 'fixed', token);
  static readonly shifting = new BottomNavigationBarType(1, 'shifting', token);
  static readonly values: readonly BottomNavigationBarType[] = Object.freeze([
    BottomNavigationBarType.fixed,
    BottomNavigationBarType.shifting,
  ]);
  toString(): string {
    return 'BottomNavigationBarType.' + this.name;
  }
}
Object.freeze(BottomNavigationBarType.prototype);
Object.freeze(BottomNavigationBarType);
