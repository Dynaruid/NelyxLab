// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';
import { deviceFeatures, deviceServicesFor, bindDeviceServices } from '@nelyx/sdk/devices';
import { browserDeviceServices } from '../sdk/dist/backends/browser/devices.js';
import { tauriDeviceServices } from '../sdk/dist/backends/tauri-devices.js';
import { DeviceScope } from '../sdk/dist/runtime/device-scope.js';
import {
  androidManifest, configuredDevicePlugins, deepLinkPluginConfig, deviceCapabilities, writeDeviceAndroidLinks,
} from '../sdk/tooling/cli/src/tauri-device-host.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const root = new URL('https://example.test/demo/');
const scope = new DeviceScope();
const options = { scope, root, namespace: 'Demo' };
const matchesCode = (code) => (error) => error.code === code;
const position = { timestamp: 123456, coords: { latitude: 37, longitude: 127, accuracy: 8 } };
let watchPosition;
let cleared = 0;
let closedVideo = 0;
let shown;
let selected = true;
let link;
let shared;
let sensorPermission = 0;
let gattClosed = 0;
let bluetoothCancelled = false;
let nfcWritten;
let inputCount = 0;
const stored = new Map();
const battery = Object.assign(new EventTarget(), { level: 0.74, charging: false });
const stream = { getTracks: () => [{ stop: () => { closedVideo++; } }] };
const raw = new Uint8Array([0, 1, 255]);
class NDEFReader extends EventTarget {
  async scan({ signal }) {
    assert.ok(!signal.aborted);
    const bytes = new TextEncoder().encode('안녕');
    const reading = Object.assign(new Event('reading'), { message: { records: [
      { recordType: 'text', lang: 'ko', encoding: 'utf-8', data: new DataView(bytes.buffer) },
    ] } });
    queueMicrotask(() => this.dispatchEvent(reading));
  }
  async write(data) { nfcWritten = data; }
}
class PublicKeyCredential {}
const view = Object.assign(new EventTarget(), {
  isSecureContext: true,
  location: new URL(root),
  localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  },
  navigator: {
    geolocation: {
      getCurrentPosition: (yes) => yes(position),
      watchPosition: (yes) => { watchPosition = yes; return 5; },
      clearWatch: (id) => { assert.equal(id, 5); cleared++; },
    },
    serviceWorker: { getRegistration: async () => ({ active: true, showNotification: async (...args) => { shown = args; } }) },
    mediaDevices: { getUserMedia: async (options) => { assert.equal(options.audio, false); return stream; } },
    credentials: { get: async ({ publicKey }) => { assert.equal(publicKey.userVerification, 'required'); return new PublicKeyCredential(); } },
    getBattery: async () => battery,
    canShare: () => true,
    share: async (data) => { shared = data; },
    bluetooth: {
      async requestDevice({ filters }) {
        assert.deepEqual(filters, [{ services: ['battery_service'] }]);
        if (bluetoothCancelled) throw new DOMException('User cancelled the chooser', 'NotFoundError');
        const gatt = {
          connected: false,
          async connect() { this.connected = true; return this; },
          disconnect() { this.connected = false; gattClosed++; },
          async getPrimaryService(uuid) {
            assert.equal(uuid, 'battery_service');
            return { getCharacteristic: async () => ({
              readValue: async () => new DataView(raw.buffer, 1, 2),
              writeValueWithResponse: async (value) => assert.deepEqual(value, raw),
            }) };
          },
        };
        return { gatt, name: 'Device' };
      },
    },
  },
  Notification: class {
    static permission = 'denied';
    static async requestPermission() { this.permission = 'granted'; return 'granted'; }
  },
  BarcodeDetector: class {
    static async getSupportedFormats() { return ['qr_code']; }
    async detect() { return [{ rawValue: 'nelyx://demo', format: 'qr_code' }]; }
  },
  NDEFReader,
  PublicKeyCredential,
  DeviceOrientationEvent: { requestPermission: async () => { sensorPermission++; return 'granted'; } },
  setTimeout,
  document: {
    body: { append() { inputCount++; } },
    createElement(tag) {
      if (tag === 'a') return { click() { link = { url: this.href, rel: this.rel }; } };
      if (tag === 'video') return { async play() {}, pause() {} };
      return Object.assign(new EventTarget(), {
        files: [new File([raw], 'number.bin')],
        click() { this.dispatchEvent(new Event(selected ? 'change' : 'cancel')); },
        remove() { inputCount--; },
      });
    },
  },
});

const web = browserDeviceServices(view, options);
const messenger = {};
scope.own(bindDeviceServices(messenger, web));
assert.equal(deviceServicesFor({ binaryMessenger: messenger }), web);
assert.deepEqual(await web.location.current(), {
  latitude: 37, longitude: 127, accuracy: 8, timestamp: 123456,
  altitude: null, altitudeAccuracy: null, heading: null, speed: null,
});
const locations = [];
await web.location.watch((sample) => locations.push(sample.latitude));
watchPosition(position);
assert.deepEqual(locations, [37]);

