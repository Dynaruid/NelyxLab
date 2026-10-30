import { generation } from '../foundation/numbers.ts';
import { invariant } from '../foundation/errors.ts';
import type { ResourceDescriptor, ResourceId } from '../ui/types.ts';
import {
  resourceKey,
  releaseFrameResources,
  resourceOwner,
  bindResourceRetainer,
  copyResourceId,
} from '../ui/resource-retention.ts';
export interface ResourceCost {
  readonly units: number;
  readonly bytes: number;
}
export interface ResourceAccountingTotals {
  readonly resident: number;
  readonly producers: number;
  readonly residentUnits: number;
  readonly producerUnits: number;
  readonly residentBytes: number;
  readonly producerBytes: number;
}
export interface ResourceAccountingRegistration {
  readonly owner: ResourceAccounting;
  readonly identity: object;
  readonly cost: ResourceCost;
}
interface AccountingState {
  readonly registry: ResourceRegistry;
  readonly entries: Map<string, AccountingEntry>;
  resident: number;
  producers: number;
  residentUnits: number;
  producerUnits: number;
  residentBytes: number;
  producerBytes: number;
}
interface AccountingEntry {
  readonly state: AccountingState;
  readonly key: string;
  readonly identity: object;
  readonly cost: ResourceCost;
  producers: number;
}
const accountings = new WeakMap<ResourceAccounting, AccountingState>();
const registryAccountings = new WeakMap<
  ResourceRegistry,
  {
    resident: number;
    producers: number;
    residentUnits: number;
    producerUnits: number;
    residentBytes: number;
    producerBytes: number;
  }
>();
function registryAccounting(registry: ResourceRegistry) {
  let totals = registryAccountings.get(registry);
  if (!totals) {
    totals = {
      resident: 0,
      producers: 0,
      residentUnits: 0,
      producerUnits: 0,
      residentBytes: 0,
      producerBytes: 0,
    };
    registryAccountings.set(registry, totals);
  }
  return totals;
}
/** Non-owning cost totals follow the registry's actual producer and retirement
 * transitions. No callbacks, resource bodies or additional leases are retained. */
