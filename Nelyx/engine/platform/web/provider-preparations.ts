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
export interface ProviderPreparationLease {
  readonly scene: EngineResponse;
  release(): void;
}
/** The synchronous Content recording owns this subscription. Neither the
 * candidate document nor CanvasKit resources are retained in its dictionary. */
export class ProviderPreparations {
  private readonly stream = new ObservationStream('provider-preparation');
  private readonly decode = new ObservationDecodeCache();
  private readonly retired = new Set<Reservation>();
  private reservation: Reservation | undefined;
  private low = false;
  private resizing = false;
  private disabled = false;
  private closed = false;
  private hasRows = false;
  private cachedRows = 0;
  private headroom = 0;
  private preparationDeltaEnabled = true;
  readonly counters = {
    scenes: 0,
    responseBytes: 0,
    rowVisits: 0,
    changedRows: 0,
    comparedSlots: 0,
    fallbacks: 0,
    emptyScenes: 0,
    capacityGrowths: 0,
    capacityShrinks: 0,
    resizeScenes: 0,
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
      decodeHits: this.decode.counters.hits,
      decodeMisses: this.decode.counters.misses,
      admissionHeadroomBytes: this.headroom,
      reservedBytes: this.reservation?.bytes ?? 0,
      retiredBytes: [...this.retired].reduce((n, r) => n + r.bytes, 0),
      readers:
        (this.reservation?.readers ?? 0) + [...this.retired].reduce((n, r) => n + r.readers, 0),
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
  private borrow(scene: EngineResponse): ProviderPreparationLease {
    const reservation =
      scene.status === p.statuses.ok && scene.observation ? this.reservation : undefined;
    if (reservation) ++reservation.readers;
    let held = true;
    return {
      scene,
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
  acquire(): ProviderPreparationLease {
    if (this.closed) throw Error('Provider preparation stream is closed');
    if (!this.preparationDeltaEnabled || this.low || this.disabled || this.resizing) {
      const scene = request(this.module, this.engine, p.opcodes.preparationScene);
      if (this.resizing && scene.status === p.statuses.ok) ++this.counters.resizeScenes;
      return this.borrow(scene);
    }
    for (let attempt = 0; attempt < 2; ++attempt) {
      const data = body(16, (v) => {
        v.setUint32(0, p.inspectionFlags.providerPreparationDelta, true);
        v.setBigUint64(8, attempt ? 0n : this.stream.version, true);
      });
      const output = exchange(
        this.module,
        this.engine,
        packet(p.opcodes.preparationScene, owner, data),
      );
      this.counters.responseBytes += output.length;
      let scene: EngineResponse;
      try {
        const header = new DataView(output.buffer, output.byteOffset, output.byteLength),
          status = header.getUint16(p.headerFields.status, true),
          rows = header.getUint32(p.headerFields.count, true);
        if (rows > p.limits.nodes) throw Error('Preparation row capacity exceeded');
        if (status === p.statuses.ok && !this.hasRows && rows === 0) {
          // Empty startup candidates have no retained rows to justify a full
          // dictionary capacity credit alongside font/resource staging.
          this.trim();
          ++this.counters.emptyScenes;
          return this.borrow(request(this.module, this.engine, p.opcodes.preparationScene));
        }
        if (status === p.statuses.ok) {
          try {
            // Reserve before eager decode. Existing rows/dictionary/decode
            // storage plus the complete incoming packet bound replacement
            // work; 8x wire bytes and 1024 per row are conservative capacity
            // credits, not a GC measurement. Active readers forbid shrink.
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
            this.trim();
            this.disabled = true;
            ++this.counters.fallbacks;
            return this.borrow(request(this.module, this.engine, p.opcodes.preparationScene));
          }
        }
        scene = response(output, {
          observationStream: this.stream,
          observationCache: this.decode,
          observationOwner: 'provider-preparation/1:1:1:1',
        });
        if (scene.status === p.statuses.ok && this.reservation) {
          this.counters.decodeRetired += this.decode.retainRegistered(
            'provider-preparation/1:1:1:1',
            this.stream.registeredIds(),
          );
          const resident = observationCapacity(
            this.stream.byteLength,
            this.decode.byteLength,
            scene.nodes.length,
            output.length,
            0,
          );
          // The old dictionary was replaced. Both this live-data bound and
          // the admitted decode bound cover the result; only shrink here.
          this.adjustCapacity(Math.min(this.reservation.bytes, resident));
        }
      } catch (error) {
        this.stream.clear();
        this.decode.clear();
        if (!(error instanceof ObservationGapError) || attempt) throw error;
        ++this.stream.counters.resyncs;
        continue;
      }
      if (scene.status === p.statuses.budgetExceeded) {
        this.trim();
        this.disabled = true;
        ++this.counters.fallbacks;
        return this.borrow(request(this.module, this.engine, p.opcodes.preparationScene));
      }
      if (scene.status === p.statuses.ok) {
        if (!scene.observation?.preparation) throw Error('Missing provider preparation cohort');
        ++this.counters.scenes;
        this.counters.rowVisits += scene.observation.rowVisits;
        this.counters.changedRows += scene.observation.changedRows;
        this.counters.comparedSlots += Number(scene.observation.preparation.comparedSlots);
        this.hasRows = scene.nodes.length > 0;
        this.cachedRows = scene.nodes.length;
      }
      return this.borrow(scene);
    }
    throw Error('Provider preparation resync failed');
  }
  trim(): void {
    try {
      const state = request(
        this.module,
        this.engine,
        p.opcodes.preparationScene,
        body(16, (v) => {
          v.setUint32(0, p.inspectionFlags.providerPreparationDelta, true);
          v.setUint32(4, 1, true);
        }),
      );
      if (![p.statuses.ok, p.statuses.closed].includes(state.status as 0))
        throw Error('Provider preparation eviction rejected: ' + state.status);
    } finally {
      this.stream.clear();
      this.decode.clear();
      this.hasRows = false;
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
    if (this.resizing) return;
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
    if (this.retired.size) throw Error('Provider preparation readers still hold retirement credit');
  }
}
