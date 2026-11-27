// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { chromium, firefox, webkit } from 'playwright';
import { isAppNavigation, mediaType } from '../sdk/tooling/vite/src/content.mjs';

const { values } = parseArgs({
  options: {
    demo: { type: 'string', default: 'sample/nelyx-demo-app/.nelyx/web' },
    testbed: { type: 'string' },
    baseline: { type: 'string' },
    fixture: { type: 'string' },
    dev: { type: 'string' },
    report: { type: 'string' },
    engine: { type: 'string', default: 'chrome' },
    trials: { type: 'string', default: '1' },
    swiftshader: { type: 'boolean' },
    suite: { type: 'string', default: 'all' },
    dpr: { type: 'string', default: '1' },
  },
});
const view = { width: 1280, height: 760 },
  trialCount = Number(values.trials);
const deviceScaleFactor = Number(values.dpr);
assert.ok(Number.isFinite(deviceScaleFactor) && deviceScaleFactor >= 1 && deviceScaleFactor <= 3);
assert.ok(Number.isInteger(trialCount) && trialCount >= 1 && trialCount <= 10);
assert.ok(values.suite !== 'strict' || values.dev, '--suite strict requires a fixture --dev URL');
const coop = 'Cross-Origin-Opener-Policy',
  coep = 'Cross-Origin-Embedder-Policy';
const policies = {
  none: {},
  coop: { [coop]: 'same-origin' },
  coep: { [coep]: 'require-corp' },
  both: { [coop]: 'same-origin', [coep]: 'require-corp' },
};
const policyFields = {
  'Permissions-Policy': 'geolocation=()',
  'Content-Security-Policy': "object-src 'none'",
};
const reports = [];
const suite = (name) => values.suite === 'all' || values.suite === name;
const hideSharedConstructor =
  'Object.defineProperty(globalThis, "SharedArrayBuffer", { configurable: true, value: undefined });\n';

function workerFaults() {
  const receive = globalThis.onmessage;
  const schedule = globalThis.setTimeout;
  let canvas,
    hold = false,
    resumeDraw;
  globalThis.onmessage = (event) => {
    const data = event.data;
    if (data.kind === 'attach') canvas = data.canvas;
    if (data.kind === 'test-hold') {
      hold = true;
      return;
    }
    if (data.kind === 'test-resume') {
      hold = false;
      resumeDraw?.();
      resumeDraw = undefined;
      return;
    }
    if (data.kind === 'test-context-loss') {
      const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WEBGL_lose_context unavailable for test');
      extension.loseContext();
      return;
    }
    if (data.kind === 'frame' && hold) {
      // Hold the draw queue while acknowledgements for combined registrations continue.
      globalThis.setTimeout = (callback, delay, ...args) => {
        if (delay !== 0) return schedule(callback, delay, ...args);
        const timer = schedule(callback, 60_000, ...args);
        resumeDraw = () => {
          clearTimeout(timer);
          schedule(callback, 0, ...args);
        };
        return timer;
      };
      try {
        receive(event);
      } finally {
        globalThis.setTimeout = schedule;
      }
      return;
    }
    receive(event);
  };
}

