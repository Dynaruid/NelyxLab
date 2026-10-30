// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const enumToken = Symbol('IconAlignment');
export class IconAlignment {
  private readonly enumBrand = enumToken;
  /** @dartType int */ readonly index: number;
  /** @dartParam index int */ private constructor(
    index: number,
    readonly name: 'start' | 'end',
    token: typeof enumToken,
  ) {
    if (token !== enumToken) throw new TypeError('IconAlignment requires a canonical enum value');
    this.index = index;
    Object.freeze(this);
  }
  static readonly start = new IconAlignment(0, 'start', enumToken);
  static readonly end = new IconAlignment(1, 'end', enumToken);
  static readonly values: readonly IconAlignment[] = Object.freeze([
    IconAlignment.start,
    IconAlignment.end,
  ]);
  toString(): string {
    return 'IconAlignment.' + this.name;
  }
}
Object.freeze(IconAlignment.prototype);
Object.freeze(IconAlignment);
