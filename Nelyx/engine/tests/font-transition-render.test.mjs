// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { fontResourceFixture } from './font-resource-fixture.mjs';
import { wasmFactory } from './transports.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { FontPreparation } from '../platform/web/font-preparation.ts';
import { AppTextBudget, WebAppTextBackend } from '../platform/web/app-text.ts';
import { exchange } from '../platform/web/common.ts';
import {
  EngineClient,
  protocol as p,
  appTextQuotaBytes,
} from '../../runtime/engine-client/index.ts';
import { fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../runtime/engine-client/paragraph.ts';

test(
  'Actual App/Content/Render C++ font preparation gates Core commit, survives producer release and drains cancelled/failed candidates',
  { timeout },
  async () => {
    const root = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json')));
    assert.equal(manifest.sourceSha256, sourceIdentity());
    const supply = canvasKitTestSupply(),
      factory = createRequire(import.meta.url)(supply.js),
      wasmBinary = fs.readFileSync(supply.wasm),
      kits = [];
    for (let i = 0; i < 3; ++i) kits.push(await factory({ wasmBinary }));
    assert.equal(new Set(kits.map((kit) => kit.HEAPU8.buffer)).size, 3);
    const fonts = manifest.fonts.map((font) => ({
      id: manifest.files.find((file) => file.path === font.path).sha256,
      family: font.family,
      bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
    }));
    const budget = new AppTextBudget(appTextQuotaBytes),
      appProvider = new CanvasKitProvider(kits[0], fonts, budget),
      backend = new WebAppTextBackend(appProvider, budget),
      content = new CanvasKitProvider(kits[1], fonts),
      render = new CanvasKitProvider(kits[2], fonts);
    const { module } = await wasmFactory(path.join(root, 'single-worker')),
      engine = module._nelyx_wasm_open(1, 1, p.schema, p.capabilities.protocol),
      messages = [];
    assert.ok(engine);
    const client = await EngineClient.connect({
        exchange: async (bytes) => exchange(module, engine, bytes),
        close() {},
      }),
      view = await client.openView(1),
      preparers = [
        new FontPreparation(module, engine, content, 'content', (value) => messages.push(value)),
        new FontPreparation(module, engine, render, 'render', (value) => messages.push(value)),
      ];
    const inputs = fontResourceFixture(root),
      a = { slot: 50, generation: 1 },
      b = { slot: 50, generation: 2 },
      bad = { slot: 50, generation: 3 },
      handles = [];
    const input = {
      text: 'אבגד שלום 123',
      width: 180,
      fontSize: 32,
      color: 0xff172033,
      textDirection: 0,
      paragraph: readParagraphOptions(paragraphOptionsBytes({ fontFamily: 'NelyxDefault' })),
    };
    let appStage;
    const layout = (revision) => {
      const value = backend.layout(input, revision);
      handles.push(value.handle);
      return value;
    };
    const prepare = (bytes) => (appStage = backend.prepareFonts(bytes));
    const finish = (committed) => {
      backend.finishFonts(appStage, committed);
      appStage = undefined;
    };
    const upload = async (resource, bytes, token) => {
      await view.beginFontUpload(resource, bytes.length, token);
      for (let at = 0; at < bytes.length; at += p.limits.fontChunkBytes)
        await view.appendFontUpload(token, at, bytes.subarray(at, at + p.limits.fontChunkBytes));
      await view.finishFontUpload(token, true);
    };
    const check = () => preparers.forEach((owner) => owner.check());
    try {
      const old = layout(1),
        oldBoxes = backend.boxes(old.handle, 0, 3, 0, 0);
      prepare(inputs.a);
      await upload(a, inputs.a, 1n);
      await view.beginFontTransition(a, 1n);
      await view.fontTransitionReady(1n, 'app');
      await view.releaseFontResource(a);
      preparers[0].check();
      assert.equal((await view.request(p.opcodes.inspect)).fontTransition.ready, 3);
      await assert.rejects(
        view.commitFontTransition(1n, 2n),
        (error) => error.status === p.statuses.pending,
      );
      preparers[1].check();
      assert.equal((await view.request(p.opcodes.inspect)).fontTransition.ready, 7);
      const revision = backend.activateFonts(appStage);
      assert.deepEqual(
        layout(1).geometry,
        old.geometry,
        'Old synchronous App selection remains available before Core commit',
      );
      await view.commitFontTransition(1n, BigInt(revision));
      finish(true);
      check();
      assert.equal(
        backend.snapshot().fontRevision,
        Number((await view.request(p.opcodes.inspect)).fontRevision),
      );
      const custom = layout(revision);
      assert.deepEqual(backend.boxes(old.handle, 0, 3, 0, 0), oldBoxes);
      assert.equal(content.counters.resourceFontCatalogs, 1);
      assert.equal(render.counters.resourceFontCatalogs, 1);
      assert.deepEqual(
        (await view.readFontResource(a, 0, 32, 0n, 1n)).bytes,
        inputs.a.slice(0, 32),
      );

      prepare(inputs.b);
      await upload(b, inputs.b, 2n);
      await view.beginFontTransition(b, 2n);
      await view.fontTransitionReady(2n, 'app');
      preparers[0].check();
      assert.equal(content.counters.resourceFontCatalogs, 2);
      await view.abortFontTransition(2n);
      finish(false);
      check();
      await view.releaseFontResource(b);
      assert.equal(content.counters.resourceFontCatalogs, 1);
      assert.equal(render.counters.resourceFontCatalogs, 1);
      assert.equal((await view.request(p.opcodes.inspect)).fontRevision, BigInt(revision));

      const invalid = fontCatalogBytes({
        fonts: [{ family: 'NelyxDefault', bytes: new Uint8Array(16) }],
      });
      assert.throws(() => backend.prepareFonts(invalid), /font decode/i);
      await upload(bad, invalid, 3n);
      await view.beginFontTransition(bad, 3n);
      preparers[1].check();
      preparers[0].check();
      const failure = await view.request(p.opcodes.inspect);
      assert.equal(failure.fontTransition.phase, 'failed');
      assert.equal(failure.fontTransition.failedOwner, 4);
      assert.equal(failure.fontTransition.failedStatus, p.statuses.invalidValue);
      assert.equal(failure.fontRevision, BigInt(revision));
      assert.equal(content.counters.resourceFontCatalogs, 1);
      assert.equal(render.counters.resourceFontCatalogs, 1);
      assert.equal(
        messages.filter((message) => message.kind === 'font-preparation-error').length,
        1,
      );
      await view.abortFontTransition(3n);
      check();
      await view.releaseFontResource(bad);

      prepare(fontCatalogBytes({ fonts: [] }));
      await view.beginFontTransition(null, 4n);
      await view.fontTransitionReady(4n, 'app');
      check();
      const resetRevision = backend.activateFonts(appStage);
      await view.commitFontTransition(4n, BigInt(resetRevision));
      finish(true);
      check();
      assert.equal(content.counters.resourceFontCatalogs, 0);
      assert.equal(render.counters.resourceFontCatalogs, 0);
      assert.equal((await view.request(p.opcodes.inspect)).resourceBytes, 0n);
      assert.equal(
        backend.snapshot(custom.fontRevision).fontRevision,
        custom.fontRevision,
        'Held App paragraphs still own their old decoded collection',
      );
      assert.deepEqual(layout(resetRevision).geometry, old.geometry);
      // Owner shutdown must retire a decoded candidate even when Render has
      // not acknowledged it yet. Core close cancels its independent byte hold.
      const closingResource = { slot: 50, generation: 4 };
      prepare(inputs.a);
      await upload(closingResource, inputs.a, 4n);
      await view.beginFontTransition(closingResource, 5n);
      await view.fontTransitionReady(5n, 'app');
      preparers[0].check();
      assert.equal((await view.request(p.opcodes.inspect)).fontTransition.ready, 3);
      await view.releaseFontResource(closingResource);
      await view.close();
      finish(false);
      preparers.forEach((owner) => owner.stop());
      assert.equal(content.counters.resourceFontCatalogs, 0);
      assert.equal(render.counters.resourceFontCatalogs, 0);
      assert.equal(backend.snapshot().fontRevision, resetRevision);
      console.log(
        JSON.stringify({
          control: 'three-independent-heaps',
          ready: 7,
          appLayouts: backend.snapshot().layouts,
          appQueries: backend.snapshot().queries,
          appDecodes: backend.snapshot().fontLoads,
          contentDecodes: content.counters.dynamicFontLoads,
          renderDecodes: render.counters.dynamicFontLoads,
          failedOwner: failure.fontTransition.failedOwner,
          closedPending: true,
          resourceCatalogs: [
            content.counters.resourceFontCatalogs,
            render.counters.resourceFontCatalogs,
          ],
          tsFallbacks: 0,
        }),
      );
    } finally {
      preparers.forEach((owner) => owner.stop());
      if (appStage !== undefined) backend.finishFonts(appStage, false);
      for (const handle of handles) backend.release(handle);
      backend.close();
      content.close();
      render.close();
      try {
        await client.abort();
      } finally {
        module._nelyx_engine_destroy(engine);
      }
    }
    assert.equal(backend.snapshot().paragraphs, 0);
    assert.equal(
      budget.bytes,
      backend.snapshot().heapBytes,
      'C++ object retirement cannot release committed Wasm memory',
    );
  },
);
