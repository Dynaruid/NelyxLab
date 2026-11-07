// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Adapted from the pinned dart:ui painting.dart ImageDescriptor contract.
import { FlutterError } from '../foundation/flutter-error.ts';
import {
  currentImageDescriptorLoader,
  requireImageDescriptorBackend,
} from './image-descriptor-binding.ts';
import type { ImageDescriptorValue } from './image-descriptor-binding.ts';
import type { ImmutableBuffer } from './immutable-buffer.ts';
import type { Codec } from './codec.ts';
export type PixelFormat = 'rgba8888' | 'bgra8888' | 'rgbaFloat32' | 'rFloat32';
export type TargetPixelFormat = 'dontCare' | 'rgbaFloat32' | 'rFloat32';
export interface ImageDescriptorRawOptions {
  readonly width: number;
  readonly height: number;
  readonly rowBytes?: number | null;
  readonly pixelFormat: PixelFormat;
}
export interface ImageCodecOptions {
  readonly targetWidth?: number | null;
  readonly targetHeight?: number | null;
  readonly targetFormat?: TargetPixelFormat;
}
const creation = {};
export class ImageDescriptor {
  static {
    requireImageDescriptorBackend();
  }
  #disposed = false;
  #disposing = false;
  private constructor(
    key: object,
    private readonly value: ImageDescriptorValue,
  ) {
    if (key !== creation) throw new FlutterError('ImageDescriptor requires its engine factory');
  }
  static async encoded(buffer: ImmutableBuffer): Promise<ImageDescriptor> {
    // Capture the current owner and retain synchronously inside its factory.
    const owner = currentImageDescriptorLoader();
    return new ImageDescriptor(creation, await owner.encoded(buffer));
  }
  static raw(buffer: ImmutableBuffer, options: ImageDescriptorRawOptions): ImageDescriptor {
    return new ImageDescriptor(
      creation,
      currentImageDescriptorLoader().raw(buffer, Object.freeze({ ...options })),
    );
  }
  get width(): number {
    return this.value.width;
  }
  get height(): number {
    return this.value.height;
  }
  get bytesPerPixel(): number {
    return this.value.bytesPerPixel;
  }
  instantiateCodec(options: ImageCodecOptions = {}): Promise<Codec> {
    if (this.#disposed || this.#disposing)
      return Promise.reject(new FlutterError('Cannot instantiate a disposed ImageDescriptor'));
    return this.value.instantiateCodec(Object.freeze({ ...options }));
  }
  dispose(): void {
    if (this.#disposed || this.#disposing)
      throw new FlutterError('ImageDescriptor cannot be disposed more than once or reentrantly');
    this.#disposing = true;
    try {
      this.value.dispose();
      this.#disposed = true;
    } finally {
      this.#disposing = false;
    }
  }
}
