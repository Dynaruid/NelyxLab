// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';

export interface ParagraphOptions {
  readonly fontWeight?: number;
  readonly hyphens?: 'manual' | 'hidden';
  readonly textAlign?: keyof typeof p.paragraphAlign;
  readonly wrap?: boolean;
  readonly maxLines?: number;
  readonly ellipsis?: string;
  readonly locale?: string;
  readonly height?: number;
  readonly letterSpacing?: number;
  readonly wordSpacing?: number;
  readonly halfLeading?: boolean;
  readonly applyHeightToFirstAscent?: boolean;
  readonly applyHeightToLastDescent?: boolean;
}
export interface ParagraphSnapshot {
  readonly fontWeight?: number;
  readonly hyphens: 'manual' | 'hidden';
  readonly textAlign: keyof typeof p.paragraphAlign;
  readonly wrap: boolean;
  readonly maxLines: number;
  readonly ellipsis: string;
  readonly locale: string;
  readonly height: number | null;
  readonly letterSpacing: number;
  readonly wordSpacing: number;
  readonly halfLeading: boolean;
  readonly applyHeightToFirstAscent: boolean;
  readonly applyHeightToLastDescent: boolean;
}
const names = Object.keys(p.paragraphAlign) as (keyof typeof p.paragraphAlign)[];
const allowed = new Set([
  'fontWeight',
  'hyphens',
  'textAlign',
  'wrap',
  'maxLines',
  'ellipsis',
  'locale',
  'height',
  'letterSpacing',
  'wordSpacing',
  'halfLeading',
  'applyHeightToFirstAscent',
  'applyHeightToLastDescent',
]);
const aligned = (size: number) => Math.ceil(size / 8) * 8;
const finite = (value: number) => {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw Error('Invalid paragraph scalar');
  return value;
};
export function readParagraphOptions(bytes: Uint8Array): ParagraphSnapshot {
  if (bytes.byteLength < p.paragraphBytes) throw Error('Truncated paragraph options');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    flags = data.getUint32(0, true),
    align = data.getUint32(4, true),
    maxLines = data.getUint32(8, true),
    localeLength = data.getUint32(12, true),
    ellipsisLength = data.getUint32(16, true),
    localeBytes = aligned(localeLength),
    ellipsisBytes = aligned(ellipsisLength),
    height = finite(data.getFloat64(32, true)),
    letterSpacing = finite(data.getFloat64(40, true)),
    wordSpacing = finite(data.getFloat64(48, true));
  if (
    flags > 31 ||
    align > p.paragraphAlign.justify ||
    maxLines > p.limits.textBytes ||
    !localeLength ||
    localeLength > p.limits.localeBytes ||
    ellipsisLength > p.limits.ellipsisBytes ||
    bytes.length !== p.paragraphBytes + localeBytes + ellipsisBytes ||
    data.getUint32(20, true) ||
    data.getUint32(28, true) ||
    (data.getUint32(24, true) &&
      (data.getUint32(24, true) < 100 || data.getUint32(24, true) > 900)) ||
    data.getBigUint64(56, true) ||
    !(height === -1 || (height >= 0 && height <= 1e6)) ||
    letterSpacing < -1e6 ||
    letterSpacing > 1e6 ||
    wordSpacing < -1e6 ||
    wordSpacing > 1e6
  )
    throw Error('Invalid paragraph options');
  for (let i = localeLength; i < localeBytes; ++i)
    if (bytes[p.paragraphBytes + i]) throw Error('Nonzero paragraph locale padding');
  for (let i = ellipsisLength; i < ellipsisBytes; ++i)
    if (bytes[p.paragraphBytes + localeBytes + i])
      throw Error('Nonzero paragraph ellipsis padding');
  const locale = decodeUtf8(bytes.subarray(p.paragraphBytes, p.paragraphBytes + localeLength)),
    ellipsis = decodeUtf8(
      bytes.subarray(
        p.paragraphBytes + localeBytes,
        p.paragraphBytes + localeBytes + ellipsisLength,
      ),
    );
  if (locale.includes('\0')) throw Error('Invalid paragraph locale');
  return Object.freeze({
    ...(data.getUint32(24, true) ? { fontWeight: data.getUint32(24, true) } : {}),
    hyphens: flags & p.paragraphFlags.manualHyphens ? 'manual' : 'hidden',
    textAlign: names[align]!,
    wrap: !!(flags & p.paragraphFlags.wrap),
    maxLines,
    locale,
    ellipsis,
    height: height === -1 ? null : height,
    letterSpacing,
    wordSpacing,
    halfLeading: !!(flags & p.paragraphFlags.halfLeading),
    applyHeightToFirstAscent: !(flags & p.paragraphFlags.disableFirstAscent),
    applyHeightToLastDescent: !(flags & p.paragraphFlags.disableLastDescent),
  });
}
export function paragraphOptionsBytes(value: ParagraphOptions | null): Uint8Array {
  if (!value) return new Uint8Array();
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw Error('Unknown paragraph option: ' + key);
  for (const key of [
    'wrap',
    'halfLeading',
    'applyHeightToFirstAscent',
    'applyHeightToLastDescent',
  ] as const)
    if (value[key] !== undefined && typeof value[key] !== 'boolean')
      throw Error('Invalid paragraph flag: ' + key);
  if (!Object.hasOwn(p.paragraphAlign, value.textAlign ?? 'start'))
    throw Error('Invalid paragraph alignment');
  if (value.hyphens !== undefined && value.hyphens !== 'manual' && value.hyphens !== 'hidden')
    throw Error('Invalid paragraph hyphens');
  const locale = encodeUtf8(value.locale ?? 'en', p.limits.localeBytes),
    ellipsis = encodeUtf8(value.ellipsis ?? '', p.limits.ellipsisBytes),
    bytes = new Uint8Array(p.paragraphBytes + aligned(locale.length) + aligned(ellipsis.length)),
    data = new DataView(bytes.buffer),
    maxLines = value.maxLines ?? 0,
    align = p.paragraphAlign[value.textAlign ?? 'start'];
  if (
    !Number.isInteger(maxLines) ||
    maxLines < 0 ||
    maxLines > p.limits.textBytes ||
    align === undefined
  )
    throw Error('Invalid paragraph line limit or alignment');
  data.setUint32(
    0,
    (value.wrap === false ? 0 : p.paragraphFlags.wrap) |
      (value.hyphens === 'hidden' ? 0 : p.paragraphFlags.manualHyphens) |
      (value.halfLeading ? p.paragraphFlags.halfLeading : 0) |
      (value.applyHeightToFirstAscent === false ? p.paragraphFlags.disableFirstAscent : 0) |
      (value.applyHeightToLastDescent === false ? p.paragraphFlags.disableLastDescent : 0),
    true,
  );
  data.setUint32(4, align, true);
  data.setUint32(8, maxLines, true);
  data.setUint32(12, locale.length, true);
  data.setUint32(16, ellipsis.length, true);
  if (value.fontWeight !== undefined && value.fontWeight !== 400) {
    if (!Number.isInteger(value.fontWeight)) throw Error('Invalid paragraph weight');
    data.setUint32(24, value.fontWeight, true);
  }
  data.setFloat64(32, finite(value.height ?? -1), true);
  data.setFloat64(40, finite(value.letterSpacing ?? 0), true);
  data.setFloat64(48, finite(value.wordSpacing ?? 0), true);
  bytes.set(locale, p.paragraphBytes);
  bytes.set(ellipsis, p.paragraphBytes + aligned(locale.length));
  readParagraphOptions(bytes);
  return bytes;
}
