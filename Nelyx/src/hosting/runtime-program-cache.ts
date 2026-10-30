// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import { NativeRetirementError } from './rasterization.ts';

interface Entry<T> {
  readonly value: T;
  readonly bytes: number;
  failed: boolean;
}
/** Owner-local compiled programs. Uniforms and GPU recordings are not cache keys.
 * Limits bound source storage and program count, not driver allocation sizes.
 * Native shaders retain their own program references after an entry is evicted.
 */
export class RuntimeProgramCache<T extends object> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly unconfirmed = new Set<T>();
  private readonly errors: unknown[] = [];
  private sourceBytes = 0;
  private closed = false;
  private busy = false;
  private failure: NativeRetirementError | undefined;
  private hits = 0;
  private misses = 0;
  private compilations = 0;
  private evictions = 0;
  constructor(
    private readonly compile: (source: string) => T,
    private readonly retire: (value: T) => void,
    private readonly validate: (value: T) => void = () => {},
    private readonly limits = { entries: 16, sourceBytes: 128 * 1024 },
  ) {
    invariant(
      Number.isSafeInteger(limits.entries) &&
        limits.entries > 0 &&
        limits.entries <= 256 &&
        Number.isSafeInteger(limits.sourceBytes) &&
        limits.sourceBytes > 0 &&
        limits.sourceBytes <= 4 * 1024 * 1024,
      'invalid-program-cache-budget',
      'Invalid runtime program cache limits',
    );
    this.limits = Object.freeze({ ...limits });
  }
  private available(): void {
    if (this.failure) throw this.failure;
    invariant(!this.closed, 'closed-program-cache', 'Runtime program cache is closed');
    invariant(
      !this.busy,
      'reentrant-program-cache',
      'Runtime program cache mutation is in progress',
    );
  }
  private retireValue(value: T): void {
    try {
      this.retire(value);
    } catch (error) {
      this.unconfirmed.add(value);
      this.errors.push(error);
      this.failure = new NativeRetirementError(this.errors, [...this.unconfirmed]);
      throw this.failure;
    }
  }
  private remove(source: string): void {
    const entry = this.entries.get(source);
    if (!entry) return;
    if (entry.failed) throw this.failure;
    try {
      this.retireValue(entry.value);
    } catch (error) {
      entry.failed = true;
      throw error;
    }
    this.entries.delete(source);
    this.sourceBytes -= entry.bytes;
  }
  get(source: string): T {
    /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
    this.available();
    invariant(
      typeof source === 'string' &&
        source.length > 0 &&
        source.length <= this.limits.sourceBytes &&
        /^[\x09\x0a\x0d\x20-\x7e]+$/.test(source),
      'invalid-program-source',
      'Runtime program source exceeds its ASCII budget',
    );
    /* oxlint-enable no-control-regex */
    const previous = this.entries.get(source);
    if (previous) {
      this.hits++;
      this.entries.delete(source);
      this.entries.set(source, previous);
      return previous.value;
    }
    this.misses++;
    this.busy = true;
    let value: T | undefined;
    try {
      value = this.compile(source);
      this.validate(value);
      this.compilations++;
      while (
        this.entries.size >= this.limits.entries ||
        this.sourceBytes + source.length > this.limits.sourceBytes
      ) {
        this.remove(this.entries.keys().next().value!);
        this.evictions++;
      }
      this.entries.set(source, { value, bytes: source.length, failed: false });
      this.sourceBytes += source.length;
      return value;
    } catch (error) {
      if (value !== undefined) {
        this.retireValue(value);
      }
      throw error;
    } finally {
      this.busy = false;
    }
  }
  /** Successful context loss releases cached wrappers; later gets compile anew. */
  clear(): void {
    this.available();
    this.release(false);
  }
  private release(close: boolean): void {
    invariant(
      !this.busy,
      'reentrant-program-cache',
      'Runtime program cache mutation is in progress',
    );
    if (close) this.closed = true;
    this.busy = true;
    try {
      for (const [source, entry] of this.entries)
        if (!entry.failed)
          try {
            this.remove(source);
          } catch {
            /* Retain failed owner, retire the other entries once. */
          }
    } finally {
      this.busy = false;
    }
    if (this.failure) throw this.failure;
  }
  dispose(): void {
    this.release(true);
  }
  get retirementError(): NativeRetirementError | undefined {
    return this.failure;
  }
  get debugStats() {
    return Object.freeze({
      entries: this.entries.size,
      sourceBytes: this.sourceBytes,
      hits: this.hits,
      misses: this.misses,
      compilations: this.compilations,
      evictions: this.evictions,
      unconfirmed: this.unconfirmed.size,
      closed: this.closed,
    });
  }
}
