// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { invariant } from '../foundation/errors.ts';
import { freezeRunStyle, freezeStrutStyle } from './text-style-validation.ts';
import type {
  TextAlign,
  FontStyle,
  FontWeight,
  TextHeightBehavior,
  Hyphens,
} from './typography.ts';
import type { TextStrutStyle } from './text-styles.ts';
import type { Locale } from './locale.ts';
import { protect } from './value-math.ts';
export interface ParagraphStyleOptions {
  readonly textAlign?: TextAlign | null;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly fontWeight?: FontWeight | null;
  readonly fontStyle?: FontStyle | null;
  readonly fontFamily?: string | null;
  readonly fontSize?: number | null;
  readonly height?: number | null;
  readonly textHeightBehavior?: TextHeightBehavior | null;
  readonly hyphens?: Hyphens | null;
  readonly strutStyle?: TextStrutStyle | null;
  readonly maxLines?: number | null;
  readonly ellipsis?: string | null;
  readonly locale?: Locale | string | null;
}
/** Value boundary used by framework TextStyle; it contains no engine objects. */
export class ParagraphStyle {
  readonly textAlign: TextAlign | null;
  readonly textDirection: 'ltr' | 'rtl' | null;
  readonly fontWeight: FontWeight | null;
  readonly fontStyle: FontStyle | null;
  readonly fontFamily: string | null;
  readonly fontSize: number | null;
  readonly height: number | null;
  readonly textHeightBehavior: TextHeightBehavior | null;
  readonly hyphens: Hyphens | null;
  readonly strutStyle: TextStrutStyle | null;
  readonly maxLines: number | null;
  readonly ellipsis: string | null;
  readonly locale: Locale | string | null;
  constructor(o: ParagraphStyleOptions = {}) {
    this.textAlign = o.textAlign ?? null;
    this.textDirection = o.textDirection ?? null;
    this.fontWeight = o.fontWeight ?? null;
    this.fontStyle = o.fontStyle ?? null;
    this.fontFamily = o.fontFamily ?? null;
    this.fontSize = o.fontSize ?? null;
    this.height = o.height ?? null;
    this.textHeightBehavior = o.textHeightBehavior ?? null;
    this.hyphens = o.hyphens ?? null;
    this.strutStyle = o.strutStyle ? freezeStrutStyle(o.strutStyle) : null;
    this.maxLines = o.maxLines ?? null;
    this.ellipsis = o.ellipsis ?? null;
    this.locale = o.locale ?? null;
    invariant(
      this.textAlign === null ||
        ['left', 'right', 'center', 'justify', 'start', 'end'].includes(this.textAlign),
      'invalid-paragraph-style',
      'Invalid text alignment',
    );
    invariant(
      this.textDirection === null || ['ltr', 'rtl'].includes(this.textDirection),
      'invalid-paragraph-style',
      'Invalid text direction',
    );
    invariant(
      this.hyphens === null || ['manual', 'hidden'].includes(this.hyphens),
      'invalid-paragraph-style',
      'Invalid hyphen policy',
    );
    invariant(
      this.maxLines === null || (Number.isSafeInteger(this.maxLines) && this.maxLines > 0),
      'invalid-paragraph-style',
      'maxLines must be a positive integer',
    );
    invariant(
      this.ellipsis === null || typeof this.ellipsis === 'string',
      'invalid-paragraph-style',
      'Invalid ellipsis',
    );
    freezeRunStyle({
      ...(this.fontFamily !== null ? { fontFamilies: [this.fontFamily] } : {}),
      ...(this.fontWeight ? { fontWeight: this.fontWeight.value } : {}),
      ...(this.fontStyle ? { fontStyle: this.fontStyle } : {}),
      ...(this.fontSize !== null ? { fontSize: this.fontSize } : {}),
      ...(this.height !== null ? { height: this.height } : {}),
      ...(this.locale !== null
        ? { locale: typeof this.locale === 'string' ? this.locale : this.locale.toString() }
        : {}),
    });
    if (new.target === ParagraphStyle) Object.freeze(this);
    else protect(this, Object.keys(this));
  }
}
