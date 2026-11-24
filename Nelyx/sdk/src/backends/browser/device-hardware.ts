// SPDX-License-Identifier: BSD-3-Clause
import { deviceBarcodeFormats } from '../../devices.ts';
import type {
  DeviceBarcodeFormat, DeviceFeature, DeviceServices, DeviceSensor,
} from '../../devices.ts';
import { abortable, deviceError, throwIfCancelled } from '../../runtime/device-scope.ts';
import type { DeviceScope } from '../../runtime/device-scope.ts';
import { externalUrl, nfcText } from '../../runtime/device-values.ts';

interface BarcodeDetector {
  detect(video: HTMLVideoElement): Promise<readonly { rawValue: string; format: string }[]>;
}
interface BarcodeConstructor {
  new (options?: { formats: readonly DeviceBarcodeFormat[] }): BarcodeDetector;
  getSupportedFormats?(): Promise<readonly string[]>;
}
interface NdefTextRecord {
  readonly recordType: string;
  readonly encoding?: string;
  readonly lang?: string;
  readonly data?: DataView | null;
}
interface NdefReader extends EventTarget {
  scan(options: { signal: AbortSignal }): Promise<void>;
  write(message: { records: [{ recordType: 'text'; data: string; lang: string }] }, options: { signal: AbortSignal }): Promise<void>;
}
interface BatteryStatus extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
}
interface SensorClass {
  requestPermission?(): Promise<string>;
}
interface GattCharacteristic {
  readValue(): Promise<DataView>;
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
}
interface GattService {
  getCharacteristic(uuid: string): Promise<GattCharacteristic>;
}
interface Gatt {
  readonly connected: boolean;
  connect(): Promise<Gatt>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<GattService>;
}
interface BluetoothSource {
  requestDevice(options: { filters: [{ services: [string]; namePrefix?: string }] }): Promise<{
    name?: string;
    gatt?: Gatt;
  }>;
}
type HardwareWindow = Window & {
  readonly BarcodeDetector?: BarcodeConstructor;
  readonly NDEFReader?: new () => NdefReader;
  readonly DeviceOrientationEvent?: SensorClass;
  readonly DeviceMotionEvent?: SensorClass;
  readonly PublicKeyCredential?: typeof PublicKeyCredential;
};
type HardwareNavigator = Navigator & {
  readonly bluetooth?: BluetoothSource;
  getBattery?(): Promise<BatteryStatus>;
};

export function browserHardware(
  view: Window,
  scope: DeviceScope,
  has: (feature: DeviceFeature) => boolean,
  camera: DeviceServices['camera'],
): DeviceServices {
  if (!view.isSecureContext) return {};
  const host = view as HardwareWindow;
  const nav = view.navigator as HardwareNavigator;
  const Detector = host.BarcodeDetector;
  const Reader = host.NDEFReader;
  const bluetooth = nav.bluetooth;
  return {
    ...(has('barcode') && Detector && camera ? { barcode: barcode(view, Detector, camera, scope) } : {}),
    ...(has('nfc') && Reader ? { nfc: nfc(Reader, scope) } : {}),
    ...(has('credentials') && host.PublicKeyCredential && nav.credentials ? { credentials: {
      get: (options: PublicKeyCredentialRequestOptions, user?: AbortSignal) => scope.cancelWith(user, async (signal) => {
        const result = await nav.credentials.get({ publicKey: { ...options, userVerification: 'required' }, signal });
        if (!result) throw deviceError('cancelled', 'No credential was selected');
        if (!(result instanceof host.PublicKeyCredential!))
          throw deviceError('unavailable', 'No public key credential was returned');
        return result;
      }),
    } } : {}),
    ...(has('battery') && typeof nav.getBattery === 'function' ? { battery: battery(nav.getBattery.bind(nav), scope) } : {}),
    ...(has('sensors') && (host.DeviceOrientationEvent || host.DeviceMotionEvent) ? { sensors: sensors(host, scope) } : {}),
    ...(has('bluetooth') && bluetooth ? { bluetooth: gattServices(bluetooth, scope) } : {}),
    ...(has('share') && typeof nav.share === 'function' ? { share: (content: ShareData) => scope.run(() => {
      const data = { ...content, ...(content.url !== undefined ? { url: externalUrl(content.url) } : {}) };
      if (!data.text && !data.title && !data.url)
        throw deviceError('invalid-arguments', 'Sharing requires a title, text or URL');
      if (nav.canShare && !nav.canShare(data)) throw deviceError('unsupported', 'The browser cannot share this content');
      return nav.share(data);
    }) } : {}),
  };
}

