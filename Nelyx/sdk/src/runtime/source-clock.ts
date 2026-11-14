// SPDX-License-Identifier: BSD-3-Clause
import type { SourceDiagnosticClock } from '@nelyx/core/internal/runtime/app';

/** Only a host-declared native domain can join Source with native diagnostics.
 * A browser/older host keeps its existing owner-local clock and no calibration
 * or end-to-end latency is inferred from the presence of a clock alone. */
export function nativeSourceDiagnosticClock(
  environment = globalThis as unknown as {
    readonly NelyxV2Native?: {
      readonly clockDomain?: string;
      readonly clock?: () => number;
      readonly heapProfileActive?: () => boolean;
    };
  },
): SourceDiagnosticClock | undefined {
  const native = environment.NelyxV2Native,
    domain = native?.clockDomain;
  if (domain !== 'qpc-milliseconds' && domain !== 'monotonic-milliseconds') return;
  const now = native!.clock;
  if (typeof now === 'function') {
    let profileActive: (() => boolean) | undefined;
    try {
      profileActive = native!.heapProfileActive;
    } catch {
      return { domain, now };
    }
    return { domain, now, ...(typeof profileActive === 'function' ? { profileActive } : {}) };
  }
}
