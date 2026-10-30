// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Enum order and int index resolved from pinned typography.dart.
import { invariant } from '@nelyx/core/foundation/errors';
const categoryToken = Symbol('ScriptCategory');
export class ScriptCategory {
  /** @dartType int */ readonly index: number;
  /** @dartParam index int */
  private constructor(
    index: number,
    readonly name: 'englishLike' | 'dense' | 'tall',
    token: typeof categoryToken,
  ) {
    invariant(
      token === categoryToken,
      'invalid-enum-construction',
      'ScriptCategory values cannot be constructed',
    );
    this.index = index;
    Object.freeze(this);
  }
  static readonly englishLike = new ScriptCategory(0, 'englishLike', categoryToken);
  static readonly dense = new ScriptCategory(1, 'dense', categoryToken);
  static readonly tall = new ScriptCategory(2, 'tall', categoryToken);
  static readonly values: readonly ScriptCategory[] = Object.freeze([
    ScriptCategory.englishLike,
    ScriptCategory.dense,
    ScriptCategory.tall,
  ]);
  toString(): string {
    return 'ScriptCategory.' + this.name;
  }
}
Object.freeze(ScriptCategory.prototype);
Object.freeze(ScriptCategory);
