// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { stop } from 'esbuild';
import ts from 'typescript';
import { packet, response, protocol as p } from '../../runtime/engine-client/index.ts';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import {
  createEngineV2Project,
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
} from '../../sdk/tooling/cli/src/engine-v2-runner.mjs';
import { originalOrderedPaintFixture } from './original-ordered-paint-fixture.mjs';
const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function published(page, count) {
  for (let i = 0; i < 30; i++) {
    const bytes = await page.evaluate(
        async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
        Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
      ),
      s = response(new Uint8Array(bytes));
    if (
      s.status === p.statuses.ok &&
      s.publication &&
      s.document === s.publishedDocument &&
      !s.queued &&
      s.nodes.filter((n) => n.flags & p.nodeFlags.paintResource).length === count
    )
      return s;
    assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error('Ordered Source paint did not publish');
}
async function colors(page, revision) {
  const png = await page.screenshot();
  return page.evaluate(
    async ({ png, revision }) => {
      const bitmap = await createImageBitmap(
        new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
      );
      try {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
          ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height),
          d = image.data;
        const sample = (x, y) =>
            Array.from(d.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)),
          bg = revision ? [255, 170, 34] : [238, 238, 34],
          red = [221, 51, 0],
          cyan = [34, 221, 204];
        const count = (rgb, x, y, w, h) => {
          let n = 0;
          for (let row = y; row < y + h; row++)
            for (let col = x; col < x + w; col++) {
              const i = (row * image.width + col) * 4;
              if (d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2]) n++;
            }
          return n;
        };
        return {
          bgVisible: count(bg, 196, 5, 54, 35),
          bgBlocked: count(bg, 152, 2, 41, 36),
          bgCropped: count(bg, 251, 2, 55, 36),
          fgVisible: count(red, 47, 50, 100, 35),
          fgBlocked: count(red, 12, 52, 31, 21),
          last: count(cyan, 180, 80, 150, 40),
          child: sample(20, 20),
          cover: sample(20, 60),
        };
      } finally {
        bitmap.close();
      }
    },
    { png: png.toString('base64'), revision },
  );
}
async function opacityDelta(page, reference) {
  const current = await page.screenshot();
  return page.evaluate(
    async (values) => {
      const images = await Promise.all(
        values.map((png) =>
          createImageBitmap(
            new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
          ),
        ),
      );
      try {
        const data = images.map((image) => {
          const canvas = new OffscreenCanvas(image.width, image.height),
            ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, image.width, image.height).data;
        });
        let maximum = 0;
        for (let i = 0; i < data[0].length; i += 4)
          for (let channel = 0; channel < 3; channel++)
            maximum = Math.max(
              maximum,
              Math.abs(
                data[1][i + channel] -
                  Math.round((data[0][i + channel] + [244, 246, 250][channel]) / 2),
              ),
            );
        return maximum;
      } finally {
        for (const image of images) image.close();
      }
    },
    [reference.toString('base64'), current.toString('base64')],
  );
}
test(
  'Original Source Canvas paragraph/shape order, save/clip and foreground survive updates and retirement in both Web profiles',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-ordered-paint-'));
    let server, browser;
    try {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(supply, 'engine-manifest.json'))).sourceSha256,
        sourceIdentity(),
      );
      createEngineV2Project(app);
      fs.mkdirSync(path.join(app, 'node_modules/@nelyx'), { recursive: true });
      for (const [name, dir] of [
        ['core', 'Nelyx'],
        ['sdk', 'Nelyx/sdk'],
      ])
        fs.symlinkSync(
          path.join(repo, dir),
          path.join(app, 'node_modules/@nelyx', name),
          'junction',
        );
      const entry = path.join(app, 'src/app.ts');
      fs.writeFileSync(entry, originalOrderedPaintFixture);
      const options = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        customConditions: ['browser'],
      };
      assert.deepEqual(
        ts
          .getPreEmitDiagnostics(ts.createProgram([entry], options))
          .filter((e) => e.category === ts.DiagnosticCategory.Error)
          .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' ')),
        [],
      );
      const built = await buildEngineV2Application({ app, target: 'web', engineInputs: supply });
      server = createEngineV2Server(verifyEngineV2Application(built.directory, 'web'));
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      browser = await chromium.launch({ headless: true });
      for (const [route, profile] of [
        ['plain', 'single-worker'],
        ['isolated', 'threaded'],
      ]) {
        const context = await browser.newContext({ viewport: { width: 360, height: 240 } }),
          page = await context.newPage(),
          errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        try {
          await page.addInitScript(() => {
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (message, ...args) {
              if (message?.kind === 'start')
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'app-execution')
                    globalThis.__orderedExecution = event.data.execution;
                  if (event.data?.kind === 'ordered-state') globalThis.__orderedState = event.data;
                });
              return Reflect.apply(post, this, [message, ...args]);
            };
          });
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
            timeout: 30000,
          });
          assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
          let frame, reference;
          for (const [revision, foreground] of [
            [0, true],
            [1, true],
            [2, false],
            [3, true],
            [4, true],
          ]) {
            if (revision)
              await page.evaluate(
                ({ foreground, revision }) =>
                  __nelyxV2.app.postMessage({
                    kind: 'ordered-update',
                    foreground,
                    ...(revision === 4 ? { opacity: 0.5 } : {}),
                  }),
                { foreground, revision },
              );
            if (revision)
              await page.waitForFunction(
                (revision) => __orderedState?.revision === revision,
                revision,
                { timeout: 15000 },
              );
            frame = await published(page, foreground ? 3 : 1);
            if (revision === 4)
              assert.ok(
                (await opacityDelta(page, reference)) <= 2,
                'Foreground and every inline paragraph remain inside the ancestor Opacity layer',
              );
            else {
              const pixel = await colors(page, revision);
              assert.ok(pixel.bgVisible > 10, JSON.stringify(pixel));
              assert.equal(pixel.bgBlocked, 0);
              assert.equal(pixel.bgCropped, 0);
              assert.deepEqual(pixel.child, [34, 68, 102, 255]);
              assert.equal(pixel.fgBlocked, 0);
              if (foreground) {
                assert.ok(pixel.fgVisible > 10 && pixel.last > 10, JSON.stringify(pixel));
                assert.deepEqual(pixel.cover, [119, 85, 153, 255]);
              } else {
                assert.equal(pixel.fgVisible, 0);
                assert.equal(pixel.last, 0);
                assert.deepEqual(pixel.cover, [34, 68, 102, 255]);
              }
            }
            if (revision === 3) reference = await page.screenshot();
            const paint = frame.nodes.flatMap((n) => n.nativePaint ?? []);
            assert.equal(paint.filter((e) => e.kind === 'paragraph').length, foreground ? 3 : 1);
            assert.equal(paint.filter((e) => e.kind === 'children').length, foreground ? 1 : 0);
            assert.equal(frame.framePaintNodes, 1n);
            assert.ok(frame.framePaintWork > 0n);
          }
          for (let i = 0; i < 30; i++) {
            const execution = await page.evaluate(() => __orderedExecution);
            if (execution && frame.transactionWork === BigInt(execution.acknowledgedCommands))
              break;
            frame = await published(page, 3);
            await page.evaluate(() => new Promise(requestAnimationFrame));
          }
          const execution = await page.evaluate(() => __orderedExecution),
            render = await page.evaluate(() => __nelyxV2.surface.diagnostics['render-stats']);
          assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
          assert.equal(execution.appText.layouts, execution.appText.sdkLayouts);
          assert.ok(execution.appText.layouts > 0);
          assert.equal(execution.appText.tsFallbacks, 0);
          assert.equal(execution.rejectedFallbacks, 0);
          assert.equal(execution.tsLayoutFallbacks, 0);
          assert.ok(render.counters.orderedParagraphs > 0 && render.counters.foregroundPaints > 0);
          const closed = await page.evaluate(() => __nelyxV2.close());
          assert.equal(closed.reservedBytes, 0);
          assert.equal(closed.workersStopped, true);
          assert.equal(closed.appText.reservations, 0);
          assert.deepEqual(errors, []);
          console.log(
            JSON.stringify({
              profile,
              cppCommands: String(frame.transactionWork),
              sdkCommands: execution.acknowledgedCommands,
              cppFramePaintWork: String(frame.framePaintWork),
              cppFramePaintNodes: String(frame.framePaintNodes),
              sourceLayouts: execution.appText.layouts,
              orderedParagraphs: render.counters.orderedParagraphs,
              foregroundPaints: render.counters.foregroundPaints,
              resourcesDrained: true,
            }),
          );
        } finally {
          await page.evaluate(() => globalThis.__nelyxV2?.close?.()).catch(() => {});
          await context.close();
        }
      }
    } finally {
      await browser?.close();
      if (server) await new Promise((r) => server.close(r));
      stop();
      assert.equal(path.dirname(app), parent);
      assert.match(path.basename(app), /^engine-ordered-paint-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
