// SPDX-License-Identifier: BSD-3-Clause
import './font-resource-render.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { engineRoot, timeout } from '../tools/build.mjs';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { richRun } from './rich-paragraph-contracts.mjs';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../runtime/engine-client/paragraph.ts';
import { encodeUtf8, protocol as p } from '../../runtime/engine-client/index.ts';
test(
  'Content font-reference Pictures retain rich paint in an independent Render heap, reject foreign fonts and drain',
  { timeout },
  async () => {
    const require = createRequire(import.meta.url),
      supply = canvasKitTestSupply(),
      root = path.join(engineRoot, 'dist'),
      manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
      factory = require(supply.js),
      ck = await factory({ wasmBinary: fs.readFileSync(supply.wasm) }),
      renderKit = await factory({ wasmBinary: fs.readFileSync(supply.wasm) }),
      fonts = manifest.fonts.map((font) => ({
        id: manifest.files.find((file) => file.path === font.path).sha256,
        family: font.family,
        bytes: new Uint8Array(fs.readFileSync(path.join(root, font.path))),
      })),
      content = new CanvasKitProvider(ck, fonts),
      render = new CanvasKitProvider(renderKit, fonts);
    assert.notEqual(ck.HEAPU8.buffer, renderKit.HEAPU8.buffer);
    let reference, expected, actual, slotReference, slotExpected, slotActual;
    try {
      const text = 'A😀 MMMM e\u0301 אבג مرحبا 한글',
        runs = [
          richRun(0, 4, {
            fontSize: 27,
            color: 0xffdd3300,
            fontFeatures: [{ name: 'liga', value: 0 }],
            shadows: [{ color: 0xff00bbdd, offset: { x: -16, y: -12 }, blurSigma: 2.5 }],
          }),
          richRun(4, 9, {
            fontSize: 45,
            color: 0xffbb22aa,
            backgroundColor: 0xffccffaa,
            fontWeight: 900,
            fontVariations: [{ axis: 'wght', value: 250 }],
            fontStyle: 'italic',
            decoration: 5,
            decorationStyle: 'wavy',
            decorationColor: 0xff009966,
            decorationThickness: 2,
          }),
          richRun(9, 24, {
            fontSize: 33,
            color: 0xff882277,
            fontFamilies: ['NelyxDefault', 'NelyxArabic', 'NelyxHebrew'],
            locale: 'he',
            shadows: [{ color: 0xffcc5500, offset: { x: 36, y: 30 }, blurSigma: 0 }],
          }),
        ],
        paragraph = readParagraphOptions(
          paragraphOptionsBytes({
            runs,
            strut: {
              fontFamilies: ['NelyxDefault'],
              fontSize: 8,
              fontWeight: 400,
              fontStyle: 'normal',
              height: 0.5,
              leading: 0,
              halfLeading: true,
              forceStrutHeight: true,
            },
          }),
        ),
        input = { text, width: 180, fontSize: 27, color: 0xff000000, textDirection: 0, paragraph };
      reference = content.appParagraph(input);
      const scene = {
          preparation: 1n,
          preparationDocument: 1n,
          metrics: 1n,
          device: 1n,
          fontRevision: 1n,
          nodes: [
            {
              node: { slot: 1, generation: 1 },
              kind: p.kinds.paragraph,
              flags: 16,
              width: 180,
              height: reference.getHeight(),
              fontSize: 27,
              color: input.color,
              textDirection: 0,
              paragraph,
              content: { x: 0, y: 0, width: 180, height: reference.getHeight() },
            },
          ],
          blobs: [{ type: 1, handle: { slot: 1, generation: 1 }, bytes: encodeUtf8(text) }],
        },
        packet = content.prepare(scene, false);
      assert.equal(packet.texts.length, 0);
      assert.equal(packet.pictures.length, 1);
      assert.ok(packet.pictures[0].fonts.length >= 4);
      assert.ok(packet.pictures[0].bytes.byteLength < 64 * 1024);
      const bad = structuredClone(packet);
      bad.preparation = 2n;
      bad.pictures[0].fonts = [];
      assert.throws(() => render.import(bad), /decode/);
      assert.equal(render.tables.has(2n), false);
      bad.pictures[0].fonts = structuredClone(packet.pictures[0].fonts);
      bad.pictures[0].fonts[0].font = 'foreign';
      assert.throws(() => render.import(bad), /identity/);
      assert.equal(render.tables.has(2n), false);
      render.import(packet);
      assert.equal(render.counters.fontReferenceImports, 1);
      assert.equal(content.counters.fontReferencePictures, 1);
      const coordinates = packet.pictures[0].fonts.flatMap((font) => font.coordinates);
      assert.ok(
        coordinates.some((value) => value.axis === 0x77676874 && value.value === 250),
        'The actual cloned weight axis crosses heaps',
      );
      expected = ck.MakeSurface(320, 320);
      actual = renderKit.MakeSurface(320, 320);
      expected.getCanvas().clear(ck.Color(244, 246, 250, 1));
      expected.getCanvas().drawParagraph(reference, 48, 48);
      actual.getCanvas().clear(renderKit.Color(244, 246, 250, 1));
      actual.getCanvas().translate(48, 48);
      actual.getCanvas().drawPicture([...render.tables.get(1n).values()][0]);
      const pixels = (kit, surface) =>
          surface.getCanvas().readPixels(0, 0, {
            width: 320,
            height: 320,
            colorType: kit.ColorType.RGBA_8888,
            alphaType: kit.AlphaType.Unpremul,
            colorSpace: kit.ColorSpace.SRGB,
          }),
        a = pixels(ck, expected),
        b = pixels(renderKit, actual);
      assert.equal(
        a.reduce((sum, value, i) => sum + (value !== b[i] ? 1 : 0), 0),
        0,
        'No re-layout or glyph-only replacement may alter rich paint',
      );
      let shadowOutside = 0;
      for (let y = 0; y < 320; y++)
        for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4;
          if (
            (x >= 48 + input.width || y >= 48 + reference.getHeight()) &&
            a[i] === 204 &&
            a[i + 1] === 85 &&
            a[i + 2] === 0
          )
            shadowOutside++;
        }
      assert.ok(
        shadowOutside > 10,
        'A shadow outside the layout box is retained, not clipped to paragraph bounds',
      );
      console.log(
        JSON.stringify({
          fontReferenceBytes: packet.pictures[0].bytes.byteLength,
          fonts: packet.pictures[0].fonts.length,
          pixelDifferences: 0,
          shadowOutside,
        }),
      );
      const slotText = 'Q\ufffc אב \ufffc',
        slotOptions = readParagraphOptions(
          paragraphOptionsBytes({
            strut: {
              fontFamilies: ['NelyxDefault'],
              fontSize: 8,
              fontWeight: 400,
              fontStyle: 'normal',
              height: 0.5,
              leading: 0,
              halfLeading: true,
              forceStrutHeight: true,
            },
            placeholders: [
              {
                offset: 1,
                width: 31.25,
                height: 35,
                alignment: 'baseline',
                baseline: 'alphabetic',
                baselineOffset: 18,
              },
              {
                offset: 6,
                width: 40,
                height: 28,
                alignment: 'middle',
                baseline: 'ideographic',
                baselineOffset: 14,
              },
            ],
          }),
        ),
        slotInput = {
          text: slotText,
          width: 180,
          fontSize: 36,
          color: 0xff172033,
          textDirection: 1,
          paragraph: slotOptions,
        };
      slotReference = content.appParagraph(slotInput);
      const slotScene = structuredClone(scene);
      slotScene.preparation = 3n;
      slotScene.nodes[0] = {
        ...slotScene.nodes[0],
        fontSize: 36,
        color: slotInput.color,
        textDirection: 1,
        paragraph: slotOptions,
        height: slotReference.getHeight(),
        content: { x: 0, y: 0, width: 180, height: slotReference.getHeight() },
      };
      slotScene.blobs[0].bytes = encodeUtf8(slotText);
      const slotPacket = content.prepare(slotScene, false);
      assert.equal(slotPacket.texts.length, 0);
      assert.equal(slotPacket.pictures.length, 1);
      assert.ok(
        slotPacket.pictures[0].fonts.length > 0,
        'A plain strut/placeholder paragraph uses font references',
      );
      render.import(slotPacket);
      slotExpected = ck.MakeSurface(320, 320);
      slotActual = renderKit.MakeSurface(320, 320);
      slotExpected.getCanvas().clear(ck.Color(244, 246, 250, 1));
      slotExpected.getCanvas().drawParagraph(slotReference, 48, 48);
      slotActual.getCanvas().clear(renderKit.Color(244, 246, 250, 1));
      slotActual.getCanvas().translate(48, 48);
      slotActual.getCanvas().drawPicture([...render.tables.get(3n).values()][0]);
      const sa = pixels(ck, slotExpected),
        sb = pixels(renderKit, slotActual);
      assert.equal(
        sa.reduce((sum, value, i) => sum + (value !== sb[i] ? 1 : 0), 0),
        0,
        'Plain placeholders and compressed strut retain the C++ paint stream across heaps',
      );
      assert.equal(slotReference.getRectsForPlaceholders().length, 2);
      let compressedInk = 0;
      for (let y = 0; y < 320; y++)
        for (let x = 0; x < 320; x++) {
          const i = (y * 320 + x) * 4;
          if (
            (x < 48 || y < 48 || x >= 228 || y >= 48 + slotReference.getHeight()) &&
            (sa[i] !== 244 || sa[i + 1] !== 246 || sa[i + 2] !== 250)
          )
            compressedInk++;
        }
      assert.ok(
        compressedInk > 10,
        'Forced small line height must preserve glyph ink outside its layout box',
      );
      console.log(
        JSON.stringify({
          plainPlaceholderPictureBytes: slotPacket.pictures[0].bytes.byteLength,
          placeholderBoxes: 2,
          compressedInk,
          pixelDifferences: 0,
        }),
      );
    } finally {
      reference?.delete();
      expected?.delete();
      actual?.delete();
      slotReference?.delete();
      slotExpected?.delete();
      slotActual?.delete();
      content.releasePacket(1n);
      content.releasePacket(3n);
      content.close();
      render.close();
    }
    assert.equal(content.counters.livePictures, 0);
    assert.equal(render.counters.livePictures, 0);
  },
);
