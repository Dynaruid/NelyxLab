// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { capture, startOwnedCommand } from '../sdk/tooling/cli/src/commands.mjs';
import { publishDirectory, removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';

async function removeProfile(directory) {
  for (let attempt = 0; ; attempt++) {
    try {
      removeDirectory(directory, path.dirname(directory));
      return;
    } catch (error) {
      if (attempt >= 10 || !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error.code)) throw error;
      await delay(500);
    }
  }
}

assert.equal(process.platform, 'win32');
assert(process.argv[2], 'Pass the app directory');
const app = path.resolve(process.argv[2]);
const release = JSON.parse(
  fs.readFileSync(path.join(app, '.nelyx/tauri/frontend/build.json'), 'utf8'),
);
const config = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const pkg = path.join(app, '.nelyx/tauri/windows-x64');
const packaged = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
assert.equal(packaged.frontendBuildId, release.buildId);
assert.equal(release.target, 'tauri');
assert.deepEqual(packaged.backend, release.backend);
const representative = release.files.find(
  ({ path }) => path.startsWith('assets/') && path.endsWith('.ttf'),
)?.path;
const files = [release.entry, 'runtime/canvaskit.js', 'runtime/canvaskit.wasm'];
if (representative) files.push(representative);
const expected = files.map((file) => release.files.find(({ path }) => path === file)?.sha256);
assert(expected.every(Boolean), 'Missing expected Tauri frontend file');

