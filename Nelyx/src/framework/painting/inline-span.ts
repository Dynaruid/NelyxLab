// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { TextStyle } from './text-style.ts';
import type { TextScaler } from './text-scaler.ts';
import type { RenderComparison } from './basic-types.ts';
import type { TextPosition } from '../../ui/text-position.ts';
import { checkedInteger, protect } from '../../ui/value-math.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { DiagnosticableTree } from '../../foundation/diagnosticable.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import type { GestureRecognizer } from '../gestures/recognizer.ts';
import type { StringAttribute } from '../../ui/string-attribute.ts';
import { TextRange } from '../../ui/text-range.ts';
import { valueEquals, hashValues } from './value-equality.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import type { ParagraphBuilder } from '../../ui/paragraph-builder.ts';
import type { PlaceholderDimensions } from './placeholder-dimensions.ts';

export interface InlineSpanSemanticsOptions {
  readonly isPlaceholder?: boolean;
  readonly semanticsLabel?: string | null;
  readonly semanticsIdentifier?: string | null;
  readonly recognizer?: GestureRecognizer | null;
  readonly stringAttributes?: readonly StringAttribute[];
}
export class InlineSpanSemanticsInformation {
  static readonly placeholder = new InlineSpanSemanticsInformation('\ufffc', {
    isPlaceholder: true,
  });
  readonly isPlaceholder: boolean;
  readonly semanticsLabel: string | null;
  readonly semanticsIdentifier: string | null;
  readonly recognizer: GestureRecognizer | null;
  readonly stringAttributes: readonly StringAttribute[];
  readonly requiresOwnNode: boolean;
  constructor(
    readonly text: string,
    {
      isPlaceholder = false,
      semanticsLabel = null,
      semanticsIdentifier = null,
      recognizer = null,
      stringAttributes = [],
    }: InlineSpanSemanticsOptions = {},
  ) {
    if (FoundationBuildMode.debug)
      invariant(
        !isPlaceholder || (text === '\ufffc' && semanticsLabel === null && recognizer === null),
        'invalid-placeholder-semantics',
        'A placeholder must carry only its replacement character',
      );
    this.isPlaceholder = isPlaceholder;
    this.semanticsLabel = semanticsLabel;
    this.semanticsIdentifier = semanticsIdentifier;
    this.recognizer = recognizer;
    this.stringAttributes = Object.freeze([...stringAttributes]);
    this.requiresOwnNode = isPlaceholder || recognizer !== null || semanticsIdentifier !== null;
    if (new.target === InlineSpanSemanticsInformation) Object.freeze(this);
    else protect(this, Object.keys(this));
  }
  equals(other: unknown): boolean {
    return (
      other instanceof InlineSpanSemanticsInformation &&
      this.text === other.text &&
      this.semanticsLabel === other.semanticsLabel &&
      this.semanticsIdentifier === other.semanticsIdentifier &&
      this.recognizer === other.recognizer &&
      this.isPlaceholder === other.isPlaceholder &&
      this.stringAttributes.length === other.stringAttributes.length &&
      this.stringAttributes.every((value, i) => value === other.stringAttributes[i])
    );
  }
  get hashCode(): number {
    return hashValues(
      this.text,
      this.semanticsLabel,
      this.semanticsIdentifier,
      this.recognizer,
      this.isPlaceholder,
    );
  }
  toString(): string {
    return `${objectRuntimeType(this, 'InlineSpanSemanticsInformation')}{text: ${this.text}, semanticsLabel: ${this.semanticsLabel}, semanticsIdentifier: ${this.semanticsIdentifier}, recognizer: ${this.recognizer}}`;
  }
}
/** Preserve the source's empty separators around nodes that must stay distinct. */
export function combineSemanticsInfo(
  infoList: readonly InlineSpanSemanticsInformation[],
): InlineSpanSemanticsInformation[] {
  const combined: InlineSpanSemanticsInformation[] = [];
  let text = '',
    label = '',
    attributes: StringAttribute[] = [];
  for (const info of infoList) {
    if (info.requiresOwnNode) {
      combined.push(
        new InlineSpanSemanticsInformation(text, {
          semanticsLabel: label,
          stringAttributes: attributes,
        }),
      );
      text = '';
      label = '';
      attributes = [];
      combined.push(info);
    } else {
      text += info.text;
      for (const attribute of info.stringAttributes)
        attributes.push(
          attribute.copy({
            range: new TextRange({
              start: attribute.range.start + label.length,
              end: attribute.range.end + label.length,
            }),
          }),
        );
      label += info.semanticsLabel ?? info.text;
    }
  }
  combined.push(
    new InlineSpanSemanticsInformation(text, {
      semanticsLabel: label,
      stringAttributes: attributes,
    }),
  );
  return combined;
}
/** Source mutable traversal offset, using the explicit safe-number int adapter. */
export class Accumulator {
  private current: number;
  constructor(value = 0) {
    this.current = checkedInteger(value);
  }
  get value(): number {
    return this.current;
  }
  increment(addend: number): void {
    checkedInteger(addend);
    if (FoundationBuildMode.debug)
      invariant(
        addend >= 0,
        'negative-span-accumulator',
        'Accumulator increment must be nonnegative',
      );
    this.current = checkedInteger(this.current + addend);
  }
}
export type InlineSpanVisitor = (span: InlineSpan) => boolean;
export interface PlainTextOptions {
  readonly includeSemanticsLabels?: boolean;
  readonly includePlaceholders?: boolean;
}
export interface InlineSpanBuildOptions {
  readonly textScaler?: TextScaler;
  readonly dimensions?: readonly PlaceholderDimensions[] | null;
}
export abstract class InlineSpan extends DiagnosticableTree {
  constructor(readonly style: TextStyle | null = null) {
    super();
    protect(this, ['style']);
  }
  abstract build(builder: ParagraphBuilder, options?: InlineSpanBuildOptions): void;
  abstract visitDirectChildren(visitor: (span: InlineSpan) => boolean): boolean;
  abstract compareTo(other: InlineSpan): RenderComparison;
  protected abstract getSpanForPositionVisitor(
    position: TextPosition,
    offset: Accumulator,
  ): InlineSpan | null;
  protected abstract codeUnitAtVisitor(index: number, offset: Accumulator): number | null;
  protected abstract ownPlainText(options: PlainTextOptions): string;
  /** @internal Content belonging to this span, excluding descendants. */
  _plainTextContent(options: PlainTextOptions): string {
    return this.ownPlainText(options);
  }
  abstract visitChildren(visitor: InlineSpanVisitor): boolean;
  abstract computeSemanticsInformation(collector: InlineSpanSemanticsInformation[]): void;
  getSemanticsInformation(): InlineSpanSemanticsInformation[] {
    const collector: InlineSpanSemanticsInformation[] = [];
    this.computeSemanticsInformation(collector);
    return collector;
  }
  debugAssertIsValid(): boolean {
    return true;
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof InlineSpan &&
        other.constructor === this.constructor &&
        valueEquals(this.style, other.style))
    );
  }
  get hashCode(): number {
    return hashValues(this.style);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.defaultDiagnosticsTreeStyle = 'whitespace';
    this.style?.debugFillProperties(properties);
  }
  getSpanForPosition(position: TextPosition): InlineSpan | null {
    const offset = new Accumulator();
    let result: InlineSpan | null = null;
    this.visitChildren((span) => {
      result = span.getSpanForPositionVisitor(position, offset);
      return result === null;
    });
    return result;
  }
  codeUnitAt(index: number): number | null {
    checkedInteger(index);
    if (index < 0) return null;
    const offset = new Accumulator();
    let result: number | null = null;
    this.visitChildren((span) => {
      result = span.codeUnitAtVisitor(index, offset);
      return result === null;
    });
    return result;
  }
  toPlainText(options: PlainTextOptions = {}): string {
    let result = '',
      count = 0;
    const seen = new Set<InlineSpan>();
    const visit = (span: InlineSpan, depth: number) => {
      if (seen.has(span) || depth > 128 || ++count > 256)
        throw new RangeError('InlineSpan tree is cyclic or exceeds budget');
      seen.add(span);
      result += span.ownPlainText(options);
      if (result.length > 4096) throw new RangeError('InlineSpan text budget exceeded');
      span.visitDirectChildren((child) => {
        visit(child, depth + 1);
        return true;
      });
      seen.delete(span);
    };
    visit(this, 0);
    return result;
  }
}
