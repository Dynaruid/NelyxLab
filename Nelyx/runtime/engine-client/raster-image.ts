// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
/** Immutable transport pixels are packed RGBA8888, premultiplied, sRGB. */
export function rasterImageHeader(width: number, height: number): Uint8Array {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height * 4 > p.limits.resourceBytes - p.rasterImageHeaderBytes
  )
    throw Error('Raster image dimension/resource budget exceeded');
  const bytes = new Uint8Array(p.rasterImageHeaderBytes),
    data = new DataView(bytes.buffer);
  for (const [offset, value] of [
    [0, p.rasterImageMagic],
    [4, 1],
    [8, width],
    [12, height],
    [16, width * 4],
    [20, width * height * 4],
    [24, 1],
  ])
    data.setUint32(offset!, value!, true);
  return bytes;
}
export function readRasterImage(
  bytes: Uint8Array,
): { width: number; height: number; rowBytes: number; pixels: Uint8Array } | null {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || data.getUint32(0, true) !== p.rasterImageMagic) return null;
  if (bytes.length < p.rasterImageHeaderBytes) throw Error('Truncated raster image header');
  const width = data.getUint32(8, true),
    height = data.getUint32(12, true),
    header = rasterImageHeader(width, height);
  for (let offset = 0; offset < header.length; ++offset)
    if (header[offset] !== bytes[offset]) throw Error('Invalid raster image header');
  if (bytes.length !== p.rasterImageHeaderBytes + width * height * 4)
    throw Error('Raster image payload length differs');
  return { width, height, rowBytes: width * 4, pixels: bytes.subarray(p.rasterImageHeaderBytes) };
}
