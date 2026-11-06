// SPDX-License-Identifier: BSD-3-Clause
import type { NativePaintEntry } from '@nelyx/core/framework/rendering/object';
import type { NodeHandle, AffineMatrix } from './codec.ts';
import { protocol as p } from './schema.ts';
export interface NativePaintOptions extends Omit<NativePaintEntry, 'reference'> {
  readonly reference?: NodeHandle | (() => NodeHandle | null);
  readonly fillParent?: boolean;
}
export interface NativePaintSnapshot extends Omit<NativePaintOptions, 'reference'> {
  readonly reference: NodeHandle;
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
  readonly resolvedRadius: number;
  readonly transform: AffineMatrix;
}
const kinds = ['physical', 'border', 'highlight', 'ripple'] as const;
const shapes = ['rrect', 'stadium', 'circle'] as const;
const clips = ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer'] as const;
const finite = (n: number) => {
  if (!Number.isFinite(n)) throw Error('Non-finite native paint value');
  return n;
};
export function nativePaintBody(entries: readonly NativePaintOptions[]): Uint8Array {
  if (entries.length > p.limits.nativePaintEntries) throw RangeError('Native paint entry budget');
  const bytes = new Uint8Array(8 + entries.length * p.nativePaintBytes),
    v = new DataView(bytes.buffer);
  v.setUint32(0, entries.length, true);
  entries.forEach((entry, index) => {
    const at = 8 + index * p.nativePaintBytes,
      reference = typeof entry.reference === 'function' ? entry.reference() : entry.reference;
    if (entry.kind === 'ripple' || entry.kind === 'highlight') {
      if (!reference) throw Error('Native ink reference is not mounted');
    }
    v.setUint32(at, kinds.indexOf(entry.kind) + 1, true);
    v.setUint32(
      at + 4,
      (entry.contained ? 1 : 0) |
        (entry.center ? 2 : 0) |
        (entry.circular ? 4 : 0) |
        (entry.customClip ? 8 : 0) |
        (entry.fillParent ? 16 : 0),
      true,
    );
    v.setUint32(at + 8, entry.color, true);
    v.setUint32(at + 12, entry.shadowColor ?? 0, true);
    v.setUint32(at + 16, reference?.slot ?? 0, true);
    v.setUint32(at + 20, reference?.generation ?? 0, true);
    v.setUint32(at + 24, shapes.indexOf(entry.shape.kind), true);
    v.setUint32(at + 28, clips.indexOf(entry.clip ?? 'none'), true);
    v.setUint32(at + 32, entry.shape.strokeColor, true);
    const values = [
      entry.elevation ?? 0,
      entry.shape.strokeWidth,
      entry.shape.strokeAlign,
      entry.x ?? 0,
      entry.y ?? 0,
      entry.radius ?? -1,
      entry.progress ?? 0,
      ...entry.shape.radii,
    ];
    if (entry.shape.radii.length !== 8) throw Error('Native shape needs eight corner radii');
    values.forEach((value, i) => v.setFloat64(at + 40 + i * 8, finite(value), true));
  });
  return bytes;
}
export function readNativePaint(bytes: Uint8Array): readonly NativePaintSnapshot[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = v.getUint32(0, true);
  if (
    bytes.length < 8 ||
    count > p.limits.nativePaintEntries ||
    v.getUint32(4, true) > 1 ||
    bytes.length !== 8 + count * p.nativePaintBytes
  )
    throw Error('Invalid native paint snapshot');
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const at = 8 + index * p.nativePaintBytes,
        flags = v.getUint32(at + 4, true),
        f = (offset: number) => finite(v.getFloat64(at + offset, true)),
        kind = kinds[v.getUint32(at, true) - 1],
        shape = shapes[v.getUint32(at + 24, true)],
        clip = clips[v.getUint32(at + 28, true)];
      if (!kind || !shape || !clip || flags & ~31 || v.getUint32(at + 36, true) || f(248))
        throw Error('Invalid native paint entry');
      return Object.freeze({
        kind,
        color: v.getUint32(at + 8, true),
        shadowColor: v.getUint32(at + 12, true),
        reference: Object.freeze({
          slot: v.getUint32(at + 16, true),
          generation: v.getUint32(at + 20, true),
        }),
        shape: Object.freeze({
          kind: shape,
          strokeColor: v.getUint32(at + 32, true),
          strokeWidth: f(48),
          strokeAlign: f(56),
          radii: Object.freeze(Array.from({ length: 8 }, (_, i) => f(96 + i * 8))),
        }),
        elevation: f(40),
        x: f(64),
        y: f(72),
        radius: f(80),
        progress: f(88),
        clip,
        contained: !!(flags & 1),
        center: !!(flags & 2),
        circular: !!(flags & 4),
        customClip: !!(flags & 8),
        fillParent: !!(flags & 16),
        width: f(160),
        height: f(168),
        cx: f(176),
        cy: f(184),
        resolvedRadius: f(192),
        transform: Object.freeze(
          Array.from({ length: 6 }, (_, i) => f(200 + i * 8)),
        ) as unknown as AffineMatrix,
      });
    }),
  );
}
