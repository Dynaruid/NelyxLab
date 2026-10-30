// SPDX-License-Identifier: BSD-3-Clause
// Platform-independent asynchronous image ownership; codecs/IO belong to SDK backends.
import { invariant } from '../foundation/errors.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { Clock, FrameClock } from '../foundation/clock.ts';
import type { ResourceDescriptor } from '../ui/types.ts';
import { ResourceRegistry } from './resources.ts';
import { Image } from '../ui/image.ts';
import type { ImageByteReader } from '../ui/image.ts';
import { Codec, FrameInfo } from '../ui/codec.ts';
export const imageLimits = Object.freeze({
  encodedBytes: 16 * 1024 * 1024,
  dimension: 8192,
  pixels: 16 * 1024 * 1024,
  codecs: 32,
  frames: 4096,
});
export interface ImageDecodeOptions {
  readonly targetWidth?: number | null;
  readonly targetHeight?: number | null;
  readonly allowUpscaling?: boolean;
  readonly getTargetSize?:
    | ((
        width: number,
        height: number,
      ) => { readonly width?: number | null; readonly height?: number | null })
    | null;
}
export interface NativeImageFrame {
  readonly descriptor: ResourceDescriptor;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly readBytes?: ImageByteReader;
  retire(): void;
}
export interface NativeImageCodec {
  readonly frameCount: number;
  readonly repetitionCount: number;
  getNextFrame(): NativeImageFrame | Promise<NativeImageFrame>;
  dispose(): void;
}
export interface ImageCancellation {
  readonly canceled: boolean;
  addListener(callback: () => void): Disposable;
  throwIfCanceled(): void;
}
export interface ImageTiming extends Clock {
  scheduleTimer(callback: () => void, milliseconds: number): Disposable;
}
export interface ImageReadProgress {
  readonly cumulativeBytesLoaded: number;
  readonly expectedTotalBytes: number | null;
}
export type ImageReadProgressListener = (event: ImageReadProgress) => void;
export interface ImageReadRequest {
  readonly promise: Promise<Uint8Array>;
  cancel(): void;
  addProgressListener(listener: ImageReadProgressListener): Disposable;
}
/** Portable local file URI validation; RN's URL polyfill does not parse file paths.
 * Callers provide percent-encoded file:/// paths; remote authorities are not supported. */
