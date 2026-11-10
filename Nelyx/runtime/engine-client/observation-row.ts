// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineNodeSnapshot, NodeHandle, AffineMatrix, TextRect } from './codec.ts';

type Row = { data: DataView; at: number; cache: Record<string, unknown> };
const rows = new WeakMap<object, Row>();
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
    rows.set(this, { data, at, cache: Object.create(null) });
  }
  private f(offset: number): number {
    const r = rows.get(this)!;
    return r.data.getFloat64(r.at + offset, true);
  }
  private u(offset: number): number {
    const r = rows.get(this)!;
    return r.data.getUint32(r.at + offset, true);
  }
  private memo<T>(key: string, read: (r: Row) => T): T {
    const r = rows.get(this)!;
    if (!Object.hasOwn(r.cache, key)) r.cache[key] = read(r);
    return r.cache[key] as T;
  }
  private big(offset: number): bigint {
    return this.memo('u' + offset, (r) => r.data.getBigUint64(r.at + offset, true));
  }
  private rect(offset: number): TextRect {
    return this.memo('r' + offset, () =>
      Object.freeze({
        x: this.f(offset),
        y: this.f(offset + 8),
        width: this.f(offset + 16),
        height: this.f(offset + 24),
      }),
    );
  }
  get parent(): NodeHandle {
    return this.memo('parent', (r) => handle(r.data, r.at + 12));
  }
  get resource(): NodeHandle {
    return this.memo('resource', (r) => handle(r.data, r.at + p.nodeFields.resource));
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
    return this.memo(
      'matrix',
      () =>
        Object.freeze(
          Array.from({ length: 6 }, (_, i) => this.f(p.nodeFields.matrix + i * 8)),
        ) as unknown as AffineMatrix,
    );
  }
  get bounds(): TextRect {
    return this.rect(p.nodeFields.boundsX);
  }
  get content(): TextRect {
    return this.rect(p.nodeFields.contentX);
  }
  get clip(): TextRect {
    return this.rect(p.nodeFields.clipX);
  }
  get preparedCoverage(): EngineNodeSnapshot['preparedCoverage'] {
    return this.memo('coverage', () =>
      this.flags & 128
        ? Object.freeze({
            minimum: this.f(p.nodeFields.preparedMinimum),
            maximum: this.f(p.nodeFields.preparedMaximum),
            revision: this.big(p.nodeFields.coverageRevision),
          })
        : null,
    );
  }
  get x(): number {
    return this.f(24);
  }
  get y(): number {
    return this.f(32);
  }
  get width(): number {
    return this.f(40);
  }
  get height(): number {
    return this.f(48);
  }
  get offset(): number {
    return this.f(56);
  }
  get velocity(): number {
    return this.f(64);
  }
  get opacity(): number {
    return this.f(80);
  }
  get localOpacity(): number {
    return this.f(p.nodeFields.localOpacity);
  }
  get radius(): number {
    return this.f(p.nodeFields.radius);
  }
  get fontSize(): number {
    return this.f(p.nodeFields.fontSize);
  }
  get baseline(): number {
    return this.f(p.nodeFields.baseline);
  }
  get requestedOffset(): number {
    return this.f(p.nodeFields.requestedOffset);
  }
  get scrollMinimum(): number {
    return this.f(p.nodeFields.scrollMinimum);
  }
  get scrollMaximum(): number {
    return this.f(p.nodeFields.scrollMaximum);
  }
  get kind(): number {
    return this.u(8);
  }
  get flags(): number {
    return this.u(20);
  }
  get depth(): number {
    return this.u(p.nodeFields.depth);
  }
  get color(): number {
    return this.u(p.nodeFields.color);
  }
  get order(): number {
    return this.u(p.nodeFields.order);
  }
  get textDirection(): number {
    return this.u(p.nodeFields.textDirection);
  }
  get scrollRevision(): bigint {
    return this.big(72);
  }
  get motion(): bigint {
    return this.big(88);
  }
  get layoutRevision(): bigint {
    return this.big(p.nodeFields.layoutRevision);
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
