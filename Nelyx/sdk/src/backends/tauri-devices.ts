// SPDX-License-Identifier: BSD-3-Clause
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { deviceBarcodeFormats, deviceFeatures } from '../devices.ts';
import type { DeviceFeature, DeviceFileOptions, DeviceNfcText, DeviceServices, DeviceValue } from '../devices.ts';
import { abortable, deviceError, deviceOperationError, throwIfCancelled } from '../runtime/device-scope.ts';
import type { DeviceScope } from '../runtime/device-scope.ts';
import { deviceKey, externalUrl, nfcText, permission, position, selectedFilters } from '../runtime/device-values.ts';
import { browserDeviceServices } from './browser/devices.ts';
import type { BrowserDeviceOptions } from './browser/devices.ts';

export function tauriDeviceServices(
  view: Window,
  options: BrowserDeviceOptions,
  os: string,
  requested: readonly string[],
  releaseCallback: (id: number) => void,
): DeviceServices {
  const { scope } = options;
  const enabled = new Set<DeviceFeature>(deviceFeatures.filter((name) => requested.includes(name)));
  const mobile = os === 'android' || os === 'ios';
  const native: { -readonly [K in keyof DeviceServices]: DeviceServices[K] } = {};

  if (enabled.has('location') && mobile) native.location = nativeLocation(scope, releaseCallback);
  if (enabled.has('notifications')) native.notifications = nativeNotifications(scope);
  if (enabled.has('files')) native.files = nativeFiles(scope, os);
  if (enabled.has('openUrl')) native.openUrl = (input) => scope.run(() =>
    invoke('plugin:opener|open_url', { url: externalUrl(input) }));
  if (enabled.has('deepLinks')) native.deepLinks = nativeLinks(scope);
  if (enabled.has('store')) native.store = nativeStore(scope);
  if (enabled.has('barcode') && mobile) native.barcode = nativeBarcode(scope, os);
  if (enabled.has('nfc') && mobile) native.nfc = nativeNfc(scope, os);
  if (enabled.has('biometrics') && (mobile || os === 'macos')) native.biometrics = nativeBiometrics(scope);

  const fallback = new Set(enabled);
  for (const key of Object.keys(native) as DeviceFeature[]) fallback.delete(key);
  return Object.freeze({
    ...browserDeviceServices(view, {
      ...options,
      enabled: fallback,
      ...(enabled.has('camera') && mobile ? { prepareCamera } : {}),
    }),
    ...native,
  });
}

type Position = Parameters<typeof position>[0];
type LocationPermission = { location: string; coarseLocation: string };

function nativeLocation(scope: DeviceScope, releaseCallback: (id: number) => void): NonNullable<DeviceServices['location']> {
  const configure = async (options: PositionOptions | undefined) => {
    let state = await invoke<LocationPermission>('plugin:geolocation|check_permissions');
    const permitted = () => state.location === 'granted' || state.coarseLocation === 'granted';
    if (!permitted() && [state.location, state.coarseLocation].some((value) => permission(value) === 'prompt')) {
      throwIfCancelled(scope.signal);
      state = await invoke<LocationPermission>('plugin:geolocation|request_permissions', { permissions: ['location'] });
    }
    if (!permitted()) throw deviceError('permission-denied', 'Location permission was denied');
    throwIfCancelled(scope.signal);
    return {
      enableHighAccuracy: options?.enableHighAccuracy === true,
      timeout: millisecondOption(options?.timeout, 10_000),
      maximumAge: millisecondOption(options?.maximumAge, 0),
    };
  };
  return {
    current: (options) => scope.run(async () => {
      const settings = await configure(options);
      return position(await abortable(invoke<Position>('plugin:geolocation|get_current_position', { options: settings }), scope.signal));
    }),
    watch: (change, failure, options) => scope.run(async () => {
      const settings = await configure(options);
      const channel = new Channel<Position | string>();
      channel.onmessage = (value) => {
        if (scope.signal.aborted) return;
        if (typeof value === 'string') failure?.(deviceOperationError(value));
        else {
          let sample;
          try { sample = position(value); }
          catch (error) { failure?.(error); return; }
          change(sample);
        }
      };
      try {
        await invoke('plugin:geolocation|watch_position', { options: settings, channel });
      } catch (error) {
        releaseCallback(channel.id);
        throw error;
      }
      const watcher = scope.own(async () => {
        channel.onmessage = () => {};
        try { await invoke('plugin:geolocation|clear_watch', { channelId: channel.id }); }
        finally { releaseCallback(channel.id); }
      });
      if (scope.signal.aborted) await watcher.dispose();
      return watcher;
    }),
  };
}

