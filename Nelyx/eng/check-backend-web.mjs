// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { execute, startOwnedCommand } from '../sdk/tooling/cli/src/commands.mjs';

const child = process.argv.includes('--child');
const args = process.argv.slice(2).filter((argument) => argument !== '--child');
if (!child) {
  await execute(process.execPath, [import.meta.filename, ...args, '--child'], {
    timeout: 1_200_000,
  });
  process.exit(0);
}
const app = path.resolve(args[0] ?? 'sample/nelyx-demo-app');
const release = JSON.parse(fs.readFileSync(path.join(app, '.nelyx/web/build.json'), 'utf8'));
const wasm = release.files.find(({ path }) => path === 'runtime/backend/backend_bg.wasm');
assert(wasm);

async function preview(base) {
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise((resolve) => reservation.close(resolve));
  let ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const child = startOwnedCommand(
    process.execPath,
    [
      path.join(app, 'node_modules/@nelyx/cli/src/main.mjs'),
      'run',
      '--app',
      app,
      '--target',
      'web',
      '--base',
      base,
      '--port',
      String(port),
    ],
    {
      cwd: app,
      onStderrLine(line) {
        if (line.includes('"event":"nelyx.preview.ready"')) ready(JSON.parse(line).url);
      },
    },
  );
  try {
    const url = await Promise.race([
      started,
      child.completed.then((result) => {
        throw new Error('Web preview failed: ' + JSON.stringify(result));
      }),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Web preview timeout')), 15000).unref(),
      ),
    ]);
    return { url, stop: child.stop };
  } catch (error) {
    await child.stop();
    throw error;
  }
}

async function verifyBrowserDevices(page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    const module = await import(new URL('runtime/backend/backend.js', document.baseURI).href);
    const clipboard = navigator.clipboard;
    const write = clipboard.writeText;
    const saved = await clipboard.readText();
    const button = document.createElement('button');
    button.textContent = 'Check browser devices';
    button.style.cssText = 'position:fixed;z-index:9999;top:0;left:0';
    document.body.append(button);
    window.browserDeviceCheck = new Promise((resolve, reject) => {
      button.addEventListener(
        'click',
        () => {
          void (async () => {
            const devices = module.bind_browser_devices(window);
            const activations = [];
            let text, empty;
            try {
              clipboard.writeText = function (value) {
                activations.push(navigator.userActivation.isActive);
                return write.call(this, value);
              };
              await devices.write_clipboard_text('Nelyx 한글 👋');
              text = await devices.read_clipboard_text();
              await devices.write_clipboard_text('');
              empty = await devices.read_clipboard_text();
            } finally {
              devices.free();
              clipboard.writeText = write;
              await write.call(clipboard, saved);
            }
            const popup = window.open('', '_blank', 'popup,width=320,height=240');
            if (!popup) throw new Error('The device check requires a popup');
            const childDevices = module.bind_browser_devices(popup);
            try {
              const durations = [];
              Object.defineProperty(popup.navigator, 'vibrate', {
                configurable: true,
                value: (duration) => {
                  durations.push(duration);
                  return true;
                },
              });
              const vibrated = module.vibrate_browser(popup, 30);
              delete popup.navigator.vibrate;
              const status = new popup.EventTarget();
              status.state = 'prompt';
              const permissions = popup.navigator.permissions;
              permissions.query = () => Promise.resolve(status);
              const queried = await childDevices.clipboard_permission(true);
              let changes = 0;
              const observer = module.observe_clipboard_permission(queried, () => changes++);
              try {
                status.state = 'granted';
                status.dispatchEvent(new popup.Event('change'));
              } finally {
                observer.free();
              }
              status.state = 'denied';
              status.dispatchEvent(new popup.Event('change'));
              permissions.query = () => {
                throw new TypeError('Unknown permission descriptor');
              };
              return {
                text,
                empty,
                activations,
                vibrated,
                durations,
                changes,
                state: module.clipboard_permission_state(queried),
                unknown: childDevices.clipboard_permission(true) === undefined,
              };
            } finally {
              childDevices.free();
              popup.close();
            }
          })().then(resolve, reject);
        },
        { once: true },
      );
    }).finally(() => button.remove());
  });
  await page.getByRole('button', { name: 'Check browser devices' }).click();
  assert.deepEqual(await page.evaluate(() => window.browserDeviceCheck), {
    text: 'Nelyx 한글 👋',
    empty: '',
    activations: [true, true],
    vibrated: true,
    durations: [30],
    changes: 1,
    state: 'denied',
    unknown: true,
  });
}

