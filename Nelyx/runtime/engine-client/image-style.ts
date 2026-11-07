// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { BlendMode } from '@nelyx/core/ui/paint';
const blendModeValues = Object.keys(p.imageBlendModes) as readonly BlendMode[];
export interface ImageStyleOptions {
  readonly width: number;
  readonly height: number;
  readonly widthSpecified?: boolean;
  readonly heightSpecified?: boolean;
  readonly scale?: number;
  readonly opacity?: number;
  readonly fit?:
    | 'fill'
    | 'contain'
    | 'cover'
    | 'fitWidth'
    | 'fitHeight'
    | 'none'
    | 'scaleDown'
    | null;
  readonly alignment?: { readonly x: number; readonly y: number };
  readonly repeat?: 'noRepeat' | 'repeat' | 'repeatX' | 'repeatY';
  readonly flip?: boolean;
  readonly invert?: boolean;
  readonly antialias?: boolean;
  readonly color?: number | null;
  readonly colorBlendMode?: BlendMode;
  readonly blendMode?: BlendMode;
  readonly filterQuality?: 'none' | 'low' | 'medium' | 'high';
  readonly centerSlice?: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  } | null;
}
export interface ImagePaintSnapshot {
  readonly style: ImageStyleOptions;
  readonly clip: boolean;
  readonly flip: boolean;
  readonly center: readonly [number, number, number, number] | null;
  readonly bounds: readonly [number, number, number, number];
  readonly tiles: readonly {
    readonly source: readonly [number, number, number, number];
    readonly destination: readonly [number, number, number, number];
  }[];
}
const fits = [
    'fill',
    'contain',
    'cover',
    'fitWidth',
    'fitHeight',
    'none',
    'scaleDown',
    null,
  ] as const,
  repeats = ['noRepeat', 'repeat', 'repeatX', 'repeatY'] as const,
  qualities = ['none', 'low', 'medium', 'high'] as const;
