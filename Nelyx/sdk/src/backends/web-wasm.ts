// SPDX-License-Identifier: BSD-3-Clause
import { BrowserPlatformEnvironment } from '../frontend/dom/environment.ts';
import { backendFailure, deviceFailure, validateBackend } from './backend-contract.ts';
import type { BackendConnection, BackendDescription, BackendIdentity } from './backend-contract.ts';
import { createClipboard } from './browser/clipboard.ts';
import { browserDeviceServices } from './browser/devices.ts';
import type { BrowserGeolocation } from './browser/devices.ts';
import type { ClipboardIO, ClipboardPermission, ClipboardPolicy } from './browser/clipboard.ts';
import { sha256 } from './sha256.ts';

type WasmModule = typeof import('./generated/wasm/backend.js');

function wasmGeolocation(module: WasmModule, view: Window): BrowserGeolocation {
  return {
    current: (success, failure, options = {}) =>
      module.browser_geolocation_current(view, success, failure, options),
    watch: (success, failure, options = {}) =>
      module.browser_geolocation_watch(view, success, failure, options),
    clear: (id) => module.browser_geolocation_clear(view, id),
  };
}

function bindClipboard(module: WasmModule, view: Window): ClipboardIO {
  const devices = module.bind_browser_devices(view);
  return {
    ...(devices.can_read_clipboard() ? { readText: () => devices.read_clipboard_text() } : {}),
    ...(devices.can_write_clipboard()
      ? { writeText: (text: string) => devices.write_clipboard_text(text) }
      : {}),
    async queryPermission(name) {
      const status = await devices.clipboard_permission(name === 'clipboard-read');
      if (!status) return;
      return {
        get state() {
          return module.clipboard_permission_state(status) as ClipboardPermission['state'];
        },
        subscribe(listener) {
          const observer = module.observe_clipboard_permission(status, listener);
          return () => observer.free();
        },
      };
    },
    dispose: () => devices.free(),
  };
}

export async function openWasmBackend(
  root: URL,
  expected: BackendIdentity,
  wasmSha256: string,
  signal: AbortSignal,
): Promise<BackendConnection> {
  const moduleUrl = new URL('runtime/backend/backend.js', root).href;
  const wasmUrl = new URL('runtime/backend/backend_bg.wasm', root);
  const [module, response] = await Promise.all([
    import(/* @vite-ignore */ moduleUrl) as Promise<WasmModule>,
    fetch(wasmUrl, { signal, redirect: 'error' }),
  ]);
  if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/wasm')
    throw new Error(
      `Nelyx backend Wasm expected application/wasm, received HTTP ${response.status} ${response.headers.get('content-type')}`,
    );
  const bytes = await response.arrayBuffer();
  const actual = sha256(new Uint8Array(bytes));
  if (actual !== wasmSha256)
    throw new Error(`Nelyx backend Wasm SHA-256: expected ${wasmSha256}, received ${actual}`);
  await module.default({ module_or_path: bytes });
  signal.throwIfAborted();
  const backend = JSON.parse(module.describe()) as BackendDescription;
  validateBackend(expected, backend);
  for (const name of [
    'bind_browser_devices',
    'clipboard_permission_state',
    'observe_clipboard_permission',
    'vibrate_browser',
    'browser_geolocation_available',
    'browser_geolocation_current',
    'browser_geolocation_watch',
    'browser_geolocation_clear',
    'clipboard_policy',
    'invoke',
  ] as const) {
    if (typeof module[name] !== 'function')
      throw new Error('Nelyx backend Wasm is missing export ' + name);
  }
  return {
    host: { target: 'web', os: new BrowserPlatformEnvironment(navigator).operatingSystem, backend },
    async invoke(command, input = null) {
      signal.throwIfAborted();
      const response = JSON.parse(module.invoke(command, JSON.stringify(input)));
      if ('Err' in response) throw backendFailure(response.Err);
      return response.Ok;
    },
    clipboard: (view) =>
      createClipboard(
        view,
        (input) => {
          signal.throwIfAborted();
          return JSON.parse(module.clipboard_policy(JSON.stringify(input))) as ClipboardPolicy;
        },
        { io: bindClipboard(module, view) },
        signal,
      ),
    haptics: (view) => (request) => {
      signal.throwIfAborted();
      try {
        module.vibrate_browser(view, request.duration);
      } catch (error) {
        throw deviceFailure(error);
      }
    },
    devices: (view, options) => browserDeviceServices(view, {
      ...options,
      location: module.browser_geolocation_available(view) ? wasmGeolocation(module, view) : false,
    }),
  };
}
