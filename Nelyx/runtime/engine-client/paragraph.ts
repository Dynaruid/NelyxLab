// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import { encodeUtf8, decodeUtf8 } from './utf8.ts';
import { paragraphRunBytes, readParagraphRuns } from './paragraph-runs.ts';
import type { ParagraphRun } from './paragraph-runs.ts';
export type { ParagraphRun } from './paragraph-runs.ts';
import { paragraphExtrasBytes, readParagraphExtras } from './paragraph-extras.ts';
import type { ParagraphStrut, ParagraphPlaceholder } from './paragraph-extras.ts';
import { validateParagraphRuns } from './paragraph-runs.ts';

/** An independent, bounded text measurement in the same Content font cohort. */
export interface ParagraphOverflowProbe {
  readonly text: string;
  readonly fontSize: number;
  readonly color: number;
  readonly paragraph: ParagraphOptions;
}

export interface ParagraphOptions {
  readonly overflowProbe?: ParagraphOverflowProbe;
  /** Core measures and places the ordered WidgetSpan children. */
  readonly inlineChildren?: boolean;
  readonly strut?: ParagraphStrut;
  readonly placeholders?: readonly ParagraphPlaceholder[];
  readonly runs?: readonly ParagraphRun[];
  readonly fontFamily?: string;
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
  readonly overflowProbe?: ParagraphOverflowProbe;
  readonly inlineChildren?: boolean;
  readonly strut?: ParagraphStrut;
  readonly placeholders?: readonly ParagraphPlaceholder[];
  readonly runs?: readonly ParagraphRun[];
  readonly fontFamily?: string;
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
  'overflowProbe',
  'inlineChildren',
  'strut',
  'placeholders',
  'runs',
  'fontFamily',
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
// A Source capture may hand its already validated payload to its immediately
// following scene projection. Only this module creates these frozen keys; the
// payload is consumed once and never exposed through a returned mutable view.
const preparedParagraphs = new WeakMap<object, Uint8Array>();
const finite = (value: number) => {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw Error('Invalid paragraph scalar');
  return value;
};
export function readParagraphOptions(bytes: Uint8Array, allowProbe = true): ParagraphSnapshot {
  if (bytes.byteLength < p.paragraphBytes) throw Error('Truncated paragraph options');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    flags = data.getUint32(0, true),
    align = data.getUint32(4, true),
    maxLines = data.getUint32(8, true),
    localeLength = data.getUint32(12, true),
    ellipsisLength = data.getUint32(16, true),
    familyLength = data.getUint32(20, true),
    localeBytes = aligned(localeLength),
    ellipsisBytes = aligned(ellipsisLength),
    familyBytes = aligned(familyLength),
    height = finite(data.getFloat64(32, true)),
    letterSpacing = finite(data.getFloat64(40, true)),
    wordSpacing = finite(data.getFloat64(48, true));
  if (
    flags > 127 ||
    (!allowProbe && !!(flags & p.paragraphFlags.overflowProbe)) ||
    align > p.paragraphAlign.justify ||
    maxLines > p.limits.textBytes ||
    !localeLength ||
    localeLength > p.limits.localeBytes ||
    ellipsisLength > p.limits.ellipsisBytes ||
    familyLength > p.limits.fontFamilyBytes ||
    bytes.length < p.paragraphBytes + localeBytes + ellipsisBytes + familyBytes ||
    (data.getUint32(24, true) &&
      (data.getUint32(24, true) < 100 || data.getUint32(24, true) > 900)) ||
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
  for (let i = familyLength; i < familyBytes; ++i)
    if (bytes[p.paragraphBytes + localeBytes + ellipsisBytes + i])
      throw Error('Nonzero paragraph font family padding');
  const locale = decodeUtf8(bytes.subarray(p.paragraphBytes, p.paragraphBytes + localeLength)),
    ellipsis = decodeUtf8(
      bytes.subarray(
        p.paragraphBytes + localeBytes,
        p.paragraphBytes + localeBytes + ellipsisLength,
      ),
    ),
    fontFamily = decodeUtf8(
      bytes.subarray(
        p.paragraphBytes + localeBytes + ellipsisBytes,
        p.paragraphBytes + localeBytes + ellipsisBytes + familyLength,
      ),
    );
  if (locale.includes('\0')) throw Error('Invalid paragraph locale');
  if (fontFamily.includes('\0')) throw Error('Invalid paragraph font family');
  let extrasOffset = p.paragraphBytes + localeBytes + ellipsisBytes + familyBytes;
  let overflowProbe: ParagraphOverflowProbe | undefined;
  if (flags & p.paragraphFlags.overflowProbe) {
    if (bytes.length < extrasOffset + p.paragraphProbeBytes)
      throw Error('Truncated paragraph probe');
    const at = extrasOffset,
      textLength = data.getUint32(at, true),
      paragraphLength = data.getUint32(at + 4, true),
      fontSize = finite(data.getFloat64(at + 8, true)),
      color = data.getUint32(at + 16, true);
    if (
      !textLength ||
      textLength > p.limits.textBytes ||
      fontSize <= 0 ||
      fontSize > 512 ||
      data.getUint32(at + 20, true) ||
      paragraphLength < p.paragraphBytes ||
      bytes.length < at + p.paragraphProbeBytes + aligned(textLength) + paragraphLength
    )
      throw Error('Invalid paragraph probe');
    const textAt = at + p.paragraphProbeBytes,
      text = decodeUtf8(bytes.subarray(textAt, textAt + textLength)),
      paragraph = readParagraphOptions(
        bytes.subarray(
          textAt + aligned(textLength),
          textAt + aligned(textLength) + paragraphLength,
        ),
        false,
      );
    for (let i = textLength; i < aligned(textLength); ++i)
      if (bytes[textAt + i]) throw Error('Nonzero paragraph probe padding');
    if (paragraph.inlineChildren || paragraph.placeholders?.length)
      throw Error('Paragraph probe cannot have children');
    validateParagraphRuns(text, paragraph.runs);
    const { height, ...options } = paragraph;
    overflowProbe = Object.freeze({
      text,
      fontSize,
      color,
      paragraph: Object.freeze({ ...options, ...(height === null ? {} : { height }) }),
    });
    extrasOffset = textAt + aligned(textLength) + paragraphLength;
  }
  const extras = readParagraphExtras(
      bytes.subarray(extrasOffset),
      data.getUint32(56, true),
      data.getUint32(60, true),
    ),
    runs = readParagraphRuns(
      bytes.subarray(extrasOffset + extras.length),
      data.getUint32(28, true),
    );
  if (runs.length + (overflowProbe?.paragraph.runs?.length ?? 0) > p.limits.paragraphRuns)
    throw Error('Paragraph run budget includes its probe');
  return Object.freeze({
    ...(overflowProbe ? { overflowProbe } : {}),
    ...(flags & p.paragraphFlags.inlineChildren ? { inlineChildren: true } : {}),
    ...(extras.strut ? { strut: extras.strut } : {}),
    ...(extras.placeholders ? { placeholders: extras.placeholders } : {}),
    ...(runs.length ? { runs } : {}),
    ...(fontFamily ? { fontFamily } : {}),
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
export function paragraphOptionsBytes(
  value: ParagraphOptions | null,
  allowProbe = true,
): Uint8Array {
  if (!value) return new Uint8Array();
  const prepared = preparedParagraphs.get(value);
  if (prepared && (allowProbe || !value.overflowProbe)) {
    preparedParagraphs.delete(value);
    return prepared.slice();
  }
  return encodeParagraphOptions(value, allowProbe, false) as Uint8Array;
}
/** Capture through the same codec validation without decoding its result twice. */
export function captureParagraphOptions(value: ParagraphOptions): ParagraphSnapshot {
  return encodeParagraphOptions(value, true, true) as ParagraphSnapshot;
}
/** @internal One capture's owned payload, not a cache for public producers. */
export function prepareParagraphOptions(value: ParagraphOptions): ParagraphSnapshot {
  return encodeParagraphOptions(value, true, true, true) as ParagraphSnapshot;
}
/** @internal Preserve the Source's existing height omission and wrap override. */
export function paragraphSceneOptions(value: ParagraphSnapshot, wrap: boolean): ParagraphOptions {
  const { height, ...options } = value;
  const result: ParagraphOptions = { ...options, ...(height === null ? {} : { height }), wrap };
  const prepared = preparedParagraphs.get(value);
  if (prepared && typeof wrap === 'boolean') {
    preparedParagraphs.delete(value);
    let bytes = prepared;
    if (wrap !== value.wrap) {
      bytes = prepared.slice();
      const data = new DataView(bytes.buffer);
      data.setUint32(
        0,
        (data.getUint32(0, true) & ~p.paragraphFlags.wrap) | (wrap ? p.paragraphFlags.wrap : 0),
        true,
      );
    }
    Object.freeze(result);
    preparedParagraphs.set(result, bytes);
  }
  return result;
}
/** @internal The key's entire nested policy was decoded from validated bytes. */
export function isPreparedParagraphOptions(value: ParagraphOptions): boolean {
  return preparedParagraphs.has(value);
}
function encodeParagraphOptions(
  value: ParagraphOptions,
  allowProbe: boolean,
  capture: boolean,
  prepare = false,
): Uint8Array | ParagraphSnapshot {
  for (const key of Object.keys(value))
    if (!allowed.has(key)) throw Error('Unknown paragraph option: ' + key);
  if (!allowProbe && value.overflowProbe) throw Error('Nested paragraph probe');
  const probe = value.overflowProbe,
    probeText = probe ? encodeUtf8(probe.text, p.limits.textBytes) : new Uint8Array(),
    probeParagraph = probe ? paragraphOptionsBytes(probe.paragraph, false) : new Uint8Array(),
    probeLength = probe
      ? p.paragraphProbeBytes + aligned(probeText.length) + probeParagraph.length
      : 0;
  if (
    probe &&
    Object.keys(probe).some((key) => !['text', 'fontSize', 'color', 'paragraph'].includes(key))
  )
    throw Error('Unknown paragraph probe field');
  for (const key of [
    'inlineChildren',
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
  const runs = paragraphRunBytes(value.runs ?? []),
    extras = paragraphExtrasBytes(value.strut, value.placeholders),
    locale = encodeUtf8(value.locale ?? 'en', p.limits.localeBytes),
    ellipsis = encodeUtf8(value.ellipsis ?? '', p.limits.ellipsisBytes),
    family = encodeUtf8(value.fontFamily ?? '', p.limits.fontFamilyBytes),
    bytes = new Uint8Array(
      p.paragraphBytes +
        aligned(locale.length) +
        aligned(ellipsis.length) +
        aligned(family.length) +
        extras.bytes.length +
        runs.length +
        probeLength,
    ),
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
      (value.inlineChildren ? p.paragraphFlags.inlineChildren : 0) |
      (probe ? p.paragraphFlags.overflowProbe : 0) |
      (value.applyHeightToFirstAscent === false ? p.paragraphFlags.disableFirstAscent : 0) |
      (value.applyHeightToLastDescent === false ? p.paragraphFlags.disableLastDescent : 0),
    true,
  );
  data.setUint32(4, align, true);
  data.setUint32(8, maxLines, true);
  data.setUint32(12, locale.length, true);
  data.setUint32(16, ellipsis.length, true);
  data.setUint32(20, family.length, true);
  data.setUint32(28, value.runs?.length ?? 0, true);
  data.setUint32(56, extras.strutLength, true);
  data.setUint32(60, value.placeholders?.length ?? 0, true);
  if (value.fontWeight !== undefined && value.fontWeight !== 400) {
    if (!Number.isInteger(value.fontWeight)) throw Error('Invalid paragraph weight');
    data.setUint32(24, value.fontWeight, true);
  }
  data.setFloat64(32, finite(value.height ?? -1), true);
  data.setFloat64(40, finite(value.letterSpacing ?? 0), true);
  data.setFloat64(48, finite(value.wordSpacing ?? 0), true);
  bytes.set(locale, p.paragraphBytes);
  bytes.set(ellipsis, p.paragraphBytes + aligned(locale.length));
  bytes.set(family, p.paragraphBytes + aligned(locale.length) + aligned(ellipsis.length));
  const probeOffset =
    p.paragraphBytes + aligned(locale.length) + aligned(ellipsis.length) + aligned(family.length);
  if (probe) {
    if (!Number.isInteger(probe.color) || probe.color < 0 || probe.color > 0xffffffff)
      throw Error('Invalid paragraph probe color');
    data.setUint32(probeOffset, probeText.length, true);
    data.setUint32(probeOffset + 4, probeParagraph.length, true);
    data.setFloat64(probeOffset + 8, finite(probe.fontSize), true);
    data.setUint32(probeOffset + 16, probe.color, true);
    bytes.set(probeText, probeOffset + p.paragraphProbeBytes);
    bytes.set(probeParagraph, probeOffset + p.paragraphProbeBytes + aligned(probeText.length));
  }
  const extrasOffset = probeOffset + probeLength;
  bytes.set(extras.bytes, extrasOffset);
  bytes.set(runs, extrasOffset + extras.bytes.length);
  const snapshot = readParagraphOptions(bytes);
  if (prepare) preparedParagraphs.set(snapshot, bytes);
  return capture ? snapshot : bytes;
}