function barcode(view: Window, Detector: BarcodeConstructor, camera: NonNullable<DeviceServices['camera']>, scope: DeviceScope): NonNullable<DeviceServices['barcode']> {
  let scanning = false;
  return {
    scan: (formats, user) => scope.cancelWith(user, async (signal) => {
      if (scanning) throw deviceError('busy', 'A barcode scan is already active in this view');
      scanning = true;
      const video = view.document.createElement('video');
      let stream: Awaited<ReturnType<typeof camera.open>> | undefined;
      try {
        if (formats?.length && Detector.getSupportedFormats) {
          const supported = await Detector.getSupportedFormats();
          if (formats.some((format) => !supported.includes(format)))
            throw deviceError('unsupported', 'A requested barcode format is unavailable');
        }
        throwIfCancelled(signal);
        const detector = new Detector(formats?.length ? { formats } : undefined);
        const opening = camera.open({ facingMode: { ideal: 'environment' } });
        void opening.then((session) => {
          if (signal.aborted) return session.dispose();
        }).catch(() => {});
        stream = await abortable(opening, signal);
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream.stream;
        await abortable(video.play(), signal);
        while (!signal.aborted) {
          const [found] = await abortable(detector.detect(video), signal);
          if (found) {
            const format = deviceBarcodeFormats.find((value) => value === found.format) ?? 'unknown';
            return { text: found.rawValue, format };
          }
          await abortable(new Promise<void>((resolve) => view.setTimeout(resolve, 120)), signal);
        }
        throwIfCancelled(signal);
        throw deviceError('cancelled', 'Barcode scan ended');
      } finally {
        video.pause();
        video.srcObject = null;
        try { await stream?.dispose(); }
        finally { scanning = false; }
      }
    }),
  };
}

function nfc(Reader: new () => NdefReader, scope: DeviceScope): NonNullable<DeviceServices['nfc']> {
  let active = false;
  function run<T>(user: AbortSignal | undefined, perform: (reader: NdefReader, signal: AbortSignal) => Promise<T>) {
    return scope.cancelWith(user, async (signal) => {
      if (active) throw deviceError('busy', 'An NFC operation is already active in this view');
      const reader = new Reader();
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, { once: true });
      active = true;
      try {
        return await perform(reader, controller.signal);
      } finally {
        controller.abort();
        signal.removeEventListener('abort', cancel);
        active = false;
      }
    });
  }
  return {
    available: () => scope.run(() => true),
    read: (user) => run(user, async (reader, signal) => {
      const received = new Promise<readonly NdefTextRecord[]>((resolve, reject) => {
        reader.addEventListener('reading', (event) => {
          resolve((event as Event & { message: { records: readonly NdefTextRecord[] } }).message.records);
        }, { once: true, signal });
        reader.addEventListener('readingerror', () => reject(deviceError('unavailable', 'Unable to read the NFC tag')),
          { once: true, signal });
      });
      const [, records] = await abortable(Promise.all([reader.scan({ signal }), received]), signal);
      const record = records.find((record) => record.recordType === 'text' && record.data);
      if (!record?.data) return null;
      return {
        text: new TextDecoder(record.encoding ?? 'utf-8').decode(record.data),
        ...(record.lang ? { language: record.lang } : {}),
      };
    }),
    write: (record) => run(undefined, (reader, signal) => {
      const { text, language } = nfcText(record);
      return abortable(reader.write({ records: [{ recordType: 'text', data: text, lang: language }] }, { signal }), signal);
    }),
  };
}

