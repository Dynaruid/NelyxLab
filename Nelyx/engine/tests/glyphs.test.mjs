// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { protocol as p, encodeUtf8 } from '../../runtime/engine-client/index.ts';
import { engineRoot, timeout } from '../tools/build.mjs';
import {
  lineIndexUnit,
  lineNumberAtUTF16,
  caretLineAtUTF16,
} from '../render/canvaskit-web/paragraph.ts';
const require = createRequire(import.meta.url),
  ckRoot = path.dirname(require.resolve('canvaskit-wasm/package.json'));
const init = require(path.join(ckRoot, 'bin/full/canvaskit.js'));
test(
  'Public glyph transfer matches Korean, Latin, RTL fallback and color emoji paragraph pixels',
  { timeout },
  async () => {
    const wasmBinary = fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm'));
    const contentKit = await init({ wasmBinary }),
      renderKit = await init({ wasmBinary });
    assert.notEqual(contentKit.HEAPU8.buffer, renderKit.HEAPU8.buffer);
    const font = fs.readFileSync(
      path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
    );
    const fallback = path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets');
    const fonts = [
      { id: 'default', family: 'NelyxDefault', bytes: new Uint8Array(font) },
      ...[
        ['NotoNaskhArabic-Regular.ttf', 'NelyxArabic'],
        ['NotoSansHebrew.ttf', 'NelyxHebrew'],
        ['NotoColorEmoji.ttf', 'NelyxEmoji'],
      ].map(([file, family]) => ({
        id: file,
        family,
        bytes: new Uint8Array(fs.readFileSync(path.join(fallback, file))),
      })),
    ];
    const content = new CanvasKitProvider(contentKit, fonts),
      render = new CanvasKitProvider(renderKit, fonts);
    const surfaceA = contentKit.MakeSurface(480, 120),
      surfaceB = renderKit.MakeSurface(480, 120);
    try {
      const cases = [15, 16, 17, 18, 21, 23, 30]
        .flatMap((size) =>
          [
            'Nelyx Engine v2',
            '한국어 텍스트와 네이티브 입력',
            'C++ scene · Native / CanvasKit · 독립 스크롤',
          ].map((text) => ({ size, text, direction: 0 })),
        )
        .concat([
          { size: 21, text: 'שלום עולם · 한국어 123', direction: 1 },
          { size: 21, text: 'مرحبا بالعالم · English 123', direction: 1 },
          { size: 30, text: '😀 👩‍💻 ❤️ 🏳️‍🌈', direction: 0 },
          { size: 21, text: 'e\u0301 A😀\n한국어', direction: 0 },
        ]);
      for (const { size, text, direction } of cases) {
        const scene = {
          preparation: 1n,
          preparationDocument: 1n,
          document: 1n,
          metrics: 1n,
          device: 1n,
          blobs: [{ type: 1, handle: { slot: 1, generation: 1 }, bytes: encodeUtf8(text) }],
          nodes: [
            {
              node: { slot: 1, generation: 1 },
              kind: p.kinds.paragraph,
              width: 470,
              height: 110,
              fontSize: size,
              color: 0xff172033,
              textDirection: direction,
              resource: { slot: 0, generation: 0 },
            },
          ],
        };
        content.prepare(scene, true);
        const streamed = content.prepare(scene, false);
        render.import(streamed);
        for (const [kit, surface, provider] of [
          [contentKit, surfaceA, content],
          [renderKit, surfaceB, render],
        ]) {
          const canvas = surface.getCanvas();
          canvas.clear(kit.WHITE);
          canvas.drawPicture(provider.tables.get(1n).get('1:1'));
          surface.flush();
        }
        const pixels = (kit, surface) => {
          const image = surface.makeImageSnapshot();
          try {
            return image.readPixels(0, 0, {
              width: 480,
              height: 120,
              colorType: kit.ColorType.RGBA_8888,
              alphaType: kit.AlphaType.Premul,
              colorSpace: kit.ColorSpace.SRGB,
            });
          } finally {
            image.delete();
          }
        };
        const a = pixels(contentKit, surfaceA),
          b = pixels(renderKit, surfaceB);
        let differing = 0;
        for (let i = 0; i < a.length; i += 4)
          if (
            a[i] !== b[i] ||
            a[i + 1] !== b[i + 1] ||
            a[i + 2] !== b[i + 2] ||
            a[i + 3] !== b[i + 3]
          )
            ++differing;
        assert.equal(
          differing,
          0,
          'Glyph paint differs for ' + text + ': ' + differing + ' pixels',
        );
        content.retireExcept(0n);
        render.retireExcept(0n);
      }
      assert.ok(content.counters.textPictureProbeBytes > font.length);
      assert.ok(content.counters.glyphBytes < 65536);
      assert.equal(content.textCapabilities.lineIndexUnit, 'utf8');
    } finally {
      surfaceA.delete();
      surfaceB.delete();
      content.close();
      render.close();
    }
    assert.equal(content.counters.livePictures, 0);
    assert.equal(render.counters.livePictures, 0);
  },
);
test(
  'The pinned public paragraph binary has a verified UTF-16 adapter and distinct caret semantics',
  { timeout },
  async () => {
    const ck = await init({
      wasmBinary: fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm')),
    });
    const font = ck.TypefaceFontProvider.Make();
    font.registerFont(
      fs.readFileSync(
        path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
      ),
      'Default',
    );
    try {
      for (const text of ['한글\nA😀\ne\u0301', 'A😀\nB', '한\n\n글\n']) {
        const builder = ck.ParagraphBuilder.MakeFromFontProvider(
          new ck.ParagraphStyle({ textStyle: { fontFamilies: ['Default'], fontSize: 20 } }),
          font,
        );
        let paragraph;
        try {
          builder.addText(text);
          paragraph = builder.build();
          paragraph.layout(200);
          const unit = lineIndexUnit(paragraph, text);
          assert.equal(unit, 'utf8');
          let expected = 0;
          for (let i = 0; i < text.length;) {
            assert.equal(
              lineNumberAtUTF16(paragraph, text, i, unit),
              expected,
              JSON.stringify([text, i]),
            );
            if (text[i] === '\n') ++expected;
            const cp = text.codePointAt(i);
            if (cp > 0xffff)
              assert.throws(() => lineNumberAtUTF16(paragraph, text, i + 1, unit), RangeError);
            i += cp > 0xffff ? 2 : 1;
          }
          assert.equal(lineNumberAtUTF16(paragraph, text, text.length, unit), null);
          assert.equal(caretLineAtUTF16(paragraph, text, text.length), expected);
          assert.throws(
            () => lineNumberAtUTF16(paragraph, text, text.length + 1, unit),
            RangeError,
          );
          assert.equal('unscaledAscent' in paragraph.getLineMetrics()[0], false);
        } finally {
          paragraph?.delete();
          builder.delete();
        }
      }
    } finally {
      font.delete();
    }
  },
);
test(
  'Editable CanvasKit measurement and glyph transfer retain UTF-16 caret and selection geometry',
  { timeout },
  async () => {
    const ck = await init({
      wasmBinary: fs.readFileSync(path.join(ckRoot, 'bin/full/canvaskit.wasm')),
    });
    const fonts = [
      {
        id: 'default',
        family: 'NelyxDefault',
        bytes: new Uint8Array(
          fs.readFileSync(
            path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
          ),
        ),
      },
      {
        id: 'emoji',
        family: 'NelyxEmoji',
        bytes: new Uint8Array(
          fs.readFileSync(
            path.resolve(
              engineRoot,
              '../sdk/tooling/cli/templates/nelyx-app/assets/NotoColorEmoji.ttf',
            ),
          ),
        ),
      },
    ];
    const content = new CanvasKitProvider(ck, fonts),
      render = new CanvasKitProvider(ck, fonts);
    try {
      for (const text of ['A😀한글', 'e\u0301', '👩‍💻', '한\n\n글\n', '']) {
        const node = {
          node: { slot: 1, generation: 1 },
          kind: p.kinds.editable,
          width: 180,
          height: 120,
          fontSize: 20,
          color: 0xff172033,
          textDirection: 0,
          flags: 0,
          editing: {
            revision: 2n,
            serial: 2n,
            text,
            base: 0,
            extent: text.length,
            composingStart: -1,
            composingEnd: -1,
            flags: p.editFlags.multiline,
            maximumLength: 65536,
          },
        };
        const scene = {
          preparation: 1n,
          measurePreparation: 1n,
          measureRequest: 1n,
          preparationDocument: 1n,
          document: 1n,
          metrics: 1n,
          device: 1n,
          nodes: [node],
          blobs: [{ type: 1, handle: node.node, bytes: encodeUtf8(text) }],
        };
        const result = content.measure(scene);
        assert.equal(result.geometry.revision, 2n);
        assert.ok(result.geometry.caret.height > 0);
        assert.ok(Number.isFinite(result.geometry.caret.x));
        if (text) assert.ok(result.geometry.selection.length > 0);
        if (text.endsWith('\n')) assert.ok(result.geometry.caret.y > 0);
        const packet = content.prepare(scene, false);
        assert.equal(packet.pictures.length, 0);
        assert.equal(packet.texts.length, 1);
        render.import(packet);
        render.retireExcept(0n);
      }
    } finally {
      content.close();
      render.close();
    }
    assert.equal(content.counters.liveParagraphs, 0);
    assert.equal(render.counters.livePictures, 0);
  },
);
