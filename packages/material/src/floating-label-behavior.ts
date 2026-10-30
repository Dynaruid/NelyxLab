// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const token = Symbol('FloatingLabelBehavior');
export class FloatingLabelBehavior {
  private readonly brand = token;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'never' | 'auto' | 'always',
    own: typeof token,
  ) {
    if (own !== token) throw new TypeError('Expected a canonical FloatingLabelBehavior');
    this.index = index;
    Object.freeze(this);
  }
  static readonly never = new FloatingLabelBehavior(0, 'never', token);
  static readonly auto = new FloatingLabelBehavior(1, 'auto', token);
  static readonly always = new FloatingLabelBehavior(2, 'always', token);
  static readonly values: readonly FloatingLabelBehavior[] = Object.freeze([
    FloatingLabelBehavior.never,
    FloatingLabelBehavior.auto,
    FloatingLabelBehavior.always,
  ]);
  toString(): string {
    return 'FloatingLabelBehavior.' + this.name;
  }
}
Object.freeze(FloatingLabelBehavior.prototype);
Object.freeze(FloatingLabelBehavior);