async function serve(directory, action, options = {}) {
  const root = resolve(directory),
    base = options.base ?? '/demo/';
  let policy = options.policy ?? 'none';
  const runtimeRequests = { 'canvaskit.js': 0, 'canvaskit.wasm': 0 };
  const manifest = JSON.parse(readFileSync(join(root, 'build.json'), 'utf8'));
  const names = new Set(manifest.files.map(({ path }) => path));
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (options.popup && pathname === '/external-popup.html') {
      return response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<!doctype html>
        <script>
          const origin = new URLSearchParams(location.search).get('origin');
          if (window.opener && origin) window.opener.postMessage('nelyx-popup-ready', origin);
        </script>`);
    }
    if (!pathname.startsWith(base)) return response.writeHead(404).end();
    const relative = pathname.slice(base.length);
    if (options.embed && relative === 'embedding.html') {
      return response
        .writeHead(200, { ...policies[policy], 'Content-Type': 'text/html' })
        .end(
          '<!doctype html><iframe name="render-app" allow="cross-origin-isolated \'none\'" ' +
            'width="1100" height="660" src="./?renderMode=auto"></iframe>',
        );
    }
    const name =
      !relative || (request.headers['sec-fetch-mode'] === 'navigate' && isAppNavigation(relative))
        ? 'index.html'
        : relative;
    if (name !== 'build.json' && !names.has(name)) return response.writeHead(404).end();
    let body = readFileSync(join(root, name));
    const headers = {
      ...policies[policy],
      'Content-Type': mediaType(name),
      'Cache-Control': 'no-cache',
    };
    const runtimeFile = name.startsWith('runtime/') && name.slice('runtime/'.length);
    if (Object.hasOwn(runtimeRequests, runtimeFile)) {
      runtimeRequests[runtimeFile]++;
      if (options.coldRuntime) headers['Cache-Control'] = 'no-store';
    }
    if (name === 'index.html') {
      Object.assign(headers, policyFields);
      if (options.blockWorker) headers['Content-Security-Policy'] += "; worker-src 'none'";
      if (options.blockWasmBlob) headers['Content-Security-Policy'] += "; connect-src 'self'";
      if (relative && relative !== name)
        body = Buffer.from(
          body.toString().replace('<!--nelyx-base-->', '<base href="' + base + '">'),
        );
    }
    if (options.corruptRuntime && name === 'runtime/canvaskit.wasm')
      body = Buffer.from('damaged CanvasKit');
    if (name === manifest.rendererWorker) {
      if (options.blockBlob)
        headers['Content-Security-Policy'] = "script-src 'self' 'wasm-unsafe-eval'";
      if (options.blockWorkerWasmBlob)
        headers['Content-Security-Policy'] =
          "script-src 'self' blob: 'wasm-unsafe-eval'; connect-src 'self'";
      if (options.hideSharedConstructor)
        body = Buffer.concat([Buffer.from(hideSharedConstructor), body]);
      if (options.faults)
        body = Buffer.concat([body, Buffer.from('\n(' + workerFaults.toString() + ')();\n')]);
    }
    if (name === 'index.html') {
      headers.ETag = '"work3-original"';
      if (options.compressDocument) {
        body = gzipSync(body);
        headers['Content-Encoding'] = 'gzip';
      }
    }
    response.writeHead(200, { ...headers, 'Content-Length': body.length }).end(body);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    return await action(
      'http://127.0.0.1:' + server.address().port + base,
      (next) => {
        policy = next;
      },
      manifest,
      runtimeRequests,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}

function addProbe(fault = '') {
  window.nelyxDemoFrameProbe = (read, close) => {
    window.readNelyx = read;
    window.closeNelyx = close;
  };
  window.nelyxDemoEditorGeometryProbe = (read) => {
    window.readEditorGeometry = read;
  };
  if (fault === 'no-shared-read') {
    Object.defineProperty(window, 'SharedArrayBuffer', {
      configurable: true,
      get() {
        throw new Error('Non-isolated page accessed SharedArrayBuffer');
      },
    });
  }
  if (fault === 'no-main-webgl2') {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
      return kind === 'webgl2' ? null : original.call(this, kind, ...options);
    };
  }
  const WorkerConstructor = window.Worker;
  const trace = fault === 'trace-registration' || fault === 'fail-registration';
  window.renderWorkers = [];
  window.workerFrames = 0;
  if (trace) window.workerResourceEvents = [];
  window.Worker = class extends WorkerConstructor {
    constructor(url, options) {
      super(url, options);
      if (options?.name === 'nelyx-renderer') window.renderWorkers.push(this);
      if (trace && options?.name === 'nelyx-renderer') {
        this.addEventListener('message', ({ data }) => {
          if (['registered', 'released', 'submitted', 'retired', 'fault'].includes(data.kind)) {
            const { kind, sequence, generation, resources, resource, bytes, result } = data;
            window.workerResourceEvents.push({
              kind,
              sequence,
              generation,
              resources,
              resource,
              bytes,
              result,
            });
          }
        });
      }
    }
    postMessage(message, transfer) {
      if (message.kind === 'probe' && fault === 'hold-startup' && !window.delayedRenderProbe) {
        window.delayedRenderProbe = true;
        return;
      }
      if (message.kind === 'check-shared' && fault === 'shared')
        Atomics.store(new Int32Array(message.probe), 0, 0);
      if (message.kind === 'attach' && fault === 'attachment') {
        window.transferredCanvas = document.querySelector('canvas');
        throw new Error('Injected display canvas transfer failure');
      }
      if (message.kind === 'frame') window.workerFrames++;
      if (trace && (message.kind === 'frame' || message.kind === 'register')) {
        const { kind, sequence, generation, transport, resources } = message;
        window.workerResourceEvents.push({
          kind,
          sequence,
          generation,
          transport,
          ids: resources?.map((resource) => resource.id),
        });
        if (fault === 'fail-registration' && resources?.length > 1 && !window.failedRegistration) {
          window.failedRegistration = sequence;
          // The first valid entry is admitted before the deliberately invalid second entry.
          message = {
            ...message,
            resources: [resources[0], { ...resources[1], generation: 0 }, ...resources.slice(2)],
          };
        }
      }
      return super.postMessage(message, transfer);
    }
    terminate() {
      const index = window.renderWorkers.indexOf(this);
      if (index >= 0) window.renderWorkers.splice(index, 1);
      return super.terminate();
    }
  };
}

function observeFirstGpuFrame() {
  const observer = new MutationObserver(() => {
    if (!document.querySelector('#app canvas[data-nelyx-frame-ready=true]')) return;
    window.firstGpuFromNavigationMs = performance.now();
    observer.disconnect();
  });
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributeFilter: ['data-nelyx-frame-ready'],
  });
}

const engine = values.engine;
assert.ok(['chrome', 'webkit', 'firefox'].includes(engine), 'Select chrome, webkit or firefox');
const browser = await (engine === 'chrome'
  ? chromium.launch({
      channel: 'chrome',
      args: values.swiftshader ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
    })
  : { webkit, firefox }[engine].launch());
let gpu, glRenderer, cdp;
if (engine === 'chrome') {
  cdp = await browser.newBrowserCDPSession();
  const info = (await cdp.send('SystemInfo.getInfo')).gpu;
  gpu = info.devices;
  glRenderer = info.auxAttributes?.glRenderer;
}
console.log(JSON.stringify({ engine, version: browser.version(), gpu, glRenderer }));

async function tab(
  action,
  { serviceWorkers = 'block', fault = '', allowAlert = false, hideShared = false } = {},
) {
  const context = await browser.newContext({ viewport: view, deviceScaleFactor, serviceWorkers });
  const page = await context.newPage();
  page.setDefaultTimeout(18000);
  await page.addInitScript(addProbe, fault);
  if (hideShared) await page.addInitScript({ content: hideSharedConstructor });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const value = await action(page, context);
    assert.deepEqual(errors, []);
    if (!allowAlert)
      assert.equal(
        await page.getByRole('alert').count(),
        0,
        await page.locator('body').innerText(),
      );
    return value;
  } finally {
    await context.close();
  }
}
const diag = (page) => page.evaluate(() => window.readNelyx?.().rendering);
const appCanvas = (page) => page.locator('#app canvas').first();
const modeUrl = (root, mode, subpath = '') => root + subpath + '?renderMode=' + mode;
const onPath = (page, path) =>
  page.waitForFunction((path) => {
    const dataset = document.querySelector('canvas')?.dataset;
    return dataset?.nelyxRenderPath === path && dataset.nelyxFrameReady === 'true';
  }, path);

async function firstFrame(page, expected, baseline = false) {
  if (!baseline) {
    await page.waitForFunction(() => !!document.querySelector('[data-nelyx-render-path]'));
    const path = await appCanvas(page).getAttribute('data-nelyx-render-path');
    if (engine === 'chrome' || expected === 'direct')
      assert.equal(path, expected, JSON.stringify(await diag(page)));
  }
  await page.waitForFunction((baseline) => {
    const probe = window.readNelyx?.();
    return baseline
      ? probe?.frames.samples.some((sample) => sample.stage === 'native-submit')
      : probe?.rendering.gpuRetired > 0;
  }, baseline);
}
function wheel(page, x, y, deltaY) {
  return appCanvas(page).dispatchEvent('wheel', {
    clientX: x,
    clientY: y,
    deltaY,
    bubbles: true,
    cancelable: true,
  });
}
async function screenshotPixels(page, locator) {
  const png = await locator.screenshot({ scale: 'css' });
  const mark = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const counts = new Map();
    for (let index = 0; index < data.length; index += 4) {
      const color = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    return {
      dominant: [...counts].sort((a, b) => b[1] - a[1])[0],
      colors: counts.size,
      size: [image.width, image.height],
    };
  }, png.toString('base64'));
  assert.ok(mark.colors > 1, 'App pixels must contain rendered content');
  return { ...mark, sha256: createHash('sha256').update(png).digest('hex') };
}
async function nextFrames(page, count = 2) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame);
  }, count);
}
async function selectText(page) {
  await page.locator('[data-semantics-identifier="open-drawer"]').click({ force: true });
  await page.getByRole('button', { name: 'Text selection', exact: true }).click({ force: true });
  const field = page.getByRole('textbox', { name: 'Material single line', exact: true });
  await field.waitFor();
  const box = await field.boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + 27, box.y + box.height / 2);
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForFunction(() => {
    const active = document.activeElement,
      editor = active?.editContext ?? active;
    const boxes = window.readEditorGeometry?.(editor?.text ?? editor?.value)?.selectionBoxes;
    return editor?.selectionEnd > editor?.selectionStart && boxes?.length > 0;
  });
  return page.evaluate(() => {
    const element = document.activeElement,
      editor = element?.editContext ?? element;
    const text = editor?.text ?? editor?.value,
      start = editor?.selectionStart,
      end = editor?.selectionEnd;
    return { text, start, end, geometry: window.readEditorGeometry?.(text) };
  });
}
const measuredStages = new Set([
  'animation',
  'build',
  'layout',
  'compositing',
  'paint',
  'compose',
  'capture-transfer',
  'submit',
]);
function mainFrameP95(samples) {
  const duration = new Map();
  for (const { frame, stage, duration: elapsed } of samples)
    if (frame > 0 && measuredStages.has(stage))
      duration.set(frame, (duration.get(frame) ?? 0) + elapsed);
  return p95([...duration.values()]);
}
function p95(samples) {
  const sorted = samples.sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
async function rendererMemoryMiB() {
  if (!cdp || !['darwin', 'linux'].includes(process.platform)) return;
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  const ids = processInfo
    .filter(({ type }) => ['renderer', 'gpu'].includes(type.toLowerCase()))
    .map(({ id }) => id);
  if (!ids.length) return;
  try {
    const lines = execFileSync('ps', ['-o', 'rss=', '-p', ids.join(',')], { encoding: 'utf8' })
      .trim()
      .split('\n');
    return lines.reduce((sum, value) => sum + Number(value), 0) / 1024;
  } catch {
    // A renderer process can exit between the two snapshots.
  }
}
async function sample(page, url, expected, { baseline = false, benchmark = false } = {}) {
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: 'Filled', exact: true });
  await button.waitFor();
  await firstFrame(page, expected, baseline);
  const firstMs = Date.now() - started;
  const rss = [await rendererMemoryMiB()];
  const first = await screenshotPixels(page, button);
  const full = await button.boundingBox(),
    list = await button.evaluate((node) =>
      node.closest('[role=list]').getBoundingClientRect().toJSON(),
    );
  assert.ok(full);
  const scroll = (delta) => wheel(page, list.x + 12, list.y + 80, delta);
  await scroll(full.y + full.height - list.y - 15);
  await page.waitForFunction(
    () =>
      Math.abs(
        document.querySelector('button[aria-label=Filled]')?.getBoundingClientRect().height - 15,
      ) < 1.6,
  );
  await nextFrames(page, 3);
  let clipped;
  for (let attempt = 0; attempt < 12; attempt++) {
    await nextFrames(page, 2);
    clipped = await screenshotPixels(page, button);
    if (clipped.dominant[0] === first.dominant[0]) break;
  }
  assert.equal(clipped.dominant[0], first.dominant[0], JSON.stringify(await diag(page)));
  assert.ok(clipped.size[1] < first.size[1]);
  await scroll(-1000);
  await page.waitForFunction(
    (y) =>
      Math.abs(document.querySelector('button[aria-label=Filled]')?.getBoundingClientRect().y - y) <
      1,
    full.y,
  );
  if (benchmark) {
    for (let i = 0; i < 20; i++) {
      await scroll(i < 10 ? 21 : -21);
      await nextFrames(page);
    }
  }
  rss.push(await rendererMemoryMiB());
  const selection = await selectText(page);
  assert.ok(selection.text?.includes('Nelyx'));
  assert.ok(selection.end > selection.start, JSON.stringify(selection));
  await nextFrames(page, 3);
  const probe = await page.evaluate(() => window.readNelyx());
  const rendering = probe.rendering,
    mainFrameP95Ms = mainFrameP95(probe.frames.samples);
  rss.push(await rendererMemoryMiB());
  const peakRendererGpuRssMiB = rss.some(Number.isFinite)
    ? Math.max(...rss.filter(Number.isFinite))
    : undefined;
  if (rendering?.path === 'worker-shared') assert.ok(rendering.sharedConsumed > 0);
  if (rendering?.path === 'worker-transfer')
    assert.ok(
      rendering.buffersDetached > 0 && rendering.buffersReturned > 0 && rendering.buffersReused > 0,
    );
  if (rendering) assert.ok(rendering.maxPending <= 2);
  const isolated = await page.evaluate(() => crossOriginIsolated);
  return {
    isolated,
    first,
    clipped,
    selection,
    firstMs,
    mainFrameP95Ms,
    peakRendererGpuRssMiB,
    rendering,
  };
}

async function scrollPerformance(trial, requested, expected) {
  const report = await serve(
    values.demo,
    (root, _updatePolicy, manifest, runtimeRequests) =>
      tab(async (page) => {
        await page.addInitScript(observeFirstGpuFrame);
        await page.goto(modeUrl(root, requested), { waitUntil: 'domcontentloaded' });
        await firstFrame(page, expected);
        const firstGpuFromNavigationMs = await page.evaluate(() => window.firstGpuFromNavigationMs);
        assert.ok(firstGpuFromNavigationMs > 0);
        const firstRuntimeRequests = { ...runtimeRequests };
        const list = await page
          .getByRole('button', { name: 'Filled', exact: true })
          .evaluate((node) => node.closest('[role=list]').getBoundingClientRect().toJSON());
        await nextFrames(page, 8);
        const before = await page.evaluate(() => window.readNelyx());
        for (let index = 0; index < 16; index++) {
          await wheel(page, list.x + 12, list.y + 80, index < 8 ? 15 : -15);
          await nextFrames(page);
        }
        await nextFrames(page, 8);
        const after = await page.evaluate(() => window.readNelyx());
        const { samples, overwritten, invalid } = after.frames;
        assert.equal(overwritten + invalid, 0);
        const offsets = samples
          .filter(({ stage }) => stage === 'section-scroll-offset')
          .map(({ scrollOffset }) => scrollOffset);
        assert.ok(Math.max(...offsets) > Math.min(...offsets), 'The wheel must move the list');
        const packets = samples.filter(({ stage }) => stage === 'web-frame-encode');
        assert.equal(after.rendering.crossOriginIsolated, true);
        if (expected !== 'direct') assert.equal(after.rendering.workerIsolated, true);
        if (expected === 'worker-shared') assert.ok(after.rendering.sharedConsumed > 0);
        const delta = (key) =>
          after.rendering[key] === undefined
            ? undefined
            : after.rendering[key] - before.rendering[key];
        return {
          case: 'performance',
          trial,
          release: manifest.buildId,
          path: after.rendering.path,
          firstGpuFromNavigationMs,
          firstRuntimeRequests,
          mainFrameP95Ms: mainFrameP95(samples),
          inputToSubmitP95Ms: after.rendering.p95Ms.inputToSubmit,
          scroll: {
            min: Math.min(...offsets),
            max: Math.max(...offsets),
            end: offsets.at(-1),
          },
          accepted: after.rendering.accepted - before.rendering.accepted,
          gpuRetired: after.rendering.gpuRetired - before.rendering.gpuRetired,
          discarded: after.rendering.discarded - before.rendering.discarded,
          peakResourceBytes: after.rendering.peakResourceBytes,
          maxPacketBytes: Math.max(0, ...packets.map(({ bytes }) => bytes)),
          mainPictureCompilations:
            after.pictures.framePictureCompilations - before.pictures.framePictureCompilations,
          workerPictureCompilations: delta('workerPictureCompilations'),
          registrationWaits: delta('registrationWaits'),
          framesWithRegistration: delta('framesWithRegistration'),
          workerRegistrationP95Ms: p95(
            samples
              .filter(({ stage }) => stage === 'web-worker-register')
              .map(({ duration }) => duration),
          ),
        };
      }),
    { policy: 'both', base: '/', coldRuntime: true },
  );
  reports.push(report);
  console.log(JSON.stringify(report));
}

async function pwa(directory, name, policy, expected) {
  await serve(
    directory,
    (root, updatePolicy, manifest) =>
      tab(
        async (page, context) => {
          assert.ok(manifest.files.some((file) => file.path === manifest.rendererWorker));
          await page.goto(modeUrl(root, 'auto'));
          const canvas = appCanvas(page);
          await page.waitForFunction(() => !!document.querySelector('[data-nelyx-render-path]'));
          await onPath(page, expected);
          const first = await screenshotPixels(page, canvas);
          await page.waitForFunction(() => !!navigator.serviceWorker.controller);
          await page.goto(modeUrl(root, 'auto', 'route/first'));
          await onPath(page, expected);
          const afterDirect = await screenshotPixels(page, canvas);
          assert.equal(afterDirect.dominant[0], first.dominant[0]);
          const subpath = await page.goto(modeUrl(root, 'auto', 'route/controlled'));
          const headers = await subpath.allHeaders();
          assert.equal(headers['permissions-policy'], policyFields['Permissions-Policy']);
          assert.equal(headers['content-security-policy'], policyFields['Content-Security-Policy']);
          assert.equal(headers.etag, undefined);
          assert.equal(headers['content-length'], undefined);
          assert.equal(headers['content-encoding'], undefined);
          if (policy === 'both') {
            assert.equal(headers[coop.toLowerCase()], 'same-origin');
            assert.equal(headers[coep.toLowerCase()], 'require-corp');
          } else {
            assert.equal(headers[coop.toLowerCase()], undefined);
            assert.equal(headers[coep.toLowerCase()], undefined);
          }
          await context.setOffline(true);
          await page.goto(modeUrl(root, 'auto', 'route/restart'));
          await onPath(page, expected);
          const offline = await screenshotPixels(page, canvas);
          assert.equal(offline.dominant[0], first.dominant[0]);
          await context.setOffline(false);
          const nextPolicy = policy === 'both' ? 'none' : 'both';
          updatePolicy(nextPolicy);
          await page.goto(modeUrl(root, 'auto', 'route/header-update'));
          const nextPath = nextPolicy === 'both' ? 'worker-shared' : 'worker-transfer';
          await onPath(page, nextPath);
          await screenshotPixels(page, canvas);
          await context.setOffline(true);
          await page.goto(modeUrl(root, 'auto', 'route/header-restart'));
          await onPath(page, nextPath);
          await screenshotPixels(page, canvas);
          reports.push({ case: 'pwa', name, policy, expected, nextPath, first, offline });
        },
        { serviceWorkers: 'allow' },
      ),
    { base: name === 'demo' ? '/demo/' : '/', policy, compressDocument: true },
  );
}

async function recovery() {
  await serve(
    values.demo,
    (root, _update, _manifest, runtimeRequests) =>
      tab(async (page) => {
        await page.goto(modeUrl(root, 'auto'));
        await firstFrame(page, 'worker-shared');
        const canvas = appCanvas(page),
          start = await canvas.elementHandle();
        const before = await diag(page);
        const holdTwo = async () => {
          const count = await page.evaluate(() => {
            window.renderWorkers[0].postMessage({ kind: 'test-hold' });
            return window.workerFrames;
          });
          for (const delta of [21, 24, 19]) {
            await wheel(page, 280, 365, delta);
            await nextFrames(page, 3);
          }
          await page.waitForFunction((count) => window.workerFrames === count + 2, count);
        };
        const clip = { x: 16, y: 16, width: 520, height: 112 };
        const beforeResize = await page.screenshot({ clip, scale: 'device' });
        await holdTwo();
        const resized = { width: view.width - 215, height: view.height + 45 };
        await page.setViewportSize(resized);
        const held = await page.screenshot({ clip, scale: 'device' });
        assert.ok(held.equals(beforeResize), 'Displayed bitmap stretched during a blocked resize');
        const device = await page.context().newCDPSession(page);
        await device.send('Emulation.setDeviceMetricsOverride', {
          ...resized,
          deviceScaleFactor: 2,
          mobile: false,
        });
        await page.waitForFunction(() => devicePixelRatio === 2);
        await nextFrames(page, 3);
        await page.evaluate(() => {
          window.restoreVisibility = Object.getOwnPropertyDescriptor(document, 'hidden');
          Object.defineProperty(document, 'hidden', { configurable: true, value: true });
          document.dispatchEvent(new Event('visibilitychange'));
          window.renderWorkers[0].postMessage({ kind: 'test-resume' });
        });
        await page.waitForFunction(
          (discarded) => window.readNelyx().rendering.discarded >= discarded + 2,
          before.discarded,
        );
        await page.evaluate(() => {
          if (window.restoreVisibility)
            Object.defineProperty(document, 'hidden', window.restoreVisibility);
          else delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(
          (frames) => window.readNelyx().rendering.gpuRetired > frames,
          before.gpuRetired,
        );
        await nextFrames(page, 3);
        const finalSize = await canvas.evaluate((element) => ({
          backing: [element.width, element.height],
          viewport: [element.parentElement.clientWidth, element.parentElement.clientHeight],
          scale: devicePixelRatio,
        }));
        assert.deepEqual(finalSize, {
          backing: [resized.width * 2, resized.height * 2],
          viewport: [resized.width, resized.height],
          scale: 2,
        });
        // The latest resize can draw even while the normal worker timer is held.
        await page.waitForFunction(() => {
          const { accepted, gpuRetired, discarded } = window.readNelyx().rendering;
          return accepted === gpuRetired + discarded;
        });
        const settled = await diag(page);
        await page.evaluate(() => window.renderWorkers[0].postMessage({ kind: 'test-hold' }));
        await page.setViewportSize({ width: resized.width + 12, height: resized.height });
        await page.waitForFunction(
          (frames) => window.readNelyx().rendering.gpuRetired > frames,
          settled.gpuRetired,
        );
        await page.evaluate(() => window.renderWorkers[0].postMessage({ kind: 'test-resume' }));
        await canvas.focus();
        await holdTwo();
        const beforeLoss = await diag(page);
        await page.evaluate(() =>
          window.renderWorkers[0].postMessage({ kind: 'test-context-loss' }),
        );
        await page.waitForFunction(
          (frames) => window.readNelyx().rendering.gpuRetired > frames,
          beforeLoss.gpuRetired,
        );
        assert.equal(await start.evaluate((element) => element.isConnected), false);
        assert.equal(await canvas.getAttribute('data-nelyx-render-path'), 'worker-shared');
        assert.equal(await canvas.evaluate((element) => document.activeElement === element), true);
        assert.equal(await page.evaluate(() => window.renderWorkers.length), 1);
        assert.ok((await diag(page)).failures.some(({ stage }) => stage === 'worker-context-loss'));
        assert.deepEqual(runtimeRequests, { 'canvaskit.js': 1, 'canvaskit.wasm': 1 });
        await holdTwo();
        await page.evaluate(() => window.renderWorkers[0].terminate());
        await onPath(page, 'direct');
        await screenshotPixels(page, canvas);
        const after = await diag(page);
        assert.ok(after.discarded >= before.discarded + 6);
        assert.equal(after.resourceBytes, 0);
        assert.equal(await page.evaluate(() => window.renderWorkers.length), 0);
        reports.push({ case: 'recovery', rendering: after });
        await device.detach();
      }),
    { policy: 'both', faults: true, coldRuntime: true },
  );

  await serve(
    values.demo,
    (root) =>
      tab(async (page) => {
        await page.goto(modeUrl(root, 'auto'));
        await firstFrame(page, 'worker-transfer');
        const count = await page.evaluate(() => {
          window.renderWorkers[0].postMessage({ kind: 'test-hold' });
          return window.workerFrames;
        });
        for (const delta of [22, 23, 24]) {
          await wheel(page, 280, 360, delta);
          await nextFrames(page, 3);
        }
        await page.waitForFunction((count) => window.workerFrames === count + 2, count);
        await page.evaluate(() => window.closeNelyx());
        assert.equal(await page.evaluate(() => window.renderWorkers.length), 0);
        const rendering = await diag(page);
        assert.equal(rendering.accepted, rendering.gpuRetired + rendering.discarded);
        reports.push({ case: 'close-with-two-frames', rendering });
      }),
    { faults: true },
  );
}

async function embeddedResize() {
  await serve(
    values.demo,
    (root) =>
      tab(async (page) => {
        await page.goto(modeUrl(root, 'direct'));
        await firstFrame(page, 'direct');
        await nextFrames(page);
        const result = await page.evaluate(
          () =>
            new Promise((resolve) => {
              const canvas = document.querySelector('[data-nelyx-render-path]');
              const viewport = canvas.parentElement;
              requestAnimationFrame(() => {
                const accepted = window.readNelyx().rendering.accepted;
                const backing = [canvas.width, canvas.height];
                const width = viewport.clientWidth - 180;
                const height = viewport.clientHeight - 120;
                viewport.style.width = width + 'px';
                viewport.style.height = height + 'px';
                // An rAF scheduled by ResizeObserver would run after this callback.
                requestAnimationFrame(() => {
                  const bounds = canvas.getBoundingClientRect();
                  resolve({
                    accepted: window.readNelyx().rendering.accepted - accepted,
                    document: [innerWidth, innerHeight],
                    viewport: [width, height],
                    display: [bounds.width, bounds.height],
                    backing,
                    nextBacking: [canvas.width, canvas.height],
                    scale: devicePixelRatio,
                    windows: navigator.platform.startsWith('Win'),
                  });
                });
              });
            }),
        );
        assert.ok(result.accepted > 0, 'Changing only the parent must submit before the next rAF');
        assert.deepEqual(result.document, [view.width, view.height]);
        for (let axis = 0; axis < 2; axis++) {
          assert.ok(
            Math.abs(result.display[axis] - result.viewport[axis]) < 0.1,
            JSON.stringify(result),
          );
        }
        assert.deepEqual(
          result.nextBacking,
          result.windows
            ? result.backing
            : result.viewport.map((size) => Math.round(size * result.scale)),
        );
        if (result.windows) {
          const canvas = appCanvas(page);
          const backing = () => canvas.evaluate(({ width, height }) => [width, height]);
          const resize = async (width, height) => {
            const before = await canvas.evaluate(
              (element, { width, height }) => {
                const { accepted } = window.readNelyx().rendering;
                element.parentElement.style.width = width + 'px';
                element.parentElement.style.height = height + 'px';
                return accepted;
              },
              { width, height },
            );
            await page.waitForFunction(
              (accepted) => window.readNelyx().rendering.accepted > accepted,
              before,
            );
            await nextFrames(page);
            return backing();
          };
          // Shrink below half the initial allocation before exercising growth.
          const initial = await resize(860, 480);
          const grown = await resize(930, 450);
          const reversed = await resize(880, 470);
          assert.deepEqual(initial, [
            Math.round(860 * result.scale),
            Math.round(480 * result.scale),
          ]);
          assert.ok(grown[0] > initial[0], JSON.stringify({ initial, grown, reversed }));
          assert.equal(grown[1], initial[1], 'Keep capacity on the axis that shrinks');
          assert.deepEqual(reversed, grown, 'Reversing the drag must reuse the buffer');
          const drawer = page.getByRole('button', { name: 'Show navigation drawer', exact: true });
          await drawer.waitFor({ state: 'hidden' });
          await page.evaluate(() => {
            const viewport = document.querySelector('[data-nelyx-render-path]').parentElement;
            viewport.style.width = '1100px';
          });
          await drawer.waitFor();
        }
        reports.push({ case: 'embedded-resize', ...result });
        console.log(JSON.stringify({ case: 'embedded-resize', ...result }));
      }),
    { policy: 'both' },
  );
}

async function canvasKitCompatibility() {
  await serve(
    values.demo,
    (root, _update, _manifest, runtimeRequests) =>
      tab(async (page) => {
        await page.addInitScript(() => {
          document.addEventListener('securitypolicyviolation', (event) => {
            if (event.effectiveDirective === 'connect-src' && event.blockedURI.startsWith('blob'))
              window.wasmBlobBlocked = true;
          });
        });
        await page.goto(modeUrl(root, 'direct'));
        await firstFrame(page, 'direct');
        await page.waitForFunction(() => window.wasmBlobBlocked);
        await screenshotPixels(page, page.getByRole('button', { name: 'Filled', exact: true }));
        assert.deepEqual(runtimeRequests, { 'canvaskit.js': 1, 'canvaskit.wasm': 1 });
      }),
    { policy: 'both', blockWasmBlob: true, coldRuntime: true },
  );
}

async function partialRegistration() {
  await serve(
    values.demo,
    (root) =>
      tab(
        async (page) => {
          await page.goto(modeUrl(root, 'auto'));
          await onPath(page, 'direct');
          const rendering = await diag(page);
          assert.ok(rendering.failures.some(({ stage }) => stage === 'worker-resources'));
          assert.equal(rendering.resourceBytes, 0);
          assert.equal(rendering.framesWithRegistration, 1);
          assert.equal(rendering.discarded, 1);
          const { sequence, events } = await page.evaluate(() => ({
            sequence: window.failedRegistration,
            events: window.workerResourceEvents,
          }));
          assert.ok(sequence > 0);
          assert.equal(
            events.filter((event) => event.kind === 'frame' && event.sequence === sequence).length,
            1,
          );
          assert.equal(events.filter((event) => event.kind === 'fault').length, 1);
          assert.ok(!events.some(({ kind }) => kind === 'registered' || kind === 'submitted'));
          assert.equal(await page.evaluate(() => window.renderWorkers.length), 0);
          await screenshotPixels(page, page.getByRole('button', { name: 'Filled', exact: true }));
        },
        { fault: 'fail-registration' },
      ),
    { policy: 'both' },
  );
}

async function closeDuringStartup() {
  await serve(
    values.fixture,
    (root, _update, _manifest, runtimeRequests) =>
      tab(
        async (page) => {
          await page.goto(modeUrl(root, 'auto'));
          await page.waitForFunction(() => window.delayedRenderProbe);
          await page.getByRole('button', { name: 'Unmount renderer scene' }).click();
          await page.waitForFunction(() => window.renderWorkers.length === 0);
          assert.equal(await appCanvas(page).count(), 0);
          await page.getByRole('button', { name: 'Mount renderer scene' }).click();
          await onPath(page, 'worker-shared');
          assert.deepEqual(runtimeRequests, { 'canvaskit.js': 1, 'canvaskit.wasm': 1 });
        },
        { fault: 'hold-startup' },
      ),
    { policy: 'both', coldRuntime: true },
  );
}

async function checkCombinedRegistrations(page) {
  const events = await page.evaluate(() => window.workerResourceEvents);
  assert.ok(events.every(({ kind }) => kind !== 'register'));
  const uploads = events.filter(({ kind, ids }) => kind === 'frame' && ids?.length);
  assert.deepEqual(
    uploads.map(({ transport }) => transport),
    ['shared', 'transfer'],
  );
  const seen = new Set();
  for (const frame of uploads) {
    const matches = events.filter(
      ({ generation, sequence }) => generation === frame.generation && sequence === frame.sequence,
    );
    assert.deepEqual(
      matches.map(({ kind }) => kind),
      ['frame', 'registered', 'submitted', 'retired'],
    );
    const registered = matches[1];
    assert.deepEqual(
      registered.resources.map(({ id }) => id),
      frame.ids,
    );
    for (const resource of registered.resources) {
      assert.ok(resource.generation > 0);
      assert.ok(!seen.has(resource.id), 'A resource ID is compiled once in the worker generation');
      seen.add(resource.id);
      if (resource.nativeBytes !== undefined) assert.ok(resource.cost > resource.nativeBytes);
    }
  }
  const lastRegistration = events.filter(({ kind }) => kind === 'registered').at(-1);
  const largePicture = lastRegistration.resources.find(
    ({ nativeBytes }) => nativeBytes !== undefined,
  );
  await page.evaluate(() => window.dropLargeRendererPicture());
  await page.waitForFunction(
    (id) =>
      window.workerResourceEvents.some(
        (event) => event.kind === 'released' && event.resource.id === id,
      ),
    largePicture.id,
  );
  const released = await page.evaluate(
    (id) =>
      window.workerResourceEvents.find(
        (event) => event.kind === 'released' && event.resource.id === id,
      ),
    largePicture.id,
  );
  assert.equal(released.resource.generation, largePicture.generation);
  assert.equal(released.bytes, lastRegistration.bytes - largePicture.cost);
  assert.equal(
    (await page.evaluate(() => window.readRendererScene())).rendering.resourceBytes,
    released.bytes,
  );
}

async function checkSceneRecovery(page, reference) {
  await page.evaluate(() => window.drawLargeRendererScene());
  const before = await page.evaluate(() => window.readRendererScene());
  for (const expected of ['worker-shared', 'direct']) {
    const frames = await page.evaluate(() => {
      window.recoveryCanvas = document.querySelector('#app canvas');
      window.renderWorkers[0].postMessage({ kind: 'test-context-loss' });
      return window.readRendererScene().rendering.gpuRetired;
    });
    await page.waitForFunction(
      ({ expected, frames }) => {
        const canvas = document.querySelector('#app canvas');
        return (
          canvas !== window.recoveryCanvas &&
          canvas?.dataset.nelyxRenderPath === expected &&
          canvas.dataset.nelyxFrameReady === 'true' &&
          window.readRendererScene().rendering.gpuRetired > frames
        );
      },
      { expected, frames },
    );
    assert.deepEqual(await screenshotPixels(page, appCanvas(page)), reference);
  }
  const recovered = await page.evaluate(() => window.readRendererScene());
  assert.equal(
    recovered.rendering.failures.filter(({ stage }) => stage === 'worker-context-loss').length,
    2,
  );
  assert.equal(recovered.rendering.resourceBytes, 0);
  assert.ok(
    recovered.rendering.workerPictureCompilations >= before.rendering.workerPictureCompilations + 3,
  );
  assert.equal(
    recovered.rasterization.framePictureCompilations,
    before.rasterization.framePictureCompilations + 1,
  );
  assert.equal(await page.evaluate(() => window.renderWorkers.length), 0);
}

async function touchScroll() {
  await serve(values.demo, (root) =>
    tab(async (page) => {
      await page.setViewportSize({ width: 390, height: 719 });
      const input = await page.context().newCDPSession(page);
      await input.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      for (const mode of ['direct', 'worker-transfer']) {
        await page.goto(modeUrl(root, mode));
        await firstFrame(page, mode);
        const target = page.getByRole('button', { name: 'Filled', exact: true });
        const before = await target.boundingBox();
        assert.ok(before);
        const list = await target.evaluate((element) =>
          element.closest('[role=list]').getBoundingClientRect().toJSON(),
        );
        await page.evaluate(() => {
          window.receivedTouchMoves = 0;
          document.addEventListener(
            'pointermove',
            (event) => {
              if (event.isTrusted && event.pointerType === 'touch') window.receivedTouchMoves++;
            },
            { capture: true },
          );
        });
        const x = list.x + 14,
          y = list.y + list.height * 0.75;
        await input.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        });
        for (let step = 1; step <= 10; step++) {
          await input.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y - step * 10 }],
          });
          await nextFrames(page, 1);
        }
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction((initialY) => {
          const element = document.querySelector('button[aria-label=Filled]');
          return !element || Math.abs(element.getBoundingClientRect().y - initialY) > 10;
        }, before.y);
        const rendering = await diag(page);
        assert.equal(rendering.path, mode);
        assert.ok(rendering.gpuRetired > 1 && rendering.p95Ms.inputToSubmit !== undefined);
        assert.ok(await page.evaluate(() => window.receivedTouchMoves > 0));
        reports.push({ case: 'touch-scroll', mode, rendering });
      }
      await input.detach();
    }),
  );
}

async function externalPopup() {
  for (const [policy, path] of [
    ['none', 'worker-transfer'],
    ['both', 'worker-shared'],
  ]) {
    await serve(
      values.demo,
      (root) =>
        tab(async (page, context) => {
          await page.goto(modeUrl(root, 'auto'));
          await firstFrame(page, path);
          const url = new URL('/external-popup.html', root);
          url.hostname = 'localhost';
          url.searchParams.set('origin', new URL(root).origin);
          const opened = context.waitForEvent('page');
          await page.evaluate((href) => {
            const origin = new URL(href).origin;
            window.nelyxExternalPopupCallback = false;
            window.addEventListener('message', (event) => {
              if (event.origin === origin && event.data === 'nelyx-popup-ready')
                window.nelyxExternalPopupCallback = true;
            });
            window.open(href, 'nelyxExternalPopup');
          }, url.href);
          const popup = await opened;
          await popup.waitForURL(url.href, { waitUntil: 'load' });
          const hasOpener = await popup.evaluate(() => window.opener !== null);
          assert.equal(hasOpener, policy === 'none');
          if (hasOpener) await page.waitForFunction(() => window.nelyxExternalPopupCallback);
          const callback = await page.evaluate(() => window.nelyxExternalPopupCallback);
          assert.equal(callback, hasOpener);
          await onPath(page, path);
          reports.push({ case: 'external-popup', policy, path, hasOpener, callback });
        }),
      { policy, popup: true },
    );
  }
}

async function strictModeRemount() {
  await tab(async (page) => {
    await page.goto(modeUrl(new URL(values.dev).href, 'auto'));
    await onPath(page, 'worker-shared');
    await page.waitForFunction(() => window.readRendererScene?.().rendering.gpuRetired > 0);
    const read = () =>
      page.evaluate(() => ({
        ...window.rendererSceneEffects,
        workers: window.renderWorkers.length,
      }));
    const first = await read();
    assert.equal(first.setups - first.cleanups, 1);
    assert.equal(first.workers, 1);
    const canvas = appCanvas(page);
    const previous = await canvas.elementHandle();
    const worker = await page.evaluateHandle(() => window.renderWorkers[0]);
    const pixels = await screenshotPixels(page, canvas);
    await page.getByRole('button', { name: 'Unmount renderer scene' }).click();
    await page.waitForFunction(() => window.renderWorkers.length === 0);
    assert.equal(await previous.evaluate((element) => element.isConnected), false);
    await page.getByRole('button', { name: 'Mount renderer scene' }).click();
    await page.waitForFunction(
      (worker) =>
        window.renderWorkers.length === 1 &&
        window.renderWorkers[0] !== worker &&
        window.readRendererScene?.().revision === 2 &&
        window.readRendererScene().rendering.gpuRetired > 0,
      worker,
    );
    await onPath(page, 'worker-shared');
    assert.deepEqual(await screenshotPixels(page, canvas), pixels);
    const remounted = await read();
    assert.deepEqual(remounted, {
      setups: first.setups + 2,
      cleanups: first.cleanups + 2,
      workers: 1,
    });
    reports.push({ case: 'strict-mode-remount', first, remounted, pixels });
  });
}

try {
  if (values.suite === 'performance') {
    const modes = [
      ['direct', 'direct'],
      ['worker-transfer', 'worker-transfer'],
      ['auto', 'worker-shared'],
    ];
    for (let trial = 0; trial < trialCount; trial++)
      for (let offset = 0; offset < modes.length; offset++)
        await scrollPerformance(trial + 1, ...modes[(trial + offset) % modes.length]);
  }

  if (values.baseline && suite('demo')) {
    let reference;
    for (const policy of Object.keys(policies)) {
      const result = await serve(
        values.baseline,
        (root) =>
          tab((page) => sample(page, modeUrl(root, 'direct'), 'direct', { baseline: true })),
        { policy },
      );
      reference ??= result;
      assert.deepEqual(
        [result.first, result.clipped, result.selection],
        [reference.first, reference.clipped, reference.selection],
      );
      assert.equal(result.isolated, policy === 'both');
      reports.push({ case: 'baseline', policy, ...result });
    }
  }

  if (suite('demo'))
    for (let trial = 0; trial < trialCount; trial++) {
      let reference;
      for (const [policy, requested, expected] of [
        ['both', 'direct', 'direct'],
        ['none', 'auto', 'worker-transfer'],
        ['both', 'worker-transfer', 'worker-transfer'],
        ['both', 'auto', 'worker-shared'],
      ]) {
        const result = await serve(
          values.demo,
          (root) =>
            tab((page) => sample(page, modeUrl(root, requested), expected, { benchmark: true }), {
              fault: policy === 'none' ? 'no-shared-read' : '',
            }),
          { policy, base: '/' },
        );
        reference ??= result;
        assert.deepEqual(
          [result.first, result.clipped, result.selection],
          [reference.first, reference.clipped, reference.selection],
        );
        assert.equal(result.isolated, policy === 'both');
        reports.push({ case: 'demo', trial, policy, requested, expected, ...result });
        console.log(
          JSON.stringify({
            policy,
            expected,
            firstMs: result.firstMs,
            mainFrameP95Ms: result.mainFrameP95Ms,
            peakRendererGpuRssMiB: result.peakRendererGpuRssMiB,
            rendering: result.rendering,
          }),
        );
      }
    }

  if (suite('shared-memory')) {
    await serve(
      values.demo,
      (root) =>
        tab(
          async (page) => {
            await page.goto(modeUrl(root, 'auto'));
            await firstFrame(page, 'worker-shared');
            assert.equal(await page.evaluate(() => typeof SharedArrayBuffer), 'undefined');
            const rendering = await diag(page);
            assert.equal(rendering.path, 'worker-shared', JSON.stringify(rendering));
            assert.equal(rendering.workerIsolated, true);
            assert.ok(rendering.sharedConsumed > 0);
            reports.push({ case: 'wasm-shared-memory', rendering });
          },
          { hideShared: true },
        ),
      { policy: 'both', hideSharedConstructor: true },
    );
  }

  if (engine === 'chrome' && suite('recovery')) {
    for (const [fault, settings, expected, stage] of [
      ['shared', {}, 'worker-transfer', 'shared-memory'],
      ['attachment', {}, 'direct', 'worker-attach'],
      ['', { blockWorker: true }, 'direct', 'worker-script'],
      ['', { blockBlob: true }, 'direct', 'worker-runtime'],
      ['', { blockWorkerWasmBlob: true }, 'direct', 'worker-runtime'],
    ]) {
      await serve(
        values.demo,
        (root) =>
          tab(
            async (page) => {
              await page.goto(modeUrl(root, 'auto'));
              await firstFrame(page, expected);
              const render = await diag(page);
              assert.ok(
                render.failures.some((failure) => failure.stage === stage),
                JSON.stringify(render),
              );
              if (fault === 'attachment')
                assert.equal(
                  await page.evaluate(() => window.transferredCanvas.isConnected),
                  false,
                );
              await screenshotPixels(
                page,
                page.getByRole('button', { name: 'Filled', exact: true }),
              );
              reports.push({ case: 'fallback', stage, rendering: render });
            },
            { fault },
          ),
        { policy: 'both', ...settings },
      );
    }
    for (const [fault, settings, message] of [
      ['no-main-webgl2', { blockWorker: true }, /worker-script.*main-webgl2/],
      ['', { corruptRuntime: true }, /CanvasKit artifact size\/hash mismatch/],
    ]) {
      await serve(
        values.demo,
        (root) =>
          tab(
            async (page) => {
              await page.goto(modeUrl(root, 'auto'));
              const alert = page.getByRole('alert').first();
              await alert.waitFor();
              assert.match(await alert.textContent(), message);
              assert.equal(await page.locator('[data-nelyx-frame-ready]').count(), 0);
              reports.push({ case: 'initialization-error', error: await alert.textContent() });
            },
            { fault, allowAlert: true },
          ),
        { ...settings },
      );
    }
    await canvasKitCompatibility();
    await partialRegistration();
    await recovery();
    await serve(
      values.demo,
      (root) =>
        tab(async (page) => {
          await page.goto(root + 'embedding.html');
          const frame = page.frame({ name: 'render-app' });
          assert.ok(frame);
          await onPath(frame, 'worker-transfer');
          assert.equal(await page.evaluate(() => crossOriginIsolated), true);
          assert.equal(await frame.evaluate(() => crossOriginIsolated), false);
          await screenshotPixels(page, frame.getByRole('button', { name: 'Filled', exact: true }));
          reports.push({
            case: 'iframe-permissions-policy',
            rendering: await frame.evaluate(() => window.readNelyx().rendering),
          });
        }),
      { policy: 'both', embed: true },
    );
  }
  if (engine === 'chrome' && suite('pwa')) {
    for (const [policy, expected] of [
      ['none', 'worker-transfer'],
      ['both', 'worker-shared'],
    ]) {
      await pwa(values.demo, 'demo', policy, expected);
      if (values.testbed) await pwa(values.testbed, 'testbed', policy, expected);
    }
  }
  if (engine === 'chrome' && suite('resize')) await embeddedResize();
  if (engine === 'chrome' && suite('touch')) await touchScroll();
  if (engine === 'chrome' && suite('popup')) await externalPopup();
  if (values.dev && suite('strict')) await strictModeRemount();
  if (values.fixture && suite('scene')) {
    let reference;
    for (const [mode, expected] of [
      ['direct', 'direct'],
      ['worker-transfer', 'worker-transfer'],
      ['auto', 'worker-shared'],
    ]) {
      await serve(
        values.fixture,
        (root) =>
          tab(
            async (page) => {
              await page.goto(modeUrl(root, mode));
              await page.waitForFunction(() => {
                const scene = window.readRendererScene?.();
                return scene?.rendering.gpuRetired > 0 && scene?.readback;
              });
              const initial = await page.evaluate(() => window.readRendererScene());
              const frames = await page.evaluate(() => {
                window.drawLargeRendererScene();
                return window.readRendererScene().rendering.gpuRetired;
              });
              await page.waitForFunction(
                (frames) => window.readRendererScene().rendering.gpuRetired > frames,
                frames,
              );
              const result = await page.evaluate(() => window.readRendererScene());
              if (engine === 'chrome') assert.equal(result.rendering.path, expected);
              assert.deepEqual(result.readback, [212, 24, 36, 255]);
              assert.equal(result.contains, true);
              if (result.rendering.path === 'worker-shared') {
                assert.ok(result.rendering.sharedConsumed > 0);
                assert.ok(
                  result.rendering.buffersDetached > 0,
                  'Large frame should spill to a transfer buffer',
                );
                assert.equal(initial.rasterization.framePictureCompilations, 0);
                assert.equal(result.rasterization.framePictureCompilations, 0);
                assert.equal(initial.rendering.workerPictureCompilations, 2);
                assert.equal(result.rendering.workerPictureCompilations, 3);
                assert.equal(result.rendering.registrationWaits, 0);
              }
              const pixels = await screenshotPixels(page, appCanvas(page));
              const nestedPixels = await page.evaluate(() => window.readNestedRendererPixels());
              const scene = { pixels, geometry: result.geometry, nestedPixels };
              reference ??= scene;
              assert.deepEqual(scene, reference);
              if (mode === 'auto' && result.rendering.path === 'worker-shared') {
                const afterReadback = await page.evaluate(() => window.readRendererScene());
                assert.equal(afterReadback.rasterization.framePictureCompilations, 2);
                assert.ok(afterReadback.pictures.bytes > result.pictures.bytes);
                await checkCombinedRegistrations(page);
                const opened = page.waitForEvent('popup');
                await page.getByRole('button', { name: 'Open renderer dialog' }).click();
                const dialog = await opened;
                await onPath(dialog, 'direct');
                await screenshotPixels(dialog, dialog.locator('canvas'));
                await dialog.close();
                await page.waitForFunction(() => window.rendererDialogClosed);
                assert.equal(await page.evaluate(() => window.renderWorkers.length), 1);
                await checkSceneRecovery(page, pixels);
              }
              reports.push({ case: 'scene', mode, ...scene, ...result });
            },
            { fault: expected === 'worker-shared' ? 'trace-registration' : '' },
          ),
        { policy: 'both', faults: expected === 'worker-shared' },
      );
    }
    if (engine === 'chrome') await closeDuringStartup();
  }
  console.log('PASS Web renderer browser checks');
} finally {
  await browser.close();
  if (values.report)
    writeFileSync(
      resolve(values.report),
      JSON.stringify({ engine, version: browser.version(), gpu, reports }, null, 2) + '\n',
    );
}
