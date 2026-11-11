// SPDX-License-Identifier: BSD-3-Clause
import { body, packet, protocol as p, response } from '../../../runtime/engine-client/codec.ts';
import type { EngineResponse } from '../../../runtime/engine-client/codec.ts';
import { ObservationDecodeCache } from '../../../runtime/engine-client/observation-cache.ts';
import {
  ObservationGapError,
  ObservationStream,
} from '../../../runtime/engine-client/observation-stream.ts';
import { exchange, owner, request } from './common.ts';
import type { BrowserModule } from './common.ts';
import type { ProviderMemoryBudget, ProviderMemoryCredit } from './memory.ts';
import { observationCapacity, observationHeadroom } from './memory.ts';

type Reservation = {
  credits: ProviderMemoryCredit[];
  bytes: number;
  readers: number;
  retired: boolean;
};
export interface ProviderFrameLease {
  readonly frame: EngineResponse;
  release(): void;
}
/** One Render owner and view generation. Retain eager immutable rows, not
 * borrowed Wasm views or provider resources. Acquired frames keep independent
 * credit when pressure evicts the subscription during an awaited publication. */
export class ProviderFrames {
  private readonly stream = new ObservationStream('provider-frame');
  private readonly decode = new ObservationDecodeCache();
  private readonly retired = new Set<Reservation>();
  private reservation: Reservation | undefined;
  private low = false;
  private resizing = false;
  private disabled = false;
  private closed = false;
  private deltaEnabled = true;
  private cachedRows = 0;
  private headroom = 0;
  readonly counters = {
    frames: 0,
    responseBytes: 0,
    rowVisits: 0,
    changedRows: 0,
    fallbacks: 0,
    resizeFrames: 0,
    capacityGrowths: 0,
    capacityShrinks: 0,
    decodeRetired: 0,
  };
  constructor(
    private readonly module: BrowserModule,
    private readonly engine: number,
    private readonly budget: ProviderMemoryBudget,
  ) {}
  get diagnostics() {
    return {
      ...this.counters,
      ...this.stream.counters,
      retainedBytes: this.stream.byteLength,
      decodeBytes: this.decode.byteLength,
      admissionHeadroomBytes: this.headroom,
      reservedBytes: this.reservation?.bytes ?? 0,
      retiredBytes: [...this.retired].reduce((n, r) => n + r.bytes, 0),
      readers:
        (this.reservation?.readers ?? 0) + [...this.retired].reduce((n, row) => n + row.readers, 0),
    };
  }
  private release(reservation: Reservation): void {
    if (reservation.retired && !reservation.readers) {
      this.retired.delete(reservation);
      for (const credit of reservation.credits.splice(0).reverse()) credit();
    }
  }
  private adjustCapacity(bytes: number, headroom = 0): void {
    const reservation = this.reservation;
    if (!reservation) {
      const credit = this.budget.reserveWithHeadroom
        ? this.budget.reserveWithHeadroom(2, bytes, headroom)
        : this.budget.reserve(2, bytes);
      this.reservation = { credits: [credit], bytes, readers: 0, retired: false };
      ++this.counters.capacityGrowths;
      return;
    }
    const credit = reservation.credits.length === 1 ? reservation.credits[0] : undefined;
    if (bytes === reservation.bytes) {
      if (headroom && credit?.resize) credit.resize(bytes, headroom);
      return;
    }
    if (bytes < reservation.bytes) {
      if (reservation.readers || !credit?.resize) {
        if (headroom && credit?.resize) credit.resize(reservation.bytes, headroom);
        return;
      }
      credit.resize(bytes, headroom);
      ++this.counters.capacityShrinks;
    } else {
      if (credit?.resize) credit.resize(bytes, headroom);
      else reservation.credits.push(this.budget.reserve(2, bytes - reservation.bytes));
      ++this.counters.capacityGrowths;
    }
    reservation.bytes = bytes;
  }
  private borrow(frame: EngineResponse): ProviderFrameLease {
    const reservation =
      frame.status === p.statuses.ok && frame.observation ? this.reservation : undefined;
    if (reservation) ++reservation.readers;
    let held = true;
    return {
      frame,
      release: () => {
        if (!held) return;
        held = false;
        if (reservation) {
          --reservation.readers;
          this.release(reservation);
        }
      },
    };
  }
  private discard(output: Uint8Array): void {
    if (output.length < p.headerBytes + p.stateBytes) return;
    const data = new DataView(output.buffer, output.byteOffset, output.byteLength);
    if (
      data.getUint32(p.headerFields.magic, true) !== p.magic ||
      data.getUint32(p.headerFields.schema, true) !== p.schema ||
      data.getUint16(p.headerFields.opcode, true) !== (p.opcodes.takeFrame | 0x8000) ||
      data.getUint16(p.headerFields.status, true) !== p.statuses.ok
    )
      return;
    const result = request(
      this.module,
      this.engine,
      p.opcodes.releaseFrame,
      body(24, (view) => {
        view.setBigUint64(
          0,
          data.getBigUint64(p.headerBytes + p.stateFields.submission, true),
          true,
        );
        view.setBigUint64(8, data.getBigUint64(p.headerBytes + p.stateFields.device, true), true);
        view.setUint32(20, 1, true);
      }),
    );
    if (![p.statuses.ok, p.statuses.closed, p.statuses.stale].includes(result.status as 0))
      throw Error('Rejected provider frame did not retire: ' + result.status);
  }
  acquire(): ProviderFrameLease {
    if (this.closed) throw Error('Provider frame stream is closed');
    if (!this.deltaEnabled || this.low || this.disabled || this.resizing) {
      const frame = request(this.module, this.engine, p.opcodes.takeFrame);
      if (this.resizing && frame.status === p.statuses.ok) ++this.counters.resizeFrames;
      return this.borrow(frame);
    }
    for (let attempt = 0; attempt < 2; ++attempt) {
      const data = body(16, (view) => {
        view.setUint32(0, p.inspectionFlags.providerFrameDelta, true);
        view.setBigUint64(8, attempt ? 0n : this.stream.version, true);
      });
      const output = exchange(this.module, this.engine, packet(p.opcodes.takeFrame, owner, data));
      this.counters.responseBytes += output.length;
      let frame: EngineResponse;
      try {
        const header = new DataView(output.buffer, output.byteOffset, output.byteLength),
          status = header.getUint16(p.headerFields.status, true),
          rows = header.getUint32(p.headerFields.count, true);
        if (rows > p.limits.nodes) throw Error('Provider frame row capacity exceeded');
        if (status === p.statuses.ok) {
          try {
            const bytes = observationCapacity(
              this.stream.byteLength,
              this.decode.byteLength,
              this.cachedRows,
              output.length,
              rows,
            );
            this.headroom = observationHeadroom(header, this.module.HEAPU8.byteLength);
            this.adjustCapacity(bytes, this.headroom);
          } catch {
            this.discard(output);
            this.trim();
            this.disabled = true;
            ++this.counters.fallbacks;
            return this.borrow(request(this.module, this.engine, p.opcodes.takeFrame));
          }
        }
        frame = response(output, {
          observationStream: this.stream,
          observationCache: this.decode,
          observationOwner: 'provider-frame/1:1:1:1',
        });
        if (frame.status === p.statuses.ok && this.reservation) {
          this.counters.decodeRetired += this.decode.retainRegistered(
            'provider-frame/1:1:1:1',
            this.stream.registeredIds(),
          );
          const resident = observationCapacity(
            this.stream.byteLength,
            this.decode.byteLength,
            frame.nodes.length,
            output.length,
            0,
          );
          this.adjustCapacity(Math.min(this.reservation.bytes, resident));
        }
      } catch (error) {
        this.discard(output);
        this.stream.clear();
        this.decode.clear();
        if (!(error instanceof ObservationGapError) || attempt) throw error;
        ++this.stream.counters.resyncs;
        continue;
      }
      if (frame.status === p.statuses.budgetExceeded) {
        this.trim();
        this.disabled = true;
        ++this.counters.fallbacks;
        return this.borrow(request(this.module, this.engine, p.opcodes.takeFrame));
      }
      if (frame.status === p.statuses.ok) {
        if (!frame.observation?.frame) {
          this.discard(output);
          throw Error('Missing provider candidate cohort');
        }
        ++this.counters.frames;
        this.counters.rowVisits += frame.observation.rowVisits;
        this.counters.changedRows += frame.observation.changedRows;
        this.cachedRows = frame.nodes.length;
      }
      return this.borrow(frame);
    }
    throw Error('Provider frame resync failed');
  }
  trim(): void {
    try {
      const state = request(
        this.module,
        this.engine,
        p.opcodes.takeFrame,
        body(16, (view) => {
          view.setUint32(0, p.inspectionFlags.providerFrameDelta, true);
          view.setUint32(4, 1, true);
        }),
      );
      if (![p.statuses.ok, p.statuses.closed].includes(state.status as 0))
        throw Error('Provider frame eviction rejected: ' + state.status);
    } finally {
      this.stream.clear();
      this.decode.clear();
      this.cachedRows = 0;
      const reservation = this.reservation;
      this.reservation = undefined;
      if (reservation) {
        reservation.retired = true;
        this.retired.add(reservation);
        this.release(reservation);
      }
    }
  }
  pressure(low: boolean): void {
    this.low = low;
    if (low) this.trim();
    else this.disabled = false;
  }
  beginResize(): void {
    // Surface replacement temporarily owns both GPU backings. Evict the
    // obsolete metrics dictionary before borrowing another frame's credit.
    this.resizing = true;
    this.trim();
  }
  endResize(): void {
    this.resizing = false;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.trim();
    if (this.retired.size) throw Error('Provider frame readers still hold retirement credit');
  }
}
