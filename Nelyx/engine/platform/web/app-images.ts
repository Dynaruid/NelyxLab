// SPDX-License-Identifier: BSD-3-Clause
import type { AnimatedImage, Image as SkImage } from 'canvaskit-wasm';
import {
  appImageLimits as limits,
  imageDimensions,
} from '../../../runtime/engine-client/app-images.ts';
import type {
  AppImageBackend,
  AppImageRaw,
  AppImageSnapshot,
} from '../../../runtime/engine-client/app-images.ts';
import type { CanvasKitProvider, AppImmutableData } from '../../render/canvaskit-web/provider.ts';
interface Source {
  readonly allocation: AppImmutableData;
  dispose(): void;
}
type Descriptor = {
  source: Source;
  raw?: AppImageRaw | undefined;
  bytes?: Uint8Array | undefined;
  width: number;
  height: number;
  holds: number;
  release(): void;
};
type Codec = {
  descriptor: Descriptor;
  animated: AnimatedImage | null;
  still: SkImage | null;
  width: number;
  height: number;
  frameCount: number;
  repetitionCount: number;
  index: number;
  failed: boolean;
  release(): void;
};
type Frame = {
  image: SkImage;
  width: number;
  height: number;
  duration: number;
  holds: number;
  release(): void;
};
/** Uses the already admitted App CanvasKit heap. Browser image/canvas decoders
 * and secondary CanvasKit instances are never selected. */
