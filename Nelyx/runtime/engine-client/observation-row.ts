// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineNodeSnapshot, NodeHandle, AffineMatrix, TextRect } from './codec.ts';

type Row = { data: DataView; at: number; cache?: Record<string, unknown> };
const rows = new WeakMap<object, Row>();
/** @internal Retained deltas must not pin a large transport packet for a few
 * surviving rows. Relocation changes storage only, never snapshot values or
 * row identity, including values already materialized by lazy getters. */
export function observationBacking(node: EngineNodeSnapshot): DataView | undefined {
  return rows.get(node)?.data;
}
export function compactObservationRows(nodes: readonly EngineNodeSnapshot[]): DataView {
  const bytes = new Uint8Array(nodes.length * p.nodeBytes),
    data = new DataView(bytes.buffer);
  nodes.forEach((node, index) => {
    const row = rows.get(node);
    if (!row) throw Error('Only owned observation rows can be compacted');
    bytes.set(
      new Uint8Array(row.data.buffer, row.data.byteOffset + row.at, p.nodeBytes),
      index * p.nodeBytes,
    );
  });
  nodes.forEach((node, index) => {
    const row = rows.get(node)!;
    row.data = data;
    row.at = index * p.nodeBytes;
  });
  return data;
}
const scalarOffsets = [
  24,
  32,
  40,
  48,
  56,
  64,
  80,
  p.nodeFields.localOpacity,
  p.nodeFields.radius,
  p.nodeFields.fontSize,
  p.nodeFields.baseline,
  p.nodeFields.requestedOffset,
  p.nodeFields.scrollMinimum,
  p.nodeFields.scrollMaximum,
  ...Array.from({ length: 6 }, (_, i) => p.nodeFields.matrix + i * 8),
  p.nodeFields.boundsX,
  p.nodeFields.boundsY,
  p.nodeFields.boundsWidth,
  p.nodeFields.boundsHeight,
  p.nodeFields.contentX,
  p.nodeFields.contentY,
  p.nodeFields.contentWidth,
  p.nodeFields.contentHeight,
  p.nodeFields.clipX,
  p.nodeFields.clipY,
  p.nodeFields.clipWidth,
  p.nodeFields.clipHeight,
];
function handle(data: DataView, at: number): NodeHandle {
  return Object.freeze({
    slot: data.getUint32(at, true),
    generation: data.getUint32(at + 4, true),
  });
}
// These readers belong to this module's private rows, not the public snapshot
// interface. Direct calls let the compiler inline reads without a second
// virtual method lookup; every getter still reads its current backing/cache.
function rowScalar(node: object, offset: number): number {
  const r = rows.get(node)!;
  return r.data.getFloat64(r.at + offset, true);
}
function rowUnsigned(node: object, offset: number): number {
  const r = rows.get(node)!;
  return r.data.getUint32(r.at + offset, true);
}
function rowHandle(node: object, offset: number, key: string): NodeHandle {
  const r = rows.get(node)!,
    cache = (r.cache ??= Object.create(null));
  return (cache[key] ??= handle(r.data, r.at + offset)) as NodeHandle;
}
function rowBig(node: object, offset: number): bigint {
  const r = rows.get(node)!,
    cache = (r.cache ??= Object.create(null)),
    key = 'u' + offset;
  return (cache[key] ??= r.data.getBigUint64(r.at + offset, true)) as bigint;
}
function rowRect(node: object, offset: number): TextRect {
  const r = rows.get(node)!,
    cache = (r.cache ??= Object.create(null)),
    key = 'r' + offset;
  return (cache[key] ??= Object.freeze({
    x: r.data.getFloat64(r.at + offset, true),
    y: r.data.getFloat64(r.at + offset + 8, true),
    width: r.data.getFloat64(r.at + offset + 16, true),
    height: r.data.getFloat64(r.at + offset + 24, true),
  })) as TextRect;
}
/** App-only projection over a private packet copy. Validation is eager; object
 * and BigInt materialization is demand-driven. The renderer keeps eager rows. */
