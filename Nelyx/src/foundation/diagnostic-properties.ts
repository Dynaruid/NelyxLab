// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/diagnostics.dart.
import { DiagnosticsProperty } from './diagnostics.ts';
import type {
  DiagnosticsPropertyOptions,
  DiagnosticsStringOptions,
  DiagnosticLevel,
  ComputePropertyValueCallback,
} from './diagnostics.ts';
import { DiagnosticsSerializationDelegate } from './diagnostics-serialization.ts';
import type { JsonDiagnosticsNode } from './diagnostics-serialization.ts';
import { FoundationBuildMode } from './constants.ts';
import { debugFormatDouble, diagnosticDoubleString } from './debug.ts';
export class MessageProperty extends DiagnosticsProperty<void> {
  constructor(name: string, message: string, o: DiagnosticsPropertyOptions<void> = {}) {
    super(name, null, { ...o, typeName: 'void', description: message });
  }
}
export interface NumericPropertyOptions extends DiagnosticsPropertyOptions<number> {
  readonly unit?: string | null;
}
abstract class _NumProperty extends DiagnosticsProperty<number> {
  readonly unit: string | null;
  constructor(name: string, value: number | null, o: NumericPropertyOptions = {}) {
    super(name, value, o);
    this.unit = o.unit ?? null;
  }
  /** Source private lazy constructor after the numeric options/unit are initialized. */
  protected static initializeLazy<P extends _NumProperty>(
    property: P,
    compute: ComputePropertyValueCallback<number>,
  ): P {
    property.setLazyValue(compute);
    return property;
  }
  abstract numberToString(): string;
  override valueToString(): string {
    return this.value === null ? 'null' : this.numberToString() + (this.unit ?? '');
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (this.unit !== null) json.unit = this.unit;
    json.numberToString = this.numberToString();
    return json;
  }
}
export class DoubleProperty extends _NumProperty {
  constructor(name: string, value: number | null, o: NumericPropertyOptions = {}) {
    super(name, value, { ...o, typeName: 'double' });
  }
  /** Source DoubleProperty.lazy; distinct name avoids the inherited generic static factory signature. */
  static lazyNumber(
    name: string,
    compute: ComputePropertyValueCallback<number>,
    o: NumericPropertyOptions = {},
  ): DoubleProperty {
    return this.initializeLazy(new DoubleProperty(name, null, o), compute);
  }
  numberToString(): string {
    return debugFormatDouble(this.value);
  }
}
export class IntProperty extends _NumProperty {
  constructor(name: string, value: number | null, o: NumericPropertyOptions = {}) {
    super(name, value, { ...o, typeName: 'int' });
    if (value !== null && !Number.isSafeInteger(value))
      throw new RangeError('IntProperty requires a safe integer');
  }
  numberToString(): string {
    return String(this.value);
  }
}
export class PercentProperty extends DoubleProperty {
  constructor(name: string, fraction: number | null, o: NumericPropertyOptions = {}) {
    super(name, fraction, o);
  }
  override numberToString(): string {
    const value = this.value;
    if (value === null) return 'null';
    const clamped = Number.isNaN(value) || value > 1 ? 1 : value < 0 ? 0 : value;
    const scaled = clamped * 100;
    return (Object.is(scaled, -0) ? '-0.0' : scaled.toFixed(1)) + '%';
  }
  override valueToString(): string {
    return this.value === null
      ? 'null'
      : this.numberToString() + (this.unit !== null ? ' ' + this.unit : '');
  }
}
export interface FlagPropertyOptions extends DiagnosticsPropertyOptions<boolean> {
  readonly ifTrue?: string | null;
  readonly ifFalse?: string | null;
}
export class FlagProperty extends DiagnosticsProperty<boolean> {
  readonly ifTrue: string | null;
  readonly ifFalse: string | null;
  constructor(name: string, value: boolean | null, o: FlagPropertyOptions = {}) {
    super(name, value, {
      ...o,
      typeName: 'bool',
      defaultValue: o.defaultValue === undefined ? null : o.defaultValue,
      showName: o.showName ?? false,
    });
    this.ifTrue = o.ifTrue ?? null;
    this.ifFalse = o.ifFalse ?? null;
    if (FoundationBuildMode.debug && this.ifTrue === null && this.ifFalse === null)
      throw new Error('FlagProperty requires ifTrue or ifFalse');
  }
  override valueToString(o: DiagnosticsStringOptions = {}): string {
    return this.value === true && this.ifTrue !== null
      ? this.ifTrue
      : this.value === false && this.ifFalse !== null
        ? this.ifFalse
        : super.valueToString(o);
  }
  override get showName(): boolean {
    return this.value === null ||
      (this.value === true && this.ifTrue === null) ||
      (this.value === false && this.ifFalse === null)
      ? true
      : super.showName;
  }
  override get level(): DiagnosticLevel {
    return (this.value === true && this.ifTrue === null) ||
      (this.value === false && this.ifFalse === null)
      ? 'hidden'
      : super.level;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (this.ifTrue !== null) json.ifTrue = this.ifTrue;
    if (this.ifFalse !== null) json.ifFalse = this.ifFalse;
    return json;
  }
}
export interface IterablePropertyOptions<T> extends DiagnosticsPropertyOptions<Iterable<T>> {
  readonly elementType?: string;
}
export class IterableProperty<T> extends DiagnosticsProperty<Iterable<T>> {
  private readonly elementType: string;
  constructor(name: string, value: Iterable<T> | null, o: IterablePropertyOptions<T> = {}) {
    super(name, value, {
      ...o,
      ifEmpty: o.ifEmpty === undefined ? '[]' : o.ifEmpty,
      typeName: o.typeName ?? 'Iterable<' + (o.elementType ?? 'Object?') + '>',
    });
    this.elementType = o.elementType ?? 'Object?';
  }
  private isEmpty(value: Iterable<T>): boolean {
    return value[Symbol.iterator]().next().done === true;
  }
  override valueToString(o: DiagnosticsStringOptions = {}): string {
    const value = this.value;
    if (value === null) return 'null';
    if (this.isEmpty(value)) return this.ifEmpty ?? '[]';
    const formatted = Array.from(value, (v) =>
      this.elementType === 'double' && typeof v === 'number' ? debugFormatDouble(v) : String(v),
    );
    return o.parentConfiguration?.lineBreakProperties === false
      ? '[' + formatted.join(', ') + ']'
      : formatted.join(this.style === 'singleLine' ? ', ' : '\n');
  }
  override get level(): DiagnosticLevel {
    const value = this.value;
    return this.ifEmpty === undefined &&
      value !== null &&
      this.isEmpty(value) &&
      super.level !== 'hidden'
      ? 'fine'
      : super.level;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (this.value !== null)
      json.values = Array.from(this.value, (v) =>
        this.elementType === 'double' && typeof v === 'number'
          ? diagnosticDoubleString(v)
          : String(v),
      );
    return json;
  }
}
export type DiagnosticEnumValue = string | { readonly name: string };
export class EnumProperty<T extends DiagnosticEnumValue> extends DiagnosticsProperty<T> {
  constructor(name: string, value: T | null, o: DiagnosticsPropertyOptions<T> = {}) {
    super(name, value, { typeName: 'Enum?', ...o });
  }
  override valueToString(): string {
    const value = this.value;
    return value === null ? 'null' : typeof value === 'string' ? value : value.name;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (typeof this.value === 'string') delete json.value;
    if (typeof this.defaultValue === 'string')
      json.defaultValue = this.propertyType + '.' + this.defaultValue;
    return json;
  }
}
export interface ObjectFlagPropertyOptions<T> extends DiagnosticsPropertyOptions<T> {
  readonly ifPresent?: string | null;
}
export class ObjectFlagProperty<T> extends DiagnosticsProperty<T> {
  readonly ifPresent: string | null;
  constructor(name: string, value: T | null, o: ObjectFlagPropertyOptions<T> = {}) {
    super(name, value, { ...o, showName: o.showName ?? false });
    this.ifPresent = o.ifPresent ?? null;
    if (FoundationBuildMode.debug && this.ifPresent === null && this.ifNull === undefined)
      throw new Error('ObjectFlagProperty requires ifPresent or ifNull');
  }
  static has<T>(
    name: string,
    value: T | null,
    o: DiagnosticsPropertyOptions<T> = {},
  ): ObjectFlagProperty<T> {
    return new ObjectFlagProperty(name, value, { ...o, ifPresent: 'has ' + name, showName: false });
  }
  override valueToString(o: DiagnosticsStringOptions = {}): string {
    return this.value !== null && this.ifPresent !== null
      ? this.ifPresent
      : this.value === null && this.ifNull !== undefined
        ? this.ifNull
        : super.valueToString(o);
  }
  override get showName(): boolean {
    return (this.value !== null && this.ifPresent === null) ||
      (this.value === null && this.ifNull === undefined)
      ? true
      : super.showName;
  }
  override get level(): DiagnosticLevel {
    return (this.value !== null && this.ifPresent === null) ||
      (this.value === null && this.ifNull === undefined)
      ? 'hidden'
      : super.level;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (this.ifPresent !== null) json.ifPresent = this.ifPresent;
    return json;
  }
}
export interface FlagsSummaryOptions<T> extends DiagnosticsPropertyOptions<Map<string, T | null>> {
  readonly valueType?: string;
}
export class FlagsSummary<T> extends DiagnosticsProperty<Map<string, T | null>> {
  constructor(name: string, value: Map<string, T | null>, o: FlagsSummaryOptions<T> = {}) {
    super(name, value, { typeName: 'Map<String, ' + (o.valueType ?? 'Object?') + '>', ...o });
  }
  override get value(): Map<string, T | null> {
    return super.value!;
  }
  private _hasNonNullEntry(): boolean {
    for (const value of this.value.values()) if (value !== null) return true;
    return false;
  }
  private _formattedValues(): string[] {
    return Array.from(this.value)
      .filter(([, value]) => value !== null)
      .map(([name]) => name);
  }
  override valueToString(o: DiagnosticsStringOptions = {}): string {
    if (!this._hasNonNullEntry() && this.ifEmpty !== undefined) return this.ifEmpty;
    const values = this._formattedValues();
    return o.parentConfiguration?.lineBreakProperties === false
      ? '[' + values.join(', ') + ']'
      : values.join(this.style === 'singleLine' ? ', ' : '\n');
  }
  override get level(): DiagnosticLevel {
    return !this._hasNonNullEntry() && this.ifEmpty === undefined ? 'hidden' : super.level;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const json = super.toJsonMap(delegate);
    if (this.value.size > 0) json.values = this._formattedValues();
    return json;
  }
}
