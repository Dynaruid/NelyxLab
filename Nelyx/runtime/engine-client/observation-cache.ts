// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';

/** Reuse validated immutable blob values across compositor publications.
 * Bytes are compared exactly, so neither hash collisions nor node reuse can
 * return stale semantics. Own only the small blob, never its whole packet. */
export class ObservationDecodeCache {
  private readonly entries = new Map<string, { bytes: Uint8Array; value: unknown }>();
  private bytes = 0;
  readonly counters = { hits: 0, misses: 0 };
  constructor(
    private readonly maxBytes = 1024 * 1024,
    private readonly maxEntries: number = p.limits.nodes,
  ) {}
  get byteLength(): number {
    return this.bytes;
  }
  get size(): number {
    return this.entries.size;
  }
  /** The owner has committed a dictionary. Old snapshots keep their decoded
   * values directly; retired IDs need no extra cache holder. */
  retainRegistered(owner: string, registrations: Iterable<bigint>): number {
    const prefix = `registered/${owner}`,
      live = new Set([...registrations].map(String));
    let removed = 0;
    for (const [id, entry] of this.entries) {
      const separator = id.lastIndexOf('/');
      if (id.slice(0, separator) === prefix && !live.has(id.slice(separator + 1))) {
        this.entries.delete(id);
        this.bytes -= entry.bytes.length;
        ++removed;
      }
    }
    return removed;
  }
  /** Only owner-scoped registrations that have already passed exact ID/bytes
   * validation may use this path. Eviction remains an explicit cache miss. */
  readRegistered<T>(key: string, bytes: Uint8Array, decode: (bytes: Uint8Array) => T): T {
    const identity = `registered/${key}`;
    const previous = this.entries.get(identity);
    if (previous?.bytes === bytes) {
      ++this.counters.hits;
      return previous.value as T;
    }
    // A decoded registration from a response that later failed validation was
    // never committed to the stream. A matching ID alone cannot certify it.
    // Only the same private immutable backing has already passed that check.
    return this.readValue(identity, bytes, decode, true);
  }
  read<T>(key: string, bytes: Uint8Array, decode: (bytes: Uint8Array) => T): T {
    return this.readValue(key, bytes, decode, false);
  }
  private readValue<T>(
    key: string,
    bytes: Uint8Array,
    decode: (bytes: Uint8Array) => T,
    immutableRegistration: boolean,
  ): T {
    const previous = this.entries.get(key);
    if (previous && previous.bytes.length === bytes.length) {
      let equal = true;
      for (let i = 0; i < bytes.length; ++i)
        if (previous.bytes[i] !== bytes[i]) {
          equal = false;
          break;
        }
      if (equal) {
        if (immutableRegistration) previous.bytes = bytes;
        ++this.counters.hits;
        return previous.value as T;
      }
    }
    ++this.counters.misses;
    // Validate before updating the cache; a malformed reply must still fail.
    const value = decode(bytes);
    if (previous) {
      this.entries.delete(key);
      this.bytes -= previous.bytes.length;
    }
    if (bytes.length > this.maxBytes || this.maxEntries === 0) return value;
    while (this.entries.size >= this.maxEntries || this.bytes + bytes.length > this.maxBytes) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.bytes.length;
      this.entries.delete(oldest);
    }
    const owned = immutableRegistration ? bytes : bytes.slice();
    this.entries.set(key, { bytes: owned, value });
    this.bytes += owned.length;
    return value;
  }
  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }
}
