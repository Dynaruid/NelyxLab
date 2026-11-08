// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type {
  NativeSnapshotConfiguration,
  NativeSnapshotPaint,
} from '@nelyx/core/internal/framework/rendering/native-snapshot';
import type { AffineMatrix, NodeHandle } from './codec.ts';
export type { NativeSnapshotConfiguration } from '@nelyx/core/internal/framework/rendering/native-snapshot';
function scalar(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw Error('Invalid snapshot scalar');
  return value;
}
const modes = ['normal', 'permissive', 'forced'] as const;
function paintBytes(v: DataView, at: number, paint: NativeSnapshotPaint = {}, live: boolean): void {
  if (
    (paint.sizing && !['stretch', 'intrinsic'].includes(paint.sizing)) ||
    (live && paint.sizing === 'intrinsic')
  )
    throw Error('Invalid snapshot sizing');
  const opacity = scalar(paint.opacity ?? 1),
    color = paint.backgroundColor ?? 0;
  if (opacity < 0 || opacity > 1 || !Number.isInteger(color) || color < 0 || color > 0xffffffff)
    throw Error('Invalid snapshot paint');
  [
    paint.scaleX ?? 1,
    paint.scaleY ?? 1,
    paint.translateXFactor ?? 0,
    paint.translateYFactor ?? 0,
    paint.offsetX ?? 0,
    paint.offsetY ?? 0,
    opacity,
  ].forEach((x, i) => v.setFloat64(at + i * 8, scalar(x), true));
  v.setUint32(at + 56, color, true);
  v.setUint32(at + 60, paint.sizing === 'intrinsic' ? 1 : 0, true);
}
export function snapshotStyleBytes(style?: NativeSnapshotConfiguration | null): Uint8Array {
  const bytes = new Uint8Array(p.snapshotStyleBytes),
    v = new DataView(bytes.buffer);
  if (!style) return bytes;
  const mode = modes.indexOf(style.mode),
    ratio = scalar(style.pixelRatio);
  if (
    mode < 0 ||
    style.revision <= 0n ||
    style.revision > 0xffffffffffffffffn ||
    ratio <= 0 ||
    ratio > 64
  )
    throw Error('Invalid snapshot configuration');
  v.setUint32(0, 4 | (style.enabled ? 1 : 0) | (style.autoresize ? 2 : 0), true);
  v.setUint32(4, mode, true);
  v.setBigUint64(8, style.revision, true);
  v.setFloat64(16, ratio, true);
  paintBytes(v, 32, style.live, true);
  paintBytes(v, 96, style.snapshot, false);
  return bytes;
}
export function readSnapshotStyle(bytes: Uint8Array): NativeSnapshotConfiguration {
  if (bytes.length !== p.snapshotStyleBytes) throw Error('Invalid snapshot style size');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    flags = v.getUint32(0, true),
    mode = v.getUint32(4, true);
  if (flags & ~7 || !(flags & 4) || mode > 2 || v.getBigUint64(24, true))
    throw Error('Invalid snapshot style flags');
  const paint = (at: number): NativeSnapshotPaint => {
    const values = Array.from({ length: 7 }, (_, i) => scalar(v.getFloat64(at + i * 8, true))),
      sizing = v.getUint32(at + 60, true);
    if (sizing > (at === 32 ? 0 : 1) || values[6]! < 0 || values[6]! > 1)
      throw Error('Invalid snapshot paint');
    return Object.freeze({
      scaleX: values[0]!,
      scaleY: values[1]!,
      translateXFactor: values[2]!,
      translateYFactor: values[3]!,
      offsetX: values[4]!,
      offsetY: values[5]!,
      opacity: values[6]!,
      backgroundColor: v.getUint32(at + 56, true),
      sizing: sizing ? 'intrinsic' : 'stretch',
    });
  };
  const result: NativeSnapshotConfiguration = Object.freeze({
    revision: v.getBigUint64(8, true),
    enabled: !!(flags & 1),
    autoresize: !!(flags & 2),
    mode: modes[mode]!,
    pixelRatio: scalar(v.getFloat64(16, true)),
    live: paint(32),
    snapshot: paint(96),
  });
  if (result.revision <= 0n || result.pixelRatio <= 0 || result.pixelRatio > 64)
    throw Error('Invalid snapshot style');
  return result;
}
/** Geometry and cache eligibility are already resolved by Content/Core. */
export interface SnapshotDecision {
  readonly token: bigint;
  readonly action: 0 | 1 | 2 | 3;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly ratio: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly matrix: AffineMatrix;
  readonly opacity: number;
  readonly background: number;
  readonly sourceRectWidth: number;
  readonly sourceRectHeight: number;
  readonly destinationWidth: number;
  readonly destinationHeight: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly liveTokens: ReadonlySet<bigint>;
}
export function readSnapshotDecision(bytes: Uint8Array): SnapshotDecision {
  if (bytes.length < p.snapshotDecisionBytes) throw Error('Invalid snapshot decision size');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = v.getUint32(12, true),
    action = v.getUint32(8, true),
    token = v.getBigUint64(0, true),
    f = (at: number) => scalar(v.getFloat64(at, true));
  if (
    count > 64 ||
    bytes.length !== p.snapshotDecisionBytes + count * 8 ||
    action > 3 ||
    v.getUint32(108, true)
  )
    throw Error('Invalid snapshot decision');
  const liveTokens = new Set<bigint>();
  for (let i = 0; i < count; ++i) {
    const value = v.getBigUint64(p.snapshotDecisionBytes + i * 8, true);
    if (!value || liveTokens.has(value)) throw Error('Invalid snapshot live token');
    liveTokens.add(value);
  }
  const result: SnapshotDecision = Object.freeze({
    token,
    action: action as 0 | 1 | 2 | 3,
    sourceWidth: f(16),
    sourceHeight: f(24),
    ratio: f(32),
    pixelWidth: v.getUint32(40, true),
    pixelHeight: v.getUint32(44, true),
    matrix: Object.freeze(
      Array.from({ length: 6 }, (_, i) => f(48 + i * 8)),
    ) as unknown as AffineMatrix,
    opacity: f(96),
    background: v.getUint32(104, true),
    sourceRectWidth: f(112),
    sourceRectHeight: f(120),
    destinationWidth: f(128),
    destinationHeight: f(136),
    boxWidth: f(144),
    boxHeight: f(152),
    liveTokens,
  });
  const cached = action === 1 || action === 2;
  if (
    result.opacity < 0 ||
    result.opacity > 1 ||
    result.ratio <= 0 ||
    result.sourceWidth < 0 ||
    result.sourceHeight < 0 ||
    result.boxWidth < 0 ||
    result.boxHeight < 0 ||
    result.destinationWidth < 0 ||
    result.destinationHeight < 0 ||
    result.sourceRectWidth < 0 ||
    result.sourceRectHeight < 0 ||
    result.pixelWidth > 8192 ||
    result.pixelHeight > 8192 ||
    result.pixelWidth * result.pixelHeight > 16777216 ||
    (cached
      ? !token ||
        !liveTokens.has(token) ||
        !result.pixelWidth ||
        !result.pixelHeight ||
        result.sourceWidth <= 0 ||
        result.sourceHeight <= 0
      : !!token || !!result.pixelWidth || !!result.pixelHeight)
  )
    throw Error('Invalid snapshot decision bounds');
  return result;
}
/** Render's synchronous Core connection; no Source painter hooks execute here. */
export type SnapshotAccess = (
  frame: bigint,
  phase: 0 | 1 | 2 | 3,
  node?: NodeHandle,
  token?: bigint,
) => SnapshotDecision | null;
