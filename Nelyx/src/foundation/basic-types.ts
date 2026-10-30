// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/basic_types.dart.
import { FoundationBuildMode } from './constants.ts';
export type ValueChanged<T> = (value: T) => void;
export type ValueSetter<T> = (value: T) => void;
export type ValueGetter<T> = () => T;
export type IterableFilter<T> = (input: Iterable<T>) => Iterable<T>;
export type AsyncCallback = () => Promise<void>;
export type AsyncValueSetter<T> = (value: T) => Promise<void>;
export type AsyncValueGetter<T> = () => Promise<T>;
export interface CachingIterator<T> extends IterableIterator<T> {
  readonly current: T;
  moveNext(): boolean;
}
interface CacheAccess<T> {
  readonly values: readonly T[];
  fillNext(): boolean;
}
const cacheAccess = Symbol('CachingIterable library-private iterator access');
class StateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateError';
  }
  override toString(): string {
    return 'Bad state: ' + this.message;
  }
}
class _AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = '_AssertionError';
  }
}
function checkCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(name + ' must be a nonnegative safe integer');
}
const done = <_T>(): IteratorReturnResult<undefined> => ({ done: true, value: undefined });
/** One source iterator and one cache shared by every reader and derived view. */
export class CachingIterable<E> implements Iterable<E> {
  private readonly _results: E[] = [];
  constructor(private readonly _prefillIterator: Iterator<E>) {}
  [cacheAccess](): CacheAccess<E> {
    return { values: this._results, fillNext: () => this._fillNext() };
  }
  get iterator(): CachingIterator<E> {
    return new _LazyListIterator(this);
  }
  [Symbol.iterator](): CachingIterator<E> {
    return this.iterator;
  }
  private _fillNext(): boolean {
    const next = this._prefillIterator.next();
    if (next.done) return false;
    this._results.push(next.value);
    return true;
  }
  private _precacheEntireList(): void {
    while (this._fillNext()) {}
  }
  get length(): number {
    this._precacheEntireList();
    return this._results.length;
  }
  elementAt(index: number): E {
    checkCount(index, 'index');
    while (this._results.length <= index)
      if (!this._fillNext())
        throw new RangeError(
          'Index ' + index + ' is outside the cached iterable of length ' + this._results.length,
        );
    return this._results[index]!;
  }
  toList({ growable = true }: { readonly growable?: boolean } = {}): E[] {
    this._precacheEntireList();
    const list = this._results.slice();
    if (!growable) Object.defineProperty(list, 'length', { writable: false });
    return list;
  }
  map<T>(toElement: (value: E) => T): CachingIterable<T> {
    const source = this.iterator;
    return new CachingIterable<T>({
      next() {
        const value = source.next();
        return value.done ? done<T>() : { done: false, value: toElement(value.value) };
      },
    });
  }
  where(test: (value: E) => boolean): CachingIterable<E> {
    const source = this.iterator;
    return new CachingIterable<E>({
      next() {
        while (true) {
          const value = source.next();
          if (value.done) return done<E>();
          if (test(value.value)) return value;
        }
      },
    });
  }
  expand<T>(toElements: (value: E) => Iterable<T>): CachingIterable<T> {
    const source = this.iterator;
    let inner: Iterator<T> | null = { next: done<T> };
    return new CachingIterable<T>({
      next() {
        if (inner === null) return done<T>();
        while (true) {
          const value = inner.next();
          if (!value.done) return value;
          const next = source.next();
          if (next.done) return done<T>();
          inner = null;
          inner = toElements(next.value)[Symbol.iterator]();
        }
      },
    });
  }
  take(count: number): CachingIterable<E> {
    checkCount(count, 'count');
    const source = this.iterator;
    let remaining = count;
    return new CachingIterable<E>({
      next() {
        remaining--;
        if (remaining >= 0) return source.next();
        remaining = -1;
        return done<E>();
      },
    });
  }
  takeWhile(test: (value: E) => boolean): CachingIterable<E> {
    const source = this.iterator;
    let finished = false;
    return new CachingIterable<E>({
      next() {
        if (finished) return done<E>();
        const value = source.next();
        if (value.done || !test(value.value)) {
          finished = true;
          return done<E>();
        }
        return value;
      },
    });
  }
  skip(count: number): CachingIterable<E> {
    checkCount(count, 'count');
    const source = this.iterator;
    let remaining = count;
    return new CachingIterable<E>({
      next() {
        for (let i = 0; i < remaining; i++) source.next();
        remaining = 0;
        return source.next();
      },
    });
  }
  skipWhile(test: (value: E) => boolean): CachingIterable<E> {
    const source = this.iterator;
    let skipped = false;
    return new CachingIterable<E>({
      next() {
        if (!skipped) {
          skipped = true;
          while (true) {
            const value = source.next();
            if (value.done) break;
            if (!test(value.value)) return value;
          }
        }
        return source.next();
      },
    });
  }
  get isEmpty(): boolean {
    return !this.iterator.moveNext();
  }
  get isNotEmpty(): boolean {
    return !this.isEmpty;
  }
  get first(): E {
    const iterator = this.iterator;
    if (!iterator.moveNext()) throw new StateError('No element');
    return iterator.current;
  }
  get last(): E {
    const iterator = this.iterator;
    if (!iterator.moveNext()) throw new StateError('No element');
    let value = iterator.current;
    while (iterator.moveNext()) value = iterator.current;
    return value;
  }
  get single(): E {
    const iterator = this.iterator;
    if (!iterator.moveNext()) throw new StateError('No element');
    const value = iterator.current;
    if (iterator.moveNext()) throw new StateError('Too many elements');
    return value;
  }
  forEach(action: (value: E) => void): void {
    for (const value of this) action(value);
  }
  any(test: (value: E) => boolean): boolean {
    for (const value of this) if (test(value)) return true;
    return false;
  }
  every(test: (value: E) => boolean): boolean {
    for (const value of this) if (!test(value)) return false;
    return true;
  }
  contains(element: unknown): boolean {
    for (const value of this)
      if (
        value === element ||
        (value !== null &&
          typeof value === 'object' &&
          'equals' in value &&
          typeof value.equals === 'function' &&
          value.equals(element))
      )
        return true;
    return false;
  }
  fold<T>(initialValue: T, combine: (previous: T, element: E) => T): T {
    let result = initialValue;
    for (const value of this) result = combine(result, value);
    return result;
  }
  reduce(combine: (previous: E, element: E) => E): E {
    const iterator = this.iterator;
    if (!iterator.moveNext()) throw new StateError('No element');
    let result = iterator.current;
    while (iterator.moveNext()) result = combine(result, iterator.current);
    return result;
  }
  join(separator = ''): string {
    let first = true,
      result = '';
    for (const value of this) {
      if (!first) result += separator;
      first = false;
      result += String(value);
    }
    return result;
  }
  firstWhere(test: (value: E) => boolean, { orElse }: { readonly orElse?: () => E } = {}): E {
    for (const value of this) if (test(value)) return value;
    if (orElse) return orElse();
    throw new StateError('No element');
  }
  lastWhere(test: (value: E) => boolean, { orElse }: { readonly orElse?: () => E } = {}): E {
    let found = false,
      result: E | undefined;
    for (const value of this)
      if (test(value)) {
        found = true;
        result = value;
      }
    if (found) return result!;
    if (orElse) return orElse();
    throw new StateError('No element');
  }
  singleWhere(test: (value: E) => boolean, { orElse }: { readonly orElse?: () => E } = {}): E {
    let found = false,
      result: E | undefined;
    for (const value of this)
      if (test(value)) {
        if (found) throw new StateError('Too many elements');
        found = true;
        result = value;
      }
    if (found) return result!;
    if (orElse) return orElse();
    throw new StateError('No element');
  }
  toSet(): Set<E> {
    return new Set(this);
  }
}
class _LazyListIterator<E> implements CachingIterator<E> {
  private _index = -1;
  private readonly access: CacheAccess<E>;
  constructor(private readonly _owner: CachingIterable<E>) {
    this.access = _owner[cacheAccess]();
  }
  get current(): E {
    if (FoundationBuildMode.debug && this._index < 0)
      throw new _AssertionError('current called before moveNext()');
    if (this._index < 0 || this._index === this.access.values.length)
      throw new StateError('current can not be call after moveNext has returned false');
    return this.access.values[this._index]!;
  }
  moveNext(): boolean {
    if (this._index >= this.access.values.length) return false;
    this._index++;
    return this._index === this.access.values.length ? this.access.fillNext() : true;
  }
  next(): IteratorResult<E> {
    return this.moveNext() ? { done: false, value: this.current } : done<E>();
  }
  [Symbol.iterator](): CachingIterator<E> {
    return this;
  }
}
/** Explicit type token preserves type identity without invoking the constructor. */
export type FactoryType = string | { readonly name: string };
/* oxlint-disable typescript/no-unsafe-declaration-merging -- The constructor explicitly initializes the interface fields through validated property assignment. */
export interface Factory<T> {
  readonly constructor: ValueGetter<T>;
}
/* oxlint-enable typescript/no-unsafe-declaration-merging */
export class Factory<T> {
  constructor(
    construct: ValueGetter<T>,
    readonly type: FactoryType,
  ) {
    Object.defineProperty(this, 'constructor', {
      value: construct,
      enumerable: true,
      writable: false,
      configurable: false,
    });
    Object.freeze(this);
  }
  toString(): string {
    return 'Factory(type: ' + (typeof this.type === 'string' ? this.type : this.type.name) + ')';
  }
}
/** Host duration values are milliseconds; interpolation rounds to microseconds. */
export function lerpDuration(aMilliseconds: number, bMilliseconds: number, t: number): number {
  const a = Math.round(aMilliseconds * 1000),
    b = Math.round(bMilliseconds * 1000);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isFinite(t))
    throw new RangeError(
      'Duration interpolation requires finite safe microsecond endpoints and factor',
    );
  const value = a + (b - a) * t,
    rounded = value < 0 ? -Math.floor(-value + 0.5) : Math.floor(value + 0.5);
  if (!Number.isSafeInteger(rounded))
    throw new RangeError('Interpolated duration exceeds safe microseconds');
  return rounded === 0 ? 0 : rounded / 1000;
}
