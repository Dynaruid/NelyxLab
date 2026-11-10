// SPDX-License-Identifier: BSD-3-Clause
import type { EngineTransport } from './client.ts';
import { protocol as p } from './schema.ts';
import { engineFailures } from './lifecycle.ts';

export interface PacketEndpoint {
  readonly notifications?: boolean;
  post(value: unknown, transfer: ArrayBuffer[]): void;
  subscribe(callback: (value: unknown) => void): () => void;
  close(): void;
}
export function createPacketTransport(endpoint: PacketEndpoint, timeoutMs = 2000): EngineTransport {
  let next = 0,
    bytesPending = 0,
    closed = false;
  const counters = { copiedBytes: 0, transferredBytes: 0, pendingPeakBytes: 0, timeouts: 0 };
  const pending = new Map<
    number,
    {
      bytes: number;
      resolve(value: Uint8Array): void;
      reject(reason: Error): void;
      timer: ReturnType<typeof setTimeout>;
      retired: boolean;
    }
  >();
  const changes = new Set<() => void>();
  const unsubscribe = endpoint.subscribe((value) => {
    const message = value as { kind?: string; id?: number; bytes?: ArrayBuffer; error?: string };
    if (message.kind === 'engine-change') {
      for (const callback of Array.from(changes)) callback();
      return;
    }
    if (message.kind !== 'packet-result' || typeof message.id !== 'number') return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    bytesPending -= request.bytes;
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error));
    else if (
      !(message.bytes instanceof ArrayBuffer) ||
      message.bytes.byteLength > p.limits.responseBytes
    )
      request.reject(new Error('Invalid packet-port response'));
    else request.resolve(new Uint8Array(message.bytes));
  });
  const exchange = (bytes: Uint8Array, exclusive: boolean): Promise<Uint8Array> => {
    const length = bytes.byteLength;
    if (
      closed ||
      pending.size >= p.limits.results ||
      bytesPending + length > p.limits.packetBytes * 4
    )
      return Promise.reject(new Error('Packet port closed or admission budget exceeded'));
    if (++next > 0xffff_ffff) return Promise.reject(new Error('Packet port ID exhausted'));
    const id = next,
      owned =
        exclusive &&
        bytes.buffer instanceof ArrayBuffer &&
        bytes.byteOffset === 0 &&
        length === bytes.buffer.byteLength
          ? bytes
          : bytes.slice();
    if (owned !== bytes) counters.copiedBytes += length;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = pending.get(id);
        if (!request) return;
        // A caller deadline does not return credit for work still owned by a
        // worker. Keep the bounded terminal entry until a late reply or close.
        request.retired = true;
        ++counters.timeouts;
        reject(new Error('Packet port result timed out'));
      }, timeoutMs);
      pending.set(id, { bytes: length, resolve, reject, timer, retired: false });
      bytesPending += length;
      counters.pendingPeakBytes = Math.max(counters.pendingPeakBytes, bytesPending);
      try {
        endpoint.post({ kind: 'packet', id, bytes: owned.buffer }, [owned.buffer as ArrayBuffer]);
        counters.transferredBytes += length;
      } catch (error) {
        pending.delete(id);
        bytesPending -= length;
        clearTimeout(timer);
        reject(error);
      }
    });
  };
  return {
    diagnostics: () => ({
      ...counters,
      pending: pending.size,
      pendingBytes: bytesPending,
      retiredBytes: [...pending.values()].reduce(
        (sum, request) => sum + (request.retired ? request.bytes : 0),
        0,
      ),
    }),
    ...(endpoint.notifications
      ? {
          subscribeChanges(callback: () => void) {
            changes.add(callback);
            return () => {
              changes.delete(callback);
            };
          },
        }
      : {}),
    exchange(bytes) {
      return exchange(bytes, false);
    },
    exchangeOwned(bytes) {
      return exchange(bytes, true);
    },
    close() {
      if (closed) return;
      closed = true;
      changes.clear();
      const errors: unknown[] = [];
      for (const cleanup of [unsubscribe, () => endpoint.close()]) {
        try {
          cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('Packet port closed'));
      }
      pending.clear();
      bytesPending = 0;
      if (errors.length) throw engineFailures('Packet port close failed', errors);
    },
  };
}
