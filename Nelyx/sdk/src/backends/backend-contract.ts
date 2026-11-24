// SPDX-License-Identifier: BSD-3-Clause
import { PlatformException } from '@nelyx/core/services/message-codec';
import type { BrowserOperatingSystem } from '@nelyx/core/foundation/platform';
import type { WebSafeAreaSource } from './browser/environment.ts';
import type { ClipboardBinding } from './browser/clipboard.ts';
import type { HapticRequest } from './browser/haptics.ts';
import type { DeviceServices } from '../devices.ts';
import { validDeviceFeatures } from '../runtime/config.ts';
import type { BrowserDeviceOptions } from './browser/devices.ts';

const backendProtocol = 3;

export interface BackendIdentity {
  readonly kind: 'wasm' | 'native';
  readonly backendVersion: string;
  readonly protocolVersion: number;
  readonly sourceId: string;
}

export interface BackendDescription extends BackendIdentity {
  readonly os: string;
  readonly clipboard: { readonly read: boolean; readonly write: boolean } | null;
  readonly haptics: boolean | null;
  readonly androidBack: boolean | null;
  readonly deviceServices: readonly string[];
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
  haptics?(view: Window): ((request: HapticRequest) => Promise<void> | void) | undefined;
  androidBack?(view: Window): AndroidBackSource | undefined;
  devices?(view: Window, options: BrowserDeviceOptions): DeviceServices;
  safeArea?(view: Window): WebSafeAreaSource | undefined;
  setTitle?(title: string): Promise<void>;
}

export interface AndroidBackSource {
  setHandler(handler: () => Promise<boolean>, enabled: boolean): Promise<void>;
}

export function validateBackend(expected: BackendIdentity, actual: BackendDescription): void {
  if (expected.protocolVersion !== backendProtocol)
    throw new Error(
      `Nelyx backend protocolVersion: expected ${backendProtocol}, received ${expected.protocolVersion}`,
    );
  for (const key of ['kind', 'protocolVersion', 'backendVersion', 'sourceId'] as const) {
    if (expected[key] !== actual?.[key])
      throw new Error(`Nelyx backend ${key}: expected ${expected[key]}, received ${actual?.[key]}`);
  }
  if (
    typeof actual.os !== 'string' ||
    typeof actual.safeArea !== 'boolean' ||
    typeof actual.windowTitle !== 'boolean' ||
    (actual.haptics !== null && typeof actual.haptics !== 'boolean') ||
    (actual.androidBack !== null && typeof actual.androidBack !== 'boolean') ||
    !validDeviceFeatures(actual.deviceServices) ||
    (actual.haptics === true && actual.os !== 'android' && actual.os !== 'ios') ||
    (actual.androidBack === true && actual.os !== 'android') ||
    (actual.clipboard !== null &&
      (typeof actual.clipboard?.read !== 'boolean' ||
        typeof actual.clipboard?.write !== 'boolean')) ||
    (actual.title !== null && typeof actual.title !== 'string') ||
    (actual.frontendBuildId !== null && !/^[a-f0-9]{64}$/.test(actual.frontendBuildId)) ||
    (actual.kind === 'wasm' &&
      (actual.os !== 'browser' ||
        actual.safeArea ||
        actual.clipboard !== null ||
        actual.haptics !== null ||
        actual.androidBack !== null ||
        actual.deviceServices.length !== 0))
  )
    throw new Error('Nelyx backend returned invalid host features: ' + JSON.stringify(actual));
}

export function backendFailure(error: unknown): PlatformException {
  if (error instanceof PlatformException) return error;
  const value = error as { code?: unknown; message?: unknown } | null;
  return new PlatformException({
    code: typeof value?.code === 'string' ? value.code : 'platform-error',
    message: typeof value?.message === 'string' ? value.message : String(error),
  });
}

/** Device APIs can reject with a DOMException, a Tauri message, or a backend error. */
export function deviceFailure(error: unknown): PlatformException {
  const failure = backendFailure(error);
  if (failure.code !== 'platform-error') return failure;
  const value = error as { name?: unknown } | null;
  const reason = (typeof value?.name === 'string' ? value.name + ': ' : '') + failure.message;
  if (
    /notallowederror|securityerror|not allowed|permission (?:denied|not granted)|forbidden|unauthorized|not permitted/i.test(
      reason,
    )
  )
    return new PlatformException({ code: 'permission-denied', message: failure.message });
  if (/notsupportederror|not supported|not implemented/i.test(reason))
    return new PlatformException({ code: 'unsupported', message: failure.message });
  return failure;
}
