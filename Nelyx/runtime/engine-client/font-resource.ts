// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineResponse, NodeHandle } from './codec.ts';

export interface FontUploadState {
  readonly token: bigint;
  readonly resource: NodeHandle;
  readonly total: number;
  readonly filled: number;
  readonly phase: 'uploading' | 'committed' | 'aborted';
}
export interface FontResourceSlice {
  readonly resource: NodeHandle;
  readonly offset: number;
  readonly total: number;
  readonly bytes: Uint8Array;
}
export interface FontResourceBinding {
  readonly resource: NodeHandle | null;
  readonly fontRevision: bigint;
  readonly pinned: boolean;
}
export function readFontBinding(bytes: Uint8Array): FontResourceBinding {
  if (bytes.length !== 24) throw Error('Invalid paragraph font binding size');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    slot = data.getUint32(0, true),
    generation = data.getUint32(4, true),
    fontRevision = data.getBigUint64(8, true),
    flags = data.getUint32(16, true);
  if (
    !slot !== !generation ||
    slot > p.limits.resources ||
    !fontRevision ||
    flags > 1 ||
    data.getUint32(20, true)
  )
    throw Error('Invalid paragraph font binding');
  return Object.freeze({
    resource: slot ? Object.freeze({ slot, generation }) : null,
    fontRevision,
    pinned: !!flags,
  });
}
function integer(value: number, maximum: number): number {
  if (!Number.isInteger(value) || value < 0 || value > maximum)
    throw Error('Invalid font resource integer');
  return value;
}
function handle(data: DataView, value: NodeHandle): void {
  if (!value.slot || !value.generation) throw Error('Invalid font resource handle');
  data.setUint32(0, integer(value.slot, p.limits.resources), true);
  data.setUint32(4, integer(value.generation, 0xffffffff), true);
}
function one(result: EngineResponse, type: number) {
  const blobs = result.blobs.filter((blob) => blob.type === type);
  if (blobs.length > 1) throw Error('Duplicate font resource response');
  return blobs[0];
}
export function readFontUpload(result: EngineResponse): FontUploadState | null {
  const blob = one(result, p.fontUploadBlob);
  if (!blob) return null;
  if (blob.bytes.length !== 24) throw Error('Invalid font upload response size');
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
    total < 32 ||
    total > p.limits.fontCatalogBytes ||
    filled > total ||
    phase < 1 ||
    phase > 3 ||
    data.getUint32(20, true) ||
    (phase === 2 && filled !== total) ||
    (phase === 3 && filled)
  )
    throw Error('Invalid font upload response');
  return Object.freeze({
    token,
    resource: blob.handle,
    total,
    filled,
    phase: ['uploading', 'committed', 'aborted'][phase - 1] as FontUploadState['phase'],
  });
}
export function readFontResourceSlice(result: EngineResponse): FontResourceSlice | null {
  const blob = one(result, p.fontResourceChunkBlob);
  if (!blob) return null;
  if (blob.bytes.length < 9 || blob.bytes.length > 8 + p.limits.fontChunkBytes)
    throw Error('Invalid font resource slice size');
  const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
    offset = data.getUint32(0, true),
    total = data.getUint32(4, true),
    length = blob.bytes.length - 8;
  if (
    !blob.handle.slot ||
    blob.handle.slot > p.limits.resources ||
    !blob.handle.generation ||
    total < 32 ||
    total > p.limits.fontCatalogBytes ||
    offset >= total ||
    length > total - offset
  )
    throw Error('Invalid font resource slice');
  return Object.freeze({ resource: blob.handle, offset, total, bytes: blob.bytes.slice(8) });
}
export function fontUploadBeginBytes(resource: NodeHandle, total: number): Uint8Array {
  if (total < 32) throw Error('Invalid font catalog length');
  const bytes = new Uint8Array(16),
    data = new DataView(bytes.buffer);
  handle(data, resource);
  data.setUint32(8, integer(total, p.limits.fontCatalogBytes), true);
  return bytes;
}
export function fontUploadChunkBytes(offset: number, input: Uint8Array): Uint8Array {
  if (!(input instanceof Uint8Array) || !input.length || input.length > p.limits.fontChunkBytes)
    throw Error('Invalid font upload chunk');
  const bytes = new Uint8Array(8 + Math.ceil(input.length / 8) * 8),
    data = new DataView(bytes.buffer);
  data.setUint32(0, integer(offset, p.limits.fontCatalogBytes), true);
  data.setUint32(4, input.length, true);
  bytes.set(input, 8);
  return bytes;
}
export function fontResourceReadBytes(
  resource: NodeHandle,
  offset: number,
  length: number,
  preparation = 0n,
  transition = 0n,
): Uint8Array {
  if (
    typeof preparation !== 'bigint' ||
    preparation < 0n ||
    preparation > 0xffffffffffffffffn ||
    typeof transition !== 'bigint' ||
    transition < 0n ||
    transition > 0xffffffffffffffffn ||
    (!!transition && !!preparation) ||
    !length
  )
    throw Error('Invalid font resource read');
  const bytes = new Uint8Array(transition ? 32 : 24),
    data = new DataView(bytes.buffer);
  handle(data, resource);
  data.setBigUint64(8, preparation, true);
  data.setUint32(16, integer(offset, p.limits.fontCatalogBytes), true);
  data.setUint32(20, integer(length, p.limits.fontChunkBytes), true);
  if (transition) data.setBigUint64(24, transition, true);
  return bytes;
}