await assert.rejects(web.notifications.show({ title: 'Demo' }), matchesCode('permission-denied'));
assert.equal(await web.notifications.requestPermission(), 'granted');
await web.notifications.show({ title: 'Demo', body: 'A local message' });
assert.deepEqual(shown, ['Demo', { body: 'A local message' }]);

const [file] = await web.files.pick({ filters: [{ name: 'Binary', extensions: ['bin'] }] });
assert.equal(file.name, 'number.bin');
assert.deepEqual(await file.read(), raw);
selected = false;
assert.deepEqual(await web.files.pick(), []);
assert.equal(inputCount, 0);
await assert.rejects(web.openUrl('javascript:alert(1)'), matchesCode('invalid-arguments'));
await web.openUrl('https://example.test/');
assert.deepEqual(link, { url: 'https://example.test/', rel: 'noopener noreferrer' });
const links = [];
await web.deepLinks.watch((value) => links.push(value));
view.location.hash = '#result';
view.dispatchEvent(new Event('popstate'));
view.dispatchEvent(new Event('hashchange'));
assert.deepEqual(links, [['https://example.test/demo/#result']]);
assert.deepEqual(await web.deepLinks.current(), ['https://example.test/demo/']);

await web.store.set('setting', null);
assert.equal(await web.store.get('setting'), null);
const otherApp = browserDeviceServices(view, { ...options, namespace: 'Other' });
assert.equal(await otherApp.store.get('setting'), undefined);
assert.deepEqual(await web.barcode.scan(['qr_code']), { text: 'nelyx://demo', format: 'qr_code' });
assert.equal(closedVideo, 1);
await web.camera.open();
assert.deepEqual(await web.nfc.read(), { text: '안녕', language: 'ko' });
await web.nfc.write({ text: 'Nelyx' });
assert.equal(nfcWritten.records[0].data, 'Nelyx');
assert.ok(await web.credentials.get({ challenge: new Uint8Array([1]) }) instanceof PublicKeyCredential);
assert.deepEqual(await web.battery.current(), { level: 0.74, charging: false });
let changes = 0;
await web.battery.watch(() => { changes++; });
battery.dispatchEvent(new Event('levelchange'));
assert.equal(changes, 1);
let reading;
await web.sensors.watch('orientation', (value) => { reading = value; });
view.dispatchEvent(Object.assign(new Event('deviceorientation'), { alpha: 42, beta: null, gamma: null, absolute: false }));
assert.equal(sensorPermission, 1);
assert.equal(reading.alpha, 42);
const connected = await web.bluetooth.connect('battery_service');
assert.deepEqual(await connected.read('battery_level'), Uint8Array.from([1, 255]));
await connected.write('battery_level', raw);
bluetoothCancelled = true;
await assert.rejects(web.bluetooth.connect('battery_service'), matchesCode('cancelled'));
await web.share({ url: 'https://example.test/' });
assert.equal(shared.url, 'https://example.test/');
await scope.dispose();
assert.equal(deviceServicesFor({ binaryMessenger: messenger }), undefined);
assert.equal(cleared, 1);
assert.equal(closedVideo, 2);
assert.equal(gattClosed, 1);
battery.dispatchEvent(new Event('levelchange'));
watchPosition(position);
assert.equal(changes, 1);
assert.deepEqual(locations, [37]);
await assert.rejects(file.read(), matchesCode('cancelled'));
assert.deepEqual(browserDeviceServices(view, { ...options, enabled: new Set() }), {});

