// SPDX-License-Identifier: BSD-3-Clause
import type { FlexLayoutService } from '@nelyx/core/hosting/flex-layout';
import { flexLayoutProtocol } from '@nelyx/core/hosting/flex-layout';
import type { Skia } from './skia/types/Skia.ts';
export function createFlexLayoutService(api: Skia, ensure: () => void) {
  if (api.nelyxFlexLayoutVersion?.() !== 1 || !api.nelyxFlexLayout)
    throw Error('Requested native Flex layout capability missing; rebuild the native supplier');
  let closed = false;
  const work = {
    flexPlans: 0,
    flexChildren: 0,
    flexPlacements: 0,
    tsFallbacks: 0,
    fallbackReasons: {} as Record<string, number>,
  };
  const service: FlexLayoutService & { execution(): typeof work } = {
    run(packet) {
      ensure();
      if (closed) throw Error('Native Flex layout owner closed');
      const count = packet[3]!;
      if (
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > flexLayoutProtocol.maxChildren ||
        packet.length !== flexLayoutProtocol.header + count * 3
      )
        throw Error('Invalid SDK Flex layout packet');
      const result = api.nelyxFlexLayout!(packet.buffer as ArrayBuffer);
      if (packet[2] === 0) work.flexPlans++;
      else work.flexPlacements++;
      work.flexChildren += count;
      if (
        result.length !== (packet[2] === 0 ? 1 : 5 + count * 2) ||
        result.some((value) => !Number.isFinite(value))
      )
        throw Error('Invalid native Flex layout result');
      return result;
    },
    noteFallback(reason) {
      work.tsFallbacks++;
      work.fallbackReasons[reason] = (work.fallbackReasons[reason] ?? 0) + 1;
    },
    execution() {
      return { ...work, fallbackReasons: { ...work.fallbackReasons } };
    },
    dispose() {
      closed = true;
    },
  };
  return service;
}
