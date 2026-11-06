import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import './material-slider-render.mjs';
// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import {
  protocol as p,
  packet,
  response,
  encodeUtf8,
  body,
  EngineClient,
  measurementBody,
} from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import {
  SizedBox,
  ColoredBox,
  Align,
  Row,
  Stack,
  Text,
  ClipRect,
  Transform,
  Padding,
} from '@nelyx/core/framework/widgets/basic';
import {
  CompositedTransformTarget,
  CompositedTransformFollower,
} from '@nelyx/core/framework/widgets/composited-transform';
import { LayerLink } from '@nelyx/core/framework/rendering/layer';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import {
  ClipRect as CanonicalClipRect,
  ClipRRect,
  ClipOval,
  ClipPath,
} from '@nelyx/core/framework/widgets/clip';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect as SourceRect } from '@nelyx/core/ui/rect';
import { TextHeightBehavior, FontWeight } from '@nelyx/core/ui/typography';
import { webParagraphStyle } from '../../skia/packages/web/src/text-style.ts';
import { preparedTransfers } from '../platform/web/actors.ts';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import { wasmFactory } from './transports.mjs';
import { exchange, sessionOwner } from '../platform/web/common.ts';
import { ProviderBudget } from '../platform/web/memory.ts';
const require = createRequire(import.meta.url),
  { js: canvasKitJS, wasm: canvasKitWasm } = canvasKitTestSupply();
class HyphenText extends Text {
  constructor(value, options) {
    const { hyphens, ...rest } = options;
    super(value, rest);
    this.hyphens = hyphens;
  }
  configure(render, context) {
    super.configure(render, context);
    render.config = {
      ...render.config,
      painterOptions: { ...render.config.painterOptions, hyphens: this.hyphens },
    };
  }
}

