// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineResponse, NodeHandle } from './codec.ts';

export interface ImageUploadState {
  readonly token: bigint;
  readonly resource: NodeHandle;
  readonly total: number;
  readonly filled: number;
  readonly phase: 'uploading' | 'committed' | 'aborted';
}
export interface ImageResourceSlice {
  readonly resource: NodeHandle;
  readonly offset: number;
  readonly total: number;
  readonly bytes: Uint8Array;
}
function integer(value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 0 || value > maximum)
    throw Error('Invalid image resource integer');
  return value;
}
function handle(data: DataView, value: NodeHandle): void {
  if (!value.slot || !value.generation) throw Error('Invalid image resource handle');
  data.setUint32(0, integer(value.slot, p.limits.resources), true);
  data.setUint32(4, integer(value.generation, 0xffffffff), true);
}
function one(result: EngineResponse, type: number) {
  const blobs = result.blobs.filter((blob) => blob.type === type);
  if (blobs.length > 1) throw Error('Duplicate image resource response');
  return blobs[0];
}
export function readImageUpload(result: EngineResponse): ImageUploadState | null {
  const blob = one(result, p.imageUploadBlob);
  if (!blob) return null;
  if (blob.bytes.length !== 24) throw Error('Invalid image upload response size');
  const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
    token = data.getBigUint64(0, true),
    total = data.getUint32(8, true),
    filled = data.getUint32(12, true),
    phase = data.getUint32(16, true);
  if (
    !token ||
    !blob.handle.slot ||
    blob.handle.slot > p.limits.resources ||
    !blob.handle.generation ||
    !total ||
    total > p.limits.resourceBytes ||
    filled > total ||
    phase < 1 ||
    phase > 3 ||
    data.getUint32(20, true) ||
    (phase === 2 && filled !== total) ||
    (phase === 3 && filled)
  )
    throw Error('Invalid image upload response');
  return Object.freeze({
    token,
    resource: blob.handle,
    total,
    filled,
    phase: ['uploading', 'committed', 'aborted'][phase - 1] as ImageUploadState['phase'],
  });
}
export function readImageResourceSlice(result: EngineResponse): ImageResourceSlice | null {
  const blob = one(result, p.imageResourceChunkBlob);
  if (!blob) return null;
  if (blob.bytes.length < 9 || blob.bytes.length > 8 + p.limits.imageChunkBytes)
    throw Error('Invalid image resource slice size');
  const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
    offset = data.getUint32(0, true),
    total = data.getUint32(4, true),
    length = blob.bytes.length - 8;
  if (
    !blob.handle.slot ||
    blob.handle.slot > p.limits.resources ||
    !blob.handle.generation ||
    !total ||
    total > p.limits.resourceBytes ||
    offset >= total ||
    length > total - offset
  )
    throw Error('Invalid image resource slice');
  return Object.freeze({ resource: blob.handle, offset, total, bytes: blob.bytes.slice(8) });
}
export function imageUploadBeginBytes(resource: NodeHandle, total: number): Uint8Array {
  if (total <= 0) throw Error('Invalid image resource length');
  const bytes = new Uint8Array(16),
    data = new DataView(bytes.buffer);
  handle(data, resource);
  data.setUint32(8, integer(total, p.limits.resourceBytes), true);
  return bytes;
}
export function imageUploadChunkBytes(offset: number, input: Uint8Array): Uint8Array {
  if (!(input instanceof Uint8Array) || !input.length || input.length > p.limits.imageChunkBytes)
    throw Error('Invalid image upload chunk');
  const bytes = new Uint8Array(8 + Math.ceil(input.length / 8) * 8),
    data = new DataView(bytes.buffer);
  data.setUint32(0, integer(offset, p.limits.resourceBytes), true);
  data.setUint32(4, input.length, true);
  bytes.set(input, 8);
  return bytes;
}
export function imageResourceReadBytes(
  resource: NodeHandle,
  offset: number,
  length: number,
  preparation = 0n,
): Uint8Array {
  if (
    length <= 0 ||
    typeof preparation !== 'bigint' ||
    preparation < 0n ||
    preparation > 0xffffffffffffffffn
  )
    throw Error('Invalid image resource read');
  const bytes = new Uint8Array(24),
    data = new DataView(bytes.buffer);
  handle(data, resource);
  data.setBigUint64(8, preparation, true);
  data.setUint32(16, integer(offset, p.limits.resourceBytes), true);
  data.setUint32(20, integer(length, p.limits.imageChunkBytes), true);
  return bytes;
}
/** Content owns this temporary payload only for measurement/recording. Core's
 * preparation, query or held frame pins the source independently of producers. */
export function acquireImageResources(
  scene: EngineResponse,
  read: (
    resource: NodeHandle,
    offset: number,
    length: number,
    preparation: bigint,
  ) => ImageResourceSlice,
  reserve: (bytes: number) => () => void,
): { readonly scene: EngineResponse; release(): void } {
  const descriptors = scene.blobs.filter((blob) => blob.type === p.imageResourceBlob),
    holds: (() => void)[] = [],
    release = () => {
      for (const hold of holds.splice(0)) hold();
    };
  if (!descriptors.length) return { scene, release };
  const key = (value: NodeHandle) => `${value.slot}:${value.generation}`,
    seen = new Set(scene.blobs.filter((blob) => blob.type === 2).map((blob) => key(blob.handle))),
    blobs = [...scene.blobs],
    preparation = scene.measurePreparation || scene.preparation;
  try {
    holds.push(reserve(4 * p.limits.imageChunkBytes + 65536));
    for (const descriptor of descriptors) {
      if (descriptor.bytes.length !== 8) throw Error('Invalid image resource descriptor');
      const data = new DataView(descriptor.bytes.buffer, descriptor.bytes.byteOffset, 8),
        total = data.getUint32(0, true),
        id = key(descriptor.handle);
      if (
        !preparation ||
        !descriptor.handle.slot ||
        !descriptor.handle.generation ||
        descriptor.handle.slot > p.limits.resources ||
        !total ||
        total > p.limits.resourceBytes ||
        data.getUint32(4, true) ||
        seen.has(id)
      )
        throw Error('Invalid image resource descriptor');
      seen.add(id);
      holds.push(reserve(total + 32));
      const bytes = new Uint8Array(total);
      for (let offset = 0; offset < total; offset += p.limits.imageChunkBytes) {
        const length = Math.min(p.limits.imageChunkBytes, total - offset),
          part = read(descriptor.handle, offset, length, preparation);
        if (
          key(part.resource) !== id ||
          part.offset !== offset ||
          part.total !== total ||
          part.bytes.length !== length
        )
          throw Error('Image resource read identity/length changed');
        bytes.set(part.bytes, offset);
      }
      blobs.push(Object.freeze({ type: 2, handle: descriptor.handle, bytes }));
    }
    return { scene: Object.freeze({ ...scene, blobs: Object.freeze(blobs) }), release };
  } catch (error) {
    release();
    throw error;
  }
}
