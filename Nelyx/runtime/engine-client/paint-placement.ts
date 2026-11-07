// SPDX-License-Identifier: BSD-3-Clause
import type { NodeHandle } from './codec.ts';
import type { NativePaintScalar } from '@nelyx/core/framework/rendering/object';
import { nativePaintBody, readNativePaint } from './native-paint.ts';
import { protocol as p } from './schema.ts';

/** A recorded paragraph uses its immutable query input. Content independently
 * measures it, verifies the font/geometry, then places it in the final parent. */
export interface PaintPlacementOptions {
  readonly unbounded?: boolean;
  readonly reference?: NodeHandle | (() => NodeHandle | null);
  readonly fontRevision: bigint;
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly rect: readonly [
    NativePaintScalar,
    NativePaintScalar,
    NativePaintScalar,
    NativePaintScalar,
  ];
}
const shape = Object.freeze({
  kind: 'rrect' as const,
  radii: Object.freeze(Array<number>(8).fill(0)),
  strokeWidth: 0,
  strokeAlign: 0,
  strokeColor: 0,
});
function metrics(
  value: Pick<PaintPlacementOptions, 'fontRevision' | 'width' | 'height' | 'baseline'>,
) {
  if (
    value.fontRevision <= 0n ||
    value.fontRevision > 0xffffffffffffffffn ||
    [value.width, value.height, value.baseline].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 1e12,
    )
  )
    throw Error('Invalid recorded paragraph font/geometry');
}
export function paintPlacementBytes(value: PaintPlacementOptions): Uint8Array {
  metrics(value);
  if (value.unbounded !== undefined && typeof value.unbounded !== 'boolean')
    throw Error('Invalid paragraph paint width flag');
  const program = nativePaintBody([
    { kind: 'shape', color: 0, shape, geometry: { kind: 'program', rect: value.rect } },
  ]);
  const bytes = new Uint8Array(p.paintPlacementBytes + program.length),
    data = new DataView(bytes.buffer);
  data.setBigUint64(0, value.fontRevision, true);
  const reference = typeof value.reference === 'function' ? value.reference() : value.reference;
  if (value.reference && !reference) throw Error('Paragraph paint reference is not mounted');
  if (reference) {
    data.setUint32(32, reference.slot, true);
    data.setUint32(36, reference.generation, true);
  }
  [value.width, value.height, value.baseline].forEach((v, i) =>
    data.setFloat64(8 + i * 8, v, true),
  );
  data.setUint32(40, value.unbounded ? 1 : 0, true);
  bytes.set(program, p.paintPlacementBytes);
  return bytes;
}
export function readPaintPlacement(bytes: Uint8Array): PaintPlacementOptions {
  if (bytes.length < p.paintPlacementBytes) throw Error('Truncated paragraph paint placement');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    value = {
      fontRevision: data.getBigUint64(0, true),
      width: data.getFloat64(8, true),
      height: data.getFloat64(16, true),
      baseline: data.getFloat64(24, true),
    },
    reference = { slot: data.getUint32(32, true), generation: data.getUint32(36, true) },
    entries = readNativePaint(bytes.subarray(p.paintPlacementBytes)),
    entry = entries[0];
  metrics(value);
  if (data.getUint32(40, true) > 1 || data.getUint32(44, true))
    throw Error('Invalid paragraph paint width flags');
  if (!!reference.slot !== !!reference.generation) throw Error('Invalid paragraph paint reference');
  if (
    entries.length !== 1 ||
    entry?.kind !== 'shape' ||
    entry.geometry?.kind !== 'program' ||
    entry.geometry.repeat !== 1 ||
    entry.geometry.visible !== undefined ||
    entry.geometry.color !== undefined
  )
    throw Error('Invalid paragraph paint placement program');
  return Object.freeze({
    ...value,
    unbounded: !!data.getUint32(40, true),
    ...(reference.slot ? { reference: Object.freeze(reference) } : {}),
    rect: entry.geometry.rect,
  });
}
