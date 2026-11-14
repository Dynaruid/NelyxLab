// SPDX-License-Identifier: BSD-3-Clause
import { ParagraphBuilder } from '@nelyx/core/ui/paragraph-builder';
import { ParagraphStyle } from '@nelyx/core/ui/paragraph-style';
import type { TextLayoutInput } from '@nelyx/core/ui/types';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextParentData } from '@nelyx/core/framework/rendering/paragraph';
import type { RenderParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { WidgetSpan } from '@nelyx/core/framework/widgets/widget-span';
import { PlaceholderDimensions } from '@nelyx/core/framework/painting/placeholder-dimensions';
import { Size } from '@nelyx/core/ui/size';
import { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { originalParagraphInput } from './paragraph.ts';
import type { AppTextInput } from '../engine-client/app-text.ts';
type TextRun = NonNullable<TextLayoutInput['runs']>[number];
type TextRunStyle = TextRun['style'];

/** Reuse Source's build/validation and style stack without asking it to layout. */
class SpanRecorder extends ParagraphBuilder {
  value = '';
  readonly recordedRuns: TextRun[] = [];
  readonly recordedPlaceholders: NonNullable<TextLayoutInput['placeholders']>[number][] = [];
  private readonly declarations: TextRunStyle[] = [{}];
  constructor() {
    super(new ParagraphStyle());
  }
  override pushStyle(style: TextRunStyle): void {
    super.pushStyle(style);
    const merged = { ...this.declarations[this.declarations.length - 1], ...style };
    if (merged.foreground) delete merged.color;
    if (merged.background) delete merged.backgroundColor;
    this.declarations.push(Object.freeze(merged));
  }
  override pop(): void {
    super.pop();
    if (this.declarations.length > 1) this.declarations.pop();
  }
  override addText(value: string): void {
    super.addText(value);
    if (!value.length) return;
    const start = this.value.length;
    this.value += value;
    this.recordedRuns.push(
      Object.freeze({
        start,
        end: this.value.length,
        style: this.declarations[this.declarations.length - 1]!,
      }),
    );
  }
  override addPlaceholder(...args: Parameters<ParagraphBuilder['addPlaceholder']>): void {
    const [width, height, alignment, options = {}] = args;
    const offset = this.value.length,
      scale = options.scale ?? 1;
    super.addPlaceholder(...args);
    this.recordedPlaceholders.push(
      Object.freeze({
        offset,
        width: width * scale,
        height: height * scale,
        alignment,
        baseline: options.baseline ?? 'alphabetic',
        baselineOffset: (options.baselineOffset ?? height) * scale,
      }),
    );
  }
}
export function originalSpanInput(
  render: RenderParagraph,
  unsupported: (reason: string) => never,
  providerFamilies?: ReadonlySet<string>,
): AppTextInput {
  const config = render.config,
    painter = config.painterOptions ?? {},
    paragraph = config.paragraphOptions ?? {};
  if (
    render.registrar ||
    (painter.hyphens !== undefined && !['manual', 'hidden'].includes(painter.hyphens)) ||
    (paragraph.overflow !== undefined &&
      !['clip', 'visible', 'ellipsis', 'fade'].includes(paragraph.overflow)) ||
    (paragraph.textWidthBasis !== undefined && paragraph.textWidthBasis !== 'parent')
  )
    return unsupported('paragraph-style-or-selection');
  let count = 0;
  const slots: WidgetSpan[] = [];
  const validate = (span: unknown, depth: number): void => {
    if (++count > 256 || depth >= 128) return unsupported('paragraph-span-budget');
    if (span instanceof WidgetSpan && Object.getPrototypeOf(span) === WidgetSpan.prototype) {
      if (slots.length >= 64) return unsupported('paragraph-placeholder-budget');
      slots.push(span);
      return;
    }
    if (
      !(span instanceof TextSpan) ||
      Object.getPrototypeOf(span) !== TextSpan.prototype ||
      span.recognizer !== null ||
      span.semanticsLabel !== null ||
      span.semanticsIdentifier !== null ||
      span.locale !== null ||
      span.spellOut !== null ||
      span.mouseCursor !== MouseCursor.defer ||
      span.onEnter ||
      span.onExit
    )
      return unsupported('paragraph-interactive-or-custom-span');
    for (const child of span.children ?? []) validate(child, depth + 1);
  };
  validate(config.span, 0);
  if (
    config.placeholderCount !== slots.length ||
    render.children.length !== slots.length ||
    render.children.some(
      (child, i) =>
        !(child.parentData instanceof TextParentData) || child.parentData.span !== slots[i],
    )
  )
    return unsupported('paragraph-placeholder-children');
  const recorder = new SpanRecorder(),
    style = config.style.merge(config.span.style);
  try {
    const dimensions = slots.map(
      (span) =>
        new PlaceholderDimensions({
          size: Size.zero,
          alignment: span.alignment,
          baseline: span.baseline,
        }),
    );
    new TextSpan({ style, children: [config.span] }).build(recorder, {
      textScaler: config.scaler,
      dimensions,
    });
    const size = config.scaler.scale(style.fontSize ?? 18);
    if (!(Number.isFinite(size) && size > 0 && size <= 512))
      return unsupported('paragraph-font-size');
    const input: TextLayoutInput = {
      text: recorder.value,
      style: style.toRunStyle(config.scaler),
      runs: recorder.recordedRuns,
      ...(slots.length ? { placeholders: recorder.recordedPlaceholders } : {}),
      font: config.font,
      fontSize: size,
      width: 0,
      direction: painter.textDirection ?? 'ltr',
      scale: config.scale,
      locale: String(painter.locale ?? style.locale ?? 'en'),
      color: style.color ?? 0xffe8eef8,
      unlimitedLines: painter.maxLines == null,
      ...(painter.maxLines == null ? {} : { maxLines: painter.maxLines }),
      ellipsis: painter.ellipsis ?? '',
      hyphens: painter.hyphens ?? 'manual',
      ...(painter.strutStyle ? { strutStyle: painter.strutStyle.toStyle(config.scaler) } : {}),
      textAlign: painter.textAlign ?? 'start',
      ...(painter.textHeightBehavior ? { textHeightBehavior: painter.textHeightBehavior } : {}),
    };
    const main = originalParagraphInput(
      input,
      unsupported,
      true,
      slots.length > 0,
      providerFamilies,
      true,
    );
    if (paragraph.overflow !== 'fade') return main;
    const {
      runs: _runs,
      placeholders: _placeholders,
      maxLines: _maxLines,
      strutStyle: _strut,
      textHeightBehavior: _heightBehavior,
      ...probeInput
    } = input;
    const metric = originalParagraphInput(
      {
        ...probeInput,
        text: '\u2026',
        unlimitedLines: true,
        ellipsis: '',
        textAlign: 'start',
        hyphens: 'manual',
      },
      unsupported,
      true,
      false,
      providerFamilies,
    );
    const { height, ...metricOptions } = metric.paragraph;
    return Object.freeze({
      ...main,
      paragraph: Object.freeze({
        ...main.paragraph,
        overflowProbe: Object.freeze({
          text: metric.text,
          fontSize: metric.fontSize,
          color: metric.color,
          paragraph: Object.freeze({ ...metricOptions, ...(height === null ? {} : { height }) }),
        }),
      }),
    });
  } finally {
    recorder.dispose();
  }
}
