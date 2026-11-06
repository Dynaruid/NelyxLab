// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { canvasKitTestSupply } from './canvaskit-supply.mjs';
import { CanvasKitProvider } from '../render/canvaskit-web/provider.ts';
import { WebSkiaLibrary } from '../../skia/packages/web/src/library.ts';
import { EngineClient, protocol as p, body } from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { engineRoot, timeout, sourceIdentity } from '../tools/build.mjs';
import { preparedTransfers } from '../platform/web/actors.ts';
import { wasmFactory } from './transports.mjs';
import { Slider } from '@nelyx/material/slider';
import { SliderTheme, SliderThemeData } from '@nelyx/material/slider-theme';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import {
  RectangularSliderTrackShape,
  RoundSliderThumbShape,
  SliderComponentShape,
} from '@nelyx/material/slider-shapes';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { PaintingContext } from '@nelyx/core/framework/painting/context';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Size } from '@nelyx/core/ui/size';
import { Color } from '@nelyx/core/ui/color';

const require = createRequire(import.meta.url),
  supply = canvasKitTestSupply();
for (const profile of ['single-worker', 'threaded'])
  test(
    `Material Slider CanvasKit pixels match original Source shape painting (${profile})`,
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
        errors = [];
      const host = new OriginalWidgetHost(view, {
          pollEvents: false,
          platform: { kind: 'web', operatingSystem: 'windows' },
          onError: (error) => errors.push(error),
        }),
        key = new GlobalKey('material-pixel-reference');
      const ck = await require(supply.js)({ wasmBinary: fs.readFileSync(supply.wasm) }),
        renderKit =
          profile === 'single-worker'
            ? ck
            : await require(supply.js)({ wasmBinary: fs.readFileSync(supply.wasm) });
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
      ];
      const content = new CanvasKitProvider(ck, fonts),
        render = profile === 'single-worker' ? content : new CanvasKitProvider(renderKit, fonts);
      const reference = new WebSkiaLibrary(renderKit, null, { id: 'reference', generation: 1 });
      const width = 320,
        height = 100,
        surface = renderKit.MakeSurface(width, height),
        expected = renderKit.MakeSurface(width, height);
      render.surface = surface;
      render.resize = () => {};
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
      const cases = [
        { name: 'round continuous', value: 0.25 },
        { name: 'round pressed paint', value: 0.5, pressed: true },
        { name: 'round discrete RTL', value: 0.25, divisions: 4, rtl: true },
        { name: 'round disabled', value: 0.75, disabled: true, divisions: 4 },
        { name: 'gapped continuous', modern: true, value: 0.25 },
        { name: 'gapped pressed paint', modern: true, value: 0.5, pressed: true },
        { name: 'gapped discrete RTL', modern: true, value: 0.25, divisions: 4, rtl: true },
        { name: 'gapped narrow', modern: true, value: 0.5, boxWidth: 72 },
        { name: 'gapped dense ticks', modern: true, value: 0.5, divisions: 1000000 },
        {
          name: 'explicit padding',
          modern: true,
          value: 0.7,
          padding: { left: 8, right: 12, top: 4, bottom: 6 },
        },
        {
          name: 'rectangular track',
          value: 0.3,
          divisions: 5,
          theme: new SliderThemeData({ trackShape: new RectangularSliderTrackShape() }),
        },
        {
          name: 'different preferred thumb radii',
          value: 0.2,
          theme: new SliderThemeData({
            thumbShape: new RoundSliderThumbShape({
              enabledThumbRadius: 18,
              disabledThumbRadius: 5,
            }),
            overlayShape: SliderComponentShape.noOverlay,
          }),
        },
      ];
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
        for (const scenario of cases) {
          const root = new Directionality(
            scenario.rtl ? 'rtl' : 'ltr',
            new Theme(
              new ThemeData(),
              new SliderTheme(
                scenario.theme ?? new SliderThemeData(),
                new Padding(
                  { left: 20, top: 20 },
                  new SizedBox(
                    scenario.boxWidth ?? 280,
                    72,
                    new Slider({
                      key,
                      value: scenario.value,
                      divisions: scenario.divisions ?? null,
                      year2023: !scenario.modern,
                      secondaryTrackValue: 0.8,
                      activeColor: new Color(0xffbb4466),
                      inactiveColor: new Color(0xff4455bb),
                      thumbColor: new Color(0xff33aa77),
                      onChanged: scenario.disabled ? null : () => {},
                      ...(scenario.padding ? { padding: scenario.padding } : {}),
                    }),
                  ),
                ),
              ),
            ),
          );
          if (mounted) await host.update(root);
          else {
            mounted = true;
            await host.mount(root);
          }
          if (scenario.pressed) {
            // Exercise Source paint states independently of the browser gesture acceptance test.
            const source = key.currentState.surfaceKey.currentContext.findRenderObject();
            source.model = {
              ...source.model,
              visual: { ...source.model.visual, pressProgress: 0.75, dragging: true },
            };
            source.markNeedsPaint();
          }
          await host.flush();
          let state;
          for (let i = 0; i < 30; i++) {
            state = await view.request(
              p.opcodes.contentStep,
              body(8, (v) => v.setUint32(0, p.limits.contentPerStep, true)),
            );
            if (state.preparationReady) break;
          }
          assert.equal(state.preparationReady, true, scenario.name);
          const scene = await view.request(p.opcodes.preparationScene),
            packet = content.prepare(scene, profile === 'single-worker');
          if (render !== content)
            render.import(structuredClone(packet, { transfer: preparedTransfers(packet) }));
          await view.request(
            p.opcodes.tick,
            body(8, (v) => v.setFloat64(0, (time += 0.01), true)),
          );
          const frame = await view.request(p.opcodes.takeFrame);
          assert.equal(frame.status, p.statuses.ok);
          render.draw(frame, width, height, 1);
          render.retireExcept(frame.activePreparation);
          content.releasePacket(scene.preparation);
          const node = frame.nodes.find((n) =>
            n.nativePaint?.some((e) => e.kind === 'elevationShadow' || e.kind === 'save'),
          );
          assert.ok(node, scenario.name);
          const source = key.currentState.surfaceKey.currentContext.findRenderObject(),
            clone = new source.constructor(source.model),
            context = new PaintingContext();
          try {
            clone.layout(BoxConstraints.tight(new Size(node.width, node.height)));
            clone.paint(context);
            const canvas = expected.getCanvas();
            canvas.clear(renderKit.Color(244, 246, 250, 1));
            canvas.save();
            const [a, b, c, d, x, y] = node.matrix;
            canvas.concat([a, c, x, b, d, y, 0, 0, 1]);
            reference.replay(canvas, { commands: context.commands }, 1);
            canvas.restore();
            const actual = pixels(surface),
              wanted = pixels(expected);
            let changed = 0,
              max = 0,
              first;
            for (let i = 0; i < actual.length; i++) {
              const delta = Math.abs(actual[i] - wanted[i]);
              if (delta) {
                changed++;
                max = Math.max(max, delta);
                first ??= {
                  x: Math.floor(i / 4) % width,
                  y: Math.floor(i / (4 * width)),
                  actual: Array.from(actual.subarray(i - (i % 4), i - (i % 4) + 4)),
                  wanted: Array.from(wanted.subarray(i - (i % 4), i - (i % 4) + 4)),
                };
              }
            }
            // Separate local pictures may round a fractional SkScalar edge by one channel value.
            assert.ok(
              max <= 1 && changed <= 32,
              JSON.stringify({ profile, scenario: scenario.name, changed, max, first }),
            );
          } finally {
            context.dispose();
            clone.dispose();
          }
          const receipt = body(24, (v) => {
            v.setBigUint64(0, frame.submission, true);
            v.setBigUint64(8, frame.device, true);
          });
          assert.equal((await view.request(p.opcodes.releaseFrame, receipt)).status, p.statuses.ok);
          assert.equal((await view.request(p.opcodes.publish, receipt)).status, p.statuses.ok);
        }
        assert.deepEqual(errors, []);
        assert.equal(host.execution.tsLayoutFallbacks, 0);
        assert.equal(host.execution.appGeometryNodes, 0);
      } finally {
        await host.close();
        await client.abort();
        content.close();
        if (render !== content) render.close();
        expected.delete();
        await reference.dispose();
      }
    },
  );
