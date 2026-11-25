// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import { RasterizationPendingError } from './rasterization.ts';
import type { Picture, PictureCapture, PictureResourceProvider } from '../ui/picture.ts';
import type { ResourceDescriptor, ResourceId, ViewOwner } from '../ui/types.ts';
import type { ResourceRegistry, ResourceLease } from './resources.ts';
import { paintFrameLimits } from '../ui/frame.ts';

export interface NativeFramePicture {
  readonly bytes: number;
  retire(): void;
}
/** The backend retains a CPU restoration recipe; native lookup recompiles after context loss. */
export interface FramePictureBackend {
  compile(
    capture: PictureCapture,
    descriptor: ResourceDescriptor,
    updateNativeBytes?: (bytes: number) => void,
  ): NativeFramePicture;
}
interface Entry {
  readonly resource: ResourceDescriptor;
  readonly capture: PictureCapture;
  readonly input: ResourceLease;
  readonly native: NativeFramePicture;
  bytes: number;
  cancel: () => void;
}
// A composition snapshot owns its leaves even before GPU admission. Allow one
// bounded frame being built plus the renderer's two admitted frames and the LRU.
const limits = Object.freeze({
  entries: 64,
  live: paintFrameLimits.commands * 3 + 64,
  bytes: 32 * 1024 * 1024,
});
/** App-local native picture LRU. Eviction drops a producer, never an admitted GPU lease. */
export class FramePictureService implements PictureResourceProvider {
  private readonly cache = new Map<Picture, Entry>();
  private readonly live = new Set<Entry>();
  private readonly failures: Entry[] = [];
  private readonly uncertain: Array<{
    capture: PictureCapture;
    input: ResourceLease;
    error: RasterizationPendingError;
  }> = [];
  private bytes = 0;
  private closed = false;
  constructor(
    readonly resources: ResourceRegistry,
    private readonly backend: FramePictureBackend,
    private readonly owner: ViewOwner,
  ) {}
  resource(picture: Picture): ResourceId {
    invariant(!this.closed, 'closed-picture-owner', 'Native frame picture owner is closed');
    const cached = this.cache.get(picture);
    if (cached) {
      // Each Picture owns one immutable recording. Retain a capture only for
      // a new native entry, not on every translated/recomposed cache hit.
      invariant(!picture.debugDisposed, 'disposed-picture', 'Picture has been disposed');
      this.cache.delete(picture);
      this.cache.set(picture, cached);
      return cached.resource;
    }
    const capture = picture._capture();
    let recipe: PictureCapture | undefined,
      input: ResourceLease | undefined,
      native: NativeFramePicture | undefined,
      entry: Entry | undefined,
      admitted = false,
      result: ResourceId | undefined;
    const errors: unknown[] = [];
    try {
      // Nested pictures rely on the same bounded registry and native lookup.
      input = this.resources.acquire([...capture.frame.resources]);
      while (this.cache.size >= limits.entries) this.evict();
      invariant(
        this.live.size < limits.live,
        'picture-pending-budget',
        'Too many native Picture resources for the bounded frame queue',
      );
      const resource: ResourceDescriptor = Object.freeze({
        ...this.resources.allocateId(`${this.owner.id}:${this.owner.generation}:picture`),
        kind: 'picture',
      });
      recipe = capture.retain();
      const captureBytes = capture.frame.estimatedBytes;
      native = this.backend.compile(recipe, resource, (nativeBytes) => {
        invariant(entry && this.live.has(entry), 'picture-byte-budget', 'Picture is not admitted');
        const bytes = this.pictureBytes(captureBytes, nativeBytes);
        const delta = bytes - entry.bytes;
        if (delta > 0) this.makeRoom(delta, picture);
        this.bytes += delta;
        entry.bytes = bytes;
      });
      invariant(
        !this.closed,
        'closed-picture-owner',
        'Native picture owner closed during compilation',
      );
      invariant(
        !picture.debugDisposed,
        'disposed-picture',
        'Picture disposed during native compilation',
      );
      const bytes = this.pictureBytes(captureBytes, native.bytes);
      this.makeRoom(bytes);
      const next: Entry = { resource, capture: recipe, input, native, bytes, cancel: () => {} };
      this.resources.register(resource, () => this.retire(picture, next));
      entry = next;
      admitted = true;
      this.live.add(entry);
      this.bytes += bytes;
      this.cache.set(picture, entry);
      this.resources.bindResource(resource);
      try {
        entry.cancel = picture._onDispose(() => this.remove(picture));
      } catch (error) {
        try {
          this.remove(picture);
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'Picture disposal subscription failed');
        }
        throw error;
      }
      result = resource;
    } catch (error) {
      errors.push(error);
      if (error instanceof RasterizationPendingError && recipe && input && !native) {
        this.closed = true;
        this.uncertain.push({ capture: recipe, input, error });
        recipe = undefined;
        input = undefined;
      }
    } finally {
      if (!admitted) {
        let retired = true;
        try {
          native?.retire();
        } catch (error) {
          retired = false;
          this.closed = true;
          errors.push(error);
          if (native && recipe && input)
            this.failures.push({
              resource: { id: 'failed-admission', generation: 1, kind: 'picture' },
              capture: recipe,
              input,
              native,
              bytes: 0,
              cancel: () => {},
            });
        }
        if (retired) {
          for (const cleanup of [() => input?.returnBy('caller'), () => recipe?.dispose()])
            try {
              cleanup();
            } catch (error) {
              errors.push(error);
            }
        }
      }
      try {
        capture.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length)
      throw new AggregateError(errors, 'Native frame picture admission cleanup failed');
    return result!;
  }
  private pictureBytes(captureBytes: number, nativeBytes: number): number {
    const bytes = captureBytes + nativeBytes;
    invariant(
      Number.isSafeInteger(nativeBytes) && nativeBytes >= 0 && bytes <= limits.bytes,
      'picture-byte-budget',
      'Native picture and restoration recipe exceed budget',
    );
    return bytes;
  }
  private makeRoom(bytes: number, keep?: Picture): void {
    for (const key of this.cache.keys()) {
      if (this.bytes + bytes <= limits.bytes) break;
      if (key !== keep) this.remove(key);
    }
    invariant(
      this.bytes + bytes <= limits.bytes,
      'picture-byte-budget',
      'GPU-retained pictures occupy the byte budget',
    );
  }
  private remove(key: Picture): void {
    const entry = this.cache.get(key);
    if (!entry) return;
    this.cache.delete(key);
    entry.cancel();
    this.resources.releaseProducer(entry.resource);
  }
  private evict(): void {
    const key = this.cache.keys().next().value;
    invariant(key, 'picture-cache-empty', 'No evictable native picture');
    this.remove(key);
  }
  private retire(picture: Picture, entry: Entry): void {
    if (this.cache.get(picture) === entry) {
      this.cache.delete(picture);
      entry.cancel();
    }
    // A failed native deletion cannot release its input recipe or resource lease.
    try {
      entry.native.retire();
    } catch (error) {
      this.closed = true;
      this.failures.push(entry);
      throw error;
    }
    this.live.delete(entry);
    this.bytes -= entry.bytes;
    const errors: unknown[] = [];
    for (const cleanup of [() => entry.input.returnBy('caller'), () => entry.capture.dispose()])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, 'Native frame picture input retirement failed');
  }
  get debugStats() {
    return Object.freeze({ cached: this.cache.size, live: this.live.size, bytes: this.bytes });
  }
  stop(): void {
    this.closed = true;
  }
  dispose(): void {
    this.stop();
    const errors: unknown[] = [];
    while (this.cache.size)
      try {
        this.evict();
      } catch (error) {
        errors.push(error);
      }
    if (this.failures.length || this.uncertain.length)
      errors.push(new Error('Native picture retirement failed; inputs retained'));
    if (errors.length)
      throw new AggregateError(errors, 'Native frame picture owner retirement failed');
  }
}
