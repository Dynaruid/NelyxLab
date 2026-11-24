// SPDX-License-Identifier: BSD-3-Clause
import type {
  DeviceCamera, DeviceFeature, DeviceFile, DeviceFileOptions, DeviceServices, DeviceValue,
} from '../../devices.ts';
import { abortable, deviceError, throwIfCancelled } from '../../runtime/device-scope.ts';
import type { DeviceScope } from '../../runtime/device-scope.ts';
import { deviceKey, externalUrl, locationError, permission, position, selectedFilters } from '../../runtime/device-values.ts';
import { browserHardware } from './device-hardware.ts';

export interface BrowserGeolocation {
  current(success: PositionCallback, failure: PositionErrorCallback, options?: PositionOptions): void;
  watch(success: PositionCallback, failure: PositionErrorCallback, options?: PositionOptions): number;
  clear(id: number): void;
}

export interface BrowserDeviceOptions {
  readonly scope: DeviceScope;
  readonly root: URL;
  readonly namespace: string;
  readonly enabled?: ReadonlySet<DeviceFeature>;
  readonly location?: BrowserGeolocation | false;
  readonly prepareCamera?: () => Promise<void>;
}

export function browserDeviceServices(view: Window, options: BrowserDeviceOptions): DeviceServices {
  const { scope } = options;
  const has = (feature: DeviceFeature) => !options.enabled || options.enabled.has(feature);
  const nav = view.navigator;
  const secure = view.isSecureContext;
  const geo = secure ? options.location ?? browserGeolocation(nav.geolocation) : undefined;
  const notifications = secure ? (view as Window & { Notification?: typeof Notification }).Notification : undefined;
  const store = has('store') ? localStore(view, scope, options.root, options.namespace) : undefined;
  const camera = secure && typeof nav.mediaDevices?.getUserMedia === 'function'
    ? browserCamera(nav.mediaDevices, scope, options.prepareCamera)
    : undefined;

  return Object.freeze({
    ...(geo && has('location') ? { location: locationServices(geo, scope) } : {}),
    ...(notifications && has('notifications') ? { notifications: notificationServices(notifications, nav, scope) } : {}),
    ...(has('files') ? { files: filePicker(view, scope) } : {}),
    ...(has('openUrl') ? { openUrl: (url: URL | string) => scope.run(() => {
      const anchor = view.document.createElement('a');
      anchor.href = externalUrl(url);
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
    }) } : {}),
    ...(has('deepLinks') ? { deepLinks: browserLinks(view, scope) } : {}),
    ...(store ? { store } : {}),
    ...(camera && has('camera') ? { camera } : {}),
    ...browserHardware(view, scope, has, camera),
  });
}

function browserGeolocation(geo: Geolocation | undefined): BrowserGeolocation | undefined {
  return geo && typeof geo.getCurrentPosition === 'function' && typeof geo.watchPosition === 'function' &&
    typeof geo.clearWatch === 'function'
    ? {
        current: (success, failure, options) => geo.getCurrentPosition(success, failure, options),
        watch: (success, failure, options) => geo.watchPosition(success, failure, options),
        clear: (id) => geo.clearWatch(id),
      }
    : undefined;
}

function locationServices(geo: BrowserGeolocation, scope: DeviceScope): NonNullable<DeviceServices['location']> {
  return {
    current: (options) => scope.run(async () => {
      const value = await abortable(new Promise<GeolocationPosition>((resolve, reject) => {
        geo.current(resolve, (error) => reject(locationError(error)), options);
      }), scope.signal);
      return position(value);
    }),
    watch: (change, failure, options) => scope.run(() => {
      let active = true;
      const live = () => active && !scope.signal.aborted;
      const id = geo.watch(
        (value) => { if (live()) change(position(value)); },
        (error) => { if (live()) failure?.(locationError(error)); },
        options,
      );
      return scope.own(() => {
        active = false;
        geo.clear(id);
      });
    }),
  };
}

