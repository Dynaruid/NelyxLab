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
import { originalRichTextFixture } from './original-rich-text-fixture.mjs';
const owner = { session: 1, app: 1, view: 1, generation: 1 };
async function published(page, count, after = 0n) {
  for (let i = 0; i < 30; i++) {
    const bytes = await page.evaluate(
        async (bytes) => Array.from(await __nelyxV2.surface.host.exchange(new Uint8Array(bytes))),
        Array.from(packet(p.opcodes.semanticsSnapshot, owner)),
      ),
      state = response(new Uint8Array(bytes));
    if (
      state.status === p.statuses.ok &&
      state.publication &&
      state.publishedDocument > after &&
      state.document === state.publishedDocument &&
      !state.queued &&
      state.nodes.filter((n) => n.kind === p.kinds.paragraph).length === count
    )
      return state;
    assert.deepEqual(await page.evaluate(() => __nelyxV2.errors), []);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw Error('Rich Source publication did not settle');
}
async function pixels(page) {
  const png = await page.screenshot();
  return page.evaluate(async (png) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: 'image/png' }),
    );
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
        ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const differences = [];
      let maximum = 0,
        different = 0,
        ink = 0;
      const colors = [
        [221, 51, 0],
        [34, 85, 204],
        [255, 238, 153],
        [0, 153, 102],
        [136, 34, 119],
      ].map(() => 0);
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < 240; x++) {
          const a = (y * image.width + x) * 4,
            b = (y * image.width + x + 288) * 4;
          for (let c = 0; c < 4; c++) {
            const delta = Math.abs(image.data[a + c] - image.data[b + c]);
            maximum = Math.max(maximum, delta);
            if (delta) {
              different++;
              if (differences.length < 24)
                differences.push({ x, y, c, a: image.data[a + c], b: image.data[b + c] });
            }
          }
          if (image.data[a] !== 244 || image.data[a + 1] !== 246 || image.data[a + 2] !== 250)
            ink++;
          [
            [221, 51, 0],
            [34, 85, 204],
            [255, 238, 153],
            [0, 153, 102],
            [136, 34, 119],
          ].forEach((rgb, i) => {
            if (rgb.every((v, c) => image.data[a + c] === v)) colors[i]++;
          });
        }
      return { maximum, different, ink, colors, differences };
    } finally {
      bitmap.close();
    }
  }, png.toString('base64'));
}
test(
  'Original rich TextPainter and RichText preserve run styles, UTF16 queries and Content/Render pixels across profiles and updates',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-rich-text-'));
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
      fs.writeFileSync(entry, originalRichTextFixture);
      const options = {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };
      assert.deepEqual(
        ts
          .getPreEmitDiagnostics(ts.createProgram([entry], options))
          .filter((d) => d.category === ts.DiagnosticCategory.Error)
          .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')),
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
        const context = await browser.newContext({ viewport: { width: 624, height: 340 } }),
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
                    globalThis.__richExecution = event.data.execution;
                  if (event.data?.kind === 'rich-state') globalThis.__richState = event.data;
                });
              return Reflect.apply(post, this, [message, ...args]);
            };
          });
          await page.goto('http://127.0.0.1:' + server.address().port + '/' + route + '/');
          await page.waitForFunction(() => __nelyxV2?.ready || __nelyxV2?.errors.length, null, {
            timeout: 30000,
          });
          assert.deepEqual(
            await page.evaluate(() => __nelyxV2.errors),
            [],
            JSON.stringify(
              await page.evaluate(() => ({
                preparation: __nelyxV2.surface?.diagnostics?.['preparation-error'],
                provider: __nelyxV2.surface?.diagnostics?.['provider-error'],
              })),
            ),
          );
          let frame;
          for (let revision = 0; revision < 5; revision++) {
            if (revision) {
              await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'rich-update' }));
              await page.waitForFunction(
                (revision) => __richState?.revision === revision,
                revision,
                { timeout: 15000 },
              );
            }
            frame = await published(page, revision === 3 ? 0 : 2, frame?.publishedDocument ?? 0n);
            const geometry = await page.evaluate(() => __richState),
              pixel = await pixels(page);
            assert.equal(
              pixel.different,
              0,
              JSON.stringify({
                profile,
                revision,
                pixel,
                nodes: frame.nodes
                  .filter((n) => n.kind === p.kinds.paragraph)
                  .map((n) => ({
                    fontSize: n.fontSize,
                    color: n.color,
                    paragraph: n.paragraph,
                    paintPlacement: n.paintPlacement
                      ? {
                          unbounded: n.paintPlacement.unbounded,
                          width: n.paintPlacement.width,
                          height: n.paintPlacement.height,
                        }
                      : null,
                    width: n.width,
                    height: n.height,
                    content: n.content,
                    matrix: n.matrix,
                    flags: n.flags,
                  })),
              }),
            );
            if (revision === 3) {
              assert.equal(pixel.ink, 0);
              continue;
            }
            assert.ok(pixel.ink > 100);
            if (!revision)
              assert.ok(
                pixel.colors.every((n) => n > 10),
                JSON.stringify(pixel),
              );
            const paragraphs = frame.nodes.filter((n) => n.kind === p.kinds.paragraph),
              recorded = paragraphs.find((n) => n.flags & p.nodeFlags.paintResource),
              original = paragraphs.find((n) => !(n.flags & p.nodeFlags.paintResource));
            assert.deepEqual(original.paragraph.runs, recorded.paragraph.runs);
            assert.deepEqual(original.paragraph.strut, recorded.paragraph.strut);
            assert.equal(original.paragraph.strut.fontSize, revision ? 36 : 30);
            assert.equal(original.paragraph.strut.forceStrutHeight, revision === 0);
            assert.equal(original.paragraph.runs[0].fontFeatures[0].value, 0);
            assert.equal(original.paragraph.runs[1].fontVariations[0].value, revision ? 900 : 250);
            assert.equal(original.paragraph.runs[2].shadows[0].offset.y, 30);
            for (const node of paragraphs) {
              assert.ok(Math.abs(node.content.width - geometry.width) < 0.001);
              assert.ok(Math.abs(node.content.height - geometry.height) < 0.001);
              assert.ok(Math.abs(node.baseline - geometry.baseline) < 0.001);
            }
            if (revision >= 2) assert.equal(geometry.lines, 2);
          }
          for (let i = 0; i < 30; i++) {
            const execution = await page.evaluate(() => __richExecution);
            if (execution && frame.transactionWork === BigInt(execution.acknowledgedCommands))
              break;
            frame = await published(page, 2);
            await page.evaluate(() => new Promise(requestAnimationFrame));
          }
          const execution = await page.evaluate(() => __richExecution),
            diagnostics = await page.evaluate(() => __nelyxV2.surface.diagnostics),
            content = diagnostics['content-stats'],
            render = diagnostics['render-stats'];
          assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
          assert.equal(execution.appText.layouts, execution.appText.sdkLayouts);
          assert.equal(execution.appText.queries, execution.appText.sdkQueries);
          assert.ok(execution.appText.layouts > 0 && execution.appText.queries > 0);
          assert.equal(execution.appText.tsFallbacks, 0);
          assert.equal(execution.rejectedFallbacks, 0);
          assert.equal(execution.tsLayoutFallbacks, 0);
          assert.ok(content.counters.paragraphLayouts > 0 && render.counters.draws > 0);
          if (profile === 'threaded') {
            assert.ok(content.counters.fontReferencePictures > 0);
            assert.ok(render.counters.fontReferenceImports > 0);
            assert.ok(content.counters.fontReferenceBytes < 1024 * 1024);
          }
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
              appLayouts: execution.appText.layouts,
              appQueries: execution.appText.queries,
              contentLayouts: content.counters.paragraphLayouts,
              fontReferencePictures: content.counters.fontReferencePictures,
              fontReferenceImports: render.counters.fontReferenceImports,
              fontReferenceBytes: content.counters.fontReferenceBytes,
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
      assert.match(path.basename(app), /^engine-rich-text-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
