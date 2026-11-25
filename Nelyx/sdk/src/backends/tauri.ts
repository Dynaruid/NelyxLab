// SPDX-License-Identifier: BSD-3-Clause
import type { ViewEnvironment } from '@nelyx/core/ui/types';
import { Channel, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { BrowserPlatformEnvironment } from '../frontend/dom/environment.ts';
import { backendFailure, deviceFailure, validateBackend } from './backend-contract.ts';
import type { BackendConnection, BackendIdentity } from './backend-contract.ts';
import { createClipboard } from './browser/clipboard.ts';
import type { ClipboardIO } from './browser/clipboard.ts';
import type { HapticRequest } from './browser/haptics.ts';
import type { WebSafeAreaSource } from './browser/environment.ts';
import { createAndroidBack } from './tauri-android-back.ts';
import { tauriDeviceServices } from './tauri-devices.ts';
import { commands } from './generated/tauri.ts';
import type { SystemChromeHost } from '../runtime/os-services.ts';
import type { TauriScrollEdgeEffects } from '../runtime/config.ts';

type Insets = ViewEnvironment['safeArea'];
type TauriWindow = Window & {
  __TAURI_INTERNALS__?: { invoke: typeof invoke; unregisterCallback(id: number): void };
};

function textOrEmpty(error: unknown): string {
  const message = backendFailure(error).message ?? '';
  if (/clipboard is empty|clipboard contents were not available/i.test(message)) return '';
  throw error;
}

export async function openTauriBackend(
  root: URL,
  expected: BackendIdentity,
  release: boolean,
  signal: AbortSignal,
  developmentBuildId?: string,
): Promise<BackendConnection> {
  const view = window as TauriWindow;
  if (typeof view.__TAURI_INTERNALS__?.invoke !== 'function')
    throw new Error('Nelyx expected the Tauri backend, received no IPC bridge');
  const releaseCallback = (id: number) => view.__TAURI_INTERNALS__?.unregisterCallback(id);
  async function request<T>(call: () => Promise<T>, fail = backendFailure): Promise<T> {
    signal.throwIfAborted();
    try {
      const result = await call();
      signal.throwIfAborted();
      return result;
    } catch (error) {
      signal.throwIfAborted();
      throw fail(error);
    }
  }
  const backend = await request(commands.describe);
  validateBackend(expected, backend);
  if (developmentBuildId && backend.frontendBuildId !== developmentBuildId)
    throw new Error('Waiting for the Tauri development host ' + developmentBuildId);
  if (release) {
    const response = await fetch(new URL('build.json', root), { signal, redirect: 'error' });
    if (!response.ok) throw new Error('Tauri frontend build.json HTTP ' + response.status);
    const { buildId, target } = await response.json();
    if (target !== 'tauri' || !buildId || backend.frontendBuildId !== buildId)
      throw new Error(
        `Tauri frontend build ID: expected ${backend.frontendBuildId}, received ${buildId} (${target})`,
      );
  }
  const os =
    backend.os === 'ios'
      ? 'iOS'
      : backend.os === 'macos'
        ? 'macOS'
        : backend.os === 'windows' || backend.os === 'linux' || backend.os === 'android'
          ? backend.os
          : new BrowserPlatformEnvironment(view.navigator).operatingSystem;
  const mobile = os === 'android' || os === 'iOS';
  const clipboard: ClipboardIO | undefined = backend.clipboard
    ? {
        ...(backend.clipboard.read
          ? {
              readText: () =>
                request(
                  () => invoke<string>('plugin:clipboard-manager|read_text').catch(textOrEmpty),
                  deviceFailure,
                ),
            }
          : {}),
        ...(backend.clipboard.write
          ? {
              writeText: (text: string) =>
                request(
                  () => invoke<void>('plugin:clipboard-manager|write_text', { text }),
                  deviceFailure,
                ),
            }
          : {}),
      }
    : undefined;
  const nativeHaptics = (feedback: HapticRequest) =>
    request(() => invokeHaptics(feedback), deviceFailure);
  const safeArea = backend.safeArea ? createSafeArea(view, releaseCallback, signal) : undefined;
  let chromeUpdates = Promise.resolve();
  const systemChrome: SystemChromeHost = (method, args) => {
    const update = chromeUpdates.then(() =>
      request(() =>
        invoke<void>('plugin:nelyx-backend|system_chrome', {
          request: { method, arguments: args },
        }),
      ),
    );
    chromeUpdates = update.catch(() => {});
    return update;
  };
  let edgeUpdates = Promise.resolve();
  function scrollEdgeEffects(effects: TauriScrollEdgeEffects | null) {
    const settings = effects && { ...effects };
    const update = edgeUpdates.then(() =>
      request(() =>
        invoke<Required<TauriScrollEdgeEffects>>('plugin:nelyx-backend|scroll_edge_effects', {
          effects: settings,
        }),
      ),
    );
    edgeUpdates = update.then(
      () => {},
      () => {},
    );
    return update;
  }
  const back = backend.androidBack
    ? createAndroidBack(
        view,
        () => request(() => invoke<void>('plugin:nelyx-backend|dispatch_default_back')),
        releaseCallback,
        signal,
      )
    : undefined;
  return {
    host: { target: 'tauri', os, backend },
    invoke: (command, input = null) =>
      request(() => invoke('plugin:nelyx-backend|invoke', { command, input })),
    clipboard: (owner) =>
      owner === view
        ? createClipboard(
            owner,
            (input) => request(() => commands.clipboardPolicy(input)),
            clipboard
              ? { host: mobile ? 'native-mobile' : 'native-desktop', io: clipboard }
              : { host: mobile ? 'browser-mobile' : 'browser' },
            signal,
          )
        : createClipboard(owner),
    haptics(owner) {
      if (owner !== view || backend.haptics === null) return;
      return backend.haptics ? nativeHaptics : () => {};
    },
    ...(back ? { androidBack: (owner) => (owner === view ? back : undefined) } : {}),
    ...(backend.systemChrome
      ? { systemChrome: (owner) => (owner === view ? systemChrome : undefined) }
      : {}),
    ...(os === 'iOS'
      ? {
          scrollEdgeEffects: {
            get: () => scrollEdgeEffects(null),
            set: scrollEdgeEffects,
          },
        }
      : {}),
    devices: (owner, options) =>
      owner === view
        ? tauriDeviceServices(owner, options, backend.os, backend.deviceServices, releaseCallback)
        : {},
    ...(safeArea ? { safeArea: (owner) => (owner === view ? safeArea : undefined) } : {}),
    async setTitle(title) {
      if (backend.windowTitle && (os === 'windows' || os === 'linux' || os === 'macOS'))
        await request(() => getCurrentWindow().setTitle(title));
    },
  };
}

function invokeHaptics(feedback: HapticRequest): Promise<void> {
  switch (feedback.kind) {
    case 'vibrate':
      return invoke('plugin:haptics|vibrate', { duration: feedback.duration });
    case 'impact':
      return invoke('plugin:haptics|impact_feedback', { style: feedback.style });
    case 'selection':
      return invoke('plugin:haptics|selection_feedback');
    case 'notification':
      return invoke('plugin:haptics|notification_feedback', { type: feedback.type });
  }
}

function createSafeArea(
  view: Window,
  releaseCallback: (id: number) => void,
  signal: AbortSignal,
): WebSafeAreaSource {
  const listeners = new Set<() => void>();
  let active: { id: string; channel: Channel<Insets>; ready: Promise<void> } | undefined;
  let physical: Insets | undefined;
  function stop() {
    const previous = active;
    active = undefined;
    physical = undefined;
    if (!previous) return;
    previous.channel.onmessage = () => {};
    void previous.ready
      .then(
        () => invoke('plugin:nelyx-backend|unwatch_safe_area', { subscription: previous.id }),
        () => {},
      )
      .catch((error) => {
        if (!signal.aborted) console.error('Nelyx safe area unsubscribe', error);
      })
      .finally(() => releaseCallback(previous.channel.id));
  }
  signal.addEventListener('abort', stop, { once: true });
  return {
    read() {
      if (!physical) return;
      const scale = view.devicePixelRatio || 1;
      return {
        top: physical.top / scale,
        right: physical.right / scale,
        bottom: physical.bottom / scale,
        left: physical.left / scale,
      };
    },
    subscribe(listener) {
      signal.throwIfAborted();
      listeners.add(listener);
      if (!active) {
        const id = crypto.randomUUID();
        const channel = new Channel<Insets>();
        channel.onmessage = (value) => {
          if (active?.id !== id || signal.aborted) return;
          if (
            !['top', 'right', 'bottom', 'left'].every(
              (key) =>
                typeof value?.[key as keyof Insets] === 'number' && value[key as keyof Insets] >= 0,
            )
          )
            return;
          physical = value;
          for (const update of listeners) update();
        };
        const ready = invoke<void>('plugin:nelyx-backend|watch_safe_area', {
          subscription: id,
          onChange: channel,
        });
        active = { id, channel, ready };
        void ready.catch((error) => {
          if (active?.id === id) {
            active = undefined;
            releaseCallback(channel.id);
            if (!signal.aborted) console.error('Nelyx safe area subscribe', error);
          }
        });
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) stop();
      };
    },
  };
}
