// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { WebSkiaLibrary } from '../../skia/packages/web/src/library.ts';
import {
  EngineClient,
  WidgetHost,
  Box,
  protocol as p,
  body,
} from '../../runtime/engine-client/index.ts';
import { nativeMaterialSliderIndicator } from '../../../packages/material/dist/internal/slider/native-paint.js';
import { SliderThemeData } from '@nelyx/material/slider-theme';
import {
  DropSliderValueIndicatorShape,
  RoundedRectSliderValueIndicatorShape,
  RoundedRectSliderTrackShape,
  RoundSliderThumbShape,
  RoundSliderOverlayShape,
} from '@nelyx/material/slider-shapes';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import { Size } from '@nelyx/core/ui/size';
import { Offset } from '@nelyx/core/ui/offset';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Paint } from '@nelyx/core/ui/paint';
import { Color } from '@nelyx/core/ui/color';
import { AlwaysStoppedAnimation } from '@nelyx/core/framework/animation/animations';
import { preparedTransfers } from '../platform/web/actors.ts';
import { wasmFactory } from './transports.mjs';
import { engineRoot, sourceIdentity, timeout } from '../tools/build.mjs';
const require = createRequire(import.meta.url),
  supply = canvasKitTestSupply(),
  width = 320,
  height = 180;
