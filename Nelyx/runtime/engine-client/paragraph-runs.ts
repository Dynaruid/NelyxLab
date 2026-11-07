// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

/** Resolved declarations, in UTF-16 units. Shaping and placement belong to C++. */
export interface ParagraphRun {
  readonly start: number;
  readonly end: number;
  readonly fontSize: number;
  readonly color: number;
  readonly fontWeight: number;
  readonly fontStyle: 'normal' | 'italic';
  readonly fontFamilies: readonly string[];
  readonly locale: string;
  readonly height: number | null;
  readonly letterSpacing: number;
  readonly wordSpacing: number;
  readonly halfLeading: boolean;
  readonly backgroundColor?: number;
  readonly decoration: number;
  readonly decorationStyle: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';
  readonly decorationColor?: number;
  readonly decorationThickness: number;
  readonly fontFeatures?: readonly { readonly name: string; readonly value: number }[];
  readonly fontVariations?: readonly { readonly axis: string; readonly value: number }[];
  readonly shadows?: readonly {
    readonly color: number;
    readonly offset: { readonly x: number; readonly y: number };
    readonly blurSigma: number;
  }[];
}
const styles = ['solid', 'double', 'dotted', 'dashed', 'wavy'] as const;
const aligned = (value: number) => Math.ceil(value / 8) * 8;
const integer = (value: number, low: number, high: number) => {
  if (!Number.isInteger(value) || value < low || value > high)
    throw Error('Invalid paragraph run integer');
  return value;
};
const scalar = (value: number, low: number, high: number) => {
  if (!Number.isFinite(value) || value < low || value > high)
    throw Error('Invalid paragraph run scalar');
  return value;
};
const tag = (value: string) => {
  if (!/^[\x20-\x7e]{4}$/.test(value)) throw Error('Invalid paragraph OpenType tag');
  return (
    value.charCodeAt(0) * 0x1000000 +
    value.charCodeAt(1) * 0x10000 +
    value.charCodeAt(2) * 0x100 +
    value.charCodeAt(3)
  );
};
const readTag = (value: number) => {
  const name = String.fromCharCode(
    value >>> 24,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  );
  tag(name);
  return name;
};
const keys = new Set([
  'start',
  'end',
  'fontSize',
  'color',
  'fontWeight',
  'fontStyle',
  'fontFamilies',
  'locale',
  'height',
  'letterSpacing',
  'wordSpacing',
  'halfLeading',
  'backgroundColor',
  'decoration',
  'decorationStyle',
  'decorationColor',
  'decorationThickness',
  'fontFeatures',
  'fontVariations',
  'shadows',
]);
export function paragraphRunBytes(runs: readonly ParagraphRun[]): Uint8Array {
  integer(runs.length, 0, p.limits.paragraphRuns);
  let end = 0;
  const records = runs.map((run) => {
    if (Object.keys(run).some((key) => !keys.has(key))) throw Error('Unknown paragraph run option');
    integer(run.start, 0, p.limits.textBytes);
    integer(run.end, run.start + 1, p.limits.textBytes);
    if (run.start !== end) throw Error('Paragraph runs must cover text contiguously');
    end = run.end;
    integer(run.fontFamilies.length, 1, p.limits.paragraphRunFamilies);
    if (
      run.fontFamilies.some((family) => !family || family.includes('\0')) ||
      !run.locale ||
      run.locale.includes('\0')
    )
      throw Error('Invalid paragraph run family/locale');
    const family = encodeUtf8(run.fontFamilies.join('\0'), p.limits.fontFamilyBytes),
      locale = encodeUtf8(run.locale, p.limits.localeBytes),
      features = run.fontFeatures ?? [],
      variations = run.fontVariations ?? [],
      shadows = run.shadows ?? [],
      featureCount = integer(features.length, 0, p.limits.paragraphRunFeatures),
      variationCount = integer(variations.length, 0, p.limits.paragraphRunVariations),
      shadowCount = integer(shadows.length, 0, p.limits.paragraphRunShadows),
      bytes = new Uint8Array(
        p.paragraphRunBytes +
          aligned(family.length) +
          aligned(locale.length) +
          featureCount * 8 +
          variationCount * 16 +
          shadowCount * 32,
      ),
      data = new DataView(bytes.buffer);
    if (
      !['normal', 'italic'].includes(run.fontStyle) ||
      typeof run.halfLeading !== 'boolean' ||
      !styles.includes(run.decorationStyle)
    )
      throw Error('Invalid paragraph run flags');
    data.setUint32(0, run.start, true);
    data.setUint32(4, run.end, true);
    data.setUint32(8, integer(run.color, 0, 0xffffffff), true);
    data.setUint32(
      12,
      run.backgroundColor === undefined ? 0 : integer(run.backgroundColor, 0, 0xffffffff),
      true,
    );
    data.setUint32(
      16,
      (run.backgroundColor !== undefined ? 1 : 0) |
        (run.fontStyle === 'italic' ? 2 : 0) |
        (run.halfLeading ? 4 : 0) |
        (run.decorationColor !== undefined ? 8 : 0),
      true,
    );
    data.setUint32(20, integer(run.fontWeight, 100, 900), true);
    data.setUint32(24, family.length, true);
    data.setUint32(28, locale.length, true);
    data.setFloat64(32, scalar(run.fontSize, 0, 512), true);
    data.setFloat64(40, run.height === null ? -1 : scalar(run.height, 0, 1e6), true);
    data.setFloat64(48, scalar(run.letterSpacing, -1e6, 1e6), true);
    data.setFloat64(56, scalar(run.wordSpacing, -1e6, 1e6), true);
    data.setFloat64(64, scalar(run.decorationThickness, 0, 1e6), true);
    data.setUint32(72, integer(run.decoration, 0, 7), true);
    data.setUint32(76, styles.indexOf(run.decorationStyle), true);
    data.setUint32(
      80,
      run.decorationColor === undefined ? 0 : integer(run.decorationColor, 0, 0xffffffff),
      true,
    );
    data.setUint32(84, run.fontFamilies.length, true);
    data.setUint32(88, featureCount, true);
    data.setUint32(92, variationCount, true);
    data.setUint32(96, shadowCount, true);
    bytes.set(family, p.paragraphRunBytes);
    bytes.set(locale, p.paragraphRunBytes + aligned(family.length));
    let offset = p.paragraphRunBytes + aligned(family.length) + aligned(locale.length);
    for (const feature of features) {
      if (Object.keys(feature).some((key) => !['name', 'value'].includes(key)))
        throw Error('Unknown paragraph font feature option');
      data.setUint32(offset, tag(feature.name), true);
      data.setUint32(offset + 4, integer(feature.value, 0, 0xffffffff), true);
      offset += 8;
    }
    for (const variation of variations) {
      if (Object.keys(variation).some((key) => !['axis', 'value'].includes(key)))
        throw Error('Unknown paragraph font variation option');
      data.setUint32(offset, tag(variation.axis), true);
      data.setFloat64(offset + 8, scalar(variation.value, -16777216, 16777216), true);
      offset += 16;
    }
    for (const shadow of shadows) {
      if (
        Object.keys(shadow).some((key) => !['color', 'offset', 'blurSigma'].includes(key)) ||
        Object.keys(shadow.offset).some((key) => !['x', 'y'].includes(key))
      )
        throw Error('Unknown paragraph shadow option');
      data.setUint32(offset, integer(shadow.color, 0, 0xffffffff), true);
      data.setFloat64(offset + 8, scalar(shadow.offset.x, -16777216, 16777216), true);
      data.setFloat64(offset + 16, scalar(shadow.offset.y, -16777216, 16777216), true);
      data.setFloat64(offset + 24, scalar(shadow.blurSigma, 0, 4096), true);
      offset += 32;
    }
    return bytes;
  });
  const bytes = new Uint8Array(records.reduce((sum, record) => sum + record.length, 0));
  let offset = 0;
  for (const record of records) {
    bytes.set(record, offset);
    offset += record.length;
  }
  return bytes;
}
export function readParagraphRuns(bytes: Uint8Array, count: number): readonly ParagraphRun[] {
  integer(count, 0, p.limits.paragraphRuns);
  const runs: ParagraphRun[] = [];
  let offset = 0,
    end = 0;
  for (let i = 0; i < count; ++i) {
    if (bytes.length - offset < p.paragraphRunBytes) throw Error('Truncated paragraph run');
    const data = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset),
      flags = data.getUint32(16, true),
      familiesLength = data.getUint32(24, true),
      localeLength = data.getUint32(28, true),
      featureCount = integer(data.getUint32(88, true), 0, p.limits.paragraphRunFeatures),
      variationCount = integer(data.getUint32(92, true), 0, p.limits.paragraphRunVariations),
      shadowCount = integer(data.getUint32(96, true), 0, p.limits.paragraphRunShadows),
      length =
        p.paragraphRunBytes +
        aligned(familiesLength) +
        aligned(localeLength) +
        featureCount * 8 +
        variationCount * 16 +
        shadowCount * 32;
    if (
      flags > 15 ||
      !familiesLength ||
      familiesLength > p.limits.fontFamilyBytes ||
      !localeLength ||
      localeLength > p.limits.localeBytes ||
      length > data.byteLength ||
      data.getUint32(100, true) ||
      data.getBigUint64(104, true)
    )
      throw Error('Invalid paragraph run record');
    const fontFamilies = decodeUtf8(
        bytes.subarray(offset + p.paragraphRunBytes, offset + p.paragraphRunBytes + familiesLength),
      ).split('\0'),
      locale = decodeUtf8(
        bytes.subarray(
          offset + p.paragraphRunBytes + aligned(familiesLength),
          offset + p.paragraphRunBytes + aligned(familiesLength) + localeLength,
        ),
      ),
      height = data.getFloat64(40, true);
    if (
      fontFamilies.length !== data.getUint32(84, true) ||
      fontFamilies.some((family) => !family) ||
      locale.includes('\0') ||
      (!(flags & 1) && data.getUint32(12, true)) ||
      (!(flags & 8) && data.getUint32(80, true))
    )
      throw Error('Invalid paragraph run strings/colors');
    integer(fontFamilies.length, 1, p.limits.paragraphRunFamilies);
    for (let j = familiesLength; j < aligned(familiesLength); ++j)
      if (bytes[offset + p.paragraphRunBytes + j]) throw Error('Nonzero paragraph run padding');
    for (let j = localeLength; j < aligned(localeLength); ++j)
      if (bytes[offset + p.paragraphRunBytes + aligned(familiesLength) + j])
        throw Error('Nonzero paragraph run padding');
    let cursor = p.paragraphRunBytes + aligned(familiesLength) + aligned(localeLength);
    const fontFeatures = Array.from({ length: featureCount }, () => {
      const feature = Object.freeze({
        name: readTag(data.getUint32(cursor, true)),
        value: data.getUint32(cursor + 4, true),
      });
      cursor += 8;
      return feature;
    });
    const fontVariations = Array.from({ length: variationCount }, () => {
      if (data.getUint32(cursor + 4, true)) throw Error('Nonzero paragraph variation padding');
      const variation = Object.freeze({
        axis: readTag(data.getUint32(cursor, true)),
        value: scalar(data.getFloat64(cursor + 8, true), -16777216, 16777216),
      });
      cursor += 16;
      return variation;
    });
    const shadows = Array.from({ length: shadowCount }, () => {
      if (data.getUint32(cursor + 4, true)) throw Error('Nonzero paragraph shadow padding');
      const shadow = Object.freeze({
        color: data.getUint32(cursor, true),
        offset: Object.freeze({
          x: scalar(data.getFloat64(cursor + 8, true), -16777216, 16777216),
          y: scalar(data.getFloat64(cursor + 16, true), -16777216, 16777216),
        }),
        blurSigma: scalar(data.getFloat64(cursor + 24, true), 0, 4096),
      });
      cursor += 32;
      return shadow;
    });
    const run: ParagraphRun = Object.freeze({
      start: integer(data.getUint32(0, true), end, end),
      end: integer(data.getUint32(4, true), end + 1, p.limits.textBytes),
      color: data.getUint32(8, true),
      ...(flags & 1 ? { backgroundColor: data.getUint32(12, true) } : {}),
      fontStyle: flags & 2 ? 'italic' : 'normal',
      halfLeading: !!(flags & 4),
      fontWeight: integer(data.getUint32(20, true), 100, 900),
      fontFamilies: Object.freeze(fontFamilies),
      locale,
      fontSize: scalar(data.getFloat64(32, true), 0, 512),
      height: height === -1 ? null : scalar(height, 0, 1e6),
      letterSpacing: scalar(data.getFloat64(48, true), -1e6, 1e6),
      wordSpacing: scalar(data.getFloat64(56, true), -1e6, 1e6),
      decorationThickness: scalar(data.getFloat64(64, true), 0, 1e6),
      decoration: integer(data.getUint32(72, true), 0, 7),
      decorationStyle: styles[integer(data.getUint32(76, true), 0, 4)]!,
      ...(flags & 8 ? { decorationColor: data.getUint32(80, true) } : {}),
      ...(featureCount ? { fontFeatures: Object.freeze(fontFeatures) } : {}),
      ...(variationCount ? { fontVariations: Object.freeze(fontVariations) } : {}),
      ...(shadowCount ? { shadows: Object.freeze(shadows) } : {}),
    });
    end = run.end;
    runs.push(run);
    offset += length;
  }
  if (offset !== bytes.length) throw Error('Trailing paragraph run bytes');
  return Object.freeze(runs);
}
/** Conservative recording bounds only; glyph placement stays in SkParagraph. */
export function paragraphPaintOutset(
  runs: readonly ParagraphRun[] | undefined,
  fontSize = 0,
  compressed = false,
): number {
  let outset = 0,
    ink = compressed ? fontSize * 2 : 0;
  for (const run of runs ?? []) {
    if (compressed || (run.height !== null && run.height < 1))
      ink = Math.max(ink, run.fontSize * 2);
    for (const shadow of run.shadows ?? [])
      outset = Math.max(
        outset,
        Math.abs(shadow.offset.x) + shadow.blurSigma * 4,
        Math.abs(shadow.offset.y) + shadow.blurSigma * 4,
      );
  }
  return ink + outset;
}
export function validateParagraphRuns(
  text: string,
  runs: readonly ParagraphRun[] | undefined,
): void {
  if (!runs?.length) return;
  let end = 0;
  for (const run of runs) {
    const previous = text.charCodeAt(run.end - 1),
      next = text.charCodeAt(run.end);
    if (
      run.start !== end ||
      run.end > text.length ||
      (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
    )
      throw Error('Paragraph run splits a UTF-16 scalar or exceeds text');
    end = run.end;
  }
  if (end !== text.length) throw Error('Paragraph runs do not cover text');
}
