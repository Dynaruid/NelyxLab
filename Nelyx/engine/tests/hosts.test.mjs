// SPDX-License-Identifier: BSD-3-Clause
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from 'playwright';
import { packet, protocol, response, body, writeHandle, editBody } from '@nelyx/core/v2';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import { createHostServer } from '../tools/serve.mjs';
import { browserVisibilityContracts } from './browser-visibility.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execute = promisify(execFile);
function assertCppExecution(app) {
  assert.equal(app.execution.selected, 'engine-v2-cpp');
  assert.equal(app.execution.fallbackPolicy, 'reject-unported');
  assert.equal(app.execution.observed, true);
  assert.ok(app.execution.acknowledgedTransactions > 0);
  assert.equal(app.execution.acknowledgedCommands, app.commands);
  assert.equal(app.execution.rejectedFallbacks, 0);
}
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
  constructor(host = 'windows-hwnd') {
    this.child = spawn(
      path.join(
        engineRoot,
        host === 'windows-app-sdk'
          ? 'dist/windows-app-sdk/NelyxEngineAppSdkHost.exe'
          : 'dist/native/NelyxEngineV2Host.exe',
      ),
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
for (const hostKind of ['windows-hwnd', 'windows-app-sdk']) {
  test(
    `Windows ${hostKind} closes during startup and joins admitted owners`,
    { timeout },
    async () => {
      const host = new NativeProbe(hostKind);
      try {
        host.send('close');
        await host.until((line) => line.startsWith('V2_CLOSED '));
      } finally {
        await host.close();
      }
      const closed = JSON.parse(host.lines.find((line) => line.startsWith('V2_CLOSED ')).slice(10));
      assert.equal(closed.memoryTotal, 0);
      assert.equal(closed.workersJoined, true);
      assert.equal(host.child.exitCode, 0, host.errors);
    },
  );
  test(
    `Windows ${hostKind} published Widgets expose UIA text, paragraph bounds, focus, editing and invoke`,
    { timeout },
    async () => {
      const host = new NativeProbe(hostKind);
      try {
        const app = JSON.parse(
          (
            await host.until((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
          ).slice(7),
        );
        assert.ok(BigInt(app.queryWork) > 0n && app.widgets.builds > 0);
        assertCppExecution(app);
        const result = await execute(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-STA',
            '-File',
            path.join(engineRoot, 'tests/windows-interaction.ps1'),
            '-ProcessId',
            String(host.child.pid),
          ],
          { timeout, windowsHide: true, encoding: 'utf8' },
        );
        const value = JSON.parse(result.stdout.trim());
        assert.equal(value.utf16Length, 4);
        assert.equal(value.graphemesMoved, 2);
        assert.equal(value.pointerCaret, 1);
        assert.equal(value.controls, 3);
        assert.equal(value.keyboardGraphemes, true);
        assert.ok(value.rectangles > 0);
        const work = await host.waitStats((s) => s.nativeCommands === app.commands + 1);
        assert.ok(work.editingWork > 0 && work.semanticsWork > 0 && work.queryWork > 0);
        assert.ok(work.gestureWork > 0 && work.controlWork >= 3);
        assert.ok(app.lazy.built > 0 && app.lazy.peakItems <= 24 && app.lazy.itemCount === 2000);
        assert.equal(app.query.contentHeight, 1498);
        console.log('V2_NATIVE_INTERACTION ' + JSON.stringify(value));
        host.send('close');
        await host.until(
          (line) => line.startsWith('V2_CLOSED ') && line.includes('"reservedBytes":0'),
        );
      } finally {
        await host.close();
      }
    },
  );
  test(`Windows ${hostKind}, Hermes, Skia and distinct owners drain`, { timeout }, async () => {
    const host = new NativeProbe(hostKind);
    try {
      const app = JSON.parse(
        (
          await host.until((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
        ).slice(7),
      );
      await host.until((line) => line === 'V2_SCENE_PUBLISHED 1');
      const identity = JSON.parse(
        (await host.until((line) => line.startsWith('V2_WINDOWS_HOST '))).slice(16),
      );
      assert.equal(identity.host, hostKind);
      assert.equal(identity.dispatcherCallback, hostKind === 'windows-app-sdk');
      const state = await host.stats();
      assert.equal(state.nativeCommands, app.commands);
      assert.equal(String(state.nativeCommands), app.engineWork);
      assert.equal(
        new Set([state.uiThread, state.appThread, state.contentThread, state.renderThread]).size,
        4,
      );
      assert.ok(state.paragraphs > 0 && state.images > 0 && state.frames > 0);
      assert.equal(state.frameClock.source, 'dwm-composition-qpc');
      assert.equal(state.frameClock.status, 0);
      assert.equal(state.frameClock.monitorSpecific, false);
      assert.ok(state.frameClock.periodMs >= 1 && state.frameClock.periodMs <= 1000);
      assert.equal(state.timing.domain, 'qpc-seconds');
      assert.ok(
        state.timing.qpcFrequency > 0 &&
          state.timing.submission > 0 &&
          state.timing.publication > 0,
      );
      assert.ok(state.timing.completedAtSeconds >= state.timing.startedAtSeconds);
      assert.ok(state.frameClock.targetSeconds > state.timing.startedAtSeconds);
      for (const field of [
        'coreElapsedMs',
        'recordAndBackingElapsedMs',
        'submitElapsedMs',
        'publicationElapsedMs',
      ])
        assert.ok(state.timing[field] >= 0);
      assert.equal(state.timing.scanout, 'unobserved');
      assert.ok(
        state.contentTiming.preparation > 0 &&
          state.contentTiming.steps > 0 &&
          state.contentTiming.recordElapsedMs > 0,
      );
      assert.equal(state.contentTiming.failed, false);
      assert.ok(state.layoutWork > 0, 'The actual Testbed executes C++ layout');
      assertCppExecution(app);
      assert.equal(state.appExecutionObserved, true);
      assert.equal(state.appAcknowledgedCommands, app.commands);
      assert.equal(state.rejectedFallbacks, 0);
      assert.equal(app.nativeExtensions, 1);
      assert.ok(state.nativeExtensions > 0 && state.graphicsRecords > 0);
      assert.ok(
        state.memoryTotal > 0 &&
          state.memoryPeak <= protocol.limits.unifiedBytes &&
          state.memoryGpu > 0,
      );
      assert.ok(
        state.appHeapBytes > 0 && state.appHeapBytes < state.memoryTotal,
        'The actual Hermes heap and external buffers enter the shared ledger',
      );
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
              await host.until(
                (line, index) => index >= start && line.startsWith('V2_INPUT_FRAME '),
              )
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
      assert.ok(updated.reusedPictures - prior.reusedPictures >= 90);
      assert.ok(updated.reusedParagraphs - prior.reusedParagraphs >= 30);
      assert.equal(updated.reusedImages, prior.reusedImages + 1);
      assert.ok(
        updated.pictures - prior.pictures <= 4 &&
          updated.paragraphLayouts - prior.paragraphLayouts <= 3,
      );
      assert.ok(updated.cachedContentBytes > 0 && updated.cachedContentBytes <= 16 * 1024 * 1024);
      console.log(
        'V2_PREPARATION_REUSE ' +
          JSON.stringify({
            host: hostKind,
            records: updated.pictures - prior.pictures,
            reused: updated.reusedPictures - prior.reusedPictures,
            paragraphLayouts: updated.paragraphLayouts - prior.paragraphLayouts,
            imageDecodes: updated.images - prior.images,
            nativeCommands: updated.nativeCommands - prior.nativeCommands,
          }),
      );
      await sleep(1700);
      const idle = await host.stats();
      await sleep(80);
      assert.equal((await host.stats()).ticks, idle.ticks, 'Idle Render still ticks');
      for (let i = 0; i < 6; ++i) {
        host.send('lazy-wheel 100');
        await sleep(60);
      }
      const lazy = await host.waitStats(
        (state) => state.lazyOffset > 200 && state.activeDocument > updated.activeDocument,
      );
      assert.ok(
        lazy.nodeCount < 220 &&
          lazy.nativeCommands > updated.nativeCommands &&
          lazy.rejectedFallbacks === 0,
      );
      console.log(
        'V2_NATIVE_LAZY ' +
          JSON.stringify({
            offset: lazy.lazyOffset,
            nodes: lazy.nodeCount,
            commands: lazy.nativeCommands,
          }),
      );
      host.send('seek 1500');
      const sought = await host.waitStats((state) => state.lazyOffset > 70000);
      assert.ok(sought.nodeCount < 220 && sought.rejectedFallbacks === 0);
      const raw = JSON.parse(
        (
          await host.until(
            (line) => line.startsWith('V2_APP ') && line.includes('"kind":"raw-input"'),
          )
        ).slice(7),
      );
      assert.ok(BigInt(raw.publication) > 0n && raw.native);
      host.send('memory-pressure 1');
      const pressured = await host.waitStats(
        (s) =>
          s.memoryPressure.effectiveLow &&
          s.memoryPressure.contentEpoch === s.memoryPressure.epoch &&
          s.memoryPressure.renderEpoch === s.memoryPressure.epoch &&
          s.cachedContentBytes === 0,
      );
      assert.equal(pressured.memoryPressure.source, 'windows-resource-notification');
      assert.equal(pressured.memoryPressure.probeLow, true);
      assert.equal(pressured.memoryPressure.gpuCacheLimitBytes, 4 * 1024 * 1024);
      host.send('wheel -8');
      await host.waitStats(
        (s) => s.frames > pressured.frames && s.scrollOffset < pressured.scrollOffset,
      );
      host.send('memory-pressure 0');
      const normal = await host.waitStats(
        (s) =>
          !s.memoryPressure.effectiveLow &&
          s.memoryPressure.contentEpoch === s.memoryPressure.epoch &&
          s.memoryPressure.renderEpoch === s.memoryPressure.epoch,
      );
      host.send('update');
      const recovered = await host.waitStats(
        (s) => s.activeDocument > normal.activeDocument && s.cachedContentBytes > 0,
      );
      assert.ok(
        recovered.memoryPeak <= protocol.limits.unifiedBytes && recovered.rejectedFallbacks === 0,
      );
      console.log(
        'V2_MEMORY_PRESSURE ' +
          JSON.stringify({
            host: hostKind,
            osSignalObserved: pressured.memoryPressure.osLow,
            probe: true,
            activeInputSurvived: true,
            admissionRecovered: true,
            cachedBytes: recovered.cachedContentBytes,
          }),
      );
      console.log('Native host: ' + JSON.stringify(moved));
    } finally {
      await host.close();
    }
    const closed = JSON.parse(host.lines.find((line) => line.startsWith('V2_CLOSED ')).slice(10));
    assert.equal(closed.status, 0);
    assert.equal(closed.reservedBytes, 0);
    assert.equal(closed.memoryTotal, 0);
    assert.ok(
      host.lines.some((line) => line.includes('"kind":"app-disposed"')),
      'The Testbed App disposes before native providers stop',
    );
    assert.equal(closed.workersJoined, true);
    assert.equal(host.child.exitCode, 0, host.lines.join('\n') + '\n' + host.errors);
    if (hostKind === 'windows-app-sdk')
      assert.ok(host.lines.includes('V2_WINDOWS_DISPATCHER_CLOSED'));
  });
}

for (const channel of ['chromium', 'chrome', 'msedge']) {
  for (const [route, expected] of [
    ['plain', 'single-worker'],
    ['isolated', 'threaded'],
  ]) {
    test(
      'Web ' + channel + ' ' + route + ' auto profile renders and drains',
      { timeout },
      async () => {
        const server = createHostServer();
        let browser;
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
          browser = await chromium.launch({
            headless: process.env.NELYX_V2_HEADFUL !== '1',
            ...(channel === 'chromium' ? {} : { channel }),
          });
          const context = await browser.newContext({
              viewport: { width: 1024, height: 820 },
            }),
            page = await context.newPage(),
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
          assertCppExecution(state.app);
          assert.ok(BigInt(state.app.queryWork) > 0n && state.app.widgets.builds > 0);
          assert.equal(state.app.query.contentHeight, 1498);
          assert.ok(render.counters.draws > 0);
          assert.ok(
            ['worker-raf', 'main-raf'].includes(render.frameClock.source),
            JSON.stringify(render.frameClock),
          );
          if (render.frameClock.source === 'main-raf') {
            assert.ok(state.stats.frameClockMain.callbacks > 0);
            assert.equal(
              render.frameClock.callbackTimeOriginMs,
              await page.evaluate(() => performance.timeOrigin),
            );
            assert.equal(render.frameClock.fallbackReason, 'worker-raf-not-supported');
          } else assert.equal(render.frameClock.fallbackReason, null);
          assert.ok(render.frameClock.callbacks > 0 && render.frameClock.timeOriginMs > 0);
          assert.ok(render.frameClock.callbackTimestampMs >= 0);
          assert.equal(render.timing.domain, 'owner-performance');
          assert.equal(render.timing.scanout, 'unobserved');
          assert.ok(render.timing.completedAtMs >= render.timing.startedAtMs);
          assert.ok(content.timing.preparation > 0n && content.timing.steps > 0);
          assert.ok(content.timing.recordElapsedMs >= 0 && content.timing.nativeLayoutWork > 0n);
          assert.ok(content.counters.paragraphs > 0 && content.counters.images > 0);
          assert.equal(state.app.nativeExtensions, 1);
          assert.ok(content.counters.nativeExtensions > 0 && content.counters.graphicsRecords > 0);
          assert.ok(
            render.state.memory.providerHeap > 0n &&
              render.state.memory.gpu > 0n &&
              render.state.memory.peak <= render.state.memory.limit,
          );
          assert.ok(render.state.layoutWork > 0n, 'The actual Testbed executes C++ layout');
          assert.ok(content.counters.measurements > 0);
          assert.equal(content.textCapabilities.lineIndexUnit, 'utf8');
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
                        ? instance.appEvents.some(
                            (e) => e.kind === 'app-delay-end' && e.time >= start,
                          )
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
                      ? !instance.appEvents.some(
                          (e) => e.kind === 'app-delay-end' && e.time >= start,
                        )
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
                surface.input({
                  phase: 'update',
                  source: 'wheelUnknown',
                  x: 260,
                  y: 300,
                  dy: 1,
                }),
              ),
            );
            await new Promise((r) => setTimeout(r, 30));
            return {
              accepted: accepted.filter(Boolean).length,
              ...surface.inputStats,
            };
          });
          assert.ok(burst.accepted <= 24 && burst.rejected > 0 && burst.canceledStreams > 0);
          const recovered = await page.evaluate(async () => {
            const s = window.__v2.surface;
            const old = s.diagnostics['render-stats'].scrollOffsets[0];
            await s.input({
              phase: 'update',
              source: 'wheelUnknown',
              x: 260,
              y: 300,
              dy: 12,
            });
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
                packet(protocol.opcodes.inspect, {
                  session: 1,
                  app: 1,
                  view: 1,
                  generation: 1,
                }),
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
          const priorContent = await page.evaluate(() => ({
            ...window.__v2.surface.diagnostics['content-stats'].counters,
          }));
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
            String(state.app.commands + 1),
          );
          assert.equal(
            await page.evaluate(
              () => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0],
            ),
            previous,
          );
          await page.waitForFunction(
            (before) =>
              window.__v2.surface.diagnostics['content-stats'].counters.reusedPictures >
              before.reusedPictures,
            priorContent,
          );
          const reusedContent = await page.evaluate(() => ({
            ...window.__v2.surface.diagnostics['content-stats'].counters,
          }));
          assert.ok(reusedContent.reusedPictures - priorContent.reusedPictures >= 90);
          assert.ok(reusedContent.reusedParagraphs - priorContent.reusedParagraphs >= 30);
          assert.equal(reusedContent.images, priorContent.images);
          assert.ok(
            reusedContent.pictures - priorContent.pictures <= 4 &&
              reusedContent.paragraphLayouts - priorContent.paragraphLayouts <= 3,
          );
          console.log(
            'V2_PREPARATION_REUSE ' +
              JSON.stringify({
                browser: channel,
                profile: route,
                records: reusedContent.pictures - priorContent.pictures,
                reused: reusedContent.reusedPictures - priorContent.reusedPictures,
                paragraphLayouts: reusedContent.paragraphLayouts - priorContent.paragraphLayouts,
                imageDecodes: reusedContent.images - priorContent.images,
                nativeCommands: 1,
              }),
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
            await page.evaluate(
              () => window.__v2.surface.diagnostics['render-stats'].counters.draws,
            ),
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
            await page.evaluate(
              () => window.__v2.surface.diagnostics['render-stats'].counters.draws,
            ),
            idle,
          );
          const field = page.getByRole('textbox', { name: '입력' });
          await field.fill('A😀한글');
          const handle = await field.getAttribute('data-nelyx-node');
          const [slot, generation] = handle.split(':').map(Number);
          const readEditor = async () =>
            response(
              new Uint8Array(
                await page.evaluate(
                  async (bytes) =>
                    Array.from(await window.__v2.surface.host.exchange(new Uint8Array(bytes))),
                  Array.from(
                    packet(
                      protocol.opcodes.editSnapshot,
                      { session: 1, app: 1, view: 1, generation: 1 },
                      body(8, (v) => writeHandle(v, 0, { slot, generation })),
                    ),
                  ),
                ),
              ),
            );
          let edited;
          for (let i = 0; i < 30; ++i) {
            edited = await readEditor();
            if (edited.nodes[0]?.editing?.text === 'A😀한글') break;
            await page.waitForTimeout(20);
          }
          assert.equal(edited.nodes[0].editing.text, 'A😀한글');
          assert.ok(edited.editingWork > 0n);
          const during = await page.evaluate(async () => {
            const app = window.__v2.app,
              events = window.__v2.appEvents,
              previous = events.filter((e) => e.kind === 'app-delay-start').at(-1)?.time;
            app.postMessage({ kind: 'delay', milliseconds: 200 });
            const end = performance.now() + 2000;
            while (
              events.filter((e) => e.kind === 'app-delay-start').at(-1)?.time === previous &&
              performance.now() < end
            )
              await new Promise((r) => setTimeout(r, 2));
            const element = document.querySelector('[data-nelyx-v2-semantics] textarea');
            element.setSelectionRange(element.value.length, element.value.length);
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            const prefix = element.value;
            for (const part of ['ㅎ', '한']) {
              element.value = prefix + part;
              element.setSelectionRange(element.value.length, element.value.length);
              element.dispatchEvent(
                new InputEvent('input', {
                  bubbles: true,
                  inputType: 'insertCompositionText',
                  data: part,
                  isComposing: true,
                }),
              );
            }
            element.dispatchEvent(
              new CompositionEvent('compositionend', {
                bubbles: true,
                data: '한',
              }),
            );
            return events.filter((e) => e.kind === 'app-delay-start').at(-1)?.time;
          });
          for (let i = 0; i < 30; ++i) {
            edited = await readEditor();
            if (
              edited.nodes[0]?.editing?.text === 'A😀한글한' &&
              edited.nodes[0].editing.composingStart === -1
            )
              break;
            await page.waitForTimeout(10);
          }
          assert.equal(edited.nodes[0].editing.text, 'A😀한글한');
          assert.equal(edited.nodes[0].editing.composingStart, -1);
          const ended = await page.evaluate(
            () => window.__v2.appEvents.filter((e) => e.kind === 'app-delay-end').at(-1)?.time ?? 0,
          );
          assert.ok(ended < during, 'Core editing progresses while the App worker is busy');
          await field.evaluate((element) =>
            element.dispatchEvent(
              new InputEvent('beforeinput', {
                inputType: 'historyUndo',
                bubbles: true,
                cancelable: true,
              }),
            ),
          );
          for (let i = 0; i < 30; ++i) {
            edited = await readEditor();
            if (edited.nodes[0]?.editing?.text === 'A😀한글') break;
            await page.waitForTimeout(20);
          }
          assert.equal(
            edited.nodes[0].editing.text,
            'A😀한글',
            'Composition is one Core undo group',
          );
          await page.evaluate(() => {
            window.__v2.clickTrace = [];
            for (const kind of ['pointerdown', 'pointerup', 'click'])
              document.addEventListener(
                kind,
                (event) => {
                  const target = event.target,
                    canvas = document.querySelector('canvas'),
                    button = document.querySelector('[aria-label="Update title"]');
                  const rect = (element) => {
                    const r = element.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                  };
                  const records = window.__v2.clickTrace;
                  records.push({
                    kind,
                    x: event.clientX,
                    y: event.clientY,
                    target: target.tagName,
                    label: target.getAttribute('aria-label'),
                    canvas: rect(canvas),
                    button: rect(button),
                    input: { ...window.__v2.surface.inputStats },
                  });
                  if (records.length > 6) records.shift();
                },
                { capture: true },
              );
          });
          await page.getByRole('button', { name: 'Update title', exact: true }).click();
          try {
            await page.waitForFunction(
              () => window.__v2.surface.diagnostics['render-stats'].state.activeDocument >= 3n,
            );
          } catch (error) {
            const diagnostic = await page.evaluate(() => {
              const current = window.__v2,
                render = current.surface.diagnostics['render-stats'],
                content = current.surface.diagnostics['content-stats'];
              return {
                errors: current.errors,
                events: current.appEvents.map((value) => ({
                  kind: value.kind,
                  message: value.message,
                })),
                state: render.state,
                clock: render.frameClock,
                content: content?.timing,
                viewport: [
                  document.visibilityState,
                  document.querySelector('canvas').clientWidth,
                  document.querySelector('canvas').clientHeight,
                ],
                clickTrace: current.clickTrace,
                inputStats: current.surface.inputStats,
              };
            });
            assert.fail(
              String(error) +
                JSON.stringify({ domExceptions: errors }) +
                '\n' +
                JSON.stringify(diagnostic, (_key, value) =>
                  typeof value === 'bigint' ? String(value) : value,
                ),
            );
          }
          assert.equal(
            await field.inputValue(),
            'A😀한글',
            'Widget rebuild preserves native editing',
          );
          assert.equal((await readEditor()).nodes[0].editing.text, 'A😀한글');
          // The App port must await the browser acknowledgement, with immutable retry identity.
          await field.focus();
          await field.evaluate((element) =>
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
          );
          for (let i = 0; i < 30; ++i) {
            edited = await readEditor();
            if (edited.nodes[0].editing.composingStart >= 0) break;
            await page.waitForTimeout(10);
          }
          assert.ok(edited.nodes[0].editing.composingStart >= 0);
          await page.waitForTimeout(50);
          edited = await readEditor();
          const forcedPacket = packet(
            protocol.opcodes.edit,
            { session: 1, app: 1, view: 1, generation: 1 },
            editBody(
              { slot, generation },
              {
                kind: 'replace',
                revision: edited.nodes[0].editing.revision,
                session: edited.focus.session,
                text: '확정😀',
                base: 4,
                extent: 4,
                policy: 'commit',
              },
            ),
            701n,
          );
          const forced = await page.evaluate(async (bytes) => {
            const port = window.__v2.surface.createAppPort();
            port.start();
            let next = 0;
            const callbacks = new Map();
            port.addEventListener('message', (event) => {
              const done = callbacks.get(event.data.id);
              if (done) {
                callbacks.delete(event.data.id);
                done(event.data.bytes);
              }
            });
            const send = (payload = bytes) =>
              new Promise((resolve, reject) => {
                const id = ++next,
                  data = new Uint8Array(payload),
                  timer = setTimeout(
                    () => reject(new Error('App composition command did not settle')),
                    5000,
                  );
                callbacks.set(id, (value) => {
                  clearTimeout(timer);
                  resolve(value);
                });
                port.postMessage({ kind: 'packet', id, bytes: data.buffer }, [data.buffer]);
              });
            let settled = false;
            const pending = send().then((value) => {
              settled = true;
              return value;
            });
            await new Promise((resolve) => setTimeout(resolve, 40));
            const waited = !settled;
            document
              .querySelector('textarea')
              .dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
            const result = Array.from(new Uint8Array(await pending)),
              retry = Array.from(new Uint8Array(await send()));
            const changed = bytes.slice();
            changed[changed.length - 1] ^= 1;
            const reused = Array.from(new Uint8Array(await send(changed)));
            port.close();
            return { waited, result, retry, reused };
          }, Array.from(forcedPacket));
          assert.equal(forced.waited, true);
          assert.deepEqual(forced.retry, forced.result);
          assert.equal(response(new Uint8Array(forced.reused)).status, protocol.statuses.idReused);
          assert.equal(response(new Uint8Array(forced.result)).status, protocol.statuses.ok);
          assert.equal((await readEditor()).nodes[0].editing.text, '확정😀');
          await field.focus();
          await field.evaluate((element) =>
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
          );
          for (let i = 0; i < 30; ++i) {
            edited = await readEditor();
            if (edited.nodes[0].editing.composingStart >= 0) break;
            await page.waitForTimeout(10);
          }
          await page.waitForTimeout(50);
          edited = await readEditor();
          const cancelPacket = packet(
            protocol.opcodes.edit,
            { session: 1, app: 1, view: 1, generation: 1 },
            editBody(
              { slot, generation },
              {
                kind: 'replace',
                revision: edited.nodes[0].editing.revision,
                session: edited.focus.session,
                text: 'no acknowledgement',
                base: 0,
                extent: 0,
                policy: 'cancel',
              },
            ),
            702n,
          );
          const expired = await page.evaluate(async (bytes) => {
            const port = window.__v2.surface.createAppPort();
            port.start();
            try {
              return await new Promise((resolve, reject) => {
                const timer = setTimeout(
                  () => reject(new Error('Unacknowledged composition did not expire')),
                  5000,
                );
                port.addEventListener(
                  'message',
                  (event) => {
                    clearTimeout(timer);
                    if (event.data.error) reject(new Error(event.data.error));
                    else resolve(Array.from(new Uint8Array(event.data.bytes)));
                  },
                  { once: true },
                );
                const data = new Uint8Array(bytes);
                port.postMessage({ kind: 'packet', id: 1, bytes: data.buffer }, [data.buffer]);
              });
            } finally {
              port.close();
            }
          }, Array.from(cancelPacket));
          assert.equal(response(new Uint8Array(expired)).status, protocol.statuses.timedOut);
          assert.equal(
            (await readEditor()).nodes[0].editing.text,
            '확정😀',
            'No OS acknowledgement means no replacement',
          );
          await field.evaluate((element) =>
            element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })),
          );
          await page.evaluate((p) => {
            const trace = (window.__v2.packetTrace = []),
              pending = new Map(),
              subscribed = new WeakSet();
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (value, ...options) {
              if (value?.kind === 'viewport') {
                trace.push({
                  kind: 'viewport',
                  visible: value.viewport.visible,
                  focused: value.viewport.focused,
                });
                if (trace.length > 16) pending.delete(trace.shift().id);
              }
              if (value?.kind === 'packet' && value.bytes instanceof ArrayBuffer) {
                const bytes = new DataView(value.bytes),
                  base = p.headerBytes;
                if (bytes.getUint16(p.headerFields.opcode, true) === p.opcodes.input) {
                  if (!subscribed.has(this)) {
                    subscribed.add(this);
                    this.addEventListener('message', (event) => {
                      const record = pending.get(event.data.id);
                      if (event.data.kind !== 'packet-result' || !record) return;
                      pending.delete(event.data.id);
                      if (event.data.bytes) {
                        const result = new DataView(event.data.bytes);
                        record.result = {
                          status: result.getUint16(p.headerFields.status, true),
                          flags: result.getUint32(base + p.stateFields.flags, true),
                          metrics: String(result.getBigUint64(base + p.stateFields.metrics, true)),
                          publication: String(
                            result.getBigUint64(base + p.stateFields.publication, true),
                          ),
                        };
                      } else record.error = event.data.error;
                    });
                  }
                  const record = {
                    id: value.id,
                    phase: bytes.getUint32(base + p.inputFields.phase, true),
                    stream: bytes.getUint32(base + p.inputFields.stream, true),
                    sequence: String(bytes.getBigUint64(base + p.inputFields.sequence, true)),
                    metrics: String(bytes.getBigUint64(base + p.inputFields.metrics, true)),
                    publication: String(bytes.getBigUint64(base + p.inputFields.publication, true)),
                    flags: bytes.getUint32(base + p.inputFields.flags, true),
                  };
                  trace.push(record);
                  pending.set(value.id, record);
                  if (trace.length > 16) pending.delete(trace.shift().id);
                }
              }
              return Reflect.apply(post, this, [value, ...options]);
            };
          }, protocol);
          for (const name of ['Material selection', 'Cupertino selection']) {
            const control = page.getByRole('checkbox', { name });
            const beforeControl = await page.evaluate(() => ({
              state: window.__v2.surface.diagnostics['render-stats'].state,
              input: { ...window.__v2.surface.inputStats },
            }));
            await control.click();
            try {
              await page.waitForFunction(
                (name) =>
                  document.querySelector(`[aria-label="${name}"]`)?.getAttribute('aria-checked') ===
                  'true',
                name,
              );
            } catch (error) {
              const diagnostic = await page.evaluate(() => ({
                state: window.__v2.surface.diagnostics['render-stats'].state,
                input: window.__v2.surface.inputStats,
                errors: window.__v2.errors,
                clickTrace: window.__v2.clickTrace,
                packetTrace: window.__v2.packetTrace,
                active: document.activeElement?.outerHTML,
                controls: [...document.querySelectorAll('[role="checkbox"]')].map((element) => ({
                  label: element.getAttribute('aria-label'),
                  checked: element.getAttribute('aria-checked'),
                  bounds: element.getBoundingClientRect().toJSON(),
                })),
              }));
              assert.fail(
                String(error) +
                  '\n' +
                  JSON.stringify({ name, beforeControl, diagnostic }, (_key, value) =>
                    typeof value === 'bigint' ? String(value) : value,
                  ),
              );
            }
          }
          const slider = page.getByRole('slider', { name: 'Slider' });
          await slider.focus();
          await slider.press('ArrowRight');
          await page.waitForFunction(
            () =>
              Number(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')) >
              0.25,
          );
          const nativeControl = await page.evaluate(() => {
            const r = window.__v2.surface.diagnostics['render-stats'];
            return {
              gestures: String(r.state.gestureWork),
              controls: String(r.state.controlWork),
            };
          });
          assert.ok(BigInt(nativeControl.gestures) > 0n && BigInt(nativeControl.controls) >= 3n);
          await page.evaluate(async () => {
            const s = window.__v2.surface;
            for (let i = 0; i < 6; ++i) {
              await s.input({
                phase: 'update',
                source: 'wheelUnknown',
                x: 650,
                y: 420,
                dy: 100,
              });
              await new Promise((r) => setTimeout(r, 60));
            }
          });
          await page.waitForFunction(
            () => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[1] > 200,
          );
          assert.ok(
            (await page.evaluate(
              () => window.__v2.surface.diagnostics['render-stats'].state.nodeCount,
            )) < 220,
            '2000 lazy rows remain bounded',
          );
          await page.evaluate(() => window.__v2.app.postMessage({ kind: 'seek', index: 1500 }));
          await page.waitForFunction(
            () => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[1] > 70000,
          );
          assert.ok(
            (await page.evaluate(
              () => window.__v2.surface.diagnostics['render-stats'].state.nodeCount,
            )) < 220,
          );
          assert.ok(
            await page.evaluate(() =>
              window.__v2.appEvents.some(
                (event) => event.kind === 'raw-input' && BigInt(event.publication) > 0n,
              ),
            ),
          );
          await page.evaluate(() => window.__v2.surface.setMemoryPressure(true));
          await page.waitForFunction(
            () => window.__v2.surface.diagnostics['memory-pressure']?.low === true,
          );
          const pressure = await page.evaluate(
            () => window.__v2.surface.diagnostics['memory-pressure'],
          );
          assert.equal(pressure.owners.length, route === 'plain' ? 1 : 2);
          assert.ok(
            pressure.owners.every(
              (o) =>
                o.counters.cachedContentBytes === 0 &&
                o.counters.memoryPressure &&
                o.counters.gpuCacheLimitBytes === 4 * 1024 * 1024,
            ),
          );
          const pressureOffset = await page.evaluate(async () => {
            const s = window.__v2.surface,
              old = s.diagnostics['render-stats'].scrollOffsets[0];
            const admitted = await s.input({
              phase: 'update',
              source: 'wheelUnknown',
              x: 260,
              y: 300,
              dy: old >= 8 ? -8 : 8,
            });
            return { old, admitted };
          });
          assert.equal(pressureOffset.admitted, true);
          await page.waitForFunction(
            (old) => window.__v2.surface.diagnostics['render-stats'].scrollOffsets[0] !== old,
            pressureOffset.old,
          );
          await page.evaluate(() => {
            const s = window.__v2.surface;
            s.setMemoryPressure(false);
            s.setMemoryPressure(true);
            s.setMemoryPressure(false);
          });
          await page.waitForFunction(
            () => window.__v2.surface.diagnostics['memory-pressure']?.low === false,
          );
          const normalPressure = await page.evaluate(
            () => window.__v2.surface.diagnostics['memory-pressure'],
          );
          assert.ok(
            normalPressure.revision <= pressure.revision + 2,
            'Pressure changes keep one in-flight control and coalesce the latest policy',
          );
          const beforePressureRebuild = await page.evaluate(
            () => window.__v2.surface.diagnostics['render-stats'].state.activeDocument,
          );
          await page.evaluate(() => window.__v2.app.postMessage({ kind: 'update' }));
          await page.waitForFunction(
            (old) =>
              window.__v2.surface.diagnostics['render-stats'].state.activeDocument > old &&
              window.__v2.surface.diagnostics['content-stats'].counters.cachedContentBytes > 0,
            beforePressureRebuild,
          );
          console.log(
            'V2_MEMORY_PRESSURE ' +
              JSON.stringify({
                browser: channel,
                profile: route,
                source: pressure.source,
                owners: pressure.owners.length,
                activeInputSurvived: true,
                admissionRecovered: true,
              }),
          );
          const closed = await page.evaluate(() => window.__v2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          assert.equal(closed.frameClock.outstanding, 0);
          assert.ok(['worker-raf', 'main-raf'].includes(closed.frameClock.source));
          assert.equal(
            (await page.evaluate(() => window.__v2.surface.diagnostics.frameClockMain)).outstanding,
            0,
          );
          if (route === 'plain') {
            assert.equal(closed.provider.livePictures, 0);
            assert.equal(closed.provider.liveSurfaces, 0);
            assert.equal(closed.provider.fontBytes, 0);
            assert.equal(closed.provider.liveContexts, 0);
            assert.equal(closed.provider.liveParagraphs, 0);
          } else
            for (const owner of ['contentClosed', 'renderClosed']) {
              assert.equal(closed.provider[owner].livePictures, 0);
              assert.equal(closed.provider[owner].liveSurfaces, 0);
              assert.equal(closed.provider[owner].fontBytes, 0);
              assert.equal(closed.provider[owner].liveContexts, 0);
              assert.equal(closed.provider[owner].liveParagraphs, 0);
            }
          assert.deepEqual(errors, []);
          console.log(
            'Web host: ' +
              JSON.stringify({
                browser: channel,
                version: browser.version(),
                headless: process.env.NELYX_V2_HEADFUL !== '1',
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
      },
    );
  }
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
      for (const failure of [
        'threaded',
        'schema',
        'asset',
        'paragraph-metadata',
        'paragraph-capability',
        'picture-metadata',
        'picture-capability',
        'font-metadata',
        'font-version',
        'font-capability',
      ]) {
        const page = await browser.newPage();
        if (failure.endsWith('-metadata'))
          await page.route('**/engine-manifest.json', async (route) => {
            const result = await route.fetch(),
              manifest = await result.json();
            if (failure === 'picture-metadata') manifest.canvasKit.pictureApiVersion = 0;
            else if (failure === 'font-metadata') manifest.canvasKit.fontApiVersion = 0;
            else manifest.canvasKit.paragraphApiVersion = 0;
            await route.fulfill({ json: manifest });
          });
        if (failure.endsWith('-capability') || failure === 'font-version') {
          const js = Buffer.concat([
              fs.readFileSync(path.join(engineRoot, 'dist/canvaskit/canvaskit.js')),
              Buffer.from(
                '\nvar __nelyxOriginalFactory=CanvasKitInit;CanvasKitInit=async function(options){var module=await __nelyxOriginalFactory(options);module.' +
                  (failure === 'picture-capability'
                    ? 'nelyxMakePicture'
                    : failure === 'font-capability'
                      ? 'nelyxMakeFontProvider'
                      : failure === 'font-version'
                        ? 'nelyxFontApiVersion'
                        : 'nelyxParagraphApiVersion') +
                  '=undefined;return module;};\n',
              ),
            ]),
            digest = (bytes) => createHash('sha256').update(bytes).digest('hex'),
            supplied = JSON.parse(
              fs.readFileSync(path.join(engineRoot, 'dist/canvaskit/native-manifest.json')),
            );
          supplied.files.find((file) => file.id === 'canvaskit.js').sha256 = digest(js);
          const source = Buffer.from(JSON.stringify(supplied));
          await page.route('**/engine-manifest.json', async (route) => {
            const result = await route.fetch(),
              manifest = await result.json();
            manifest.files.find((file) => file.path === manifest.canvasKit.js).sha256 = digest(js);
            manifest.files.find((file) => file.path === manifest.canvasKit.sourceManifest).sha256 =
              digest(source);
            await route.fulfill({ json: manifest });
          });
          await page.route('**/canvaskit/canvaskit.js', (route) =>
            route.fulfill({ body: js, contentType: 'text/javascript' }),
          );
          await page.route('**/canvaskit/native-manifest.json', (route) =>
            route.fulfill({ body: source, contentType: 'application/json' }),
          );
        }
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
              : failure.endsWith('-metadata')
                ? /CanvasKit supplier differs/
                : failure.endsWith('-capability') || failure === 'font-version'
                  ? /Owned CanvasKit paragraph\/graphics capability missing/
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
browserVisibilityContracts();
