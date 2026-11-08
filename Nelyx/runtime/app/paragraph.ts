// SPDX-License-Identifier: BSD-3-Clause
import type { TextLayoutInput } from '@nelyx/core/ui/types';
import { paragraphOptionsBytes, readParagraphOptions } from '../engine-client/paragraph.ts';
import type { ParagraphRun } from '../engine-client/paragraph.ts';
import { validateParagraphRuns } from '../engine-client/paragraph-runs.ts';
import { validateParagraphPlaceholders } from '../engine-client/paragraph-extras.ts';
import type { AppTextInput } from '../engine-client/app-text.ts';
import { fontFamilyBytes } from '../engine-client/font-catalog.ts';
type TextRunStyle = NonNullable<TextLayoutInput['style']>;

const admitted = new Set([
  'color',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'fontFamilies',
  'fontStyle',
  'height',
  'letterSpacing',
  'wordSpacing',
  'locale',
  'leadingDistribution',
  'decoration',
  'decorationColor',
  'decorationThickness',
  'decorationStyle',
  'textBaseline',
  'foreground',
  'background',
  'fontFeatures',
  'fontVariations',
  'shadows',
]);
const families = new Set(['NelyxDefault', 'NelyxArabic', 'NelyxHebrew', 'NelyxEmoji']);
function solid(
  paint: TextRunStyle['foreground'],
  unsupported: (reason: string) => never,
): number | undefined {
  if (!paint) return undefined;
  if (
    paint.style !== 'fill' ||
    paint.blendMode !== 'srcOver' ||
    !paint.isAntiAlias ||
    paint.shader ||
    paint.colorFilter ||
    paint.imageFilter ||
    paint.maskFilter ||
    paint.invertColors ||
    paint.dither
  )
    return unsupported('App-text-custom-Paint');
  return paint.color;
}
/** Capture only declarations. Both App and Content use this exact wire policy. */
export function originalParagraphInput(
  input: TextLayoutInput,
  unsupported: (reason: string) => never,
  allowProviderFamilies = false,
  inlineChildren = false,
  providerFamilies?: ReadonlySet<string>,
): AppTextInput {
  const base = input.style ?? {},
    scale = input.textScale ?? 1;
  const resolveFamilies = (values: readonly string[] | undefined) => {
    if (values && values.length > 8) return unsupported('App-text-font-family-count');
    const names = (values?.length ? values : ['NelyxDefault']).map((family) =>
      family === 'CupertinoSystemText' || family === 'CupertinoSystemDisplay'
        ? 'NelyxDefault'
        : family,
    );
    for (const name of names) fontFamilyBytes(name);
    if (allowProviderFamilies && !providerFamilies) return names;
    // An unavailable requested face falls through to the next declared face,
    // then the bundled default. Never alias another face under its name or let
    // App and Content choose different fonts for the same paragraph revision.
    const available = providerFamilies ?? families;
    const resolved = names.filter((family) => available.has(family));
    if (!resolved.length && !available.has('NelyxDefault'))
      return unsupported('App-text-default-font-unavailable');
    return resolved.length ? resolved : ['NelyxDefault'];
  };
  const resolved = (style: TextRunStyle, start: number, end: number): ParagraphRun => {
    if (
      Object.keys(style).some((key) => !admitted.has(key)) ||
      (style.textBaseline !== undefined &&
        !['alphabetic', 'ideographic'].includes(style.textBaseline))
    )
      return unsupported('App-text-style');
    const fontFamilies = resolveFamilies(style.fontFamilies);
    const color = solid(style.foreground, unsupported) ?? style.color ?? input.color ?? 0xffeef5ff,
      backgroundColor = solid(style.background, unsupported) ?? style.backgroundColor;
    return {
      start,
      end,
      color,
      ...(backgroundColor === undefined ? {} : { backgroundColor }),
      fontFamilies,
      fontSize: (style.fontSize ?? input.fontSize) * scale,
      fontWeight: style.fontWeight ?? 400,
      fontStyle: style.fontStyle ?? 'normal',
      locale: style.locale ?? input.locale ?? 'en',
      height: style.height ?? null,
      letterSpacing: style.letterSpacing ?? 0,
      wordSpacing: style.wordSpacing ?? 0,
      halfLeading:
        (style.leadingDistribution ?? input.textHeightBehavior?.leadingDistribution) === 'even',
      ...(style.textBaseline === 'ideographic' ? { textBaseline: 'ideographic' } : {}),
      decoration: style.decoration ?? 0,
      decorationStyle: style.decorationStyle ?? 'solid',
      ...(style.decorationColor === undefined ? {} : { decorationColor: style.decorationColor }),
      decorationThickness: style.decorationThickness ?? 1,
      ...(style.fontFeatures?.length ? { fontFeatures: style.fontFeatures } : {}),
      ...(style.fontVariations?.length ? { fontVariations: style.fontVariations } : {}),
      ...(style.shadows?.length ? { shadows: style.shadows } : {}),
    };
  };
  const runs: ParagraphRun[] = [];
  let cursor = 0;
  for (const run of input.runs ?? []) {
    if (run.start < cursor || run.end <= run.start || run.end > input.text.length)
      throw Error('Invalid Source paragraph run');
    if (cursor < run.start) runs.push(resolved(base, cursor, run.start));
    const style = { ...base, ...run.style };
    // Match ParagraphBuilder's Paint precedence after inheritance.
    if (style.foreground) delete style.color;
    if (style.background) delete style.backgroundColor;
    runs.push(resolved(style, run.start, run.end));
    cursor = run.end;
  }
  if (cursor < input.text.length) runs.push(resolved(base, cursor, input.text.length));
  const first = runs[0] ?? resolved(base, 0, 0),
    signature = ({ start: _start, end: _end, ...style }: ParagraphRun) => JSON.stringify(style),
    uniform = runs.every((run) => signature(run) === signature(first)),
    plain =
      uniform &&
      first.textBaseline !== 'ideographic' &&
      first.fontStyle === 'normal' &&
      first.backgroundColor === undefined &&
      first.decoration === 0 &&
      !first.fontFeatures?.length &&
      !first.fontVariations?.length &&
      !first.shadows?.length &&
      first.fontFamilies.length === 1 &&
      (allowProviderFamilies || providerFamilies || first.fontFamilies[0] === 'NelyxDefault'),
    defaults = plain ? first : resolved(base, 0, input.text.length),
    paragraph = readParagraphOptions(
      paragraphOptionsBytes({
        ...(input.strutStyle
          ? {
              strut: (() => {
                const strut = input.strutStyle!;
                if (
                  Object.keys(strut).some(
                    (key) =>
                      ![
                        'fontFamilies',
                        'fontSize',
                        'fontWeight',
                        'fontStyle',
                        'height',
                        'leading',
                        'leadingDistribution',
                        'forceStrutHeight',
                      ].includes(key),
                  )
                )
                  return unsupported('App-text-strut-style');
                return {
                  fontFamilies: resolveFamilies(strut.fontFamilies),
                  fontSize: (strut.fontSize ?? input.fontSize) * scale,
                  fontWeight: strut.fontWeight ?? 400,
                  fontStyle: strut.fontStyle ?? 'normal',
                  height: strut.height ?? null,
                  leading: strut.leading ?? 0,
                  halfLeading:
                    (strut.leadingDistribution ?? input.textHeightBehavior?.leadingDistribution) ===
                    'even',
                  forceStrutHeight: strut.forceStrutHeight ?? false,
                };
              })(),
            }
          : {}),
        ...(input.placeholders?.length ? { placeholders: input.placeholders } : {}),
        ...(inlineChildren ? { inlineChildren: true } : {}),
        ...(plain &&
        (allowProviderFamilies || providerFamilies) &&
        first.fontFamilies[0] !== 'NelyxDefault'
          ? { fontFamily: first.fontFamilies[0]! }
          : {}),
        fontWeight: defaults.fontWeight,
        hyphens: input.hyphens ?? 'manual',
        textAlign: input.textAlign ?? 'start',
        maxLines: input.unlimitedLines ? 0 : (input.maxLines ?? 128),
        ellipsis: input.ellipsis ?? '',
        locale: defaults.locale,
        ...(defaults.height === null ? {} : { height: defaults.height }),
        letterSpacing: defaults.letterSpacing,
        wordSpacing: defaults.wordSpacing,
        halfLeading: defaults.halfLeading,
        applyHeightToFirstAscent: input.textHeightBehavior?.applyHeightToFirstAscent ?? true,
        applyHeightToLastDescent: input.textHeightBehavior?.applyHeightToLastDescent ?? true,
        ...(plain || !runs.length ? {} : { runs }),
      }),
    );
  validateParagraphRuns(input.text, paragraph.runs);
  validateParagraphPlaceholders(input.text, paragraph.placeholders);
  return Object.freeze({
    text: input.text,
    width: input.width,
    fontSize: defaults.fontSize,
    color: defaults.color,
    textDirection: input.direction === 'rtl' ? 1 : 0,
    paragraph,
  });
}
