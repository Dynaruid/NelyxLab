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
import { originalInlineTextFixture } from './original-inline-text-fixture.mjs';
const owner = { session: 1, app: 1, view: 1, generation: 1 };
const json = (value) =>
  JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? String(item) : item));
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
  throw Error('Inline Source publication did not settle');
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
      let different = 0,
        ink = 0;
      const examples = [];
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < 248; x++) {
          const a = (y * image.width + x) * 4,
            b = (y * image.width + x + 288) * 4;
          for (let c = 0; c < 4; c++)
            if (image.data[a + c] !== image.data[b + c]) {
              different++;
              if (examples.length < 12)
                examples.push({ x, y, c, a: image.data[a + c], b: image.data[b + c] });
            }
          if (image.data[a] !== 244 || image.data[a + 1] !== 246 || image.data[a + 2] !== 250)
            ink++;
        }
      return { different, ink, examples };
    } finally {
      bitmap.close();
    }
  }, png.toString('base64'));
}
test(
  'Original WidgetSpan uses Core child layout, real baselines and scaled input with exact TextPainter control pixels across profiles and updates',
  { timeout },
  async () => {
    const repo = path.resolve(engineRoot, '../..'),
      supply = path.join(engineRoot, 'dist'),
      parent = fs.realpathSync(os.tmpdir()),
      app = fs.mkdtempSync(path.join(parent, 'engine-inline-text-'));
    let browser, server;
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
      fs.writeFileSync(entry, originalInlineTextFixture);
      const options = {
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
            globalThis.__inlineTaps = [];
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function (message, ...args) {
              if (message?.kind === 'start')
                this.addEventListener('message', (event) => {
                  if (event.data?.kind === 'app-execution')
                    globalThis.__inlineExecution = event.data.execution;
                  if (event.data?.kind === 'inline-state') globalThis.__inlineState = event.data;
                  if (event.data?.kind === 'inline-tap') {
                    globalThis.__inlineTaps ??= [];
                    globalThis.__inlineTaps.push(event.data);
                  }
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
            json(
              await page.evaluate(() => ({
                preparation: __nelyxV2.surface?.diagnostics?.['preparation-error'],
                provider: __nelyxV2.surface?.diagnostics?.['provider-error'],
              })),
            ),
          );
          let frame,
            totalBoxes = 0,
            hiddenChildren = 0;
          for (let revision = 0; revision < 6; revision++) {
            if (revision) {
              await page.evaluate(() => __nelyxV2.app.postMessage({ kind: 'inline-update' }));
              await page.waitForFunction(
                (revision) => __inlineState?.revision === revision,
                revision,
                { timeout: 15000 },
              );
            }
            const geometry = await page.evaluate(() => __inlineState);
            frame = await published(page, geometry.paragraphs, frame?.publishedDocument ?? 0n);
            const pixel = await pixels(page);
            assert.equal(
              pixel.different,
              0,
              json({
                profile,
                revision,
                pixel,
                geometry,
                nodes: frame.nodes
                  .filter((n) => n.kind === p.kinds.paragraph)
                  .map((n) => ({
                    node: n.node,
                    parent: n.parent,
                    width: n.width,
                    height: n.height,
                    content: n.content,
                    matrix: n.matrix,
                    paragraph: n.paragraph,
                  })),
              }),
            );
            if (revision === 3) {
              assert.equal(pixel.ink, 0);
              continue;
            }
            assert.ok(pixel.ink > 100);
            const paragraph = frame.nodes.find((n) => n.paragraph?.inlineChildren),
              children = frame.nodes
                .filter((n) => n.parent.slot === paragraph.node.slot)
                .sort((a, b) => a.order - b.order);
            assert.equal(children.length, 7);
            assert.equal(paragraph.paragraph.placeholders.length, 7);
            assert.ok(
              Math.abs(paragraph.baseline - geometry.baseline) < 1e-4,
              json({ profile, revision, baseline: paragraph.baseline, geometry }),
            );
            assert.ok(Math.abs(paragraph.height - geometry.height) < 1e-4);
            const near = (a, b) =>
              assert.ok(Math.abs(a - b) < 1e-4, JSON.stringify({ a, b, profile, revision }));
            for (let i = 0; i < children.length; i++) {
              const child = children[i],
                declared = paragraph.paragraph.placeholders[i],
                expected = geometry.dimensions[i];
              near(child.width, expected.width);
              near(child.height, expected.height);
              near(declared.width, expected.width);
              near(declared.height, expected.height);
              if (i === 0 || i === 6) near(declared.baselineOffset, expected.baselineOffset);
              if (i < geometry.boxes.length) {
                near(child.x, paragraph.x + paragraph.content.x + geometry.boxes[i].x);
                near(child.y, paragraph.y + paragraph.content.y + geometry.boxes[i].y);
                assert.equal(child.flags & p.nodeFlags.inlineHidden, 0);
                totalBoxes++;
              } else {
                assert.ok(child.flags & p.nodeFlags.inlineHidden);
                assert.equal(child.opacity, 0);
                hiddenChildren++;
              }
            }
            if (!revision) {
              const target = frame.nodes.find((n) => n.semantics?.label?.startsWith('inline-0'));
              assert.ok(target);
              near(target.matrix[0], geometry.scale);
              near(target.matrix[3], geometry.scale);
              await page.mouse.click(
                target.matrix[4] + (target.width * geometry.scale) / 2,
                target.matrix[5] + (target.height * geometry.scale) / 2,
              );
              await page.waitForFunction(() => __inlineTaps?.length === 1, null, {
                timeout: 10000,
              });
              assert.equal((await page.evaluate(() => __inlineTaps))[0].index, 0);
            }
            if (revision === 2 || revision === 4) {
              assert.ok(geometry.boxes.length < 7);
              const hidden = frame.nodes.filter(
                (n) =>
                  n.semantics?.label?.startsWith('inline-') && n.flags & p.nodeFlags.inlineHidden,
              );
              assert.ok(hidden.length > 0);
              assert.ok(hidden.every((n) => n.semantics.flags & p.semanticsFlags.hidden));
            }
            if (geometry.compressed) {
              assert.equal(
                paragraph.flags & p.nodeFlags.rectangularClip,
                0,
                'Forced strut does not turn child ink outside its line box into paragraph overflow',
              );
              assert.ok(
                geometry.boxes.some((box) => box.y < 0 || box.y + box.height > geometry.height),
              );
            }
          }
          for (let i = 0; i < 30; i++) {
            const execution = await page.evaluate(() => __inlineExecution);
            if (execution && frame.transactionWork === BigInt(execution.acknowledgedCommands))
              break;
            frame = await published(page, (await page.evaluate(() => __inlineState)).paragraphs);
            await page.evaluate(() => new Promise(requestAnimationFrame));
          }
          const execution = await page.evaluate(() => __inlineExecution),
            diagnostics = await page.evaluate(() => __nelyxV2.surface.diagnostics),
            content = diagnostics['content-stats'],
            render = diagnostics['render-stats'];
          assert.equal(frame.transactionWork, BigInt(execution.acknowledgedCommands));
          assert.ok(frame.layoutWork > 0n);
          assert.equal(execution.tsLayoutFallbacks, 0);
          assert.equal(execution.rejectedFallbacks, 0);
          assert.equal(execution.appText.tsFallbacks, 0);
          assert.equal(execution.appText.layouts, execution.appText.sdkLayouts);
          assert.equal(execution.appText.queries, execution.appText.sdkQueries);
          assert.ok(
            execution.appText.layouts > 0 &&
              content.counters.paragraphLayouts > 0 &&
              render.counters.draws > 0,
          );
          if (profile === 'threaded') {
            assert.ok(
              content.counters.fontReferencePictures > 0 &&
                render.counters.fontReferenceImports > 0,
            );
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
              cppLayoutWork: String(frame.layoutWork),
              sdkCommands: execution.acknowledgedCommands,
              appLayouts: execution.appText.layouts,
              appQueries: execution.appText.queries,
              contentLayouts: content.counters.paragraphLayouts,
              totalBoxes,
              hiddenChildren,
              fontReferencePictures: content.counters.fontReferencePictures,
              fontReferenceImports: render.counters.fontReferenceImports,
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
      if (server) await new Promise((resolve) => server.close(resolve));
      stop();
      assert.equal(path.dirname(app), parent);
      assert.match(path.basename(app), /^engine-inline-text-/);
      fs.rmSync(app, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
