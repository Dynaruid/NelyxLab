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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execute = promisify(execFile);
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
test(
  'Windows published Widgets expose UIA text, paragraph bounds, focus, editing and invoke',
  { timeout },
  async () => {
    const host = new NativeProbe();
    try {
      const app = JSON.parse(
        (
          await host.until((line) => line.startsWith('V2_APP ') && line.includes('app-ready'))
        ).slice(7),
      );
      assert.ok(
        BigInt(app.queryWork) > 0n && app.widgets.builds > 0 && app.widgets.fallbacks === 0,
      );
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
    assert.ok(state.layoutWork > 0, 'The actual Testbed executes C++ layout');
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
    for (let i = 0; i < 6; ++i) {
      host.send('lazy-wheel 100');
      await sleep(60);
    }
    const lazy = await host.waitStats(
      (state) => state.lazyOffset > 200 && state.activeDocument > updated.activeDocument,
    );
    assert.ok(
      lazy.nodeCount < 220 && lazy.nativeCommands > updated.nativeCommands && lazy.fallbacks === 0,
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
    assert.ok(sought.nodeCount < 220 && sought.fallbacks === 0);
    const raw = JSON.parse(
      (
        await host.until(
          (line) => line.startsWith('V2_APP ') && line.includes('"kind":"raw-input"'),
        )
      ).slice(7),
    );
    assert.ok(BigInt(raw.publication) > 0n && raw.native);
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
      assert.ok(BigInt(state.app.queryWork) > 0n && state.app.widgets.builds > 0);
      assert.equal(state.app.query.contentHeight, 1498);
      assert.ok(render.counters.draws > 0);
      assert.ok(content.counters.paragraphs > 0 && content.counters.images > 0);
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
        String(state.app.commands + 1),
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
          new CompositionEvent('compositionend', { bubbles: true, data: '한' }),
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
      assert.equal(edited.nodes[0].editing.text, 'A😀한글', 'Composition is one Core undo group');
      await page.getByRole('button', { name: 'Update title', exact: true }).click();
      await page.waitForFunction(
        () => window.__v2.surface.diagnostics['render-stats'].state.activeDocument >= 3n,
      );
      assert.equal(await field.inputValue(), 'A😀한글', 'Widget rebuild preserves native editing');
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
      for (const name of ['Material selection', 'Cupertino selection']) {
        const control = page.getByRole('checkbox', { name });
        await control.click();
        await page.waitForFunction(
          (name) =>
            document.querySelector(`[aria-label="${name}"]`)?.getAttribute('aria-checked') ===
            'true',
          name,
        );
      }
      const slider = page.getByRole('slider', { name: 'Slider' });
      await slider.focus();
      await slider.press('ArrowRight');
      await page.waitForFunction(
        () =>
          Number(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')) > 0.25,
      );
      const nativeControl = await page.evaluate(() => {
        const r = window.__v2.surface.diagnostics['render-stats'];
        return { gestures: String(r.state.gestureWork), controls: String(r.state.controlWork) };
      });
      assert.ok(BigInt(nativeControl.gestures) > 0n && BigInt(nativeControl.controls) >= 3n);
      await page.evaluate(async () => {
        const s = window.__v2.surface;
        for (let i = 0; i < 6; ++i) {
          await s.input({ phase: 'update', source: 'wheelUnknown', x: 650, y: 420, dy: 100 });
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
      const closed = await page.evaluate(() => window.__v2.close());
      assert.equal(closed.reservedBytes, 0);
      assert.equal(closed.workersStopped, true);
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