function battery(getBattery: () => Promise<BatteryStatus>, scope: DeviceScope): NonNullable<DeviceServices['battery']> {
  const snapshot = (status: BatteryStatus) => ({ level: status.level, charging: status.charging });
  return {
    current: () => scope.run(async () => snapshot(await getBattery())),
    watch: (change) => scope.run(async () => {
      const status = await getBattery();
      throwIfCancelled(scope.signal);
      const update = () => { if (!scope.signal.aborted) change(snapshot(status)); };
      status.addEventListener('levelchange', update);
      status.addEventListener('chargingchange', update);
      return scope.own(() => {
        status.removeEventListener('levelchange', update);
        status.removeEventListener('chargingchange', update);
      });
    }),
  };
}

function sensors(view: HardwareWindow, scope: DeviceScope): NonNullable<DeviceServices['sensors']> {
  return {
    watch: (kind, change) => scope.run(async () => {
      const orientation = kind === 'orientation';
      const Constructor = orientation ? view.DeviceOrientationEvent : view.DeviceMotionEvent;
      if (!Constructor) throw deviceError('unsupported', 'This sensor is not exposed by the browser');
      if (Constructor.requestPermission && await Constructor.requestPermission() !== 'granted')
        throw deviceError('permission-denied', 'Sensor permission was denied');
      throwIfCancelled(scope.signal);
      const name = orientation ? 'deviceorientation' : 'devicemotion';
      const listener = (event: Event) => {
        if (scope.signal.aborted) return;
        let sample: DeviceSensor;
        if (orientation) {
          const { alpha, beta, gamma, absolute } = event as DeviceOrientationEvent;
          if (alpha === null && beta === null && gamma === null) return;
          sample = { kind, alpha, beta, gamma, absolute };
        } else {
          const { acceleration } = event as DeviceMotionEvent;
          if (!acceleration) return;
          const { x, y, z } = acceleration;
          if (x === null && y === null && z === null) return;
          sample = { kind, x, y, z };
        }
        change(sample);
      };
      view.addEventListener(name, listener);
      return scope.own(() => { view.removeEventListener(name, listener); });
    }),
  };
}

function gattServices(source: BluetoothSource, scope: DeviceScope): NonNullable<DeviceServices['bluetooth']> {
  return {
    connect: (uuid, namePrefix) => scope.run(async () => {
      if (!uuid.trim()) throw deviceError('invalid-arguments', 'A GATT service UUID is required');
      const device = await source.requestDevice({ filters: [{ services: [uuid], ...(namePrefix ? { namePrefix } : {}) }] });
      throwIfCancelled(scope.signal);
      if (!device.gatt) throw deviceError('unavailable', 'The selected device has no GATT server');
      const gatt = await device.gatt.connect();
      let closed = false;
      const owner = scope.own(() => {
        closed = true;
        if (gatt.connected) gatt.disconnect();
      });
      const connected = () => {
        throwIfCancelled(scope.signal);
        if (closed || !gatt.connected) throw deviceError('unavailable', 'The Bluetooth device is disconnected');
      };
      try {
        connected();
        const service = await gatt.getPrimaryService(uuid);
        connected();
        return {
          name: device.name ?? null,
          dispose: owner.dispose,
          read: (characteristic) => scope.run(async () => {
            connected();
            const target = await service.getCharacteristic(characteristic);
            connected();
            const value = await target.readValue();
            connected();
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
          }),
          write: (characteristic, bytes) => scope.run(async () => {
            connected();
            const target = await service.getCharacteristic(characteristic);
            connected();
            const write = target.writeValueWithResponse ?? target.writeValue;
            if (!write) throw deviceError('unsupported', 'The GATT characteristic does not support writing');
            await write.call(target, new Uint8Array(bytes));
            connected();
          }),
        };
      } catch (error) {
        await owner.dispose();
        throw error;
      }
    }),
  };
}
