// SPDX-License-Identifier: BSD-3-Clause
import { checkedInteger } from '../ui/value-math.ts';
import { DartIterable } from './dart-collections.ts';
import {
  applyDartType,
  captureDartInterface,
  castDartType,
  isDartType,
} from './dart-type-witness.ts';
import type { DartTypeWitness } from './dart-type-witness.ts';
import { requireDartNumericProvenance } from './dart-numeric.ts';
import {
  registerDartValueSemantics,
  dartValueString,
  dartIdentityHash,
  dartValueEquals,
  dartValueHash,
} from './dart-value.ts';

/** Dense source List storage. Element kinds come only from an explicit witness. */
class SourceList<T> extends Array<T> {
  static override get [Symbol.species](): ArrayConstructor {
    return Array;
  }
}
export type DartMutableList<T> = T[];
interface Storage {
  readonly target: unknown[];
  readonly elementType: DartTypeWitness<unknown>;
  readonly growable: boolean;
  readonly immutable?: boolean;
}
const storage = new WeakMap<object, Storage>(),
  printing = new WeakSet<object>();
class UnsupportedError extends Error {
  constructor() {
    super('Cannot change the length of a fixed-length list');
    this.name = 'UnsupportedError';
  }
}
function record(value: object): Storage {
  const result = storage.get(value);
  if (!result) throw new TypeError('Expected a witnessed source List');
  return result;
}
function element<T>(value: unknown, type: DartTypeWitness<T>): T {
  requireDartNumericProvenance(value);
  return castDartType(value, type);
}
function growable(value: Storage): void {
  if (!value.growable) throw new UnsupportedError();
}
function writable(value: Storage): void {
  if (value.immutable) throw new UnsupportedError();
}
function index(value: number, length: number, insert = false): void {
  checkedInteger(value);
  if (value < 0 || value > length || (!insert && value === length))
    throw new RangeError('Dart List index out of range');
}
function propertyIndex(key: PropertyKey): number | null {
  if (typeof key !== 'string' || !/^(-?\d+)$/.test(key)) return null;
  const value = Number(key);
  if (String(value) !== key || !Number.isSafeInteger(value))
    throw new RangeError('Invalid source List index');
  return value;
}
export function dartIterableType<T>(type: DartTypeWitness<T>): DartTypeWitness<Iterable<T>> {
  return applyDartType(DartIterable, 'Iterable', [type], []);
}
export function dartListType<T>(type: DartTypeWitness<T>): DartTypeWitness<T[]> {
  return applyDartType(SourceList, 'List', [type], [dartIterableType(type)]);
}
export function createDartIterable<T>(
  type: DartTypeWitness<T>,
  iteratorFactory: () => Iterator<T>,
): DartIterable<T> {
  const value = new DartIterable<T>(
    () => {
      const source = iteratorFactory();
      return {
        next() {
          const next = source.next();
          return next.done
            ? { done: true, value: undefined }
            : { done: false, value: element(next.value, type) };
        },
      };
    },
    {
      accepts: (value: unknown): value is T => isDartType(value, type),
      hash: dartValueHash,
      equals: dartValueEquals,
    },
  );
  captureDartInterface(value, dartIterableType(type));
  return value;
}

/** Like List.of: copy the input, retain the source type and optionally fix length.
 * Returned views may be widened covariantly; writes still use the captured type. */
/** Internal factory for analyzer-proven const literals, interned by dart-const.
 * Reuse the same SourceList/type/value owners as mutable lists; every write fails. */
