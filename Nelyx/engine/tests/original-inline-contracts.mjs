// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { OriginalWidgetHost } from '../../runtime/engine-client/original.ts';
import { EngineClient, protocol as p, measurementBody } from '../../runtime/engine-client/index.ts';
import { SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { RichText } from '@nelyx/core/framework/widgets/rich-text';
import { WidgetSpan } from '@nelyx/core/framework/widgets/widget-span';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { PlaceholderSpanIndexSemanticsTag } from '@nelyx/core/framework/rendering/paragraph';
export function originalInlineContracts({ using, timeout }) {
  for (const profile of ['native', 'single-worker', 'threaded'])
    test(
      `${profile}: canonical WidgetSpan identities preserve their private scale and scoped semantics tag without accepting custom spans or foreign tags`,
      { timeout },
      () =>
        using(profile, async (f, transport) => {
          const client = await EngineClient.connect(transport),
            view = await client.openView(1),
            host = new OriginalWidgetHost(view, { pollEvents: false });
          const child = () => new SizedBox(20, 30, new ColoredBox({ color: 0xff224466 }));
          try {
            await f.resize(180, 100);
            await host.mount(
              new SizedBox(
                120,
                70,
                new RichText(
                  new TextSpan({
                    text: 'A',
                    style: new TextStyle({ fontSize: 18 }),
                    children: [
                      new WidgetSpan(child(), { alignment: 'baseline', baseline: 'alphabetic' }),
                    ],
                  }),
                  { textScaler: TextScaler.linear(1.5) },
                ),
              ),
            );
            let measured = 0;
            for (let i = 0; i < 30; i++) {
              const state = await f.step();
              if (state.measureRequest) {
                const request = await f.send(p.opcodes.measureRequest);
                const slots = request.nodes[0].paragraph.placeholders;
                assert.equal(slots.length, 1);
                assert.deepEqual(
                  [slots[0].width, slots[0].height, slots[0].baselineOffset],
                  [30, 45, 45],
                );
                assert.equal(
                  (
                    await f.send(
                      p.opcodes.measureResult,
                      measurementBody(request, {
                        width: request.nodes[0].width,
                        height: 60,
                        minimum: 40,
                        maximum: 90,
                        baseline: 48,
                        ideographicBaseline: 51,
                        placeholders: [{ x: 15, y: 3, width: 30, height: 45, direction: 0 }],
                      }),
                    )
                  ).status,
                  p.statuses.ok,
                );
                measured++;
              }
              if (state.preparationReady) break;
            }
            assert.equal(measured, 1);
            await f.tick();
            await f.present();
            const frame = await view.semanticsSnapshot(),
              paint = frame.nodes.find((n) => n.color === 0xff224466);
            assert.deepEqual(paint.matrix.slice(0, 4), [1.5, 0, 0, 1.5]);
            assert.equal(host.execution.tsLayoutFallbacks, 0);
            assert.equal(frame.transactionWork, BigInt(host.counters.commands));
            const commands = host.counters.commands;
            class CustomSpan extends WidgetSpan {}
            for (const [widget, reason] of [
              [
                new RichText(new TextSpan({ children: [new CustomSpan(child())] })),
                /paragraph-interactive-or-custom-span/,
              ],
              [
                new Semantics({
                  child: child(),
                  tagForChildren: new PlaceholderSpanIndexSemanticsTag(0),
                }),
                /semantics-property:tagForChildren/,
              ],
            ]) {
              await assert.rejects(host.update(widget), reason);
              assert.equal(host.counters.commands, commands);
            }
          } finally {
            await host.close();
            await client.abort();
          }
        }),
    );
}
