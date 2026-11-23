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
      if (release.format === 'pwa') {
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
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
