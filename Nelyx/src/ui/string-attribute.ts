// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Host values preserve UI semantics metadata; native allocation belongs to the bridge.
import type { TextRange } from './text-range.ts';
import type { Locale } from './locale.ts';
import { protect } from './value-math.ts';
export abstract class StringAttribute {
  constructor(readonly range: TextRange) {
    protect(this, ['range']);
  }
  abstract copy(options: { readonly range: TextRange }): StringAttribute;
}
export class SpellOutStringAttribute extends StringAttribute {
  constructor({ range }: { readonly range: TextRange }) {
    super(range);
  }
  copy({ range }: { readonly range: TextRange }): SpellOutStringAttribute {
    return new SpellOutStringAttribute({ range });
  }
  toString(): string {
    return `SpellOutStringAttribute(${this.range})`;
  }
}
export class LocaleStringAttribute extends StringAttribute {
  readonly locale: Locale;
  constructor({ range, locale }: { readonly range: TextRange; readonly locale: Locale }) {
    super(range);
    this.locale = locale;
    protect(this, ['locale']);
  }
  copy({ range }: { readonly range: TextRange }): LocaleStringAttribute {
    return new LocaleStringAttribute({ range, locale: this.locale });
  }
  toString(): string {
    return `LocaleStringAttribute(${this.range}, ${this.locale.toLanguageTag()})`;
  }
}
