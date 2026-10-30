// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../../foundation/disposable.ts';
import { invariant } from '../../foundation/errors.ts';
/** Host timer adapter. Owners cancel it on route retirement; callbacks never own a View. */
export function scrollChromeTimer(milliseconds: number, callback: () => void): Disposable {
  const host = globalThis as unknown as {
    setTimeout?: (callback: () => void, delay: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  invariant(
    host.setTimeout && host.clearTimeout,
    'missing-scroll-chrome-timer',
    'Scroll chrome requires host one-shot timers',
  );
  let active = true;
  const handle = host.setTimeout(() => {
    if (active) {
      active = false;
      callback();
    }
  }, milliseconds);
  return {
    dispose() {
      if (active) {
        active = false;
        host.clearTimeout!(handle);
      }
    },
  };
}
