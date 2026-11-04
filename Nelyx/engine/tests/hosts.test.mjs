// SPDX-License-Identifier: BSD-3-Clause
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { packet, protocol } from '@nelyx/core/v2';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import { createHostServer } from '../tools/serve.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
before(
  () => {
    const directory = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(directory, 'engine-manifest.json')));
    assert.equal(
      manifest.sourceSha256,
      sourceIdentity(),
      'Build the current engine source before host tests',
    );
    for (const file of manifest.files)
      assert.equal(
        createHash('sha256')
          .update(fs.readFileSync(path.join(directory, file.path)))
          .digest('hex'),
        file.sha256,
        file.path,
      );
  },
  { timeout },
);
class NativeProbe {
  lines = [];
  errors = '';
  partial = '';
  constructor() {
    this.child = spawn(
      path.join(engineRoot, 'dist/native/NelyxEngineV2Host.exe'),
      [path.join(engineRoot, 'dist'), '--probe'],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
    );
    this.child.stdout.on('data', (bytes) => {
      this.partial += bytes;
      let end;
      while ((end = this.partial.indexOf('\n')) >= 0) {
        this.lines.push(this.partial.slice(0, end).trim());
        this.partial = this.partial.slice(end + 1);
        if (this.lines.length > 128) this.lines.shift();
      }
    });
    this.child.stderr.on('data', (bytes) => {
      this.errors = (this.errors + bytes).slice(-8192);
    });
    this.child.on('error', (error) => {
      this.errors += String(error);
    });
  }
  send(command) {
    this.child.stdin.write(command + '\n');
  }
  async until(predicate, limit = 15000) {
    const end = Date.now() + limit;
    while (Date.now() < end) {
      const found = this.lines.find(predicate);
      if (found) return found;
      if (this.errors || this.child.exitCode !== null)
        throw new Error(this.errors + '\n' + this.lines.join('\n'));
      await sleep(4);
    }
    throw new Error('Native probe timeout: ' + this.lines.join('\n'));
  }
  async stats() {
    const start = this.lines.length;
    this.send('stats');
    const line = await this.until((line, index) => index >= start && line.startsWith('V2_STATS '));
    return JSON.parse(line.slice(9));
  }
  async waitStats(predicate) {
    let latest;
    for (let i = 0; i < 30; ++i) {
      latest = await this.stats();
      if (predicate(latest)) return latest;
      await sleep(100);
    }
    assert.fail('Native state did not settle: ' + JSON.stringify(latest));
  }
  async close() {
    if (this.child.exitCode !== null) return;
    this.send('close');
    const deadline = setTimeout(() => this.child.kill(), 10000);
    try {
      await once(this.child, 'exit');
    } finally {
      clearTimeout(deadline);
    }
  }
}
test('Windows HWND, Hermes, Skia and distinct owners drain', { timeout }, async () => {
  const host = new NativeProbe();
  try {
    const app = JSON.parse(
      (await host.until((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))).slice(
        7,
      ),
    );
    await host.until((line) => line === 'V2_SCENE_PUBLISHED 1');
    const state = await host.stats();
    assert.equal(state.nativeCommands, app.commands);
    assert.equal(String(state.nativeCommands), app.engineWork);
    assert.equal(
      new Set([state.uiThread, state.appThread, state.contentThread, state.renderThread]).size,
      4,
    );
    assert.ok(state.paragraphs > 0 && state.images > 0 && state.frames > 0);
    assert.equal(state.fallbacks, 0);
    host.send('wheel 80');
    await sleep(60);
    const moved = await host.stats();
    assert.ok(moved.scrollOffset > state.scrollOffset);
    for (const owner of ['app', 'content'])
      for (const milliseconds of [50, 100, 200]) {
        const before = await host.stats(),
          start = host.lines.length;
        host.send('arm-input 24');
        host.send(`delay-${owner} ${milliseconds}`);
        await host.until(
          (line, index) =>
            index >= start &&
            (owner === 'app'
              ? line.includes('app-delay-start')
              : line.startsWith('V2_CONTENT_DELAY_START')),
        );
        const progress = JSON.parse(
          (
            await host.until((line, index) => index >= start && line.startsWith('V2_INPUT_FRAME '))
          ).slice(15),
        );
        assert.ok(
          progress.offset > before.scrollOffset,
          `${owner} ${milliseconds} ms stopped Render`,
        );
        assert.ok(
          progress.busyAtCompose & (owner === 'app' ? 1 : 2),
          `${owner} ${milliseconds} blocked C++ frame composition`,
        );
        console.log(
          'Native delay: ' +
            JSON.stringify({
              owner,
              milliseconds,
              composedDuring: true,
              completedDuring: !!(progress.busyAtCompletion & (owner === 'app' ? 1 : 2)),
            }),
        );
        await host.until(
          (line, index) =>
            index >= start &&
            (owner === 'app'
              ? line.includes('app-delay-end')
              : line.startsWith('V2_CONTENT_DELAY_END')),
        );
      }
    const resized = await host.stats();
    host.send('resize 840');
    await host.waitStats((state) => state.width === 840 && state.frames > resized.frames);
    host.send('minimize');
    const hidden = await host.waitStats((state) => !state.visible);
    await sleep(80);
    assert.equal((await host.stats()).frames, hidden.frames);
    host.send('restore');
    await host.waitStats(
      (state) =>
        state.visible &&
        state.width === 840 &&
        state.height === 720 &&
        state.frames > hidden.frames,
    );
    const prior = await host.stats();
    host.send('update');
    await host.until((line) => line === 'V2_SCENE_PUBLISHED 2');
    const updated = await host.stats();
    assert.equal(updated.nativeCommands, app.commands + 1);
    assert.equal(updated.scrollOffset, prior.scrollOffset);
    await sleep(1700);
    const idle = await host.stats();
    await sleep(80);
    assert.equal((await host.stats()).ticks, idle.ticks, 'Idle Render still ticks');
    console.log('Native host: ' + JSON.stringify(moved));
  } finally {
    await host.close();
  }
  const closed = JSON.parse(host.lines.find((line) => line.startsWith('V2_CLOSED ')).slice(10));
  assert.equal(closed.status, 0);
  assert.equal(closed.reservedBytes, 0);
  assert.equal(closed.workersJoined, true);
  assert.equal(host.child.exitCode, 0);
});

