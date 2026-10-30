// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { decodeUtf8 } from './json-serialization.ts';
/** ByteData/ImmutableBuffer transport is adapted to owned Uint8Array values. */
export abstract class AssetBundle {
  abstract load(key: string): Promise<Uint8Array>;
  async loadString(key: string, _options: { readonly cache?: boolean } = {}): Promise<string> {
    return decodeUtf8(await this.load(key));
  }
  async loadStructuredData<T>(key: string, parser: (text: string) => T | Promise<T>): Promise<T> {
    return parser(await this.loadString(key));
  }
  async loadStructuredBinaryData<T>(
    key: string,
    parser: (data: Uint8Array) => T | Promise<T>,
  ): Promise<T> {
    return parser(await this.load(key));
  }
  evict(_key: string): void {}
  clear(): void {}
  toString(): string {
    return this.constructor.name;
  }
}
export abstract class CachingAssetBundle extends AssetBundle {
  private strings = new Map<string, Promise<string>>();
  private structured = new Map<string, Promise<unknown>>();
  private binary = new Map<string, Promise<unknown>>();
  private ready = new Map<string, unknown>();
  private binaryReady = new Map<string, unknown>();
  override loadString(
    key: string,
    { cache = true }: { readonly cache?: boolean } = {},
  ): Promise<string> {
    if (!cache) return super.loadString(key, { cache: false });
    let value = this.strings.get(key);
    if (!value) {
      value = super.loadString(key);
      this.strings.set(key, value);
      const pending = value;
      void value.catch(() => {
        if (this.strings.get(key) === pending) this.strings.delete(key);
      });
    }
    return value;
  }
  override loadStructuredData<T>(
    key: string,
    parser: (text: string) => T | Promise<T>,
  ): Promise<T> {
    return this.cached(this.structured, key, () => super.loadStructuredData(key, parser));
  }
  override loadStructuredBinaryData<T>(
    key: string,
    parser: (data: Uint8Array) => T | Promise<T>,
  ): Promise<T> {
    return this.cached(this.binary, key, () => super.loadStructuredBinaryData(key, parser));
  }
  private cached<T>(
    map: Map<string, Promise<unknown>>,
    key: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const existing = map.get(key);
    if (existing) return existing as Promise<T>;
    const value = load();
    map.set(key, value);
    void value.then(
      (result) => {
        if (map.get(key) === value)
          (map === this.binary ? this.binaryReady : this.ready).set(key, result);
      },
      () => {
        if (map.get(key) === value) map.delete(key);
      },
    );
    return value;
  }
  /** Host adaptation of source SynchronousFuture cache hits, without changing Promise IO. */
  peekStructuredData<T>(
    key: string,
    { binary = false }: { readonly binary?: boolean } = {},
  ): T | undefined {
    return (binary ? this.binaryReady : this.ready).get(key) as T | undefined;
  }
  override evict(key: string): void {
    this.strings.delete(key);
    this.structured.delete(key);
    this.binary.delete(key);
    this.ready.delete(key);
    this.binaryReady.delete(key);
  }
  override clear(): void {
    this.strings.clear();
    this.structured.clear();
    this.binary.clear();
    this.ready.clear();
    this.binaryReady.clear();
  }
}