const reservation = net.createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const endpoint = `http://127.0.0.1:${port}`;
const signal = AbortSignal.timeout(1_200_000);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-tauri-webview-'));
let child, browser;
try {
  const name = packaged.artifacts.find(({ format }) => format === 'exe')?.file;
  assert(name, 'Windows EXE is missing');
  const current = path.join(stage, 'current');
  const candidate = path.join(stage, 'candidate');
  fs.mkdirSync(current);
  fs.mkdirSync(candidate);
  const file = path.join(current, name);
  fs.copyFileSync(path.join(pkg, name), file);
  child = startOwnedCommand(file, [], {
    cwd: stage,
    signal,
    isolateWindows: true,
    windowsHide: false,
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: path.join(stage, 'profile'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --proxy-server=http://127.0.0.1:9 --proxy-bypass-list=<-loopback>`,
    },
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(endpoint + '/json/list', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
    }).catch(() => null);
    if (
      list?.ok &&
      (await list.json()).some(({ url }) => url.startsWith('https://tauri.localhost/'))
    ) {
      browser = await chromium.connectOverCDP(endpoint, { timeout: 25_000 });
      break;
    }
    await delay(600, undefined, { signal });
  }
  assert(browser, 'The isolated WebView2 page did not open');
  const page = browser
    .contexts()[0]
    .pages()
    .find((page) => page.url().startsWith('https://tauri.localhost/'));
  assert(page, 'The built-in protocol page is missing');
  await page.waitForFunction(
    () =>
      document.body.dataset.error ||
      (document.documentElement.dataset.tauriOs === 'windows' &&
        Boolean(document.querySelector('canvas')?.getContext('webgl2'))),
    undefined,
    { timeout: 45_000 },
  );
  assert.equal(await page.locator('body').getAttribute('data-error'), null);
  const actual = await page.evaluate(
    async ({ files, clipEnabled }) => {
      async function read(file) {
        const response = await fetch(new URL(file, document.baseURI), { cache: 'no-store' });
        if (!response.ok) throw new Error(file + ' HTTP ' + response.status);
        return response;
      }
      const { buildId } = await (await read('build.json')).json();
      const core = window.__TAURI__.core;
      const backend = await core.invoke('plugin:nelyx-backend|describe');
      const example = await core.invoke('plugin:nelyx-backend|invoke', {
        command: 'app.example',
        input: 10,
      });
      const policy = await core.invoke('plugin:nelyx-backend|clipboard_policy', {
        input: {
          host: 'native-mobile',
          readApi: true,
          writeApi: true,
          readPermission: 'granted',
          writePermission: 'granted',
        },
      });
      const clipboard = async () => {
        try {
          return await core.invoke('plugin:clipboard-manager|read_text');
        } catch (error) {
          if (/clipboard is empty|clipboard contents were not available/i.test(String(error)))
            return '';
          throw error;
        }
      };
      let clipboardCheck;
      if (clipEnabled) {
        const saved = await clipboard();
        const text = 'Nelyx 클립보드 확인';
        try {
          await core.invoke('plugin:clipboard-manager|write_text', { text });
          clipboardCheck = (await clipboard()) === text;
        } finally {
          await core.invoke('plugin:clipboard-manager|write_text', { text: saved });
        }
      } else {
        clipboardCheck = await clipboard().then(
          () => false,
          (error) => /permission|not allowed|not found|forbidden/i.test(String(error)),
        );
      }
      const sha256 = await Promise.all(
        files.map(async (file) => {
          const data = await (await read(file)).arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
        }),
      );
      return {
        buildId,
        backend,
        example,
        preflight: policy.preflight,
        clipboardCheck,
        sha256,
        workers: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
        wasmRequests: performance
          .getEntriesByType('resource')
          .filter(({ name }) => name.includes('/runtime/backend/')).length,
      };
    },
    { files, clipEnabled: !!config.nelyx.targets.tauri.windows?.[0]?.clipboard?.write },
  );
  assert.equal(actual.buildId, release.buildId);
  assert.deepEqual(actual.sha256, expected);
  assert.equal(actual.workers, 0);
  assert.equal(actual.wasmRequests, 0);
  for (const key of ['kind', 'backendVersion', 'protocolVersion', 'sourceId'])
    assert.equal(actual.backend[key], release.backend[key]);
  assert.equal(actual.backend.frontendBuildId, release.buildId);
  assert.equal(actual.example, Number(process.argv[3] ?? 21));
  assert.equal(actual.preflight, 'permission-required');
  assert.equal(actual.clipboardCheck, true);
  if (actual.backend.windowTitle) {
    const title = capture('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-Process -Id ' + child.pid + ').MainWindowTitle',
    ]);
    assert.equal(title.trim(), actual.backend.title + ' ' + config.version + ' (windows)');
  }
  if (config.name === '@nelyx/testbed-2') {
    const button = (name) => page.getByRole('button', { name, exact: true });
    const activate = async (name) => {
      const control = button(name);
      await control.waitFor();
      await control.evaluate((element) => element.click());
    };
    const selected = (group, name) =>
      group
        .getByRole('button', { name, exact: true })
        .and(page.locator('[aria-selected=true]'))
        .waitFor();
    const material = page.getByRole('group', { name: 'Segmented buttons 기본 API' });
    await selected(material, 'List');
    await activate('Grid');
    await selected(material, 'Grid');
    await activate('Cupertino');
    const cupertino = page.getByRole('list', { name: /Sliding segmented control/ });
    await selected(cupertino, 'Daily');
    await activate('Weekly');
    await selected(cupertino, 'Weekly');
    console.log('Windows Testbed verified Material and Cupertino segmented controls');
  }
  assert.throws(() => publishDirectory(candidate, current), /Close any running copy/);
  assert.equal(fs.statSync(file).size, fs.statSync(path.join(pkg, name)).size);
  assert(
    fs.existsSync(candidate) &&
      !fs.readdirSync(stage).some((name) => name.startsWith('.previous-')),
  );
  console.log(
    'Offline WebView2 verified Rust IPC, clipboard permissions, title and embedded assets',
    actual.buildId,
  );
} finally {
  try {
    if (child?.pid) {
      capture(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$app = Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if ($app.Path -eq $env:NELYX_TEST_EXECUTABLE) { [void]$app.CloseMainWindow() }`,
        ],
        {
          timeout: 5000,
          env: {
            ...process.env,
            NELYX_TEST_EXECUTABLE: path.join(stage, 'current', 'nelyx-tauri.exe'),
          },
        },
      );
      await Promise.race([child.completed, delay(5000, undefined, { ref: false })]);
    }
  } finally {
    await child?.stop();
    await browser?.close().catch(() => {});
    await removeProfile(stage);
  }
}
