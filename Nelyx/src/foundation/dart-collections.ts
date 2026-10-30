// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from './errors.ts';

/** Explicit closed host policy; never infer Dart equality from JS object shape. */
export interface DartKeyPolicy<K> {
  readonly accepts: (value: unknown) => value is K;
  readonly hash: (value: unknown) => unknown;
  readonly equals: (stored: K, query: unknown) => boolean;
  readonly validQuery?: ((value: unknown) => boolean) | undefined;
}
type Entry<K, V> = { readonly key: K; value: V };
export interface DartMapEntry<K, V> {
  readonly key: K;
  readonly value: V;
}
const constructedMaps = new WeakSet<object>();
const constructedSets = new WeakSet<object>();

/** Live/reiterable views. Result element policies are required only for toSet. */
export class DartIterable<T> implements Iterable<T> {
  constructor(
    private readonly iteratorFactory: () => Iterator<T>,
    readonly elementPolicy?: DartKeyPolicy<T>,
    private readonly readLength?: () => number,
    private readonly readEmpty?: () => boolean,
  ) {}
  [Symbol.iterator](): Iterator<T> {
    return this.iteratorFactory();
  }
  get length(): number {
    if (this.readLength) return this.readLength();
    let count = 0;
    for (const _value of this) count++;
    return count;
  }
  get isEmpty(): boolean {
    return this.readEmpty ? this.readEmpty() : this[Symbol.iterator]().next().done === true;
  }
  get isNotEmpty(): boolean {
    return !this.isEmpty;
  }
  forEach(action: (value: T) => void): void {
    for (const value of this) action(value);
  }
  contains(value: unknown): boolean {
    const policy = this.elementPolicy;
    invariant(
      policy,
      'missing-dart-value-policy',
      'contains requires an explicit Dart equality policy',
    );
    for (const element of this) if (policy.equals(element, value)) return true;
    return false;
  }
  where(test: (value: T) => boolean): DartIterable<T> {
    return new DartIterable(() => {
      const source = this[Symbol.iterator]();
      return {
        next() {
          for (;;) {
            const next = source.next();
            if (next.done || test(next.value)) return next;
          }
        },
      };
    }, this.elementPolicy);
  }
  map<U>(convert: (value: T) => U, policy?: DartKeyPolicy<U>): DartIterable<U> {
    return new DartIterable<U>(
      () => {
        const source = this[Symbol.iterator]();
        return {
          next() {
            const next = source.next();
            return next.done
              ? { done: true, value: undefined }
              : { done: false, value: convert(next.value) };
          },
        };
      },
      policy,
      () => this.length,
      () => this.isEmpty,
    );
  }
  toList({ growable = true }: { growable?: boolean } = {}): T[] {
    const result = [...this];
    if (!growable) {
      Object.seal(result);
      Object.defineProperty(result, 'length', { writable: false });
    }
    return result;
  }
  toSet(): DartSet<T> {
    invariant(
      this.elementPolicy,
      'missing-dart-set-policy',
      'toSet requires an explicit Dart element equality/hash policy',
    );
    const result = new DartSet(this.elementPolicy);
    result.addAll(this);
    return result;
  }
}