async function verifyDeviceWidget(page, context) {
  await context.grantPermissions(['geolocation', 'notifications']);
  await context.setGeolocation({ latitude: 37.5, longitude: 127.1, accuracy: 6 });
  await page.evaluate(() => {
    const geo = navigator.geolocation;
    const original = geo.getCurrentPosition.bind(geo);
    geo.getCurrentPosition = (...args) => {
      window.deviceLocationStack = new Error().stack;
      return original(...args);
    };
  });
  const tap = async (control) => {
    await control.waitFor();
    const box = await control.boundingBox();
    assert(box?.width && box.height);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const press = (name) => tap(page.getByRole('button', { name, exact: true }));
  const result = (text) => page.waitForFunction((value) => {
    const element = document.querySelector('[data-semantics-identifier="device-result"]');
    return (element?.getAttribute('aria-label') ?? element?.textContent ?? '').includes(value);
  }, text);
  const openDevices = async () => {
    await tap(page.locator('[data-semantics-identifier="open-drawer"]'));
    await press('Device services');
  };
  await openDevices();
  await press('Get location');
  await result('"latitude":37.5');
  assert.match(await page.evaluate(() => window.deviceLocationStack), /wasm:\/|wasm-function/);
  await press('Show notification');
  await result('Notification requested');
  assert.equal(await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const notifications = await registration.getNotifications();
    const delivered = notifications.some(({ title }) => title === 'Nelyx Demo');
    notifications.forEach((notification) => notification.close());
    return delivered;
  }), true);
  const picking = page.waitForEvent('filechooser');
  await press('Pick a file');
  await (await picking).setFiles({
    name: 'nelyx-bytes.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 255]),
  });
  await result('nelyx-bytes.bin · 3 bytes');
  await press('Save setting');
  await result('Setting saved');
  await page.reload();
  await openDevices();
  await press('Read setting');
  await result('{"value":"Nelyx"}');
  console.log('Demo widget verified Wasm location, service-worker notification, selected file bytes and stored settings');
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const base of ['/', '/demo/']) {
    const server = await preview(base);
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(server.url);
      const open = async () => {
        await page.waitForFunction(
          () =>
            document.body.dataset.error ||
            (document.documentElement.dataset.nelyxBackendSourceId &&
              document.querySelector('canvas')),
        );
        assert.equal(await page.locator('body').getAttribute('data-error'), null);
      };
      await open();
      const actual = await page.evaluate(async () => {
        const root = document.baseURI;
        const url = (filename) => new URL('runtime/backend/' + filename, root).href;
        const module = await import(url('backend.js'));
        const response = await fetch(url('backend_bg.wasm'));
        const bytes = await response.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const result = JSON.parse(module.invoke('app.example', '10'));
        const policy = (host, readPermission, readApi = true) =>
          JSON.parse(
            module.clipboard_policy(
              JSON.stringify({
                host,
                readApi,
                writeApi: true,
                readPermission,
                writePermission: 'denied',
              }),
            ),
          ).preflight;
        return {
          backend: JSON.parse(module.describe()),
          result,
          bytes: bytes.byteLength,
          mime: response.headers.get('content-type'),
          sha256: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join(''),
          ms: Number(document.documentElement.dataset.nelyxBackendMs),
          policies: [
            policy('browser', 'granted'),
            policy('browser', 'prompt'),
            policy('browser', 'denied'),
            policy('browser', 'unavailable', false),
            policy('native-desktop', 'granted'),
            policy('native-mobile', 'granted'),
          ],
        };
      });
      for (const key of ['kind', 'backendVersion', 'protocolVersion', 'sourceId'])
        assert.equal(actual.backend[key], release.backend[key]);
      assert.equal(actual.backend.haptics, null);
      assert.equal(actual.backend.androidBack, null);
      assert.deepEqual(actual.backend.deviceServices, []);
      if (release.backend.appManifest)
        assert.deepEqual(actual.result, { Ok: Number(args[1] ?? 21) });
      else assert.equal(actual.result.Err.code, 'unknown-command');
      assert.equal(actual.mime, 'application/wasm');
      assert.equal(actual.sha256, wasm.sha256);
      assert.equal(actual.bytes, wasm.bytes);
      assert.deepEqual(actual.policies, [
        'read',
        'permission-required',
        'permission-denied',
        'unsupported',
        'read',
        'permission-required',
      ]);
      if (base === '/') await verifyBrowserDevices(page);
      if (release.format === 'pwa') {
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        if (base === '/' && release.appId === '@nelyx/demo') await verifyDeviceWidget(page, context);
        await context.setOffline(true);
        await page.goto(server.url + 'offline/nested');
        await open();
        assert.equal(
          await page.locator('html').getAttribute('data-nelyx-backend-source-id'),
          release.backend.sourceId,
        );
      } else {
        assert.equal(
          await page.evaluate(
            async () => (await navigator.serviceWorker.getRegistrations()).length,
          ),
          0,
        );
      }
      console.log(
        JSON.stringify({
          app: release.appId,
          base,
          format: release.format,
          wasmBytes: actual.bytes,
          backendStartupMs: actual.ms,
          result: actual.result,
        }),
      );
    } finally {
      await context.close();
      await server.stop();
    }
  }
} finally {
  await browser.close();
}
