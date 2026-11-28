// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { removeDirectory } from '../sdk/tooling/cli/src/publication.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

// Exercise a real OffscreenCanvas loss and delay replies on only the test worker.
const controlWorker = `
  const testPost = self.postMessage.bind(self);
  const contexts = new Set();
  const getContext = OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext = function (kind, ...options) {
    const context = getContext.call(this, kind, ...options);
    if (context && kind === 'webgl2' && this.width > 16) contexts.add(context);
    return context;
  };
  let hold = false, waiting, retirement;
  self.postMessage = (message, transfer) => {
    if (hold && message.kind === 'submitted') {
      if (!waiting) {
        waiting = message;
        testPost({ lifecycleTest: true, kind: 'held', sequence: message.sequence });
      } else {
        testPost(message, transfer);
        testPost(waiting);
        if (retirement) testPost(retirement);
        testPost({ lifecycleTest: true, kind: 'reordered', sequence: message.sequence,
          previous: waiting.sequence });
        hold = false;
        waiting = retirement = undefined;
      }
    } else if (waiting && message.kind === 'retired' && message.sequence === waiting.sequence) {
      retirement = message;
    } else testPost(message, transfer);
  };
  self.addEventListener('message', (event) => {
    if (event.data?.kind === 'test-hold-submissions') {
      event.stopImmediatePropagation();
      hold = true;
    } else if (event.data?.kind === 'test-lose-graphics') {
      event.stopImmediatePropagation();
      const extension = [...contexts].at(0)?.getExtension('WEBGL_lose_context');
      if (extension) extension.loseContext();
      else testPost({ lifecycleTest: true, kind: 'no-loss-extension' });
    }
  });
`;

const workspace = path.resolve(import.meta.dirname, '../..');
const runtime = path.join(workspace, 'sample/nelyx-testbed-app-3/.nelyx/web/runtime');
const root = path.join(import.meta.dirname, 'fixtures');
const contents =
  '<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>' +
  '<div id="root"></div><script type="module" src="/platform-view-lifecycle.ts"></script>';
