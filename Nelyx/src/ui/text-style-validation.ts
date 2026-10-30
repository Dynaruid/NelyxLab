// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { TextRunStyle, TextStrutStyle } from './text-styles.ts';
import { freezePaint } from './paint.ts';
import { markCapturedTextRecord, captureTextArray } from './text-input-data.ts';
import { mergeTextRunStyle } from './text-builder.ts';
function number(value: number, name: string, min = -16777216, max = 16777216): void {
  if (!(Number.isFinite(value) && value >= min && value <= max))
    invariant(false, 'invalid-text-style', name + ' outside finite budget');
}
function color(value: number): void {
  if (!(Number.isInteger(value) && value >= 0 && value <= 0xffffffff))
    invariant(false, 'invalid-text-style', 'Text color must be ARGB uint32');
}
export function freezeFontFamilies(value: readonly string[]): readonly string[] {
  if (
    !(
      value.length <= 64 &&
      value.every(
        (s) => typeof s === 'string' && s.length > 0 && s.length <= 256 && !s.includes('\0'),
      )
    )
  )
    invariant(false, 'invalid-text-style', 'Font family count/name budget');
  return captureTextArray([...value]);
}
const capturedRunStyles = new WeakSet<TextRunStyle>();
const capturedStrutStyles = new WeakSet<TextStrutStyle>();
const colorFields = ['color', 'backgroundColor', 'decorationColor'] as const,
  spacingFields = ['letterSpacing', 'wordSpacing'] as const;
const baselines = ['alphabetic', 'ideographic'],
  fontStyles = ['normal', 'italic'],
  leading = ['proportional', 'even'],
  decorations = ['solid', 'double', 'dotted', 'dashed', 'wavy'];
