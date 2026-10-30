// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { Image } from '../ui/image.ts';
import type { PictureCapture } from '../ui/picture.ts';

interface Entry {
  readonly frame: object;
  readonly size: string;
  readonly image: Image;
  readonly bytes: number;
  cancel: () => void;
}
const maxEntries = 64,
  maxBytes = 32 * 1024 * 1024;
/** App-local CPU-restorable raster outputs. Keys use recording identity and exact pixel dimensions. */
export class PictureBitmapCache {
  private readonly recordings = new Map<object, Map<string, Entry>>();
  private readonly entries = new Set<Entry>();
  private readonly failures: unknown[] = [];
  private readonly failedOwners: Image[] = [];
  private bytes = 0;
  private closed = false;
  private hits = 0;
  private misses = 0;
  lookup(capture: PictureCapture, width: number, height: number): Image | null {
    invariant(!this.closed, 'closed-bitmap-cache', 'Picture bitmap cache is closed');
    const entry = this.recordings.get(capture.frame)?.get(`${width}:${height}`);
    if (!entry) {
      this.misses++;
      return null;
    }
    const image = entry.image.clone();
    try {
      invariant(
        !this.closed && this.entries.has(entry),
        'closed-bitmap-cache',
        'Bitmap retired during clone admission',
      );
    } catch (error) {
      try {
        image.dispose();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Bitmap clone admission and retirement failed');
      }
      throw error;
    }
    this.entries.delete(entry);
    this.entries.add(entry);
    this.hits++;
    return image;
  }
  admit(capture: PictureCapture, image: Image): void {
    invariant(!this.closed, 'closed-bitmap-cache', 'Picture bitmap cache is closed');
    const bytes = image.width * image.height * 4,
      size = `${image.width}:${image.height}`;
    // An overbudget result remains a valid caller-owned image and bypasses caching.
    if (bytes > maxBytes || this.recordings.get(capture.frame)?.has(size)) return;
    while (this.entries.size >= maxEntries || this.bytes + bytes > maxBytes)
      this.remove(this.entries.values().next().value!);
    invariant(!this.closed, 'closed-bitmap-cache', 'Picture bitmap cache closed during eviction');
    const owned = image.clone();
    const entry: Entry = { frame: capture.frame, size, image: owned, bytes, cancel: () => {} };
    if (this.closed) {
      try {
        owned.dispose();
      } catch (error) {
        this.recordFailure(error, owned);
        throw error;
      }
      throw new Error('Picture bitmap cache closed during clone creation');
    }
    let sizes = this.recordings.get(capture.frame);
    if (!sizes) this.recordings.set(capture.frame, (sizes = new Map()));
    sizes.set(size, entry);
    this.entries.add(entry);
    this.bytes += bytes;
    try {
      const cancel = capture.onRetire(() => this.remove(entry));
      invariant(
        typeof cancel === 'function',
        'invalid-picture-subscription',
        'Bitmap recording requires an unsubscribe callback',
      );
      if (!this.entries.has(entry)) {
        this.cancel(cancel);
        throw new Error('Bitmap retired during subscription');
      }
      entry.cancel = cancel;
      invariant(
        !this.closed,
        'closed-bitmap-cache',
        'Picture bitmap cache closed during subscription',
      );
    } catch (error) {
      try {
        this.remove(entry);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Bitmap subscription and retirement failed');
      }
      throw error;
    }
  }
  private recordFailure(error: unknown, image?: Image): void {
    this.closed = true;
    this.failures.push(error);
    if (image) this.failedOwners.push(image);
  }
  private cancel(cancel: () => void): void {
    try {
      cancel();
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
  private remove(entry: Entry): void {
    if (!this.entries.delete(entry)) return;
    const sizes = this.recordings.get(entry.frame);
    sizes?.delete(entry.size);
    if (!sizes?.size) this.recordings.delete(entry.frame);
    this.bytes -= entry.bytes;
    const errors: unknown[] = [];
    try {
      this.cancel(entry.cancel);
    } catch (error) {
      errors.push(error);
    }
    try {
      entry.image.dispose();
    } catch (error) {
      this.recordFailure(error, entry.image);
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Bitmap cache entry retirement failed');
  }
  get debugStats() {
    return Object.freeze({
      entries: this.entries.size,
      bytes: this.bytes,
      hits: this.hits,
      misses: this.misses,
      failed: this.failures.length > 0,
    });
  }
  dispose(): void {
    this.closed = true;
    const errors: unknown[] = [...this.failures];
    for (const entry of this.entries)
      try {
        this.remove(entry);
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Picture bitmap cache retirement failed');
  }
}
