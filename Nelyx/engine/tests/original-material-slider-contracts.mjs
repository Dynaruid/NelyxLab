// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineClient, protocol as p } from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { Slider } from '@nelyx/material/slider';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Color } from '@nelyx/core/ui/color';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';

export function originalMaterialSliderContracts({ using, timeout }) {
  test(
    'native: original Material Slider preserves themes, controlled callbacks, RTL, disabled state and C++ paint programs',
    { timeout },
    () =>
      using('native', async (f, transport) => {
        const client = await EngineClient.connect(transport),
          view = await client.openView(1),
          errors = [],
          calls = [],
          key = new GlobalKey('material-slider');
        const host = new OriginalWidgetHost(view, {
          pollEvents: false,
          platform: { kind: 'native', operatingSystem: 'windows' },
          onError: (error) => errors.push(error),
        });
        const previous = FlutterError.onError;
        FlutterError.onError = (details) => errors.push(details.exception);
        const tree = ({
          modern = false,
          rtl = false,
          disabled = false,
          value = 0.5,
          divisions = 4,
          label = null,
        } = {}) =>
          new Directionality(
            rtl ? 'rtl' : 'ltr',
            new Theme(
              new ThemeData(),
              new SizedBox(
                280,
                72,
                new Slider({
                  key,
                  value,
                  divisions,
                  label,
                  year2023: !modern,
                  secondaryTrackValue: 0.8,
                  activeColor: new Color(0xffbb4466),
                  inactiveColor: new Color(0xff4455bb),
                  thumbColor: new Color(0xff33aa77),
                  onChanged: disabled ? null : (value) => calls.push(['change', value]),
                  onChangeStart: (value) => calls.push(['start', value]),
                  onChangeEnd: (value) => calls.push(['end', value]),
                }),
              ),
            ),
          );
        const prepare = async () => {
          for (let i = 0; i < 30; i++) {
            await host.flush();
            const s = await f.inspect();
            if (
              s.preparation ||
              s.contentWake ||
              s.document !== s.activeDocument ||
              s.metrics !== s.layoutMetrics
            )
              await f.ready();
            else await f.tick();
            if ((await f.inspect()).renderWake) await f.present();
            await host.pollEvents();
            const frame = await view.semanticsSnapshot();
            if (
              frame.publication &&
              frame.document === frame.publishedDocument &&
              frame.metrics === frame.publishedMetrics
            )
              return frame;
          }
          throw Error('Source Material Slider did not publish');
        };
        const peer = (frame) =>
          frame.nodes.find((n) => n.semantics?.role === p.semanticsRoles.slider);
        const paint = (frame) =>
          frame.nodes.flatMap((n) => n.nativePaint ?? []).filter((e) => e.kind !== 'hitRegion');
        try {
          await f.resize(300, 200);
          await host.mount(tree());
          let frame = await prepare();
          assert.ok(frame.capabilities & p.capabilities.paintPrograms);
          assert.equal(peer(frame).control, null);
          assert.equal(peer(frame).semantics.range.value, 0.5);
          assert.ok(
            paint(frame).some(
              (e) => e.kind === 'elevationShadow' && e.transparentOccluder && e.elevation === 1,
            ),
          );
          assert.ok(
            paint(frame).some(
              (e) => e.kind === 'shape' && e.color === 0xff33aa77 && e.width === 20,
            ),
          );
          assert.ok(paint(frame).length >= 9);
          const target = peer(frame),
            x = target.bounds.x + target.width * 0.8,
            y = target.bounds.y + target.height / 2;
          await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
          await f.tick();
          await host.pollEvents();
          await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x, y });
          await f.tick();
          await host.pollEvents();
          assert.equal(calls[0][0], 'start');
          assert.equal(calls.at(-1)[0], 'end');
          assert.ok(
            calls.some(([kind, value]) => kind === 'change' && value === 0.75),
            JSON.stringify(calls),
          );
          frame = await prepare();
          assert.equal(
            peer(frame).semantics.range.value,
            0.5,
            'The App may refuse a controlled change',
          );
          await host.update(tree({ modern: true, rtl: true, value: 0.25 }));
          frame = await prepare();
          assert.ok(paint(frame).some((e) => e.kind === 'save'));
          assert.ok(paint(frame).some((e) => e.kind === 'restore'));
          assert.ok(
            paint(frame).some(
              (e) =>
                e.kind === 'shape' && e.color === 0xff33aa77 && e.width === 4 && e.height === 44,
            ),
          );
          assert.equal(paint(frame).filter((e) => e.kind === 'elevationShadow').length, 0);
          assert.equal(peer(frame).semantics.range.value, 0.25);
          await host.update(tree({ modern: true, disabled: true, divisions: 1e6 }));
          frame = await prepare();
          assert.equal(peer(frame).semantics.range.readOnly, true);
          assert.ok(
            paint(frame).length < 12,
            'Source tick-density policy skips a huge invisible repetition',
          );
          calls.length = 0;
          await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
          await f.input('end', 0, { pointer: true, kind: 'mouse', buttons: 0, x, y });
          await f.tick();
          await host.pollEvents();
          assert.deepEqual(calls, []);
          assert.ok(key.currentState.surfaceKey.currentContext.findRenderObject().model.theme);
          const state = await f.inspect();
          assert.ok(state.gestureWork > 0n);
          assert.equal(state.controlWork, 0n);
          assert.equal(state.rejected, 0n);
          assert.equal(state.transactionWork, BigInt(host.counters.commands));
          assert.equal(host.execution.tsLayoutFallbacks, 0);
          assert.equal(host.execution.appGeometryNodes, 0);
          assert.deepEqual(errors, []);
          for (const at of [1, 2]) {
            await f.tick(at);
            await host.pollEvents();
            await host.flush();
          }
          const beforeLabel = await f.inspect();
          await assert.rejects(
            host.update(tree({ label: '값 50%' })),
            /synchronous-App-text-layout/,
          );
          const afterLabel = await f.inspect();
          assert.equal(afterLabel.document, beforeLabel.document);
          assert.equal(afterLabel.transactionWork, beforeLabel.transactionWork);
          assert.ok(errors.length > 0);
          errors.length = 0;
          await host.update(tree());
          await prepare();
          assert.equal(
            host.execution.rejectedFallbacks,
            1,
            'A label remains an explicit W9-06-A obligation, without a hidden TS text renderer',
          );
        } catch (error) {
          if (errors.length)
            throw new AggregateError([...errors, error], 'Source Material Slider failed');
          throw error;
        } finally {
          FlutterError.onError = previous;
          await host.close();
          await client.abort();
        }
      }),
  );
}