class ReferenceBox extends RenderBox {
  performLayout() {
    return new Size(240, 48);
  }
  localToGlobal(position) {
    return { x: position.dx + 24, y: position.dy + 100 };
  }
}
for (const profile of ['single-worker', 'threaded'])
  test(
    `Compound indicator/background paths match canonical Source pixels, alpha, stroke and curves (${profile})`,
    { timeout },
    async () => {
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(engineRoot, 'dist/engine-manifest.json')))
          .sourceSha256,
        sourceIdentity(),
      );
      const factory = await wasmFactory(path.join(engineRoot, 'dist', profile)),
        client = await EngineClient.connect(factory.create()),
        view = await client.openView(1),
        host = new WidgetHost(view);
      const ck = await require(supply.js)({ wasmBinary: fs.readFileSync(supply.wasm) }),
        renderKit =
          profile === 'single-worker'
            ? ck
            : await require(supply.js)({ wasmBinary: fs.readFileSync(supply.wasm) }),
        fonts = [
          {
            id: 'default',
            family: 'NelyxDefault',
            bytes: new Uint8Array(fs.readFileSync(path.join(engineRoot, 'dist/assets/font.ttf'))),
          },
        ],
        content = new CanvasKitProvider(ck, fonts),
        render = profile === 'single-worker' ? content : new CanvasKitProvider(renderKit, fonts),
        reference = new WebSkiaLibrary(renderKit, null, {
          id: 'indicator-reference',
          generation: 1,
        }),
        expected = renderKit.MakeSurface(width, height),
        box = new ReferenceBox();
      render.surface = renderKit.MakeSurface(width, height);
      render.resize = () => {};
      assert.ok(expected && render.surface);
      let mounted = false,
        time = 0;
      const pixels = (surface) => {
        const image = surface.makeImageSnapshot();
        try {
          return image
            .readPixels(0, 0, {
              width,
              height,
              colorType: renderKit.ColorType.RGBA_8888,
              alphaType: renderKit.AlphaType.Premul,
              colorSpace: renderKit.ColorSpace.SRGB,
            })
            .slice();
        } finally {
          image.delete();
        }
      };
      async function compare(entries, context, name) {
        const root = new Box([], {
          key: 'path-reference',
          properties: { x: 24, y: 100, width: 240, height: 48 },
          nativePaint: entries,
        });
        if (mounted) await host.update(root);
        else {
          mounted = true;
          await host.mount(root);
        }
        let state;
        for (let i = 0; i < 30; i++) {
          state = await view.request(
            p.opcodes.contentStep,
            body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
          );
          if (state.preparationReady) break;
        }
        assert.equal(state.preparationReady, true, name);
        const scene = await view.request(p.opcodes.preparationScene),
          packet = content.prepare(scene, profile === 'single-worker');
        if (render !== content)
          render.import(structuredClone(packet, { transfer: preparedTransfers(packet) }));
        await view.request(
          p.opcodes.tick,
          body(8, (v) => v.setFloat64(0, (time += 0.01), true)),
        );
        const frame = await view.request(p.opcodes.takeFrame);
        assert.equal(frame.status, p.statuses.ok, name);
        render.draw(frame, width, height, 1);
        render.retireExcept(frame.activePreparation);
        content.releasePacket(scene.preparation);
        const canvas = expected.getCanvas();
        canvas.clear(renderKit.Color(244, 246, 250, 1));
        canvas.save();
        canvas.translate(24, 100);
        reference.replay(canvas, { commands: context.commands }, 1);
        canvas.restore();
        const actual = pixels(render.surface),
          wanted = pixels(expected);
        let changed = 0,
          max = 0,
          ink = 0;
        for (let i = 0; i < actual.length; i++) {
          const delta = Math.abs(actual[i] - wanted[i]);
          if (delta) {
            changed++;
            max = Math.max(max, delta);
          }
          if (i % 4 !== 3 && actual[i] !== [244, 246, 250][i % 4]) ink++;
        }
        assert.ok(ink > 100, 'Actual paint work is required');
        // Fractional matrix composition can round an antialiased edge by one channel.
        assert.ok(max <= 1 && changed <= 64, JSON.stringify({ profile, name, changed, max }));
        assert.equal(frame.transactionWork, BigInt(host.execution.acknowledgedCommands));
        const receipt = body(24, (v) => {
          v.setBigUint64(0, frame.submission, true);
          v.setBigUint64(8, frame.device, true);
        });
        assert.equal((await view.request(p.opcodes.releaseFrame, receipt)).status, p.statuses.ok);
        assert.equal((await view.request(p.opcodes.publish, receipt)).status, p.statuses.ok);
      }
      try {
        const initial = await view.request(p.opcodes.inspect);
        await view.request(
          p.opcodes.metrics,
          body(40, (v) => {
            v.setBigUint64(0, initial.metrics + 1n, true);
            v.setFloat64(8, width, true);
            v.setFloat64(16, height, true);
            v.setFloat64(24, 1, true);
            v.setBigUint64(32, initial.lastInput, true);
          }),
        );
        box.layout(BoxConstraints.tight(new Size(240, 48)));
        for (const indicator of [
          new DropSliderValueIndicatorShape(),
          new RoundedRectSliderValueIndicatorShape(),
        ]) {
          for (const scenario of [
            { name: 'opaque', alpha: 255, scale: 1, label: 60, value: 0.5 },
            { name: 'overlap alpha', alpha: 128, scale: 1, label: 60, value: 0.5 },
            {
              name: 'alpha stroke RTL edge',
              alpha: 128,
              scale: 1,
              label: 120,
              value: 1,
              rtl: true,
              stroke: 0x804422ff,
            },
            {
              name: 'fractional activation',
              alpha: 128,
              scale: 0.5,
              label: 17,
              value: 1,
              stroke: 0xffcc4488,
              textScale: 1.5,
            },
            { name: 'overflow label', alpha: 128, scale: 1, label: 512, value: 0, textScale: 1.5 },
          ]) {
            const theme = new SliderThemeData({
              trackShape: new RoundedRectSliderTrackShape(),
              thumbShape: new RoundSliderThumbShape(),
              overlayShape: new RoundSliderOverlayShape(),
              trackHeight: 4,
              activeTrackColor: new Color(0xff333333),
              inactiveTrackColor: new Color(0xff555555),
              valueIndicatorShape: indicator,
              valueIndicatorColor: new Color(((scenario.alpha << 24) | 0x284870) >>> 0),
              valueIndicatorStrokeColor: scenario.stroke ? new Color(scenario.stroke) : null,
            });
            // This control compares only the Source background. Separate browser/Hermes
            // tests exercise real TextPainter resources and final Content text pixels.
            const painter = {
              width: scenario.label,
              height: 20,
              textDirection: scenario.rtl ? 'rtl' : 'ltr',
              _layoutSnapshot: () => ({ width: scenario.label, maxIntrinsicWidth: scenario.label }),
              paint() {},
            };
            const model = {
              theme,
              trackTheme: theme,
              thumbTheme: theme,
              visual: { direction: painter.textDirection, position: { value: scenario.value } },
              enabled: true,
              divisions: null,
              secondary: null,
              label: 'background control',
              enableProgress: 1,
              painter,
              reference: box,
              activation: scenario.scale,
              textScale: scenario.textScale ?? 1,
              screenWidth: width,
            };
            const entries = nativeMaterialSliderIndicator(model).entries.map(
                ({ reference, ...entry }) => entry,
              ),
              context = new PaintingContext();
            try {
              const track = theme.trackShape.getPreferredRect({
                  parentBox: box,
                  offset: Offset.zero,
                  sliderTheme: theme,
                  isEnabled: true,
                  isDiscrete: false,
                }),
                value = scenario.rtl ? 1 - scenario.value : scenario.value,
                center = new Offset(track.left + track.width * value, track.center.dy);
              indicator.paint(context, center, {
                activationAnimation: new AlwaysStoppedAnimation(scenario.scale),
                enableAnimation: new AlwaysStoppedAnimation(1),
                isDiscrete: false,
                labelPainter: painter,
                parentBox: box,
                sliderTheme: theme,
                textDirection: painter.textDirection,
                value: scenario.value,
                textScaleFactor: scenario.textScale ?? 1,
                sizeWithOverflow: new Size(width, height),
              });
              await compare(entries, context, indicator.constructor.name + ' ' + scenario.name);
            } finally {
              context.dispose();
            }
          }
        }
        const context = new PaintingContext(),
          source = new Path(),
          paint = new Paint();
        try {
          source.fillType = 'evenOdd';
          source.addRect(Rect.fromLTWH(10, -80, 80, 60));
          source.addRect(Rect.fromLTWH(30, -60, 40, 20));
          source.moveTo(110, -20);
          source.quadraticBezierTo(120, -70, 140, -20);
          source.cubicTo(150, -90, 170, -90, 180, -20);
          source.conicTo(200, -70, 220, -20, 0.5);
          source.close();
          paint.color = 0x80284870;
          context.canvas.drawPath(source, paint);
          const shape = {
            kind: 'rrect',
            radii: Array(8).fill(0),
            strokeWidth: 0,
            strokeAlign: 0,
            strokeColor: 0,
          };
          await compare(
            [
              {
                kind: 'path',
                shape,
                color: 0x80284870,
                geometry: { kind: 'program', rect: [0, 0, 240, 48] },
                path: {
                  fillRule: 'evenOdd',
                  commands: [
                    ['rect', 10, -80, 80, 60],
                    ['rect', 30, -60, 40, 20],
                    ['move', 110, -20],
                    ['quad', 120, -70, 140, -20],
                    ['cubic', 150, -90, 170, -90, 180, -20],
                    ['conic', 200, -70, 220, -20, 0.5],
                    ['close'],
                  ],
                },
              },
            ],
            context,
            'generic even-odd holes and all curve verbs',
          );
        } finally {
          context.dispose();
        }
        assert.ok(host.execution.acknowledgedCommands > 0);
        assert.equal(host.execution.appGeometryNodes, 0);
        assert.equal(host.execution.rejectedFallbacks, 0);
        assert.deepEqual(host.execution.rejectionReasons, {});
        console.log(
          JSON.stringify({
            profile,
            sourcePixelCases: 11,
            cppCommands: host.execution.acknowledgedCommands,
            appGeometryNodes: host.execution.appGeometryNodes,
            rejectedFallbacks: host.execution.rejectedFallbacks,
          }),
        );
      } finally {
        await host.close();
        await client.abort();
        content.close();
        if (render !== content) render.close();
        expected.delete();
        box.dispose();
        await reference.dispose();
      }
    },
  );