for (const profile of ['single-worker', 'threaded'])
  test(
    `Original C++ text, alignment, RTL, links and conditional clips produce actual CanvasKit pixels (${profile})`,
    { timeout },
    async () => {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(engineRoot, 'dist/engine-manifest.json')))
          .sourceSha256,
        sourceIdentity(),
      );
      const factory = await wasmFactory(path.join(engineRoot, 'dist', profile));
      const client = await EngineClient.connect(factory.create()),
        view = await client.openView(1),
        host = new OriginalWidgetHost(view, { pollEvents: false });
      const initialize = require(canvasKitJS),
        wasmBinary = fs.readFileSync(canvasKitWasm),
        ck = await initialize({ wasmBinary }),
        renderKit = profile === 'single-worker' ? ck : await initialize({ wasmBinary }),
        font = new Uint8Array(
          fs.readFileSync(
            path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
          ),
        ),
        fonts = [
          { id: 'default', family: 'NelyxDefault', bytes: font },
          ...[
            ['NotoNaskhArabic-Regular.ttf', 'NelyxArabic'],
            ['NotoSansHebrew.ttf', 'NelyxHebrew'],
            ['NotoColorEmoji.ttf', 'NelyxEmoji'],
          ].map(([file, family]) => ({
            id: file,
            family,
            bytes: new Uint8Array(
              fs.readFileSync(
                path.resolve(engineRoot, '../sdk/tooling/cli/templates/nelyx-app/assets', file),
              ),
            ),
          })),
        ],
        content = new CanvasKitProvider(ck, fonts),
        render = profile === 'single-worker' ? content : new CanvasKitProvider(renderKit, fonts);
      let time = 0,
        mounted = false;
      render.surface = renderKit.MakeSurface(100, 80);
      render.resize = () => {};
      assert.ok(render.surface);
      const child = (width, height, color) =>
        new SizedBox(width, height, new ColoredBox({ color }));
      const stack = (clipBehavior) =>
        new SizedBox(
          40,
          40,
          new Stack([child(20, 10, 0xffff0000), child(10, 15, 0xff00ff00)], {
            alignment: { x: 2, y: 0 },
            clipBehavior,
          }),
        );
      const paint = async (root) => {
        if (mounted) await host.update(root);
        else {
          mounted = true;
          await host.mount(root);
        }
        let state;
        for (let i = 0; i < 30; ++i) {
          state = await view.request(
            p.opcodes.contentStep,
            body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
          );
          if (state.measureRequest) {
            const request = await view.request(p.opcodes.measureRequest);
            assert.equal(
              (
                await view.request(
                  p.opcodes.measureResult,
                  measurementBody(request, content.measure(request)),
                )
              ).status,
              p.statuses.ok,
            );
          }
          if (state.preparationReady) break;
        }
        assert.equal(state.preparationReady, true);
        const scene = await view.request(p.opcodes.preparationScene);
        assert.equal(scene.status, p.statuses.ok);
        const prepared = content.prepare(scene, profile === 'single-worker');
        if (render !== content)
          render.import(structuredClone(prepared, { transfer: preparedTransfers(prepared) }));
        await view.request(
          p.opcodes.tick,
          body(8, (v) => v.setFloat64(0, (time += 0.01), true)),
        );
        const frame = await view.request(p.opcodes.takeFrame);
        assert.equal(frame.status, p.statuses.ok);
        render.draw(frame, 100, 80, 1);
        render.retireExcept(frame.activePreparation);
        content.releasePacket(scene.preparation);
        const image = render.surface.makeImageSnapshot();
        let pixels;
        try {
          pixels = image
            .readPixels(0, 0, {
              width: 100,
              height: 80,
              colorType: renderKit.ColorType.RGBA_8888,
              alphaType: renderKit.AlphaType.Premul,
              colorSpace: renderKit.ColorSpace.SRGB,
            })
            .slice();
        } finally {
          image.delete();
        }
        const receipt = body(24, (v) => {
          v.setBigUint64(0, frame.submission, true);
          v.setBigUint64(8, frame.device, true);
        });
        assert.equal((await view.request(p.opcodes.releaseFrame, receipt)).status, p.statuses.ok);
        assert.equal((await view.request(p.opcodes.publish, receipt)).status, p.statuses.ok);
        return {
          frame,
          pixels,
          pixel: (x, y) => Array.from(pixels.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 3)),
        };
      };
      const reference = (value, options, width, height, loose) => {
        const fontProvider = renderKit.TypefaceFontProvider.Make(),
          surface = renderKit.MakeSurface(100, 80);
        let builder, paragraph, snapshot;
        try {
          for (const input of fonts) fontProvider.registerFont(input.bytes, input.family);
          builder = renderKit.ParagraphBuilder.MakeFromFontProvider(
            webParagraphStyle(
              renderKit,
              {
                font: { id: 'reference', generation: 1 },
                text: value,
                fontSize: 14,
                locale: options.locale ?? 'en',
                color: options.color,
                direction: options.direction ?? 'ltr',
                textAlign: options.textAlign ?? 'start',
                unlimitedLines: !options.maxLines,
                maxLines: options.maxLines ?? 0,
                ellipsis: options.overflow === 'ellipsis' ? '…' : '',
                hyphens: options.hyphens ?? 'manual',
                style: new TextStyle(options.style).toRunStyle(),
                textHeightBehavior: options.textHeightBehavior,
              },
              'NelyxDefault',
              fonts.slice(1).map((font) => font.family),
            ),
            fontProvider,
          );
          builder.addText(value);
          paragraph = builder.build();
          const wraps = options.softWrap !== false || options.overflow === 'ellipsis';
          paragraph.layout(wraps ? width : Infinity);
          const maximum = paragraph.getMaxIntrinsicWidth(),
            minimum = loose ? 0 : width;
          if (!wraps) paragraph.layout(maximum);
          // TextPainter's content width precedes RenderParagraph's constrained box.
          const painterWidth = wraps
              ? Math.min(width, Math.max(minimum, maximum))
              : Math.max(minimum, maximum),
            boxWidth = loose ? painterWidth : width,
            boxHeight = loose ? Math.min(height, paragraph.getHeight()) : height,
            align = options.textAlign ?? 'start',
            rtl = options.direction === 'rtl',
            factor =
              align === 'center'
                ? 0.5
                : align === 'right' ||
                    (align === 'start' && rtl) ||
                    (align === 'end' && !rtl) ||
                    (align === 'justify' && rtl)
                  ? 1
                  : 0,
            offset = factor * (painterWidth - (wraps ? width : maximum)),
            canvas = surface.getCanvas();
          canvas.clear(renderKit.Color(244, 246, 250, 1));
          canvas.save();
          if (
            options.overflow !== 'visible' &&
            (painterWidth > boxWidth ||
              paragraph.getHeight() > boxHeight ||
              paragraph.didExceedMaxLines())
          )
            canvas.clipRect(
              renderKit.XYWHRect(0, 0, boxWidth, boxHeight),
              renderKit.ClipOp.Intersect,
              false,
            );
          canvas.drawParagraph(paragraph, offset, 0);
          canvas.restore();
          snapshot = surface.makeImageSnapshot();
          return {
            pixels: snapshot
              .readPixels(0, 0, {
                width: 100,
                height: 80,
                colorType: renderKit.ColorType.RGBA_8888,
                alphaType: renderKit.AlphaType.Premul,
                colorSpace: renderKit.ColorSpace.SRGB,
              })
              .slice(),
            width: boxWidth,
            height: boxHeight,
            baseline: paragraph.getAlphabeticBaseline(),
            offset,
          };
        } finally {
          snapshot?.delete();
          paragraph?.delete();
          builder?.delete();
          surface?.delete();
          fontProvider.delete();
        }
      };
      try {
        const initial = await view.request(p.opcodes.inspect);
        await view.request(
          p.opcodes.metrics,
          body(40, (v) => {
            v.setBigUint64(0, initial.metrics + 1n, true);
            v.setFloat64(8, 100, true);
            v.setFloat64(16, 80, true);
            v.setFloat64(24, 1, true);
            v.setBigUint64(32, initial.lastInput, true);
          }),
        );
        const coldText = '😀\u00ad😀\u00ad😀',
          coldOptions = { fontSize: 14, color: 0xffbc2341 },
          cold = await paint(new SizedBox(30, 60, new Text(coldText, coldOptions))),
          coldExpected = reference(coldText, coldOptions, 30, 60, false);
        assert.equal(
          cold.pixels.reduce(
            (count, value, index) => count + (value !== coldExpected.pixels[index] ? 1 : 0),
            0,
          ),
          0,
          'The first paragraph also transfers a generated soft-hyphen font without a warm font cache',
        );
        const aligned = await paint(
          new Align(child(20, 10, 0xffff0000), { alignment: { x: 0.5, y: -0.5 } }),
        );
        assert.deepEqual(aligned.pixel(65, 20), [255, 0, 0]);
        assert.deepEqual(aligned.pixel(50, 20), [244, 246, 250]);
        const link = new LayerLink();
        const linkedTree = (left = 10, linked = true, showWhenUnlinked = false) =>
          new Stack(
            [
              linked
                ? new Padding(
                    { left, top: 10 },
                    new CompositedTransformTarget(child(20, 10, 0xff0000ff), { link }),
                  )
                : new SizedBox(1, 1),
              new Padding(
                { left: 60, top: 50 },
                new CompositedTransformFollower(child(8, 6, 0xffff0000), {
                  link,
                  showWhenUnlinked,
                  targetAnchor: Alignment.bottomRight,
                  offset: { x: 2, y: 3 },
                }),
              ),
            ],
            {
              textDirection: 'ltr',
              alignment: Alignment.topLeft,
              fit: 'loose',
              clipBehavior: 'none',
            },
          );
        const linked = await paint(linkedTree());
        assert.deepEqual(
          linked.pixel(34, 25),
          [255, 0, 0],
          'Content positions follower replay at its leader anchor',
        );
        assert.deepEqual(
          linked.pixel(64, 54),
          [244, 246, 250],
          'The unlinked layout position does not paint while linked',
        );
        const movedLink = await paint(linkedTree(25));
        assert.deepEqual(movedLink.pixel(49, 25), [255, 0, 0]);
        assert.deepEqual(movedLink.pixel(34, 25), [244, 246, 250]);
        const hiddenLink = await paint(linkedTree(25, false));
        assert.deepEqual(hiddenLink.pixel(64, 54), [244, 246, 250]);
        const unlinked = await paint(linkedTree(25, false, true));
        assert.deepEqual(unlinked.pixel(64, 54), [255, 0, 0]);
        const rtl = await paint(
          new SizedBox(
            100,
            60,
            new Row([child(20, 10, 0xffff0000), child(30, 15, 0xff0000ff)], {
              textDirection: 'rtl',
              verticalDirection: 'up',
              crossAxisAlignment: 'start',
              spacing: 5,
            }),
          ),
        );
        assert.deepEqual(rtl.pixel(85, 55), [255, 0, 0]);
        assert.deepEqual(rtl.pixel(50, 50), [0, 0, 255]);
        const clipped = await paint(stack('hardEdge'));
        assert.deepEqual(clipped.pixel(35, 20), [255, 0, 0]);
        assert.deepEqual(clipped.pixel(45, 20), [244, 246, 250]);
        const open = await paint(stack('none'));
        assert.deepEqual(
          open.pixel(45, 20),
          [0, 255, 0],
          'Second source child paints above the first outside an unclipped Stack',
        );
        const referenceRect = (matrix, width, height, clip) => {
          const surface = renderKit.MakeSurface(100, 80),
            brush = new renderKit.Paint();
          let snapshot;
          try {
            const canvas = surface.getCanvas();
            canvas.clear(renderKit.Color(244, 246, 250, 1));
            if (clip)
              canvas.clipRect(
                renderKit.LTRBRect(0, 0, clip[0], clip[1]),
                renderKit.ClipOp.Intersect,
                true,
              );
            canvas.concat([
              matrix[0],
              matrix[2],
              matrix[4],
              matrix[1],
              matrix[3],
              matrix[5],
              0,
              0,
              1,
            ]);
            brush.setColor(renderKit.Color(255, 0, 0, 1));
            brush.setAntiAlias(true);
            canvas.drawRect(renderKit.LTRBRect(0, 0, width, height), brush);
            snapshot = surface.makeImageSnapshot();
            return snapshot
              .readPixels(0, 0, {
                width: 100,
                height: 80,
                colorType: renderKit.ColorType.RGBA_8888,
                alphaType: renderKit.AlphaType.Premul,
                colorSpace: renderKit.ColorSpace.SRGB,
              })
              .slice();
          } finally {
            snapshot?.delete();
            brush.delete();
            surface.delete();
          }
        };
        for (const [label, widget, matrix, width, height, clip] of [
          [
            'fractional-translation-inside-clip',
            new SizedBox(
              40,
              30,
              new ClipRect(
                Transform.translate(new ColoredBox({ color: 0xffff0000 }), { x: 10.5, y: 5.5 }),
              ),
            ),
            [1, 0, 0, 1, 10.5, 5.5],
            40,
            30,
            [40, 30],
          ],
          [
            'origin-and-center-rotation',
            new SizedBox(
              60,
              40,
              Transform.rotate(new ColoredBox({ color: 0xffff0000 }), Math.PI / 2, {
                origin: { x: 3, y: 4 },
              }),
            ),
            [0, 1, -1, 0, 57, -9],
            60,
            40,
          ],
          [
            'center-flip',
            new SizedBox(
              60,
              40,
              Transform.flip(new ColoredBox({ color: 0xffff0000 }), { flipX: true }),
            ),
            [-1, 0, 0, 1, 60, 0],
            60,
            40,
          ],
        ]) {
          const actual = await paint(widget),
            expected = referenceRect(matrix, width, height, clip);
          assert.equal(
            actual.pixels.reduce(
              (count, value, index) => count + (value !== expected[index] ? 1 : 0),
              0,
            ),
            0,
            label,
          );
        }
        const singular = await paint(
          new SizedBox(
            60,
            40,
            Transform.scale(new ColoredBox({ color: 0xffff0000 }), { scale: 0 }),
          ),
        );
        assert.ok(
          singular.pixels.every((value, index) => value === [244, 246, 250, 255][index % 4]),
          'Singular source transforms paint no child',
        );
        const corners = BorderRadius.only({
          topLeft: new Radius(25, 10),
          topRight: new Radius(4, 18),
          bottomRight: new Radius(20, 12),
          bottomLeft: new Radius(6, 4),
        });
        const referenceClip = (shape, behavior, border = corners) => {
          const surface = renderKit.MakeSurface(100, 80),
            brush = new renderKit.Paint(),
            layer = new renderKit.Paint();
          let snapshot, builder, path;
          try {
            const canvas = surface.getCanvas(),
              rect = renderKit.LTRBRect(0, 0, 60, 40),
              antiAlias = behavior !== 'hardEdge';
            canvas.clear(renderKit.Color(244, 246, 250, 1));
            canvas.translate(10.25, 8.75);
            canvas.save();
            if (behavior !== 'none') {
              if (shape === 'rect') canvas.clipRect(rect, renderKit.ClipOp.Intersect, antiAlias);
              else if (shape === 'rrect') {
                const r = border.toRRect(SourceRect.fromLTWH(0, 0, 60, 40));
                canvas.clipRRect(
                  Float32Array.from([
                    r.left,
                    r.top,
                    r.right,
                    r.bottom,
                    r.tlRadiusX,
                    r.tlRadiusY,
                    r.trRadiusX,
                    r.trRadiusY,
                    r.brRadiusX,
                    r.brRadiusY,
                    r.blRadiusX,
                    r.blRadiusY,
                  ]),
                  renderKit.ClipOp.Intersect,
                  antiAlias,
                );
              } else {
                builder = new renderKit.PathBuilder();
                if (shape === 'oval') builder.addOval(rect);
                else builder.addRect(rect);
                path = builder.detach();
                canvas.clipPath(path, renderKit.ClipOp.Intersect, antiAlias);
              }
              if (behavior === 'antiAliasWithSaveLayer') canvas.saveLayer(layer, rect);
            }
            brush.setAntiAlias(true);
            brush.setColor(renderKit.Color(255, 0, 0, 1));
            canvas.drawRect(rect, brush);
            canvas.save();
            canvas.translate(20.25, 10.25);
            brush.setColor(renderKit.Color(0, 0, 255, 1));
            canvas.drawRect(rect, brush);
            canvas.restore();
            if (behavior === 'antiAliasWithSaveLayer') canvas.restore();
            canvas.restore();
            snapshot = surface.makeImageSnapshot();
            return snapshot
              .readPixels(0, 0, {
                width: 100,
                height: 80,
                colorType: renderKit.ColorType.RGBA_8888,
                alphaType: renderKit.AlphaType.Premul,
                colorSpace: renderKit.ColorSpace.SRGB,
              })
              .slice();
          } finally {
            snapshot?.delete();
            path?.delete();
            builder?.delete();
            brush.delete();
            layer.delete();
            surface.delete();
          }
        };
        const payload = () =>
          new Stack(
            [
              new ColoredBox({ color: 0xffff0000 }),
              Transform.translate(new ColoredBox({ color: 0xff0000ff }), { x: 20.25, y: 10.25 }),
            ],
            { fit: 'expand', clipBehavior: 'none', textDirection: 'ltr' },
          );
        for (const [Type, shape] of [
          [CanonicalClipRect, 'rect'],
          [ClipRRect, 'rrect'],
          [ClipOval, 'oval'],
          [ClipPath, 'path'],
        ])
          for (const behavior of ['none', 'hardEdge', 'antiAlias', 'antiAliasWithSaveLayer']) {
            const widget = new Type(payload(), {
                clipBehavior: behavior,
                ...(Type === ClipRRect ? { borderRadius: corners } : {}),
              }),
              actual = await paint(
                Transform.translate(new SizedBox(60, 40, widget), { x: 10.25, y: 8.75 }),
              ),
              expected = referenceClip(shape, behavior);
            assert.equal(
              actual.pixels.reduce(
                (count, value, index) => count + (value !== expected[index] ? 1 : 0),
                0,
              ),
              0,
              shape + '/' + behavior + ' matches canonical clip data and save-layer ordering',
            );
          }
        const text = (overflow) =>
          new SizedBox(80, 12, new Text('한 M\nM', { fontSize: 18, color: 0xffbc2341, overflow }));
        const ink = (result, begin, end) => {
          let count = 0;
          for (let y = begin; y < end; ++y)
            for (let x = 0; x < 80; ++x) {
              const offset = (y * 100 + x) * 4;
              if (
                result.pixels[offset] !== 244 ||
                result.pixels[offset + 1] !== 246 ||
                result.pixels[offset + 2] !== 250
              )
                ++count;
            }
          return count;
        };
        const clippedText = await paint(text('clip')),
          textNode = clippedText.frame.nodes.find((node) => node.kind === p.kinds.paragraph);
        assert.ok(textNode.baseline > 0 && textNode.height === 12 && textNode.width === 80);
        assert.ok(textNode.flags & p.nodeFlags.hardEdgeClip);
        assert.ok(ink(clippedText, 0, 12) > 0, 'Actual bundled font glyphs paint inside the box');
        assert.equal(ink(clippedText, 12, 70), 0);
        const visibleText = await paint(text('visible'));
        assert.ok(
          ink(visibleText, 12, 70) > 0,
          'Visible paragraph overflow paints outside its box',
        );
        assert.deepEqual(
          clippedText.pixels.slice(0, 12 * 100 * 4),
          visibleText.pixels.slice(0, 12 * 100 * 4),
          'Overflow clipping preserves glyph pixels within the original text box',
        );
        let finalFrame = visibleText.frame,
          finalPixels = visibleText.pixels;
        for (const [label, value, extra, width, height, loose] of [
          [
            'ellipsis',
            'Alpha beta gamma delta epsilon',
            { overflow: 'ellipsis', maxLines: 1, textAlign: 'end', locale: 'ko' },
            100,
            60,
            false,
          ],
          ['rtl-loose', 'AB', { direction: 'rtl', textAlign: 'start' }, 100, 80, true],
          ['soft-hyphen', 'hy\u00adphen\u00adation', {}, 48, 60, false],
          [
            'soft-hyphen-arabic',
            'مر\u00adحبامر\u00adحبا',
            { direction: 'rtl', locale: 'ar' },
            48,
            60,
            false,
          ],
          ['soft-hyphen-emoji', '😀\u00ad😀\u00ad😀', {}, 30, 60, false],
          [
            'wide-glyph',
            '한',
            { overflow: 'visible', style: { fontSize: 96, height: 1.5 } },
            40,
            60,
            false,
          ],
          ['soft-hyphen-hidden', 'hy\u00adphen\u00adation', { hyphens: 'hidden' }, 48, 60, false],
          [
            'nowrap-short',
            'AB',
            { textAlign: 'right', softWrap: false, overflow: 'visible' },
            100,
            60,
            false,
          ],
          [
            'nowrap',
            'Alpha beta gamma delta',
            { direction: 'rtl', textAlign: 'center', softWrap: false, overflow: 'visible' },
            40,
            60,
            false,
          ],
          [
            'hebrew',
            'שלום 123 A',
            { direction: 'rtl', textAlign: 'justify', locale: 'he' },
            100,
            60,
            false,
          ],
          [
            'arabic',
            'مرحبا ABC',
            { direction: 'rtl', textAlign: 'right', locale: 'ar' },
            100,
            60,
            false,
          ],
          ['emoji', '😀 👩‍💻', {}, 100, 60, false],
          [
            'medium-fallback',
            '한 A',
            {
              style: { fontSize: 18, fontFamily: 'Missing font 字体', fontWeight: FontWeight.w500 },
            },
            100,
            60,
            false,
          ],
          [
            'bold-variable',
            '한 A',
            { style: { fontSize: 18, fontWeight: FontWeight.w900 } },
            100,
            60,
            false,
          ],
          [
            'height-behavior',
            'Alpha\tbeta\n한글',
            {
              textHeightBehavior: new TextHeightBehavior({
                applyHeightToFirstAscent: false,
                applyHeightToLastDescent: false,
                leadingDistribution: 'proportional',
              }),
            },
            100,
            60,
            false,
          ],
        ]) {
          const options = {
              color: 0xffbc2341,
              style: {
                fontSize: 14,
                height: 1.5,
                letterSpacing: 1,
                wordSpacing: 2,
                leadingDistribution: 'even',
              },
              ...extra,
            },
            expected = reference(value, options, width, height, loose),
            child = options.hyphens
              ? new HyphenText(value, { ...options, style: new TextStyle(options.style) })
              : new Text(value, { ...options, style: new TextStyle(options.style) }),
            actual = await paint(
              loose
                ? new Align(child, { widthFactor: 1, heightFactor: 1 })
                : new SizedBox(width, height, child),
            ),
            row = actual.frame.nodes.find((n) => n.kind === p.kinds.paragraph);
          for (const [field, want] of [
            ['width', expected.width],
            ['height', expected.height],
            ['baseline', expected.baseline],
          ])
            assert.ok(
              Math.abs(row[field] - want) < 1e-5,
              `${profile}/${label}: ${field} ${row[field]} != canonical ${want}`,
            );
          const errors = actual.pixels.reduce(
            (n, value, i) => n + (value !== expected.pixels[i] ? 1 : 0),
            0,
          );
          assert.equal(
            errors,
            0,
            `${profile}/${label}: C++/provider differs from the canonical paragraph adapter`,
          );
          finalFrame = actual.frame;
          finalPixels = actual.pixels;
        }
        assert.ok(render.counters.liveFontVariations <= render.counters.fontVariationLimit);
        render.setMemoryPressure(true);
        assert.equal(render.counters.liveFontVariations, 0);
        render.draw(finalFrame, 100, 80, 1);
        const pressureSnapshot = render.surface.makeImageSnapshot();
        try {
          assert.deepEqual(
            pressureSnapshot.readPixels(0, 0, {
              width: 100,
              height: 80,
              colorType: renderKit.ColorType.RGBA_8888,
              alphaType: renderKit.AlphaType.Premul,
              colorSpace: renderKit.ColorSpace.SRGB,
            }),
            finalPixels,
            'Pressure releases variation wrappers while retained glyph pictures remain valid',
          );
        } finally {
          pressureSnapshot.delete();
        }
        render.setMemoryPressure(false);
        assert.ok(content.counters.measurements > 0 && content.counters.paragraphLayouts > 0);
        assert.equal(finalFrame.transactionWork, BigInt(host.counters.commands));
        assert.ok(finalFrame.transactionWork > 0n && finalFrame.layoutWork > 0n);
        assert.equal(host.execution.tsLayoutFallbacks, 0);
      } finally {
        content.close();
        if (render !== content) render.close();
        await host.close();
        await client.abort();
      }
      for (const provider of new Set([content, render])) {
        assert.equal(provider.counters.livePictures, 0);
        assert.equal(provider.recorded.size, 0);
        assert.equal(provider.counters.cachedContentBytes, 0);
        assert.equal(provider.regularTypefaces.size, 0);
      }
    },
  );

