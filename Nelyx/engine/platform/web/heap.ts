// SPDX-License-Identifier: BSD-3-Clause
import type { ProviderMemoryBudget } from './memory.ts';

/** Guard this owned instance only. Emscripten may retry a rejected geometric
 * over-allocation with fewer pages; every attempt reserves its actual size
 * before irreversible growth. Native growth failure returns the credit. */
export function admitHeapGrowth(memory: WebAssembly.Memory, budget: ProviderMemoryBudget): void {
  const grow = memory.grow.bind(memory);
  budget.set(1, memory.buffer.byteLength);
  Object.defineProperty(memory, 'grow', {
    value(pages: number): number {
      if (!Number.isSafeInteger(pages) || pages < 0) throw new RangeError('Invalid heap growth');
      const before = memory.buffer.byteLength;
      budget.set(1, before + pages * 65536);
      try {
        return grow(pages);
      } catch (error) {
        budget.set(1, before);
        throw error;
      }
    },
  });
}
