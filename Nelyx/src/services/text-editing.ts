// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { TextRange } from '../ui/text-range.ts';
import { TextAffinity, TextPosition } from '../ui/text-position.ts';
import { protect } from '../ui/value-math.ts';
import { hashValues } from '../framework/painting/value-equality.ts';
import { objectRuntimeType } from '../foundation/object.ts';
export { TextAffinity, TextPosition };
export interface TextSelectionOptions {
  readonly baseOffset: number;
  readonly extentOffset: number;
  readonly affinity?: TextAffinity;
  readonly isDirectional?: boolean;
}
export class TextSelection extends TextRange {
  readonly baseOffset: number;
  readonly extentOffset: number;
  readonly affinity: TextAffinity;
  readonly isDirectional: boolean;
  constructor({
    baseOffset,
    extentOffset,
    affinity = TextAffinity.downstream,
    isDirectional = false,
  }: TextSelectionOptions) {
    super({ start: Math.min(baseOffset, extentOffset), end: Math.max(baseOffset, extentOffset) });
    this.baseOffset = baseOffset;
    this.extentOffset = extentOffset;
    this.affinity = affinity;
    this.isDirectional = isDirectional;
    protect(this, ['baseOffset', 'extentOffset', 'affinity', 'isDirectional']);
  }
  /** Numeric form preserves the inherited TS static constructor signature. */
  static override collapsed(
    options: number | { readonly offset: number; readonly affinity?: TextAffinity },
  ): TextSelection {
    const { offset, affinity = TextAffinity.downstream } =
      typeof options === 'number' ? { offset: options } : options;
    return new TextSelection({ baseOffset: offset, extentOffset: offset, affinity });
  }
  static fromPosition(position: TextPosition): TextSelection {
    return TextSelection.collapsed(position);
  }
  get base(): TextPosition {
    return new TextPosition({
      offset: this.baseOffset,
      affinity:
        !this.isValid || this.isCollapsed
          ? this.affinity
          : this.baseOffset < this.extentOffset
            ? TextAffinity.downstream
            : TextAffinity.upstream,
    });
  }
  get extent(): TextPosition {
    return new TextPosition({
      offset: this.extentOffset,
      affinity:
        !this.isValid || this.isCollapsed
          ? this.affinity
          : this.baseOffset < this.extentOffset
            ? TextAffinity.upstream
            : TextAffinity.downstream,
    });
  }
  override equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof TextSelection &&
        (!this.isValid
          ? !other.isValid
          : other.baseOffset === this.baseOffset &&
            other.extentOffset === this.extentOffset &&
            (!this.isCollapsed || other.affinity === this.affinity) &&
            other.isDirectional === this.isDirectional))
    );
  }
  override get hashCode(): number {
    return !this.isValid
      ? hashValues(-1, -1, TextAffinity.downstream)
      : hashValues(
          this.baseOffset,
          this.extentOffset,
          this.isCollapsed ? this.affinity : TextAffinity.downstream,
          this.isDirectional,
        );
  }
  copyWith({
    baseOffset,
    extentOffset,
    affinity,
    isDirectional,
  }: Partial<{
    readonly baseOffset: number | null;
    readonly extentOffset: number | null;
    readonly affinity: TextAffinity | null;
    readonly isDirectional: boolean | null;
  }> = {}): TextSelection {
    return new TextSelection({
      baseOffset: baseOffset ?? this.baseOffset,
      extentOffset: extentOffset ?? this.extentOffset,
      affinity: affinity ?? this.affinity,
      isDirectional: isDirectional ?? this.isDirectional,
    });
  }
  expandTo(position: TextPosition, extentAtIndex = false): TextSelection {
    if (position.offset >= this.start && position.offset <= this.end) return this;
    const normalized = this.baseOffset <= this.extentOffset;
    if (position.offset <= this.start)
      return extentAtIndex
        ? this.copyWith({
            baseOffset: this.end,
            extentOffset: position.offset,
            affinity: position.affinity,
          })
        : this.copyWith({
            baseOffset: normalized ? position.offset : this.baseOffset,
            extentOffset: normalized ? this.extentOffset : position.offset,
          });
    return extentAtIndex
      ? this.copyWith({
          baseOffset: this.start,
          extentOffset: position.offset,
          affinity: position.affinity,
        })
      : this.copyWith({
          baseOffset: normalized ? this.baseOffset : position.offset,
          extentOffset: normalized ? position.offset : this.extentOffset,
        });
  }
  extendTo(position: TextPosition): TextSelection {
    return this.extent.equals(position)
      ? this
      : this.copyWith({ extentOffset: position.offset, affinity: position.affinity });
  }
  override toString(): string {
    const name = objectRuntimeType(this, 'TextSelection');
    if (!this.isValid) return name + '.invalid';
    return this.isCollapsed
      ? `${name}.collapsed(offset: ${this.baseOffset}, affinity: TextAffinity.${this.affinity}, isDirectional: ${this.isDirectional})`
      : `${name}(baseOffset: ${this.baseOffset}, extentOffset: ${this.extentOffset}, isDirectional: ${this.isDirectional})`;
  }
}
