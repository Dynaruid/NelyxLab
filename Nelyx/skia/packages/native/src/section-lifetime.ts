// SPDX-License-Identifier: BSD-3-Clause
import type { SectionLifetimeService } from '@nelyx/core/hosting/section-lifetime';
import { sectionLifetimeProtocol as protocol } from '@nelyx/core/hosting/section-lifetime';
import type { Skia } from './skia/types/Skia.ts';
export function createSectionLifetimeService(api: Skia, ensure: () => void) {
  if (api.nelyxSectionLifetimeVersion?.() !== 1 || !api.nelyxSectionLifetime)
    throw new Error('Requested section-lifetime capability missing; rebuild native inputs');
  let closed = false;
  const work = {
    decisions: 0,
    visited: 0,
    retain: 0,
    evict: 0,
    prepare: 0,
    appliedRetain: 0,
    appliedEvict: 0,
    appliedPrepare: 0,
    bytes: 0,
  };
  const service: SectionLifetimeService & { execution(): typeof work } = {
    run(packet) {
      ensure();
      if (closed) throw new Error('Section lifetime owner closed');
      if (
        packet.byteOffset !== 0 ||
        packet.byteLength !== packet.buffer.byteLength ||
        packet.length < protocol.header ||
        packet.length > protocol.header + protocol.maxRows * protocol.row
      )
        throw new Error('Invalid section lifetime buffer');
      const result = api.nelyxSectionLifetime!(packet.buffer as ArrayBuffer);
      if (
        result.length !== 5 ||
        result[0] !== packet[4] ||
        result.some((x) => !Number.isSafeInteger(x) || x < 0) ||
        result[4] !== packet[5]
      )
        throw new Error('Invalid native section lifetime decision');
      const ids = new Set(
        Array.from({ length: packet[5]! }, (_, i) => packet[protocol.header + i * protocol.row]!),
      );
      if (result.slice(1, 4).some((id) => id !== 0 && !ids.has(id)))
        throw new Error('Foreign section lifetime decision');
      work.decisions++;
      work.visited += result[4]!;
      work.retain += Number(result[1]! > 0);
      work.evict += Number(result[2]! > 0);
      work.prepare += Number(result[3]! > 0);
      work.bytes += packet.byteLength;
      return result;
    },
    applied(retained, evicted, prepared) {
      work.appliedRetain += retained;
      work.appliedEvict += evicted;
      work.appliedPrepare += prepared;
    },
    execution: () => ({ ...work }),
    dispose() {
      closed = true;
    },
  };
  return service;
}
