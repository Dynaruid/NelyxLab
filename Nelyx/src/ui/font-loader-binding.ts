// SPDX-License-Identifier: BSD-3-Clause
import type { Disposable } from '../foundation/disposable.ts';
import { FlutterError } from '../foundation/flutter-error.ts';

/** @internal The embedding owns snapshots, admission, decoding and publication. */
export interface FontLoaderBackend {
  loadFont(bytes: Uint8Array, family?: string): Promise<void>;
}
let defaultBackend: FontLoaderBackend | undefined;
const leases = new Set<object>();
/** @internal One default font namespace per App realm, never a stack of owners. */
export function bindFontLoader(backend: FontLoaderBackend): Disposable {
  if (defaultBackend && defaultBackend !== backend)
    throw new FlutterError('A different default FontLoader already owns this realm');
  const lease = {};
  defaultBackend = backend;
  leases.add(lease);
  return {
    dispose() {
      if (!leases.delete(lease)) return;
      if (!leases.size) defaultBackend = undefined;
    },
  };
}
/** @internal Capture before awaiting, so work never migrates to a later App. */
export function currentFontLoader(): FontLoaderBackend | null {
  return defaultBackend ?? null;
}
