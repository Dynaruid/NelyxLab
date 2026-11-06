// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EngineClient,
  EngineError,
  keyBody,
  protocol as p,
} from '../../runtime/engine-client/index.ts';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { Slider } from '@nelyx/material/slider';
import { SliderInteraction } from '@nelyx/material/slider-theme';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { CupertinoSlider } from '@nelyx/cupertino/slider';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetState, WidgetStatesController } from '@nelyx/core/framework/widgets/widget-state';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';

export function originalSliderInteractionContracts({ using, timeout }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: Source Slider keyboard, semantic range and disable during capture preserve controlled state`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            errors = [],
            calls = [],
            events = [],
            focus = new FocusNode(),
            states = new WidgetStatesController(),
            host = new OriginalWidgetHost(view, {
              pollEvents: false,
              platform: { kind: 'native', operatingSystem: 'windows' },
              onError: (error) => errors.push(error),
            });
          const previous = FlutterError.onError,
            poll = view.pollInteractionEvents.bind(view);
          FlutterError.onError = (details) => errors.push(details.exception);
          view.pollInteractionEvents = async () => {
            const result = await poll();
            events.push(...result.events);
            return result;
          };
          let clock = 0;
          const tree = ({
            design = 'material',
            rtl = false,
            disabled = false,
            value = 20,
            interaction = SliderInteraction.tapAndSlide,
          } = {}) => {
            const options = {
              value,
              min: 10,
              max: 30,
              divisions: 4,
              onChanged: disabled ? null : (value) => calls.push(['change', value]),
              onChangeStart: (value) => calls.push(['start', value]),
              onChangeEnd: (value) => calls.push(['end', value]),
            };
            return new Directionality(
              rtl ? 'rtl' : 'ltr',
              design === 'material'
                ? new Theme(
                    new ThemeData(),
                    new SizedBox(
                      280,
                      72,
                      new Slider({
                        ...options,
                        focusNode: focus,
                        statesController: states,
                        allowedInteraction: interaction,
                        semanticFormatterCallback: (value) => `units ${value}`,
                      }),
                    ),
                  )
                : new CupertinoTheme(
                    new CupertinoThemeData(),
                    new SizedBox(280, 72, new CupertinoSlider(options)),
                  ),
            );
          };
          const peer = (frame) =>
            frame.nodes.find((node) => node.semantics?.role === p.semanticsRoles.slider);
          const prepare = async (accepts = () => true) => {
            for (let attempt = 0; attempt < 20; ++attempt) {
              await host.flush();
              let state = await f.inspect();
              if (
                state.preparation ||
                state.contentWake ||
                state.document !== state.activeDocument ||
                state.metrics !== state.layoutMetrics
              )
                await f.ready();
              await f.tick(++clock);
              if ((await f.inspect()).renderWake) await f.present();
              await host.pollEvents();
              await host.flush();
              state = await view.semanticsSnapshot();
              if (
                state.publication &&
                state.document === state.publishedDocument &&
                state.metrics === state.publishedMetrics &&
                state.device === state.publishedDevice &&
                !state.interactionCount &&
                accepts(state)
              )
                return state;
            }
            throw Error('Source Slider interaction did not publish');
          };
          const key = async (code, down = true, repeat = false, modifiers = 0) => {
            const frame = await prepare();
            const result = await view.request(
              p.opcodes.key,
              keyBody(frame.publication, code, down, modifiers, repeat),
            );
            assert.equal(result.status, p.statuses.ok);
            await host.pollEvents();
            await prepare();
          };
          const press = async (code, modifiers = 0) => {
            await key(code, true, false, modifiers);
            await key(code, false, false, modifiers);
          };
          const semantic = async (action, value) => {
            const frame = await prepare();
            await view.semanticAction(peer(frame).node, frame.publication, action, 0n, value);
            await host.pollEvents();
            return prepare();
          };
          const adjusted = (value) => [
            ['start', 20],
            ['change', value],
            ['end', value],
          ];
          try {
            await f.resize(320, 200);
            await host.mount(tree());
            let frame = await prepare();
            assert.equal(peer(frame).semantics.value, 'units 20');
            assert.equal(peer(frame).semantics.increasedValue, 'units 25');
            assert.equal(peer(frame).semantics.decreasedValue, 'units 15');
            focus.requestFocus();
            await prepare(() => focus.hasPrimaryFocus);
            calls.length = 0;
            await key(39);
            await key(39, true, true);
            await key(39, false);
            assert.deepEqual(calls, [...adjusted(25), ...adjusted(25)]);
            assert.equal(peer(await prepare()).semantics.range.value, 20);
            calls.length = 0;
            await press(37, 2);
            assert.deepEqual(calls, [], 'Ctrl does not match the original unmodified shortcut');
            await press(37);
            assert.deepEqual(calls, adjusted(15));
            await host.update(tree({ rtl: true }));
            await prepare(() => focus.hasPrimaryFocus);
            for (const [code, value] of [
              [39, 15],
              [37, 25],
              [38, 25],
              [40, 15],
            ]) {
              calls.length = 0;
              await press(code);
              assert.deepEqual(calls, adjusted(value), `Source RTL shortcut ${code}`);
            }
            calls.length = 0;
            await semantic('increment');
            assert.deepEqual(calls, adjusted(25));
            calls.length = 0;
            await semantic('decrement');
            assert.deepEqual(calls, adjusted(15));
            calls.length = 0;
            frame = await semantic('setValue', 23);
            assert.deepEqual(calls, adjusted(25));
            assert.equal(peer(frame).semantics.range.value, 20);
            calls.length = 0;
            await assert.rejects(
              view.semanticAction(peer(frame).node, frame.publication, 'setValue', 0n, 31),
              (error) => error instanceof EngineError && error.status === p.statuses.invalidValue,
            );
            await host.pollEvents();
            assert.deepEqual(calls, []);
            for (const [interaction, expected] of [
              [SliderInteraction.tapOnly, adjusted(25)],
              [
                SliderInteraction.slideOnly,
                [
                  ['start', 20],
                  ['end', 20],
                ],
              ],
              [SliderInteraction.slideThumb, []],
            ]) {
              await host.update(tree({ interaction }));
              frame = await prepare();
              const target = peer(frame),
                x = target.bounds.x + target.width * 0.8,
                y = target.bounds.y + target.height / 2;
              calls.length = 0;
              for (const [phase, buttons] of [
                ['begin', 1],
                ['end', 0],
              ]) {
                await f.input(phase, 0, { pointer: true, kind: 'mouse', buttons, x, y });
                await f.tick();
                await host.pollEvents();
              }
              assert.deepEqual(calls, expected, String(interaction));
            }
            for (const design of ['material', 'cupertino']) {
              await host.update(tree({ design, value: 25 }));
              frame = await prepare();
              assert.equal(peer(frame).semantics.range.value, 25);
              await host.update(tree({ design }));
              frame = await prepare();
              const target = peer(frame),
                x = target.bounds.x + target.width / 2,
                y = target.bounds.y + target.height / 2;
              calls.length = 0;
              events.length = 0;
              await f.input('begin', 0, { pointer: true, kind: 'mouse', buttons: 1, x, y });
              await f.tick();
              await host.pollEvents();
              await f.input('update', 0, {
                pointer: true,
                kind: 'mouse',
                buttons: 1,
                x: x + 48,
                y,
              });
              await f.tick();
              await host.pollEvents();
              assert.ok(
                calls.some(([kind]) => kind === 'start'),
                design + ' begins in Source',
              );
              assert.ok((await f.inspect()).nodes.some((node) => node.flags & 4));
              await host.update(tree({ design, disabled: true }));
              frame = await prepare();
              assert.equal(peer(frame).semantics.range.readOnly, true);
              assert.equal(
                (await f.inspect()).nodes.some((node) => node.flags & 4),
                false,
              );
              assert.equal(
                events.filter(
                  (event) =>
                    event.kind === p.events.gesture && event.status === p.gestureKinds.cancel,
                ).length,
                1,
                design + ' retires capture once',
              );
              assert.equal(states.value.contains(WidgetState.pressed), false);
              assert.equal(states.value.contains(WidgetState.dragged), false);
              calls.length = 0;
              for (const [phase, buttons] of [
                ['update', 1],
                ['end', 0],
              ]) {
                assert.equal(
                  (
                    await f.input(phase, 0, {
                      pointer: true,
                      kind: 'mouse',
                      buttons,
                      x: x + 64,
                      y,
                    })
                  ).status,
                  p.statuses.stale,
                  'A retired capture rejects its remaining samples',
                );
                await f.tick();
                await host.pollEvents();
              }
              assert.deepEqual(calls, [], design + ' cannot complete a canceled Source change');
              for (const action of ['increment', 'decrement', 'setValue'])
                await assert.rejects(
                  view.semanticAction(peer(frame).node, frame.publication, action, 0n, 25),
                  (error) =>
                    error instanceof EngineError && error.status === p.statuses.capabilityMissing,
                );
              await host.update(tree({ design }));
              await prepare();
              calls.length = 0;
              await semantic('setValue', 23);
              assert.deepEqual(calls, design === 'material' ? adjusted(25) : [['change', 25]]);
            }
            const state = await f.inspect();
            assert.ok(state.keyWork > 0n);
            assert.ok(state.semanticsWork > 0n);
            assert.ok(state.gestureWork > 0n);
            assert.equal(state.controlWork, 0n);
            assert.equal(state.transactionWork, BigInt(host.counters.commands));
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            assert.equal(host.execution.appGeometryNodes, 0);
            assert.equal(host.execution.rejectedFallbacks, 0);
            assert.deepEqual(errors, []);
          } finally {
            FlutterError.onError = previous;
            await host.close();
            focus.dispose();
            states.dispose();
            await client.abort();
          }
        }),
    );
}
