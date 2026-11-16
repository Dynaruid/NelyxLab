// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';

/** Internal queue metadata lives on the existing owner record. No entry object,
 * duplicate membership Map or stale heap node is allocated for each rebuild. */
export interface DepthQueueRecord {
  readonly depth: number;
  _buildQueueIndex: number;
  _buildQueueDepth: number;
  _buildQueueOrder: number;
}
/** @nelyxTypedFactory owned-state-v1
 * Only the heap and its scalar bookkeeping are typed. Element references and
 * their fields stay boxed JS values, including getters, coercion and failures.
 * The array never leaves this closure. The same Source body runs on Web and
 * bytecode; the AOT frontend must prove this closure before selecting it. */
function createDepthQueueStorage(fail: typeof invariant) {
  // `any` is the dynamic record ABI, not permission to cast a foreign object
  // to a typed class or to assume that a property contains a number.
  const heap: any[] = [];
  let order: number = 0;
  let revision: number = 0;
  function before(a: any, b: any): boolean {
    return (
      a._buildQueueDepth < b._buildQueueDepth ||
      (a._buildQueueDepth === b._buildQueueDepth && a._buildQueueOrder < b._buildQueueOrder)
    );
  }
  function size(): number {
    return heap.length;
  }
  function every(predicate: (record: any) => boolean): boolean {
    const current: number = revision;
    for (const record of heap) if (!predicate(record) || revision !== current) return false;
    return true;
  }
  function up(index: any, record: any): void {
    while (index) {
      const parent: number = (index - 1) >> 1;
      const value = heap[parent];
      if (!before(record, value)) break;
      heap[index] = value;
      value._buildQueueIndex = index;
      index = parent;
    }
    heap[index] = record;
    record._buildQueueIndex = index;
  }
  function down(index: any, record: any): void {
    while (index * 2 + 1 < heap.length) {
      let child: number = index * 2 + 1;
      if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
      const value = heap[child];
      if (!before(value, record)) break;
      heap[index] = value;
      value._buildQueueIndex = index;
      index = child;
    }
    heap[index] = record;
    record._buildQueueIndex = index;
  }
  function schedule(record: any): void {
    const index = record._buildQueueIndex;
    if (index >= 0) {
      if (!(heap[index] === record))
        fail(false, 'foreign-depth-record', 'Dirty record belongs to another queue');
      if (record._buildQueueDepth === record.depth) return;
    }
    if (order === Number.MAX_SAFE_INTEGER) {
      if (heap.length) fail(false, 'depth-order-overflow', 'Dirty queue order exhausted');
      order = 0;
    }
    record._buildQueueDepth = record.depth;
    revision++;
    record._buildQueueOrder = ++order;
    if (index < 0) {
      heap.push(record);
      up(heap.length - 1, record);
    } else if (index > 0 && before(record, heap[(index - 1) >> 1])) up(index, record);
    else down(index, record);
  }
  function remove(record: any): void {
    const index = record._buildQueueIndex;
    if (!(index >= 0 && heap[index] === record))
      fail(false, 'foreign-depth-record', 'Dirty record is not queued here');
    const last = heap.pop();
    revision++;
    record._buildQueueIndex = -1;
    if (index < heap.length) {
      if (index > 0 && before(last, heap[(index - 1) >> 1])) up(index, last);
      else down(index, last);
    }
  }
  function first(): any {
    return heap[0];
  }
  return { size, every, schedule, remove, first };
}
export class DepthQueue<T extends DepthQueueRecord> {
  private readonly storage = createDepthQueueStorage(invariant);
  get size(): number {
    return this.storage.size();
  }
  /** Read only the queued records; a reentrant mutation makes validation fail. */
  every(predicate: (record: T) => boolean): boolean {
    return this.storage.every(predicate);
  }
  schedule(record: T): void {
    this.storage.schedule(record);
  }
  remove(record: T): void {
    this.storage.remove(record);
  }
  pop(): T | undefined {
    const record = this.storage.first();
    // Keep the public virtual call, including its receiver and subclass hooks.
    if (record) this.remove(record);
    return record;
  }
}
