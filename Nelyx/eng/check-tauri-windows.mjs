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
const release = JSON.parse(fs.readFileSync(path.join(app, '.nelyx/pwa/build.json'), 'utf8'));
const pkg = path.join(app, '.nelyx/tauri/windows-x64');
const packaged = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
assert.equal(packaged.buildId, release.buildId);
const representative = release.files.find(
  ({ path }) => path.startsWith('assets/') && path.endsWith('.ttf'),
)?.path;
const files = [release.entry, 'runtime/canvaskit.js', 'runtime/canvaskit.wasm'];
if (representative) files.push(representative);
const expected = files.map((file) => release.files.find(({ path }) => path === file)?.sha256);
assert(expected.every(Boolean), 'Missing expected PWA file');

const reservation = net.createServer().listen(0, '127.0.0.1');
await once(reservation, 'listening');
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const endpoint = `http://127.0.0.1:${port}`;
const signal = AbortSignal.timeout(1_200_000);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-tauri-webview-'));
let child, browser;
try {
  const name = 'nelyx-tauri.exe';
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
      document.documentElement.dataset.tauriOs === 'windows' &&
      Boolean(document.querySelector('canvas')?.getContext('webgl2')),
    undefined,
    { timeout: 45_000 },
  );
  const actual = await page.evaluate(async (files) => {
    async function read(file) {
      const response = await fetch(new URL(file, document.baseURI), { cache: 'no-store' });
      if (!response.ok) throw new Error(file + ' HTTP ' + response.status);
      return response;
    }
    const { buildId } = await (await read('build.json')).json();
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
      sha256,
      workers: (await navigator.serviceWorker?.getRegistrations())?.length ?? 0,
    };
  }, files);
  assert.deepEqual(actual, { buildId: release.buildId, sha256: expected, workers: 0 });
  assert.throws(() => publishDirectory(candidate, current), /Close any running copy/);
  assert.equal(fs.statSync(file).size, fs.statSync(path.join(pkg, name)).size);
  assert(
    fs.existsSync(candidate) &&
      !fs.readdirSync(stage).some((name) => name.startsWith('.previous-')),
  );
  console.log(
    'WebView2 ran the embedded PWA with verified JS, Wasm and app assets',
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
