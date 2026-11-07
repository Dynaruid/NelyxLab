// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { decodeUtf8 } from './json-serialization.ts';
import { currentAssetLoader } from './asset-loader-binding.ts';
import type { AssetLoaderBackend } from './asset-loader-binding.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import { ImmutableBuffer } from '../ui/immutable-buffer.ts';
import {
  currentImmutableBufferLoader,
  wrapImmutableBuffer,
} from '../ui/immutable-buffer-binding.ts';
export { ImmutableBuffer } from '../ui/immutable-buffer.ts';
/** ByteData transport is adapted to owned Uint8Array values. */
export abstract class AssetBundle {
  abstract load(key: string): Promise<Uint8Array>;
  async loadBuffer(key: string): Promise<ImmutableBuffer> {
    const owner = currentImmutableBufferLoader();
    const bytes = await this.load(key);
    return wrapImmutableBuffer(owner.create(bytes), ImmutableBuffer);
  }
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
    return this.cached(this.structured, key, async () =>
      parser(await this.loadString(key, { cache: false })),
    );
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

/** Resolves keys against a URL using the current App's HTTP owner. Resources
 * are fetched on every call; any HTTP cache belongs to the platform stack. */
export class NetworkAssetBundle extends AssetBundle {
  constructor(private readonly baseUrl: string) {
    super();
    if (typeof baseUrl !== 'string' || !baseUrl || baseUrl.length > 4096 || baseUrl.includes('\0'))
      throw new FlutterError('Invalid NetworkAssetBundle base URL');
  }
  async load(key: string): Promise<Uint8Array> {
    const owner = currentAssetLoader();
    if (!owner?.loadNetwork)
      throw new FlutterError('NetworkAssetBundle requires an initialized App HTTP owner');
    return owner.loadNetwork(this.baseUrl, key);
  }
  override async loadBuffer(key: string): Promise<ImmutableBuffer> {
    const owner = currentAssetLoader();
    if (owner?.loadNetworkBuffer)
      return wrapImmutableBuffer(await owner.loadNetworkBuffer(this.baseUrl, key), ImmutableBuffer);
    return super.loadBuffer(key);
  }
  override toString(): string {
    return `${super.toString()}(${this.baseUrl})`;
  }
}

/** The embedding supplies packaged assets; cache entries belong to its realm
 * owner. A late result from a retired App cannot populate the next App's cache. */
export class PlatformAssetBundle extends CachingAssetBundle {
  private owner: AssetLoaderBackend | null = null;
  private capture(): AssetLoaderBackend {
    const owner = currentAssetLoader();
    if (owner !== this.owner) {
      super.clear();
      this.owner = owner;
    }
    if (!owner) throw new FlutterError('AssetBundle requires an initialized App asset owner');
    return owner;
  }
  load(key: string): Promise<Uint8Array> {
    try {
      return this.capture().load(key);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  override async loadBuffer(key: string): Promise<ImmutableBuffer> {
    const owner = this.capture();
    if (owner.loadBuffer) return wrapImmutableBuffer(await owner.loadBuffer(key), ImmutableBuffer);
    return super.loadBuffer(key);
  }
  override loadString(key: string, options: { readonly cache?: boolean } = {}): Promise<string> {
    try {
      this.capture();
      return super.loadString(key, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  override loadStructuredData<T>(
    key: string,
    parser: (text: string) => T | Promise<T>,
  ): Promise<T> {
    try {
      this.capture();
      return super.loadStructuredData(key, parser);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  override loadStructuredBinaryData<T>(
    key: string,
    parser: (data: Uint8Array) => T | Promise<T>,
  ): Promise<T> {
    try {
      this.capture();
      return super.loadStructuredBinaryData(key, parser);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  override peekStructuredData<T>(
    key: string,
    options: { readonly binary?: boolean } = {},
  ): T | undefined {
    this.capture();
    return super.peekStructuredData<T>(key, options);
  }
}
export const rootBundle: AssetBundle = new PlatformAssetBundle();
