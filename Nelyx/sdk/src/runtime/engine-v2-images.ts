// SPDX-License-Identifier: BSD-3-Clause
import {
  appImageLimits,
  imageDimensions,
  ImageResource,
  protocol as p,
  rasterImageHeader,
} from '@nelyx/core/v2';
import type {
  AppImageBackend,
  AppImageDescriptor,
  AppImageRaw,
  AppTextBackend,
} from '@nelyx/core/v2';
import type {
  ImageDescriptorLoader,
  ImageDescriptorValue,
} from '@nelyx/core/internal/ui/image-descriptor-binding';
import { bindImageServiceDecoder } from '@nelyx/core/internal/ui/image-descriptor-binding';
import { retainImmutableBuffer } from '@nelyx/core/internal/ui/immutable-buffer-binding';
import type { ImageDescriptorRawOptions } from '@nelyx/core/ui/image-descriptor';
import type { ImmutableBuffer } from '@nelyx/core/ui/immutable-buffer';
import type { ImmutableBufferLease } from '@nelyx/core/internal/ui/immutable-buffer-binding';
import type { Codec } from '@nelyx/core/ui/codec';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { ResourceDescriptor } from '@nelyx/core/ui/types';
import { ImageService, adoptImageCodec, imageTargetSize } from '@nelyx/core/hosting/images';
import type {
  NativeImageCodec,
  NativeImageFrame,
  ImageDecodeOptions,
} from '@nelyx/core/hosting/images';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { Image } from '@nelyx/core/ui/image';
import { resourceKey } from '@nelyx/core/ui/resource-retention';
import type {
  OriginalImageSource,
  OriginalImageSceneLease,
  OriginalImageClock,
} from '@nelyx/core/v2/original';
import type { EngineV2Buffers } from './engine-v2-buffers.ts';
import type { EngineV2Assets, AssetCancellation } from './engine-v2-assets.ts';
import type { ImageCancellation, ImageReadProgressListener } from '@nelyx/core/hosting/images';
import { imageLimits } from '@nelyx/core/hosting/images';

/** Canonical descriptors/codecs reuse ImageService's frame, clone, read and
 * asynchronous retirement rules. Scene/image-provider integration is separate. */