function millisecondOption(input: number | undefined, defaultValue: number): number {
  if (input === undefined) return defaultValue;
  if (input === Infinity) return 0xffffffff;
  if (!Number.isFinite(input) || input < 0)
    throw deviceError('invalid-arguments', 'Location time options must be non-negative milliseconds');
  return Math.min(0xffffffff, Math.trunc(input));
}

function nativeNotifications(scope: DeviceScope): NonNullable<DeviceServices['notifications']> {
  const state = async () => {
    const result = await invoke<boolean | null>('plugin:notification|is_permission_granted');
    return result === null ? 'prompt' as const : result ? 'granted' as const : 'denied' as const;
  };
  return {
    permission: () => scope.run(state),
    requestPermission: () => scope.run(async () => permission(await invoke('plugin:notification|request_permission'))),
    show: (options) => scope.run(async () => {
      const permission = await state();
      if (permission !== 'granted')
        throw deviceError(permission === 'denied' ? 'permission-denied' : 'permission-required', 'Notification permission is required');
      throwIfCancelled(scope.signal);
      await invoke('plugin:notification|notify', { options });
    }),
  };
}

function fileName(location: string, os: string): string {
  if (!/^(?:file|content):\/\//i.test(location))
    return location.split(os === 'windows' ? /[\\/]/ : '/').at(-1) ?? location;
  const segment = location.split('/').at(-1) ?? location;
  try { return decodeURIComponent(segment); }
  catch { return segment; }
}

function nativeFiles(scope: DeviceScope, os: string): NonNullable<DeviceServices['files']> {
  let picking = false;
  return {
    pick: (options: DeviceFileOptions = {}, user) => scope.cancelWith(user, async (signal) => {
      if (picking) throw deviceError('busy', 'A file picker is already open in this view');
      const filters = selectedFilters(options.filters) ?? [];
      picking = true;
      const opening = invoke<string | string[] | null>('plugin:dialog|open', {
        options: { multiple: options.multiple === true, directory: false, filters },
      }).finally(() => { picking = false; });
      const selected = await abortable(opening, signal);
      const paths = selected === null ? [] : typeof selected === 'string' ? [selected] : selected;
      return Promise.all(paths.map(async (path) => ({
        name: os === 'android' && path.startsWith('content:')
          ? (await invoke<string | null>('plugin:nelyx-backend|device_file_name', { uri: path })) ?? fileName(path, os)
          : fileName(path, os),
        read: () => scope.run(async () => {
          const bytes = await invoke<ArrayBuffer | number[]>('plugin:fs|read_file', { path });
          return Array.isArray(bytes) ? Uint8Array.from(bytes) : new Uint8Array(bytes);
        }),
      })));
    }),
  };
}

function nativeLinks(scope: DeviceScope): NonNullable<DeviceServices['deepLinks']> {
  const urls = (input: readonly string[] | null) => (input ?? []).filter((value) => {
    try { return typeof value === 'string' && !!new URL(value).protocol; }
    catch { return false; }
  });
  return {
    current: () => scope.run(async () => urls(await invoke<string[] | null>('plugin:deep-link|get_current'))),
    watch: (change) => scope.run(async () => {
      const stop = await listen<string[]>('deep-link://new-url', (event) => {
        if (scope.signal.aborted) return;
        const incoming = urls(event.payload);
        if (incoming.length) change(incoming);
      });
      const subscription = scope.own(stop);
      if (scope.signal.aborted) await subscription.dispose();
      return subscription;
    }),
  };
}

function nativeStore(scope: DeviceScope): NonNullable<DeviceServices['store']> {
  return {
    get: (key) => scope.run(async () => {
      const result = await invoke<{ found: boolean; value: DeviceValue }>('plugin:nelyx-backend|device_store', {
        input: { operation: 'get', key: deviceKey(key) },
      });
      return result.found ? result.value : undefined;
    }),
    set: (key, value) => scope.run(() => invoke('plugin:nelyx-backend|device_store', {
      input: { operation: 'set', key: deviceKey(key), value },
    })),
    remove: (key) => scope.run(() => invoke('plugin:nelyx-backend|device_store', {
      input: { operation: 'remove', key: deviceKey(key) },
    })),
  };
}

async function prepareCamera(): Promise<void> {
  let { camera } = await invoke<{ camera: string }>('plugin:barcode-scanner|check_permissions');
  if (permission(camera) === 'prompt')
    ({ camera } = await invoke<{ camera: string }>('plugin:barcode-scanner|request_permissions'));
  if (camera !== 'granted') throw deviceError('permission-denied', 'Camera permission was denied');
}

function nativeBarcode(scope: DeviceScope, os: string): NonNullable<DeviceServices['barcode']> {
  let scanning = false;
  return {
    scan: (formats, user) => scope.cancelWith(user, async (signal) => {
      if (scanning) throw deviceError('busy', 'A barcode scan is already active in this view');
      if (os === 'ios' && formats?.includes('upc_a'))
        throw deviceError('unsupported', 'UPC-A scanning is unavailable on iOS');
      scanning = true;
      let pending: Promise<{ content: string; format: string }> | undefined;
      let cancellation: Promise<void> | undefined;
      const stop = () => {
        if (pending) cancellation ??= invoke<void>('plugin:barcode-scanner|cancel').catch((error: unknown) => {
          if (!/no (?:active )?scan|not scanning/i.test(String(error))) throw error;
        });
        return cancellation;
      };
      const cancel = () => { void stop()?.catch(() => {}); };
      signal.addEventListener('abort', cancel, { once: true });
      const handle = scope.own(async () => { if (signal.aborted) await stop(); });
      try {
        await abortable(prepareCamera(), signal);
        throwIfCancelled(signal);
        pending = invoke('plugin:barcode-scanner|scan', { formats: formats?.map((format) => format.toUpperCase()) });
        const result = await abortable(pending, signal);
        const format = deviceBarcodeFormats.find((format) => format.toUpperCase() === result.format) ?? 'unknown';
        return { text: result.content, format };
      } finally {
        signal.removeEventListener('abort', cancel);
        try { await handle.dispose(); }
        finally { scanning = false; }
      }
    }),
  };
}

type NdefRecord = { tnf: number; kind: number[]; payload: number[] };

function readNdefText(records: NdefRecord[]): DeviceNfcText | null {
  const record = records.find(({ tnf, kind }) => tnf === 1 && kind.length === 1 && kind[0] === 0x54);
  if (!record) return null;
  const bytes = Uint8Array.from(record.payload);
  const status = bytes[0];
  if (status === undefined || (status & 0x40) !== 0) return null;
  const languageLength = status & 0x3f;
  if (bytes.length < 1 + languageLength) return null;
  const value = bytes.subarray(1 + languageLength);
  const utf16 = (status & 0x80) !== 0;
  const encoding = utf16 ? (value[0] === 0xff && value[1] === 0xfe ? 'utf-16le' : 'utf-16be') : 'utf-8';
  const text = new TextDecoder(encoding).decode(value);
  const language = new TextDecoder().decode(bytes.subarray(1, 1 + languageLength));
  return { text, ...(language ? { language } : {}) };
}

function nativeNfc(scope: DeviceScope, os: string): NonNullable<DeviceServices['nfc']> {
  let busy = false;
  const available = async () => (await invoke<{ available: boolean }>('plugin:nfc|is_available')).available;
  async function inSession<T>(signal: AbortSignal, call: () => Promise<T>): Promise<T> {
    if (busy) throw deviceError('busy', 'An NFC session is already active');
    busy = true;
    try {
      if (!await available()) throw deviceError('unavailable', 'NFC is unavailable on this device');
      throwIfCancelled(signal);
      return await call();
    } finally {
      busy = false;
    }
  }
  return {
    available: () => scope.run(available),
    read: (user) => scope.cancelWith(user, (signal) => abortable(inSession(signal, async () => {
      const { records } = await invoke<{ records: NdefRecord[] }>('plugin:nfc|scan', {
        kind: os === 'ios' ? 'ndef' : { tag: {} }, keepSessionAlive: false,
      });
      return readNdefText(records);
    }), signal)),
    write: (record) => scope.run(() => inSession(scope.signal, () => {
      const { text, language } = nfcText(record);
      const utf8 = new TextEncoder();
      const lang = utf8.encode(language);
      return invoke('plugin:nfc|write', {
        kind: os === 'ios' ? 'ndef' : { tag: {} },
        records: [{ format: 1, kind: [0x54], id: [], payload: [lang.length, ...lang, ...utf8.encode(text)] }],
      });
    })),
  };
}

function nativeBiometrics(scope: DeviceScope): NonNullable<DeviceServices['biometrics']> {
  return {
    available: () => scope.run(async () => (await invoke<{ isAvailable: boolean }>('plugin:biometric|status')).isAvailable),
    authenticate: (reason) => scope.run(() => {
      if (!reason.trim()) throw deviceError('invalid-arguments', 'A biometric authentication reason is required');
      return invoke('plugin:biometric|authenticate', { reason, allowDeviceCredential: false });
    }),
  };
}
