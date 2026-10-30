// SPDX-License-Identifier: BSD-3-Clause
// Nelyx editing policy. Offsets are UTF-16; native composition is never rewritten.
import { invariant } from '../foundation/errors.ts';
import { validateEditingContent } from '../ui/editing.ts';
import { graphemeBoundaries } from '../foundation/grapheme-boundaries.ts';
import type { TextEditingValue } from '../ui/types.ts';

export type EditingContent = Pick<TextEditingValue, 'text' | 'selection' | 'composing'>;
export function snapshotEditingContent(value: EditingContent): EditingContent {
  validateEditingContent(value);
  return Object.freeze({
    text: value.text,
    selection: Object.freeze({ ...value.selection }),
    composing: Object.freeze({ ...value.composing }),
  });
}
export abstract class TextInputFormatter {
  abstract formatEditUpdate(oldValue: EditingContent, newValue: EditingContent): EditingContent;
  static withFunction(
    format: (oldValue: EditingContent, newValue: EditingContent) => EditingContent,
  ): TextInputFormatter {
    return new (class extends TextInputFormatter {
      formatEditUpdate(oldValue: EditingContent, newValue: EditingContent): EditingContent {
        return format(oldValue, newValue);
      }
    })();
  }
}
/** Limits extended graphemes with the pinned characters automaton. Active IME composition is retained until commit. */
export class LengthLimitingTextInputFormatter extends TextInputFormatter {
  constructor(readonly maxLength: number) {
    super();
    invariant(
      Number.isSafeInteger(maxLength) && maxLength >= 0,
      'invalid-text-limit',
      'Text limit must be a nonnegative integer',
    );
  }
  formatEditUpdate(_oldValue: EditingContent, newValue: EditingContent): EditingContent {
    if (newValue.composing.status === 'active') return newValue;
    const end = graphemeBoundaries(newValue.text)[this.maxLength] ?? newValue.text.length;
    const text = newValue.text.slice(0, end);
    return text === newValue.text
      ? newValue
      : snapshotEditingContent({
          ...newValue,
          text,
          selection: {
            anchor: Math.min(newValue.selection.anchor, text.length),
            focus: Math.min(newValue.selection.focus, text.length),
          },
        });
  }
}
/** Whole-value validation. Use this for structured input; rejected edits retain the previous selection. */
export class PredicateTextInputFormatter extends TextInputFormatter {
  constructor(readonly accepts: (text: string) => boolean) {
    super();
  }
  formatEditUpdate(oldValue: EditingContent, newValue: EditingContent): EditingContent {
    return newValue.composing.status === 'active' || this.accepts(newValue.text)
      ? newValue
      : oldValue;
  }
}
/** Transactional replacement against an exact text snapshot, with resulting selection supplied by the producer. */
export class TextEditingDelta {
  readonly oldText: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly result: EditingContent;
  constructor({
    oldText,
    start,
    end,
    text,
    selection,
    composing = { status: 'none' },
  }: {
    readonly oldText: string;
    readonly start: number;
    readonly end: number;
    readonly text: string;
    readonly selection: EditingContent['selection'];
    readonly composing?: EditingContent['composing'];
  }) {
    validateEditingContent({
      text: oldText,
      selection: { anchor: start, focus: end },
      composing: { status: 'none' },
    });
    invariant(start <= end, 'invalid-editing-delta', 'Delta replacement range is reversed');
    this.oldText = oldText;
    this.start = start;
    this.end = end;
    this.text = text;
    this.result = snapshotEditingContent({
      text: oldText.slice(0, start) + text + oldText.slice(end),
      selection,
      composing,
    });
    Object.freeze(this);
  }
  apply(value: EditingContent): EditingContent {
    invariant(
      value.text === this.oldText,
      'stale-editing-delta',
      'Delta does not match current text',
    );
    return this.result;
  }
}
