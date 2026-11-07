// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

export interface ParagraphStrut {
  readonly fontFamilies: readonly string[];
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly fontStyle: 'normal' | 'italic';
  readonly height: number | null;
  readonly leading: number;
  readonly halfLeading: boolean;
  readonly forceStrutHeight: boolean;
}
export interface ParagraphPlaceholder {
  readonly offset: number;
  readonly width: number;
  readonly height: number;
  readonly alignment: 'baseline' | 'aboveBaseline' | 'belowBaseline' | 'top' | 'bottom' | 'middle';
  readonly baseline: 'alphabetic' | 'ideographic';
  readonly baselineOffset: number;
}
const alignments = [
  'baseline',
  'aboveBaseline',
  'belowBaseline',
  'top',
  'bottom',
  'middle',
] as const;
const aligned = (value: number) => Math.ceil(value / 8) * 8;
const scalar = (value: number, low: number, high: number) => {
  if (!Number.isFinite(value) || value < low || value > high)
    throw Error('Invalid paragraph extra scalar');
  return value;
};
const integer = (value: number, low: number, high: number) => {
  scalar(value, low, high);
  if (!Number.isInteger(value)) throw Error('Invalid paragraph extra integer');
  return value;
};
const strutKeys = new Set([
  'fontFamilies',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'height',
  'leading',
  'halfLeading',
  'forceStrutHeight',
]);
const placeholderKeys = new Set([
  'offset',
  'width',
  'height',
  'alignment',
  'baseline',
  'baselineOffset',
]);
export function paragraphExtrasBytes(
  strut: ParagraphStrut | undefined,
  placeholders: readonly ParagraphPlaceholder[] = [],
) {
  integer(placeholders.length, 0, p.limits.paragraphPlaceholders);
  const families = strut
      ? encodeUtf8(strut.fontFamilies.join('\0'), p.limits.fontFamilyBytes)
      : new Uint8Array(),
    strutLength = strut ? p.paragraphStrutBytes + aligned(families.length) : 0,
    bytes = new Uint8Array(strutLength + placeholders.length * p.paragraphPlaceholderBytes),
    data = new DataView(bytes.buffer);
  if (strut) {
    if (
      Object.keys(strut).some((key) => !strutKeys.has(key)) ||
      !['normal', 'italic'].includes(strut.fontStyle) ||
      typeof strut.halfLeading !== 'boolean' ||
      typeof strut.forceStrutHeight !== 'boolean' ||
      strut.fontFamilies.some((family) => !family || family.includes('\0'))
    )
      throw Error('Invalid paragraph strut declaration');
    integer(strut.fontFamilies.length, 1, p.limits.paragraphRunFamilies);
    data.setUint32(
      0,
      (strut.fontStyle === 'italic' ? 1 : 0) |
        (strut.halfLeading ? 2 : 0) |
        (strut.forceStrutHeight ? 4 : 0),
      true,
    );
    data.setUint32(4, integer(strut.fontWeight, 1, 1000), true);
    data.setUint32(8, families.length, true);
    data.setUint32(12, strut.fontFamilies.length, true);
    data.setFloat64(16, scalar(strut.fontSize, 0, 512), true);
    data.setFloat64(24, strut.height === null ? -1 : scalar(strut.height, 0, 100), true);
    data.setFloat64(32, scalar(strut.leading, 0, 100), true);
    bytes.set(families, p.paragraphStrutBytes);
  }
  let previous = -1;
  for (let i = 0; i < placeholders.length; ++i) {
    const item = placeholders[i]!,
      offset = strutLength + i * p.paragraphPlaceholderBytes;
    if (
      Object.keys(item).some((key) => !placeholderKeys.has(key)) ||
      !alignments.includes(item.alignment) ||
      !['alphabetic', 'ideographic'].includes(item.baseline)
    )
      throw Error('Invalid paragraph placeholder declaration');
    data.setUint32(offset, integer(item.offset, previous + 1, p.limits.textBytes - 1), true);
    previous = item.offset;
    data.setUint32(offset + 4, alignments.indexOf(item.alignment), true);
    data.setUint32(offset + 8, item.baseline === 'ideographic' ? 1 : 0, true);
    data.setFloat64(offset + 16, scalar(item.width, 0, 16777216), true);
    data.setFloat64(offset + 24, scalar(item.height, 0, 16777216), true);
    data.setFloat64(offset + 32, scalar(item.baselineOffset, -1e12, 1e12), true);
  }
  return { bytes, strutLength };
}
export function readParagraphExtras(bytes: Uint8Array, strutLength: number, count: number) {
  integer(count, 0, p.limits.paragraphPlaceholders);
  if (strutLength !== 0)
    integer(
      strutLength,
      p.paragraphStrutBytes + 8,
      p.paragraphStrutBytes + aligned(p.limits.fontFamilyBytes),
    );
  const length = strutLength + count * p.paragraphPlaceholderBytes;
  if (length > bytes.length) throw Error('Truncated paragraph extras');
  const data = new DataView(bytes.buffer, bytes.byteOffset, length);
  let strut: ParagraphStrut | undefined;
  if (strutLength) {
    const flags = data.getUint32(0, true),
      size = data.getUint32(8, true),
      familiesCount = data.getUint32(12, true);
    integer(flags, 0, 7);
    integer(size, 1, p.limits.fontFamilyBytes);
    integer(familiesCount, 1, p.limits.paragraphRunFamilies);
    if (strutLength !== p.paragraphStrutBytes + aligned(size) || data.getBigUint64(40, true))
      throw Error('Invalid paragraph strut size/padding');
    const fontFamilies = decodeUtf8(
      bytes.subarray(p.paragraphStrutBytes, p.paragraphStrutBytes + size),
    ).split('\0');
    if (fontFamilies.length !== familiesCount || fontFamilies.some((family) => !family))
      throw Error('Invalid paragraph strut families');
    for (let i = size; i < aligned(size); ++i)
      if (bytes[p.paragraphStrutBytes + i]) throw Error('Nonzero paragraph strut padding');
    const height = data.getFloat64(24, true);
    strut = Object.freeze({
      fontFamilies: Object.freeze(fontFamilies),
      fontSize: scalar(data.getFloat64(16, true), 0, 512),
      fontWeight: integer(data.getUint32(4, true), 1, 1000),
      fontStyle: flags & 1 ? 'italic' : 'normal',
      height: height === -1 ? null : scalar(height, 0, 100),
      leading: scalar(data.getFloat64(32, true), 0, 100),
      halfLeading: !!(flags & 2),
      forceStrutHeight: !!(flags & 4),
    });
  }
  let previous = -1;
  const placeholders = Array.from({ length: count }, (_, i): ParagraphPlaceholder => {
    const offset = strutLength + i * p.paragraphPlaceholderBytes,
      value = integer(data.getUint32(offset, true), previous + 1, p.limits.textBytes - 1);
    previous = value;
    if (data.getUint32(offset + 12, true)) throw Error('Nonzero paragraph placeholder padding');
    return Object.freeze({
      offset: value,
      alignment: alignments[integer(data.getUint32(offset + 4, true), 0, 5)]!,
      baseline: integer(data.getUint32(offset + 8, true), 0, 1) ? 'ideographic' : 'alphabetic',
      width: scalar(data.getFloat64(offset + 16, true), 0, 16777216),
      height: scalar(data.getFloat64(offset + 24, true), 0, 16777216),
      baselineOffset: scalar(data.getFloat64(offset + 32, true), -1e12, 1e12),
    });
  });
  return {
    length,
    ...(strut ? { strut } : {}),
    ...(count ? { placeholders: Object.freeze(placeholders) } : {}),
  };
}
export function validateParagraphPlaceholders(
  text: string,
  placeholders: readonly ParagraphPlaceholder[] | undefined,
): void {
  let previous = -1;
  for (const item of placeholders ?? []) {
    if (!Number.isInteger(item.offset) || item.offset <= previous || text[item.offset] !== '\ufffc')
      throw Error('Paragraph placeholder must target an ordered object replacement character');
    previous = item.offset;
  }
}
