// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p, encodeUtf8, decodeUtf8, EngineError } from '@nelyx/core/v2';
import type { AppTextBackend } from '@nelyx/core/v2';
import { networkAssetTransport, networkAssetAddress } from './engine-v2-network.ts';

export function applicationAssetKey(key: string): void {
  if (
    typeof key !== 'string' ||
    !key ||
    key.length > 1024 ||
    /[\\:*?"<>|]/.test(key) ||
    key.split('/').some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part))
  )
    throw Error('Invalid application asset name');
  for (let at = 0; at < key.length; ++at)
    if (key.charCodeAt(at) < 32 || key.charCodeAt(at) === 127)
      throw Error('Invalid application asset name');
  encodeUtf8(key, 1024);
}
export interface AssetCancellation {
  check(): void;
  listen(callback: () => void): () => void;
}
class Cancellation implements AssetCancellation {
  private cancelled = false;
  private readonly listeners = new Set<() => void>();
  check(): void {
    if (this.cancelled)
      throw new EngineError(p.statuses.canceled, 'App asset load cancelled/closing');
  }
  listen(callback: () => void): () => void {
    this.check();
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}
export interface AssetRead {
  readonly size: number;
  readonly variableSize?: boolean;
  read(token: number, progress?: AssetProgress, maximumBytes?: number): Promise<Uint8Array>;
  close(): void | Promise<void>;
}
export type AssetProgress = (event: {
  readonly cumulativeBytesLoaded: number;
  readonly expectedTotalBytes: number | null;
}) => void;
export type AssetTransport = ((
  backend: AppTextBackend,
  key: string,
  cancellation: AssetCancellation,
) => Promise<AssetRead>) & {
  close?(): void;
  readonly metadataBuffers?: number;
  readonly metadataCreditBytes?: number;
};
export const nativeAssetTransport: AssetTransport = async (backend, key, cancellation) => {
  cancellation.check();
  if (!backend.assetSize || !backend.readAsset)
    throw Error('Required Native App asset service is unavailable');
  const size = backend.assetSize(key);
  return {
    size,
    async read(token) {
      cancellation.check();
      return backend.readAsset!(token, key);
    },
    close() {},
  };
};
export function webAssetTransport(root: string): AssetTransport {
  const indexLimit = 512 * 1024,
    metadataSize = 2 * indexLimit;
  type Metadata = { size: number; sha256: string };
  let catalog: Promise<Map<string, Metadata>> | undefined,
    catalogCredit: { backend: AppTextBackend; token: number } | undefined;
  const loadCatalog = (
    backend: AppTextBackend,
    cancellation: AssetCancellation,
    signal: AbortSignal,
  ): Promise<Map<string, Metadata>> => {
    if (catalog) return catalog;
    const token = backend.reserveAssetBytes(metadataSize);
    catalogCredit = { backend, token };
    const work = (async () => {
      try {
        const response = await fetch(new URL('application/asset-index.json', root), { signal });
        cancellation.check();
        const length = response.headers.get('Content-Length');
        if (
          !response.ok ||
          !response.body ||
          (length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > indexLimit))
        )
          throw Error('Application asset index is unavailable/too large');
        const bytes = new Uint8Array(indexLimit),
          reader = response.body.getReader();
        let at = 0;
        try {
          for (;;) {
            cancellation.check();
            const chunk = await reader.read();
            if (chunk.done) break;
            if (chunk.value.length > indexLimit - at)
              throw Error('Application asset index exceeds metadata budget');
            bytes.set(chunk.value, at);
            at += chunk.value.length;
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        cancellation.check();
        const value = JSON.parse(decodeUtf8(bytes.subarray(0, at))) as {
          schema?: unknown;
          assets?: unknown;
        };
        if (
          !value ||
          value.schema !== 'nelyx.assets.v2/1' ||
          !Array.isArray(value.assets) ||
          value.assets.length > 258
        )
          throw Error('Invalid application asset index');
        const entries = new Map<string, Metadata>();
        for (const item of value.assets as { key: string; size: number; sha256: string }[]) {
          if (!item) throw Error('Invalid application asset index entry');
          applicationAssetKey(item.key);
          if (
            entries.has(item.key) ||
            !Number.isSafeInteger(item.size) ||
            item.size < 0 ||
            item.size > p.limits.resourceBytes ||
            typeof item.sha256 !== 'string' ||
            !/^[a-f0-9]{64}$/.test(item.sha256)
          )
            throw Error('Invalid application asset index entry');
          entries.set(item.key, { size: item.size, sha256: item.sha256 });
        }
        return entries;
      } catch (error) {
        backend.finishAssetLoad(token, false);
        catalogCredit = undefined;
        catalog = undefined;
        throw error;
      }
    })();
    catalog = work;
    return work;
  };
  const transport: AssetTransport = async (backend, key, cancellation) => {
    const controller = new AbortController(),
      unbind = cancellation.listen(() => controller.abort()),
      url = new URL('application/assets/' + key.split('/').map(encodeURIComponent).join('/'), root);
    try {
      const metadata = await fetch(url, { method: 'HEAD', signal: controller.signal }).catch(
        () => undefined,
      );
      cancellation.check();
      let header = metadata?.headers.get('Content-Length') ?? null,
        hash = metadata?.headers.get('X-Nelyx-Asset-Sha256') ?? null,
        size: number;
      if (metadata?.ok && hash !== null) {
        if (header === null || !/^(0|[1-9][0-9]*)$/.test(header) || !/^[a-f0-9]{64}$/.test(hash))
          throw Error('Application asset metadata is invalid: ' + key);
        size = Number(header);
      } else {
        const entries = await loadCatalog(backend, cancellation, controller.signal),
          entry = entries.get(key);
        if (!entry) throw Error('Application asset is undeclared: ' + key);
        size = entry.size;
        hash = entry.sha256;
        header = String(size);
      }
      const expectedHash = hash;
      return {
        size,
        async read(_token, progress) {
          cancellation.check();
          const response = await fetch(url, { signal: controller.signal });
          if (
            !response.ok ||
            (response.headers.has('Content-Length') &&
              response.headers.get('Content-Length') !== header) ||
            (response.headers.has('X-Nelyx-Asset-Sha256') &&
              response.headers.get('X-Nelyx-Asset-Sha256') !== expectedHash) ||
            !response.body
          )
            throw Error('Application asset changed before reading: ' + key);
          const bytes = new Uint8Array(size),
            reader = response.body.getReader();
          let at = 0;
          try {
            for (;;) {
              cancellation.check();
              const chunk = await reader.read();
              if (chunk.done) break;
              if (chunk.value.length > size - at)
                throw Error('Application asset exceeds declared size');
              bytes.set(chunk.value, at);
              at += chunk.value.length;
              progress?.({ cumulativeBytesLoaded: at, expectedTotalBytes: size });
            }
            cancellation.check();
            if (at !== size) throw Error('Application asset is shorter than declared size');
            const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
            cancellation.check();
            if (
              Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('') !==
              expectedHash
            )
              throw Error('Application asset identity differs: ' + key);
            return bytes;
          } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
        },
        close() {
          unbind();
          controller.abort();
        },
      };
    } catch (error) {
      unbind();
      controller.abort();
      throw error;
    }
  };
  transport.close = () => {
    catalog = undefined;
    if (catalogCredit) {
      catalogCredit.backend.finishAssetLoad(catalogCredit.token, false);
      catalogCredit = undefined;
    }
  };
  Object.defineProperties(transport, {
    metadataBuffers: { get: () => (catalogCredit ? 1 : 0) },
    metadataCreditBytes: { get: () => (catalogCredit ? 3 * metadataSize + 65536 : 0) },
  });
  return transport;
}
/** Reservations cover IO/copies and cached UTF-16 text. Delivered ByteData may
 * escape into arbitrary caller JS, so its credit survives until realm teardown. */
export class EngineV2Assets {
  private closed = false;
  private readonly pending = new Map<Cancellation, Promise<unknown>>();
  private readonly failedCredits = new Set<number>();
  private readonly failedClosures = new Set<AssetRead>();
  private reads = 0;
  private bytes = 0;
  private bufferReads = 0;
  private bufferBytes = 0;
  private networkReads = 0;
  private networkBytes = 0;
  private networkBufferReads = 0;
  private networkBufferBytes = 0;
  private owner: AppTextBackend | undefined;
  constructor(
    private readonly backend: () => Promise<AppTextBackend>,
    private readonly transport: AssetTransport,
  ) {}
  get execution() {
    const state = this.owner?.snapshot();
    return Object.freeze({
      reads: this.reads,
      bytes: this.bytes,
      bufferReads: this.bufferReads,
      bufferBytes: this.bufferBytes,
      networkReads: this.networkReads,
      networkBytes: this.networkBytes,
      networkBufferReads: this.networkBufferReads,
      networkBufferBytes: this.networkBufferBytes,
      pending: this.pending.size,
      failedCredits: this.failedCredits.size,
      failedClosures: this.failedClosures.size,
      metadataBuffers: this.transport.metadataBuffers ?? 0,
      metadataCreditBytes: this.transport.metadataCreditBytes ?? 0,
      closed: this.closed,
      buffers: state?.assetBuffers ?? 0,
      creditBytes: state?.assetBufferBytes ?? 0,
      dataBytes: state?.assetDataBytes ?? 0,
      nativeReads: state?.assetNativeReads ?? 0,
      nativeReadBytes: state?.assetNativeReadBytes ?? 0,
      networkBuffers: state?.networkBuffers ?? 0,
      networkCreditBytes: state?.networkBufferBytes ?? 0,
      nativeNetworkRequests: state?.networkRequests ?? 0,
      nativeNetworkReadBytes: state?.networkReadBytes ?? 0,
    });
  }
  load(
    key: string,
    source?: AssetCancellation,
    progress?: AssetProgress,
    maximumBytes: number = p.limits.resourceBytes,
  ): Promise<Uint8Array> {
    return this.begin(
      key,
      true,
      (_backend, bytes) => bytes,
      () => {},
      this.transport,
      false,
      source,
      progress,
      maximumBytes,
    );
  }
  /** Internal reads never deliver mutable ByteData, so their staging can retire
   * after the engine has captured an immutable allocation. */
  consumeBuffer<T>(
    key: string,
    capture: (backend: AppTextBackend, bytes: Uint8Array) => T,
    retire: (value: T) => void,
  ): Promise<T> {
    return this.begin(key, false, capture, retire);
  }
  loadNetwork(
    baseUrl: string,
    key: string,
    headers: Readonly<Record<string, string>> = {},
    source?: AssetCancellation,
    progress?: AssetProgress,
    maximumBytes: number = p.limits.resourceBytes,
  ): Promise<Uint8Array> {
    return this.consumeNetwork(
      baseUrl,
      key,
      true,
      (_backend, bytes) => bytes,
      () => {},
      headers,
      source,
      progress,
      maximumBytes,
    );
  }
  consumeNetworkBuffer<T>(
    baseUrl: string,
    key: string,
    capture: (backend: AppTextBackend, bytes: Uint8Array) => T,
    retire: (value: T) => void,
  ): Promise<T> {
    return this.consumeNetwork(baseUrl, key, false, capture, retire);
  }
  private consumeNetwork<T>(
    baseUrl: string,
    key: string,
    delivered: boolean,
    capture: (backend: AppTextBackend, bytes: Uint8Array) => T,
    retire: (value: T) => void,
    headers: Readonly<Record<string, string>> = {},
    source?: AssetCancellation,
    progress?: AssetProgress,
    maximumBytes: number = p.limits.resourceBytes,
  ): Promise<T> {
    try {
      networkAssetAddress(baseUrl, key);
    } catch (error) {
      return Promise.reject(error);
    }
    return this.begin(
      key,
      delivered,
      capture,
      retire,
      networkAssetTransport(baseUrl, headers),
      true,
      source,
      progress,
      maximumBytes,
    );
  }
  private begin<T>(
    key: string,
    delivered: boolean,
    capture: (backend: AppTextBackend, bytes: Uint8Array) => T,
    retire: (value: T) => void,
    transport: AssetTransport = this.transport,
    network = false,
    source?: AssetCancellation,
    progress?: AssetProgress,
    maximumBytes: number = p.limits.resourceBytes,
  ): Promise<T> {
    try {
      if (this.closed) throw new EngineError(p.statuses.canceled, 'App asset owner is closing');
      if (this.failedCredits.size || this.failedClosures.size)
        throw Error('App asset credits remain unresolved until realm termination');
      if (this.pending.size >= 32) throw Error('App asset request budget exceeded');
      if (!network) applicationAssetKey(key);
      if (
        !Number.isSafeInteger(maximumBytes) ||
        maximumBytes < 0 ||
        maximumBytes > p.limits.resourceBytes
      )
        throw Error('Invalid asset read byte limit');
      source?.check();
    } catch (error) {
      return Promise.reject(error);
    }
    const cancellation = new Cancellation();
    let detach = () => {};
    try {
      detach = source?.listen(() => cancellation.cancel()) ?? detach;
    } catch (error) {
      return Promise.reject(error);
    }
    const work = this.perform(
      key,
      cancellation,
      delivered,
      capture,
      retire,
      transport,
      network,
      progress,
      maximumBytes,
    ).finally(() => {
      try {
        detach();
      } finally {
        this.pending.delete(cancellation);
      }
    });
    this.pending.set(cancellation, work);
    void work.catch(() => {});
    if (this.closed) cancellation.cancel();
    return work;
  }
  private async perform<T>(
    key: string,
    cancellation: Cancellation,
    delivered: boolean,
    capture: (backend: AppTextBackend, bytes: Uint8Array) => T,
    retire: (value: T) => void,
    transport: AssetTransport,
    network: boolean,
    progress: AssetProgress | undefined,
    maximumBytes: number,
  ): Promise<T> {
    const backend = await this.backend();
    this.owner = backend;
    cancellation.check();
    let input: AssetRead;
    try {
      input = await transport(backend, key, cancellation);
    } catch (error) {
      cancellation.check();
      throw error;
    }
    let token: number | undefined;
    let result: T | undefined,
      produced = false;
    let closing: Promise<void> | undefined;
    const closeInput = () => (closing ??= Promise.resolve().then(() => input.close()));
    try {
      cancellation.check();
      if (!Number.isSafeInteger(input.size) || input.size < 0 || input.size > maximumBytes)
        throw Error('Application asset exceeds resource budget');
      token = backend.reserveAssetBytes(input.size);
      let loaded = 0;
      const observe = (event: Parameters<AssetProgress>[0]) => {
        cancellation.check();
        if (
          !Number.isSafeInteger(event.cumulativeBytesLoaded) ||
          event.cumulativeBytesLoaded < loaded ||
          event.cumulativeBytesLoaded > maximumBytes ||
          (event.expectedTotalBytes !== null &&
            (!Number.isSafeInteger(event.expectedTotalBytes) ||
              event.expectedTotalBytes < event.cumulativeBytesLoaded ||
              event.expectedTotalBytes > maximumBytes))
        )
          throw Error('Invalid image/asset source progress or read byte limit');
        loaded = event.cumulativeBytesLoaded;
        progress?.(event);
        cancellation.check();
      };
      progress?.({
        cumulativeBytesLoaded: 0,
        expectedTotalBytes: input.variableSize ? null : input.size,
      });
      cancellation.check();
      const bytes = await input.read(token, observe, maximumBytes);
      cancellation.check();
      if (
        !(bytes instanceof Uint8Array) ||
        !(bytes.buffer instanceof ArrayBuffer) ||
        bytes.byteOffset !== 0 ||
        (!input.variableSize && bytes.length !== input.size) ||
        bytes.length > maximumBytes ||
        bytes.buffer.byteLength !== bytes.length
      )
        throw Error('Application asset input size/ownership differs');
      if (loaded > bytes.length) throw Error('Application asset progress exceeds final bytes');
      if (loaded < bytes.length)
        observe({
          cumulativeBytesLoaded: bytes.length,
          expectedTotalBytes: input.variableSize ? null : input.size,
        });
      await closeInput();
      cancellation.check();
      result = capture(backend, bytes);
      produced = true;
      backend.finishAssetLoad(token, delivered, bytes.length);
      token = undefined;
      produced = false;
      if (delivered) {
        ++this.reads;
        this.bytes += bytes.length;
        if (network) {
          ++this.networkReads;
          this.networkBytes += bytes.length;
        }
      } else {
        ++this.bufferReads;
        this.bufferBytes += bytes.length;
        if (network) {
          ++this.networkBufferReads;
          this.networkBufferBytes += bytes.length;
        }
      }
      return result;
    } catch (error) {
      const errors: unknown[] = [error];
      let closed = true;
      try {
        await closeInput();
      } catch (retirement) {
        closed = false;
        this.failedClosures.add(input);
        errors.push(retirement);
      }
      if (produced)
        try {
          retire(result!);
        } catch (retirement) {
          errors.push(retirement);
        }
      if (token !== undefined) {
        if (!closed) this.failedCredits.add(token);
        else
          try {
            backend.finishAssetLoad(token, false);
          } catch (retirement) {
            this.failedCredits.add(token);
            errors.push(retirement);
          }
      }
      if (errors.length > 1)
        throw new AggregateError(errors, 'App asset credit/capture retirement failed');
      cancellation.check();
      throw error;
    }
  }
  cancel(): void {
    this.closed = true;
    for (const cancellation of this.pending.keys()) cancellation.cancel();
  }
  async close(): Promise<void> {
    this.cancel();
    await Promise.allSettled(this.pending.values());
    this.transport.close?.();
    if (this.failedCredits.size || this.failedClosures.size)
      throw Error('App asset credits remain unresolved until realm termination');
  }
}
