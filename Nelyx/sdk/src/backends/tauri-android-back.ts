// SPDX-License-Identifier: BSD-3-Clause
import { onBackButtonPress } from '@tauri-apps/api/app';
import type { OnBackButtonPressPayload } from '@tauri-apps/api/app';
import type { PluginListener } from '@tauri-apps/api/core';
import { backendFailure } from './backend-contract.ts';
import type { AndroidBackSource } from './backend-contract.ts';

export function createAndroidBack(
  view: Window,
  dispatchDefault: () => Promise<void>,
  releaseCallback: (id: number) => void,
  signal: AbortSignal,
): AndroidBackSource {
  const handlers = new Set<() => Promise<boolean>>();
  let listener: PluginListener | undefined;
  let transitions = Promise.resolve();
  let inputs = Promise.resolve();
  let replaying = false;

  const live = () => !signal.aborted && !view.closed;
  const report = (error: unknown) => {
    if (live()) console.error('Nelyx Android back', error);
  };
  function update(action: () => Promise<void>) {
    const result = transitions.then(action);
    transitions = result.catch(() => {});
    return result;
  }
  async function unregister() {
    if (!listener) return;
    await listener.unregister();
    releaseCallback(listener.channelId);
    listener = undefined;
  }
  async function reconcile() {
    if (live() && handlers.size) {
      listener ??= await onBackButtonPress(receive);
    } else {
      await unregister();
    }
  }
  function receive({ canGoBack }: OnBackButtonPressPayload) {
    if (!live() || replaying) return;
    const handler = [...handlers].at(-1);
    if (!handler) return;
    const active = () => live() && handlers.has(handler);
    inputs = inputs
      .then(async () => {
        if (!active() || (await handler()) || !active()) return;
        if (canGoBack) {
          view.history.back();
          return;
        }
        await update(async () => {
          if (!active()) return;
          replaying = true;
          try {
            // The core dispatcher takes its default path only without a listener.
            await unregister();
            if (active()) await dispatchDefault();
          } finally {
            replaying = false;
            await reconcile();
          }
        });
      })
      .catch(report);
  }
  signal.addEventListener(
    'abort',
    () => {
      handlers.clear();
      void update(reconcile).catch(report);
    },
    { once: true },
  );
  return {
    async setHandler(handler, enabled) {
      if (enabled && live()) handlers.add(handler);
      else handlers.delete(handler);
      try {
        await update(reconcile);
      } catch (error) {
        throw backendFailure(error);
      }
    },
  };
}