export function fileImageUri(value: string): string {
  /* oxlint-disable no-control-regex -- Control code points are deliberately matched for input validation or normalization. */
  invariant(
    typeof value === 'string' && /^file:\/\/\/[^?#\\\u0000-\u0020]+$/i.test(value),
    'invalid-image-file',
    'FileImage requires a percent-encoded absolute file:/// URI without query or fragment',
  );
  /* oxlint-enable no-control-regex */
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.slice(8));
  } catch {
    throw new Error('Invalid FileImage URI encoding');
  }
  invariant(
    !decoded.includes('\0') && !decoded.includes('\\'),
    'invalid-image-file',
    'FileImage URI contains an invalid path character',
  );
  return 'file:///' + value.slice(8);
}
class ImageRequest implements ImageCancellation {
  private aborted = false;
  private completed = false;
  private listeners = new Set<() => void>();
  private progressListeners = new Set<ImageReadProgressListener>();
  private loaded = 0;
  addProgressListener(listener: ImageReadProgressListener): Disposable {
    if (this.completed) return { dispose() {} };
    this.progressListeners.add(listener);
    return {
      dispose: () => {
        this.progressListeners.delete(listener);
      },
    };
  }
  reportProgress(event: ImageReadProgress): void {
    if (this.aborted || this.completed) return;
    invariant(
      Number.isSafeInteger(event.cumulativeBytesLoaded) &&
        event.cumulativeBytesLoaded >= this.loaded &&
        (event.expectedTotalBytes === null ||
          (Number.isSafeInteger(event.expectedTotalBytes) && event.expectedTotalBytes >= 0)),
      'invalid-image-progress',
      'Invalid or decreasing image progress',
    );
    this.loaded = event.cumulativeBytesLoaded;
    const snapshot = Object.freeze({ ...event });
    const snapshot1 = [...this.progressListeners];
    for (const listener of snapshot1) {
      if (this.aborted || this.completed) break;
      if (this.progressListeners.has(listener)) listener(snapshot);
    }
  }
  finish(): void {
    this.completed = true;
    this.listeners.clear();
    this.progressListeners.clear();
  }
  get canceled(): boolean {
    return this.aborted;
  }
  addListener(callback: () => void): Disposable {
    if (this.aborted) {
      callback();
      return { dispose() {} };
    }
    this.listeners.add(callback);
    return {
      dispose: () => {
        this.listeners.delete(callback);
      },
    };
  }
  throwIfCanceled(): void {
    if (this.aborted) throw canceled();
  }
  abort(): void {
    if (this.aborted || this.completed) return;
    this.aborted = true;
    const errors: unknown[] = [];
    for (const callback of this.listeners)
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    this.finish();
    failures(errors, 'Image request cancellation failed');
  }
}
export interface ImageBackend {
  readonly assetManifestBytes?: Uint8Array;
  instantiateCodec(
    bytes: Uint8Array,
    options: ImageDecodeOptions,
  ): NativeImageCodec | Promise<NativeImageCodec>;
  loadAsset(
    key: string,
    signal: ImageCancellation,
    onProgress?: ImageReadProgressListener,
  ): Promise<Uint8Array>;
  loadNetwork(
    url: string,
    headers: Readonly<Record<string, string>>,
    signal: ImageCancellation,
    onProgress?: ImageReadProgressListener,
  ): Promise<Uint8Array>;
  /** Explicit native file capability, separate from confined application assets. */
  loadFile?(
    uri: string,
    signal: ImageCancellation,
    onProgress?: ImageReadProgressListener,
  ): Promise<Uint8Array>;
  dispose?(): void | Promise<void>;
}
export function imageTargetSize(
  width: number,
  height: number,
  {
    targetWidth = null,
    targetHeight = null,
    allowUpscaling = true,
    getTargetSize = null,
  }: ImageDecodeOptions = {},
): { width: number; height: number } {
  invariant(
    Number.isSafeInteger(width) &&
      width > 0 &&
      width <= imageLimits.dimension &&
      Number.isSafeInteger(height) &&
      height > 0 &&
      height <= imageLimits.dimension &&
      width * height <= imageLimits.pixels,
    'image-pixel-budget',
    'Decoded image exceeds dimension/pixel bounds',
  );
  if (getTargetSize) {
    const target = getTargetSize(width, height);
    targetWidth = target.width ?? null;
    targetHeight = target.height ?? null;
  }
  for (const value of [targetWidth, targetHeight])
    invariant(
      value === null ||
        (Number.isSafeInteger(value) && value > 0 && value <= imageLimits.dimension),
      'invalid-image-target',
      'Image target dimensions must be positive bounded integers',
    );
  let w =
      targetWidth ??
      (targetHeight === null ? width : Math.max(1, Math.round((width * targetHeight) / height))),
    h =
      targetHeight ??
      (targetWidth === null ? height : Math.max(1, Math.round((height * targetWidth) / width)));
  if (!allowUpscaling) {
    w = Math.min(width, w);
    h = Math.min(height, h);
  }
  invariant(w * h <= imageLimits.pixels, 'image-pixel-budget', 'Target image exceeds pixel budget');
  return { width: w, height: h };
}
function canceled(): Error {
  return new Error('Image owner is closed or decoding was canceled');
}
function failures(errors: unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}
class HostedCodec extends Codec {
  private dead = false;
  private pending = 0;
  private tail = Promise.resolve();
  private resolve!: () => void;
  private reject!: (error: unknown) => void;
  readonly drained: Promise<void>;
  private retired = false;
  readonly frameCount: number;
  readonly repetitionCount: number;
  constructor(
    private readonly native: NativeImageCodec,
    private readonly registry: ResourceRegistry,
    private readonly onRetired: () => void,
    private readonly onFrameFailure: (frame: NativeImageFrame, error: unknown) => void,
  ) {
    super();
    this.frameCount = native.frameCount;
    this.repetitionCount = native.repetitionCount;
    invariant(
      Number.isSafeInteger(this.frameCount) &&
        this.frameCount > 0 &&
        this.frameCount <= imageLimits.frames &&
        Number.isSafeInteger(this.repetitionCount) &&
        this.repetitionCount >= -1,
      'invalid-image-codec',
      'Invalid codec frame/repetition count',
    );
    this.drained = new Promise<void>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    void this.drained.catch(() => {});
  }
  getNextFrame(): Promise<FrameInfo> {
    invariant(!this.dead, 'disposed-image-codec', 'Cannot decode with a disposed Codec');
    this.pending++;
    const result = this.tail.then(async () => {
      if (this.dead) throw canceled();
      const frame = await this.native.getNextFrame();
      let registered = false,
        legacy = false,
        image: Image | undefined;
      try {
        if (this.dead) throw canceled();
        invariant(
          frame.descriptor.kind === 'image',
          'invalid-image-frame',
          'Codec returned another resource kind',
        );
        imageTargetSize(frame.width, frame.height);
        invariant(
          Number.isFinite(frame.duration) && frame.duration >= 0,
          'invalid-frame-duration',
          'Codec returned invalid frame duration',
        );
        this.registry.register(frame.descriptor, () => this.retireFrame(frame));
        registered = legacy = true;
        image = Image.fromResource(
          this.registry,
          frame.descriptor,
          frame.width,
          frame.height,
          frame.readBytes ?? null,
        );
        if (this.dead) throw canceled();
        this.registry.releaseProducer(frame.descriptor);
        legacy = false;
        return new FrameInfo(frame.duration, image);
      } catch (error) {
        const errors = [error];
        if (image)
          try {
            image.dispose();
          } catch (cleanup) {
            errors.push(cleanup);
          }
        if (legacy)
          try {
            this.registry.releaseProducer(frame.descriptor);
          } catch (cleanup) {
            errors.push(cleanup);
          }
        else if (!registered)
          try {
            this.retireFrame(frame);
          } catch (cleanup) {
            errors.push(cleanup);
          }
        failures(errors, 'Image frame admission and retirement failed');
        throw error;
      }
    });
    this.tail = result
      .then(
        () => {},
        () => {},
      )
      .then(() => {
        this.pending--;
        this.finish();
      });
    return result;
  }
  private retireFrame(frame: NativeImageFrame): void {
    try {
      frame.retire();
    } catch (error) {
      this.onFrameFailure(frame, error);
      throw error;
    }
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.finish();
  }
  private finish(): void {
    if (!this.dead || this.pending || this.retired) return;
    this.retired = true;
    try {
      this.native.dispose();
      this.resolve();
      this.onRetired();
    } catch (error) {
      this.reject(error);
    }
  }
}
export class ImageService implements Disposable {
  private closed = false;
  private closing: Promise<void> | undefined;
  private codecs = new Set<HostedCodec>();
  private codecDrains = new Set<Promise<void>>();
  private jobs = new Set<Promise<unknown>>();
  private requests = new Set<ImageRequest>();
  private callbacks = new Set<Disposable>();
  private observers = new Set<() => void>();
  private stopErrors: unknown[] = [];
  private failedNative: NativeImageCodec[] = [];
  private failedFrames: NativeImageFrame[] = [];
  constructor(
    readonly resources: ResourceRegistry,
    private readonly backend: ImageBackend,
    private readonly frameClock: FrameClock,
    private readonly time: ImageTiming,
  ) {}
  /** Extend this owner's drain to asynchronous processing of its decoded images. */
  trackImageOperation<T>(operation: Promise<T>): Promise<T> {
    this.assertOpen();
    return this.track(operation);
  }
  get isClosed(): boolean {
    return this.closed;
  }
  get assetManifestBytes(): Uint8Array | null {
    return this.backend.assetManifestBytes ? new Uint8Array(this.backend.assetManifestBytes) : null;
  }
  now(): number {
    return this.time.now();
  }
  private assertOpen(): void {
    invariant(!this.closed, 'closed-image-owner', 'Image owner is closed');
  }
  private track<T>(promise: Promise<T>): Promise<T> {
    this.jobs.add(promise);
    void promise.then(
      () => this.jobs.delete(promise),
      () => this.jobs.delete(promise),
    );
    return promise;
  }
  instantiateImageCodec(bytes: Uint8Array, options: ImageDecodeOptions = {}): Promise<Codec> {
    this.assertOpen();
    invariant(
      bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= imageLimits.encodedBytes,
      'image-byte-budget',
      'Encoded image exceeds the nonempty byte budget',
    );
    invariant(
      this.codecs.size + this.jobs.size < imageLimits.codecs,
      'image-codec-budget',
      'Too many live/pending image decoders',
    );
    const snapshot = Object.freeze({ ...options });
    for (const value of [snapshot.targetWidth, snapshot.targetHeight])
      invariant(
        value == null ||
          (Number.isSafeInteger(value) && value > 0 && value <= imageLimits.dimension),
        'invalid-image-target',
        'Invalid target image size',
      );
    invariant(
      snapshot.allowUpscaling === undefined || typeof snapshot.allowUpscaling === 'boolean',
      'invalid-image-target',
      'allowUpscaling must be a boolean',
    );
    invariant(
      snapshot.getTargetSize == null || typeof snapshot.getTargetSize === 'function',
      'invalid-image-target',
      'getTargetSize must be a function',
    );
    const copy = new Uint8Array(bytes);
    return this.track(
      Promise.resolve()
        .then(() => {
          this.assertOpen();
          return this.backend.instantiateCodec(copy, snapshot);
        })
        .then((native) => {
          try {
            this.assertOpen();
            let codec: HostedCodec;
            codec = new HostedCodec(
              native,
              this.resources,
              () => this.codecs.delete(codec),
              (frame, error) => {
                this.failedFrames.push(frame);
                this.stopErrors.push(error);
                this.stop();
              },
            );
            this.codecs.add(codec);
            this.codecDrains.add(codec.drained);
            void codec.drained.then(
              () => this.codecDrains.delete(codec.drained),
              () => {},
            );
            return codec;
          } catch (error) {
            try {
              native.dispose();
            } catch (cleanup) {
              this.failedNative.push(native);
              this.stopErrors.push(cleanup);
              throw new AggregateError([error, cleanup], 'Codec creation and retirement failed');
            }
            throw error;
          }
        }),
    );
  }
  private load(
    read: (signal: ImageCancellation, onProgress: ImageReadProgressListener) => Promise<Uint8Array>,
  ): ImageReadRequest {
    this.assertOpen();
    invariant(this.requests.size < 8, 'image-fetch-budget', 'Too many image reads');
    const controller = new ImageRequest();
    this.requests.add(controller);
    const promise = this.track(
      Promise.resolve()
        .then(() => {
          this.assertOpen();
          controller.throwIfCanceled();
          return read(controller, (event) => {
            if (!this.closed) controller.reportProgress(event);
          });
        })
        .then((bytes) => {
          this.assertOpen();
          controller.throwIfCanceled();
          invariant(
            bytes instanceof Uint8Array &&
              bytes.length > 0 &&
              bytes.length <= imageLimits.encodedBytes,
            'image-byte-budget',
            'Image source exceeds byte budget',
          );
          return new Uint8Array(bytes);
        })
        .finally(() => {
          this.requests.delete(controller);
          controller.finish();
        }),
    );
    return {
      promise,
      cancel: () => controller.abort(),
      addProgressListener: (listener) => controller.addProgressListener(listener),
    };
  }
  loadAssetRequest(key: string): ImageReadRequest {
    invariant(
      typeof key === 'string' && key.length > 0,
      'invalid-image-asset',
      'Image asset key is required',
    );
    return this.load((signal, progress) => this.backend.loadAsset(key, signal, progress));
  }
  loadAsset(key: string): Promise<Uint8Array> {
    return this.loadAssetRequest(key).promise;
  }
  loadNetworkRequest(
    url: string,
    headers: Readonly<Record<string, string>> = {},
  ): ImageReadRequest {
    invariant(
      typeof url === 'string' && url.length > 0,
      'invalid-image-url',
      'Image URL is required',
    );
    const snapshot = Object.freeze({ ...headers });
    return this.load((signal, progress) =>
      this.backend.loadNetwork(url, snapshot, signal, progress),
    );
  }
  loadNetwork(url: string, headers: Readonly<Record<string, string>> = {}): Promise<Uint8Array> {
    return this.loadNetworkRequest(url, headers).promise;
  }
  loadFileRequest(uri: string): ImageReadRequest {
    this.assertOpen();
    const file = fileImageUri(uri);
    const read = this.backend.loadFile;
    invariant(read, 'unsupported-image-file', 'This image backend does not support local file IO');
    return this.load((signal, progress) => read.call(this.backend, file, signal, progress));
  }
  loadFile(uri: string): Promise<Uint8Array> {
    return this.loadFileRequest(uri).promise;
  }
  addCloseListener(callback: () => void): Disposable {
    this.assertOpen();
    this.observers.add(callback);
    return {
      dispose: () => {
        this.observers.delete(callback);
      },
    };
  }
  scheduleFrame(callback: () => void): Disposable {
    this.assertOpen();
    let active = true,
      request: Disposable;
    const owned = {
      dispose: () => {
        if (!active) return;
        active = false;
        this.callbacks.delete(owned);
        request?.dispose();
      },
    };
    this.callbacks.add(owned);
    try {
      request = this.frameClock.request(() => {
        if (!active) return;
        active = false;
        this.callbacks.delete(owned);
        if (!this.closed) callback();
      });
      if (!active) request.dispose();
    } catch (error) {
      owned.dispose();
      throw error;
    }
    return owned;
  }
  scheduleTimer(callback: () => void, milliseconds: number): Disposable {
    this.assertOpen();
    invariant(
      Number.isFinite(milliseconds) && milliseconds >= 0,
      'invalid-image-timer',
      'Invalid image delay',
    );
    let active = true,
      timer: Disposable | undefined;
    const owned = {
      dispose: () => {
        if (!active) return;
        active = false;
        timer?.dispose();
        this.callbacks.delete(owned);
      },
    };
    this.callbacks.add(owned);
    try {
      timer = this.time.scheduleTimer(() => {
        if (!active) return;
        active = false;
        this.callbacks.delete(owned);
        if (!this.closed) callback();
      }, milliseconds);
      if (!active) timer.dispose();
    } catch (error) {
      owned.dispose();
      throw error;
    }
    return owned;
  }
  stop(): void {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.requests)
      try {
        request.abort();
      } catch (error) {
        this.stopErrors.push(error);
      }
    const snapshot2 = [...this.callbacks];
    for (const callback of snapshot2)
      try {
        callback.dispose();
      } catch (error) {
        this.stopErrors.push(error);
      }
    const snapshot3 = [...this.observers];
    for (const observer of snapshot3)
      try {
        observer();
      } catch (error) {
        this.stopErrors.push(error);
      }
    this.observers.clear();
    const snapshot4 = [...this.codecs];
    for (const codec of snapshot4) codec.dispose();
  }
  /* oxlint-disable unicorn/no-useless-spread -- Snapshot pending work before Promise assimilation can trigger reentrant collection mutations. */
  dispose(): Promise<void> {
    if (this.closing) return this.closing;
    let resolve!: () => void, reject!: (error: unknown) => void;
    this.closing = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    this.stop();
    void (async () => {
      await Promise.allSettled([...this.jobs]);
      const results = await Promise.allSettled([...this.codecDrains]),
        errors = [...this.stopErrors];
      for (const result of results) if (result.status === 'rejected') errors.push(result.reason);
      failures(errors, 'Image codec shutdown failed; backend retained');
      await this.backend.dispose?.();
    })().then(resolve, reject);
    return this.closing;
  }
  /* oxlint-enable unicorn/no-useless-spread */
}
