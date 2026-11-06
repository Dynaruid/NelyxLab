// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import { packet, response, protocol as p } from '@nelyx/core/v2';
import { sourceIdentity, timeout } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import {
  originalSliderFixture,
  originalMaterialSliderFixture,
} from './original-slider-fixture.mjs';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function native(page, op = p.opcodes.semanticsSnapshot) {
  const bytes = await page.evaluate(
    async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
    Array.from(packet(op, owner)),
  );
  const result = response(new Uint8Array(bytes));
  assert.equal(result.status, p.statuses.ok);
  return result;
}
async function settled(page, accepts = () => true) {
  let state;
  for (let attempt = 0; attempt < 30; ++attempt) {
    state = await native(page);
    if (
      state.publication &&
      state.document === state.publishedDocument &&
      state.metrics === state.publishedMetrics &&
      state.device === state.publishedDevice &&
      !state.queued &&
      !state.interactionCount &&
      accepts(state)
    )
      return state;
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error(
    'Slider scene did not settle: ' +
      JSON.stringify({
        document: String(state.document),
        published: String(state.publishedDocument),
        metrics: String(state.metrics),
        publishedMetrics: String(state.publishedMetrics),
        queued: state.queued,
        interactionCount: state.interactionCount,
      }),
  );
}
const slider = (frame) => frame.nodes.find((n) => n.semantics?.role === p.semanticsRoles.slider);
function sourceThumb(frame, size) {
  for (const node of frame.nodes) {
    const entry = node.nativePaint?.find(
      (e) =>
        e.kind === 'shape' &&
        e.width === size &&
        e.height === size &&
        (size === 28
          ? e.color === 0xff33aa77
          : node.nativePaint.some((e) => e.kind === 'elevationShadow')),
    );
    if (!entry) continue;
    const lx = entry.transform[4] + entry.width / 2,
      ly = entry.transform[5] + entry.height / 2,
      m = node.matrix;
    return {
      x: m[0] * lx + m[2] * ly + m[4],
      y: m[1] * lx + m[3] * ly + m[5],
      bottom: size === 28 ? node.bounds.y + node.height : m[1] * lx + m[3] * ly + m[5] + size / 2,
    };
  }
  throw Error('Content did not publish the canonical Cupertino thumb');
}
async function pixels(page, points) {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, points }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return points.map(({ x, y }) => [
          ...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data,
        ]);
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), points },
  );
}
async function report(page, predicate) {
  await page.waitForFunction(predicate, null, { timeout: 15000 });
  return page.evaluate(() => __sliderEvents.filter((e) => e.kind === 'slider-state').at(-1));
}
for (const design of ['cupertino', 'material'])
  test(
    `Original ${design} Slider uses C++ capture and pixels across controlled updates, RTL, resize and disabled input in both Web profiles`,
    { timeout },
    async () => {
      const thumb = (frame) => sourceThumb(frame, design === 'cupertino' ? 28 : 20),
        dragDistance = design === 'cupertino' ? 48 : 32;
      const repo = path.resolve(import.meta.dirname, '../../..'),
        supply = path.join(repo, 'Nelyx/engine/dist'),
        parent = fs.realpathSync(os.tmpdir());
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'), 'utf8')).sourceSha256,
        sourceIdentity(),
        'Build the current source before browser consumption',
      );
      const app = fs.mkdtempSync(path.join(parent, 'engine-slider-web-'));
      let server, browser;
      try {
        createEngineV2Project(app, {
          designs: design === 'cupertino' ? ['cupertino'] : ['cupertino', 'material'],
        });
        fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
        for (const [name, directory] of [
          ['core', 'Nelyx'],
          ['sdk', 'Nelyx/sdk'],
          ['cupertino', 'packages/cupertino'],
          ['material', 'packages/material'],
        ])
          fs.symlinkSync(
            path.join(repo, directory),
            path.join(app, 'node_modules/@nelyx', name),
            'junction',
          );
        fs.writeFileSync(
          path.join(app, 'src/app.ts'),
          design === 'cupertino' ? originalSliderFixture : originalMaterialSliderFixture,
        );
        const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
        assert.equal(built.routing.appModel, 'original-elements');
        server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        browser = await chromium.launch({ headless: true });
        for (const [route, profile] of [
          ['plain', 'single-worker'],
          ['isolated', 'threaded'],
        ]) {
          const context = await browser.newContext({ viewport: { width: 960, height: 600 } }),
            page = await context.newPage(),
            errors = [];
          page.on('pageerror', (error) => errors.push(String(error)));
          try {
            await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
            await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
              timeout: 30000,
            });
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            assert.equal(await page.evaluate(() => __nelyxV2.surface.selectedProfile), profile);
            await page.evaluate(() => {
              globalThis.__sliderEvents = [];
              __nelyxV2.app.addEventListener('message', (event) => {
                if (['slider-state', 'app-execution'].includes(event.data.kind)) {
                  __sliderEvents.push(event.data);
                  if (__sliderEvents.length > 100) __sliderEvents.shift();
                }
              });
            });
            let frame = await settled(page);
            const observations = [];
            const observe = async (stage) =>
              observations.push({
                stage,
                ...(await page.evaluate(() => __nelyxV2.surface.inputStats)),
              });
            await observe('initial');
            const initial = thumb(frame);
            assert.equal(slider(frame).control, null);
            assert.equal(slider(frame).semantics.range.value, 0.5);
            const colors = await pixels(page, [
              initial,
              { x: initial.x, y: initial.bottom + 1 },
              { x: initial.x + 70, y: initial.bottom + 1 },
            ]);
            assert.deepEqual(colors[0], [51, 170, 119, 255]);
            assert.notDeepEqual(
              colors[1],
              colors[2],
              'A shadow below the render box survives the provider recording bounds',
            );
            const drag = async (delta) => {
              const at = thumb(await settled(page));
              await page.mouse.move(at.x, at.y);
              await page.mouse.down();
              await page.mouse.move(at.x + delta, at.y, { steps: 8 });
              await page.mouse.up();
            };
            await drag(dragDistance);
            let state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 1),
            );
            assert.equal(state.value, 0.75);
            assert.ok(state.changes > 0);
            frame = await settled(page, (frame) => slider(frame)?.semantics.range.value === 0.75);
            assert.equal(slider(frame).semantics.range.value, 0.75);
            await observe('forward');
            assert.ok(thumb(frame).x > initial.x + 20);
            assert.deepEqual((await pixels(page, [thumb(frame)]))[0], [51, 170, 119, 255]);
            await drag(-dragDistance);
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 2),
            );
            assert.equal(state.value, 0.5);
            await observe('reverse');
            const click = async (label) => {
              const bounds = await page
                .getByRole('button', { name: label, exact: true })
                .boundingBox();
              assert.ok(bounds);
              await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            };
            await click('Toggle direction');
            await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.rtl),
            );
            await drag(dragDistance);
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 3),
            );
            assert.equal(state.value, 0.25);
            await observe('rtl');
            await click('Toggle acceptance');
            await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && !e.accept),
            );
            const before = state.changes;
            await drag(-dragDistance);
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 4),
            );
            assert.equal(state.value, 0.25);
            assert.ok(state.changes > before);
            await observe('refused');
            frame = await settled(page);
            assert.equal(
              slider(frame).semantics.range.value,
              0.25,
              'A refused controlled update never becomes native control state',
            );
            await page.setViewportSize({ width: 720, height: 600 });
            frame = await settled(page, (frame) => frame.viewport?.width === 720);
            assert.equal(frame.publishedMetrics, frame.metrics);
            await observe('resize');
            await click('Toggle disabled');
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.disabled),
            );
            frame = await settled(
              page,
              (frame) => slider(frame)?.semantics.range.readOnly === true,
            );
            assert.equal(slider(frame).semantics.range.readOnly, true);
            await observe('disabled');
            await page
              .getByRole('slider')
              .getAttribute('aria-disabled')
              .then((value) => assert.equal(value, 'true'));
            const changes = state.changes,
              received = frame.received;
            await drag(32);
            for (let attempt = 0; attempt < 30; ++attempt) {
              frame = await settled(page);
              if (frame.received > received) break;
              await page.evaluate(() => new Promise(requestAnimationFrame));
            }
            assert.ok(frame.received > received);
            assert.equal(
              (
                await page.evaluate(() =>
                  __sliderEvents.filter((e) => e.kind === 'slider-state').at(-1),
                )
              ).changes,
              changes,
            );
            const admitted = await page.evaluate(() => __nelyxV2.surface.inputStats);
            assert.equal(admitted.rejected, 0, JSON.stringify(observations));
            assert.equal(admitted.collected, admitted.dispatched);
            await click('Toggle disabled');
            await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && !e.disabled && e.ends === 4),
            );
            await settled(page, (frame) => slider(frame)?.semantics.range.readOnly === false);
            await click('Disable on next change');
            await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.disableOnChange),
            );
            const held = thumb(await settled(page));
            await page.mouse.move(held.x, held.y);
            await page.mouse.down();
            await page.mouse.move(held.x - dragDistance, held.y, { steps: 8 });
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.disabled && e.starts === 5),
            );
            assert.equal(
              state.ends,
              4,
              'Disabling during a Source drag cancels its callback cycle',
            );
            frame = await settled(
              page,
              (frame) =>
                slider(frame)?.semantics.range.readOnly === true &&
                !frame.nodes.some((node) => node.flags & 4),
            );
            await page.mouse.up();
            for (let attempt = 0; attempt < 30; ++attempt) {
              const pending = await page.evaluate(() => __nelyxV2.surface.inputStats);
              if (pending.collected === pending.dispatched + pending.rejected) break;
              await page.evaluate(() => new Promise(requestAnimationFrame));
            }
            const retired = await page.evaluate(() => __nelyxV2.surface.inputStats);
            assert.ok(
              retired.rejected > 0,
              'The old capture cannot resume after native cancellation',
            );
            assert.equal(retired.collected, retired.dispatched + retired.rejected);
            await click('Toggle disabled');
            await settled(page, (frame) => slider(frame)?.semantics.range.readOnly === false);
            await drag(-dragDistance);
            state = await report(page, () =>
              __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 5),
            );
            assert.equal(state.disabled, false);
            assert.equal(state.value, 0.25, 'Refusing a change also survives capture retirement');
            frame = await settled(page);
            if (design === 'material') {
              const beforeKey = state.changes;
              await page.getByRole('slider').focus();
              await page.keyboard.press('ArrowRight');
              state = await report(page, () =>
                __sliderEvents.some((e) => e.kind === 'slider-state' && e.ends === 6),
              );
              assert.equal(state.changes, beforeKey + 1);
              assert.equal(state.value, 0.25);
              assert.deepEqual(state.trace.slice(-3), [
                { kind: 'start', value: 0.25 },
                { kind: 'change', value: 0 },
                { kind: 'end', value: 0 },
              ]);
              frame = await settled(page);
              assert.ok(frame.keyWork >= 2n);
            }
            const execution = await page.evaluate(
              () => __sliderEvents.filter((e) => e.kind === 'app-execution').at(-1)?.execution,
            );
            assert.ok(execution);
            assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
            assert.ok(frame.gestureWork > 0n);
            assert.equal(frame.controlWork, 0n);
            assert.equal(execution.tsLayoutFallbacks, 0);
            assert.equal(execution.appGeometryNodes, 0);
            assert.equal(execution.rejectedFallbacks, 0);
            assert.deepEqual(errors, []);
            assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
            const input = await page.evaluate(() => __nelyxV2.surface.inputStats);
            await observe('disabled-drag');
            assert.equal(input.rejected, retired.rejected, JSON.stringify(observations));
            assert.equal(input.collected, input.dispatched + input.rejected);
            const closed = await page.evaluate(() => __nelyxV2.close());
            assert.equal(closed.reservedBytes, 0);
            assert.equal(closed.workersStopped, true);
            console.log(
              JSON.stringify({
                design,
                profile,
                commands: String(frame.transactionWork),
                gestureWork: String(frame.gestureWork),
                controlWork: String(frame.controlWork),
                value: state.value,
                changes: state.changes,
                retiredSamples: input.rejected,
                colors,
                workersStopped: closed.workersStopped,
                reservedBytes: closed.reservedBytes,
              }),
            );
          } finally {
            await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
            await context.close();
          }
        }
      } finally {
        await browser?.close();
        if (server) await new Promise((resolve) => server.close(resolve));
        stop();
        assert.equal(path.dirname(path.resolve(app)), parent);
        assert.match(path.basename(app), /^engine-slider-web-/);
        fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
      }
    },
  );
