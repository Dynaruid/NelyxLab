// SPDX-License-Identifier: BSD-3-Clause
import type { NodeHandle } from './codec.ts';
import { protocol as p } from './schema.ts';

/** One allocation domain for SDK image/font producers across a client session.
 * Only a known Core release advances a generation. Raw packet producers remain
 * responsible for reserving their own domain; Core rejects any collision. */
export class ResourceSlots {
  private next = 0;
  private readonly free: NodeHandle[] = [];
  private readonly owned = new Map<NodeHandle, object>();
  allocate(owner: object): NodeHandle {
    let handle = this.free.pop();
    if (!handle) {
      if (this.next >= p.limits.resources) throw Error('SDK resource slot budget exceeded');
      handle = Object.freeze({ slot: ++this.next, generation: 1 });
    }
    this.owned.set(handle, owner);
    return handle;
  }
  recycle(owner: object, handle: NodeHandle, released: boolean): void {
    if (this.owned.get(handle) !== owner) throw Error('Foreign or retired SDK resource slot');
    this.owned.delete(handle);
    if (released) {
      if (handle.generation < 0xfffffffe)
        this.free.push(Object.freeze({ slot: handle.slot, generation: handle.generation + 1 }));
    } else this.free.push(handle);
  }
  clear(): void {
    this.owned.clear();
    this.free.length = 0;
  }
  discard(owner: object, handle: NodeHandle): void {
    if (this.owned.get(handle) !== owner) throw Error('Foreign SDK resource slot');
    this.owned.delete(handle);
  }
}
