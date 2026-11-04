// SPDX-License-Identifier: BSD-3-Clause
import type { Paragraph } from 'canvaskit-wasm';
import type { CanvasKit } from 'canvaskit-wasm';
import type {
  EditingSnapshot,
  TextGeometry,
  TextRect,
} from '../../../runtime/engine-client/codec.ts';

export type LineIndexUnit = 'utf8' | 'utf16';
/** Probe the selected binary, rather than trusting its .d.ts declaration. */
export function lineIndexUnit(paragraph: Paragraph, text: string): LineIndexUnit {
  const lines = paragraph.getLineMetrics();
  const probes = lines.filter(
    (line) => line.width > 0 && line.startIndex > 0 && line.startIndex < text.length,
  );
  const matches = (unit: LineIndexUnit) =>
    probes.every(
      (line) =>
        paragraph.getLineNumberAt(
          unit === 'utf8' ? utf8Offset(text, line.startIndex) : line.startIndex,
        ) === line.lineNumber,
    );
  if (!probes.length) throw new Error('Line-index probe needs non-ASCII text and multiple lines');
  const utf8 = matches('utf8'),
    utf16 = matches('utf16');
  if (utf8 === utf16)
    throw new Error('Public paragraph line-index unit is ambiguous or incompatible');
  return utf8 ? 'utf8' : 'utf16';
}
function utf8Offset(text: string, offset: number): number {
  let bytes = 0;
  for (let unit = 0; unit < offset;) {
    const cp = text.codePointAt(unit)!;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    unit += cp > 0xffff ? 2 : 1;
  }
  return bytes;
}
export function utf16Boundary(text: string, offset: number): void {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > text.length ||
    (offset > 0 &&
      offset < text.length &&
      text.charCodeAt(offset) >= 0xdc00 &&
      text.charCodeAt(offset) <= 0xdfff &&
      text.charCodeAt(offset - 1) >= 0xd800 &&
      text.charCodeAt(offset - 1) <= 0xdbff)
  )
    throw new RangeError('Offset is outside a UTF-16 scalar boundary');
}
/** Visible codepoint lookup. End-of-document caret lookup is a separate API. */
export function lineNumberAtUTF16(
  paragraph: Paragraph,
  text: string,
  offset: number,
  unit: LineIndexUnit,
): number | null {
  utf16Boundary(text, offset);
  if (offset === text.length) return null;
  const line = paragraph.getLineNumberAt(unit === 'utf8' ? utf8Offset(text, offset) : offset);
  if (!Number.isInteger(line) || line < -1 || line >= paragraph.getNumberOfLines())
    throw new Error('Invalid provider line number');
  return line < 0 ? null : line;
}
export function caretLineAtUTF16(
  paragraph: Paragraph,
  text: string,
  offset: number,
  affinity: 'upstream' | 'downstream' = 'downstream',
): number | null {
  utf16Boundary(text, offset);
  const lines = paragraph.getLineMetrics();
  if (offset === text.length && lines.length) return lines[lines.length - 1]!.lineNumber;
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i]!;
    if (offset < line.startIndex) continue;
    if (offset < line.endIncludingNewline) return line.lineNumber;
    if (offset === line.endIncludingNewline) {
      const next = lines[i + 1];
      if (next?.startIndex === offset && (line.isHardBreak || affinity === 'downstream'))
        return next.lineNumber;
      return line.lineNumber;
    }
  }
  return null;
}
/** Coordinates are local to the exact paragraph used to prepare the scene. */
export function editingGeometry(
  ck: CanvasKit,
  paragraph: Paragraph,
  value: EditingSnapshot,
  fontSize: number,
): TextGeometry {
  utf16Boundary(value.text, value.base);
  utf16Boundary(value.text, value.extent);
  const selection = paragraph
    .getRectsForRange(
      Math.min(value.base, value.extent),
      Math.max(value.base, value.extent),
      ck.RectHeightStyle.Max,
      ck.RectWidthStyle.Tight,
    )
    .map(({ rect }): TextRect =>
      Object.freeze({
        x: rect[0]!,
        y: rect[1]!,
        width: Math.max(0, rect[2]! - rect[0]!),
        height: Math.max(0, rect[3]! - rect[1]!),
      }),
    );
  const offset = value.extent,
    lines = paragraph.getLineMetrics(),
    lineNumber = caretLineAtUTF16(paragraph, value.text, offset),
    line = lines.find((l) => l.lineNumber === lineNumber);
  let x = line?.left ?? 0,
    y = line ? line.baseline - line.ascent : 0,
    height = line?.height ?? fontSize * 1.2;
  let index = offset,
    trailing = false;
  if (index === value.text.length && index > 0) {
    index -= value.text.codePointAt(index - 2)! > 0xffff ? 2 : 1;
    trailing = true;
  }
  const glyph = value.text.length ? paragraph.getGlyphInfoAt(index) : null;
  if (glyph && !(offset === value.text.length && value.text.endsWith('\n'))) {
    const r = glyph.graphemeLayoutBounds,
      rtl = glyph.dir === ck.TextDirection.RTL;
    x = r[trailing !== rtl ? 2 : 0]!;
    y = r[1]!;
    height = Math.max(height, r[3]! - r[1]!);
  }
  return Object.freeze({
    revision: value.revision,
    caret: Object.freeze({ x, y, width: 1, height: Math.max(1, height) }),
    selection: Object.freeze(selection),
  });
}
