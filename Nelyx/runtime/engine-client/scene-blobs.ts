// SPDX-License-Identifier: BSD-3-Clause
import { body, writeHandle } from './codec.ts';
import type { NodeHandle } from './codec.ts';
import { protocol as p } from './schema.ts';
const nodeKey = (node: NodeHandle) => `${node.slot}:${node.generation}`;
const command = (op: number, node: NodeHandle, payload: Uint8Array = new Uint8Array()) => {
  const bytes = body(16 + payload.length, (view) => {
    view.setUint16(0, op, true);
    view.setUint32(4, 16 + payload.length, true);
    writeHandle(view, 8, node);
  });
  bytes.set(payload, 16);
  return bytes;
};
const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, index) => value === b[index]);
type Entry = { handle: NodeHandle; kind: number; bytes: Uint8Array; hash: string; uses: number };
export type SceneBlobPlan = {
  readonly commands: readonly Uint8Array[];
  accept(): void;
  reject(): void;
};
/** Transactional immutable configuration registrations. Source command bytes
 * remain the diff oracle; IDs affect transport only and become reusable after
 * a known terminal. Native documents/readers retain their normalized values. */
export class SceneBlobJournal {
  private readonly entries = new Map<string, Entry[]>();
  private readonly bindings = new Map<string, Map<number, Entry>>();
  private readonly free: NodeHandle[] = [];
  private nextSlot = 1;
  private bytes = 0;
  readonly counters = {
    registrations: 0,
    bindings: 0,
    retired: 0,
    registeredBytes: 0,
    referencedBytes: 0,
  };
  constructor(
    private readonly hashBytes = (bytes: Uint8Array) => {
      let hash = 2166136261;
      for (const value of bytes) hash = Math.imul(hash ^ value, 16777619);
      return hash >>> 0;
    },
  ) {}
  diagnostics() {
    return {
      ...this.counters,
      bytes: this.bytes,
      entries: [...this.entries.values()].reduce((n, values) => n + values.length, 0),
    };
  }
  prepare(changes: readonly Uint8Array[]): SceneBlobPlan {
    const changed = new Map<string, Map<number, Entry>>(),
      deltas = new Map<Entry, number>(),
      added: Entry[] = [],
      popped: NodeHandle[] = [],
      nextSlot = this.nextSlot,
      registrations: Uint8Array[] = [],
      commands: Uint8Array[] = [],
      retired: Entry[] = [],
      staged = new Map<string, Entry[]>();
    let addedBytes = 0,
      bindings = 0,
      referencedBytes = 0,
      terminal = false;
    const change = (entry: Entry, delta: number) =>
      deltas.set(entry, (deltas.get(entry) ?? 0) + delta);
    const owner = (id: string) => {
      let map = changed.get(id);
      if (!map) changed.set(id, (map = new Map(this.bindings.get(id))));
      return map;
    };
    const rollback = () => {
      this.nextSlot = nextSlot;
      this.free.push(...popped.reverse());
    };
    try {
      for (const bytes of changes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          kind = view.getUint16(0, true),
          node = { slot: view.getUint32(8, true), generation: view.getUint32(12, true) },
          id = nodeKey(node);
        if (kind === p.commands.destroy) {
          for (const entry of owner(id).values()) change(entry, -1);
          owner(id).clear();
        }
        if (
          kind !== p.commands.paragraphOptions &&
          kind !== p.commands.semantics &&
          kind !== p.commands.nativePaint
        ) {
          commands.push(bytes);
          continue;
        }
        const uses = owner(id),
          previous = uses.get(kind),
          payload = bytes.subarray(16);
        if (previous) {
          change(previous, -1);
          uses.delete(kind);
        }
        if (payload.length < p.paragraphBytes) {
          commands.push(bytes);
          continue;
        }
        const hash = `${kind}/${this.hashBytes(payload)}`;
        let entry =
          this.entries.get(hash)?.find((value) => equal(value.bytes, payload)) ??
          staged.get(hash)?.find((value) => equal(value.bytes, payload));
        if (!entry) {
          const recycled = this.free.pop();
          if (recycled) popped.push(recycled);
          const handle = recycled ?? { slot: this.nextSlot++, generation: 1 };
          if (
            handle.slot > p.limits.immutableBlobs ||
            this.bytes + addedBytes + payload.length > p.limits.immutableBlobBytes
          )
            throw new RangeError('Immutable scene blob quota exceeded');
          entry = { handle, kind, bytes: payload.slice(), hash, uses: 0 };
          added.push(entry);
          addedBytes += payload.length;
          let candidates = staged.get(hash);
          if (!candidates) staged.set(hash, (candidates = []));
          candidates.push(entry);
          const data = body(8 + payload.length, (v) => {
            v.setUint32(0, kind, true);
            v.setUint32(4, payload.length, true);
          });
          data.set(entry.bytes, 8);
          registrations.push(command(p.commands.registerBlob, handle, data));
        }
        uses.set(kind, entry);
        change(entry, 1);
        ++bindings;
        referencedBytes += payload.length;
        commands.push(
          command(
            p.commands.useBlob,
            node,
            body(16, (v) => {
              writeHandle(v, 0, entry!.handle);
              v.setUint32(8, kind, true);
            }),
          ),
        );
      }
      for (const [entry, delta] of deltas)
        if (entry.uses + delta === 0) {
          retired.push(entry);
          commands.push(command(p.commands.releaseBlob, entry.handle));
        }
    } catch (error) {
      rollback();
      throw error;
    }
    return {
      commands: [...registrations, ...commands],
      accept: () => {
        if (terminal) return;
        terminal = true;
        for (const entry of added) {
          let values = this.entries.get(entry.hash);
          if (!values) this.entries.set(entry.hash, (values = []));
          values.push(entry);
          this.bytes += entry.bytes.length;
        }
        for (const [id, values] of changed) {
          if (values.size) this.bindings.set(id, values);
          else this.bindings.delete(id);
        }
        for (const [entry, delta] of deltas) entry.uses += delta;
        for (const entry of retired) {
          const values = this.entries.get(entry.hash)!;
          values.splice(values.indexOf(entry), 1);
          if (!values.length) this.entries.delete(entry.hash);
          this.bytes -= entry.bytes.length;
          if (entry.handle.generation < 0xffffffff)
            this.free.push({ slot: entry.handle.slot, generation: entry.handle.generation + 1 });
        }
        this.counters.registrations += added.length;
        this.counters.bindings += bindings;
        this.counters.retired += retired.length;
        this.counters.registeredBytes += addedBytes;
        this.counters.referencedBytes += referencedBytes;
      },
      reject: () => {
        if (terminal) return;
        terminal = true;
        rollback();
      },
    };
  }
  clear() {
    this.entries.clear();
    this.bindings.clear();
    this.free.length = 0;
    this.bytes = 0;
    this.nextSlot = 1;
  }
}