export class ResourceAccounting {
  constructor(registry: ResourceRegistry) {
    accountings.set(this, {
      registry,
      entries: new Map(),
      resident: 0,
      producers: 0,
      residentUnits: 0,
      producerUnits: 0,
      residentBytes: 0,
      producerBytes: 0,
    });
  }
  get totals(): ResourceAccountingTotals {
    const value = accountings.get(this)!;
    return {
      resident: value.resident,
      producers: value.producers,
      residentUnits: value.residentUnits,
      producerUnits: value.producerUnits,
      residentBytes: value.residentBytes,
      producerBytes: value.producerBytes,
    };
  }
  record(
    resource: ResourceId,
    identity: object,
  ): ({ readonly producers: number } & ResourceCost) | undefined {
    const state = accountings.get(this)!;
    if (!state.registry.isRetained(resource)) return;
    const value = state.entries.get(resourceKey(resource));
    if (value?.identity === identity)
      return { producers: value.producers, units: value.cost.units, bytes: value.cost.bytes };
  }
}
interface Entry {
  readonly descriptor: ResourceDescriptor;
  references: number;
  producer: number;
  owners: number;
  readonly retire: () => void;
  readonly accounting?: AccountingEntry;
}
function changeProducerAccounting(entry: Entry, delta: number): void {
  const value = entry.accounting;
  if (value) {
    value.producers += delta;
    value.state.producers += delta;
    value.state.producerUnits += value.cost.units * delta;
    value.state.producerBytes += value.cost.bytes * delta;
    const totals = registryAccounting(value.state.registry);
    totals.producers += delta;
    totals.producerUnits += value.cost.units * delta;
    totals.producerBytes += value.cost.bytes * delta;
  }
}
function retireAccounting(entry: Entry): void {
  const value = entry.accounting;
  if (value) {
    if (value.state.entries.get(value.key) === value) value.state.entries.delete(value.key);
    value.state.resident--;
    value.state.residentUnits -= value.cost.units;
    value.state.residentBytes -= value.cost.bytes;
    const totals = registryAccounting(value.state.registry);
    totals.resident--;
    totals.residentUnits -= value.cost.units;
    totals.residentBytes -= value.cost.bytes;
  }
}
export class ResourceLease {
  private returned = false;
  private holder: 'caller' | 'renderer' = 'caller';
  constructor(
    readonly resources: readonly ResourceId[],
    private readonly release: () => void,
  ) {}
  get released(): boolean {
    return this.returned;
  }
  transfer(): void {
    invariant(
      !this.returned && this.holder === 'caller',
      'invalid-transfer',
      'lease already transferred or returned',
    );
    this.holder = 'renderer';
  }
  returnBy(holder: 'caller' | 'renderer'): void {
    invariant(
      !this.returned && holder === this.holder,
      'invalid-return',
      'lease return has wrong owner or repeats',
    );
    this.returned = true;
    this.release();
  }
}
export class ResourceRegistry {
  private entries = new Map<string, Entry>();
  private closed = false;
  private allocationSequence = 0;
  private optionalReclaimers: Set<() => void> | undefined;
  private reclaimingOptional = false;
  /** @internal Optional UI/cache owners can release their own logical leases
   * before admission. In-flight frames remain independently charged. */
  addOptionalResourceReclaimer(reclaim: () => void): { dispose(): void } {
    invariant(
      !this.closed && typeof reclaim === 'function',
      'invalid-resource-reclaimer',
      'Optional resource reclamation needs a live registry and callback',
    );
    const entry = () => reclaim();
    (this.optionalReclaimers ??= new Set()).add(entry);
    let live = true;
    return {
      dispose: () => {
        if (!live) return;
        live = false;
        this.optionalReclaimers?.delete(entry);
      },
    };
  }
  /** @internal Bounded by registered owners; a reentrant admission does not
   * recursively restart the same reclamation transaction. */
  reclaimOptionalResources(): boolean {
    if (this.closed || this.reclaimingOptional || !this.optionalReclaimers?.size) return false;
    this.reclaimingOptional = true;
    const errors: unknown[] = [],
      batch = [...this.optionalReclaimers];
    try {
      for (const reclaim of batch)
        if (this.optionalReclaimers.has(reclaim))
          try {
            reclaim();
          } catch (error) {
            errors.push(error);
          }
    } finally {
      this.reclaimingOptional = false;
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Optional resource reclamation failed');
    return true;
  }
  /** Aggregate only registered cost sidecars, across services sharing this registry.
   * Residency includes owners/in-flight frames after the final producer leaves. */
  get accountedTotals(): ResourceAccountingTotals {
    return { ...registryAccounting(this) };
  }
  /** One app-local namespace allocator also sees resources retained only by GPU frames. */
  allocateId(prefix: string): ResourceId {
    invariant(
      !this.closed && prefix.length > 0,
      'closed-resource-allocator',
      'Resource allocator is closed or has an empty prefix',
    );
    let resource: ResourceId;
    do {
      invariant(
        this.allocationSequence < Number.MAX_SAFE_INTEGER,
        'resource-id-exhausted',
        'Dynamic resource IDs exhausted',
      );
      resource = Object.freeze({ id: `${prefix}:${++this.allocationSequence}`, generation: 1 });
    } while (this.entries.has(resourceKey(resource)));
    return resource;
  }
  register(
    descriptor: ResourceDescriptor,
    retire: () => void,
    accounting?: ResourceAccountingRegistration,
  ): void {
    invariant(!this.closed, 'closed', 'resource registry is closing');
    generation(descriptor.generation);
    invariant(descriptor.id.length > 0, 'invalid-resource', 'empty resource id');
    const key = resourceKey(descriptor);
    invariant(!this.entries.has(key), 'duplicate-resource', 'resource already registered');
    const copy = descriptor.asset
      ? { ...descriptor, asset: Object.freeze({ ...descriptor.asset }) }
      : { ...descriptor };
    let tracked: AccountingEntry | undefined;
    if (accounting) {
      const state = accountings.get(accounting.owner),
        identity = accounting.identity,
        units = accounting.cost.units,
        bytes = accounting.cost.bytes;
      invariant(
        state?.registry === this &&
          identity !== null &&
          (typeof identity === 'object' || typeof identity === 'function'),
        'invalid-resource-accounting',
        'Resource accounting belongs to another registry or has no identity',
      );
      invariant(
        Number.isSafeInteger(units) && units >= 0 && Number.isSafeInteger(bytes) && bytes >= 0,
        'invalid-resource-accounting',
        'Resource costs must be nonnegative safe integers',
      );
      tracked = { state, key, identity, cost: { units, bytes }, producers: 1 };
      state.entries.set(key, tracked);
      state.resident++;
      state.producers++;
      state.residentUnits += units;
      state.producerUnits += units;
      state.residentBytes += bytes;
      state.producerBytes += bytes;
    }
    if (tracked) {
      const totals = registryAccounting(this);
      totals.resident++;
      totals.producers++;
      totals.residentUnits += tracked.cost.units;
      totals.producerUnits += tracked.cost.units;
      totals.residentBytes += tracked.cost.bytes;
      totals.producerBytes += tracked.cost.bytes;
    }
    this.entries.set(key, {
      descriptor: Object.freeze(copy),
      references: 1,
      producer: 1,
      owners: 0,
      retire,
      ...(tracked ? { accounting: tracked } : {}),
    });
  }
  has(resource: ResourceId): boolean {
    const entry = this.entries.get(resourceKey(resource)),
      owner = resourceOwner(resource);
    return (
      !this.closed &&
      (owner === null || owner === this) &&
      !!entry &&
      (entry.producer > 0 || entry.owners > 0)
    );
  }
  hasInitialProducer(resource: ResourceId): boolean {
    return this.initialProducerCount(resource) > 0;
  }
  initialProducerCount(resource: ResourceId): number {
    const owner = resourceOwner(resource);
    return !this.closed && (owner === null || owner === this)
      ? (this.entries.get(resourceKey(resource))?.producer ?? 0)
      : 0;
  }
  /** Retained references include logical producers, owners and admitted frames. */
  retainedReferenceCount(resource: ResourceId): number {
    const owner = resourceOwner(resource);
    return !this.closed && (owner === null || owner === this)
      ? (this.entries.get(resourceKey(resource))?.references ?? 0)
      : 0;
  }
  /** Each borrower of an immutable backend resource owes one producer release.
   * A completed recording can keep that resource alive across lazy remounts. */
  retainInitialProducer(resource: ResourceId): void {
    const entry = this.entries.get(resourceKey(resource)),
      owner = resourceOwner(resource);
    invariant(
      !this.closed && (owner === null || owner === this) && entry && entry.references > 0,
      'stale-resource',
      'Cannot reuse a retired or foreign producer',
    );
    entry.references++;
    entry.producer++;
    changeProducerAccounting(entry, 1);
  }
  /** An admitted frame can outlive every UI producer without becoming stale. */
  isRetained(resource: ResourceId): boolean {
    const owner = resourceOwner(resource);
    return (
      !this.closed && (owner === null || owner === this) && this.entries.has(resourceKey(resource))
    );
  }
  /** Capture the immutable identity and this registry's stable binding together. */
  captureResource(resource: ResourceId): ResourceId {
    const identifier = copyResourceId(resource, () => this.retainProducer(identifier), this),
      owner = resourceOwner(resource);
    invariant(
      (owner === null || owner === this) && this.has(identifier),
      'stale-resource',
      'Cannot bind a foreign or released resource',
    );
    return identifier;
  }
  bindResource(resource: ResourceId): void {
    const identifier = this.captureResource(resource);
    bindResourceRetainer(resource, () => this.retainProducer(identifier), this);
  }
  retainProducer(resource: ResourceId): { dispose(): void } {
    const entry = this.entries.get(resourceKey(resource)),
      owner = resourceOwner(resource);
    invariant(
      !this.closed && (owner === null || owner === this) && entry && entry.references > 0,
      'stale-resource',
      'Cannot retain a foreign or retired resource',
    );
    entry.references++;
    entry.owners++;
    let released = false;
    return {
      dispose: () => {
        if (released) return;
        released = true;
        if (this.closed) return;
        entry.owners--;
        this.release(entry);
      },
    };
  }
  releaseProducer(resource: ResourceId): void {
    const entry = this.entries.get(resourceKey(resource));
    invariant(
      !this.closed &&
        entry?.producer &&
        (resourceOwner(resource) === null || resourceOwner(resource) === this),
      'stale-resource',
      'resource producer was already released or belongs to another registry',
    );
    entry.producer--;
    changeProducerAccounting(entry, -1);
    this.release(entry);
  }
  acquire(resources: readonly ResourceId[]): ResourceLease {
    try {
      invariant(!this.closed, 'closed', 'resource registry is closing');
      for (const resource of resources)
        invariant(
          resourceOwner(resource) === null || resourceOwner(resource) === this,
          'foreign-resource',
          'Resource belongs to another registry',
        );
      const unique = [...new Map(resources.map((r) => [resourceKey(r), r])).values()];
      const entries = unique.map((r) => {
        const entry = this.entries.get(resourceKey(r));
        invariant(
          entry &&
            (entry.producer || entry.owners > 0) &&
            (resourceOwner(r) === null || resourceOwner(r) === this),
          'stale-resource',
          `missing or foreign resource ${r.id}`,
        );
        return entry;
      });
      entries.forEach((entry) => entry.references++);
      try {
        releaseFrameResources(resources);
      } catch (error) {
        try {
          this.releaseAll(entries);
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'Frame admission rollback failed');
        }
        throw error;
      }
      return new ResourceLease(Object.freeze(unique.map((r) => Object.freeze({ ...r }))), () => {
        this.releaseAll(entries);
      });
    } catch (error) {
      try {
        releaseFrameResources(resources);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Frame resource admission and cleanup failed');
      }
      throw error;
    }
  }
  private release(entry: Entry): void {
    if (--entry.references === 0) {
      this.entries.delete(resourceKey(entry.descriptor));
      entry.retire();
      retireAccounting(entry);
    }
  }
  private releaseAll(entries: readonly Entry[]): void {
    const errors: unknown[] = [];
    for (const entry of entries) {
      try {
        this.release(entry);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'resource retirement failed');
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.optionalReclaimers?.clear();
    const producers: Entry[] = [];
    for (const entry of this.entries.values()) {
      const count = entry.producer + entry.owners;
      changeProducerAccounting(entry, -entry.producer);
      entry.producer = 0;
      entry.owners = 0;
      for (let i = 0; i < count; i++) producers.push(entry);
    }
    this.releaseAll(producers);
  }
}