assert(fs.existsSync(path.join(runtime, 'native-manifest.json')), 'Build Testbed 3 Web first');
const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-view-lifecycle-')));
const contentTypes = new Map([
  ['.js', 'text/javascript'],
  ['.wasm', 'application/wasm'],
  ['.json', 'application/json'],
]);
let server;
let browser;
try {
  server = await createServer({
    root,
    configFile: false,
    publicDir: false,
    cacheDir: scratch,
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: { exclude: ['@nelyx/sdk', '@nelyx/core', '@nelyx/skia-web'] },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [workspace] } },
    plugins: [
      {
        name: 'nelyx-platform-view-lifecycle',
        enforce: 'pre',
        configureServer({ middlewares }) {
          middlewares.use((request, response, next) => {
            const { pathname } = new URL(request.url, 'http://localhost');
            if (pathname === '/') {
              response.setHeader('Content-Type', 'text/html;charset=utf-8');
              response.end(contents);
              return;
            }
            if (!pathname.startsWith('/runtime/')) return next();
            const filename = pathname.slice('/runtime/'.length);
            if (path.posix.basename(filename) !== filename) return next();
            const file = path.join(runtime, filename);
            if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return next();
            response.setHeader(
              'Content-Type',
              contentTypes.get(path.extname(file)) ?? 'application/octet-stream',
            );
            fs.createReadStream(file).pipe(response);
          });
        },
        transform(source, id) {
          const file = id.split('?')[0].replaceAll('\\', '/');
          if (file.endsWith('/sdk/dist/frontend/dom/application.js')) {
            // Put StrictMode at the actual React root so React replays mount effects.
            const rendered = 'mounted.render(React.createElement(application));';
            assert(source.includes(rendered), 'React root fixture could not enable StrictMode');
            return source.replace(
              rendered,
              'mounted.render(React.createElement(React.StrictMode, null, React.createElement(application)));',
            );
          }
          if (file.endsWith('/browser/renderer-worker.js') && id.includes('worker_file'))
            return controlWorker + source;
        },
      },
    ],
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ channel: 'chrome' });
  for (const mode of ['direct', 'worker-transfer']) {
    const page = await browser.newPage();
    const errorMessages = [];
    page.on('pageerror', (error) => errorMessages.push(error.message));
    try {
      await page.goto(url + (mode === 'direct' ? '' : '?worker'));
      await page.waitForFunction(() => Boolean(window.lifecycleTest));
      await page.evaluate(() => window.lifecycleTest.start('first'));
      const slot = page.locator('[data-nelyx-platform-view="test.lifecycle-editor"]');
      const editor = slot.locator('textarea');
      const canvas = page.locator('canvas[data-nelyx-render-path]');
      const foreground = page.locator('canvas[data-nelyx-platform-foreground]');
      await editor.waitFor({ state: 'visible' });
      await foreground.waitFor({ state: 'visible' });
      assert.equal(await canvas.getAttribute('data-nelyx-render-path'), mode);
      const id = await slot.getAttribute('id');
      await editor.fill('retained editor');
      await page.evaluate(() => window.lifecycleTest.ping());
      assert.deepEqual(await page.evaluate(() => window.lifecycleTest.counts().first), {
        effects: 2,
        cleanups: 1,
        created: 1,
        disposed: 0,
        pings: 1,
      });

      if (mode === 'worker-transfer') {
        await page.evaluate(() => {
          window.lifecycleTest.sendToWorker('test-hold-submissions');
          window.lifecycleTest.move(72);
        });
        await page.waitForFunction(() =>
          window.lifecycleTest.replies().some(({ kind }) => kind === 'held'),
        );
        assert.equal(await slot.evaluate((element) => element.style.top), '24px');
        await page.evaluate(() => window.lifecycleTest.move(128));
        const order = await page.waitForFunction(() =>
          window.lifecycleTest.replies().find(({ kind }) => kind === 'reordered'),
        );
        const { sequence, previous } = await order.jsonValue();
        assert(sequence > previous);
        assert.equal(await slot.evaluate((element) => element.style.top), '128px');
        assert.equal(await page.evaluate(() => window.lifecycleTest.workers()), 1);

        const oldCanvas = await canvas.elementHandle();
        await page.evaluate(() => window.lifecycleTest.sendToWorker('test-lose-graphics'));
        await page.waitForFunction(
          () =>
            window.lifecycleTest.workers() === 2 ||
            window.lifecycleTest.replies().some(({ kind }) => kind === 'no-loss-extension'),
        );
        assert.equal(
          await page.evaluate(() => window.lifecycleTest.workers()),
          2,
          'Worker WebGL extension did not restart the renderer',
        );
        await page.locator('canvas[data-nelyx-frame-ready="true"]').waitFor();
        await page.waitForFunction((element) => !element.isConnected, oldCanvas);
        await oldCanvas.dispose();
        await page.waitForFunction(
          () => !document.querySelector('[data-nelyx-platform-view]').inert,
        );
        assert.equal(await canvas.getAttribute('data-nelyx-render-path'), mode);
        assert.equal(await slot.getAttribute('id'), id);
        assert.equal(await editor.inputValue(), 'retained editor');
      }

      await page.evaluate(() => window.lifecycleTest.close());
      assert.equal(await editor.count(), 0);
      assert.equal(await foreground.count(), 0);
      assert.equal(await page.evaluate(() => window.lifecycleTest.liveApplications()), 0);
      await page.evaluate(() => window.lifecycleTest.start('second'));
      await editor.waitFor({ state: 'visible' });
      assert.notEqual(await slot.getAttribute('id'), id);
      assert.equal(await editor.inputValue(), 'second');
      await page.evaluate(() => window.lifecycleTest.ping());
      assert.deepEqual(await page.evaluate(() => window.lifecycleTest.counts()), {
        first: { effects: 2, cleanups: 2, created: 1, disposed: 1, pings: 1 },
        second: { effects: 2, cleanups: 1, created: 1, disposed: 0, pings: 1 },
      });
      await page.evaluate(() => window.lifecycleTest.close());
      assert.deepEqual(await page.evaluate(() => window.lifecycleTest.errors()), []);
      assert.deepEqual(errorMessages, []);
      console.log(
        mode,
        'StrictMode remount and subscription disposal verified' +
          (mode === 'worker-transfer' ? ' with reversed submissions and WebGL restart' : ''),
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server?.close();
  removeDirectory(scratch, path.dirname(scratch));
}