for (const [route, expected] of [
  ['plain', 'single-worker'],
  ['isolated', 'threaded'],
]) {
  test('Web ' + route + ' auto profile renders and drains', { timeout }, async () => {
    const server = createHostServer();
    let browser;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      browser = await chromium.launch({ headless: process.env.NELYX_V2_HEADFUL !== '1' });
      const page = await browser.newPage({ viewport: { width: 1024, height: 820 } }),
        errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(`http://127.0.0.1:${server.address().port}/${route}/`);
      await page.waitForFunction(
        () => window.__v2?.ready || window.__v2?.errors.length,
        {},
        { timeout: 30000 },
      );
      assert.deepEqual(
        await page.evaluate(() => window.__v2.errors),
        [],
        await page.locator('#error').textContent(),
      );
      assert.equal(await page.evaluate(() => window.__v2.surface.selectedProfile), expected);
      await page.waitForFunction(
        () =>
          window.__v2.surface.diagnostics['render-stats']?.state?.publication > 0n &&
          window.__v2.surface.diagnostics['render-stats']?.state?.activeDocument === 1n,
        {},
        { timeout: 10000 },
      );
      const state = await page.evaluate(() => ({
        app: window.__v2.appReady,
        stats: window.__v2.surface.diagnostics,
        isolation: crossOriginIsolated,
      }));
      assert.equal(state.isolation, route === 'isolated');
      const render = state.stats['render-stats'],
        content = state.stats['content-stats'];
      assert.equal(String(state.app.commands), state.app.engineWork);
      assert.equal(state.app.fallbacks, 0);
      assert.ok(render.counters.draws > 0);
      assert.ok(content.counters.paragraphs > 0 && content.counters.images > 0);
      assert.equal(render.gl.version, 2);
      if (route === 'isolated') {
        assert.notEqual(state.stats.content.thread, state.stats.render.thread);
        assert.equal(state.stats.content.providerShared, false);
      }
      const before = await page.locator('canvas').screenshot();
      await page.mouse.move(260, 340);
      await page.mouse.wheel(0, 120);
      await page.waitForFunction(
        () => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0] > 0,
        {},
        { timeout: 10000 },
      );
      const after = await page.locator('canvas').screenshot();
      assert.notDeepEqual(before, after);
      for (const owner of ['app', 'content'])
        for (const milliseconds of [50, 100, 200]) {
          const during = await page.evaluate(
            async ({ owner, milliseconds }) => {
              const instance = window.__v2,
                surface = instance.surface;
              const before = surface.diagnostics['render-stats'];
              const oldStart =
                owner === 'app'
                  ? instance.appEvents.filter((e) => e.kind === 'app-delay-start').length
                  : surface.diagnostics['delay-started']?.start;
              if (owner === 'app') instance.app.postMessage({ kind: 'delay', milliseconds });
              else surface.delayContent(milliseconds);
              const deadline = performance.now() + 3000;
              while (
                (owner === 'app'
                  ? instance.appEvents.filter((e) => e.kind === 'app-delay-start').length ===
                    oldStart
                  : surface.diagnostics['delay-started']?.start === oldStart) &&
                performance.now() < deadline
              )
                await new Promise((r) => setTimeout(r, 0));
              const start =
                owner === 'app'
                  ? instance.appEvents.filter((e) => e.kind === 'app-delay-start').at(-1).time
                  : surface.diagnostics['delay-started'].start;
              const input = surface.input({
                phase: 'update',
                source: 'wheelUnknown',
                x: 260,
                y: 300,
                dy: 24,
              });
              let moved = false,
                inDelay = false;
              while (performance.now() < deadline) {
                const render = surface.diagnostics['render-stats'];
                const ended =
                  owner === 'app'
                    ? instance.appEvents.some((e) => e.kind === 'app-delay-end' && e.time >= start)
                    : surface.diagnostics['delay-ended']?.end >= start;
                moved =
                  render.scrollOffsets[0] > before.scrollOffsets[0] &&
                  render.counters.draws > before.counters.draws;
                if (moved) {
                  inDelay = !ended;
                  break;
                }
                await new Promise((r) => setTimeout(r, 1));
              }
              await input;
              while (
                (owner === 'app'
                  ? !instance.appEvents.some((e) => e.kind === 'app-delay-end' && e.time >= start)
                  : !(surface.diagnostics['delay-ended']?.end >= start)) &&
                performance.now() < deadline
              )
                await new Promise((r) => setTimeout(r, 2));
              return { moved, inDelay };
            },
            { owner, milliseconds },
          );
          assert.equal(during.moved, true, `${owner} ${milliseconds} did not recover`);
          if (owner === 'app' || route === 'isolated')
            assert.equal(during.inDelay, true, `${owner} ${milliseconds} blocked Render`);
          else
            assert.equal(
              during.inDelay,
              false,
              'Single-worker must report cooperative Content execution',
            );
        }
      const burst = await page.evaluate(async () => {
        const surface = window.__v2.surface;
        const accepted = await Promise.all(
          Array.from({ length: 40 }, () =>
            surface.input({ phase: 'update', source: 'wheelUnknown', x: 260, y: 300, dy: 1 }),
          ),
        );
        await new Promise((r) => setTimeout(r, 30));
        return { accepted: accepted.filter(Boolean).length, ...surface.inputStats };
      });
      assert.ok(burst.accepted <= 24 && burst.rejected > 0 && burst.canceledStreams > 0);
      const recovered = await page.evaluate(async () => {
        const s = window.__v2.surface;
        const old = s.diagnostics['render-stats'].scrollOffsets[0];
        await s.input({ phase: 'update', source: 'wheelUnknown', x: 260, y: 300, dy: 12 });
        return old;
      });
      await page.waitForFunction(
        (old) => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0] > old,
        recovered,
      );
      const inputFence = await page.evaluate(
        async ({ bytes, offset }) => {
          const result = await window.__v2.surface.host.exchange(new Uint8Array(bytes));
          return new DataView(result.buffer, result.byteOffset, result.byteLength).getBigUint64(
            offset,
            true,
          );
        },
        {
          bytes: Array.from(
            packet(protocol.opcodes.inspect, { session: 1, app: 1, view: 1, generation: 1 }),
          ),
          offset: protocol.headerBytes + protocol.stateFields.lastInput,
        },
      );
      await page.waitForFunction(
        (sequence) =>
          window.__v2.surface.diagnostics['render-stats'].state.consumedThrough >= sequence,
        inputFence,
      );
      const previous = await page.evaluate(
        () => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0],
      );
      await page.getByRole('button', { name: 'Update content' }).click();
      await page.waitForFunction(
        () =>
          window.__v2.surface.diagnostics['render-stats'].state.activeDocument === 2n &&
          window.__v2.appEvents.some((e) => e.kind === 'app-updated'),
      );
      assert.equal(
        await page.evaluate(
          () => window.__v2.appEvents.find((e) => e.kind === 'app-updated').engineWork,
        ),
        '278',
      );
      assert.equal(
        await page.evaluate(() => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0]),
        previous,
      );
      const beforeResize = await page.evaluate(() => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return {
          metrics: r.state.metrics,
          scene: r.state.scene,
          publication: r.state.publication,
          draws: r.counters.draws,
        };
      });
      await page.locator('canvas').evaluate((canvas) => {
        canvas.style.width = '840px';
      });
      await page.waitForFunction((old) => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return (
          r.state.metrics > old.metrics &&
          r.state.scene > old.scene &&
          r.state.publication > old.publication &&
          r.counters.draws > old.draws
        );
      }, beforeResize);
      const beforeZero = await page.evaluate(
        () => window.__v2.surface.diagnostics['render-stats'].state.metrics,
      );
      await page.locator('canvas').evaluate((canvas) => {
        canvas.style.width = '0px';
        canvas.style.height = '0px';
      });
      await page.waitForFunction((old) => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return r.state.metrics > old && !r.state.renderWake;
      }, beforeZero);
      const zero = await page.evaluate(() => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return {
          metrics: r.state.metrics,
          scene: r.state.scene,
          publication: r.state.publication,
          draws: r.counters.draws,
        };
      });
      await page.waitForTimeout(80);
      assert.equal(
        await page.evaluate(() => window.__v2.surface.diagnostics['render-stats'].counters.draws),
        zero.draws,
      );
      await page.locator('canvas').evaluate((canvas) => {
        canvas.style.width = '960px';
        canvas.style.height = '720px';
      });
      await page.waitForFunction((old) => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return (
          r.state.metrics > old.metrics &&
          r.state.scene > old.scene &&
          r.state.publication > old.publication &&
          r.counters.draws > old.draws
        );
      }, zero);
      await page.waitForTimeout(1700);
      const idle = await page.evaluate(
        () => window.__v2.surface.diagnostics['render-stats'].counters.draws,
      );
      await page.waitForTimeout(80);
      assert.equal(
        await page.evaluate(() => window.__v2.surface.diagnostics['render-stats'].counters.draws),
        idle,
      );
      const closed = await page.evaluate(() => window.__v2.close());
      assert.equal(closed.reservedBytes, 0);
      assert.equal(closed.workersStopped, true);
      if (route === 'plain') {
        assert.equal(closed.provider.livePictures, 0);
        assert.equal(closed.provider.liveSurfaces, 0);
        assert.equal(closed.provider.fontBytes, 0);
        assert.equal(closed.provider.liveContexts, 0);
      } else
        for (const owner of ['contentClosed', 'renderClosed']) {
          assert.equal(closed.provider[owner].livePictures, 0);
          assert.equal(closed.provider[owner].liveSurfaces, 0);
          assert.equal(closed.provider[owner].fontBytes, 0);
          assert.equal(closed.provider[owner].liveContexts, 0);
        }
      assert.deepEqual(errors, []);
      console.log(
        'Web host: ' +
          JSON.stringify({
            profile: expected,
            gl: render.gl,
            commands: state.app.commands,
            paragraphs: content.counters.paragraphs,
            images: content.counters.images,
            closed: true,
          }),
      );
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
test(
  'Web startup rejects forced threading without isolation and invalid supply',
  { timeout },
  async () => {
    const server = createHostServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const base = `http://127.0.0.1:${server.address().port}`;
      for (const failure of ['threaded', 'schema', 'asset']) {
        const page = await browser.newPage();
        if (failure === 'schema')
          await page.route('**/engine-manifest.json', async (route) => {
            const result = await route.fetch(),
              body = await result.json();
            body.abi.schema ^= 1;
            await route.fulfill({ json: body });
          });
        if (failure === 'asset')
          await page.route('**/single-worker/engine-browser.wasm', (route) =>
            route.fulfill({ body: Buffer.from([0, 1, 2]) }),
          );
        await page.goto(base + '/plain/' + (failure === 'threaded' ? '?profile=threaded' : ''));
        await page.waitForFunction(() => window.__v2?.errors.length, {}, { timeout: 30000 });
        const errors = await page.evaluate(() => window.__v2.errors.join('\n'));
        assert.match(
          errors,
          failure === 'threaded'
            ? /isolation/
            : failure === 'schema'
              ? /schema mismatch/
              : /identity\/size mismatch/,
        );
        assert.equal(await page.evaluate(() => window.__v2.ready), false);
        await page.close();
      }
      const zero = await browser.newPage();
      await zero.route('**/plain/', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()).replace(
            'width:960px;height:720px;',
            'width:0px;height:0px;',
          ),
        });
      });
      await zero.goto(base + '/plain/');
      await zero.waitForFunction(() => window.__v2?.surface, {}, { timeout: 20000 });
      assert.equal(await zero.evaluate(() => window.__v2.surface.diagnostics.gl.version), 2);
      await zero.locator('canvas').evaluate((canvas) => {
        canvas.style.width = '960px';
        canvas.style.height = '720px';
      });
      await zero.waitForFunction(
        () =>
          window.__v2.ready &&
          window.__v2.surface.diagnostics['render-stats']?.state.activeDocument === 1n,
      );
      await zero.evaluate(() => window.__v2.close());
      await zero.close();
      const noGpu = await chromium.launch({
        headless: true,
        args: ['--disable-webgl', '--disable-webgl2', '--disable-software-rasterizer'],
      });
      try {
        const page = await noGpu.newPage();
        await page.goto(base + '/plain/');
        await page.waitForFunction(() => window.__v2?.errors.length, {}, { timeout: 20000 });
        assert.match(
          await page.evaluate(() => window.__v2.errors.join('\n')),
          /WebGL2.*unavailable/,
        );
        assert.equal(await page.evaluate(() => window.__v2.ready), false);
      } finally {
        await noGpu.close();
      }
    } finally {
      await browser?.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
