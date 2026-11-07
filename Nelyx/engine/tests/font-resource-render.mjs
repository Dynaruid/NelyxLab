// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { encodeUtf8, protocol as p } from '../../runtime/engine-client/index.ts';
import { readFontCatalog, fontCatalogBytes } from '../../runtime/engine-client/font-catalog.ts';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../runtime/engine-client/paragraph.ts';
import { preparedTransfers } from '../platform/web/actors.ts';
import { engineRoot, timeout } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { fontResourceFixture } from './font-resource-fixture.mjs';
import { richRun } from './rich-paragraph-contracts.mjs';

test(
  'Web resource fonts preserve measured paragraphs and exact same-family faces across independent heaps, failures and retirement',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      supply = canvasKitTestSupply(),
      root = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
      factory = require(supply.js),
      ck = await factory({ wasmBinary: fs.readFileSync(supply.wasm) }),
      other = await factory({ wasmBinary: fs.readFileSync(supply.wasm) }),
      fonts = manifest.fonts.map((font) => ({
        id: manifest.files.find((file) => file.path === font.path).sha256,
        family: font.family,
        bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
      })),
      content = new CanvasKitProvider(ck, fonts),
      render = new CanvasKitProvider(other, fonts),
      fixture = fontResourceFixture(root),
      a = { slot: 50, generation: 1 },
      b = { slot: 50, generation: 2 },
      inputs = new Map([
        ['1:50', fixture.a],
        ['2:50', fixture.b],
      ]),
      text = 'אבגד שלום 123 אבגד 😀 مرحبا',
      split = text.indexOf('אבגד', 1),
      paragraph = readParagraphOptions(
        paragraphOptionsBytes({
          runs: [
            richRun(0, split, {
              fontSize: 32,
              fontFamilies: ['NelyxDefault'],
              fontWeight: 700,
              fontVariations: [{ axis: 'wght', value: 250 }],
              color: 0xff172033,
            }),
            richRun(split, text.length, {
              fontSize: 28,
              fontFamilies: ['NelyxHebrew'],
              fontWeight: 400,
              color: 0xff773399,
            }),
          ],
        }),
      ),
      options = { text, fontSize: 32, color: 0xff172033, textDirection: 0, width: 180, paragraph },
      controls = [],
      surfaces = [],
      reads = [];
    const pixels = (kit, paint) => {
      const surface = kit.MakeSurface(240, 150);
      surfaces.push(surface);
      const canvas = surface.getCanvas();
      canvas.clear(kit.Color(244, 246, 250, 1));
      paint(canvas);
      return canvas
        .readPixels(0, 0, {
          width: 240,
          height: 150,
          colorType: kit.ColorType.RGBA_8888,
          alphaType: kit.AlphaType.Unpremul,
          colorSpace: kit.ColorSpace.SRGB,
        })
        .slice();
    };
    const read = (resource, offset, length, preparation) => {
      const source = inputs.get(resource.generation + ':' + resource.slot);
      assert.ok(source && preparation > 0n && length <= p.limits.fontChunkBytes);
      reads.push({ offset, length });
      return {
        resource,
        offset,
        total: source.length,
        bytes: source.slice(offset, offset + length),
      };
    };
    let prior, last;
    try {
      assert.notEqual(ck.HEAPU8.buffer, other.HEAPU8.buffer);
      const familyA = ck.Typeface.MakeTypefaceFromData(fixture.font.slice().buffer),
        familyB = ck.Typeface.MakeTypefaceFromData(fixture.changed.slice().buffer);
      try {
        assert.equal(familyA.getFamilyName(), familyB.getFamilyName());
      } finally {
        familyA.delete();
        familyB.delete();
      }
      for (const [index, resource, catalogBytes] of [
        [1, a, fixture.a],
        [2, b, fixture.b],
      ]) {
        const catalog = content.makeAppFontCatalog(readFontCatalog(catalogBytes)),
          control = content.appParagraph(options, catalog);
        controls.push({ catalog, control });
        const scene = {
          preparation: BigInt(index),
          preparationDocument: BigInt(index),
          metrics: 1n,
          device: 1n,
          fontRevision: BigInt(index + 1),
          measurePreparation: BigInt(index),
          measureRequest: 1n,
          measureMinWidth: 180,
          measureMaxWidth: 180,
          nodes: [
            {
              node: { slot: 1, generation: 1 },
              kind: p.kinds.paragraph,
              flags: 16,
              width: 180,
              height: control.getHeight(),
              fontSize: 32,
              color: options.color,
              textDirection: 0,
              paragraph,
              fontBinding: { resource, fontRevision: BigInt(index + 1), pinned: false },
              content: { x: 0, y: 0, width: 180, height: control.getHeight() },
            },
          ],
          blobs: [{ type: 1, handle: { slot: 1, generation: 1 }, bytes: encodeUtf8(text) }],
        };
        const release = content.acquireFontResources(scene, read);
        let packet;
        try {
          assert.throws(() => content.close(), /catalogs\/scopes/);
          const before = content.counters.paragraphLayouts;
          content.measure(scene);
          assert.equal(content.counters.paragraphLayouts, before + 1);
          packet = content.prepare(scene, false);
          assert.equal(
            content.counters.paragraphLayouts,
            before + 1,
            'Measured dynamic paragraphs are reused',
          );
        } finally {
          release();
        }
        assert.equal(packet.fontCatalogs.length, 1);
        assert.equal(
          packet.texts.length,
          0,
          'Dynamic plain/rich paragraphs preserve a complete C++ Picture',
        );
        assert.ok(
          packet.pictures[0].fonts.some((font) =>
            font.font.startsWith('resource:' + resource.generation + ':50/'),
          ),
        );
        if (index === 2) {
          assert.ok(packet.pictures[0].fonts.length >= 3);
          assert.ok(
            packet.pictures[0].fonts.some(
              (font) => font.font === fonts.find((font) => font.family === 'NelyxHebrew').id,
            ),
            'One C++ Picture uses the changed custom face and the equal-named bundled face',
          );
          const wrong = structuredClone(packet);
          wrong.preparation = 19n;
          wrong.pictures[0].fonts.find((font) => font.font.startsWith('resource:2:50/')).font =
            fonts.find((font) => font.family === 'NelyxHebrew').id;
          assert.throws(
            () => render.import(wrong),
            /decode/,
            'An installed same-family base cannot replace the identity inside the C++ stream',
          );
          assert.equal(render.tables.has(19n), false);
          assert.equal(
            render.counters.resourceFontCatalogs,
            1,
            'Failed candidate collections are fully released',
          );
        }
        const moved = structuredClone(packet, { transfer: preparedTransfers(packet) });
        assert.equal(packet.fontCatalogs[0].bytes.byteLength, 0);
        render.import(moved);
        content.releasePacket(BigInt(index));
        const expected = pixels(ck, (canvas) => canvas.drawParagraph(control, 0, 0)),
          actual = pixels(other, (canvas) =>
            canvas.drawPicture(render.tables.get(BigInt(index)).get('1:1')),
          );
        assert.deepEqual(actual, expected);
        if (index === 1) prior = actual;
        else
          assert.ok(
            actual.some((value, i) => value !== prior[i]),
            'Equal intrinsic names with different font bytes produce different glyph ink',
          );
        last = moved;
      }
      content.trimCache();
      assert.equal(content.counters.resourceFontCatalogs, 0);
      assert.equal(render.counters.resourceFontCatalogs, 2);
      assert.deepEqual(
        pixels(other, (canvas) => canvas.drawPicture(render.tables.get(1n).get('1:1'))),
        prior,
        'An older Render table owns its original decoded faces after Content releases them',
      );
      const changed = structuredClone(last);
      changed.preparation = 20n;
      new Uint8Array(changed.fontCatalogs[0].bytes)[0] ^= 1;
      assert.throws(() => render.import(changed), /identity changed/);
      const invalid = structuredClone(last);
      invalid.preparation = 21n;
      invalid.fontCatalogs[0].resource.generation = 3;
      invalid.fontCatalogs[0].bytes = fontCatalogBytes({
        fonts: [{ family: 'NelyxDefault', bytes: new Uint8Array(16) }],
      }).buffer;
      assert.throws(() => render.import(invalid), /decode/);
      assert.equal(render.counters.resourceFontCatalogs, 2);
      render.retireExcept(2n);
      assert.equal(render.counters.resourceFontCatalogs, 1);
      render.retireExcept(-1n);
      assert.equal(render.counters.resourceFontCatalogs, 0);
      assert.equal(render.counters.resourceFontBytes, 0);
      console.log(
        JSON.stringify({
          sameFamilyGenerations: 2,
          contentDecodes: content.counters.dynamicFontLoads,
          renderDecodes: render.counters.dynamicFontLoads,
          cppLayouts: content.counters.paragraphLayouts,
          fontReferencePictures: content.counters.fontReferencePictures,
          imports: render.counters.fontReferenceImports,
          pixelDiff: 0,
          reads: reads.length,
          resourceCatalogsAfterRetire: 0,
        }),
      );
    } finally {
      for (const surface of surfaces) surface?.delete();
      for (const { control, catalog } of controls) {
        control.delete();
        catalog.close();
      }
      content.close();
      render.close();
    }
    assert.equal(content.counters.resourceFontCatalogs, 0);
    assert.equal(content.counters.resourceFontBytes, 0);
    assert.equal(content.counters.livePictures, 0);
    assert.equal(render.counters.livePictures, 0);
  },
);
