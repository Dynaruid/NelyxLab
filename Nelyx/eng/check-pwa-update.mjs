// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { mediaType } from '../sdk/tooling/vite/src/content.mjs';
import { serviceWorker } from '../sdk/tooling/vite/src/service-worker.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

function fixture(id, revision) {
  const shell = `<!doctype html><html><head><!--nelyx-base--><title>${revision}</title></head>
    <body><script>navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'});</script></body></html>`;
  const files = new Map([
    ['index.html', Buffer.from(shell)],
    ['chunks/lazy.js', Buffer.from('export default ' + JSON.stringify(revision))],
    ['runtime/canvaskit.wasm', Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])],
    ['runtime/backend/backend_bg.wasm', Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])],
  ]);
  const inventory = [...files].map(([path, bytes]) => ({
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }));
  files.set('sw.js', Buffer.from(serviceWorker(id, inventory)));
  return files;
}

const a = fixture('/apps/update', 'A');
const b = fixture('/apps/update', 'B');
const other = fixture('/apps/other', 'other');
let phase = 'A';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const [scope, ...parts] = url.pathname.slice(1).split('/');
  const file = parts.join('/') || 'index.html';
  const files = scope === 'demo' ? (phase === 'A' ? a : b) : scope === 'other' ? other : new Map();
  const bytes =
    scope === 'demo' && phase === 'damaged' && file === 'runtime/backend/backend_bg.wasm'
      ? Buffer.from('damaged')
      : files.get(file);
  res.writeHead(bytes ? 200 : 404, {
    'Cache-Control': 'no-cache',
    'Content-Type': mediaType(file),
  });
  res.end(bytes);
});

let browser;
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const otherPage = await context.newPage();
  const controlled = (tab) =>
    tab.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.goto(origin + '/demo/');
  await otherPage.goto(origin + '/other/');
  await Promise.all([controlled(page), controlled(otherPage)]);
  const keysA = (await page.evaluate(() => caches.keys())).toSorted();
  assert.equal(keysA.length, 2);

  async function update() {
    return page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const done = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Worker update did not finish')), 15_000);
        function observe() {
          const worker = registration.installing;
          worker.addEventListener('statechange', () => {
            if (!['redundant', 'installed'].includes(worker.state)) return;
            clearTimeout(timeout);
            resolve(worker.state);
          });
        }
        registration.addEventListener('updatefound', observe, { once: true });
      });
      await registration.update();
      return done;
    });
  }
  phase = 'damaged';
  assert.equal(await update(), 'redundant');
  assert.deepEqual((await page.evaluate(() => caches.keys())).toSorted(), keysA);

  phase = 'B';
  assert.equal(await update(), 'installed');
  assert.equal(
    await page.evaluate(async () => !!(await navigator.serviceWorker.ready).waiting),
    true,
  );
  await context.setOffline(true);
  const second = await context.newPage();
  await second.goto(origin + '/demo/a/deep/route');
  assert.equal(await second.title(), 'A');
  assert.equal(await second.evaluate(async () => {
    const response = await fetch(new URL('runtime/backend/backend_bg.wasm', document.baseURI));
    const wasm = await WebAssembly.compileStreaming(response);
    return WebAssembly.Module.exports(wasm).length;
  }), 0);
  assert.equal(
    await second.evaluate(
      async () => (await import(new URL('chunks/lazy.js', document.baseURI))).default,
    ),
    'A',
  );
  assert.equal(
    await second.evaluate(() =>
      fetch('/demo/api/health').then(
        () => false,
        () => true,
      ),
    ),
    true,
  );
  await second.close();
  await page.close();
  const next = await context.newPage();
  await next.goto(origin + '/demo/');
  await controlled(next);
  assert.equal(await next.title(), 'B');
  assert.equal(await otherPage.title(), 'other');
  const keysB = (await next.evaluate(() => caches.keys())).toSorted();
  assert.equal(keysB.length, 2);
  assert.equal(keysA.filter((key) => keysB.includes(key)).length, 1);
  console.log(
    'PWA update preserved A on corrupted backend Wasm, activated B and preserved the other app cache',
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
