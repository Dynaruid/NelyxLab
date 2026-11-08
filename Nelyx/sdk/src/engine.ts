// SPDX-License-Identifier: BSD-3-Clause
import { EngineClient, resolveEngineV2, protocol } from '@nelyx/core/engine';
import type { EngineIdentity, EngineTransport } from '@nelyx/core/engine';
export { EngineClient, EngineError, protocol } from '@nelyx/core/engine';
export type { EngineIdentity, EngineResponse, EngineTransport } from '@nelyx/core/engine';
export { createBrowserEngineV2Surface } from './runtime/engine-v2-browser.ts';
export type { EngineBrowserSurface, EngineWebProfile } from './runtime/engine-v2-browser.ts';
export { bindBrowserAppServices } from './platforms/web/app-services.ts';

export interface EngineV2Host extends EngineTransport {
  readonly identity: EngineIdentity;
}
/** Packet/surface entry without either App frontend or renderer fallback. */
export async function connectEngineV2Host(
  host: EngineV2Host,
  options: {
    bundle?: EngineIdentity;
    session?: number;
    app?: number;
    requiredCapabilities?: number;
  } = {},
): Promise<EngineClient> {
  resolveEngineV2(
    options.bundle ?? { engine: 'v2', abiMajor: protocol.abiMajor, schema: protocol.schema },
    host.identity,
  );
  return EngineClient.connect(host, options);
}
