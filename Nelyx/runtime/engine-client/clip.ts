// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';

/** Clockwise top-left, top-right, bottom-right and bottom-left x/y radii. */
export type ClipRadii = readonly [number, number, number, number, number, number, number, number];
export interface ClipStyleOptions {
  readonly hitTestShape?: boolean;
  readonly behavior?: keyof typeof p.clipBehaviors;
  readonly shape?: keyof typeof p.clipShapes;
  readonly radii?: ClipRadii;
}
export interface ClipStyleSnapshot {
  readonly hitTestShape: boolean;
  readonly behavior: keyof typeof p.clipBehaviors;
  readonly shape: keyof typeof p.clipShapes;
  readonly radii: ClipRadii;
}
function capture(options: ClipStyleOptions): ClipStyleSnapshot {
  if (
    Object.keys(options).some(
      (key) => !['behavior', 'shape', 'radii', 'hitTestShape'].includes(key),
    )
  )
    throw new RangeError('Unknown native clip style option');
  const behavior = options.behavior ?? 'antiAlias',
    shape = options.shape ?? 'rect';
  if (!Object.hasOwn(p.clipBehaviors, behavior) || !Object.hasOwn(p.clipShapes, shape))
    throw new RangeError('Unknown native clip behavior or shape');
  if (options.hitTestShape !== undefined && typeof options.hitTestShape !== 'boolean')
    throw RangeError('Invalid native clip hit policy');
  const radii = Array.from(options.radii ?? [0, 0, 0, 0, 0, 0, 0, 0]);
  if (
    radii.length !== 8 ||
    radii.some(
      (value) =>
        !Number.isFinite(value) || value < 0 || value > 1e12 || (shape !== 'rrect' && value !== 0),
    )
  )
    throw new RangeError('Invalid native clip radii');
  return Object.freeze({
    behavior,
    shape,
    hitTestShape: options.hitTestShape ?? false,
    radii: Object.freeze(radii) as unknown as ClipRadii,
  });
}
export function clipStyleBytes(options: ClipStyleOptions): Uint8Array {
  const value = capture(options),
    bytes = new Uint8Array(p.clipStyleBytes),
    view = new DataView(bytes.buffer);
  view.setUint32(0, p.clipBehaviors[value.behavior], true);
  view.setUint32(4, p.clipShapes[value.shape], true);
  view.setUint32(8, value.hitTestShape ? p.clipStyleFlags.hitTestShape : 0, true);
  value.radii.forEach((radius, index) => view.setFloat64(16 + index * 8, radius, true));
  return bytes;
}
export function readClipStyle(bytes: Uint8Array): ClipStyleSnapshot {
  if (bytes.length !== p.clipStyleBytes) throw Error('Invalid native clip style size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    behavior = view.getUint32(0, true),
    shape = view.getUint32(4, true);
  if (
    behavior > p.clipBehaviors.antiAliasWithSaveLayer ||
    shape > p.clipShapes.circle ||
    view.getUint32(8, true) > p.clipStyleFlags.hitTestShape ||
    view.getUint32(12, true)
  )
    throw Error('Invalid native clip style header');
  return capture({
    hitTestShape: !!view.getUint32(8, true),
    behavior: (Object.keys(p.clipBehaviors) as (keyof typeof p.clipBehaviors)[])[behavior]!,
    shape: (Object.keys(p.clipShapes) as (keyof typeof p.clipShapes)[])[shape]!,
    radii: Array.from({ length: 8 }, (_, index) =>
      view.getFloat64(16 + index * 8, true),
    ) as unknown as ClipRadii,
  });
}