const nativeScope = new DeviceScope();
const calls = [];
const callbackIds = new Set();
let watchId = 0;
let notified = false;
let locationEnabled = true;
let pickedPath = 'content://files/document/7';
const kv = new Map();
globalThis.window = Object.assign(view, {
  __TAURI_INTERNALS__: {
    transformCallback() { callbackIds.add(++watchId); return watchId; },
    unregisterCallback(id) { callbackIds.delete(id); },
    async invoke(command, args) {
      calls.push(command);
      switch (command) {
        case 'plugin:geolocation|check_permissions':
          if (!locationEnabled) throw 'Location services are disabled.';
          return { location: 'prompt', coarseLocation: 'prompt' };
        case 'plugin:geolocation|request_permissions': return { location: 'denied', coarseLocation: 'granted' };
        case 'plugin:geolocation|get_current_position': return position;
        case 'plugin:geolocation|watch_position': return;
        case 'plugin:geolocation|clear_watch': assert.equal(args.channelId, watchId); return;
        case 'plugin:notification|is_permission_granted': return true;
        case 'plugin:notification|notify': notified = true; return;
        case 'plugin:dialog|open': return pickedPath;
        case 'plugin:nelyx-backend|device_file_name': return 'payload.bin';
        case 'plugin:fs|read_file': return raw.buffer;
        case 'plugin:deep-link|get_current': return ['nelyx-demo://home', 'invalid'];
        case 'plugin:barcode-scanner|check_permissions': return { camera: 'granted' };
        case 'plugin:barcode-scanner|scan': return { content: 'demo', format: 'QR_CODE' };
        case 'plugin:nfc|is_available': return { available: true };
        case 'plugin:nfc|scan': return { records: [{ tnf: 1, kind: [0x54], payload: [2, 101, 110, 65] }] };
        case 'plugin:nfc|write': assert.deepEqual(args.records[0].payload, [2, 101, 110, 65]); return;
        case 'plugin:biometric|status': return { isAvailable: true };
        case 'plugin:biometric|authenticate': assert.equal(args.allowDeviceCredential, false); return;
        case 'plugin:nelyx-backend|device_store': {
          const { operation, key, value } = args.input;
          if (operation === 'get') return { found: kv.has(key), value: kv.get(key) };
          if (operation === 'set') kv.set(key, value);
          else kv.delete(key);
          return;
        }
        default: throw new Error(command);
      }
    },
  },
});
const native = tauriDeviceServices(view, { ...options, scope: nativeScope }, 'android', deviceFeatures, (id) => callbackIds.delete(id));
assert.deepEqual(await tauriDeviceServices(view, options, 'android', [], () => {}), {});
assert.equal((await native.location.current()).latitude, 37);
locationEnabled = false;
await assert.rejects(native.location.current(), matchesCode('unavailable'));
locationEnabled = true;
await native.location.watch(() => {});
const [nativeFile] = await native.files.pick();
assert.equal(nativeFile.name, 'payload.bin');
assert.deepEqual(await nativeFile.read(), raw);
pickedPath = 'C:\\Fixture\\name%20.bin';
const desktop = tauriDeviceServices(view, { ...options, scope: nativeScope }, 'windows', ['files'], () => {});
assert.equal((await desktop.files.pick())[0].name, 'name%20.bin');
await native.notifications.show({ title: 'Local' });
assert.ok(notified);
assert.deepEqual(await native.deepLinks.current(), ['nelyx-demo://home']);
assert.deepEqual(await native.barcode.scan(['qr_code']), { text: 'demo', format: 'qr_code' });
assert.deepEqual(await native.nfc.read(), { text: 'A', language: 'en' });
await native.nfc.write({ text: 'A' });
assert.equal(await native.biometrics.available(), true);
await native.biometrics.authenticate('Verify');
await native.store.set('demo', false);
assert.equal(await native.store.get('demo'), false);
await native.store.remove('demo');
assert.equal(await native.store.get('demo'), undefined);
await nativeScope.dispose();
assert.equal(callbackIds.size, 0);
assert.ok(calls.includes('plugin:geolocation|clear_watch'));
assert.ok(!calls.includes('plugin:store|load'));
assert.equal(configuredDevicePlugins([{ deviceServices: [] }], '2.4.2').length, 0);
assert.equal(configuredDevicePlugins([{ deviceServices: deviceFeatures }], '2.4.2').length, 11);
assert.equal(deviceCapabilities.files[0].permissions.length, 2);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-device-manifest-'));
try {
  const overlay = [
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android">',
    '  <application>',
    '    <activity android:name=".MainActivity">',
    '      <intent-filter><action android:name="android.intent.action.MAIN" /></intent-filter>',
    '    </activity>',
    '  </application>',
    '</manifest>',
    '',
  ].join('\n');
  const { mobile } = deepLinkPluginConfig({
    schemes: ['nelyx-demo'], domains: [{ host: 'example.test', pathPrefix: '/demo' }],
  });
  const read = () => fs.readFileSync(path.join(temp, androidManifest), 'utf8');
  writeDeviceAndroidLinks(temp, mobile, overlay);
  const generated = read();
  assert.match(generated, /android:scheme="nelyx-demo"/);
  assert.match(generated, /android:autoVerify="true"/);
  assert.match(generated, /android:host="example.test"/);
  assert.match(generated, /android:pathPrefix="\/demo"/);
  writeDeviceAndroidLinks(temp, mobile, overlay);
  assert.equal(read(), generated);
  writeDeviceAndroidLinks(temp, mobile);
  assert.equal(read(), generated);
  writeDeviceAndroidLinks(temp, []);
  assert.equal(read(), overlay);
} finally {
  removeDirectory(temp, path.dirname(temp));
}
console.log('Expanded browser and Tauri devices, scoped storage, selected bytes and resource retirement verified');
