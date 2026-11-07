// SPDX-License-Identifier: BSD-3-Clause
import { EngineError, protocol as p } from '@nelyx/core/v2';
import type { AppTextBackend } from '@nelyx/core/v2';
import type {
  ImmutableBufferLoader,
  ImmutableBufferValue,
  ImmutableBufferLease,
} from '@nelyx/core/internal/ui/immutable-buffer-binding';
import { applicationAssetKey } from './engine-v2-assets.ts';
import type { EngineV2Assets } from './engine-v2-assets.ts';

/** All public buffers and engine leases keep the App that admitted them. */
export class EngineV2Buffers implements ImmutableBufferLoader {
  private closed = false;
  private readonly handles = new Map<number, { backend: AppTextBackend; length: number }>();
  private readonly leases = new WeakMap<
    ImmutableBufferLease,
    { backend: AppTextBackend; handle: number; entry: object }
  >();
  private readonly pending = new Set<Promise<ImmutableBufferValue>>();
  private copies = 0;
  private bytes = 0;
  private reads = 0;
  private readBytes = 0;
  private owner: AppTextBackend | undefined;
  constructor(
    private readonly ready: () => AppTextBackend | undefined,
    private readonly initialize: () => Promise<AppTextBackend>,
    private readonly assets: EngineV2Assets,
  ) {}
  get execution() {
    const value = this.owner?.snapshot();
    return Object.freeze({
      copies: this.copies,
      bytes: this.bytes,
      reads: this.reads,
      readBytes: this.readBytes,
      handles: this.handles.size,
      pending: this.pending.size,
      closed: this.closed,
      nativeCopies: value?.immutableBufferCopies ?? 0,
      nativeCopyBytes: value?.immutableBufferCopyBytes ?? 0,
      nativeReads: value?.immutableBufferReads ?? 0,
      nativeReadBytes: value?.immutableBufferReadBytes ?? 0,
      nativeFileReads: value?.immutableBufferFileReads ?? 0,
      nativeFileBytes: value?.immutableBufferFileBytes ?? 0,
      nativeHandles: value?.immutableBuffers ?? 0,
      creditBytes: value?.immutableBufferBytes ?? 0,
      dataBytes: value?.immutableBufferDataBytes ?? 0,
    });
  }
  private check(): void {
    if (this.closed)
      throw new EngineError(p.statuses.canceled, 'App immutable buffer owner is closing');
  }
  private value(
    backend: AppTextBackend,
    value: { handle: number; length: number },
    copied: boolean,
  ): ImmutableBufferValue {
    if (
      !Number.isSafeInteger(value.handle) ||
      value.handle <= 0 ||
      this.handles.has(value.handle) ||
      !Number.isSafeInteger(value.length) ||
      value.length < 0 ||
      value.length > p.limits.resourceBytes
    )
      throw Error('Invalid/foreign immutable buffer result');
    this.owner = backend;
    if (copied) {
      ++this.copies;
      this.bytes += value.length;
    }
    const record = { backend, length: value.length };
    this.handles.set(value.handle, record);
    const live = () => {
      this.check();
      if (this.handles.get(value.handle) !== record)
        throw Error('ImmutableBuffer handle is foreign/retired');
    };
    return {
      length: value.length,
      dispose: () => {
        // Existing holders can retire after admission closes. A failed native
        // release keeps its exact handle here and prevents a false drained close.
        if (this.handles.get(value.handle) !== record)
          throw Error('ImmutableBuffer handle is foreign/retired');
        backend.releaseBuffer(value.handle);
        this.handles.delete(value.handle);
      },
      retain: (): ImmutableBufferLease => {
        live();
        const id = backend.retainBuffer(value.handle);
        const held = this.value(backend, { handle: id, length: value.length }, false);
        const entry = this.handles.get(id)!;
        const lease: ImmutableBufferLease = {
          length: value.length,
          dispose: () => held.dispose(),
          read: (offset, length) => {
            this.check();
            if (
              this.handles.get(id) !== entry ||
              !Number.isSafeInteger(offset) ||
              !Number.isSafeInteger(length) ||
              offset < 0 ||
              length < 0 ||
              length > p.limits.fontChunkBytes ||
              offset > value.length ||
              length > value.length - offset
            )
              throw Error('ImmutableBuffer chunk is outside a live buffer');
            const bytes = backend.bufferChunk(id, offset, length);
            if (
              !(bytes instanceof Uint8Array) ||
              !(bytes.buffer instanceof ArrayBuffer) ||
              bytes.byteOffset !== 0 ||
              bytes.length !== length ||
              bytes.buffer.byteLength !== length
            )
              throw Error('ImmutableBuffer chunk result differs');
            ++this.reads;
            this.readBytes += length;
            return bytes;
          },
        };
        this.leases.set(lease, { backend, handle: id, entry });
        return lease;
      },
    };
  }
  /** Only this exact App's live lease can enter the private image decoder. */
  imageSource(lease: ImmutableBufferLease): { backend: AppTextBackend; handle: number } {
    this.check();
    const value = this.leases.get(lease);
    if (!value || this.handles.get(value.handle) !== value.entry)
      throw Error('Image buffer is foreign/retired');
    return value;
  }
  create(bytes: Uint8Array): ImmutableBufferValue {
    this.check();
    if (
      !(bytes instanceof Uint8Array) ||
      !(bytes.buffer instanceof ArrayBuffer) ||
      bytes.length > p.limits.resourceBytes
    )
      throw Error('Invalid immutable buffer input');
    const backend = this.ready();
    if (!backend)
      throw Error('Synchronous immutable buffer backend was not prepared before App build');
    return this.value(backend, backend.createBuffer(bytes), true);
  }
  private track(work: Promise<ImmutableBufferValue>): Promise<ImmutableBufferValue> {
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work)).catch(() => {});
    return work;
  }
  loadAsset(key: string): Promise<ImmutableBufferValue> {
    try {
      this.check();
      applicationAssetKey(key);
      if (this.pending.size >= 32) throw Error('ImmutableBuffer IO request budget exceeded');
    } catch (error) {
      return Promise.reject(error);
    }
    return this.track(
      (async () => {
        const backend = await this.initialize();
        this.check();
        if (backend.bufferFromAsset) return this.value(backend, backend.bufferFromAsset(key), true);
        return this.assets.consumeBuffer(
          key,
          (owner, bytes) => {
            this.check();
            return this.value(owner, owner.createBuffer(bytes), true);
          },
          (value) => value.dispose(),
        );
      })(),
    );
  }
  loadFile(path: string): Promise<ImmutableBufferValue> {
    try {
      this.check();
      if (this.pending.size >= 32) throw Error('ImmutableBuffer IO request budget exceeded');
      if (typeof path !== 'string' || !path || path.length > 4096 || path.includes('\0'))
        throw Error('Invalid immutable buffer file path');
    } catch (error) {
      return Promise.reject(error);
    }
    return this.track(
      (async () => {
        const backend = await this.initialize();
        this.check();
        if (!backend.bufferFromFile)
          throw Error('Native ImmutableBuffer file loading is unavailable on this platform');
        return this.value(backend, backend.bufferFromFile(path), true);
      })(),
    );
  }
  loadNetwork(baseUrl: string, key: string): Promise<ImmutableBufferValue> {
    try {
      this.check();
      if (this.pending.size >= 32) throw Error('ImmutableBuffer IO request budget exceeded');
    } catch (error) {
      return Promise.reject(error);
    }
    return this.track(
      this.assets.consumeNetworkBuffer(
        baseUrl,
        key,
        (owner, bytes) => {
          this.check();
          return this.value(owner, owner.createBuffer(bytes), true);
        },
        (value) => value.dispose(),
      ),
    );
  }
  cancel(): void {
    this.closed = true;
    this.assets.cancel();
  }
  async close(): Promise<void> {
    this.cancel();
    await Promise.allSettled(this.pending);
    if (this.handles.size)
      throw Error('App immutable buffers remain live until holders retire or the realm terminates');
  }
}