for (const sharedOwner of [true, false])
  test(
    `Preparation reuse preserves pixels, transferred ownership, invalidation and failure cleanup (${sharedOwner ? 'single-worker' : 'threaded'})`,
    { timeout },
    async () => {
      const init = require(canvasKitJS),
        wasmBinary = fs.readFileSync(canvasKitWasm),
        ck = await init({ wasmBinary }),
        renderKit = sharedOwner ? ck : await init({ wasmBinary }),
        font = new Uint8Array(
          fs.readFileSync(
            path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
          ),
        ),
        content = new CanvasKitProvider(ck, font),
        render = sharedOwner ? content : new CanvasKitProvider(renderKit, font),
        cold = new CanvasKitProvider(renderKit, font);
      const image = (color) => {
        const surface = ck.MakeSurface(4, 4);
        try {
          surface.getCanvas().clear(color);
          const snapshot = surface.makeImageSnapshot();
          try {
            return snapshot.encodeToBytes().slice();
          } finally {
            snapshot.delete();
          }
        } finally {
          surface.delete();
        }
      };
      const red = image(ck.RED),
        green = image(ck.GREEN),
        h = (slot) => ({ slot, generation: 1 }),
        node = (slot, kind, x, extra = {}) => ({
          node: h(slot),
          parent: h(0),
          resource: h(0),
          kind: p.kinds[kind],
          width: 90,
          height: 42,
          matrix: [1, 0, 0, 1, x, 0],
          depth: 0,
          color: 0xff172033,
          radius: 0,
          fontSize: 18,
          textDirection: 0,
          flags: 16,
          clip: { x: 0, y: 0, width: 300, height: 60 },
          localOpacity: 1,
          opacity: 1,
          ...extra,
        });
      let generation = 0n;
      const scene = {
        preparation: 0n,
        preparationDocument: 1n,
        activePreparation: 0n,
        metrics: 1n,
        device: 1n,
        fontRevision: 1n,
        nodes: [
          node(1, 'paragraph', 0),
          node(2, 'image', 100, { resource: h(1) }),
          node(3, 'box', 200),
        ],
        blobs: [
          { type: 1, handle: h(1), bytes: encodeUtf8('한글 A') },
          { type: 2, handle: h(1), bytes: red },
        ],
      };
      const next = () => {
        scene.preparation = scene.activePreparation = ++generation;
        return scene;
      };
      const pixels = (provider) => {
        const snapshot = provider.surface.makeImageSnapshot();
        try {
          return snapshot
            .readPixels(0, 0, {
              width: 300,
              height: 60,
              colorType: provider.ck.ColorType.RGBA_8888,
              alphaType: provider.ck.AlphaType.Premul,
              colorSpace: provider.ck.ColorSpace.SRGB,
            })
            .slice();
        } finally {
          snapshot.delete();
        }
      };
      const paint = () => {
        const packet = content.prepare(next(), sharedOwner);
        if (!sharedOwner) {
          const buffers = preparedTransfers(packet);
          render.import(structuredClone(packet, { transfer: buffers }));
          assert.ok(
            buffers.every((buffer) => buffer.byteLength === 0),
            'Outgoing buffers are detached while the Content cache keeps its own bytes',
          );
        }
        render.draw(scene, 300, 60, 1);
        render.retireExcept(scene.preparation);
        content.releasePacket(scene.preparation);
        return pixels(render);
      };
      const compareCold = (actual) => {
        cold.trimCache();
        cold.retireExcept(0n);
        cold.import(cold.prepare(scene, false));
        cold.releasePacket(scene.preparation);
        cold.draw(scene, 300, 60, 1);
        assert.deepEqual(
          actual,
          pixels(cold),
          'Reused records match a full preparation pixel for pixel',
        );
      };
      try {
        render.surface = renderKit.MakeSurface(300, 60);
        render.resize = () => {};
        cold.surface = renderKit.MakeSurface(300, 60);
        cold.resize = () => {};
        paint();
        const before = { ...content.counters };
        scene.nodes[2].color = 0xff2266cc;
        compareCold(paint());
        assert.equal(content.counters.pictures - before.pictures, 1);
        assert.equal(content.counters.paragraphLayouts, before.paragraphLayouts);
        assert.equal(content.counters.images, before.images);
        assert.equal(content.counters.reusedParagraphs - before.reusedParagraphs, 1);
        assert.equal(content.counters.reusedImages - before.reusedImages, 1);
        assert.equal(content.recorded.size, 3);
        assert.ok(
          content.counters.cachedContentBytes > 0 &&
            content.counters.cachedContentBytes <= 16 * 1024 * 1024,
        );
        const stable = pixels(render),
          retained = content.counters.cachedContentBytes,
          live = content.counters.livePictures;
        scene.nodes[0].fontSize = 20;
        scene.blobs[1].bytes = new Uint8Array([0, 1, 2]);
        assert.throws(() => content.prepare(next(), sharedOwner), /Image decode failed/);
        assert.equal(content.counters.cachedContentBytes, retained);
        assert.equal(
          content.counters.livePictures,
          live,
          'Failed provisional cache entries release their Picture holds',
        );
        scene.nodes[0].fontSize = 18;
        scene.blobs[1].bytes = green;
        const imageBefore = content.counters.images;
        compareCold(paint());
        assert.equal(
          content.counters.images,
          imageBefore + 1,
          'Changed resource bytes invalidate even a reused resource handle',
        );
        assert.notDeepEqual(pixels(render), stable);
        for (const field of ['metrics', 'device', 'fontRevision']) {
          const previous = { ...content.counters };
          ++scene[field];
          compareCold(paint());
          assert.equal(
            content.counters.pictures,
            previous.pictures + 3,
            field + ' invalidates the complete preparation cache',
          );
          assert.equal(content.counters.paragraphLayouts, previous.paragraphLayouts + 1);
          assert.equal(content.counters.images, previous.images + 1);
        }
        const active = pixels(render);
        content.setMemoryPressure(true);
        if (render !== content) render.setMemoryPressure(true);
        assert.equal(content.counters.cachedContentBytes, 0);
        assert.equal(content.counters.gpuCacheLimitBytes, 4 * 1024 * 1024);
        render.draw(scene, 300, 60, 1);
        assert.deepEqual(
          pixels(render),
          active,
          'Cache eviction preserves active publication holds',
        );
        compareCold(paint());
        assert.equal(
          content.counters.cachedContentBytes,
          0,
          'Low pressure admission remains disabled during a successful new preparation',
        );
        content.setMemoryPressure(false);
        if (render !== content) render.setMemoryPressure(false);
        compareCold(paint());
        assert.ok(
          content.counters.cachedContentBytes > 0,
          'Normal admission resumes after pressure clears',
        );
      } finally {
        content.close();
        if (render !== content) render.close();
        cold.close();
      }
      for (const provider of new Set([content, render, cold])) {
        assert.equal(provider.counters.livePictures, 0);
        assert.equal(provider.counters.cachedContentBytes, 0);
        assert.equal(provider.pictureOwners.size, 0);
        assert.equal(provider.recorded.size, 0);
      }
    },
  );

