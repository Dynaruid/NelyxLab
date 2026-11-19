// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/services/spell_check.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { Locale } from '../ui/locale.ts';
import { TextRange } from '../ui/text-range.ts';
import type { MethodChannel } from './platform-channel.ts';
import { SystemChannels } from './system-channels.ts';

export class SuggestionSpan {
  readonly suggestions: readonly string[];
  constructor(
    readonly range: TextRange,
    suggestions: readonly string[],
  ) {
    this.suggestions = Object.freeze([...suggestions]);
    Object.freeze(this);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof SuggestionSpan &&
      this.range.equals(other.range) &&
      this.suggestions.length === other.suggestions.length &&
      this.suggestions.every((suggestion, index) => suggestion === other.suggestions[index])
    );
  }
}

export class SpellCheckResults {
  readonly suggestionSpans: readonly SuggestionSpan[];
  constructor(
    readonly spellCheckedText: string,
    suggestionSpans: readonly SuggestionSpan[],
  ) {
    this.suggestionSpans = Object.freeze([...suggestionSpans]);
  }
}

export interface SpellCheckService {
  fetchSpellCheckSuggestions(
    locale: Locale,
    text: string,
  ): PromiseLike<readonly SuggestionSpan[] | null>;
}

export class DefaultSpellCheckService implements SpellCheckService {
  lastSavedResults: SpellCheckResults | null = null;
  private lastLocale: string | null = null;

  constructor(public spellCheckChannel: MethodChannel = SystemChannels.spellCheck) {}

  static mergeResults(
    oldResults: readonly SuggestionSpan[],
    newResults: readonly SuggestionSpan[],
  ): SuggestionSpan[] {
    const merged: SuggestionSpan[] = [];
    let left = 0,
      right = 0;
    while (left < oldResults.length && right < newResults.length) {
      const old = oldResults[left]!,
        next = newResults[right]!;
      if (old.range.start <= next.range.start) {
        merged.push(old);
        left++;
        if (old.range.start === next.range.start) right++;
      } else {
        merged.push(next);
        right++;
      }
    }
    return merged.concat(oldResults.slice(left), newResults.slice(right));
  }

  async fetchSpellCheckSuggestions(
    locale: Locale,
    text: string,
  ): Promise<readonly SuggestionSpan[] | null> {
    const tag = locale.toLanguageTag();
    let reply: unknown;
    try {
      reply = await this.spellCheckChannel.invokeMethod('SpellCheck.initiateSpellCheck', [
        tag,
        text,
      ]);
    } catch {
      return null;
    }
    if (!Array.isArray(reply)) return null;
    const spans: SuggestionSpan[] = [];
    for (const item of reply) {
      if (!item || typeof item !== 'object') continue;
      const read = (key: string): unknown => (item instanceof Map ? item.get(key) : item[key]);
      const start = read('startIndex'),
        end = read('endIndex'),
        suggestions = read('suggestions');
      if (
        typeof start !== 'number' ||
        typeof end !== 'number' ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end <= start ||
        end > text.length ||
        !Array.isArray(suggestions)
      )
        continue;
      spans.push(
        new SuggestionSpan(
          new TextRange({ start, end }),
          suggestions.filter((value): value is string => typeof value === 'string'),
        ),
      );
    }
    spans.sort((a, b) => a.range.start - b.range.start);
    const previous = this.lastSavedResults;
    const suggestions =
      previous?.spellCheckedText === text && this.lastLocale === tag
        ? DefaultSpellCheckService.mergeResults(previous.suggestionSpans, spans)
        : spans;
    this.lastLocale = tag;
    this.lastSavedResults = new SpellCheckResults(text, suggestions);
    return this.lastSavedResults.suggestionSpans;
  }
}