/** Insertion-ordered Dart Map boundary, with canonical stored keys and live values. */
export class DartMap<K, V> {
  #buckets = new Map<unknown, Entry<K, V>[]>();
  #ordered = new Set<Entry<K, V>>();
  #revision = 0;
  #immutable = false;
  constructor(
    readonly keyPolicy: DartKeyPolicy<K>,
    private readonly acceptsValue: (value: unknown) => value is V,
    private readonly valuePolicy?: DartKeyPolicy<V>,
  ) {
    constructedMaps.add(this);
  }
  /** Internal representation admission without inspecting user-visible fields. */
  static is(value: unknown): value is DartMap<unknown, unknown> {
    return value !== null && typeof value === 'object' && constructedMaps.has(value);
  }
  get length(): number {
    return this.#ordered.size;
  }
  get isEmpty(): boolean {
    return this.length === 0;
  }
  get isNotEmpty(): boolean {
    return !this.isEmpty;
  }
  /** The exact typed factory owns const canonicalization. Freezing is shallow. */
  freeze(): this {
    this.#immutable = true;
    return this;
  }
  /** @internal Check even no-op mutations before querying keys or callbacks. */
  checkMutable(): void {
    if (this.#immutable) throw new TypeError('Cannot modify an immutable Dart collection');
  }
  #stable(revision: number): void {
    invariant(
      this.#revision === revision,
      'concurrent-map-modification',
      'Dart Map keys changed during traversal or key comparison',
    );
  }
  #lookup(
    key: unknown,
  ): { hash: unknown; entry: Entry<K, V> | undefined; bucket: Entry<K, V>[] | undefined } | null {
    if (this.keyPolicy.validQuery && !this.keyPolicy.validQuery(key)) return null;
    const revision = this.#revision,
      hash = this.keyPolicy.hash(key);
    this.#stable(revision);
    const bucket = this.#buckets.get(hash);
    for (const entry of bucket ?? []) {
      const equal = this.keyPolicy.equals(entry.key, key);
      this.#stable(revision);
      if (equal) return { hash, entry, bucket };
    }
    return { hash, entry: undefined, bucket };
  }
  containsKey(key: unknown): boolean {
    return this.#lookup(key)?.entry !== undefined;
  }
  containsValue(value: unknown): boolean {
    return this.values.contains(value);
  }
  get(key: unknown): V | null {
    return this.#lookup(key)?.entry?.value ?? null;
  }
  #put(key: K, value: V, replace: boolean): boolean {
    this.checkMutable();
    invariant(
      key !== undefined && this.keyPolicy.accepts(key),
      'invalid-dart-map-key',
      'Key violates the specialized Dart Map contract',
    );
    invariant(
      value !== undefined && this.acceptsValue(value),
      'invalid-dart-map-value',
      'Value violates the specialized Dart Map contract',
    );
    const found = this.#lookup(key);
    invariant(found, 'invalid-dart-map-key-policy', 'A valid stored key must be a valid query');
    if (found.entry) {
      if (replace) found.entry.value = value;
      return false;
    }
    const entry = { key, value },
      bucket = found.bucket ?? [];
    bucket.push(entry);
    this.#buckets.set(found.hash, bucket);
    this.#ordered.add(entry);
    this.#revision++;
    return true;
  }
  set(key: K, value: V): void {
    this.#put(key, value, true);
  }
  /** @internal Set admission retains the original equal key/value. */
  addIfAbsent(key: K, value: V): boolean {
    return this.#put(key, value, false);
  }
  putIfAbsent(key: K, ifAbsent: () => V): V {
    this.checkMutable();
    invariant(
      key !== undefined && this.keyPolicy.accepts(key),
      'invalid-dart-map-key',
      'Key violates the specialized Dart Map contract',
    );
    const existing = this.#lookup(key)?.entry;
    if (existing) return existing.value;
    // Dart permits this callback to modify the map, including this same key.
    const value = ifAbsent();
    this.set(key, value);
    return value;
  }
  #removeEntry(key: unknown): Entry<K, V> | undefined {
    this.checkMutable();
    const found = this.#lookup(key);
    if (!found?.entry) return undefined;
    const entry = found.entry,
      bucket = found.bucket!;
    bucket.splice(bucket.indexOf(entry), 1);
    if (!bucket.length) this.#buckets.delete(found.hash);
    this.#ordered.delete(entry);
    this.#revision++;
    return entry;
  }
  remove(key: unknown): V | null {
    return this.#removeEntry(key)?.value ?? null;
  }
  /** @internal Unlike Map.remove, this distinguishes a stored null from absence. */
  delete(key: unknown): boolean {
    return this.#removeEntry(key) !== undefined;
  }
  clear(): void {
    this.checkMutable();
    if (this.#ordered.size) {
      this.#buckets.clear();
      this.#ordered.clear();
      this.#revision++;
    }
  }
  #iterator<T>(select: (entry: Entry<K, V>) => T): Iterator<T> {
    const revision = this.#revision,
      source = this.#ordered[Symbol.iterator]();
    // Capture at iterator creation, not first next(), and check even after end.
    return {
      next: () => {
        this.#stable(revision);
        const next = source.next();
        return next.done
          ? { done: true, value: undefined }
          : { done: false, value: select(next.value) };
      },
    };
  }
  get keys(): DartIterable<K> {
    return new DartIterable(
      () => this.#iterator((entry) => entry.key),
      this.keyPolicy,
      () => this.length,
      () => this.isEmpty,
    );
  }
  get values(): DartIterable<V> {
    return new DartIterable(
      () => this.#iterator((entry) => entry.value),
      this.valuePolicy,
      () => this.length,
      () => this.isEmpty,
    );
  }
  get entries(): DartIterable<DartMapEntry<K, V>> {
    return new DartIterable(
      () => this.#iterator((entry) => Object.freeze({ key: entry.key, value: entry.value })),
      undefined,
      () => this.length,
      () => this.isEmpty,
    );
  }
  forEach(action: (key: K, value: V) => void): void {
    for (const entry of this.entries) action(entry.key, entry.value);
  }
  addAll(other: DartMap<K, V>): void {
    this.checkMutable();
    for (const entry of other.entries) this.set(entry.key, entry.value);
  }
}

export class DartSet<T> extends DartIterable<T> {
  static is(value: unknown): value is DartSet<unknown> {
    return typeof value === 'object' && value !== null && constructedSets.has(value);
  }
  private readonly storage: DartMap<T, T>;
  constructor(policy: DartKeyPolicy<T>) {
    const storage = new DartMap(policy, policy.accepts, policy);
    super(
      () => storage.keys[Symbol.iterator](),
      policy,
      () => storage.length,
      () => storage.isEmpty,
    );
    this.storage = storage;
    constructedSets.add(this);
  }
  add(value: T): boolean {
    return this.storage.addIfAbsent(value, value);
  }
  freeze(): this {
    this.storage.freeze();
    return this;
  }
  addAll(values: Iterable<T>): void {
    this.storage.checkMutable();
    for (const value of values) this.add(value);
  }
  contains(value: unknown): boolean {
    return this.storage.containsKey(value);
  }
  lookup(value: unknown): T | null {
    return this.storage.get(value);
  }
  remove(value: unknown): boolean {
    return this.storage.delete(value);
  }
  clear(): void {
    this.storage.clear();
  }
  difference(other: { contains(value: unknown): boolean }): DartSet<T> {
    const result = new DartSet(this.elementPolicy!);
    for (const value of this) if (!other.contains(value)) result.add(value);
    return result;
  }
}
export function dartMapRead<K, V>(map: DartMap<K, V>, key: unknown): V | null {
  return map.get(key);
}
export function dartMapWrite<K, V>(map: DartMap<K, V>, key: K, value: V): void {
  map.set(key, value);
}
