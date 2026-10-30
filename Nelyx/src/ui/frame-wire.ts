// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import { WriteBuffer } from '../foundation/serialization.ts';
import { freezeFrame, resourceKey, disposeFrame } from './frame.ts';
import { blendModes } from './paint.ts';
import type { PaintSnapshot } from './paint.ts';
import { pathOperationNames } from './path.ts';
import type { PathSnapshot } from './path.ts';
import type { PaintFrame, ResourceId, Rect } from './types.ts';
import { encodePaintEffects } from './paint-effects-wire.ts';
import { filterQualities } from './paint-effects-data.ts';
export const frameWireVersion = 11;
export interface NativeFrameResource {
  readonly id: number;
  readonly generation: number;
}
export type NativeFrameResourceResolver = (resource: ResourceId) => NativeFrameResource;
const uint32 = (value: number, label: string) => {
  invariant(
    Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
    'invalid-frame-wire',
    `${label} must fit uint32`,
  );
  return value;
};
/** Wire 11 adds bounded runtime shaders; native replay retains wires1..10. */
export function encodeFrame(frame: PaintFrame, resolve?: NativeFrameResourceResolver): Uint8Array {
  const frozen = freezeFrame(frame.token, frame.commands),
    records: number[][] = [],
    bindings = new Map<string, NativeFrameResource>(),
    ids = new Map<number, string>();
  try {
    function native(resource: ResourceId): NativeFrameResource {
      const key = resourceKey(resource),
        previous = bindings.get(key);
      if (previous) return previous;
      invariant(resolve, 'invalid-frame-resource', 'Native resource mapping is required');
      const entry = resolve(resource),
        id = uint32(entry.id, 'resource id'),
        generation = uint32(entry.generation, 'resource generation');
      invariant(
        id > 0 && generation === resource.generation && !ids.has(id),
        'invalid-frame-resource',
        'Stale or colliding native resource mapping',
      );
      const result = { id, generation };
      bindings.set(key, result);
      ids.set(id, key);
      return result;
    }
    const record = (
      op: number,
      color = 0,
      values: readonly number[] = [],
      flags = 0,
      id = 0,
      generation = 0,
    ) =>
      records.push([
        op,
        color,
        ...Array.from({ length: 6 }, (_, i) => values[i] ?? 0),
        flags,
        id,
        generation,
      ]);
    const rectangle = (r: Rect) => [r.x, r.y, r.width, r.height];
    function paint(p: PaintSnapshot): void {
      const flags =
        (p.style === 'stroke' ? 1 : 0) |
        (['butt', 'round', 'square'].indexOf(p.strokeCap) << 1) |
        (['miter', 'round', 'bevel'].indexOf(p.strokeJoin) << 3) |
        (p.isAntiAlias ? 32 : 0) |
        (blendModes.indexOf(p.blendMode) << 6);
      record(10, p.color, [p.strokeWidth, p.strokeMiterLimit], flags);
      for (const row of encodePaintEffects(p, native))
        record(row.op, row.color, row.values, row.flags, row.aux1, row.aux2);
    }
    function pathOperations(p: PathSnapshot): void {
      for (const item of p.operations) {
        record(23, pathOperationNames.indexOf(item.verb) + 1, item.values);
        if (item.verb === 'addRRect') record(26, 0, item.values.slice(6));
      }
    }
    function path(op: 21 | 22, p: PathSnapshot, flags = 0): void {
      record(op, p.fillType === 'evenOdd' ? 1 : 0, [], flags, 0, p.operations.length);
      pathOperations(p);
    }
    function rounded(op: 24 | 25, values: readonly number[], flags = 0): void {
      record(op, 0, values, flags);
      record(26, 0, values.slice(6));
    }
    for (const c of frozen.commands)
      switch (c.op) {
        case 'drawPicture': {
          const r = native(c.resource);
          record(35, 0, [], 0, r.id, r.generation);
          break;
        }
        case 'clear':
          record(1, c.color);
          break;
        case 'save':
          record(2);
          break;
        case 'restore':
          record(3);
          break;
        case 'transform':
          if (c.matrix.length === 16) {
            record(18, 0, c.matrix.slice(0, 6));
            record(19, 0, c.matrix.slice(6, 12));
            record(20, 0, c.matrix.slice(12, 16));
          } else record(4, 0, c.matrix);
          break;
        case 'clip':
          record(5, 0, rectangle(c.rect));
          break;
        case 'rect':
          record(6, c.color, rectangle(c.rect));
          break;
        case 'rrect':
          record(7, c.color, [...rectangle(c.rect), c.radius]);
          break;
        case 'image':
        case 'paragraph': {
          const r = native(c.resource);
          record(
            c.op === 'image' ? 8 : 9,
            0,
            c.op === 'image' ? rectangle(c.rect) : [c.x, c.y],
            0,
            r.id,
            r.generation,
          );
          break;
        }
        case 'drawImageRect':
        case 'drawImageNine': {
          const r = native(c.resource);
          paint(c.paint);
          record(
            c.op === 'drawImageRect' ? 31 : 33,
            0,
            rectangle(c.op === 'drawImageRect' ? c.src : c.center),
            filterQualities.indexOf(c.paint.filterQuality ?? 'none'),
            r.id,
            r.generation,
          );
          record(c.op === 'drawImageRect' ? 32 : 34, 0, rectangle(c.dst));
          break;
        }
        case 'drawRect':
        case 'drawOval':
          paint(c.paint);
          record(c.op === 'drawRect' ? 11 : 13, 0, rectangle(c.rect));
          break;
        case 'drawRRect':
          paint(c.paint);
          if ('rrect' in c) rounded(24, c.rrect.values);
          else record(12, 0, [...rectangle(c.rect), c.radius]);
          break;
        case 'drawLine':
          paint(c.paint);
          record(14, 0, [c.from.x, c.from.y, c.to.x, c.to.y]);
          break;
        case 'saveLayer':
          paint(c.paint);
          record(15, 0, c.bounds ? rectangle(c.bounds) : [], c.bounds ? 1 : 0);
          break;
        case 'saveBackdropFilter':
          paint(c.paint);
          record(38);
          break;
        case 'clipRect':
        case 'clipRRect': {
          const flags = (c.doAntiAlias ? 1 : 0) | (c.clipOp === 'difference' ? 2 : 0);
          if (c.op === 'clipRRect' && 'rrect' in c) rounded(25, c.rrect.values, flags);
          else
            record(
              c.op === 'clipRect' ? 16 : 17,
              0,
              [...rectangle(c.rect), ...(c.op === 'clipRRect' ? [c.radius] : [])],
              flags,
            );
          break;
        }
        case 'drawPath':
          paint(c.paint);
          path(21, c.path);
          break;
        case 'drawShadow':
          record(
            36,
            c.color,
            [c.elevation, c.devicePixelRatio],
            (c.transparentOccluder ? 1 : 0) | (c.path.fillType === 'evenOdd' ? 2 : 0),
            c.path.operations.length,
          );
          pathOperations(c.path);
          break;
        case 'drawPaint':
          paint(c.paint);
          record(37);
          break;
        case 'clipPath':
          path(22, c.path, (c.doAntiAlias ? 1 : 0) | (c.clipOp === 'difference' ? 2 : 0));
          break;
        default: {
          const unhandled: never = c;
          throw new Error('Unhandled paint command: ' + String((unhandled as { op: string }).op));
        }
      }
    const byteLength = 64 + records.length * 48,
      buffer = new WriteBuffer({ startCapacity: byteLength }),
      put = (value: number) =>
        buffer.putUint32(uint32(value, 'wire integer'), { endian: 'little' }),
      float = (value: number) => {
        invariant(
          Number.isFinite(value) && Number.isFinite(Math.fround(value)),
          'invalid-frame-wire',
          'Frame value must fit finite float32',
        );
        buffer.putFloat32(value, { endian: 'little' });
      };
    const t = frozen.token,
      m = t.metrics;
    for (const value of [
      0x494c5a4f,
      frameWireVersion,
      byteLength,
      records.length,
      t.owner.generation,
      m.viewportGeneration,
      m.rendererGeneration,
      t.sequence,
      m.physicalWidth,
      m.physicalHeight,
    ])
      put(value);
    invariant(m.scale <= 16, 'invalid-frame-wire', 'Native wire density exceeds 16');
    float(m.scale);
    put(m.nativeContextGeneration ?? 0);
    put(m.nativeSurfaceGeneration ?? 0);
    for (let i = 0; i < 12; i++) buffer.putUint8(0);
    // Final reserved bytes use scalar adds, preserving the exact-size owned buffer
    // without triggering WriteBuffer's source bulk-write growth at an exact fit.
    let remaining = records.length;
    for (const record of records) {
      const op = record[0]!;
      put(op);
      put(record[1]!);
      for (let n = 0; n < 6; n++) float(record[2 + n]!);
      put(op === 8 || op === 9 ? record[9]! : record[8]!);
      put(op >= 27 ? record[9]! : op === 8 || op === 9 || op === 21 || op === 22 ? record[10]! : 0);
      put(op >= 27 ? record[10]! : 0);
      if (--remaining === 0) for (let i = 0; i < 4; i++) buffer.putUint8(0);
      else put(0);
    }
    const result = buffer.done();
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  } finally {
    disposeFrame(frozen);
  }
}
