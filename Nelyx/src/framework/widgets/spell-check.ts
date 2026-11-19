// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/spell_check.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { Color } from '../../ui/color.ts';
import type { Locale } from '../../ui/locale.ts';
import { SpellCheckResults } from '../../services/spell-check.ts';
import type { SpellCheckService, SuggestionSpan } from '../../services/spell-check.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { TextSpan } from '../painting/text-span.ts';
import type { TextStyle } from '../painting/text-style.ts';
import type { EditableTextState } from './editable-text.ts';
import type { BuildContext, Widget } from './framework.ts';

export interface SpellCheckConfigurationOptions {
  readonly spellCheckService?: SpellCheckService | null;
  readonly misspelledSelectionColor?: Color | null;
  readonly misspelledTextStyle?: TextStyle | null;
  readonly spellCheckSuggestionsToolbarBuilder?:
    | ((context: BuildContext, editor: EditableTextState) => Widget)
    | null;
}

export class SpellCheckConfiguration {
  readonly spellCheckService: SpellCheckService | null;
  readonly misspelledSelectionColor: Color | null;
  readonly misspelledTextStyle: TextStyle | null;
  readonly spellCheckSuggestionsToolbarBuilder: NonNullable<
    SpellCheckConfigurationOptions['spellCheckSuggestionsToolbarBuilder']
  > | null;

  constructor(
    options: SpellCheckConfigurationOptions = {},
    readonly spellCheckEnabled = true,
  ) {
    this.spellCheckService = options.spellCheckService ?? null;
    this.misspelledSelectionColor = options.misspelledSelectionColor ?? null;
    this.misspelledTextStyle = options.misspelledTextStyle ?? null;
    this.spellCheckSuggestionsToolbarBuilder = options.spellCheckSuggestionsToolbarBuilder ?? null;
    Object.freeze(this);
  }

  static disabled(): SpellCheckConfiguration {
    return disabledSpellCheck;
  }

  copyWith(options: SpellCheckConfigurationOptions = {}): SpellCheckConfiguration {
    return this.spellCheckEnabled
      ? new SpellCheckConfiguration({
          spellCheckService: options.spellCheckService ?? this.spellCheckService,
          misspelledSelectionColor:
            options.misspelledSelectionColor ?? this.misspelledSelectionColor,
          misspelledTextStyle: options.misspelledTextStyle ?? this.misspelledTextStyle,
          spellCheckSuggestionsToolbarBuilder:
            options.spellCheckSuggestionsToolbarBuilder ?? this.spellCheckSuggestionsToolbarBuilder,
        })
      : this;
  }
}

const disabledSpellCheck = new SpellCheckConfiguration({}, false);

interface Request {
  readonly service: SpellCheckService;
  readonly locale: Locale;
  readonly text: string;
}

/** @internal Serializes a field's checks and discards results for an older value or locale. */
export class SpellCheckSession {
  private latest: Request | null = null;
  private next: Request | null = null;
  private running = false;
  private saved: SpellCheckResults | null = null;

  constructor(private readonly changed: () => void) {}

  update(text: string, locale: Locale, service: SpellCheckService): void {
    if (
      this.latest?.text === text &&
      this.latest.service === service &&
      this.latest.locale.equals(locale)
    )
      return;
    this.saved = null;
    this.latest = this.next = { service, locale, text };
    if (this.running) return;
    this.running = true;
    void Promise.resolve().then(() => this.run());
  }

  clear(): void {
    this.latest = this.next = null;
    this.saved = null;
  }

  private async run(): Promise<void> {
    try {
      while (this.next) {
        const current = this.next;
        this.next = null;
        try {
          const spans = await current.service.fetchSpellCheckSuggestions(
            current.locale,
            current.text,
          );
          if (this.latest !== current || spans === null) continue;
          this.saved = new SpellCheckResults(
            current.text,
            spans
              .filter(
                ({ range }) =>
                  range.isValid && range.start < range.end && range.end <= current.text.length,
              )
              .sort((a, b) => a.range.start - b.range.start),
          );
          this.changed();
        } catch (exception) {
          if (this.latest === current)
            FlutterError.reportError(
              new FlutterErrorDetails({ exception, library: 'widgets spell check' }),
            );
        }
      }
    } finally {
      this.running = false;
    }
  }

  find(text: string, index: number): SuggestionSpan | null {
    if (this.saved?.spellCheckedText !== text) return null;
    const results = this.saved.suggestionSpans;
    return (
      results.find(({ range }) => range.start <= index && index < range.end) ??
      results.find(({ range }) => index === range.end) ??
      null
    );
  }

  buildSpan(text: string, style: TextStyle, misspelledStyle: TextStyle): TextSpan | null {
    const result = this.saved;
    if (result?.spellCheckedText !== text || result.suggestionSpans.length === 0) return null;
    const children: TextSpan[] = [];
    let offset = 0;
    for (const { range } of result.suggestionSpans) {
      if (range.start < offset) continue;
      if (range.start > offset)
        children.push(new TextSpan({ text: text.slice(offset, range.start) }));
      children.push(new TextSpan({ text: range.textInside(text), style: misspelledStyle }));
      offset = range.end;
    }
    if (offset < text.length) children.push(new TextSpan({ text: text.slice(offset) }));
    return new TextSpan({ style, children });
  }
}