export class EngineV2Images implements ImageDescriptorLoader, OriginalImageSource {
  private closed = false;
  private readonly descriptors = new Map<number, AppImageBackend>();
  private owner: AppTextBackend | undefined;
  private creates = 0;
  private codecs = 0;
  private decodes = 0;
  private reads = 0;
  private readBytes = 0;
  private readonly frames = new Map<
    string,
    { backend: AppImageBackend; handle: number; width: number; height: number }
  >();
  private readonly scenes = new Map<
    string,
    {
      resource: ImageResource;
      backend: AppImageBackend;
      credit: number;
      size: number;
      holds: number;
    }
  >();
  private readonly failedSceneCredits = new Map<number, AppImageBackend>();
  private sceneAdmissions = 0;
  private sceneCaptures = 0;
  readonly service: ImageService;
  private readonly decoderBinding: Disposable;
  private clock: OriginalImageClock | undefined;
  readonly resources = new ResourceRegistry();
  constructor(
    private readonly buffers: EngineV2Buffers,
    private readonly assets: EngineV2Assets,
  ) {
    const unsupported = (): never => {
      throw Error('This App image service requires the canonical immutable buffer/descriptor API');
    };
    this.service = new ImageService(
      this.resources,
      {
        instantiateCodec: unsupported,
        loadAsset: (key, signal, progress) =>
          this.assets.load(key, this.cancellation(signal), progress, imageLimits.encodedBytes),
        loadNetwork: (url, headers, signal, progress) =>
          this.assets.loadNetwork(
            url,
            '',
            headers,
            this.cancellation(signal),
            progress,
            imageLimits.encodedBytes,
          ),
        loadFile: (uri, signal, progress) => this.readFile(uri, signal, progress),
      },
      {
        request: (callback) => this.frameClock().requestFrame(() => callback()),
      },
      {
        now: () => this.frameClock().now(),
        scheduleTimer: (callback, milliseconds) =>
          this.frameClock().scheduleTimer(callback, milliseconds),
      },
    );
    this.decoderBinding = bindImageServiceDecoder(this.service, (bytes, options) =>
      this.decodeCaptured(bytes, options),
    );
  }
  private frameClock(): OriginalImageClock {
    if (!this.clock) throw Error('App image stream has no live Core View frame clock');
    return this.clock;
  }
  private cancellation(signal: ImageCancellation): AssetCancellation {
    return {
      check: () => {
        this.check();
        signal.throwIfCanceled();
      },
      listen: (callback) => {
        const lease = signal.addListener(callback);
        return () => lease.dispose();
      },
    };
  }
  private async readFile(
    uri: string,
    signal: ImageCancellation,
    progress?: ImageReadProgressListener,
  ): Promise<Uint8Array> {
    this.check();
    signal.throwIfCanceled();
    const path = decodeURIComponent(uri.slice(8)),
      buffer = await this.buffers.loadFile(/^[A-Za-z]:/.test(path) ? path : '/' + path),
      errors: unknown[] = [];
    let lease: ImmutableBufferLease | undefined,
      credit: number | undefined,
      backend: AppTextBackend | undefined,
      result: Uint8Array | undefined;
    try {
      this.check();
      signal.throwIfCanceled();
      if (buffer.length <= 0 || buffer.length > imageLimits.encodedBytes)
        throw Error('Image file byte budget exceeded');
      lease = buffer.retain();
      backend = this.buffers.imageSource(lease).backend;
      credit = backend.reserveAssetBytes(buffer.length);
      progress?.({ cumulativeBytesLoaded: 0, expectedTotalBytes: buffer.length });
      this.check();
      signal.throwIfCanceled();
      result = new Uint8Array(buffer.length);
      for (let offset = 0; offset < result.length; offset += appImageLimits.chunkBytes) {
        this.check();
        signal.throwIfCanceled();
        const size = Math.min(appImageLimits.chunkBytes, result.length - offset);
        result.set(lease.read(offset, size), offset);
        progress?.({ cumulativeBytesLoaded: offset + size, expectedTotalBytes: result.length });
      }
      this.check();
      signal.throwIfCanceled();
    } catch (error) {
      errors.push(error);
    }
    for (const release of [() => lease?.dispose(), () => buffer.dispose()])
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    if (credit !== undefined)
      try {
        backend!.finishAssetLoad(credit, !errors.length, result?.length);
      } catch (error) {
        errors.push(error);
        this.cancel();
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Image file read/retirement failed');
    return result!;
  }
  bindClock(clock: OriginalImageClock): Disposable {
    this.check();
    if (this.clock) throw Error('App image stream already owns a View frame clock');
    this.clock = clock;
    return {
      dispose: () => {
        if (this.clock !== clock) return;
        this.service.stop();
        this.clock = undefined;
      },
    };
  }
  get execution() {
    return Object.freeze({
      descriptorCreates: this.creates,
      codecCreates: this.codecs,
      frameDecodes: this.decodes,
      pixelReads: this.reads,
      pixelReadBytes: this.readBytes,
      sceneAdmissions: this.sceneAdmissions,
      sceneCaptures: this.sceneCaptures,
      sceneSnapshots: this.scenes.size,
      sceneSnapshotBytes: [...this.scenes.values()].reduce((sum, value) => sum + value.size, 0),
      sceneLeases: [...this.scenes.values()].reduce((sum, value) => sum + value.holds, 0),
      failedSceneCredits: this.failedSceneCredits.size,
      clock: this.clock?.execution ?? null,
      tsFallbacks: 0,
      backend: this.owner?.images?.snapshot() ?? null,
      closed: this.closed,
    });
  }
  private check(): void {
    if (this.closed) throw Error('App image owner is closing');
  }
  private create(buffer: ImmutableBuffer, raw?: ImageDescriptorRawOptions): ImageDescriptorValue {
    this.check();
    let spec;
    if (raw) {
      imageDimensions(raw.width, raw.height);
      if (raw.pixelFormat !== 'rgba8888' && raw.pixelFormat !== 'bgra8888')
        throw Error('App raw floating-point image decoding is not connected');
      spec = {
        width: raw.width,
        height: raw.height,
        rowBytes: raw.rowBytes ?? raw.width * 4,
        pixelFormat: raw.pixelFormat,
      };
    }
    return this.createDescriptor(retainImmutableBuffer(buffer), spec);
  }
  private createDescriptor(lease: ImmutableBufferLease, spec?: AppImageRaw): ImageDescriptorValue {
    let value: AppImageDescriptor, backend: AppImageBackend;
    try {
      const source = this.buffers.imageSource(lease);
      if (!source.backend.images)
        throw Error('Required App image descriptor service version 2 is unavailable');
      backend = source.backend.images;
      value = backend.createDescriptor(source.handle, spec);
      this.owner = source.backend;
    } finally {
      lease.dispose();
    }
    try {
      imageDimensions(value.width, value.height);
      if (
        !Number.isSafeInteger(value.handle) ||
        value.handle <= 0 ||
        this.descriptors.has(value.handle) ||
        !Number.isSafeInteger(value.bytesPerPixel) ||
        value.bytesPerPixel < 1 ||
        value.bytesPerPixel > 16
      )
        throw Error('Invalid App image descriptor result');
    } catch (error) {
      backend.releaseDescriptor(value.handle);
      throw error;
    }
    this.descriptors.set(value.handle, backend);
    ++this.creates;
    let live = true;
    return {
      width: value.width,
      height: value.height,
      bytesPerPixel: value.bytesPerPixel,
      instantiateCodec: (options) => {
        try {
          this.check();
          if (!live || this.descriptors.get(value.handle) !== backend)
            throw Error('ImageDescriptor is foreign/retired');
          if (options.targetFormat !== undefined && options.targetFormat !== 'dontCare')
            throw Error('App floating-point target image format is not connected');
          const normalized = (size: number | null | undefined) => {
            if (size == null) return null;
            if (!Number.isSafeInteger(size)) throw Error('Invalid target image dimension');
            return size <= 0 ? null : size;
          };
          const size = imageTargetSize(value.width, value.height, {
            targetWidth: normalized(options.targetWidth),
            targetHeight: normalized(options.targetHeight),
          });
          const result = backend.instantiateCodec(value.handle, size.width, size.height);
          ++this.codecs;
          return Promise.resolve(adoptImageCodec(this.service, this.codec(backend, result)));
        } catch (error) {
          return Promise.reject(error);
        }
      },
      dispose: () => {
        if (!live) throw Error('ImageDescriptor is already retired');
        backend.releaseDescriptor(value.handle);
        this.descriptors.delete(value.handle);
        live = false;
      },
    };
  }
  encoded(buffer: ImmutableBuffer): Promise<ImageDescriptorValue> {
    try {
      return Promise.resolve(this.create(buffer));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  raw(buffer: ImmutableBuffer, options: ImageDescriptorRawOptions): ImageDescriptorValue {
    return this.create(buffer, options);
  }
  private async decodeCaptured(bytes: Uint8Array, options: ImageDecodeOptions): Promise<Codec> {
    this.check();
    // This executes synchronously before the returned Promise can yield.
    const buffer = this.buffers.create(bytes),
      errors: unknown[] = [];
    let descriptor: ImageDescriptorValue | undefined, codec: Codec | undefined;
    try {
      descriptor = this.createDescriptor(buffer.retain());
      const target = imageTargetSize(descriptor.width, descriptor.height, options);
      this.check();
      codec = await descriptor.instantiateCodec({
        targetWidth: target.width,
        targetHeight: target.height,
      });
      this.check();
    } catch (error) {
      errors.push(error);
    }
    for (const release of [() => descriptor?.dispose(), () => buffer.dispose()])
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) {
      try {
        codec?.dispose();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length === 1) throw errors[0];
      this.cancel();
      throw new AggregateError(errors, 'Image provider decode/retirement failed');
    }
    return codec!;
  }
  private codec(
    backend: AppImageBackend,
    value: { handle: number; frameCount: number; repetitionCount: number },
  ): NativeImageCodec {
    return {
      frameCount: value.frameCount,
      repetitionCount: value.repetitionCount,
      getNextFrame: (): NativeImageFrame => {
        this.check();
        const frame = backend.nextFrame(value.handle);
        ++this.decodes;
        let descriptor: ResourceDescriptor;
        try {
          descriptor = {
            ...this.resources.allocateId('engine-v2-App-image'),
            kind: 'image' as const,
          };
          this.frames.set(resourceKey(descriptor), {
            backend,
            handle: frame.handle,
            width: frame.width,
            height: frame.height,
          });
        } catch (error) {
          backend.releaseFrame(frame.handle);
          throw error;
        }
        return {
          descriptor,
          width: frame.width,
          height: frame.height,
          duration: frame.duration,
          readBytes: async (format) => {
            this.check();
            if (format !== 'rawRgba' && format !== 'rawUnmodified')
              throw Error(
                'App image readback currently requires premultiplied rawRgba/rawUnmodified',
              );
            const length = frame.width * frame.height * 4,
              credit = backend.reserveReadback(length);
            let delivered = false;
            try {
              const bytes = new Uint8Array(length);
              for (let offset = 0; offset < length; offset += appImageLimits.chunkBytes) {
                const size = Math.min(appImageLimits.chunkBytes, length - offset),
                  chunk = backend.frameChunk(frame.handle, offset, size);
                if (!(chunk instanceof Uint8Array) || chunk.length !== size)
                  throw Error('App image pixel chunk differs');
                bytes.set(chunk, offset);
                ++this.reads;
                this.readBytes += size;
              }
              this.check();
              backend.finishReadback(credit, true);
              delivered = true;
              return bytes;
            } finally {
              if (!delivered) backend.finishReadback(credit, false);
            }
          },
          retire: () => {
            backend.releaseFrame(frame.handle);
            this.frames.delete(resourceKey(descriptor));
          },
        };
      },
      dispose: () => backend.releaseCodec(value.handle),
    };
  }
  cancel(): void {
    if (this.closed) return;
    this.closed = true;
    this.service.stop();
  }
  capture(image: Image): OriginalImageSceneLease {
    this.check();
    if (!(image instanceof Image)) throw Error('Foreign canonical Image');
    const identifier = this.resources.captureResource(image.resource),
      key = resourceKey(identifier),
      source = this.frames.get(key);
    if (!source || source.width !== image.width || source.height !== image.height)
      throw Error('Foreign/retired App image frame or dimensions');
    let snapshot = this.scenes.get(key);
    if (!snapshot) {
      const header = rasterImageHeader(source.width, source.height),
        size = header.length + source.width * source.height * 4;
      if (size > p.limits.resourceBytes)
        throw Error('Image scene resource exceeds the Core byte budget');
      const hold = this.resources.acquire([identifier]),
        errors: unknown[] = [];
      let credit: number | undefined, resource: ImageResource | undefined;
      try {
        credit = source.backend.reserveScene(size);
        ++this.sceneAdmissions;
        const bytes = new Uint8Array(size);
        bytes.set(header);
        for (let offset = header.length; offset < size; offset += appImageLimits.chunkBytes) {
          const length = Math.min(appImageLimits.chunkBytes, size - offset),
            chunk = source.backend.frameChunk(source.handle, offset - header.length, length);
          if (!(chunk instanceof Uint8Array) || chunk.length !== length)
            throw Error('App image scene pixel chunk differs');
          bytes.set(chunk, offset);
          ++this.reads;
          this.readBytes += length;
        }
        this.check();
        resource = new ImageResource(bytes);
        this.check();
      } catch (error) {
        errors.push(error);
      }
      try {
        hold.returnBy('caller');
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) {
        if (credit !== undefined)
          try {
            source.backend.releaseScene(credit);
          } catch (error) {
            this.failedSceneCredits.set(credit, source.backend);
            errors.push(error);
          }
        if (errors.length === 1) throw errors[0];
        throw new AggregateError(errors, 'Image scene capture and retirement failed');
      }
      snapshot = { resource: resource!, backend: source.backend, credit: credit!, size, holds: 0 };
      this.scenes.set(key, snapshot);
      ++this.sceneCaptures;
    }
    ++snapshot.holds;
    let held = true;
    return {
      key,
      resource: snapshot.resource,
      release: () => {
        if (!held) throw Error('Image scene lease is already retired');
        held = false;
        if (--snapshot.holds) return;
        try {
          snapshot.backend.releaseScene(snapshot.credit);
          this.scenes.delete(key);
        } catch (error) {
          this.failedSceneCredits.set(snapshot.credit, snapshot.backend);
          this.cancel();
          throw error;
        }
      },
    };
  }
  async close(): Promise<void> {
    this.cancel();
    await this.service.dispose();
    this.decoderBinding.dispose();
    this.resources.dispose();
    if (this.scenes.size || this.failedSceneCredits.size)
      throw Error('App image scene snapshots have surviving or uncertain holders');
    if (this.frames.size) throw Error('App image frames have surviving or uncertain holders');
    if (this.descriptors.size)
      throw Error('App image descriptors remain live until holders retire');
    const state = this.owner?.images?.snapshot();
    if (
      state &&
      (state.descriptors ||
        state.codecs ||
        state.frames ||
        state.reservedBytes !== state.readbackBytes)
    )
      throw Error('App image resources/readers have not drained');
  }
}