function notificationServices(Notification: typeof globalThis.Notification, nav: Navigator, scope: DeviceScope): NonNullable<DeviceServices['notifications']> {
  return {
    permission: () => scope.run(() => permission(Notification.permission)),
    requestPermission: () => scope.run(async () => permission(await Notification.requestPermission())),
    show: ({ title, body }) => scope.run(async () => {
      if (Notification.permission !== 'granted')
        throw deviceError(Notification.permission === 'denied' ? 'permission-denied' : 'permission-required',
          'Notification permission is required');
      const options = body === undefined ? {} : { body };
      const registration = await nav.serviceWorker?.getRegistration();
      throwIfCancelled(scope.signal);
      if (registration?.active) await registration.showNotification(title, options);
      else {
        try {
          new Notification(title, options);
        } catch (error) {
          if ((error as { name?: string } | null)?.name !== 'TypeError') throw error;
          throw deviceError('unsupported', 'This browser requires an active notification service worker');
        }
      }
    }),
  };
}

function filePicker(view: Window, scope: DeviceScope): NonNullable<DeviceServices['files']> {
  let picking = false;
  return {
    pick: (options: DeviceFileOptions = {}, user?: AbortSignal) => scope.cancelWith(user, async (signal) => {
      if (picking) throw deviceError('busy', 'A file picker is already open in this view');
      const { document } = view;
      const input = document.createElement('input');
      input.type = 'file';
      input.hidden = true;
      input.multiple = options.multiple === true;
      input.accept = selectedFilters(options.filters)?.flatMap((filter) => filter.extensions.map((ext) => '.' + ext)).join(',') ?? '';
      let selected: () => void = () => {};
      let cancelled: () => void = () => {};
      const result = new Promise<readonly DeviceFile[]>((resolve) => {
        selected = () => resolve(Array.from(input.files ?? [], (file) => ({
          name: file.name,
          read: () => scope.run(async () => new Uint8Array(await file.arrayBuffer())),
        })));
        cancelled = () => resolve([]);
      });
      picking = true;
      try {
        input.addEventListener('change', selected, { once: true });
        input.addEventListener('cancel', cancelled, { once: true });
        document.body.append(input);
        input.click();
        return await abortable(result, signal);
      } finally {
        input.removeEventListener('change', selected);
        input.removeEventListener('cancel', cancelled);
        input.remove();
        picking = false;
      }
    }),
  };
}

function browserLinks(view: Window, scope: DeviceScope): NonNullable<DeviceServices['deepLinks']> {
  const entry = view.location.href;
  return {
    current: () => scope.run(() => [entry]),
    watch: (change) => scope.run(() => {
      let previous = view.location.href;
      const listener = () => {
        const current = view.location.href;
        if (scope.signal.aborted || previous === current) return;
        previous = current;
        change([current]);
      };
      view.addEventListener('popstate', listener);
      view.addEventListener('hashchange', listener);
      return scope.own(() => {
        view.removeEventListener('popstate', listener);
        view.removeEventListener('hashchange', listener);
      });
    }),
  };
}

function localStore(view: Window, scope: DeviceScope, root: URL, namespace: string): DeviceServices['store'] {
  let storage: Storage;
  try {
    storage = view.localStorage;
    if (!storage) return;
  } catch {
    return;
  }
  const prefix = 'nelyx:device:' + encodeURIComponent(namespace) + ':' + encodeURIComponent(root.pathname) + ':';
  const keyFor = (key: string) => prefix + deviceKey(key);
  return {
    get: (key) => scope.run(() => {
      const raw = storage.getItem(keyFor(key));
      return raw === null ? undefined : JSON.parse(raw) as DeviceValue;
    }),
    set: (key, value) => scope.run(() => {
      const data = JSON.stringify(value);
      if (data === undefined) throw deviceError('invalid-arguments', 'A JSON storage value is required');
      storage.setItem(keyFor(key), data);
    }),
    remove: (key) => scope.run(() => { storage.removeItem(keyFor(key)); }),
  };
}

function browserCamera(media: MediaDevices, scope: DeviceScope, prepare?: () => Promise<void>): NonNullable<DeviceServices['camera']> {
  return {
    open: (video) => scope.run(async (): Promise<DeviceCamera> => {
      if (prepare) await prepare();
      throwIfCancelled(scope.signal);
      const stream = await media.getUserMedia({ video: video ?? true, audio: false });
      const lifetime = scope.own(() => { for (const track of stream.getTracks()) track.stop(); });
      if (scope.signal.aborted) await lifetime.dispose();
      return { stream, ...lifetime };
    }),
  };
}
