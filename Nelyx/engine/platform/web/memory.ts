// SPDX-License-Identifier: BSD-3-Clause
import { body, packet, protocol as p, response } from '../../../runtime/engine-client/codec.ts';
import { exchange, sessionOwner } from './common.ts';
import type { BrowserModule } from './common.ts';
export interface ProviderMemoryCredit {
  (): void;
  resize?(bytes: number, headroom?: number): void;
}
export interface ProviderMemoryBudget {
  set(kind: number, bytes: number): void;
  reserve(kind: number, bytes: number): ProviderMemoryCredit;
  reserveWithHeadroom?(kind: number, bytes: number, headroom: number): ProviderMemoryCredit;
  close(): void;
}
/** Current retained bytes, decoded values and the whole incoming packet bound
 * replacement work before eager decode. These are conservative capacity
 * credits, not a measurement of the JS heap or GC. */
export function observationCapacity(
  retainedBytes: number,
  decodedBytes: number,
  retainedRows: number,
  incomingBytes: number,
  incomingRows: number,
): number {
  if (incomingRows > p.limits.nodes) throw Error('Provider observation row capacity exceeded');
  return (
    (retainedBytes + retainedRows * p.nodeBytes + decodedBytes + incomingBytes) * 8 +
    (retainedRows + incomingRows) * 1024
  );
}
/** Keep working room for one geometric Core-heap growth, two maximum wire
 * responses and one viewport-sized GPU layer. Core checks this room atomically
 * with the cache's actual credit; it never becomes a second live charge. */
export function observationHeadroom(header: DataView, engineBytes: number): number {
  const b = p.headerBytes,
    heap = Math.max(engineBytes, Number(header.getBigUint64(b + p.stateFields.engineHeap, true))),
    width = header.getFloat64(b + p.stateFields.viewportWidth, true),
    height = header.getFloat64(b + p.stateFields.viewportHeight, true),
    scale = header.getFloat64(b + p.stateFields.viewportScale, true),
    layer = Math.ceil(width * scale) * Math.ceil(height * scale) * 4;
  return Math.ceil((heap / 4 + p.limits.responseBytes * 2 + layer) / 65536) * 65536;
}
/** Host-only, absolute accounts in the shared C++ session ledger. */
export class ProviderBudget {
  private accounts = [0, 0, 0, 0, 0, 0];
  private closed = false;
  constructor(
    private module: BrowserModule,
    private engine: number,
    private owner: number,
  ) {}
  set(kind: number, bytes: number, headroom = 0): void {
    if (
      this.closed ||
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      !Number.isSafeInteger(headroom) ||
      headroom < 0
    )
      throw new Error('Invalid memory account');
    if (this.accounts[kind] === bytes && !headroom) return;
    const result = response(
      exchange(
        this.module,
        this.engine,
        packet(
          p.opcodes.memoryReport,
          sessionOwner,
          body(headroom ? p.memoryReportHeadroomBytes : 16, (v) => {
            v.setUint32(0, this.owner, true);
            v.setUint32(4, kind, true);
            v.setBigUint64(8, BigInt(bytes), true);
            if (headroom) v.setBigUint64(16, BigInt(headroom), true);
          }),
        ),
      ),
    );
    if (result.status !== p.statuses.ok)
      throw new Error(
        `Unified memory budget rejected (${result.status}); owner=${this.owner} kind=${kind} requested=${bytes}, total=${result.memory.total}, providerHeap=${result.memory.providerHeap}, gpu=${result.memory.gpu}, staging=${result.memory.staging}, limit=${result.memory.limit}`,
      );
    this.accounts[kind] = bytes;
  }
  reserve(kind: number, bytes: number, headroom = 0): ProviderMemoryCredit {
    this.set(kind, this.accounts[kind]! + bytes, headroom);
    let held = true;
    const credit: ProviderMemoryCredit = () => {
      if (held) {
        held = false;
        if (!this.closed) this.set(kind, this.accounts[kind]! - bytes);
      }
    };
    credit.resize = (next, headroom = 0) => {
      if (
        !held ||
        !Number.isSafeInteger(next) ||
        next < 0 ||
        !Number.isSafeInteger(headroom) ||
        headroom < 0
      )
        throw Error('Invalid memory credit resize');
      // One absolute Core report atomically adjusts this live credit. A
      // rejected growth leaves both the account and its release size intact.
      this.set(kind, this.accounts[kind]! - bytes + next, headroom);
      bytes = next;
    };
    return credit;
  }
  reserveWithHeadroom(kind: number, bytes: number, headroom: number): ProviderMemoryCredit {
    if (!Number.isSafeInteger(headroom) || headroom < 0)
      throw Error('Invalid memory admission headroom');
    return this.reserve(kind, bytes, headroom);
  }
  close(): void {
    if (this.closed) return;
    for (let kind = 1; kind < 6; ++kind) this.set(kind, 0);
    this.closed = true;
  }
}
