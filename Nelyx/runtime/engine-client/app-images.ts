// SPDX-License-Identifier: BSD-3-Clause
/** Private App-local image service. Numeric handles never cross actor boundaries. */
export const appImageServiceVersion = 2;
export const appImageLimits = Object.freeze({
  dimension: 8192,
  pixels: 16 * 1024 * 1024,
  encodedBytes: 16 * 1024 * 1024,
  descriptors: 32,
  codecs: 32,
  frames: 64,
  frameCount: 4096,
  residentBytes: 64 * 1024 * 1024,
  chunkBytes: 256 * 1024,
});
export interface AppImageRaw {
  readonly width: number;
  readonly height: number;
  readonly rowBytes: number;
  readonly pixelFormat: 'rgba8888' | 'bgra8888';
}
export interface AppImageDescriptor {
  readonly handle: number;
  readonly width: number;
  readonly height: number;
  readonly bytesPerPixel: number;
}
export interface AppImageCodec {
  readonly handle: number;
  readonly frameCount: number;
  readonly repetitionCount: number;
}
export interface AppImageFrame {
  readonly handle: number;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
}
export interface AppImageSnapshot {
  readonly version: 2;
  readonly descriptors: number;
  readonly codecs: number;
  readonly frames: number;
  readonly reservedBytes: number;
  readonly descriptorCreates: number;
  readonly codecCreates: number;
  readonly frameDecodes: number;
  readonly pixelReads: number;
  readonly pixelReadBytes: number;
  readonly encodedCopies: number;
  readonly encodedCopyBytes: number;
  readonly readbacks: number;
  readonly readbackBytes: number;
  readonly sceneBuffers: number;
  readonly sceneDataBytes: number;
  readonly sceneCreditBytes: number;
  readonly sceneSnapshotCreates: number;
}
export interface AppImageBackend {
  reserveScene(size: number): number;
  releaseScene(handle: number): void;
  reserveReadback(size: number): number;
  finishReadback(handle: number, delivered: boolean): void;
  createDescriptor(buffer: number, raw?: AppImageRaw): AppImageDescriptor;
  instantiateCodec(descriptor: number, width: number, height: number): AppImageCodec;
  nextFrame(codec: number): AppImageFrame;
  frameChunk(frame: number, offset: number, length: number): Uint8Array;
  releaseDescriptor(handle: number): void;
  releaseCodec(handle: number): void;
  releaseFrame(handle: number): void;
  snapshot(): AppImageSnapshot;
}
export function imageDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > appImageLimits.dimension ||
    height > appImageLimits.dimension ||
    width * height > appImageLimits.pixels
  )
    throw Error('Image dimension/pixel budget exceeded');
}