export function createDartConstList<T>(
  type: DartTypeWitness<T>,
  values: readonly T[],
): readonly T[] {
  const listType = dartListType(type),
    target = new SourceList<T>();
  for (const value of values) target.push(element(value, type));
  Object.freeze(target);
  const mutators = new Set([
    'push',
    'pop',
    'shift',
    'unshift',
    'splice',
    'sort',
    'reverse',
    'fill',
    'copyWithin',
  ]);
  const reject = () => {
    throw new UnsupportedError();
  };
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const position = propertyIndex(key);
      if (position !== null) {
        index(position, target.length);
        return target[position];
      }
      if (typeof key === 'string' && mutators.has(key)) return reject;
      return Reflect.get(target, key, receiver);
    },
    set: reject,
    defineProperty: reject,
    deleteProperty: reject,
    setPrototypeOf: reject,
  });
  storage.set(proxy, {
    target,
    elementType: type as DartTypeWitness<unknown>,
    growable: false,
    immutable: true,
  });
  captureDartInterface(proxy, listType);
  return proxy;
}
export function createDartList<T>(
  type: DartTypeWitness<T>,
  values: Iterable<T>,
  { growable: canGrow = true }: { readonly growable?: boolean } = {},
): T[] {
  const listType = dartListType(type),
    target = new SourceList<T>();
  for (const value of values) target.push(element(value, type));
  let proxy: T[];
  const methods = new Map<PropertyKey, unknown>();
  const handler: ProxyHandler<T[]> = {
    get(target, key, receiver) {
      const position = propertyIndex(key);
      if (position !== null) {
        index(position, target.length);
        return target[position];
      }
      if (key === Symbol.iterator) return methods.get(key) ?? cache(key, () => iterator(proxy));
      if (key === 'push')
        return (
          methods.get(key) ??
          cache(key, (...items: T[]) => {
            items.forEach((value) => element(value, type));
            growable(record(proxy));
            return target.push(...items);
          })
        );
      if (key === 'pop')
        return (
          methods.get(key) ??
          cache(key, () => {
            growable(record(proxy));
            return target.pop();
          })
        );
      if (key === 'shift')
        return (
          methods.get(key) ??
          cache(key, () => {
            growable(record(proxy));
            return target.shift();
          })
        );
      if (key === 'unshift')
        return (
          methods.get(key) ??
          cache(key, (...items: T[]) => {
            items.forEach((value) => element(value, type));
            growable(record(proxy));
            return target.unshift(...items);
          })
        );
      if (key === 'splice')
        return (
          methods.get(key) ??
          cache(key, (start: number, ...rest: [number?, ...T[]]) => {
            const items = rest.slice(1) as T[];
            items.forEach((value) => element(value, type));
            growable(record(proxy));
            const removed = rest.length
              ? target.splice(start, rest[0]!, ...items)
              : target.splice(start);
            return createDartList(type, removed);
          })
        );
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      if (receiver !== proxy)
        throw new TypeError('Source List writes require their owning receiver');
      if (key === 'length') {
        dartListSetLength(proxy, value);
        return true;
      }
      const position = propertyIndex(key);
      if (position === null) throw new TypeError('Unknown source List property');
      const checked = element(value, type);
      index(position, target.length);
      target[position] = checked;
      return true;
    },
    defineProperty(target, key, descriptor) {
      if (
        !('value' in descriptor) ||
        descriptor.get ||
        descriptor.set ||
        descriptor.configurable === false ||
        descriptor.enumerable === false ||
        descriptor.writable === false
      )
        throw new TypeError('Source List slots cannot change their descriptors');
      if (key === 'length') {
        dartListSetLength(proxy, descriptor.value);
        return true;
      }
      const position = propertyIndex(key);
      if (position === null) throw new TypeError('Unknown source List property');
      const checked = element(descriptor.value, type);
      index(position, target.length);
      target[position] = checked;
      return true;
    },
    deleteProperty() {
      throw new UnsupportedError();
    },
    setPrototypeOf() {
      throw new TypeError('Source List prototype is fixed');
    },
    preventExtensions() {
      throw new UnsupportedError();
    },
  };
  function cache(key: PropertyKey, value: unknown): unknown {
    methods.set(key, value);
    return value;
  }
  proxy = new Proxy(target, handler);
  storage.set(proxy, { target, elementType: type as DartTypeWitness<unknown>, growable: canGrow });
  captureDartInterface(proxy, listType);
  return proxy;
}
/** Literal elements are evaluated and checked one at a time, before later effects. */
export function createDartListLiteral<T>(type: DartTypeWitness<T>, values: Iterable<() => T>): T[] {
  const list = createDartList(type, []);
  for (const value of values) dartListAdd(list, value());
  return list;
}

