// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { EngineBlob, EngineNodeSnapshot, NodeHandle } from './codec.ts';
import { observationBacking, compactObservationRows } from './observation-row.ts';

const key = (node: NodeHandle) => `${node.slot}:${node.generation}`;
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;
  return true;
}
export class ObservationGapError extends Error {}
export interface ProviderFrameCohort {
  readonly submission: bigint;
  readonly document: bigint;
  readonly metrics: bigint;
  readonly device: bigint;
  readonly font: bigint;
  readonly preparation: bigint;
  readonly property: bigint;
  readonly basedOn: bigint;
}
export interface ProviderPreparationCohort {
  readonly preparation: bigint;
  readonly document: bigint;
  readonly metrics: bigint;
  readonly device: bigint;
  readonly font: bigint;
  readonly basedOn: bigint;
  readonly comparedSlots: bigint;
  readonly baseDocument: bigint;
}
export interface ObservationDelta {
  readonly base: bigint;
  readonly version: bigint;
  readonly full: boolean;
  readonly changedRows: number;
  readonly removedRows: number;
  readonly registeredBlobs: number;
  readonly rowVisits: number;
  readonly retainedBytes: bigint;
  readonly frame?: Readonly<ProviderFrameCohort>;
  readonly preparation?: Readonly<ProviderPreparationCohort>;
  readonly cohorts: Readonly<{
    accepted: Readonly<{ document: bigint; metrics: bigint; device: bigint; font: bigint }>;
    active: Readonly<{
      document: bigint;
      metrics: bigint;
      device: bigint;
      font: bigint;
      preparation: bigint;
    }>;
    published: Readonly<{
      document: bigint;
      metrics: bigint;
      device: bigint;
      font: bigint;
      preparation: bigint;
      property: bigint;
      publication: bigint;
    }>;
  }>;
}
type RegisteredBlob = EngineBlob & { readonly registration: bigint };
/** One owner/generation and consistency role. Cached rows are immutable public
 * snapshots; dictionary bytes are private and never exposed to callers. */