function scalar(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw Error('Invalid image style scalar');
  return value;
}
function index(values: readonly unknown[], value: unknown): number {
  const result = values.indexOf(value);
  if (result < 0) throw Error('Invalid image style enum');
  return result;
}
export function imageStyleBytes(value: ImageStyleOptions | null): Uint8Array {
  const bytes = new Uint8Array(p.imageStyleBytes),
    data = new DataView(bytes.buffer);
  if (!value) return bytes;
  const flags =
    p.imageFlags.canonical |
    (value.widthSpecified ? p.imageFlags.widthSpecified : 0) |
    (value.heightSpecified ? p.imageFlags.heightSpecified : 0) |
    (value.flip ? p.imageFlags.flip : 0) |
    (value.invert ? p.imageFlags.invert : 0) |
    (value.antialias ? p.imageFlags.antialias : 0) |
    (value.color != null ? p.imageFlags.tint : 0) |
    (value.centerSlice ? p.imageFlags.center : 0);
  if (
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    value.width < 0 ||
    value.height < 0 ||
    value.width > 8192 ||
    value.height > 8192 ||
    !!value.width !== !!value.height ||
    (value.scale ?? 1) <= 0 ||
    (value.color != null &&
      (!Number.isInteger(value.color) || value.color < 0 || value.color > 0xffffffff))
  )
    throw Error('Invalid image style dimensions/color');
  const words = [
    flags,
    index(fits, value.fit ?? null),
    index(repeats, value.repeat ?? 'noRepeat'),
    index(qualities, value.filterQuality ?? 'medium'),
    value.color ?? 0,
    index(blendModeValues, value.colorBlendMode ?? 'srcIn'),
    index(blendModeValues, value.blendMode ?? 'srcOver'),
    0,
    value.width,
    value.height,
  ];
  words.forEach((word, i) => data.setUint32(i * 4, word, true));
  const center = value.centerSlice,
    values = [
      value.scale ?? 1,
      value.opacity ?? 1,
      value.alignment?.x ?? 0,
      value.alignment?.y ?? 0,
      center?.left ?? 0,
      center?.top ?? 0,
      center?.right ?? 0,
      center?.bottom ?? 0,
    ];
  values.forEach((number, i) => data.setFloat64(40 + i * 8, scalar(number), true));
  if (
    center &&
    (center.left < 0 ||
      center.top < 0 ||
      center.right < center.left ||
      center.bottom < center.top ||
      (value.width > 0 &&
        (center.right * (value.scale ?? 1) > value.width ||
          center.bottom * (value.scale ?? 1) > value.height)))
  )
    throw Error('Invalid image center slice');
  return bytes;
}
export function readImagePaint(bytes: Uint8Array): ImagePaintSnapshot {
  if (bytes.length < p.imagePaintBytes || (bytes.length - p.imagePaintBytes) % 64)
    throw Error('Invalid image paint size');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.length),
    flags = data.getUint32(0, true),
    count = data.getUint32(112, true),
    plan = data.getUint32(116, true);
  if (
    !(flags & p.imageFlags.canonical) ||
    flags > 255 ||
    data.getUint32(28, true) ||
    data.getBigUint64(104, true) ||
    data.getBigUint64(120, true) ||
    count > p.limits.imageTiles ||
    bytes.length !== p.imagePaintBytes + count * 64 ||
    plan > 7
  )
    throw Error('Invalid image paint header');
  const flag = (bit: number) => !!(flags & bit),
    get = (offset: number) => scalar(data.getFloat64(offset, true)),
    fit = fits[data.getUint32(4, true)],
    repeat = repeats[data.getUint32(8, true)],
    filterQuality = qualities[data.getUint32(12, true)],
    colorBlendMode = blendModeValues[data.getUint32(20, true)],
    blendMode = blendModeValues[data.getUint32(24, true)];
  if (
    fit === undefined ||
    repeat === undefined ||
    filterQuality === undefined ||
    !colorBlendMode ||
    !blendMode
  )
    throw Error('Invalid image paint enum');
  const style: ImageStyleOptions = Object.freeze({
    width: data.getUint32(32, true),
    height: data.getUint32(36, true),
    widthSpecified: flag(p.imageFlags.widthSpecified),
    heightSpecified: flag(p.imageFlags.heightSpecified),
    scale: get(40),
    opacity: get(48),
    alignment: Object.freeze({ x: get(56), y: get(64) }),
    fit,
    repeat,
    filterQuality,
    colorBlendMode,
    blendMode,
    flip: flag(p.imageFlags.flip),
    invert: flag(p.imageFlags.invert),
    antialias: flag(p.imageFlags.antialias),
    color: flag(p.imageFlags.tint) ? data.getUint32(16, true) : null,
    centerSlice: flag(p.imageFlags.center)
      ? Object.freeze({ left: get(72), top: get(80), right: get(88), bottom: get(96) })
      : null,
  });
  const encoded = imageStyleBytes(style);
  for (let i = 0; i < encoded.length; ++i)
    if (encoded[i] !== bytes[i]) throw Error('Image paint style differs');
  const rect = (at: number): readonly [number, number, number, number] => {
    const rect: [number, number, number, number] = [
      get(at),
      get(at + 8),
      get(at + 16),
      get(at + 24),
    ];
    if (rect[2] < 0 || rect[3] < 0) throw Error('Negative image rectangle');
    return Object.freeze(rect);
  };
  const center: [number, number, number, number] = [128, 132, 136, 140].map((at) =>
    data.getInt32(at, true),
  ) as [number, number, number, number];
  if (
    center.some((value) => value < 0 || value > 8192) ||
    center[2] < center[0] ||
    center[3] < center[1] ||
    (!(plan & 4) && center.some(Boolean))
  )
    throw Error('Invalid image paint center');
  const tiles = Array.from({ length: count }, (_, i) =>
    Object.freeze({
      source: rect(p.imagePaintBytes + i * 64),
      destination: rect(p.imagePaintBytes + i * 64 + 32),
    }),
  );
  return Object.freeze({
    style,
    clip: !!(plan & 1),
    flip: !!(plan & 2),
    center: plan & 4 ? Object.freeze(center) : null,
    bounds: rect(144),
    tiles: Object.freeze(tiles),
  });
}
