// SPDX-License-Identifier: BSD-3-Clause
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { BrowserOperatingSystem } from '@nelyx/core/foundation/platform';
import type { WebSafeAreaSource } from './browser/environment.ts';
import type { ClipboardBinding } from './browser/clipboard.ts';

export interface BackendIdentity {
  readonly kind: 'wasm' | 'native';
  readonly backendVersion: string;
  readonly protocolVersion: number;
  readonly sourceId: string;
}

export interface BackendDescription extends BackendIdentity {
  readonly os: string;
  readonly clipboard: { readonly read: boolean; readonly write: boolean } | null;
  readonly safeArea: boolean;
  readonly windowTitle: boolean;
  readonly title: string | null;
  readonly frontendBuildId: string | null;
}

export interface FrontendHost {
  readonly target: 'web' | 'tauri';
  readonly os: BrowserOperatingSystem;
  readonly backend?: BackendDescription;
}

export interface BackendConnection {
  readonly host: FrontendHost;
  invoke(command: string, input?: unknown): Promise<unknown>;
  clipboard(view: Window): ClipboardBinding;
  safeArea?(view: Window): WebSafeAreaSource | undefined;
  setTitle?(title: string): Promise<void>;
}

export function validateBackend(expected: BackendIdentity, actual: BackendDescription): void {
  for (const key of ['kind', 'protocolVersion', 'backendVersion', 'sourceId'] as const) {
    if (expected[key] !== actual?.[key])
      throw new Error(`Nelyx backend ${key}: expected ${expected[key]}, received ${actual?.[key]}`);
  }
  if (
    typeof actual.os !== 'string' ||
    typeof actual.safeArea !== 'boolean' ||
    typeof actual.windowTitle !== 'boolean' ||
    (actual.clipboard !== null &&
      (typeof actual.clipboard?.read !== 'boolean' ||
        typeof actual.clipboard?.write !== 'boolean')) ||
    (actual.title !== null && typeof actual.title !== 'string') ||
    (actual.frontendBuildId !== null && !/^[a-f0-9]{64}$/.test(actual.frontendBuildId)) ||
    (actual.kind === 'wasm' &&
      (actual.os !== 'browser' || actual.safeArea || actual.clipboard !== null))
  )
    throw new Error('Nelyx backend returned invalid host features: ' + JSON.stringify(actual));
}

export function backendFailure(error: unknown): PlatformException {
  const value = error as { code?: unknown; message?: unknown } | null;
  return new PlatformException({
    code: typeof value?.code === 'string' ? value.code : 'platform-error',
    message: typeof value?.message === 'string' ? value.message : String(error),
  });
}