export class ObservationStream {
  constructor(private readonly role: 'app' | 'provider-frame' | 'provider-preparation' = 'app') {}
  version = 0n;
  private previousPreparation: Readonly<ProviderPreparationCohort> | undefined;
  private rows = new Map<string, EngineNodeSnapshot>();
  private references = new Map<string, readonly bigint[]>();
  private dictionary = new Map<bigint, RegisteredBlob>();
  private order: readonly string[] = [];
  private current: readonly EngineNodeSnapshot[] = Object.freeze([]);
  private highId = 0n;
  private handles = new Set<string>();
  private readonly backingGroups = new Map<DataView, Set<EngineNodeSnapshot>>();
  private rowGroups = new WeakMap<EngineNodeSnapshot, DataView>();
  readonly counters = {
    fulls: 0,
    deltas: 0,
    unchanged: 0,
    rowWrappers: 0,
    registrations: 0,
    registrationCopyBytes: 0,
    resyncs: 0,
    rowCompactions: 0,
    compactedRows: 0,
    compactedBytes: 0,
  };
  get byteLength(): number {
    let bytes = 0;
    for (const data of this.backingGroups.keys()) bytes += data.byteLength;
    for (const blob of this.dictionary.values()) bytes += blob.bytes.length;
    return bytes;
  }
  registeredIds(): IterableIterator<bigint> {
    return this.dictionary.keys();
  }
  private detachRow(node: EngineNodeSnapshot, affected: Set<DataView>): void {
    const data = this.rowGroups.get(node);
    if (!data) return;
    const group = this.backingGroups.get(data);
    group?.delete(node);
    affected.add(data);
    if (!group?.size) this.backingGroups.delete(data);
    this.rowGroups.delete(node);
  }
  private attachRow(node: EngineNodeSnapshot, affected: Set<DataView>): void {
    const data = observationBacking(node);
    if (!data) return;
    let group = this.backingGroups.get(data);
    if (!group) this.backingGroups.set(data, (group = new Set()));
    group.add(node);
    this.rowGroups.set(node, data);
    affected.add(data);
  }
  private compactRows(affected: Iterable<DataView>, force = false): void {
    for (const data of affected) {
      const group = this.backingGroups.get(data);
      if (!group?.size) continue;
      const size = group.size * p.nodeBytes;
      if (data.byteLength <= (force ? size : size * 2)) continue;
      const nodes = [...group],
        compact = compactObservationRows(nodes);
      this.backingGroups.delete(data);
      this.backingGroups.set(compact, group);
      for (const node of nodes) this.rowGroups.set(node, compact);
      ++this.counters.rowCompactions;
      this.counters.compactedRows += nodes.length;
      this.counters.compactedBytes += size;
    }
  }
  prepare(wireBlobs: readonly EngineBlob[], changes: readonly EngineNodeSnapshot[]) {
    const envelopes = wireBlobs.filter((blob) => blob.type === p.observationDeltaBlob);
    if (envelopes.length !== 1) throw Error('Missing/duplicate observation delta');
    const envelope = envelopes[0]!;
    if (
      envelope.handle.slot ||
      envelope.handle.generation ||
      envelope.bytes.length < p.observationDeltaBytes
    )
      throw Error('Invalid observation delta owner/length');
    const d = new DataView(
      envelope.bytes.buffer,
      envelope.bytes.byteOffset,
      envelope.bytes.byteLength,
    );
    const base = d.getBigUint64(0, true),
      version = d.getBigUint64(8, true),
      flags = d.getUint32(16, true),
      removedCount = d.getUint32(20, true),
      orderCount = d.getUint32(24, true),
      full = !!(flags & 1),
      replaceOrder = !!(flags & 2);
    if (
      flags & ~3 ||
      !version ||
      version < base ||
      (full ? base !== 0n || !replaceOrder : base !== this.version) ||
      version < this.version ||
      removedCount > p.limits.nodes ||
      orderCount > p.limits.nodes ||
      (!replaceOrder && orderCount) ||
      (full && removedCount) ||
      envelope.bytes.length !== p.observationDeltaBytes + (removedCount + orderCount) * 8 ||
      d.getBigUint64(40, true) > BigInt(p.limits.observationBytes)
    )
      throw new ObservationGapError('Observation version/owner or order gap; full resync required');
    const readKeys = (offset: number, count: number) => {
      const keys: string[] = [],
        seen = new Set<string>();
      for (let i = 0; i < count; ++i) {
        const at = offset + i * 8,
          node = { slot: d.getUint32(at, true), generation: d.getUint32(at + 4, true) };
        const id = key(node);
        if (!node.slot || node.slot > p.limits.nodes || !node.generation || seen.has(id))
          throw Error('Invalid/duplicate observation handle');
        seen.add(id);
        keys.push(id);
      }
      return keys;
    };
    const cohort = (at: number) =>
      Object.freeze({
        document: d.getBigUint64(at, true),
        metrics: d.getBigUint64(at + 8, true),
        device: d.getBigUint64(at + 16, true),
        font: d.getBigUint64(at + 24, true),
      });
    const frameBlobs = wireBlobs.filter((blob) => blob.type === p.providerFrameBlob);
    const preparationBlobs = wireBlobs.filter((blob) => blob.type === p.providerPreparationBlob);
    if (
      frameBlobs.length !== (this.role === 'provider-frame' ? 1 : 0) ||
      preparationBlobs.length !== (this.role === 'provider-preparation' ? 1 : 0)
    )
      throw Error('Observation consistency role differs');
    let frame: Readonly<ProviderFrameCohort> | undefined;
    if (frameBlobs.length) {
      const blob = frameBlobs[0]!;
      if (blob.handle.slot || blob.handle.generation || blob.bytes.length !== p.providerFrameBytes)
        throw Error('Invalid provider frame cohort');
      const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength);
      frame = Object.freeze({
        submission: data.getBigUint64(0, true),
        document: data.getBigUint64(8, true),
        metrics: data.getBigUint64(16, true),
        device: data.getBigUint64(24, true),
        font: data.getBigUint64(32, true),
        preparation: data.getBigUint64(40, true),
        property: data.getBigUint64(48, true),
        basedOn: data.getBigUint64(56, true),
      });
      if (
        !frame.submission ||
        !frame.metrics ||
        !frame.device ||
        !frame.font ||
        frame.basedOn >= frame.submission
      )
        throw Error('Invalid provider frame identity');
    }
    let preparation: Readonly<ProviderPreparationCohort> | undefined;
    if (preparationBlobs.length) {
      const blob = preparationBlobs[0]!;
      if (
        blob.handle.slot ||
        blob.handle.generation ||
        blob.bytes.length !== p.providerPreparationBytes
      )
        throw Error('Invalid provider preparation cohort');
      const data = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength);
      preparation = Object.freeze({
        preparation: data.getBigUint64(0, true),
        document: data.getBigUint64(8, true),
        metrics: data.getBigUint64(16, true),
        device: data.getBigUint64(24, true),
        font: data.getBigUint64(32, true),
        basedOn: data.getBigUint64(40, true),
        comparedSlots: data.getBigUint64(48, true),
        baseDocument: data.getBigUint64(56, true),
      });
      if (
        !preparation.preparation ||
        !preparation.metrics ||
        !preparation.device ||
        !preparation.font ||
        preparation.basedOn > preparation.preparation ||
        preparation.comparedSlots > BigInt(p.limits.nodes + 1)
      )
        throw Error('Invalid provider preparation identity');
      if (
        !full &&
        (preparation.basedOn !== this.previousPreparation?.preparation ||
          preparation.baseDocument !== this.previousPreparation.document)
      )
        throw new ObservationGapError('Preparation dictionary candidate gap; full resync required');
    }
    const cohorts = Object.freeze({
      accepted: cohort(48),
      active: Object.freeze({ ...cohort(80), preparation: d.getBigUint64(112, true) }),
      published: Object.freeze({
        ...cohort(120),
        preparation: d.getBigUint64(152, true),
        property: d.getBigUint64(160, true),
        publication: d.getBigUint64(168, true),
      }),
    });
    if (
      !cohorts.accepted.metrics ||
      !cohorts.accepted.device ||
      !cohorts.accepted.font ||
      (cohorts.active.preparation &&
        (!cohorts.active.metrics || !cohorts.active.device || !cohorts.active.font)) ||
      (cohorts.published.publication &&
        (!cohorts.published.metrics || !cohorts.published.device || !cohorts.published.font))
    )
      throw Error('Invalid observation consistency cohort');
    if (
      !full &&
      (changes.length || removedCount || replaceOrder ? version <= base : version !== base)
    )
      throw new ObservationGapError('Observation version did not describe its changes');
    if (!full && !replaceOrder && !removedCount && !changes.length) {
      if (
        d.getUint32(32, true) ||
        wireBlobs.some(
          (blob) =>
            blob.type === p.observationReferencesBlob ||
            blob.type === p.observationRegistrationBlob,
        )
      )
        throw Error('Unchanged observation supplied registrations');
      const metadata: ObservationDelta = Object.freeze({
        base,
        version,
        full: false,
        changedRows: 0,
        removedRows: 0,
        registeredBlobs: 0,
        rowVisits: d.getUint32(28, true),
        retainedBytes: d.getBigUint64(40, true),
        cohorts,
        ...(frame ? { frame } : {}),
        ...(preparation ? { preparation } : {}),
      });
      return {
        metadata,
        blobs: wireBlobs.filter((blob) => blob.type !== p.observationDeltaBlob),
        handles: this.handles,
        merge: () => this.current,
        commit: () => {
          this.previousPreparation = preparation;
          ++this.counters.deltas;
          ++this.counters.unchanged;
        },
      };
    }
    const removed = readKeys(p.observationDeltaBytes, removedCount);
    const order = replaceOrder
      ? readKeys(p.observationDeltaBytes + removedCount * 8, orderCount)
      : this.order;
    const rowKeys = new Set<string>();
    for (const row of changes) {
      const id = key(row.node);
      if (rowKeys.has(id)) throw Error('Duplicate observation row');
      rowKeys.add(id);
    }
    const dictionary = new Map<bigint, RegisteredBlob>();
    let registeredBytes = 0,
      registrationCopyBytes = 0;
    for (const blob of wireBlobs)
      if (blob.type === p.observationRegistrationBlob) {
        if (blob.bytes.length < 16) throw Error('Truncated immutable observation registration');
        const b = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
          id = b.getBigUint64(0, true),
          type = b.getUint32(8, true),
          length = b.getUint32(12, true);
        if (
          !id ||
          dictionary.has(id) ||
          length !== blob.bytes.length - 16 ||
          !blob.handle.slot ||
          !blob.handle.generation ||
          !(this.role !== 'app'
            ? (
                [
                  ...(this.role === 'provider-preparation' ? [1] : []),
                  4,
                  5,
                  7,
                  10,
                  11,
                  12,
                  13,
                  p.layerCompositionBlob,
                  p.paintPlacementBlob,
                  p.fontBindingBlob,
                  p.imagePaintBlob,
                  p.snapshotStyleBlob,
                ] as readonly number[]
              ).includes(type)
            : (type >= 3 && type <= 7) ||
              (
                [
                  p.layerCompositionBlob,
                  p.layoutBuilderBlob,
                  p.semanticGeometryBlob,
                  p.semanticTraversalBlob,
                ] as readonly number[]
              ).includes(type))
        )
          throw Error('Invalid immutable observation registration');
        const bytes = blob.bytes.subarray(16),
          old = this.dictionary.get(id);
        if (!old && id <= this.highId) throw Error('Retired immutable observation ID reused');
        if (
          old &&
          (old.type !== type || key(old.handle) !== key(blob.handle) || !same(old.bytes, bytes))
        )
          throw Error('Immutable observation ID reused');
        dictionary.set(
          id,
          old ??
            Object.freeze({ registration: id, type, handle: blob.handle, bytes: bytes.slice() }),
        );
        if (!old) registrationCopyBytes += bytes.length;
        registeredBytes += bytes.length;
      }
    if (dictionary.size !== d.getUint32(32, true) || registeredBytes > p.limits.observationBytes)
      throw Error('Observation registration budget/count differs');
    const references = new Map<string, readonly bigint[]>();
    const expanded: EngineBlob[] = wireBlobs.filter(
      (blob) =>
        !(
          [
            p.observationDeltaBlob,
            p.observationReferencesBlob,
            p.observationRegistrationBlob,
          ] as readonly number[]
        ).includes(blob.type),
    );
    for (const blob of wireBlobs)
      if (blob.type === p.observationReferencesBlob) {
        const owner = key(blob.handle);
        if (
          !rowKeys.has(owner) ||
          references.has(owner) ||
          blob.bytes.length % 8 ||
          blob.bytes.length > p.limits.nodeBlobs * 8
        )
          throw Error('Invalid observation row references');
        const b = new DataView(blob.bytes.buffer, blob.bytes.byteOffset, blob.bytes.byteLength),
          ids: bigint[] = [],
          types = new Set<number>();
        for (let at = 0; at < blob.bytes.length; at += 8) {
          const id = b.getBigUint64(at, true),
            value = dictionary.get(id) ?? (!full ? this.dictionary.get(id) : undefined);
          if (!value || key(value.handle) !== owner || types.has(value.type))
            throw new ObservationGapError('Missing/foreign immutable observation ID');
          ids.push(id);
          types.add(value.type);
          expanded.push(value);
        }
        references.set(owner, Object.freeze(ids));
      }
    if (references.size !== rowKeys.size) throw Error('Missing observation row manifest');
    const members = new Set(full ? [] : this.rows.keys());
    for (const id of removed) {
      if (!members.delete(id) || rowKeys.has(id)) throw Error('Foreign observation tombstone');
    }
    for (const id of rowKeys) members.add(id);
    if (order.length !== members.size || order.some((id) => !members.has(id)))
      throw Error('Observation order/membership differs');
    const metadata: ObservationDelta = Object.freeze({
      base,
      version,
      full,
      changedRows: changes.length,
      removedRows: removedCount,
      registeredBlobs: dictionary.size,
      rowVisits: d.getUint32(28, true),
      retainedBytes: d.getBigUint64(40, true),
      cohorts,
      ...(frame ? { frame } : {}),
      ...(preparation ? { preparation } : {}),
    });
    let merged: readonly EngineNodeSnapshot[] | undefined;
    let nextRows: Map<string, EngineNodeSnapshot> | undefined;
    return {
      metadata,
      blobs: expanded,
      handles: members,
      merge: (changed: readonly EngineNodeSnapshot[]): readonly EngineNodeSnapshot[] => {
        if (!full && !changed.length && !removed.length && !replaceOrder) {
          merged = this.current;
          return merged;
        }
        nextRows = new Map(full ? [] : this.rows);
        for (const id of removed) nextRows.delete(id);
        for (const row of changed) nextRows.set(key(row.node), row);
        merged = Object.freeze(order.map((id) => nextRows!.get(id)!));
        return merged;
      },
      commit: () => {
        if (!merged) throw Error('Observation rows were not validated');
        const affected = new Set<DataView>();
        if (full) {
          this.backingGroups.clear();
          this.rowGroups = new WeakMap();
        } else
          for (const id of [...removed, ...rowKeys]) {
            const previous = this.rows.get(id);
            if (previous) this.detachRow(previous, affected);
          }
        for (const node of changes) this.attachRow(node, affected);
        if (nextRows) this.rows = nextRows;
        if (full) this.references.clear();
        for (const id of removed) this.references.delete(id);
        for (const [id, ids] of references) this.references.set(id, ids);
        const live = new Set<bigint>();
        for (const ids of this.references.values()) for (const id of ids) live.add(id);
        for (const id of this.dictionary.keys()) if (!live.has(id)) this.dictionary.delete(id);
        for (const [id, blob] of dictionary) if (live.has(id)) this.dictionary.set(id, blob);
        for (const id of dictionary.keys()) if (id > this.highId) this.highId = id;
        this.compactRows(affected);
        if (this.byteLength > p.limits.observationBytes)
          this.compactRows([...this.backingGroups.keys()], true);
        this.order = order;
        this.handles = members;
        this.current = merged;
        this.version = version;
        this.previousPreparation = preparation;
        ++this.counters[full ? 'fulls' : 'deltas'];
        if (!changes.length && !removed.length) ++this.counters.unchanged;
        this.counters.rowWrappers += changes.length;
        this.counters.registrations += dictionary.size;
        this.counters.registrationCopyBytes += registrationCopyBytes;
      },
    };
  }
  clear(): void {
    this.version = 0n;
    this.previousPreparation = undefined;
    this.highId = 0n;
    this.handles.clear();
    this.backingGroups.clear();
    this.rowGroups = new WeakMap();
    this.rows.clear();
    this.references.clear();
    this.dictionary.clear();
    this.order = [];
    this.current = Object.freeze([]);
  }
}