const openTypeFields = [
  ['fontFeatures', 'name', 'value'],
  ['fontVariations', 'axis', 'value'],
] as const;
export function freezeRunStyle(value: TextRunStyle): TextRunStyle {
  if (capturedRunStyles.has(value)) return value;
  if (!(value.foreground === undefined || value.color === undefined))
    invariant(false, 'invalid-text-style', 'Choose foreground Paint or color');
  if (!(value.background === undefined || value.backgroundColor === undefined))
    invariant(false, 'invalid-text-style', 'Choose background Paint or backgroundColor');
  if (value.textBaseline !== undefined) {
    if (!baselines.includes(value.textBaseline))
      invariant(false, 'invalid-text-style', 'Invalid text baseline');
  }
  for (let index = 0; index < colorFields.length; index++) {
    const n = colorFields[index]!;
    if (value[n] !== undefined) color(value[n]);
  }
  if (value.fontSize !== undefined) number(value.fontSize, 'Font size', 0, 512);
  if (value.fontWeight !== undefined) {
    if (!(Number.isInteger(value.fontWeight) && value.fontWeight >= 1 && value.fontWeight <= 1000))
      invariant(false, 'invalid-text-style', 'Font weight must be1..1000');
  }
  if (value.fontStyle !== undefined) {
    if (!fontStyles.includes(value.fontStyle))
      invariant(false, 'invalid-text-style', 'Invalid font style');
  }
  for (let index = 0; index < spacingFields.length; index++) {
    const n = spacingFields[index]!;
    if (value[n] !== undefined) number(value[n], n, -4096, 4096);
  }
  if (value.height !== undefined) number(value.height, 'Height multiplier', 0, 100);
  if (value.leadingDistribution !== undefined) {
    if (!leading.includes(value.leadingDistribution))
      invariant(false, 'invalid-text-style', 'Invalid leading distribution');
  }
  if (value.locale !== undefined) {
    if (!(value.locale.length <= 128 && !value.locale.includes('\0')))
      invariant(false, 'invalid-text-style', 'Invalid style locale');
  }
  if (value.decoration !== undefined) {
    if (!(Number.isInteger(value.decoration) && value.decoration >= 0 && value.decoration <= 7))
      invariant(false, 'invalid-text-style', 'Invalid decoration mask');
  }
  if (value.decorationThickness !== undefined)
    number(value.decorationThickness, 'Decoration thickness', 0, 100);
  if (value.decorationStyle !== undefined) {
    if (!decorations.includes(value.decorationStyle))
      invariant(false, 'invalid-text-style', 'Invalid decoration style');
  }
  for (let index = 0; index < openTypeFields.length; index++) {
    const fields = openTypeFields[index]!,
      name = fields[0],
      tag = fields[1],
      field = fields[2],
      list = value[name];
    if (list) {
      if (!(list.length <= 64)) invariant(false, 'invalid-text-style', 'OpenType entry budget');
      for (const item of list) {
        const record = item as unknown as Record<string, unknown>;
        if (!(typeof record[tag] === 'string' && /^[\x20-\x7e]{4}$/.test(record[tag])))
          invariant(false, 'invalid-text-style', 'Invalid OpenType tag');
        const n = record[field] as number;
        number(
          n,
          name,
          name === 'fontFeatures' ? 0 : -16777216,
          name === 'fontFeatures' ? 0xffffffff : 16777216,
        );
        if (name === 'fontFeatures') {
          if (!Number.isInteger(n))
            invariant(false, 'invalid-text-style', 'Font feature must be integer');
        }
      }
    }
  }
  if (value.shadows) {
    if (!(value.shadows.length <= 16)) invariant(false, 'invalid-text-style', 'Text shadow budget');
    for (const shadow of value.shadows) {
      color(shadow.color);
      number(shadow.offset.x, 'Shadow x');
      number(shadow.offset.y, 'Shadow y');
      number(shadow.blurSigma, 'Shadow blur', 0, 4096);
    }
  }
  const captured = Object.freeze({
    ...value,
    ...(value.foreground ? { foreground: freezePaint(value.foreground) } : undefined),
    ...(value.background ? { background: freezePaint(value.background) } : undefined),
    ...(value.fontFamilies ? { fontFamilies: freezeFontFamilies(value.fontFamilies) } : undefined),
    ...(value.fontFeatures
      ? { fontFeatures: Object.freeze(value.fontFeatures.map((x) => Object.freeze({ ...x }))) }
      : undefined),
    ...(value.fontVariations
      ? { fontVariations: Object.freeze(value.fontVariations.map((x) => Object.freeze({ ...x }))) }
      : undefined),
    ...(value.shadows
      ? {
          shadows: Object.freeze(
            value.shadows.map((x) =>
              Object.freeze({ ...x, offset: Object.freeze({ x: x.offset.x, y: x.offset.y }) }),
            ),
          ),
        }
      : undefined),
  });
  capturedRunStyles.add(captured);
  markCapturedTextRecord(captured);
  return captured;
}
/** Inherit captured descriptors without recapturing each immutable nested list.
 * Image bindings and external styles keep the full capture boundary. */
export function inheritTextRunStyle(base: TextRunStyle, value: TextRunStyle): TextRunStyle {
  const merged = mergeTextRunStyle(base, value);
  if (
    !capturedRunStyles.has(base) ||
    !capturedRunStyles.has(value) ||
    merged.foreground?.shader?.kind === 'image' ||
    merged.background?.shader?.kind === 'image'
  )
    return freezeRunStyle(merged);
  const captured = Object.freeze(merged);
  capturedRunStyles.add(captured);
  markCapturedTextRecord(captured);
  return captured;
}
export function freezeStrutStyle(value: TextStrutStyle): TextStrutStyle {
  if (capturedStrutStyles.has(value)) return value;
  freezeRunStyle({ ...value });
  if (value.leading !== undefined) number(value.leading, 'Strut leading', 0, 100);
  if (value.forceStrutHeight !== undefined) {
    if (!(typeof value.forceStrutHeight === 'boolean'))
      invariant(false, 'invalid-text-style', 'Invalid strut flag');
  }
  const captured = Object.freeze({
    ...value,
    ...(value.fontFamilies ? { fontFamilies: freezeFontFamilies(value.fontFamilies) } : {}),
  });
  capturedStrutStyles.add(captured);
  markCapturedTextRecord(captured);
  return captured;
}
