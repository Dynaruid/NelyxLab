// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import { FlutterError } from '../foundation/flutter-error.ts';
import type { ImmutableBufferValue } from '../ui/immutable-buffer-binding.ts';
/** @internal Loads capture this owner synchronously before any IO awaits. */
export interface AssetLoaderBackend {
  load(key: string): Promise<Uint8Array>;
  loadBuffer?(key: string): Promise<ImmutableBufferValue>;
  loadNetwork?(baseUrl: string, key: string): Promise<Uint8Array>;
  loadNetworkBuffer?(baseUrl: string, key: string): Promise<ImmutableBufferValue>;
}
let backend: AssetLoaderBackend | null = null;
const leases = new Set<object>();
export function currentAssetLoader(): AssetLoaderBackend | null {
  return backend;
}
export function bindAssetLoader(value: AssetLoaderBackend): Disposable {
  if (backend && backend !== value)
    throw new FlutterError('A different default AssetBundle already owns this realm');
  backend = value;
  const lease = {};
  leases.add(lease);
  return {
    dispose() {
      if (!leases.delete(lease)) return;
      if (!leases.size) backend = null;
    },
  };
}