export class WebAppImages implements AppImageBackend {
  private readonly descriptors = new Map<number, Descriptor>();
  private readonly codecs = new Map<number, Codec>();
  private readonly frames = new Map<number, Frame>();
  private readonly frameAllocations = new Set<Frame>();
  private resident = 0;
  private readonly scenes = new Map<number, { size: number; bytes: number; release(): void }>();
  private sceneSnapshotCreates = 0;
  private readonly readbacks = new Map<
    number,
    { size: number; bytes: number; delivered: boolean; release(): void }
  >();
  private descriptorAllocations = 0;
  private counts = {
    descriptorCreates: 0,
    codecCreates: 0,
    frameDecodes: 0,
    pixelReads: 0,
    pixelReadBytes: 0,
    encodedCopies: 0,
    encodedCopyBytes: 0,
  };
  constructor(
    private readonly provider: CanvasKitProvider,
    private readonly hold: (id: number) => Source,
    private readonly reserveBytes: (bytes: number) => () => void,
    private readonly sequence: () => number,
    private readonly ensureOpen: () => void,
  ) {}
  private reserve(bytes: number): () => void {
    if (this.resident + bytes > limits.residentBytes)
      throw Error('App image resident memory budget exceeded');
    const release = this.reserveBytes(bytes);
    this.resident += bytes;
    let held = true;
    return () => {
      if (!held) return;
      release();
      this.resident -= bytes;
      held = false;
    };
  }
  private find<T>(values: Map<number, T>, id: number): T {
    this.ensureOpen();
    const value = values.get(id);
    if (!value) throw Error('App image handle is foreign/retired/wrong kind');
    return value;
  }
  private drop(value: Descriptor): void {
    if (value.holds === 1) {
      value.source.dispose();
      value.release();
      --this.descriptorAllocations;
    }
    --value.holds;
  }
  snapshot(): AppImageSnapshot {
    return {
      version: 2,
      descriptors: this.descriptors.size,
      codecs: this.codecs.size,
      frames: this.frames.size,
      reservedBytes:
        this.resident + [...this.scenes.values()].reduce((sum, value) => sum + value.bytes, 0),
      sceneBuffers: this.scenes.size,
      sceneDataBytes: [...this.scenes.values()].reduce((sum, value) => sum + value.size, 0),
      sceneCreditBytes: [...this.scenes.values()].reduce((sum, value) => sum + value.bytes, 0),
      sceneSnapshotCreates: this.sceneSnapshotCreates,
      ...this.counts,
      readbacks: this.readbacks.size,
      readbackBytes: [...this.readbacks.values()].reduce((sum, value) => sum + value.bytes, 0),
    };
  }
  reserveReadback(size: number): number {
    this.ensureOpen();
    const total = [...this.readbacks.values()].reduce((sum, value) => sum + value.size, 0);
    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > 32 * 1024 * 1024 ||
      total + size > 32 * 1024 * 1024 ||
      this.readbacks.size >= 64
    )
      throw Error('App image readback count/byte budget exceeded');
    const bytes = 3 * size + 65536,
      release = this.reserve(bytes);
    try {
      const id = this.sequence();
      this.readbacks.set(id, { size, bytes, delivered: false, release });
      return id;
    } catch (error) {
      release();
      throw error;
    }
  }
  reserveScene(size: number): number {
    this.ensureOpen();
    if (
      !Number.isSafeInteger(size) ||
      size < 32 ||
      size > 32 * 1024 * 1024 ||
      this.scenes.size >= 64 ||
      [...this.scenes.values()].reduce((sum, value) => sum + value.size, 0) >
        32 * 1024 * 1024 - size
    )
      throw Error('App image scene count/byte budget exceeded');
    const bytes = 3 * size + 2 * limits.chunkBytes + 65536,
      release = this.reserveBytes(bytes);
    try {
      const token = this.sequence();
      this.scenes.set(token, { size, bytes, release });
      ++this.sceneSnapshotCreates;
      return token;
    } catch (error) {
      release();
      throw error;
    }
  }
  releaseScene(handle: number): void {
    const value = this.find(this.scenes, handle);
    value.release();
    this.scenes.delete(handle);
  }
  finishReadback(handle: number, delivered: boolean): void {
    const value = this.find(this.readbacks, handle);
    if (value.delivered || typeof delivered !== 'boolean')
      throw Error('App image readback is foreign/delivered');
    if (delivered) value.delivered = true;
    else {
      value.release();
      this.readbacks.delete(handle);
    }
  }
  assertDrained(): void {
    if (
      this.descriptors.size ||
      this.codecs.size ||
      this.frameAllocations.size ||
      this.scenes.size ||
      [...this.readbacks.values()].some((value) => !value.delivered) ||
      this.resident !== this.snapshot().readbackBytes
    )
      throw Error('App image descriptors/codecs/frames/readers are still live');
  }
  createDescriptor(buffer: number, raw?: AppImageRaw) {
    this.ensureOpen();
    if (this.descriptorAllocations >= limits.descriptors)
      throw Error('App image descriptor count budget exceeded');
    const source = this.hold(buffer);
    let release: (() => void) | undefined;
    try {
      const size = source.allocation.length;
      if (!size || (!raw && size > limits.encodedBytes))
        throw Error('App image encoded byte budget exceeded');
      if (raw) {
        imageDimensions(raw.width, raw.height);
        if (
          !['rgba8888', 'bgra8888'].includes(raw.pixelFormat) ||
          !Number.isSafeInteger(raw.rowBytes) ||
          raw.rowBytes < raw.width * 4 ||
          raw.rowBytes > 32 * 1024 * 1024 ||
          (raw.height - 1) * raw.rowBytes + raw.width * 4 > size
        )
          throw Error('App raw image row/buffer bounds differ');
      }
      release = this.reserve(512 * 1024 + (raw ? 0 : 2 * size));
      let width: number, height: number, bytes: Uint8Array | undefined;
      if (raw) {
        width = raw.width;
        height = raw.height;
      } else {
        // MakeImageFromEncoded is Skia's deferred decoder: inspect dimensions
        // before admitting any animated/decoded pixel storage.
        bytes = source.allocation.copyForImage();
        ++this.counts.encodedCopies;
        this.counts.encodedCopyBytes += bytes.length;
        const image = this.provider.ck.MakeImageFromEncoded(bytes);
        if (!image) throw Error('App encoded image descriptor is invalid/unsupported');
        try {
          width = image.width();
          height = image.height();
          imageDimensions(width, height);
        } finally {
          image.delete();
          this.provider.syncAppImageMemory();
        }
      }
      const id = this.sequence();
      this.descriptors.set(id, {
        source,
        raw: raw ? { ...raw } : undefined,
        bytes,
        width,
        height,
        holds: 1,
        release,
      });
      ++this.descriptorAllocations;
      ++this.counts.descriptorCreates;
      return { handle: id, width, height, bytesPerPixel: 4 };
    } catch (error) {
      source.dispose();
      release?.();
      throw error;
    }
  }
  instantiateCodec(descriptor: number, width: number, height: number) {
    const value = this.find(this.descriptors, descriptor);
    imageDimensions(width, height);
    if (this.codecs.size >= limits.codecs) throw Error('App image codec count budget exceeded');
    const release = this.reserve(value.width * value.height * 12 + width * height * 4 + 65536);
    let animated: AnimatedImage | null = null,
      still: SkImage | null = null;
    try {
      if (value.bytes) {
        animated = this.provider.ck.MakeAnimatedImageFromEncoded(value.bytes);
        if (!animated) still = this.provider.ck.MakeImageFromEncoded(value.bytes);
        if (!animated && !still) throw Error('App image codec creation failed');
      }
      const frameCount = animated?.getFrameCount() ?? 1;
      if (!Number.isSafeInteger(frameCount) || frameCount < 1 || frameCount > limits.frameCount)
        throw Error('App image frame count budget exceeded');
      const repetitionCount = frameCount === 1 ? 0 : animated!.getRepetitionCount();
      if (!Number.isSafeInteger(repetitionCount) || repetitionCount < -1)
        throw Error('Invalid App image repetition count');
      const id = this.sequence();
      this.provider.syncAppImageMemory();
      this.codecs.set(id, {
        descriptor: value,
        animated,
        still,
        width,
        height,
        frameCount,
        repetitionCount,
        index: 0,
        failed: false,
        release,
      });
      ++value.holds;
      ++this.counts.codecCreates;
      return { handle: id, frameCount, repetitionCount };
    } catch (error) {
      animated?.delete();
      still?.delete();
      release();
      this.provider.syncAppImageMemory();
      throw error;
    }
  }
  nextFrame(codec: number) {
    const value = this.find(this.codecs, codec),
      ck = this.provider.ck;
    if (value.failed) throw Error('App image codec failed; dispose before decoding again');
    if (this.frameAllocations.size >= limits.frames)
      throw Error('App image frame count budget exceeded');
    const release = this.reserve(value.width * value.height * 4 + 65536);
    let raw: SkImage | null = null,
      surface: ReturnType<typeof ck.MakeSurface> = null,
      output: SkImage | null = null;
    try {
      if (value.animated && value.index > 0) {
        if (value.index % value.frameCount === 0) value.animated.reset();
        else if (value.animated.decodeNextFrame() === -1)
          throw Error('App image frame decode failed/incomplete');
      }
      if (value.animated) raw = value.animated.makeImageAtCurrentFrame();
      else if (value.still) raw = value.still;
      else {
        const descriptor = value.descriptor,
          spec = descriptor.raw!;
        // Private raw copy is admitted by codec working credit. The public
        // immutable allocation remains retained independently through the codec.
        const pixels = new Uint8Array(spec.width * spec.height * 4);
        for (let row = 0; row < spec.height; ++row)
          pixels.set(
            descriptor.source.allocation.copyForImage(row * spec.rowBytes, spec.width * 4),
            row * spec.width * 4,
          );
        raw = ck.MakeImage(
          {
            width: spec.width,
            height: spec.height,
            colorType:
              spec.pixelFormat === 'rgba8888' ? ck.ColorType.RGBA_8888 : ck.ColorType.BGRA_8888,
            alphaType: ck.AlphaType.Premul,
            colorSpace: ck.ColorSpace.SRGB,
          },
          pixels,
          spec.width * 4,
        );
      }
      if (!raw) throw Error('App image frame decode failed');
      surface = ck.MakeSurface(value.width, value.height);
      if (!surface) throw Error('App image resize allocation failed');
      surface.getCanvas().clear(ck.TRANSPARENT);
      surface
        .getCanvas()
        .drawImageRectOptions(
          raw,
          ck.XYWHRect(0, 0, raw.width(), raw.height()),
          ck.XYWHRect(0, 0, value.width, value.height),
          ck.FilterMode.Linear,
          ck.MipmapMode.None,
        );
      output = surface.makeImageSnapshot();
      const id = this.sequence(),
        duration = value.frameCount === 1 ? 0 : value.animated!.currentFrameDuration();
      this.provider.syncAppImageMemory();
      const frame = {
        image: output,
        width: value.width,
        height: value.height,
        duration,
        release,
        holds: 1,
      };
      this.frames.set(id, frame);
      this.frameAllocations.add(frame);
      output = null;
      ++value.index;
      ++this.counts.frameDecodes;
      return { handle: id, width: value.width, height: value.height, duration };
    } catch (error) {
      value.failed = true;
      output?.delete();
      release();
      throw error;
    } finally {
      if (raw && raw !== value.still) raw.delete();
      surface?.delete();
      this.provider.syncAppImageMemory();
    }
  }
  frameChunk(frame: number, offset: number, length: number): Uint8Array {
    const value = this.find(this.frames, frame),
      ck = this.provider.ck;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 0 ||
      length > limits.chunkBytes ||
      offset > value.width * value.height * 4 - length ||
      offset % 4 ||
      length % 4
    )
      throw Error('App image chunk is outside a live frame');
    ++value.holds;
    try {
      const output = new Uint8Array(length);
      let cursor = offset / 4,
        at = 0;
      while (at < length) {
        const x = cursor % value.width,
          y = Math.floor(cursor / value.width),
          width = Math.min(value.width - x, (length - at) / 4);
        const pixels = value.image.readPixels(x, y, {
          width,
          height: 1,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        });
        if (!(pixels instanceof Uint8Array) && !(pixels instanceof Uint8ClampedArray))
          throw Error('App image pixel read failed');
        output.set(pixels, at);
        cursor += width;
        at += width * 4;
      }
      ++this.counts.pixelReads;
      this.counts.pixelReadBytes += length;
      this.provider.syncAppImageMemory();
      return output;
    } finally {
      this.dropFrame(value);
    }
  }
  releaseDescriptor(handle: number): void {
    const value = this.find(this.descriptors, handle);
    this.drop(value);
    this.descriptors.delete(handle);
  }
  releaseCodec(handle: number): void {
    const value = this.find(this.codecs, handle);
    value.animated?.delete();
    value.still?.delete();
    this.drop(value.descriptor);
    value.release();
    this.codecs.delete(handle);
    this.provider.syncAppImageMemory();
  }
  releaseFrame(handle: number): void {
    const value = this.find(this.frames, handle);
    this.dropFrame(value);
    this.frames.delete(handle);
  }
  private dropFrame(value: Frame): void {
    if (value.holds === 1) {
      value.image.delete();
      value.release();
      this.frameAllocations.delete(value);
      this.provider.syncAppImageMemory();
    }
    --value.holds;
  }
}
