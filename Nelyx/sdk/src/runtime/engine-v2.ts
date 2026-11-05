// SPDX-License-Identifier: BSD-3-Clause
import { EngineClient, resolveEngineV2, protocol } from '@nelyx/core/v2';
import type { EngineIdentity, EngineTransport } from '@nelyx/core/v2';
export { EngineClient, EngineError, protocol } from '@nelyx/core/v2';
export type { EngineIdentity, EngineResponse, EngineTransport } from '@nelyx/core/v2';
export { createBrowserEngineV2Surface } from './engine-v2-browser.ts';
export type { EngineBrowserSurface, EngineWebProfile } from './engine-v2-browser.ts';
export { defineEngineV2App, launchEngineV2App } from './engine-v2-app.ts';
export type { EngineV2App, EngineV2AppContext } from './engine-v2-app.ts';

export interface EngineV2Host extends EngineTransport {
  readonly identity: EngineIdentity;
}
/** Explicit v2 packet-port entrypoint. A v1 renderer is never used as fallback.
 * Platform surface/provider bootstrap is supplied by the v2 host, not this client. */
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
