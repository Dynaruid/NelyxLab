// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { checkTestbedPlatformViews } from './fixtures/testbed-platform-views.mjs';

const args = process.argv.slice(2).filter((arg) => arg !== '--child');
if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, ...args, '--child']);
  process.exit(0);
}
const root = path.resolve('sample/nelyx-testbed-app-3/.nelyx/web');
const contentType = new Map([
  ['.html', 'text/html'],
  ['.js', 'application/javascript'],
  ['.css', 'text/css'],
  ['.wasm', 'application/wasm'],
  ['.json', 'application/json'],
  ['.ttf', 'font/ttf'],
  ['.webmanifest', 'application/manifest+json'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);
const servers = [];
async function serve(handler) {
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  servers.push(server);
  await once(server, 'listening');
  return new URL('http://127.0.0.1:' + server.address().port);
}

let browser;
try {
  const foreign = await serve((request, response) => {
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    if (request.url === '/denied')
      response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><meta charset="utf-8">
      <button type="button" onclick="this.textContent='Frame clicks: '+ ++count">Frame clicks: 0</button>
      <p>Drag to select inside this cross-origin document.</p>
      <script>let count = 0; parent.postMessage({kind:'testbed/platform-frame-ready'}, '*');</script>`);
  });
  const app = (isolated) =>
    serve(async (request, response) => {
      if (isolated) {
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }
      const name = new URL(request.url, 'http://localhost').pathname;
      const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!file.startsWith(root + path.sep)) {
        response.writeHead(400).end();
        return;
      }
      try {
        const data = await fs.readFile(file);
        response.setHeader(
          'Content-Type',
          contentType.get(path.extname(file)) ?? 'application/octet-stream',
        );
        response.end(data);
      } catch {
        response.writeHead(404).end();
      }
    });
  const plain = await app(false);
  const isolated = await app(true);
  browser = await chromium.launch({ channel: 'chrome' });
  const matrix = [
    {
      mode: 'direct',
      origin: plain,
      remote: '/allowed',
      extended: true,
      contextRecovery: true,
      legacyViews: true,
    },
    { mode: 'worker-transfer', origin: plain, remote: '/allowed', extended: true },
    { mode: 'worker-shared', origin: isolated, remote: '/allowed', extended: true },
    { mode: 'direct', origin: isolated, remote: '/denied', denied: true },
    { mode: 'direct', origin: isolated, extended: false },
  ];
  for (const test of matrix) {
    if (args.length && !args.includes(test.mode)) continue;
    const context = await browser.newContext({
      viewport: { width: 980, height: 880 },
      deviceScaleFactor: 1.25,
      serviceWorkers: 'block',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.setDefaultTimeout(12_000);
      const url = new URL(test.origin);
      url.searchParams.set('renderMode', test.mode);
      if (test.remote) url.searchParams.set('platformFrame', new URL(test.remote, foreign).href);
      await page.goto(url.href);
      assert.equal(await page.evaluate(() => crossOriginIsolated), test.origin === isolated);
      try {
        await checkTestbedPlatformViews(page, test);
      } catch (error) {
        const details = await page.locator('body').ariaSnapshot();
        console.error(
          details
            .split('\n')
            .filter((line) => /tab |composited|overlay|alert|editor|iframe|modal/i.test(line))
            .slice(0, 36)
            .join('\n'),
        );
        throw error;
      }
      assert.equal(
        await page
          .locator('canvas[data-nelyx-render-path]')
          .first()
          .getAttribute('data-nelyx-render-path'),
        test.mode,
      );
      assert.deepEqual(errors, []);
      console.log(
        test.mode,
        test.remote ?? 'local',
        test.origin === isolated ? 'isolated' : 'plain',
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
}
