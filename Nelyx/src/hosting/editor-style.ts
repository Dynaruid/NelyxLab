// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { TextAlign, FontStyle } from '../ui/typography.ts';

/** Resolved logical-pixel text styling for an existing host editing session.
 * Styling is snapshot metadata, independent of editing configuration and revisions. */
export interface EditorStyle {
  readonly fontFamilies: readonly string[];
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly fontStyle: FontStyle;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly wordSpacing: number;
  readonly color: number;
  readonly backgroundColor: number;
  readonly cursorColor: number;
  readonly selectionColor: number;
  readonly textAlign: TextAlign;
  readonly textDirection: 'ltr' | 'rtl';
}
export function freezeEditorStyle(value: EditorStyle): EditorStyle {
  /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
  invariant(
    Array.isArray(value.fontFamilies) &&
      value.fontFamilies.length <= 64 &&
      value.fontFamilies.every(
        (family) =>
          typeof family === 'string' && family.length > 0 && !/[\u0000-\u001f]/.test(family),
      ),
    'invalid-editor-style',
    'Editor font families must be nonempty names',
  );
  /* oxlint-enable no-control-regex */
  invariant(
    Number.isFinite(value.fontSize) &&
      value.fontSize > 0 &&
      Number.isFinite(value.lineHeight) &&
      value.lineHeight > 0 &&
      Number.isFinite(value.letterSpacing) &&
      Number.isFinite(value.wordSpacing),
    'invalid-editor-style',
    'Editor text dimensions must be finite and positive where required',
  );
  invariant(
    Number.isInteger(value.fontWeight) &&
      value.fontWeight >= 100 &&
      value.fontWeight <= 900 &&
      ['normal', 'italic'].includes(value.fontStyle),
    'invalid-editor-style',
    'Invalid editor font weight/style',
  );
  invariant(
    [value.color, value.backgroundColor, value.cursorColor, value.selectionColor].every(
      (color) => Number.isInteger(color) && color >= 0 && color <= 0xffffffff,
    ),
    'invalid-editor-style',
    'Editor colors require unsigned ARGB values',
  );
  invariant(
    ['left', 'right', 'center', 'justify', 'start', 'end'].includes(value.textAlign) &&
      (value.textDirection === 'ltr' || value.textDirection === 'rtl'),
    'invalid-editor-style',
    'Invalid editor alignment/direction',
  );
  return Object.freeze({ ...value, fontFamilies: Object.freeze([...value.fontFamilies]) });
}
