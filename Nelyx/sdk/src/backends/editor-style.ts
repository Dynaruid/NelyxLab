// SPDX-License-Identifier: BSD-3-Clause
import type { EditorStyle } from '@nelyx/core/hosting/editor-style';
/** CSS and React Native accept this shared straight-alpha color representation. */
export function editorColor(value: number): string {
  return `rgba(${(value >>> 16) & 255},${(value >>> 8) & 255},${value & 255},${(value >>> 24) / 255})`;
}
export function nativeEditorStyle(
  style: EditorStyle,
  multiline = false,
): Record<string, string | number | boolean> {
  if (style.wordSpacing !== 0) throw new Error('Native editing word spacing is unavailable');
  return {
    ...(style.fontFamilies[0] ? { fontFamily: style.fontFamilies[0] } : {}),
    fontSize: style.fontSize,
    fontWeight: String(style.fontWeight),
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: editorColor(style.color),
    backgroundColor: editorColor(style.backgroundColor),
    textAlign:
      style.textAlign === 'start'
        ? style.textDirection === 'rtl'
          ? 'right'
          : 'left'
        : style.textAlign === 'end'
          ? style.textDirection === 'rtl'
            ? 'left'
            : 'right'
          : style.textAlign,
    writingDirection: style.textDirection,
    padding: 0,
    borderWidth: 0,
    borderRadius: 0,
    includeFontPadding: false,
    textAlignVertical: multiline ? 'top' : 'center',
  };
}