function iterator<T>(list: T[]): IterableIterator<T> {
  const captured = list.length;
  let cursor = 0;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      if (list.length !== captured) {
        const error = new Error('List changed during iteration');
        error.name = 'ConcurrentModificationError';
        throw error;
      }
      return cursor < captured
        ? { done: false, value: list[cursor++]! }
        : { done: true, value: undefined };
    },
  };
}
export function dartListSetLength<T>(list: T[], length: number): void {
  const value = record(list);
  growable(value);
  checkedInteger(length);
  if (length < 0) throw new RangeError('Dart List length must be nonnegative');
  if (length > value.target.length) {
    if (!isDartType(null, value.elementType))
      throw new TypeError('Non-nullable List cannot grow with null');
    while (value.target.length < length) value.target.push(null);
  } else value.target.length = length;
}
export function dartListSet<T>(list: T[], position: number, value: T): void {
  const target = record(list);
  const checked = element(value, target.elementType);
  writable(target);
  index(position, target.target.length);
  target.target[position] = checked;
}
export function dartListAdd<T>(list: T[], value: T): void {
  const target = record(list),
    checked = element(value, target.elementType);
  growable(target);
  target.target.push(checked);
}
export function dartListAddAll<T>(list: T[], values: Iterable<T>): void {
  const target = record(list);
  castDartType(values, dartIterableType(target.elementType));
  growable(target);
  if (values === list && list.length) {
    const error = new Error('List changed during iteration');
    error.name = 'ConcurrentModificationError';
    throw error;
  }
  for (const value of values) target.target.push(element(value, target.elementType));
}
export function dartListClear<T>(list: T[]): void {
  const target = record(list);
  growable(target);
  target.target.length = 0;
}
export function dartListRemoveAt<T>(list: T[], position: number): T {
  const target = record(list);
  growable(target);
  index(position, target.target.length);
  return target.target.splice(position, 1)[0] as T;
}
export function dartListInsert<T>(list: T[], position: number, value: T): void {
  const target = record(list),
    checked = element(value, target.elementType);
  growable(target);
  index(position, target.target.length, true);
  target.target.splice(position, 0, checked);
}
export function dartListSublist<T>(list: T[], start: number, end = list.length): T[] {
  const target = record(list);
  index(start, list.length, true);
  index(end, list.length, true);
  if (end < start) throw new RangeError('List end precedes start');
  return createDartList(target.elementType, target.target.slice(start, end)) as T[];
}
export function dartListReversed<T>(list: T[]): DartIterable<T> {
  const target = record(list);
  return createDartIterable(target.elementType, () => {
    const length = list.length;
    let position = length;
    return {
      next() {
        if (list.length !== length) {
          const error = new Error('List changed during reverse iteration');
          error.name = 'ConcurrentModificationError';
          throw error;
        }
        return position > 0
          ? { done: false, value: list[--position]! }
          : { done: true, value: undefined };
      },
    };
  }) as DartIterable<T>;
}

registerDartValueSemantics(SourceList, {
  accepts: (value: unknown): value is SourceList<unknown> =>
    typeof value === 'object' && value !== null && storage.has(value),
  equals: (value, other) => value === other,
  hash: dartIdentityHash,
  string(value) {
    if (printing.has(value)) return '[...]';
    printing.add(value);
    try {
      return '[' + [...value].map(dartValueString).join(', ') + ']';
    } finally {
      printing.delete(value);
    }
  },
});
