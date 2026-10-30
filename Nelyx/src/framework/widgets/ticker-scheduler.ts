// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
import { Element } from './framework.ts';
import type { BuildContext, BuildOwner } from './framework.ts';
const schedulers = new WeakMap<BuildOwner, FrameScheduler>();
export function registerTickerScheduler(owner: BuildOwner, scheduler: FrameScheduler): void {
  invariant(
    !schedulers.has(owner),
    'ticker-scheduler-attached',
    'BuildOwner already has a ticker scheduler',
  );
  schedulers.set(owner, scheduler);
}
export function unregisterTickerScheduler(owner: BuildOwner): void {
  schedulers.delete(owner);
}
/** @internal Passive registrars may detach after their Root scheduler is closed. */
export function maybeTickerScheduler(context: BuildContext): FrameScheduler | null {
  invariant(
    context instanceof Element,
    'invalid-ticker-context',
    'Widget ticker providers require an Element',
  );
  const scheduler = schedulers.get(context.owner);
  return scheduler && !scheduler.disposed ? scheduler : null;
}
export function tickerScheduler(context: BuildContext): FrameScheduler {
  const scheduler = maybeTickerScheduler(context);
  invariant(
    scheduler,
    'ticker-scheduler-unavailable',
    'Widget ticker providers require a live FrameworkRoot',
  );
  return scheduler;
}
