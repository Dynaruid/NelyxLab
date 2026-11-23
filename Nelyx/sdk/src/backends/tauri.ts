// SPDX-License-Identifier: BSD-3-Clause
import type { ViewEnvironment } from '@nelyx/core/ui/types';
import { BrowserPlatformEnvironment } from '../frontend/dom/environment.ts';
import { backendFailure, validateBackend } from './backend-contract.ts';
import type { BackendConnection, BackendDescription, BackendIdentity } from './backend-contract.ts';
import { createClipboard } from './browser/clipboard.ts';
import type { ClipboardPolicy, NativeClipboard } from './browser/clipboard.ts';
import type { WebSafeAreaSource } from './browser/environment.ts';

type Insets = ViewEnvironment['safeArea'];
interface Channel {
  onmessage: (value: Insets) => void;
  readonly id: number;
}
interface TauriWindow extends Window {
  __TAURI__?: {
    core: {
      invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
      Channel: new () => Channel;
    };
    window: { getCurrentWindow(): { setTitle(title: string): Promise<void> } };
  };
  __TAURI_INTERNALS__?: { unregisterCallback(id: number): void };
}

export async function openTauriBackend(
  root: URL,
  expected: BackendIdentity,
  release: boolean,
  signal: AbortSignal,
): Promise<BackendConnection> {
  const view = window as TauriWindow;
  const api = view.__TAURI__;
  if (!api?.core) throw new Error('Nelyx expected the Tauri backend, received no IPC bridge');
  const { core } = api;
  async function request<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    signal.throwIfAborted();
    try {
      const result = await core.invoke<T>(command, args);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      throw backendFailure(error);
    }
  }
  const backend = await request<BackendDescription>('plugin:nelyx-backend|describe');
  validateBackend(expected, backend);
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
          : new BrowserPlatformEnvironment(navigator).operatingSystem;
  const native: NativeClipboard | undefined = backend.clipboard
    ? {
        mobile: os === 'android' || os === 'iOS',
        ...(backend.clipboard.read
          ? {
              readText: () => request<string>('plugin:clipboard-manager|read_text'),
            }
          : {}),
        ...(backend.clipboard.write
          ? {
              writeText: (text: string) =>
                request<void>('plugin:clipboard-manager|write_text', { text }),
            }
          : {}),
      }
    : undefined;
  const safeArea = backend.safeArea ? createSafeArea(view, core, signal) : undefined;
  return {
    host: { target: 'tauri', os, backend },
    invoke: (command, input = null) => request('plugin:nelyx-backend|invoke', { command, input }),
    clipboard: (owner) =>
      createClipboard(
        owner,
        (input) => request<ClipboardPolicy>('plugin:nelyx-backend|clipboard_policy', { input }),
        native,
        signal,
      ),
    ...(safeArea ? { safeArea: () => safeArea } : {}),
    async setTitle(title) {
      if (backend.windowTitle && (os === 'windows' || os === 'linux' || os === 'macOS'))
        await api.window.getCurrentWindow().setTitle(title);
    },
  };
}

function createSafeArea(
  view: TauriWindow,
  core: NonNullable<TauriWindow['__TAURI__']>['core'],
  signal: AbortSignal,
): WebSafeAreaSource {
  const listeners = new Set<() => void>();
  let active: { id: string; channel: Channel; ready: Promise<void> } | undefined;
  let physical: Insets | undefined;
  function stop() {
    const previous = active;
    active = undefined;
    physical = undefined;
    if (!previous) return;
    previous.channel.onmessage = () => {};
    void previous.ready
      .catch(() => {})
      .then(() =>
        core.invoke('plugin:nelyx-backend|unwatch_safe_area', { subscription: previous.id }),
      )
      .catch((error) => {
        if (!signal.aborted) console.error('Nelyx safe area unsubscribe', error);
      })
      .finally(() => view.__TAURI_INTERNALS__?.unregisterCallback(previous.channel.id));
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
        const channel = new core.Channel();
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
        const ready = core.invoke<void>('plugin:nelyx-backend|watch_safe_area', {
          subscription: id,
          onChange: channel,
        });
        active = { id, channel, ready };
        void ready.catch((error) => {
          if (active?.id === id) {
            active = undefined;
            view.__TAURI_INTERNALS__?.unregisterCallback(channel.id);
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
