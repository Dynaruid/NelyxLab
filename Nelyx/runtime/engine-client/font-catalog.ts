// SPDX-License-Identifier: BSD-3-Clause
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

/** Immutable, owner-neutral font input. This is not a Core resource packet. */
export interface FontCatalog {
  readonly fonts: readonly { readonly family: string; readonly bytes: Uint8Array }[];
  readonly fallback: readonly string[];
}
export interface FontCatalogInput {
  readonly fonts: FontCatalog['fonts'];
  readonly fallback?: FontCatalog['fallback'];
}
export const bundledFontFamilies = Object.freeze([
  'NelyxDefault',
  'NelyxArabic',
  'NelyxHebrew',
  'NelyxEmoji',
]);
export const fontCatalogLimit = 16 * 1024 * 1024;
const magic = 0x31544e46; // FNT1, little endian
const aligned = (size: number) => Math.ceil(size / 8) * 8;
function familyName(value: string): Uint8Array {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 256 ||
    value.startsWith(' ') ||
    value.endsWith(' ')
  )
    throw Error('Invalid font family');
  for (let i = 0; i < value.length; ++i) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) throw Error('Invalid font family');
  }
  return encodeUtf8(value, 256);
}
/** Validate/measure a family before allocating an additive catalog. */
export { familyName as fontFamilyBytes };
function validate(catalog: FontCatalog): void {
  if (catalog.fonts.length > 64 || !catalog.fallback.length || catalog.fallback.length > 8)
    throw Error('Font catalog count exceeds its bound');
  const names = new Set(bundledFontFamilies);
  for (const font of catalog.fonts) {
    familyName(font.family);
    if (
      !(font.bytes instanceof Uint8Array) ||
      font.bytes.length < 12 ||
      font.bytes.length > fontCatalogLimit
    )
      throw Error('Invalid font bytes');
    names.add(font.family);
  }
  const seen = new Set<string>();
  for (const name of catalog.fallback) {
    familyName(name);
    if (!names.has(name) || seen.has(name)) throw Error('Unknown or duplicate fallback family');
    seen.add(name);
  }
}
export function fontCatalogBytes(input: FontCatalogInput): Uint8Array {
  const catalog = { fonts: input.fonts, fallback: input.fallback ?? bundledFontFamilies };
  validate(catalog);
  const records = catalog.fonts.map((font) => ({ ...font, name: familyName(font.family) })),
    fallback = catalog.fallback.map(familyName),
    size =
      32 +
      records.reduce(
        (sum, font) => sum + 16 + aligned(font.name.length) + aligned(font.bytes.length),
        0,
      ) +
      fallback.reduce((sum, name) => sum + 8 + aligned(name.length), 0);
  if (size > fontCatalogLimit) throw Error('Font catalog byte budget exceeded');
  const bytes = new Uint8Array(size),
    data = new DataView(bytes.buffer);
  [magic, 1, records.length, fallback.length, size].forEach((value, index) =>
    data.setUint32(index * 4, value, true),
  );
  let offset = 32;
  for (const font of records) {
    data.setUint32(offset, font.name.length, true);
    data.setUint32(offset + 4, font.bytes.length, true);
    offset += 16;
    bytes.set(font.name, offset);
    offset += aligned(font.name.length);
    bytes.set(font.bytes, offset);
    offset += aligned(font.bytes.length);
  }
  for (const name of fallback) {
    data.setUint32(offset, name.length, true);
    offset += 8;
    bytes.set(name, offset);
    offset += aligned(name.length);
  }
  return bytes;
}
export function readFontCatalog(bytes: Uint8Array): FontCatalog {
  if (!(bytes instanceof Uint8Array) || bytes.length < 32 || bytes.length > fontCatalogLimit)
    throw Error('Invalid font catalog size');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = data.getUint32(8, true),
    fallbackCount = data.getUint32(12, true);
  if (
    data.getUint32(0, true) !== magic ||
    data.getUint32(4, true) !== 1 ||
    count > 64 ||
    !fallbackCount ||
    fallbackCount > 8 ||
    data.getUint32(16, true) !== bytes.length ||
    data.getUint32(20, true) ||
    data.getUint32(24, true) ||
    data.getUint32(28, true)
  )
    throw Error('Invalid font catalog header');
  let offset = 32;
  const range = (size: number) => {
      const length = aligned(size);
      if (offset + length > bytes.length) throw Error('Truncated font catalog');
      const value = bytes.subarray(offset, offset + size);
      for (let i = size; i < length; ++i)
        if (bytes[offset + i]) throw Error('Nonzero font catalog padding');
      offset += length;
      return value;
    },
    fonts: { family: string; bytes: Uint8Array }[] = [],
    fallback: string[] = [];
  for (let i = 0; i < count; ++i) {
    if (offset + 16 > bytes.length) throw Error('Truncated font record');
    const nameLength = data.getUint32(offset, true),
      size = data.getUint32(offset + 4, true);
    if (
      !nameLength ||
      nameLength > 256 ||
      size < 12 ||
      size > fontCatalogLimit ||
      data.getUint32(offset + 8, true) ||
      data.getUint32(offset + 12, true)
    )
      throw Error('Invalid font record');
    offset += 16;
    fonts.push(Object.freeze({ family: decodeUtf8(range(nameLength)), bytes: range(size) }));
  }
  for (let i = 0; i < fallbackCount; ++i) {
    if (offset + 8 > bytes.length) throw Error('Truncated fallback record');
    const length = data.getUint32(offset, true);
    if (!length || length > 256 || data.getUint32(offset + 4, true))
      throw Error('Invalid fallback record');
    offset += 8;
    fallback.push(decodeUtf8(range(length)));
  }
  if (offset !== bytes.length) throw Error('Trailing font catalog bytes');
  const catalog = Object.freeze({ fonts: Object.freeze(fonts), fallback: Object.freeze(fallback) });
  validate(catalog);
  return catalog;
}
