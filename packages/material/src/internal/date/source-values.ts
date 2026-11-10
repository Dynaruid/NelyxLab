// SPDX-License-Identifier: BSD-3-Clause
// Host representations for generated Dart bodies, not date/calendar algorithms.
import {
  runtimeDartType,
  dartStringType,
  dartBoolType,
} from '@nelyx/core/internal/foundation/dart-type-witness';
import {
  dartValueHash,
  dartValueString,
  dartIdentityHash,
  registerDartValueSemantics,
} from '@nelyx/core/internal/foundation/dart-value';
import { hashDoubles } from '@nelyx/core/internal/ui/value-math';
import { captureDartException } from '@nelyx/core/internal/foundation/dart-exceptions';
export function sourceStyleRuntimeType(value: {}): object {
  return typeof value === 'string'
    ? dartStringType
    : typeof value === 'boolean'
      ? dartBoolType
      : runtimeDartType(value);
}
export function sourceStyleHash(...values: unknown[]): number {
  return hashDoubles(values.map(dartValueHash));
}
export function dateListAt<T>(values: readonly T[], index: number): T {
  if (!Number.isSafeInteger(index) || index < 0 || index >= values.length)
    throw new RangeError('Dart List index out of range');
  return values[index]!;
}
export function dateListAdd<T>(values: readonly T[], value: T): void {
  if (Object.isFrozen(values)) throw new TypeError('Cannot modify a const List');
  (values as T[]).push(value);
}
export function dateStringAt(value: string, index: number): string {
  if (!Number.isSafeInteger(index) || index < 0 || index >= value.length)
    throw new RangeError('Dart String index out of range');
  return value[index]!;
}
export const dateStringIsEmpty = (value: string): boolean => value.length === 0;
export function dateIntString(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError('Expected Dart host int');
  return String(value);
}
export function dateIntAbs(value: number): number {
  dateIntString(value);
  return Math.abs(value);
}
export function dateTryParseInt(
  value: string,
  { radix = 10 }: { radix?: number } = {},
): number | null {
  if (radix !== 10) throw new RangeError('Date input uses radix 10');
  const trimmed = value.trim();
  if (!/^[+-]?[0-9]+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isSafeInteger(number) ? number : null;
}
export class DateStringBuffer {
  private parts: string[] = [];
  constructor(initial: unknown = '') {
    this.write(initial);
  }
  write(value: unknown): void {
    this.parts.push(dartValueString(value));
  }
  toString(): string {
    return this.parts.join('');
  }
}
export function dateEnumString(value: { toString(): string }): string {
  return value.toString();
}
/** Dart enums have canonical identity equality, including restoration writes
 * that assign the same value. Admit only the emitted enum's declared constants. */
export function registerDateEnumValues<T extends object>(
  owner: Function & { readonly prototype: T; readonly values: readonly T[] },
): void {
  const values = new Set(owner.values);
  registerDartValueSemantics(owner, {
    accepts: (value): value is T => values.has(value as T),
    equals: (value, other) => value === other,
    hash: dartIdentityHash,
    string: (value) => value.toString(),
  });
}
export type SourceStackTrace = string;
export function dateCatchError<T>(
  future: Promise<T>,
  callback: (error: {}, stack: SourceStackTrace) => T | PromiseLike<T>,
): Promise<T> {
  return future.catch((error: unknown) => {
    const caught = captureDartException(error);
    return callback(caught.exception, caught.stackTrace);
  });
}