class ObservationRow implements EngineNodeSnapshot {
  readonly node: NodeHandle;
  constructor(data: DataView, at: number, validate: (value: number) => number) {
    for (const offset of scalarOffsets) validate(data.getFloat64(at + offset, true));
    if (data.getUint32(at + 20, true) & 128) {
      validate(data.getFloat64(at + p.nodeFields.preparedMinimum, true));
      validate(data.getFloat64(at + p.nodeFields.preparedMaximum, true));
    }
    this.node = handle(data, at);
    rows.set(this, { data, at });
  }
  get parent(): NodeHandle {
    return rowHandle(this, 12, 'parent');
  }
  get resource(): NodeHandle {
    return rowHandle(this, p.nodeFields.resource, 'resource');
  }
  get hasFocus(): boolean {
    return !!(this.flags & 256);
  }
  get caretVisible(): boolean {
    return !!(this.flags & 512);
  }
  get deferred(): boolean {
    return !!(this.flags & 64);
  }
  get matrix(): AffineMatrix {
    const r = rows.get(this)!,
      cache = (r.cache ??= Object.create(null)),
      at = r.at + p.nodeFields.matrix;
    return (cache.matrix ??= Object.freeze([
      r.data.getFloat64(at, true),
      r.data.getFloat64(at + 8, true),
      r.data.getFloat64(at + 16, true),
      r.data.getFloat64(at + 24, true),
      r.data.getFloat64(at + 32, true),
      r.data.getFloat64(at + 40, true),
    ])) as AffineMatrix;
  }
  get bounds(): TextRect {
    return rowRect(this, p.nodeFields.boundsX);
  }
  get content(): TextRect {
    return rowRect(this, p.nodeFields.contentX);
  }
  get clip(): TextRect {
    return rowRect(this, p.nodeFields.clipX);
  }
  get preparedCoverage(): EngineNodeSnapshot['preparedCoverage'] {
    const r = rows.get(this)!,
      cache = (r.cache ??= Object.create(null));
    // Null is an observed absence, so do not reconstruct it on every read.
    if (cache.coverage === undefined)
      cache.coverage =
        r.data.getUint32(r.at + 20, true) & 128
          ? Object.freeze({
              minimum: r.data.getFloat64(r.at + p.nodeFields.preparedMinimum, true),
              maximum: r.data.getFloat64(r.at + p.nodeFields.preparedMaximum, true),
              revision: rowBig(this, p.nodeFields.coverageRevision),
            })
          : null;
    return cache.coverage as EngineNodeSnapshot['preparedCoverage'];
  }
  get x(): number {
    return rowScalar(this, 24);
  }
  get y(): number {
    return rowScalar(this, 32);
  }
  get width(): number {
    return rowScalar(this, 40);
  }
  get height(): number {
    return rowScalar(this, 48);
  }
  get offset(): number {
    return rowScalar(this, 56);
  }
  get velocity(): number {
    return rowScalar(this, 64);
  }
  get opacity(): number {
    return rowScalar(this, 80);
  }
  get localOpacity(): number {
    return rowScalar(this, p.nodeFields.localOpacity);
  }
  get radius(): number {
    return rowScalar(this, p.nodeFields.radius);
  }
  get fontSize(): number {
    return rowScalar(this, p.nodeFields.fontSize);
  }
  get baseline(): number {
    return rowScalar(this, p.nodeFields.baseline);
  }
  get requestedOffset(): number {
    return rowScalar(this, p.nodeFields.requestedOffset);
  }
  get scrollMinimum(): number {
    return rowScalar(this, p.nodeFields.scrollMinimum);
  }
  get scrollMaximum(): number {
    return rowScalar(this, p.nodeFields.scrollMaximum);
  }
  get kind(): number {
    return rowUnsigned(this, 8);
  }
  get flags(): number {
    return rowUnsigned(this, 20);
  }
  get depth(): number {
    return rowUnsigned(this, p.nodeFields.depth);
  }
  get color(): number {
    return rowUnsigned(this, p.nodeFields.color);
  }
  get order(): number {
    return rowUnsigned(this, p.nodeFields.order);
  }
  get textDirection(): number {
    return rowUnsigned(this, p.nodeFields.textDirection);
  }
  get scrollRevision(): bigint {
    return rowBig(this, 72);
  }
  get motion(): bigint {
    return rowBig(this, 88);
  }
  get layoutRevision(): bigint {
    return rowBig(this, p.nodeFields.layoutRevision);
  }
  declare readonly layoutBuilder: EngineNodeSnapshot['layoutBuilder'];
  declare readonly snapshot: EngineNodeSnapshot['snapshot'];
  declare readonly imagePaint: EngineNodeSnapshot['imagePaint'];
  declare readonly fontBinding: EngineNodeSnapshot['fontBinding'];
  declare readonly layerComposition: EngineNodeSnapshot['layerComposition'];
  declare readonly nativePaint: EngineNodeSnapshot['nativePaint'];
  declare readonly paragraph: EngineNodeSnapshot['paragraph'];
  declare readonly paintPlacement: Exclude<EngineNodeSnapshot['paintPlacement'], undefined>;
  declare readonly graphics: EngineNodeSnapshot['graphics'];
  declare readonly clipStyle: EngineNodeSnapshot['clipStyle'];
  declare readonly control: EngineNodeSnapshot['control'];
  declare readonly list: EngineNodeSnapshot['list'];
  declare readonly editing: EngineNodeSnapshot['editing'];
  declare readonly textGeometry: EngineNodeSnapshot['textGeometry'];
  declare readonly semantics: EngineNodeSnapshot['semantics'];
  declare readonly semanticTraversal: EngineNodeSnapshot['semanticTraversal'];
  declare readonly semanticGeometry: Exclude<EngineNodeSnapshot['semanticGeometry'], undefined>;
}
Object.assign(ObservationRow.prototype, {
  layoutBuilder: null,
  snapshot: null,
  imagePaint: null,
  fontBinding: null,
  layerComposition: null,
  nativePaint: null,
  paragraph: null,
  paintPlacement: null,
  graphics: null,
  clipStyle: null,
  control: null,
  list: null,
  editing: null,
  textGeometry: null,
  semantics: null,
  semanticTraversal: null,
  semanticGeometry: null,
});
export function readObservationRow(
  data: DataView,
  at: number,
  validate: (value: number) => number,
): EngineNodeSnapshot {
  return new ObservationRow(data, at, validate);
}
