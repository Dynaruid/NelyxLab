// SPDX-License-Identifier: BSD-3-Clause
import { BrowserPlatformEnvironment } from '../frontend/dom/environment.ts';
import { backendFailure, validateBackend } from './backend-contract.ts';
import type { BackendConnection, BackendDescription, BackendIdentity } from './backend-contract.ts';
import { createClipboard } from './browser/clipboard.ts';
import type { ClipboardPolicy } from './browser/clipboard.ts';
import { sha256 } from './sha256.ts';

interface WasmModule {
  default(input: { module_or_path: ArrayBuffer }): Promise<unknown>;
  describe(): string;
  invoke(command: string, input: string): string;
  clipboard_policy(input: string): string;
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
        undefined,
        signal,
      ),
  };
}
