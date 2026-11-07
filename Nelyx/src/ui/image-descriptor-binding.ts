// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import type { Codec } from './codec.ts';
import type { ImmutableBuffer } from './immutable-buffer.ts';
import type { ImageDescriptorRawOptions, ImageCodecOptions } from './image-descriptor.ts';
import type { ImageDecodeOptions } from '../hosting/images.ts';

type ImageServiceDecoder = (bytes: Uint8Array, options: ImageDecodeOptions) => Promise<Codec>;
const serviceDecoders = new WeakMap<object, ImageServiceDecoder>();
/** Private per-service admission. The adapter captures caller bytes before its
 * first await, using the same App's admitted immutable buffer/codec owner. */
export function bindImageServiceDecoder(owner: object, decode: ImageServiceDecoder): Disposable {
  if (serviceDecoders.has(owner))
    throw new FlutterError('Image service decoder already registered');
  serviceDecoders.set(owner, decode);
  return {
    dispose() {
      if (serviceDecoders.get(owner) === decode) serviceDecoders.delete(owner);
    },
  };
}
export function imageServiceDecoder(owner: object): ImageServiceDecoder | undefined {
  return serviceDecoders.get(owner);
}

/** @internal Realm-local engine ownership; no native handles enter the public API. */
export interface ImageDescriptorValue extends Disposable {
  readonly width: number;
  readonly height: number;
  readonly bytesPerPixel: number;
  instantiateCodec(options: ImageCodecOptions): Promise<Codec>;
}
export interface ImageDescriptorLoader {
  encoded(buffer: ImmutableBuffer): Promise<ImageDescriptorValue>;
  raw(buffer: ImmutableBuffer, options: ImageDescriptorRawOptions): ImageDescriptorValue;
}
let backend: ImageDescriptorLoader | undefined;
let required = false;
export function requireImageDescriptorBackend(): void {
  required = true;
}
export function imageDescriptorBackendRequired(): boolean {
  return required;
}
const bindings = new Set<object>();
export function bindImageDescriptorLoader(value: ImageDescriptorLoader): Disposable {
  if (backend && backend !== value)
    throw new FlutterError('A different image descriptor owner already owns this realm');
  backend = value;
  const binding = {};
  bindings.add(binding);
  return {
    dispose() {
      if (!bindings.delete(binding)) return;
      if (!bindings.size) backend = undefined;
    },
  };
}
export function currentImageDescriptorLoader(): ImageDescriptorLoader {
  if (!backend) throw new FlutterError('ImageDescriptor requires an initialized App image owner');
  return backend;
}