test(
  'Real provider backing admission preserves its surface and drains unified reservations on rejection',
  { timeout },
  async () => {
    const { module } = await wasmFactory(path.join(engineRoot, 'dist/single-worker')),
      engine = module._nelyx_wasm_open(1, 1, p.schema, 15),
      budget = new ProviderBudget(module, engine, 2),
      ck = await require(canvasKitJS)({
        wasmBinary: fs.readFileSync(canvasKitWasm),
      });
    let provider, cache;
    const state = () => response(exchange(module, engine, packet(p.opcodes.inspect, sessionOwner)));
    try {
      provider = new CanvasKitProvider(
        ck,
        new Uint8Array(
          fs.readFileSync(
            path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
          ),
        ),
        budget,
      );
      const surface = ck.MakeSurface(64, 64),
        canvas = { width: 64, height: 64, getContext: () => null };
      assert.ok(surface);
      provider.surface = surface;
      provider.canvas = canvas;
      cache = budget.reserve(3, 32 * 1024 * 1024);
      const before = state();
      assert.ok(before.memory.engineHeap > 0n && before.memory.providerHeap > 0n);
      assert.throws(() => provider.resize(4096, 4096, 1), /Unified memory budget rejected/);
      const after = state();
      assert.equal(after.memory.total, before.memory.total);
      assert.equal(after.memory.gpu, before.memory.gpu);
      assert.equal(after.memory.rejected, before.memory.rejected + 1n);
      assert.equal(provider.surface, surface);
      assert.deepEqual([canvas.width, canvas.height], [64, 64]);
      surface.getCanvas().clear(ck.Color(20, 40, 60, 1));
      surface.flush();
      const image = surface.makeImageSnapshot();
      try {
        assert.equal(
          image.width(),
          64,
          'The retained surface remains usable after a rejected replacement',
        );
      } finally {
        image.delete();
      }
      const paintScene = {
        preparation: 1n,
        preparationDocument: 1n,
        metrics: 1n,
        device: 1n,
        fontRevision: 1n,
        blobs: [],
        nodes: [
          {
            node: { slot: 1, generation: 1 },
            kind: p.kinds.box,
            width: 24,
            height: 24,
            color: 0xff336699,
            radius: 0,
          },
        ],
      };
      const preparePacket = () => {
        const prepared = provider.prepare(paintScene, false);
        try {
          provider.import(structuredClone(prepared, { transfer: preparedTransfers(prepared) }));
          provider.retireExcept(0n);
        } finally {
          provider.releasePacket(paintScene.preparation);
        }
      };
      const cpuBefore = state().memory.cpu;
      const narrowHeadroom = budget.reserve(
        5,
        Number(state().memory.limit - state().memory.total) - 8 * 1024 * 1024,
      );
      try {
        preparePacket();
        assert.ok(
          state().memory.total <= state().memory.limit,
          'An actual small preparation uses available headroom without reserving the full transport ceiling twice',
        );
      } finally {
        narrowHeadroom();
      }
      assert.ok(
        state().memory.cpu > cpuBefore,
        'Retained transport records reserve bytes in the actual C++ session ledger',
      );
      provider.setMemoryPressure(true);
      assert.equal(
        state().memory.cpu,
        cpuBefore,
        'Cache pressure returns the held external account',
      );
      ++paintScene.preparation;
      preparePacket();
      assert.equal(provider.counters.cachedContentBytes, 0);
      assert.equal(state().memory.cpu, cpuBefore);
      provider.setMemoryPressure(false);
      ++paintScene.preparation;
      preparePacket();
      assert.ok(state().memory.cpu > cpuBefore);
      provider.setMemoryPressure(true);
      const base = {
          width: 64,
          height: 64,
          radius: 0,
          localOpacity: 1,
          opacity: 1,
          clip: { x: 0, y: 0, width: 64, height: 64 },
          matrix: [1, 0, 0, 1, 0, 0],
          graphics: null,
        },
        layerScene = {
          ...paintScene,
          preparation: 10n,
          activePreparation: 10n,
          preparationDocument: 10n,
          nodes: [
            {
              ...base,
              node: { slot: 3, generation: 1 },
              kind: p.kinds.clip,
              color: 0,
              depth: 0,
              flags: 16 | p.nodeFlags.clipsChildren | p.nodeFlags.clipSaveLayer,
              clipStyle: {
                shape: 'oval',
                behavior: 'antiAliasWithSaveLayer',
                radii: [0, 0, 0, 0, 0, 0, 0, 0],
              },
            },
            {
              ...base,
              node: { slot: 4, generation: 1 },
              kind: p.kinds.box,
              color: 0xffff0000,
              depth: 1,
              flags: 16,
              clipStyle: null,
            },
          ],
        };
      provider.prepare(layerScene, true);
      const originalResize = provider.resize.bind(provider);
      let resizeCalls = 0;
      provider.resize = (...args) => {
        ++resizeCalls;
        originalResize(...args);
      };
      const drawHeadroom = budget.reserve(
        5,
        Number(state().memory.limit - state().memory.total) - 2 * 1024 * 1024,
      );
      try {
        const beforeLayer = state();
        assert.throws(
          () => provider.draw(layerScene, 1024, 1024, 1),
          /Unified memory budget rejected.*kind=3/,
        );
        assert.equal(resizeCalls, 0, 'Clip save-layer admission precedes resize and drawing');
        assert.equal(state().memory.gpu, beforeLayer.memory.gpu);
        assert.equal(state().memory.total, beforeLayer.memory.total);
        assert.equal(provider.surface, surface);
      } finally {
        drawHeadroom();
      }
      const gpuBeforeDraw = state().memory.gpu;
      provider.draw(layerScene, 64, 64, 1);
      assert.equal(
        state().memory.gpu,
        gpuBeforeDraw,
        'Successful clip-layer drawing returns its transient account',
      );
      const layerImage = surface.makeImageSnapshot();
      try {
        const pixels = layerImage.readPixels(0, 0, {
          width: 64,
          height: 64,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        });
        assert.deepEqual(
          Array.from(pixels.slice((32 * 64 + 32) * 4, (32 * 64 + 32) * 4 + 3)),
          [255, 0, 0],
        );
      } finally {
        layerImage.delete();
      }
      provider.retireExcept(0n);
      provider.releasePacket(layerScene.preparation);
      cache();
      cache = undefined;
      provider.close();
      provider = undefined;
      const closed = response(
        exchange(module, engine, packet(p.opcodes.closeSession, sessionOwner)),
      );
      assert.equal(closed.status, p.statuses.ok);
      assert.equal(closed.reservedBytes, 0n);
      assert.equal(closed.memory.providerHeap, 0n);
      assert.equal(closed.memory.gpu, 0n);
      assert.equal(closed.memory.staging, 0n);
      assert.equal(
        closed.memory.total,
        closed.memory.engineHeap,
        'Only the still-live engine Wasm heap remains until worker teardown',
      );
      assert.ok(closed.memory.peak <= closed.memory.limit);
    } finally {
      cache?.();
      provider?.close();
      module._nelyx_engine_destroy(engine);
    }
  },
);
test(
  'Retained public Pictures preserve path/round clips, rotation, subtree opacity, shadow and blur pixels',
  { timeout },
  async () => {
    const ck = await require(canvasKitJS)({
      wasmBinary: fs.readFileSync(canvasKitWasm),
    });
    const font = new Uint8Array(
        fs.readFileSync(
          path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/assets/NotoSansKR.ttf'),
        ),
      ),
      content = new CanvasKitProvider(ck, font),
      render = new CanvasKitProvider(ck, font),
      surface = ck.MakeSurface(180, 180);
    assert.ok(surface);
    render.surface = surface;
    render.resize = () => {};
    const h = (slot) => ({ slot, generation: 1 }),
      triangle = [['move', 0, 0], ['line', 100, 0], ['quad', 100, 100, 0, 100], ['close']];
    const node = (slot, kind, width, height, matrix, depth, color, extra = {}) => ({
      node: h(slot),
      parent: h(0),
      kind: p.kinds[kind],
      width,
      height,
      matrix,
      depth,
      color,
      flags: 16,
      clip: { x: 0, y: 0, width: 180, height: 180 },
      localOpacity: 1,
      opacity: 1,
      radius: 0,
      resource: h(0),
      ...extra,
    });
    const nodes = [
      node(1, 'clip', 100, 100, [1, 0, 0, 1, 10, 10], 0, 0, { radius: 24 }),
      node(2, 'path', 100, 100, [1, 0, 0, 1, 10, 10], 1, 0xffff0000, {
        graphics: { hasPath: true, path: triangle, fillRule: 'winding' },
      }),
      node(3, 'box', 30, 40, [0, 1, -1, 0, 160, 10], 0, 0xff0000ff),
      node(4, 'box', 50, 50, [1, 0, 0, 1, 85, 85], 0, 0, { localOpacity: 0.5 }),
      node(5, 'box', 40, 40, [1, 0, 0, 1, 85, 85], 1, 0xffff0000),
      node(6, 'box', 40, 40, [1, 0, 0, 1, 95, 95], 1, 0xff00ff00),
      node(7, 'effect', 20, 20, [1, 0, 0, 1, 10, 135], 0, 0, { graphics: { blur: 3 } }),
      node(8, 'box', 20, 20, [1, 0, 0, 1, 10, 135], 1, 0xff000000),
      node(9, 'box', 20, 20, [1, 0, 0, 1, 145, 115], 0, 0xffff0000, {
        graphics: {
          shadow: { x: 8, y: 0, sigma: 0, color: 0xff000000 },
          stroke: { color: 0xff00ff00, width: 2 },
        },
      }),
    ];
    try {
      const scene = {
        preparation: 1n,
        activePreparation: 1n,
        preparationDocument: 1n,
        metrics: 1n,
        device: 1n,
        blobs: [],
        nodes,
      };
      const packet = content.prepare(scene, false);
      assert.equal(packet.paths.length, 1);
      assert.ok(packet.pictures.every((record) => record.bytes.byteLength > 0));
      render.import(packet);
      render.draw(scene, 180, 180, 1);
      const snapshot = surface.makeImageSnapshot();
      let pixels;
      try {
        pixels = snapshot.readPixels(0, 0, {
          width: 180,
          height: 180,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        });
      } finally {
        snapshot.delete();
      }
      const pixel = (x, y) => Array.from(pixels.slice((y * 180 + x) * 4, (y * 180 + x) * 4 + 3)),
        background = [244, 246, 250];
      assert.deepEqual(pixel(11, 11), background, 'Rounded ancestor removes the path corner');
      assert.deepEqual(pixel(35, 35), [255, 0, 0], 'Prepared quadratic path fills its interior');
      assert.deepEqual(
        pixel(108, 108),
        [122, 251, 125],
        'Subtree opacity composites the overlap once',
      );
      assert.deepEqual(
        pixel(130, 20),
        [0, 0, 255],
        'Rotation changes actual picture replay coordinates',
      );
      assert.deepEqual(
        pixel(169, 125),
        [0, 0, 0],
        'Shadow survives outside the local paint bounds',
      );
      assert.deepEqual(pixel(145, 125), [0, 255, 0], 'Declared stroke is retained in the Picture');
      assert.ok(
        pixel(8, 145)[0] < 244 && pixel(8, 145)[0] > 0,
        'Subtree blur expands beyond the child',
      );
      assert.deepEqual(pixel(0, 145), background, 'Blur remains spatially bounded');
      const tiny = {
        ...scene,
        preparation: 2n,
        activePreparation: 2n,
        preparationDocument: 2n,
        nodes: [
          node(20, 'transform', 1e8, 1e8, [1e-7, 0, 0, 1e-7, 10, 10], 0, 0),
          node(21, 'box', 1e8, 1e8, [1e-7, 0, 0, 1e-7, 10, 10], 1, 0xffff0000),
        ],
      };
      render.import(content.prepare(tiny, false));
      render.draw(tiny, 180, 180, 1);
      const tinySnapshot = surface.makeImageSnapshot();
      try {
        const tinyPixels = tinySnapshot.readPixels(0, 0, {
          width: 180,
          height: 180,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        });
        assert.deepEqual(
          Array.from(tinyPixels.slice((15 * 180 + 15) * 4, (15 * 180 + 15) * 4 + 3)),
          [255, 0, 0],
          'A small invertible transform and its relative child matrix still paint visible vector geometry',
        );
        assert.deepEqual(
          Array.from(tinyPixels.slice((15 * 180 + 25) * 4, (15 * 180 + 25) * 4 + 3)),
          background,
        );
      } finally {
        tinySnapshot.delete();
      }
      render.retireExcept(0n);
      assert.equal(render.tables.size, 0);
      assert.equal(render.pathTables.size, 0);
    } finally {
      content.close();
      render.close();
    }
  },
);
