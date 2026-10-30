// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { invariant } from '../foundation/errors.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import { Paragraph } from './paragraph.ts';
import type { ParagraphContext, ParagraphTextSnapshot } from './paragraph.ts';
import { ParagraphStyle } from './paragraph-style.ts';
import type { PlaceholderAlignment, TextBaseline } from './typography.ts';
import type { TextRunStyle, TextRun, TextPlaceholder } from './text-styles.ts';
import type { ResourceId } from './types.ts';
import { freezeRunStyle, inheritTextRunStyle } from './text-style-validation.ts';
import { markCapturedTextRecord, captureTextArray } from './text-input-data.ts';
import type { ResourceHold } from './resource-retention.ts';
import { copyResourceId } from './resource-retention.ts';
import { textLimits } from './text.ts';
/** Pure text recording with optional explicit engine ownership; build transfers held inputs to Paragraph. */
export class ParagraphBuilder {
  private closed = false;
  private text = '';
  private readonly stack: TextRunStyle[];
  private readonly runs: TextRun[] = [];
  private readonly placeholders: TextPlaceholder[] = [];
  private readonly scales: number[] = [];
  private readonly holds: ResourceHold[] = [];
  private readonly held = new Set<string>();
  private readonly context: ParagraphContext | null;
  constructor(
    private readonly style: ParagraphStyle,
    context: ParagraphContext | null = null,
  ) {
    const locale = style.locale;
    this.stack = [
      freezeRunStyle({
        ...(style.fontFamily !== null ? { fontFamilies: [style.fontFamily] } : {}),
        ...(style.fontWeight !== null ? { fontWeight: style.fontWeight.value } : {}),
        ...(style.fontStyle !== null ? { fontStyle: style.fontStyle } : {}),
        ...(style.fontSize !== null ? { fontSize: style.fontSize } : {}),
        ...(style.height !== null ? { height: style.height } : {}),
        ...(locale !== null
          ? { locale: typeof locale === 'string' ? locale : locale.toString() }
          : {}),
        ...(style.textHeightBehavior
          ? { leadingDistribution: style.textHeightBehavior.leadingDistribution }
          : {}),
      }),
    ];
    this.context = context
      ? Object.freeze({ ...context, font: copyResourceId(context.font) })
      : null;
    if (this.context) this.keep([this.context.font]);
  }
  private live(): void {
    invariant(
      !this.closed,
      'closed-paragraph-builder',
      'ParagraphBuilder is invalid after build/dispose',
    );
  }
  private keep(resources: readonly ResourceId[]): void {
    if (!this.context) return;
    const fresh = new Map<string, ResourceId>();
    for (const resource of resources) {
      invariant(
        this.context.resources.has(resource),
        'stale-resource',
        'Paragraph input is foreign or retired',
      );
      const key = JSON.stringify([resource.id, resource.generation]);
      if (!this.held.has(key)) fresh.set(key, resource);
    }
    invariant(
      this.held.size + fresh.size <= textLimits.runs * 2 + 1,
      'paragraph-input-budget',
      'Too many retained paragraph inputs',
    );
    const acquired: ResourceHold[] = [];
    try {
      for (const resource of fresh.values())
        acquired.push(this.context.resources.retainProducer(resource));
    } catch (error) {
      const errors = [error];
      for (const hold of acquired)
        try {
          hold.dispose();
        } catch (failure) {
          errors.push(failure);
        }
      if (errors.length > 1)
        throw new AggregateError(errors, 'Paragraph input admission and rollback failed');
      throw error;
    }
    this.holds.push(...acquired);
    for (const key of fresh.keys()) this.held.add(key);
  }
  get placeholderCount(): number {
    return this.placeholders.length;
  }
  get placeholderScales(): number[] {
    return this.scales;
  }
  pushStyle(style: TextRunStyle): void {
    this.live();
    invariant(
      this.stack.length < 128,
      'paragraph-style-depth',
      'Paragraph style stack exceeds its budget',
    );
    const captured = freezeRunStyle(style),
      images = [captured.foreground?.shader, captured.background?.shader].flatMap((shader) =>
        shader?.kind === 'image' ? [shader.image] : [],
      );
    this.keep(images);
    this.stack.push(inheritTextRunStyle(this.stack[this.stack.length - 1]!, captured));
  }
  pop(): void {
    this.live();
    if (this.stack.length > 1) this.stack.pop();
  }
  addText(text: string): void {
    this.live();
    if (typeof text !== 'string') throw new TypeError('Paragraph text must be a string');
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = text.charCodeAt(++index);
        if (!(next >= 0xdc00 && next <= 0xdfff))
          throw new TypeError('string is not well-formed UTF-16');
      } else if (code >= 0xdc00 && code <= 0xdfff)
        throw new TypeError('string is not well-formed UTF-16');
    }
    if (text.length === 0) return;
    invariant(
      this.text.length + text.length <= textLimits.units && this.runs.length < textLimits.runs,
      'paragraph-text-budget',
      'Paragraph text/run budget exceeded',
    );
    const start = this.text.length;
    this.text += text;
    const run = Object.freeze({
      start,
      end: this.text.length,
      style: this.stack[this.stack.length - 1]!,
    });
    markCapturedTextRecord(run);
    this.runs.push(run);
  }
  addPlaceholder(
    width: number,
    height: number,
    alignment: PlaceholderAlignment,
    {
      scale = 1,
      baselineOffset = height,
      baseline = null,
    }: {
      readonly scale?: number;
      readonly baselineOffset?: number | null;
      readonly baseline?: TextBaseline | null;
    } = {},
  ): void {
    this.live();
    if (FoundationBuildMode.debug)
      invariant(
        !['baseline', 'aboveBaseline', 'belowBaseline'].includes(alignment) || baseline !== null,
        'missing-placeholder-baseline',
        'Baseline alignment requires a baseline',
      );
    invariant(
      Number.isFinite(width) &&
        Number.isFinite(height) &&
        Number.isFinite(scale) &&
        width >= 0 &&
        height >= 0 &&
        scale >= 0 &&
        Number.isFinite((baselineOffset ?? height) * scale),
      'invalid-placeholder',
      'Placeholder dimensions and scale must be finite and nonnegative',
    );
    invariant(
      this.placeholders.length < textLimits.placeholders,
      'paragraph-placeholder-budget',
      'Too many placeholders',
    );
    const offset = this.text.length;
    this.addText('\ufffc');
    const placeholder = Object.freeze({
      offset,
      width: width * scale,
      height: height * scale,
      alignment,
      baseline: baseline ?? 'alphabetic',
      baselineOffset: (baselineOffset ?? height) * scale,
    });
    markCapturedTextRecord(placeholder);
    this.placeholders.push(placeholder);
    this.scales.push(scale);
  }
  build(): Paragraph {
    this.live();
    const snapshot: ParagraphTextSnapshot = Object.freeze({
        text: this.text,
        style: this.stack[0]!,
        runs: captureTextArray([...this.runs]),
        placeholders: captureTextArray([...this.placeholders]),
      }),
      paragraph = Paragraph._fromBuilder(this.style, snapshot, this.context, this.holds.splice(0));
    this.closed = true;
    return paragraph;
  }
  /** Host extension for abandoning a builder without leaking input holds. */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    for (const hold of this.holds.splice(0))
      try {
        hold.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'ParagraphBuilder input retirement failed');
  }
  toString(): string {
    return 'ParagraphBuilder';
  }
}
