// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
const enumToken = Symbol("TextCapitalization");
export class TextCapitalization {
  private readonly enumBrand = enumToken;
  /** @dartType int */
  readonly index: number;
  /** @dartParam index int */
  private constructor(index: number, readonly name: "words" | "sentences" | "characters" | "none", token: typeof enumToken) { if (token !== enumToken) throw new TypeError("Expected a canonical TextCapitalization"); this.index = index; Object.freeze(this); }
  static readonly words = new TextCapitalization(0, "words", enumToken);
  static readonly sentences = new TextCapitalization(1, "sentences", enumToken);
  static readonly characters = new TextCapitalization(2, "characters", enumToken);
  static readonly none = new TextCapitalization(3, "none", enumToken);
  static readonly values: readonly TextCapitalization[] = Object.freeze([TextCapitalization.words, TextCapitalization.sentences, TextCapitalization.characters, TextCapitalization.none]);
  toString(): string { return "TextCapitalization." + this.name; }
}
Object.freeze(TextCapitalization.prototype);
Object.freeze(TextCapitalization);
