// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { invariant } from '../foundation/errors.ts';
import { ImmutableBuffer } from './immutable-buffer.ts';
import { ImageDescriptor } from './image-descriptor.ts';
import type { Codec } from './codec.ts';
export class TargetImageSize {
  readonly width: number | null;
  readonly height: number | null;
  constructor({
    width = null,
    height = null,
  }: {
    readonly width?: number | null;
    readonly height?: number | null;
  } = {}) {
    for (const value of [width, height])
      invariant(
        value === null || (Number.isSafeInteger(value) && value > 0),
        'invalid-image-target',
        'TargetImageSize dimensions must be positive integers or null',
      );
    this.width = width;
    this.height = height;
  }
}
export type TargetImageSizeCallback = (width: number, height: number) => TargetImageSize;
export interface InstantiateImageCodecOptions {
  readonly targetWidth?: number | null;
  readonly targetHeight?: number | null;
  readonly allowUpscaling?: boolean;
}
export async function instantiateImageCodec(
  list: Uint8Array,
  options: InstantiateImageCodecOptions = {},
): Promise<Codec> {
  const pending = ImmutableBuffer.fromUint8List(list);
  let snapshot: InstantiateImageCodecOptions;
  try {
    snapshot = Object.freeze({ ...options });
  } catch (error) {
    try {
      (await pending).dispose();
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        'Image options and captured buffer retirement failed',
      );
    }
    throw error;
  }
  return instantiateImageCodecFromBuffer(await pending, snapshot);
}
/** Transfers ownership of buffer, including failure and target callback failure. */
export async function instantiateImageCodecFromBuffer(
  buffer: ImmutableBuffer,
  options: InstantiateImageCodecOptions = {},
): Promise<Codec> {
  let delegated = false;
  try {
    const { targetWidth = null, targetHeight = null, allowUpscaling = true } = options;
    delegated = true;
    return await instantiateImageCodecWithSize(buffer, {
      getTargetSize(width, height) {
        invariant(
          typeof allowUpscaling === 'boolean',
          'invalid-image-target',
          'allowUpscaling must be a boolean',
        );
        return new TargetImageSize({
          width:
            !allowUpscaling && targetWidth !== null ? Math.min(width, targetWidth) : targetWidth,
          height:
            !allowUpscaling && targetHeight !== null
              ? Math.min(height, targetHeight)
              : targetHeight,
        });
      },
    });
  } finally {
    if (!delegated) buffer.dispose();
  }
}
export async function instantiateImageCodecWithSize(
  buffer: ImmutableBuffer,
  options: { readonly getTargetSize?: TargetImageSizeCallback | null } = {},
): Promise<Codec> {
  let descriptor: ImageDescriptor | undefined;
  try {
    const { getTargetSize = null } = options;
    descriptor = await ImageDescriptor.encoded(buffer);
    const target =
      getTargetSize === null
        ? new TargetImageSize()
        : getTargetSize(descriptor.width, descriptor.height);
    return await descriptor.instantiateCodec({
      targetWidth: target.width,
      targetHeight: target.height,
    });
  } finally {
    // Descriptor and caller handle are independent owners. Always retire both.
    try {
      descriptor?.dispose();
    } finally {
      buffer.dispose();
    }
  }
}
