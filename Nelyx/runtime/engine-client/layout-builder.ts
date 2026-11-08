// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { AxisBound, NodeHandle } from './codec.ts';

export interface LayoutBuilderOptions {
  readonly revision: bigint;
  readonly built?: {
    readonly revision: bigint;
    readonly horizontal: AxisBound;
    readonly vertical: AxisBound;
  };
}
export interface LayoutBuildRequest {
  readonly list?: {
    readonly count: number;
    readonly begin: number;
    readonly end: number;
    readonly offset: number;
    readonly beginOffset: number;
    readonly paintExtent: number;
    readonly rows: readonly {
      readonly index: number;
      readonly token: bigint;
      readonly offset: number;
      readonly extent: number;
    }[];
  };
  readonly node: NodeHandle;
  readonly preparation: bigint;
  readonly document: bigint;
  readonly metrics: bigint;
  readonly device: bigint;
  readonly revision: bigint;
  readonly id: bigint;
  readonly horizontal: AxisBound;
  readonly vertical: AxisBound;
}
const integer = (value: bigint): bigint => {
  if (typeof value !== 'bigint' || value < 0n || value > 0xffffffffffffffffn)
    throw RangeError('Invalid layout builder revision');
  return value;
};
function writeAxis(v: DataView, at: number, value?: AxisBound): void {
  if (value?.kind === 'expand') throw RangeError('Invalid layout builder input');
  const min = value?.min ?? 0,
    max = value?.kind === 'finite' ? value.max : 0;
  if (
    (value && !['finite', 'unbounded'].includes(value.kind)) ||
    !Number.isFinite(min) ||
    min < 0 ||
    min > 1e12 ||
    !Number.isFinite(max) ||
    max < 0 ||
    max > 1e12 ||
    (value?.kind === 'finite' && max < min)
  )
    throw RangeError('Invalid layout builder input');
  v.setUint32(at, value?.kind === 'unbounded' ? p.bounds.unbounded : p.bounds.finite, true);
  v.setFloat64(at + 8, min, true);
  v.setFloat64(at + 16, max, true);
}
function readAxis(v: DataView, at: number): AxisBound {
  const tag = v.getUint32(at, true),
    min = v.getFloat64(at + 8, true),
    max = v.getFloat64(at + 16, true);
  if (
    v.getUint32(at + 4, true) ||
    ![p.bounds.finite, p.bounds.unbounded].includes(tag as 0) ||
    !Number.isFinite(min) ||
    min < 0 ||
    min > 1e12 ||
    !Number.isFinite(max) ||
    max < 0 ||
    max > 1e12 ||
    (tag === p.bounds.finite ? max < min : max !== 0)
  )
    throw Error('Invalid layout builder input');
  return Object.freeze(
    tag === p.bounds.finite ? { kind: 'finite', min, max } : { kind: 'unbounded', min },
  );
}
export function layoutBuilderBytes(value?: LayoutBuilderOptions | null): Uint8Array {
  if (!value) return new Uint8Array();
  const revision = integer(value.revision),
    built = integer(value.built?.revision ?? 0n);
  if (!revision || built > revision || (!!value.built && !built))
    throw RangeError('Invalid layout builder revision');
  if (value.built && (!value.built.horizontal || !value.built.vertical))
    throw RangeError('Missing layout builder input');
  const bytes = new Uint8Array(p.layoutBuilderBytes),
    v = new DataView(bytes.buffer);
  v.setBigUint64(0, revision, true);
  v.setBigUint64(8, built, true);
  writeAxis(v, 16, value.built?.horizontal);
  writeAxis(v, 40, value.built?.vertical);
  return bytes;
}
export function readLayoutBuilder(bytes: Uint8Array): LayoutBuilderOptions {
  if (bytes.length !== p.layoutBuilderBytes) throw Error('Invalid layout builder style size');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    revision = v.getBigUint64(0, true),
    built = v.getBigUint64(8, true),
    horizontal = readAxis(v, 16),
    vertical = readAxis(v, 40);
  if (!revision || built > revision || (!built && bytes.subarray(16).some((value) => value !== 0)))
    throw Error('Invalid layout builder revision');
  return Object.freeze({
    revision,
    ...(built ? { built: Object.freeze({ revision: built, horizontal, vertical }) } : {}),
  });
}
export function readLayoutBuildRequest(bytes: Uint8Array, node: NodeHandle): LayoutBuildRequest {
  if (
    (bytes.length !== p.layoutBuildRequestBytes &&
      (bytes.length < p.layoutListBuildRequestBytes ||
        bytes.length >
          p.layoutListBuildRequestBytes + p.limits.listChildren * p.layoutListBuildRowBytes)) ||
    !node.slot ||
    !node.generation ||
    node.slot > p.limits.nodes
  )
    throw Error('Invalid layout build request size/owner');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    values = Array.from({ length: 6 }, (_, index) => v.getBigUint64(index * 8, true));
  if (values.some((value) => !value)) throw Error('Invalid layout build request identity');
  const horizontal = readAxis(v, 48),
    vertical = readAxis(v, 72);
  let list: LayoutBuildRequest['list'];
  if (bytes.length !== p.layoutBuildRequestBytes) {
    const begin = v.getUint32(120, true),
      end = v.getUint32(124, true),
      count = v.getUint32(136, true),
      length = v.getUint32(128, true);
    const offset = v.getFloat64(96, true),
      beginOffset = v.getFloat64(104, true),
      paintExtent = v.getFloat64(112, true);
    if (
      horizontal.kind !== 'finite' ||
      vertical.kind !== 'finite' ||
      horizontal.min !== 0 ||
      vertical.min !== 0 ||
      count > 1_000_000 ||
      begin > end ||
      end > count ||
      end - begin > p.limits.listChildren ||
      length > p.limits.listChildren ||
      bytes.length !== p.layoutListBuildRequestBytes + length * p.layoutListBuildRowBytes ||
      v.getUint32(132, true) ||
      v.getUint32(140, true) ||
      ![offset, beginOffset, paintExtent].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 1e12,
      ) ||
      paintExtent > vertical.max
    )
      throw Error('Invalid native list build input');
    const indices = new Set<number>(),
      tokens = new Set<bigint>();
    const rows = Array.from({ length }, (_, i) => {
      const at = p.layoutListBuildRequestBytes + i * p.layoutListBuildRowBytes;
      const index = v.getUint32(at, true),
        token = v.getBigUint64(at + 8, true),
        offset = v.getFloat64(at + 16, true),
        extent = v.getFloat64(at + 24, true);
      if (
        v.getUint32(at + 4, true) ||
        index >= count ||
        !token ||
        indices.has(index) ||
        tokens.has(token) ||
        ![offset, extent].every((value) => Number.isFinite(value) && value >= 0 && value <= 1e12)
      )
        throw Error('Invalid native list build row');
      indices.add(index);
      tokens.add(token);
      return Object.freeze({ index, token, offset, extent });
    });
    list = Object.freeze({
      count,
      begin,
      end,
      offset,
      beginOffset,
      paintExtent,
      rows: Object.freeze(rows),
    });
  }
  return Object.freeze({
    ...(list ? { list } : {}),
    node,
    preparation: values[0]!,
    document: values[1]!,
    metrics: values[2]!,
    device: values[3]!,
    revision: values[4]!,
    id: values[5]!,
    horizontal,
    vertical,
  });
}
